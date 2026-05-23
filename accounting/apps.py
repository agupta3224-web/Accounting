from django.apps import AppConfig


class AccountingConfig(AppConfig):
    name = "accounting"

    def ready(self):
        import os
        from django.core.signals import request_started
        from .router import set_active_db

        # Reset database context at the start of every request to avoid thread-leak issues
        def reset_db_context(sender, **kwargs):
            set_active_db('default')

        request_started.connect(reset_db_context)

        # Ensure we only start the thread in the main process, not the reloader
        if os.environ.get('RUN_MAIN') == 'true':
            from .backup_service import start_backup_thread
            start_backup_thread()
