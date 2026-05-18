#!/bin/bash

echo "Starting SimpleRentalBooks setup..."

# Install dependencies
pip install django openpyxl

# Run migrations
python manage.py makemigrations accounting
python manage.py migrate

# Create initial data (optional)
# python manage.py loaddata initial_data.json

echo ""
echo "--------------------------------------------------"
echo "Setup complete!"
echo "To start the application, run: python manage.py runserver"
echo "--------------------------------------------------"
