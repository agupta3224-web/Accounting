from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.contrib import messages
from django.db import transaction
from django.db.models import Sum, Q
from django.core import serializers
from decimal import Decimal
from datetime import datetime
from .models import Transaction, Property, LLC, JournalItem, Account, JournalEntry, AccountingClass, Vendor, Company, ImportRule, GlobalSetting
from .services import create_journal_entry_from_transaction, reconcile_account as reconcile_service, close_books as close_service, setup_standard_accounts
from .utils import import_csv_transactions, import_excel_property_manager, parse_csv_preview, parse_date, import_iif_coa, get_company_db_name
from .forms import TransactionForm, FileImportForm, ReconciliationForm, CloseBooksForm, JournalEntryForm, JournalItemFormSet, AccountForm, LLCForm, PropertyForm, AccountingClassForm, VendorForm, CompanyForm, GlobalSettingForm, RestoreForm
from django.utils.text import slugify

def company_list(request):
    companies = Company.objects.all()
    return render(request, 'accounting/company_list.html', {'companies': companies})

import shutil
from pathlib import Path
from django.conf import settings

def add_company(request):
    if request.method == 'POST':
        form = CompanyForm(request.POST)
        if form.is_valid():
            company = form.save(commit=False)
            company.db_name = get_company_db_name(company.name)
            company.save()

            # Create a separate DB file for this company
            db_alias = company.db_name
            db_filename = f"{db_alias}.sqlite3"
            db_path = (settings.BASE_DIR / "data" / db_filename).resolve()
            template_path = (settings.BASE_DIR / "data" / "template.sqlite3").resolve()

            shutil.copy2(template_path, db_path)

            # Register new DB in settings at runtime for this session
            # (In production, you'd use a more robust way to manage DB connections)
            settings.DATABASES[db_alias] = settings.DATABASES['default'].copy()
            settings.DATABASES[db_alias].update({
                'NAME': db_path,
            })

            # Explicitly set the active DB context for seeding the new company
            from .router import set_active_db
            set_active_db(db_alias)
            setup_standard_accounts(company)
            set_active_db('default')

            return redirect('company_list')
    else:
        form = CompanyForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Company'})

def select_company(request, pk):
    company = get_object_or_404(Company, pk=pk)
    request.session['active_company_id'] = company.id
    return redirect('dashboard')

def open_sample_company(request):
    company, created = Company.objects.get_or_create(name='Sample Company', defaults={'db_name': get_company_db_name('Sample Company')})
    if created:
        # Create a separate DB file for the sample company
        db_alias = company.db_name
        db_filename = f"{db_alias}.sqlite3"
        db_path = (settings.BASE_DIR / "data" / db_filename).resolve()

        if not db_path.exists():
            template_path = (settings.BASE_DIR / "data" / "template.sqlite3").resolve()
            shutil.copy2(template_path, db_path)

        # Register and initialize the new DB context
        settings.DATABASES[db_alias] = settings.DATABASES['default'].copy()
        settings.DATABASES[db_alias].update({
            'NAME': db_path,
        })

        from .router import set_active_db
        set_active_db(db_alias)
        setup_standard_accounts(company)
        set_active_db('default')

    request.session['active_company_id'] = company.id
    return redirect('dashboard')

def save_company(request):
    # In a web app with DB persistence, every action is already "saved".
    # This view provides a visual confirmation for the user and
    # synchronizes the database filename with the company name if changed.
    company_id = request.session.get('active_company_id')
    if company_id:
        company = get_object_or_404(Company, id=company_id)

        new_db_name = get_company_db_name(company.name)
        if company.db_name != new_db_name:
            old_db_name = company.db_name if company.db_name else f"company_{company.id}"
            old_path = settings.BASE_DIR / "data" / f"{old_db_name}.sqlite3"
            new_path = settings.BASE_DIR / "data" / f"{new_db_name}.sqlite3"

            if old_path.exists() and not new_path.exists():
                # Close all connections to the old database before renaming
                from django.db import connections
                if old_db_name in connections:
                    connections[old_db_name].close()

                try:
                    shutil.move(old_path, new_path)
                    company.db_name = new_db_name
                    company.save()

                    # Update active connection in settings
                    if old_db_name in settings.DATABASES:
                        settings.DATABASES[new_db_name] = settings.DATABASES.pop(old_db_name)
                        settings.DATABASES[new_db_name]['NAME'] = new_path

                    messages.success(request, f"Company database renamed to {new_db_name}.sqlite3")
                except Exception as e:
                    messages.error(request, f"Error renaming database file: {str(e)}")

        messages.success(request, f"Company '{company.name}' saved successfully.")
    return redirect('dashboard')

def copy_company(request):
    active_id = request.session.get('active_company_id')
    if not active_id:
        messages.error(request, "No active company to copy.")
        return redirect('company_list')

    source_company = get_object_or_404(Company, id=active_id)

    if request.method == 'POST':
        new_name = request.POST.get('name')
        if not new_name:
            messages.error(request, "Please provide a name for the new company.")
        else:
            with transaction.atomic():
                db_alias = get_company_db_name(new_name)
                new_company = Company.objects.create(name=new_name, db_name=db_alias)

                # Setup DB file for new company
                db_filename = f"{db_alias}.sqlite3"
                db_path = settings.BASE_DIR / "data" / db_filename

                source_db_filename = source_company.db_name if source_company.db_name else f"company_{source_company.id}"
                source_db_path = settings.BASE_DIR / "data" / f"{source_db_filename}.sqlite3"

                if source_db_path.exists():
                    shutil.copy2(source_db_path, db_path)
                else:
                    template_path = settings.BASE_DIR / "data" / "template.sqlite3"
                    shutil.copy2(template_path, db_path)

                # Register and initialize the new DB context
                settings.DATABASES[db_alias] = settings.DATABASES['default'].copy()
                settings.DATABASES[db_alias].update({
                    'NAME': db_path,
                    'ATOMIC_REQUESTS': False,
                    'AUTOCOMMIT': True,
                })

                # Update company_id in all tables in the new database
                from django.db import connections
                with connections[db_alias].cursor() as cursor:
                    tables = [
                        'accounting_account', 'accounting_accountingclass', 'accounting_llc',
                        'accounting_vendor', 'accounting_journalentry', 'accounting_transaction',
                        'accounting_importrule'
                    ]
                    for table in tables:
                        try:
                            cursor.execute(f"UPDATE {table} SET company_id = {new_company.id}")
                        except:
                            pass # Table might not exist in this version

                messages.success(request, f"Company '{source_company.name}' copied to '{new_company.name}' successfully.")
                request.session['active_company_id'] = new_company.id
                return redirect('dashboard')

    return render(request, 'accounting/generic_form.html', {
        'title': f"Copy Company: {source_company.name}",
        'form': CompanyForm() # Reuse CompanyForm for name field
    })

def backup_company(request):
    active_id = request.session.get('active_company_id')
    if not active_id:
        messages.error(request, "No active company to backup.")
        return redirect('company_list')

    company = get_object_or_404(Company, id=active_id)
    db_filename = company.db_name if company.db_name else f"company_{active_id}"
    db_path = settings.BASE_DIR / "data" / f"{db_filename}.sqlite3"

    if not db_path.exists():
        messages.error(request, "Database file not found.")
        return redirect('dashboard')

    from .backup_service import get_backup_dir
    default_backup_dir = get_backup_dir()

    if request.method == 'POST':
        form = GlobalSettingForm(request.POST)
        if form.is_valid():
            custom_path = form.cleaned_data.get('backup_path')

            if custom_path:
                backup_dir = Path(custom_path)
                # Ensure the custom directory exists
                try:
                    backup_dir.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    messages.error(request, f"Could not create directory: {e}")
                    return redirect('backup_company')
            else:
                backup_dir = default_backup_dir

            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"backup_{company.name.replace(' ', '_')}_{timestamp}.sqlite3"

            # Save a copy to the chosen backup folder
            try:
                shutil.copy2(db_path, backup_dir / backup_filename)
                messages.success(request, f"Backup copy successfully saved to: {backup_dir}")
            except Exception as e:
                messages.error(request, f"Error saving backup to folder: {e}")
                return redirect('backup_company')

            # Serve the download as well
            with open(db_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/x-sqlite3')
                response['Content-Disposition'] = f'attachment; filename="{backup_filename}"'
                return response
    else:
        # Use GlobalSetting for the initial value if it exists
        backup_path_setting = GlobalSetting.objects.filter(key='backup_path').first()
        initial_path = backup_path_setting.value if backup_path_setting else ""
        form = GlobalSettingForm(initial={'backup_path': initial_path})

    return render(request, 'accounting/backup_confirm.html', {
        'form': form,
        'company': company,
        'default_dir': default_backup_dir,
        'title': 'Confirm Backup'
    })

def dashboard(request):
    company_id = request.session.get('active_company_id')
    properties = Property.objects.filter(llc__company_id=company_id)
    llcs = LLC.objects.filter(company_id=company_id)
    total_income = JournalItem.objects.filter(entry__company_id=company_id, account__account_type='INCOME').aggregate(Sum('credit'))['credit__sum'] or 0
    total_expense = JournalItem.objects.filter(entry__company_id=company_id, account__account_type='EXPENSE').aggregate(Sum('debit'))['debit__sum'] or 0
    context = {
        'properties': properties,
        'llcs': llcs,
        'net_income': total_income - total_expense,
    }
    return render(request, 'accounting/dashboard.html', context)

def transaction_list(request):
    company_id = request.session.get('active_company_id')
    transactions = Transaction.objects.filter(company_id=company_id).order_by('-date')
    return render(request, 'accounting/transaction_list.html', {'transactions': transactions})

def add_transaction(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = TransactionForm(request.POST)
        # Filter choices in the form
        form.fields['property'].queryset = Property.objects.filter(llc__company_id=company_id)
        form.fields['category'].queryset = Account.objects.filter(company_id=company_id)
        form.fields['payment_account'].queryset = Account.objects.filter(company_id=company_id, account_type__in=['ASSET', 'LIABILITY'])
        form.fields['vendor'].queryset = Vendor.objects.filter(company_id=company_id)

        if form.is_valid():
            tx = form.save(commit=False)
            tx.company_id = company_id
            tx.save()
            create_journal_entry_from_transaction(tx)
            return redirect('transaction_list')
    else:
        form = TransactionForm()
        form.fields['property'].queryset = Property.objects.filter(llc__company_id=company_id)
        form.fields['category'].queryset = Account.objects.filter(company_id=company_id)
        form.fields['payment_account'].queryset = Account.objects.filter(company_id=company_id, account_type__in=['ASSET', 'LIABILITY'])
        form.fields['vendor'].queryset = Vendor.objects.filter(company_id=company_id)
    return render(request, 'accounting/transaction_form.html', {'form': form, 'title': 'Add Transaction'})

def edit_transaction(request, pk):
    company_id = request.session.get('active_company_id')
    tx = get_object_or_404(Transaction, pk=pk, company_id=company_id)
    if request.method == 'POST':
        form = TransactionForm(request.POST, instance=tx)
        # Filter choices in the form
        form.fields['property'].queryset = Property.objects.filter(llc__company_id=company_id)
        form.fields['category'].queryset = Account.objects.filter(company_id=company_id)
        form.fields['payment_account'].queryset = Account.objects.filter(company_id=company_id, account_type__in=['ASSET', 'LIABILITY'])
        form.fields['vendor'].queryset = Vendor.objects.filter(company_id=company_id)

        if form.is_valid():
            tx = form.save()
            create_journal_entry_from_transaction(tx)
            return redirect('transaction_list')
    else:
        form = TransactionForm(instance=tx)
        form.fields['property'].queryset = Property.objects.filter(llc__company_id=company_id)
        form.fields['category'].queryset = Account.objects.filter(company_id=company_id)
        form.fields['payment_account'].queryset = Account.objects.filter(company_id=company_id, account_type__in=['ASSET', 'LIABILITY'])
        form.fields['vendor'].queryset = Vendor.objects.filter(company_id=company_id)
    return render(request, 'accounting/transaction_form.html', {'form': form, 'title': 'Edit Transaction'})

def import_file(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = FileImportForm(request.POST, request.FILES, company_id=company_id)
        if form.is_valid():
            format_type = form.cleaned_data['format_type']
            if format_type == 'pm_excel':
                import_excel_property_manager(request.FILES['file'], company_id=company_id)
                return redirect('transaction_list')
            else:
                # Store import metadata in session
                request.session['import_data'] = {
                    'property_id': form.cleaned_data['property'].id if form.cleaned_data['property'] else None,
                    'llc_id': form.cleaned_data['llc'].id if form.cleaned_data['llc'] else None,
                    'payment_account_id': form.cleaned_data['payment_account'].id if form.cleaned_data['payment_account'] else None,
                    'format_type': format_type,
                    'rows': parse_csv_preview(request.FILES['file'])
                }
                return redirect('categorize_import')
    else:
        form = FileImportForm(company_id=company_id)
    return render(request, 'accounting/import_file.html', {'form': form})

def categorize_import(request):
    company_id = request.session.get('active_company_id')
    import_data = request.session.get('import_data')
    if not import_data:
        return redirect('import_file')

    accounts = Account.objects.filter(company_id=company_id)
    rules = ImportRule.objects.filter(company_id=company_id)

    # Process rows to find suggested categories
    processed_rows = []
    for row in import_data['rows']:
        desc = ""
        amount = "0"

        ft = import_data['format_type']
        if ft == 'pm_csv':
            desc = row.get('comment') or row.get('description') or ""
            amount = row.get('total') or row.get('amount') or "0"
        elif ft == 'cc_csv':
            desc = row.get('description') or row.get('memo') or ""
            amount = row.get('charge') or row.get('amount') or "0"
        else: # bank
            desc = row.get('description') or row.get('memo') or ""
            amount = row.get('amount') or "0"

        suggested_cat = None
        for rule in rules:
            if rule.search_text.lower() in desc.lower():
                suggested_cat = rule.category_id
                break

        processed_rows.append({
            'date': row.get('date') or row.get('transaction date') or row.get('trans. date'),
            'description': desc,
            'amount': amount,
            'suggested_cat': suggested_cat,
            'raw': row
        })

    return render(request, 'accounting/import_categorize.html', {
        'rows': processed_rows,
        'accounts': accounts,
        'title': 'Categorize Transactions'
    })

def process_import(request):
    company_id = request.session.get('active_company_id')
    import_data = request.session.pop('import_data', None)
    if not import_data:
        return redirect('import_file')

    prop = Property.objects.get(id=import_data['property_id']) if import_data['property_id'] else None
    llc = LLC.objects.get(id=import_data['llc_id']) if import_data['llc_id'] else None
    payment_account = Account.objects.get(id=import_data['payment_account_id']) if import_data['payment_account_id'] else None

    with transaction.atomic():
        for i, row in enumerate(import_data['rows']):
            category_id = request.POST.get(f'category_{i}')
            if not category_id: continue

            category = Account.objects.get(id=category_id)

            desc = ""
            amount_str = "0"
            ft = import_data['format_type']
            if ft == 'pm_csv':
                desc = row.get('comment') or row.get('description') or ""
                amount_str = row.get('total') or row.get('amount') or "0"
            elif ft == 'cc_csv':
                desc = row.get('description') or row.get('memo') or ""
                amount_str = row.get('charge') or row.get('amount') or "0"
            else: # bank
                desc = row.get('description') or row.get('memo') or ""
                amount_str = row.get('amount') or "0"

            date_str = row.get('date') or row.get('transaction date') or row.get('trans. date')
            date = parse_date(date_str) if date_str else datetime.now().date()

            tx = Transaction.objects.create(
                company_id=company_id,
                date=date,
                description=desc or "Imported CSV",
                amount=Decimal(amount_str.replace(',', '')),
                property=prop,
                llc=llc,
                payment_account=payment_account,
                category=category
            )
            create_journal_entry_from_transaction(tx)

            # Create rule if requested
            if request.POST.get(f'rule_{i}') == 'on':
                ImportRule.objects.get_or_create(
                    company_id=company_id,
                    search_text=desc,
                    defaults={'category': category}
                )

    messages.success(request, f"Imported {len(import_data['rows'])} transactions.")
    return redirect('transaction_list')

def add_account_ajax(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        name = request.POST.get('name')
        type = request.POST.get('account_type')
        code = request.POST.get('code')
        if name and type:
            try:
                acc = Account.objects.create(
                    company_id=company_id,
                    name=name,
                    account_type=type,
                    code=code
                )
                return JsonResponse({'id': acc.id, 'name': str(acc)})
            except Exception as e:
                return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Invalid data'}, status=400)

def profit_and_loss(request):
    company_id = request.session.get('active_company_id')
    # Filtering logic
    prop_id = request.GET.get('property')
    llc_id = request.GET.get('llc')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    filters = Q(entry__company_id=company_id)
    if prop_id: filters &= Q(property_id=prop_id)
    if llc_id: filters &= Q(property__llc_id=llc_id)
    if start_date: filters &= Q(entry__date__gte=start_date)
    if end_date: filters &= Q(entry__date__lte=end_date)

    income_items = JournalItem.objects.filter(filters, account__account_type='INCOME').values('account__name').annotate(total=Sum('credit'))
    expense_items = JournalItem.objects.filter(filters, account__account_type='EXPENSE').values('account__name').annotate(total=Sum('debit'))

    total_income = sum(item['total'] for item in income_items)
    total_expense = sum(item['total'] for item in expense_items)
    net_profit = total_income - total_expense

    # Calculate percentages
    for item in income_items:
        item['percent'] = (item['total'] / total_income * 100) if total_income else 0
    for item in expense_items:
        item['percent'] = (item['total'] / total_income * 100) if total_income else 0

    context = {
        'income_items': income_items,
        'expense_items': expense_items,
        'total_income': total_income,
        'total_expense': total_expense,
        'net_profit': net_profit,
        'properties': Property.objects.filter(llc__company_id=company_id),
        'llcs': LLC.objects.filter(company_id=company_id),
    }
    return render(request, 'accounting/pnl.html', context)

def balance_sheet(request):
    company_id = request.session.get('active_company_id')
    prop_id = request.GET.get('property')
    llc_id = request.GET.get('llc')
    as_of_date = request.GET.get('as_of_date') or datetime.now().date()

    filters = Q(entry__company_id=company_id, entry__date__lte=as_of_date)
    if prop_id: filters &= Q(property_id=prop_id)
    if llc_id: filters &= Q(property__llc_id=llc_id)

    # Assets, Liabilities, Equity
    accounts = Account.objects.filter(company_id=company_id, account_type__in=['ASSET', 'LIABILITY', 'EQUITY'])
    report_data = []
    total_assets = 0
    total_liab_equity = 0

    for acc in accounts:
        items = JournalItem.objects.filter(filters, account=acc)
        debit = items.aggregate(Sum('debit'))['debit__sum'] or 0
        credit = items.aggregate(Sum('credit'))['credit__sum'] or 0

        if acc.account_type in ['ASSET']:
            balance = debit - credit
            total_assets += balance
        else:
            balance = credit - debit
            total_liab_equity += balance

        if balance != 0:
            report_data.append({'name': acc.name, 'type': acc.account_type, 'balance': balance})

    context = {
        'report_data': report_data,
        'total_assets': total_assets,
        'total_liab_equity': total_liab_equity,
        'as_of_date': as_of_date,
        'properties': Property.objects.filter(llc__company_id=company_id),
        'llcs': LLC.objects.filter(company_id=company_id),
    }
    return render(request, 'accounting/balance_sheet.html', context)

def trial_balance(request):
    company_id = request.session.get('active_company_id')
    prop_id = request.GET.get('property')
    llc_id = request.GET.get('llc')
    as_of_date = request.GET.get('as_of_date') or datetime.now().date()

    filters = Q(entry__company_id=company_id, entry__date__lte=as_of_date)
    if prop_id: filters &= Q(property_id=prop_id)
    if llc_id: filters &= Q(property__llc_id=llc_id)

    accounts = Account.objects.filter(company_id=company_id)
    report_data = []
    total_debit = 0
    total_credit = 0

    for acc in accounts:
        items = JournalItem.objects.filter(filters, account=acc)
        debit = items.aggregate(Sum('debit'))['debit__sum'] or 0
        credit = items.aggregate(Sum('credit'))['credit__sum'] or 0

        if debit != 0 or credit != 0:
            report_data.append({'name': acc.name, 'debit': debit, 'credit': credit})
            total_debit += debit
            total_credit += credit

    context = {
        'report_data': report_data,
        'total_debit': total_debit,
        'total_credit': total_credit,
        'as_of_date': as_of_date,
        'properties': Property.objects.filter(llc__company_id=company_id),
        'llcs': LLC.objects.filter(company_id=company_id),
    }
    return render(request, 'accounting/trial_balance.html', context)

def reconcile(request):
    company_id = request.session.get('active_company_id')
    result = None
    if request.method == 'POST':
        form = ReconciliationForm(request.POST, company_id=company_id)
        if form.is_valid():
            result = reconcile_service(
                form.cleaned_data['account'].id,
                form.cleaned_data['end_date'],
                form.cleaned_data['balance']
            )
    else:
        form = ReconciliationForm(company_id=company_id)
    return render(request, 'accounting/reconcile.html', {'form': form, 'result': result})

def close_books_view(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = CloseBooksForm(request.POST)
        if form.is_valid():
            close_service(form.cleaned_data['end_date'], company_id=company_id)
            return redirect('dashboard')
    else:
        form = CloseBooksForm()
    return render(request, 'accounting/close_books.html', {'form': form})

def chart_of_accounts(request):
    company_id = request.session.get('active_company_id')
    # Fetch only top-level accounts; sub-accounts will be rendered recursively in the template
    accounts = Account.objects.filter(company_id=company_id, parent__isnull=True).order_by('code', 'name')
    return render(request, 'accounting/coa_list.html', {'accounts': accounts})

def add_account(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = AccountForm(request.POST, company_id=company_id)
        if form.is_valid():
            acc = form.save(commit=False)
            acc.company_id = company_id
            acc.save()
            return redirect('coa_list')
    else:
        form = AccountForm(company_id=company_id)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Account'})

def edit_account(request, pk):
    company_id = request.session.get('active_company_id')
    account = get_object_or_404(Account, pk=pk, company_id=company_id)
    if request.method == 'POST':
        form = AccountForm(request.POST, instance=account, company_id=company_id)
        if form.is_valid():
            form.save()
            return redirect('coa_list')
    else:
        form = AccountForm(instance=account, company_id=company_id)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Account: {account.name}'})

def delete_account(request, pk):
    company_id = request.session.get('active_company_id')
    account = get_object_or_404(Account, pk=pk, company_id=company_id)

    # Check if used in transactions or journal items
    if JournalItem.objects.filter(account=account).exists() or Transaction.objects.filter(Q(category=account) | Q(payment_account=account)).exists():
        messages.error(request, f"Cannot delete account '{account.name}' because it has transactions associated with it.")
    else:
        account.delete()
        messages.success(request, f"Account '{account.name}' deleted successfully.")

    return redirect('coa_list')

def import_coa_iif(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        if 'file' in request.FILES:
            try:
                count = import_iif_coa(request.FILES['file'], company_id)
                messages.success(request, f"Successfully imported {count} accounts from IIF.")
                return redirect('coa_list')
            except Exception as e:
                messages.error(request, f"Error importing IIF: {str(e)}")
        else:
            messages.error(request, "No file uploaded.")

    return render(request, 'accounting/import_coa.html', {'title': 'Import Chart of Accounts (IIF)'})

def add_llc(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = LLCForm(request.POST)
        if form.is_valid():
            llc = form.save(commit=False)
            llc.company_id = company_id
            llc.save()
            # Create a matching class
            acc_class = AccountingClass.objects.create(name=llc.name, company_id=company_id)
            llc.accounting_class = acc_class
            llc.save()
            return redirect('dashboard')
    else:
        form = LLCForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add LLC'})

def edit_llc(request, pk):
    company_id = request.session.get('active_company_id')
    llc = get_object_or_404(LLC, pk=pk, company_id=company_id)
    if request.method == 'POST':
        form = LLCForm(request.POST, instance=llc)
        if form.is_valid():
            form.save()
            return redirect('dashboard')
    else:
        form = LLCForm(instance=llc)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit LLC: {llc.name}'})

def add_property(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = PropertyForm(request.POST, company_id=company_id)
        if form.is_valid():
            prop = form.save()
            # Create a matching sub-class under the LLC's class
            parent_class = prop.llc.accounting_class
            class_name = prop.sub_class_name or prop.short_name or prop.address_line_1
            acc_class = AccountingClass.objects.create(name=class_name, parent=parent_class, company_id=company_id)
            prop.accounting_class = acc_class
            prop.save()
            return redirect('dashboard')
    else:
        form = PropertyForm(company_id=company_id)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Property'})

def edit_property(request, pk):
    company_id = request.session.get('active_company_id')
    prop = get_object_or_404(Property, pk=pk, llc__company_id=company_id)
    if request.method == 'POST':
        form = PropertyForm(request.POST, instance=prop, company_id=company_id)
        if form.is_valid():
            form.save()
            return redirect('dashboard')
    else:
        form = PropertyForm(instance=prop, company_id=company_id)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Property: {prop.short_name or prop.address_line_1}'})

def add_class(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = AccountingClassForm(request.POST, company_id=company_id)
        if form.is_valid():
            obj = form.save(commit=False)
            obj.company_id = company_id
            obj.save()
            return redirect('dashboard')
    else:
        form = AccountingClassForm(company_id=company_id)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Class'})

def edit_class(request, pk):
    company_id = request.session.get('active_company_id')
    acc_class = get_object_or_404(AccountingClass, pk=pk, company_id=company_id)
    if request.method == 'POST':
        form = AccountingClassForm(request.POST, instance=acc_class, company_id=company_id)
        if form.is_valid():
            form.save()
            return redirect('dashboard')
    else:
        form = AccountingClassForm(instance=acc_class, company_id=company_id)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Class: {acc_class.name}'})

def vendor_list(request):
    company_id = request.session.get('active_company_id')
    vendors = Vendor.objects.filter(company_id=company_id).order_by('company_name')
    return render(request, 'accounting/vendor_list.html', {'vendors': vendors})

def add_vendor(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = VendorForm(request.POST)
        if form.is_valid():
            vendor = form.save(commit=False)
            vendor.company_id = company_id
            vendor.save()
            return redirect('vendor_list')
    else:
        form = VendorForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Vendor'})

def edit_vendor(request, pk):
    company_id = request.session.get('active_company_id')
    vendor = get_object_or_404(Vendor, pk=pk, company_id=company_id)
    if request.method == 'POST':
        form = VendorForm(request.POST, instance=vendor)
        if form.is_valid():
            form.save()
            return redirect('vendor_list')
    else:
        form = VendorForm(instance=vendor)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Vendor: {vendor.company_name}'})

def class_list(request):
    company_id = request.session.get('active_company_id')
    # Only get top level classes, sub-classes will be accessed via related name in template
    classes = AccountingClass.objects.filter(company_id=company_id, parent=None).order_by('name')
    return render(request, 'accounting/class_list.html', {'classes': classes})

def add_journal_entry(request):
    company_id = request.session.get('active_company_id')
    if request.method == 'POST':
        form = JournalEntryForm(request.POST)
        formset = JournalItemFormSet(request.POST, form_kwargs={'company_id': company_id})
        if form.is_valid() and formset.is_valid():
            entry = form.save(commit=False)
            entry.company_id = company_id
            entry.save()
            formset.instance = entry
            formset.save()
            return redirect('dashboard')
    else:
        form = JournalEntryForm()
        formset = JournalItemFormSet(form_kwargs={'company_id': company_id})
    return render(request, 'accounting/journal_entry_form.html', {
        'form': form,
        'formset': formset,
        'title': 'Add Journal Entry'
    })

def settings_view(request):
    backup_path_setting, _ = GlobalSetting.objects.get_or_create(key='backup_path')

    if request.method == 'POST':
        form = GlobalSettingForm(request.POST)
        if form.is_valid():
            backup_path_setting.value = form.cleaned_data['backup_path']
            backup_path_setting.save()
            messages.success(request, "Settings updated successfully.")
            return redirect('settings')
    else:
        form = GlobalSettingForm(initial={'backup_path': backup_path_setting.value})

    return render(request, 'accounting/settings.html', {
        'form': form,
        'title': 'Global Settings'
    })

def restore_company(request):
    if request.method == 'POST':
        form = RestoreForm(request.POST)
        if form.is_valid():
            backup_file_path = Path(form.cleaned_data['backup_file_path'])
            restore_as_name = form.cleaned_data['restore_as_name']

            if not backup_file_path.exists():
                messages.error(request, f"Backup file not found at: {backup_file_path}")
            elif not backup_file_path.is_file():
                messages.error(request, f"The path provided is not a file: {backup_file_path}")
            else:
                try:
                    db_alias = get_company_db_name(restore_as_name)
                    db_filename = f"{db_alias}.sqlite3"
                    dest_path = settings.BASE_DIR / "data" / db_filename

                    if dest_path.exists():
                        messages.error(request, f"A database named {db_filename} already exists. Please choose a different company name.")
                    else:
                        # Copy the backup file
                        shutil.copy2(backup_file_path, dest_path)

                        # Create Company record
                        Company.objects.create(name=restore_as_name, db_name=db_alias)

                        messages.success(request, f"Company '{restore_as_name}' successfully restored from backup.")
                        return redirect('company_list')
                except Exception as e:
                    messages.error(request, f"An error occurred during restoration: {e}")
    else:
        form = RestoreForm()

    return render(request, 'accounting/restore_company.html', {
        'form': form,
        'title': 'Restore Company from Backup'
    })
