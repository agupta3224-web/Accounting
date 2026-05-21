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

:: 4. Run Migrations
echo [3/3] Setting up the database...
:: Ensure data directory exists
if not exist data mkdir data

:: Run migrations
venv\Scripts\python.exe manage.py migrate
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
