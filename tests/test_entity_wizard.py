"""
Automated unit tests for the Entity Setup Interview Wizard.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_wizard_portfolio_and_multi_member_llc_setup():
    """Test creating a unified Portfolio and setting up a Multi-Member LLC underneath it."""
    payload = {
        "is_portfolio": True,
        "portfolio_name": "Skyline Portfolio Holdings LLC",
        "portfolio_ein": "12-3456789",
        "portfolio_notes": "Commercial & Residential multi-entity portfolio",
        "entity_name": "Skyline Downtown LLC",
        "entity_type": "LLC",
        "tax_classification": "MULTI_MEMBER",
        "tax_form": "Form 1065",
        "ein": "98-7654321",
        "office_address_line1": "100 Skyline Way",
        "office_address_line2": "Suite 400",
        "office_city": "Denver",
        "office_state": "CO",
        "office_zip": "80202",
        "mailing_same_as_office": True,
        "contact_name": "Marcus Vance",
        "contact_phone": "(303) 555-0199",
        "initial_property_name": "Skyline Tower",
        "initial_property_address": "100 Skyline Way, Denver, CO 80202",
        "initial_property_type": "Commercial",
        "initial_property_units": 24
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    # Verify Portfolio Company
    assert data["company"]["name"] == "Skyline Portfolio Holdings LLC"
    assert data["company"]["ein"] == "12-3456789"

    # Verify ClassEntity
    cls = data["class_entity"]
    assert cls["name"] == "Skyline Downtown LLC"
    assert cls["entity_type"] == "LLC"
    assert cls["tax_classification"] == "MULTI_MEMBER"
    assert cls["tax_form"] == "Form 1065"
    assert cls["contact_name"] == "Marcus Vance"
    assert cls["contact_phone"] == "(303) 555-0199"
    assert "100 Skyline Way" in cls["office_address"]
    assert "100 Skyline Way" in cls["mailing_address"] # Copied because mailing_same_as_office is True

    # Verify Initial Property
    prop = data["property"]
    assert prop is not None
    assert prop["name"] == "Skyline Tower"
    assert prop["property_type"] == "Commercial"
    assert prop["units_count"] == 24


def test_wizard_single_member_disregarded_llc_setup():
    """Test creating a Single-Member Disregarded LLC with distinct mailing address."""
    payload = {
        "is_portfolio": False,
        "entity_name": "Pineview Rentals LLC",
        "entity_type": "LLC",
        "tax_classification": "SINGLE_MEMBER_DISREGARDED",
        "tax_form": "Schedule E",
        "office_address_line1": "450 Pine St",
        "office_city": "Boulder",
        "office_state": "CO",
        "office_zip": "80302",
        "mailing_same_as_office": False,
        "mailing_address_line1": "PO Box 8812",
        "mailing_city": "Boulder",
        "mailing_state": "CO",
        "mailing_zip": "80306",
        "contact_name": "Elena Rostova",
        "contact_phone": "(303) 555-4421"
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    cls = data["class_entity"]
    assert cls["name"] == "Pineview Rentals LLC"
    assert cls["entity_type"] == "LLC"
    assert cls["tax_classification"] == "SINGLE_MEMBER_DISREGARDED"
    assert cls["contact_name"] == "Elena Rostova"
    assert "450 Pine St" in cls["office_address"]
    assert "PO Box 8812" in cls["mailing_address"]


def test_wizard_corporation_s_corp_setup():
    """Test setting up an S-Corporation with Form 1120-S and corporate officer contact."""
    payload = {
        "is_portfolio": False,
        "entity_name": "Apex Asset Management Corp",
        "entity_type": "CORP",
        "tax_classification": "S_CORP",
        "tax_form": "Form 1120-S",
        "ein": "45-9871234",
        "office_address_line1": "700 17th St",
        "office_address_line2": "Floor 12",
        "office_city": "Denver",
        "office_state": "CO",
        "office_zip": "80202",
        "mailing_same_as_office": True,
        "contact_name": "David Sterling, President",
        "contact_phone": "(720) 555-8899"
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    cls = data["class_entity"]
    assert cls["name"] == "Apex Asset Management Corp"
    assert cls["entity_type"] == "CORP"
    assert cls["tax_classification"] == "S_CORP"
    assert cls["tax_form"] == "Form 1120-S"
    assert cls["contact_name"] == "David Sterling, President"


def test_wizard_self_employed_setup():
    """Test setting up a Self-Employed / Sole Proprietor entity."""
    payload = {
        "is_portfolio": False,
        "entity_name": "Sarah Jenkins Real Estate",
        "entity_type": "SELF_EMPLOYED",
        "tax_classification": "SOLE_PROPRIETOR",
        "tax_form": "Schedule C",
        "office_address_line1": "880 Elm Street",
        "office_city": "Golden",
        "office_state": "CO",
        "office_zip": "80401",
        "mailing_same_as_office": True,
        "contact_name": "Sarah Jenkins",
        "contact_phone": "(303) 555-7766"
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    cls = data["class_entity"]
    assert cls["name"] == "Sarah Jenkins Real Estate"
    assert cls["entity_type"] == "SELF_EMPLOYED"
    assert cls["tax_classification"] == "SOLE_PROPRIETOR"
    assert cls["contact_name"] == "Sarah Jenkins"


def test_wizard_create_new_company_file():
    """Test creating a brand-new company database file via the entity setup wizard."""
    unique_name = "Wizard Auto Company LLC"
    payload = {
        "create_new_company_file": True,
        "is_portfolio": False,
        "entity_name": unique_name,
        "entity_type": "LLC",
        "tax_classification": "SINGLE_MEMBER_DISREGARDED",
        "tax_form": "Schedule E",
        "office_address_line1": "123 Main St",
        "office_city": "Austin",
        "office_state": "TX",
        "office_zip": "78701",
        "mailing_same_as_office": True,
        "contact_name": "Test Owner",
        "contact_phone": "(512) 555-0100"
    }

    comp_key = None
    try:
        res = client.post("/api/entity-wizard/setup", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["created_new_company_file"] is True
        assert unique_name.lower() in data["active_company_name"].lower()
        comp_key = data["active_company_key"]

        # Verify session is now on this new company
        sess_res = client.get("/api/system/session")
        assert sess_res.status_code == 200
        sess = sess_res.json()
        assert unique_name.lower() in sess["active_company_name"].lower()
    finally:
        # Cleanup: switch back to sample_company and delete the temporary company file
        client.post("/api/system/companies/open", json={"company_key": "sample_company"})
        if comp_key:
            client.delete(f"/api/system/companies/{comp_key}")


def test_wizard_multifamily_building_as_whole():
    """Test creating a multifamily apartment building configured as building as a whole."""
    payload = {
        "is_portfolio": False,
        "entity_name": "Lone Star Apartments LLC",
        "entity_type": "LLC",
        "tax_classification": "SINGLE_MEMBER_DISREGARDED",
        "tax_form": "Schedule E",
        "office_address_line1": "500 Congress Ave",
        "office_city": "Austin",
        "office_state": "TX",
        "office_zip": "78701",
        "mailing_same_as_office": True,
        "contact_name": "Austin Manager",
        "contact_phone": "(512) 555-1234",
        "properties": [
            {
                "name": "Oakview Manor",
                "address_line1": "1200 Oakview Lane",
                "address_line2": "Building 1",
                "city": "Austin",
                "state": "TX",
                "zip_code": "78704",
                "property_type": "Multi-Family",
                "units_count": 12,
                "acquisition_cost": 1500000.0,
                "acquisition_date": "2024-03-15",
                "is_multifamily": True,
                "multifamily_mode": "WHOLE"
            }
        ]
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    prop = data["property"]
    assert prop is not None
    assert prop["name"] == "Oakview Manor"
    assert prop["address_line1"] == "1200 Oakview Lane"
    assert prop["address_line2"] == "Building 1"
    assert prop["city"] == "Austin"
    assert prop["state"] == "TX"
    assert prop["zip_code"] == "78704"
    assert prop["acquisition_cost"] == 1500000.0
    assert prop["acquisition_date"] == "2024-03-15"
    assert prop["property_type"] == "Multi-Family"


def test_wizard_multifamily_individual_apartments():
    """Test creating a multifamily property configured as individual apartments with spaces for each unit."""
    payload = {
        "is_portfolio": False,
        "entity_name": "Maple Court Residences LLC",
        "entity_type": "LLC",
        "tax_classification": "MULTI_MEMBER",
        "tax_form": "Form 1065",
        "office_address_line1": "880 Maple Street",
        "office_city": "Denver",
        "office_state": "CO",
        "office_zip": "80203",
        "mailing_same_as_office": True,
        "contact_name": "Apartment Manager",
        "contact_phone": "(303) 555-8822",
        "properties": [
            {
                "name": "Maple Court",
                "address_line1": "880 Maple St",
                "city": "Denver",
                "state": "CO",
                "zip_code": "80203",
                "property_type": "Multi-Family",
                "acquisition_cost": 2200000.0,
                "acquisition_date": "2023-08-01",
                "is_multifamily": True,
                "multifamily_mode": "INDIVIDUAL_UNITS",
                "apartment_units": [
                    {
                        "unit_number": "Apt 101",
                        "sub_class_name": "880 Maple St - Apt 101",
                        "acquisition_cost": 550000.0
                    },
                    {
                        "unit_number": "Apt 102",
                        "sub_class_name": "880 Maple St - Apt 102",
                        "acquisition_cost": 550000.0
                    },
                    {
                        "unit_number": "Apt 201",
                        "sub_class_name": "880 Maple St - Apt 201",
                        "acquisition_cost": 550000.0
                    }
                ]
            }
        ]
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    # Verify that properties list has the individual units
    props_res = client.get(f"/api/properties?class_id={data['class_entity']['id']}")
    assert props_res.status_code == 200
    props = props_res.json()
    unit_numbers = [p["unit_number"] for p in props if p.get("unit_number")]
    assert "Apt 101" in unit_numbers
    assert "Apt 102" in unit_numbers
    assert "Apt 201" in unit_numbers

    # Verify unit properties inherited address and acquisition data
    apt101 = next(p for p in props if p.get("unit_number") == "Apt 101")
    assert apt101["address_line1"] == "880 Maple St"
    assert apt101["city"] == "Denver"
    assert apt101["state"] == "CO"
    assert apt101["zip_code"] == "80203"
    assert apt101["acquisition_cost"] == 550000.0


def test_wizard_multiple_properties_sequential_entry():
    """Test setting up multiple properties sequentially in the interview."""
    payload = {
        "is_portfolio": False,
        "entity_name": "Front Range Holdings LLC",
        "entity_type": "LLC",
        "tax_classification": "SINGLE_MEMBER_DISREGARDED",
        "tax_form": "Schedule E",
        "office_address_line1": "100 Broadway",
        "office_city": "Denver",
        "office_state": "CO",
        "office_zip": "80203",
        "mailing_same_as_office": True,
        "contact_name": "Portfolio Lead",
        "contact_phone": "(303) 555-9988",
        "properties": [
            {
                "name": "1420 Pearl St",
                "address_line1": "1420 Pearl St",
                "city": "Boulder",
                "state": "CO",
                "zip_code": "80302",
                "property_type": "Commercial",
                "units_count": 4,
                "acquisition_cost": 850000.0,
                "acquisition_date": "2022-05-10"
            },
            {
                "name": "3100 Arapahoe Ave",
                "address_line1": "3100 Arapahoe Ave",
                "address_line2": "Suite 200",
                "city": "Boulder",
                "state": "CO",
                "zip_code": "80303",
                "property_type": "Residential",
                "units_count": 1,
                "acquisition_cost": 420000.0,
                "acquisition_date": "2023-01-20"
            }
        ]
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    props_res = client.get(f"/api/properties?class_id={data['class_entity']['id']}")
    assert props_res.status_code == 200
    props = props_res.json()
    prop_names = [p["name"] for p in props]
    assert "1420 Pearl St" in prop_names
    assert "3100 Arapahoe Ave" in prop_names

    pearl = next(p for p in props if p["name"] == "1420 Pearl St")
    assert pearl["acquisition_cost"] == 850000.0
    assert pearl["acquisition_date"] == "2022-05-10"
    assert pearl["city"] == "Boulder"


def test_wizard_portfolio_with_multiple_llcs():
    """Test creating a portfolio with multiple LLCs and holdings under each LLC."""
    payload = {
        "is_portfolio": True,
        "portfolio_name": "Lone Star Grand Portfolio",
        "portfolio_ein": "11-2233445",
        "entities": [
            {
                "entity_name": "Lone Star Austin LLC",
                "entity_type": "LLC",
                "tax_classification": "MULTI_MEMBER",
                "tax_form": "Form 1065",
                "office_address_line1": "100 Congress Ave",
                "office_city": "Austin",
                "office_state": "TX",
                "office_zip": "78701",
                "mailing_same_as_office": True,
                "contact_name": "Austin Lead",
                "properties": [
                    {
                        "name": "Congress Heights",
                        "address_line1": "100 Congress Ave",
                        "city": "Austin",
                        "state": "TX",
                        "zip_code": "78701",
                        "property_type": "Commercial",
                        "acquisition_cost": 2500000.0
                    }
                ]
            },
            {
                "entity_name": "Lone Star Dallas LLC",
                "entity_type": "LLC",
                "tax_classification": "MULTI_MEMBER",
                "tax_form": "Form 1065",
                "office_address_line1": "500 Main St",
                "office_city": "Dallas",
                "office_state": "TX",
                "office_zip": "75201",
                "mailing_same_as_office": True,
                "contact_name": "Dallas Lead",
                "properties": [
                    {
                        "name": "Main Street Plaza",
                        "address_line1": "500 Main St",
                        "city": "Dallas",
                        "state": "TX",
                        "zip_code": "75201",
                        "property_type": "Commercial",
                        "acquisition_cost": 1800000.0
                    }
                ]
            }
        ]
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["class_entities"]) == 2
    llc_names = [c["name"] for c in data["class_entities"]]
    assert "Lone Star Austin LLC" in llc_names
    assert "Lone Star Dallas LLC" in llc_names

    # Verify both properties were created
    assert len(data["properties"]) == 2
    prop_names = [p["name"] for p in data["properties"]]
    assert "Congress Heights" in prop_names
    assert "Main Street Plaza" in prop_names


def test_wizard_custom_base_coa_creation():
    """Test setting up an entity with custom base chart of accounts."""
    unique_name = "Custom COA Real Estate LLC"
    payload = {
        "create_new_company_file": True,
        "is_portfolio": False,
        "coa_mode": "CUSTOM",
        "entity_name": unique_name,
        "entity_type": "LLC",
        "tax_classification": "SINGLE_MEMBER_DISREGARDED",
        "tax_form": "Schedule E",
        "office_address_line1": "777 Custom Way",
        "office_city": "Denver",
        "office_state": "CO",
        "office_zip": "80202",
        "mailing_same_as_office": True
    }

    comp_key = None
    try:
        res = client.post("/api/entity-wizard/setup", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["coa_mode"] == "CUSTOM"
        comp_key = data.get("active_company_key")

        # Verify custom 8-base accounts exist
        accts_res = client.get("/api/accounts")
        assert accts_res.status_code == 200
        accts = accts_res.json()
        acct_dict = {a["account_number"]: a["name"] for a in accts}
        assert acct_dict.get("10000") == "All Assets"
        assert acct_dict.get("20000") == "All Liabilities"
        assert acct_dict.get("30000") == "All Equity"
        assert acct_dict.get("40000") == "All Revenue (Income)"
        assert acct_dict.get("50000") == "Used for Flips only"
        assert acct_dict.get("60000") == "All Operating Expenses"
        assert acct_dict.get("70000") == "All Operating Expenses"
        assert acct_dict.get("80000") == "Other Income/Expenses"
    finally:
        client.post("/api/system/companies/open", json={"company_key": "sample_company"})
        if comp_key:
            client.delete(f"/api/system/companies/{comp_key}")


def test_wizard_with_initial_bank_opening_balance():
    """Test creating a new entity with starting bank opening balance and date."""
    unique_name = "Opening Balance Test LLC"
    payload = {
        "create_new_company_file": True,
        "is_portfolio": False,
        "entity_name": unique_name,
        "entity_type": "LLC",
        "tax_classification": "SINGLE_MEMBER_DISREGARDED",
        "tax_form": "Schedule E",
        "office_address_line1": "999 Capital Blvd",
        "office_city": "Denver",
        "office_state": "CO",
        "office_zip": "80202",
        "mailing_same_as_office": True,
        "initial_bank_opening_balance": 18500.0,
        "initial_bank_opening_date": "2026-01-15"
    }

    comp_key = None
    try:
        res = client.post("/api/entity-wizard/setup", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        comp_key = data.get("active_company_key")

        # Verify checking account 10010 has opening balance and date
        accts_res = client.get("/api/accounts")
        assert accts_res.status_code == 200
        accts = accts_res.json()
        checking = next((a for a in accts if a.get("account_number") in ["10100", "10010"] or "Operating Checking" in a.get("name", "")), None)
        assert checking is not None
        assert checking["opening_balance"] == 18500.0
        assert checking["opening_balance_date"] == "2026-01-15"
        assert checking["current_balance"] == 18500.0

        # Verify check bank balance endpoint
        bal_res = client.get(f"/api/checks/bank-balance/{checking['id']}")
        assert bal_res.status_code == 200
        bal_data = bal_res.json()
        assert bal_data["balance"] == 18500.0
    finally:
        client.post("/api/system/companies/open", json={"company_key": "sample_company"})
        if comp_key:
            client.delete(f"/api/system/companies/{comp_key}")


def test_wizard_common_portfolio_expense_class_creation():
    """Test creating a portfolio setup with a shared common expense class (for telephone, legal, software)."""
    payload = {
        "is_portfolio": True,
        "portfolio_name": "Unified Apex Holdings LLC",
        "portfolio_ein": "88-1234567",
        "entity_name": "Apex Commercial LLC",
        "entity_type": "LLC",
        "tax_classification": "MULTI_MEMBER",
        "include_common_class": True,
        "common_class_name": "Portfolio / Company Expense",
        "common_property_name": "Portfolio / Company Overhead",
        "properties": [
            {
                "name": "1200 Market Center",
                "address_line1": "1200 Market St",
                "city": "Denver",
                "state": "CO",
                "zip_code": "80202",
                "property_type": "Commercial",
                "units_count": 10
            }
        ]
    }

    res = client.post("/api/entity-wizard/setup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"

    # Query all classes for the company
    comp_id = data["company"]["id"]
    classes_res = client.get(f"/api/classes?company_id={comp_id}")
    assert classes_res.status_code == 200
    classes = classes_res.json()
    
    # Verify primary operating LLC class exists
    primary_cls = next((c for c in classes if c["name"] == "Apex Commercial LLC"), None)
    assert primary_cls is not None
    assert primary_cls["entity_type"] == "LLC"

    # Verify Common Portfolio / Company Expense class exists
    common_cls = next((c for c in classes if c["name"] == "Portfolio / Company Expense"), None)
    assert common_cls is not None
    assert common_cls["entity_type"] == "COMMON"
    assert common_cls["tax_classification"] == "PORTFOLIO_OVERHEAD"
    assert "Shared portfolio/company expenses" in common_cls.get("description", "")

    # Query properties under the common class
    props_res = client.get(f"/api/properties?class_id={common_cls['id']}")
    assert props_res.status_code == 200
    common_props = props_res.json()
    assert len(common_props) >= 1
    overhead_prop = next((p for p in common_props if p["name"] == "Portfolio / Company Overhead"), None)
    assert overhead_prop is not None
    assert overhead_prop["property_type"] == "Common Overhead"

    # Verify a telephone expense transaction can be recorded to this Common class
    tx_payload = {
        "date": "2026-03-01",
        "amount": 245.50,
        "account_name": "Telephone Expense",
        "category_type": "OPERATING_EXPENSE",
        "description": "T-Mobile Portfolio Corporate Telephone Bill",
        "payee": "T-Mobile",
        "property_id": overhead_prop["id"],
        "class_id": common_cls["id"]
    }
    tx_res = client.post("/api/transactions", json=tx_payload)
    assert tx_res.status_code == 200
    tx_data = tx_res.json()
    assert tx_data["amount"] == 245.50
    assert tx_data["property_id"] == overhead_prop["id"]
    assert tx_data["class_id"] == common_cls["id"]


def test_create_common_class_standalone_api():
    """Test creating a common overhead class directly via POST /api/classes with auto-generated overhead property."""
    comp_res = client.get("/api/companies")
    assert comp_res.status_code == 200
    companies = comp_res.json()
    assert len(companies) > 0
    test_comp_id = companies[0]["id"]

    class_payload = {
        "name": "General Portfolio Overhead Expenses",
        "company_id": test_comp_id,
        "description": "Portfolio-wide legal, accounting, and telephone bills",
        "entity_type": "COMMON",
        "tax_classification": "PORTFOLIO_OVERHEAD",
        "create_default_property": True,
        "default_property_name": "General Portfolio Overhead"
    }

    res = client.post("/api/classes", json=class_payload)
    assert res.status_code == 200
    c_data = res.json()
    assert c_data["name"] == "General Portfolio Overhead Expenses"
    assert c_data["entity_type"] == "COMMON"
    assert c_data["tax_classification"] == "PORTFOLIO_OVERHEAD"

    # Verify sub-class property was automatically created
    props_res = client.get(f"/api/properties?class_id={c_data['id']}")
    assert props_res.status_code == 200
    props = props_res.json()
    matching_prop = next((p for p in props if p["name"] == "General Portfolio Overhead"), None)
    assert matching_prop is not None
    assert matching_prop["property_type"] == "Common Overhead"





