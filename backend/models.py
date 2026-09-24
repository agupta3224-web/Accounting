from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class Company(Base):
    __tablename__ = 'companies'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    ein = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    classes = relationship('ClassEntity', back_populates='company', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'ein': self.ein,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'classes_count': len(self.classes) if self.classes else 0
        }

class ClassEntity(Base):
    """
    Represents the LLC entity under a Company.
    """
    __tablename__ = 'classes'

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=True, index=True)
    name = Column(String(150), nullable=False, index=True) # LLC / Corp Name
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Entity Structure Attributes
    entity_type = Column(String(50), nullable=True, default='LLC') # CORP, LLC, SELF_EMPLOYED
    tax_classification = Column(String(50), nullable=True) # S_CORP, C_CORP, SINGLE_MEMBER_DISREGARDED, MULTI_MEMBER, SOLE_PROPRIETOR
    tax_form = Column(String(50), nullable=True) # Form 1120-S, Form 1120, Form 1065, Schedule E, Schedule C
    ein = Column(String(50), nullable=True)
    
    office_address_line1 = Column(String(255), nullable=True)
    office_address_line2 = Column(String(255), nullable=True)
    office_city = Column(String(100), nullable=True)
    office_state = Column(String(50), nullable=True)
    office_zip = Column(String(20), nullable=True)

    mailing_address_line1 = Column(String(255), nullable=True)
    mailing_address_line2 = Column(String(255), nullable=True)
    mailing_city = Column(String(100), nullable=True)
    mailing_state = Column(String(50), nullable=True)
    mailing_zip = Column(String(20), nullable=True)

    contact_name = Column(String(150), nullable=True)
    contact_phone = Column(String(50), nullable=True)

    company = relationship('Company', back_populates='classes')
    properties = relationship('Property', back_populates='class_entity', cascade='all, delete-orphan')
    transactions = relationship('Transaction', back_populates='class_entity')

    def formatted_office_address(self):
        parts = []
        if self.office_address_line1:
            parts.append(self.office_address_line1)
        if self.office_address_line2:
            parts.append(self.office_address_line2)
        loc = []
        if self.office_city:
            loc.append(self.office_city)
        if self.office_state:
            loc.append(self.office_state)
        if loc:
            parts.append(', '.join(loc))
        if self.office_zip:
            parts.append(self.office_zip)
        return ' '.join(parts) if parts else ''

    def formatted_mailing_address(self):
        parts = []
        if self.mailing_address_line1:
            parts.append(self.mailing_address_line1)
        if self.mailing_address_line2:
            parts.append(self.mailing_address_line2)
        loc = []
        if self.mailing_city:
            loc.append(self.mailing_city)
        if self.mailing_state:
            loc.append(self.mailing_state)
        if loc:
            parts.append(', '.join(loc))
        if self.mailing_zip:
            parts.append(self.mailing_zip)
        return ' '.join(parts) if parts else ''

    def to_dict(self):
        return {
            'id': self.id,
            'company_id': self.company_id,
            'company_name': self.company.name if self.company else 'Unassigned Company',
            'name': self.name,
            'description': self.description,
            'entity_type': self.entity_type or 'LLC',
            'tax_classification': self.tax_classification,
            'tax_form': self.tax_form,
            'ein': self.ein,
            'office_address_line1': self.office_address_line1,
            'office_address_line2': self.office_address_line2,
            'office_city': self.office_city,
            'office_state': self.office_state,
            'office_zip': self.office_zip,
            'office_address': self.formatted_office_address(),
            'mailing_address_line1': self.mailing_address_line1,
            'mailing_address_line2': self.mailing_address_line2,
            'mailing_city': self.mailing_city,
            'mailing_state': self.mailing_state,
            'mailing_zip': self.mailing_zip,
            'mailing_address': self.formatted_mailing_address(),
            'contact_name': self.contact_name,
            'contact_phone': self.contact_phone,
            'properties_count': len(self.properties) if self.properties else 0
        }

class Property(Base):
    """
    Represents the Sub-Class (Property Asset) under an LLC (Class).
    Includes dedicated address form fields: Line 1, Line 2, City, State, Zip.
    """
    __tablename__ = 'properties'

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey('classes.id'), nullable=True, index=True) # LLC foreign key
    name = Column(String(255), nullable=False, index=True) # Sub-Class Name (e.g. 2908 Depot)
    address_line1 = Column(String(255), nullable=True) # Address Line 1
    address_line2 = Column(String(255), nullable=True) # Address Line 2
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    
    address = Column(String(500), nullable=True) # Full formatted address cache
    property_type = Column(String(100), default='Residential')
    units_count = Column(Integer, default=1)
    acquisition_cost = Column(Float, nullable=True) # Optional Acquisition Cost
    acquisition_date = Column(String(20), nullable=True) # Optional Acquisition Date (YYYY-MM-DD)
    unit_number = Column(String(50), nullable=True) # Optional Apartment / Unit Number
    parent_property_id = Column(Integer, ForeignKey('properties.id'), nullable=True) # Optional building parent
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    class_entity = relationship('ClassEntity', back_populates='properties')
    transactions = relationship('Transaction', back_populates='property', cascade='all, delete-orphan')
    statements = relationship('Statement', back_populates='property')

    def formatted_address(self):
        parts = []
        if self.address_line1:
            parts.append(self.address_line1)
        if self.address_line2:
            parts.append(self.address_line2)
        loc = []
        if self.city:
            loc.append(self.city)
        if self.state:
            loc.append(self.state)
        if loc:
            parts.append(', '.join(loc))
        if self.zip_code:
            parts.append(self.zip_code)
        return ' '.join(parts) if parts else (self.address or '')

    def to_dict(self):
        full_addr = self.formatted_address()
        return {
            'id': self.id,
            'class_id': self.class_id,
            'class_name': self.class_entity.name if self.class_entity else 'Unassigned LLC',
            'company_id': self.class_entity.company_id if self.class_entity else None,
            'company_name': self.class_entity.company.name if self.class_entity and self.class_entity.company else 'Unassigned Company',
            'name': self.name,
            'address_line1': self.address_line1 or '',
            'address_line2': self.address_line2 or '',
            'city': self.city or '',
            'state': self.state or '',
            'zip_code': self.zip_code or '',
            'address': full_addr,
            'property_type': self.property_type,
            'units_count': self.units_count,
            'acquisition_cost': self.acquisition_cost,
            'acquisition_date': self.acquisition_date,
            'unit_number': self.unit_number,
            'parent_property_id': self.parent_property_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Category(Base):
    """
    Represents an Account in the Chart of Accounts (COA).
    Supports 5-digit standard accounting numbering:
    - 1xxxx (10000 - 19999): Assets
    - 2xxxx (20000 - 29999): Payables & Liabilities
    - 3xxxx (30000 - 39999): Equities
    - 4xxxx (40000 - 49999): Revenue and Income
    - 5xxxx (50000 - 59999): Cost of Goods Sold (COGS)
    - 6xxxx - 8xxxx (60000 - 89999): Operating Expenses
    - 9xxxx (90000 - 99999): Other Income / Other Expenses
    """
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    account_number = Column(String(20), nullable=True, index=True) # e.g. 10010, 20100, 40100
    name = Column(String(150), nullable=False, index=True)
    type = Column(String(50), nullable=False, default='OPERATING_EXPENSE')
    sub_type = Column(String(100), nullable=True) # e.g. Bank, Accounts Payable, Rental Revenue
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    is_repair_category = Column(Boolean, default=False)
    is_rental_income = Column(Boolean, default=False)
    parent_account_id = Column(Integer, ForeignKey('categories.id'), nullable=True, index=True)
    opening_balance = Column(Float, nullable=True, default=0.0)
    opening_balance_date = Column(String(10), nullable=True) # YYYY-MM-DD
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    transactions = relationship('Transaction', back_populates='category')
    parent_account = relationship('Category', remote_side=[id], backref='sub_accounts')

    def to_dict(self):
        acct_num = self.account_number or ''
        disp = f"[{acct_num}] {self.name}" if acct_num else self.name
        return {
            'id': self.id,
            'account_number': acct_num,
            'name': self.name,
            'display_name': disp,
            'type': self.type,
            'sub_type': self.sub_type or '',
            'description': self.description or '',
            'is_active': True if self.is_active is None else self.is_active,
            'is_repair_category': bool(self.is_repair_category),
            'is_rental_income': bool(self.is_rental_income),
            'parent_account_id': self.parent_account_id,
            'parent_account_name': self.parent_account.name if self.parent_account else None,
            'parent_account_number': self.parent_account.account_number if self.parent_account else None,
            'sub_accounts_count': len(self.sub_accounts) if self.sub_accounts else 0,
            'is_sub_account': bool(self.parent_account_id),
            'transactions_count': len(self.transactions) if self.transactions else 0,
            'opening_balance': round(self.opening_balance or 0.0, 2),
            'opening_balance_date': self.opening_balance_date,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Alias for Chart of Accounts terminology
Account = Category

class Statement(Base):
    __tablename__ = 'statements'

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    upload_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=True)
    month = Column(String(7), nullable=True) # YYYY-MM
    status = Column(String(50), default='PROCESSED')
    row_count = Column(Integer, default=0)
    consolidated_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)

    property = relationship('Property', back_populates='statements')
    transactions = relationship('Transaction', back_populates='statement')

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'file_type': self.file_type,
            'upload_date': self.upload_date.isoformat() if self.upload_date else None,
            'property_id': self.property_id,
            'property_name': self.property.name if self.property else 'Unassigned',
            'month': self.month,
            'status': self.status,
            'row_count': self.row_count,
            'consolidated_count': self.consolidated_count,
            'notes': self.notes
        }

class Transaction(Base):
    __tablename__ = 'transactions'

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    month = Column(String(7), nullable=False, index=True) # YYYY-MM
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=False, index=True)
    class_id = Column(Integer, ForeignKey('classes.id'), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=True, index=True)
    
    account_name = Column(String(255), nullable=False, index=True)
    category_type = Column(String(50), nullable=False, default='OPERATING_EXPENSE')
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    payee = Column(String(255), nullable=True)
    source = Column(String(50), default='IMPORTED') # IMPORTED, MANUAL
    statement_id = Column(Integer, ForeignKey('statements.id'), nullable=True)
    
    is_aggregated = Column(Boolean, default=False)
    raw_aggregated_items = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    property = relationship('Property', back_populates='transactions')
    class_entity = relationship('ClassEntity', back_populates='transactions')
    category = relationship('Category', back_populates='transactions')
    statement = relationship('Statement', back_populates='transactions')

    def to_dict(self):
        aggregated_data = None
        if self.raw_aggregated_items:
            try:
                aggregated_data = json.loads(self.raw_aggregated_items)
            except Exception:
                aggregated_data = None

        prop_name = self.property.name if self.property else 'Unknown'
        llc_name = self.class_entity.name if self.class_entity else (self.property.class_entity.name if self.property and self.property.class_entity else 'General')
        company_name = self.property.class_entity.company.name if self.property and self.property.class_entity and self.property.class_entity.company else 'General'

        cat_num = self.category.account_number if self.category else ''
        cat_disp = f"[{cat_num}] {self.category.name}" if (self.category and cat_num) else (self.category.name if self.category else self.account_name)

        return {
            'id': self.id,
            'date': self.date,
            'month': self.month,
            'property_id': self.property_id,
            'property_name': prop_name,
            'class_id': self.class_id,
            'class_name': llc_name,
            'company_name': company_name,
            'category_id': self.category_id,
            'category_account_number': cat_num,
            'category_name': self.category.name if self.category else self.account_name,
            'category_display_name': cat_disp,
            'category_type': self.category_type,
            'account_name': self.account_name,
            'amount': round(self.amount, 2),
            'description': self.description or '',
            'payee': self.payee or '',
            'source': self.source,
            'statement_id': self.statement_id,
            'is_aggregated': self.is_aggregated,
            'raw_aggregated_items': aggregated_data,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class JournalEntry(Base):
    """
    Represents a General Journal Entry header.
    Contains date, entry number, overall memo, and links to multi-line double-entry lines.
    """
    __tablename__ = 'journal_entries'

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(50), nullable=False, unique=True, index=True) # e.g. JE-1001
    date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    month = Column(String(7), nullable=False, index=True) # YYYY-MM
    memo = Column(Text, nullable=True)
    source = Column(String(50), default='GENERAL_JOURNAL') # GENERAL_JOURNAL, CHECK
    reference_id = Column(Integer, nullable=True) # Check ID if originated from check
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lines = relationship('JournalEntryLine', back_populates='journal_entry', cascade='all, delete-orphan')

    def to_dict(self):
        line_dicts = [l.to_dict() for l in sorted(self.lines, key=lambda x: x.line_number or 0)] if self.lines else []
        total_debits = sum(l.debit for l in self.lines) if self.lines else 0.0
        total_credits = sum(l.credit for l in self.lines) if self.lines else 0.0
        return {
            'id': self.id,
            'entry_number': self.entry_number,
            'date': self.date,
            'month': self.month,
            'memo': self.memo or '',
            'source': self.source,
            'reference_id': self.reference_id,
            'total_debit': round(total_debits, 2),
            'total_credit': round(total_credits, 2),
            'is_balanced': abs(total_debits - total_credits) < 0.005,
            'lines': line_dicts,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class JournalEntryLine(Base):
    """
    Represents an individual line item of a General Journal Entry.
    Columns: Account, Debit Amount, Credit Amount, Notes, Class, Property.
    """
    __tablename__ = 'journal_entry_lines'

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey('journal_entries.id'), nullable=False, index=True)
    line_number = Column(Integer, default=1)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False, index=True)
    
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    memo = Column(Text, nullable=True) # Notes
    
    class_id = Column(Integer, ForeignKey('classes.id'), nullable=True, index=True) # LLC (Class)
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=True, index=True) # Property (Sub-Class)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    journal_entry = relationship('JournalEntry', back_populates='lines')
    category = relationship('Category')
    class_entity = relationship('ClassEntity')
    property = relationship('Property')

    def to_dict(self):
        cat_disp = self.category.display_name if hasattr(self.category, 'display_name') else (self.category.name if self.category else '')
        if self.category and self.category.account_number:
            cat_disp = f"[{self.category.account_number}] {self.category.name}"
            
        return {
            'id': self.id,
            'journal_entry_id': self.journal_entry_id,
            'line_number': self.line_number,
            'category_id': self.category_id,
            'account_number': self.category.account_number if self.category else '',
            'account_name': self.category.name if self.category else '',
            'account_display': cat_disp,
            'account_type': self.category.type if self.category else '',
            'debit': round(self.debit or 0.0, 2),
            'credit': round(self.credit or 0.0, 2),
            'memo': self.memo or '',
            'class_id': self.class_id,
            'class_name': self.class_entity.name if self.class_entity else '',
            'property_id': self.property_id,
            'property_name': self.property.name if self.property else '',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class CheckRecord(Base):
    """
    Represents a Check written in QuickBooks Desktop format.
    Includes Bank Account, Check #, Date, Payee, Amount, Words Amount, Address, Memo, and Splits.
    """
    __tablename__ = 'check_records'

    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey('categories.id'), nullable=False, index=True)
    check_number = Column(String(50), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    month = Column(String(7), nullable=False, index=True) # YYYY-MM
    payee = Column(String(255), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    amount_in_words = Column(String(500), nullable=True) # English words representation
    address = Column(Text, nullable=True) # Payee address
    memo = Column(Text, nullable=True)
    is_printed = Column(Boolean, default=False)
    is_void = Column(Boolean, default=False)
    transaction_type = Column(String(50), default='CHECK') # CHECK, ACH, DEBIT, DEPOSIT
    source = Column(String(50), default='MANUAL') # MANUAL, BANK_IMPORT
    journal_entry_id = Column(Integer, ForeignKey('journal_entries.id'), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    bank_account = relationship('Category', foreign_keys=[bank_account_id])
    journal_entry = relationship('JournalEntry')
    splits = relationship('CheckSplit', back_populates='check_record', cascade='all, delete-orphan')

    def to_dict(self):
        split_dicts = [s.to_dict() for s in sorted(self.splits, key=lambda x: x.line_number or 0)] if self.splits else []
        bank_disp = f"[{self.bank_account.account_number}] {self.bank_account.name}" if (self.bank_account and self.bank_account.account_number) else (self.bank_account.name if self.bank_account else 'Unknown Bank')
        return {
            'id': self.id,
            'bank_account_id': self.bank_account_id,
            'bank_account_number': self.bank_account.account_number if self.bank_account else '',
            'bank_account_name': self.bank_account.name if self.bank_account else '',
            'bank_account_display': bank_disp,
            'check_number': self.check_number,
            'date': self.date,
            'month': self.month,
            'payee': self.payee,
            'amount': round(self.amount, 2),
            'amount_in_words': self.amount_in_words or '',
            'address': self.address or '',
            'memo': self.memo or '',
            'is_printed': bool(self.is_printed),
            'is_void': bool(self.is_void),
            'transaction_type': self.transaction_type or 'CHECK',
            'source': self.source or 'MANUAL',
            'journal_entry_id': self.journal_entry_id,
            'splits': split_dicts,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class CheckSplit(Base):
    """
    Represents an expense/account split row for a written check.
    """
    __tablename__ = 'check_splits'

    id = Column(Integer, primary_key=True, index=True)
    check_id = Column(Integer, ForeignKey('check_records.id'), nullable=False, index=True)
    line_number = Column(Integer, default=1)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False, index=True) # Split account
    amount = Column(Float, nullable=False)
    memo = Column(Text, nullable=True)
    class_id = Column(Integer, ForeignKey('classes.id'), nullable=True, index=True) # LLC
    property_id = Column(Integer, ForeignKey('properties.id'), nullable=True, index=True) # Property
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    check_record = relationship('CheckRecord', back_populates='splits')
    category = relationship('Category')
    class_entity = relationship('ClassEntity')
    property = relationship('Property')

    def to_dict(self):
        cat_disp = f"[{self.category.account_number}] {self.category.name}" if (self.category and self.category.account_number) else (self.category.name if self.category else '')
        return {
            'id': self.id,
            'check_id': self.check_id,
            'line_number': self.line_number,
            'category_id': self.category_id,
            'account_number': self.category.account_number if self.category else '',
            'account_name': self.category.name if self.category else '',
            'account_display': cat_disp,
            'account_type': self.category.type if self.category else '',
            'amount': round(self.amount, 2),
            'memo': self.memo or '',
            'class_id': self.class_id,
            'class_name': self.class_entity.name if self.class_entity else '',
            'property_id': self.property_id,
            'property_name': self.property.name if self.property else '',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Vendor(Base):
    """
    Represents a Vendor / Payee in the accounting system.
    Stores Account Number, Name, Full Address, Contact info, Tax ID (1099), and Default Expense Account.
    """
    __tablename__ = 'vendors'

    id = Column(Integer, primary_key=True, index=True)
    account_number = Column(String(50), nullable=False, unique=True, index=True) # e.g. VEND-1001
    name = Column(String(255), nullable=False, index=True) # Vendor Company / Contractor Name
    contact_person = Column(String(150), nullable=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    tax_id = Column(String(50), nullable=True) # SSN / EIN for 1099
    is_1099_eligible = Column(Boolean, default=False)
    
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True) # Formatted full address
    
    default_category_id = Column(Integer, ForeignKey('categories.id'), nullable=True, index=True) # Default Expense Account
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    default_category = relationship('Category')

    def formatted_address(self):
        parts = []
        if self.address_line1: parts.append(self.address_line1)
        if self.address_line2: parts.append(self.address_line2)
        loc = []
        if self.city: loc.append(self.city)
        if self.state: loc.append(self.state)
        if loc: parts.append(', '.join(loc))
        if self.zip_code: parts.append(self.zip_code)
        return ' '.join(parts) if parts else (self.address or '')

    def to_dict(self):
        full_addr = self.formatted_address()
        cat_disp = f"[{self.default_category.account_number}] {self.default_category.name}" if (self.default_category and self.default_category.account_number) else (self.default_category.name if self.default_category else '')
        return {
            'id': self.id,
            'account_number': self.account_number,
            'name': self.name,
            'contact_person': self.contact_person or '',
            'email': self.email or '',
            'phone': self.phone or '',
            'tax_id': self.tax_id or '',
            'is_1099_eligible': bool(self.is_1099_eligible),
            'address_line1': self.address_line1 or '',
            'address_line2': self.address_line2 or '',
            'city': self.city or '',
            'state': self.state or '',
            'zip_code': self.zip_code or '',
            'address': full_addr,
            'default_category_id': self.default_category_id,
            'default_category_name': self.default_category.name if self.default_category else '',
            'default_category_display': cat_disp,
            'notes': self.notes or '',
            'is_active': True if self.is_active is None else bool(self.is_active),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class BankRule(Base):
    """
    Automated rule for categorizing and mapping recurring bank transactions.
    When a bank transaction's payee or description matches keyword, automatically
    assigns the vendor, expense/income account, property, and class.
    """
    __tablename__ = 'bank_rules'

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    match_keyword = Column(String(150), nullable=False, index=True)
    match_field = Column(String(50), default='payee_or_desc') # payee, description, payee_or_desc
    target_category_id = Column(Integer, ForeignKey('categories.id'), nullable=True, index=True)
    target_vendor_id = Column(Integer, ForeignKey('vendors.id'), nullable=True, index=True)
    target_vendor_name = Column(String(255), nullable=True)
    target_property_id = Column(Integer, ForeignKey('properties.id'), nullable=True, index=True)
    target_class_id = Column(Integer, ForeignKey('classes.id'), nullable=True, index=True)
    is_check = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    target_category = relationship('Category')
    target_vendor = relationship('Vendor')
    target_property = relationship('Property')
    target_class = relationship('ClassEntity')

    def to_dict(self):
        cat_disp = f"[{self.target_category.account_number}] {self.target_category.name}" if (self.target_category and self.target_category.account_number) else (self.target_category.name if self.target_category else '')
        return {
            'id': self.id,
            'company_id': self.company_id,
            'name': self.name,
            'match_keyword': self.match_keyword,
            'match_field': self.match_field,
            'target_category_id': self.target_category_id,
            'target_category_name': self.target_category.name if self.target_category else '',
            'target_category_display': cat_disp,
            'target_category_type': self.target_category.type if self.target_category else '',
            'target_vendor_id': self.target_vendor_id,
            'target_vendor_name': self.target_vendor.name if self.target_vendor else (self.target_vendor_name or ''),
            'target_property_id': self.target_property_id,
            'target_property_name': self.target_property.name if self.target_property else '',
            'target_class_id': self.target_class_id,
            'target_class_name': self.target_class.name if self.target_class else '',
            'is_check': bool(self.is_check),
            'is_active': bool(self.is_active),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class BankStatement(Base):
    """
    Represents an imported bank statement file (CSV, XLSX, or PDF) for a specific bank account.
    """
    __tablename__ = 'bank_statements'

    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey('categories.id'), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), default='CSV') # CSV, PDF, XLSX
    upload_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    statement_period = Column(String(50), nullable=True) # e.g. 2026-04
    row_count = Column(Integer, default=0)
    checks_count = Column(Integer, default=0)
    deposits_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)

    bank_account = relationship('Category')

    def to_dict(self):
        bank_disp = f"[{self.bank_account.account_number}] {self.bank_account.name}" if (self.bank_account and self.bank_account.account_number) else (self.bank_account.name if self.bank_account else '')
        return {
            'id': self.id,
            'bank_account_id': self.bank_account_id,
            'bank_account_name': self.bank_account.name if self.bank_account else '',
            'bank_account_display': bank_disp,
            'filename': self.filename,
            'file_type': self.file_type,
            'upload_date': self.upload_date.isoformat() if self.upload_date else None,
            'statement_period': self.statement_period or '',
            'row_count': self.row_count,
            'checks_count': self.checks_count,
            'deposits_count': self.deposits_count,
            'notes': self.notes or ''
        }
