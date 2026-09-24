import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base, ensure_db_schema
from backend.models import Category, Vendor
from backend.coa_engine import backfill_standard_account_numbers
from backend.vendor_engine import (
    get_next_vendor_account_number,
    create_vendor,
    update_vendor,
    get_vendors_list,
    delete_vendor,
    export_vendors_to_csv,
    seed_standard_vendors
)

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    ensure_db_schema(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    backfill_standard_account_numbers(db)
    yield db
    db.close()

def test_vendor_number_generation(db_session):
    next_num = get_next_vendor_account_number(db_session)
    assert next_num == "VEND-1001"

def test_vendor_crud_and_address_formatting(db_session):
    repairs_cat = db_session.query(Category).filter(Category.account_number == "60100").first()
    
    # 1. Create Vendor
    vendor = create_vendor(
        db=db_session,
        name="Austin HVAC Pros & Mechanical",
        account_number="VEND-1001",
        contact_person="Robert Vance",
        email="service@austinhvac.com",
        phone="(512) 555-0192",
        tax_id="74-8891234",
        is_1099_eligible=True,
        address_line1="1420 Industrial Blvd",
        address_line2="Suite 200",
        city="Austin",
        state="TX",
        zip_code="78745",
        default_category_id=repairs_cat.id if repairs_cat else None,
        notes="Primary HVAC repair contractor."
    )
    
    assert vendor.id is not None
    assert vendor.account_number == "VEND-1001"
    assert "1420 Industrial Blvd" in vendor.formatted_address()
    assert "Austin, TX 78745" in vendor.formatted_address()
    assert vendor.is_1099_eligible is True
    
    # 2. Verify next account number is VEND-1002
    assert get_next_vendor_account_number(db_session) == "VEND-1002"
    
    # 3. Update Vendor
    updated = update_vendor(
        db=db_session,
        vendor_id=vendor.id,
        contact_person="Bob Vance, President",
        phone="(512) 555-9999"
    )
    assert updated.contact_person == "Bob Vance, President"
    assert updated.phone == "(512) 555-9999"
    
    # 4. Search Vendor
    results = get_vendors_list(db_session, search="HVAC")
    assert len(results) == 1
    assert results[0].name == "Austin HVAC Pros & Mechanical"
    
    # 5. CSV Export
    csv_text = export_vendors_to_csv([vendor])
    assert "Account Number,Vendor Name,Address Line 1" in csv_text
    assert "VEND-1001" in csv_text
    assert "Austin HVAC Pros & Mechanical" in csv_text
    
    # 6. Delete Vendor
    deleted = delete_vendor(db_session, vendor.id)
    assert deleted is True
    assert len(get_vendors_list(db_session)) == 0

def test_seed_standard_vendors(db_session):
    seed_standard_vendors(db_session)
    vendors = get_vendors_list(db_session)
    assert len(vendors) >= 5
    
    tax_collector = db_session.query(Vendor).filter(Vendor.account_number == "VEND-1002").first()
    assert tax_collector is not None
    assert "Travis County" in tax_collector.name
    assert tax_collector.city == "Austin"
