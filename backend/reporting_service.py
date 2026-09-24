from sqlalchemy.orm import Session
from sqlalchemy import or_
from .models import Transaction, Property, ClassEntity, Company, Category, CheckRecord, JournalEntry
from collections import defaultdict
import datetime
import calendar
from typing import Optional, Dict, Any, List

def compute_period_bounds(
    preset: str = 'MONTHLY',
    year: Optional[int] = None,
    month: Optional[str] = None,
    quarter: Optional[int] = None,
    half: Optional[int] = None,
    fiscal_start_month: int = 1,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    compare_prior: bool = True
) -> Dict[str, Any]:
    """
    Computes exact start_date, end_date, prior_start_date, prior_end_date,
    along with human-readable period labels for all reporting presets.
    Presets: MONTHLY, QUARTERLY, SIX_MONTH, ANNUAL, YTD, FISCAL_YEAR, CUSTOM.
    """
    today = datetime.date.today()
    preset_upper = (preset or 'MONTHLY').upper().strip()

    # Convert month to string if passed as int or str
    month_str = str(month).strip() if month is not None else None

    # Determine default year
    if not year:
        if month_str and len(month_str) >= 4 and month_str[:4].isdigit():
            target_year = int(month_str[:4])
        else:
            target_year = today.year
    else:
        target_year = int(year)

    if preset_upper == 'MONTHLY':
        # Target month string: e.g. "2026-03" or "3"
        if month_str and '-' in month_str:
            parts = month_str.split('-')
            target_year = int(parts[0])
            m_num = int(parts[1])
        elif month_str and month_str.isdigit():
            m_num = int(month_str)
        else:
            m_num = today.month

        m_num = max(1, min(12, m_num))
        _, last_day = calendar.monthrange(target_year, m_num)
        start_date = f"{target_year:04d}-{m_num:02d}-01"
        end_date = f"{target_year:04d}-{m_num:02d}-{last_day:02d}"

        # Prior month
        if m_num == 1:
            p_year = target_year - 1
            p_month = 12
        else:
            p_year = target_year
            p_month = m_num - 1
        _, p_last_day = calendar.monthrange(p_year, p_month)
        prior_start_date = f"{p_year:04d}-{p_month:02d}-01"
        prior_end_date = f"{p_year:04d}-{p_month:02d}-{p_last_day:02d}"

        month_name = calendar.month_name[m_num]
        p_month_name = calendar.month_name[p_month]
        period_label = f"{month_name} {target_year}"
        prior_period_label = f"{p_month_name} {p_year}"

    elif preset_upper == 'QUARTERLY':
        q = int(quarter) if quarter in [1, 2, 3, 4] else ((today.month - 1) // 3 + 1)
        if q == 1:
            start_date = f"{target_year:04d}-01-01"
            end_date = f"{target_year:04d}-03-31"
            prior_start_date = f"{target_year-1:04d}-10-01"
            prior_end_date = f"{target_year-1:04d}-12-31"
            prior_period_label = f"Q4 {target_year-1}"
        elif q == 2:
            start_date = f"{target_year:04d}-04-01"
            end_date = f"{target_year:04d}-06-30"
            prior_start_date = f"{target_year:04d}-01-01"
            prior_end_date = f"{target_year:04d}-03-31"
            prior_period_label = f"Q1 {target_year}"
        elif q == 3:
            start_date = f"{target_year:04d}-07-01"
            end_date = f"{target_year:04d}-09-30"
            prior_start_date = f"{target_year:04d}-04-01"
            prior_end_date = f"{target_year:04d}-06-30"
            prior_period_label = f"Q2 {target_year}"
        else: # Q4
            start_date = f"{target_year:04d}-10-01"
            end_date = f"{target_year:04d}-12-31"
            prior_start_date = f"{target_year:04d}-07-01"
            prior_end_date = f"{target_year:04d}-09-30"
            prior_period_label = f"Q3 {target_year}"

        period_label = f"Q{q} {target_year}"

    elif preset_upper == 'SIX_MONTH':
        h = int(half) if half in [1, 2] else (1 if today.month <= 6 else 2)
        if h == 1:
            start_date = f"{target_year:04d}-01-01"
            end_date = f"{target_year:04d}-06-30"
            prior_start_date = f"{target_year-1:04d}-07-01"
            prior_end_date = f"{target_year-1:04d}-12-31"
            prior_period_label = f"H2 {target_year-1} (Jul - Dec)"
            period_label = f"H1 {target_year} (Jan - Jun)"
        else:
            start_date = f"{target_year:04d}-07-01"
            end_date = f"{target_year:04d}-12-31"
            prior_start_date = f"{target_year:04d}-01-01"
            prior_end_date = f"{target_year:04d}-06-30"
            prior_period_label = f"H1 {target_year} (Jan - Jun)"
            period_label = f"H2 {target_year} (Jul - Dec)"

    elif preset_upper == 'ANNUAL':
        start_date = f"{target_year:04d}-01-01"
        end_date = f"{target_year:04d}-12-31"
        prior_start_date = f"{target_year-1:04d}-01-01"
        prior_end_date = f"{target_year-1:04d}-12-31"
        period_label = f"Annual {target_year}"
        prior_period_label = f"Annual {target_year-1}"

    elif preset_upper == 'YTD':
        start_date = f"{target_year:04d}-01-01"
        if to_date:
            end_date = to_date
        elif target_year == today.year:
            end_date = today.isoformat()
        else:
            end_date = f"{target_year:04d}-12-31"

        # Prior period: same day span in previous year
        prior_start_date = f"{target_year-1:04d}-01-01"
        try:
            cur_end_dt = datetime.date.fromisoformat(end_date)
            # handle leap day
            if cur_end_dt.month == 2 and cur_end_dt.day == 29:
                p_end_dt = datetime.date(target_year-1, 2, 28)
            else:
                p_end_dt = datetime.date(target_year-1, cur_end_dt.month, cur_end_dt.day)
            prior_end_date = p_end_dt.isoformat()
        except Exception:
            prior_end_date = f"{target_year-1:04d}-12-31"

        period_label = f"YTD {target_year} (Jan 01 - {end_date})"
        prior_period_label = f"Prior YTD {target_year-1} (Jan 01 - {prior_end_date})"

    elif preset_upper == 'FISCAL_YEAR':
        f_start_month = max(1, min(12, int(fiscal_start_month or 1)))
        if f_start_month == 1:
            # Calendar year fiscal
            start_date = f"{target_year:04d}-01-01"
            end_date = f"{target_year:04d}-12-31"
            prior_start_date = f"{target_year-1:04d}-01-01"
            prior_end_date = f"{target_year-1:04d}-12-31"
            period_label = f"FY {target_year} (Jan - Dec)"
            prior_period_label = f"FY {target_year-1} (Jan - Dec)"
        else:
            # E.g. July start (f_start_month=7): FY 2026 runs 2025-07-01 to 2026-06-30
            start_year = target_year - 1
            end_year = target_year
            end_month = f_start_month - 1
            _, last_d = calendar.monthrange(end_year, end_month)
            start_date = f"{start_year:04d}-{f_start_month:02d}-01"
            end_date = f"{end_year:04d}-{end_month:02d}-{last_d:02d}"

            # Prior fiscal year
            p_start_year = start_year - 1
            p_end_year = end_year - 1
            _, p_last_d = calendar.monthrange(p_end_year, end_month)
            prior_start_date = f"{p_start_year:04d}-{f_start_month:02d}-01"
            prior_end_date = f"{p_end_year:04d}-{end_month:02d}-{p_last_d:02d}"

            s_month_name = calendar.month_abbr[f_start_month]
            e_month_name = calendar.month_abbr[end_month]
            period_label = f"FY {target_year} ({s_month_name} {start_year} - {e_month_name} {end_year})"
            prior_period_label = f"FY {target_year-1} ({s_month_name} {p_start_year} - {e_month_name} {p_end_year})"

    elif preset_upper == 'CUSTOM':
        # Custom specific dates
        start_date = from_date if from_date else f"{target_year:04d}-01-01"
        end_date = to_date if to_date else today.isoformat()

        try:
            s_dt = datetime.date.fromisoformat(start_date)
            e_dt = datetime.date.fromisoformat(end_date)
            span_days = max(1, (e_dt - s_dt).days + 1)
            p_end_dt = s_dt - datetime.timedelta(days=1)
            p_start_dt = p_end_dt - datetime.timedelta(days=span_days - 1)
            prior_start_date = p_start_dt.isoformat()
            prior_end_date = p_end_dt.isoformat()
        except Exception:
            prior_start_date = start_date
            prior_end_date = end_date

        period_label = f"Custom ({start_date} to {end_date})"
        prior_period_label = f"Prior Period ({prior_start_date} to {prior_end_date})"

    else:
        # Fallback default
        start_date = f"{target_year:04d}-01-01"
        end_date = f"{target_year:04d}-12-31"
        prior_start_date = f"{target_year-1:04d}-01-01"
        prior_end_date = f"{target_year-1:04d}-12-31"
        period_label = f"{preset_upper} {target_year}"
        prior_period_label = f"Prior {target_year-1}"

    return {
        'preset': preset_upper,
        'start_date': start_date,
        'end_date': end_date,
        'prior_start_date': prior_start_date,
        'prior_end_date': prior_end_date,
        'period_label': period_label,
        'prior_period_label': prior_period_label,
        'compare_prior': bool(compare_prior)
    }


def _consolidate_transactions_into_categories(
    current_txns: List[Transaction],
    prior_txns: List[Transaction],
    category_map: Dict[int, Category],
    filter_func
) -> Dict[str, Any]:
    """
    Groups transactions by category into single consolidated line items.
    Combines all transactions belonging to the same category into EXACTLY ONE row.
    Computes current_amount, prior_amount, change_amount, change_percent, and transaction_count.
    """
    curr_filtered = [t for t in current_txns if filter_func(t)]
    prior_filtered = [t for t in prior_txns if filter_func(t)]

    # Map category names for case-insensitive lookup
    cat_name_map = {c.name.lower().strip(): c for c in category_map.values()}

    def get_canonical_key(t: Transaction):
        if t.category_id and t.category_id in category_map:
            return ('CAT', t.category_id)
        acc = (t.account_name or '').strip()
        matched = cat_name_map.get(acc.lower())
        if matched:
            return ('CAT', matched.id)
        return ('NAME', acc or 'Uncategorized')

    grouped_curr = defaultdict(list)
    for t in curr_filtered:
        grouped_curr[get_canonical_key(t)].append(t)

    grouped_prior = defaultdict(list)
    for t in prior_filtered:
        grouped_prior[get_canonical_key(t)].append(t)

    all_keys = set(grouped_curr.keys()).union(set(grouped_prior.keys()))

    items = []
    total_curr = 0.0
    total_prior = 0.0

    for key_type, key_val in all_keys:
        c_list = grouped_curr.get((key_type, key_val), [])
        p_list = grouped_prior.get((key_type, key_val), [])

        c_sum = sum(t.amount for t in c_list)
        p_sum = sum(t.amount for t in p_list)

        total_curr += c_sum
        total_prior += p_sum

        if key_type == 'CAT':
            cat_obj = category_map.get(key_val)
            cat_id = cat_obj.id if cat_obj else key_val
            acc_num = cat_obj.account_number if cat_obj and cat_obj.account_number else ''
            name_clean = cat_obj.name if cat_obj else 'General'
            cat_type = cat_obj.type if cat_obj else 'OPERATING_EXPENSE'
            is_repair = (cat_obj.is_repair_category if cat_obj else False) or 'repair' in name_clean.lower() or 'maintenance' in name_clean.lower()
            is_rent = (cat_obj.is_rental_income if cat_obj else False) or 'rental income' in name_clean.lower() or 'rent' in name_clean.lower()
        else:
            cat_obj = None
            cat_id = None
            acc_num = ''
            name_clean = key_val
            cat_type = c_list[0].category_type if c_list else (p_list[0].category_type if p_list else 'OPERATING_EXPENSE')
            is_repair = 'repair' in name_clean.lower() or 'maintenance' in name_clean.lower()
            is_rent = 'rental income' in name_clean.lower() or 'rent' in name_clean.lower()

        display_name = f"[{acc_num}] {name_clean}" if acc_num else name_clean

        diff_amt = c_sum - p_sum
        if p_sum > 0:
            diff_pct = round((diff_amt / p_sum) * 100.0, 2)
        elif c_sum > 0:
            diff_pct = 100.0
        else:
            diff_pct = 0.0

        items.append({
            'category_id': cat_id,
            'account_number': acc_num,
            'account_name': name_clean,
            'display_name': display_name,
            'category_type': cat_type,
            'is_repair': is_repair,
            'is_rental_income': is_rent,
            'current_amount': round(c_sum, 2),
            'prior_amount': round(p_sum, 2),
            'change_amount': round(diff_amt, 2),
            'change_percent': diff_pct,
            'transaction_count': len(c_list)
        })

    # Sort items: by account number if available, otherwise by current amount desc
    items.sort(key=lambda x: (x['account_number'] == '', x['account_number'], -x['current_amount'], x['account_name']))

    diff_total = total_curr - total_prior
    diff_total_pct = round((diff_total / total_prior) * 100.0, 2) if total_prior > 0 else (100.0 if total_curr > 0 else 0.0)

    return {
        'items': items,
        'total_current': round(total_curr, 2),
        'total_prior': round(total_prior, 2),
        'total_change': round(diff_total, 2),
        'total_change_percent': diff_total_pct
    }


def generate_concise_pnl_report(
    db: Session,
    company_id: Optional[int] = None,
    class_id: Optional[int] = None,
    property_id: Optional[int] = None,
    preset: str = 'MONTHLY',
    year: Optional[int] = None,
    month: Optional[str] = None,
    quarter: Optional[int] = None,
    half: Optional[int] = None,
    fiscal_start_month: int = 1,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    compare_prior: bool = True
) -> Dict[str, Any]:
    """
    Generates a concise Profit & Loss Statement where expenses and revenues
    for each category are combined into single, clear line items.
    Includes comprehensive date range presets and side-by-side prior period comparisons.
    """
    bounds = compute_period_bounds(
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

    # Base Query Builder
    def build_query(start_d: str, end_d: str):
        q = db.query(Transaction).filter(Transaction.date >= start_d, Transaction.date <= end_d)
        if property_id:
            q = q.filter(Transaction.property_id == property_id)
        elif class_id:
            q = q.filter(Transaction.class_id == class_id)
        elif company_id:
            class_ids = [c.id for c in db.query(ClassEntity).filter(ClassEntity.company_id == company_id).all()]
            q = q.filter(Transaction.class_id.in_(class_ids))
        return q.order_by(Transaction.date.asc()).all()

    current_txns = build_query(bounds['start_date'], bounds['end_date'])
    prior_txns = build_query(bounds['prior_start_date'], bounds['prior_end_date']) if bounds['compare_prior'] else []

    # Map categories
    all_categories = db.query(Category).all()
    category_map = {c.id: c for c in all_categories}

    # Group transactions by property
    props_query = db.query(Property)
    if property_id:
        props_query = props_query.filter(Property.id == property_id)
    elif class_id:
        props_query = props_query.filter(Property.class_id == class_id)
    elif company_id:
        class_ids = [c.id for c in db.query(ClassEntity).filter(ClassEntity.company_id == company_id).all()]
        props_query = props_query.filter(Property.class_id.in_(class_ids))

    all_props = props_query.all()
    prop_by_id = {p.id: p for p in all_props}

    # Group current and prior by property
    curr_by_prop = defaultdict(list)
    for t in current_txns:
        curr_by_prop[t.property_id].append(t)

    prior_by_prop = defaultdict(list)
    for t in prior_txns:
        prior_by_prop[t.property_id].append(t)

    # If no properties matched in filter, gather from transactions
    relevant_prop_ids = set(prop_by_id.keys()).union(set(curr_by_prop.keys())).union(set(prior_by_prop.keys()))
    if not relevant_prop_ids and not property_id and not class_id and not company_id:
        relevant_prop_ids = set(prop_by_id.keys())

    # Build Property Reports
    properties_reports = []

    portfolio_rental_curr = 0.0
    portfolio_rental_prior = 0.0
    portfolio_gross_curr = 0.0
    portfolio_gross_prior = 0.0
    portfolio_opex_curr = 0.0
    portfolio_opex_prior = 0.0
    portfolio_repairs_curr = 0.0
    portfolio_repairs_prior = 0.0
    portfolio_noi_curr = 0.0
    portfolio_noi_prior = 0.0
    portfolio_net_cash_curr = 0.0
    portfolio_net_cash_prior = 0.0

    # Helper filter functions
    def is_rental_income(t: Transaction) -> bool:
        cat = category_map.get(t.category_id)
        if cat and cat.is_rental_income:
            return True
        if t.category_type in ['INCOME', 'REVENUE']:
            acc_l = (t.account_name or '').lower()
            return t.is_aggregated or 'rental income' in acc_l or 'rent' in acc_l
        return False

    def is_other_income(t: Transaction) -> bool:
        if t.category_type in ['INCOME', 'REVENUE']:
            return not is_rental_income(t)
        return False

    def is_operating_expense(t: Transaction) -> bool:
        return t.category_type == 'OPERATING_EXPENSE'

    def is_non_operating(t: Transaction) -> bool:
        return t.category_type in ['NON_OPERATING_EXPENSE', 'CAPEX', 'OTHER_INCOME_EXPENSE']

    sorted_prop_ids = sorted(list(relevant_prop_ids), key=lambda pid: (prop_by_id.get(pid).name if prop_by_id.get(pid) else 'Z'))

    for pid in sorted_prop_ids:
        p_obj = prop_by_id.get(pid)
        p_name = p_obj.name if p_obj else f"Property #{pid}"
        c_name = p_obj.class_entity.name if p_obj and p_obj.class_entity else "General LLC"
        comp_name = p_obj.class_entity.company.name if p_obj and p_obj.class_entity and p_obj.class_entity.company else "Holding Co."
        addr = p_obj.formatted_address() if p_obj else ""
        p_type = p_obj.property_type if p_obj else "Residential"
        units = p_obj.units_count if p_obj else 1

        p_curr_txns = curr_by_prop.get(pid, [])
        p_prior_txns = prior_by_prop.get(pid, [])

        # 1. Rental Income (Explicit Top Section)
        rental_sec = _consolidate_transactions_into_categories(p_curr_txns, p_prior_txns, category_map, is_rental_income)

        # 2. Other Operating Income
        other_inc_sec = _consolidate_transactions_into_categories(p_curr_txns, p_prior_txns, category_map, is_other_income)

        # Total Gross Income
        gross_curr = round(rental_sec['total_current'] + other_inc_sec['total_current'], 2)
        gross_prior = round(rental_sec['total_prior'] + other_inc_sec['total_prior'], 2)
        gross_change = round(gross_curr - gross_prior, 2)
        gross_change_pct = round((gross_change / gross_prior) * 100.0, 2) if gross_prior > 0 else (100.0 if gross_curr > 0 else 0.0)

        # 3. Operating Expenses Breakdown (Consolidated Category Lines, BOLD Total)
        opex_sec = _consolidate_transactions_into_categories(p_curr_txns, p_prior_txns, category_map, is_operating_expense)

        # Dedicated Repair % Calculation
        repairs_curr = sum(item['current_amount'] for item in opex_sec['items'] if item['is_repair'])
        repairs_prior = sum(item['prior_amount'] for item in opex_sec['items'] if item['is_repair'])

        repair_pct_curr = round((repairs_curr / rental_sec['total_current']) * 100.0, 2) if rental_sec['total_current'] > 0 else 0.0
        repair_pct_prior = round((repairs_prior / rental_sec['total_prior']) * 100.0, 2) if rental_sec['total_prior'] > 0 else 0.0

        repair_health = 'GOOD'
        if repair_pct_curr > 25.0:
            repair_health = 'HIGH'
        elif repair_pct_curr >= 10.0:
            repair_health = 'MODERATE'

        # Net Operating Income (NOI)
        noi_curr = round(gross_curr - opex_sec['total_current'], 2)
        noi_prior = round(gross_prior - opex_sec['total_prior'], 2)
        noi_change = round(noi_curr - noi_prior, 2)
        noi_change_pct = round((noi_change / abs(noi_prior)) * 100.0, 2) if abs(noi_prior) > 0 else (100.0 if noi_curr > 0 else 0.0)

        # 4. Non-Operating Items & CapEx
        non_op_sec = _consolidate_transactions_into_categories(p_curr_txns, p_prior_txns, category_map, is_non_operating)

        # Net Cash Flow
        ncf_curr = round(noi_curr - non_op_sec['total_current'], 2)
        ncf_prior = round(noi_prior - non_op_sec['total_prior'], 2)
        ncf_change = round(ncf_curr - ncf_prior, 2)
        ncf_change_pct = round((ncf_change / abs(ncf_prior)) * 100.0, 2) if abs(ncf_prior) > 0 else (100.0 if ncf_curr > 0 else 0.0)

        property_report = {
            'property_id': pid,
            'property_name': p_name,
            'class_name': c_name,
            'company_name': comp_name,
            'address': addr,
            'property_type': p_type,
            'units_count': units,
            'period_label': bounds['period_label'],
            'prior_period_label': bounds['prior_period_label'],
            
            # Sections
            'rental_income_section': rental_sec,
            'other_income_section': other_inc_sec,
            'total_gross_income_current': gross_curr,
            'total_gross_income_prior': gross_prior,
            'total_gross_income_change': gross_change,
            'total_gross_income_change_percent': gross_change_pct,

            'operating_expenses_section': opex_sec,
            'total_operating_expenses_current': opex_sec['total_current'],
            'total_operating_expenses_prior': opex_sec['total_prior'],
            'total_operating_expenses_change': opex_sec['total_change'],
            'total_operating_expenses_change_percent': opex_sec['total_change_percent'],
            'is_operating_expenses_bold': True,

            'total_repairs_current': round(repairs_curr, 2),
            'total_repairs_prior': round(repairs_prior, 2),
            'repair_percentage_current': repair_pct_curr,
            'repair_percentage_prior': repair_pct_prior,
            'repair_health': repair_health,

            'net_operating_income_current': noi_curr,
            'net_operating_income_prior': noi_prior,
            'net_operating_income_change': noi_change,
            'net_operating_income_change_percent': noi_change_pct,

            'non_operating_section': non_op_sec,
            'net_cash_flow_current': ncf_curr,
            'net_cash_flow_prior': ncf_prior,
            'net_cash_flow_change': ncf_change,
            'net_cash_flow_change_percent': ncf_change_pct
        }
        properties_reports.append(property_report)

        portfolio_rental_curr += rental_sec['total_current']
        portfolio_rental_prior += rental_sec['total_prior']
        portfolio_gross_curr += gross_curr
        portfolio_gross_prior += gross_prior
        portfolio_opex_curr += opex_sec['total_current']
        portfolio_opex_prior += opex_sec['total_prior']
        portfolio_repairs_curr += repairs_curr
        portfolio_repairs_prior += repairs_prior
        portfolio_noi_curr += noi_curr
        portfolio_noi_prior += noi_prior
        portfolio_net_cash_curr += ncf_curr
        portfolio_net_cash_prior += ncf_prior

    portfolio_repair_pct_curr = round((portfolio_repairs_curr / portfolio_rental_curr) * 100.0, 2) if portfolio_rental_curr > 0 else 0.0
    portfolio_repair_pct_prior = round((portfolio_repairs_prior / portfolio_rental_prior) * 100.0, 2) if portfolio_rental_prior > 0 else 0.0

    # Build Master Consolidated Portfolio Report (combining all properties into 1 concise statement)
    port_rental_sec = _consolidate_transactions_into_categories(current_txns, prior_txns, category_map, is_rental_income)
    port_other_inc_sec = _consolidate_transactions_into_categories(current_txns, prior_txns, category_map, is_other_income)
    port_gross_curr = round(port_rental_sec['total_current'] + port_other_inc_sec['total_current'], 2)
    port_gross_prior = round(port_rental_sec['total_prior'] + port_other_inc_sec['total_prior'], 2)
    port_gross_change = round(port_gross_curr - port_gross_prior, 2)
    port_gross_change_pct = round((port_gross_change / port_gross_prior) * 100.0, 2) if port_gross_prior > 0 else (100.0 if port_gross_curr > 0 else 0.0)

    port_opex_sec = _consolidate_transactions_into_categories(current_txns, prior_txns, category_map, is_operating_expense)
    port_repairs_curr = sum(item['current_amount'] for item in port_opex_sec['items'] if item['is_repair'])
    port_repairs_prior = sum(item['prior_amount'] for item in port_opex_sec['items'] if item['is_repair'])
    port_repair_pct_curr = round((port_repairs_curr / port_rental_sec['total_current']) * 100.0, 2) if port_rental_sec['total_current'] > 0 else 0.0
    port_repair_pct_prior = round((port_repairs_prior / port_rental_sec['total_prior']) * 100.0, 2) if port_rental_sec['total_prior'] > 0 else 0.0
    port_repair_health = 'GOOD'
    if port_repair_pct_curr > 25.0:
        port_repair_health = 'HIGH'
    elif port_repair_pct_curr >= 10.0:
        port_repair_health = 'MODERATE'

    port_noi_curr = round(port_gross_curr - port_opex_sec['total_current'], 2)
    port_noi_prior = round(port_gross_prior - port_opex_sec['total_prior'], 2)
    port_noi_change = round(port_noi_curr - port_noi_prior, 2)
    port_noi_change_pct = round((port_noi_change / abs(port_noi_prior)) * 100.0, 2) if abs(port_noi_prior) > 0 else (100.0 if port_noi_curr > 0 else 0.0)

    port_non_op_sec = _consolidate_transactions_into_categories(current_txns, prior_txns, category_map, is_non_operating)
    port_ncf_curr = round(port_noi_curr - port_non_op_sec['total_current'], 2)
    port_ncf_prior = round(port_noi_prior - port_non_op_sec['total_prior'], 2)
    port_ncf_change = round(port_ncf_curr - port_ncf_prior, 2)
    port_ncf_change_pct = round((port_ncf_change / abs(port_ncf_prior)) * 100.0, 2) if abs(port_ncf_prior) > 0 else (100.0 if port_ncf_curr > 0 else 0.0)

    portfolio_consolidated_report = {
        'property_id': 0,
        'property_name': 'Entire Portfolio (Consolidated Statement)',
        'class_name': 'Consolidated Entities',
        'company_name': 'Master Portfolio',
        'address': f"{len(properties_reports)} Properties Combined",
        'property_type': 'Portfolio-Wide',
        'units_count': sum(p['units_count'] for p in properties_reports),
        'period_label': bounds['period_label'],
        'prior_period_label': bounds['prior_period_label'],

        'rental_income_section': port_rental_sec,
        'other_income_section': port_other_inc_sec,
        'total_gross_income_current': port_gross_curr,
        'total_gross_income_prior': port_gross_prior,
        'total_gross_income_change': port_gross_change,
        'total_gross_income_change_percent': port_gross_change_pct,

        'operating_expenses_section': port_opex_sec,
        'total_operating_expenses_current': port_opex_sec['total_current'],
        'total_operating_expenses_prior': port_opex_sec['total_prior'],
        'total_operating_expenses_change': port_opex_sec['total_change'],
        'total_operating_expenses_change_percent': port_opex_sec['total_change_percent'],
        'is_operating_expenses_bold': True,

        'total_repairs_current': round(port_repairs_curr, 2),
        'total_repairs_prior': round(port_repairs_prior, 2),
        'repair_percentage_current': port_repair_pct_curr,
        'repair_percentage_prior': port_repair_pct_prior,
        'repair_health': port_repair_health,

        'net_operating_income_current': port_noi_curr,
        'net_operating_income_prior': port_noi_prior,
        'net_operating_income_change': port_noi_change,
        'net_operating_income_change_percent': port_noi_change_pct,

        'non_operating_section': port_non_op_sec,
        'net_cash_flow_current': port_ncf_curr,
        'net_cash_flow_prior': port_ncf_prior,
        'net_cash_flow_change': port_ncf_change,
        'net_cash_flow_change_percent': port_ncf_change_pct
    }

    return {
        'period_info': bounds,
        'properties_reports': properties_reports,
        'portfolio_consolidated_report': portfolio_consolidated_report,
        'summary': {
            'total_properties': len(properties_reports),
            'portfolio_rental_income_current': round(portfolio_rental_curr, 2),
            'portfolio_rental_income_prior': round(portfolio_rental_prior, 2),
            'portfolio_rental_income_change': round(portfolio_rental_curr - portfolio_rental_prior, 2),
            'portfolio_gross_income_current': round(portfolio_gross_curr, 2),
            'portfolio_gross_income_prior': round(portfolio_gross_prior, 2),
            'portfolio_operating_expenses_current': round(portfolio_opex_curr, 2),
            'portfolio_operating_expenses_prior': round(portfolio_opex_prior, 2),
            'portfolio_operating_expenses_change': round(portfolio_opex_curr - portfolio_opex_prior, 2),
            'portfolio_repairs_current': round(portfolio_repairs_curr, 2),
            'portfolio_repairs_prior': round(portfolio_repairs_prior, 2),
            'portfolio_repair_percentage_current': portfolio_repair_pct_curr,
            'portfolio_repair_percentage_prior': portfolio_repair_pct_prior,
            'portfolio_noi_current': round(portfolio_noi_curr, 2),
            'portfolio_noi_prior': round(portfolio_noi_prior, 2),
            'portfolio_noi_change': round(portfolio_noi_curr - portfolio_noi_prior, 2),
            'portfolio_net_cash_flow_current': round(portfolio_net_cash_curr, 2),
            'portfolio_net_cash_flow_prior': round(portfolio_net_cash_prior, 2),
        }
    }


def get_category_drilldown_transactions(
    db: Session,
    category_id: Optional[int] = None,
    account_name: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    property_id: Optional[int] = None,
    class_id: Optional[int] = None,
    company_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Fetches all individual transactions making up a specific category line item
    within the chosen date range and entity filters.
    """
    query = db.query(Transaction)

    if from_date:
        query = query.filter(Transaction.date >= from_date)
    if to_date:
        query = query.filter(Transaction.date <= to_date)

    if property_id:
        query = query.filter(Transaction.property_id == property_id)
    elif class_id:
        query = query.filter(Transaction.class_id == class_id)
    elif company_id:
        class_ids = [c.id for c in db.query(ClassEntity).filter(ClassEntity.company_id == company_id).all()]
        query = query.filter(Transaction.class_id.in_(class_ids))

    cat_obj = None
    if category_id and category_id > 0:
        cat_obj = db.query(Category).filter(Category.id == category_id).first()
        if cat_obj:
            query = query.filter(or_(Transaction.category_id == category_id, Transaction.account_name.ilike(cat_obj.name.strip())))
        else:
            query = query.filter(Transaction.category_id == category_id)
    elif account_name:
        cat_obj = db.query(Category).filter(Category.name.ilike(account_name.strip())).first()
        if cat_obj:
            query = query.filter(or_(Transaction.category_id == cat_obj.id, Transaction.account_name.ilike(account_name.strip())))
        else:
            query = query.filter(Transaction.account_name.ilike(account_name.strip()))

    txns = query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()

    total_amt = 0.0
    items = []
    for t in txns:
        total_amt += t.amount
        t_dict = t.to_dict()
        
        # Determine human reference
        desc = t.description or ''
        if t.source == 'JOURNAL_ENTRY':
            if desc.startswith('[') and ']' in desc:
                je_ref = desc.split(']')[0].lstrip('[')
                t_dict['reference_number'] = f"JE #{je_ref}"
            else:
                t_dict['reference_number'] = "Journal Entry"
        elif t.source == 'CHECK':
            t_dict['reference_number'] = "Check Payment"
        elif t.source == 'IMPORTED':
            t_dict['reference_number'] = "Imported Statement"
        else:
            t_dict['reference_number'] = f"Manual Entry #{t.id}"

        items.append(t_dict)

    acc_num = cat_obj.account_number if cat_obj and cat_obj.account_number else ''
    cat_name = cat_obj.name if cat_obj else (account_name or 'Unassigned Category')
    display_title = f"[{acc_num}] {cat_name}" if acc_num else cat_name

    return {
        'category': {
            'id': cat_obj.id if cat_obj else category_id,
            'account_number': acc_num,
            'name': cat_name,
            'display_name': display_title,
            'type': cat_obj.type if cat_obj else 'OPERATING_EXPENSE',
            'is_repair_category': cat_obj.is_repair_category if cat_obj else False,
            'is_rental_income': cat_obj.is_rental_income if cat_obj else False,
        },
        'period_info': {
            'from_date': from_date or '',
            'to_date': to_date or '',
            'date_label': f"{from_date or 'Start'} to {to_date or 'End'}"
        },
        'total_amount': round(total_amt, 2),
        'transaction_count': len(items),
        'transactions': items
    }


def generate_monthly_property_pnl(
    db: Session, 
    company_id: int = None,
    class_id: int = None,
    property_id: int = None, 
    year: int = None, 
    month: str = None
) -> dict:
    """
    Backwards-compatible monthly financial reports organized by property,
    retained for existing legacy views and automated test suites.
    """
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
    elif year:
        query = query.filter(Transaction.month.startswith(str(year)))
        
    transactions = query.order_by(Transaction.month.desc(), Transaction.date.asc()).all()

    # Group by property then by month
    grouped_data = defaultdict(lambda: defaultdict(list))
    for txn in transactions:
        prop_name = txn.property.name if txn.property else "Portfolio Unassigned"
        grouped_data[prop_name][txn.month].append(txn)

    reports = []
    portfolio_total_rental_income = 0.0
    portfolio_total_operating_expenses = 0.0
    portfolio_total_repairs = 0.0
    portfolio_total_noi = 0.0

    for prop_name, months_dict in grouped_data.items():
        prop_obj = next((t.property for month_txns in months_dict.values() for t in month_txns if t.property), None)
        prop_id = prop_obj.id if prop_obj else 0
        prop_units = prop_obj.units_count if prop_obj else 1
        prop_addr = prop_obj.formatted_address() if prop_obj else ''
        prop_type = prop_obj.property_type if prop_obj else 'Residential'
        llc_name = prop_obj.class_entity.name if prop_obj and prop_obj.class_entity else 'General LLC'
        comp_name = prop_obj.class_entity.company.name if prop_obj and prop_obj.class_entity and prop_obj.class_entity.company else 'Holding Co.'

        property_report = {
            'property_id': prop_id,
            'property_name': prop_name,
            'class_name': llc_name,
            'company_name': comp_name,
            'address': prop_addr,
            'property_type': prop_type,
            'units_count': prop_units,
            'months': []
        }

        sorted_months = sorted(months_dict.keys(), reverse=True)

        for m in sorted_months:
            month_txns = months_dict[m]
            
            # 1. Income Section (Rental Income explicitly first)
            rental_income_items = []
            other_income_items = []
            operating_expense_items = []
            non_operating_expense_items = []

            total_rental_income = 0.0
            total_other_income = 0.0
            total_operating_expenses = 0.0
            total_repairs = 0.0
            total_non_operating = 0.0

            for t in month_txns:
                t_dict = t.to_dict()
                is_rent = (t.category.is_rental_income if t.category else False) or t.is_aggregated or 'rental income' in t.account_name.lower() or 'rent' in t.account_name.lower()
                is_repair = (t.category.is_repair_category if t.category else False) or 'repair' in t.account_name.lower() or 'maintenance' in t.account_name.lower()

                if t.category_type in ['INCOME', 'REVENUE']:
                    if is_rent:
                        rental_income_items.append(t_dict)
                        total_rental_income += t.amount
                    else:
                        other_income_items.append(t_dict)
                        total_other_income += t.amount
                elif t.category_type == 'OPERATING_EXPENSE':
                    operating_expense_items.append(t_dict)
                    total_operating_expenses += t.amount
                    if is_repair:
                        total_repairs += t.amount
                else:
                    non_operating_expense_items.append(t_dict)
                    total_non_operating += t.amount

            total_gross_income = total_rental_income + total_other_income
            net_operating_income = total_gross_income - total_operating_expenses
            net_cash_flow = net_operating_income - total_non_operating

            repair_percentage = 0.0
            if total_rental_income > 0:
                repair_percentage = round((total_repairs / total_rental_income) * 100.0, 2)

            repair_health = 'GOOD'
            if repair_percentage > 25.0:
                repair_health = 'HIGH'
            elif repair_percentage >= 10.0:
                repair_health = 'MODERATE'

            month_report = {
                'month': m,
                'rental_income_items': rental_income_items,
                'other_income_items': other_income_items,
                'total_rental_income': round(total_rental_income, 2),
                'total_other_income': round(total_other_income, 2),
                'total_gross_income': round(total_gross_income, 2),
                'operating_expense_items': operating_expense_items,
                'total_operating_expenses': round(total_operating_expenses, 2),
                'is_operating_expenses_bold': True,
                'total_repairs': round(total_repairs, 2),
                'repair_percentage': repair_percentage,
                'repair_health': repair_health,
                'net_operating_income': round(net_operating_income, 2),
                'non_operating_expense_items': non_operating_expense_items,
                'total_non_operating': round(total_non_operating, 2),
                'net_cash_flow': round(net_cash_flow, 2)
            }
            property_report['months'].append(month_report)

            portfolio_total_rental_income += total_rental_income
            portfolio_total_operating_expenses += total_operating_expenses
            portfolio_total_repairs += total_repairs
            portfolio_total_noi += net_operating_income

        reports.append(property_report)

    portfolio_repair_percentage = 0.0
    if portfolio_total_rental_income > 0:
        portfolio_repair_percentage = round((portfolio_total_repairs / portfolio_total_rental_income) * 100.0, 2)

    return {
        'properties_reports': reports,
        'summary': {
            'total_properties': len(reports),
            'portfolio_total_rental_income': round(portfolio_total_rental_income, 2),
            'portfolio_total_operating_expenses': round(portfolio_total_operating_expenses, 2),
            'portfolio_total_repairs': round(portfolio_total_repairs, 2),
            'portfolio_total_noi': round(portfolio_total_noi, 2),
            'portfolio_repair_percentage': portfolio_repair_percentage
        }
    }
