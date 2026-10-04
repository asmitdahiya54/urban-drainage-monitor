"""External civic / environmental data integration (Step 10).

Design notes
------------
This module is an *integration layer*, not a data source. It defines a small
provider interface so a real government/municipal API can be plugged in later
without touching the routes or the frontend.

Honest labelling is a hard requirement:

* No official government API is used by this project today. There is no
  verified, publicly accessible civic dataset wired in, so the default
  provider returns clearly labelled **demo/mock** data:
  "Demo/Mock Civic Data — Not Official Government Data".
* Every record carries `is_mock`, the provider `source` and a `retrieved_at`
  timestamp, so the frontend can never present demo values as official.
* `HttpCivicDataProvider` is a generic, unconfigured adapter. It only becomes
  active when the operator sets `CIVIC_API_BASE_URL` (and optionally
  `CIVIC_API_KEY`) for a source they actually have access to. Nothing here
  invents or hard-codes a government endpoint.

Security: API keys are read from the environment inside the provider, are sent
only as a request header, and are never returned by the service or logged.
No citizen data is read or written by this module at all.
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

MOCK_LABEL = "Demo/Mock Civic Data — Not Official Government Data"

# Only these data types are supported. Each one is implemented by the mock
# provider; a real provider may support a subset.
DATA_TYPES = (
    "RAINFALL",
    "DRAINAGE_INFRASTRUCTURE",
    "FLOOD_INCIDENT",
    "MUNICIPAL_SERVICE",
)

# Default area used by the demo provider (Bengaluru city centre) — the same
# region as the seeded demo reports, so the two line up on the map.
DEFAULT_LATITUDE = 12.9716
DEFAULT_LONGITUDE = 77.5946

CACHE_TTL_SECONDS = int(os.environ.get("CIVIC_CACHE_TTL_SECONDS", 300))
REQUEST_TIMEOUT_SECONDS = float(os.environ.get("CIVIC_API_TIMEOUT_SECONDS", 8))


# --- Errors ---------------------------------------------------------------
class CivicDataError(Exception):
    """Base class for integration failures. `reason` is a stable machine code."""

    reason = "unavailable"
    http_status = 503

    def __init__(self, message: str, reason: str | None = None):
        super().__init__(message)
        self.message = message
        if reason:
            self.reason = reason


class CivicDataUnavailable(CivicDataError):
    reason = "external_api_unavailable"


class CivicDataTimeout(CivicDataError):
    reason = "timeout"


class CivicDataInvalidResponse(CivicDataError):
    reason = "invalid_response"


class CivicDataRateLimited(CivicDataError):
    reason = "rate_limited"
    http_status = 429


class CivicDataUnsupported(CivicDataError):
    """The configured provider does not offer the requested data type."""

    reason = "unsupported_data_type"
    http_status = 400


# --- Provider interface ---------------------------------------------------
@dataclass
class CivicRecord:
    """One civic/environmental observation, safe to send to the browser."""

    data_type: str
    title: str
    location: dict
    observed_at: str | None
    values: dict
    source: str
    source_url: str | None = None
    is_mock: bool = True
    notes: str | None = None

    def to_dict(self) -> dict:
        return {
            "data_type": self.data_type,
            "title": self.title,
            "location": self.location,
            "observed_at": self.observed_at,
            "values": self.values,
            "source": self.source,
            "source_url": self.source_url,
            "is_mock": self.is_mock,
            "notes": self.notes,
        }


class CivicDataProvider(ABC):
    """Interface every civic data source must implement."""

    #: Human-readable source name shown in the UI.
    name: str = "unknown"
    #: True when the data is demo/sample data rather than a real source.
    is_mock: bool = True
    #: Documentation/attribution URL for the source, if any.
    source_url: str | None = None
    #: Data types this provider can serve.
    supported_types: tuple[str, ...] = ()

    @abstractmethod
    def fetch(self, data_type: str, latitude: float, longitude: float) -> list[CivicRecord]:
        """Return records for one data type, or raise a CivicDataError."""

    def describe(self) -> dict:
        return {
            "provider": self.__class__.__name__,
            "source": self.name,
            "source_url": self.source_url,
            "is_mock": self.is_mock,
            "supported_types": list(self.supported_types),
        }


# --- Mock provider (default) ---------------------------------------------
@dataclass
class MockCivicDataProvider(CivicDataProvider):
    """Deterministic, clearly labelled sample data.

    The numbers are illustrative placeholders shaped like the data a municipal
    API would return. They are NOT measurements and must never be presented as
    official information.
    """

    name: str = "Demo/Mock Civic Data (local sample data)"
    is_mock: bool = True
    source_url: str | None = None
    supported_types: tuple[str, ...] = field(default=DATA_TYPES)

    def fetch(self, data_type: str, latitude: float, longitude: float) -> list[CivicRecord]:
        if data_type not in self.supported_types:
            raise CivicDataUnsupported(f"{data_type} is not available from the demo provider")

        now = datetime.now(timezone.utc).replace(microsecond=0)

        def record(title: str, values: dict, offset_hours: int, dlat=0.0, dlon=0.0, notes=None):
            return CivicRecord(
                data_type=data_type,
                title=title,
                location={
                    "latitude": round(latitude + dlat, 6),
                    "longitude": round(longitude + dlon, 6),
                    "area_name": "Demo ward (sample area)",
                },
                observed_at=(now - timedelta(hours=offset_hours)).isoformat(),
                values=values,
                source=self.name,
                source_url=self.source_url,
                is_mock=True,
                notes=notes or MOCK_LABEL,
            )

        if data_type == "RAINFALL":
            return [
                record(
                    "Rainfall observation (sample)",
                    {
                        "rainfall_mm_last_1h": 4.2,
                        "rainfall_mm_last_24h": 38.6,
                        "intensity": "MODERATE",
                        "station_id": "DEMO-RAIN-01",
                    },
                    1,
                ),
                record(
                    "Rainfall observation (sample)",
                    {
                        "rainfall_mm_last_1h": 0.0,
                        "rainfall_mm_last_24h": 12.1,
                        "intensity": "LIGHT",
                        "station_id": "DEMO-RAIN-02",
                    },
                    5,
                    dlat=0.012,
                    dlon=-0.008,
                ),
            ]

        if data_type == "DRAINAGE_INFRASTRUCTURE":
            return [
                record(
                    "Storm water drain segment (sample)",
                    {
                        "asset_id": "DEMO-DRN-118",
                        "asset_type": "STORM_DRAIN",
                        "diameter_mm": 900,
                        "condition": "FAIR",
                        "last_cleaned": (now - timedelta(days=46)).date().isoformat(),
                    },
                    24,
                    dlat=0.004,
                    dlon=0.005,
                ),
                record(
                    "Pumping station (sample)",
                    {
                        "asset_id": "DEMO-PMP-004",
                        "asset_type": "PUMP_STATION",
                        "capacity_lps": 320,
                        "condition": "GOOD",
                        "last_cleaned": (now - timedelta(days=9)).date().isoformat(),
                    },
                    30,
                    dlat=-0.009,
                    dlon=0.011,
                ),
            ]

        if data_type == "FLOOD_INCIDENT":
            return [
                record(
                    "Recorded waterlogging incident (sample)",
                    {
                        "incident_id": "DEMO-FLD-2024-017",
                        "max_water_depth_cm": 35,
                        "duration_hours": 6,
                        "cause": "BLOCKED_DRAIN",
                    },
                    72,
                    dlat=0.006,
                    dlon=0.002,
                ),
            ]

        return [
            record(
                "Municipal service information (sample)",
                {
                    "service": "Storm water complaints helpline",
                    "department": "Demo Municipal Corporation (sample)",
                    "contact": "not-a-real-number",
                    "response_target_hours": 48,
                },
                12,
            ),
        ]


# --- Generic real-API adapter (inactive until configured) ----------------
class HttpCivicDataProvider(CivicDataProvider):
    """Adapter for a real JSON civic API the operator has access to.

    Configuration comes from the environment only:

    * ``CIVIC_API_BASE_URL`` — base URL of the source (required to activate)
    * ``CIVIC_API_KEY``      — optional key, sent as a request header
    * ``CIVIC_API_KEY_HEADER`` — header name for the key (default ``X-API-Key``)
    * ``CIVIC_API_SOURCE_NAME`` — attribution shown in the UI

    The response is expected as ``{"records": [...]}`` or a bare JSON list,
    with each item mapped through :meth:`_map_record`. Adjust that one method
    for the real payload shape; nothing else needs to change.
    """

    is_mock = False

    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        key_header: str = "X-API-Key",
        source_name: str | None = None,
        source_url: str | None = None,
        timeout: float = REQUEST_TIMEOUT_SECONDS,
        supported_types: tuple[str, ...] = DATA_TYPES,
    ):
        self.base_url = base_url.rstrip("/")
        self._api_key = api_key  # never exposed by describe()/responses
        self._key_header = key_header
        self.name = source_name or f"External civic API ({urllib.parse.urlparse(base_url).netloc})"
        self.source_url = source_url
        self.timeout = timeout
        self.supported_types = supported_types

    # -- helpers ----------------------------------------------------------
    def _map_record(self, raw: dict, data_type: str) -> CivicRecord:
        if not isinstance(raw, dict):
            raise CivicDataInvalidResponse("Each record must be a JSON object")
        location = raw.get("location") if isinstance(raw.get("location"), dict) else {}
        return CivicRecord(
            data_type=data_type,
            title=str(raw.get("title") or data_type.replace("_", " ").title()),
            location={
                "latitude": location.get("latitude", raw.get("latitude")),
                "longitude": location.get("longitude", raw.get("longitude")),
                "area_name": location.get("area_name", raw.get("area_name")),
            },
            observed_at=raw.get("observed_at") or raw.get("timestamp"),
            values=raw.get("values") if isinstance(raw.get("values"), dict) else {},
            source=self.name,
            source_url=self.source_url,
            is_mock=False,
            notes=None,
        )

    def fetch(self, data_type: str, latitude: float, longitude: float) -> list[CivicRecord]:
        if data_type not in self.supported_types:
            raise CivicDataUnsupported(f"{data_type} is not available from {self.name}")

        query = urllib.parse.urlencode(
            {"data_type": data_type, "latitude": latitude, "longitude": longitude}
        )
        url = f"{self.base_url}/{data_type.lower()}?{query}"
        headers = {"Accept": "application/json"}
        if self._api_key:
            headers[self._key_header] = self._api_key

        request = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise CivicDataRateLimited(
                    "The civic data source is rate limiting requests. Try again later."
                ) from None
            logger.warning("Civic API returned HTTP %s", exc.code)
            raise CivicDataUnavailable(
                f"The civic data source returned an error (HTTP {exc.code})."
            ) from None
        except TimeoutError:
            raise CivicDataTimeout("The civic data source did not respond in time.") from None
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, TimeoutError) or "timed out" in str(exc.reason).lower():
                raise CivicDataTimeout("The civic data source did not respond in time.") from None
            logger.warning("Civic API unreachable: %s", type(exc).__name__)
            raise CivicDataUnavailable("The civic data source is unreachable.") from None
        except OSError:
            raise CivicDataUnavailable("The civic data source is unreachable.") from None

        try:
            payload = json.loads(body)
        except ValueError:
            raise CivicDataInvalidResponse(
                "The civic data source returned a response that is not valid JSON."
            ) from None

        if isinstance(payload, dict):
            raw_records = payload.get("records")
        else:
            raw_records = payload
        if not isinstance(raw_records, list):
            raise CivicDataInvalidResponse(
                "The civic data source returned an unexpected response shape."
            )

        return [self._map_record(item, data_type) for item in raw_records]


# --- Provider selection + cache ------------------------------------------
def build_provider() -> CivicDataProvider:
    """Return the configured provider — the demo provider unless a real API is set."""
    base_url = os.environ.get("CIVIC_API_BASE_URL", "").strip()
    if base_url:
        return HttpCivicDataProvider(
            base_url=base_url,
            api_key=os.environ.get("CIVIC_API_KEY") or None,
            key_header=os.environ.get("CIVIC_API_KEY_HEADER", "X-API-Key"),
            source_name=os.environ.get("CIVIC_API_SOURCE_NAME") or None,
            source_url=os.environ.get("CIVIC_API_SOURCE_URL") or None,
        )
    return MockCivicDataProvider()


_cache: dict[tuple, tuple[float, list[dict]]] = {}


def clear_cache() -> None:
    _cache.clear()


def get_civic_data(
    data_types: list[str] | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    *,
    provider: CivicDataProvider | None = None,
    use_cache: bool = True,
) -> dict:
    """Collect civic records for the requested data types.

    Never raises for a single failing data type: the failure is reported per
    type in `errors` so a partial answer still reaches the dashboard.
    """
    provider = provider or build_provider()
    requested = [t.upper() for t in (data_types or list(DATA_TYPES))]
    unknown = [t for t in requested if t not in DATA_TYPES]
    if unknown:
        raise CivicDataUnsupported(f"Unsupported data type: {', '.join(unknown)}")

    lat = DEFAULT_LATITUDE if latitude is None else latitude
    lon = DEFAULT_LONGITUDE if longitude is None else longitude

    records: list[dict] = []
    errors: list[dict] = []
    cached_types: list[str] = []
    now = time.time()

    for data_type in requested:
        key = (provider.__class__.__name__, provider.name, data_type, round(lat, 4), round(lon, 4))
        if use_cache and key in _cache:
            stored_at, cached = _cache[key]
            if now - stored_at < CACHE_TTL_SECONDS:
                records.extend(cached)
                cached_types.append(data_type)
                continue

        try:
            fetched = [r.to_dict() for r in provider.fetch(data_type, lat, lon)]
        except CivicDataError as exc:
            errors.append({"data_type": data_type, "reason": exc.reason, "message": exc.message})
            continue
        except Exception:  # pragma: no cover — provider bug, never leak details
            logger.exception("Civic provider raised an unexpected error")
            errors.append(
                {
                    "data_type": data_type,
                    "reason": "unavailable",
                    "message": "The civic data source could not be read.",
                }
            )
            continue

        if use_cache:
            _cache[key] = (now, fetched)
        records.extend(fetched)

    is_mock = provider.is_mock
    return {
        "records": records,
        "count": len(records),
        "source": provider.name,
        "source_url": provider.source_url,
        "is_mock": is_mock,
        "label": MOCK_LABEL if is_mock else provider.name,
        "provider": provider.describe(),
        "requested_types": requested,
        "available_types": list(DATA_TYPES),
        "cached_types": cached_types,
        "location": {"latitude": lat, "longitude": lon},
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "errors": errors,
        "disclaimer": (
            MOCK_LABEL
            + ". Sample values only, shaped like a municipal dataset for development."
            if is_mock
            else f"Data supplied by {provider.name}."
        ),
    }
