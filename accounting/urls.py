from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('transactions/', views.transaction_list, name='transaction_list'),
    path('transactions/add/', views.add_transaction, name='add_transaction'),
    path('pnl/', views.profit_and_loss, name='pnl'),
    path('balance-sheet/', views.balance_sheet, name='balance_sheet'),
    path('trial-balance/', views.trial_balance, name='trial_balance'),
    path('coa/', views.chart_of_accounts, name='coa_list'),
    path('coa/add/', views.add_account, name='add_account'),
    path('llc/add/', views.add_llc, name='add_llc'),
    path('property/add/', views.add_property, name='add_property'),
    path('class/add/', views.add_class, name='add_class'),
    path('import/', views.import_file, name='import_file'),
    path('reconcile/', views.reconcile, name='reconcile'),
    path('close/', views.close_books_view, name='close_books'),
    path('journal/add/', views.add_journal_entry, name='add_journal_entry'),
]
