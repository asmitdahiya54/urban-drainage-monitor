"""Production WSGI entry point.

Gunicorn (or any WSGI server) loads the module-level `app` object built by
the existing application factory — no application logic lives here.

    gunicorn backend.wsgi:app --bind 0.0.0.0:$PORT
"""

from .app import create_app

app = create_app()

__all__ = ["app"]
