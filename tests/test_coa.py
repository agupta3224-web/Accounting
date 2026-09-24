import pytest
import csv
import io
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base, ensure_db_schema
from backend.models import Category, Transaction
from backend.coa_engine import (
    validate_account_number,
    suggest_next_account_number,
    export_accounts_to_csv,
    get_sample_csv_template,
    import_accounts_from_csv,
    backfill_standard_account_numbers,
    STANDARD_COA_SEED,
    CUSTOM_BASE_COA_SEED,
    seed_custom_base_accounts
)
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    ensure_db_schema(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    yield db
    db.close()

def test_numbering_validation_rules():
    # 1xxxx - ASSETS (10000 - 19999)
    assert validate_account_number("10010", "ASSET")[0] is True
    assert validate_account_number("10100", "ASSET")[0] is True
    assert validate_account_number("15000", "ASSET")[0] is True
    assert validate_account_number("20100", "ASSET")[0] is False # Out of range

    # 2xxxx - LIABILITIES (20000 - 29999)
    assert validate_account_number("20100", "LIABILITY")[0] is True
    assert validate_account_number("25000", "LIABILITY")[0] is True
    assert validate_account_number("10010", "LIABILITY")[0] is False

    # 3xxxx - EQUITIES (30000 - 39999)
    assert validate_account_number("30100", "EQUITY")[0] is True
    assert validate_account_number("40100", "EQUITY")[0] is False

    # 4xxxx - REVENUE & INCOME (40000 - 49999)
    assert validate_account_number("40100", "INCOME")[0] is True
    assert validate_account_number("40200", "REVENUE")[0] is True
    assert validate_account_number("60100", "INCOME")[0] is False

    # 5xxxx - COGS (50000 - 59999)
    assert validate_account_number("50100", "COGS")[0] is True
    assert validate_account_number("60100", "COGS")[0] is False

    # 6xxxx thru 8xxxx - OPERATING EXPENSES (60000 - 89999)
    assert validate_account_number("60100", "OPERATING_EXPENSE")[0] is True
    assert validate_account_number("70500", "OPERATING_EXPENSE")[0] is True
    assert validate_account_number("85000", "OPERATING_EXPENSE")[0] is True
    assert validate_account_number("90100", "OPERATING_EXPENSE")[0] is False

    # 8xxxx thru 9xxxx - OTHER INCOME & EXPENSE (80000 - 99999)
    assert validate_account_number("80100", "OTHER_INCOME_EXPENSE")[0] is True
    assert validate_account_number("90100", "OTHER_INCOME_EXPENSE")[0] is True
    assert validate_account_number("90200", "NON_OPERATING_EXPENSE")[0] is True
    assert validate_account_number("90300", "CAPEX")[0] is True
    assert validate_account_number("10010", "OTHER_INCOME_EXPENSE")[0] is False

def test_account_auto_suggestion():
    # Initial suggestions when list is empty
    assert suggest_next_account_number("ASSET", []) == "10100"
    assert suggest_next_account_number("LIABILITY", []) == "20100"
    assert suggest_next_account_number("EQUITY", []) == "30100"
    assert suggest_next_account_number("INCOME", []) == "40100"
    assert suggest_next_account_number("COGS", []) == "50100"
    assert suggest_next_account_number("OPERATING_EXPENSE", []) == "60100"
    assert suggest_next_account_number("OTHER_INCOME_EXPENSE", []) == "80100"

    # Suggestion when numbers already exist
    existing_assets = ["10100", "10200", "10300"]
    next_asset = suggest_next_account_number("ASSET", existing_assets)
    assert next_asset == "10400"

    existing_expenses = ["60100", "60200", "60300"]
    next_expense = suggest_next_account_number("OPERATING_EXPENSE", existing_expenses)
    assert next_expense == "60400"

def test_backfill_and_standard_seed(db_session):
    # Database starts empty
    assert db_session.query(Category).count() == 0
    backfill_standard_account_numbers(db_session)
    
    # Verify all standard accounts were seeded
    count = db_session.query(Category).count()
    assert count == len(STANDARD_COA_SEED)
    
    # Verify key standard real estate accounts
    checking = db_session.query(Category).filter(Category.account_number == "10100").first()
    assert checking is not None
    assert checking.name == "Operating Checking"
    assert checking.type == "ASSET"
    
    rent = db_session.query(Category).filter(Category.account_number == "40100").first()
    assert rent is not None
    assert rent.is_rental_income is True
    
    repairs = db_session.query(Category).filter(Category.account_number == "60100").first()
    assert repairs is not None
    assert repairs.is_repair_category is True

def test_coa_csv_export(db_session):
    backfill_standard_account_numbers(db_session)
    accounts = db_session.query(Category).all()
    
    csv_text = export_accounts_to_csv(accounts)
    assert "Account Number,Account Name,Account Type,Sub Type,Description" in csv_text
    
    # Parse generated CSV
    reader = csv.reader(io.StringIO(csv_text.strip()))
    rows = list(reader)
    header = rows[0]
    data_rows = rows[1:]
    
    assert header[0] == "Account Number"
    assert len(data_rows) == len(accounts)
    
    # Ensure sorted by account number
    first_row = data_rows[0]
    assert first_row[0] == "10100" # Operating Checking first

def test_coa_sample_template():
    tmpl = get_sample_csv_template()
    assert "Account Number,Account Name,Account Type,Sub Type" in tmpl
    assert "10100" in tmpl
    assert "40100" in tmpl
    assert "60100" in tmpl

def test_coa_csv_import_workflow(db_session):
    sample_csv = """Account Number,Account Name,Account Type,Sub Type,Description,Is Repair Category,Is Rental Income,Active Status
10010,Main Property Operating Checking,ASSET,Bank Accounts,Primary operating account,No,No,Active
10050,Austin Regional Escrow,ASSET,Bank Accounts,Austin regional tenant escrow,No,No,Active
20150,Contractor Retainage Payable,LIABILITY,Payables,Held contractor retainage,No,No,Active
40100,Residential Rental Revenue,INCOME,Rental Revenue,Monthly scheduled tenant rents,No,Yes,Active
60100,Property Maintenance & Repairs,OPERATING_EXPENSE,Maintenance,Plumbing and HVAC repairs,Yes,No,Active
60950,Pest Control Specialty Services,OPERATING_EXPENSE,Maintenance,Termite and pest treatment,No,No,Active
90300,Roof & HVAC CapEx Improvements,CAPEX,CapEx,Capital structural improvements,No,No,Active
"""
    result = import_accounts_from_csv(sample_csv, db_session)
    assert result["success"] is True
    assert result["imported_count"] >= 5
    assert len(result["errors"]) == 0
    
    # Check created accounts
    austin_escrow = db_session.query(Category).filter(Category.account_number == "10050").first()
    assert austin_escrow is not None
    assert austin_escrow.name == "Austin Regional Escrow"
    assert austin_escrow.type == "ASSET"
    
    pest = db_session.query(Category).filter(Category.account_number == "60950").first()
    assert pest is not None
    assert pest.type == "OPERATING_EXPENSE"

def test_coa_csv_import_invalid_number_handling(db_session):
    invalid_csv = """Account Number,Account Name,Account Type,Sub Type
99999,Invalid Asset Number,ASSET,Bank Accounts
20100,Valid Accounts Payable,LIABILITY,Payables
"""
    result = import_accounts_from_csv(invalid_csv, db_session)
    assert result["success"] is True
    assert result["imported_count"] == 1 # only 20100 imported
    assert len(result["errors"]) == 1 # 99999 rejected for ASSET
    assert "Asset accounts must be in the 1xxxx range" in result["errors"][0]

def test_coa_sub_accounts_hierarchy(db_session):
    # Create parent account: 60300 Property Taxes
    parent = Category(
        account_number="60300",
        name="Property Taxes",
        type="OPERATING_EXPENSE",
        sub_type="Taxes",
        description="Master property tax account"
    )
    db_session.add(parent)
    db_session.commit()
    db_session.refresh(parent)

    # Auto suggest sub-account number with parent
    suggested = suggest_next_account_number("OPERATING_EXPENSE", ["60300"], parent_number="60300")
    assert suggested == "60310"

    # Create sub-accounts
    sub1 = Category(
        account_number="60310",
        name="County Taxes",
        type="OPERATING_EXPENSE",
        sub_type="Taxes",
        parent_account_id=parent.id
    )
    sub2 = Category(
        account_number="60320",
        name="City Taxes",
        type="OPERATING_EXPENSE",
        sub_type="Taxes",
        parent_account_id=parent.id
    )
    db_session.add_all([sub1, sub2])
    db_session.commit()

    db_session.refresh(parent)
    db_session.refresh(sub1)
    db_session.refresh(sub2)

    assert len(parent.sub_accounts) == 2
    parent_dict = parent.to_dict()
    assert parent_dict["sub_accounts_count"] == 2
    assert parent_dict["is_sub_account"] is False

    sub1_dict = sub1.to_dict()
    assert sub1_dict["is_sub_account"] is True
    assert sub1_dict["parent_account_id"] == parent.id
    assert sub1_dict["parent_account_number"] == "60300"
    assert sub1_dict["parent_account_name"] == "Property Taxes"

def test_custom_base_coa_seeding(db_session):
    created = seed_custom_base_accounts(db_session, overwrite=True)
    assert len(created) == 8
    
    acc_map = {a.account_number: a.name for a in db_session.query(Category).all()}
    assert acc_map["10000"] == "All Assets"
    assert acc_map["20000"] == "All Liabilities"
    assert acc_map["30000"] == "All Equity"
    assert acc_map["40000"] == "All Revenue (Income)"
    assert acc_map["50000"] == "Used for Flips only"
    assert acc_map["60000"] == "All Operating Expenses"
    assert acc_map["70000"] == "All Operating Expenses"
    assert acc_map["80000"] == "Other Income/Expenses"

def test_reset_coa_endpoint():
    # Create temporary isolated company to avoid mutating shared sample_company
    create_res = client.post("/api/system/companies/create", json={"name": "Temp COA Test Co"})
    assert create_res.status_code == 200
    comp_key = create_res.json()["key"]

    try:
        # Test reset to CUSTOM template
        res = client.post("/api/accounts/reset-template", json={"template": "CUSTOM", "overwrite": True})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "SUCCESS"
        assert data["template"] == "CUSTOM"
        assert data["accounts_created"] == 8

        # Verify custom accounts can be retrieved
        accounts_res = client.get("/api/accounts")
        assert accounts_res.status_code == 200
        accts = accounts_res.json()
        acct_nums = [a["account_number"] for a in accts]
        assert "10000" in acct_nums
        assert "50000" in acct_nums
        assert "80000" in acct_nums

        # Test reset back to DEFAULT template
        res_default = client.post("/api/accounts/reset-template", json={"template": "DEFAULT", "overwrite": True})
        assert res_default.status_code == 200
        data_default = res_default.json()
        assert data_default["status"] == "SUCCESS"
        assert data_default["template"] == "DEFAULT"
        assert data_default["accounts_created"] >= 30
    finally:
        client.post("/api/system/companies/open", json={"company_key": "sample_company"})
        if comp_key:
            client.delete(f"/api/system/companies/{comp_key}")

def test_create_account_with_opening_balance_asset(db_session):
    from backend.journal_engine import record_opening_balance_entry, compute_account_balance
    from backend.models import JournalEntry

    bank = Category(
        account_number="10050",
        name="New Operating Checking",
        type="ASSET",
        sub_type="Bank Accounts",
        opening_balance=12500.0,
        opening_balance_date="2026-01-01"
    )
    db_session.add(bank)
    db_session.commit()
    db_session.refresh(bank)

    record_opening_balance_entry(db_session, bank, bank.opening_balance, bank.opening_balance_date)

    # Verify Journal Entry
    je = db_session.query(JournalEntry).filter(JournalEntry.source == "OPENING_BALANCE").first()
    assert je is not None
    assert je.date == "2026-01-01"
    assert len(je.lines) == 2

    # Check debit to Asset account and credit to 39000 Opening Balance Equity
    asset_line = next(line for line in je.lines if line.category_id == bank.id)
    equity_line = next(line for line in je.lines if line.category_id != bank.id)
    assert asset_line.debit == 12500.0
    assert asset_line.credit == 0.0
    assert equity_line.credit == 12500.0
    assert equity_line.debit == 0.0

    obe_acct = db_session.query(Category).filter(Category.id == equity_line.category_id).first()
    assert obe_acct.account_number == "39000"
    assert obe_acct.name == "Opening Balance Equity"

    # Compute account balance
    balance = compute_account_balance(db_session, bank)
    assert balance == 12500.0

def test_create_account_with_opening_balance_liability(db_session):
    from backend.journal_engine import record_opening_balance_entry, compute_account_balance
    from backend.models import JournalEntry

    cc = Category(
        account_number="20500",
        name="Business Credit Card",
        type="LIABILITY",
        sub_type="Credit Card",
        opening_balance=3400.0,
        opening_balance_date="2026-02-01"
    )
    db_session.add(cc)
    db_session.commit()
    db_session.refresh(cc)

    record_opening_balance_entry(db_session, cc, cc.opening_balance, cc.opening_balance_date)

    # Verify Journal Entry: Credit Liability, Debit Opening Balance Equity
    je = db_session.query(JournalEntry).filter(JournalEntry.source == "OPENING_BALANCE", JournalEntry.date == "2026-02-01").first()
    assert je is not None
    cc_line = next(line for line in je.lines if line.category_id == cc.id)
    equity_line = next(line for line in je.lines if line.category_id != cc.id)
    assert cc_line.credit == 3400.0
    assert cc_line.debit == 0.0
    assert equity_line.debit == 3400.0
    assert equity_line.credit == 0.0

    balance = compute_account_balance(db_session, cc)
    assert balance == 3400.0

def test_csv_export_import_with_opening_balance(db_session):
    backfill_standard_account_numbers(db_session)
    accts = db_session.query(Category).all()
    csv_str = export_accounts_to_csv(accts)
    assert "Opening Balance" in csv_str
    assert "Opening Balance Date" in csv_str

    # Test importing with opening balance
    import_csv = (
        "Account Number,Account Name,Account Type,Sub Type,Description,Opening Balance,Opening Balance Date,Is Repair Category,Is Rental Income,Active Status\n"
        "10090,Imported Checking,ASSET,Bank Accounts,Testing Import,9800.50,2026-01-10,No,No,Active\n"
    )
    result = import_accounts_from_csv(import_csv, db_session)
    assert result["success"] is True
    assert result["imported_count"] == 1

    imported_acct = db_session.query(Category).filter(Category.account_number == "10090").first()
    assert imported_acct is not None
    assert imported_acct.opening_balance == 9800.50
    assert imported_acct.opening_balance_date == "2026-01-10"

if __name__ == "__main__":
    pytest.main(["-v", "test_coa.py"])


