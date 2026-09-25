"""Server-side validation for drainage report input.

The React form mirrors these rules for a better experience, but the backend
never trusts the client: issue type, severity, description and coordinates are
all re-validated here, and ownership/status are set by the API itself.
"""

from ..models.enums import IssueType, Severity
from .validators import ValidationError

DESCRIPTION_MIN, DESCRIPTION_MAX = 10, 2000

LATITUDE_MIN, LATITUDE_MAX = -90.0, 90.0
LONGITUDE_MIN, LONGITUDE_MAX = -180.0, 180.0


def validate_issue_type(raw: object) -> IssueType:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError("Issue type is required", "issue_type")
    try:
        return IssueType(raw.strip().upper())
    except ValueError:
        allowed = ", ".join(member.value for member in IssueType)
        raise ValidationError(f"Issue type must be one of: {allowed}", "issue_type") from None


def validate_severity(raw: object) -> Severity:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError("Severity is required", "severity")
    try:
        return Severity(raw.strip().upper())
    except ValueError:
        allowed = ", ".join(member.value for member in Severity)
        raise ValidationError(f"Severity must be one of: {allowed}", "severity") from None


def validate_description(raw: object) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError("Description is required", "description")
    description = raw.strip()
    if len(description) < DESCRIPTION_MIN:
        raise ValidationError(
            f"Description must be at least {DESCRIPTION_MIN} characters", "description"
        )
    if len(description) > DESCRIPTION_MAX:
        raise ValidationError(
            f"Description must be at most {DESCRIPTION_MAX} characters", "description"
        )
    return description


def _coerce_float(raw: object, field: str, label: str) -> float:
    if isinstance(raw, bool) or raw is None or raw == "":
        raise ValidationError(f"{label} is required", field)
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValidationError(f"{label} must be a number", field) from None
    if value != value or value in (float("inf"), float("-inf")):  # NaN / infinity
        raise ValidationError(f"{label} must be a number", field)
    return value


def validate_latitude(raw: object) -> float:
    value = _coerce_float(raw, "latitude", "Latitude")
    if not LATITUDE_MIN <= value <= LATITUDE_MAX:
        raise ValidationError("Latitude must be between -90 and 90", "latitude")
    return value


def validate_longitude(raw: object) -> float:
    value = _coerce_float(raw, "longitude", "Longitude")
    if not LONGITUDE_MIN <= value <= LONGITUDE_MAX:
        raise ValidationError("Longitude must be between -180 and 180", "longitude")
    return value
