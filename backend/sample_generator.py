import os
import pandas as pd
from openpyxl import Workbook

def generate_sample_statements(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. AppFolio Multi-Unit Statement (CSV)
    appfolio_data = [
        {"Post Date": "04/01/2026", "Account Title": "Tenant Rent - Unit 101", "Payee/Tenant": "Alice Smith", "Amount": "1,450.00", "Type": "Income", "Unit": "101"},
        {"Post Date": "04/01/2026", "Account Title": "Tenant Rent - Unit 102", "Payee/Tenant": "Bob Jones", "Amount": "1,450.00", "Type": "Income", "Unit": "102"},
        {"Post Date": "04/02/2026", "Account Title": "Tenant Rent - Unit 103", "Payee/Tenant": "Charlie Brown", "Amount": "1,500.00", "Type": "Income", "Unit": "103"},
        {"Post Date": "04/02/2026", "Account Title": "Tenant Rent - Unit 104", "Payee/Tenant": "Diana Prince", "Amount": "1,400.00", "Type": "Income", "Unit": "104"},
        {"Post Date": "04/03/2026", "Account Title": "Tenant Rent - Unit 201", "Payee/Tenant": "Evan Wright", "Amount": "1,600.00", "Type": "Income", "Unit": "201"},
        {"Post Date": "04/03/2026", "Account Title": "Tenant Rent - Unit 202", "Payee/Tenant": "Fiona Gallagher", "Amount": "1,550.00", "Type": "Income", "Unit": "202"},
        {"Post Date": "04/05/2026", "Account Title": "Late Charge Fee", "Payee/Tenant": "Evan Wright", "Amount": "75.00", "Type": "Income", "Unit": "201"},
        {"Post Date": "04/10/2026", "Account Title": "Plumbing Maintenance", "Payee/Tenant": "Pro-Drains LLC", "Amount": "-420.00", "Type": "Expense", "Unit": "104"},
        {"Post Date": "04/12/2026", "Account Title": "HVAC Repair & Service", "Payee/Tenant": "CoolAir Tech", "Amount": "-650.00", "Type": "Expense", "Unit": "202"},
        {"Post Date": "04/15/2026", "Account Title": "Property Management Commission", "Payee/Tenant": "Peak PM", "Amount": "-720.00", "Type": "Expense", "Unit": "Building"},
        {"Post Date": "04/20/2026", "Account Title": "Landscaping Service", "Payee/Tenant": "GreenCare", "Amount": "-250.00", "Type": "Expense", "Unit": "Common"}
    ]
    appfolio_df = pd.DataFrame(appfolio_data)
    appfolio_csv_path = os.path.join(output_dir, "AppFolio_SunsetPalms_April2026.csv")
    appfolio_df.to_csv(appfolio_csv_path, index=False)

    # 2. Buildium Style Excel Statement (.xlsx) with Debit / Credit columns
    wb = Workbook()
    ws = wb.active
    ws.title = "Monthly Cash Flow"
    
    ws.append(["Txn Date", "Category", "Description / Payee", "Debit (Expense)", "Credit (Income)"])
    excel_rows = [
        ["2026-04-01", "Rental Income", "Unit A April Monthly Rent", None, 2200.00],
        ["2026-04-02", "Rental Income", "Unit B April Monthly Rent", None, 2100.00],
        ["2026-04-10", "Repairs & Maintenance", "Replaced Kitchen Faucet Unit A", 185.00, None],
        ["2026-04-15", "Property Management Fees", "Monthly Management Fee", 344.00, None],
        ["2026-04-22", "Lawn Maintenance", "Spring Mulching and Edging", 150.00, None]
    ]
    for r in excel_rows:
        ws.append(r)
        
    excel_path = os.path.join(output_dir, "Buildium_Oakridge_April2026.xlsx")
    wb.save(excel_path)

    # 3. Standard CSV Statement for Single Family Home
    sfh_csv_path = os.path.join(output_dir, "HighlandHeights_April2026.csv")
    with open(sfh_csv_path, "w", encoding="utf-8") as f:
        f.write("Date,Account,Description,Amount\n")
        f.write("2026-04-01,Rental Income,Tenant April Rent Payment,3200.00\n")
        f.write("2026-04-05,Late Fee,Tenant Late Fee Payment,50.00\n")
        f.write("2026-04-12,Repairs & Maintenance,Emergency Roof Shingle Repair,-580.00\n")
        f.write("2026-04-15,Property Management Fees,Monthly PM Fee (8%),-256.00\n")
        f.write("2026-04-20,Pest Control,Annual Termite Inspection,-120.00\n")

    print(f"Sample statements generated in {output_dir}")


def make_minimal_pdf_statement(lines: list, out_path: str):
    stream = 'BT /F1 10 Tf 20 750 Td 14 TL '
    for line in lines:
        escaped = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        stream += f'({escaped}) \' '
    stream += 'ET'
    stream_bytes = stream.encode('latin1')
    length = len(stream_bytes)
    pdf = f"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length {length} >>
stream
{stream}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000000 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
500
%%EOF"""
    with open(out_path, 'wb') as f:
        f.write(pdf.encode('latin1'))


def generate_sample_bank_statements(output_dir: str):
    """
    Generates realistic sample bank statements:
    1. Chase Operating Checking (CSV with Check Number & Amount)
    2. Wells Fargo Commercial Statement (PDF with Checks, Deposits, and Debits)
    3. Bank of America Business Checking (CSV with separate Debit & Credit columns)
    """
    os.makedirs(output_dir, exist_ok=True)

    # 1. Chase Operating Checking CSV
    chase_csv_path = os.path.join(output_dir, "Sample_Chase_Operating_Checking.csv")
    with open(chase_csv_path, "w", encoding="utf-8") as f:
        f.write("Posting Date,Check Number,Description,Amount,Type,Balance\n")
        f.write("04/02/2026,,Deposit - Tenant Rent Unit 101,1800.00,Deposit,26800.00\n")
        f.write("04/03/2026,,Deposit - Tenant Rent Unit 102,2100.00,Deposit,28900.00\n")
        f.write("04/05/2026,1042,Joe's Plumbing - Emergency Drain Snaking,-500.00,Check,28400.00\n")
        f.write("04/08/2026,1043,Ace Hardware - Paint & Unit Turnover Supplies,-145.20,Check,28254.80\n")
        f.write("04/12/2026,,ACH Payment Xcel Energy Electric & Gas,-182.50,Electronic Debit,28072.30\n")
        f.write("04/15/2026,,State Farm - Property Hazard & Liability Insurance,-650.00,Electronic Debit,27422.30\n")
        f.write("04/18/2026,1044,Mile High Lawn Care - Spring Mulch & Maintenance,-220.00,Check,27202.30\n")
        f.write("04/22/2026,1045,Pro-Tech Appliance Repair - Dishwasher Repair Unit 104,-310.00,Check,26892.30\n")
        f.write("04/25/2026,,ACH Travis County Tax Collector - Real Estate Taxes,-1250.00,ACH Debit,25642.30\n")
        f.write("04/28/2026,,Chase Business Checking - Interest Payment,16.45,Interest,25658.75\n")

    # 2. Wells Fargo Commercial Statement PDF
    wf_pdf_path = os.path.join(output_dir, "Sample_Wells_Fargo_Bank_Statement.pdf")
    wf_lines = [
        "WELLS FARGO COMMERCIAL CHECKING ACCOUNT STATEMENT",
        "Account Number: 10010-987654321  Statement Period: 04/01/2026 - 04/30/2026",
        "CHECKS IN NUMERICAL ORDER",
        "Check 1042 Joe's plumbing 500.00",
        "Check 1043 Ace Hardware 145.20",
        "Check 1044 Mile High Lawn Care 220.00",
        "DEPOSITS AND ADDITIONS",
        "04/02/2026 Deposit Tenant Rent 1800.00",
        "04/03/2026 Deposit Tenant Rent 2100.00",
        "ELECTRONIC WITHDRAWALS AND OTHER DEBITS",
        "04/12/2026 ACH Xcel Energy 182.50",
        "04/15/2026 ACH State Farm Insurance 650.00",
        "04/25/2026 ACH Travis County Taxes 1250.00"
    ]
    make_minimal_pdf_statement(wf_lines, wf_pdf_path)

    # 3. Bank of America Debit / Credit CSV
    bofa_csv_path = os.path.join(output_dir, "Sample_Bank_Of_America_Debit_Credit.csv")
    with open(bofa_csv_path, "w", encoding="utf-8") as f:
        f.write("Date,Reference,Payee / Description,Withdrawal (Debit),Deposit (Credit),Running Balance\n")
        f.write("2026-04-02,,Tenant Rent Payment - Unit 201,,1600.00,21600.00\n")
        f.write("2026-04-03,,Tenant Rent Payment - Unit 202,,1550.00,23150.00\n")
        f.write("2026-04-05,Check #1042,Joe's Plumbing - Main Line Clear,500.00,,22650.00\n")
        f.write("2026-04-09,Check #1043,Austin HVAC Pros - Service Call,350.00,,22300.00\n")
        f.write("2026-04-14,,Xcel Energy Electric Bill,165.40,,22134.60\n")
        f.write("2026-04-20,,Austin Water & Trash Services,95.00,,22039.60\n")
        f.write("2026-04-28,Check #1044,Peak Property Management Fee,420.00,,21619.60\n")

    print(f"Sample bank statements generated in {output_dir}")
