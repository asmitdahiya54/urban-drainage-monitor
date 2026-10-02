"""Authentication and authorization tests."""

from backend.tests.conftest import auth_header

VALID = {"name": "John Doe", "email": "john@example.com", "password": "password123"}


def register(client, **overrides):
    return client.post("/api/auth/register", json={**VALID, **overrides})


# --- 1. successful registration -------------------------------------------
def test_register_success(client):
    response = register(client)
    assert response.status_code == 201
    body = response.get_json()
    assert body["user"]["email"] == "john@example.com"
    assert body["user"]["role"] == "citizen"
    assert body["access_token"]
    # No secret material leaks out.
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_register_ignores_role_escalation(client):
    body = register(client, role="admin").get_json()
    assert body["user"]["role"] == "citizen"


def test_register_normalizes_email(client):
    body = register(client, email="  JOHN@Example.COM ").get_json()
    assert body["user"]["email"] == "john@example.com"


# --- 2. duplicate email ---------------------------------------------------
def test_register_duplicate_email(client):
    register(client)
    response = register(client, email="JOHN@example.com", name="Someone Else")
    assert response.status_code == 409
    assert "already exists" in response.get_json()["error"]


# --- 3. invalid registration ---------------------------------------------
def test_register_invalid_email(client):
    response = register(client, email="not-an-email")
    assert response.status_code == 400
    assert response.get_json()["field"] == "email"


def test_register_weak_password(client):
    response = register(client, password="abc")
    assert response.status_code == 400
    assert response.get_json()["field"] == "password"


def test_register_missing_name(client):
    response = register(client, name="")
    assert response.status_code == 400
    assert response.get_json()["field"] == "name"


def test_password_is_hashed(client, app):
    register(client)
    from backend.models import User

    with app.app_context():
        user = User.query.filter_by(email="john@example.com").first()
        assert user.password_hash != "password123"
        assert user.check_password("password123")


# --- 4. successful login --------------------------------------------------
def test_login_success(client):
    register(client)
    response = client.post(
        "/api/auth/login", json={"email": "john@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["access_token"]
    assert body["user"]["role"] == "citizen"


# --- 5. wrong password ----------------------------------------------------
def test_login_wrong_password(client):
    register(client)
    response = client.post(
        "/api/auth/login", json={"email": "john@example.com", "password": "wrongpass1"}
    )
    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_login_unknown_account_same_message(client):
    response = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "password123"}
    )
    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


# --- 6/7. /api/auth/me ----------------------------------------------------
def test_me_without_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.get_json()["error"]


def test_me_with_invalid_token(client):
    response = client.get("/api/auth/me", headers=auth_header("not.a.jwt"))
    assert response.status_code == 401


def test_me_with_valid_token(client):
    token = register(client).get_json()["access_token"]
    response = client.get("/api/auth/me", headers=auth_header(token))
    assert response.status_code == 200
    user = response.get_json()["user"]
    assert user["email"] == "john@example.com"
    assert user["created_at"]
    assert "password_hash" not in user


# --- 8/9. role authorization ---------------------------------------------
def test_citizen_cannot_access_admin_endpoint(client):
    token = register(client).get_json()["access_token"]
    response = client.get("/api/admin/stats", headers=auth_header(token))
    assert response.status_code == 403


def test_admin_endpoint_requires_auth(client):
    assert client.get("/api/admin/stats").status_code == 401


def test_admin_can_access_admin_endpoint(client, admin_user):
    token = client.post("/api/auth/login", json=admin_user).get_json()["access_token"]
    response = client.get("/api/admin/stats", headers=auth_header(token))
    assert response.status_code == 200
    assert response.get_json()["admins"] == 1


def test_logout_is_stateless(client):
    token = register(client).get_json()["access_token"]
    response = client.post("/api/auth/logout", headers=auth_header(token))
    assert response.status_code == 200
    assert response.get_json()["stateless"] is True
