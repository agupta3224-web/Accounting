import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .models import JournalEntry, JournalEntryLine, Category, ClassEntity, Property, Transaction

def get_next_journal_entry_number(db: Session) -> str:
    """
    Generates the next sequential Journal Entry number, e.g. JE-1001, JE-1002...
    """
    last_entry = db.query(JournalEntry).order_by(JournalEntry.id.desc()).first()
    if not last_entry or not last_entry.entry_number:
        return "JE-1001"
    
    # Extract numeric part
    match = re.search(r"(\d+)", last_entry.entry_number)
    if match:
        num = int(match.group(1)) + 1
        prefix = last_entry.entry_number[:match.start()] or "JE-"
        return f"{prefix}{num}"
    
    return f"JE-{last_entry.id + 1001}"


def validate_journal_entry_payload(
    date: str,
    lines: List[Dict[str, Any]]
) -> Tuple[bool, str]:
    if not date:
        return False, "Date is required for the journal entry."
    
    if not lines or len(lines) < 2:
        return False, "A General Journal Entry must contain at least 2 lines for double-entry balancing."
    
    total_debits = 0.0
    total_credits = 0.0
    
    for idx, line in enumerate(lines, start=1):
        cat_id = line.get("category_id")
        if not cat_id:
            return False, f"Line {idx}: Account is required."
        
        debit = float(line.get("debit") or 0.0)
        credit = float(line.get("credit") or 0.0)
        
        if debit < 0 or credit < 0:
            return False, f"Line {idx}: Debit and Credit amounts cannot be negative."
        
        if debit > 0 and credit > 0:
            return False, f"Line {idx}: A single line cannot have both a Debit and a Credit amount."
        
        if debit == 0 and credit == 0:
            return False, f"Line {idx}: Please enter either a Debit or Credit amount."
        
        total_debits += debit
        total_credits += credit
        
    if total_debits <= 0 or total_credits <= 0:
        return False, "Journal entry amounts must be greater than zero."
        
    diff = abs(total_debits - total_credits)
    if diff > 0.005:
        return False, f"Journal entry is out of balance. Total Debits (${total_debits:,.2f}) must equal Total Credits (${total_credits:,.2f}). Difference: ${diff:,.2f}."
        
    return True, "Valid"


def create_journal_entry(
    db: Session,
    date: str,
    entry_number: Optional[str],
    memo: Optional[str],
    lines: List[Dict[str, Any]],
    source: str = "GENERAL_JOURNAL",
    reference_id: Optional[int] = None
) -> JournalEntry:
    is_valid, err_msg = validate_journal_entry_payload(date, lines)
    if not is_valid:
        raise ValueError(err_msg)
    
    entry_num = entry_number.strip() if entry_number and entry_number.strip() else get_next_journal_entry_number(db)
    
    # Check if entry_number already exists
    existing = db.query(JournalEntry).filter(JournalEntry.entry_number == entry_num).first()
    if existing:
        entry_num = get_next_journal_entry_number(db)
        
    month = date[:7] if len(date) >= 7 else datetime.now().strftime("%Y-%m")
    
    je = JournalEntry(
        entry_number=entry_num,
        date=date,
        month=month,
        memo=memo or "",
        source=source,
        reference_id=reference_id
    )
    db.add(je)
    db.flush() # get je.id
    
    # Process lines
    for idx, line_data in enumerate(lines, start=1):
        cat_id = line_data["category_id"]
        debit = float(line_data.get("debit") or 0.0)
        credit = float(line_data.get("credit") or 0.0)
        line_memo = line_data.get("memo") or line_data.get("notes") or memo or ""
        class_id = line_data.get("class_id") or None
        property_id = line_data.get("property_id") or None
        
        # If property is given but not class, lookup class from property
        if property_id and not class_id:
            prop = db.query(Property).filter(Property.id == property_id).first()
            if prop and prop.class_id:
                class_id = prop.class_id
        # If class is given but not property, find first property under class
        elif class_id and not property_id:
            prop = db.query(Property).filter(Property.class_id == class_id).first()
            if prop:
                property_id = prop.id
                
        je_line = JournalEntryLine(
            journal_entry_id=je.id,
            line_number=idx,
            category_id=cat_id,
            debit=debit,
            credit=credit,
            memo=line_memo,
            class_id=class_id,
            property_id=property_id
        )
        db.add(je_line)
        
        # Sync to Transaction table for P&L and Property financial reports if it has an associated property
        # and represents an Income or Expense/CapEx entry
        category = db.query(Category).filter(Category.id == cat_id).first()
        if category and property_id:
            txn_amount = 0.0
            cat_type = category.type
            
            # For expense accounts, debit increases expense
            if cat_type in ["OPERATING_EXPENSE", "COGS", "CAPEX", "OTHER_INCOME_EXPENSE", "NON_OPERATING_EXPENSE"] and debit > 0:
                txn_amount = debit
            # For revenue/income accounts, credit increases income
            elif cat_type in ["INCOME", "REVENUE"] and credit > 0:
                txn_amount = credit
                
            if txn_amount > 0:
                txn = Transaction(
                    date=date,
                    month=month,
                    property_id=property_id,
                    class_id=class_id,
                    category_id=category.id,
                    account_name=category.name,
                    category_type=cat_type,
                    amount=txn_amount,
                    description=f"[{je.entry_number}] {line_memo}".strip(),
                    payee=memo or "Journal Entry",
                    source="JOURNAL_ENTRY",
                    is_aggregated=False
                )
                db.add(txn)
                
    db.commit()
    db.refresh(je)
    return je


def get_journal_entries_list(
    db: Session,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    class_id: Optional[int] = None,
    search: Optional[str] = None
) -> List[JournalEntry]:
    query = db.query(JournalEntry)
    
    if from_date:
        query = query.filter(JournalEntry.date >= from_date)
    if to_date:
        query = query.filter(JournalEntry.date <= to_date)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (JournalEntry.entry_number.ilike(search_term)) |
            (JournalEntry.memo.ilike(search_term))
        )
        
    entries = query.order_by(JournalEntry.date.desc(), JournalEntry.id.desc()).all()
    
    if class_id:
        # Filter entries where at least one line has this class_id
        filtered = []
        for e in entries:
            if any(l.class_id == class_id for l in e.lines):
                filtered.append(e)
        return filtered
        
    return entries


def delete_journal_entry(db: Session, entry_id: int) -> bool:
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        return False
    
    # Remove associated transactions if any
    db.query(Transaction).filter(
        Transaction.source == "JOURNAL_ENTRY",
        Transaction.description.like(f"[{je.entry_number}]%")
    ).delete(synchronize_session=False)
    
    db.delete(je)
    db.commit()
    return True


def record_opening_balance_entry(
    db: Session,
    account: Category,
    opening_balance: float,
    opening_date: Optional[str] = None
) -> Optional[JournalEntry]:
    """
    Creates or updates the double-entry opening balance journal entry for an account.
    Standard QuickBooks double-entry logic:
    - Asset accounts: Debit Asset, Credit Opening Balance Equity.
    - Liability accounts: Credit Liability, Debit Opening Balance Equity.
    - Equity accounts: Credit Equity, Debit Opening Balance Equity.
    """
    if not opening_balance or opening_balance <= 0:
        return None

    date = opening_date.strip() if opening_date and opening_date.strip() else datetime.now().strftime("%Y-%m-%d")
    month = date[:7]

    # Resolve or create Opening Balance Equity account
    equity_account = db.query(Category).filter(
        (Category.name.ilike("%Opening Balance Equity%")) |
        (Category.account_number == "39000")
    ).first()

    if not equity_account:
        equity_account = Category(
            account_number="39000",
            name="Opening Balance Equity",
            type="EQUITY",
            sub_type="Opening Balance Equity",
            description="Offsetting equity account for historical starting balances",
            is_active=True
        )
        db.add(equity_account)
        db.commit()
        db.refresh(equity_account)

    # Check if an existing opening balance journal entry exists for this account
    entry_marker = f"JE-OPEN-{account.account_number or account.id}"
    existing_je = db.query(JournalEntry).filter(
        (JournalEntry.entry_number == entry_marker) |
        ((JournalEntry.source == "OPENING_BALANCE") & (JournalEntry.reference_id == account.id))
    ).first()

    if existing_je:
        db.query(JournalEntryLine).filter(JournalEntryLine.journal_entry_id == existing_je.id).delete()
        je = existing_je
        je.date = date
        je.month = month
        je.memo = f"Opening Balance - [{account.account_number or ''}] {account.name}"
    else:
        je = JournalEntry(
            entry_number=entry_marker,
            date=date,
            month=month,
            memo=f"Opening Balance - [{account.account_number or ''}] {account.name}",
            source="OPENING_BALANCE",
            reference_id=account.id
        )
        db.add(je)
        db.flush()

    acct_type = (account.type or "").upper()
    if acct_type in ["ASSET", "BANK"]:
        line1 = JournalEntryLine(
            journal_entry_id=je.id,
            line_number=1,
            category_id=account.id,
            debit=round(opening_balance, 2),
            credit=0.0,
            memo=f"Opening Balance as of {date}"
        )
        line2 = JournalEntryLine(
            journal_entry_id=je.id,
            line_number=2,
            category_id=equity_account.id,
            debit=0.0,
            credit=round(opening_balance, 2),
            memo=f"Opening Balance offset for {account.name}"
        )
    else:
        line1 = JournalEntryLine(
            journal_entry_id=je.id,
            line_number=1,
            category_id=account.id,
            debit=0.0,
            credit=round(opening_balance, 2),
            memo=f"Opening Balance as of {date}"
        )
        line2 = JournalEntryLine(
            journal_entry_id=je.id,
            line_number=2,
            category_id=equity_account.id,
            debit=round(opening_balance, 2),
            credit=0.0,
            memo=f"Opening Balance offset for {account.name}"
        )

    db.add_all([line1, line2])
    db.commit()
    db.refresh(je)
    return je


def compute_account_balance(db: Session, account: Category) -> float:
    """
    Computes current net account balance taking into account opening balance and journal entries.
    """
    lines = db.query(JournalEntryLine).filter(JournalEntryLine.category_id == account.id).all()
    total_debits = sum(l.debit for l in lines)
    total_credits = sum(l.credit for l in lines)
    
    acct_type = (account.type or "").upper()
    if len(lines) > 0:
        if acct_type in ["ASSET", "BANK", "OPERATING_EXPENSE", "COGS", "CAPEX"]:
            return round(total_debits - total_credits, 2)
        else:
            return round(total_credits - total_debits, 2)
    else:
        return round(account.opening_balance or 0.0, 2)

