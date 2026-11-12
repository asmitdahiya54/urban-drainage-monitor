"""Admin-only endpoints (Step 5: report management).

Every route here is wrapped in `@admin_required`, so the backend itself
enforces authorization: 401 unauthenticated, 403 for citizens, 200 for admins.
Frontend route guards are convenience only.
"""

import logging

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models import IssueType, Report, ReportStatus, Severity, User, UserRole
from ..services.analytics import dashboard_analytics
from ..services.risk import CELL_DEGREES, latest_predictions, train_and_store
from ..services.report_status import (
    allowed_next_statuses,
    apply_status_change,
    validate_comment,
    validate_status,
)
from ..utils.auth import admin_required, current_user
from ..utils.validators import ValidationError
from .reports import serialize_report

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

MAX_PER_PAGE = 100
MAX_SEARCH_LENGTH = 120


def _positive_int(raw: str | None, default: int, maximum: int | None = None) -> int:
    try:
        value = int(raw) if raw is not None and raw != "" else default
    except (TypeError, ValueError):
        value = default
    value = max(1, value)
    if maximum is not None:
        value = min(value, maximum)
    return value


def _status_counts() -> dict[str, int]:
    """Live per-status counts straight from the database."""
    rows = db.session.query(Report.status, db.func.count(Report.id)).group_by(Report.status).all()
    counts = {status.value: 0 for status in ReportStatus}
    for status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        counts[key] = count
    return counts


@admin_bp.get("/stats")
@admin_required
def stats():
    """Aggregate summary used by the admin dashboard cards."""
    counts = _status_counts()
    return jsonify(
        {
            "users": User.query.count(),
            "citizens": User.query.filter_by(role=UserRole.CITIZEN).count(),
            "admins": User.query.filter_by(role=UserRole.ADMIN).count(),
            "reports": Report.query.count(),
            "by_status": counts,
        }
    )


@admin_bp.get("/analytics")
@admin_required
def analytics():
    """Aggregated analytics for the admin dashboard (Step 7).

    All counting happens in PostgreSQL (plus one PostGIS query for the
    geographic spread); the response is a few dozen numbers, never a list of
    reports for the browser to aggregate.
    """
    days = _positive_int(request.args.get("days"), 30, 365)
    months = _positive_int(request.args.get("months"), 6, 36)

    try:
        data = dashboard_analytics(days=days, months=months, recent_days=days)
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Analytics query failed")
        return jsonify({"error": "The analytics are temporarily unavailable."}), 503

    return jsonify(data), 200


# --- ML prototype: drainage-risk prediction (Step 9) ---------------------
# Admin-only. The model is an explainable baseline trained on aggregated
# report data with a documented proxy target — never an official warning.


def _cell_degrees() -> float:
    raw = request.args.get("cell_degrees") or (
        (request.get_json(silent=True) or {}).get("cell_degrees")
        if request.method == "POST"
        else None
    )
    try:
        value = float(raw) if raw not in (None, "") else CELL_DEGREES
    except (TypeError, ValueError) as exc:
        raise ValidationError("cell_degrees must be a number", "cell_degrees") from exc
    if not 0.001 <= value <= 0.05:
        raise ValidationError("cell_degrees must be between 0.001 and 0.05", "cell_degrees")
    return value


@admin_bp.post("/risk-model/train")
@admin_required
def train_risk_model():
    """Train/retrain the baseline prototype and store its predictions."""
    try:
        cell_degrees = _cell_degrees()
        days = _positive_int(
            (request.get_json(silent=True) or {}).get("days")
            or request.args.get("days"),
            30,
            365,
        )
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    try:
        result = train_and_store(cell_degrees=cell_degrees, days=days)
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Risk model training failed")
        return jsonify({"error": "The risk model is temporarily unavailable."}), 503

    # Insufficient data is a normal, explained outcome the UI renders, not an
    # error — so it returns 200 with `trained: false` and a reason.
    return jsonify(result), 200


@admin_bp.get("/risk-predictions")
@admin_required
def risk_predictions():
    """Latest stored prototype predictions with their supporting indicators."""
    try:
        cell_degrees = _cell_degrees()
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    try:
        data = latest_predictions(cell_degrees=cell_degrees)
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Risk prediction read failed")
        return jsonify({"error": "The risk predictions are temporarily unavailable."}), 503

    return jsonify(data), 200


@admin_bp.get("/reports")
@admin_required
def list_all_reports():
    """Every report, filtered and paginated in SQL (never in the browser)."""
    query = Report.query

    filters: dict[str, str] = {}
    try:
        if raw := (request.args.get("status") or "").strip():
            if raw.upper() != "ALL":
                status = validate_status(raw)
                query = query.filter(Report.status == status)
                filters["status"] = status.value
        if raw := (request.args.get("severity") or "").strip():
            if raw.upper() != "ALL":
                try:
                    severity = Severity(raw.upper())
                except ValueError as exc:
                    allowed = ", ".join(s.value for s in Severity)
                    raise ValidationError(
                        f"Severity must be one of: {allowed}", "severity"
                    ) from exc
                query = query.filter(Report.severity == severity)
                filters["severity"] = severity.value
        if raw := (request.args.get("issue_type") or "").strip():
            if raw.upper() != "ALL":
                try:
                    issue_type = IssueType(raw.upper())
                except ValueError as exc:
                    allowed = ", ".join(i.value for i in IssueType)
                    raise ValidationError(
                        f"Issue type must be one of: {allowed}", "issue_type"
                    ) from exc
                query = query.filter(Report.issue_type == issue_type)
                filters["issue_type"] = issue_type.value
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    # Free-text search over the description and the reporter's name/email.
    # Bound the length and neutralise LIKE wildcards so a crafted term cannot
    # turn into an expensive scan pattern (values are still bound parameters).
    if search := (request.args.get("search") or "").strip()[:MAX_SEARCH_LENGTH]:
        escaped = (
            search.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        pattern = f"%{escaped}%"
        query = query.outerjoin(User, Report.user_id == User.id).filter(
            db.or_(
                db.func.lower(Report.description).like(pattern, escape="\\"),
                db.func.lower(User.name).like(pattern, escape="\\"),
                db.func.lower(User.email).like(pattern, escape="\\"),
            )
        )
        filters["search"] = search

    page = _positive_int(request.args.get("page"), 1)
    per_page = _positive_int(request.args.get("per_page"), 20, MAX_PER_PAGE)

    pagination = query.order_by(Report.created_at.desc(), Report.id.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return (
        jsonify(
            {
                "reports": [serialize_report(r) for r in pagination.items],
                "page": pagination.page,
                "per_page": pagination.per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
                "filters": filters,
            }
        ),
        200,
    )


@admin_bp.get("/reports/<int:report_id>")
@admin_required
def get_any_report(report_id: int):
    """Admins can open any report, with its full status history."""
    report = db.session.get(Report, report_id)
    if report is None:
        return jsonify({"error": "Report not found"}), 404

    data = serialize_report(report, include_history=True)
    data["allowed_next_statuses"] = allowed_next_statuses(report.status)
    return jsonify({"report": data}), 200


@admin_bp.put("/reports/<int:report_id>/status")
@admin_required
def update_report_status(report_id: int):
    """Change a report's status and append one audit-trail row."""
    admin = current_user()
    if admin is None:
        return jsonify({"error": "Authentication required"}), 401

    report = db.session.get(Report, report_id)
    if report is None:
        return jsonify({"error": "Report not found"}), 404

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A JSON body is required"}), 400

    try:
        new_status = validate_status(payload.get("status"))
        comment = validate_comment(payload.get("comment"))
        changed = apply_status_change(report, new_status, admin, comment)
    except ValidationError as exc:
        db.session.rollback()
        return jsonify({"error": exc.message, "field": exc.field}), 400

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Failed to update report status")
        return jsonify({"error": "Could not update the status. Please try again."}), 500

    data = serialize_report(report, include_history=True)
    data["allowed_next_statuses"] = allowed_next_statuses(report.status)
    message = (
        f"Status updated to {report.status.value}."
        if changed
        else f"Report is already {report.status.value}; nothing was changed."
    )
    return jsonify({"message": message, "changed": changed, "report": data}), 200
