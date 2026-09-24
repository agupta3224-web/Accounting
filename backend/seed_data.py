import json
import os
from .models import Company, ClassEntity, Property, Category, Transaction, Statement

def init_db():
    from .company_manager import company_manager
    if company_manager.engine:
        from .database import Base
        Base.metadata.create_all(bind=company_manager.engine)

def seed_sample_data_with_db(db):
    if db.query(Company).first():
        return {"message": "Database already seeded with companies"}

    # 1. Chart of Accounts Seed (5-digit accounting numbering system)
    from .coa_engine import STANDARD_COA_SEED
    for acct_data in STANDARD_COA_SEED:
        existing = db.query(Category).filter(
            (Category.name == acct_data["name"]) | 
            (Category.account_number == acct_data["account_number"])
        ).first()
        if not existing:
            cat = Category(
                account_number=acct_data["account_number"],
                name=acct_data["name"],
                type=acct_data["type"],
                sub_type=acct_data.get("sub_type"),
                description=acct_data.get("description"),
                is_repair_category=acct_data.get("is_repair_category", False),
                is_rental_income=acct_data.get("is_rental_income", False),
                is_active=True
            )
            db.add(cat)
    db.commit()

    # Query category references for demo transactions
    cat_rental = db.query(Category).filter(Category.account_number == "40100").first()
    cat_late = db.query(Category).filter(Category.account_number == "40200").first()
    cat_repairs = db.query(Category).filter(Category.account_number == "60100").first()
    cat_management = db.query(Category).filter(Category.account_number == "60200").first()
    cat_taxes = db.query(Category).filter(Category.account_number == "60300").first()
    cat_insurance = db.query(Category).filter(Category.account_number == "60400").first()
    cat_utilities = db.query(Category).filter(Category.account_number == "60500").first()
    cat_landscaping = db.query(Category).filter(Category.account_number == "60600").first()
    cat_mortgage = db.query(Category).filter(Category.account_number == "90100").first()
    cat_capex = db.query(Category).filter(Category.account_number == "90300").first()

    # 2. Companies (Top Level)
    company1 = Company(name="Apex Real Estate Holdings Inc.", ein="84-2938102", notes="Primary commercial & multi-family portfolio")
    company2 = SummitCapital = Company(name="Summit Capital Partners", ein="77-4920193", notes="Residential & single-family investment assets")
    db.add_all([company1, company2])
    db.commit()

    # 3. Classes (LLCs under Company)
    llc_depot = ClassEntity(company_id=company1.id, name="Depot Holdings LLC", description="Special purpose entity for Depot corridor assets")
    llc_sunset = ClassEntity(company_id=company1.id, name="Sunset Palms LLC", description="Entity for Austin multi-family properties")
    llc_oakridge = ClassEntity(company_id=company2.id, name="Oakridge Properties LLC", description="Denver residential duplex assets")
    llc_highland = ClassEntity(company_id=company2.id, name="Highland Investments LLC", description="Pacific Northwest single-family rentals")

    db.add_all([llc_depot, llc_sunset, llc_oakridge, llc_highland])
    db.commit()

    # 4. Sub-Classes (Properties under LLCs with full structured address form)
    prop_depot = Property(
        class_id=llc_depot.id,
        name="2908 Depot",
        address_line1="2908 Depot Rd",
        address_line2="Suite 100",
        city="Austin",
        state="TX",
        zip_code="78704",
        property_type="Commercial / Multi-Unit",
        units_count=4
    )
    prop_sunset = Property(
        class_id=llc_sunset.id,
        name="Sunset Palms Apartments",
        address_line1="742 Evergreen Terrace",
        address_line2="Bldg A-C",
        city="Austin",
        state="TX",
        zip_code="78701",
        property_type="Multi-Family",
        units_count=8
    )
    prop_oakridge = Property(
        class_id=llc_oakridge.id,
        name="Oakridge Duplex",
        address_line1="108 Oakridge Blvd",
        address_line2="",
        city="Denver",
        state="CO",
        zip_code="80202",
        property_type="Duplex",
        units_count=2
    )
    prop_highland = Property(
        class_id=llc_highland.id,
        name="Highland Heights SFH",
        address_line1="450 Highland Way",
        address_line2="",
        city="Seattle",
        state="WA",
        zip_code="98101",
        property_type="Single-Family",
        units_count=1
    )

    db.add_all([prop_depot, prop_sunset, prop_oakridge, prop_highland])
    db.commit()

    # 5. Transactions for Sunset Palms (March 2026) - Aggregated Rental Income demo
    sunset_units_rent = [
        {"date": "2026-03-01", "account_name": "Unit 101 Rent", "description": "Tenant Alice Smith - Unit 101 Rent", "amount": 1450.0},
        {"date": "2026-03-01", "account_name": "Unit 102 Rent", "description": "Tenant Bob Jones - Unit 102 Rent", "amount": 1450.0},
        {"date": "2026-03-02", "account_name": "Unit 103 Rent", "description": "Tenant Charlie Brown - Unit 103 Rent", "amount": 1500.0},
        {"date": "2026-03-03", "account_name": "Unit 104 Rent", "description": "Tenant Diana Prince - Unit 104 Rent", "amount": 1400.0},
        {"date": "2026-03-05", "account_name": "Unit 201 Rent", "description": "Tenant Evan Wright - Unit 201 Rent", "amount": 1600.0},
        {"date": "2026-03-05", "account_name": "Unit 202 Rent", "description": "Tenant Fiona Gallagher - Unit 202 Rent", "amount": 1550.0},
        {"date": "2026-03-06", "account_name": "Unit 203 Rent", "description": "Tenant George Clark - Unit 203 Rent", "amount": 1500.0},
        {"date": "2026-03-07", "account_name": "Unit 204 Rent", "description": "Tenant Hannah Abbott - Unit 204 Rent", "amount": 1550.0}
    ]
    total_sunset_rent = sum(u['amount'] for u in sunset_units_rent) # $12,000.00

    t_sunset_rent = Transaction(
        date="2026-03-01", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_rental.id,
        account_name="Rental Income", category_type="INCOME", amount=total_sunset_rent,
        description="Consolidated Rental Income (8 units aggregated)", payee="Multiple Tenants", source="IMPORTED",
        is_aggregated=True, raw_aggregated_items=json.dumps(sunset_units_rent)
    )
    t_sunset_late = Transaction(
        date="2026-03-10", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_late.id,
        account_name="Late Fees & Misc Income", category_type="INCOME", amount=150.0, description="Unit 104 Late Fee", source="IMPORTED"
    )
    t_sunset_mgmt = Transaction(
        date="2026-03-15", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_management.id,
        account_name="Property Management Fees", category_type="OPERATING_EXPENSE", amount=960.0, description="8% Monthly Management Fee - Peak Properties", payee="Peak Property Management", source="IMPORTED"
    )
    t_sunset_repairs = Transaction(
        date="2026-03-18", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_repairs.id,
        account_name="Repairs & Maintenance", category_type="OPERATING_EXPENSE", amount=840.0, description="Unit 102 Plumbing Leak & Valve Replacement", payee="Apex Plumbing LLC", source="IMPORTED"
    )
    t_sunset_repairs2 = Transaction(
        date="2026-03-22", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_repairs.id,
        account_name="Repairs & Maintenance", category_type="OPERATING_EXPENSE", amount=360.0, description="Unit 203 HVAC Inspection & Filter Change", payee="CoolAir Mechanical", source="IMPORTED"
    )
    t_sunset_util = Transaction(
        date="2026-03-25", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_utilities.id,
        account_name="Utilities (Water/Gas/Trash)", category_type="OPERATING_EXPENSE", amount=620.0, description="City Water & Waste Common Meter", payee="City Utility Dept", source="IMPORTED"
    )
    t_sunset_landscape = Transaction(
        date="2026-03-28", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_landscaping.id,
        account_name="Landscaping & Grounds", category_type="OPERATING_EXPENSE", amount=300.0, description="Bi-weekly mowing & hedge trimming", payee="GreenThumb Landscaping", source="IMPORTED"
    )
    t_sunset_mortgage = Transaction(
        date="2026-03-01", month="2026-03", property_id=prop_sunset.id, class_id=llc_sunset.id, category_id=cat_mortgage.id,
        account_name="Mortgage Principal & Interest", category_type="NON_OPERATING_EXPENSE", amount=4800.0, description="Direct Chase Commercial Loan #8841", payee="Chase Bank", source="MANUAL"
    )

    # 6. Transactions for 2908 Depot (March 2026)
    depot_rent_items = [
        {"date": "2026-03-01", "account_name": "Suite 100 Commercial Lease", "description": "Tenant Blue Studio Design", "amount": 2800.0},
        {"date": "2026-03-01", "account_name": "Suite 200 Creative Lab", "description": "Tenant Nexa Software", "amount": 3200.0}
    ]
    t_depot_rent = Transaction(
        date="2026-03-01", month="2026-03", property_id=prop_depot.id, class_id=llc_depot.id, category_id=cat_rental.id,
        account_name="Rental Income", category_type="INCOME", amount=6000.0,
        description="Consolidated Rental Income (Suite 100 & Suite 200)", payee="Commercial Tenants", source="IMPORTED",
        is_aggregated=True, raw_aggregated_items=json.dumps(depot_rent_items)
    )
    t_depot_repairs = Transaction(
        date="2026-03-14", month="2026-03", property_id=prop_depot.id, class_id=llc_depot.id, category_id=cat_repairs.id,
        account_name="Repairs & Maintenance", category_type="OPERATING_EXPENSE", amount=420.0, description="Lighting ballasts and exterior signage repair", payee="Austin Electric Pro", source="IMPORTED"
    )
    t_depot_mgmt = Transaction(
        date="2026-03-15", month="2026-03", property_id=prop_depot.id, class_id=llc_depot.id, category_id=cat_management.id,
        account_name="Property Management Fees", category_type="OPERATING_EXPENSE", amount=480.0, description="Management fee (8%)", payee="CapCity PM", source="IMPORTED"
    )

    # 7. Oakridge Duplex Transactions (March 2026)
    oakridge_rent_items = [
        {"date": "2026-03-01", "account_name": "Unit A Rent", "description": "Unit A Tenant Payment", "amount": 2200.0},
        {"date": "2026-03-02", "account_name": "Unit B Rent", "description": "Unit B Tenant Payment", "amount": 2100.0}
    ]
    t_oak_rent = Transaction(
        date="2026-03-01", month="2026-03", property_id=prop_oakridge.id, class_id=llc_oakridge.id, category_id=cat_rental.id,
        account_name="Rental Income", category_type="INCOME", amount=4300.0,
        description="Consolidated Rental Income (Unit A + Unit B)", payee="Tenants", source="IMPORTED",
        is_aggregated=True, raw_aggregated_items=json.dumps(oakridge_rent_items)
    )
    t_oak_mgmt = Transaction(
        date="2026-03-15", month="2026-03", property_id=prop_oakridge.id, class_id=llc_oakridge.id, category_id=cat_management.id,
        account_name="Property Management Fees", category_type="OPERATING_EXPENSE", amount=344.0, description="8% Monthly Management Fee", payee="Mile High PM", source="IMPORTED"
    )
    t_oak_repairs = Transaction(
        date="2026-03-19", month="2026-03", property_id=prop_oakridge.id, class_id=llc_oakridge.id, category_id=cat_repairs.id,
        account_name="Repairs & Maintenance", category_type="OPERATING_EXPENSE", amount=215.0, description="Unit B Garbage Disposal Replacement", payee="HandyPro Services", source="IMPORTED"
    )
    t_oak_mortgage = Transaction(
        date="2026-03-01", month="2026-03", property_id=prop_oakridge.id, class_id=llc_oakridge.id, category_id=cat_mortgage.id,
        account_name="Mortgage Principal & Interest", category_type="NON_OPERATING_EXPENSE", amount=1950.0, description="Wells Fargo 30-yr fixed", payee="Wells Fargo", source="MANUAL"
    )

    # 8. Highland Heights Single Family Home (March 2026)
    t_sfh_rent = Transaction(
        date="2026-03-01", month="2026-03", property_id=prop_highland.id, class_id=llc_highland.id, category_id=cat_rental.id,
        account_name="Rental Income", category_type="INCOME", amount=3200.0, description="Monthly Lease Payment - Highland Heights", payee="Tenant Mark Davis", source="IMPORTED"
    )
    t_sfh_repairs = Transaction(
        date="2026-03-12", month="2026-03", property_id=prop_highland.id, class_id=llc_highland.id, category_id=cat_repairs.id,
        account_name="Repairs & Maintenance", category_type="OPERATING_EXPENSE", amount=950.0, description="Water Heater Repair & Expansion Tank", payee="Emerald City Plumbing", source="IMPORTED"
    )
    t_sfh_tax = Transaction(
        date="2026-03-15", month="2026-03", property_id=prop_highland.id, class_id=llc_highland.id, category_id=cat_taxes.id,
        account_name="Property Taxes", category_type="OPERATING_EXPENSE", amount=480.0, description="King County Semi-Annual Escrow", payee="King County Treasurer", source="MANUAL"
    )

    all_txns = [
        t_sunset_rent, t_sunset_late, t_sunset_mgmt, t_sunset_repairs, t_sunset_repairs2, t_sunset_util, t_sunset_landscape, t_sunset_mortgage,
        t_depot_rent, t_depot_repairs, t_depot_mgmt,
        t_oak_rent, t_oak_mgmt, t_oak_repairs, t_oak_mortgage,
        t_sfh_rent, t_sfh_repairs, t_sfh_tax
    ]
    db.add_all(all_txns)
    db.commit()
        # 9. Seed Standard Real Estate Vendors
    from .vendor_engine import seed_standard_vendors
    seed_standard_vendors(db)

    return {"message": "Sample data seeded successfully"}

def seed_sample_data():
    from .database import get_db
    for db in get_db():
        return seed_sample_data_with_db(db)
