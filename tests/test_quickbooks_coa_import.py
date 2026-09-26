import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.database import Base
from backend.models import Category, JournalEntry, JournalEntryLine, Company
from backend.coa_engine import (
    map_quickbooks_account_type,
    parse_quickbooks_coa_file,
    import_quickbooks_coa_to_db,
    suggest_next_account_number
)
from backend.main import app, _persist_entity_interview_records, EntityInterviewPayload

SAMPLE_EXCEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "sample_statements",
    "QuickBooks_Chart_of_Accounts_Sample.xlsx"
)

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

def test_map_quickbooks_account_type():
    # Bank
    t, st, rep, rent = map_quickbooks_account_type("Bank", "US Bank Checking")
    assert t == "ASSET"
    assert st == "Bank Accounts"
    assert not rep and not rent

    # Fixed asset and contra asset
    t, st, _, _ = map_quickbooks_account_type("Fixed Asset", "Building Acquisition Cost")
    assert t == "ASSET"
    assert "Building" in st

    t, st, _, _ = map_quickbooks_account_type("Fixed Asset", "Accumulated Depreciation")
    assert t == "ASSET"
    assert st == "Contra Asset"

    # Credit card
    t, st, _, _ = map_quickbooks_account_type("Credit Card", "Chase Sapphire")
    assert t == "LIABILITY"
    assert st == "Credit Cards"

    # Tenant Deposits
    t, st, _, _ = map_quickbooks_account_type("Other Current Liability", "Tenant Security Deposits")
    assert t == "LIABILITY"
    assert st == "Tenant Deposits"

    # Equity Draws
    t, st, _, _ = map_quickbooks_account_type("Equity", "Members Draw")
    assert t == "EQUITY"
    assert st == "Equity Draws"

    # Rental Income
    t, st, rep, rent = map_quickbooks_account_type("Income", "Rental Income")
    assert t == "INCOME"
    assert rent is True
    assert st == "Rental Revenue"

    # Repairs & Maintenance
    t, st, rep, rent = map_quickbooks_account_type("Expense", "Repairs & Maintenance")
    assert t == "OPERATING_EXPENSE"
    assert rep is True
    assert st == "Maintenance"

def test_parse_quickbooks_excel_file():
    assert os.path.exists(SAMPLE_EXCEL_PATH), f"Sample file not found at {SAMPLE_EXCEL_PATH}"
    with open(SAMPLE_EXCEL_PATH, "rb") as f:
        content = f.read()

    result = parse_quickbooks_coa_file(content, "QuickBooks_Chart_of_Accounts_Sample.xlsx")
    assert result["filename"] == "QuickBooks_Chart_of_Accounts_Sample.xlsx"
    assert result["sheet_name"] == "Sheet1"  # Skipped 'QuickBooks Desktop Export Tips'

    summary = result["summary"]
    assert summary["total_accounts"] == 43
    assert summary["valid_accounts"] == 43
    assert summary["sub_accounts_count"] == 12
    assert summary["total_assets_balance"] > 0
    assert summary["total_liabilities_balance"] > 0

    accounts = result["accounts"]
    # Check top-level bank account
    acct_10001 = next((a for a in accounts if a["account_number"] == "10001"), None)
    assert acct_10001 is not None
    assert acct_10001["name"] == "US Bank Checking"
    assert acct_10001["type"] == "ASSET"
    assert acct_10001["level"] == 0

    # Check hierarchical sub-account
    chase_sapphire = next((a for a in accounts if a["account_number"] == "28110"), None)
    assert chase_sapphire is not None
    assert chase_sapphire["name"] == "Chase Sapphire"
    assert chase_sapphire["level"] == 1
    assert chase_sapphire["parent_account_number"] == "28000"
    assert chase_sapphire["type"] == "LIABILITY"

    # Check 3-level sub-account
    group_a = next((a for a in accounts if a["account_number"] == "21310"), None)
    assert group_a is not None
    assert group_a["name"] == "Investor Group A"
    assert group_a["level"] == 2
    assert group_a["parent_account_number"] == "21300"

def test_import_quickbooks_coa_to_db(db_session):
    with open(SAMPLE_EXCEL_PATH, "rb") as f:
        content = f.read()

    result = parse_quickbooks_coa_file(content, "QuickBooks_Chart_of_Accounts_Sample.xlsx")
    import_res = import_quickbooks_coa_to_db(result["accounts"], db_session, overwrite=True, create_opening_balances=True)

    assert import_res["success"] is True
    assert import_res["created_count"] == 43
    assert import_res["sub_accounts_linked"] == 12
    assert import_res["opening_balances_recorded"] > 0

    # Verify parent-child relationship in DB
    parent_cc = db_session.query(Category).filter(Category.account_number == "28000").first()
    assert parent_cc is not None
    child_cc = db_session.query(Category).filter(Category.account_number == "28110").first()
    assert child_cc is not None
    assert child_cc.parent_account_id == parent_cc.id
    assert child_cc.parent_account.name == parent_cc.name

    # Verify 3-level parent hierarchy: 21000 -> 21300 -> 21310
    loan_root = db_session.query(Category).filter(Category.account_number == "21000").first()
    loan_sub = db_session.query(Category).filter(Category.account_number == "21300").first()
    loan_child = db_session.query(Category).filter(Category.account_number == "21310").first()

    assert loan_root is not None
    assert loan_sub is not None
    assert loan_child is not None
    assert loan_sub.parent_account_id == loan_root.id
    assert loan_child.parent_account_id == loan_sub.id

    # Verify journal entries for opening balances
    jes = db_session.query(JournalEntry).filter(JournalEntry.source == "OPENING_BALANCE").all()
    assert len(jes) > 0
    # Every JE must have balanced debits and credits
    for je in jes:
        lines = db_session.query(JournalEntryLine).filter(JournalEntryLine.journal_entry_id == je.id).all()
        total_dr = sum(l.debit for l in lines)
        total_cr = sum(l.credit for l in lines)
        assert round(total_dr, 2) == round(total_cr, 2)

def test_api_quickbooks_preview_and_import():
    client = TestClient(app)
    with open(SAMPLE_EXCEL_PATH, "rb") as f:
        files = {"file": ("QuickBooks_Chart_of_Accounts_Sample.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        resp = client.post("/api/coa/quickbooks/preview", files=files)

    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total_accounts"] == 43
    assert data["summary"]["sub_accounts_count"] == 12

    # Import via API
    resp2 = client.post("/api/coa/quickbooks/import", json={
        "accounts": data["accounts"],
        "overwrite": False,
        "create_opening_balances": True
    })
    assert resp2.status_code == 200
    res_data = resp2.json()
    assert res_data["success"] is True

def test_entity_wizard_persist_quickbooks_coa(db_session):
    with open(SAMPLE_EXCEL_PATH, "rb") as f:
        content = f.read()
    parsed = parse_quickbooks_coa_file(content, "QuickBooks_Chart_of_Accounts_Sample.xlsx")

    payload = EntityInterviewPayload(
        is_portfolio=False,
        entity_name="QuickBooks Test Portfolio LLC",
        entity_type="LLC",
        coa_mode="QUICKBOOKS",
        quickbooks_accounts=parsed["accounts"]
    )

    result = _persist_entity_interview_records(payload, db_session)
    assert result["company"]["name"] == "QuickBooks Test Portfolio LLC"

    # Verify accounts in DB
    cats = db_session.query(Category).all()
    assert len(cats) >= 43
    # Check that sub-accounts are linked
    sub_accounts = [c for c in cats if c.parent_account_id is not None]
    assert len(sub_accounts) == 12
