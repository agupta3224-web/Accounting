from django.http import HttpResponseForbidden
from .models import Subscription

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
                return HttpResponseForbidden("No active subscription found for your account.")

        response = self.get_response(request)
        return response
