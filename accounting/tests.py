import io
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from .models import LLC, Property, Account, Transaction, JournalItem, Company
from .services import create_journal_entry_from_transaction
from .router import set_active_db
import shutil

class AccountingTest(TransactionTestCase):
    databases = '__all__'

    def tearDown(self):
        set_active_db('default')
        super().tearDown()

    def setUp(self):
        self.company = Company.objects.create(name="Test Company", db_name="test_company")
        # Initialize company DB
        self.db_alias = self.company.db_name
        set_active_db(self.db_alias)

        # Set active company in session
        session = self.client.session
        session['active_company_id'] = self.company.id
        session.save()

        self.llc = LLC.objects.create(name="Rental LLC", company_id=self.company.id)
        self.prop = Property.objects.create(short_name="Apartment 1", llc=self.llc)
        self.bank = Account.objects.create(name="Checking", account_type="ASSET", company_id=self.company.id)
        self.rent = Account.objects.create(name="Rent Income", account_type="INCOME", company_id=self.company.id)
        self.expense_acc = Account.objects.create(name="Repairs", account_type="EXPENSE", company_id=self.company.id)

    def test_single_entry_to_double_entry(self):
        tx = Transaction.objects.create(
            date=timezone.now().date(),
            description="Jan Rent",
            amount=1000,
            property=self.prop,
            category=self.rent,
            payment_account=self.bank,
            company_id=self.company.id
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
        # Manually ensure middleware sets the right DB for the client requests
        session = self.client.session
        session['active_company_id'] = self.company.id
        session.save()

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

        set_active_db(self.db_alias)
        self.assertEqual(Transaction.objects.filter(description='Repair sink').count(), 1)

    def test_delete_account(self):
        acc = Account.objects.create(name="Delete Me", account_type="EXPENSE", company_id=self.company.id)

        # Delete should succeed
        response = self.client.post(reverse('delete_account', args=[acc.id]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Account.objects.filter(id=acc.id).exists())

        # Now try to delete an account WITH transactions
        acc2 = Account.objects.create(name="Dont Delete Me", account_type="EXPENSE", company_id=self.company.id)
        tx = Transaction.objects.create(
            date="2024-05-18",
            description="Used",
            amount=100,
            category=acc2,
            payment_account=self.bank,
            company_id=self.company.id
        )

        response = self.client.post(reverse('delete_account', args=[acc2.id]))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Account.objects.filter(id=acc2.id).exists())

    def test_import_iif_coa(self):
        iif_content = (
            "!ACCNT\tNAME\tACCNTTYPE\tACCNUM\tDESC\n"
            "ACCNT\tCheckingIIF\tBANK\t1000\tOperating Account\n"
        )
        iif_file = SimpleUploadedFile("test.iif", iif_content.encode('utf-8'))

        response = self.client.post(reverse('import_coa_iif'), {'file': iif_file})
        self.assertEqual(response.status_code, 302)

        # Verify account created
        set_active_db(self.db_alias)
        self.assertTrue(Account.objects.filter(name="CheckingIIF", company_id=self.company.id).exists())

    def test_import_iif_coa_duplicate_code(self):
        # Create an account with code 1000
        Account.objects.create(name="Old Cash", code="1000", account_type="ASSET", company_id=self.company.id)

        # IIF has "New Cash" with code 1000
        iif_content = (
            "!ACCNT\tNAME\tACCNTTYPE\tACCNUM\n"
            "ACCNT\tNew Cash\tBANK\t1000\n"
        )
        iif_file = SimpleUploadedFile("test.iif", iif_content.encode('utf-8'))

        response = self.client.post(reverse('import_coa_iif'), {'file': iif_file})
        self.assertEqual(response.status_code, 302)

        set_active_db(self.db_alias)
        self.assertTrue(Account.objects.filter(code="1000", name="New Cash", company_id=self.company.id).exists())

    def test_pnl_net_balances(self):
        """
        Verify that P&L correctly calculates net balances including spending and refunds.
        Intuitive Convention: Positive Income = Money IN, Positive Expense = Money OUT
        """
        # 1. Normal Rent Income (Money IN - Positive)
        Transaction.objects.create(
            date=timezone.now().date(),
            description="Rent",
            amount=1000,
            category=self.rent,
            payment_account=self.bank,
            company_id=self.company.id
        )
        # 2. Rent Refund (Money OUT - Negative)
        Transaction.objects.create(
            date=timezone.now().date(),
            description="Rent Refund",
            amount=-200,
            category=self.rent,
            payment_account=self.bank,
            company_id=self.company.id
        )
        # 3. Normal Repair (Money OUT - Positive)
        Transaction.objects.create(
            date=timezone.now().date(),
            description="Repair",
            amount=500,
            category=self.expense_acc,
            payment_account=self.bank,
            company_id=self.company.id
        )
        # 4. Repair Refund (Money IN - Negative)
        Transaction.objects.create(
            date=timezone.now().date(),
            description="Repair Refund",
            amount=-50,
            category=self.expense_acc,
            payment_account=self.bank,
            company_id=self.company.id
        )

        # Synchronize journal entries
        for tx in Transaction.objects.filter(company_id=self.company.id):
            create_journal_entry_from_transaction(tx)

        # Check P&L View
        response = self.client.get(reverse('pnl'))
        self.assertEqual(response.status_code, 200)

        # Net Income should be (1000 - 200) = 800
        self.assertEqual(response.context['total_income'], 800)
        # Net Expense should be (500 - 50) = 450
        self.assertEqual(response.context['total_expense'], 450)
        # Net Profit should be 800 - 450 = 350
        self.assertEqual(response.context['net_profit'], 350)

        # Check Dashboard View
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.context['net_income'], 350)
