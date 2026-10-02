"""Step 11 — security hardening regression tests.

These lock in the security boundaries of the existing API. They must never be
relaxed: each one describes an attack that previously had to be reasoned about
by hand.
"""

import json

import pytest

from backend.app import create_app
from backend.config import Config, TestConfig
from backend.tests.conftest import auth_header


def register(client, email="sec.citizen@example.com", password="Citizen123", name="Sec Citizen"):
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 201, response.get_data(as_text=True)
    return response.get_json()["access_token"]


def admin_token(client, admin_user):
    response = client.post("/api/auth/login", json=admin_user)
    assert response.status_code == 200
    return response.get_json()["access_token"]


# --- configuration --------------------------------------------------------
def test_debug_is_off_unless_explicitly_enabled(monkeypatch):
    """A forgotten FLASK_DEBUG must not enable the interactive debugger."""
    from backend.config import env_flag

    monkeypatch.delenv("FLASK_DEBUG", raising=False)
    assert env_flag("FLASK_DEBUG", "0") is False
    monkeypatch.setenv("FLASK_DEBUG", "true")
    assert env_flag("FLASK_DEBUG", "0") is False
    monkeypatch.setenv("FLASK_DEBUG", "1")
    assert env_flag("FLASK_DEBUG", "0") is True
    assert TestConfig.DEBUG is False
    assert TestConfig.EXPOSE_SERVER_DETAILS is False


def test_request_body_size_is_capped():
    assert Config.MAX_CONTENT_LENGTH <= 5 * 1024 * 1024


def test_security_headers_present_on_api_responses(client):
    response = client.get("/api/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"


def test_health_hides_exact_postgis_version_by_default(client):
    payload = client.get("/api/health").get_json()
    assert payload["status"] in ("ok", "error")
    if payload.get("database") == "connected":
        assert payload["postgis"] == "enabled"
        assert "postgis_version" not in payload


def test_error_responses_are_json_without_internals(client):
    missing = client.get("/api/does-not-exist")
    assert missing.status_code == 404
    assert missing.get_json() == {"error": "Not found"}

    wrong_method = client.delete("/api/health")
    assert wrong_method.status_code == 405
    assert wrong_method.get_json() == {"error": "Method not allowed"}


# --- authentication -------------------------------------------------------
def test_password_hash_never_leaves_the_api(client):
    token = register(client, "sec.hash@example.com")
    body = client.get("/api/auth/me", headers=auth_header(token)).get_data(as_text=True)
    assert "password" not in body.lower()
    assert "pbkdf2" not in body.lower()
    assert "scrypt" not in body.lower()


def test_registration_cannot_self_assign_admin(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Escalation Attempt",
            "email": "sec.escalate@example.com",
            "password": "Citizen123",
            "role": "admin",
            "is_admin": True,
        },
    )
    assert response.status_code == 201
    assert response.get_json()["user"]["role"] == "citizen"


def test_login_errors_do_not_reveal_whether_the_account_exists(client):
    register(client, "sec.enum@example.com")
    unknown = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "Citizen123"}
    )
    wrong = client.post(
        "/api/auth/login", json={"email": "sec.enum@example.com", "password": "Wrong123456"}
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.get_json()["error"] == wrong.get_json()["error"]


def test_oversized_credentials_are_rejected_generically(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "a" * 500 + "@example.com", "password": "b" * 5000},
    )
    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_tampered_and_missing_tokens_are_rejected(client):
    token = register(client, "sec.tamper@example.com")
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth_header(token + "x")).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": token}).status_code == 401
    assert client.get("/api/auth/me", headers=auth_header("not.a.jwt")).status_code == 401


def test_token_signed_with_another_secret_is_rejected(client):
    """A JWT minted with a different key must never be accepted."""
    other = create_app(type("OtherConfig", (TestConfig,), {"JWT_SECRET_KEY": "attacker-key"}))
    with other.app_context():
        from flask_jwt_extended import create_access_token

        forged = create_access_token(identity="1", additional_claims={"role": "admin"})
    assert client.get("/api/auth/me", headers=auth_header(forged)).status_code == 401


def test_role_claim_in_token_is_not_trusted_for_authorization(client):
    """Authorization comes from the database row, not the token's role claim."""
    register(client, "sec.claim@example.com")
    from flask_jwt_extended import create_access_token

    from backend.extensions import db
    from backend.models import User

    user = db.session.query(User).filter_by(email="sec.claim@example.com").one()
    forged = create_access_token(
        identity=str(user.id), additional_claims={"role": "admin", "is_admin": True}
    )
    response = client.get("/api/admin/stats", headers=auth_header(forged))
    assert response.status_code == 403


# --- authorization boundaries --------------------------------------------
ADMIN_GET_ROUTES = (
    "/api/admin/stats",
    "/api/admin/analytics",
    "/api/admin/reports",
    "/api/admin/risk-predictions",
)


@pytest.mark.parametrize("route", ADMIN_GET_ROUTES)
def test_admin_routes_reject_anonymous_and_citizen(client, route):
    assert client.get(route).status_code == 401
    token = register(client, "sec.boundary@example.com")
    assert client.get(route, headers=auth_header(token)).status_code == 403


def test_risk_training_requires_admin(client):
    assert client.post("/api/admin/risk-model/train").status_code == 401
    token = register(client, "sec.train@example.com")
    assert client.post("/api/admin/risk-model/train", headers=auth_header(token)).status_code == 403


def test_citizen_cannot_read_another_citizens_report(client):
    author = register(client, "sec.author@example.com")
    created = client.post(
        "/api/reports",
        headers=auth_header(author),
        json={
            "issue_type": "FLOODING",
            "severity": "HIGH",
            "description": "Security boundary test report for ownership checks.",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "confirm_duplicate": True,
        },
    )
    assert created.status_code == 201
    report_id = created.get_json()["report"]["id"]

    other = register(client, "sec.other@example.com")
    denied = client.get(f"/api/reports/{report_id}", headers=auth_header(other))
    assert denied.status_code in (403, 404)
    listing = client.get("/api/reports", headers=auth_header(other)).get_json()
    assert all(item["id"] != report_id for item in listing["reports"])


def test_citizen_cannot_change_report_status(client, admin_user):
    author = register(client, "sec.status@example.com")
    created = client.post(
        "/api/reports",
        headers=auth_header(author),
        json={
            "issue_type": "BLOCKED_DRAIN",
            "severity": "LOW",
            "description": "Status change authorization boundary test report.",
            "latitude": 12.97,
            "longitude": 77.59,
            "confirm_duplicate": True,
        },
    )
    report_id = created.get_json()["report"]["id"]
    response = client.put(
        f"/api/admin/reports/{report_id}/status",
        headers=auth_header(author),
        json={"status": "RESOLVED"},
    )
    assert response.status_code == 403


# --- privacy on public endpoints -----------------------------------------
PUBLIC_ROUTES = ("/api/reports/map", "/api/reports/hotspots", "/api/reports/risk-areas")


@pytest.mark.parametrize("route", PUBLIC_ROUTES)
def test_public_endpoints_expose_no_citizen_identity(client, route):
    token = register(client, "sec.private@example.com", name="Private Person")
    client.post(
        "/api/reports",
        headers=auth_header(token),
        json={
            "issue_type": "WATERLOGGING",
            "severity": "CRITICAL",
            "description": "Privacy check report for the public map endpoints.",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "confirm_duplicate": True,
        },
    )
    body = client.get(route).get_data(as_text=True)
    assert body and client.get(route).status_code == 200
    for secret in ("sec.private@example.com", "Private Person", "user_id", "password"):
        assert secret not in body


# --- injection and malformed input ---------------------------------------
def test_sql_injection_attempt_in_admin_search_is_harmless(client, admin_user):
    token = admin_token(client, admin_user)
    for attempt in ("'; DROP TABLE reports; --", "%", "_", "\\", "' OR '1'='1"):
        response = client.get(
            "/api/admin/reports", headers=auth_header(token), query_string={"search": attempt}
        )
        assert response.status_code == 200
    # The table still exists and still answers.
    assert client.get("/api/admin/stats", headers=auth_header(token)).status_code == 200


def test_overlong_admin_search_is_truncated_not_fatal(client, admin_user):
    token = admin_token(client, admin_user)
    response = client.get(
        "/api/admin/reports", headers=auth_header(token), query_string={"search": "x" * 5000}
    )
    assert response.status_code == 200
    assert len(response.get_json()["filters"].get("search", "")) <= 120


def test_malformed_json_body_returns_400_not_500(client):
    response = client.post(
        "/api/auth/login", data="{not json", content_type="application/json"
    )
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_xss_payload_in_description_is_stored_and_returned_as_data(client):
    """The API returns JSON; escaping is the frontend's job, but nothing may execute here."""
    token = register(client, "sec.xss@example.com")
    payload = "<script>alert('xss')</script> drainage blocked near the market"
    created = client.post(
        "/api/reports",
        headers=auth_header(token),
        json={
            "issue_type": "BLOCKED_DRAIN",
            "severity": "MEDIUM",
            "description": payload,
            "latitude": 12.96,
            "longitude": 77.58,
            "confirm_duplicate": True,
        },
    )
    assert created.status_code == 201
    assert created.headers["Content-Type"].startswith("application/json")
    assert created.get_json()["report"]["description"] == payload


def test_analytics_group_by_column_is_whitelisted():
    from backend.services import analytics

    with pytest.raises(ValueError):
        analytics._grouped("status; DROP TABLE reports", type("E", (), {"__members__": {}}))


def test_civic_endpoint_requires_a_session_and_hides_keys(client, monkeypatch):
    monkeypatch.setenv("CIVIC_API_KEY", "top-secret-civic-key")
    assert client.get("/api/civic-data").status_code == 401
    token = register(client, "sec.civic@example.com")
    response = client.get("/api/civic-data", headers=auth_header(token))
    assert response.status_code in (200, 503)
    assert "top-secret-civic-key" not in json.dumps(response.get_json())
