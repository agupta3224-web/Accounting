import pytest
from backend.license_engine import license_engine

def test_license_engine_full_workflow():
    # 1. Check default 21-Day Free Trial status
    status = license_engine.get_license_status()
    assert status["status"] in ["TRIAL_ACTIVE", "ACTIVE"]
    if status["status"] == "TRIAL_ACTIVE":
        assert status["is_trial"] is True
        assert status["days_remaining"] <= 21

    # 2. Generate Monthly License Key ($9.99/mo)
    monthly_key = license_engine.generate_license_key(
        plan="MONTHLY",
        customer_name="Alice Investor",
        customer_email="alice@investor.com",
        days=30
    )
    assert monthly_key.startswith("PBKS-MTH-")

    # 3. Activate Monthly License Key
    act_res = license_engine.activate_license(monthly_key)
    assert act_res["status"] == "ACTIVATED"
    assert act_res["plan"] == "MONTHLY"

    status_m = license_engine.get_license_status()
    assert status_m["status"] == "ACTIVE"
    assert status_m["plan"] == "MONTHLY"
    assert status_m["customer_name"] == "Alice Investor"
    assert status_m["days_remaining"] == 30

    # 4. Generate Annual License Key ($100/yr Special Offer)
    annual_key = license_engine.generate_license_key(
        plan="ANNUAL",
        customer_name="Apex Holdings Inc",
        customer_email="finance@apexholdings.com",
        days=365
    )
    assert annual_key.startswith("PBKS-ANN-")

    # 5. Activate Annual License Key
    act_ann = license_engine.activate_license(annual_key)
    assert act_ann["status"] == "ACTIVATED"
    assert act_ann["plan"] == "ANNUAL"

    status_ann = license_engine.get_license_status()
    assert status_ann["status"] == "ACTIVE"
    assert status_ann["plan"] == "ANNUAL"
    assert status_ann["days_remaining"] == 365

    # 6. Verify Tampered / Invalid Key Rejection
    fake_key = monthly_key[:-4] + "ffff"
    with pytest.raises(ValueError, match="Invalid license key signature"):
        license_engine.activate_license(fake_key)

    # 7. Verify Expired Key Rejection
    expired_key = license_engine.generate_license_key(
        plan="MONTHLY",
        customer_name="Expired User",
        days=-5 # Expired 5 days ago
    )
    with pytest.raises(ValueError, match="License expired"):
        license_engine.activate_license(expired_key)

if __name__ == "__main__":
    test_license_engine_full_workflow()
    print("License engine tests passed successfully!")
