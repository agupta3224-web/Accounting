from django.test import TransactionTestCase, Client
from accounting.models import Company, Account
from django.conf import settings
from django.db import connections
import os

class MultiDbTest(TransactionTestCase):
    def test_company_creation_creates_db_file(self):
        # Create a new company
        response = self.client.post('/companies/add/', {'name': 'Company X'})
        self.assertEqual(response.status_code, 302)

        company = Company.objects.get(name='Company X')
        db_path = settings.BASE_DIR / "data" / f"company_{company.id}.sqlite3"
        self.assertTrue(db_path.exists())

    def test_database_switching(self):
        # 1. Create two companies
        c1 = Company.objects.create(name='Company 1')
        c2 = Company.objects.create(name='Company 2')

        # Initialize their DBs
        for c in [c1, c2]:
            import shutil
            db_path = settings.BASE_DIR / "data" / f"company_{c.id}.sqlite3"
            shutil.copy2(settings.BASE_DIR / "data" / "template.sqlite3", db_path)

            # Register DB in settings for the duration of the test process
            db_alias = f"company_{c.id}"
            settings.DATABASES[db_alias] = {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': db_path,
                'ATOMIC_REQUESTS': False,
                'AUTOCOMMIT': True,
            }

        # 2. Add an account to Company 1
        self.client.post(f'/companies/{c1.id}/select/')
        self.client.post('/coa/add/', {'name': 'C1 Account', 'account_type': 'ASSET', 'code': '111'})

        # 3. Add an account to Company 2
        self.client.post(f'/companies/{c2.id}/select/')
        self.client.post('/coa/add/', {'name': 'C2 Account', 'account_type': 'ASSET', 'code': '222'})

        # 4. Verify separation
        # In Company 2 context
        response = self.client.get('/coa/')
        self.assertContains(response, 'C2 Account')
        self.assertNotContains(response, 'C1 Account')

        # In Company 1 context
        self.client.post(f'/companies/{c1.id}/select/')
        response = self.client.get('/coa/')
        self.assertContains(response, 'C1 Account')
        self.assertNotContains(response, 'C2 Account')
