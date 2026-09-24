"""
Unit tests for Windows printer discovery and printable P&L report generation.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.printer_engine import get_system_printers, render_printable_pnl_html
from backend.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

client = TestClient(app)

def test_get_system_printers_structure():
    """Verify that get_system_printers returns a non-empty list of well-structured printer items."""
    printers = get_system_printers()
    assert isinstance(printers, list)
    assert len(printers) > 0

    first = printers[0]
    assert "name" in first
    assert "is_default" in first
    assert "supports_duplex" in first
    assert "supports_color" in first
    assert "capabilities" in first
    assert isinstance(first["is_default"], bool)
    assert isinstance(first["supports_duplex"], bool)

def test_render_printable_pnl_html_portrait_and_landscape():
    """Verify that render_printable_pnl_html injects appropriate @page CSS and content."""
    mock_data = {
        "period_info": {
            "period_label": "January 2026",
            "prior_period_label": "December 2025",
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "compare_prior": True
        },
        "summary": {
            "portfolio_rental_income_current": 15000.0,
            "portfolio_gross_income_current": 15500.0,
            "portfolio_operating_expenses_current": 3200.0,
            "portfolio_noi_current": 12300.0
        },
        "properties_reports": [
            {
                "property_id": 1,
                "property_name": "Highland Heights SFH",
                "class_name": "Highland LLC",
                "company_name": "PropBooks LLC",
                "address": "123 Main St",
                "units_count": 1,
                "property_type": "Single Family",
                "repair_percentage_current": 8.5,
                "rental_income_section": {
                    "items": [
                        {
                            "display_name": "[40100] Rental Income",
                            "transaction_count": 1,
                            "current_amount": 2500.0,
                            "prior_amount": 2500.0,
                            "change_amount": 0.0,
                            "change_percent": 0.0
                        }
                    ],
                    "total_current": 2500.0,
                    "total_prior": 2500.0,
                    "total_change": 0.0,
                    "total_change_percent": 0.0
                },
                "other_income_section": {"items": []},
                "total_gross_income_current": 2500.0,
                "total_gross_income_prior": 2500.0,
                "total_gross_income_change": 0.0,
                "total_gross_income_change_percent": 0.0,
                "operating_expenses_section": {
                    "items": [
                        {
                            "display_name": "[60100] Repairs & Maintenance",
                            "is_repair": True,
                            "transaction_count": 1,
                            "current_amount": 212.5,
                            "prior_amount": 100.0,
                            "change_amount": 112.5,
                            "change_percent": 112.5
                        }
                    ]
                },
                "total_operating_expenses_current": 212.5,
                "total_operating_expenses_prior": 100.0,
                "total_operating_expenses_change": 112.5,
                "total_operating_expenses_change_percent": 112.5,
                "net_operating_income_current": 2287.5,
                "net_operating_income_prior": 2400.0,
                "net_operating_income_change": -112.5,
                "net_operating_income_change_percent": -4.69,
                "non_operating_section": {"items": []},
                "net_cash_flow_current": 2287.5,
                "net_cash_flow_prior": 2400.0,
                "net_cash_flow_change": -112.5,
                "net_cash_flow_change_percent": -4.69
            }
        ]
    }

    # Test Portrait
    html_portrait = render_printable_pnl_html(
        mock_data,
        orientation="portrait",
        duplex="none",
        page_fit="fit_one_page_wide"
    )
    assert "size: portrait" in html_portrait
    assert "fit-one-page-wide" in html_portrait
    assert "Highland Heights SFH" in html_portrait
    assert "[60100] Repairs & Maintenance" in html_portrait
    assert "NET OPERATING INCOME" in html_portrait

    # Test Landscape with Duplex Long Edge
    html_landscape = render_printable_pnl_html(
        mock_data,
        orientation="landscape",
        duplex="long_edge",
        page_fit="multi_page_readable",
        page_per_property=True,
        target_printer="Brother MFC-8910DW Printer"
    )
    assert "size: landscape" in html_landscape
    assert "@page :left" in html_landscape
    assert "@page :right" in html_landscape
    assert "multi-page-readable" in html_landscape
    assert "Target: Brother MFC-8910DW Printer" in html_landscape

def test_printers_api_endpoint():
    """Verify GET /api/printers returns 200 and a list of printers."""
    res = client.get("/api/printers")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(p["name"] for p in data)

def test_concise_pnl_print_view_api_endpoint():
    """Verify GET /api/reports/concise-pnl/print-view returns HTML document."""
    res = client.get("/api/reports/concise-pnl/print-view?preset=MONTHLY&year=2024&month=1&orientation=landscape&duplex=long_edge&page_fit=fit_one_page_wide")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "<!DOCTYPE html>" in res.text
    assert "size: landscape" in res.text
    assert "Profit &amp; Loss Statement" in res.text or "Profit & Loss Statement" in res.text
