"""Urban Drainage Monitor — Flask application factory.

Run locally (from the project root, with the venv active):
    python -m backend.app
or:
    flask --app backend.app run --port 5000
"""

import logging

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import db, jwt, migrate
from .routes import admin_bp, auth_bp, civic_bp, health_bp, reports_bp


def register_jwt_handlers() -> None:
    """Consistent JSON for every JWT failure (401, never a stack trace)."""

    @jwt.unauthorized_loader
    def missing_token(reason: str):  # noqa: ARG001
        return jsonify({"error": "Authentication required"}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason: str):  # noqa: ARG001
        return jsonify({"error": "Invalid authentication token"}), 401

    @jwt.expired_token_loader
    def expired_token(header, payload):  # noqa: ARG001
        return jsonify({"error": "Session expired, please log in again"}), 401


def create_app(config_object: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    logging.basicConfig(level=logging.INFO)

    # CORS for the React frontend (Authorization header must be allowed).
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=False,
        allow_headers=["Content-Type", "Authorization"],
    )

    # Database + migrations + JWT.
    db.init_app(app)
    migrate.init_app(app, db, directory="backend/migrations")
    jwt.init_app(app)
    register_jwt_handlers()

    # Import models so Alembic autogenerate sees them.
    from . import models  # noqa: F401

    # Blueprints.
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(civic_bp)

    @app.errorhandler(400)
    def bad_request(_error):
        return jsonify({"error": "Invalid request"}), 400

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(413)
    def payload_too_large(_error):
        return jsonify({"error": "Request body is too large"}), 413

    @app.errorhandler(429)
    def too_many_requests(_error):  # pragma: no cover
        return jsonify({"error": "Too many requests, please slow down"}), 429

    @app.errorhandler(500)
    def server_error(_error):  # pragma: no cover
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(Exception)
    def unhandled_error(error):  # pragma: no cover
        """Never leak an exception message or traceback to a client."""
        if isinstance(error, HTTPException):
            return error
        app.logger.exception("Unhandled application error")
        try:
            db.session.rollback()
        except Exception:  # noqa: BLE001 - rollback must not mask the response
            pass
        return jsonify({"error": "Internal server error"}), 500

    @app.after_request
    def security_headers(response):
        """Baseline hardening headers for a JSON API."""
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(self), camera=(), microphone=()"
        )
        response.headers.pop("Server", None)
        return response

    # Refuse to run silently with placeholder secrets outside development.
    if not app.config.get("TESTING") and not app.config.get("DEBUG"):
        if app.config.get("WEAK_SECRET_KEY"):
            app.logger.warning(
                "SECRET_KEY is not set — set a strong random value before serving traffic."
            )
        if app.config.get("WEAK_JWT_SECRET"):
            app.logger.warning(
                "JWT_SECRET_KEY is not set — existing sessions cannot be trusted."
            )

    # CLI: `flask --app backend.app seed`
    from .seed import register_cli

    register_cli(app)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=app.config["PORT"],
        debug=app.config["DEBUG"],
    )
