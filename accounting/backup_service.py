import threading
import time
import shutil
import os
import atexit
from pathlib import Path
from django.conf import settings

def perform_backups():
    """
    Copy database files to backup directory.
    """
    data_dir = Path(settings.BASE_DIR) / "data"
    backup_dir = Path(settings.BASE_DIR) / "backups"

    if not backup_dir.exists():
        backup_dir.mkdir()

    for db_file in data_dir.glob("*.sqlite3"):
        if "template" in db_file.name: continue

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"{db_file.stem}_{timestamp}.sqlite3"
        shutil.copy2(db_file, backup_path)

    # Cleanup old backups (keep last 10 per database)
    for stem in set(f.stem.split('_')[0] for f in backup_dir.glob("*.sqlite3")):
        backups = sorted(list(backup_dir.glob(f"{stem}_*.sqlite3")), key=os.path.getmtime)
        if len(backups) > 10:
            for old_b in backups[:-10]:
                old_b.unlink()

def run_backup_service():
    """
    Background thread to backup database files every 5 minutes.
    """
    data_dir = Path(settings.BASE_DIR) / "data"
    backup_dir = Path(settings.BASE_DIR) / "backups"

    if not backup_dir.exists():
        backup_dir.mkdir()

    while True:
        try:
            perform_backups()
        except Exception as e:
            print(f"Backup Error: {e}")

        time.sleep(300) # 5 minutes

def start_backup_thread():
    # Perform immediate backup on start
    try:
        perform_backups()
    except:
        pass

    # Register exit handler
    atexit.register(perform_backups)

    thread = threading.Thread(target=run_backup_service, daemon=True)
    thread.start()
