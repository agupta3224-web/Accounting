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
        row = {k.lower(): v for k, v in row.items()}

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

        # 1. Get or create Property (Class) - Scoped to company via LLC
        prop, _ = Property.objects.get_or_create(short_name=class_name, llc__company_id=company_id, defaults={'llc': default_llc})

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
