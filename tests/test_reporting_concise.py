import pytest
from backend.database import get_db
from backend.seed_data import seed_sample_data, init_db
from backend.company_manager import company_manager
from backend.reporting_service import (
    compute_period_bounds,
    generate_concise_pnl_report,
    get_category_drilldown_transactions
)

def setup_module():
    company_manager.open_company("sample_company")
    init_db()
    seed_sample_data()

def test_compute_period_bounds_all_presets():
    # 1. Monthly
    m_bounds = compute_period_bounds(preset="MONTHLY", month="2026-03")
    assert m_bounds["start_date"] == "2026-03-01"
    assert m_bounds["end_date"] == "2026-03-31"
    assert m_bounds["prior_start_date"] == "2026-02-01"
    assert m_bounds["prior_end_date"] == "2026-02-28"
    assert "March 2026" in m_bounds["period_label"]
    assert "February 2026" in m_bounds["prior_period_label"]

    # 2. Quarterly
    q1_bounds = compute_period_bounds(preset="QUARTERLY", year=2026, quarter=1)
    assert q1_bounds["start_date"] == "2026-01-01"
    assert q1_bounds["end_date"] == "2026-03-31"
    assert q1_bounds["prior_start_date"] == "2025-10-01"
    assert q1_bounds["prior_end_date"] == "2025-12-31"

    q2_bounds = compute_period_bounds(preset="QUARTERLY", year=2026, quarter=2)
    assert q2_bounds["start_date"] == "2026-04-01"
    assert q2_bounds["end_date"] == "2026-06-30"
    assert q2_bounds["prior_start_date"] == "2026-01-01"
    assert q2_bounds["prior_end_date"] == "2026-03-31"

    # 3. Six Months
    h1_bounds = compute_period_bounds(preset="SIX_MONTH", year=2026, half=1)
    assert h1_bounds["start_date"] == "2026-01-01"
    assert h1_bounds["end_date"] == "2026-06-30"
    assert h1_bounds["prior_start_date"] == "2025-07-01"
    assert h1_bounds["prior_end_date"] == "2025-12-31"

    h2_bounds = compute_period_bounds(preset="SIX_MONTH", year=2026, half=2)
    assert h2_bounds["start_date"] == "2026-07-01"
    assert h2_bounds["end_date"] == "2026-12-31"
    assert h2_bounds["prior_start_date"] == "2026-01-01"
    assert h2_bounds["prior_end_date"] == "2026-06-30"

    # 4. Annual
    ann_bounds = compute_period_bounds(preset="ANNUAL", year=2026)
    assert ann_bounds["start_date"] == "2026-01-01"
    assert ann_bounds["end_date"] == "2026-12-31"
    assert ann_bounds["prior_start_date"] == "2025-01-01"
    assert ann_bounds["prior_end_date"] == "2025-12-31"

    # 5. YTD
    ytd_bounds = compute_period_bounds(preset="YTD", year=2026, to_date="2026-03-15")
    assert ytd_bounds["start_date"] == "2026-01-01"
    assert ytd_bounds["end_date"] == "2026-03-15"
    assert ytd_bounds["prior_start_date"] == "2025-01-01"
    assert ytd_bounds["prior_end_date"] == "2025-03-15"

    # 6. Fiscal Year (July 1 start)
    fy_bounds = compute_period_bounds(preset="FISCAL_YEAR", year=2026, fiscal_start_month=7)
    assert fy_bounds["start_date"] == "2025-07-01"
    assert fy_bounds["end_date"] == "2026-06-30"
    assert fy_bounds["prior_start_date"] == "2024-07-01"
    assert fy_bounds["prior_end_date"] == "2025-06-30"

    # 7. Custom Specific Dates
    cust_bounds = compute_period_bounds(preset="CUSTOM", from_date="2026-03-01", to_date="2026-03-15")
    assert cust_bounds["start_date"] == "2026-03-01"
    assert cust_bounds["end_date"] == "2026-03-15"
    assert cust_bounds["prior_end_date"] == "2026-02-28"

def test_generate_concise_pnl_report():
    for db in get_db():
        report = generate_concise_pnl_report(db, preset="MONTHLY", month="2026-03", compare_prior=True)
        assert len(report["properties_reports"]) > 0
        assert "period_info" in report
        assert "summary" in report

        sunset = next((p for p in report["properties_reports"] if "Sunset Palms" in p["property_name"]), None)
        assert sunset is not None

        # Verify Rental Income section at top
        r_sec = sunset["rental_income_section"]
        assert r_sec["total_current"] == 12000.0
        assert len(r_sec["items"]) > 0

        # Verify Operating Expenses section is consolidated by category
        op_sec = sunset["operating_expenses_section"]
        assert op_sec["total_current"] > 0
        assert sunset["is_operating_expenses_bold"] is True

        # Each category in operating expenses should have a single combined line item
        cat_names = [item["account_name"] for item in op_sec["items"]]
        assert len(cat_names) == len(set(cat_names)), "Categories should be consolidated without duplicate rows"

        # Check Repair Percentage calculation
        assert sunset["repair_percentage_current"] == 10.0
        assert sunset["total_repairs_current"] == 1200.0

        # Check Net Operating Income
        expected_noi = sunset["total_gross_income_current"] - sunset["total_operating_expenses_current"]
        assert sunset["net_operating_income_current"] == expected_noi

        # Verify Master Portfolio Consolidated Report
        assert "portfolio_consolidated_report" in report
        port_rep = report["portfolio_consolidated_report"]
        assert port_rep["property_name"] == "Entire Portfolio (Consolidated Statement)"
        assert port_rep["units_count"] > 0
        assert port_rep["is_operating_expenses_bold"] is True

        port_cat_names = [item["account_name"] for item in port_rep["operating_expenses_section"]["items"]]
        assert len(port_cat_names) == len(set(port_cat_names)), "Master consolidated report must have exactly 1 row per category"

        # Check repair line in portfolio report is consolidated into 1 line
        repairs_in_port = [item for item in port_rep["operating_expenses_section"]["items"] if item["is_repair"]]
        assert len(repairs_in_port) == 1, "There should be exactly one combined Repairs & Maintenance line in portfolio report"
        assert repairs_in_port[0]["transaction_count"] >= 1

def test_category_drilldown_transactions():
    for db in get_db():
        # Test drilling down into category
        report = generate_concise_pnl_report(db, preset="MONTHLY", month="2026-03")
        sunset = next((p for p in report["properties_reports"] if "Sunset Palms" in p["property_name"]))
        op_items = sunset["operating_expenses_section"]["items"]
        assert len(op_items) > 0

        target_item = op_items[0]
        cat_id = target_item["category_id"]
        cat_name = target_item["account_name"]

        drill = get_category_drilldown_transactions(
            db=db,
            category_id=cat_id,
            account_name=cat_name,
            from_date="2026-03-01",
            to_date="2026-03-31",
            property_id=sunset["property_id"]
        )

        assert drill["category"]["name"] is not None
        assert drill["transaction_count"] > 0
        assert len(drill["transactions"]) == drill["transaction_count"]
        assert drill["total_amount"] == target_item["current_amount"]
        assert all("reference_number" in t for t in drill["transactions"])
