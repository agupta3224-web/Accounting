"""
bank_parser_engine.py

Intelligent Bank Statement Parser and Transaction Classifier.
Supports CSV, Excel (.xlsx), and PDF bank statements from Chase, Wells Fargo,
Bank of America, and generic financial institutions.
"""

import io
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from pypdf import PdfReader
from sqlalchemy.orm import Session

from .models import Category, Vendor, CheckRecord, Property, ClassEntity, BankRule
from .parser_engine import parse_currency, parse_date_string, clean_header


BANK_HEADER_SYNONYMS = {
    'date': ['posting_date', 'transaction_date', 'trans_date', 'post_date', 'activity_date', 'effective_date', 'date_entered', 'txn_date', 'date'],
    'check': ['check_number', 'check_no', 'check_num', 'chk_no', 'chk_num', 'check_or_slip', 'check', 'chk', 'cheque', 'ref_number', 'reference', 'ref_no', 'serial_number'],
    'description': ['description', 'desc', 'transaction_description', 'payee', 'memo', 'name', 'narrative', 'particulars', 'merchant', 'details'],
    'amount': ['amount', 'net_amount', 'total', 'transaction_amount', 'net'],
    'debit': ['debit', 'withdrawal', 'withdrawals', 'payments', 'paid_out', 'outflow', 'expense', 'charges'],
    'credit': ['credit', 'deposit', 'deposits', 'additions', 'paid_in', 'inflow', 'income'],
    'balance': ['balance', 'running_balance', 'ending_balance', 'ledger_balance']
}


def clean_vendor_name(raw_name: str) -> str:
    """
    Cleans bank transaction descriptions into professional vendor names.
    e.g. 'CHECK 1042 JOE\'S PLUMBING - DRAIN' -> "Joe's Plumbing"
    e.g. 'ACH WITHDRAWAL XCEL ENERGY CO 800-555-0199' -> "Xcel Energy"
    e.g. 'T-MOBILE*RECURRING 800-937-8997' -> "T-Mobile"
    e.g. 'MONTHLY SERVICE FEE' -> "Monthly Service Fee"
    e.g. 'ORIG CO NAME:Transamerica ...' -> "Transamerica"
    """
    if not raw_name:
        return 'Unknown Payee'
    
    text = str(raw_name).strip()
    
    # Specific standard banking transaction descriptors
    if re.search(r'(?i)\boverdraft\s+fee\b', text):
        return 'Bank Overdraft Fee'
    if re.search(r'(?i)\bmonthly\s+service\s+fee\b', text):
        return 'Monthly Service Fee'
    if re.search(r'(?i)\bonline\s+transfer\b', text):
        return 'Online Transfer'

    # Extract corporate originator name from ACH descriptors (e.g. Chase ORIG CO NAME:Transamerica)
    m_ach = re.search(r'(?i)ORIG\s+CO\s+NAME:\s*([A-Za-z0-9 &\'\.\-]+?)(?:\s+(?:ORIG\s+ID|DESC\s+DATE|CO\s+ENTRY|SEC:|TRACE#|EED:|IND\s+ID|IND\s+NAME)|$)', text)
    if m_ach:
        text = m_ach.group(1).strip()
    
    # Strip check number prefixes
    text = re.sub(r'(?i)^(?:check|chk|ck)[\s#]*\d+\s*[-:]*\s*', '', text)
    text = re.sub(r'(?i)^#\d+\s*[-:]*\s*', '', text)
    
    # Strip banking prefixes
    prefixes = [
        r'(?i)^ach\s+(?:payment|withdrawal|debit|dir\s+dep|transfer|bill\s+pay)?\s*[-:]*\s*',
        r'(?i)^(?:direct\s+deposit|direct\s+debit|online\s+payment|bill\s+pay|electronic\s+withdrawal|wire\s+transfer)\s*[-:]*\s*',
        r'(?i)^(?:debit\s+card\s+purchase|pos\s+purchase|pos\s+debit|card\s+purchase)\s*[-:]*\s*',
        r'(?i)^(?:mobile\s+deposit|remote\s+deposit|atm\s+deposit|deposit)\s*[-:]*\s*',
        r'(?i)^recurring\s+(?:payment|debit|charge)?\s*[-:]*\s*',
    ]
    for p in prefixes:
        text = re.sub(p, '', text)
        
    # Replace asterisks with spaces (e.g. T-MOBILE*RECURRING -> T-MOBILE RECURRING)
    text = text.replace('*', ' ')

    # Strip descriptors like recurring, autopay, pos, payment
    text = re.sub(r'(?i)\b(?:recurring|autopay|auto-pay|pymt|payment|purchase|bill\s*pay)\b', '', text)

    # Remove terminal store IDs, phone numbers, merchant IDs (e.g. #0452, 800-555-0199, TX 78701)
    text = re.sub(r'#\d+', '', text)
    text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '', text)
    text = re.sub(r'\s+[a-z]{2}\s+\d{5}(?:-\d{4})?', '', text, flags=re.IGNORECASE)
    
    # Strip trailing corporate suffix (e.g. CO, CORP, INC, LLC)
    text = re.sub(r'\s+(?:co|corp|inc|llc|ltd)\.?$', '', text.strip(), flags=re.IGNORECASE)

    # Strip trailing memo hints like '- Unit 101', 'Invoice 4821', etc.
    text = re.sub(r'\s*-\s*(?:unit|inv|acct|po|apt|emergency|spring|monthly).*$', '', text, flags=re.IGNORECASE)

    # Strip trailing numbers / amounts (e.g. "Joe's plumbing 500" or "Joe's plumbing 500.00")
    text = re.sub(r'\s+\$?\d+(?:\.\d{2})?\s*$', '', text)

    # Strip trailing corporate suffix again in case amount was at the end
    text = re.sub(r'\s+(?:co|corp|inc|llc|ltd)\.?$', '', text.strip(), flags=re.IGNORECASE)

    cleaned = ' '.join(text.split()).strip(' -:,#*')
    if not cleaned:
        return 'Unknown Payee'

    # Special well-known brand casing & normalization
    c_lower = cleaned.lower()
    if 'capital one' in c_lower:
        return 'Capital One'
    if 'transamerica ins' in c_lower:
        return 'Transamerica Insurance'
    if 'transamerica' in c_lower:
        return 'Transamerica'
    if 'my property mana' in c_lower:
        return 'My Property Management'
    if 'dividend solar' in c_lower:
        return 'Dividend Solar'
    if 'chase credit crd' in c_lower:
        return 'Chase Credit Card'
    if 'frontier communi' in c_lower or 'frontier' in c_lower:
        return 'Frontier Communications'
    if 't-mobile' in c_lower or 'tmobile' in c_lower:
        return 'T-Mobile'
    if 'verizon' in c_lower:
        return 'Verizon Wireless' if 'wireless' in c_lower else 'Verizon'
    if 'at&t' in c_lower or 'att ' in c_lower or c_lower == 'att':
        return 'AT&T'
    if 'home depot' in c_lower:
        return 'The Home Depot'
    if "lowe's" in c_lower or 'lowes' in c_lower:
        return "Lowe's"
    if 'xcel' in c_lower:
        return 'Xcel Energy'
        
    # Title Case if lowercase or uppercase
    words = cleaned.split(' ')
    title_words = [w.capitalize() if (w.islower() or w.isupper()) else w for w in words]
    cleaned = ' '.join(title_words)
        
    return cleaned


def extract_check_number_from_text(text: str) -> Optional[str]:
    """
    Extracts check number from transaction description or memo text.
    e.g. 'Check 1042 Joe\'s plumbing 500' -> '1042'
    e.g. 'CHK #1043 Ace Hardware' -> '1043'
    """
    if not text:
        return None
        
    s = str(text).strip()
    match = re.search(r'(?i)\b(?:check|chk|ck)[\s#]*(\d{2,8})\b', s)
    if match:
        return match.group(1)
        
    match2 = re.search(r'#(\d{3,8})\b', s)
    if match2:
        return match2.group(1)
        
    return None


def match_bank_columns(headers: List[str]) -> Dict[str, Optional[str]]:
    """
    Detects column roles for a bank statement table.
    Prioritizes exact match based on the order in BANK_HEADER_SYNONYMS,
    then evaluates substring matches (for synonyms of at least 3 characters).
    """
    mappings: Dict[str, Optional[str]] = {
        'date_col': None,
        'check_col': None,
        'description_col': None,
        'amount_col': None,
        'debit_col': None,
        'credit_col': None,
        'balance_col': None
    }
    
    assigned = set()
    
    # Pass 1: exact matches prioritizing synonym order
    for role, syns in BANK_HEADER_SYNONYMS.items():
        key = f'{role}_col'
        for syn in syns:
            for col in headers:
                if col in assigned:
                    continue
                if clean_header(col) == syn:
                    mappings[key] = col
                    assigned.add(col)
                    break
            if mappings[key] is not None:
                break
                
    # Pass 2: substring matches (synonym length >= 3 to prevent collisions like 'cr' in 'description')
    for role, syns in BANK_HEADER_SYNONYMS.items():
        key = f'{role}_col'
        if mappings[key] is not None:
            continue
        for syn in syns:
            if len(syn) < 3:
                continue
            for col in headers:
                if col in assigned:
                    continue
                if syn in clean_header(col):
                    mappings[key] = col
                    assigned.add(col)
                    break
            if mappings[key] is not None:
                break
                
    return mappings


def _format_classification(raw: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
    raw['match_status'] = raw.get('confidence', 'NEEDS_REVIEW')
    acct_num = raw.get('category_account_number')
    if db is not None:
        if not raw.get('category_id') and acct_num:
            cat = db.query(Category).filter(Category.account_number == acct_num).first()
            if cat:
                raw['category_id'] = cat.id
                raw['category_name'] = cat.name
                raw['category_display'] = f"[{acct_num}] {cat.name}"
            else:
                alt_cat = db.query(Category).filter(Category.name.ilike(f"%{raw.get('category_name', '')}%")).first()
                if alt_cat:
                    raw['category_id'] = alt_cat.id
                    raw['category_name'] = alt_cat.name
                    raw['category_display'] = f"[{alt_cat.account_number}] {alt_cat.name}" if alt_cat.account_number else alt_cat.name
                else:
                    raw['suggest_create_account'] = True
                    raw['category_display'] = f"[{acct_num}] {raw.get('category_name')} (New Account)"
        elif raw.get('category_id') and not raw.get('category_display'):
            cat = db.query(Category).filter(Category.id == raw['category_id']).first()
            if cat:
                raw['category_account_number'] = cat.account_number
                raw['category_name'] = cat.name
                raw['category_display'] = f"[{cat.account_number}] {cat.name}" if cat.account_number else cat.name
    return raw


def categorize_bank_transaction(
    payee: str,
    description: str,
    amount: float,
    is_outflow: bool = True,
    db: Optional[Session] = None,
    company_id: Optional[int] = None
) -> Dict[str, Any]:
    res = _categorize_core(
        payee=payee,
        description=description,
        amount=amount,
        is_outflow=is_outflow,
        db=db,
        company_id=company_id
    )
    return _format_classification(res, db)


def _categorize_core(
    payee: str,
    description: str,
    amount: float,
    is_outflow: bool = True,
    db: Optional[Session] = None,
    company_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Intelligently categorizes a bank transaction using:
    1. Saved Bank Rules (bank_rules table)
    2. Known Vendor lookup (vendors table)
    3. Real Estate keyword heuristic rules
    4. Fallback classification with confidence scoring ('RULE_MATCH', 'AUTO_CLASSIFIED', 'NEEDS_REVIEW')
    """
    combined = f"{payee} {description}".lower()
    
    # 1. Match against saved bank_rules in database
    if db is not None:
        try:
            rules_query = db.query(BankRule).filter(BankRule.is_active == True)
            if company_id:
                rules_query = rules_query.filter((BankRule.company_id == company_id) | (BankRule.company_id == None))
            rules = rules_query.all()
            for r in rules:
                if r.match_keyword and r.match_keyword.lower() in combined:
                    target_cat = r.target_category
                    return {
                        'category_id': r.target_category_id,
                        'category_name': target_cat.name if target_cat else 'General Expense',
                        'category_account_number': target_cat.account_number if target_cat else '',
                        'category_type': target_cat.type if target_cat else ('OPERATING_EXPENSE' if is_outflow else 'INCOME'),
                        'vendor_id': r.target_vendor_id,
                        'vendor_name': r.target_vendor_name or (r.target_vendor.name if r.target_vendor else payee),
                        'property_id': r.target_property_id,
                        'class_id': r.target_class_id,
                        'confidence': 'RULE_MATCH',
                        'matched_rule_id': r.id,
                        'matched_rule_name': r.name,
                        'suggest_rule': False
                    }
        except Exception:
            pass

    # 2. Check if payee matches an existing Vendor in vendors table
    matched_vendor_id = None
    if db is not None:
        try:
            clean_p = payee.strip().lower()
            existing_vendors = db.query(Vendor).filter(Vendor.is_active == True).all()
            for v in existing_vendors:
                v_name = v.name.strip().lower()
                if v_name in clean_p or clean_p in v_name:
                    matched_vendor_id = v.id
                    if v.default_category_id:
                        v_cat = v.default_category
                        return {
                            'category_id': v.default_category_id,
                            'category_name': v_cat.name if v_cat else 'Repairs & Maintenance',
                            'category_account_number': v_cat.account_number if v_cat else '60100',
                            'category_type': v_cat.type if v_cat else 'OPERATING_EXPENSE',
                            'vendor_id': v.id,
                            'vendor_name': v.name,
                            'property_id': None,
                            'class_id': None,
                            'confidence': 'AUTO_CLASSIFIED',
                            'matched_rule_id': None,
                            'matched_rule_name': None,
                            'suggest_rule': False
                        }
                    break
        except Exception:
            pass

    # 3. Keyword heuristic rules for standard Real Estate Accounting COA
    # A. Inflow / Deposits -> Rental Income or Fees
    if not is_outflow:
        if any(k in combined for k in ['online transfer', 'acct_xfer', 'bank transfer']):
            return {
                'category_account_number': '10100',
                'category_name': 'Operating Checking (Transfer)',
                'category_type': 'ASSET',
                'vendor_id': matched_vendor_id,
                'vendor_name': payee,
                'confidence': 'AUTO_CLASSIFIED',
                'suggest_rule': True
            }
        if any(k in combined for k in ['late fee', 'late charge', 'pet fee', 'parking', 'storage', 'application fee']):
            return {
                'category_account_number': '40200',
                'category_name': 'Late Charges & Fees',
                'category_type': 'INCOME',
                'vendor_id': matched_vendor_id,
                'vendor_name': payee,
                'confidence': 'AUTO_CLASSIFIED',
                'suggest_rule': True
            }
        elif any(k in combined for k in ['interest', 'int earned', 'bank interest']):
            return {
                'category_account_number': '90100',
                'category_name': 'Interest Income',
                'category_type': 'OTHER_INCOME_EXPENSE',
                'vendor_id': matched_vendor_id,
                'vendor_name': payee,
                'confidence': 'AUTO_CLASSIFIED',
                'suggest_rule': True
            }
        else:
            return {
                'category_account_number': '40100',
                'category_name': 'Rental Income',
                'category_type': 'INCOME',
                'vendor_id': matched_vendor_id,
                'vendor_name': payee,
                'confidence': 'AUTO_CLASSIFIED' if any(k in combined for k in ['rent', 'tenant', 'deposit', 'lease', 'my property mana', 'property manager', 'peak pm', 'anjaleesa']) else 'NEEDS_REVIEW',
                'suggest_rule': True
            }

    # B. Outflow / Checks & Expenses
    # Bank & Merchant Service Fees (e.g. Monthly Service Fee, Overdraft Fee)
    if any(k in combined for k in [
        'service fee', 'monthly service fee', 'overdraft fee', 'bank fee', 'fee_transaction',
        'nsf fee', 'wire fee', 'statement fee', 'maintenance fee', 'atm fee', 'overdraft'
    ]):
        return {
            'category_account_number': '61300',
            'category_name': 'Bank & Merchant Service Fees',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }

    # Credit Card Payments (e.g. Capital One, Chase Credit Card)
    if any(k in combined for k in ['capital one', 'chase credit crd', 'crcardpmt', 'credit card payment', 'credit card autopay']):
        return {
            'category_account_number': '20300',
            'category_name': 'Credit Cards Payable',
            'category_type': 'LIABILITY',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }

    # Online Bank Transfers
    if any(k in combined for k in ['online transfer', 'acct_xfer', 'bank transfer', 'wire transfer']):
        return {
            'category_account_number': '10100',
            'category_name': 'Operating Checking (Transfer)',
            'category_type': 'ASSET',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }

    # Repairs & Plumbing & Maintenance
    if any(k in combined for k in ['plumbing', 'plumber', 'drain', 'pipe', 'faucet', 'sewer snake', 'water heater', 'leak']):
        return {
            'category_account_number': '60100',
            'category_name': 'Repairs & Maintenance',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['repair', 'maintenance', 'hardware', 'home depot', 'lowe\'s', 'lowes', 'ace hardware', 'menards', 'contractor', 'drywall', 'roof repair', 'locksmith', 'handyman']):
        return {
            'category_account_number': '60100',
            'category_name': 'Repairs & Maintenance',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['dividend solar', 'solar', 'electric', 'power', 'xcel', 'duke energy', 'edison', 'gas', 'water', 'sewer', 'trash', 'waste management', 'republic services', 'utility']):
        return {
            'category_account_number': '60500',
            'category_name': 'Utilities (Water/Gas/Trash)',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in [
        't-mobile', 'tmobile', 'verizon', 'at&t', 'att wireless', 'att mob', 'sprint',
        'spectrum', 'comcast', 'xfinity', 'charter', 'centurylink', 'frontier', 'frontier communi', 'cox',
        'telephone', 'cell phone', 'cellular', 'internet', 'wifi', 'broadband', 'telecom', 'phone'
    ]):
        return {
            'category_account_number': '61200',
            'category_name': 'Telephone & Internet',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['transamerica', 'transamerica ins', 'insurance', 'state farm', 'allstate', 'travelers', 'geico', 'liberty mutual', 'hazard insurance', 'flood insurance']):
        return {
            'category_account_number': '60400',
            'category_name': 'Property Insurance',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['tax', 'property tax', 'county treasurer', 'tax collector', 'ad valorem', 'assessor']):
        return {
            'category_account_number': '60300',
            'category_name': 'Property Taxes',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['lawn', 'landscaping', 'tree trimming', 'snow removal', 'mowing', 'grounds']):
        return {
            'category_account_number': '60600',
            'category_name': 'Landscaping & Grounds',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['pest', 'termite', 'orkin', 'terminix', 'exterminator']):
        return {
            'category_account_number': '60900',
            'category_name': 'Pest Control Services',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['mortgage', 'loan payment', 'debt service', 'principal & interest', 'chase mtg', 'wells fargo mtg']):
        return {
            'category_account_number': '90200',
            'category_name': 'Mortgage Principal & Interest',
            'category_type': 'NON_OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['management fee', 'property manager', 'peak pm', 'leasing commission']):
        return {
            'category_account_number': '60200',
            'category_name': 'Property Management Fees',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['legal', 'attorney', 'cpa', 'accounting fee', 'audit']):
        return {
            'category_account_number': '60700',
            'category_name': 'Legal & Professional Fees',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['hoa', 'assessment', 'condo dues', 'association']):
        return {
            'category_account_number': '61000',
            'category_name': 'HOA & Assessment Dues',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }
    if any(k in combined for k in ['license', 'permit', 'registration fee']):
        return {
            'category_account_number': '61100',
            'category_name': 'Licenses & Permits',
            'category_type': 'OPERATING_EXPENSE',
            'vendor_id': matched_vendor_id,
            'vendor_name': payee,
            'confidence': 'AUTO_CLASSIFIED',
            'suggest_rule': True
        }

    # Fallback for ambiguous outflow
    return {
        'category_account_number': '60100',
        'category_name': 'Repairs & Maintenance',
        'category_type': 'OPERATING_EXPENSE',
        'vendor_id': matched_vendor_id,
        'vendor_name': payee,
        'confidence': 'NEEDS_REVIEW',
        'suggest_rule': True
    }


def parse_bank_statement_pdf(
    file_bytes: bytes,
    db: Optional[Session] = None,
    bank_account_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Parses a PDF bank statement (e.g. Wells Fargo, Chase, BofA).
    Extracts text, checks paid lines, deposits, and electronic withdrawals.
    Specifically handles phrases like:
    'Check 1042 Joe\'s plumbing 500' or '04/05/2026 Check 1042 Joe\'s plumbing 500.00'
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    all_lines: List[str] = []
    for page in reader.pages:
        txt = page.extract_text() or ''
        for raw_line in txt.split('\n'):
            line = raw_line.strip()
            if line:
                cleaned_line = line.replace('\ufffd', "'").replace('’', "'").replace('‘', "'")
                all_lines.append(cleaned_line)

    transactions: List[Dict[str, Any]] = []

    # Regex 1: Specific check format e.g. "Check 1042 Joe's plumbing 500" or with optional date
    check_explicit_regex = re.compile(
        r'(?i)(?:(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+)?(?:check|chk|ck)[\s#]*(\d{2,8})\s+([^$\d\n]+?)\s+[\$]?([\d,]+\.?\d*)'
    )
    
    # Regex 2: Standard date-led transaction line:
    # "04/05/2026 Check #1042 Joe's Plumbing 500.00" or "04/12/2026 ACH Xcel Energy 142.50"
    date_line_regex = re.compile(
        r'^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(?:check|chk|ck)?[\s#]*(\d{3,6})?\s*(.*?)\s+[\$]?([\d,]+\.\d{2})(?:\s+[\$]?[\d,]+\.\d{2})?$'
    )

    # Check numerical table: "1042 04/05 500.00 Joe's Plumbing"
    check_table_regex = re.compile(
        r'^(\d{3,6})\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+[\$]?([\d,]+\.\d{2})\s*(.*?)$'
    )

    current_date_default = datetime.now().strftime('%Y-%m-%d')

    for line in all_lines:
        lower = line.lower()
        if any(skip in lower for skip in ['beginning balance', 'ending balance', 'total checks', 'total deposits', 'page ', 'statement period', 'account number']):
            continue

        matched = False

        # Try Check Table format (Check# Date Amount Payee)
        m_tbl = check_table_regex.search(line)
        if m_tbl:
            chk_num, raw_dt, raw_amt, raw_payee = m_tbl.groups()
            date_str = parse_date_string(raw_dt)
            amt = parse_currency(raw_amt)
            payee_clean = clean_vendor_name(raw_payee or f"Check #{chk_num}")
            classification = categorize_bank_transaction(payee_clean, line, amt, is_outflow=True, db=db)
            transactions.append({
                'date': date_str,
                'check_number': chk_num,
                'payee': payee_clean,
                'raw_description': line,
                'amount': amt,
                'is_outflow': True,
                'transaction_type': 'CHECK',
                **classification
            })
            matched = True
            continue

        # Try Check Explicit format
        m_chk = check_explicit_regex.search(line)
        if m_chk:
            raw_dt, chk_num, raw_payee, raw_amt = m_chk.groups()
            date_str = parse_date_string(raw_dt) if raw_dt else current_date_default
            amt = parse_currency(raw_amt)
            payee_clean = clean_vendor_name(raw_payee)
            classification = categorize_bank_transaction(payee_clean, line, amt, is_outflow=True, db=db)
            transactions.append({
                'date': date_str,
                'check_number': chk_num,
                'payee': payee_clean,
                'raw_description': line,
                'amount': amt,
                'is_outflow': True,
                'transaction_type': 'CHECK',
                **classification
            })
            matched = True
            continue

        # Try Date-led transaction line
        m_dt = date_line_regex.search(line)
        if m_dt:
            raw_dt, chk_num, raw_desc, raw_amt = m_dt.groups()
            date_str = parse_date_string(raw_dt)
            amt = parse_currency(raw_amt)
            
            # Determine inflow vs outflow based on keywords
            is_outflow = True
            txn_type = 'DEBIT'
            if chk_num or 'check' in raw_desc.lower() or 'chk' in raw_desc.lower():
                txn_type = 'CHECK'
            elif any(k in raw_desc.lower() for k in ['deposit', 'tenant rent', 'credit', 'interest']):
                is_outflow = False
                txn_type = 'DEPOSIT'

            payee_clean = clean_vendor_name(raw_desc)
            if not chk_num:
                chk_num = extract_check_number_from_text(raw_desc)
                if chk_num:
                    txn_type = 'CHECK'

            classification = categorize_bank_transaction(payee_clean, raw_desc, amt, is_outflow=is_outflow, db=db)
            transactions.append({
                'date': date_str,
                'check_number': chk_num,
                'payee': payee_clean,
                'raw_description': raw_desc,
                'amount': amt,
                'is_outflow': is_outflow,
                'transaction_type': txn_type,
                **classification
            })
            matched = True

    return transactions


def parse_csv_raw_preview(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Parses raw CSV bytes and returns:
    - filename
    - total_rows
    - raw_headers: list of column names
    - sample_values_by_column: dict with sample values for each column
    - suggested_mapping: { date_col, description_col, check_col, amount_col, debit_col, credit_col }
    - raw_rows: first 25 rows as dicts for visual table display
    """
    df = None
    for enc in ['utf-8', 'utf-8-sig', 'latin1', 'cp1252', 'iso-8859-1']:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding=enc, sep=None, engine='python', index_col=False)
            if df is not None and len(df.columns) >= 1:
                break
        except Exception:
            continue
            
    if df is None:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding='utf-8', index_col=False)
        except Exception:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding='latin1', index_col=False)

    df = df.fillna('')
    # Filter out empty Unnamed columns if any
    headers = [str(h).strip() for h in df.columns if not str(h).startswith('Unnamed:')]
    if not headers:
        headers = [str(h).strip() for h in df.columns]
    mapping = match_bank_columns(headers)
    
    sample_values: Dict[str, List[str]] = {}
    for col in headers:
        samples = []
        for val in df[col]:
            s_val = str(val).strip()
            if s_val and s_val not in samples and s_val.lower() != 'nan':
                samples.append(s_val)
            if len(samples) >= 3:
                break
        sample_values[col] = samples

    date_col = mapping.get('date_col')
    desc_col = mapping.get('description_col')
    amt_col = mapping.get('amount_col')
    chk_col = mapping.get('check_col')

    raw_rows_raw = df.head(30).to_dict(orient='records')
    raw_rows = []
    parsed_preview_txns = []

    for rIdx, r in enumerate(raw_rows_raw):
        cleaned_r = {str(k): ('' if pd.isna(v) or str(v).lower() == 'nan' else str(v)) for k, v in r.items()}
        raw_rows.append(cleaned_r)

        # Build parsed representation for row-by-row inspection
        p_date = parse_date_string(cleaned_r.get(date_col)) if date_col else ''
        p_desc = str(cleaned_r.get(desc_col, '')).strip() if desc_col else ''
        p_chk = extract_check_number_from_text(p_desc) if not chk_col else str(cleaned_r.get(chk_col, '')).strip()
        p_amt_raw = parse_currency(cleaned_r.get(amt_col)) if amt_col else 0.0
        
        # Determine outflow
        p_outflow = p_amt_raw < 0
        for dir_col in ['Details', 'details', 'Type', 'type', 'Transaction Type']:
            if dir_col in cleaned_r and cleaned_r[dir_col]:
                dv = cleaned_r[dir_col].strip().upper()
                if dv in ['CREDIT', 'CR', 'DEPOSIT', 'ACH_CREDIT']:
                    p_outflow = False
                    break
                elif dv in ['DEBIT', 'DR', 'CHECK', 'WITHDRAWAL', 'ACH_DEBIT', 'FEE_TRANSACTION']:
                    p_outflow = True
                    break

        p_amt = abs(p_amt_raw)
        p_payee = clean_vendor_name(p_desc)
        p_cat = categorize_bank_transaction(p_payee, p_desc, p_amt, p_outflow)
        
        parsed_preview_txns.append({
            'row_index': rIdx,
            'date': p_date or datetime.now().strftime('%Y-%m-%d'),
            'payee': p_payee,
            'raw_description': p_desc,
            'check_number': p_chk,
            'amount': p_amt,
            'is_outflow': p_outflow,
            'transaction_type': 'CHECK' if p_chk else ('DEBIT' if p_outflow else 'DEPOSIT'),
            'category_account_number': p_cat.get('category_account_number'),
            'category_name': p_cat.get('category_name'),
            'category_display': p_cat.get('category_display'),
            'match_status': p_cat.get('match_status', 'AUTO_CLASSIFIED')
        })

    return {
        'filename': filename,
        'file_type': 'CSV',
        'total_rows': len(df),
        'raw_headers': headers,
        'sample_values_by_column': sample_values,
        'suggested_mapping': mapping,
        'raw_rows': raw_rows,
        'parsed_preview_transactions': parsed_preview_txns
    }


def parse_bank_statement_file(
    file_bytes: bytes,
    filename: str,
    column_mapping: Optional[Dict[str, Optional[str]]] = None,
    bank_account_id: Optional[int] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Unified entry point for parsing bank statements (CSV, XLSX, PDF).
    Returns preview summary, suggested mapping, and parsed classified transactions.
    """
    fn_lower = filename.lower()
    is_pdf = fn_lower.endswith('.pdf')
    
    if is_pdf:
        # PDF parsing
        parsed_txns = parse_bank_statement_pdf(file_bytes, db=db, bank_account_id=bank_account_id)
        
        # Resolve category objects if DB is available
        if db is not None:
            cat_map = {c.account_number: c for c in db.query(Category).all() if c.account_number}
            for t in parsed_txns:
                acct_num = t.get('category_account_number')
                if acct_num and acct_num in cat_map:
                    t['category_id'] = cat_map[acct_num].id
                    t['category_display'] = f"[{acct_num}] {cat_map[acct_num].name}"
                elif not t.get('category_id'):
                    # Fallback to general expense
                    def_cat = db.query(Category).filter(Category.type == 'OPERATING_EXPENSE').first()
                    if def_cat:
                        t['category_id'] = def_cat.id
                        t['category_display'] = f"[{def_cat.account_number}] {def_cat.name}"

        return {
            'filename': filename,
            'file_type': 'PDF',
            'total_rows_detected': len(parsed_txns),
            'available_columns': ['Date', 'Check Number', 'Payee / Description', 'Amount', 'Type'],
            'suggested_mapping': {},
            'transactions': parsed_txns,
            'preview_rows': [
                {
                    'Date': t['date'],
                    'Check #': t.get('check_number') or '',
                    'Payee / Description': t['payee'],
                    'Amount': f"${t['amount']:,.2f}",
                    'Type': t.get('transaction_type')
                } for t in parsed_txns[:15]
            ]
        }

    # CSV / Excel Parsing
    df = None
    if fn_lower.endswith('.csv'):
        for enc in ['utf-8', 'utf-8-sig', 'latin1', 'cp1252', 'iso-8859-1']:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding=enc, sep=None, engine='python', index_col=False)
                if df is not None and len(df.columns) >= 1:
                    break
            except Exception:
                continue
        if df is None:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding='utf-8', index_col=False)
            except Exception:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding='latin1', index_col=False)
    elif fn_lower.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        df = pd.read_csv(io.BytesIO(file_bytes), index_col=False)

    df = df.fillna('')
    # Filter out empty Unnamed columns if any
    headers = [str(h).strip() for h in df.columns if not str(h).startswith('Unnamed:')]
    if not headers:
        headers = [str(h).strip() for h in df.columns]
    mapping = column_mapping or match_bank_columns(headers)

    date_col = mapping.get('date_col')
    check_col = mapping.get('check_col') or mapping.get('check_number_col')
    desc_col = mapping.get('description_col')
    amt_col = mapping.get('amount_col')
    debit_col = mapping.get('debit_col')
    credit_col = mapping.get('credit_col')
    amount_mode = mapping.get('amount_mode', 'negative_outflow')

    parsed_txns: List[Dict[str, Any]] = []

    cat_map = {}
    if db is not None:
        cat_map = {c.account_number: c for c in db.query(Category).all() if c.account_number}

    for _, row in df.iterrows():
        # 1. Parse Date - strictly from date_col
        raw_date = row.get(date_col) if date_col and date_col in row else None
        date_str = parse_date_string(raw_date)

        # 2. Parse Description - strictly from desc_col (NEVER use date_col)
        if desc_col and desc_col in row:
            raw_desc = str(row.get(desc_col, '')).strip()
        else:
            candidates = [c for c in headers if c not in [date_col, check_col, amt_col, debit_col, credit_col]]
            raw_desc = str(row.get(candidates[0], '')).strip() if candidates else ''

        # 3. Parse Check Number
        raw_chk = str(row.get(check_col, '')).strip() if check_col and check_col in row else ''
        raw_chk = re.sub(r'\.0$', '', raw_chk)
        chk_num = re.sub(r'[^\d]', '', raw_chk) if raw_chk else extract_check_number_from_text(raw_desc)

        # 4. Parse Amount and Direction
        amount = 0.0
        is_outflow = True
        
        if debit_col and debit_col in row and credit_col and credit_col in row:
            deb = parse_currency(row.get(debit_col))
            cred = parse_currency(row.get(credit_col))
            if cred > 0:
                amount = cred
                is_outflow = False
            elif deb > 0:
                amount = deb
                is_outflow = True
        elif amt_col and amt_col in row:
            raw_amt = parse_currency(row.get(amt_col))
            if amount_mode == 'positive_outflow':
                # Positive is outflow/check, negative is credit/deposit
                if raw_amt < 0:
                    amount = abs(raw_amt)
                    is_outflow = False
                else:
                    amount = raw_amt
                    is_outflow = True
            else:
                # Default negative_outflow: negative is outflow/expense, positive is deposit
                if raw_amt < 0:
                    amount = abs(raw_amt)
                    is_outflow = True
                else:
                    amount = raw_amt
                    if chk_num or any(k in raw_desc.lower() for k in ['check', 'chk', 'debit', 'fee', 'charge', 'withdrawal', 'ach payment']):
                        is_outflow = True
                    else:
                        is_outflow = False

        # Check explicit transaction direction column (e.g. Chase 'Details' or 'Type')
        for dir_col in ['Details', 'details', 'Type', 'type', 'Transaction Type', 'trans_type']:
            if dir_col in row and str(row.get(dir_col, '')).strip():
                dir_val = str(row.get(dir_col, '')).strip().upper()
                if dir_val in ['CREDIT', 'CR', 'DEPOSIT', 'ACH_CREDIT']:
                    is_outflow = False
                    break
                elif dir_val in ['DEBIT', 'DR', 'CHECK', 'WITHDRAWAL', 'ACH_DEBIT', 'FEE_TRANSACTION']:
                    is_outflow = True
                    break

        if amount == 0.0 and not raw_desc:
            continue

        payee_clean = clean_vendor_name(raw_desc)
        txn_type = 'CHECK' if chk_num else ('DEBIT' if is_outflow else 'DEPOSIT')

        classification = categorize_bank_transaction(
            payee=payee_clean,
            description=raw_desc,
            amount=amount,
            is_outflow=is_outflow,
            db=db
        )

        # Resolve category ID and display
        acct_num = classification.get('category_account_number')
        if acct_num and acct_num in cat_map:
            classification['category_id'] = cat_map[acct_num].id
            classification['category_display'] = f"[{acct_num}] {cat_map[acct_num].name}"
        elif not classification.get('category_id') and db is not None:
            def_type = 'OPERATING_EXPENSE' if is_outflow else 'INCOME'
            fallback_cat = db.query(Category).filter(Category.type == def_type).first()
            if fallback_cat:
                classification['category_id'] = fallback_cat.id
                classification['category_display'] = f"[{fallback_cat.account_number}] {fallback_cat.name}"

        parsed_txns.append({
            'date': date_str,
            'check_number': chk_num,
            'payee': payee_clean,
            'raw_description': raw_desc,
            'amount': amount,
            'is_outflow': is_outflow,
            'transaction_type': txn_type,
            **classification
        })

    return {
        'filename': filename,
        'file_type': 'CSV',
        'total_rows_detected': len(parsed_txns),
        'available_columns': headers,
        'suggested_mapping': mapping,
        'transactions': parsed_txns,
        'preview_rows': df.head(15).to_dict(orient='records')
    }
