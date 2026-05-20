from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Sum, Q
from decimal import Decimal
from datetime import datetime
from .models import Transaction, Property, LLC, JournalItem, Account, JournalEntry, AccountingClass, Vendor
from .services import create_journal_entry_from_transaction, reconcile_account as reconcile_service, close_books as close_service
from .utils import import_csv_transactions, import_excel_property_manager
from .forms import TransactionForm, FileImportForm, ReconciliationForm, CloseBooksForm, JournalEntryForm, AccountForm, LLCForm, PropertyForm, AccountingClassForm, VendorForm

def dashboard(request):
    properties = Property.objects.all()
    llcs = LLC.objects.all()
    total_income = JournalItem.objects.filter(account__account_type='INCOME').aggregate(Sum('credit'))['credit__sum'] or 0
    total_expense = JournalItem.objects.filter(account__account_type='EXPENSE').aggregate(Sum('debit'))['debit__sum'] or 0
    context = {
        'properties': properties,
        'llcs': llcs,
        'net_income': total_income - total_expense,
    }
    return render(request, 'accounting/dashboard.html', context)

def transaction_list(request):
    transactions = Transaction.objects.all().order_by('-date')
    return render(request, 'accounting/transaction_list.html', {'transactions': transactions})

def add_transaction(request):
    if request.method == 'POST':
        form = TransactionForm(request.POST)
        if form.is_valid():
            tx = form.save()
            create_journal_entry_from_transaction(tx)
            return redirect('transaction_list')
    else:
        form = TransactionForm()
    return render(request, 'accounting/transaction_form.html', {'form': form})

def import_file(request):
    if request.method == 'POST':
        form = FileImportForm(request.POST, request.FILES)
        if form.is_valid():
            format_type = form.cleaned_data['format_type']
            if format_type == 'pm_excel':
                import_excel_property_manager(request.FILES['file'])
            else:
                csv_type = 'bank'
                if format_type == 'cc_csv': csv_type = 'cc'
                if format_type == 'pm_csv': csv_type = 'property_manager'

                import_csv_transactions(
                    request.FILES['file'],
                    form.cleaned_data['property'].id,
                    form.cleaned_data['payment_account'].id,
                    csv_type
                )
            return redirect('transaction_list')
    else:
        form = FileImportForm()
    return render(request, 'accounting/import_file.html', {'form': form})

def profit_and_loss(request):
    # Filtering logic
    prop_id = request.GET.get('property')
    llc_id = request.GET.get('llc')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    filters = Q()
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
        'properties': Property.objects.all(),
        'llcs': LLC.objects.all(),
    }
    return render(request, 'accounting/pnl.html', context)

def balance_sheet(request):
    prop_id = request.GET.get('property')
    llc_id = request.GET.get('llc')
    as_of_date = request.GET.get('as_of_date') or datetime.now().date()

    filters = Q(entry__date__lte=as_of_date)
    if prop_id: filters &= Q(property_id=prop_id)
    if llc_id: filters &= Q(property__llc_id=llc_id)

    # Assets, Liabilities, Equity
    accounts = Account.objects.filter(account_type__in=['ASSET', 'LIABILITY', 'EQUITY'])
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
        'properties': Property.objects.all(),
        'llcs': LLC.objects.all(),
    }
    return render(request, 'accounting/balance_sheet.html', context)

def trial_balance(request):
    prop_id = request.GET.get('property')
    llc_id = request.GET.get('llc')
    as_of_date = request.GET.get('as_of_date') or datetime.now().date()

    filters = Q(entry__date__lte=as_of_date)
    if prop_id: filters &= Q(property_id=prop_id)
    if llc_id: filters &= Q(property__llc_id=llc_id)

    accounts = Account.objects.all()
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
        'properties': Property.objects.all(),
        'llcs': LLC.objects.all(),
    }
    return render(request, 'accounting/trial_balance.html', context)

def reconcile(request):
    result = None
    if request.method == 'POST':
        form = ReconciliationForm(request.POST)
        if form.is_valid():
            result = reconcile_service(
                form.cleaned_data['account'].id,
                form.cleaned_data['end_date'],
                form.cleaned_data['balance']
            )
    else:
        form = ReconciliationForm()
    return render(request, 'accounting/reconcile.html', {'form': form, 'result': result})

def close_books_view(request):
    if request.method == 'POST':
        form = CloseBooksForm(request.POST)
        if form.is_valid():
            close_service(form.cleaned_data['end_date'])
            return redirect('dashboard')
    else:
        form = CloseBooksForm()
    return render(request, 'accounting/close_books.html', {'form': form})

def chart_of_accounts(request):
    accounts = Account.objects.all().order_by('code', 'name')
    return render(request, 'accounting/coa_list.html', {'accounts': accounts})

def add_account(request):
    if request.method == 'POST':
        form = AccountForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('coa_list')
    else:
        form = AccountForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Account'})

def edit_account(request, pk):
    account = get_object_or_404(Account, pk=pk)
    if request.method == 'POST':
        form = AccountForm(request.POST, instance=account)
        if form.is_valid():
            form.save()
            return redirect('coa_list')
    else:
        form = AccountForm(instance=account)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Account: {account.name}'})

def add_llc(request):
    if request.method == 'POST':
        form = LLCForm(request.POST)
        if form.is_valid():
            llc = form.save()
            # Create a matching class
            acc_class = AccountingClass.objects.create(name=llc.name)
            llc.accounting_class = acc_class
            llc.save()
            return redirect('dashboard')
    else:
        form = LLCForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add LLC'})

def edit_llc(request, pk):
    llc = get_object_or_404(LLC, pk=pk)
    if request.method == 'POST':
        form = LLCForm(request.POST, instance=llc)
        if form.is_valid():
            form.save()
            return redirect('dashboard')
    else:
        form = LLCForm(instance=llc)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit LLC: {llc.name}'})

def add_property(request):
    if request.method == 'POST':
        form = PropertyForm(request.POST)
        if form.is_valid():
            prop = form.save()
            # Create a matching sub-class under the LLC's class
            parent_class = prop.llc.accounting_class
            class_name = prop.sub_class_name or prop.short_name or prop.name
            acc_class = AccountingClass.objects.create(name=class_name, parent=parent_class)
            prop.accounting_class = acc_class
            prop.save()
            return redirect('dashboard')
    else:
        form = PropertyForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Property'})

def edit_property(request, pk):
    prop = get_object_or_404(Property, pk=pk)
    if request.method == 'POST':
        form = PropertyForm(request.POST, instance=prop)
        if form.is_valid():
            form.save()
            return redirect('dashboard')
    else:
        form = PropertyForm(instance=prop)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Property: {prop.name}'})

def add_class(request):
    if request.method == 'POST':
        form = AccountingClassForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('dashboard')
    else:
        form = AccountingClassForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Class'})

def edit_class(request, pk):
    acc_class = get_object_or_404(AccountingClass, pk=pk)
    if request.method == 'POST':
        form = AccountingClassForm(request.POST, instance=acc_class)
        if form.is_valid():
            form.save()
            return redirect('dashboard')
    else:
        form = AccountingClassForm(instance=acc_class)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Class: {acc_class.name}'})

def vendor_list(request):
    vendors = Vendor.objects.all().order_by('company_name')
    return render(request, 'accounting/vendor_list.html', {'vendors': vendors})

def add_vendor(request):
    if request.method == 'POST':
        form = VendorForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('vendor_list')
    else:
        form = VendorForm()
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': 'Add Vendor'})

def edit_vendor(request, pk):
    vendor = get_object_or_404(Vendor, pk=pk)
    if request.method == 'POST':
        form = VendorForm(request.POST, instance=vendor)
        if form.is_valid():
            form.save()
            return redirect('vendor_list')
    else:
        form = VendorForm(instance=vendor)
    return render(request, 'accounting/generic_form.html', {'form': form, 'title': f'Edit Vendor: {vendor.company_name}'})

def class_list(request):
    classes = AccountingClass.objects.all().order_by('parent__name', 'name')
    return render(request, 'accounting/class_list.html', {'classes': classes})

def add_journal_entry(request):
    if request.method == 'POST':
        form = JournalEntryForm(request.POST)
        if form.is_valid():
            date = form.cleaned_data['date']
            desc = form.cleaned_data['description']
            acc1 = form.cleaned_data['debit_account']
            acc2 = form.cleaned_data['credit_account']
            amount = form.cleaned_data['amount']
            entry = JournalEntry.objects.create(date=date, description=desc)
            JournalItem.objects.create(entry=entry, account=acc1, debit=amount)
            JournalItem.objects.create(entry=entry, account=acc2, credit=amount)
            return redirect('dashboard')
    else:
        form = JournalEntryForm()
    return render(request, 'accounting/journal_entry_form.html', {'form': form})
