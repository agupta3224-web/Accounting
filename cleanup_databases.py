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

def cleanup_databases():
    companies = Company.objects.all()
    active_db_files = {f"{c.db_name}.sqlite3" for c in companies if c.db_name}
    active_db_files.add("master.sqlite3")
    active_db_files.add("template.sqlite3")
    active_db_files.add("test_company.sqlite3")

    print(f"Active database files: {active_db_files}")

    for filename in os.listdir(data_dir):
        if filename.endswith(".sqlite3") and filename not in active_db_files:
            file_path = data_dir / filename
            print(f"Removing redundant database file: {filename}")
            os.remove(file_path)

if __name__ == "__main__":
    cleanup_databases()
    print("Cleanup complete.")
