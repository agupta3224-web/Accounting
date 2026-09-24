import csv
import io
import re
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from .models import Vendor, Category

STANDARD_VENDORS_SEED = [
    {
        "account_number": "VEND-1001",
        "name": "Austin HVAC Pros & Mechanical",
        "contact_person": "Robert Vance",
        "email": "service@austinhvacpros.com",
        "phone": "(512) 555-0192",
        "tax_id": "74-8891234",
        "is_1099_eligible": True,
        "address_line1": "1420 Industrial Blvd",
        "address_line2": "Suite 200",
        "city": "Austin",
        "state": "TX",
        "zip_code": "78745",
        "default_category_account_number": "60100", # Repairs & Maintenance
        "notes": "Primary HVAC repair contractor for multi-unit properties."
    },
    {
        "account_number": "VEND-1002",
        "name": "Travis County Tax Collector",
        "contact_person": "Property Tax Division",
        "email": "tax@traviscountytx.gov",
        "phone": "(512) 854-9473",
        "tax_id": "74-6000180",
        "is_1099_eligible": False,
        "address_line1": "2433 Ridgepoint Dr",
        "address_line2": "",
        "city": "Austin",
        "state": "TX",
        "zip_code": "78754",
        "default_category_account_number": "60300", # Property Taxes
        "notes": "Ad valorem county property taxes."
    },
    {
        "account_number": "VEND-1003",
        "name": "Austin Energy & City Water",
        "contact_person": "Commercial Billing",
        "email": "customercare@austinenergy.com",
        "phone": "(512) 494-9400",
        "tax_id": "74-6000100",
        "is_1099_eligible": False,
        "address_line1": "721 Barton Springs Rd",
        "address_line2": "",
        "city": "Austin",
        "state": "TX",
        "zip_code": "78704",
        "default_category_account_number": "60500", # Utilities
        "notes": "Monthly owner-paid water, trash, and electricity."
    },
    {
        "account_number": "VEND-1004",
        "name": "Lone Star Hazard & Property Insurance",
        "contact_person": "Sarah Jenkins",
        "email": "claims@lonestarinsure.com",
        "phone": "(512) 555-8822",
        "tax_id": "75-9921441",
        "is_1099_eligible": False,
        "address_line1": "901 S Mopac Expy",
        "address_line2": "Bldg 1 Ste 400",
        "city": "Austin",
        "state": "TX",
        "zip_code": "78746",
        "default_category_account_number": "60400", # Property Insurance
        "notes": "Property hazard and liability master policy."
    },
    {
        "account_number": "VEND-1005",
        "name": "Capital City Grounds & Landscaping",
        "contact_person": "Miguel Alvarez",
        "email": "miguel@capcitygrounds.com",
        "phone": "(512) 555-3319",
        "tax_id": "81-3049182",
        "is_1099_eligible": True,
        "address_line1": "3100 E 7th St",
        "address_line2": "",
        "city": "Austin",
        "state": "TX",
        "zip_code": "78702",
        "default_category_account_number": "60600", # Landscaping
        "notes": "Bi-weekly mowing, tree trimming, and grounds maintenance."
    }
]

def get_next_vendor_account_number(db: Session) -> str:
    """
    Finds the highest sequential VEND-XXXX number and returns next.
    e.g. VEND-1001, VEND-1002...
    """
    vendors = db.query(Vendor).all()
    max_num = 1000
    for v in vendors:
        match = re.search(r"(\d+)", v.account_number or "")
        if match:
            max_num = max(max_num, int(match.group(1)))
            
    return f"VEND-{max_num + 1}"


def create_vendor(
    db: Session,
    name: str,
    account_number: Optional[str] = None,
    contact_person: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    tax_id: Optional[str] = None,
    is_1099_eligible: bool = False,
    address_line1: Optional[str] = None,
    address_line2: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    zip_code: Optional[str] = None,
    default_category_id: Optional[int] = None,
    notes: Optional[str] = None,
    is_active: bool = True
) -> Vendor:
    if not name or not name.strip():
        raise ValueError("Vendor Name is required.")
        
    acct_num = account_number.strip() if account_number and account_number.strip() else get_next_vendor_account_number(db)
    
    # Check if account_number exists
    existing = db.query(Vendor).filter(Vendor.account_number == acct_num).first()
    if existing:
        acct_num = get_next_vendor_account_number(db)
        
    vendor = Vendor(
        account_number=acct_num,
        name=name.strip(),
        contact_person=contact_person or "",
        email=email or "",
        phone=phone or "",
        tax_id=tax_id or "",
        is_1099_eligible=is_1099_eligible,
        address_line1=address_line1 or "",
        address_line2=address_line2 or "",
        city=city or "",
        state=state or "",
        zip_code=zip_code or "",
        default_category_id=default_category_id,
        notes=notes or "",
        is_active=is_active
    )
    vendor.address = vendor.formatted_address()
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def update_vendor(
    db: Session,
    vendor_id: int,
    name: Optional[str] = None,
    account_number: Optional[str] = None,
    contact_person: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    tax_id: Optional[str] = None,
    is_1099_eligible: Optional[bool] = None,
    address_line1: Optional[str] = None,
    address_line2: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    zip_code: Optional[str] = None,
    default_category_id: Optional[int] = None,
    notes: Optional[str] = None,
    is_active: Optional[bool] = None
) -> Vendor:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise ValueError(f"Vendor ID {vendor_id} not found.")
        
    if name is not None and name.strip(): vendor.name = name.strip()
    if account_number is not None and account_number.strip(): vendor.account_number = account_number.strip()
    if contact_person is not None: vendor.contact_person = contact_person
    if email is not None: vendor.email = email
    if phone is not None: vendor.phone = phone
    if tax_id is not None: vendor.tax_id = tax_id
    if is_1099_eligible is not None: vendor.is_1099_eligible = is_1099_eligible
    if address_line1 is not None: vendor.address_line1 = address_line1
    if address_line2 is not None: vendor.address_line2 = address_line2
    if city is not None: vendor.city = city
    if state is not None: vendor.state = state
    if zip_code is not None: vendor.zip_code = zip_code
    if default_category_id is not None: vendor.default_category_id = default_category_id
    if notes is not None: vendor.notes = notes
    if is_active is not None: vendor.is_active = is_active
    
    vendor.address = vendor.formatted_address()
    db.commit()
    db.refresh(vendor)
    return vendor


def get_vendors_list(
    db: Session,
    search: Optional[str] = None,
    active_only: bool = False
) -> List[Vendor]:
    query = db.query(Vendor)
    if active_only:
        query = query.filter(Vendor.is_active == True)
    if search:
        s_term = f"%{search}%"
        query = query.filter(
            (Vendor.name.ilike(s_term)) |
            (Vendor.account_number.ilike(s_term)) |
            (Vendor.contact_person.ilike(s_term)) |
            (Vendor.city.ilike(s_term)) |
            (Vendor.phone.ilike(s_term))
        )
        
    return query.order_by(Vendor.account_number.asc(), Vendor.name.asc()).all()


def delete_vendor(db: Session, vendor_id: int) -> bool:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        return False
    db.delete(vendor)
    db.commit()
    return True


def export_vendors_to_csv(vendors: List[Vendor]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Account Number",
        "Vendor Name",
        "Address Line 1",
        "Address Line 2",
        "City",
        "State",
        "Zip Code",
        "Full Address",
        "Contact Person",
        "Phone",
        "Email",
        "Tax ID",
        "1099 Eligible",
        "Default Expense Account",
        "Notes",
        "Status"
    ])
    
    for v in vendors:
        cat_disp = f"[{v.default_category.account_number}] {v.default_category.name}" if (v.default_category and v.default_category.account_number) else (v.default_category.name if v.default_category else "")
        writer.writerow([
            v.account_number or "",
            v.name,
            v.address_line1 or "",
            v.address_line2 or "",
            v.city or "",
            v.state or "",
            v.zip_code or "",
            v.formatted_address(),
            v.contact_person or "",
            v.phone or "",
            v.email or "",
            v.tax_id or "",
            "Yes" if v.is_1099_eligible else "No",
            cat_disp,
            v.notes or "",
            "Active" if v.is_active else "Inactive"
        ])
        
    return output.getvalue()


def seed_standard_vendors(db: Session):
    existing_accts = {v.account_number for v in db.query(Vendor).all()}
    existing_names = {v.name.lower().strip() for v in db.query(Vendor).all()}
    
    for s in STANDARD_VENDORS_SEED:
        if s["account_number"] not in existing_accts and s["name"].lower().strip() not in existing_names:
            cat = None
            if s.get("default_category_account_number"):
                cat = db.query(Category).filter(Category.account_number == s["default_category_account_number"]).first()
                
            vendor = Vendor(
                account_number=s["account_number"],
                name=s["name"],
                contact_person=s.get("contact_person", ""),
                email=s.get("email", ""),
                phone=s.get("phone", ""),
                tax_id=s.get("tax_id", ""),
                is_1099_eligible=s.get("is_1099_eligible", False),
                address_line1=s.get("address_line1", ""),
                address_line2=s.get("address_line2", ""),
                city=s.get("city", ""),
                state=s.get("state", ""),
                zip_code=s.get("zip_code", ""),
                default_category_id=cat.id if cat else None,
                notes=s.get("notes", ""),
                is_active=True
            )
            vendor.address = vendor.formatted_address()
            db.add(vendor)
            existing_accts.add(s["account_number"])
            existing_names.add(s["name"].lower().strip())
            
    db.commit()
