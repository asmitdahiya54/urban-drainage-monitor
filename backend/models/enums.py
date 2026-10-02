"""Enumerations used by the database models.

These are stored as native PostgreSQL enum types so the database itself
rejects invalid values (a real constraint, not just app-level validation).
"""

import enum


class UserRole(str, enum.Enum):
    CITIZEN = "citizen"
    ADMIN = "admin"


class IssueType(str, enum.Enum):
    BLOCKED_DRAIN = "BLOCKED_DRAIN"
    WATERLOGGING = "WATERLOGGING"
    DRAIN_OVERFLOW = "DRAIN_OVERFLOW"
    SEWAGE_OVERFLOW = "SEWAGE_OVERFLOW"
    DAMAGED_DRAIN = "DAMAGED_DRAIN"
    FLOODING = "FLOODING"
    OTHER = "OTHER"


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ReportStatus(str, enum.Enum):
    NEW = "NEW"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
