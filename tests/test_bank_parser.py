import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import ensure_db_schema
from backend.models import Category, Property, ClassEntity, Company, BankRule, Vendor
from backend.coa_engine import backfill_standard_account_numbers
from backend.bank_parser_engine import (
    clean_vendor_name,
    extract_check_number_from_text,
    categorize_bank_transaction,
    parse_bank_statement_file,
    parse_csv_raw_preview
)
from backend.sample_generator import generate_sample_bank_statements

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    ensure_db_schema(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    backfill_standard_account_numbers(db)

    comp = Company(name="Lone Star Portfolio LLC")
    db.add(comp)
    db.flush()

    llc = ClassEntity(name="2908 Depot LLC", company_id=comp.id)
    db.add(llc)
    db.flush()

    prop = Property(name="2908 Depot", class_id=llc.id, address_line1="2908 Depot Rd", city="Austin", state="TX", zip_code="78704")
    db.add(prop)
    db.commit()

    yield db
    db.close()

def test_clean_vendor_name():
    # User's exact prompt example
    assert "Joe's Plumbing" in clean_vendor_name("Check 1042 Joe's plumbing 500")
    assert clean_vendor_name("ACH WITHDRAWAL XCEL ENERGY CO 800-555-0199") == "Xcel Energy"
    assert clean_vendor_name("POS DEBIT STATE FARM INSURANCE #0482") == "State Farm Insurance"
    assert "Ace Hardware" in clean_vendor_name("CHECK #1043 ACE HARDWARE - PAINT & SUPPLIES")
    assert clean_vendor_name("Direct Deposit Tenant Rent - Unit 101") == "Tenant Rent"

def test_extract_check_number():
    # User's exact prompt example: Check (number) Joe's plumbing 500
    assert extract_check_number_from_text("Check 1042 Joe's plumbing 500") == "1042"
    assert extract_check_number_from_text("CHK #1043 Ace Hardware") == "1043"
    assert extract_check_number_from_text("Check 98754 Austin HVAC") == "98754"
    assert extract_check_number_from_text("ACH Electronic Payment - Xcel Energy") is None

def test_categorize_bank_transaction_heuristics(db_session):
    # Test Joe's Plumbing -> 60100 Repairs & Maintenance
    cat_res = categorize_bank_transaction(
        payee="Joe's Plumbing",
        description="Check 1042 Joe's plumbing 500",
        amount=500.0,
        is_outflow=True,
        db=db_session
    )
    assert cat_res["category_account_number"] == "60100"
    assert "60100" in cat_res["category_display"]
    assert cat_res["match_status"] == "AUTO_CLASSIFIED"

    # Test Xcel Energy -> 60500 Utilities
    util_res = categorize_bank_transaction(
        payee="Xcel Energy",
        description="ACH Payment Xcel Energy Electric",
        amount=182.50,
        is_outflow=True,
        db=db_session
    )
    assert util_res["category_account_number"] == "60500"

    # Test Tenant Rent Deposit -> 40100 Rental Income
    rent_res = categorize_bank_transaction(
        payee="Tenant Rent",
        description="Deposit - Tenant Rent Unit 101",
        amount=1800.0,
        is_outflow=False,
        db=db_session
    )
    assert rent_res["category_account_number"] == "40100"

def test_categorize_bank_transaction_with_custom_rule(db_session):
    prop = db_session.query(Property).first()
    tax_cat = db_session.query(Category).filter(Category.account_number == "60300").first()

    # Create a custom bank rule
    rule = BankRule(
        name="Travis County Taxes Rule",
        match_keyword="Travis County Tax",
        match_field="payee_or_desc",
        target_category_id=tax_cat.id,
        target_property_id=prop.id,
        is_active=True
    )
    db_session.add(rule)
    db_session.commit()

    res = categorize_bank_transaction(
        payee="Travis County Tax Collector",
        description="ACH Travis County Tax Collector - Real Estate Taxes",
        amount=1250.0,
        is_outflow=True,
        db=db_session
    )
    assert res["match_status"] == "RULE_MATCH"
    assert res["category_account_number"] == "60300"
    assert res["property_id"] == prop.id

def test_parse_sample_chase_csv(db_session, tmp_path):
    generate_sample_bank_statements(str(tmp_path))
    chase_csv = os.path.join(str(tmp_path), "Sample_Chase_Operating_Checking.csv")
    with open(chase_csv, "rb") as f:
        file_bytes = f.read()

    result = parse_bank_statement_file(file_bytes, "Sample_Chase_Operating_Checking.csv", db=db_session)
    assert result["file_type"] == "CSV"
    assert result["total_rows_detected"] == 10

    # Verify Joe's Plumbing row
    plumbing_row = next((t for t in result["transactions"] if "Joe's Plumbing" in t["payee"]), None)
    assert plumbing_row is not None
    assert plumbing_row["check_number"] == "1042"
    assert plumbing_row["amount"] == 500.0
    assert plumbing_row["category_account_number"] == "60100"
    assert plumbing_row["transaction_type"] == "CHECK"

def test_parse_sample_wells_fargo_pdf(db_session, tmp_path):
    generate_sample_bank_statements(str(tmp_path))
    wf_pdf = os.path.join(str(tmp_path), "Sample_Wells_Fargo_Bank_Statement.pdf")
    with open(wf_pdf, "rb") as f:
        file_bytes = f.read()

    result = parse_bank_statement_file(file_bytes, "Sample_Wells_Fargo_Bank_Statement.pdf", db=db_session)
    assert result["file_type"] == "PDF"
    assert result["total_rows_detected"] >= 6

    # Verify Check 1042 Joe's plumbing 500 from PDF
    check_row = next((t for t in result["transactions"] if t.get("check_number") == "1042"), None)
    assert check_row is not None
    assert "Joe's Plumbing" in check_row["payee"]
    assert check_row["amount"] == 500.0
    assert check_row["category_account_number"] == "60100"
    assert check_row["transaction_type"] == "CHECK"

    # Verify Deposit from PDF
    dep_row = next((t for t in result["transactions"] if not t["is_outflow"]), None)
    assert dep_row is not None
    assert dep_row["amount"] in [1800.0, 2100.0]


def test_tmobile_clean_and_telephone_expense_heuristic(db_session):
    # Test cleaning vendor name
    assert clean_vendor_name("T-MOBILE*RECURRING 800-937-8997 WA") == "T-Mobile"
    assert clean_vendor_name("TMOBILE AUTO-PAY RECURRING PMT") == "T-Mobile"
    assert "Verizon" in clean_vendor_name("VERIZON WIRELESS PAYMENTS")

    # Test categorization to 61200 Telephone & Internet
    cat_res = categorize_bank_transaction(
        payee="T-Mobile",
        description="T-MOBILE*RECURRING 800-937-8997 WA",
        amount=85.0,
        is_outflow=True,
        db=db_session
    )
    assert cat_res["category_account_number"] == "61200"
    assert "Telephone" in cat_res["category_name"]
    assert cat_res["match_status"] == "AUTO_CLASSIFIED"


def test_parse_csv_raw_preview():
    csv_content = (
        "Transaction Date,Check Number,Description,Amount\n"
        "04/12/2026,1045,T-MOBILE*RECURRING,-85.00\n"
        "04/13/2026,,Xcel Energy Power Bill,-142.50\n"
        "04/15/2026,,Tenant Deposit Rent,+1850.00\n"
    ).encode("utf-8")

    preview = parse_csv_raw_preview(csv_content, "test_statement.csv")
    assert preview["total_rows"] == 3
    assert preview["raw_headers"] == ["Transaction Date", "Check Number", "Description", "Amount"]
    assert preview["suggested_mapping"]["date_col"] == "Transaction Date"
    assert preview["suggested_mapping"]["check_col"] == "Check Number"
    assert preview["suggested_mapping"]["description_col"] == "Description"
    assert preview["suggested_mapping"]["amount_col"] == "Amount"
    assert len(preview["raw_rows"]) == 3
    assert preview["raw_rows"][0]["Description"] == "T-MOBILE*RECURRING"


def test_strict_column_mapping_date_never_vendor(db_session):
    csv_content = (
        "Date,Desc,Net\n"
        "04/12/2026,T-MOBILE*RECURRING,-85.00\n"
        "04/15/2026,Joe's Plumbing Repairs,-350.00\n"
    ).encode("utf-8")

    mapping = {
        "date_col": "Date",
        "description_col": "Desc",
        "amount_col": "Net"
    }

    result = parse_bank_statement_file(
        csv_content,
        "custom_bank.csv",
        db=db_session,
        column_mapping=mapping
    )

    txns = result["transactions"]
    assert len(txns) == 2

    # Verify transaction 1: date is strictly '2026-04-12', payee is 'T-Mobile' (never '04/12/2026')
    t1 = txns[0]
    assert t1["date"] == "2026-04-12"
    assert t1["payee"] == "T-Mobile"
    assert t1["category_account_number"] == "61200"
    assert t1["amount"] == 85.0
    assert t1["is_outflow"] is True

    # Verify transaction 2: date is strictly '2026-04-15', payee is Joe's Plumbing
    t2 = txns[1]
    assert t2["date"] == "2026-04-15"
    assert "Joe's Plumbing" in t2["payee"]
    assert t2["category_account_number"] == "60100"


def test_suggest_create_account_flag_when_account_missing():
    # Calling categorize_bank_transaction without DB or without 61200 in DB
    cat_res = categorize_bank_transaction(
        payee="T-Mobile",
        description="T-MOBILE*RECURRING",
        amount=85.0,
        is_outflow=True,
        db=None
    )
    assert cat_res["category_account_number"] == "61200"
    assert cat_res.get("category_id") is None
    assert cat_res["suggest_rule"] is True


def test_chase_activity_format_with_trailing_commas_and_service_fees():
    # Exact Chase checking CSV format with trailing commas on data lines
    chase_csv = (
        "Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n"
        "DEBIT,08/31/2026,\"MONTHLY SERVICE FEE\",-15.00,FEE_TRANSACTION,1041.82,,\n"
        "DEBIT,08/27/2026,\"ORIG CO NAME:Transamerica           ORIG ID:9760958000 DESC DATE:260826 CO ENTRY DESCR:debitpmt  SEC:PPD    TRACE#:021000025764140 EED:260827   IND ID:                             IND NAME:ASHISH GUPTA TRN: 2395764140TC\",-60.00,ACH_DEBIT,1056.82,,\n"
        "CREDIT,08/25/2026,\"ORIG CO NAME:My Property Mana ORIG ID:1234567890 DESC DATE:260825\",1250.00,ACH_CREDIT,2306.82,,\n"
    ).encode("utf-8")

    # 1. Test parse_csv_raw_preview
    raw_prev = parse_csv_raw_preview(chase_csv, "Chase8135_Activity_20260923.csv")
    assert raw_prev["total_rows"] == 3
    assert len(raw_prev["parsed_preview_transactions"]) == 3

    p1 = raw_prev["parsed_preview_transactions"][0]
    assert p1["date"] == "2026-08-31"
    assert p1["payee"] == "Monthly Service Fee"
    assert p1["amount"] == 15.0
    assert p1["is_outflow"] is True
    assert p1["category_account_number"] == "61300"
    assert p1["category_name"] == "Bank & Merchant Service Fees"

    # 2. Test parse_bank_statement_file
    res = parse_bank_statement_file(chase_csv, "Chase8135_Activity_20260923.csv")
    txns = res["transactions"]
    assert len(txns) == 3

    # Row 1: Monthly Service Fee
    assert txns[0]["date"] == "2026-08-31"
    assert txns[0]["payee"] == "Monthly Service Fee"
    assert txns[0]["amount"] == 15.0
    assert txns[0]["is_outflow"] is True
    assert txns[0]["category_account_number"] == "61300"

    # Row 2: Transamerica
    assert txns[1]["date"] == "2026-08-27"
    assert txns[1]["payee"] == "Transamerica"
    assert txns[1]["amount"] == 60.0
    assert txns[1]["is_outflow"] is True
    assert txns[1]["category_account_number"] == "60400"

    # Row 3: Rental Income Inflow
    assert txns[2]["date"] == "2026-08-25"
    assert txns[2]["amount"] == 1250.0
    assert txns[2]["is_outflow"] is False
    assert txns[2]["category_account_number"] == "40100"


