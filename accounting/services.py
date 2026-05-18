from decimal import Decimal
from django.db import transaction
from .models import JournalEntry, JournalItem, Account, Transaction as SingleTransaction

def create_journal_entry_from_transaction(single_tx):
    """
    Creates a double-entry JournalEntry from a single Transaction.
    """
    with transaction.atomic():
        entry = JournalEntry.objects.create(
            date=single_tx.date,
            description=single_tx.description
        )

        # Determine debit/credit based on account types
        # This is a simplified logic for rental income/expense
        if single_tx.amount > 0: # Income or Positive expense?
            # In a real system, we'd handle this more strictly
            debit_account = single_tx.payment_account
            credit_account = single_tx.category
        else:
            debit_account = single_tx.category
            credit_account = single_tx.payment_account

        abs_amount = abs(single_tx.amount)

        JournalItem.objects.create(
            entry=entry,
            account=debit_account,
            property=single_tx.property,
            debit=abs_amount
        )
        JournalItem.objects.create(
            entry=entry,
            account=credit_account,
            property=single_tx.property,
            credit=abs_amount
        )

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

def close_books(end_date):
    """
    Locks all journal entries up to the end_date.
    """
    JournalEntry.objects.filter(date__lte=end_date).update(is_closed=True)
