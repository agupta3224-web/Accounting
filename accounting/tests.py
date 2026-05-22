import io
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import LLC, Property, Account, Transaction, JournalItem, Company
from .services import create_journal_entry_from_transaction

class AccountingTest(TestCase):
    def setUp(self):
        self.llc = LLC.objects.create(name="Rental LLC")
        self.prop = Property.objects.create(short_name="Apartment 1", llc=self.llc)
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

    def test_delete_account(self):
        # Create a fresh company to avoid context issues
        company = Company.objects.create(name="Delete Test Co")
        acc = Account.objects.create(name="Delete Me", account_type="EXPENSE", company=company)

        # Set active company in session
        session = self.client.session
        session['active_company_id'] = company.id
        session.save()

        # Delete should succeed
        response = self.client.post(reverse('delete_account', args=[acc.id]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Account.objects.filter(id=acc.id).exists())

        # Now try to delete an account WITH transactions
        acc2 = Account.objects.create(name="Dont Delete Me", account_type="EXPENSE", company=company)
        bank = Account.objects.create(name="Bank", account_type="ASSET", company=company)
        tx = Transaction.objects.create(
            date="2024-05-18",
            description="Used",
            amount=100,
            category=acc2,
            payment_account=bank,
            company=company
        )

        response = self.client.post(reverse('delete_account', args=[acc2.id]))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Account.objects.filter(id=acc2.id).exists())

    def test_import_iif_coa(self):
        company = Company.objects.create(name="IIF Test Co")
        session = self.client.session
        session['active_company_id'] = company.id
        session.save()

        iif_content = (
            "!ACCNT\tNAME\tACCNTTYPE\tACCNUM\tDESC\n"
            "ACCNT\tChecking\tBANK\t1000\tOperating Account\n"
            "ACCNT\tUtilities:Electricity\tEXP\t6000\tElectric bill\n"
        )
        iif_file = SimpleUploadedFile("test.iif", iif_content.encode('utf-8'))

        response = self.client.post(reverse('import_coa_iif'), {'file': iif_file})
        self.assertEqual(response.status_code, 302)

        # Verify accounts created
        self.assertTrue(Account.objects.filter(name="Checking", company=company).exists())
        self.assertTrue(Account.objects.filter(name="Utilities", company=company).exists())
        self.assertTrue(Account.objects.filter(name="Electricity", company=company, parent__name="Utilities").exists())

    def test_import_iif_coa_duplicate_code(self):
        company = Company.objects.create(name="IIF Duplicate Test Co")
        # Create an account with code 1000
        Account.objects.create(name="Old Cash", code="1000", account_type="ASSET", company=company)

        # IIF has "New Cash" with code 1000
        iif_content = (
            "!ACCNT\tNAME\tACCNTTYPE\tACCNUM\n"
            "ACCNT\tNew Cash\tBANK\t1000\n"
        )
        iif_file = SimpleUploadedFile("test.iif", iif_content.encode('utf-8'))

        # Set active company in session
        session = self.client.session
        session['active_company_id'] = company.id
        session.save()

        # This currently fails with UNIQUE constraint error
        response = self.client.post(reverse('import_coa_iif'), {'file': iif_file})
        self.assertEqual(response.status_code, 302)

        # Should have updated the name or at least not crashed
        # Depending on how we decide to handle it.
        # Usually if code matches, it's the same account renamed.
        self.assertTrue(Account.objects.filter(code="1000", name="New Cash", company=company).exists())
