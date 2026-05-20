from django.db import models

class AccountingClass(models.Model):
    """
    Used for LLCs and Properties (Classes and Sub-classes).
    e.g. Class: Golden LLC, Sub-class: Apartment A
    """
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='sub_classes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Accounting Class"
        verbose_name_plural = "Accounting Classes"

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} : {self.name}"
        return self.name

class LLC(models.Model):
    name = models.CharField(max_length=255)
    accounting_class = models.OneToOneField(AccountingClass, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Property(models.Model):
    name = models.CharField(max_length=255)  # Acts as the full display name
    short_name = models.CharField(max_length=50, blank=True)
    sub_class_name = models.CharField(max_length=255, blank=True)
    llc = models.ForeignKey(LLC, on_delete=models.CASCADE, related_name='properties')
    accounting_class = models.OneToOneField(AccountingClass, on_delete=models.SET_NULL, null=True, blank=True)

    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    zip_code = models.CharField(max_length=10, blank=True)

    def __str__(self):
        return f"{self.llc.name} - {self.name}"

    def save(self, *args, **kwargs):
        if not self.sub_class_name and self.short_name:
            self.sub_class_name = self.short_name
        super().save(*args, **kwargs)

class Vendor(models.Model):
    company_name = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=255, blank=True)

    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    zip_code = models.CharField(max_length=10, blank=True)

    phone_number = models.CharField(max_length=20, blank=True)
    email_address = models.EmailField(blank=True)

    def __str__(self):
        return self.company_name

class Account(models.Model):
    ACCOUNT_TYPES = [
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('EQUITY', 'Equity'),
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
    ]
    code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='sub_accounts')

    def __str__(self):
        prefix = f"{self.code} - " if self.code else ""
        return f"{prefix}{self.name} ({self.account_type})"

class JournalEntry(models.Model):
    date = models.DateField()
    description = models.TextField(blank=True)
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"JE {self.id} on {self.date}"

class JournalItem(models.Model):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.CASCADE)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, null=True, blank=True)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.account.name}: {self.debit} / {self.credit}"

class Transaction(models.Model):
    # Bridge for single-entry UX
    date = models.DateField()
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    property = models.ForeignKey(Property, on_delete=models.CASCADE)
    category = models.ForeignKey(Account, on_delete=models.CASCADE, limit_choices_to={'account_type__in': ['INCOME', 'EXPENSE']})
    payment_account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='payment_transactions', limit_choices_to={'account_type__in': ['ASSET', 'LIABILITY']})
    journal_entry = models.OneToOneField(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.date}: {self.description} ({self.amount})"

from django.contrib.auth.models import User

class Subscription(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    expiry_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {'Active' if self.is_active else 'Inactive'}"
