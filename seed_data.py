import sys
import os
import django

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "SimpleRentalBooks.settings")
django.setup()

from django.contrib.auth.models import User
from accounting.models import Account, AccountingClass

def seed():
    # 1. Create Superuser
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
        print("Created superuser: admin / admin123")

    # 2. Seed Chart of Accounts
    accounts = [
        # Assets (1000s)
        ('1000', 'Cash', 'ASSET', 'Main checking account'),
        ('1100', 'Accounts Receivable', 'ASSET', 'Unpaid rent'),
        ('1500', 'Rental Property', 'ASSET', 'Building value'),

        # Liabilities (2000s)
        ('2000', 'Accounts Payable', 'LIABILITY', 'Unpaid bills'),
        ('2100', 'Security Deposits', 'LIABILITY', 'Tenant deposits held'),
        ('2500', 'Mortgage Payable', 'LIABILITY', 'Loan balance'),

        # Equity (3000s)
        ('3000', 'Owner Investment', 'EQUITY', 'Initial capital'),
        ('3900', 'Retained Earnings', 'EQUITY', 'Accumulated profit'),

        # Income (4000s)
        ('4000', 'Rental Income', 'INCOME', 'Monthly rent'),
        ('4100', 'Late Fees', 'INCOME', 'Late payment penalties'),

        # Expenses (5000s)
        ('5000', 'Repairs & Maintenance', 'EXPENSE', 'Fixing things'),
        ('5100', 'Property Taxes', 'EXPENSE', 'Annual taxes'),
        ('5200', 'Insurance', 'EXPENSE', 'Property insurance'),
        ('5300', 'Management Fees', 'EXPENSE', 'Property manager costs'),
    ]

    for code, name, acc_type, desc in accounts:
        Account.objects.get_or_create(code=code, defaults={
            'name': name,
            'account_type': acc_type,
            'description': desc
        })
    print(f"Seeded {len(accounts)} accounts into COA.")

if __name__ == "__main__":
    seed()
