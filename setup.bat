@echo off
echo Starting SimpleRentalBooks setup for Windows...

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH. Please install Python 3.
    pause
    exit /b 1
)

echo Installing dependencies...
pip install django openpyxl

echo Running migrations...
python manage.py makemigrations accounting
python manage.py migrate

echo.
echo --------------------------------------------------
echo Setup complete!
echo To start the application, run: python manage.py runserver
echo --------------------------------------------------
pause
