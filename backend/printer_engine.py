"""
PropBooks Real Estate Accounting - Windows Printer Engine
Handles discovery of installed Windows printers, printer capabilities (duplex, color, default),
and rendering of executive publication-grade printable Profit & Loss statements.
"""
import sys
import json
import subprocess
from typing import List, Dict, Any, Optional

def get_system_printers() -> List[Dict[str, Any]]:
    """
    Enumerates all installed printers on the host machine.
    On Windows, uses PowerShell Win32_Printer CIM query to retrieve exact names,
    default status, and hardware capability descriptors (Duplex, Color, Copies, etc.).
    Falls back gracefully to virtual printers if running in a non-Windows or restricted environment.
    """
    printers: List[Dict[str, Any]] = []

    if sys.platform == "win32":
        try:
            # Query Win32_Printer using PowerShell with JSON conversion
            cmd = [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-CimInstance Win32_Printer | "
                "Select-Object Name, Default, CapabilityDescriptions, Capabilities, PortName, PrinterStatus | "
                "ConvertTo-Json -Compress"
            ]
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )

            if res.returncode == 0 and res.stdout.strip():
                raw_json = json.loads(res.stdout.strip())
                # Handle single object vs array of objects
                items = [raw_json] if isinstance(raw_json, dict) else raw_json

                for item in items:
                    name = str(item.get("Name") or "Unknown Printer").strip()
                    is_default = bool(item.get("Default", False))
                    raw_caps = item.get("CapabilityDescriptions") or []
                    if isinstance(raw_caps, str):
                        caps = [raw_caps]
                    elif isinstance(raw_caps, list):
                        caps = [str(c) for c in raw_caps]
                    else:
                        caps = []

                    # Detect hardware duplex support (Capability 3 or 'Duplex' in description)
                    supports_duplex = any("duplex" in c.lower() for c in caps)
                    supports_color = any("color" in c.lower() for c in caps)

                    printers.append({
                        "name": name,
                        "is_default": is_default,
                        "supports_duplex": supports_duplex,
                        "supports_color": supports_color,
                        "capabilities": caps,
                        "port_name": str(item.get("PortName") or ""),
                        "status": "Ready"
                    })
        except Exception:
            # Fallback will trigger below if list is empty
            pass

    # Fallback if no printers were detected or running on non-Windows host
    if not printers:
        printers = [
            {
                "name": "Microsoft Print to PDF",
                "is_default": True,
                "supports_duplex": False,
                "supports_color": True,
                "capabilities": ["Copies", "Color"],
                "port_name": "PORTPROMPT:",
                "status": "Ready"
            },
            {
                "name": "Default System Printer",
                "is_default": False,
                "supports_duplex": True,
                "supports_color": True,
                "capabilities": ["Copies", "Color", "Duplex"],
                "port_name": "LOCAL:",
                "status": "Ready"
            }
        ]

    # Ensure default printer is listed first
    printers.sort(key=lambda x: (not x["is_default"], x["name"]))
    return printers


def render_printable_pnl_html(
    report_data: Dict[str, Any],
    orientation: str = "portrait",
    duplex: str = "none",
    page_fit: str = "fit_one_page_wide",
    page_per_property: bool = False,
    include_summary: bool = True,
    include_comparison: bool = True,
    target_printer: Optional[str] = None,
    autoprint: bool = False
) -> str:
    """
    Renders publication-quality, standalone HTML for printing Profit & Loss financial statements.
    Incorporates CSS Paged Media (@page), repeated headers (thead { display: table-header-group }),
    orphan prevention, duplex margin gutters, and custom page fitting.
    """
    is_landscape = (orientation.lower() == "landscape")
    is_compact = (page_fit == "fit_one_page_wide")
    compare_prior = bool(include_comparison and report_data.get("period_info", {}).get("compare_prior", False))

    summary = report_data.get("summary", {})
    period_info = report_data.get("period_info", {})
    properties_reports = report_data.get("properties_reports", [])

    period_label = period_info.get("period_label", "Financial Report")
    prior_period_label = period_info.get("prior_period_label", "Prior Period")
    date_range_str = f"{period_info.get('start_date', '')} to {period_info.get('end_date', '')}"

    # Build Duplex Margins CSS
    duplex_css = ""
    if duplex == "long_edge":
        duplex_css = """
            @page :left {
                margin-left: 0.7in;
                margin-right: 0.4in;
            }
            @page :right {
                margin-left: 0.4in;
                margin-right: 0.7in;
            }
        """
    elif duplex == "short_edge":
        duplex_css = """
            @page {
                margin-top: 0.6in;
                margin-bottom: 0.4in;
            }
        """

    # Page fit typography & scaling
    if is_compact:
        font_size = "9.5pt"
        header_font_size = "13pt"
        cell_padding = "3px 6px"
        table_scale_class = "fit-one-page-wide"
    else:
        font_size = "11pt"
        header_font_size = "15pt"
        cell_padding = "6px 10px"
        table_scale_class = "multi-page-readable"

    # Build Properties Statements HTML
    statements_html = ""
    for idx, prop in enumerate(properties_reports):
        is_consolidated = (prop.get("property_id") == 0)
        break_class = "page-break-before" if (page_per_property and idx > 0) else ""

        # Section 1: Rental Revenue
        rental_rows = ""
        rental_items = prop.get("rental_income_section", {}).get("items", [])
        if not rental_items:
            rental_rows = f"""
            <tr>
                <td colspan="{6 if compare_prior else 3}" style="padding: {cell_padding}; color: #64748b; font-style: italic; padding-left: 24px;">
                    No rental income recorded for this period.
                </td>
            </tr>
            """
        else:
            for item in rental_items:
                prior_cells = ""
                if compare_prior:
                    chg = item.get("change_amount", 0)
                    chg_pct = item.get("change_percent", 0)
                    chg_color = "#047857" if chg >= 0 else "#b91c1c"
                    prior_cells = f"""
                    <td style="text-align: right; font-family: Consolas, monospace; padding: {cell_padding}; color: #475569;">${item.get('prior_amount', 0):,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg >= 0 else ''}${chg:,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg_pct >= 0 else ''}{chg_pct}%</td>
                    """
                rental_rows += f"""
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: {cell_padding}; padding-left: 24px; font-weight: 500;">{item.get('display_name')}</td>
                    <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #64748b;">{item.get('transaction_count', 0)} txns</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #047857;">+${item.get('current_amount', 0):,.2f}</td>
                    {prior_cells}
                </tr>
                """

        # Rental Subtotal
        rental_tot = prop.get("rental_income_section", {})
        prior_rental_subtotal = ""
        if compare_prior:
            tot_chg = rental_tot.get("total_change", 0)
            tot_pct = rental_tot.get("total_change_percent", 0)
            tot_color = "#047857" if tot_chg >= 0 else "#b91c1c"
            prior_rental_subtotal = f"""
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #334155;">${rental_tot.get('total_prior', 0):,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {tot_color};">{'+' if tot_chg >= 0 else ''}${tot_chg:,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {tot_color};">{'+' if tot_pct >= 0 else ''}{tot_pct}%</td>
            """
        rental_subtotal_row = f"""
        <tr style="background: #f0fdf4; font-weight: bold; border-top: 1px solid #bbf7d0; border-bottom: 1px solid #bbf7d0;">
            <td style="padding: {cell_padding}; padding-left: 24px; color: #14532d;">Subtotal: Total Rental Income</td>
            <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #15803d;">
                {sum(i.get('transaction_count', 0) for i in rental_items)} txns
            </td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: 800; padding: {cell_padding}; color: #14532d;">
                ${rental_tot.get('total_current', 0):,.2f}
            </td>
            {prior_rental_subtotal}
        </tr>
        """

        # Section 2: Other Operating Revenue
        other_inc_items = prop.get("other_income_section", {}).get("items", [])
        other_inc_rows = ""
        if other_inc_items:
            other_inc_rows += f"""
            <tr style="background: #f8fafc; font-weight: bold; font-size: 9pt; color: #334155;">
                <td colspan="{6 if compare_prior else 3}" style="padding: {cell_padding}; padding-left: 16px;">Other Operating Revenue</td>
            </tr>
            """
            for item in other_inc_items:
                prior_cells = ""
                if compare_prior:
                    chg = item.get("change_amount", 0)
                    chg_pct = item.get("change_percent", 0)
                    chg_color = "#047857" if chg >= 0 else "#b91c1c"
                    prior_cells = f"""
                    <td style="text-align: right; font-family: Consolas, monospace; padding: {cell_padding}; color: #475569;">${item.get('prior_amount', 0):,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg >= 0 else ''}${chg:,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg_pct >= 0 else ''}{chg_pct}%</td>
                    """
                other_inc_rows += f"""
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: {cell_padding}; padding-left: 24px;">{item.get('display_name')}</td>
                    <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #64748b;">{item.get('transaction_count', 0)} txns</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #047857;">+${item.get('current_amount', 0):,.2f}</td>
                    {prior_cells}
                </tr>
                """

        # Total Gross Income Row
        prior_gross_cells = ""
        if compare_prior:
            g_chg = prop.get("total_gross_income_change", 0)
            g_pct = prop.get("total_gross_income_change_percent", 0)
            g_color = "#047857" if g_chg >= 0 else "#b91c1c"
            prior_gross_cells = f"""
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #1e293b;">${prop.get('total_gross_income_prior', 0):,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {g_color};">{'+' if g_chg >= 0 else ''}${g_chg:,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {g_color};">{'+' if g_pct >= 0 else ''}{g_pct}%</td>
            """
        total_gross_row = f"""
        <tr style="background: #e2e8f0; font-weight: 800; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8;">
            <td style="padding: {cell_padding}; text-transform: uppercase; color: #0f172a;">TOTAL GROSS INCOME</td>
            <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #64748b;">—</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: 900; padding: {cell_padding}; color: #065f46; font-size: 1.05em;">
                ${prop.get('total_gross_income_current', 0):,.2f}
            </td>
            {prior_gross_cells}
        </tr>
        """

        # Section 3: Operating Expenses (Consolidated Categories)
        opex_items = prop.get("operating_expenses_section", {}).get("items", [])
        opex_rows = ""
        if not opex_items:
            opex_rows = f"""
            <tr>
                <td colspan="{6 if compare_prior else 3}" style="padding: {cell_padding}; color: #64748b; font-style: italic; padding-left: 24px;">
                    No operating expenses recorded for this period.
                </td>
            </tr>
            """
        else:
            for item in opex_items:
                prior_cells = ""
                if compare_prior:
                    chg = item.get("change_amount", 0)
                    chg_pct = item.get("change_percent", 0)
                    # For expenses, negative change is good (cost decreased)
                    chg_color = "#047857" if chg <= 0 else "#b91c1c"
                    prior_cells = f"""
                    <td style="text-align: right; font-family: Consolas, monospace; padding: {cell_padding}; color: #475569;">${item.get('prior_amount', 0):,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg >= 0 else ''}${chg:,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg_pct >= 0 else ''}{chg_pct}%</td>
                    """
                repair_badge = ' <span style="background: #fef3c7; color: #92400e; font-size: 7.5pt; padding: 1px 4px; border-radius: 3px; font-weight: bold;">REPAIR</span>' if item.get('is_repair') else ''
                opex_rows += f"""
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: {cell_padding}; padding-left: 24px;">{item.get('display_name')}{repair_badge}</td>
                    <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #64748b;">{item.get('transaction_count', 0)} txns</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #b91c1c;">-${item.get('current_amount', 0):,.2f}</td>
                    {prior_cells}
                </tr>
                """

        # TOTAL OPERATING EXPENSES (IN BOLD)
        prior_opex_cells = ""
        if compare_prior:
            o_chg = prop.get("total_operating_expenses_change", 0)
            o_pct = prop.get("total_operating_expenses_change_percent", 0)
            o_color = "#047857" if o_chg <= 0 else "#fca5a5"
            prior_opex_cells = f"""
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #e2e8f0;">-${prop.get('total_operating_expenses_prior', 0):,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {o_color};">{'+' if o_chg >= 0 else ''}${o_chg:,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {o_color};">{'+' if o_pct >= 0 else ''}{o_pct}%</td>
            """
        total_opex_row = f"""
        <tr style="background: #0f172a; color: white; font-weight: 900; border-top: 2px solid #020617; border-bottom: 2px solid #020617;">
            <td style="padding: {cell_padding}; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL OPERATING EXPENSES</td>
            <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #94a3b8;">
                {sum(i.get('transaction_count', 0) for i in opex_items)} txns
            </td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: 900; padding: {cell_padding}; color: #fca5a5; font-size: 1.05em;">
                -${prop.get('total_operating_expenses_current', 0):,.2f}
            </td>
            {prior_opex_cells}
        </tr>
        """

        # NET OPERATING INCOME (NOI)
        prior_noi_cells = ""
        if compare_prior:
            noi_chg = prop.get("net_operating_income_change", 0)
            noi_pct = prop.get("net_operating_income_change_percent", 0)
            noi_color = "#047857" if noi_chg >= 0 else "#b91c1c"
            prior_noi_cells = f"""
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #0f172a;">${prop.get('net_operating_income_prior', 0):,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {noi_color};">{'+' if noi_chg >= 0 else ''}${noi_chg:,.2f}</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {noi_color};">{'+' if noi_pct >= 0 else ''}{noi_pct}%</td>
            """
        noi_row = f"""
        <tr style="background: #dcfce7; color: #064e3b; font-weight: 900; border-top: 2px solid #4ade80; border-bottom: 2px solid #4ade80;">
            <td style="padding: {cell_padding}; text-transform: uppercase;">NET OPERATING INCOME (NOI)</td>
            <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #64748b;">—</td>
            <td style="text-align: right; font-family: Consolas, monospace; font-weight: 900; padding: {cell_padding}; color: #065f46; font-size: 1.1em;">
                ${prop.get('net_operating_income_current', 0):,.2f}
            </td>
            {prior_noi_cells}
        </tr>
        """

        # Section 4: Non-Operating Items
        non_op_items = prop.get("non_operating_section", {}).get("items", [])
        non_op_rows = ""
        if non_op_items:
            non_op_rows += f"""
            <tr style="background: #f8fafc; font-weight: bold; font-size: 9pt; color: #475569;">
                <td colspan="{6 if compare_prior else 3}" style="padding: {cell_padding}; padding-left: 16px;">Non-Operating Items (Mortgage Debt Service & CapEx)</td>
            </tr>
            """
            for item in non_op_items:
                prior_cells = ""
                if compare_prior:
                    chg = item.get("change_amount", 0)
                    chg_pct = item.get("change_percent", 0)
                    chg_color = "#047857" if chg <= 0 else "#b91c1c"
                    prior_cells = f"""
                    <td style="text-align: right; font-family: Consolas, monospace; padding: {cell_padding}; color: #475569;">${item.get('prior_amount', 0):,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg >= 0 else ''}${chg:,.2f}</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {chg_color};">{'+' if chg_pct >= 0 else ''}{chg_pct}%</td>
                    """
                non_op_rows += f"""
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: {cell_padding}; padding-left: 24px;">{item.get('display_name')}</td>
                    <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #64748b;">{item.get('transaction_count', 0)} txns</td>
                    <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #475569;">-${item.get('current_amount', 0):,.2f}</td>
                    {prior_cells}
                </tr>
                """

            # Net Cash Flow
            prior_ncf_cells = ""
            if compare_prior:
                ncf_chg = prop.get("net_cash_flow_change", 0)
                ncf_pct = prop.get("net_cash_flow_change_percent", 0)
                ncf_color = "#047857" if ncf_chg >= 0 else "#b91c1c"
                prior_ncf_cells = f"""
                <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: #334155;">${prop.get('net_cash_flow_prior', 0):,.2f}</td>
                <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {ncf_color};">{'+' if ncf_chg >= 0 else ''}${ncf_chg:,.2f}</td>
                <td style="text-align: right; font-family: Consolas, monospace; font-weight: bold; padding: {cell_padding}; color: {ncf_color};">{'+' if ncf_pct >= 0 else ''}{ncf_pct}%</td>
                """
            non_op_rows += f"""
            <tr style="background: #e2e8f0; font-weight: bold; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                <td style="padding: {cell_padding}; text-transform: uppercase; color: #0f172a;">NET CASH FLOW (After Debt & CapEx)</td>
                <td style="text-align: center; padding: {cell_padding}; font-size: 8.5pt; color: #64748b;">—</td>
                <td style="text-align: right; font-family: Consolas, monospace; font-weight: 800; padding: {cell_padding}; color: #0f172a;">
                    ${prop.get('net_cash_flow_current', 0):,.2f}
                </td>
                {prior_ncf_cells}
            </tr>
            """

        # Repair percentage badge
        rep_pct = prop.get("repair_percentage_current", 0)
        rep_badge_bg = "#fef3c7" if rep_pct > 25 else "#e0f2fe" if rep_pct >= 10 else "#dcfce7"
        rep_badge_color = "#92400e" if rep_pct > 25 else "#0369a1" if rep_pct >= 10 else "#15803d"

        property_header_title = "CONSOLIDATED PORTFOLIO STATEMENT" if is_consolidated else prop.get("property_name", "Property Statement")
        entity_subtitle = "Master Rollup of All Properties" if is_consolidated else f"{prop.get('class_name', 'LLC Entity')} • {prop.get('company_name', '')}"
        address_line = f"<div style='font-size: 8.5pt; color: #64748b; margin-top: 2px;'>{prop.get('address')} • {prop.get('units_count', 0)} Units ({prop.get('property_type', 'Residential')})</div>" if prop.get("address") else ""

        statements_html += f"""
        <div class="property-statement-block {break_class}" style="margin-bottom: 30px;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-top: 3px solid #059669; padding: 12px 16px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="margin: 0; font-size: {header_font_size}; color: #0f172a; font-weight: 800;">{property_header_title}</h2>
                    <div style="font-size: 9pt; color: #475569; font-weight: 600; margin-top: 2px;">{entity_subtitle}</div>
                    {address_line}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 8pt; color: #64748b; text-transform: uppercase; font-weight: bold;">Repair Ratio</div>
                    <div style="display: inline-block; background: {rep_badge_bg}; color: {rep_badge_color}; padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 9pt; font-family: Consolas, monospace; margin-top: 2px;">
                        🔧 {rep_pct}% of rent
                    </div>
                </div>
            </div>

            <table class="report-table" style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #cbd5e1; border-top: none;">
                <thead>
                    <tr style="background: #0f172a; color: white; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.5px;">
                        <th style="text-align: left; padding: 8px 10px; width: 40%;">Account Category</th>
                        <th style="text-align: center; padding: 8px 6px; width: 12%;">Volume</th>
                        <th style="text-align: right; padding: 8px 10px; width: 16%;">{period_label}</th>
                        {"<th style='text-align: right; padding: 8px 10px; width: 14%;'>" + prior_period_label + "</th>" if compare_prior else ""}
                        {"<th style='text-align: right; padding: 8px 10px; width: 10%;'>Variance ($)</th>" if compare_prior else ""}
                        {"<th style='text-align: right; padding: 8px 10px; width: 8%;'>Var %</th>" if compare_prior else ""}
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: #f8fafc; font-weight: bold; font-size: 9pt; color: #065f46;">
                        <td colspan="{6 if compare_prior else 3}" style="padding: {cell_padding}; padding-left: 12px; border-bottom: 1px solid #e2e8f0;">
                            1. Rental Operating Revenue
                        </td>
                    </tr>
                    {rental_rows}
                    {rental_subtotal_row}
                    {other_inc_rows}
                    {total_gross_row}
                    <tr style="background: #f8fafc; font-weight: bold; font-size: 9pt; color: #991b1b;">
                        <td colspan="{6 if compare_prior else 3}" style="padding: {cell_padding}; padding-left: 12px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                            2. Operating Expenses Breakdown (Consolidated Categories)
                        </td>
                    </tr>
                    {opex_rows}
                    {total_opex_row}
                    {noi_row}
                    {non_op_rows}
                </tbody>
            </table>
        </div>
        """

    # Executive Summary Cards HTML (Top Summary)
    summary_html = ""
    if include_summary and summary:
        summary_html = f"""
        <div class="summary-section" style="margin-bottom: 24px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px;">
                    <div style="font-size: 8pt; font-weight: bold; color: #166534; text-transform: uppercase;">Rental Income</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #14532d; font-family: Consolas, monospace; margin-top: 3px;">
                        ${summary.get('portfolio_rental_income_current', 0):,.2f}
                    </div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;">
                    <div style="font-size: 8pt; font-weight: bold; color: #334155; text-transform: uppercase;">Gross Income</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #0f172a; font-family: Consolas, monospace; margin-top: 3px;">
                        ${summary.get('portfolio_gross_income_current', 0):,.2f}
                    </div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px;">
                    <div style="font-size: 8pt; font-weight: bold; color: #991b1b; text-transform: uppercase;">Operating Expenses</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #7f1d1d; font-family: Consolas, monospace; margin-top: 3px;">
                        -${summary.get('portfolio_operating_expenses_current', 0):,.2f}
                    </div>
                </div>
                <div style="background: #ecfdf5; border: 2px solid #059669; border-radius: 6px; padding: 10px;">
                    <div style="font-size: 8pt; font-weight: bold; color: #047857; text-transform: uppercase;">Net Operating Income (NOI)</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #064e3b; font-family: Consolas, monospace; margin-top: 3px;">
                        ${summary.get('portfolio_noi_current', 0):,.2f}
                    </div>
                </div>
            </div>
        </div>
        """

    printer_badge = f"<span style='background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 4px; font-size: 8pt;'>🖨️ Target: {target_printer}</span>" if target_printer else ""
    duplex_badge = f"<span style='background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 8pt;'>📖 Duplex: {duplex.replace('_', ' ').title()}</span>" if duplex != 'none' else ""
    fit_badge = f"<span style='background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 8pt;'>📐 Fit: {'1 Page Wide' if is_compact else 'Multi-Page Readable'}</span>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>PropBooks - Profit & Loss Statement ({period_label})</title>
    <style>
        @page {{
            size: {'landscape' if is_landscape else 'portrait'};
            margin: 0.4in;
        }}
        {duplex_css}
        @media print {{
            body {{
                background: white !important;
                color: #0f172a !important;
                padding: 0 !important;
                margin: 0 !important;
            }}
            .no-print {{
                display: none !important;
            }}
            .page-break-before {{
                page-break-before: always !important;
                break-before: page !important;
            }}
            .report-table {{
                width: 100% !important;
                page-break-inside: auto;
            }}
            .report-table thead {{
                display: table-header-group !important;
            }}
            .report-table tr {{
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }}
            .summary-section {{
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }}
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background-color: #f1f5f9;
            margin: 0;
            padding: 24px;
            font-size: {font_size};
            line-height: 1.35;
        }}

        .print-container {{
            max-width: {'1300px' if is_landscape else '900px'};
            margin: 0 auto;
            background: white;
            padding: 32px;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }}

        .report-header {{
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }}

        .btn-print {{
            background: #059669;
            color: white;
            border: none;
            padding: 9px 18px;
            font-size: 13px;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }}
        .btn-print:hover {{
            background: #047857;
        }}
        .btn-close {{
            background: white;
            color: #475569;
            border: 1px solid #cbd5e1;
            padding: 9px 16px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
        }}
        .btn-close:hover {{
            background: #f8fafc;
        }}

        /* Page fitting rules */
        .fit-one-page-wide table {{
            table-layout: fixed;
            word-wrap: break-word;
        }}
    </style>
</head>
<body class="{table_scale_class}">

    <!-- Top Non-Printing Action Bar -->
    <div class="no-print" style="max-width: {'1300px' if is_landscape else '900px'}; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 18px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <div style="display: flex; items-center; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: bold; color: #0f172a; font-size: 14px;">Print Document Preview</span>
            {printer_badge}
            {duplex_badge}
            {fit_badge}
            <span style="background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 4px; font-size: 8pt;">Orientation: {orientation.title()}</span>
        </div>
        <div style="display: flex; gap: 8px;">
            <button class="btn-close" onclick="window.close()">Close Window</button>
            <button class="btn-print" onclick="window.print()">🖨️ Print Document</button>
        </div>
    </div>

    <!-- The Printable Document Container -->
    <div class="print-container">
        
        <!-- Header -->
        <div class="report-header">
            <div>
                <div style="font-size: 9pt; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 1px;">PropBooks Accounting Pro</div>
                <h1 style="margin: 4px 0 0 0; font-size: 20pt; color: #0f172a; font-weight: 900; letter-spacing: -0.5px;">Profit &amp; Loss Statement</h1>
                <div style="font-size: 11pt; color: #475569; font-weight: 600; margin-top: 4px;">Executive Summary &amp; Category Breakdown</div>
            </div>
            <div style="text-align: right;">
                <div style="display: inline-block; background: #0f172a; color: white; padding: 4px 12px; border-radius: 4px; font-weight: 800; font-size: 10pt; font-family: Consolas, monospace;">
                    {period_label}
                </div>
                <div style="font-size: 8.5pt; color: #64748b; margin-top: 4px;">Date Range: {date_range_str}</div>
                {"<div style='font-size: 8.5pt; color: #059669; font-weight: bold; margin-top: 2px;'>Compared to: " + prior_period_label + "</div>" if compare_prior else ""}
            </div>
        </div>

        <!-- Optional Executive KPI Summary -->
        {summary_html}

        <!-- Property Statements -->
        {statements_html}

        <!-- Document Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8;">
            <div>Generated by PropBooks Real Estate Accounting • Professional Edition</div>
            <div>Confidential Investor &amp; Management Report • Page 1 of Statements</div>
        </div>

    </div>

    {"<script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 400); });</script>" if autoprint else ""}
</body>
</html>
"""
    return html
