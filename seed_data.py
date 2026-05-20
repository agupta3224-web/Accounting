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

import time

def seed():
    # Wait a moment for disk I/O if needed
    time.sleep(1)

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

    # 3. Seed Chart of Accounts using the shared service
    setup_standard_accounts(company)
    print(f"Seeded accounts into COA for {company.name}.")

if __name__ == "__main__":
    seed()
