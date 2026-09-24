import io
import csv
import re
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from .models import Category

ACCOUNT_RANGES = {
    "ASSET": (10000, 19999, "1xxxx - Assets (Bank, Cash, Receivables, Fixed Assets)"),
    "LIABILITY": (20000, 29999, "2xxxx - Payables & Liabilities (AP, Tenant Deposits, Mortgages)"),
    "EQUITY": (30000, 39999, "3xxxx - Equities (Owner's Equity, Draws, Retained Earnings)"),
    "REVENUE": (40000, 49999, "4xxxx - Revenue & Income (Rental Income, Late Fees, Laundry)"),
    "INCOME": (40000, 49999, "4xxxx - Revenue & Income (Rental Income, Late Fees, Laundry)"),
    "COGS": (50000, 59999, "5xxxx - Cost of Goods Sold / Flips Operations"),
    "OPERATING_EXPENSE": (60000, 89999, "6xxxx thru 8xxxx - Operating Expenses (Repairs, Taxes, Insurance, Utilities)"),
    "OTHER_INCOME_EXPENSE": (80000, 99999, "8xxxx thru 9xxxx - Other Incomes & Expenses (Interest, CapEx, Depreciation)"),
    "NON_OPERATING_EXPENSE": (80000, 99999, "8xxxx thru 9xxxx - Other Incomes & Expenses (Mortgage Interest, CapEx)"),
    "CAPEX": (80000, 99999, "8xxxx thru 9xxxx - Other Incomes & Expenses (CapEx)")
}

CUSTOM_BASE_COA_SEED = [
    {"account_number": "10000", "name": "All Assets", "type": "ASSET", "sub_type": "All Assets", "description": "Master asset account", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "20000", "name": "All Liabilities", "type": "LIABILITY", "sub_type": "All Liabilities", "description": "Master liabilities account", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "30000", "name": "All Equity", "type": "EQUITY", "sub_type": "All Equity", "description": "Master equity account", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "40000", "name": "All Revenue (Income)", "type": "INCOME", "sub_type": "All Revenue", "description": "Master revenue and income account", "is_repair_category": False, "is_rental_income": True},
    {"account_number": "50000", "name": "Used for Flips only", "type": "COGS", "sub_type": "Flips", "description": "Cost of goods sold / capital improvements for flips only", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60000", "name": "All Operating Expenses", "type": "OPERATING_EXPENSE", "sub_type": "Operating Expenses", "description": "Master operating expenses (60000 series)", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "70000", "name": "All Operating Expenses", "type": "OPERATING_EXPENSE", "sub_type": "Operating Expenses", "description": "Master operating expenses (70000 series)", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "80000", "name": "Other Income/Expenses", "type": "OTHER_INCOME_EXPENSE", "sub_type": "Other Income/Expenses", "description": "Master other income and expenses account", "is_repair_category": False, "is_rental_income": False},
]

STANDARD_COA_SEED = [
    # 1xxxx - ASSETS
    {"account_number": "10100", "name": "Operating Checking", "type": "ASSET", "sub_type": "Bank Accounts", "description": "Primary operating cash bank account", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "10200", "name": "Security Deposit Escrow", "type": "ASSET", "sub_type": "Bank Accounts", "description": "Restricted tenant security deposits bank account", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "10300", "name": "Reserve & Savings", "type": "ASSET", "sub_type": "Bank Accounts", "description": "Capital reserve and escrow savings account", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "10400", "name": "Cash on Hand & Petty Cash", "type": "ASSET", "sub_type": "Cash on Hand", "description": "Petty cash and cash on hand", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "10500", "name": "Accounts Receivable", "type": "ASSET", "sub_type": "Accounts Receivable", "description": "Uncollected tenant rents and charges", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "10600", "name": "Prepaid Insurance & Expenses", "type": "ASSET", "sub_type": "Other Current Assets", "description": "Prepaid property insurance and real estate taxes", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "15000", "name": "Real Property & Buildings", "type": "ASSET", "sub_type": "Fixed Assets", "description": "Land, residential buildings, and structural improvements", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "15100", "name": "Accumulated Depreciation", "type": "ASSET", "sub_type": "Contra Asset", "description": "Cumulative building and asset depreciation", "is_repair_category": False, "is_rental_income": False},

    # 2xxxx - LIABILITIES & PAYABLES
    {"account_number": "20100", "name": "Accounts Payable", "type": "LIABILITY", "sub_type": "Accounts Payable", "description": "Outstanding vendor bills and contractor invoices", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "20200", "name": "Tenant Security Deposits Held", "type": "LIABILITY", "sub_type": "Other Current Liabilities", "description": "Refundable security deposits held on behalf of tenants", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "20300", "name": "Credit Cards Payable", "type": "LIABILITY", "sub_type": "Credit Cards", "description": "Property operational credit card balances", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "20400", "name": "Accrued Property Taxes Payable", "type": "LIABILITY", "sub_type": "Current Liabilities", "description": "Accrued county property tax liability", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "25000", "name": "Long-Term Mortgages Payable", "type": "LIABILITY", "sub_type": "Long Term Liabilities", "description": "Primary property mortgage loan principal notes", "is_repair_category": False, "is_rental_income": False},

    # 3xxxx - EQUITIES
    {"account_number": "30100", "name": "Owner's Equity & Contributions", "type": "EQUITY", "sub_type": "Owner's Equity", "description": "Initial capital investments and member contributions", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "30200", "name": "Owner's Draws & Distributions", "type": "EQUITY", "sub_type": "Equity Draws", "description": "Partner profit distributions and capital withdrawals", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "30300", "name": "Retained Earnings", "type": "EQUITY", "sub_type": "Retained Earnings", "description": "Cumulative historical net operating earnings", "is_repair_category": False, "is_rental_income": False},

    # 4xxxx - REVENUE & INCOME
    {"account_number": "40100", "name": "Rental Income", "type": "INCOME", "sub_type": "Rental Revenue", "description": "Gross scheduled tenant rental income", "is_repair_category": False, "is_rental_income": True},
    {"account_number": "40200", "name": "Late Fees & Misc Income", "type": "INCOME", "sub_type": "Fee Income", "description": "Tenant late payment penalties and administrative fees", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "40300", "name": "Laundry & Parking Income", "type": "INCOME", "sub_type": "Ancillary Revenue", "description": "Coin-op laundry, assigned parking, and storage rents", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "40400", "name": "Pet Fees & Application Fees", "type": "INCOME", "sub_type": "Fee Income", "description": "Non-refundable pet fees and applicant screening charges", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "40900", "name": "Miscellaneous Property Income", "type": "INCOME", "sub_type": "Other Revenue", "description": "Vending, utility reimbursements, and misc income", "is_repair_category": False, "is_rental_income": False},

    # 5xxxx - COST OF GOODS SOLD (COGS)
    {"account_number": "50100", "name": "Unit Turnover & Cleaning", "type": "COGS", "sub_type": "Direct Turnover Costs", "description": "Direct turnover labor and deep cleaning between leases", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "50200", "name": "Direct Turnover Subcontractors", "type": "COGS", "sub_type": "Direct Labor", "description": "Third-party turnover trades (painters, carpet installers)", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "50300", "name": "Direct Turnover Materials", "type": "COGS", "sub_type": "Turnover Supplies", "description": "Locks, fixtures, paint, and turnover hardware", "is_repair_category": False, "is_rental_income": False},

    # 6xxxx thru 8xxxx - OPERATING EXPENSES
    {"account_number": "60100", "name": "Repairs & Maintenance", "type": "OPERATING_EXPENSE", "sub_type": "Maintenance", "description": "Day-to-day property repairs, plumbing, electrical, and HVAC", "is_repair_category": True, "is_rental_income": False},
    {"account_number": "60200", "name": "Property Management Fees", "type": "OPERATING_EXPENSE", "sub_type": "Management", "description": "Monthly third-party property management percentage fees", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60300", "name": "Property Taxes", "type": "OPERATING_EXPENSE", "sub_type": "Taxes", "description": "County real estate ad valorem property taxes", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60400", "name": "Property Insurance", "type": "OPERATING_EXPENSE", "sub_type": "Insurance", "description": "Property hazard, liability, and flood insurance policies", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60500", "name": "Utilities (Water/Gas/Trash)", "type": "OPERATING_EXPENSE", "sub_type": "Utilities", "description": "Owner-paid water, gas, electricity, trash, and sewer", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60600", "name": "Landscaping & Grounds", "type": "OPERATING_EXPENSE", "sub_type": "Grounds Maintenance", "description": "Lawn care, tree trimming, snow removal, and groundskeeping", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60700", "name": "Legal & Professional Fees", "type": "OPERATING_EXPENSE", "sub_type": "Professional Services", "description": "Attorney, CPA, tax advisory, and accounting software fees", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60800", "name": "Advertising & Leasing Fees", "type": "OPERATING_EXPENSE", "sub_type": "Marketing", "description": "Zillow/CoStar listings, tenant placement commissions", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "60900", "name": "Pest Control Services", "type": "OPERATING_EXPENSE", "sub_type": "Maintenance", "description": "Routine extermination and termite protection", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "61000", "name": "HOA & Assessment Dues", "type": "OPERATING_EXPENSE", "sub_type": "Association Fees", "description": "Condo / Homeowners association monthly assessments", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "61100", "name": "Licenses & Permits", "type": "OPERATING_EXPENSE", "sub_type": "Administrative", "description": "Rental registration certificates and municipal permits", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "61200", "name": "Telephone & Internet", "type": "OPERATING_EXPENSE", "sub_type": "Utilities", "description": "Business phone, cellular, property Wi-Fi, and internet services", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "61300", "name": "Bank & Merchant Service Fees", "type": "OPERATING_EXPENSE", "sub_type": "Bank Fees", "description": "Bank account monthly service charges, overdraft fees, wire fees, and merchant processing fees", "is_repair_category": False, "is_rental_income": False},

    # 9xxxx - OTHER INCOMES & EXPENSES
    {"account_number": "90100", "name": "Interest Income", "type": "OTHER_INCOME_EXPENSE", "sub_type": "Other Income", "description": "Bank account and escrow interest earned", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "90200", "name": "Mortgage Principal & Interest", "type": "NON_OPERATING_EXPENSE", "sub_type": "Debt Service", "description": "Mortgage loan interest and principal debt service payments", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "90300", "name": "Capital Improvements (CapEx)", "type": "CAPEX", "sub_type": "CapEx", "description": "Major roof replacements, HVAC overhauls, and capital additions", "is_repair_category": False, "is_rental_income": False},
    {"account_number": "90400", "name": "Depreciation & Amortization", "type": "OTHER_INCOME_EXPENSE", "sub_type": "Non-Cash Expenses", "description": "Non-cash tax depreciation and closing cost amortization", "is_repair_category": False, "is_rental_income": False}
]

def normalize_account_type(type_str: str) -> str:
    t = (type_str or "").strip().upper().replace(" ", "_").replace("-", "_")
    if t in ["ASSET", "ASSETS"]:
        return "ASSET"
    if t in ["LIABILITY", "LIABILITIES", "PAYABLE", "PAYABLES"]:
        return "LIABILITY"
    if t in ["EQUITY", "EQUITIES", "OWNER_EQUITY", "OWNERS_EQUITY"]:
        return "EQUITY"
    if t in ["REVENUE", "REVENUES", "INCOME", "INCOMES"]:
        return "INCOME"
    if t in ["COGS", "COST_OF_GOODS", "COST_OF_GOODS_SOLD", "DIRECT_COST", "DIRECT_COSTS"]:
        return "COGS"
    if t in ["OPERATING_EXPENSE", "OPERATING_EXPENSES", "EXPENSE", "EXPENSES"]:
        return "OPERATING_EXPENSE"
    if t in ["OTHER_INCOME_EXPENSE", "OTHER_INCOME", "OTHER_EXPENSE", "OTHER", "NON_OPERATING", "NON_OPERATING_EXPENSE", "CAPEX"]:
        return "OTHER_INCOME_EXPENSE"
    return "OPERATING_EXPENSE"

def infer_account_type_from_number(account_number: str) -> str:
    num_str = re.sub(r"[^\d]", "", str(account_number or "").strip())
    if not num_str:
        return "OPERATING_EXPENSE"
    first_digit = num_str[0]
    if first_digit == "1":
        return "ASSET"
    elif first_digit == "2":
        return "LIABILITY"
    elif first_digit == "3":
        return "EQUITY"
    elif first_digit == "4":
        return "INCOME"
    elif first_digit == "5":
        return "COGS"
    elif first_digit in ["6", "7"]:
        return "OPERATING_EXPENSE"
    elif first_digit in ["8", "9"]:
        return "OTHER_INCOME_EXPENSE"
    return "OPERATING_EXPENSE"

def validate_account_number(account_number: str, account_type: str) -> Tuple[bool, str]:
    num_str = re.sub(r"[^\d]", "", str(account_number or "").strip())
    if not num_str or len(num_str) < 4 or len(num_str) > 7:
        return False, f"Account number '{account_number}' must be between 4 and 7 digits (e.g. 10010, 20100)."
    
    num_val = int(num_str)
    norm_type = normalize_account_type(account_type)
    
    if norm_type == "ASSET" and not (10000 <= num_val <= 19999):
        return False, f"Asset accounts must be in the 1xxxx range (10000 - 19999). Got {account_number}."
    elif norm_type == "LIABILITY" and not (20000 <= num_val <= 29999):
        return False, f"Payables & Liability accounts must be in the 2xxxx range (20000 - 29999). Got {account_number}."
    elif norm_type == "EQUITY" and not (30000 <= num_val <= 39999):
        return False, f"Equity accounts must be in the 3xxxx range (30000 - 39999). Got {account_number}."
    elif norm_type in ["INCOME", "REVENUE"] and not (40000 <= num_val <= 49999):
        return False, f"Revenue & Income accounts must be in the 4xxxx range (40000 - 49999). Got {account_number}."
    elif norm_type == "COGS" and not (50000 <= num_val <= 59999):
        return False, f"Cost of Goods Sold (COGS) accounts must be in the 5xxxx range (50000 - 59999). Got {account_number}."
    elif norm_type == "OPERATING_EXPENSE" and not (60000 <= num_val <= 89999):
        return False, f"Operating Expense accounts must be in the 6xxxx thru 8xxxx range (60000 - 89999). Got {account_number}."
    elif norm_type in ["OTHER_INCOME_EXPENSE", "NON_OPERATING_EXPENSE", "CAPEX"] and not (80000 <= num_val <= 99999):
        return False, f"Other Income & Expense accounts must be in the 8xxxx thru 9xxxx range (80000 - 99999). Got {account_number}."
    
    return True, "Valid"

def suggest_next_account_number(account_type: str, existing_numbers: List[str], parent_number: Optional[str] = None) -> str:
    used_ints = set()
    for num_str in existing_numbers:
        clean = re.sub(r"[^\d]", "", str(num_str or ""))
        if clean.isdigit():
            used_ints.add(int(clean))

    # If suggesting for a sub-account of a parent account
    if parent_number and parent_number.strip():
        clean_parent = re.sub(r"[^\d]", "", str(parent_number).strip())
        if clean_parent.isdigit():
            parent_val = int(clean_parent)
            step = 100 if parent_val % 10000 == 0 else (10 if parent_val % 100 == 0 else 1)
            candidate = parent_val + step
            while candidate in used_ints and candidate < parent_val + (step * 10):
                candidate += step
            return str(candidate)

    norm_type = normalize_account_type(account_type)
    min_val, max_val, _ = ACCOUNT_RANGES.get(norm_type, (60000, 89999, ""))
    
    type_used_ints = [v for v in used_ints if min_val <= v <= max_val]
    
    if not type_used_ints:
        starts = {
            "ASSET": 10100,
            "LIABILITY": 20100,
            "EQUITY": 30100,
            "INCOME": 40100,
            "REVENUE": 40100,
            "COGS": 50100,
            "OPERATING_EXPENSE": 60100,
            "OTHER_INCOME_EXPENSE": 80100
        }
        return str(starts.get(norm_type, min_val + 100))
    
    max_used = max(type_used_ints)
    step = 100 if all(val % 100 == 0 for val in type_used_ints) else 10
    candidate = ((max_used // step) + 1) * step
    while candidate in used_ints and candidate <= max_val:
        candidate += step
        
    if candidate > max_val:
        candidate = min_val + step
        while candidate in used_ints and candidate <= max_val:
            candidate += step
            
    return str(candidate)

def seed_custom_base_accounts(db: Session, overwrite: bool = False):
    """
    Seeds the clean 8 base master accounts:
    10000 All Assets
    20000 All Liabilities
    30000 All Equity
    40000 All Revenue (Income)
    50000 Used for Flips only
    60000 All Operating Expenses
    70000 All Operating Expenses
    80000 Other Income/Expenses
    """
    if overwrite:
        existing = db.query(Category).all()
        for c in existing:
            if not c.transactions:
                db.delete(c)
            else:
                c.is_active = False
        db.commit()

    created = []
    existing_nums = {c.account_number for c in db.query(Category).all() if c.account_number}
    for item in CUSTOM_BASE_COA_SEED:
        if item["account_number"] not in existing_nums:
            new_cat = Category(
                account_number=item["account_number"],
                name=item["name"],
                type=item["type"],
                sub_type=item.get("sub_type"),
                description=item.get("description"),
                is_repair_category=item.get("is_repair_category", False),
                is_rental_income=item.get("is_rental_income", False),
                is_active=True
            )
            db.add(new_cat)
            created.append(new_cat)
            existing_nums.add(item["account_number"])
    db.commit()
    return created

def export_accounts_to_csv(accounts: List[Category]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Account Number",
        "Account Name",
        "Account Type",
        "Sub Type",
        "Description",
        "Opening Balance",
        "Opening Balance Date",
        "Is Repair Category",
        "Is Rental Income",
        "Active Status"
    ])
    
    sorted_accounts = sorted(
        accounts,
        key=lambda a: (
            int(re.sub(r"[^\d]", "", a.account_number)) if a.account_number and re.sub(r"[^\d]", "", a.account_number).isdigit() else 999999,
            a.name
        )
    )
    
    for acct in sorted_accounts:
        writer.writerow([
            acct.account_number or "",
            acct.name,
            acct.type,
            acct.sub_type or "",
            acct.description or "",
            acct.opening_balance if acct.opening_balance is not None else 0.0,
            acct.opening_balance_date or "",
            "Yes" if acct.is_repair_category else "No",
            "Yes" if acct.is_rental_income else "No",
            "Active" if (acct.is_active if acct.is_active is not None else True) else "Inactive"
        ])
        
    return output.getvalue()

def get_sample_csv_template() -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Account Number",
        "Account Name",
        "Account Type",
        "Sub Type",
        "Description",
        "Is Repair Category",
        "Is Rental Income",
        "Active Status"
    ])
    
    samples = [
        ["10100", "Operating Bank Checking", "ASSET", "Bank Accounts", "Main property operating checking account", "No", "No", "Active"],
        ["10500", "Tenant Accounts Receivable", "ASSET", "Accounts Receivable", "Uncollected rents due from tenants", "No", "No", "Active"],
        ["20100", "Accounts Payable", "LIABILITY", "Accounts Payable", "Unpaid contractor and utility bills", "No", "No", "Active"],
        ["20200", "Security Deposits Escrow", "LIABILITY", "Tenant Deposits", "Held tenant security deposits", "No", "No", "Active"],
        ["30100", "Owner's Equity Contributions", "EQUITY", "Owner's Equity", "Capital invested by owners", "No", "No", "Active"],
        ["40100", "Rental Income", "INCOME", "Rental Revenue", "Monthly residential and commercial tenant rents", "No", "Yes", "Active"],
        ["40200", "Late Charges & Fees", "INCOME", "Fee Income", "Tenant late fees and penalties", "No", "No", "Active"],
        ["50100", "Direct Unit Cleaning & Turnaround", "COGS", "Direct Costs", "Make-ready and turnover cleaning labor", "No", "No", "Active"],
        ["60100", "Repairs & Maintenance", "OPERATING_EXPENSE", "Maintenance", "General repairs, plumbing, electrical, and HVAC", "Yes", "No", "Active"],
        ["60200", "Property Management Fees", "OPERATING_EXPENSE", "Management", "Monthly management fees", "No", "No", "Active"],
        ["60300", "Property Taxes", "OPERATING_EXPENSE", "Taxes", "County real estate ad valorem taxes", "No", "No", "Active"],
        ["60400", "Property Insurance", "OPERATING_EXPENSE", "Insurance", "Hazard, fire, and liability coverage", "No", "No", "Active"],
        ["60500", "Utilities (Water/Gas/Trash)", "OPERATING_EXPENSE", "Utilities", "Landlord-paid utility bills", "No", "No", "Active"],
        ["90100", "Interest Income", "OTHER_INCOME_EXPENSE", "Other Income", "Interest on escrow balances", "No", "No", "Active"],
        ["90200", "Mortgage Interest & Debt Service", "NON_OPERATING_EXPENSE", "Debt Service", "Monthly loan interest", "No", "No", "Active"],
        ["90300", "Capital Improvements (CapEx)", "CAPEX", "CapEx", "Roof, HVAC, and capital structural investments", "No", "No", "Active"]
    ]
    
    for s in samples:
        writer.writerow(s)
        
    return output.getvalue()

def _match_header_col(headers: List[str], target_keys: List[str]) -> int:
    for idx, h in enumerate(headers):
        clean = h.strip().lower().replace(" ", "_").replace("-", "_").replace("#", "number")
        if clean in target_keys:
            return idx
    for idx, h in enumerate(headers):
        clean = h.strip().lower().replace(" ", "_").replace("-", "_").replace("#", "number")
        for key in target_keys:
            if clean.startswith(key) or clean.endswith(key) or key in clean:
                return idx
    return -1

def import_accounts_from_csv(csv_content: str, db: Session) -> Dict[str, Any]:
    reader = csv.reader(io.StringIO(csv_content.strip()))
    rows = list(reader)
    if not rows:
        raise ValueError("The provided CSV file is empty.")
    
    raw_header = rows[0]
    col_number_idx = _match_header_col(raw_header, ["account_number", "acct_number", "account_no", "acct_no", "account_num", "number"])
    col_name_idx = _match_header_col(raw_header, ["account_name", "category_name", "acct_name", "account_title", "category", "name"])
    col_type_idx = _match_header_col(raw_header, ["account_type", "category_type", "acct_type", "classification", "type", "class"])
    col_subtype_idx = _match_header_col(raw_header, ["sub_type", "subtype", "detail_type", "sub_category", "detail"])
    col_desc_idx = _match_header_col(raw_header, ["description", "desc", "notes", "memo"])
    col_repair_idx = _match_header_col(raw_header, ["is_repair_category", "is_repair", "repair", "repairs"])
    col_rental_idx = _match_header_col(raw_header, ["is_rental_income", "is_rental", "rental_income", "rental", "rent"])
    col_active_idx = _match_header_col(raw_header, ["active_status", "is_active", "status", "active"])
    col_open_bal_idx = _match_header_col(raw_header, ["opening_balance", "open_balance", "initial_balance", "starting_balance"])
    col_open_dt_idx = _match_header_col(raw_header, ["opening_balance_date", "opening_date", "balance_date", "as_of_date"])

    if col_number_idx == -1 and len(raw_header) > 0: col_number_idx = 0
    if col_name_idx == -1 and len(raw_header) > 1: col_name_idx = 1
    if col_type_idx == -1 and len(raw_header) > 2: col_type_idx = 2

    existing_accounts = db.query(Category).all()
    accounts_by_num = {a.account_number: a for a in existing_accounts if a.account_number}
    accounts_by_name = {a.name.lower().strip(): a for a in existing_accounts}
    
    imported_count = 0
    updated_count = 0
    errors = []

    for row_num, row in enumerate(rows[1:], start=2):
        if not row or not any(row):
            continue
        
        raw_num = row[col_number_idx].strip() if col_number_idx < len(row) and col_number_idx >= 0 else ""
        raw_name = row[col_name_idx].strip() if col_name_idx < len(row) and col_name_idx >= 0 else ""
        raw_type = row[col_type_idx].strip() if col_type_idx < len(row) and col_type_idx >= 0 else ""
        raw_sub = row[col_subtype_idx].strip() if col_subtype_idx < len(row) and col_subtype_idx >= 0 else ""
        raw_desc = row[col_desc_idx].strip() if col_desc_idx < len(row) and col_desc_idx >= 0 else ""
        raw_repair = row[col_repair_idx].strip().lower() if col_repair_idx < len(row) and col_repair_idx >= 0 else ""
        raw_rental = row[col_rental_idx].strip().lower() if col_rental_idx < len(row) and col_rental_idx >= 0 else ""
        raw_active = row[col_active_idx].strip().lower() if col_active_idx < len(row) and col_active_idx >= 0 else ""
        raw_bal = row[col_open_bal_idx].strip() if col_open_bal_idx < len(row) and col_open_bal_idx >= 0 else ""
        raw_bal_dt = row[col_open_dt_idx].strip() if col_open_dt_idx < len(row) and col_open_dt_idx >= 0 else ""

        open_bal_val = 0.0
        if raw_bal:
            try:
                open_bal_val = float(raw_bal.replace("$", "").replace(",", ""))
            except ValueError:
                open_bal_val = 0.0

        if not raw_name:
            errors.append(f"Row {row_num}: Missing account name.")
            continue

        if not raw_type and raw_num:
            inferred_type = infer_account_type_from_number(raw_num)
        else:
            inferred_type = normalize_account_type(raw_type or "OPERATING_EXPENSE")

        if raw_num:
            is_valid, err_msg = validate_account_number(raw_num, inferred_type)
            if not is_valid:
                errors.append(f"Row {row_num} ('{raw_name}'): {err_msg}")
                continue

        is_repair = raw_repair in ["yes", "true", "1", "y"] or ("repair" in raw_name.lower() or "maintenance" in raw_name.lower())
        is_rental = raw_rental in ["yes", "true", "1", "y"] or ("rental income" in raw_name.lower() or "rent income" in raw_name.lower())
        is_active = raw_active not in ["no", "false", "0", "n", "inactive"]

        target_acct = None
        if raw_num and raw_num in accounts_by_num:
            target_acct = accounts_by_num[raw_num]
        elif raw_name.lower() in accounts_by_name:
            target_acct = accounts_by_name[raw_name.lower()]

        if target_acct:
            target_acct.account_number = raw_num or target_acct.account_number
            target_acct.name = raw_name
            target_acct.type = inferred_type
            if raw_sub: target_acct.sub_type = raw_sub
            if raw_desc: target_acct.description = raw_desc
            target_acct.is_repair_category = is_repair
            target_acct.is_rental_income = is_rental
            target_acct.is_active = is_active
            if open_bal_val > 0 and (not target_acct.opening_balance or target_acct.opening_balance == 0):
                target_acct.opening_balance = round(open_bal_val, 2)
                if raw_bal_dt: target_acct.opening_balance_date = raw_bal_dt
                from .journal_engine import record_opening_balance_entry
                record_opening_balance_entry(
                    db=db,
                    account=target_acct,
                    opening_balance=target_acct.opening_balance,
                    opening_date=target_acct.opening_balance_date
                )
            updated_count += 1
        else:
            new_acct = Category(
                account_number=raw_num or None,
                name=raw_name,
                type=inferred_type,
                sub_type=raw_sub or None,
                description=raw_desc or None,
                is_repair_category=is_repair,
                is_rental_income=is_rental,
                is_active=is_active,
                opening_balance=round(open_bal_val, 2) if open_bal_val else 0.0,
                opening_balance_date=raw_bal_dt or None
            )
            db.add(new_acct)
            imported_count += 1
            if raw_num: accounts_by_num[raw_num] = new_acct
            accounts_by_name[raw_name.lower()] = new_acct
            if open_bal_val > 0:
                db.flush()
                from .journal_engine import record_opening_balance_entry
                record_opening_balance_entry(
                    db=db,
                    account=new_acct,
                    opening_balance=new_acct.opening_balance,
                    opening_date=new_acct.opening_balance_date
                )

    db.commit()

    return {
        "success": True,
        "imported_count": imported_count,
        "updated_count": updated_count,
        "errors": errors,
        "message": f"Successfully processed COA import: {imported_count} created, {updated_count} updated." + (f" ({len(errors)} warnings/errors)" if errors else "")
    }


def migrate_coa_10010_to_10100(db: Session) -> bool:
    """
    Safely migrates active company Chart of Accounts from legacy 10010 to standard 10100 series:
    - 10100 Cash on Hand -> 10400 Cash on Hand & Petty Cash
    - 10200 Accounts Receivable -> 10500 Accounts Receivable
    - 10300 Prepaid Insurance -> 10600 Prepaid Insurance & Expenses
    - 10030 Reserve & Savings -> 10300 Reserve & Savings (sub_type='Bank Accounts')
    - 10020 Security Deposit Escrow -> 10200 Security Deposit Escrow (sub_type='Bank Accounts')
    - 10010 Operating Checking -> 10100 Operating Checking (sub_type='Bank Accounts')
    - Sub-accounts of Operating Checking:
      - Inherit sub_type='Bank Accounts'
      - 10011 -> 10110
      - 10012 -> 10120
    """
    changed = False
    
    # 1. Move non-bank assets out of 10100-10300 slots first to prevent collisions
    cash_acct = db.query(Category).filter(
        Category.account_number == "10100",
        Category.name.ilike("%cash%")
    ).first()
    if cash_acct:
        cash_acct.account_number = "10400"
        cash_acct.name = "Cash on Hand & Petty Cash"
        changed = True
        
    ar_acct = db.query(Category).filter(
        Category.account_number == "10200",
        Category.name.ilike("%receivable%")
    ).first()
    if ar_acct:
        ar_acct.account_number = "10500"
        changed = True
        
    prepaid_acct = db.query(Category).filter(
        Category.account_number == "10300",
        Category.name.ilike("%prepaid%")
    ).first()
    if prepaid_acct:
        prepaid_acct.account_number = "10600"
        changed = True

    # 2. Migrate bank accounts
    res_acct = db.query(Category).filter(Category.account_number == "10030").first()
    if res_acct:
        res_acct.account_number = "10300"
        res_acct.sub_type = "Bank Accounts"
        changed = True

    escrow_acct = db.query(Category).filter(Category.account_number == "10020").first()
    if escrow_acct:
        escrow_acct.account_number = "10200"
        escrow_acct.sub_type = "Bank Accounts"
        changed = True

    op_acct = db.query(Category).filter(Category.account_number == "10010").first()
    if op_acct:
        op_acct.account_number = "10100"
        op_acct.sub_type = "Bank Accounts"
        changed = True

    # 3. Migrate sub-accounts of Operating Checking
    target_op = op_acct or db.query(Category).filter(Category.account_number == "10100").first()
    if target_op:
        sub_accts = db.query(Category).filter(Category.parent_account_id == target_op.id).all()
        for s in sub_accts:
            if not s.sub_type or 'bank' not in s.sub_type.lower():
                s.sub_type = "Bank Accounts"
                changed = True
            if s.account_number == "10011":
                s.account_number = "10110"
                changed = True
            elif s.account_number == "10012":
                s.account_number = "10120"
                changed = True

    if changed:
        db.commit()
    return changed


def backfill_standard_account_numbers(db: Session):
    migrate_coa_10010_to_10100(db)
    existing = db.query(Category).all()
    seed_by_name = {s['name'].lower().strip(): s for s in STANDARD_COA_SEED}
    used_numbers = [c.account_number for c in existing if c.account_number]
    
    for cat in existing:
        if not cat.account_number:
            match = seed_by_name.get(cat.name.lower().strip())
            if match and match['account_number'] not in used_numbers:
                cat.account_number = match['account_number']
                if not cat.sub_type: cat.sub_type = match.get('sub_type')
                if not cat.description: cat.description = match.get('description')
                used_numbers.append(cat.account_number)
            else:
                next_num = suggest_next_account_number(cat.type, used_numbers)
                cat.account_number = next_num
                used_numbers.append(next_num)
                
    existing_names = {c.name.lower().strip() for c in existing}
    for s in STANDARD_COA_SEED:
        if s['name'].lower().strip() not in existing_names and s['account_number'] not in used_numbers:
            new_c = Category(
                account_number=s['account_number'],
                name=s['name'],
                type=s['type'],
                sub_type=s.get('sub_type'),
                description=s.get('description'),
                is_repair_category=s.get('is_repair_category', False),
                is_rental_income=s.get('is_rental_income', False),
                is_active=True
            )
            db.add(new_c)
            used_numbers.append(s['account_number'])
            existing_names.add(s['name'].lower().strip())
            
    db.commit()
