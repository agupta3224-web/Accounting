import math
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from .models import CheckRecord, CheckSplit, Category, Property, ClassEntity, Transaction, JournalEntry, JournalEntryLine
from .journal_engine import create_journal_entry

def number_to_words(amount: float) -> str:
    """
    Converts a floating-point dollar amount into standard English check words.
    e.g. 1250.50 -> 'One Thousand Two Hundred Fifty and 50/100 Dollars'
    """
    if amount is None or amount < 0:
        return "Zero and 00/100 Dollars"
    
    cents = int(round((amount - int(amount)) * 100))
    dollars = int(amount)
    
    if dollars == 0:
        return f"Zero and {cents:02d}/100 Dollars"
    
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
    thousands = ["", "Thousand", "Million", "Billion"]
    
    def convert_hundreds(n: int) -> str:
        res = []
        if n >= 100:
            res.append(ones[n // 100] + " Hundred")
            n %= 100
        if n >= 20:
            if n % 10 != 0:
                res.append(tens[n // 10] + "-" + ones[n % 10])
            else:
                res.append(tens[n // 10])
        elif n > 0:
            res.append(ones[n])
        return " ".join(res)
    
    parts = []
    group_idx = 0
    temp_dollars = dollars
    
    while temp_dollars > 0:
        chunk = temp_dollars % 1000
        if chunk > 0:
            chunk_words = convert_hundreds(chunk)
            if thousands[group_idx]:
                chunk_words += " " + thousands[group_idx]
            parts.insert(0, chunk_words)
        temp_dollars //= 1000
        group_idx += 1
        
    words_str = " ".join(parts).strip()
    return f"{words_str} and {cents:02d}/100 Dollars"


def get_next_check_number(db: Session, bank_account_id: Optional[int] = None) -> str:
    """
    Finds the highest numeric check number for the given bank account (or globally)
    and returns next sequential check number (e.g. 1001, 1002...).
    """
    query = db.query(CheckRecord)
    if bank_account_id:
        query = query.filter(CheckRecord.bank_account_id == bank_account_id)
        
    checks = query.all()
    max_num = 1000
    for c in checks:
        num_str = re.sub(r"[^\d]", "", c.check_number or "")
        if num_str.isdigit():
            max_num = max(max_num, int(num_str))
            
    return str(max_num + 1)


def get_bank_account_balance(db: Session, bank_account_id: int) -> float:
    """
    Calculates the current balance of a bank account.
    Standard Asset account balance = Initial + Debits - Credits
    """
    bank_acct = db.query(Category).filter(Category.id == bank_account_id).first()
    if not bank_acct:
        return 0.0
        
    # Include sub-accounts if this account is a parent bank account
    sub_acct_ids = [s.id for s in db.query(Category.id).filter(Category.parent_account_id == bank_account_id).all()]
    all_target_ids = [bank_account_id] + sub_acct_ids

    # Check debits and credits from journal entry lines
    lines = db.query(JournalEntryLine).filter(JournalEntryLine.category_id.in_(all_target_ids)).all()
    total_debits = sum(l.debit for l in lines)
    total_credits = sum(l.credit for l in lines)
    
    # Check if opening balance is already recorded in journal lines
    has_opening_je = any(l.journal_entry and l.journal_entry.source == "OPENING_BALANCE" for l in lines)
    if has_opening_je:
        base_balance = 0.0
    elif bank_acct.opening_balance is not None and bank_acct.opening_balance > 0:
        base_balance = bank_acct.opening_balance
    else:
        # Standard demo default for sample accounts
        base_balance = 25000.0 if any(n in (bank_acct.account_number or "") for n in ["10100", "10010"]) else 10000.0

    return round(base_balance + total_debits - total_credits, 2)


def create_check(
    db: Session,
    bank_account_id: int,
    check_number: str,
    date: str,
    payee: str,
    amount: float,
    address: Optional[str] = None,
    memo: Optional[str] = None,
    splits: Optional[List[Dict[str, Any]]] = None,
    transaction_type: str = "CHECK",
    source: str = "MANUAL"
) -> CheckRecord:
    if not bank_account_id:
        raise ValueError("Bank Account is required to write a check.")
    if not payee or not payee.strip():
        raise ValueError("Pay to the Order of (Payee) is required.")
    if amount <= 0:
        raise ValueError("Check amount must be greater than zero.")
    if not date:
        raise ValueError("Check date is required.")
    if not check_number or not check_number.strip():
        check_number = get_next_check_number(db, bank_account_id)
        
    bank_acct = db.query(Category).filter(Category.id == bank_account_id).first()
    if not bank_acct:
        raise ValueError(f"Selected bank account ID {bank_account_id} not found.")
        
    month = date[:7] if len(date) >= 7 else datetime.now().strftime("%Y-%m")
    words_amount = number_to_words(amount)
    
    # Process splits
    processed_splits = splits or []
    if not processed_splits:
        # Default single split line to Repairs & Maintenance or General Expense
        default_exp = db.query(Category).filter(Category.account_number == "60100").first()
        if not default_exp:
            default_exp = db.query(Category).filter(Category.type == "OPERATING_EXPENSE").first()
        cat_id = default_exp.id if default_exp else bank_account_id
        
        # Default property
        first_prop = db.query(Property).first()
        prop_id = first_prop.id if first_prop else None
        class_id = first_prop.class_id if first_prop else None
        
        processed_splits = [{
            "category_id": cat_id,
            "amount": amount,
            "memo": memo or f"Check #{check_number} - {payee}",
            "class_id": class_id,
            "property_id": prop_id
        }]
    else:
        # Validate splits sum equals check amount
        total_split_amt = sum(float(s.get("amount") or 0.0) for s in processed_splits)
        if abs(total_split_amt - amount) > 0.01:
            raise ValueError(f"The sum of split line amounts (${total_split_amt:,.2f}) must equal the check total amount (${amount:,.2f}).")

    # 1. Create CheckRecord
    check_rec = CheckRecord(
        bank_account_id=bank_account_id,
        check_number=check_number.strip(),
        date=date,
        month=month,
        payee=payee.strip(),
        amount=amount,
        amount_in_words=words_amount,
        address=address or "",
        memo=memo or "",
        transaction_type=transaction_type,
        source=source,
        is_printed=False,
        is_void=False
    )
    db.add(check_rec)
    db.flush()
    
    # 2. Create CheckSplits
    for idx, s in enumerate(processed_splits, start=1):
        c_split = CheckSplit(
            check_id=check_rec.id,
            line_number=idx,
            category_id=s["category_id"],
            amount=float(s.get("amount") or 0.0),
            memo=s.get("memo") or memo or "",
            class_id=s.get("class_id") or None,
            property_id=s.get("property_id") or None
        )
        db.add(c_split)
        
    # 3. Create Corresponding Balanced Journal Entry
    # Credit the Bank Account for the total check amount
    # Debit each split category for its split amount
    je_lines = []
    
    # Expense / Debit lines first
    for s in processed_splits:
        je_lines.append({
            "category_id": s["category_id"],
            "debit": float(s.get("amount") or 0.0),
            "credit": 0.0,
            "memo": s.get("memo") or f"Check #{check_number} to {payee}",
            "class_id": s.get("class_id") or None,
            "property_id": s.get("property_id") or None
        })
        
    # Bank Credit line
    je_lines.append({
        "category_id": bank_account_id,
        "debit": 0.0,
        "credit": amount,
        "memo": f"Check #{check_number} - {payee}",
        "class_id": None,
        "property_id": None
    })
    
    je = create_journal_entry(
        db=db,
        date=date,
        entry_number=f"CHK-{check_number}",
        memo=f"Check #{check_number} - {payee}: {memo or ''}".strip(),
        lines=je_lines,
        source="CHECK",
        reference_id=check_rec.id
    )
    
    check_rec.journal_entry_id = je.id
    db.commit()
    db.refresh(check_rec)
    return check_rec


def void_check(db: Session, check_id: int) -> CheckRecord:
    check = db.query(CheckRecord).filter(CheckRecord.id == check_id).first()
    if not check:
        raise ValueError(f"Check ID {check_id} not found.")
        
    check.is_void = True
    
    # Remove associated Journal Entry and Transactions
    if check.journal_entry_id:
        je = db.query(JournalEntry).filter(JournalEntry.id == check.journal_entry_id).first()
        if je:
            db.query(Transaction).filter(
                Transaction.source == "JOURNAL_ENTRY",
                Transaction.description.like(f"[{je.entry_number}]%")
            ).delete(synchronize_session=False)
            db.delete(je)
            check.journal_entry_id = None
            
    db.commit()
    db.refresh(check)
    return check


def get_checks_list(
    db: Session,
    bank_account_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None
) -> List[CheckRecord]:
    query = db.query(CheckRecord)
    
    if bank_account_id:
        sub_acct_ids = [s.id for s in db.query(Category.id).filter(Category.parent_account_id == bank_account_id).all()]
        all_target_ids = [bank_account_id] + sub_acct_ids
        query = query.filter(CheckRecord.bank_account_id.in_(all_target_ids))
    if from_date:
        query = query.filter(CheckRecord.date >= from_date)
    if to_date:
        query = query.filter(CheckRecord.date <= to_date)
    if search:
        s_term = f"%{search}%"
        query = query.filter(
            (CheckRecord.check_number.ilike(s_term)) |
            (CheckRecord.payee.ilike(s_term)) |
            (CheckRecord.memo.ilike(s_term))
        )
        
    return query.order_by(CheckRecord.date.desc(), CheckRecord.id.desc()).all()


def render_check_voucher_html(check: CheckRecord) -> str:
    """
    Renders standard QuickBooks 3-part check voucher HTML printable layout.
    """
    bank_name = check.bank_account.name if check.bank_account else "Operating Checking"
    splits_rows = ""
    for s in check.splits:
        cat_disp = f"[{s.category.account_number}] {s.category.name}" if (s.category and s.category.account_number) else (s.category.name if s.category else "")
        prop_disp = s.property.name if s.property else (s.class_entity.name if s.class_entity else "")
        splits_rows += f"""
        <tr>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">{cat_disp}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">{s.memo or ''}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">{prop_disp}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${s.amount:,.2f}</td>
        </tr>
        """
        
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Check #{check.check_number} - {check.payee}</title>
        <style>
            @media print {{
                body {{ margin: 0; padding: 0; background: white; }}
                .no-print {{ display: none !important; }}
                .page-break {{ page-break-after: always; }}
            }}
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #1e293b;
                background-color: #f8fafc;
                margin: 0;
                padding: 20px;
            }}
            .check-container {{
                max-width: 800px;
                margin: 0 auto;
                background: white;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }}
            .check-paper {{
                background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
                border: 2px solid #059669;
                border-radius: 6px;
                padding: 24px;
                margin: 16px;
                position: relative;
            }}
            .watermark {{
                position: absolute;
                top: 40%;
                left: 30%;
                font-size: 60px;
                color: rgba(5, 150, 105, 0.06);
                transform: rotate(-25deg);
                pointer-events: none;
                font-weight: 900;
                text-transform: uppercase;
            }}
            .void-stamp {{
                position: absolute;
                top: 30%;
                left: 35%;
                font-size: 70px;
                color: rgba(225, 29, 72, 0.4);
                transform: rotate(-20deg);
                pointer-events: none;
                font-weight: 900;
                border: 5px solid rgba(225, 29, 72, 0.4);
                padding: 5px 25px;
                border-radius: 12px;
            }}
            .voucher-stub {{
                padding: 20px;
                border-top: 2px dashed #94a3b8;
                background: white;
            }}
            .btn-print {{
                background: #059669;
                color: white;
                border: none;
                padding: 10px 20px;
                font-weight: 600;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
        </style>
    </head>
    <body>
        <div class="no-print" style="max-width: 800px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; color: #0f172a; font-size: 18px;">QuickBooks Format Check Voucher</h2>
            <button class="btn-print" onclick="window.print()">🖨️ Print Check Voucher</button>
        </div>

        <div class="check-container">
            <!-- TOP: THE PHYSICAL CHECK -->
            <div class="check-paper">
                {"<div class='void-stamp'>VOID</div>" if check.is_void else ""}
                <div class="watermark">PROPBOOKS</div>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <div>
                        <div style="font-size: 18px; font-weight: 800; color: #065f46; letter-spacing: -0.5px;">PROPBOOKS PROPERTY MANAGEMENT</div>
                        <div style="font-size: 11px; color: #047857;">Real Estate Trust & Operating Account</div>
                        <div style="font-size: 11px; color: #475569; margin-top: 4px;">Bank: {bank_name}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: 800; color: #0f172a;">CHECK #{check.check_number}</div>
                        <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 4px;">DATE: <span style="border-bottom: 1px solid #334155; padding: 2px 10px;">{check.date}</span></div>
                    </div>
                </div>

                <!-- PAY TO THE ORDER OF -->
                <div style="display: flex; align-items: baseline; margin-bottom: 16px; background: rgba(255,255,255,0.7); padding: 8px 12px; border-radius: 4px; border: 1px solid #cbd5e1;">
                    <span style="font-size: 12px; font-weight: 700; color: #065f46; width: 140px;">PAY TO THE ORDER OF:</span>
                    <span style="font-size: 16px; font-weight: 800; color: #0f172a; flex-grow: 1;">{check.payee}</span>
                    <span style="font-size: 18px; font-weight: 800; color: #0f172a; background: #ecfdf5; border: 1.5px solid #059669; padding: 4px 12px; border-radius: 4px;">${check.amount:,.2f}</span>
                </div>

                <!-- AMOUNT IN WORDS -->
                <div style="display: flex; align-items: baseline; margin-bottom: 20px; border-bottom: 1.5px solid #94a3b8; padding-bottom: 4px;">
                    <span style="font-size: 14px; font-weight: 700; color: #0f172a; font-style: italic;">{check.amount_in_words}</span>
                </div>

                <!-- ADDRESS & MEMO & SIGNATURE -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="font-size: 11px; color: #475569; max-width: 250px;">
                        <div style="font-weight: 700; color: #334155; margin-bottom: 2px;">MAIL TO:</div>
                        <div style="white-space: pre-line; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">{check.address or check.payee}</div>
                        <div style="margin-top: 10px; font-size: 12px; font-weight: 600; color: #0f172a;">MEMO: <span style="border-bottom: 1px solid #64748b; padding: 0 10px;">{check.memo or ''}</span></div>
                    </div>
                    <div style="text-align: center; width: 220px;">
                        <div style="border-bottom: 1.5px solid #334155; height: 35px;"></div>
                        <div style="font-size: 11px; font-weight: 700; color: #334155; margin-top: 4px;">AUTHORIZED SIGNATURE</div>
                    </div>
                </div>
            </div>

            <!-- MIDDLE: VOUCHER STUB / EXPENSE ALLOCATION -->
            <div class="voucher-stub">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569;">Voucher / Expense Breakdown</span>
                    <span style="font-size: 12px; font-weight: 700; color: #0f172a;">Check #{check.check_number} &bull; {check.date} &bull; Total: ${check.amount:,.2f}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                            <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1;">Account</th>
                            <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1;">Memo</th>
                            <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1;">Class / Property</th>
                            <th style="padding: 6px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {splits_rows}
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    """
    return html
