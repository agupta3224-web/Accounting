import threading

_thread_locals = threading.local()

def set_active_db(db_alias):
    _thread_locals.active_db = db_alias

def get_active_db():
    return getattr(_thread_locals, 'active_db', 'default')

class CompanyRouter:
    """
    A router to control all database operations on models in the
    accounting application.
    """
    def db_for_read(self, model, **hints):
        if model._meta.app_label == 'accounting':
            if model._meta.model_name in ['company', 'subscription']:
                return 'default'
            return get_active_db()
        return 'default'

    def db_for_write(self, model, **hints):
        if model._meta.app_label == 'accounting':
            if model._meta.model_name in ['company', 'subscription']:
                return 'default'
            return get_active_db()
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == 'accounting':
            if model_name in ['company', 'subscription']:
                return db == 'default'
            return True
        return db == 'default'
