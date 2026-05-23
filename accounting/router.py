import threading

_thread_locals = threading.local()

def set_active_db(db_alias):
    _thread_locals.active_db = db_alias

def get_active_db():
    return getattr(_thread_locals, 'active_db', 'default')

def set_active_db(db_alias):
    _thread_locals.active_db = db_alias

class CompanyRouter:
    """
    A router to control all database operations.
    - Global models (Company, Subscription) and Django system models (Session, Auth, Admin)
      are kept in the 'default' (master) database.
    - Company-specific accounting data is routed to company databases.
    """
    def db_for_read(self, model, **hints):
        app_label = model._meta.app_label
        if app_label == 'accounting':
            if model._meta.model_name in ['company', 'subscription']:
                return 'default'
            return get_active_db()

        # System apps always go to default
        if app_label in ['sessions', 'auth', 'admin', 'contenttypes']:
            return 'default'

        return 'default'

    def db_for_write(self, model, **hints):
        app_label = model._meta.app_label
        if app_label == 'accounting':
            if model._meta.model_name in ['company', 'subscription']:
                return 'default'
            return get_active_db()

        if app_label in ['sessions', 'auth', 'admin', 'contenttypes']:
            return 'default'

        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == 'accounting':
            if model_name in ['company', 'subscription']:
                return db == 'default'
            return True # Allow accounting models in both master and shards

        if app_label in ['sessions', 'auth', 'admin', 'contenttypes']:
            return db == 'default'

        return db == 'default'
