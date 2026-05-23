from django.contrib import admin
from .models import LLC, Property, Account, JournalEntry, JournalItem, Transaction, Subscription, Vendor, Company, AccountingClass

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')

@admin.register(AccountingClass)
class AccountingClassAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'company_id')

@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'contact_name', 'city', 'state')

@admin.register(LLC)
class LLCAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')

@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('short_name', 'llc', 'city')
    list_filter = ('llc',)

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'account_type', 'parent')
    list_filter = ('account_type',)

class JournalItemInline(admin.TabularInline):
    model = JournalItem
    extra = 2

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('date', 'description', 'is_closed')
    inlines = [JournalItemInline]

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'description', 'amount', 'property', 'category')
    list_filter = ('property', 'category', 'date')

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_active', 'expiry_date')
