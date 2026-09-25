import os
from typing import Optional, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response, PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db, Base
from .models import Company, ClassEntity, Property, Category, Transaction, Statement, JournalEntry, JournalEntryLine, CheckRecord, CheckSplit, Vendor, BankRule, BankStatement
from .journal_engine import (
    get_next_journal_entry_number,
    validate_journal_entry_payload,
    create_journal_entry,
    get_journal_entries_list,
    delete_journal_entry
)
from .vendor_engine import (
    get_next_vendor_account_number,
    create_vendor,
    update_vendor,
    get_vendors_list,
    delete_vendor,
    export_vendors_to_csv,
    seed_standard_vendors
)
from .check_engine import (
    number_to_words,
    get_next_check_number,
    get_bank_account_balance,
    create_check,
    void_check,
    get_checks_list,
    render_check_voucher_html
)
from .bank_parser_engine import parse_bank_statement_file, categorize_bank_transaction
from .parser_engine import parse_file_to_preview, process_file_with_mapping
from .rule_engine import apply_property_manager_rules
from .reporting_service import (
    generate_monthly_property_pnl,
    generate_concise_pnl_report,
    get_category_drilldown_transactions,
    compute_period_bounds
)
from .seed_data import seed_sample_data, init_db
from .sample_generator import generate_sample_statements, generate_sample_bank_statements
from .company_manager import company_manager
from .license_engine import license_engine
from .coa_engine import (
    validate_account_number,
    suggest_next_account_number,
    export_accounts_to_csv,
    get_sample_csv_template,
    import_accounts_from_csv,
    backfill_standard_account_numbers,
    normalize_account_type,
    CUSTOM_BASE_COA_SEED,
    seed_custom_base_accounts
)
from .printer_engine import get_system_printers, render_printable_pnl_html

@asynccontextmanager
async def lifespan(app: FastAPI):
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    generate_sample_statements(sample_dir)
    generate_sample_bank_statements(sample_dir)
    yield
    company_manager.auto_backup_on_close()

app = FastAPI(title="PropBooks Real Estate Accounting - Desktop Pro Edition", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Request Models
class CompanyCreate(BaseModel):
    name: str
    ein: Optional[str] = None
    notes: Optional[str] = None

class ClassCreate(BaseModel):
    name: str
    company_id: Optional[int] = None
    description: Optional[str] = None

class PropertyCreate(BaseModel):
    name: str
    class_id: Optional[int] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    property_type: Optional[str] = "Residential"
    units_count: Optional[int] = 1
    acquisition_cost: Optional[float] = None
    acquisition_date: Optional[str] = None
    unit_number: Optional[str] = None
    parent_property_id: Optional[int] = None

class ApartmentUnitItem(BaseModel):
    unit_number: str
    sub_class_name: Optional[str] = None
    acquisition_cost: Optional[float] = None
    acquisition_date: Optional[str] = None

class PropertyItemPayload(BaseModel):
    name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    zip_code: str
    property_type: Optional[str] = "Residential"
    units_count: Optional[int] = 1
    acquisition_cost: Optional[float] = None
    acquisition_date: Optional[str] = None
    unit_number: Optional[str] = None
    is_multifamily: Optional[bool] = False
    multifamily_mode: Optional[str] = "WHOLE"  # "WHOLE" or "INDIVIDUAL_UNITS"
    apartment_units: Optional[List[ApartmentUnitItem]] = []

class EntityItemPayload(BaseModel):
    entity_name: str
    entity_type: str = "LLC"  # CORP, LLC, SELF_EMPLOYED
    tax_classification: Optional[str] = None  # S_CORP, C_CORP, SINGLE_MEMBER_DISREGARDED, MULTI_MEMBER, SOLE_PROPRIETOR
    tax_form: Optional[str] = None  # Form 1120-S, Form 1120, Form 1065, Schedule E, Schedule C
    ein: Optional[str] = None
    description: Optional[str] = None
    office_address_line1: Optional[str] = None
    office_address_line2: Optional[str] = None
    office_city: Optional[str] = None
    office_state: Optional[str] = None
    office_zip: Optional[str] = None
    mailing_same_as_office: bool = True
    mailing_address_line1: Optional[str] = None
    mailing_address_line2: Optional[str] = None
    mailing_city: Optional[str] = None
    mailing_state: Optional[str] = None
    mailing_zip: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    properties: Optional[List[PropertyItemPayload]] = []

class EntityInterviewPayload(BaseModel):
    # Step 1: Portfolio Structure
    is_portfolio: bool = False
    portfolio_name: Optional[str] = None
    portfolio_ein: Optional[str] = None
    portfolio_notes: Optional[str] = None
    company_id: Optional[int] = None
    create_new_company_file: bool = False

    # Chart of Accounts Choice
    coa_mode: Optional[str] = "DEFAULT"  # "DEFAULT" or "CUSTOM"

    # Multi-Entity support
    entities: Optional[List[EntityItemPayload]] = []

    # Step 2 & 3: Single Entity Details (or first entity fallback)
    entity_name: Optional[str] = "Main Entity"
    entity_type: str = "LLC" # CORP, LLC, SELF_EMPLOYED
    tax_classification: Optional[str] = None # S_CORP, C_CORP, SINGLE_MEMBER_DISREGARDED, MULTI_MEMBER, SOLE_PROPRIETOR
    tax_form: Optional[str] = None # Form 1120-S, Form 1120, Form 1065, Schedule E, Schedule C
    ein: Optional[str] = None
    description: Optional[str] = None

    # Addresses
    office_address_line1: Optional[str] = None
    office_address_line2: Optional[str] = None
    office_city: Optional[str] = None
    office_state: Optional[str] = None
    office_zip: Optional[str] = None

    mailing_same_as_office: bool = True
    mailing_address_line1: Optional[str] = None
    mailing_address_line2: Optional[str] = None
    mailing_city: Optional[str] = None
    mailing_state: Optional[str] = None
    mailing_zip: Optional[str] = None

    # Contact Person
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    # Initial Bank Opening Balance (for users bringing info over to new file)
    initial_bank_opening_balance: Optional[float] = None
    initial_bank_opening_date: Optional[str] = None

    # Step 4: Sub-Class Properties List (Multi-Property & Multifamily)
    properties: Optional[List[PropertyItemPayload]] = []

    # Backwards compatibility fields
    initial_property_name: Optional[str] = None
    initial_property_address: Optional[str] = None
    initial_property_type: Optional[str] = "Residential"
    initial_property_units: Optional[int] = 1

class ManualTransactionCreate(BaseModel):
    date: str
    property_id: int
    class_id: Optional[int] = None
    category_id: Optional[int] = None
    account_name: str
    category_type: str = "OPERATING_EXPENSE"
    amount: float
    description: Optional[str] = ""
    payee: Optional[str] = ""
    source: str = "MANUAL"

class AccountCreate(BaseModel):
    account_number: Optional[str] = None
    name: str
    type: str = "OPERATING_EXPENSE"
    sub_type: Optional[str] = None
    description: Optional[str] = None
    is_repair_category: Optional[bool] = False
    is_rental_income: Optional[bool] = False
    is_active: Optional[bool] = True
    parent_account_id: Optional[int] = None
    opening_balance: Optional[float] = 0.0
    opening_balance_date: Optional[str] = None


class JournalEntryLinePayload(BaseModel):
    category_id: int
    debit: Optional[float] = 0.0
    credit: Optional[float] = 0.0
    memo: Optional[str] = ""
    notes: Optional[str] = ""
    class_id: Optional[int] = None
    property_id: Optional[int] = None

class JournalEntryCreate(BaseModel):
    date: str
    entry_number: Optional[str] = None
    memo: Optional[str] = ""
    lines: List[JournalEntryLinePayload]

class CheckSplitPayload(BaseModel):
    category_id: int
    amount: float
    memo: Optional[str] = ""
    class_id: Optional[int] = None
    property_id: Optional[int] = None


class VendorCreate(BaseModel):
    name: str
    account_number: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    is_1099_eligible: Optional[bool] = False
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    default_category_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = True

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    account_number: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    is_1099_eligible: Optional[bool] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    default_category_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class CheckCreate(BaseModel):
    bank_account_id: int
    check_number: Optional[str] = None
    date: str
    payee: str
    amount: float
    address: Optional[str] = ""
    memo: Optional[str] = ""
    splits: Optional[List[CheckSplitPayload]] = None

class AccountUpdate(BaseModel):
    account_number: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    sub_type: Optional[str] = None
    description: Optional[str] = None
    is_repair_category: Optional[bool] = None
    is_rental_income: Optional[bool] = None
    is_active: Optional[bool] = None
    parent_account_id: Optional[int] = None
    opening_balance: Optional[float] = None
    opening_balance_date: Optional[str] = None

class CoaResetRequest(BaseModel):
    template: str = "DEFAULT"  # "DEFAULT" or "CUSTOM"
    overwrite: bool = True

class ConfirmImportRequest(BaseModel):
    filename: str
    property_id: Optional[int] = None
    class_id: Optional[int] = None
    column_mapping: dict
    aggregate_rental_income: bool = True
    raw_file_content_id: Optional[str] = None

class BankTransactionItemPayload(BaseModel):
    date: str
    check_number: Optional[str] = None
    payee: str
    raw_description: Optional[str] = ""
    amount: float
    is_outflow: bool = True
    transaction_type: Optional[str] = "CHECK"  # CHECK, ACH, DEBIT, DEPOSIT
    category_id: Optional[int] = None
    category_account_number: Optional[str] = None
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    property_id: Optional[int] = None
    class_id: Optional[int] = None
    memo: Optional[str] = None
    match_status: Optional[str] = "NEEDS_REVIEW"
    save_rule: Optional[bool] = False
    rule_keyword: Optional[str] = None

class BankStatementConfirmPayload(BaseModel):
    bank_account_id: int
    filename: str
    statement_period: Optional[str] = None
    transactions: List[BankTransactionItemPayload]

class BankRuleCreate(BaseModel):
    name: str
    match_keyword: str
    match_field: Optional[str] = "payee_or_desc"
    target_category_id: Optional[int] = None
    target_vendor_id: Optional[int] = None
    target_vendor_name: Optional[str] = None
    target_property_id: Optional[int] = None
    target_class_id: Optional[int] = None
    is_check: Optional[bool] = False
    is_active: Optional[bool] = True

class BankRuleUpdate(BaseModel):
    name: Optional[str] = None
    match_keyword: Optional[str] = None
    match_field: Optional[str] = None
    target_category_id: Optional[int] = None
    target_vendor_id: Optional[int] = None
    target_vendor_name: Optional[str] = None
    target_property_id: Optional[int] = None
    target_class_id: Optional[int] = None
    is_check: Optional[bool] = None
    is_active: Optional[bool] = None

class OpenCompanyRequest(BaseModel):
    company_key: str

class BackupRequest(BaseModel):
    custom_name: Optional[str] = None

class LicenseActivateRequest(BaseModel):
    key: str

UPLOAD_CACHE = {}

# ==========================================
# LICENSE & SUBSCRIPTION MONETIZATION API
# ==========================================

@app.get("/api/license/status")
def get_license_status():
    status = license_engine.get_license_status()
    # Attach promotional pricing
    status["pricing"] = {
        "trial_days": 21,
        "monthly_promo_price": 9.99,
        "monthly_standard_price": 19.99,
        "annual_promo_price": 100.00,
        "annual_standard_price": 190.00,
        "special_offer_text": "$9.99/mo or $100/yr for the first year (New Subscribers Special)"
    }
    return status

@app.post("/api/license/activate")
def activate_license_endpoint(req: LicenseActivateRequest):
    try:
        return license_engine.activate_license(req.key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/license/deactivate")
def deactivate_license_endpoint():
    return license_engine.deactivate_license()

# ==========================================
# SYSTEM & MULTI-COMPANY MANAGER ENDPOINTS
# ==========================================

@app.get("/api/system/session")
def get_system_session():
    return {
        "active_company_key": company_manager.active_company_key,
        "active_company_name": company_manager.active_company_name,
        "is_sample": (company_manager.active_company_key == "sample_company"),
        "has_active_company": bool(company_manager.active_company_key)
    }

@app.get("/api/system/companies")
def list_system_companies():
    return company_manager.list_companies()

@app.post("/api/system/companies/open")
def open_system_company(req: OpenCompanyRequest):
    try:
        return company_manager.open_company(req.company_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/system/companies/create")
def create_system_company_file(comp_in: CompanyCreate):
    try:
        return company_manager.create_new_company(
            name=comp_in.name,
            ein=comp_in.ein,
            notes=comp_in.notes
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/system/companies/close")
def close_system_company():
    return company_manager.close_company()

@app.delete("/api/system/companies/{company_key}")
def delete_system_company(company_key: str):
    try:
        return company_manager.delete_company(company_key)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system/companies/prune-restored")
def prune_restored_system_companies(keep_count: int = 4):
    try:
        deleted = company_manager.prune_restored_companies(keep_count=keep_count)
        return {
            "status": "SUCCESS",
            "message": f"Kept last {keep_count} restored companies, pruned {len(deleted)} older restored files.",
            "pruned_count": len(deleted),
            "pruned_keys": deleted
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system/backup")
def create_company_backup(req: BackupRequest = None):
    try:
        custom_name = req.custom_name if req else None
        return company_manager.manual_backup(custom_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/system/backups")
def list_system_backups():
    return company_manager.list_backups()

@app.get("/api/system/backups/download/{filename}")
def download_backup_file(filename: str):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "backups", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(file_path, filename=filename)

@app.post("/api/system/restore")
async def restore_company_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        return company_manager.restore_company_from_backup(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# ACTIVE COMPANY DATA ENDPOINTS
# ==========================================

# --- Companies Endpoints ---
@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db)):
    companies = db.query(Company).order_by(Company.name).all()
    return [c.to_dict() for c in companies]

@app.post("/api/companies")
def create_company(comp_in: CompanyCreate, db: Session = Depends(get_db)):
    existing = db.query(Company).filter(Company.name == comp_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company with this name already exists")
    company = Company(
        name=comp_in.name,
        ein=comp_in.ein,
        notes=comp_in.notes
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company.to_dict()

# --- Classes / LLCs Endpoints ---
@app.get("/api/classes")
def get_classes(company_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ClassEntity)
    if company_id:
        query = query.filter(ClassEntity.company_id == company_id)
    classes = query.order_by(ClassEntity.name).all()
    return [c.to_dict() for c in classes]

@app.post("/api/classes")
def create_class(c_in: ClassCreate, db: Session = Depends(get_db)):
    c = ClassEntity(
        name=c_in.name,
        company_id=c_in.company_id,
        description=c_in.description
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c.to_dict()

# --- Entity Setup Interview Wizard Endpoint ---
def _persist_entity_interview_records(payload: EntityInterviewPayload, db: Session) -> Dict[str, Any]:
    # 0. Initialize Chart of Accounts if custom mode requested
    if payload.coa_mode and payload.coa_mode.upper() == "CUSTOM":
        seed_custom_base_accounts(db, overwrite=True)

    # 1. Resolve Company / Portfolio
    target_company_id = payload.company_id
    company = None

    if payload.is_portfolio and payload.portfolio_name and payload.portfolio_name.strip():
        comp_name = payload.portfolio_name.strip()
        company = db.query(Company).filter(Company.name == comp_name).first()
        if not company:
            company = Company(
                name=comp_name,
                ein=payload.portfolio_ein,
                notes=payload.portfolio_notes or "Portfolio File"
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        target_company_id = company.id
    elif target_company_id:
        company = db.query(Company).filter(Company.id == target_company_id).first()
    else:
        # Default fallback or single entity company wrapper
        company = db.query(Company).first()
        if not company:
            first_name = (payload.entities[0].entity_name.strip() if payload.entities and len(payload.entities) > 0 else (payload.entity_name or "Real Estate Entity")).strip()
            company = Company(
                name=first_name,
                ein=payload.ein,
                notes="Primary Business Entity"
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        target_company_id = company.id

    # 2 & 3. Process Entities and Properties
    entities_to_process = payload.entities if payload.entities and len(payload.entities) > 0 else None
    created_classes = []
    created_properties = []

    if entities_to_process:
        for ent in entities_to_process:
            m1 = ent.office_address_line1 if ent.mailing_same_as_office else ent.mailing_address_line1
            m2 = ent.office_address_line2 if ent.mailing_same_as_office else ent.mailing_address_line2
            m_city = ent.office_city if ent.mailing_same_as_office else ent.mailing_city
            m_state = ent.office_state if ent.mailing_same_as_office else ent.mailing_state
            m_zip = ent.office_zip if ent.mailing_same_as_office else ent.mailing_zip

            new_class = ClassEntity(
                company_id=target_company_id,
                name=ent.entity_name.strip(),
                description=ent.description or f"{ent.entity_type} - {ent.tax_classification or 'Operating Entity'}",
                entity_type=ent.entity_type,
                tax_classification=ent.tax_classification,
                tax_form=ent.tax_form,
                ein=ent.ein,
                office_address_line1=ent.office_address_line1,
                office_address_line2=ent.office_address_line2,
                office_city=ent.office_city,
                office_state=ent.office_state,
                office_zip=ent.office_zip,
                mailing_address_line1=m1,
                mailing_address_line2=m2,
                mailing_city=m_city,
                mailing_state=m_state,
                mailing_zip=m_zip,
                contact_name=ent.contact_name,
                contact_phone=ent.contact_phone
            )
            db.add(new_class)
            db.commit()
            db.refresh(new_class)
            created_classes.append(new_class)

            if ent.properties:
                for p_item in ent.properties:
                    if p_item.is_multifamily and p_item.multifamily_mode == 'INDIVIDUAL_UNITS' and p_item.apartment_units:
                        for unit in p_item.apartment_units:
                            sub_name = unit.sub_class_name or f"{p_item.name} - {unit.unit_number}"
                            addr2 = unit.unit_number if not p_item.address_line2 else f"{p_item.address_line2} {unit.unit_number}"
                            prop = Property(
                                class_id=new_class.id,
                                name=sub_name.strip(),
                                address_line1=p_item.address_line1.strip(),
                                address_line2=addr2.strip() if addr2 else None,
                                city=p_item.city.strip(),
                                state=p_item.state.strip(),
                                zip_code=p_item.zip_code.strip(),
                                property_type="Multi-Family Unit",
                                units_count=1,
                                acquisition_cost=unit.acquisition_cost if unit.acquisition_cost is not None else p_item.acquisition_cost,
                                acquisition_date=unit.acquisition_date or p_item.acquisition_date,
                                unit_number=unit.unit_number.strip()
                            )
                            db.add(prop)
                            db.commit()
                            db.refresh(prop)
                            created_properties.append(prop)
                    else:
                        prop_type = p_item.property_type or ("Multi-Family Building" if p_item.is_multifamily else "Residential")
                        prop = Property(
                            class_id=new_class.id,
                            name=p_item.name.strip(),
                            address_line1=p_item.address_line1.strip(),
                            address_line2=p_item.address_line2.strip() if p_item.address_line2 else None,
                            city=p_item.city.strip(),
                            state=p_item.state.strip(),
                            zip_code=p_item.zip_code.strip(),
                            property_type=prop_type,
                            units_count=p_item.units_count or 1,
                            acquisition_cost=p_item.acquisition_cost,
                            acquisition_date=p_item.acquisition_date,
                            unit_number=p_item.unit_number
                        )
                        db.add(prop)
                        db.commit()
                        db.refresh(prop)
                        created_properties.append(prop)
    else:
        # Single entity setup (backward compatible)
        mail1 = payload.office_address_line1 if payload.mailing_same_as_office else payload.mailing_address_line1
        mail2 = payload.office_address_line2 if payload.mailing_same_as_office else payload.mailing_address_line2
        mail_city = payload.office_city if payload.mailing_same_as_office else payload.mailing_city
        mail_state = payload.office_state if payload.mailing_same_as_office else payload.mailing_state
        mail_zip = payload.office_zip if payload.mailing_same_as_office else payload.mailing_zip

        entity_name_val = payload.entity_name.strip() if payload.entity_name else "Operating Entity"
        new_class = ClassEntity(
            company_id=target_company_id,
            name=entity_name_val,
            description=payload.description or f"{payload.entity_type} - {payload.tax_classification or 'Operating Entity'}",
            entity_type=payload.entity_type,
            tax_classification=payload.tax_classification,
            tax_form=payload.tax_form,
            ein=payload.ein,
            office_address_line1=payload.office_address_line1,
            office_address_line2=payload.office_address_line2,
            office_city=payload.office_city,
            office_state=payload.office_state,
            office_zip=payload.office_zip,
            mailing_address_line1=mail1,
            mailing_address_line2=mail2,
            mailing_city=mail_city,
            mailing_state=mail_state,
            mailing_zip=mail_zip,
            contact_name=payload.contact_name,
            contact_phone=payload.contact_phone
        )
        db.add(new_class)
        db.commit()
        db.refresh(new_class)
        created_classes.append(new_class)

        if payload.properties:
            for p_item in payload.properties:
                if p_item.is_multifamily and p_item.multifamily_mode == 'INDIVIDUAL_UNITS' and p_item.apartment_units:
                    for unit in p_item.apartment_units:
                        sub_name = unit.sub_class_name or f"{p_item.name} - {unit.unit_number}"
                        addr2 = unit.unit_number if not p_item.address_line2 else f"{p_item.address_line2} {unit.unit_number}"
                        prop = Property(
                            class_id=new_class.id,
                            name=sub_name.strip(),
                            address_line1=p_item.address_line1.strip(),
                            address_line2=addr2.strip() if addr2 else None,
                            city=p_item.city.strip(),
                            state=p_item.state.strip(),
                            zip_code=p_item.zip_code.strip(),
                            property_type="Multi-Family Unit",
                            units_count=1,
                            acquisition_cost=unit.acquisition_cost if unit.acquisition_cost is not None else p_item.acquisition_cost,
                            acquisition_date=unit.acquisition_date or p_item.acquisition_date,
                            unit_number=unit.unit_number.strip()
                        )
                        db.add(prop)
                        db.commit()
                        db.refresh(prop)
                        created_properties.append(prop)
                else:
                    prop_type = p_item.property_type or ("Multi-Family Building" if p_item.is_multifamily else "Residential")
                    prop = Property(
                        class_id=new_class.id,
                        name=p_item.name.strip(),
                        address_line1=p_item.address_line1.strip(),
                        address_line2=p_item.address_line2.strip() if p_item.address_line2 else None,
                        city=p_item.city.strip(),
                        state=p_item.state.strip(),
                        zip_code=p_item.zip_code.strip(),
                        property_type=prop_type,
                        units_count=p_item.units_count or 1,
                        acquisition_cost=p_item.acquisition_cost,
                        acquisition_date=p_item.acquisition_date,
                        unit_number=p_item.unit_number
                    )
                    db.add(prop)
                    db.commit()
                    db.refresh(prop)
                    created_properties.append(prop)
        elif payload.initial_property_name and payload.initial_property_name.strip():
            new_prop = Property(
                class_id=new_class.id,
                name=payload.initial_property_name.strip(),
                address=payload.initial_property_address,
                property_type=payload.initial_property_type or "Residential",
                units_count=payload.initial_property_units or 1
            )
            db.add(new_prop)
            db.commit()
            db.refresh(new_prop)
            created_properties.append(new_prop)

    # 4. Process optional initial bank opening balance
    if payload.initial_bank_opening_balance is not None and payload.initial_bank_opening_balance > 0:
        checking = db.query(Category).filter(
            Category.account_number.in_(["10100", "10010"]) |
            (Category.name.ilike("%Operating Checking%"))
        ).first()
        if not checking:
            checking = db.query(Category).filter(Category.type == "ASSET").first()

        if checking:
            open_dt = payload.initial_bank_opening_date or datetime.now().strftime("%Y-%m-%d")
            checking.opening_balance = round(float(payload.initial_bank_opening_balance), 2)
            checking.opening_balance_date = open_dt
            db.commit()
            from .journal_engine import record_opening_balance_entry
            record_opening_balance_entry(
                db=db,
                account=checking,
                opening_balance=checking.opening_balance,
                opening_date=open_dt
            )

    primary_class = created_classes[0] if created_classes else None
    primary_prop = created_properties[0] if created_properties else None

    return {
        "status": "success",
        "company": company.to_dict() if company else None,
        "class_entity": primary_class.to_dict() if primary_class else None,
        "class_entities": [c.to_dict() for c in created_classes],
        "property": primary_prop.to_dict() if primary_prop else None,
        "properties": [p.to_dict() for p in created_properties],
        "coa_mode": payload.coa_mode or "DEFAULT"
    }

@app.post("/api/entity-wizard/setup")
def setup_entity_interview(payload: EntityInterviewPayload, db: Session = Depends(get_db)):
    """
    Executes the complete Entity Setup Interview:
    1. If create_new_company_file is True (or no active company is currently loaded):
       Creates a brand-new .propbooks company file, opens it, and sets up entities/properties inside.
    2. Otherwise, sets up the portfolio/entity/property inside the current active company database.
    """
    if payload.create_new_company_file or not company_manager.active_company_key:
        if payload.is_portfolio and payload.portfolio_name and payload.portfolio_name.strip():
            file_name = payload.portfolio_name.strip()
            file_ein = payload.portfolio_ein
            file_notes = payload.portfolio_notes or "Real Estate Portfolio"
        elif payload.entities and len(payload.entities) > 0 and payload.entities[0].entity_name:
            file_name = payload.entities[0].entity_name.strip()
            file_ein = payload.entities[0].ein
            file_notes = f"Real Estate Entity - {payload.entities[0].entity_type}"
        else:
            file_name = (payload.entity_name or "Real Estate Entity").strip()
            file_ein = payload.ein
            file_notes = f"Real Estate Entity - {payload.entity_type}"

        # Create new .propbooks file with standard chart of accounts and open it
        opened_company = company_manager.create_new_company(
            name=file_name,
            ein=file_ein,
            notes=file_notes
        )

        # Obtain session for the newly opened company
        new_db = company_manager.SessionLocal()
        try:
            res = _persist_entity_interview_records(payload, new_db)
            res["created_new_company_file"] = True
            res["active_company_key"] = company_manager.active_company_key
            res["active_company_name"] = company_manager.active_company_name
            return res
        finally:
            new_db.close()
    else:
        res = _persist_entity_interview_records(payload, db)
        res["created_new_company_file"] = False
        res["active_company_key"] = company_manager.active_company_key
        res["active_company_name"] = company_manager.active_company_name
        return res

# --- Properties / Sub-Classes Endpoints ---
@app.get("/api/properties")
def get_properties(
    class_id: Optional[int] = None,
    company_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Property)
    if class_id:
        query = query.filter(Property.class_id == class_id)
    elif company_id:
        class_ids = [c.id for c in db.query(ClassEntity).filter(ClassEntity.company_id == company_id).all()]
        query = query.filter(Property.class_id.in_(class_ids))
    props = query.order_by(Property.name).all()
    return [p.to_dict() for p in props]

@app.post("/api/properties")
def create_property(prop_in: PropertyCreate, db: Session = Depends(get_db)):
    prop = Property(
        name=prop_in.name,
        class_id=prop_in.class_id,
        address_line1=prop_in.address_line1,
        address_line2=prop_in.address_line2,
        city=prop_in.city,
        state=prop_in.state,
        zip_code=prop_in.zip_code,
        property_type=prop_in.property_type,
        units_count=prop_in.units_count,
        acquisition_cost=prop_in.acquisition_cost,
        acquisition_date=prop_in.acquisition_date,
        unit_number=prop_in.unit_number,
        parent_property_id=prop_in.parent_property_id
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop.to_dict()

# --- Full Organizational Hierarchy Endpoint ---
@app.get("/api/hierarchy")
def get_hierarchy(db: Session = Depends(get_db)):
    companies = db.query(Company).order_by(Company.name).all()
    result = []
    for comp in companies:
        c_dict = comp.to_dict()
        c_dict["classes"] = []
        for cls in comp.classes:
            cls_dict = cls.to_dict()
            cls_dict["properties"] = [p.to_dict() for p in cls.properties]
            c_dict["classes"].append(cls_dict)
        result.append(c_dict)
    return result

# --- Categories & Chart of Accounts (COA) ---
@app.get("/api/categories")
def get_categories(db: Session = Depends(get_db)):
    backfill_standard_account_numbers(db)
    cats = db.query(Category).all()
    sorted_cats = sorted(
        cats,
        key=lambda a: (
            int(''.join(filter(str.isdigit, a.account_number))) if a.account_number and any(c.isdigit() for c in a.account_number) else 999999,
            a.name
        )
    )
    return [c.to_dict() for c in sorted_cats]

@app.get("/api/accounts")
def get_accounts(
    type: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    backfill_standard_account_numbers(db)
    query = db.query(Category)
    if active_only:
        query = query.filter(Category.is_active == True)
    if type and type.upper() != "ALL":
        norm_type = normalize_account_type(type)
        query = query.filter(Category.type == norm_type)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Category.name.ilike(s)) | 
            (Category.account_number.ilike(s)) | 
            (Category.sub_type.ilike(s)) | 
            (Category.description.ilike(s))
        )
        
    accounts = query.all()
    sorted_accounts = sorted(
        accounts,
        key=lambda a: (
            int(''.join(filter(str.isdigit, a.account_number))) if a.account_number and any(c.isdigit() for c in a.account_number) else 999999,
            a.name
        )
    )
    from .journal_engine import compute_account_balance
    result = []
    for a in sorted_accounts:
        d = a.to_dict()
        d["current_balance"] = compute_account_balance(db, a)
        result.append(d)
    return result

@app.get("/api/accounts/suggest-number")
def get_suggested_account_number(
    type: str = "OPERATING_EXPENSE",
    parent_account_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    existing = [c.account_number for c in db.query(Category.account_number).all() if c.account_number]
    parent_number = None
    if parent_account_id:
        parent_acct = db.query(Category).filter(Category.id == parent_account_id).first()
        if parent_acct:
            parent_number = parent_acct.account_number
            type = parent_acct.type
    suggested = suggest_next_account_number(type, existing, parent_number=parent_number)
    return {"account_type": type, "suggested_number": suggested, "parent_account_id": parent_account_id}

@app.post("/api/accounts/reset-template")
def reset_coa_template(req: CoaResetRequest, db: Session = Depends(get_db)):
    if req.template.upper() == "CUSTOM":
        created = seed_custom_base_accounts(db, overwrite=req.overwrite)
        return {
            "status": "SUCCESS",
            "template": "CUSTOM",
            "accounts_created": len(created),
            "message": f"Successfully initialized {len(created)} custom base accounts (10000-80000)."
        }
    else:
        from .coa_engine import STANDARD_COA_SEED
        if req.overwrite:
            db.query(Category).delete()
            db.commit()
        created_count = 0
        for acct in STANDARD_COA_SEED:
            existing = db.query(Category).filter(Category.account_number == acct["account_number"]).first()
            if not existing:
                db.add(Category(
                    account_number=acct["account_number"],
                    name=acct["name"],
                    type=acct["type"],
                    sub_type=acct.get("sub_type"),
                    description=acct.get("description"),
                    is_repair_category=acct.get("is_repair_category", False),
                    is_rental_income=acct.get("is_rental_income", False),
                    is_active=True
                ))
                created_count += 1
        db.commit()
        return {
            "status": "SUCCESS",
            "template": "DEFAULT",
            "accounts_created": created_count,
            "message": "Initialized Standard Real Estate Chart of Accounts."
        }

@app.post("/api/accounts")
def create_account(a_in: AccountCreate, db: Session = Depends(get_db)):
    norm_type = normalize_account_type(a_in.type)
    parent_acct = None
    if a_in.parent_account_id:
        parent_acct = db.query(Category).filter(Category.id == a_in.parent_account_id).first()
        if not parent_acct:
            raise HTTPException(status_code=400, detail="Parent account not found.")
        norm_type = parent_acct.type  # Sub-account inherits parent's account type

    acct_num = a_in.account_number.strip() if a_in.account_number else None
    
    if not acct_num:
        existing = [c.account_number for c in db.query(Category.account_number).all() if c.account_number]
        parent_num = parent_acct.account_number if parent_acct else None
        acct_num = suggest_next_account_number(norm_type, existing, parent_number=parent_num)
    else:
        is_valid, err_msg = validate_account_number(acct_num, norm_type)
        if not is_valid:
            raise HTTPException(status_code=400, detail=err_msg)
            
    dup_num = db.query(Category).filter(Category.account_number == acct_num).first()
    if dup_num:
        raise HTTPException(status_code=400, detail=f"Account number '{acct_num}' is already assigned to '{dup_num.name}'.")
        
    dup_name = db.query(Category).filter(
        Category.name.ilike(a_in.name.strip()),
        Category.parent_account_id == a_in.parent_account_id
    ).first()
    if dup_name:
        raise HTTPException(status_code=400, detail=f"Account with name '{a_in.name}' already exists at this hierarchy level.")
        
    account = Category(
        account_number=acct_num,
        name=a_in.name.strip(),
        type=norm_type,
        sub_type=a_in.sub_type.strip() if a_in.sub_type else None,
        description=a_in.description.strip() if a_in.description else None,
        is_repair_category=bool(a_in.is_repair_category),
        is_rental_income=bool(a_in.is_rental_income),
        is_active=True if a_in.is_active is None else a_in.is_active,
        parent_account_id=a_in.parent_account_id,
        opening_balance=round(float(a_in.opening_balance or 0.0), 2),
        opening_balance_date=a_in.opening_balance_date.strip() if a_in.opening_balance_date else None
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    if account.opening_balance and account.opening_balance > 0:
        from .journal_engine import record_opening_balance_entry
        record_opening_balance_entry(
            db=db,
            account=account,
            opening_balance=account.opening_balance,
            opening_date=account.opening_balance_date
        )

    from .journal_engine import compute_account_balance
    res = account.to_dict()
    res["current_balance"] = compute_account_balance(db, account)
    return res

@app.put("/api/accounts/{account_id}")
def update_account(account_id: int, a_in: AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(Category).filter(Category.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    if a_in.parent_account_id is not None:
        if a_in.parent_account_id == account_id:
            raise HTTPException(status_code=400, detail="An account cannot be its own parent.")
        if a_in.parent_account_id in (0, -1):
            account.parent_account_id = None
        else:
            parent_acct = db.query(Category).filter(Category.id == a_in.parent_account_id).first()
            if not parent_acct:
                raise HTTPException(status_code=400, detail="Parent account not found.")
            account.parent_account_id = a_in.parent_account_id
            account.type = parent_acct.type

    if a_in.type is not None and account.parent_account_id is None:
        account.type = normalize_account_type(a_in.type)
        
    if a_in.account_number is not None:
        new_num = a_in.account_number.strip()
        if new_num:
            is_valid, err_msg = validate_account_number(new_num, account.type)
            if not is_valid:
                raise HTTPException(status_code=400, detail=err_msg)
            dup = db.query(Category).filter(Category.account_number == new_num, Category.id != account_id).first()
            if dup:
                raise HTTPException(status_code=400, detail=f"Account number '{new_num}' is already in use by '{dup.name}'.")
            account.account_number = new_num
        else:
            account.account_number = None
            
    if a_in.name is not None:
        clean_name = a_in.name.strip()
        dup_name = db.query(Category).filter(
            Category.name.ilike(clean_name),
            Category.parent_account_id == account.parent_account_id,
            Category.id != account_id
        ).first()
        if dup_name:
            raise HTTPException(status_code=400, detail=f"Account name '{clean_name}' already exists at this hierarchy level.")
        account.name = clean_name
        
    if a_in.sub_type is not None:
        account.sub_type = a_in.sub_type.strip() if a_in.sub_type else None
    if a_in.description is not None:
        account.description = a_in.description.strip() if a_in.description else None
    if a_in.is_repair_category is not None:
        account.is_repair_category = bool(a_in.is_repair_category)
    if a_in.is_rental_income is not None:
        account.is_rental_income = bool(a_in.is_rental_income)
    if a_in.is_active is not None:
        account.is_active = bool(a_in.is_active)
    if a_in.opening_balance is not None:
        account.opening_balance = round(float(a_in.opening_balance), 2)
    if a_in.opening_balance_date is not None:
        account.opening_balance_date = a_in.opening_balance_date.strip() if a_in.opening_balance_date else None
        
    db.commit()
    db.refresh(account)

    if account.opening_balance and account.opening_balance > 0:
        from .journal_engine import record_opening_balance_entry
        record_opening_balance_entry(
            db=db,
            account=account,
            opening_balance=account.opening_balance,
            opening_date=account.opening_balance_date
        )

    from .journal_engine import compute_account_balance
    res = account.to_dict()
    res["current_balance"] = compute_account_balance(db, account)
    return res

@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(Category).filter(Category.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    txn_count = db.query(Transaction).filter(Transaction.category_id == account_id).count()
    if txn_count > 0:
        account.is_active = False
        db.commit()
        return {
            "status": "DEACTIVATED",
            "message": f"Account '{account.name}' has {txn_count} transaction(s) and was deactivated to protect historical accounting records."
        }
        
    db.delete(account)
    db.commit()
    return {"status": "DELETED", "message": f"Account '{account.name}' was permanently deleted."}

@app.get("/api/accounts/export-csv")
def export_accounts_csv(db: Session = Depends(get_db)):
    backfill_standard_account_numbers(db)
    accounts = db.query(Category).all()
    csv_str = export_accounts_to_csv(accounts)
    filename = f"Chart_of_Accounts_{company_manager.active_company_key or 'export'}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/accounts/template-csv")
def get_accounts_template_csv():
    csv_str = get_sample_csv_template()
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="Chart_of_Accounts_Sample_Template.csv"'}
    )

@app.post("/api/accounts/import-csv")
async def import_accounts_csv_endpoint(
    file: Optional[UploadFile] = File(None),
    raw_csv: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        csv_text = ""
        if file:
            content_bytes = await file.read()
            csv_text = content_bytes.decode("utf-8-sig", errors="ignore")
        elif raw_csv:
            csv_text = raw_csv
        else:
            raise HTTPException(status_code=400, detail="No CSV file or CSV text was provided.")
            
        result = import_accounts_from_csv(csv_text, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Transactions Endpoints ---
@app.get("/api/transactions")
def get_transactions(
    company_id: Optional[int] = None,
    class_id: Optional[int] = None,
    property_id: Optional[int] = None,
    month: Optional[str] = None,
    category_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    if property_id:
        query = query.filter(Transaction.property_id == property_id)
    elif class_id:
        query = query.filter(Transaction.class_id == class_id)
    elif company_id:
        class_ids = [c.id for c in db.query(ClassEntity).filter(ClassEntity.company_id == company_id).all()]
        query = query.filter(Transaction.class_id.in_(class_ids))

    if month:
        query = query.filter(Transaction.month == month)
    if category_type:
        query = query.filter(Transaction.category_type == category_type)
    if search:
        s = f"%{search}%"
        query = query.filter((Transaction.account_name.ilike(s)) | (Transaction.description.ilike(s)) | (Transaction.payee.ilike(s)))
    
    txns = query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()
    return [t.to_dict() for t in txns]

@app.post("/api/transactions")
def create_transaction(t_in: ManualTransactionCreate, db: Session = Depends(get_db)):
    month_str = t_in.date[:7]
    
    class_id = t_in.class_id
    if not class_id and t_in.property_id:
        prop = db.query(Property).filter(Property.id == t_in.property_id).first()
        if prop:
            class_id = prop.class_id

    category_id = t_in.category_id
    if not category_id:
        cat = db.query(Category).filter(Category.name.ilike(t_in.account_name)).first()
        if cat:
            category_id = cat.id

    txn = Transaction(
        date=t_in.date,
        month=month_str,
        property_id=t_in.property_id,
        class_id=class_id,
        category_id=category_id,
        account_name=t_in.account_name,
        category_type=t_in.category_type,
        amount=abs(t_in.amount),
        description=t_in.description,
        payee=t_in.payee,
        source=t_in.source
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn.to_dict()

@app.delete("/api/transactions/{txn_id}")
def delete_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
    return {"message": "Transaction deleted successfully"}

# --- Statement Upload & Dynamic Mapping Portal ---
@app.post("/api/statements/upload-preview")
async def upload_statement_preview(file: UploadFile = File(...)):
    filename = file.filename
    content = await file.read()
    
    cache_id = f"{filename}_{len(content)}"
    UPLOAD_CACHE[cache_id] = content
    
    preview_data = parse_file_to_preview(content, filename)
    preview_data["cache_id"] = cache_id
    return preview_data

@app.post("/api/statements/confirm-import")
async def confirm_statement_import(
    req: ConfirmImportRequest,
    db: Session = Depends(get_db)
):
    cache_id = req.raw_file_content_id
    content = UPLOAD_CACHE.get(cache_id)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file session expired. Please re-upload.")

    raw_txns = process_file_with_mapping(
        file_bytes=content,
        filename=req.filename,
        column_mapping=req.column_mapping,
        default_property_id=req.property_id,
        default_class_id=req.class_id
    )

    if not raw_txns:
        raise HTTPException(status_code=400, detail="No valid transactions parsed from file.")

    final_txns, consolidated_count = apply_property_manager_rules(
        raw_txns,
        aggregate_rental_income=req.aggregate_rental_income
    )

    detected_month = final_txns[0]['month'] if final_txns else None
    ext = os.path.splitext(req.filename)[1].replace('.', '').upper() or 'CSV'

    statement_record = Statement(
        filename=req.filename,
        file_type=ext,
        property_id=req.property_id,
        month=detected_month,
        status="PROCESSED",
        row_count=len(final_txns),
        consolidated_count=consolidated_count,
        notes=f"Imported with {len(req.column_mapping)} column mappings. Consolidated {consolidated_count} rental rows."
    )
    db.add(statement_record)
    db.commit()
    db.refresh(statement_record)

    category_cache = {c.name.lower(): c for c in db.query(Category).all()}
    target_prop = db.query(Property).filter(Property.id == req.property_id).first() if req.property_id else None
    derived_class_id = req.class_id or (target_prop.class_id if target_prop else None)

    saved_count = 0
    for item in final_txns:
        prop_id = item.get('property_id') or req.property_id
        if not prop_id:
            first_p = db.query(Property).first()
            prop_id = first_p.id if first_p else 1

        cat_obj = category_cache.get(item.get('category_name', '').lower())
        cat_id = cat_obj.id if cat_obj else None

        txn_record = Transaction(
            date=item['date'],
            month=item['month'],
            property_id=prop_id,
            class_id=item.get('class_id') or derived_class_id,
            category_id=cat_id,
            account_name=item['account_name'],
            category_type=item['category_type'],
            amount=item['amount'],
            description=item.get('description', ''),
            payee=item.get('payee', ''),
            source="IMPORTED",
            statement_id=statement_record.id,
            is_aggregated=item.get('is_aggregated', False),
            raw_aggregated_items=item.get('raw_aggregated_items')
        )
        db.add(txn_record)
        saved_count += 1

    db.commit()

    return {
        "status": "SUCCESS",
        "statement_id": statement_record.id,
        "filename": req.filename,
        "total_saved_transactions": saved_count,
        "consolidated_rental_rows": consolidated_count,
        "message": f"Successfully imported {saved_count} transactions. Consolidated {consolidated_count} rental rows into unified Rental Income line items."
    }

@app.get("/api/statements")
def list_statements(db: Session = Depends(get_db)):
    statements = db.query(Statement).order_by(Statement.upload_date.desc()).all()
    return [s.to_dict() for s in statements]

@app.get("/api/sample-statements/list")
def list_sample_statements():
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    files = []
    if os.path.exists(sample_dir):
        for f in os.listdir(sample_dir):
            path = os.path.join(sample_dir, f)
            if os.path.isfile(path):
                files.append({
                    "filename": f,
                    "size_bytes": os.path.getsize(path),
                    "ext": os.path.splitext(f)[1]
                })
    return files

@app.get("/api/sample-statements/download/{filename}")
def download_sample_statement(filename: str):
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    file_path = os.path.join(sample_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=filename)



# =====================================================================
# --- Vendor Management API Endpoints ---
# =====================================================================

@app.get("/api/vendors")
def list_vendors(
    search: Optional[str] = None,
    active_only: Optional[bool] = False,
    db: Session = Depends(get_db)
):
    vendors = get_vendors_list(db, search=search, active_only=bool(active_only))
    return [v.to_dict() for v in vendors]

@app.get("/api/vendors/next-account-number")
def get_next_vendor_acc_num(db: Session = Depends(get_db)):
    next_num = get_next_vendor_account_number(db)
    return {"next_account_number": next_num}

@app.post("/api/vendors")
def create_new_vendor(payload: VendorCreate, db: Session = Depends(get_db)):
    try:
        vendor = create_vendor(
            db=db,
            name=payload.name,
            account_number=payload.account_number,
            contact_person=payload.contact_person,
            email=payload.email,
            phone=payload.phone,
            tax_id=payload.tax_id,
            is_1099_eligible=bool(payload.is_1099_eligible),
            address_line1=payload.address_line1,
            address_line2=payload.address_line2,
            city=payload.city,
            state=payload.state,
            zip_code=payload.zip_code,
            default_category_id=payload.default_category_id,
            notes=payload.notes,
            is_active=True if payload.is_active is None else bool(payload.is_active)
        )
        return vendor.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create vendor: {str(e)}")

@app.get("/api/vendors/{vendor_id}")
def get_vendor_detail(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.to_dict()

@app.put("/api/vendors/{vendor_id}")
def update_existing_vendor(vendor_id: int, payload: VendorUpdate, db: Session = Depends(get_db)):
    try:
        vendor = update_vendor(
            db=db,
            vendor_id=vendor_id,
            name=payload.name,
            account_number=payload.account_number,
            contact_person=payload.contact_person,
            email=payload.email,
            phone=payload.phone,
            tax_id=payload.tax_id,
            is_1099_eligible=payload.is_1099_eligible,
            address_line1=payload.address_line1,
            address_line2=payload.address_line2,
            city=payload.city,
            state=payload.state,
            zip_code=payload.zip_code,
            default_category_id=payload.default_category_id,
            notes=payload.notes,
            is_active=payload.is_active
        )
        return vendor.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update vendor: {str(e)}")

@app.delete("/api/vendors/{vendor_id}")
def delete_single_vendor(vendor_id: int, db: Session = Depends(get_db)):
    success = delete_vendor(db, vendor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"success": True, "message": "Vendor deleted successfully"}

@app.get("/api/vendors/export-csv")
def export_vendors_csv(db: Session = Depends(get_db)):
    vendors = get_vendors_list(db)
    csv_text = export_vendors_to_csv(vendors)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=propbooks_vendor_list.csv"}
    )


# =====================================================================
# --- General Journal Entries API Endpoints ---
# =====================================================================

@app.get("/api/journal-entries")
def list_journal_entries(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    class_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    entries = get_journal_entries_list(db, from_date=from_date, to_date=to_date, class_id=class_id, search=search)
    return [e.to_dict() for e in entries]

@app.get("/api/journal-entries/next-number")
def get_next_journal_number(db: Session = Depends(get_db)):
    next_num = get_next_journal_entry_number(db)
    return {"next_number": next_num}

@app.post("/api/journal-entries")
def create_new_journal_entry(payload: JournalEntryCreate, db: Session = Depends(get_db)):
    try:
        lines_data = [l.model_dump() for l in payload.lines]
        je = create_journal_entry(
            db=db,
            date=payload.date,
            entry_number=payload.entry_number,
            memo=payload.memo,
            lines=lines_data,
            source="GENERAL_JOURNAL"
        )
        return je.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create journal entry: {str(e)}")

@app.get("/api/journal-entries/{entry_id}")
def get_journal_entry_detail(entry_id: int, db: Session = Depends(get_db)):
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return je.to_dict()

@app.delete("/api/journal-entries/{entry_id}")
def delete_single_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    success = delete_journal_entry(db, entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return {"success": True, "message": "Journal entry deleted successfully"}


# =====================================================================
# --- QuickBooks Format Check Writing API Endpoints ---
# =====================================================================

@app.get("/api/checks")
def list_checks(
    bank_account_id: Optional[int] = None,
    account_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    effective_bank_id = bank_account_id if bank_account_id is not None else account_id
    checks = get_checks_list(db, bank_account_id=effective_bank_id, from_date=from_date, to_date=to_date, search=search)
    return [c.to_dict() for c in checks]

@app.get("/api/checks/next-number")
def get_next_chk_number(bank_account_id: Optional[int] = None, db: Session = Depends(get_db)):
    next_num = get_next_check_number(db, bank_account_id)
    return {"next_check_number": next_num}

@app.get("/api/checks/words-preview")
def preview_number_words(amount: float = Query(0.0)):
    return {"amount": amount, "amount_in_words": number_to_words(amount)}

@app.get("/api/checks/bank-balance/{bank_account_id}")
def get_bank_balance_endpoint(bank_account_id: int, db: Session = Depends(get_db)):
    balance = get_bank_account_balance(db, bank_account_id)
    return {"bank_account_id": bank_account_id, "balance": balance}

@app.post("/api/checks")
def write_new_check(payload: CheckCreate, db: Session = Depends(get_db)):
    try:
        splits_data = [s.model_dump() for s in payload.splits] if payload.splits else None
        check = create_check(
            db=db,
            bank_account_id=payload.bank_account_id,
            check_number=payload.check_number,
            date=payload.date,
            payee=payload.payee,
            amount=payload.amount,
            address=payload.address,
            memo=payload.memo,
            splits=splits_data
        )
        return check.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create check: {str(e)}")

@app.get("/api/checks/{check_id}")
def get_check_detail(check_id: int, db: Session = Depends(get_db)):
    check = db.query(CheckRecord).filter(CheckRecord.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    return check.to_dict()

@app.post("/api/checks/{check_id}/void")
def void_existing_check(check_id: int, db: Session = Depends(get_db)):
    try:
        check = void_check(db, check_id)
        return check.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/checks/{check_id}/print-voucher")
def print_check_voucher(check_id: int, db: Session = Depends(get_db)):
    check = db.query(CheckRecord).filter(CheckRecord.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    html_content = render_check_voucher_html(check)
    return Response(content=html_content, media_type="text/html")


# =====================================================================
# --- Bank Statement Import & Intelligent Transaction Wizard API ---
# =====================================================================

@app.get("/api/bank-statements/samples")
def get_sample_bank_statements_list():
    """
    Returns the catalog of downloadable/previewable real estate bank statements
    (Chase CSV, Wells Fargo PDF, Bank of America CSV).
    """
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    if not os.path.exists(os.path.join(sample_dir, "Sample_Wells_Fargo_Bank_Statement.pdf")):
        generate_sample_bank_statements(sample_dir)

    return [
        {
            "filename": "Sample_Chase_Operating_Checking.csv",
            "bank_name": "Chase Bank",
            "format": "CSV",
            "account_title": "Operating Checking",
            "description": "Standard Chase checking statement with check numbers, amounts, and deposits",
            "recommended_account_number": "10100"
        },
        {
            "filename": "Sample_Wells_Fargo_Bank_Statement.pdf",
            "bank_name": "Wells Fargo",
            "format": "PDF",
            "account_title": "Commercial Checking",
            "description": "PDF statement with 'Checks in Numerical Order' (e.g. Check 1042 Joe's plumbing 500) and Electronic Debits",
            "recommended_account_number": "10100"
        },
        {
            "filename": "Sample_Bank_Of_America_Debit_Credit.csv",
            "bank_name": "Bank of America",
            "format": "CSV",
            "account_title": "Business Advantage Checking",
            "description": "BofA checking statement with separate Debit and Credit columns",
            "recommended_account_number": "10100"
        }
    ]

@app.get("/api/bank-statements/sample-download/{filename}")
def download_sample_bank_statement_file(filename: str):
    """
    Direct download of sample bank statements (CSV or PDF).
    """
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    file_path = os.path.join(sample_dir, filename)
    if not os.path.exists(file_path):
        generate_sample_bank_statements(sample_dir)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Sample bank statement file not found")
    media_type = "application/pdf" if filename.lower().endswith(".pdf") else "text/csv"
    return FileResponse(file_path, filename=filename, media_type=media_type)

@app.post("/api/bank-statements/sample-preview/{filename}")
def preview_sample_bank_statement(
    filename: str,
    bank_account_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    1-Click preview of sample bank statement without needing to browse local disk.
    """
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    file_path = os.path.join(sample_dir, filename)
    if not os.path.exists(file_path):
        generate_sample_bank_statements(sample_dir)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Sample bank statement not found")

    with open(file_path, "rb") as f:
        content = f.read()

    result = parse_bank_statement_file(
        file_bytes=content,
        filename=filename,
        bank_account_id=bank_account_id,
        db=db
    )
    return result

@app.post("/api/bank-statements/csv-raw-preview")
async def get_csv_raw_preview(
    file: UploadFile = File(...)
):
    """
    Reads an uploaded CSV file without importing it, returning:
    - filename
    - raw_headers
    - sample_values_by_column
    - suggested_mapping
    - raw_rows (first 25 rows for visual display in the wizard table)
    - total_rows
    """
    content = await file.read()
    filename = file.filename
    from .bank_parser_engine import parse_csv_raw_preview
    result = parse_csv_raw_preview(file_bytes=content, filename=filename)
    return result

@app.post("/api/bank-statements/upload-preview")
async def upload_bank_statement_preview(
    file: UploadFile = File(...),
    bank_account_id: int = Form(...),
    column_mapping: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload and parse bank statement (CSV, XLSX, or PDF).
    Applies bank rules, vendor matching, and COA heuristics.
    """
    import json
    content = await file.read()
    filename = file.filename
    mapping_dict = None
    if column_mapping:
        try:
            mapping_dict = json.loads(column_mapping)
        except Exception:
            mapping_dict = None

    result = parse_bank_statement_file(
        file_bytes=content,
        filename=filename,
        column_mapping=mapping_dict,
        bank_account_id=bank_account_id,
        db=db
    )
    return result

@app.post("/api/bank-statements/confirm-import")
def confirm_bank_statement_import(
    payload: BankStatementConfirmPayload,
    db: Session = Depends(get_db)
):
    """
    Confirms reviewed bank transactions into check register and general ledger.
    - Outflows (Checks / Debits / ACH) -> check_records with splits & balanced Journal Entry.
    - Automatically creates missing Vendors in vendors table.
    - Inflows (Deposits) -> balanced Journal Entry & Transaction sync.
    - Saves BankRules for items marked save_rule=True.
    """
    bank_acct = db.query(Category).filter(Category.id == payload.bank_account_id).first()
    if not bank_acct:
        raise HTTPException(status_code=404, detail="Selected bank account not found.")

    checks_created = 0
    deposits_created = 0
    vendors_created = 0
    rules_saved = 0

    first_prop = db.query(Property).first()
    default_prop_id = first_prop.id if first_prop else None
    default_class_id = first_prop.class_id if first_prop else None

    # Cache vendors
    vendor_by_name = {v.name.lower(): v for v in db.query(Vendor).all()}

    # Resolve default categories
    default_expense = db.query(Category).filter(Category.account_number == "60100").first()
    if not default_expense:
        default_expense = db.query(Category).filter(Category.type == "OPERATING_EXPENSE").first()
    default_income = db.query(Category).filter(Category.account_number == "40100").first()
    if not default_income:
        default_income = db.query(Category).filter(Category.type == "INCOME").first()

    for idx, item in enumerate(payload.transactions):
        # 1. Automated Rule Saving
        if item.save_rule:
            rule_kw = (item.rule_keyword or item.vendor_name or item.payee).strip()
            if rule_kw:
                existing_rule = db.query(BankRule).filter(BankRule.match_keyword.ilike(rule_kw)).first()
                if not existing_rule:
                    new_rule = BankRule(
                        name=f"Rule: {rule_kw}",
                        match_keyword=rule_kw,
                        match_field="payee_or_desc",
                        target_category_id=item.category_id or (default_expense.id if item.is_outflow else default_income.id),
                        target_vendor_id=item.vendor_id,
                        target_vendor_name=item.vendor_name or item.payee,
                        target_property_id=item.property_id or default_prop_id,
                        target_class_id=item.class_id or default_class_id,
                        is_check=bool(item.check_number),
                    )
                    db.add(new_rule)
                    rules_saved += 1
                else:
                    if item.category_id:
                        existing_rule.target_category_id = item.category_id
                    if item.vendor_id:
                        existing_rule.target_vendor_id = item.vendor_id
                    if item.property_id:
                        existing_rule.target_property_id = item.property_id
                    rules_saved += 1

        # 2. Auto-create vendor if not existing
        v_name = (item.vendor_name or item.payee or "").strip()
        if v_name and v_name.lower() not in ["deposit", "unknown payee", "transfer", "interest", "bank charge"]:
            if v_name.lower() not in vendor_by_name:
                try:
                    new_v = create_vendor(
                        db=db,
                        name=v_name,
                        default_category_id=item.category_id or (default_expense.id if default_expense else None)
                    )
                    vendor_by_name[v_name.lower()] = new_v
                    vendors_created += 1
                    item.vendor_id = new_v.id
                except Exception:
                    pass

        # 3. Determine Property and Class
        prop_id = item.property_id or default_prop_id
        target_property = db.query(Property).filter(Property.id == prop_id).first() if prop_id else None
        class_id = item.class_id or (target_property.class_id if target_property else default_class_id)

        # 4. Outflow (Checks, ACH, Electronic Debits) -> Check Register
        if item.is_outflow or (item.transaction_type in ['CHECK', 'ACH', 'DEBIT']):
            cat_id = item.category_id or (default_expense.id if default_expense else payload.bank_account_id)
            
            # Check number formatting
            chk_num = (item.check_number or "").strip()
            txn_t = item.transaction_type or ("CHECK" if chk_num else "DEBIT")
            if not chk_num:
                if txn_t == 'CHECK':
                    chk_num = get_next_check_number(db, payload.bank_account_id)
                else:
                    ref_prefix = 'ACH' if txn_t == 'ACH' else 'DEB'
                    date_suffix = item.date.replace('-', '')[-4:] if item.date else '0000'
                    chk_num = f"{ref_prefix}-{date_suffix}-{idx+1}"

            splits = [{
                "category_id": cat_id,
                "amount": item.amount,
                "memo": item.memo or item.raw_description or f"{item.payee}",
                "class_id": class_id,
                "property_id": prop_id
            }]

            create_check(
                db=db,
                bank_account_id=payload.bank_account_id,
                check_number=chk_num,
                date=item.date,
                payee=item.payee,
                amount=item.amount,
                address="",
                memo=item.memo or item.raw_description or "",
                splits=splits,
                transaction_type=txn_t,
                source="BANK_IMPORT"
            )
            checks_created += 1

        else:
            # 5. Inflow (Deposit / Addition) -> Journal Entry & Income Transaction
            inc_cat_id = item.category_id or (default_income.id if default_income else payload.bank_account_id)
            date_s = item.date.replace('-', '')[-4:] if item.date else '0000'
            dep_ref = f"DEP-{date_s}-{idx+1}"
            
            create_journal_entry(
                db=db,
                date=item.date,
                entry_number=dep_ref,
                memo=f"Bank Deposit: {item.payee}".strip(),
                lines=[
                    {
                        "category_id": payload.bank_account_id,
                        "debit": item.amount,
                        "credit": 0.0,
                        "memo": f"Bank Deposit: {item.payee}",
                        "property_id": None,
                        "class_id": None
                    },
                    {
                        "category_id": inc_cat_id,
                        "debit": 0.0,
                        "credit": item.amount,
                        "memo": item.memo or item.raw_description or f"Deposit from {item.payee}",
                        "property_id": prop_id,
                        "class_id": class_id
                    }
                ],
                source="BANK_IMPORT"
            )
            deposits_created += 1

    # 6. Record statement history
    file_ext = 'PDF' if payload.filename.lower().endswith('.pdf') else 'CSV'
    bank_stmt = BankStatement(
        bank_account_id=payload.bank_account_id,
        filename=payload.filename,
        file_type=file_ext,
        statement_period=payload.statement_period,
        row_count=len(payload.transactions),
        checks_count=checks_created,
        deposits_count=deposits_created,
        notes=f"Successfully imported {checks_created} checks/debits and {deposits_created} deposits."
    )
    db.add(bank_stmt)
    db.commit()

    return {
        "status": "SUCCESS",
        "statement_id": bank_stmt.id,
        "filename": payload.filename,
        "checks_created": checks_created,
        "deposits_created": deposits_created,
        "vendors_created": vendors_created,
        "rules_saved": rules_saved,
        "message": f"Successfully imported {len(payload.transactions)} transactions ({checks_created} disbursements/checks and {deposits_created} deposits) into register."
    }

@app.get("/api/bank-statements")
def list_bank_statements(db: Session = Depends(get_db)):
    """
    List past imported bank statements.
    """
    stmts = db.query(BankStatement).order_by(BankStatement.upload_date.desc()).all()
    return [s.to_dict() for s in stmts]


# =====================================================================
# --- Automated Bank Rules API Endpoints ---
# =====================================================================

@app.get("/api/bank-rules")
def list_bank_rules(db: Session = Depends(get_db)):
    rules = db.query(BankRule).order_by(BankRule.id.asc()).all()
    return [r.to_dict() for r in rules]

@app.post("/api/bank-rules")
def create_bank_rule(payload: BankRuleCreate, db: Session = Depends(get_db)):
    rule = BankRule(
        name=payload.name,
        match_keyword=payload.match_keyword,
        match_field=payload.match_field or "payee_or_desc",
        target_category_id=payload.target_category_id,
        target_vendor_id=payload.target_vendor_id,
        target_vendor_name=payload.target_vendor_name,
        target_property_id=payload.target_property_id,
        target_class_id=payload.target_class_id,
        is_check=bool(payload.is_check),
        is_active=True if payload.is_active is None else payload.is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule.to_dict()

@app.put("/api/bank-rules/{rule_id}")
def update_bank_rule(rule_id: int, payload: BankRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(BankRule).filter(BankRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Bank rule not found")
    if payload.name is not None: rule.name = payload.name
    if payload.match_keyword is not None: rule.match_keyword = payload.match_keyword
    if payload.match_field is not None: rule.match_field = payload.match_field
    if payload.target_category_id is not None: rule.target_category_id = payload.target_category_id
    if payload.target_vendor_id is not None: rule.target_vendor_id = payload.target_vendor_id
    if payload.target_vendor_name is not None: rule.target_vendor_name = payload.target_vendor_name
    if payload.target_property_id is not None: rule.target_property_id = payload.target_property_id
    if payload.target_class_id is not None: rule.target_class_id = payload.target_class_id
    if payload.is_check is not None: rule.is_check = payload.is_check
    if payload.is_active is not None: rule.is_active = payload.is_active
    db.commit()
    db.refresh(rule)
    return rule.to_dict()

@app.delete("/api/bank-rules/{rule_id}")
def delete_bank_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(BankRule).filter(BankRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Bank rule not found")
    db.delete(rule)
    db.commit()
    return {"success": True, "message": "Bank rule deleted successfully"}


# --- Financial Reporting Dashboard Endpoints ---
@app.get("/api/reports/monthly-pnl")
def get_monthly_pnl_report(
    company_id: Optional[int] = None,
    class_id: Optional[int] = None,
    property_id: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return generate_monthly_property_pnl(
        db,
        company_id=company_id,
        class_id=class_id,
        property_id=property_id,
        year=year,
        month=month
    )

@app.get("/api/reports/concise-pnl")
def get_concise_pnl_report_endpoint(
    company_id: Optional[int] = None,
    class_id: Optional[int] = None,
    property_id: Optional[int] = None,
    preset: Optional[str] = "MONTHLY",
    year: Optional[int] = None,
    month: Optional[str] = None,
    quarter: Optional[int] = None,
    half: Optional[int] = None,
    fiscal_start_month: Optional[int] = 1,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    compare_prior: Optional[bool] = True,
    db: Session = Depends(get_db)
):
    return generate_concise_pnl_report(
        db=db,
        company_id=company_id,
        class_id=class_id,
        property_id=property_id,
        preset=preset or "MONTHLY",
        year=year,
        month=month,
        quarter=quarter,
        half=half,
        fiscal_start_month=fiscal_start_month or 1,
        from_date=from_date,
        to_date=to_date,
        compare_prior=bool(compare_prior)
    )

@app.get("/api/reports/category-drilldown")
def get_category_drilldown_endpoint(
    category_id: Optional[int] = None,
    account_name: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    property_id: Optional[int] = None,
    class_id: Optional[int] = None,
    company_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return get_category_drilldown_transactions(
        db=db,
        category_id=category_id,
        account_name=account_name,
        from_date=from_date,
        to_date=to_date,
        property_id=property_id,
        class_id=class_id,
        company_id=company_id
    )

@app.get("/api/reports/concise-pnl/export-csv")
def export_concise_pnl_csv(
    company_id: Optional[int] = None,
    class_id: Optional[int] = None,
    property_id: Optional[int] = None,
    preset: Optional[str] = "MONTHLY",
    year: Optional[int] = None,
    month: Optional[str] = None,
    quarter: Optional[int] = None,
    half: Optional[int] = None,
    fiscal_start_month: Optional[int] = 1,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    compare_prior: Optional[bool] = True,
    db: Session = Depends(get_db)
):
    data = generate_concise_pnl_report(
        db=db,
        company_id=company_id,
        class_id=class_id,
        property_id=property_id,
        preset=preset or "MONTHLY",
        year=year,
        month=month,
        quarter=quarter,
        half=half,
        fiscal_start_month=fiscal_start_month or 1,
        from_date=from_date,
        to_date=to_date,
        compare_prior=bool(compare_prior)
    )
    period = data['period_info']
    lines = []
    lines.append("Profit & Loss Statement (Concise Summary)")
    lines.append(f"Period: {period['period_label']} (vs Prior: {period['prior_period_label']})")
    lines.append("")

    if not property_id and data.get('portfolio_consolidated_report'):
        port = data['portfolio_consolidated_report']
        lines.append(f"=== {port['property_name']} ({port['address']}) ===")
        lines.append("Section,Account Number,Category Name,Current Amount ($),Prior Amount ($),Change ($),Change (%),Txn Count")
        for item in port['rental_income_section']['items']:
            lines.append(f'"Rental Income","{item["account_number"]}","{item["account_name"]}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        r_tot = port['rental_income_section']
        lines.append(f'"Total Rental Income","","Subtotal",{r_tot["total_current"]},{r_tot["total_prior"]},{r_tot["total_change"]},{r_tot["total_change_percent"]}%,')
        for item in port['other_income_section']['items']:
            lines.append(f'"Other Income","{item["account_number"]}","{item["account_name"]}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        lines.append(f'"Total Gross Income","","Total",{port["total_gross_income_current"]},{port["total_gross_income_prior"]},{port["total_gross_income_change"]},{port["total_gross_income_change_percent"]}%,')
        for item in port['operating_expenses_section']['items']:
            repair_tag = " (Repair)" if item["is_repair"] else ""
            lines.append(f'"Operating Expenses","{item["account_number"]}","{item["account_name"]}{repair_tag}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        op_tot = port['operating_expenses_section']
        lines.append(f'"TOTAL OPERATING EXPENSES (BOLD)","","Total",{op_tot["total_current"]},{op_tot["total_prior"]},{op_tot["total_change"]},{op_tot["total_change_percent"]}%,')
        lines.append(f'"Repair Percentage (%)","","KPI",{port["repair_percentage_current"]}%,{port["repair_percentage_prior"]}%,,,')
        lines.append(f'"NET OPERATING INCOME (NOI)","","Total",{port["net_operating_income_current"]},{port["net_operating_income_prior"]},{port["net_operating_income_change"]},{port["net_operating_income_change_percent"]}%,')
        for item in port['non_operating_section']['items']:
            lines.append(f'"Non-Operating","{item["account_number"]}","{item["account_name"]}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        lines.append(f'"NET CASH FLOW","","Total",{port["net_cash_flow_current"]},{port["net_cash_flow_prior"]},{port["net_cash_flow_change"]},{port["net_cash_flow_change_percent"]}%,')
        lines.append("")
        lines.append("=== Individual Property Statements ===")
        lines.append("")

    for prop in data['properties_reports']:
        lines.append(f"Property: {prop['property_name']} | LLC: {prop['class_name']} | Company: {prop['company_name']}")
        lines.append("Section,Account Number,Category Name,Current Amount ($),Prior Amount ($),Change ($),Change (%),Txn Count")
        
        # 1. Rental Income
        for item in prop['rental_income_section']['items']:
            lines.append(f'"Rental Income","{item["account_number"]}","{item["account_name"]}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        r_tot = prop['rental_income_section']
        lines.append(f'"Total Rental Income","","Subtotal",{r_tot["total_current"]},{r_tot["total_prior"]},{r_tot["total_change"]},{r_tot["total_change_percent"]}%,')

        # 2. Other Income
        for item in prop['other_income_section']['items']:
            lines.append(f'"Other Income","{item["account_number"]}","{item["account_name"]}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        lines.append(f'"Total Gross Income","","Total",{prop["total_gross_income_current"]},{prop["total_gross_income_prior"]},{prop["total_gross_income_change"]},{prop["total_gross_income_change_percent"]}%,')

        # 3. Operating Expenses
        for item in prop['operating_expenses_section']['items']:
            repair_tag = " (Repair)" if item["is_repair"] else ""
            lines.append(f'"Operating Expenses","{item["account_number"]}","{item["account_name"]}{repair_tag}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        op_tot = prop['operating_expenses_section']
        lines.append(f'"TOTAL OPERATING EXPENSES (BOLD)","","Total",{op_tot["total_current"]},{op_tot["total_prior"]},{op_tot["total_change"]},{op_tot["total_change_percent"]}%,')
        lines.append(f'"Repair Percentage (%)","","KPI",{prop["repair_percentage_current"]}%,{prop["repair_percentage_prior"]}%,,,')

        # NOI
        lines.append(f'"NET OPERATING INCOME (NOI)","","Total",{prop["net_operating_income_current"]},{prop["net_operating_income_prior"]},{prop["net_operating_income_change"]},{prop["net_operating_income_change_percent"]}%,')

        # 4. Non-Operating
        for item in prop['non_operating_section']['items']:
            lines.append(f'"Non-Operating","{item["account_number"]}","{item["account_name"]}",{item["current_amount"]},{item["prior_amount"]},{item["change_amount"]},{item["change_percent"]}%,{item["transaction_count"]}')
        lines.append(f'"NET CASH FLOW","","Total",{prop["net_cash_flow_current"]},{prop["net_cash_flow_prior"]},{prop["net_cash_flow_change"]},{prop["net_cash_flow_change_percent"]}%,')
        lines.append("")

    csv_content = "\n".join(lines)
    filename = f"Concise_PnL_{preset}_{period['start_date']}_{period['end_date']}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/reports/category-drilldown/export-csv")
def export_category_drilldown_csv(
    category_id: Optional[int] = None,
    account_name: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    property_id: Optional[int] = None,
    class_id: Optional[int] = None,
    company_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    drill = get_category_drilldown_transactions(
        db=db,
        category_id=category_id,
        account_name=account_name,
        from_date=from_date,
        to_date=to_date,
        property_id=property_id,
        class_id=class_id,
        company_id=company_id
    )
    lines = []
    cat_title = drill['category']['display_name']
    lines.append(f"Category Detail Ledger: {cat_title}")
    lines.append(f"Date Range: {drill['period_info']['date_label']}")
    lines.append(f"Total Transactions: {drill['transaction_count']} | Total Sum: ${drill['total_amount']:,.2f}")
    lines.append("")
    lines.append("Date,Reference,Type/Source,Payee,Memo/Description,Property,Class / LLC,Amount ($)")
    for t in drill['transactions']:
        lines.append(f'"{t.get("date","")}","{t.get("reference_number","")}","{t.get("source","")}","{t.get("payee","")}","{t.get("description","")}","{t.get("property_name","")}","{t.get("class_name","")}",{t.get("amount",0.0)}')
    csv_content = "\n".join(lines)
    clean_cat_filename = "".join([c if c.isalnum() else "_" for c in cat_title]).strip("_")
    filename = f"Ledger_{clean_cat_filename}_{from_date or 'start'}_{to_date or 'end'}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.post("/api/seed-demo-data")
def trigger_seed(db: Session = Depends(get_db)):
    from .seed_data import seed_sample_data_with_db
    return seed_sample_data_with_db(db)

# --- Printer Discovery & Report Printing Endpoints ---
@app.get("/api/printers")
def list_system_printers():
    """
    Returns all detected printers configured on the Windows machine,
    their default status, and whether they support duplex / double-sided printing.
    """
    return get_system_printers()

@app.get("/api/reports/concise-pnl/print-view")
def get_concise_pnl_print_view(
    company_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    property_id: Optional[int] = Query(None),
    preset: str = Query('MONTHLY'),
    year: Optional[int] = Query(None),
    month: Optional[str] = Query(None),
    quarter: Optional[int] = Query(None),
    half: Optional[int] = Query(None),
    fiscal_start_month: Optional[int] = Query(7),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    compare_prior: bool = Query(True),
    orientation: str = Query('portrait'),
    duplex: str = Query('none'),
    page_fit: str = Query('fit_one_page_wide'),
    page_per_property: bool = Query(False),
    include_summary: bool = Query(True),
    target_printer: Optional[str] = Query(None),
    autoprint: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Generates standalone, executive publication-grade printable HTML for the Concise Profit & Loss statement.
    Supports user-customized orientation (portrait/landscape), duplex margins, page-fitting, and property pagination.
    """
    data = generate_concise_pnl_report(
        db=db,
        company_id=company_id,
        class_id=class_id,
        property_id=property_id,
        preset=preset,
        year=year,
        month=month,
        quarter=quarter,
        half=half,
        fiscal_start_month=fiscal_start_month,
        from_date=from_date,
        to_date=to_date,
        compare_prior=compare_prior
    )

    html_content = render_printable_pnl_html(
        report_data=data,
        orientation=orientation,
        duplex=duplex,
        page_fit=page_fit,
        page_per_property=page_per_property,
        include_summary=include_summary,
        include_comparison=compare_prior,
        target_printer=target_printer,
        autoprint=autoprint
    )

    return Response(content=html_content, media_type="text/html")

# --- Serve Frontend in Production ---
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
