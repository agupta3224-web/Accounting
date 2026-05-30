from decimal import Decimal
from django.db import transaction
from .models import JournalEntry, JournalItem, Account, Transaction as SingleTransaction

def create_journal_entry_from_transaction(single_tx):
    """
    Creates or updates a double-entry JournalEntry from a single Transaction.
    Unified Logic:
    Positive amount = Money IN (Debit Cash, Credit Category)
    Negative amount = Money OUT (Credit Cash, Debit Category)
    """
    with transaction.atomic():
        if single_tx.journal_entry:
            entry = single_tx.journal_entry
            entry.date = single_tx.date
            entry.description = single_tx.description
            entry.save()
            # Clear existing items for re-creation
            entry.items.all().delete()
        else:
            entry = JournalEntry.objects.create(
                company_id=single_tx.company_id,
                date=single_tx.date,
                description=single_tx.description
            )

        # Determine debit/credit based on sign (Unified Sign Convention)
        # Positive amount = Money IN (Debit Cash/Asset, Credit Category/Liability/Equity)
        # Negative amount = Money OUT (Debit Category/Liability/Equity, Credit Cash/Asset)

        abs_amount = abs(single_tx.amount)
        is_money_out = (single_tx.amount < 0)

        if is_money_out:
            # Money OUT: Debit Category, Credit Payment Account
            debit_account = single_tx.category
            credit_account = single_tx.payment_account
        else:
            # Money IN: Debit Payment Account, Credit Category
            debit_account = single_tx.payment_account
            credit_account = single_tx.category

        # Link to the appropriate AccountingClass
        acc_class = None
        if single_tx.property and single_tx.property.accounting_class:
            acc_class = single_tx.property.accounting_class
        elif single_tx.llc and single_tx.llc.accounting_class:
            acc_class = single_tx.llc.accounting_class

        JournalItem.objects.create(
            entry=entry,
            account=debit_account,
            property=single_tx.property,
            accounting_class=acc_class,
            vendor=single_tx.vendor,
            debit=abs_amount
        )
        JournalItem.objects.create(
            entry=entry,
            account=credit_account,
            property=single_tx.property,
            accounting_class=acc_class,
            vendor=single_tx.vendor,
            credit=abs_amount
        )

        if not single_tx.journal_entry:
            single_tx.journal_entry = entry
            single_tx.save()

    return entry

def reconcile_account(account_id, end_date, statement_balance):
    """
    Checks if the book balance matches the statement balance.
    """
    account = Account.objects.get(id=account_id)
    # Simplified calculation
    items = JournalItem.objects.filter(account=account, entry__date__lte=end_date)
    total_debit = sum(i.debit for i in items)
    total_credit = sum(i.credit for i in items)

    if account.account_type in ['ASSET', 'EXPENSE']:
        balance = total_debit - total_credit
    else:
        balance = total_credit - total_debit

    return balance == Decimal(statement_balance)

def close_books(end_date, company_id=None):
    """
    Locks all journal entries up to the end_date for a specific company.
    """
    filters = {'date__lte': end_date}
    if company_id:
        filters['company_id'] = company_id
    JournalEntry.objects.filter(**filters).update(is_closed=True)

def setup_standard_accounts(company):
    """
    Seeds a standard Chart of Accounts for a new company.
    """
    accounts = [
        # Assets (10000s)
        ('10000', 'Cash', 'ASSET', 'Main checking account'),
        ('11000', 'Accounts Receivable', 'ASSET', 'Unpaid rent'),
        ('15000', 'Rental Property', 'ASSET', 'Building value'),

        # Liabilities (20000s)
        ('20000', 'Accounts Payable', 'LIABILITY', 'Unpaid bills'),
        ('21000', 'Security Deposits', 'LIABILITY', 'Tenant deposits held'),
        ('25000', 'Mortgage Payable', 'LIABILITY', 'Loan balance'),

        # Equity (30000s)
        ('30000', 'Owner Investment', 'EQUITY', 'Initial capital'),
        ('30100', 'Owner Draw', 'EQUITY', 'Personal withdrawals'),
        ('39000', 'Retained Earnings', 'EQUITY', 'Accumulated profit'),

        # Income (40000s)
        ('40000', 'Rental Income', 'INCOME', 'Monthly rent'),
        ('41000', 'Late Fees', 'INCOME', 'Late payment penalties'),

        # Expenses (50000s)
        ('50000', 'Repairs & Maintenance', 'EXPENSE', 'Fixing things'),
        ('51000', 'Property Taxes', 'EXPENSE', 'Annual taxes'),
        ('52000', 'Insurance', 'EXPENSE', 'Property insurance'),
        ('53000', 'Management Fees', 'EXPENSE', 'Property manager costs'),
        ('PMCLR', 'PM Clearing', 'ASSET', 'Clearing account for property manager imports'),
    ]

    for code, name, acc_type, desc in accounts:
        Account.objects.get_or_create(company_id=company.id, code=code, defaults={
            'name': name,
            'account_type': acc_type,
            'description': desc
        })
