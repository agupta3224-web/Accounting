import os
import sys
import json
import base64
import hmac
import hashlib
import uuid
import platform
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
LICENSE_VAULT_PATH = os.path.join(DATA_DIR, "license.vault")

# Secret signing key used to sign and verify HMAC tokens
SIGNING_SECRET = b"PROPBOOKS_2026_REAL_ESTATE_SECRET_KEY_v2"
TRIAL_DAYS = 21 # 21-Day Free Trial for new installations

class LicenseEngine:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self.machine_id = self._get_machine_fingerprint()
        self._init_vault()

    def _get_machine_fingerprint(self) -> str:
        """
        Creates a stable machine hardware fingerprint based on node, OS, and machine GUID.
        """
        try:
            node = platform.node() or "desktop"
            sys_name = platform.system() or "windows"
            mac = hex(uuid.getnode())
            raw = f"{node}-{sys_name}-{mac}"
            return hashlib.sha256(raw.encode()).hexdigest()[:16]
        except Exception:
            return "MACHINE_DEFAULT_ID"

    def _init_vault(self):
        """
        Initializes the license vault on fresh install with a 21-day trial.
        """
        if not os.path.exists(LICENSE_VAULT_PATH):
            now = datetime.now(timezone.utc)
            trial_expires = now + timedelta(days=TRIAL_DAYS)
            
            vault_data = {
                "first_installed_at": now.isoformat(),
                "trial_started_at": now.isoformat(),
                "trial_expires_at": trial_expires.isoformat(),
                "active_key": None,
                "customer_name": None,
                "customer_email": None,
                "plan_tier": "TRIAL",
                "machine_id": self.machine_id
            }
            self._write_vault(vault_data)

    def _read_vault(self) -> Dict[str, Any]:
        try:
            if os.path.exists(LICENSE_VAULT_PATH):
                with open(LICENSE_VAULT_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _write_vault(self, data: Dict[str, Any]):
        with open(LICENSE_VAULT_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def generate_license_key(
        self,
        plan: str = "ANNUAL", # MONTHLY, ANNUAL, LIFETIME
        customer_name: str = "Valued Investor",
        customer_email: str = "investor@example.com",
        days: int = 365,
        machine_bound: Optional[str] = None
    ) -> str:
        """
        Admin generator: generates a signed license key.
        """
        now = datetime.now(timezone.utc)
        if plan.upper() == "LIFETIME" or days == 0:
            expires_at = "LIFETIME"
        else:
            expires_at = (now + timedelta(days=days)).isoformat()
        
        prefix_map = {
            "MONTHLY": "PBKS-MTH",
            "ANNUAL": "PBKS-ANN",
            "LIFETIME": "PBKS-LIFE",
            "TRIAL": "PBKS-TRL"
        }
        prefix = prefix_map.get(plan.upper(), "PBKS-PRO")

        payload = {
            "name": customer_name,
            "email": customer_email,
            "plan": plan.upper(),
            "issued_at": now.isoformat(),
            "expires_at": expires_at,
            "machine_bound": machine_bound
        }

        payload_json = json.dumps(payload, sort_keys=True)
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
        
        sig = hmac.new(SIGNING_SECRET, payload_b64.encode(), hashlib.sha256).hexdigest()[:12]
        return f"{prefix}-{payload_b64}-{sig}"

    def verify_license_key(self, key_str: str) -> Dict[str, Any]:
        """
        Validates cryptographic signature, expiry date, and machine binding.
        """
        key_str = key_str.strip()
        parts = key_str.split("-")
        if len(parts) < 3:
            raise ValueError("Invalid license key format")

        payload_b64 = parts[-2]
        provided_sig = parts[-1]

        # 1. Verify HMAC Signature
        expected_sig = hmac.new(SIGNING_SECRET, payload_b64.encode(), hashlib.sha256).hexdigest()[:12]
        if not hmac.compare_digest(provided_sig, expected_sig):
            raise ValueError("Invalid license key signature: key has been tampered with or is invalid.")

        # 2. Decode payload
        try:
            padded_b64 = payload_b64 + "=" * (-len(payload_b64) % 4)
            payload_json = base64.urlsafe_b64decode(padded_b64.encode()).decode()
            payload = json.loads(payload_json)
        except Exception:
            raise ValueError("Corrupted license payload")

        # 3. Check expiration
        expires_at_str = payload.get("expires_at")
        if expires_at_str and expires_at_str != "LIFETIME":
            expires_at = datetime.fromisoformat(expires_at_str)
            now = datetime.now(timezone.utc)
            if now > expires_at:
                raise ValueError(f"License expired on {expires_at.strftime('%B %d, %Y')}. Please renew your subscription.")

        # 4. Check machine binding if present
        bound_m = payload.get("machine_bound")
        if bound_m and bound_m != self.machine_id:
            raise ValueError("This license is registered to a different computer hardware profile.")

        return payload

    def activate_license(self, key_str: str) -> Dict[str, Any]:
        payload = self.verify_license_key(key_str)
        
        vault = self._read_vault()
        vault["active_key"] = key_str
        vault["customer_name"] = payload.get("name")
        vault["customer_email"] = payload.get("email")
        vault["plan_tier"] = payload.get("plan", "PRO")
        vault["license_expires_at"] = payload.get("expires_at")
        vault["activated_at"] = datetime.now(timezone.utc).isoformat()
        
        self._write_vault(vault)
        return {
            "status": "ACTIVATED",
            "plan": vault["plan_tier"],
            "name": vault["customer_name"],
            "expires_at": vault["license_expires_at"]
        }

    def deactivate_license(self) -> Dict[str, Any]:
        vault = self._read_vault()
        vault["active_key"] = None
        vault["customer_name"] = None
        vault["customer_email"] = None
        vault["plan_tier"] = "UNLICENSED"
        self._write_vault(vault)
        return {"status": "DEACTIVATED"}

    def get_license_status(self) -> Dict[str, Any]:
        vault = self._read_vault()
        now = datetime.now(timezone.utc)
        active_key = vault.get("active_key")

        # 1. If active paid key is present
        if active_key:
            try:
                payload = self.verify_license_key(active_key)
                expires_at_str = payload.get("expires_at")
                
                if expires_at_str == "LIFETIME":
                    return {
                        "status": "ACTIVE",
                        "plan": payload.get("plan", "LIFETIME"),
                        "plan_display": "Lifetime Investor License",
                        "customer_name": payload.get("name"),
                        "customer_email": payload.get("email"),
                        "expires_at": "LIFETIME",
                        "days_remaining": 9999,
                        "is_trial": False,
                        "is_expiring_soon": False
                    }

                expires_at = datetime.fromisoformat(expires_at_str)
                delta_sec = (expires_at - now).total_seconds()
                days_left = max(0, int(math.ceil(delta_sec / 86400.0)))
                
                plan_name = payload.get("plan", "PRO")
                display = "Monthly Pro Subscription" if plan_name == "MONTHLY" else "Annual Pro Subscription"

                is_expiring_soon = (days_left <= 7)

                return {
                    "status": "ACTIVE",
                    "plan": plan_name,
                    "plan_display": display,
                    "customer_name": payload.get("name"),
                    "customer_email": payload.get("email"),
                    "expires_at": expires_at.strftime("%B %d, %Y"),
                    "days_remaining": days_left,
                    "is_trial": False,
                    "is_expiring_soon": is_expiring_soon
                }
            except Exception as e:
                # Key expired or invalid
                return {
                    "status": "EXPIRED",
                    "plan": vault.get("plan_tier", "EXPIRED"),
                    "plan_display": "Subscription Expired",
                    "customer_name": vault.get("customer_name"),
                    "customer_email": vault.get("customer_email"),
                    "error": str(e),
                    "days_remaining": 0,
                    "is_trial": False,
                    "is_expiring_soon": True
                }

        # 2. Check 21-Day Free Trial
        trial_expires_str = vault.get("trial_expires_at")
        if trial_expires_str:
            trial_expires = datetime.fromisoformat(trial_expires_str)
            if now <= trial_expires:
                days_left = max(0, int(math.ceil((trial_expires - now).total_seconds() / 86400.0)))
                return {
                    "status": "TRIAL_ACTIVE",
                    "plan": "FREE_TRIAL",
                    "plan_display": f"21-Day Free Trial ({days_left} days left)",
                    "customer_name": "Trial User",
                    "customer_email": None,
                    "expires_at": trial_expires.strftime("%B %d, %Y"),
                    "days_remaining": days_left,
                    "is_trial": True,
                    "is_expiring_soon": (days_left <= 5)
                }

        # 3. Trial expired and no active key
        return {
            "status": "EXPIRED",
            "plan": "EXPIRED_TRIAL",
            "plan_display": "21-Day Free Trial Ended",
            "customer_name": None,
            "customer_email": None,
            "days_remaining": 0,
            "is_trial": True,
            "is_expiring_soon": True
        }

# Singleton instance
license_engine = LicenseEngine()
