import io
import os
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.seed_data import init_db, seed_sample_data
from backend.sample_generator import generate_sample_bank_statements

@pytest.fixture(scope="module")
def client():
    init_db()
    seed_sample_data()
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    os.makedirs(sample_dir, exist_ok=True)
    generate_sample_bank_statements(sample_dir)
    return TestClient(app)

def test_get_bank_statement_samples(client):
    res = client.get("/api/bank-statements/samples")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    filenames = [s["filename"] for s in data]
    assert "Sample_Chase_Operating_Checking.csv" in filenames
    assert "Sample_Wells_Fargo_Bank_Statement.pdf" in filenames

def test_sample_preview_chase_csv(client):
    # Fetch bank account
    accts_res = client.get("/api/accounts")
    assert accts_res.status_code == 200
    accounts = accts_res.json()
    bank_acct = next(a for a in accounts if a.get("account_number") == "10100" or a.get("type") == "BANK")

    res = client.post(f"/api/bank-statements/sample-preview/Sample_Chase_Operating_Checking.csv?bank_account_id={bank_acct['id']}")
    assert res.status_code == 200
    preview = res.json()
    assert preview["file_type"].lower() == "csv"
    assert len(preview["transactions"]) > 0
    
    # Check that Joe's Plumbing is parsed with check #1042 and expense category
    plumbing_tx = next((t for t in preview["transactions"] if "Joe's Plumbing" in t.get("payee", "")), None)
    assert plumbing_tx is not None
    assert plumbing_tx["check_number"] == "1042"
    assert plumbing_tx["amount"] == 500.0
    assert plumbing_tx["category_id"] is not None
    assert "Repairs" in (plumbing_tx.get("category_display") or "")

def test_sample_preview_wells_fargo_pdf(client):
    accts_res = client.get("/api/accounts")
    accounts = accts_res.json()
    bank_acct = next(a for a in accounts if a.get("account_number") == "10100" or a.get("type") == "BANK")

    res = client.post(f"/api/bank-statements/sample-preview/Sample_Wells_Fargo_Bank_Statement.pdf?bank_account_id={bank_acct['id']}")
    assert res.status_code == 200
    preview = res.json()
    assert preview["file_type"].lower() == "pdf"
    assert len(preview["transactions"]) >= 3

def test_upload_preview_custom_csv(client):
    accts_res = client.get("/api/accounts")
    accounts = accts_res.json()
    bank_acct = next(a for a in accounts if a.get("account_number") == "10100" or a.get("type") == "BANK")

    csv_content = (
        "Date,Check Number,Description,Amount\n"
        "2026-04-10,1055,Check 1055 Apex Electric Emergency Repair,-320.00\n"
        "2026-04-11,,Direct Deposit Tenant Rent - Apt 204,1800.00\n"
    )
    res = client.post(
        "/api/bank-statements/upload-preview",
        data={"bank_account_id": bank_acct["id"]},
        files={"file": ("custom_bank_statement.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )
    assert res.status_code == 200
    preview = res.json()
    assert preview["file_type"].lower() == "csv"
    assert len(preview["transactions"]) == 2
    
    tx0 = preview["transactions"][0]
    assert tx0["check_number"] == "1055"
    assert "Apex Electric" in tx0["payee"]
    assert tx0["amount"] == 320.0
    assert tx0["is_outflow"] is True

def test_confirm_bank_import_and_check_register(client):
    # Fetch accounts and properties
    accts_res = client.get("/api/accounts")
    assert accts_res.status_code == 200
    accounts = accts_res.json()
    bank_acct = next(a for a in accounts if a.get("account_number") == "10100" or a.get("type") == "BANK")
    repair_acct = next(a for a in accounts if a.get("account_number") == "60100" or "Repair" in a.get("name", ""))
    
    props_res = client.get("/api/properties")
    assert props_res.status_code == 200
    props = props_res.json()
    prop_id = props[0]["id"]

    # Post import payload
    confirm_payload = {
        "filename": "Test_Import_Statement.csv",
        "bank_account_id": bank_acct["id"],
        "transactions": [
            {
                "date": "2026-04-05",
                "check_number": "1042",
                "payee": "Joe's Plumbing",
                "raw_description": "Check 1042 Joe's plumbing 500",
                "amount": 500.0,
                "is_outflow": True,
                "transaction_type": "CHECK",
                "category_id": repair_acct["id"],
                "property_id": prop_id,
                "memo": "Plumbing service for unit main line",
                "save_rule": True,
                "rule_keyword": "Joe's Plumbing"
            },
            {
                "date": "2026-04-06",
                "check_number": None,
                "payee": "Tenant Rent",
                "raw_description": "Direct Deposit Tenant Rent - Unit 101",
                "amount": 1250.0,
                "is_outflow": False,
                "transaction_type": "DEPOSIT",
                "category_id": None,
                "property_id": prop_id,
                "memo": "April rent deposit",
                "save_rule": False
            }
        ]
    }

    res_confirm = client.post("/api/bank-statements/confirm-import", json=confirm_payload)
    assert res_confirm.status_code == 200
    result = res_confirm.json()
    assert result["status"] == "SUCCESS"
    assert result["checks_created"] >= 1
    assert result["deposits_created"] >= 1
    assert result["rules_saved"] >= 1

    # Verify check register has the new check #1042
    checks_res = client.get(f"/api/checks?account_id={bank_acct['id']}")
    assert checks_res.status_code == 200
    checks = checks_res.json()
    joe_check = next((c for c in checks if str(c.get("check_number")) == "1042"), None)
    assert joe_check is not None
    assert joe_check["amount"] == 500.0
    assert "Joe's Plumbing" in (joe_check.get("payee") or "")
    assert joe_check["source"] == "BANK_IMPORT"
    assert joe_check["source"] == "BANK_IMPORT"

    # Verify rules API has recorded the rule
    rules_res = client.get("/api/bank-rules")
    assert rules_res.status_code == 200
    rules = rules_res.json()
    joe_rule = next((r for r in rules if "Joe's Plumbing".lower() in r.get("match_keyword", "").lower()), None)
    assert joe_rule is not None

    # Delete the rule to verify rule cleanup
    del_res = client.delete(f"/api/bank-rules/{joe_rule['id']}")
    assert del_res.status_code == 200

def test_import_to_bank_sub_account_and_hierarchical_register(client):
    # 1. Fetch parent bank account 10100
    accts_res = client.get("/api/accounts")
    assert accts_res.status_code == 200
    accounts = accts_res.json()
    parent_bank = next(a for a in accounts if a.get("account_number") in ["10100", "10010"] or "Operating Checking" in a.get("name", ""))
    repair_acct = next(a for a in accounts if a.get("account_number") == "60100")
    
    props_res = client.get("/api/properties")
    props = props_res.json()
    prop_id = props[0]["id"]

    # 2. Create sub-account 10110 under 10100 if not present
    existing_10110 = next((a for a in accounts if a.get("account_number") == "10110"), None)
    if not existing_10110:
        create_res = client.post("/api/accounts", json={
            "account_number": "10110",
            "name": "Chase Operating Checking",
            "type": "ASSET",
            "sub_type": "Bank Accounts",
            "parent_account_id": parent_bank["id"],
            "description": "Chase operating checking sub-account"
        })
        assert create_res.status_code == 200
        sub_acct_10110 = create_res.json()
    else:
        sub_acct_10110 = existing_10110

    # 3. Create second sub-account 10120 under 10100
    existing_10120 = next((a for a in accounts if a.get("account_number") == "10120"), None)
    if not existing_10120:
        create_res2 = client.post("/api/accounts", json={
            "account_number": "10120",
            "name": "Wells Fargo Operating Checking",
            "type": "ASSET",
            "sub_type": "Bank Accounts",
            "parent_account_id": parent_bank["id"],
            "description": "Wells Fargo sub-account"
        })
        assert create_res2.status_code == 200
        sub_acct_10120 = create_res2.json()
    else:
        sub_acct_10120 = existing_10120

    # 4. Import statement directly to sub-account 10110
    confirm_payload = {
        "filename": "Chase_SubAccount_Statement.csv",
        "bank_account_id": sub_acct_10110["id"],
        "transactions": [
            {
                "date": "2026-04-12",
                "check_number": "777",
                "payee": "Apex Electrical Repairs",
                "raw_description": "Check 777 Apex Electrical Repairs 350",
                "amount": 350.0,
                "is_outflow": True,
                "transaction_type": "CHECK",
                "category_id": repair_acct["id"],
                "property_id": prop_id,
                "memo": "Sub-account electrical repair check"
            }
        ]
    }

    res_confirm = client.post("/api/bank-statements/confirm-import", json=confirm_payload)
    assert res_confirm.status_code == 200
    assert res_confirm.json()["status"] == "SUCCESS"

    # 5. Verify check record has bank_account_id == sub_acct_10110
    checks_sub = client.get(f"/api/checks?bank_account_id={sub_acct_10110['id']}").json()
    check_777 = next((c for c in checks_sub if str(c.get("check_number")) == "777"), None)
    assert check_777 is not None
    assert check_777["bank_account_id"] == sub_acct_10110["id"]
    assert check_777["amount"] == 350.0

    # 6. Verify parent bank account filter includes checks from sub-accounts!
    checks_parent = client.get(f"/api/checks?bank_account_id={parent_bank['id']}").json()
    check_in_parent = next((c for c in checks_parent if str(c.get("check_number")) == "777"), None)
    assert check_in_parent is not None

    # 7. Verify other sibling sub-account does NOT include check #777
    checks_sibling = client.get(f"/api/checks?bank_account_id={sub_acct_10120['id']}").json()
    check_in_sibling = next((c for c in checks_sibling if str(c.get("check_number")) == "777"), None)
    assert check_in_sibling is None

