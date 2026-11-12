"""Step 10 — civic / environmental data integration tests.

Covers the endpoint, the provider interface, the mock provider, error handling
(unavailable / timeout / invalid response / rate limited / missing data),
authorization and privacy.
"""

import json
import urllib.error

import pytest

from backend.services import civic
from backend.services.civic import (
    DATA_TYPES,
    MOCK_LABEL,
    CivicDataProvider,
    CivicDataInvalidResponse,
    CivicDataRateLimited,
    CivicDataTimeout,
    CivicDataUnavailable,
    CivicRecord,
    HttpCivicDataProvider,
    MockCivicDataProvider,
    build_provider,
    get_civic_data,
)

from .conftest import auth_header
from .test_reports import register


@pytest.fixture(autouse=True)
def _clear_cache():
    civic.clear_cache()
    yield
    civic.clear_cache()


def citizen_token(client) -> str:
    return register(client, email="civic.citizen@example.com")


# --- provider / service logic --------------------------------------------
def test_default_provider_is_mock(monkeypatch):
    monkeypatch.delenv("CIVIC_API_BASE_URL", raising=False)
    provider = build_provider()
    assert isinstance(provider, MockCivicDataProvider)
    assert provider.is_mock is True


def test_real_provider_used_when_configured(monkeypatch):
    monkeypatch.setenv("CIVIC_API_BASE_URL", "https://example.invalid/civic")
    provider = build_provider()
    assert isinstance(provider, HttpCivicDataProvider)
    assert provider.is_mock is False
    # The key must never be exposed by the description.
    monkeypatch.setenv("CIVIC_API_KEY", "super-secret-key")
    assert "super-secret-key" not in json.dumps(build_provider().describe())


def test_mock_provider_covers_every_data_type():
    provider = MockCivicDataProvider()
    for data_type in DATA_TYPES:
        records = provider.fetch(data_type, 12.97, 77.59)
        assert records, data_type
        for record in records:
            assert isinstance(record, CivicRecord)
            assert record.is_mock is True
            assert record.notes == MOCK_LABEL
            assert record.observed_at


def test_service_marks_mock_data_and_caches():
    first = get_civic_data(["RAINFALL"], provider=MockCivicDataProvider())
    assert first["is_mock"] is True
    assert first["label"] == MOCK_LABEL
    assert first["cached_types"] == []
    second = get_civic_data(["RAINFALL"], provider=MockCivicDataProvider())
    assert second["cached_types"] == ["RAINFALL"]


def test_service_reports_unsupported_data_type():
    from backend.services.civic import CivicDataUnsupported

    with pytest.raises(CivicDataUnsupported):
        get_civic_data(["NUCLEAR_LAUNCH_CODES"], provider=MockCivicDataProvider())


class _FailingProvider(CivicDataProvider):
    name = "Failing test source"
    is_mock = False
    supported_types = DATA_TYPES

    def __init__(self, error):
        self.error = error

    def fetch(self, data_type, latitude, longitude):
        raise self.error


@pytest.mark.parametrize(
    "error,reason",
    [
        (CivicDataUnavailable("down"), "external_api_unavailable"),
        (CivicDataTimeout("slow"), "timeout"),
        (CivicDataInvalidResponse("garbage"), "invalid_response"),
        (CivicDataRateLimited("too many"), "rate_limited"),
    ],
)
def test_service_records_provider_failures(error, reason):
    data = get_civic_data(["RAINFALL"], provider=_FailingProvider(error), use_cache=False)
    assert data["records"] == []
    assert data["errors"][0]["reason"] == reason


class _EmptyProvider(CivicDataProvider):
    name = "Empty test source"
    is_mock = False
    supported_types = DATA_TYPES

    def fetch(self, data_type, latitude, longitude):
        return []


def test_service_handles_missing_data():
    data = get_civic_data(["FLOOD_INCIDENT"], provider=_EmptyProvider(), use_cache=False)
    assert data["records"] == []
    assert data["errors"] == []
    assert data["count"] == 0


# --- HTTP adapter error handling -----------------------------------------
def _http_provider():
    return HttpCivicDataProvider(base_url="https://example.invalid/civic", timeout=0.1)


def test_http_provider_timeout(monkeypatch):
    def boom(*args, **kwargs):
        raise TimeoutError("timed out")

    monkeypatch.setattr(civic.urllib.request, "urlopen", boom)
    with pytest.raises(CivicDataTimeout):
        _http_provider().fetch("RAINFALL", 1.0, 2.0)


def test_http_provider_unreachable(monkeypatch):
    def boom(*args, **kwargs):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(civic.urllib.request, "urlopen", boom)
    with pytest.raises(CivicDataUnavailable):
        _http_provider().fetch("RAINFALL", 1.0, 2.0)


def test_http_provider_rate_limited(monkeypatch):
    def boom(*args, **kwargs):
        raise urllib.error.HTTPError("url", 429, "Too Many Requests", {}, None)

    monkeypatch.setattr(civic.urllib.request, "urlopen", boom)
    with pytest.raises(CivicDataRateLimited):
        _http_provider().fetch("RAINFALL", 1.0, 2.0)


class _FakeResponse:
    def __init__(self, body: str):
        self._body = body.encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_http_provider_invalid_json(monkeypatch):
    monkeypatch.setattr(
        civic.urllib.request, "urlopen", lambda *a, **k: _FakeResponse("<html>nope</html>")
    )
    with pytest.raises(CivicDataInvalidResponse):
        _http_provider().fetch("RAINFALL", 1.0, 2.0)


def test_http_provider_unexpected_shape(monkeypatch):
    monkeypatch.setattr(
        civic.urllib.request, "urlopen", lambda *a, **k: _FakeResponse('{"data": {}}')
    )
    with pytest.raises(CivicDataInvalidResponse):
        _http_provider().fetch("RAINFALL", 1.0, 2.0)


def test_http_provider_maps_records(monkeypatch):
    body = json.dumps(
        {
            "records": [
                {
                    "title": "Gauge 12",
                    "location": {"latitude": 12.9, "longitude": 77.6, "area_name": "Ward 12"},
                    "observed_at": "2026-01-01T00:00:00+00:00",
                    "values": {"rainfall_mm_last_1h": 3.0},
                }
            ]
        }
    )
    monkeypatch.setattr(civic.urllib.request, "urlopen", lambda *a, **k: _FakeResponse(body))
    records = _http_provider().fetch("RAINFALL", 1.0, 2.0)
    assert len(records) == 1
    assert records[0].is_mock is False
    assert records[0].values["rainfall_mm_last_1h"] == 3.0


# --- endpoint -------------------------------------------------------------
def test_civic_endpoint_requires_authentication(client):
    response = client.get("/api/civic-data")
    assert response.status_code == 401


def test_civic_endpoint_returns_labelled_mock_data(client, monkeypatch):
    monkeypatch.delenv("CIVIC_API_BASE_URL", raising=False)
    token = citizen_token(client)
    response = client.get("/api/civic-data", headers=auth_header(token))
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["is_mock"] is True
    assert payload["label"] == MOCK_LABEL
    assert payload["count"] > 0
    assert set(payload["available_types"]) == set(DATA_TYPES)
    for record in payload["records"]:
        assert record["source"]
        assert record["observed_at"]
        assert record["data_type"] in DATA_TYPES


def test_civic_endpoint_filters_by_data_type(client):
    token = citizen_token(client)
    response = client.get("/api/civic-data?data_type=RAINFALL", headers=auth_header(token))
    assert response.status_code == 200
    types = {r["data_type"] for r in response.get_json()["records"]}
    assert types == {"RAINFALL"}


def test_civic_endpoint_rejects_unknown_data_type(client):
    token = citizen_token(client)
    response = client.get("/api/civic-data?data_type=SECRET", headers=auth_header(token))
    assert response.status_code == 400
    assert "reason" in response.get_json()


def test_civic_endpoint_rejects_invalid_coordinates(client):
    token = citizen_token(client)
    response = client.get("/api/civic-data?latitude=999&longitude=0", headers=auth_header(token))
    assert response.status_code == 400


def test_civic_endpoint_reports_total_failure_as_503(client, monkeypatch):
    monkeypatch.setattr(
        civic, "build_provider", lambda: _FailingProvider(CivicDataTimeout("slow"))
    )
    token = citizen_token(client)
    response = client.get("/api/civic-data?refresh=1", headers=auth_header(token))
    assert response.status_code == 503
    assert response.get_json()["reason"] == "timeout"


def test_civic_endpoint_exposes_no_secrets_or_citizen_data(client, monkeypatch):
    monkeypatch.setenv("CIVIC_API_KEY", "super-secret-key")
    token = citizen_token(client)
    body = client.get("/api/civic-data", headers=auth_header(token)).get_data(as_text=True)
    assert "super-secret-key" not in body
    assert "civic.citizen@example.com" not in body
    assert "password" not in body.lower()


def test_provider_endpoint_describes_source_without_key(client, monkeypatch):
    monkeypatch.setenv("CIVIC_API_KEY", "super-secret-key")
    token = citizen_token(client)
    response = client.get("/api/civic-data/provider", headers=auth_header(token))
    assert response.status_code == 200
    payload = response.get_json()
    assert "super-secret-key" not in json.dumps(payload)
    assert payload["provider"]["is_mock"] in (True, False)
