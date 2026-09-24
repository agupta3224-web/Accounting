import json
from collections import defaultdict

def apply_property_manager_rules(raw_transactions: list, aggregate_rental_income: bool = True) -> tuple:
    """
    Applies the Property Manager rules:
    Rule: If an imported statement contains multiple rows of rental income for a single property
    in a given month, automatically aggregate them into a single 'Rental Income' row at the top.
    """
    if not raw_transactions:
        return [], 0

    if not aggregate_rental_income:
        return raw_transactions, 0

    rental_buckets = defaultdict(list)
    other_transactions = []
    
    for txn in raw_transactions:
        is_rental = txn.get('is_rental_income', False) or 'rent' in txn.get('account_name', '').lower() or 'rent' in txn.get('category_name', '').lower()
        if is_rental and txn.get('category_type') == 'INCOME':
            key = (txn.get('property_id'), txn.get('month'))
            rental_buckets[key].append(txn)
        else:
            other_transactions.append(txn)

    consolidated_txns = []
    consolidated_count = 0

    for (prop_id, month_key), items in rental_buckets.items():
        if len(items) > 1:
            total_rent = sum(item['amount'] for item in items)
            earliest_date = min(item['date'] for item in items)
            
            sub_items = []
            for item in items:
                sub_items.append({
                    'date': item['date'],
                    'account_name': item['account_name'],
                    'description': item.get('description', ''),
                    'amount': item['amount'],
                    'class_hint': item.get('class_hint', '')
                })
            
            aggregated_row = {
                'date': earliest_date,
                'month': month_key,
                'property_id': prop_id,
                'class_id': items[0].get('class_id'),
                'account_name': 'Rental Income',
                'category_name': 'Rental Income',
                'category_type': 'INCOME',
                'is_rental_income': True,
                'is_repair_category': False,
                'amount': round(total_rent, 2),
                'description': f"Consolidated Rental Income ({len(items)} units/payments aggregated)",
                'payee': 'Multiple Tenants',
                'source': 'IMPORTED',
                'is_aggregated': True,
                'raw_aggregated_items': json.dumps(sub_items)
            }
            consolidated_txns.append(aggregated_row)
            consolidated_count += len(items)
        elif len(items) == 1:
            item = items[0]
            item['account_name'] = 'Rental Income'
            item['category_name'] = 'Rental Income'
            item['is_rental_income'] = True
            consolidated_txns.append(item)

    all_final = consolidated_txns + other_transactions
    
    def sort_key(t):
        is_rent_priority = 0 if t.get('is_rental_income') else 1
        return (t.get('month', ''), is_rent_priority, t.get('date', ''))

    all_final.sort(key=sort_key)
    return all_final, consolidated_count
