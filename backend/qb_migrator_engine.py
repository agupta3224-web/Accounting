import os
import re
import io
import csv
import zipfile
import tempfile
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

import openpyxl
import openqbw
from sqlalchemy.orm import Session

from .models import (
    Company,
    ClassEntity,
    Property,
    Category,
    Vendor,
    Transaction,
    JournalEntry,
    JournalEntryLine
)
from .coa_engine import (
    map_quickbooks_account_type,
    normalize_account_type,
    validate_account_number,
    suggest_next_account_number,
    import_quickbooks_coa_to_db,
    parse_quickbooks_coa_file
)
from .journal_engine import record_opening_balance_entry


def clean_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def parse_date_str(raw_date: Any) -> str:
    """Parses various date strings into YYYY-MM-DD."""
    if not raw_date:
        return datetime.now().strftime("%Y-%m-%d")
    raw = clean_str(raw_date)
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%Y/%m/%d", "%d-%b-%Y", "%d-%b-%y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return datetime.now().strftime("%Y-%m-%d")


def parse_address_from_string(s: str) -> Dict[str, str]:
    """
    Intelligently extracts street address, unit/apt, city, state, zip from a text string.
    """
    addr1 = clean_str(s)
    addr2 = ""
    city = ""
    state = ""
    zip_code = ""

    # Check for unit / suite / bldg
    unit_m = re.search(r'\b(Unit|Apt|Suite|Ste|Bldg|Building|#)\s*([A-Za-z0-9\-]+)', addr1, re.IGNORECASE)
    if unit_m:
        addr2 = unit_m.group(0)

    # Check for City, ST ZIP pattern: e.g. Austin, TX 78701 or Austin TX 78701
    loc_m = re.search(r',\s*([A-Za-z\s]+),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)', addr1)
    if loc_m:
        city = loc_m.group(1).strip()
        state = loc_m.group(2).strip()
        zip_code = loc_m.group(3).strip()
        addr1 = addr1[:loc_m.start()].strip()

    return {
        "address_line1": addr1,
        "address_line2": addr2,
        "city": city,
        "state": state,
        "zip_code": zip_code
    }


def parse_quickbooks_iif(content: str, filename: str = "quickbooks.iif") -> Dict[str, Any]:
    """
    Parses an Intuit Interchange Format (.iif) file into structured company data:
    - !CLASS / CLASS: Top-level classes -> ClassEntity (LLC), Sub-classes -> Property
    - !ACCNT / ACCNT: Chart of Accounts with parent/sub hierarchy and starting balances
    - !VEND / VEND: Vendors with full contact info, address, tax ID (1099)
    - !TRNS / !SPL / TRNS / SPL: Historical double-entry transactions
    """
    headers: Dict[str, List[str]] = {}
    raw_classes: List[Dict[str, str]] = []
    raw_accounts: List[Dict[str, str]] = []
    raw_vendors: List[Dict[str, str]] = []
    raw_transactions: List[Dict[str, Any]] = []

    current_trns: Optional[Dict[str, Any]] = None
    current_splits: List[Dict[str, Any]] = []

    # Handle universal newlines and tab delimiter
    reader = csv.reader(io.StringIO(content), delimiter='\t')

    for row in reader:
        if not row or not any(row):
            continue
        tag = row[0].strip()
        if not tag:
            continue

        if tag.startswith('!'):
            tag_name = tag[1:].upper()
            headers[tag_name] = [c.strip().upper() for c in row[1:]]
            continue

        tag_name = tag.upper()
        col_names = headers.get(tag_name, [])

        row_dict: Dict[str, str] = {}
        for i, col in enumerate(col_names):
            val = row[i + 1].strip() if (i + 1) < len(row) else ""
            row_dict[col] = val

        if tag_name == "CLASS":
            raw_classes.append(row_dict)
        elif tag_name == "ACCNT":
            raw_accounts.append(row_dict)
        elif tag_name == "VEND":
            raw_vendors.append(row_dict)
        elif tag_name == "TRNS":
            # Start new transaction
            current_trns = row_dict
            current_splits = []
        elif tag_name == "SPL":
            current_splits.append(row_dict)
        elif tag_name in ("ENDTRNS", "") and current_trns is not None:
            # End of transaction block
            raw_transactions.append({
                "header": current_trns,
                "splits": current_splits
            })
            current_trns = None
            current_splits = []

    # If file ended without explicit ENDTRNS
    if current_trns is not None:
        raw_transactions.append({
            "header": current_trns,
            "splits": current_splits
        })

    # --- 1. Process Classes and Properties ---
    classes_map: Dict[str, Dict[str, Any]] = {}
    properties_list: List[Dict[str, Any]] = []

    for c in raw_classes:
        full_name = c.get("NAME", "").strip()
        if not full_name:
            continue

        if ":" in full_name:
            parts = [p.strip() for p in full_name.split(":")]
            llc_name = parts[0]
            prop_name = ":".join(parts[1:])
        else:
            llc_name = full_name
            prop_name = None

        if llc_name not in classes_map:
            classes_map[llc_name] = {
                "name": llc_name,
                "entity_type": "LLC",
                "properties_count": 0,
                "description": f"QuickBooks Class: {llc_name}"
            }

        if prop_name:
            classes_map[llc_name]["properties_count"] += 1
            addr_info = parse_address_from_string(prop_name)
            properties_list.append({
                "class_name": llc_name,
                "name": prop_name,
                "full_path": full_name,
                "address_line1": addr_info["address_line1"],
                "address_line2": addr_info["address_line2"],
                "city": addr_info["city"],
                "state": addr_info["state"],
                "zip_code": addr_info["zip_code"],
                "property_type": "Residential",
                "units_count": 1
            })

    # If any class has 0 properties, auto-add a default property asset for that LLC
    for llc_name, c_data in classes_map.items():
        if c_data["properties_count"] == 0:
            default_prop_name = f"{llc_name} - Main Property"
            properties_list.append({
                "class_name": llc_name,
                "name": default_prop_name,
                "full_path": f"{llc_name}:{default_prop_name}",
                "address_line1": default_prop_name,
                "address_line2": "",
                "city": "",
                "state": "",
                "zip_code": "",
                "property_type": "Residential",
                "units_count": 1,
                "is_auto_created": True
            })
            c_data["properties_count"] = 1

    classes_list = list(classes_map.values())

    # --- 2. Process Chart of Accounts ---
    parsed_accounts: List[Dict[str, Any]] = []
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0
    type_counts: Dict[str, int] = {}

    for a in raw_accounts:
        full_acct_name = a.get("NAME", "").strip()
        if not full_acct_name:
            continue

        raw_type = a.get("ACCNTTYPE", "").strip()
        desc = a.get("DESC", "").strip()
        acct_num = a.get("ACCNUM", "").strip() or None

        # Hierarchy (: delimited)
        if ":" in full_acct_name:
            parts = [p.strip() for p in full_acct_name.split(":")]
            leaf_name = parts[-1]
            parent_full = ":".join(parts[:-1])
            parent_name = parts[-2]
            level = len(parts) - 1
        else:
            leaf_name = full_acct_name
            parent_full = None
            parent_name = None
            level = 0

        mapped_type, mapped_sub_type, is_repair, is_rental = map_quickbooks_account_type(
            raw_type,
            name=leaf_name,
            num=acct_num
        )

        # Balance parsing if present
        bal_num = 0.0
        for bal_key in ("OBAL", "BAL", "TOTAL"):
            if a.get(bal_key):
                try:
                    clean_bal = re.sub(r'[\$,\s]', '', a[bal_key])
                    bal_num = float(clean_bal)
                    break
                except ValueError:
                    pass

        if mapped_type == "ASSET":
            total_assets += bal_num
        elif mapped_type == "LIABILITY":
            total_liabilities += bal_num
        elif mapped_type == "EQUITY":
            total_equity += bal_num

        type_counts[mapped_type] = type_counts.get(mapped_type, 0) + 1

        is_valid_num = True
        num_err = ""
        if acct_num:
            is_valid_num, num_err = validate_account_number(acct_num, mapped_type)

        parsed_accounts.append({
            "account_number": acct_num,
            "name": leaf_name,
            "full_name": full_acct_name,
            "level": level,
            "is_sub_account": level > 0,
            "parent_account_name": parent_name,
            "parent_full_name": parent_full,
            "type": mapped_type,
            "sub_type": mapped_sub_type,
            "qb_type": raw_type,
            "description": desc or None,
            "balance_total": round(bal_num, 2),
            "opening_balance": round(bal_num, 2),
            "is_repair_category": is_repair,
            "is_rental_income": is_rental,
            "is_valid": is_valid_num,
            "validation_error": num_err if not is_valid_num else None
        })

    # Auto-assign 5-digit account numbers if accounts had none
    used_nums = [acc["account_number"] for acc in parsed_accounts if acc.get("account_number")]
    for acc in parsed_accounts:
        if not acc.get("account_number"):
            assigned = suggest_next_account_number(acc["type"], used_nums)
            acc["account_number"] = assigned
            used_nums.append(assigned)
            acc["auto_assigned_number"] = True

    # --- 3. Process Vendors ---
    parsed_vendors: List[Dict[str, Any]] = []
    for v_idx, v in enumerate(raw_vendors, start=1001):
        v_name = v.get("NAME", "").strip()
        if not v_name:
            continue

        tax_id = v.get("TAXID", "").strip()
        notes = v.get("NOTEPAD", "").strip()
        is_1099 = bool(tax_id or "1099" in notes.lower())

        addr1 = v.get("ADDR1", "").strip()
        addr2 = v.get("ADDR2", "").strip()
        city = v.get("CITY", "").strip()
        state = v.get("STATE", "").strip()
        zip_code = v.get("ZIP", "").strip()

        parsed_vendors.append({
            "account_number": f"VEND-{v_idx}",
            "name": v_name,
            "print_as": v.get("PRINTAS", "").strip() or v_name,
            "contact_person": v.get("CONT1", "").strip() or None,
            "phone": v.get("PHONE1", "").strip() or v.get("PHONE2", "").strip() or None,
            "email": v.get("EMAIL", "").strip() or None,
            "tax_id": tax_id or None,
            "is_1099_eligible": is_1099,
            "address_line1": addr1 or None,
            "address_line2": addr2 or None,
            "city": city or None,
            "state": state or None,
            "zip_code": zip_code or None,
            "notes": notes or None
        })

    # --- 4. Process Transactions ---
    normalized_transactions: List[Dict[str, Any]] = []
    for t_idx, item in enumerate(raw_transactions):
        header = item["header"]
        splits = item["splits"]

        h_date = parse_date_str(header.get("DATE"))
        h_payee = header.get("NAME", "").strip()
        h_memo = header.get("MEMO", "").strip()
        h_doc = header.get("DOCNUM", "").strip()

        if splits:
            for s in splits:
                s_acct = s.get("ACCNT", "").strip()
                s_class = s.get("CLASS", "").strip()
                s_amount_str = re.sub(r'[\$,\s]', '', s.get("AMOUNT", "0"))
                try:
                    s_amt = float(s_amount_str)
                except ValueError:
                    s_amt = 0.0

                s_payee = s.get("NAME", "").strip() or h_payee
                s_memo = s.get("MEMO", "").strip() or h_memo

                # Resolve class & property
                cls_name = None
                prop_name = None
                if s_class:
                    if ":" in s_class:
                        c_parts = [p.strip() for p in s_class.split(":")]
                        cls_name = c_parts[0]
                        prop_name = ":".join(c_parts[1:])
                    else:
                        cls_name = s_class

                normalized_transactions.append({
                    "id": t_idx + 1,
                    "date": h_date,
                    "account_name": s_acct,
                    "payee": s_payee,
                    "amount": round(abs(s_amt), 2),
                    "is_credit": s_amt < 0,
                    "memo": s_memo,
                    "check_number": h_doc or None,
                    "class_name": cls_name,
                    "property_name": prop_name
                })
        else:
            h_amount_str = re.sub(r'[\$,\s]', '', header.get("AMOUNT", "0"))
            try:
                h_amt = float(h_amount_str)
            except ValueError:
                h_amt = 0.0

            normalized_transactions.append({
                "id": t_idx + 1,
                "date": h_date,
                "account_name": header.get("ACCNT", "").strip(),
                "payee": h_payee,
                "amount": round(abs(h_amt), 2),
                "is_credit": h_amt < 0,
                "memo": h_memo,
                "check_number": h_doc or None,
                "class_name": None,
                "property_name": None
            })

    # Derive suggested company name
    base_name = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ")
    suggested_company_name = re.sub(r'\b(export|quickbooks|iif|backup)\b', '', base_name, flags=re.IGNORECASE).strip().title()
    if not suggested_company_name:
        suggested_company_name = classes_list[0]["name"] if classes_list else "Migrated QuickBooks Company"

    return {
        "status": "SUCCESS",
        "format": "IIF",
        "filename": filename,
        "company_name": suggested_company_name,
        "classes": classes_list,
        "properties": properties_list,
        "accounts": parsed_accounts,
        "vendors": parsed_vendors,
        "transactions": normalized_transactions,
        "summary": {
            "total_classes": len(classes_list),
            "total_properties": len(properties_list),
            "total_accounts": len(parsed_accounts),
            "total_vendors": len(parsed_vendors),
            "total_transactions": len(normalized_transactions),
            "total_assets_balance": round(total_assets, 2),
            "total_liabilities_balance": round(total_liabilities, 2),
            "total_equity_balance": round(total_equity, 2),
            "types_breakdown": type_counts
        }
    }


def parse_quickbooks_excel(content_bytes: bytes, filename: str = "quickbooks.xlsx") -> Dict[str, Any]:
    """
    Parses a multi-sheet or single-sheet QuickBooks Excel workbook (.xlsx / .xls).
    Scans for:
    - Chart of Accounts / Account List
    - Class List (LLCs and Properties)
    - Vendor Contact List (Vendors, Addresses, Tax IDs)
    - Transactions / Journal
    """
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
    except Exception as e:
        # Fallback to single-sheet COA parser
        return parse_quickbooks_coa_file(content_bytes, filename)

    parsed_classes_map: Dict[str, Dict[str, Any]] = {}
    parsed_properties: List[Dict[str, Any]] = []
    parsed_vendors: List[Dict[str, Any]] = []
    parsed_accounts: List[Dict[str, Any]] = []
    parsed_transactions: List[Dict[str, Any]] = []

    # Sheet scanner
    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        lower_name = sheet_name.lower()

        # Read top 15 rows to detect columns
        rows = list(sheet.iter_rows(values_only=True, max_row=20))
        if not rows:
            continue

        header_idx = -1
        col_headers: List[str] = []
        for r_idx, r in enumerate(rows):
            clean_r = [clean_str(cell).lower() for cell in r if cell is not None]
            if any(k in clean_r for k in ("account", "class", "vendor", "transaction")):
                header_idx = r_idx
                col_headers = [clean_str(cell) for cell in r]
                break

        if header_idx == -1:
            continue

        clean_col_names = [c.lower() for c in col_headers]

        # 1. Accounts sheet detection
        if ("account" in clean_col_names and "type" in clean_col_names) or "coa" in lower_name or "chart" in lower_name:
            # Leverage COA parser
            try:
                coa_res = parse_quickbooks_coa_file(content_bytes, filename)
                if coa_res.get("accounts") and not parsed_accounts:
                    parsed_accounts = coa_res["accounts"]
            except Exception:
                pass

        # 2. Classes sheet detection
        if any("class" in c for c in clean_col_names) and ("vendor" not in lower_name):
            name_col = next((i for i, c in enumerate(clean_col_names) if "class" in c or "name" in c), 0)
            all_rows = list(sheet.iter_rows(values_only=True, min_row=header_idx + 2))
            for r in all_rows:
                if not r or len(r) <= name_col or not r[name_col]:
                    continue
                full_cls_name = clean_str(r[name_col])
                if not full_cls_name or full_cls_name.lower().startswith("total"):
                    continue

                if ":" in full_cls_name:
                    parts = [p.strip() for p in full_cls_name.split(":")]
                    llc_name = parts[0]
                    prop_name = ":".join(parts[1:])
                else:
                    llc_name = full_cls_name
                    prop_name = None

                if llc_name not in parsed_classes_map:
                    parsed_classes_map[llc_name] = {
                        "name": llc_name,
                        "entity_type": "LLC",
                        "properties_count": 0,
                        "description": f"QuickBooks Class: {llc_name}"
                    }

                if prop_name:
                    parsed_classes_map[llc_name]["properties_count"] += 1
                    addr_info = parse_address_from_string(prop_name)
                    parsed_properties.append({
                        "class_name": llc_name,
                        "name": prop_name,
                        "full_path": full_cls_name,
                        "address_line1": addr_info["address_line1"],
                        "address_line2": addr_info["address_line2"],
                        "city": addr_info["city"],
                        "state": addr_info["state"],
                        "zip_code": addr_info["zip_code"],
                        "property_type": "Residential",
                        "units_count": 1
                    })

        # 3. Vendors sheet detection
        if any(k in lower_name for k in ("vendor", "payee", "contact")) or ("vendor" in clean_col_names):
            name_col = next((i for i, c in enumerate(clean_col_names) if "vendor" in c or "company" in c or "name" in c), -1)
            tax_col = next((i for i, c in enumerate(clean_col_names) if "tax" in c or "ssn" in c or "ein" in c), -1)
            phone_col = next((i for i, c in enumerate(clean_col_names) if "phone" in c), -1)
            email_col = next((i for i, c in enumerate(clean_col_names) if "email" in c), -1)
            contact_col = next((i for i, c in enumerate(clean_col_names) if "contact" in c), -1)
            addr_col = next((i for i, c in enumerate(clean_col_names) if "address" in c or "street" in c), -1)
            city_col = next((i for i, c in enumerate(clean_col_names) if "city" in c), -1)
            state_col = next((i for i, c in enumerate(clean_col_names) if "state" in c), -1)
            zip_col = next((i for i, c in enumerate(clean_col_names) if "zip" in c), -1)

            if name_col != -1:
                all_v_rows = list(sheet.iter_rows(values_only=True, min_row=header_idx + 2))
                for v_idx, r in enumerate(all_v_rows, start=1001):
                    if not r or len(r) <= name_col or not r[name_col]:
                        continue
                    v_name = clean_str(r[name_col])
                    if not v_name or v_name.lower().startswith("total"):
                        continue

                    tax_id = clean_str(r[tax_col]) if tax_col != -1 and tax_col < len(r) else None
                    phone = clean_str(r[phone_col]) if phone_col != -1 and phone_col < len(r) else None
                    email = clean_str(r[email_col]) if email_col != -1 and email_col < len(r) else None
                    contact = clean_str(r[contact_col]) if contact_col != -1 and contact_col < len(r) else None
                    addr1 = clean_str(r[addr_col]) if addr_col != -1 and addr_col < len(r) else None
                    city = clean_str(r[city_col]) if city_col != -1 and city_col < len(r) else None
                    state = clean_str(r[state_col]) if state_col != -1 and state_col < len(r) else None
                    zip_code = clean_str(r[zip_col]) if zip_col != -1 and zip_col < len(r) else None

                    parsed_vendors.append({
                        "account_number": f"VEND-{v_idx}",
                        "name": v_name,
                        "print_as": v_name,
                        "contact_person": contact,
                        "phone": phone,
                        "email": email,
                        "tax_id": tax_id,
                        "is_1099_eligible": bool(tax_id),
                        "address_line1": addr1,
                        "address_line2": None,
                        "city": city,
                        "state": state,
                        "zip_code": zip_code,
                        "notes": "Imported from QuickBooks Excel"
                    })

    # If no accounts were extracted from dedicated sheet, run COA parser on the workbook
    if not parsed_accounts:
        try:
            coa_res = parse_quickbooks_coa_file(content_bytes, filename)
            parsed_accounts = coa_res.get("accounts", [])
        except Exception:
            pass

    # Ensure each LLC has at least 1 property
    for llc_name, c_data in parsed_classes_map.items():
        if c_data["properties_count"] == 0:
            def_name = f"{llc_name} - Main Property"
            parsed_properties.append({
                "class_name": llc_name,
                "name": def_name,
                "full_path": f"{llc_name}:{def_name}",
                "address_line1": def_name,
                "address_line2": "",
                "city": "",
                "state": "",
                "zip_code": "",
                "property_type": "Residential",
                "units_count": 1,
                "is_auto_created": True
            })
            c_data["properties_count"] = 1

    classes_list = list(parsed_classes_map.values())

    # Derive suggested company name
    base_name = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ")
    suggested_company_name = re.sub(r'\b(export|quickbooks|backup|coa|accounts|report)\b', '', base_name, flags=re.IGNORECASE).strip().title()
    if not suggested_company_name:
        suggested_company_name = classes_list[0]["name"] if classes_list else "Migrated QuickBooks Company"

    total_assets = sum(a.get("balance_total", 0.0) for a in parsed_accounts if a.get("type") == "ASSET")
    total_liabilities = sum(a.get("balance_total", 0.0) for a in parsed_accounts if a.get("type") == "LIABILITY")
    total_equity = sum(a.get("balance_total", 0.0) for a in parsed_accounts if a.get("type") == "EQUITY")
    type_counts: Dict[str, int] = {}
    for a in parsed_accounts:
        t = a.get("type", "UNKNOWN")
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "status": "SUCCESS",
        "format": "EXCEL",
        "filename": filename,
        "company_name": suggested_company_name,
        "classes": classes_list,
        "properties": parsed_properties,
        "accounts": parsed_accounts,
        "vendors": parsed_vendors,
        "transactions": parsed_transactions,
        "summary": {
            "total_classes": len(classes_list),
            "total_properties": len(parsed_properties),
            "total_accounts": len(parsed_accounts),
            "total_vendors": len(parsed_vendors),
            "total_transactions": len(parsed_transactions),
            "total_assets_balance": round(total_assets, 2),
            "total_liabilities_balance": round(total_liabilities, 2),
            "total_equity_balance": round(total_equity, 2),
            "types_breakdown": type_counts
        }
    }


def parse_quickbooks_qbw(content_bytes: bytes, filename: str = "company.qbw") -> Dict[str, Any]:
    """
    Parses a native QuickBooks Desktop (.qbw) company file using openqbw.
    If the file has proprietary enterprise encryption or password restrictions,
    catches the exception gracefully and provides one-click IIF/Excel conversion guidance.
    """
    base_name = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ")
    suggested_company_name = re.sub(r'\b(quickbooks|qbw|backup|company)\b', '', base_name, flags=re.IGNORECASE).strip().title()
    if not suggested_company_name:
        suggested_company_name = "QuickBooks Migrated Company"

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".qbw", delete=False) as tf:
            tf.write(content_bytes)
            temp_path = tf.name

        reader = openqbw.open(temp_path)
        tables = reader.tables()
        txns = reader.transactions()
        lines = reader.line_items()

        # Build normalized transactions
        normalized_transactions: List[Dict[str, Any]] = []
        for idx, t in enumerate(txns[:1000]):  # Sample up to first 1000
            t_date = parse_date_str(t.get("date") or t.get("trans_date"))
            payee = clean_str(t.get("payee") or t.get("name") or "QuickBooks Payee")
            memo = clean_str(t.get("memo") or t.get("description") or "")
            amt = float(t.get("amount") or 0.0)

            normalized_transactions.append({
                "id": idx + 1,
                "date": t_date,
                "account_name": clean_str(t.get("account") or "Unassigned Account"),
                "payee": payee,
                "amount": round(abs(amt), 2),
                "is_credit": amt < 0,
                "memo": memo,
                "check_number": clean_str(t.get("check_number") or t.get("doc_num") or ""),
                "class_name": clean_str(t.get("class") or ""),
                "property_name": None
            })

        return {
            "status": "SUCCESS",
            "format": "QBW",
            "filename": filename,
            "company_name": suggested_company_name,
            "can_convert": True,
            "page_count": reader.page_count,
            "tables_count": len(tables),
            "classes": [
                {
                    "name": suggested_company_name,
                    "entity_type": "LLC",
                    "properties_count": 1,
                    "description": "Primary Entity from QuickBooks QBW"
                }
            ],
            "properties": [
                {
                    "class_name": suggested_company_name,
                    "name": f"{suggested_company_name} - Main Property",
                    "full_path": f"{suggested_company_name}:Main Property",
                    "address_line1": "Main Property",
                    "address_line2": "",
                    "city": "",
                    "state": "",
                    "zip_code": "",
                    "property_type": "Residential",
                    "units_count": 1
                }
            ],
            "accounts": [],
            "vendors": [],
            "transactions": normalized_transactions,
            "summary": {
                "total_classes": 1,
                "total_properties": 1,
                "total_accounts": 0,
                "total_vendors": 0,
                "total_transactions": len(normalized_transactions),
                "total_assets_balance": 0.0,
                "total_liabilities_balance": 0.0,
                "total_equity_balance": 0.0,
                "types_breakdown": {}
            }
        }
    except Exception as e:
        return {
            "status": "ENCRYPTED_OR_RESTRICTED",
            "format": "QBW",
            "filename": filename,
            "company_name": suggested_company_name,
            "can_convert": False,
            "error": str(e),
            "guidance": (
                f"QuickBooks Desktop company file '{filename}' uses proprietary Intuit database encryption "
                f"or password locking. To migrate with 100% fidelity across all QuickBooks Desktop versions: "
                f"In QuickBooks Desktop, select 'File' > 'Utilities' > 'Export' > 'Lists to IIF Files' "
                f"(or export your Chart of Accounts, Classes, and Vendors to Excel), and drop that .iif or .xlsx file here "
                f"for instant 1-click conversion!"
            )
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def parse_quickbooks_zip(content_bytes: bytes, filename: str = "quickbooks_export.zip") -> Dict[str, Any]:
    """
    Parses a multi-file ZIP archive exported from QuickBooks Desktop.
    Extracts and merges all .iif, .xlsx, .xls, .csv, or .qbw files found inside.
    """
    aggregated_classes: Dict[str, Dict[str, Any]] = {}
    aggregated_properties: List[Dict[str, Any]] = []
    aggregated_accounts: List[Dict[str, Any]] = []
    aggregated_vendors: List[Dict[str, Any]] = []
    aggregated_transactions: List[Dict[str, Any]] = []
    detected_files: List[str] = []
    comp_name: Optional[str] = None

    with zipfile.ZipFile(io.BytesIO(content_bytes), "r") as zf:
        for member_name in zf.namelist():
            if member_name.startswith("__MACOSX") or member_name.startswith(".") or "/" in member_name and member_name.endswith("/"):
                continue
            lower_m = member_name.lower()
            file_bytes = zf.read(member_name)

            if lower_m.endswith(".iif"):
                detected_files.append(member_name)
                try:
                    res = parse_quickbooks_iif(file_bytes.decode("utf-8", errors="replace"), member_name)
                    if not comp_name:
                        comp_name = res.get("company_name")
                    for c in res.get("classes", []):
                        aggregated_classes[c["name"]] = c
                    aggregated_properties.extend(res.get("properties", []))
                    aggregated_accounts.extend(res.get("accounts", []))
                    aggregated_vendors.extend(res.get("vendors", []))
                    aggregated_transactions.extend(res.get("transactions", []))
                except Exception:
                    pass

            elif lower_m.endswith((".xlsx", ".xls")):
                detected_files.append(member_name)
                try:
                    res = parse_quickbooks_excel(file_bytes, member_name)
                    if not comp_name:
                        comp_name = res.get("company_name")
                    for c in res.get("classes", []):
                        aggregated_classes[c["name"]] = c
                    aggregated_properties.extend(res.get("properties", []))
                    if not aggregated_accounts:
                        aggregated_accounts.extend(res.get("accounts", []))
                    aggregated_vendors.extend(res.get("vendors", []))
                    aggregated_transactions.extend(res.get("transactions", []))
                except Exception:
                    pass

            elif lower_m.endswith(".csv"):
                detected_files.append(member_name)
                try:
                    res = parse_quickbooks_coa_file(file_bytes, member_name)
                    if not aggregated_accounts:
                        aggregated_accounts.extend(res.get("accounts", []))
                except Exception:
                    pass

    base_name = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ")
    suggested_company_name = comp_name or base_name.title()

    total_assets = sum(a.get("balance_total", 0.0) for a in aggregated_accounts if a.get("type") == "ASSET")
    total_liabilities = sum(a.get("balance_total", 0.0) for a in aggregated_accounts if a.get("type") == "LIABILITY")
    total_equity = sum(a.get("balance_total", 0.0) for a in aggregated_accounts if a.get("type") == "EQUITY")
    type_counts: Dict[str, int] = {}
    for a in aggregated_accounts:
        t = a.get("type", "UNKNOWN")
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "status": "SUCCESS",
        "format": "ZIP",
        "filename": filename,
        "company_name": suggested_company_name,
        "detected_files": detected_files,
        "classes": list(aggregated_classes.values()),
        "properties": aggregated_properties,
        "accounts": aggregated_accounts,
        "vendors": aggregated_vendors,
        "transactions": aggregated_transactions,
        "summary": {
            "total_classes": len(aggregated_classes),
            "total_properties": len(aggregated_properties),
            "total_accounts": len(aggregated_accounts),
            "total_vendors": len(aggregated_vendors),
            "total_transactions": len(aggregated_transactions),
            "total_assets_balance": round(total_assets, 2),
            "total_liabilities_balance": round(total_liabilities, 2),
            "total_equity_balance": round(total_equity, 2),
            "types_breakdown": type_counts
        }
    }


def parse_quickbooks_migration_file(content_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Main entry point for QuickBooks file preview & parsing.
    Dispatches according to file extension:
    - .qbw: Native QuickBooks Desktop company file
    - .iif: Intuit Interchange Format file
    - .xlsx / .xls: QuickBooks Excel export
    - .zip: Multi-report archive
    - .csv: Chart of accounts or export list
    """
    lower = filename.lower()
    if lower.endswith(".qbw"):
        return parse_quickbooks_qbw(content_bytes, filename)
    elif lower.endswith(".iif"):
        text = content_bytes.decode("utf-8", errors="replace")
        return parse_quickbooks_iif(text, filename)
    elif lower.endswith((".xlsx", ".xls")):
        return parse_quickbooks_excel(content_bytes, filename)
    elif lower.endswith(".zip"):
        return parse_quickbooks_zip(content_bytes, filename)
    elif lower.endswith(".csv"):
        text = content_bytes.decode("utf-8", errors="replace")
        if text.startswith("!") or "\t" in text:
            return parse_quickbooks_iif(text, filename)
        else:
            coa_res = parse_quickbooks_coa_file(content_bytes, filename)
            base_name = os.path.splitext(filename)[0].replace("_", " ").title()
            return {
                "status": "SUCCESS",
                "format": "CSV",
                "filename": filename,
                "company_name": base_name,
                "classes": [],
                "properties": [],
                "accounts": coa_res.get("accounts", []),
                "vendors": [],
                "transactions": [],
                "summary": {
                    "total_classes": 0,
                    "total_properties": 0,
                    "total_accounts": len(coa_res.get("accounts", [])),
                    "total_vendors": 0,
                    "total_transactions": 0,
                    "total_assets_balance": coa_res.get("summary", {}).get("total_assets_balance", 0.0),
                    "total_liabilities_balance": coa_res.get("summary", {}).get("total_liabilities_balance", 0.0),
                    "total_equity_balance": coa_res.get("summary", {}).get("total_equity_balance", 0.0),
                    "types_breakdown": coa_res.get("summary", {}).get("types_breakdown", {})
                }
            }
    else:
        # Default try IIF or text
        try:
            text = content_bytes.decode("utf-8", errors="replace")
            return parse_quickbooks_iif(text, filename)
        except Exception:
            return parse_quickbooks_excel(content_bytes, filename)


def execute_quickbooks_migration(
    payload: Dict[str, Any],
    company_manager: Any
) -> Dict[str, Any]:
    """
    Provisions a new .propbooks company file and populates it with:
    1. Company metadata (name, EIN, notes)
    2. Exact Chart of Accounts from QuickBooks with parent/sub hierarchy
    3. Class Entities (LLCs)
    4. Property Assets (Sub-Classes) linked to their Class
    5. Vendors (Addresses, Tax IDs, Contact info)
    6. Starting Opening Balances via journal_engine
    7. Historical Transactions (if selected)
    8. Automatically switches active company to the newly converted file
    """
    company_name = payload.get("company_name", "").strip() or "Migrated QuickBooks Company"
    ein = payload.get("ein")
    notes = payload.get("notes") or f"Converted from QuickBooks on {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    # 1. Create brand new company file and switch to it
    new_comp_info = company_manager.create_new_company(name=company_name, ein=ein, notes=notes)
    company_key = new_comp_info["key"]

    db: Session = company_manager.SessionLocal()
    try:
        # 2. Update company record
        comp = db.query(Company).first()
        if comp:
            comp.name = company_name
            if ein:
                comp.ein = ein
            comp.notes = notes
            db.commit()

        # 3. Populate Chart of Accounts
        accounts = payload.get("accounts", [])
        create_opening_balances = payload.get("create_opening_balances", True)
        if accounts:
            import_quickbooks_coa_to_db(
                accounts=accounts,
                db=db,
                overwrite=True,
                create_opening_balances=create_opening_balances
            )

        # 4. Populate Classes (LLCs)
        classes_data = payload.get("classes", [])
        created_classes_map: Dict[str, ClassEntity] = {}

        for c_data in classes_data:
            c_name = c_data.get("name", "").strip()
            if not c_name:
                continue

            existing = db.query(ClassEntity).filter(ClassEntity.name == c_name).first()
            if not existing:
                new_class = ClassEntity(
                    company_id=comp.id if comp else None,
                    name=c_name,
                    description=c_data.get("description") or f"LLC Entity: {c_name}",
                    entity_type=c_data.get("entity_type") or "LLC",
                    ein=c_data.get("ein") or ein,
                    office_address_line1=c_data.get("office_address_line1"),
                    office_city=c_data.get("office_city"),
                    office_state=c_data.get("office_state"),
                    office_zip=c_data.get("office_zip"),
                    contact_name=c_data.get("contact_name"),
                    contact_phone=c_data.get("contact_phone")
                )
                db.add(new_class)
                db.flush()
                created_classes_map[c_name] = new_class
            else:
                created_classes_map[c_name] = existing

        # 5. Populate Properties (Sub-Classes)
        properties_data = payload.get("properties", [])
        created_properties_map: Dict[str, Property] = {}

        for p_data in properties_data:
            p_name = p_data.get("name", "").strip()
            if not p_name:
                continue

            parent_class_name = p_data.get("class_name", "").strip()
            target_class = created_classes_map.get(parent_class_name)

            # If class wasn't explicitly in classes list, create it
            if parent_class_name and not target_class:
                new_class = ClassEntity(
                    company_id=comp.id if comp else None,
                    name=parent_class_name,
                    entity_type="LLC"
                )
                db.add(new_class)
                db.flush()
                target_class = new_class
                created_classes_map[parent_class_name] = new_class

            existing_prop = db.query(Property).filter(Property.name == p_name).first()
            if not existing_prop:
                new_prop = Property(
                    class_id=target_class.id if target_class else None,
                    name=p_name,
                    address_line1=p_data.get("address_line1"),
                    address_line2=p_data.get("address_line2"),
                    city=p_data.get("city"),
                    state=p_data.get("state"),
                    zip_code=p_data.get("zip_code"),
                    property_type=p_data.get("property_type") or "Residential",
                    units_count=p_data.get("units_count") or 1
                )
                db.add(new_prop)
                db.flush()
                created_properties_map[p_name] = new_prop
                if parent_class_name:
                    created_properties_map[f"{parent_class_name}:{p_name}"] = new_prop
            else:
                created_properties_map[p_name] = existing_prop
                if parent_class_name:
                    created_properties_map[f"{parent_class_name}:{p_name}"] = existing_prop

        # 6. Populate Vendors
        vendors_data = payload.get("vendors", [])
        created_vendors_count = 0
        used_vendor_nums = set()

        for idx, v_data in enumerate(vendors_data, start=1001):
            v_name = v_data.get("name", "").strip()
            if not v_name:
                continue

            v_num = v_data.get("account_number") or f"VEND-{idx}"
            if v_num in used_vendor_nums:
                v_num = f"VEND-{idx + len(used_vendor_nums)}"
            used_vendor_nums.add(v_num)

            # Match default expense category if provided
            default_cat_id = None
            if v_data.get("default_category_name"):
                cat_match = db.query(Category).filter(
                    Category.name.ilike(f"%{v_data['default_category_name']}%")
                ).first()
                if cat_match:
                    default_cat_id = cat_match.id

            new_vendor = Vendor(
                account_number=v_num,
                name=v_name,
                contact_person=v_data.get("contact_person"),
                email=v_data.get("email"),
                phone=v_data.get("phone"),
                tax_id=v_data.get("tax_id"),
                is_1099_eligible=bool(v_data.get("is_1099_eligible") or v_data.get("tax_id")),
                address_line1=v_data.get("address_line1"),
                address_line2=v_data.get("address_line2"),
                city=v_data.get("city"),
                state=v_data.get("state"),
                zip_code=v_data.get("zip_code"),
                default_category_id=default_cat_id,
                notes=v_data.get("notes") or "Imported from QuickBooks"
            )
            db.add(new_vendor)
            created_vendors_count += 1

        # 7. Populate Transactions (if selected)
        import_transactions = payload.get("import_transactions", True)
        transactions_data = payload.get("transactions", [])
        created_txns_count = 0

        if import_transactions and transactions_data:
            # Pre-fetch lookup maps
            all_cats = db.query(Category).all()
            cat_by_name = {c.name.lower().strip(): c for c in all_cats}
            cat_by_num = {c.account_number: c for c in all_cats if c.account_number}

            for t_data in transactions_data:
                t_date = parse_date_str(t_data.get("date"))
                t_month = t_date[:7]
                t_amt = float(t_data.get("amount") or 0.0)
                t_payee = clean_str(t_data.get("payee") or "")
                t_memo = clean_str(t_data.get("memo") or "")
                t_acct = clean_str(t_data.get("account_name") or "")
                t_cls = clean_str(t_data.get("class_name") or "")
                t_prop = clean_str(t_data.get("property_name") or "")

                # Match category
                matched_cat = None
                if t_acct:
                    if t_acct.lower().strip() in cat_by_name:
                        matched_cat = cat_by_name[t_acct.lower().strip()]
                    elif t_acct in cat_by_num:
                        matched_cat = cat_by_num[t_acct]

                # Match class
                matched_cls = created_classes_map.get(t_cls)

                # Match property
                matched_prop = None
                if t_prop:
                    matched_prop = created_properties_map.get(f"{t_cls}:{t_prop}") or created_properties_map.get(t_prop)
                elif matched_cls and matched_cls.properties:
                    matched_prop = matched_cls.properties[0]

                new_txn = Transaction(
                    date=t_date,
                    month=t_month,
                    property_id=matched_prop.id if matched_prop else None,
                    class_id=matched_cls.id if matched_cls else (matched_prop.class_id if matched_prop else None),
                    category_id=matched_cat.id if matched_cat else None,
                    account_name=matched_cat.name if matched_cat else (t_acct or "QuickBooks Transaction"),
                    category_type=matched_cat.type if matched_cat else "OPERATING_EXPENSE",
                    amount=t_amt,
                    description=t_memo or f"QuickBooks import - {t_payee}".strip(),
                    payee=t_payee,
                    source="QUICKBOOKS_IMPORT",
                    is_aggregated=False
                )
                db.add(new_txn)
                created_txns_count += 1

        db.commit()

        # Gather final stats
        final_classes_count = db.query(ClassEntity).count()
        final_props_count = db.query(Property).count()
        final_cats_count = db.query(Category).count()
        final_vendors_count = db.query(Vendor).count()
        final_txns_count = db.query(Transaction).count()

        return {
            "success": True,
            "company_key": company_key,
            "company_name": company_name,
            "accounts_imported": final_cats_count,
            "classes_imported": final_classes_count,
            "properties_imported": final_props_count,
            "vendors_imported": final_vendors_count,
            "transactions_imported": final_txns_count,
            "active_company": new_comp_info,
            "message": (
                f"Successfully converted QuickBooks file into company '{company_name}'! "
                f"Imported {final_classes_count} LLC Entities, {final_props_count} Properties, "
                f"{final_cats_count} Accounts, and {final_vendors_count} Vendors."
            )
        }
    finally:
        db.close()
