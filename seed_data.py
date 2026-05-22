import sys
import os
import django

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "SimpleRentalBooks.settings")
django.setup()

from django.contrib.auth.models import User
from accounting.models import Account, AccountingClass, Company
from accounting.services import setup_standard_accounts
from django.db import connection, connections
from django.core.management import call_command

import time

def seed():
    # Wait a moment for disk I/O if needed
    time.sleep(1)

    # 0. Check if tables exist
    if "accounting_company" not in connection.introspection.table_names():
        print("ERROR: Database tables are missing. Please run migrations first.")
        return

    # 1. Create Superuser
    if not User.objects.filter(username='admin').exists():
        try:
            User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
            print("Created superuser: admin / admin123")
        except Exception as e:
            print(f"Note: Could not create superuser via script: {e}")
            print("You can create one manually using: python manage.py createsuperuser")

    # 2. Ensure at least one company exists
    company, created = Company.objects.get_or_create(name="Default Company")
    if created:
        print(f"Created initial company: {company.name}")

    # 3. Create a template database for new companies
    print("Creating template database...")
    call_command('migrate', database='company_template', interactive=False)

    # 4. Seed Chart of Accounts into the template
    # Since we can't easily switch the default in seed script without hints,
    # we'll just ensure template is migrated.
    print("Template database ready.")

    # 5. Seed initial company's DB if it doesn't exist
    db_path = f"data/company_{company.id}.sqlite3"
    if not os.path.exists(db_path):
        import shutil
        shutil.copy2("data/template.sqlite3", db_path)
        print(f"Initialized data file for {company.name}")

if __name__ == "__main__":
    seed()
