"""Authentication endpoints: register, login, current user, logout.

Security notes
--------------
* Passwords are hashed with Werkzeug (PBKDF2) — never stored in plain text.
* Public registration ALWAYS creates a `citizen`; a client-supplied "role"
  field is ignored. Admins come from the seed script only.
* Login errors are deliberately generic ("Invalid email or password") so the
  endpoint cannot be used to enumerate registered accounts.
* No response ever contains a password, password hash, or secret.
"""

import json
import logging
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ..extensions import db
from ..models import User, UserRole
from ..utils.auth import current_user
from ..utils.validators import (
    EMAIL_MAX,
    PASSWORD_MAX,
    ValidationError,
    normalize_email,
    validate_name,
    validate_password,
)

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _token_for(user: User) -> str:
    """Issue an access token; identity is the user id as a string."""
    return create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role.value, "email": user.email},
    )


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    try:
        name = validate_name(payload.get("name"))
        email = normalize_email(payload.get("email"))
        password = validate_password(payload.get("password"))
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    if User.query.filter_by(email=email).first() is not None:
        return (
            jsonify({"error": "An account with this email already exists", "field": "email"}),
            409,
        )

    # Role is forced — a public request can never create an administrator.
    user = User(name=name, email=email, role=UserRole.CITIZEN)
    user.set_password(password)

    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return (
            jsonify({"error": "An account with this email already exists", "field": "email"}),
            409,
        )
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Registration failed")
        return jsonify({"error": "Could not create the account right now"}), 503

    return (
        jsonify({"access_token": _token_for(user), "user": user.to_dict()}),
        201,
    )


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email_raw = payload.get("email")
    password = payload.get("password")

    if not isinstance(email_raw, str) or not isinstance(password, str) or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Cap the inputs before any database lookup or hash comparison, so an
    # oversized credential cannot be used to burn server time. The response
    # stays generic — it must not reveal whether the account exists.
    if len(email_raw) > EMAIL_MAX or len(password) > PASSWORD_MAX:
        return jsonify({"error": "Invalid email or password"}), 401

    email = email_raw.strip().lower()

    try:
        user = User.query.filter_by(email=email).first()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Login lookup failed")
        return jsonify({"error": "Service temporarily unavailable"}), 503

    # Same message for unknown email and wrong password (no enumeration).
    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({"access_token": _token_for(user), "user": user.to_dict()})


@auth_bp.get("/me")
@jwt_required()
def me():
    user = current_user()
    if user is None:
        return jsonify({"error": "Account no longer exists"}), 401
    return jsonify({"user": user.to_dict()})


@auth_bp.post("/logout")
@jwt_required()
def logout():
    """Stateless logout.

    JWTs are self-contained, so the server cannot revoke an already-issued
    token without a blocklist (not implemented in this step). The client
    signs out by deleting its stored token; the token simply expires.
    """
    return jsonify(
        {
            "message": "Logged out. Remove the stored token on the client.",
            "stateless": True,
        }
    )


GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def _verify_google_credential(credential: str, client_id: str) -> dict | None:
    """Verify a Google Identity Services ID token with Google's tokeninfo endpoint.

    Returns the verified claims, or None when the token is invalid, issued for
    another app, expired, or the email is unverified.
    """
    url = f"{GOOGLE_TOKENINFO_URL}?{urllib.parse.urlencode({'id_token': credential})}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:  # noqa: S310 - fixed https host
            claims = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, ValueError, TimeoutError):
        return None
    if claims.get("aud") != client_id or claims.get("iss") not in GOOGLE_ISSUERS:
        return None
    if str(claims.get("email_verified")).lower() != "true" or not claims.get("email"):
        return None
    return claims


@auth_bp.post("/google")
def google_login():
    """Sign in (or create a citizen account) with a verified Google ID token.

    The result is the same app JWT issued by /login, so every existing
    role check keeps working. New Google accounts are always citizens.
    """
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        return jsonify({"error": "Google sign-in is not configured"}), 503

    payload = request.get_json(silent=True) or {}
    credential = payload.get("credential")
    if not isinstance(credential, str) or not credential or len(credential) > 4096:
        return jsonify({"error": "Missing Google credential"}), 400

    claims = _verify_google_credential(credential, client_id)
    if claims is None:
        return jsonify({"error": "Google sign-in could not be verified"}), 401

    email = str(claims["email"]).strip().lower()
    try:
        user = User.query.filter_by(email=email).first()
        if user is None:
            name = str(claims.get("name") or email.split("@")[0])[:120]
            user = User(name=name, email=email, role=UserRole.CITIZEN)
            # Random unusable password: Google accounts sign in through Google only.
            user.set_password(secrets.token_urlsafe(32))
            db.session.add(user)
            db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Google sign-in persistence failed")
        return jsonify({"error": "Service temporarily unavailable"}), 503

    return jsonify({"access_token": _token_for(user), "user": user.to_dict()})
