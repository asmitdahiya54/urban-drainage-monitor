"""Application configuration loaded from environment variables.

Never hard-code credentials here — everything sensitive comes from `.env`.
"""

import os
from datetime import timedelta

from dotenv import load_dotenv

# Load variables from a local .env file (if present) into os.environ.
load_dotenv()


def normalize_database_url(url: str) -> str:
    """Make a hosted provider URL usable by SQLAlchemy 2.x + psycopg2.

    Render (and Heroku) hand out `postgres://...`, a scheme SQLAlchemy 2.0
    no longer accepts. The connection details are untouched — only the
    dialect prefix is rewritten.
    """
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


def env_flag(name: str, default: str = "0") -> bool:
    """Read a boolean environment flag; anything but "1" is off."""
    return os.environ.get(name, default) == "1"


class Config:
    """Base configuration shared by every environment."""

    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")

    # Database — e.g. postgresql://postgres:PASSWORD@localhost:5432/urban_drainage_db
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/urban_drainage_db",
        )
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        # Detect dropped connections before using them.
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

    # --- JWT (Flask-JWT-Extended) ---
    # Falls back to SECRET_KEY so a single .env value is enough in development,
    # but production should set JWT_SECRET_KEY explicitly.
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_TOKEN_MINUTES", 120))
    )
    # Stateless JWTs: no server-side session, no blocklist in this step.
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_TYPE = "Bearer"

    # CORS: comma-separated list of allowed frontend origins.
    # The default covers local development plus the published frontend, so a
    # forgotten env var on the host cannot silently block the live site.
    DEFAULT_CORS_ORIGINS = (
        "http://localhost:5173,"
        "http://localhost:8080,"
        "https://flowfinder-community.lovable.app"
    )
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
        if origin.strip()
    ]

    PORT = int(os.environ.get("PORT", 5000))
    # Debug is OFF unless explicitly enabled: a forgotten env var on a host must
    # never expose the interactive debugger or stack traces.
    DEBUG = env_flag("FLASK_DEBUG", "0")

    # Reject oversized request bodies before they are parsed (1 MB is far more
    # than any endpoint in this app needs).
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 1 * 1024 * 1024))

    # Verbose diagnostics (e.g. the PostGIS version in /api/health) are only
    # returned when explicitly enabled or in debug.
    EXPOSE_SERVER_DETAILS = env_flag("EXPOSE_SERVER_DETAILS", "0") or DEBUG

    #: True when a secret is still the built-in development placeholder.
    WEAK_SECRET_KEY = not os.environ.get("SECRET_KEY")
    WEAK_JWT_SECRET = not (os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY"))


class TestConfig(Config):
    """Configuration used by the pytest suite."""

    TESTING = True
    DEBUG = False
    EXPOSE_SERVER_DETAILS = False
    JWT_SECRET_KEY = "test-only-jwt-secret-not-for-production-use"
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL", Config.SQLALCHEMY_DATABASE_URI
    )
