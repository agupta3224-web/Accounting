import os
from fastapi.testclient import TestClient
from backend.main import app
from backend.sample_generator import generate_sample_statements
from backend.seed_data import seed_sample_data, init_db

def test_full_application_e2e():
    init_db()
    seed_sample_data()
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_statements")
    generate_sample_statements(sample_dir)

    client = TestClient(app)

    # 1. Properties
    res_props = client.get('/api/properties')
    assert res_props.status_code == 200
    props = res_props.json()
    assert len(props) >= 3

    # 2. Monthly PnL Report
    res_pnl = client.get('/api/reports/monthly-pnl?month=2026-03')
    assert res_pnl.status_code == 200
    pnl_data = res_pnl.json()
    assert len(pnl_data['properties_reports']) > 0

    sunset = next(p for p in pnl_data['properties_reports'] if 'Sunset' in p['property_name'])
    m = sunset['months'][0]
    assert m['total_rental_income'] == 12000.0
    assert m['repair_percentage'] == 10.0
    assert m['is_operating_expenses_bold'] is True

    # 3. Statement Upload Preview (CSV)
    sample_csv_path = os.path.join(sample_dir, 'AppFolio_SunsetPalms_April2026.csv')
    with open(sample_csv_path, 'rb') as f:
        res_upload = client.post(
            '/api/statements/upload-preview',
            files={'file': ('AppFolio_SunsetPalms_April2026.csv', f, 'text/csv')}
        )
    assert res_upload.status_code == 200
    preview = res_upload.json()
    assert 'suggested_mapping' in preview

    # 4. Confirm Import with Consolidation
    confirm_payload = {
        'filename': 'AppFolio_SunsetPalms_April2026.csv',
        'property_id': props[0]['id'],
        'column_mapping': preview['suggested_mapping'],
        'aggregate_rental_income': True,
        'raw_file_content_id': preview['cache_id']
    }
    res_confirm = client.post('/api/statements/confirm-import', json=confirm_payload)
    assert res_confirm.status_code == 200
    confirm_data = res_confirm.json()
    assert confirm_data['consolidated_rental_rows'] > 0

    # 5. Check April 2026 P&L after Import
    res_pnl_apr = client.get(f"/api/reports/monthly-pnl?property_id={props[0]['id']}&month=2026-04")
    assert res_pnl_apr.status_code == 200
    apr_data = res_pnl_apr.json()
    apr_rep = apr_data['properties_reports'][0]['months'][0]
    assert apr_rep['total_rental_income'] > 0
    assert apr_rep['repair_percentage'] >= 0

    # 6. Check Static Frontend SPA Serving
    res_spa = client.get('/')
    assert res_spa.status_code == 200
