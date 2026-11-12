"""Tests for duplicate report detection (Step 8).

Needs a real PostgreSQL + PostGIS test database (see conftest.py): the
detection runs ST_DWithin / ST_Distance inside the database.
"""

from datetime import datetime, timedelta, timezone

from backend.extensions import db
from backend.models import Report, ReportStatus, User, UserRole
from backend.tests.conftest import auth_header

BASE_LAT, BASE_LON = 28.6139, 77.2090


def _citizen(app, email: str = "dup@example.com", password: str = "password123") -> dict:
    with app.app_context():
        user = User(name="Duplicate Citizen", email=email, role=UserRole.CITIZEN)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return {"id": user.id, "email": email, "password": password}


def _login(client, creds: dict) -> str:
    response = client.post(
        "/api/auth/login", json={"email": creds["email"], "password": creds["password"]}
    )
    assert response.status_code == 200
    return response.get_json()["access_token"]


def _report(app, user_id: int, lat: float, lon: float, **kwargs) -> int:
    with app.app_context():
        report = Report(
            user_id=user_id,
            issue_type=kwargs.get("issue_type", "BLOCKED_DRAIN"),
            description=kwargs.get("description", "Water is collecting on the road."),
            severity=kwargs.get("severity", "HIGH"),
            status=kwargs.get("status", ReportStatus.NEW),
        )
        report.set_coordinates(lat, lon)
        if "age_days" in kwargs:
            report.created_at = datetime.now(timezone.utc) - timedelta(days=kwargs["age_days"])
        db.session.add(report)
        db.session.commit()
        return report.id


def _check(client, token: str, **body):
    payload = {
        "latitude": BASE_LAT,
        "longitude": BASE_LON,
        "issue_type": "BLOCKED_DRAIN",
        **body,
    }
    return client.post("/api/reports/check-duplicate", json=payload, headers=auth_header(token))


# --- authorization ---------------------------------------------------------


def test_check_duplicate_requires_authentication(client, app):
    response = client.post(
        "/api/reports/check-duplicate",
        json={"latitude": BASE_LAT, "longitude": BASE_LON, "issue_type": "BLOCKED_DRAIN"},
    )
    assert response.status_code == 401


# --- the rule ------------------------------------------------------------


def test_no_nearby_report_means_no_duplicate(client, app):
    creds = _citizen(app)
    token = _login(client, creds)
    # ~1.5 km away
    _report(app, creds["id"], BASE_LAT + 0.015, BASE_LON)

    data = _check(client, token).get_json()
    assert data["duplicate"] is False
    assert data["matches"] == []
    assert data["nearby_count"] == 0


def test_nearby_same_issue_is_likely_duplicate(client, app):
    creds = _citizen(app)
    token = _login(client, creds)
    existing = _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0002)  # ~20 m

    data = _check(client, token).get_json()
    assert data["duplicate"] is True
    assert data["message"] == "A similar drainage report already exists nearby."
    match = data["matches"][0]
    assert match["id"] == existing
    assert match["same_issue_type"] is True
    assert match["distance_m"] < 100
    assert match["confidence"] >= 0.75
    assert match["status"] == "NEW"
    assert match["issue_type"] == "BLOCKED_DRAIN"
    assert match["created_at"]


def test_nearby_different_issue_type_is_not_a_duplicate(client, app):
    creds = _citizen(app)
    token = _login(client, creds)
    _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0002, issue_type="SEWAGE_OVERFLOW")

    data = _check(client, token).get_json()
    assert data["duplicate"] is False
    assert data["nearby_count"] == 1  # still returned as context
    assert data["nearby"][0]["same_issue_type"] is False


def test_multiple_nearby_reports_are_sorted_by_distance(client, app):
    creds = _citizen(app)
    token = _login(client, creds)
    near = _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0001)
    far = _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0007)

    data = _check(client, token).get_json()
    ids = [m["id"] for m in data["nearby"]]
    assert ids == [near, far]
    assert data["duplicate"] is True
    assert near in [m["id"] for m in data["matches"]]


def test_resolved_and_old_reports_do_not_block(client, app):
    creds = _citizen(app)
    token = _login(client, creds)
    _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0001, status=ReportStatus.RESOLVED)
    _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0002, age_days=120)

    data = _check(client, token).get_json()
    assert data["duplicate"] is False
    # the resolved one is nearby context only; the 120-day-old one is out of window
    assert data["nearby_count"] == 1
    assert data["nearby"][0]["status"] == "RESOLVED"
    assert data["nearby"][0]["confidence"] <= 0.45


def test_duplicate_check_never_exposes_personal_data(client, app):
    creds = _citizen(app, "secret-reporter@example.com")
    token = _login(client, creds)
    _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0001)

    response = _check(client, token)
    body = response.get_data(as_text=True)
    assert "secret-reporter@example.com" not in body
    assert "Duplicate Citizen" not in body
    match = response.get_json()["nearby"][0]
    for forbidden in ("user_id", "reporter", "description", "email"):
        assert forbidden not in match


def test_duplicate_check_rejects_invalid_coordinates(client, app):
    creds = _citizen(app)
    token = _login(client, creds)

    response = _check(client, token, latitude=120)
    assert response.status_code == 400
    assert response.get_json()["field"] == "latitude"

    response = _check(client, token, longitude="abc")
    assert response.status_code == 400

    response = _check(client, token, issue_type="NOT_A_TYPE")
    assert response.status_code == 400
    assert response.get_json()["field"] == "issue_type"

    response = _check(client, token, radius_m=5000)
    assert response.status_code == 400
    assert response.get_json()["field"] == "radius_m"


# --- integration with report creation ------------------------------------


def _create_body(**overrides) -> dict:
    body = {
        "issue_type": "BLOCKED_DRAIN",
        "description": "The drain is blocked and water is collecting.",
        "severity": "HIGH",
        "latitude": BASE_LAT,
        "longitude": BASE_LON,
    }
    body.update(overrides)
    return body


def test_create_report_warns_instead_of_saving_a_duplicate(client, app):
    creds = _citizen(app)
    token = _login(client, creds)
    existing = _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0001)

    response = client.post("/api/reports", json=_create_body(), headers=auth_header(token))
    assert response.status_code == 409
    data = response.get_json()
    assert data["duplicate"] is True
    assert data["error"] == "A similar drainage report already exists nearby."
    assert data["matches"][0]["id"] == existing

    with app.app_context():
        assert Report.query.count() == 1  # nothing was created, nothing deleted


def test_citizen_can_continue_anyway(client, app):
    creds = _citizen(app)
    token = _login(client, creds)
    _report(app, creds["id"], BASE_LAT, BASE_LON + 0.0001)

    response = client.post(
        "/api/reports",
        json=_create_body(confirm_duplicate=True),
        headers=auth_header(token),
    )
    assert response.status_code == 201
    with app.app_context():
        assert Report.query.count() == 2


def test_create_report_still_works_with_no_nearby_reports(client, app):
    creds = _citizen(app)
    token = _login(client, creds)

    response = client.post("/api/reports", json=_create_body(), headers=auth_header(token))
    assert response.status_code == 201
    body = response.get_json()
    assert body["report"]["status"] == "NEW"
    assert round(body["report"]["latitude"], 4) == BASE_LAT
    assert round(body["report"]["longitude"], 4) == BASE_LON
