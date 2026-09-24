from backend.database import get_db
from backend.seed_data import seed_sample_data, init_db
from backend.reporting_service import generate_monthly_property_pnl
from backend.company_manager import company_manager

def test_monthly_property_pnl_generation():
    company_manager.open_company("sample_company")
    init_db()
    seed_sample_data()
    for db in get_db():
        report = generate_monthly_property_pnl(db, month="2026-03")
        assert len(report["properties_reports"]) > 0

        # Check Sunset Palms Report
        sunset_rep = next((p for p in report["properties_reports"] if "Sunset Palms" in p["property_name"]), None)
        assert sunset_rep is not None

        march_data = sunset_rep["months"][0]
        assert march_data["month"] == "2026-03"
        # 1. Rental Income explicitly at top
        assert march_data["total_rental_income"] == 12000.0
        assert len(march_data["rental_income_items"]) > 0
        # 2. Operating expenses bold flag
        assert march_data["is_operating_expenses_bold"] is True
        assert march_data["total_operating_expenses"] > 0
        # 3. Repair percentage formula: (Repairs / Rental Income) * 100%
        expected_repair_pct = round((1200.0 / 12000.0) * 100.0, 2)
        assert march_data["repair_percentage"] == expected_repair_pct
        assert march_data["repair_percentage"] == 10.0
