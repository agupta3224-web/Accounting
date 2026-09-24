from backend.rule_engine import apply_property_manager_rules

def test_rental_income_aggregation_rule():
    # Multiple rental rows for property 1 in 2026-04
    raw_txns = [
        {"date": "2026-04-01", "month": "2026-04", "property_id": 1, "account_name": "Unit 101 Rent", "amount": 1400.0, "category_type": "INCOME", "is_rental_income": True},
        {"date": "2026-04-01", "month": "2026-04", "property_id": 1, "account_name": "Unit 102 Rent", "amount": 1500.0, "category_type": "INCOME", "is_rental_income": True},
        {"date": "2026-04-02", "month": "2026-04", "property_id": 1, "account_name": "Unit 103 Rent", "amount": 1600.0, "category_type": "INCOME", "is_rental_income": True},
        {"date": "2026-04-10", "month": "2026-04", "property_id": 1, "account_name": "Plumbing Repair", "amount": 350.0, "category_type": "OPERATING_EXPENSE", "is_rental_income": False}
    ]

    consolidated, count = apply_property_manager_rules(raw_txns, aggregate_rental_income=True)

    # 3 rent rows merged into 1 + 1 repair row = 2 rows total
    assert len(consolidated) == 2
    assert count == 3

    rent_row = consolidated[0]
    assert rent_row["account_name"] == "Rental Income"
    assert rent_row["amount"] == 4500.0 # 1400 + 1500 + 1600
    assert rent_row["is_aggregated"] is True
    assert rent_row["raw_aggregated_items"] is not None
