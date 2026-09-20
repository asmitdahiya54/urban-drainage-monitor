"""Health check endpoint, including a real database connectivity probe."""

import logging

from flask import Blueprint, current_app, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db

logger = logging.getLogger(__name__)

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.get("/health")
def health():
    """Return API status plus whether PostgreSQL is reachable.

    On failure we log the real error server-side but never return the
    connection string or credentials to the client.
    """
    try:
        db.session.execute(text("SELECT 1"))
        postgis_version = db.session.execute(
            text("SELECT postgis_version()")
        ).scalar()
        payload = {
            "status": "ok",
            "database": "connected",
            # Presence only by default — exact versions are server details.
            "postgis": "enabled" if postgis_version else None,
            "message": "Urban Drainage Monitor API is running",
        }
        if current_app.config.get("EXPOSE_SERVER_DETAILS"):
            payload["postgis_version"] = postgis_version
        return jsonify(payload)
    except SQLAlchemyError as exc:
        logger.exception("Database health check failed")
        db.session.rollback()
        return (
            jsonify(
                {
                    "status": "error",
                    "database": "disconnected",
                    "message": "Urban Drainage Monitor API is running, but the database is unavailable",
                    "error": type(exc).__name__,
                }
            ),
            503,
        )
