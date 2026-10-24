"""Reusable authentication / authorization helpers.

- `current_user()` loads the User row for the JWT identity.
- `@admin_required` protects admin-only endpoints (401 when unauthenticated,
  403 when authenticated but not an admin).
"""

from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..extensions import db
from ..models import User, UserRole


def current_user() -> User | None:
    """Return the User for the verified JWT, or None if the row is gone."""
    identity = get_jwt_identity()
    if identity is None:
        return None
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None
    return db_get_user(user_id)


def db_get_user(user_id: int) -> User | None:
    return db.session.get(User, user_id)


def roles_required(*roles: UserRole):
    """Decorator factory: require a valid JWT AND one of the given roles."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Raises/handles 401 through the JWT error handlers.
            verify_jwt_in_request()
            user = current_user()
            if user is None:
                return jsonify({"error": "Authentication required"}), 401
            if user.role not in roles:
                return jsonify({"error": "Administrator access required"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def admin_required(fn):
    """Allow only users whose role is `admin`."""
    return roles_required(UserRole.ADMIN)(fn)
