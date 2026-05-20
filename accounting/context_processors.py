from .models import Company

def active_company(request):
    company_id = request.session.get('active_company_id')
    if company_id:
        try:
            return {'active_company': Company.objects.get(id=company_id)}
        except Company.DoesNotExist:
            pass

    # Default to first company if none selected or invalid
    first_company = Company.objects.first()
    if first_company:
        request.session['active_company_id'] = first_company.id
        return {'active_company': first_company}

    return {'active_company': None}
