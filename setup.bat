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

:: 4. Prompt for Installation Directory
set "INSTALL_DIR=%USERPROFILE%\SimpleRentalBooks"
echo Current location: %CD%
echo.
echo Recommended location: %INSTALL_DIR%
echo (Installing to C:\ or C:\Program Files may require 'Run as Administrator')
echo.
set /p "USER_DIR=Enter installation directory [%INSTALL_DIR%]: "
if not "%USER_DIR%"=="" set "INSTALL_DIR=%USER_DIR%"

echo.
echo Target installation: %INSTALL_DIR%
echo.

:: 5. Reinstall logic (Copy files to target directory)
if /i "%CD%"=="%INSTALL_DIR%" goto skip_copy

:: Check permissions
mkdir "%INSTALL_DIR%" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Access Denied to %INSTALL_DIR%
    echo --------------------------------------------------
    echo Please right-click setup.bat and select 'Run as Administrator'
    echo OR choose a different folder (e.g., C:\SimpleRentalBooks)
    echo --------------------------------------------------
    echo.
    pause
    exit /b 1
)

echo [1.5/3] Installing/Updating files to %INSTALL_DIR%...

:: Backup existing data from target if it exists
if exist "%INSTALL_DIR%\data" (
    echo Backing up existing data from target...
    if not exist "%TEMP%\SRB_Backup" mkdir "%TEMP%\SRB_Backup"
    xcopy /E /I /Y "%INSTALL_DIR%\data" "%TEMP%\SRB_Backup"
)

:: Create target directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy project files (excluding venv, data, and .git)
xcopy /E /I /Y /EXCLUDE:exclude_list.txt . "%INSTALL_DIR%"

:: Restore data to target
if exist "%TEMP%\SRB_Backup" (
    echo Restoring data to target...
    if not exist "%INSTALL_DIR%\data" mkdir "%INSTALL_DIR%"
    xcopy /E /I /Y "%TEMP%\SRB_Backup" "%INSTALL_DIR%\data"
    rd /S /Q "%TEMP%\SRB_Backup"
)

echo.
echo Reinstallation complete. Please run setup.bat again FROM the new directory:
echo %INSTALL_DIR%
echo.
pause
exit /b 0

:skip_copy

:: 6. Setup/Update Database
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
