import io
import pandas as pd
from backend.parser_engine import match_column_role, parse_currency, infer_category_and_type, process_file_with_mapping

def test_dynamic_column_matcher():
    # Test AppFolio style headers
    headers1 = ["Post Date", "Account Title", "Payee/Tenant", "Amount", "Unit"]
    mapping1 = match_column_role(headers1)
    assert mapping1["date_col"] == "Post Date"
    assert mapping1["account_col"] == "Account Title"
    assert mapping1["amount_col"] == "Amount"

    # Test Buildium style headers with Debit / Credit
    headers2 = ["Txn Date", "Category", "Description / Payee", "Debit (Expense)", "Credit (Income)"]
    mapping2 = match_column_role(headers2)
    assert mapping2["date_col"] == "Txn Date"
    assert mapping2["account_col"] == "Category"
    assert mapping2["debit_col"] == "Debit (Expense)"
    assert mapping2["credit_col"] == "Credit (Income)"

def test_currency_parser():
    assert parse_currency("$1,450.00") == 1450.0
    assert parse_currency("($500.00)") == -500.0
    assert parse_currency("-250.75") == -250.75
    assert parse_currency("1200 CR") == 1200.0
    assert parse_currency("350 DR") == -350.0
    assert parse_currency(None) == 0.0

def test_category_inference():
    cat, cat_type, is_rent, is_repair = infer_category_and_type("Tenant Rent - Unit 101", "", 1500)
    assert is_rent is True
    assert cat_type == "INCOME"

    cat2, cat_type2, is_rent2, is_repair2 = infer_category_and_type("Plumbing Maintenance & Drain Clear", "", -200)
    assert is_repair2 is True
    assert cat_type2 == "OPERATING_EXPENSE"
