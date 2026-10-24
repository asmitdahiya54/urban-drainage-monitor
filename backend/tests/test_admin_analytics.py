"""Tests for the admin analytics endpoint (Step 7).

Needs a real PostgreSQL + PostGIS test database (see conftest.py), because
every number is produced by SQL / PostGIS aggregation.
"""

from backend.extensions import db
from backend.models import Report, ReportStatus, Severity
from backend.tests.conftest import auth_header
from backend.tests.test_admin_reports import create_report, set_status
from backend.tests.test_reports import make_admin, register


def get_analytics(client, token: str, qs: str = ""):
    return client.get(f"/api/admin/analytics{qs}", headers=auth_header(token))


# --- authorization --------------------------------------------------------
def test_unauthenticated_gets_401(client):
    assert client.get("/api/admin/analytics").status_code == 401


def test_citizen_gets_403(client):
    citizen = register(client, "asha@test.dev")
    assert get_analytics(client, citizen).status_code == 403


def test_admin_gets_200(client, app):
    admin = make_admin(client, app)
    response = get_analytics(client, admin)
    assert response.status_code == 200
    body = response.get_json()
    for key in (
        "totals",
        "by_status",
        "by_severity",
        "by_issue_type",
        "over_time",
        "by_month",
        "resolution_speed",
        "spatial",
    ):
        assert key in body, key


# --- correctness against the database ------------------------------------
def test_totals_match_database(client, app):
    citizen = register(client, "asha@test.dev")
    a = create_report(client, citizen, severity="CRITICAL")
    create_report(client, citizen, severity="LOW")
    create_report(client, citizen, severity="HIGH", issue_type="FLOODING")
    admin = make_admin(client, app)
    for status in ("VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"):
        assert set_status(client, admin, a, status).status_code == 200

    totals = get_analytics(client, admin).get_json()["totals"]
    with app.app_context():
        assert totals["total"] == Report.query.count() == 3
        assert totals["resolved"] == 1
        assert totals["unresolved"] == 2
        assert totals["rejected"] == 0
        assert (
            totals["high_severity"]
            == Report.query.filter(Report.severity.in_([Severity.HIGH, Severity.CRITICAL])).count()
            == 2
        )
        assert totals["recent"] == 3  # all created just now
        assert totals["awaiting_review"] == 2
        assert totals["resolution_rate"] == round(1 / 3 * 100, 1)


def test_breakdowns_match_database(client, app):
    citizen = register(client, "asha@test.dev")
    create_report(client, citizen, issue_type="BLOCKED_DRAIN", severity="HIGH")
    create_report(client, citizen, issue_type="BLOCKED_DRAIN", severity="LOW")
    create_report(client, citizen, issue_type="FLOODING", severity="LOW")
    admin = make_admin(client, app)

    body = get_analytics(client, admin).get_json()
    status_counts = {row["key"]: row["count"] for row in body["by_status"]}
    severity_counts = {row["key"]: row["count"] for row in body["by_severity"]}
    issue_counts = {row["key"]: row["count"] for row in body["by_issue_type"]}

    # Every enum value is present, even when zero, so charts have stable axes.
    assert set(status_counts) == {s.value for s in ReportStatus}
    assert set(severity_counts) == {s.value for s in Severity}

    assert status_counts["NEW"] == 3
    assert status_counts["RESOLVED"] == 0
    assert severity_counts["LOW"] == 2
    assert severity_counts["HIGH"] == 1
    assert severity_counts["CRITICAL"] == 0
    assert issue_counts["BLOCKED_DRAIN"] == 2
    assert issue_counts["FLOODING"] == 1
    assert issue_counts["OTHER"] == 0
    # Busiest issue type first.
    assert body["by_issue_type"][0]["key"] == "BLOCKED_DRAIN"
    # Sum of any breakdown equals the total.
    assert sum(status_counts.values()) == body["totals"]["total"] == 3


def test_over_time_series_is_continuous(client, app):
    citizen = register(client, "asha@test.dev")
    create_report(client, citizen)
    create_report(client, citizen)
    admin = make_admin(client, app)

    body = get_analytics(client, admin, "?days=7").get_json()
    series = body["over_time"]
    assert len(series) == 7  # one row per day, gaps filled with zeros
    assert body["params"]["days"] == 7
    assert sum(row["count"] for row in series) == 2
    assert series[-1]["count"] == 2  # today
    assert series[0]["count"] == 0
    # Days are ascending and unique.
    days = [row["day"] for row in series]
    assert days == sorted(days) and len(set(days)) == 7

    months = get_analytics(client, admin, "?months=3").get_json()["by_month"]
    assert len(months) == 3
    assert sum(row["count"] for row in months) == 2


def test_resolution_speed_and_spatial(client, app):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    admin = make_admin(client, app)
    for status in ("VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"):
        set_status(client, admin, report_id, status)

    body = get_analytics(client, admin).get_json()
    speed = body["resolution_speed"]
    assert speed["resolved_count"] == 1
    assert speed["avg_hours"] is not None and speed["avg_hours"] >= 0

    spatial = body["spatial"]
    assert spatial["located"] == 1
    with app.app_context():
        report = db.session.get(Report, report_id)
        lat, lon = report.latitude, report.longitude
    assert abs(spatial["center_latitude"] - lat) < 0.001
    assert abs(spatial["center_longitude"] - lon) < 0.001


def test_analytics_on_empty_database(client, app):
    admin = make_admin(client, app)
    body = get_analytics(client, admin).get_json()
    assert body["totals"]["total"] == 0
    assert body["totals"]["resolution_rate"] == 0.0
    assert all(row["count"] == 0 for row in body["by_status"])
    assert body["resolution_speed"]["resolved_count"] == 0
    assert body["resolution_speed"]["avg_hours"] is None
    assert body["spatial"]["located"] == 0
    assert body["spatial"]["center_latitude"] is None


def test_existing_admin_endpoints_still_work(client, app):
    citizen = register(client, "asha@test.dev")
    create_report(client, citizen)
    admin = make_admin(client, app)
    assert client.get("/api/admin/stats", headers=auth_header(admin)).status_code == 200
    assert client.get("/api/admin/reports", headers=auth_header(admin)).status_code == 200
