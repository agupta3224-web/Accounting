import os
import sqlite3
import django
from pathlib import Path

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SimpleRentalBooks.settings')
django.setup()

from django.conf import settings

def repair_db():
    master_db_path = settings.DATABASES['default']['NAME']
    print(f"Repairing Master Database: {master_db_path}")

    if not os.path.exists(master_db_path):
        print("No master database found. Skipping repair.")
        return

    conn = sqlite3.connect(master_db_path)
    cursor = conn.cursor()

    # 1. Ensure essential tables and columns exist for 0001_initial consolidation
    # We create them if they are missing so that --fake-initial can succeed.
    tables_to_ensure = [
        ('accounting_company', 'CREATE TABLE IF NOT EXISTS "accounting_company" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(255) NOT NULL, "created_at" datetime NOT NULL, "db_name" varchar(255) NULL)'),
        ('accounting_globalsetting', 'CREATE TABLE IF NOT EXISTS "accounting_globalsetting" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "key" varchar(255) NOT NULL UNIQUE, "value" text NOT NULL)'),
        ('accounting_journalentry', 'CREATE TABLE IF NOT EXISTS "accounting_journalentry" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "company_id" integer NULL, "date" date NOT NULL, "doc_num" varchar(50) NOT NULL, "description" text NOT NULL, "is_closed" bool NOT NULL, "created_at" datetime NOT NULL)'),
        ('accounting_vendor', 'CREATE TABLE IF NOT EXISTS "accounting_vendor" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "company_id" integer NULL, "company_name" varchar(255) NOT NULL, "contact_name" varchar(255) NOT NULL, "address_line_1" varchar(255) NOT NULL, "address_line_2" varchar(255) NOT NULL, "city" varchar(100) NOT NULL, "state" varchar(2) NOT NULL, "zip_code" varchar(10) NOT NULL, "phone_number" varchar(20) NOT NULL, "email_address" varchar(254) NOT NULL)'),
        ('accounting_account', 'CREATE TABLE IF NOT EXISTS "accounting_account" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "company_id" integer NULL, "code" varchar(20) NULL, "name" varchar(255) NOT NULL, "description" text NOT NULL, "account_type" varchar(20) NOT NULL, "parent_id" bigint NULL REFERENCES "accounting_account" ("id") DEFERRABLE INITIALLY DEFERRED)'),
        ('accounting_accountingclass', 'CREATE TABLE IF NOT EXISTS "accounting_accountingclass" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "company_id" integer NULL, "name" varchar(255) NOT NULL, "created_at" datetime NOT NULL, "parent_id" bigint NULL REFERENCES "accounting_accountingclass" ("id") DEFERRABLE INITIALLY DEFERRED)'),
        ('accounting_llc', 'CREATE TABLE IF NOT EXISTS "accounting_llc" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "company_id" integer NULL, "name" varchar(255) NOT NULL, "created_at" datetime NOT NULL, "accounting_class_id" bigint NULL UNIQUE REFERENCES "accounting_accountingclass" ("id") DEFERRABLE INITIALLY DEFERRED)'),
        ('accounting_property', 'CREATE TABLE IF NOT EXISTS "accounting_property" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "short_name" varchar(50) NOT NULL, "sub_class_name" varchar(255) NOT NULL, "address_line_1" varchar(255) NOT NULL, "address_line_2" varchar(255) NOT NULL, "city" varchar(100) NOT NULL, "state" varchar(2) NOT NULL, "zip_code" varchar(10) NOT NULL, "accounting_class_id" bigint NULL UNIQUE REFERENCES "accounting_accountingclass" ("id") DEFERRABLE INITIALLY DEFERRED, "llc_id" bigint NOT NULL REFERENCES "accounting_llc" ("id") DEFERRABLE INITIALLY DEFERRED)'),
        ('accounting_subscription', 'CREATE TABLE IF NOT EXISTS "accounting_subscription" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "is_active" bool NOT NULL, "expiry_date" date NULL, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED)'),
        ('accounting_transaction', 'CREATE TABLE IF NOT EXISTS "accounting_transaction" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "company_id" integer NULL, "date" date NOT NULL, "description" text NOT NULL, "amount" decimal NOT NULL, "category_id" bigint NOT NULL REFERENCES "accounting_account" ("id") DEFERRABLE INITIALLY DEFERRED, "journal_entry_id" bigint NULL UNIQUE REFERENCES "accounting_journalentry" ("id") DEFERRABLE INITIALLY DEFERRED, "llc_id" bigint NULL REFERENCES "accounting_llc" ("id") DEFERRABLE INITIALLY DEFERRED, "payment_account_id" bigint NOT NULL REFERENCES "accounting_account" ("id") DEFERRABLE INITIALLY DEFERRED, "property_id" bigint NULL REFERENCES "accounting_property" ("id") DEFERRABLE INITIALLY DEFERRED, "vendor_id" bigint NULL REFERENCES "accounting_vendor" ("id") DEFERRABLE INITIALLY DEFERRED)'),
        ('accounting_journalitem', 'CREATE TABLE IF NOT EXISTS "accounting_journalitem" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "debit" decimal NOT NULL, "credit" decimal NOT NULL, "memo" varchar(255) NOT NULL, "account_id" bigint NOT NULL REFERENCES "accounting_account" ("id") DEFERRABLE INITIALLY DEFERRED, "accounting_class_id" bigint NULL REFERENCES "accounting_accountingclass" ("id") DEFERRABLE INITIALLY DEFERRED, "entry_id" bigint NOT NULL REFERENCES "accounting_journalentry" ("id") DEFERRABLE INITIALLY DEFERRED, "property_id" bigint NULL REFERENCES "accounting_property" ("id") DEFERRABLE INITIALLY DEFERRED, "vendor_id" bigint NULL REFERENCES "accounting_vendor" ("id") DEFERRABLE INITIALLY DEFERRED)'),
        ('accounting_importrule', 'CREATE TABLE IF NOT EXISTS "accounting_importrule" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "company_id" integer NULL, "search_text" varchar(255) NOT NULL, "created_at" datetime NOT NULL, "category_id" bigint NOT NULL REFERENCES "accounting_account" ("id") DEFERRABLE INITIALLY DEFERRED)'),
    ]

    for table, sql in tables_to_ensure:
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
        if not cursor.fetchone():
            print(f"  Creating missing table '{table}'...")
            # Note: We use the SQL from 0001_initial as a reference.
            # Some ForeignKeys might fail if tables are created out of order but
            # SQLite allows this with deferred checks.
            cursor.execute(sql)
        else:
            # Table exists, check for missing columns (specifically db_name in accounting_company)
            if table == 'accounting_company':
                try:
                    cursor.execute("SELECT db_name FROM accounting_company LIMIT 1")
                except sqlite3.OperationalError:
                    print("  Adding missing column 'db_name' to 'accounting_company'...")
                    cursor.execute("ALTER TABLE accounting_company ADD COLUMN db_name VARCHAR(255)")

    conn.commit()
    conn.close()
    print("Repair complete.")

if __name__ == "__main__":
    repair_db()
