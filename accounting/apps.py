from django.apps import AppConfig


class AccountingConfig(AppConfig):
    name = "accounting"

    def ready(self):
        import os
        # Ensure we only start the thread in the main process, not the reloader
        if os.environ.get('RUN_MAIN') == 'true':
            from .backup_service import start_backup_thread
            start_backup_thread()
