from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.contrib import messages
from django.db import transaction
from django.db.models import Sum, Q
from django.core import serializers
from decimal import Decimal
from datetime import datetime
from .models import Transaction, Property, LLC, JournalItem, Account, JournalEntry, AccountingClass, Vendor, Company, ImportRule
from .services import create_journal_entry_from_transaction, reconcile_account as reconcile_service, close_books as close_service, setup_standard_accounts
from .utils import import_csv_transactions, import_excel_property_manager, parse_csv_preview, parse_date, import_iif_coa
from .forms import TransactionForm, FileImportForm, ReconciliationForm, CloseBooksForm, JournalEntryForm, JournalItemFormSet, AccountForm, LLCForm, PropertyForm, AccountingClassForm, VendorForm, CompanyForm

def company_list(request):
    companies = Company.objects.all()
    return render(request, 'accounting/company_list.html', {'companies': companies})

def add_company(request):
    if request.method == 'POST':
        form = CompanyForm(request.POST)
        if form.is_valid():
            company = form.save()
            setup_standard_accounts(company)
            return redirect('company_list')
    else:
        form = CompanyForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Company'})

def select_company(request, pk):
    company = get_object_or_404(Company, pk=pk)
    request.session['active_company_id'] = company.id
    return redirect('dashboard')

def open_sample_company(request):
    company, created = Company.objects.get_or_create(name='Sample Company')
    if created:
        setup_standard_accounts(company)
    request.session['active_company_id'] = company.id
    return redirect('dashboard')

def save_company(request):
    # In a web app with DB persistence, every action is already "saved".
    # This view provides a visual confirmation for the user.
    company_id = request.session.get('active_company_id')
    if company_id:
        company = get_object_or_404(Company, id=company_id)
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
                new_company = Company.objects.create(name=new_name)

                # Copy Accounts
                accounts = Account.objects.filter(company=source_company)
                acc_mapping = {} # old_id -> new_obj
                for acc in accounts:
                    old_id = acc.id
                    acc.pk = None
                    acc.company = new_company
                    acc.save()
                    acc_mapping[old_id] = acc

                # Fix Account parents
                for old_id, new_acc in acc_mapping.items():
                    old_acc = Account.objects.get(id=old_id)
                    if old_acc.parent_id:
                        new_acc.parent = acc_mapping.get(old_acc.parent_id)
                        new_acc.save()

                # Copy Classes
                classes = AccountingClass.objects.filter(company=source_company)
                class_mapping = {}
                for cls in classes:
                    old_id = cls.id
                    cls.pk = None
                    cls.company = new_company
                    cls.save()
                    class_mapping[old_id] = cls

                # Fix Class parents
                for old_id, new_cls in class_mapping.items():
                    old_cls = AccountingClass.objects.get(id=old_id)
                    if old_cls.parent_id:
                        new_cls.parent = class_mapping.get(old_cls.parent_id)
                        new_cls.save()

                # Copy LLCs
                llcs = LLC.objects.filter(company=source_company)
                llc_mapping = {}
                for llc in llcs:
                    old_id = llc.id
                    old_class_id = llc.accounting_class_id
                    llc.pk = None
                    llc.company = new_company
                    llc.accounting_class = class_mapping.get(old_class_id)
                    llc.save()
                    llc_mapping[old_id] = llc

                # Copy Properties
                props = Property.objects.filter(llc__company=source_company)
                for prop in props:
                    old_llc_id = prop.llc_id
                    old_class_id = prop.accounting_class_id
                    prop.pk = None
                    prop.llc = llc_mapping.get(old_llc_id)
                    prop.accounting_class = class_mapping.get(old_class_id)
                    prop.save()

                # Copy Vendors
                vendors = Vendor.objects.filter(company=source_company)
                for v in vendors:
                    v.pk = None
                    v.company = new_company
                    v.save()

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

    # Collect all related data
    data = []
    data.extend(Account.objects.filter(company=company))
    data.extend(AccountingClass.objects.filter(company=company))
    data.extend(LLC.objects.filter(company=company))
    data.extend(Property.objects.filter(llc__company=company))
    data.extend(Vendor.objects.filter(company=company))
    data.extend(JournalEntry.objects.filter(company=company))
    data.extend(JournalItem.objects.filter(entry__company=company))
    data.extend(Transaction.objects.filter(company=company))

    serialized_data = serializers.serialize('json', data)

    filename = f"backup_{company.name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    response = HttpResponse(serialized_data, content_type='application/json')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response

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
    accounts = Account.objects.filter(company_id=company_id).order_by('code', 'name')
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
