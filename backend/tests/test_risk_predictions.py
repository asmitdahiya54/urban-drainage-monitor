"""Step 9 tests — ML risk prediction prototype.

Covered: authorization, insufficient data, training, prediction retrieval,
privacy (no citizen data in predictions), invalid input, the public-safe
endpoint, and the pure model / proxy-target functions.

Needs a real PostgreSQL + PostGIS test database (see conftest.py).
"""

from datetime import datetime, timedelta, timezone

import pytest

from backend.extensions import db
from backend.models import Report
from backend.tests.conftest import auth_header
from backend.tests.test_reports import VALID, make_admin, register
from ml.risk_model import (
    FEATURE_NAMES,
    MIN_SAMPLES,
    combined_score,
    proxy_risk,
    risk_level,
    train_baseline,
)

CITIZEN_EMAIL = "asha@test.dev"

# --- Helpers --------------------------------------------------------------


def file_report(client, token: str, latitude: float, longitude: float, **overrides) -> int:
    """File a report through the API (confirming past the duplicate check)."""
    payload = {
        **VALID,
        "latitude": latitude,
        "longitude": longitude,
        "confirm_duplicate": True,
        **overrides,
    }
    response = client.post("/api/reports", json=payload, headers=auth_header(token))
    assert response.status_code == 201, response.get_json()
    return response.get_json()["report"]["id"]


def spread_out(count: int, start_lat: float = 28.60) -> list[tuple[float, float]]:
    """Distinct grid cells — 0.02° apart is four cells at the default size."""
    return [(start_lat + index * 0.02, 77.20 + index * 0.02) for index in range(count)]


def seed_areas(client, token: str) -> None:
    """Six quiet areas plus one busy area, so the proxy target has variance."""
    for latitude, longitude in spread_out(6):
        file_report(client, token, latitude, longitude)
    for _ in range(4):
        file_report(client, token, 28.60, 77.20, severity="CRITICAL")


def backdate(app, report_ids: list[int], days: int) -> None:
    with app.app_context():
        when = datetime.now(timezone.utc) - timedelta(days=days)
        for report_id in report_ids:
            db.session.get(Report, report_id).created_at = when
        db.session.commit()


# --- Pure model / proxy target -------------------------------------------


def test_proxy_risk_is_bounded_and_monotonic():
    quiet = proxy_risk({"report_count": 0, "recent_count": 0})
    busy = proxy_risk(
        {
            "report_count": 20,
            "recent_count": 20,
            "high_severity_count": 20,
            "unresolved_count": 20,
            "recency_score": 1.0,
        }
    )
    assert 0.0 <= quiet < busy <= 1.0
    assert busy == pytest.approx(1.0, abs=0.01)


def test_risk_level_bands():
    assert risk_level(0.05) == "LOW"
    assert risk_level(0.5) == "MEDIUM"
    assert risk_level(0.9) == "HIGH"


def test_combined_score_never_exceeds_reported_pressure():
    # A very confident model on a barely-reported area cannot yield a high score.
    assert combined_score(0.99, 0.05) < 0.34


def test_train_baseline_reports_insufficient_data():
    rows = [{name: 1.0 for name in FEATURE_NAMES} for _ in range(MIN_SAMPLES - 1)]
    result = train_baseline(rows)
    assert result["trained"] is False
    assert result["insufficient_data"] is True
    assert "Not enough data" in result["reason"]


def test_train_baseline_rejects_data_without_variance():
    rows = [{name: 1.0 for name in FEATURE_NAMES} for _ in range(8)]
    result = train_baseline(rows)
    assert result["trained"] is False
    assert result["insufficient_data"] is True


def test_train_baseline_is_reproducible():
    rows = [
        {**{name: 0.0 for name in FEATURE_NAMES}, "report_count": count, "recent_count": count}
        for count in (0, 1, 2, 6, 9, 12)
    ]
    first = train_baseline(rows)
    second = train_baseline(rows)
    assert first["trained"] is True
    assert [p["risk_score"] for p in first["predictions"]] == [
        p["risk_score"] for p in second["predictions"]
    ]


# --- Authorization --------------------------------------------------------


def test_training_requires_authentication(client):
    assert client.post("/api/admin/risk-model/train").status_code == 401
    assert client.get("/api/admin/risk-predictions").status_code == 401


def test_training_forbidden_for_citizens(client):
    citizen = register(client, CITIZEN_EMAIL)
    headers = auth_header(citizen)
    assert client.post("/api/admin/risk-model/train", headers=headers).status_code == 403
    assert client.get("/api/admin/risk-predictions", headers=headers).status_code == 403


# --- Endpoints ------------------------------------------------------------


def test_training_with_no_reports_reports_insufficient_data(client, app):
    admin = make_admin(client, app)
    response = client.post("/api/admin/risk-model/train", headers=auth_header(admin))
    assert response.status_code == 200
    body = response.get_json()
    assert body["trained"] is False
    assert body["insufficient_data"] is True
    assert body["reason"]
    assert body["disclaimer"].startswith("Prototype risk prediction")
    assert body["limitations"]


def test_predictions_empty_before_training(client, app):
    admin = make_admin(client, app)
    body = client.get("/api/admin/risk-predictions", headers=auth_header(admin)).get_json()
    assert body["trained"] is False
    assert body["count"] == 0
    assert body["predictions"] == []
    assert "train" in body["message"].lower()


def test_training_produces_and_stores_predictions(client, app):
    citizen = register(client, CITIZEN_EMAIL)
    seed_areas(client, citizen)
    admin = make_admin(client, app)

    response = client.post("/api/admin/risk-model/train", headers=auth_header(admin))
    assert response.status_code == 200
    body = response.get_json()

    assert body["trained"] is True
    assert body["samples"] >= MIN_SAMPLES
    assert body["features"] == list(FEATURE_NAMES)
    assert body["stored_predictions"] == body["samples"]
    assert body["model_type"].startswith("LogisticRegression")
    assert body["target"]["kind"] == "proxy"
    assert body["validation"]["note"]
    assert body["limitations"]

    stored = client.get("/api/admin/risk-predictions", headers=auth_header(admin)).get_json()
    assert stored["trained"] is True
    assert stored["count"] == body["stored_predictions"]
    first = stored["predictions"][0]
    assert first["risk_level"] in {"LOW", "MEDIUM", "HIGH"}
    assert 0.0 <= first["risk_score"] <= 1.0
    assert first["prediction_date"]
    assert first["indicators"]["report_count"] >= 1


def test_retraining_replaces_the_previous_run(client, app):
    citizen = register(client, CITIZEN_EMAIL)
    seed_areas(client, citizen)
    admin = make_admin(client, app)
    headers = auth_header(admin)

    first = client.post("/api/admin/risk-model/train", headers=headers).get_json()
    second = client.post("/api/admin/risk-model/train", headers=headers).get_json()
    stored = client.get("/api/admin/risk-predictions", headers=headers).get_json()

    assert first["stored_predictions"] == second["stored_predictions"]
    assert stored["count"] == second["stored_predictions"]


def test_predictions_never_expose_citizen_data(client, app):
    citizen = register(client, CITIZEN_EMAIL, "Asha Citizen")
    seed_areas(client, citizen)
    admin = make_admin(client, app)
    headers = auth_header(admin)
    client.post("/api/admin/risk-model/train", headers=headers)

    response = client.get("/api/admin/risk-predictions", headers=headers)
    raw = response.get_data(as_text=True)
    assert CITIZEN_EMAIL not in raw
    assert "Asha Citizen" not in raw
    assert "user_id" not in raw
    assert "password" not in raw

    for item in response.get_json()["predictions"]:
        assert set(item["indicators"]).isdisjoint({"user_id", "email", "name", "description"})


def test_old_reports_score_lower_than_recent_ones(client, app):
    citizen = register(client, CITIZEN_EMAIL)
    for latitude, longitude in spread_out(5):
        file_report(client, citizen, latitude, longitude)

    stale_ids = [file_report(client, citizen, 28.75, 77.35, severity="CRITICAL") for _ in range(4)]
    backdate(app, stale_ids, days=200)
    for _ in range(4):
        file_report(client, citizen, 28.60, 77.20, severity="CRITICAL")

    admin = make_admin(client, app)
    headers = auth_header(admin)
    client.post("/api/admin/risk-model/train", headers=headers)
    predictions = client.get("/api/admin/risk-predictions", headers=headers).get_json()[
        "predictions"
    ]

    fresh = next(p for p in predictions if abs(p["latitude"] - 28.60) < 0.01)
    stale = next(p for p in predictions if abs(p["latitude"] - 28.75) < 0.01)
    assert fresh["risk_score"] > stale["risk_score"]


def test_invalid_cell_degrees_is_rejected(client, app):
    admin = make_admin(client, app)
    headers = auth_header(admin)

    response = client.post("/api/admin/risk-model/train", json={"cell_degrees": 5}, headers=headers)
    assert response.status_code == 400
    assert response.get_json()["field"] == "cell_degrees"

    assert (
        client.get("/api/admin/risk-predictions?cell_degrees=abc", headers=headers).status_code
        == 400
    )


# --- Public-safe overlay --------------------------------------------------


def test_public_risk_areas_is_open_and_privacy_safe(client, app):
    empty = client.get("/api/reports/risk-areas")
    assert empty.status_code == 200
    assert empty.get_json()["areas"] == []

    citizen = register(client, CITIZEN_EMAIL, "Asha Citizen")
    seed_areas(client, citizen)
    admin = make_admin(client, app)
    client.post("/api/admin/risk-model/train", headers=auth_header(admin))

    response = client.get("/api/reports/risk-areas")
    assert response.status_code == 200
    body = response.get_json()
    assert body["count"] > 0
    assert CITIZEN_EMAIL not in response.get_data(as_text=True)
    assert set(body["areas"][0]) == {
        "latitude",
        "longitude",
        "risk_level",
        "risk_score",
        "prediction_date",
        "report_count",
    }
    assert body["disclaimer"].startswith("Prototype risk prediction")
