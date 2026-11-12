"""Community Action Hub API workflow tests (requires PostgreSQL/PostGIS)."""
from datetime import datetime, timedelta, timezone
from backend.tests.conftest import auth_header
from backend.models import CommunityEvent, EventVolunteer, Notification, User, UserRole
from backend.extensions import db


def register(client, email, name="Community Test"):
    response = client.post("/api/auth/register", json={"name": name, "email": email, "password": "password123"})
    assert response.status_code == 201, response.get_json()
    return response.get_json()["access_token"]


def admin_token(client, app):
    token = register(client, "community-admin@example.com", "Community Admin")
    with app.app_context():
        user = User.query.filter_by(email="community-admin@example.com").one()
        user.role = UserRole.ADMIN
        db.session.commit()
    response = client.post("/api/auth/login", json={"email": "community-admin@example.com", "password": "password123"})
    assert response.status_code == 200
    return response.get_json()["access_token"]


def proposal(**extra):
    starts = datetime.now(timezone.utc) + timedelta(days=3)
    return {
        "title": "Community drainage awareness drive",
        "description": "Help residents understand how to report drainage hazards safely.",
        "category": "DRAINAGE_AWARENESS",
        "location_name": "College main gate, Sohna",
        "latitude": 28.2471,
        "longitude": 77.0654,
        "starts_at": starts.isoformat(),
        "capacity": 12,
        "safety_instructions": "Remain in public areas. Never enter drains or handle sewage.",
        **extra,
    }


def test_proposal_is_pending_and_hidden_until_approval(client):
    token = register(client, "community-citizen@example.com")
    response = client.post("/api/community/events", json=proposal(), headers=auth_header(token))
    assert response.status_code == 201, response.get_json()
    assert response.get_json()["event"]["status"] == "PENDING"
    assert client.get("/api/community/events").get_json()["events"] == []


def test_only_admin_can_approve_and_approval_notifies_creator(client, app):
    citizen = register(client, "proposal-owner@example.com")
    event_response = client.post("/api/community/events", json=proposal(), headers=auth_header(citizen))
    event_id = event_response.get_json()["event"]["id"]
    denied = client.patch(f"/api/admin/community/events/{event_id}/review", json={"status": "APPROVED"}, headers=auth_header(citizen))
    assert denied.status_code == 403
    admin = admin_token(client, app)
    approved = client.patch(f"/api/admin/community/events/{event_id}/review", json={"status": "APPROVED"}, headers=auth_header(admin))
    assert approved.status_code == 200
    assert client.get("/api/community/events").get_json()["events"][0]["id"] == event_id
    with app.app_context():
        assert Notification.query.filter_by(type="PROPOSAL_APPROVED").count() == 1


def test_join_prevents_duplicate_and_saves_registration(client, app):
    owner = register(client, "event-owner@example.com")
    admin = admin_token(client, app)
    event_id = client.post("/api/community/events", json=proposal(), headers=auth_header(owner)).get_json()["event"]["id"]
    assert client.patch(f"/api/admin/community/events/{event_id}/review", json={"status": "APPROVED"}, headers=auth_header(admin)).status_code == 200
    volunteer = register(client, "event-volunteer@example.com")
    joined = client.post(f"/api/community/events/{event_id}/join", headers=auth_header(volunteer))
    assert joined.status_code == 201
    duplicate = client.post(f"/api/community/events/{event_id}/join", headers=auth_header(volunteer))
    assert duplicate.status_code == 409
    with app.app_context():
        assert EventVolunteer.query.filter_by(event_id=event_id).count() == 1


def test_notifications_are_private(client, app):
    citizen = register(client, "notify-owner@example.com")
    other = register(client, "notify-other@example.com")
    with app.app_context():
        user = User.query.filter_by(email="notify-owner@example.com").one()
        db.session.add(Notification(user_id=user.id, type="TEST", message="Private notification"))
        db.session.commit()
        notification_id = Notification.query.one().id
    assert client.get("/api/community/notifications", headers=auth_header(other)).get_json()["notifications"] == []
    assert client.patch(f"/api/community/notifications/{notification_id}/read", headers=auth_header(other)).status_code == 404
    assert client.get("/api/community/notifications", headers=auth_header(citizen)).get_json()["unread_count"] == 1
