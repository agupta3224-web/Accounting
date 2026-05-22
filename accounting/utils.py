import csv
import io
import openpyxl
from datetime import datetime
from decimal import Decimal
from .models import Transaction, Property, Account, JournalEntry, JournalItem
from .services import create_journal_entry_from_transaction

def parse_date(date_str):
    formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d']
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return datetime.now().date()

def import_csv_transactions(file_obj, property_id, payment_account_id, format_type='bank', company_id=None):
    """
    Import transactions from CSV.
    """
    decoded_file = file_obj.read().decode('utf-8-sig')
    io_string = io.StringIO(decoded_file)
    reader = csv.DictReader(io_string)

    prop = Property.objects.get(id=property_id)
    payment_account = Account.objects.get(id=payment_account_id)

    transactions = []
    for row in reader:
        # csv.DictReader can produce None keys for empty columns
        row = {k.lower(): v for k, v in row.items() if k is not None}

        if format_type == 'property_manager':
            date_str = row.get('transaction date') or row.get('date')
            desc = row.get('comment') or row.get('description')
            amount = Decimal(row.get('total') or row.get('amount') or '0')
        elif format_type == 'cc':
            date_str = row.get('date') or row.get('trans. date')
            desc = row.get('description') or row.get('memo')
            amount = Decimal(row.get('charge') or row.get('amount') or '0')
        else: # bank
            date_str = row.get('date')
            desc = row.get('description') or row.get('memo')
            amount = Decimal(row.get('amount') or '0')

        date = parse_date(date_str) if date_str else datetime.now().date()
        category = Account.objects.filter(account_type='EXPENSE').first()

        tx = Transaction.objects.create(
            company_id=company_id,
            date=date,
            description=desc or "Imported CSV",
            amount=amount,
            property=prop,
            payment_account=payment_account,
            category=category
        )
        create_journal_entry_from_transaction(tx)
        transactions.append(tx)

    return transactions

def parse_csv_preview(file_obj):
    """
    Parse CSV and return rows for preview/categorization.
    """
    decoded_file = file_obj.read().decode('utf-8-sig')
    io_string = io.StringIO(decoded_file)
    reader = csv.DictReader(io_string)

    rows = []
    for row in reader:
        row = {k.lower(): v for k, v in row.items() if k is not None}
        rows.append(row)
    return rows

def import_iif_coa(file_obj, company_id):
    """
    Import Chart of Accounts from QuickBooks IIF file (tab-delimited).
    """
    decoded_file = file_obj.read().decode('utf-8-sig')
    lines = decoded_file.splitlines()

    # Mapping QB types to our types
    TYPE_MAP = {
        'BANK': 'ASSET',
        'AR': 'ASSET',
        'OCASSET': 'ASSET',
        'FIXASSET': 'ASSET',
        'OASSET': 'ASSET',
        'AP': 'LIABILITY',
        'CCARD': 'LIABILITY',
        'OCLIAB': 'LIABILITY',
        'LLIAB': 'LIABILITY',
        'EQUITY': 'EQUITY',
        'INC': 'INCOME',
        'EXP': 'EXPENSE',
        'EXINC': 'INCOME',
        'EXEXP': 'EXPENSE',
    }

    headers = []
    accounts_imported = 0

    for line in lines:
        if not line.strip():
            continue

        parts = line.split('\t')
        if parts[0] == '!ACCNT':
            headers = [p.upper() for p in parts[1:]]
            continue

        if parts[0] == 'ACCNT':
            # Create a dict of data, stripping quotes from values
            data = {k: v.strip('"') for k, v in zip(headers, parts[1:])}
            full_name = data.get('NAME')
            qb_type = data.get('ACCNTTYPE')
            code = data.get('ACCNUM')
            desc = data.get('DESC', '')

            if full_name and qb_type:
                acc_type = TYPE_MAP.get(qb_type, 'EXPENSE')

                # Handle hierarchical names (e.g. "Income:Rental Income")
                name_parts = full_name.split(':')
                parent = None

                for i, part in enumerate(name_parts):
                    current_name = part.strip()
                    is_last = (i == len(name_parts) - 1)

                    if is_last:
                        # Final account in the chain
                        # If code is provided, try to find by code first to avoid UNIQUE constraint
                        acc = None
                        if code:
                            acc = Account.objects.filter(company_id=company_id, code=code).first()

                        if not acc:
                            # Try to find by name and parent
                            acc = Account.objects.filter(company_id=company_id, name=current_name, parent=parent).first()

                        if acc:
                            # Update existing
                            acc.name = current_name
                            acc.parent = parent
                            acc.account_type = acc_type
                            acc.code = code if code else acc.code
                            acc.description = desc or acc.description
                            acc.save()
                        else:
                            # Create new
                            Account.objects.create(
                                company_id=company_id,
                                name=current_name,
                                parent=parent,
                                account_type=acc_type,
                                code=code if code else None,
                                description=desc
                            )
                        accounts_imported += 1
                    else:
                        # Parent account
                        parent, _ = Account.objects.get_or_create(
                            company_id=company_id,
                            name=current_name,
                            parent=parent,
                            defaults={'account_type': acc_type}
                        )
    return accounts_imported

def import_excel_property_manager(file_obj, company_id=None):
    """
    Import transactions from Excel based on specific PM mapping:
    B: Date, C: Type, D: Account, E: Doc Num, G: Class, H: Amount
    """
    wb = openpyxl.load_workbook(file_obj, data_only=True)
    ws = wb.active

    # Mapping columns (1-indexed for openpyxl)
    COL_DATE = 2
    COL_TYPE = 3
    COL_ACCOUNT = 4
    COL_DOC_NUM = 5
    COL_CLASS = 7
    COL_AMOUNT = 8

    entries = []
    # Try to find a default LLC if none exists
    from .models import LLC
    default_llc, _ = LLC.objects.get_or_create(name="Imported LLC", company_id=company_id)

    for row in ws.iter_rows(min_row=2): # Skip header
        date_val = row[COL_DATE-1].value
        type_val = row[COL_TYPE-1].value
        acc_name = row[COL_ACCOUNT-1].value
        doc_num = row[COL_DOC_NUM-1].value
        class_name = row[COL_CLASS-1].value
        amount_val = row[COL_AMOUNT-1].value

        if date_val is None or amount_val is None:
            continue

        # 1. Get or create Property (Class)
        prop = Property.objects.filter(short_name=class_name, llc__company_id=company_id).first()
        if not prop:
            prop = Property.objects.create(short_name=class_name, llc=default_llc)

        # 2. Get or create Account
        acc, _ = Account.objects.get_or_create(name=acc_name, company_id=company_id, defaults={'account_type': 'EXPENSE'})

        # 3. Create Journal Entry
        entry_date = date_val
        if isinstance(date_val, str):
            entry_date = parse_date(date_val)
        elif hasattr(date_val, 'date'):
            entry_date = date_val.date()

        entry = JournalEntry.objects.create(
            company_id=company_id,
            date=entry_date,
            doc_num=doc_num or "",
            description=f"{type_val} - {doc_num}"
        )

        clearing_acc, _ = Account.objects.get_or_create(name="PM Clearing", company_id=company_id, defaults={'account_type': 'ASSET'})

        amount = Decimal(str(amount_val))
        if amount > 0: # Usually income
             JournalItem.objects.create(entry=entry, account=acc, property=prop, credit=amount)
             JournalItem.objects.create(entry=entry, account=clearing_acc, property=prop, debit=amount)
        else: # Expense
             JournalItem.objects.create(entry=entry, account=acc, property=prop, debit=abs(amount))
             JournalItem.objects.create(entry=entry, account=clearing_acc, property=prop, credit=abs(amount))

        entries.append(entry)

    return entries
