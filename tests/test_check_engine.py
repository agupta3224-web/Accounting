import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base, ensure_db_schema
from backend.models import Category, Property, ClassEntity, Company, CheckRecord, JournalEntry
from backend.coa_engine import backfill_standard_account_numbers
from backend.check_engine import (
    number_to_words,
    get_next_check_number,
    create_check,
    void_check,
    get_checks_list,
    render_check_voucher_html
)

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

def test_number_to_words_converter():
    assert number_to_words(1250.00) == "One Thousand Two Hundred Fifty and 00/100 Dollars"
    assert number_to_words(45.85) == "Forty-Five and 85/100 Dollars"
    assert number_to_words(1000.00) == "One Thousand and 00/100 Dollars"
    assert number_to_words(10500.25) == "Ten Thousand Five Hundred and 25/100 Dollars"
    assert number_to_words(0.0) == "Zero and 00/100 Dollars"

def test_write_check_workflow(db_session):
    checking = db_session.query(Category).filter(Category.account_number.in_(["10100", "10010"])).first()
    repairs = db_session.query(Category).filter(Category.account_number == "60100").first()
    prop = db_session.query(Property).filter(Property.name == "2908 Depot").first()
    
    # Auto check number
    chk_num = get_next_check_number(db_session, checking.id)
    assert chk_num == "1001"
    
    # Write Check with split
    splits = [{
        "category_id": repairs.id,
        "amount": 750.0,
        "memo": "HVAC Compressor Repair",
        "class_id": prop.class_id,
        "property_id": prop.id
    }]
    
    check = create_check(
        db=db_session,
        bank_account_id=checking.id,
        check_number="1001",
        date="2026-09-20",
        payee="Austin HVAC Pros",
        amount=750.0,
        address="100 Cooling Way, Austin TX",
        memo="HVAC Service 2908 Depot",
        splits=splits
    )
    
    assert check.id is not None
    assert check.check_number == "1001"
    assert check.amount_in_words == "Seven Hundred Fifty and 00/100 Dollars"
    assert check.journal_entry_id is not None
    
    # Verify next check number is 1002
    assert get_next_check_number(db_session, checking.id) == "1002"
    
    # Verify voucher HTML generation
    voucher_html = render_check_voucher_html(check)
    assert "Austin HVAC Pros" in voucher_html
    assert "$750.00" in voucher_html
    assert "CHECK #1001" in voucher_html
    
    # Test voiding check
    voided = void_check(db_session, check.id)
    assert voided.is_void is True
    assert voided.journal_entry_id is None
