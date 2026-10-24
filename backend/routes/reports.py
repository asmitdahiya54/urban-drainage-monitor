"""Drainage report endpoints.

Security model (never trust the client):
- the reporter is always the JWT identity, never a `user_id` in the body;
- the initial status is always NEW, set by the server;
- citizens only ever see their own reports, admins see everything.
"""

import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import IssueType, Report, ReportStatus, ReportStatusHistory, Severity, UserRole
from ..services.duplicates import (
    RECENT_DAYS,
    SEARCH_RADIUS_M,
    find_possible_duplicates,
)
from ..services.risk import public_risk_areas
from ..services.spatial import public_map_reports, public_summary, report_hotspots
from ..utils.auth import current_user
from ..utils.report_validators import (
    validate_description,
    validate_issue_type,
    validate_latitude,
    validate_longitude,
    validate_severity,
)
from ..utils.validators import ValidationError

logger = logging.getLogger(__name__)

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _reporter(report: Report) -> dict | None:
    """Safe subset of the reporter's data — never the password hash."""
    if report.user is None:
        return None
    return {"id": report.user.id, "name": report.user.name, "email": report.user.email}


def serialize_history_entry(entry: ReportStatusHistory) -> dict:
    """History row plus the name of whoever made the change (never a hash)."""
    data = entry.to_dict()
    actor = entry.changed_by_user
    data["changed_by_name"] = actor.name if actor else None
    data["changed_by_role"] = actor.role.value if actor else None
    return data


def serialize_report(report: Report, *, include_history: bool = False) -> dict:
    data = report.to_dict()
    data["reporter"] = _reporter(report)
    if include_history:
        data["status_history"] = [serialize_history_entry(e) for e in report.status_history]
    return data


@reports_bp.post("")
@reports_bp.post("/")
@jwt_required()
def create_report():
    user = current_user()
    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A JSON body is required"}), 400

    try:
        issue_type: IssueType = validate_issue_type(payload.get("issue_type"))
        description = validate_description(payload.get("description"))
        severity: Severity = validate_severity(payload.get("severity"))
        latitude = validate_latitude(payload.get("latitude"))
        longitude = validate_longitude(payload.get("longitude"))
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    # Step 8 — duplicate detection. The report is never rejected or deleted:
    # the citizen is warned once and may confirm with `confirm_duplicate: true`.
    confirmed = payload.get("confirm_duplicate") is True
    if not confirmed:
        try:
            check = find_possible_duplicates(
                latitude=latitude, longitude=longitude, issue_type=issue_type, severity=severity
            )
        except SQLAlchemyError:
            db.session.rollback()
            logger.exception("Duplicate check failed; continuing with the report")
            check = None
        if check and check["duplicate"]:
            return (
                jsonify(
                    {
                        "error": check["message"],
                        "field": "duplicate",
                        "duplicate": True,
                        "matches": check["matches"],
                        "nearby": check["nearby"],
                        "params": check["params"],
                        "hint": "Resend with confirm_duplicate: true to submit anyway.",
                    }
                ),
                409,
            )

    report = Report(
        user_id=user.id,  # ownership comes from the JWT, never from the body
        issue_type=issue_type,
        description=description,
        severity=severity,
        status=ReportStatus.NEW,  # the server decides the initial status
    )
    # Builds POINT(longitude latitude) with SRID 4326.
    report.set_coordinates(latitude, longitude)

    try:
        db.session.add(report)
        db.session.flush()  # need report.id for the history row
        db.session.add(
            ReportStatusHistory(
                report_id=report.id,
                old_status=None,
                new_status=ReportStatus.NEW,
                changed_by=user.id,
                comment="Report submitted",
            )
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Failed to create report")
        return (
            jsonify({"error": "Could not save the report. Please try again."}),
            500,
        )

    return (
        jsonify(
            {
                "message": f"Drainage issue reported successfully. Your report ID is #{report.id}.",
                "report": serialize_report(report, include_history=True),
            }
        ),
        201,
    )


@reports_bp.post("/check-duplicate")
@jwt_required()
def check_duplicate():
    """Look for a likely duplicate before the citizen submits (Step 8).

    Signed-in only, read-only, and privacy-safe: the response contains report
    ids, classification, status, distance and dates — never reporter details.
    """
    user = current_user()
    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A JSON body is required"}), 400

    try:
        latitude = validate_latitude(payload.get("latitude"))
        longitude = validate_longitude(payload.get("longitude"))
        issue_type = validate_issue_type(payload.get("issue_type"))
        severity = (
            validate_severity(payload.get("severity")) if payload.get("severity") else None
        )
        radius_raw = payload.get("radius_m")
        radius_m = float(radius_raw) if radius_raw not in (None, "") else SEARCH_RADIUS_M
        if not 10 <= radius_m <= 1000:
            raise ValidationError("radius_m must be between 10 and 1000", "radius_m")
        days_raw = payload.get("days")
        days = int(days_raw) if days_raw not in (None, "") else RECENT_DAYS
        if not 1 <= days <= 365:
            raise ValidationError("days must be between 1 and 365", "days")
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "radius_m and days must be numbers", "field": "radius_m"}), 400

    try:
        result = find_possible_duplicates(
            latitude=latitude,
            longitude=longitude,
            issue_type=issue_type,
            severity=severity,
            radius_m=radius_m,
            days=days,
        )
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Duplicate check query failed")
        return jsonify({"error": "The duplicate check is temporarily unavailable."}), 503

    return jsonify(result), 200


@reports_bp.get("")
@reports_bp.get("/")
@jwt_required()
def list_reports():
    user = current_user()
    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    query = Report.query
    if user.role != UserRole.ADMIN:
        query = query.filter(Report.user_id == user.id)

    reports = query.order_by(Report.created_at.desc(), Report.id.desc()).all()
    return jsonify({"reports": [serialize_report(r) for r in reports], "count": len(reports)}), 200


# --- Public map endpoints (Step 6) ---------------------------------------
# These are intentionally open (no @jwt_required): the city map is public.
# They return locations and classifications only — never a reporter's name,
# email or user id — so no personal data can leak.

MAP_LIMIT_MAX = 2000


def _enum_list(raw: str | None, allowed: set[str]) -> list[str] | None:
    """Parse a comma-separated filter (`?severity=HIGH,CRITICAL`).

    Unknown values raise a 400 rather than being silently ignored.
    """
    if raw is None or raw.strip() == "" or raw.strip().upper() == "ALL":
        return None
    values = [part.strip().upper() for part in raw.split(",") if part.strip()]
    if not values:
        return None
    invalid = [v for v in values if v not in allowed]
    if invalid:
        raise ValidationError(
            f"Unsupported filter value: {', '.join(invalid)}",
            "filter",
        )
    return values


def _optional_int(raw: str | None, field: str, *, minimum: int, maximum: int) -> int | None:
    if raw is None or raw.strip() == "":
        return None
    try:
        value = int(float(raw))
    except (TypeError, ValueError):
        raise ValidationError(f"{field} must be a number", field) from None
    if not minimum <= value <= maximum:
        raise ValidationError(f"{field} must be between {minimum} and {maximum}", field)
    return value


def _map_filters() -> dict:
    args = request.args
    return {
        "issue_types": _enum_list(args.get("issue_type"), {m.value for m in IssueType}),
        "severities": _enum_list(args.get("severity"), {m.value for m in Severity}),
        "statuses": _enum_list(args.get("status"), {m.value for m in ReportStatus}),
        "days": _optional_int(args.get("days"), "days", minimum=1, maximum=3650),
    }


@reports_bp.get("/map")
def map_reports():
    """Privacy-safe report points + severity weights for the public map."""
    try:
        filters = _map_filters()
        limit = _optional_int(request.args.get("limit"), "limit", minimum=1, maximum=MAP_LIMIT_MAX)
        lat = request.args.get("lat")
        lon = request.args.get("lon")
        radius_m = _optional_int(
            request.args.get("radius_m"), "radius_m", minimum=50, maximum=200_000
        )
        center: tuple[float, float] | None = None
        if lat is not None and lon is not None and lat != "" and lon != "":
            center = (validate_latitude(lat), validate_longitude(lon))
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    try:
        points = public_map_reports(
            limit=limit or 1000,
            center=center,
            radius_m=float(radius_m) if radius_m else None,
            **filters,
        )
        summary = public_summary(**filters)
    except SQLAlchemyError:
        logger.exception("Public map query failed")
        return jsonify({"error": "The map data is temporarily unavailable."}), 503

    return (
        jsonify(
            {
                "reports": points,
                "count": len(points),
                "summary": summary,
            }
        ),
        200,
    )


@reports_bp.get("/hotspots")
def map_hotspots():
    """PostGIS density clusters (ST_ClusterDBSCAN) of nearby reports."""
    try:
        filters = _map_filters()
        radius_m = _optional_int(
            request.args.get("radius_m"), "radius_m", minimum=50, maximum=20_000
        )
        min_points = _optional_int(
            request.args.get("min_points"), "min_points", minimum=2, maximum=50
        )
        limit = _optional_int(request.args.get("limit"), "limit", minimum=1, maximum=100)
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    try:
        hotspots = report_hotspots(
            radius_m=float(radius_m or 400),
            min_points=min_points or 2,
            limit=limit or 25,
            **filters,
        )
    except SQLAlchemyError:
        logger.exception("Hotspot analysis failed")
        return jsonify({"error": "The hotspot analysis is temporarily unavailable."}), 503

    return (
        jsonify(
            {
                "hotspots": hotspots,
                "count": len(hotspots),
                "params": {
                    "radius_m": float(radius_m or 400),
                    "min_points": min_points or 2,
                },
            }
        ),
        200,
    )


@reports_bp.get("/risk-areas")
def map_risk_areas():
    """Public-safe prototype risk areas for the map.

    Coordinates, risk level, score, date and a report count only — no citizen
    identity ever leaves this endpoint. Empty until an admin trains the model.
    """
    try:
        limit = _optional_int(request.args.get("limit"), "limit", minimum=1, maximum=200)
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    try:
        data = public_risk_areas(limit=limit or 100)
    except SQLAlchemyError:
        logger.exception("Public risk areas failed")
        return jsonify({"error": "The risk overlay is temporarily unavailable."}), 503

    return jsonify(data), 200


@reports_bp.get("/<int:report_id>")
@jwt_required()
def get_report(report_id: int):
    user = current_user()
    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    report = db.session.get(Report, report_id)
    if report is None:
        return jsonify({"error": "Report not found"}), 404
    if user.role != UserRole.ADMIN and report.user_id != user.id:
        return jsonify({"error": "You can only view your own reports"}), 403

    return jsonify({"report": serialize_report(report, include_history=True)}), 200
