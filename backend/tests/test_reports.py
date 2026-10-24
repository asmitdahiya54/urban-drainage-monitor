"""Tests for the drainage report API (Step 4).

Needs a real PostgreSQL + PostGIS test database (see conftest.py) because the
location column is a PostGIS geography type.
"""

from sqlalchemy import text

from backend.extensions import db
from backend.models import Report, ReportStatus, ReportStatusHistory, User, UserRole
from backend.tests.conftest import auth_header

VALID = {
    "issue_type": "BLOCKED_DRAIN",
    "description": "The drain is blocked and water is collecting on the road.",
    "severity": "HIGH",
    "latitude": 28.6139,
    "longitude": 77.2090,
}


def register(client, email: str, name: str = "Test Citizen") -> str:
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["access_token"]


def make_admin(client, app, email: str = "boss@example.com") -> str:
    """Register, promote to admin in the database, then sign in again."""
    register(client, email, "Test Admin")
    with app.app_context():
        user = User.query.filter_by(email=email).one()
        user.role = UserRole.ADMIN
        db.session.commit()
    response = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    return response.get_json()["access_token"]


def create(client, token: str, **overrides):
    # Step 8: these fixtures intentionally file identical reports at the same
    # spot, so they confirm past the duplicate warning.
    body = {**VALID, "confirm_duplicate": True, **overrides}
    return client.post("/api/reports", json=body, headers=auth_header(token))


# --- creation -------------------------------------------------------------
def test_citizen_can_create_report(client):
    token = register(client, "creator@example.com")
    response = create(client, token)
    assert response.status_code == 201
    report = response.get_json()["report"]
    assert report["issue_type"] == "BLOCKED_DRAIN"
    assert report["severity"] == "HIGH"
    assert report["latitude"] == 28.6139
    assert report["longitude"] == 77.2090
    assert "#" in response.get_json()["message"]


def test_unauthenticated_user_cannot_create_report(client):
    response = client.post("/api/reports", json=VALID)
    assert response.status_code == 401


def test_invalid_issue_type_rejected(client):
    token = register(client, "badtype@example.com")
    response = create(client, token, issue_type="NOT_A_TYPE")
    assert response.status_code == 400
    assert response.get_json()["field"] == "issue_type"


def test_invalid_severity_rejected(client):
    token = register(client, "badsev@example.com")
    response = create(client, token, severity="EXTREME")
    assert response.status_code == 400
    assert response.get_json()["field"] == "severity"


def test_missing_description_rejected(client):
    token = register(client, "nodesc@example.com")
    response = create(client, token, description="   ")
    assert response.status_code == 400
    assert response.get_json()["field"] == "description"


def test_short_description_rejected(client):
    token = register(client, "shortdesc@example.com")
    response = create(client, token, description="blocked")
    assert response.status_code == 400


def test_invalid_latitude_rejected(client):
    token = register(client, "badlat@example.com")
    assert create(client, token, latitude=120).status_code == 400
    assert create(client, token, latitude="north").status_code == 400


def test_invalid_longitude_rejected(client):
    token = register(client, "badlng@example.com")
    assert create(client, token, longitude=-200).status_code == 400
    assert create(client, token, longitude=None).status_code == 400


def test_new_report_always_gets_new_status(client):
    token = register(client, "statuscheat@example.com")
    response = create(client, token, status="RESOLVED")
    assert response.status_code == 201
    assert response.get_json()["report"]["status"] == "NEW"
    assert response.get_json()["report"]["resolved_at"] is None


def test_citizen_cannot_report_on_behalf_of_another_user(client, app):
    other = register(client, "victim@example.com", "Victim")
    assert other
    token = register(client, "attacker@example.com", "Attacker")
    with app.app_context():
        victim_id = User.query.filter_by(email="victim@example.com").one().id
    response = create(client, token, user_id=victim_id)
    assert response.status_code == 201
    with app.app_context():
        attacker_id = User.query.filter_by(email="attacker@example.com").one().id
        report = Report.query.one()
        assert report.user_id == attacker_id


def test_status_history_created(client, app):
    token = register(client, "history@example.com")
    report_id = create(client, token).get_json()["report"]["id"]
    with app.app_context():
        entries = ReportStatusHistory.query.filter_by(report_id=report_id).all()
        assert len(entries) == 1
        assert entries[0].old_status is None
        assert entries[0].new_status == ReportStatus.NEW
        assert entries[0].changed_by == User.query.filter_by(email="history@example.com").one().id


def test_postgis_point_uses_longitude_latitude_order(client, app):
    token = register(client, "postgis@example.com")
    report_id = create(client, token).get_json()["report"]["id"]
    with app.app_context():
        wkt = db.session.execute(
            text("SELECT ST_AsText(location::geometry) FROM reports WHERE id = :id"),
            {"id": report_id},
        ).scalar()
        # longitude first, then latitude
        assert wkt == "POINT(77.209 28.6139)"
        lng, lat = db.session.execute(
            text("SELECT ST_X(location::geometry), ST_Y(location::geometry) FROM reports"),
        ).one()
        assert round(lng, 4) == 77.2090
        assert round(lat, 4) == 28.6139


# --- reading ---------------------------------------------------------------
def test_citizen_lists_only_own_reports(client):
    token_a = register(client, "a@example.com", "Citizen A")
    token_b = register(client, "b@example.com", "Citizen B")
    create(client, token_a)
    create(client, token_a, issue_type="FLOODING")
    create(client, token_b, issue_type="WATERLOGGING")

    a_reports = client.get("/api/reports", headers=auth_header(token_a)).get_json()["reports"]
    b_reports = client.get("/api/reports", headers=auth_header(token_b)).get_json()["reports"]
    assert len(a_reports) == 2
    assert len(b_reports) == 1
    assert all(r["issue_type"] != "WATERLOGGING" for r in a_reports)


def test_citizen_cannot_read_another_citizens_report(client):
    token_a = register(client, "owner@example.com", "Owner")
    token_b = register(client, "nosy@example.com", "Nosy")
    report_id = create(client, token_a).get_json()["report"]["id"]

    response = client.get(f"/api/reports/{report_id}", headers=auth_header(token_b))
    assert response.status_code == 403


def test_citizen_can_read_own_report_with_history(client):
    token = register(client, "self@example.com")
    report_id = create(client, token).get_json()["report"]["id"]
    response = client.get(f"/api/reports/{report_id}", headers=auth_header(token))
    assert response.status_code == 200
    report = response.get_json()["report"]
    assert report["id"] == report_id
    assert len(report["status_history"]) == 1
    assert "password" not in str(report) and "password_hash" not in str(report)


def test_admin_can_read_all_reports(client, app):
    token_a = register(client, "c1@example.com", "C1")
    token_b = register(client, "c2@example.com", "C2")
    create(client, token_a)
    report_id = create(client, token_b).get_json()["report"]["id"]

    admin_token = make_admin(client, app)
    listing = client.get("/api/reports", headers=auth_header(admin_token)).get_json()
    assert listing["count"] == 2
    single = client.get(f"/api/reports/{report_id}", headers=auth_header(admin_token))
    assert single.status_code == 200
    assert single.get_json()["report"]["reporter"]["email"] == "c2@example.com"


def test_unauthenticated_listing_rejected(client):
    assert client.get("/api/reports").status_code == 401


def test_missing_report_returns_404(client):
    token = register(client, "missing@example.com")
    assert client.get("/api/reports/999999", headers=auth_header(token)).status_code == 404
