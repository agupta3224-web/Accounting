import io
import re
from datetime import datetime
import pandas as pd
from pypdf import PdfReader

HEADER_SYNONYMS = {
    'date': ['date', 'txn_date', 'trans_date', 'transaction_date', 'post_date', 'posting_date', 'effective_date', 'activity_date', 'period', 'date_entered', 'txn_dt'],
    'account': ['account', 'category', 'account_name', 'account_title', 'gl_account', 'chart_of_accounts', 'item', 'charge_type', 'type', 'line_item', 'description_code'],
    'description': ['description', 'memo', 'details', 'notes', 'reference', 'narrative', 'comment', 'payee', 'vendor', 'tenant', 'payer', 'particulars'],
    'amount': ['amount', 'net_amount', 'total', 'net', 'balance_change', 'sum', 'line_total', 'value'],
    'debit': ['debit', 'expense', 'payment', 'charge', 'paid_out', 'withdrawal', 'outflow', 'dr', 'charges'],
    'credit': ['credit', 'income', 'received', 'paid_in', 'deposit', 'inflow', 'cr', 'payments'],
    'property': ['property', 'property_name', 'building', 'address', 'location', 'unit_name', 'premise', 'property_address'],
    'class': ['class', 'segment', 'unit', 'unit_number', 'unit_no', 'department', 'entity', 'tag']
}

def clean_header(header_name: str) -> str:
    if not header_name:
        return ''
    cleaned = re.sub(r'[^a-zA-Z0-9]', '_', str(header_name).strip().lower())
    cleaned = re.sub(r'_+', '_', cleaned).strip('_')
    return cleaned

def parse_currency(val) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val) if not pd.isna(val) else 0.0
    
    s = str(val).strip()
    if not s or s.lower() in ('nan', 'none', 'null', '-', ''):
        return 0.0
    
    is_negative = False
    if s.startswith('(') and s.endswith(')'):
        is_negative = True
        s = s[1:-1]
    elif s.startswith('-') or s.endswith('-'):
        is_negative = True
        s = s.replace('-', '')
    elif s.upper().endswith('DR'):
        is_negative = True
        s = s[:-2]
    elif s.upper().endswith('CR'):
        s = s[:-2]

    s = re.sub(r'[\$,\s]', '', s)
    try:
        amount = float(s)
        return -amount if is_negative else amount
    except ValueError:
        return 0.0

def parse_date_string(val) -> str:
    if val is None or pd.isna(val):
        return datetime.now().strftime('%Y-%m-%d')
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.strftime('%Y-%m-%d')
    
    s = str(val).strip()
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%m/%d/%y', '%d/%m/%Y', '%Y/%m/%d', '%m-%d-%Y', '%B %d, %Y', '%b %d, %Y', '%d %b %Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    match = re.search(r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})', s)
    if match:
        try:
            return pd.to_datetime(match.group(1)).strftime('%Y-%m-%d')
        except Exception:
            pass

    match2 = re.search(r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})', s)
    if match2:
        try:
            return pd.to_datetime(match2.group(1)).strftime('%Y-%m-%d')
        except Exception:
            pass

    return datetime.now().strftime('%Y-%m-%d')

def match_column_role(headers: list) -> dict:
    mappings = {
        'date_col': None,
        'account_col': None,
        'description_col': None,
        'amount_col': None,
        'debit_col': None,
        'credit_col': None,
        'property_col': None,
        'class_col': None
    }
    
    assigned = set()

    for col in headers:
        c_clean = clean_header(col)
        for role, syns in HEADER_SYNONYMS.items():
            key = f'{role}_col'
            if mappings.get(key) is None and (c_clean in syns or any(syn == c_clean for syn in syns)):
                mappings[key] = col
                assigned.add(col)
                break

    for col in headers:
        if col in assigned:
            continue
        c_clean = clean_header(col)
        for role, syns in HEADER_SYNONYMS.items():
            key = f'{role}_col'
            if mappings.get(key) is None and any(syn in c_clean for syn in syns):
                mappings[key] = col
                assigned.add(col)
                break
    
    if not mappings['account_col'] and mappings['description_col']:
        mappings['account_col'] = mappings['description_col']
    elif mappings['account_col'] and not mappings['description_col']:
        mappings['description_col'] = mappings['account_col']

    if not mappings['amount_col'] and not (mappings['debit_col'] or mappings['credit_col']):
        for col in headers:
            if col not in assigned and any(term in col.lower() for term in ['amt', 'val', 'price', 'cost', 'balance', 'total']):
                mappings['amount_col'] = col
                break

    return mappings

def infer_category_and_type(account_str: str, description_str: str = '', raw_amount: float = 0.0) -> tuple:
    combined = f'{account_str} {description_str}'.lower()
    
    income_keywords = [
        'rent', 'rental', 'tenant rent', 'lease', 'late fee', 'parking fee', 
        'laundry', 'pet fee', 'security deposit retained', 'utility reimbursement', 'income',
        'application fee', 'storage', 'forfeited deposit', 'unit rent'
    ]
    repair_keywords = [
        'repair', 'maintenance', 'plumbing', 'electrical', 'hvac', 'handyman', 
        'turnover', 'appliance', 'painting', 'cleaning', 'roof repair', 'pest control',
        'locksmith', 'smoke detector', 'drywall', 'landscaping', 'lawn', 'snow removal',
        'drain', 'leak', 'furnace', 'ac repair', 'water heater', 'contractor'
    ]
    management_keywords = ['management fee', 'property manager', 'commission', 'leasing fee', 'admin fee']
    utility_keywords = ['electric', 'water', 'sewer', 'gas', 'trash', 'utility', 'internet']
    tax_insurance_keywords = ['tax', 'property tax', 'insurance', 'hazard insurance', 'flood insurance', 'county tax']
    mortgage_keywords = ['mortgage', 'loan', 'principal', 'interest', 'escrow', 'debt service']
    capex_keywords = ['capital', 'roof replacement', 'hvac replacement', 'renovation', 'remodel', 'appliance purchase', 'flooring installation']

    is_rental = any(k in combined for k in ['rent', 'rental income', 'lease payment', 'tenant rent', 'unit rent', 'base rent'])
    
    if is_rental and not any(k in combined for k in ['repair', 'fee paid', 'expense', 'bill', 'refund']):
        return 'Rental Income', 'INCOME', True, False
    
    if any(k in combined for k in income_keywords) and not any(k in combined for k in ['repair', 'fee paid', 'expense', 'bill', 'maintenance']):
        return 'Late Fees & Other Income', 'INCOME', False, False
    
    if any(k in combined for k in repair_keywords):
        return 'Repairs & Maintenance', 'OPERATING_EXPENSE', False, True
    
    if any(k in combined for k in management_keywords):
        return 'Property Management Fees', 'OPERATING_EXPENSE', False, False

    if any(k in combined for k in utility_keywords):
        return 'Utilities (Water/Gas/Trash)', 'OPERATING_EXPENSE', False, False

    if any(k in combined for k in tax_insurance_keywords):
        return 'Property Taxes', 'OPERATING_EXPENSE', False, False

    if any(k in combined for k in mortgage_keywords):
        return 'Mortgage Principal & Interest', 'NON_OPERATING_EXPENSE', False, False

    if any(k in combined for k in capex_keywords):
        return 'Capital Improvements (CapEx)', 'CAPEX', False, False

    if raw_amount > 0:
        return 'Other Income', 'INCOME', False, False
    else:
        return 'General Operating Expenses', 'OPERATING_EXPENSE', False, False

def parse_tabular_pdf(file_bytes: bytes) -> tuple:
    reader = PdfReader(io.BytesIO(file_bytes))
    all_lines = []
    for page in reader.pages:
        text = page.extract_text() or ''
        for line in text.split('\n'):
            line = line.strip()
            if line:
                all_lines.append(line)
    
    header_line = None
    data_lines = []
    
    for idx, line in enumerate(all_lines):
        lower_line = line.lower()
        if ('date' in lower_line or 'period' in lower_line) and ('amount' in lower_line or 'total' in lower_line or 'description' in lower_line or 'account' in lower_line or 'debit' in lower_line or 'credit' in lower_line):
            header_line = line
            data_lines = all_lines[idx+1:]
            break
            
    if not header_line and all_lines:
        header_line = 'Date Account Description Amount'
        data_lines = all_lines

    headers = re.split(r'\s{2,}|\t|,|;', header_line)
    if len(headers) < 2:
        headers = header_line.split()

    raw_rows = []
    for line in data_lines:
        if any(skip in line.lower() for skip in ['total', 'ending balance', 'beginning balance', 'page ']):
            continue
        tokens = re.split(r'\s{2,}|\t|,|;', line)
        if len(tokens) < 2:
            tokens = line.split(' ')
        if len(tokens) >= 2:
            raw_rows.append(tokens)

    max_len = max([len(r) for r in raw_rows]) if raw_rows else len(headers)
    while len(headers) < max_len:
        headers.append(f'Column_{len(headers)+1}')
    
    padded_rows = []
    for r in raw_rows:
        row_dict = {}
        for i, col in enumerate(headers):
            row_dict[col] = r[i] if i < len(r) else ''
        padded_rows.append(row_dict)

    df = pd.DataFrame(padded_rows)
    return df, headers

def parse_file_to_preview(file_bytes: bytes, filename: str) -> dict:
    filename_lower = filename.lower()
    df = None
    headers = []

    if filename_lower.endswith('.csv'):
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding='utf-8')
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding='latin1')
            except Exception:
                df = pd.read_csv(io.BytesIO(file_bytes), sep=None, engine='python')
        headers = list(df.columns)
    elif filename_lower.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(io.BytesIO(file_bytes))
        headers = list(df.columns)
    elif filename_lower.endswith('.pdf'):
        df, headers = parse_tabular_pdf(file_bytes)
    else:
        df = pd.read_csv(io.BytesIO(file_bytes))
        headers = list(df.columns)

    df = df.fillna('')
    headers = [str(h).strip() for h in headers]
    
    suggested_mapping = match_column_role(headers)
    preview_rows = df.head(15).to_dict(orient='records')
    
    return {
        'filename': filename,
        'total_rows_detected': len(df),
        'available_columns': headers,
        'suggested_mapping': suggested_mapping,
        'preview_rows': preview_rows
    }

def process_file_with_mapping(file_bytes: bytes, filename: str, column_mapping: dict, default_property_id: int = None, default_class_id: int = None) -> list:
    filename_lower = filename.lower()
    df = None

    if filename_lower.endswith('.csv'):
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding='utf-8')
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding='latin1')
            except Exception:
                df = pd.read_csv(io.BytesIO(file_bytes), sep=None, engine='python')
    elif filename_lower.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(io.BytesIO(file_bytes))
    elif filename_lower.endswith('.pdf'):
        df, _ = parse_tabular_pdf(file_bytes)
    else:
        df = pd.read_csv(io.BytesIO(file_bytes))

    df = df.fillna('')
    
    date_col = column_mapping.get('date_col')
    account_col = column_mapping.get('account_col')
    desc_col = column_mapping.get('description_col')
    amount_col = column_mapping.get('amount_col')
    debit_col = column_mapping.get('debit_col')
    credit_col = column_mapping.get('credit_col')
    prop_col = column_mapping.get('property_col')
    class_col = column_mapping.get('class_col')

    parsed_transactions = []

    for idx, row in df.iterrows():
        raw_date = row.get(date_col) if date_col and date_col in row else None
        date_str = parse_date_string(raw_date)
        month_str = date_str[:7]

        account_val = str(row.get(account_col, '')).strip() if account_col and account_col in row else 'Line Item'
        desc_val = str(row.get(desc_col, '')).strip() if desc_col and desc_col in row else ''
        if not account_val and desc_val:
            account_val = desc_val

        amount = 0.0
        if debit_col and debit_col in row and credit_col and credit_col in row:
            debit_val = parse_currency(row.get(debit_col))
            credit_val = parse_currency(row.get(credit_col))
            if credit_val != 0:
                amount = credit_val
            elif debit_val != 0:
                amount = -debit_val
        elif amount_col and amount_col in row:
            amount = parse_currency(row.get(amount_col))

        if amount == 0.0 and not account_val:
            continue

        row_property = str(row.get(prop_col, '')).strip() if prop_col and prop_col in row else None
        row_class = str(row.get(class_col, '')).strip() if class_col and class_col in row else None

        category_name, category_type, is_rental, is_repair = infer_category_and_type(account_val, desc_val, amount)

        parsed_transactions.append({
            'date': date_str,
            'month': month_str,
            'account_name': account_val,
            'description': desc_val,
            'amount': abs(amount),
            'raw_amount': amount,
            'category_name': category_name,
            'category_type': category_type,
            'is_rental_income': is_rental,
            'is_repair_category': is_repair,
            'property_hint': row_property,
            'class_hint': row_class,
            'property_id': default_property_id,
            'class_id': default_class_id
        })

    return parsed_transactions
