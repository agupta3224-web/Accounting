"""
PropBooks License Key Generator (Admin Tool)
Use this tool to generate signed subscription license keys for paying customers.
"""
import sys
import os
import argparse

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

from backend.license_engine import license_engine

def main():
    parser = argparse.ArgumentParser(description="Generate PropBooks Subscription License Keys")
    parser.add_argument("--plan", choices=["monthly", "annual", "lifetime", "trial"], default="annual", help="Subscription Plan Tier")
    parser.add_argument("--name", default="Valued Real Estate Investor", help="Customer Full Name or Business Name")
    parser.add_argument("--email", default="investor@example.com", help="Customer Email Address")
    parser.add_argument("--days", type=int, default=None, help="License validity duration in days (Default: 30 for monthly, 365 for annual)")

    args = parser.parse_args()

    if args.days is None:
        if args.plan.lower() == "monthly":
            days = 30
            price = "$9.99 / mo (Introductory Special)"
        elif args.plan.lower() == "annual":
            days = 365
            price = "$100 / yr (1st Year Special Offer)"
        elif args.plan.lower() == "trial":
            days = 21
            price = "Free Trial"
        else:
            days = 0
            price = "Lifetime"
    else:
        days = args.days
        price = f"Custom ({days} days)"

    key = license_engine.generate_license_key(
        plan=args.plan.upper(),
        customer_name=args.name,
        customer_email=args.email,
        days=days
    )

    print("=" * 75)
    print(" ?? PROPBOOKS PRO - SUBSCRIPTION LICENSE KEY ISSUED")
    print("=" * 75)
    print(f" Customer Name:   {args.name}")
    print(f" Customer Email:  {args.email}")
    print(f" Plan Tier:       {args.plan.upper()} ({price})")
    print(f" Valid Duration:  {days} Days")
    print("-" * 75)
    print(" LICENSE KEY:")
    print(f" {key}")
    print("=" * 75)
    print(" Instructions: Send this key to the customer to enter in their desktop app.")

if __name__ == "__main__":
    main()
