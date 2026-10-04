"""Tests for admin report management (Step 5).

Needs a real PostgreSQL + PostGIS test database (see conftest.py).
"""

from backend.extensions import db
from backend.models import Report, ReportStatus, ReportStatusHistory
from backend.tests.conftest import auth_header
from backend.tests.test_reports import VALID, make_admin, register


def create_report(client, token: str, **overrides) -> int:
    payload = {**VALID, "confirm_duplicate": True, **overrides}
    response = client.post("/api/reports", json=payload, headers=auth_header(token))
    assert response.status_code == 201, response.get_json()
    return response.get_json()["report"]["id"]


def set_status(client, admin_token: str, report_id: int, status: str, comment: str | None = None):
    body: dict = {"status": status}
    if comment is not None:
        body["comment"] = comment
    return client.put(
        f"/api/admin/reports/{report_id}/status", json=body, headers=auth_header(admin_token)
    )


# --- listing / authorization ---------------------------------------------
def test_admin_can_list_all_reports(client, app):
    citizen = register(client, "asha@test.dev", "Asha")
    create_report(client, citizen)
    other = register(client, "ravi@test.dev", "Ravi")
    create_report(client, other, issue_type="FLOODING")

    admin = make_admin(client, app)
    response = client.get("/api/admin/reports", headers=auth_header(admin))
    assert response.status_code == 200
    body = response.get_json()
    assert body["total"] == 2
    assert len(body["reports"]) == 2


def test_citizen_cannot_list_all_reports(client):
    citizen = register(client, "asha@test.dev")
    response = client.get("/api/admin/reports", headers=auth_header(citizen))
    assert response.status_code == 403


def test_unauthenticated_cannot_list_all_reports(client):
    assert client.get("/api/admin/reports").status_code == 401


def test_admin_can_view_any_report(client, app):
    citizen = register(client, "asha@test.dev", "Asha")
    report_id = create_report(client, citizen)

    admin = make_admin(client, app)
    response = client.get(f"/api/admin/reports/{report_id}", headers=auth_header(admin))
    assert response.status_code == 200
    report = response.get_json()["report"]
    assert report["reporter"]["name"] == "Asha"
    assert "password" not in report["reporter"]
    assert "password_hash" not in report["reporter"]
    assert report["status_history"][0]["new_status"] == "NEW"
    assert "PENDING_VERIFICATION" in report["allowed_next_statuses"]


def test_citizen_cannot_view_report_through_admin_endpoint(client):
    owner = register(client, "asha@test.dev")
    report_id = create_report(client, owner)
    intruder = register(client, "mallory@test.dev")
    response = client.get(f"/api/admin/reports/{report_id}", headers=auth_header(intruder))
    assert response.status_code == 403
    # Also not through the citizen endpoint.
    assert client.get(f"/api/reports/{report_id}", headers=auth_header(intruder)).status_code == 403


def test_admin_report_not_found(client, app):
    admin = make_admin(client, app)
    assert client.get("/api/admin/reports/9999", headers=auth_header(admin)).status_code == 404


# --- status updates -------------------------------------------------------
def test_admin_can_change_status_and_history_is_written(client, app):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    admin = make_admin(client, app)

    response = set_status(client, admin, report_id, "VERIFIED", "Verified by administrator.")
    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["changed"] is True
    assert body["report"]["status"] == "VERIFIED"

    with app.app_context():
        rows = (
            ReportStatusHistory.query.filter_by(report_id=report_id)
            .order_by(ReportStatusHistory.id)
            .all()
        )
        assert [(r.old_status, r.new_status) for r in rows] == [
            (None, ReportStatus.NEW),
            (ReportStatus.NEW, ReportStatus.VERIFIED),
        ]
        assert rows[-1].comment == "Verified by administrator."
        assert rows[-1].changed_by is not None
        assert db.session.get(Report, report_id).status == ReportStatus.VERIFIED


def test_full_workflow_to_resolved(client, app):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    admin = make_admin(client, app)

    for status in ("VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"):
        assert set_status(client, admin, report_id, status).status_code == 200

    with app.app_context():
        report = db.session.get(Report, report_id)
        assert report.status == ReportStatus.RESOLVED
        assert report.resolved_at is not None
        assert ReportStatusHistory.query.filter_by(report_id=report_id).count() == 5


def test_citizen_cannot_change_status(client):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    response = set_status(client, citizen, report_id, "RESOLVED")
    assert response.status_code == 403
    unauth = client.put(f"/api/admin/reports/{report_id}/status", json={"status": "RESOLVED"})
    assert unauth.status_code == 401


def test_invalid_status_rejected(client, app):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    admin = make_admin(client, app)
    for bad in ("DEFINITELY_NOT_A_STATUS", "", None, 5):
        response = set_status(client, admin, report_id, bad)  # type: ignore[arg-type]
        assert response.status_code == 400, bad
    with app.app_context():
        assert db.session.get(Report, report_id).status == ReportStatus.NEW


def test_disallowed_transition_rejected(client, app):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    admin = make_admin(client, app)
    # NEW → IN_PROGRESS skips verification and assignment.
    response = set_status(client, admin, report_id, "IN_PROGRESS")
    assert response.status_code == 400
    assert "Cannot change status" in response.get_json()["error"]


def test_duplicate_status_change_creates_no_history(client, app):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    admin = make_admin(client, app)
    set_status(client, admin, report_id, "VERIFIED")

    response = set_status(client, admin, report_id, "VERIFIED", "again")
    assert response.status_code == 200
    assert response.get_json()["changed"] is False
    with app.app_context():
        assert ReportStatusHistory.query.filter_by(report_id=report_id).count() == 2


def test_citizen_sees_admin_status_update(client, app):
    citizen = register(client, "asha@test.dev")
    report_id = create_report(client, citizen)
    admin = make_admin(client, app)
    set_status(client, admin, report_id, "VERIFIED", "Checked on site.")

    response = client.get(f"/api/reports/{report_id}", headers=auth_header(citizen))
    assert response.status_code == 200
    report = response.get_json()["report"]
    assert report["status"] == "VERIFIED"
    assert [e["new_status"] for e in report["status_history"]] == ["NEW", "VERIFIED"]
    assert report["status_history"][-1]["changed_by_name"] == "Test Admin"


# --- filters, search, pagination, stats ----------------------------------
def test_filters_query_the_database(client, app):
    citizen = register(client, "asha@test.dev")
    blocked = create_report(client, citizen, issue_type="BLOCKED_DRAIN", severity="HIGH")
    create_report(client, citizen, issue_type="FLOODING", severity="LOW")
    admin = make_admin(client, app)
    set_status(client, admin, blocked, "VERIFIED")

    def ids(qs: str) -> list[int]:
        response = client.get(f"/api/admin/reports?{qs}", headers=auth_header(admin))
        assert response.status_code == 200, response.get_json()
        return [r["id"] for r in response.get_json()["reports"]]

    assert ids("status=VERIFIED") == [blocked]
    assert ids("severity=HIGH") == [blocked]
    assert ids("issue_type=BLOCKED_DRAIN") == [blocked]
    assert ids("status=NEW&severity=HIGH") == []
    assert len(ids("status=ALL")) == 2
    assert len(ids("")) == 2
    assert ids("search=asha") == ids("")  # matches the reporter
    bad = client.get("/api/admin/reports?severity=NOPE", headers=auth_header(admin))
    assert bad.status_code == 400


def test_pagination(client, app):
    citizen = register(client, "asha@test.dev")
    for _ in range(5):
        create_report(client, citizen)
    admin = make_admin(client, app)

    first = client.get("/api/admin/reports?page=1&per_page=2", headers=auth_header(admin))
    body = first.get_json()
    assert body["total"] == 5 and body["pages"] == 3
    assert len(body["reports"]) == 2 and body["has_next"] and not body["has_prev"]

    last = client.get("/api/admin/reports?page=3&per_page=2", headers=auth_header(admin))
    assert len(last.get_json()["reports"]) == 1
    assert last.get_json()["has_prev"] and not last.get_json()["has_next"]


def test_admin_stats_match_database(client, app):
    citizen = register(client, "asha@test.dev")
    a = create_report(client, citizen)
    create_report(client, citizen)
    admin = make_admin(client, app)
    set_status(client, admin, a, "VERIFIED")

    body = client.get("/api/admin/stats", headers=auth_header(admin)).get_json()
    with app.app_context():
        assert body["reports"] == Report.query.count()
        assert body["by_status"]["NEW"] == Report.query.filter_by(status=ReportStatus.NEW).count()
        assert body["by_status"]["VERIFIED"] == 1
        assert body["by_status"]["RESOLVED"] == 0
