import os
import shutil
import zipfile
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
COMPANIES_DIR = os.path.join(DATA_DIR, "companies")
BACKUPS_DIR = os.path.join(BASE_DIR, "backups")
SAMPLE_DIR = os.path.join(BASE_DIR, "sample_statements")

os.makedirs(COMPANIES_DIR, exist_ok=True)
os.makedirs(BACKUPS_DIR, exist_ok=True)
os.makedirs(SAMPLE_DIR, exist_ok=True)

class CompanyManager:
    def __init__(self):
        self.active_company_key: Optional[str] = None
        self.active_company_name: Optional[str] = None
        self.active_db_path: Optional[str] = None
        self.engine = None
        self.SessionLocal = None
        self.prune_restored_companies(keep_count=4)
        self._init_sample_company()

    def get_db_path(self, company_key: str) -> str:
        return os.path.join(COMPANIES_DIR, f"{company_key}.propbooks")

    def prune_restored_companies(self, keep_count: int = 4) -> List[str]:
        """
        Enforces retention policy: keeps only the last `keep_count` restored company files and deletes older ones.
        Returns the list of deleted company keys.
        """
        restored_files = []
        for f in os.listdir(COMPANIES_DIR):
            if f.startswith("restored_") and f.endswith(".propbooks"):
                full_path = os.path.join(COMPANIES_DIR, f)
                try:
                    mtime = os.stat(full_path).st_mtime
                except OSError:
                    mtime = 0
                key = f[:-len(".propbooks")]
                restored_files.append({
                    "filename": f,
                    "filepath": full_path,
                    "key": key,
                    "mtime": mtime
                })

        # Sort descending by modification time (newest restored files first)
        restored_files.sort(key=lambda x: x["mtime"], reverse=True)

        deleted_keys = []
        # Keep the top `keep_count` (e.g. 4); delete all older restored files
        to_delete = restored_files[keep_count:]
        for item in to_delete:
            try:
                # If currently active, safely dispose connection
                if self.active_company_key == item["key"]:
                    if self.engine:
                        self.engine.dispose()
                        self.engine = None
                        self.SessionLocal = None
                    self.active_company_key = None
                    self.active_company_name = None
                    self.active_db_path = None
                    import gc
                    gc.collect()

                if os.path.exists(item["filepath"]):
                    os.remove(item["filepath"])
                    deleted_keys.append(item["key"])
            except Exception as e:
                print(f"Warning: Failed to delete old restored company file {item['filepath']}: {e}")

        return deleted_keys

    def delete_company(self, company_key: str) -> Dict[str, Any]:
        """
        Permanently deletes a company file from disk.
        """
        if not company_key or ".." in company_key or "/" in company_key or "\\" in company_key:
            raise ValueError("Invalid company file key.")

        if company_key == "sample_company":
            raise ValueError("The built-in sample demo company cannot be deleted.")

        target_path = self.get_db_path(company_key)
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Company file '{company_key}.propbooks' not found.")

        # If currently active, safely close and release connection handles before removing
        was_active = (self.active_company_key == company_key)
        if was_active:
            if self.engine:
                self.engine.dispose()
                self.engine = None
                self.SessionLocal = None
            self.active_company_key = None
            self.active_company_name = None
            self.active_db_path = None

        import gc
        import time
        gc.collect()

        deleted = False
        for _ in range(10):
            try:
                os.remove(target_path)
                deleted = True
                break
            except PermissionError:
                gc.collect()
                time.sleep(0.1)

        if not deleted:
            os.remove(target_path)

        return {
            "status": "DELETED",
            "company_key": company_key,
            "was_active": was_active,
            "message": f"Company file '{company_key}' deleted successfully."
        }

    def _init_sample_company(self):
        sample_key = "sample_company"
        sample_path = self.get_db_path(sample_key)
        
        # If sample company doesn't exist, create and seed it
        if not os.path.exists(sample_path):
            self._create_and_seed_sample_file(sample_key)
        
        # Default open sample company on first run if nothing set
        if not self.active_company_key:
            self.open_company(sample_key)

    def _create_and_seed_sample_file(self, company_key: str):
        db_path = self.get_db_path(company_key)
        temp_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        
        from .database import ensure_db_schema
        ensure_db_schema(temp_engine)
        
        TempSession = sessionmaker(autocommit=False, autoflush=False, bind=temp_engine)
        db = TempSession()
        
        from .seed_data import seed_sample_data_with_db
        seed_sample_data_with_db(db)
        db.close()
        temp_engine.dispose()

    def list_companies(self) -> List[Dict[str, Any]]:
        # Enforce retention policy: keep only the last 4 restored company files
        self.prune_restored_companies(keep_count=4)

        companies = []
        for f in os.listdir(COMPANIES_DIR):
            if f.endswith(".propbooks"):
                key = f.replace(".propbooks", "")
                path = os.path.join(COMPANIES_DIR, f)
                stat = os.stat(path)
                
                is_sample = (key == "sample_company")
                is_restored = key.startswith("restored_")

                if is_sample:
                    name = "Sample Investor Portfolio (Demo)"
                elif is_restored:
                    name = key.replace("restored_", "Restored: ").replace("_", " ").title()
                else:
                    name = key.replace("_", " ").title()

                companies.append({
                    "key": key,
                    "name": name,
                    "file_name": f,
                    "is_sample": is_sample,
                    "is_restored": is_restored,
                    "size_kb": round(stat.st_size / 1024, 1),
                    "last_modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    "is_active": (key == self.active_company_key)
                })
        return sorted(companies, key=lambda c: (not c["is_active"], not c["is_sample"], c["name"]))

    def open_company(self, company_key: str) -> Dict[str, Any]:
        # If currently open and switching, trigger auto backup on previous
        if self.active_company_key and self.active_company_key != company_key:
            self.auto_backup_on_close()
            if self.engine:
                self.engine.dispose()
                self.engine = None

        db_path = self.get_db_path(company_key)
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"Company file {company_key}.propbooks does not exist")

        self.active_company_key = company_key
        self.active_company_name = "Sample Investor Portfolio (Demo)" if company_key == "sample_company" else company_key.replace("_", " ").title()
        self.active_db_path = db_path

        # Update active engine & session
        self.engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        from .database import ensure_db_schema
        ensure_db_schema(self.engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        return {
            "key": self.active_company_key,
            "name": self.active_company_name,
            "db_path": self.active_db_path,
            "is_sample": (company_key == "sample_company")
        }

    def create_new_company(self, name: str, ein: Optional[str] = None, notes: Optional[str] = None) -> Dict[str, Any]:
        safe_key = "".join(c if c.isalnum() else "_" for c in name.lower()).strip("_")
        if not safe_key:
            safe_key = f"company_{int(datetime.now().timestamp())}"

        # Ensure unique key
        db_path = self.get_db_path(safe_key)
        if os.path.exists(db_path):
            safe_key = f"{safe_key}_{int(datetime.now().timestamp())}"
            db_path = self.get_db_path(safe_key)

        # Create new database with standard chart of accounts
        temp_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        from .database import Base, ensure_db_schema
        from .models import Company, Category
        from .coa_engine import STANDARD_COA_SEED
        Base.metadata.create_all(bind=temp_engine)
        ensure_db_schema(temp_engine)

        TempSession = sessionmaker(autocommit=False, autoflush=False, bind=temp_engine)
        db = TempSession()
        # 1. Standard chart of accounts (5-digit accounting numbering system)
        categories = [
            Category(
                account_number=acct["account_number"],
                name=acct["name"],
                type=acct["type"],
                sub_type=acct.get("sub_type"),
                description=acct.get("description"),
                is_repair_category=acct.get("is_repair_category", False),
                is_rental_income=acct.get("is_rental_income", False),
                is_active=True
            )
            for acct in STANDARD_COA_SEED
        ]
        db.add_all(categories)

        # 2. Company record
        comp = Company(name=name, ein=ein, notes=notes or "Active investment entity")
        db.add(comp)
        db.commit()
        db.close()
        temp_engine.dispose()

        # Open newly created company
        return self.open_company(safe_key)

    def close_company(self) -> Dict[str, Any]:
        """
        Closes current active company, automatically triggering a safety backup on close.
        """
        backup_info = None
        if self.active_company_key:
            backup_info = self.auto_backup_on_close()

        closed_key = self.active_company_key
        closed_name = self.active_company_name

        if self.engine:
            self.engine.dispose()
        self.active_company_key = None
        self.active_company_name = None
        self.active_db_path = None
        self.engine = None
        self.SessionLocal = None

        return {
            "status": "CLOSED",
            "closed_company": closed_name,
            "auto_backup": backup_info
        }

    def auto_backup_on_close(self) -> Optional[Dict[str, Any]]:
        """
        Automatically creates a timestamped safety backup on company close / app exit.
        """
        if not self.active_company_key or not self.active_db_path:
            return None
        if not os.path.exists(self.active_db_path):
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"AUTO_BACKUP_{self.active_company_key}_{timestamp}.propbackup"
        backup_filepath = os.path.join(BACKUPS_DIR, backup_filename)

        return self._create_backup_zip(self.active_company_key, self.active_db_path, backup_filepath, is_auto=True)

    def manual_backup(self, custom_name: Optional[str] = None) -> Dict[str, Any]:
        if not self.active_company_key or not self.active_db_path:
            raise RuntimeError("No company is currently open to backup")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        prefix = custom_name or self.active_company_key
        safe_prefix = "".join(c if c.isalnum() else "_" for c in prefix).strip("_")
        backup_filename = f"MANUAL_BACKUP_{safe_prefix}_{timestamp}.propbackup"
        backup_filepath = os.path.join(BACKUPS_DIR, backup_filename)

        return self._create_backup_zip(self.active_company_key, self.active_db_path, backup_filepath, is_auto=False)

    def _create_backup_zip(self, company_key: str, db_path: str, backup_filepath: str, is_auto: bool) -> Dict[str, Any]:
        meta = {
            "company_key": company_key,
            "company_name": self.active_company_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_auto": is_auto,
            "version": "1.0.0"
        }

        with zipfile.ZipFile(backup_filepath, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(db_path, arcname=f"{company_key}.propbooks")
            zf.writestr("metadata.json", json.dumps(meta, indent=2))

        stat = os.stat(backup_filepath)
        return {
            "filename": os.path.basename(backup_filepath),
            "filepath": backup_filepath,
            "size_kb": round(stat.st_size / 1024, 1),
            "created_at": meta["created_at"],
            "is_auto": is_auto,
            "company_name": self.active_company_name
        }

    def restore_company_from_backup(self, backup_file_bytes: bytes, original_filename: str) -> Dict[str, Any]:
        temp_zip_path = os.path.join(BACKUPS_DIR, f"temp_restore_{int(datetime.now().timestamp())}.zip")
        with open(temp_zip_path, "wb") as f:
            f.write(backup_file_bytes)

        try:
            with zipfile.ZipFile(temp_zip_path, "r") as zf:
                namelist = zf.namelist()
                db_files = [n for n in namelist if n.endswith(".propbooks")]
                if not db_files:
                    raise ValueError("Invalid backup file: no .propbooks database found inside archive.")
                
                db_file_in_zip = db_files[0]
                base_name = os.path.basename(db_file_in_zip).replace(".propbooks", "")
                
                restore_key = f"restored_{base_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                target_path = self.get_db_path(restore_key)

                with zf.open(db_file_in_zip) as src, open(target_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)

            # Open restored company
            opened = self.open_company(restore_key)
            # Enforce retention policy: keep only the last 4 restored company files
            self.prune_restored_companies(keep_count=4)
            return {
                "status": "RESTORED",
                "message": f"Successfully restored company file as '{opened['name']}'",
                "company": opened
            }
        finally:
            if os.path.exists(temp_zip_path):
                os.remove(temp_zip_path)

    def list_backups(self) -> List[Dict[str, Any]]:
        backups = []
        for f in os.listdir(BACKUPS_DIR):
            if f.endswith(".propbackup") or f.endswith(".zip"):
                path = os.path.join(BACKUPS_DIR, f)
                stat = os.stat(path)
                backups.append({
                    "filename": f,
                    "filepath": path,
                    "size_kb": round(stat.st_size / 1024, 1),
                    "is_auto": "AUTO_BACKUP" in f,
                    "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                })
        return sorted(backups, key=lambda b: b["created_at"], reverse=True)

# Singleton Instance
company_manager = CompanyManager()
