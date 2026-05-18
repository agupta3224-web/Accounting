from django import forms
from .models import Transaction, LLC, Property, Account, JournalEntry, AccountingClass

class TransactionForm(forms.ModelForm):
    class Meta:
        model = Transaction
        fields = ['date', 'description', 'amount', 'property', 'category', 'payment_account']
        widgets = {
            'date': forms.DateInput(attrs={'type': 'date'}),
        }

class FileImportForm(forms.Form):
    file = forms.FileField()
    format_type = forms.ChoiceField(choices=[
        ('bank_csv', 'Bank CSV'),
        ('cc_csv', 'Credit Card CSV'),
        ('pm_csv', 'Property Manager CSV'),
        ('pm_excel', 'Property Manager Excel'),
    ])
    property = forms.ModelChoiceField(queryset=Property.objects.all(), required=False)
    payment_account = forms.ModelChoiceField(queryset=Account.objects.filter(account_type__in=['ASSET', 'LIABILITY']), required=False)

class ReconciliationForm(forms.Form):
    account = forms.ModelChoiceField(queryset=Account.objects.filter(account_type__in=['ASSET', 'LIABILITY']))
    end_date = forms.DateField(widget=forms.DateInput(attrs={'type': 'date'}))
    balance = forms.DecimalField(max_digits=12, decimal_places=2)

class CloseBooksForm(forms.Form):
    end_date = forms.DateField(widget=forms.DateInput(attrs={'type': 'date'}))

class JournalEntryForm(forms.Form):
    date = forms.DateField(widget=forms.DateInput(attrs={'type': 'date'}))
    description = forms.CharField(widget=forms.Textarea(attrs={'rows': 2}))
    debit_account = forms.ModelChoiceField(queryset=Account.objects.all())
    credit_account = forms.ModelChoiceField(queryset=Account.objects.all())
    amount = forms.DecimalField(max_digits=12, decimal_places=2)

class AccountForm(forms.ModelForm):
    class Meta:
        model = Account
        fields = ['code', 'name', 'account_type', 'parent', 'description']

class LLCForm(forms.ModelForm):
    class Meta:
        model = LLC
        fields = ['name']

class PropertyForm(forms.ModelForm):
    class Meta:
        model = Property
        fields = ['name', 'llc', 'address']

class AccountingClassForm(forms.ModelForm):
    class Meta:
        model = AccountingClass
        fields = ['name', 'parent']
