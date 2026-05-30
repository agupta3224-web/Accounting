import sys
import os
import django
import shutil
from django.utils.text import slugify

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "SimpleRentalBooks.settings")
django.setup()

from django.contrib.auth.models import User
from accounting.models import Account, AccountingClass, Company
from accounting.services import setup_standard_accounts
from django.db import connection, connections
from django.core.management import call_command
from django.conf import settings

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
    else:
        print("Superuser 'admin' already exists.")

    # 2. Check for existing companies
    existing_companies = Company.objects.all()
    if not existing_companies.exists():
        company = Company.objects.create(name="Default Company")
        print(f"Created initial company: {company.name}")
    else:
        print(f"Found {existing_companies.count()} existing companies.")

    # 3. Create a template database for new companies if it doesn't exist
    template_path = os.path.join("data", "template.sqlite3")
    if not os.path.exists(template_path):
        print("Creating template database...")
        call_command('migrate', database='company_template', interactive=False)
    else:
        print("Template database already exists.")

    # 4. Migrate existing company database files to name-based sharding
    data_dir = settings.BASE_DIR / "data"
    for company in Company.objects.all():
        # Generate the correct name-based filename
        from accounting.utils import get_company_db_name
        new_alias = get_company_db_name(company.name)
        new_filename = f"{new_alias}.sqlite3"
        new_path = data_dir / new_filename

        # Check if we need to update db_name in master
        if company.db_name != new_alias:
            print(f"Upgrading metadata for Company '{company.name}'...")
            company.db_name = new_alias
            company.save()

        # Handle file migration
        if not new_path.exists():
            # Check for legacy ID-based file
            old_filename = f"company_{company.id}.sqlite3"
            old_path = data_dir / old_filename

            if old_path.exists():
                print(f"Migrating Company '{company.name}' data file: {old_filename} -> {new_filename}")
                shutil.move(old_path, new_path)
            else:
                # If neither exists, initialize from template
                print(f"Initializing data file for Company '{company.name}' from template...")
                shutil.copy2(template_path, new_path)
        else:
            print(f"Data file for Company '{company.name}' found: {new_filename}")

        # 5. Sync Ledger for the company to ensure consistent signs with the new logic
        print(f"  Syncing ledger for '{company.name}'...")
        from accounting.router import set_active_db
        from accounting.models import Transaction as SingleTransaction
        from accounting.services import create_journal_entry_from_transaction

        set_active_db(new_alias)
        try:
            for tx in SingleTransaction.objects.all():
                create_journal_entry_from_transaction(tx)
        except Exception as e:
            print(f"  Warning: Could not sync ledger for {company.name}: {e}")
        finally:
            set_active_db('default')

if __name__ == "__main__":
    seed()
