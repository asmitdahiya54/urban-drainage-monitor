"""Report status workflow (Step 5).

Only administrators change a report's status, and only along the documented
transitions below. Every real change is recorded in report_status_history;
re-submitting the current status is a no-op and creates no duplicate row.

    NEW ─► PENDING_VERIFICATION ─► VERIFIED ─► ASSIGNED ─► IN_PROGRESS ─► RESOLVED
     │              │                  │
     └──────────────┴──────────────────┴────► REJECTED

Extra shortcut allowed on purpose: NEW ─► VERIFIED, so an obvious report does
not have to pass through PENDING_VERIFICATION. RESOLVED and REJECTED are final.
"""

from datetime import datetime, timezone

from ..extensions import db
from ..models import Report, ReportStatus, ReportStatusHistory, User
from ..utils.validators import ValidationError

ALLOWED_TRANSITIONS: dict[ReportStatus, tuple[ReportStatus, ...]] = {
    ReportStatus.NEW: (
        ReportStatus.PENDING_VERIFICATION,
        ReportStatus.VERIFIED,
        ReportStatus.REJECTED,
    ),
    ReportStatus.PENDING_VERIFICATION: (ReportStatus.VERIFIED, ReportStatus.REJECTED),
    ReportStatus.VERIFIED: (ReportStatus.ASSIGNED, ReportStatus.REJECTED),
    ReportStatus.ASSIGNED: (ReportStatus.IN_PROGRESS,),
    ReportStatus.IN_PROGRESS: (ReportStatus.RESOLVED,),
    ReportStatus.RESOLVED: (),
    ReportStatus.REJECTED: (),
}

MAX_COMMENT_LENGTH = 1000


def validate_status(raw: object, field: str = "status") -> ReportStatus:
    """Accept only the known status values — never an arbitrary string."""
    if raw is None or not isinstance(raw, str) or not raw.strip():
        raise ValidationError("A status is required", field)
    try:
        return ReportStatus(raw.strip().upper())
    except ValueError as exc:
        allowed = ", ".join(s.value for s in ReportStatus)
        raise ValidationError(f"Status must be one of: {allowed}", field) from exc


def validate_comment(raw: object, field: str = "comment") -> str | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ValidationError("Comment must be text", field)
    comment = raw.strip()
    if not comment:
        return None
    if len(comment) > MAX_COMMENT_LENGTH:
        raise ValidationError(
            f"Comment must be at most {MAX_COMMENT_LENGTH} characters", field
        )
    return comment


def allowed_next_statuses(status: ReportStatus) -> list[str]:
    return [s.value for s in ALLOWED_TRANSITIONS.get(status, ())]


def apply_status_change(
    report: Report,
    new_status: ReportStatus,
    admin: User,
    comment: str | None = None,
) -> bool:
    """Move a report to `new_status`, writing one history row.

    Returns True when the status actually changed, False when the report was
    already in that status (no history row is written in that case).
    Raises ValidationError when the transition is not allowed.
    """
    old_status = report.status
    if old_status == new_status:
        return False

    if new_status not in ALLOWED_TRANSITIONS.get(old_status, ()):
        allowed = allowed_next_statuses(old_status)
        readable = ", ".join(allowed) if allowed else "no further changes"
        raise ValidationError(
            f"Cannot change status from {old_status.value} to {new_status.value}. "
            f"Allowed from {old_status.value}: {readable}.",
            "status",
        )

    report.status = new_status
    report.resolved_at = (
        datetime.now(timezone.utc) if new_status == ReportStatus.RESOLVED else None
    )
    db.session.add(
        ReportStatusHistory(
            report_id=report.id,
            old_status=old_status,
            new_status=new_status,
            changed_by=admin.id,
            comment=comment,
        )
    )
    return True
