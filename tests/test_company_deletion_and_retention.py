import os
import time
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.company_manager import company_manager, COMPANIES_DIR

client = TestClient(app)

def test_delete_company_file():
    # 1. Create a company
    comp = company_manager.create_new_company("Deletion Test LLC")
    comp_key = comp["key"]
    db_path = company_manager.get_db_path(comp_key)
    assert os.path.exists(db_path)

    # 2. Check it appears in company list
    all_keys = [c["key"] for c in company_manager.list_companies()]
    assert comp_key in all_keys

    # 3. Delete the company
    res = company_manager.delete_company(comp_key)
    assert res["status"] == "DELETED"
    assert res["company_key"] == comp_key
    assert not os.path.exists(db_path)

    # 4. Check it no longer appears in company list
    all_keys_after = [c["key"] for c in company_manager.list_companies()]
    assert comp_key not in all_keys_after

def test_delete_sample_company_raises_error():
    with pytest.raises(ValueError, match="built-in sample demo company cannot be deleted"):
        company_manager.delete_company("sample_company")

def test_delete_invalid_and_nonexistent_key():
    with pytest.raises(ValueError, match="Invalid company file key"):
        company_manager.delete_company("../../etc/passwd")

    with pytest.raises(FileNotFoundError):
        company_manager.delete_company("definitely_nonexistent_company_99999")

def test_delete_active_company_clean_closure():
    # Create and open an active company
    comp = company_manager.create_new_company("Active Target LLC")
    comp_key = comp["key"]
    assert company_manager.active_company_key == comp_key
    db_path = company_manager.get_db_path(comp_key)
    assert os.path.exists(db_path)

    # Delete active company
    res = company_manager.delete_company(comp_key)
    assert res["status"] == "DELETED"
    assert res["was_active"] is True
    assert company_manager.active_company_key is None
    assert not os.path.exists(db_path)

def test_restored_files_retention_policy_keeps_only_last_4():
    # Create 6 mock restored files with incremental timestamps
    base_time = time.time()
    mock_keys = [f"restored_retention_mock_{i}_{int(base_time)}" for i in range(1, 7)]
    mock_paths = []

    for idx, key in enumerate(mock_keys):
        path = company_manager.get_db_path(key)
        mock_paths.append(path)
        with open(path, "w") as f:
            f.write("mock db content")
        # Set mtime so idx 0 is oldest, idx 5 is newest
        mtime = base_time + (idx * 10)
        os.utime(path, (mtime, mtime))

    try:
        # Prune restored files keeping last 4
        deleted_keys = company_manager.prune_restored_companies(keep_count=4)

        # The 2 oldest mock files (idx 0 and 1) should be pruned
        assert mock_keys[0] in deleted_keys
        assert mock_keys[1] in deleted_keys
        assert not os.path.exists(mock_paths[0])
        assert not os.path.exists(mock_paths[1])

        # The 4 newest mock files (idx 2, 3, 4, 5) should be kept
        assert os.path.exists(mock_paths[2])
        assert os.path.exists(mock_paths[3])
        assert os.path.exists(mock_paths[4])
        assert os.path.exists(mock_paths[5])
    finally:
        # Cleanup remaining mock files
        for p in mock_paths:
            if os.path.exists(p):
                os.remove(p)

def test_api_endpoints_delete_and_prune():
    # Create company via API
    create_res = client.post("/api/system/companies/create", json={"name": "API Delete Test Corp"})
    assert create_res.status_code == 200
    comp_data = create_res.json()
    comp_key = comp_data["key"]

    # Delete via DELETE /api/system/companies/{key}
    del_res = client.delete(f"/api/system/companies/{comp_key}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "DELETED"

    # Verify 404 for deleted key
    del_again = client.delete(f"/api/system/companies/{comp_key}")
    assert del_again.status_code == 404

    # Test POST /api/system/companies/prune-restored
    prune_res = client.post("/api/system/companies/prune-restored?keep_count=4")
    assert prune_res.status_code == 200
    assert prune_res.json()["status"] == "SUCCESS"
