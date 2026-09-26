"""
Automated unit tests for 3-backup retention policy and automatic pruning on close/exit.
"""
import os
import time
from backend.company_manager import company_manager, BACKUPS_DIR, COMPANIES_DIR
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_backup_retention_strictly_keeps_last_three_and_deletes_oldest():
    """
    Verifies that when multiple backups are created, only the latest 3 are kept,
    and older backups are automatically deleted.
    """
    # Open sample company
    company_manager.open_company("sample_company")
    active_key = company_manager.active_company_key
    assert active_key == "sample_company"

    # Create 5 manual backups with small delays so timestamps differ
    created_backups = []
    for i in range(5):
        b = company_manager.manual_backup()
        created_backups.append(b)
        time.sleep(1.05)

    # All backups for sample_company
    sample_backups = [
        b for b in company_manager.list_backups()
        if "sample_company" in b["filename"]
    ]

    # Must be at most 3 backups retained
    assert len(sample_backups) <= 3, f"Expected at most 3 backups, found {len(sample_backups)}"

    # The oldest backups created earlier should not exist on disk
    oldest_file = created_backups[0]["filepath"]
    assert not os.path.exists(oldest_file), f"Oldest backup {oldest_file} should have been pruned/deleted"

    second_oldest_file = created_backups[1]["filepath"]
    assert not os.path.exists(second_oldest_file), f"Second oldest backup {second_oldest_file} should have been pruned/deleted"

    # The newest backup should exist
    newest_file = created_backups[-1]["filepath"]
    assert os.path.exists(newest_file), f"Newest backup {newest_file} must exist"


def test_auto_backup_on_close_enforces_three_backup_retention():
    """
    Verifies that closing a company triggers an automatic backup and enforces the 3-backup retention rule.
    """
    test_comp_name = "Retention Lifecycle Test Co"
    new_comp = company_manager.create_new_company(name=test_comp_name)
    key = new_comp["key"]

    try:
        # Create 4 backups
        for _ in range(3):
            company_manager.manual_backup()
            time.sleep(1.05)

        # Trigger auto backup on close
        close_res = company_manager.close_company()
        assert close_res["status"] == "CLOSED"
        assert close_res["auto_backup"] is not None

        # Check total backups for this company key
        company_backups = [
            b for b in company_manager.list_backups()
            if key in b["filename"]
        ]
        assert len(company_backups) <= 3, f"Expected <= 3 backups after close, got {len(company_backups)}"
    finally:
        # Switch back to sample company and clean up
        company_manager.open_company("sample_company")
        try:
            company_manager.delete_company(key)
        except Exception:
            pass
        # Prune test backups
        for f in os.listdir(BACKUPS_DIR):
            if key in f:
                try:
                    os.remove(os.path.join(BACKUPS_DIR, f))
                except Exception:
                    pass


def test_prune_companies_deletes_excess_duplicate_versions():
    """
    Verifies that duplicate timestamped versions of the same company are pruned to 3.
    """
    base_name = "test_duplicate_prune_entity"
    created_files = []

    try:
        # Create a base file and 5 dummy timestamped files
        base_file = os.path.join(COMPANIES_DIR, f"{base_name}.propbooks")
        with open(base_file, "w") as f:
            f.write("test_base")
        created_files.append(base_file)

        for i in range(1, 6):
            ts_file = os.path.join(COMPANIES_DIR, f"{base_name}_179000000{i}.propbooks")
            with open(ts_file, "w") as f:
                f.write(f"test_{i}")
            # Set artificial mtimes
            os.utime(ts_file, (time.time() + i * 10, time.time() + i * 10))
            created_files.append(ts_file)

        # Total created is 6 files
        existing_matches = [f for f in os.listdir(COMPANIES_DIR) if f.startswith(base_name)]
        assert len(existing_matches) == 6

        # Enforce company retention (keep last 3)
        deleted = company_manager.prune_companies(keep_count=3)
        assert len(deleted) >= 3

        # Remaining files for this base name must be <= 3
        remaining_matches = [f for f in os.listdir(COMPANIES_DIR) if f.startswith(base_name)]
        assert len(remaining_matches) == 3
        # The base file should be preserved
        assert os.path.exists(base_file)
    finally:
        for p in created_files:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


def test_api_prune_endpoints():
    """
    Tests the POST /api/system/companies/prune-restored and POST /api/system/backups/prune endpoints.
    """
    res1 = client.post("/api/system/companies/prune-restored?keep_count=3")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "SUCCESS"
    assert "Kept last 3" in data1["message"]

    res2 = client.post("/api/system/backups/prune?keep_count=3")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "SUCCESS"
    assert "Kept last 3" in data2["message"]
