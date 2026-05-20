#!/bin/bash

echo "=================================================="
echo "  SimpleRentalBooks - First Time Setup"
echo "=================================================="
echo ""

# 1. Check for Python
if ! command -v python3 &> /dev/null
then
    echo "ERROR: Python 3 is not found!"
    echo "Please install Python 3."
    exit 1
fi

# 2. Create Virtual Environment
echo "[1/3] Creating a private box for the software (venv)..."
python3 -m venv venv

# 3. Install Dependencies
echo "[2/3] Installing the software engines (Django, etc.)..."
./venv/bin/pip install -r requirements.txt

# 4. Run Migrations
echo "[3/3] Setting up the database..."
# Ensure data directory exists
mkdir -p data
# Ensure migrations are ready
./venv/bin/python manage.py makemigrations accounting
# Run migrations (creates the tables)
# Use --fake-initial to handle cases where tables already exist from previous manual setups
./venv/bin/python manage.py migrate --fake-initial
# Seed initial data
./venv/bin/python seed_data.py

echo ""
echo "=================================================="
echo "  SUCCESS! Everything is ready."
echo "  To start the app, run: ./start_mac_linux.sh"
echo "=================================================="
echo ""
chmod +x start_mac_linux.sh
