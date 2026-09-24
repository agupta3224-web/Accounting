import os
import zipfile
from backend.company_manager import company_manager

def test_multi_company_lifecycle_and_backup():
    # 1. List companies (sample exists)
    comps = company_manager.list_companies()
    assert len(comps) >= 1
    sample = next(c for c in comps if c["is_sample"])
    assert sample["key"] == "sample_company"

    # 2. Open Sample Company
    opened_sample = company_manager.open_company("sample_company")
    assert opened_sample["key"] == "sample_company"
    assert company_manager.active_company_key == "sample_company"

    # 3. Create Manual Backup
    backup_meta = company_manager.manual_backup()
    assert os.path.exists(backup_meta["filepath"])
    assert backup_meta["filename"].endswith(".propbackup")

    # Verify backup archive contains .propbooks file & metadata.json
    with zipfile.ZipFile(backup_meta["filepath"], "r") as zf:
        names = zf.namelist()
        assert "sample_company.propbooks" in names
        assert "metadata.json" in names

    # 4. Create New Company File
    test_comp_name = "Lone Star Capital Group"
    new_comp = company_manager.create_new_company(
        name=test_comp_name,
        ein="88-1234567",
        notes="Test company for automated testing"
    )
    assert company_manager.active_company_key == new_comp["key"]
    assert company_manager.active_company_key.startswith("lone_star_capital_group")
    assert os.path.exists(company_manager.active_db_path)

    # 5. Close Company (Triggers Auto-Backup)
    close_res = company_manager.close_company()
    assert close_res["status"] == "CLOSED"
    assert company_manager.active_company_key is None
    assert close_res["auto_backup"] is not None
    assert "AUTO_BACKUP" in close_res["auto_backup"]["filename"]

    # 6. Restore Company from Backup
    with open(backup_meta["filepath"], "rb") as f:
        backup_bytes = f.read()

    restore_res = company_manager.restore_company_from_backup(backup_bytes, backup_meta["filename"])
    assert restore_res["status"] == "RESTORED"
    assert company_manager.active_company_key.startswith("restored_sample_company")

    # 7. Switch back to Sample Company
    company_manager.open_company("sample_company")
    assert company_manager.active_company_key == "sample_company"

    # 8. Clean up temporary test files
    company_manager.delete_company(new_comp["key"])
    if restore_res.get("company") and restore_res["company"].get("key"):
        try:
            company_manager.delete_company(restore_res["company"]["key"])
        except Exception:
            pass
    if os.path.exists(backup_meta["filepath"]):
        os.remove(backup_meta["filepath"])
    if close_res.get("auto_backup") and os.path.exists(close_res["auto_backup"]["filepath"]):
        os.remove(close_res["auto_backup"]["filepath"])

if __name__ == "__main__":
    test_multi_company_lifecycle_and_backup()
    print("Multi-company and backup tests passed!")
