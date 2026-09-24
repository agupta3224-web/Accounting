import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from sqlalchemy import text

Base = declarative_base()

def ensure_db_schema(engine):
    from . import models  # Ensure all model tables are registered
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            # Check categories table columns
            res = conn.execute(text("PRAGMA table_info(categories)")).fetchall()
            cols = {row[1] for row in res}
            if cols:
                if "account_number" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN account_number VARCHAR(20)"))
                if "sub_type" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN sub_type VARCHAR(100)"))
                if "description" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN description TEXT"))
                if "is_active" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                if "created_at" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN created_at DATETIME"))
                if "parent_account_id" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN parent_account_id INTEGER"))
                if "opening_balance" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN opening_balance FLOAT DEFAULT 0.0"))
                if "opening_balance_date" not in cols:
                    conn.execute(text("ALTER TABLE categories ADD COLUMN opening_balance_date VARCHAR(10)"))

                # Check if categories table has a legacy UNIQUE constraint on name
                indexes = conn.execute(text("PRAGMA index_list(categories)")).fetchall()
                has_unique_name = False
                for idx in indexes:
                    if len(idx) > 2 and idx[2] == 1:
                        idx_name = idx[1]
                        idx_cols = conn.execute(text(f"PRAGMA index_info('{idx_name}')")).fetchall()
                        col_names = [c[2] for c in idx_cols]
                        if col_names == ['name']:
                            has_unique_name = True
                            break
                if has_unique_name:
                    conn.execute(text("PRAGMA foreign_keys=OFF"))
                    conn.execute(text("""
                        CREATE TABLE categories_temp_migration (
                            id INTEGER PRIMARY KEY,
                            account_number VARCHAR(20),
                            name VARCHAR(150) NOT NULL,
                            type VARCHAR(50) NOT NULL,
                            sub_type VARCHAR(100),
                            description TEXT,
                            is_active BOOLEAN DEFAULT 1,
                            is_repair_category BOOLEAN DEFAULT 0,
                            is_rental_income BOOLEAN DEFAULT 0,
                            parent_account_id INTEGER,
                            opening_balance FLOAT DEFAULT 0.0,
                            opening_balance_date VARCHAR(10),
                            created_at DATETIME
                        )
                    """))
                    conn.execute(text("""
                        INSERT INTO categories_temp_migration (id, account_number, name, type, sub_type, description, is_active, is_repair_category, is_rental_income, parent_account_id, opening_balance, opening_balance_date, created_at)
                        SELECT id, account_number, name, type, sub_type, description, is_active, is_repair_category, is_rental_income, parent_account_id, COALESCE(opening_balance, 0.0), opening_balance_date, created_at
                        FROM categories
                    """))
                    conn.execute(text("DROP TABLE categories"))
                    conn.execute(text("ALTER TABLE categories_temp_migration RENAME TO categories"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_categories_id ON categories (id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_categories_account_number ON categories (account_number)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_categories_name ON categories (name)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_categories_parent_account_id ON categories (parent_account_id)"))
                    conn.execute(text("PRAGMA foreign_keys=ON"))

            # Check properties table columns for address form fields
            res_p = conn.execute(text("PRAGMA table_info(properties)")).fetchall()
            cols_p = {row[1] for row in res_p}
            if cols_p:
                if "address_line1" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN address_line1 VARCHAR(255)"))
                if "address_line2" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN address_line2 VARCHAR(255)"))
                if "city" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN city VARCHAR(100)"))
                if "state" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN state VARCHAR(50)"))
                if "zip_code" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN zip_code VARCHAR(20)"))
                if "acquisition_cost" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN acquisition_cost FLOAT"))
                if "acquisition_date" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN acquisition_date VARCHAR(20)"))
                if "unit_number" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN unit_number VARCHAR(50)"))
                if "parent_property_id" not in cols_p:
                    conn.execute(text("ALTER TABLE properties ADD COLUMN parent_property_id INTEGER"))

            # Check classes table columns for entity setup interview attributes
            res_c = conn.execute(text("PRAGMA table_info(classes)")).fetchall()
            cols_c = {row[1] for row in res_c}
            if cols_c:
                class_cols_to_add = [
                    ("entity_type", "VARCHAR(50) DEFAULT 'LLC'"),
                    ("tax_classification", "VARCHAR(50)"),
                    ("tax_form", "VARCHAR(50)"),
                    ("ein", "VARCHAR(50)"),
                    ("office_address_line1", "VARCHAR(255)"),
                    ("office_address_line2", "VARCHAR(255)"),
                    ("office_city", "VARCHAR(100)"),
                    ("office_state", "VARCHAR(50)"),
                    ("office_zip", "VARCHAR(20)"),
                    ("mailing_address_line1", "VARCHAR(255)"),
                    ("mailing_address_line2", "VARCHAR(255)"),
                    ("mailing_city", "VARCHAR(100)"),
                    ("mailing_state", "VARCHAR(50)"),
                    ("mailing_zip", "VARCHAR(20)"),
                    ("contact_name", "VARCHAR(150)"),
                    ("contact_phone", "VARCHAR(50)")
                ]
                for col_name, col_type in class_cols_to_add:
                    if col_name not in cols_c:
                        conn.execute(text(f"ALTER TABLE classes ADD COLUMN {col_name} {col_type}"))

            # Check check_records table columns
            res_chk = conn.execute(text("PRAGMA table_info(check_records)")).fetchall()
            cols_chk = {row[1] for row in res_chk}
            if cols_chk:
                if "transaction_type" not in cols_chk:
                    conn.execute(text("ALTER TABLE check_records ADD COLUMN transaction_type VARCHAR(50) DEFAULT 'CHECK'"))
                if "source" not in cols_chk:
                    conn.execute(text("ALTER TABLE check_records ADD COLUMN source VARCHAR(50) DEFAULT 'MANUAL'"))

            conn.commit()
    except Exception as e:
        print(f"Warning during schema migration check: {e}")

def get_db():
    from .company_manager import company_manager
    if company_manager.SessionLocal is not None:
        db = company_manager.SessionLocal()
    else:
        sample_path = company_manager.get_db_path("sample_company")
        temp_engine = create_engine(f"sqlite:///{sample_path}", connect_args={"check_same_thread": False})
        ensure_db_schema(temp_engine)
        FallbackSession = sessionmaker(autocommit=False, autoflush=False, bind=temp_engine)
        db = FallbackSession()

    try:
        yield db
    finally:
        db.close()
