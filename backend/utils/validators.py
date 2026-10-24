"""Input validation helpers for the auth endpoints.

All validation happens server-side; the React forms only mirror it for a
better user experience.
"""

import re

NAME_MIN, NAME_MAX = 2, 120
PASSWORD_MIN, PASSWORD_MAX = 8, 128
EMAIL_MAX = 255

# Deliberately simple, permissive pattern: enough to reject obvious garbage
# without rejecting valid but unusual addresses.
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")


class ValidationError(Exception):
    """Raised when user-supplied registration/login data is invalid."""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


def normalize_email(raw: object) -> str:
    """Trim and lowercase an email so `A@X.com` and `a@x.com` are one account."""
    if not isinstance(raw, str):
        raise ValidationError("Email is required", "email")
    email = raw.strip().lower()
    if not email:
        raise ValidationError("Email is required", "email")
    if len(email) > EMAIL_MAX:
        raise ValidationError(f"Email must be at most {EMAIL_MAX} characters", "email")
    if not EMAIL_RE.match(email):
        raise ValidationError("Enter a valid email address", "email")
    return email


def validate_name(raw: object) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError("Name is required", "name")
    name = " ".join(raw.strip().split())
    if len(name) < NAME_MIN:
        raise ValidationError(f"Name must be at least {NAME_MIN} characters", "name")
    if len(name) > NAME_MAX:
        raise ValidationError(f"Name must be at most {NAME_MAX} characters", "name")
    return name


def validate_password(raw: object) -> str:
    if not isinstance(raw, str) or not raw:
        raise ValidationError("Password is required", "password")
    if len(raw) < PASSWORD_MIN:
        raise ValidationError(
            f"Password must be at least {PASSWORD_MIN} characters", "password"
        )
    if len(raw) > PASSWORD_MAX:
        raise ValidationError(
            f"Password must be at most {PASSWORD_MAX} characters", "password"
        )
    if raw.strip() != raw:
        raise ValidationError(
            "Password cannot start or end with a space", "password"
        )
    if not re.search(r"[A-Za-z]", raw) or not re.search(r"\d", raw):
        raise ValidationError(
            "Password must contain at least one letter and one number", "password"
        )
    return raw
