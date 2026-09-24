import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base, ensure_db_schema
from backend.models import Category, Property, ClassEntity, Company, JournalEntry, JournalEntryLine
from backend.journal_engine import (
    get_next_journal_entry_number,
    validate_journal_entry_payload,
    create_journal_entry,
    get_journal_entries_list,
    delete_journal_entry
)
from backend.coa_engine import backfill_standard_account_numbers

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    ensure_db_schema(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    backfill_standard_account_numbers(db)
    
    # Create sample company, LLC, and Property
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

def test_journal_entry_number_generation(db_session):
    next_num = get_next_journal_entry_number(db_session)
    assert next_num == "JE-1001"

def test_journal_entry_balancing_validation(db_session):
    checking = db_session.query(Category).filter(Category.account_number.in_(["10100", "10010"])).first()
    repairs = db_session.query(Category).filter(Category.account_number == "60100").first()
    
    # 1. Unbalanced entry (Debit 150 != Credit 100) -> Should fail
    unbalanced_lines = [
        {"category_id": repairs.id, "debit": 150.0, "credit": 0.0},
        {"category_id": checking.id, "debit": 0.0, "credit": 100.0}
    ]
    is_valid, msg = validate_journal_entry_payload("2026-09-20", unbalanced_lines)
    assert is_valid is False
    assert "out of balance" in msg.lower()
    
    # 2. Single line entry -> Should fail
    single_line = [{"category_id": repairs.id, "debit": 150.0, "credit": 0.0}]
    is_valid, msg = validate_journal_entry_payload("2026-09-20", single_line)
    assert is_valid is False
    assert "at least 2 lines" in msg.lower()
    
    # 3. Balanced entry (Debit 150 == Credit 150) -> Should pass
    balanced_lines = [
        {"category_id": repairs.id, "debit": 150.0, "credit": 0.0},
        {"category_id": checking.id, "debit": 0.0, "credit": 150.0}
    ]
    is_valid, msg = validate_journal_entry_payload("2026-09-20", balanced_lines)
    assert is_valid is True

def test_create_and_sync_journal_entry(db_session):
    checking = db_session.query(Category).filter(Category.account_number.in_(["10100", "10010"])).first()
    repairs = db_session.query(Category).filter(Category.account_number == "60100").first()
    prop = db_session.query(Property).filter(Property.name == "2908 Depot").first()
    
    lines = [
        {"category_id": repairs.id, "debit": 350.0, "credit": 0.0, "memo": "Plumbing repair", "property_id": prop.id, "class_id": prop.class_id},
        {"category_id": checking.id, "debit": 0.0, "credit": 350.0, "memo": "Paid via checking"}
    ]
    
    je = create_journal_entry(
        db=db_session,
        date="2026-09-20",
        entry_number="JE-1001",
        memo="Plumbing repair for 2908 Depot",
        lines=lines
    )
    
    assert je.id is not None
    assert je.entry_number == "JE-1001"
    assert len(je.lines) == 2
    assert je.to_dict()["is_balanced"] is True
    
    # Verify next number advances to JE-1002
    next_num = get_next_journal_entry_number(db_session)
    assert next_num == "JE-1002"
    
    # Verify list filtering
    entries = get_journal_entries_list(db_session, from_date="2026-09-01", to_date="2026-09-30")
    assert len(entries) == 1
    assert entries[0].entry_number == "JE-1001"
    
    # Test delete
    deleted = delete_journal_entry(db_session, je.id)
    assert deleted is True
    assert len(get_journal_entries_list(db_session)) == 0
