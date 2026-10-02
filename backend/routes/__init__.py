"""HTTP route blueprints."""

from .admin import admin_bp
from .auth import auth_bp
from .civic import civic_bp
from .health import health_bp
from .reports import reports_bp

__all__ = ["admin_bp", "auth_bp", "civic_bp", "health_bp", "reports_bp"]
