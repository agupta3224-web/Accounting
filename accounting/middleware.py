from django.http import HttpResponseForbidden
from django.conf import settings
from .models import Subscription
from .router import set_active_db

class CompanyDatabaseMiddleware:
    """
    Middleware to switch database based on active company in session.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Always start request in the default (master) database context
        set_active_db('default')

        active_id = request.session.get('active_company_id')
        if active_id:
            db_alias = f"company_{active_id}"
            if db_alias not in settings.DATABASES:
                db_path = (settings.BASE_DIR / "data" / f"{db_alias}.sqlite3").resolve()
                if db_path.exists():
                    settings.DATABASES[db_alias] = {
                        'ENGINE': 'django.db.backends.sqlite3',
                        'NAME': db_path,
                        'ATOMIC_REQUESTS': False,
                        'AUTOCOMMIT': True,
                    }
            set_active_db(db_alias)
        else:
            set_active_db('default')

        response = self.get_response(request)

        # Reset after request
        set_active_db('default')
        return response

class SubscriptionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and not request.user.is_superuser:
            try:
                sub = Subscription.objects.get(user=request.user)
                if not sub.is_active:
                    return HttpResponseForbidden("Your subscription has expired. Please pay to regain access.")
            except Subscription.DoesNotExist:
                # For demonstration purposes, auto-enroll new users in a trial
                Subscription.objects.create(user=request.user, is_active=True)

        response = self.get_response(request)
        return response
