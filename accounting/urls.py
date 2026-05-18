from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('transactions/', views.transaction_list, name='transaction_list'),
    path('transactions/add/', views.add_transaction, name='add_transaction'),
    path('pnl/', views.profit_and_loss, name='pnl'),
    path('import/', views.import_file, name='import_file'),
    path('reconcile/', views.reconcile, name='reconcile'),
    path('close/', views.close_books_view, name='close_books'),
    path('journal/add/', views.add_journal_entry, name='add_journal_entry'),
]
