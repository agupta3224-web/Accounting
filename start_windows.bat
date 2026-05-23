@echo off
echo Starting SimpleRentalBooks...

:: Ensure database is ready before starting server
echo [1/2] Checking for updates...
venv\Scripts\python.exe manage.py migrate --fake-initial >nul 2>&1
venv\Scripts\python.exe manage.py migrate --database=company_template --fake-initial >nul 2>&1

echo [2/2] Launching server...
venv\Scripts\python.exe manage.py runserver
pause
