"""Pytest fixtures.

The models use PostGIS geography columns, so the tests need a real
PostgreSQL + PostGIS database. Point TEST_DATABASE_URL at a throwaway
database (never your development one — the fixtures drop tables):

    export TEST_DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/urban_drainage_test_db

If no database is reachable the whole suite is skipped rather than failing.
"""

import pytest
from sqlalchemy.exc import SQLAlchemyError

from backend.app import create_app
from backend.config import TestConfig
from backend.extensions import db as _db
from backend.models import User, UserRole


@pytest.fixture(scope="session")
def app():
    application = create_app(TestConfig)
    with application.app_context():
        try:
            _db.create_all()
        except SQLAlchemyError as exc:  # pragma: no cover
            pytest.skip(f"Test database unavailable: {type(exc).__name__}")
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(autouse=True)
def clean_tables(app):
    """Start every test from an empty users table."""
    with app.app_context():
        _db.session.rollback()
        for table in reversed(_db.metadata.sorted_tables):
            if table.name == "spatial_ref_sys":
                continue
            _db.session.execute(table.delete())
        _db.session.commit()
    yield


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_user(app):
    with app.app_context():
        user = User(name="Seeded Admin", email="admin@example.com", role=UserRole.ADMIN)
        user.set_password("admin123")
        _db.session.add(user)
        _db.session.commit()
        return {"email": user.email, "password": "admin123"}


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
