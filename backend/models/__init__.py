"""Database models package.

Importing this package registers every model with SQLAlchemy's metadata,
which is what Flask-Migrate/Alembic autogeneration relies on.
"""

from .enums import IssueType, ReportStatus, RiskLevel, Severity, UserRole
from .report import Report, ReportStatusHistory
from .risk_prediction import RiskPrediction
from .user import User
from .community import (
    CommunityEvent,
    CommunityEventPhoto,
    EventVolunteer,
    Notification,
    EventUpdate,
)
__all__ = [
    "IssueType",
    "ReportStatus",
    "RiskLevel",
    "Severity",
    "UserRole",
    "Report",
    "ReportStatusHistory",
    "RiskPrediction",
    "User",
    "CommunityEvent",
        "CommunityEventPhoto",
    "EventVolunteer",
    "Notification",
    "EventUpdate",
]
