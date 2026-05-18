from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from .models import LLC, Property, Account, Transaction
from .services import create_journal_entry_from_transaction

class AccountingTest(TestCase):
    def setUp(self):
        self.llc = LLC.objects.create(name="Rental LLC")
        self.prop = Property.objects.create(name="Apartment 1", llc=self.llc)
        self.bank = Account.objects.create(name="Checking", account_type="ASSET")
        self.rent = Account.objects.create(name="Rent Income", account_type="INCOME")
        self.expense_acc = Account.objects.create(name="Repairs", account_type="EXPENSE")

    def test_single_entry_to_double_entry(self):
        tx = Transaction.objects.create(
            date=timezone.now().date(),
            description="Jan Rent",
            amount=1000,
            property=self.prop,
            category=self.rent,
            payment_account=self.bank
        )
        entry = create_journal_entry_from_transaction(tx)

        self.assertEqual(entry.items.count(), 2)
        debit_item = entry.items.get(debit__gt=0)
        credit_item = entry.items.get(credit__gt=0)

        self.assertEqual(debit_item.account, self.bank)
        self.assertEqual(credit_item.account, self.rent)
        self.assertEqual(debit_item.debit, 1000)
        self.assertEqual(credit_item.credit, 1000)

    def test_transaction_views(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)

        response = self.client.get(reverse('add_transaction'))
        self.assertEqual(response.status_code, 200)

        # Test adding a transaction via POST
        data = {
            'date': '2024-05-18',
            'description': 'Repair sink',
            'amount': -150.00,
            'property': self.prop.id,
            'category': self.expense_acc.id,
            'payment_account': self.bank.id
        }
        response = self.client.post(reverse('add_transaction'), data)
        self.assertEqual(response.status_code, 302) # Redirect
        self.assertEqual(Transaction.objects.filter(description='Repair sink').count(), 1)
