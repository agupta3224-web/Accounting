from django import forms
from .models import Transaction, LLC, Property, Account, JournalEntry, JournalItem, AccountingClass, Vendor, Company

US_STATES = [
    ('', 'Select State'),
    ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'), ('CA', 'California'),
    ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'), ('FL', 'Florida'), ('GA', 'Georgia'),
    ('HI', 'Hawaii'), ('ID', 'Idaho'), ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'),
    ('KS', 'Kansas'), ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
    ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'), ('MO', 'Missouri'),
    ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'), ('NH', 'New Hampshire'), ('NJ', 'New Jersey'),
    ('NM', 'New Mexico'), ('NY', 'New York'), ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'),
    ('OK', 'Oklahoma'), ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
    ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'), ('VT', 'Vermont'),
    ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'), ('WI', 'Wisconsin'), ('WY', 'Wyoming'),
]

class TransactionForm(forms.ModelForm):
    class Meta:
        model = Transaction
        fields = ['date', 'description', 'amount', 'property', 'vendor', 'category', 'payment_account']
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
    property = forms.ModelChoiceField(queryset=Property.objects.none(), required=False, label="Apply to Property")
    llc = forms.ModelChoiceField(queryset=LLC.objects.none(), required=False, label="OR Apply to LLC")
    payment_account = forms.ModelChoiceField(queryset=Account.objects.none(), required=False)

    def __init__(self, *args, **kwargs):
        company_id = kwargs.pop('company_id', None)
        super().__init__(*args, **kwargs)
        if company_id:
            self.fields['property'].queryset = Property.objects.filter(llc__company_id=company_id)
            self.fields['llc'].queryset = LLC.objects.filter(company_id=company_id)
            self.fields['payment_account'].queryset = Account.objects.filter(company_id=company_id, account_type__in=['ASSET', 'LIABILITY'])

class ReconciliationForm(forms.Form):
    account = forms.ModelChoiceField(queryset=Account.objects.none())

    def __init__(self, *args, **kwargs):
        company_id = kwargs.pop('company_id', None)
        super().__init__(*args, **kwargs)
        if company_id:
            self.fields['account'].queryset = Account.objects.filter(company_id=company_id, account_type__in=['ASSET', 'LIABILITY'])
    end_date = forms.DateField(widget=forms.DateInput(attrs={'type': 'date'}))
    balance = forms.DecimalField(max_digits=12, decimal_places=2)

class CloseBooksForm(forms.Form):
    end_date = forms.DateField(widget=forms.DateInput(attrs={'type': 'date'}))

class JournalEntryForm(forms.ModelForm):
    class Meta:
        model = JournalEntry
        fields = ['date', 'doc_num', 'description']
        widgets = {
            'date': forms.DateInput(attrs={'type': 'date'}),
            'description': forms.Textarea(attrs={'rows': 2}),
        }

class JournalItemForm(forms.ModelForm):
    class Meta:
        model = JournalItem
        fields = ['account', 'debit', 'credit', 'memo', 'accounting_class']

    def __init__(self, *args, **kwargs):
        company_id = kwargs.pop('company_id', None)
        super().__init__(*args, **kwargs)
        if company_id:
            self.fields['account'].queryset = Account.objects.filter(company_id=company_id)
            self.fields['accounting_class'].queryset = AccountingClass.objects.filter(company_id=company_id)

JournalItemFormSet = forms.inlineformset_factory(
    JournalEntry, JournalItem,
    form=JournalItemForm,
    extra=4,
    can_delete=True
)

class AccountForm(forms.ModelForm):
    class Meta:
        model = Account
        fields = ['code', 'name', 'account_type', 'parent', 'description']

    def __init__(self, *args, **kwargs):
        company_id = kwargs.pop('company_id', None)
        super().__init__(*args, **kwargs)
        if company_id:
            self.fields['parent'].queryset = Account.objects.filter(company_id=company_id)

class LLCForm(forms.ModelForm):
    class Meta:
        model = LLC
        fields = ['name']

class PropertyForm(forms.ModelForm):
    state = forms.ChoiceField(choices=US_STATES, required=False)
    class Meta:
        model = Property
        fields = [
            'short_name', 'sub_class_name', 'llc',
            'address_line_1', 'address_line_2', 'city', 'state', 'zip_code'
        ]

    def __init__(self, *args, **kwargs):
        company_id = kwargs.pop('company_id', None)
        super().__init__(*args, **kwargs)
        if company_id:
            self.fields['llc'].queryset = LLC.objects.filter(company_id=company_id)

class VendorForm(forms.ModelForm):
    state = forms.ChoiceField(choices=US_STATES, required=False)
    class Meta:
        model = Vendor
        fields = [
            'company_name', 'contact_name',
            'address_line_1', 'address_line_2', 'city', 'state', 'zip_code',
            'phone_number', 'email_address'
        ]

    def clean_phone_number(self):
        phone = self.cleaned_data.get('phone_number')
        if phone:
            # Strip non-digits
            digits = "".join(filter(str.isdigit, phone))
            if len(digits) == 10:
                return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        return phone

class AccountingClassForm(forms.ModelForm):
    class Meta:
        model = AccountingClass
        fields = ['name', 'parent']

    def __init__(self, *args, **kwargs):
        company_id = kwargs.pop('company_id', None)
        super().__init__(*args, **kwargs)
        if company_id:
            self.fields['parent'].queryset = AccountingClass.objects.filter(company_id=company_id)

class CompanyForm(forms.ModelForm):
    class Meta:
        model = Company
        fields = ['name']

class GlobalSettingForm(forms.Form):
    backup_path = forms.CharField(
        max_length=255,
        required=False,
        label="Backup Folder Path",
        help_text="Enter a full folder path (e.g. C:\\Backups or /home/user/backups). If left blank, 'backups/' in the project folder will be used."
    )
