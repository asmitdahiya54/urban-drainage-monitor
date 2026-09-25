"""Tests for the public GIS map endpoints (Step 6).

Needs a real PostgreSQL + PostGIS test database (see conftest.py): the
hotspot endpoint runs ST_ClusterDBSCAN inside the database.
"""

from backend.extensions import db
from backend.models import Report, ReportStatus, User, UserRole
from backend.tests.conftest import auth_header


def _citizen(app, email: str = "mapper@example.com") -> int:
    with app.app_context():
        user = User(name="Map Citizen", email=email, role=UserRole.CITIZEN)
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        return user.id


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
        db.session.add(report)
        db.session.commit()
        return report.id


def test_map_endpoint_is_public(client, app):
    user_id = _citizen(app)
    _report(app, user_id, 28.6139, 77.2090)

    response = client.get("/api/reports/map")
    assert response.status_code == 200
    data = response.get_json()
    assert data["count"] == 1
    assert data["summary"]["total"] == 1
    point = data["reports"][0]
    assert round(point["latitude"], 4) == 28.6139
    assert round(point["longitude"], 4) == 77.2090
    assert point["weight"] == 3.0  # HIGH


def test_map_never_exposes_personal_data(client, app):
    user_id = _citizen(app, "private@example.com")
    _report(app, user_id, 28.61, 77.21)

    response = client.get("/api/reports/map")
    body = response.get_data(as_text=True)
    assert "private@example.com" not in body
    assert "Map Citizen" not in body
    point = response.get_json()["reports"][0]
    for forbidden in ("user_id", "reporter", "description", "image_path"):
        assert forbidden not in point


def test_map_filters_by_issue_type_severity_and_status(client, app):
    user_id = _citizen(app)
    _report(app, user_id, 28.61, 77.21, issue_type="FLOODING", severity="CRITICAL")
    _report(
        app,
        user_id,
        28.62,
        77.22,
        issue_type="WATERLOGGING",
        severity="LOW",
        status=ReportStatus.RESOLVED,
    )

    assert client.get("/api/reports/map?issue_type=FLOODING").get_json()["count"] == 1
    assert client.get("/api/reports/map?severity=LOW,CRITICAL").get_json()["count"] == 2
    assert client.get("/api/reports/map?status=RESOLVED").get_json()["count"] == 1
    assert client.get("/api/reports/map?issue_type=OTHER").get_json()["count"] == 0


def test_map_rejects_unknown_filter_values(client):
    response = client.get("/api/reports/map?severity=NOT_A_SEVERITY")
    assert response.status_code == 400
    assert "Unsupported filter value" in response.get_json()["error"]


def test_map_hides_rejected_reports_unless_requested(client, app):
    user_id = _citizen(app)
    _report(app, user_id, 28.61, 77.21, status=ReportStatus.REJECTED)

    assert client.get("/api/reports/map").get_json()["count"] == 0
    assert client.get("/api/reports/map?status=REJECTED").get_json()["count"] == 1


def test_map_radius_filter_uses_postgis_distance(client, app):
    user_id = _citizen(app)
    _report(app, user_id, 28.6139, 77.2090)  # near the centre
    _report(app, user_id, 19.0760, 72.8777)  # ~1150 km away

    near = client.get("/api/reports/map?lat=28.6139&lon=77.2090&radius_m=5000")
    assert near.status_code == 200
    assert near.get_json()["count"] == 1


def test_map_empty_state(client):
    data = client.get("/api/reports/map").get_json()
    assert data["count"] == 0
    assert data["reports"] == []
    assert data["summary"] == {"total": 0, "resolved": 0, "high_severity": 0}


def test_hotspots_cluster_nearby_reports(client, app):
    user_id = _citizen(app)
    # Three reports within ~200 m of each other -> one hotspot.
    for offset in (0.0, 0.001, 0.0015):
        _report(app, user_id, 28.6139 + offset, 77.2090 + offset, severity="CRITICAL")
    # An isolated report far away -> not part of any cluster.
    _report(app, user_id, 19.0760, 72.8777)

    response = client.get("/api/reports/hotspots?radius_m=400&min_points=2")
    assert response.status_code == 200
    data = response.get_json()
    assert data["count"] == 1
    hotspot = data["hotspots"][0]
    assert hotspot["report_count"] == 3
    assert hotspot["severity_score"] == 12.0  # 3 x CRITICAL
    assert 28.6 < hotspot["latitude"] < 28.63
    assert "user_id" not in hotspot


def test_hotspots_is_public_and_validates_params(client):
    assert client.get("/api/reports/hotspots").status_code == 200
    bad = client.get("/api/reports/hotspots?min_points=1")
    assert bad.status_code == 400


def test_protected_report_endpoints_still_require_auth(client, app):
    user_id = _citizen(app)
    report_id = _report(app, user_id, 28.61, 77.21)

    assert client.get("/api/reports").status_code == 401
    assert client.get(f"/api/reports/{report_id}").status_code == 401

    login = client.post(
        "/api/auth/login", json={"email": "mapper@example.com", "password": "password123"}
    )
    token = login.get_json()["access_token"]
    ok = client.get(f"/api/reports/{report_id}", headers=auth_header(token))
    assert ok.status_code == 200
