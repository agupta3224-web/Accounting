@echo off
setlocal
echo ==================================================
echo   SimpleRentalBooks - Setup & Update
echo ==================================================
echo.

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not found!
    echo Please install Python 3 from https://www.python.org/
    pause
    exit /b 1
)

:: 2. Create Virtual Environment
echo [1/3] Creating a private box for the software (venv)...
if not exist venv (
    python -m venv venv
)
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment.
    pause
    exit /b 1
)

:: 3. Install Dependencies
echo [2/3] Installing the software engines (Django, etc.)...
venv\Scripts\python.exe -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install software engines.
    pause
    exit /b 1
)

:: 4. Setup/Update Database
echo [3/3] Setting up the database...
:: Ensure data directory exists
if not exist data mkdir data

:: Handle legacy database migration to multi-db master
if exist db.sqlite3 (
    if not exist data\master.sqlite3 (
        echo Found legacy single-database, migrating to master...
        move db.sqlite3 data\master.sqlite3
    )
)
if exist data\db.sqlite3 (
    if not exist data\master.sqlite3 (
        echo Found old database in data folder, migrating to master...
        move data\db.sqlite3 data\master.sqlite3
    )
)

:: Ensure migrations are ready
venv\Scripts\python.exe manage.py makemigrations accounting

:: Run migrations (creates the tables)
:: Use --fake-initial to handle cases where tables already exist from previous manual setups
venv\Scripts\python.exe manage.py migrate --fake-initial
venv\Scripts\python.exe manage.py migrate --database=company_template --fake-initial
if %errorlevel% neq 0 (
    echo ERROR: Database migration failed.
    pause
    exit /b 1
)

:: Seed initial data
venv\Scripts\python.exe seed_data.py
if %errorlevel% neq 0 (
    echo ERROR: Failed to set up the database.
    pause
    exit /b 1
)

echo.
echo ==================================================
echo   SUCCESS! Everything is ready.
echo   To start the app, double-click: start_windows.bat
echo ==================================================
echo.
pause
