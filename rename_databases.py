import os
import django
import shutil
from django.utils.text import slugify

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SimpleRentalBooks.settings')
django.setup()

from accounting.models import Company
from django.conf import settings

data_dir = settings.BASE_DIR / "data"

def migrate_databases():
    companies = Company.objects.all()
    print(f"Found {companies.count()} companies to migrate.")

    for company in companies:
        old_filename = f"company_{company.id}.sqlite3"
        old_path = data_dir / old_filename

        new_alias = slugify(company.name).replace('-', '_')
        new_filename = f"{new_alias}.sqlite3"
        new_path = data_dir / new_filename

        print(f"Migrating Company '{company.name}' (ID: {company.id}):")

        if old_path.exists():
            if not new_path.exists():
                print(f"  Renaming {old_filename} to {new_filename}...")
                shutil.move(old_path, new_path)
            else:
                print(f"  {new_filename} already exists. Skipping file rename.")
        else:
            print(f"  {old_filename} not found. Checking if {new_filename} exists...")
            if new_path.exists():
                print(f"  {new_filename} already exists.")
            else:
                print(f"  Warning: Neither {old_filename} nor {new_filename} found.")

        print(f"  Updating db_name in master database to '{new_alias}'...")
        company.db_name = new_alias
        company.save()

if __name__ == "__main__":
    migrate_databases()
    print("Migration complete.")
