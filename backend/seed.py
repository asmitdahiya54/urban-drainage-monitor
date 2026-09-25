"""Development seed script — fictional demo data only.

Usage (from the project root, venv active):
    flask --app backend.app seed
    flask --app backend.app seed --reset   # wipe seeded rows first

All coordinates are realistic points in New Delhi, India, but the reports
themselves are invented demo data for development only.
"""

from datetime import datetime, timedelta, timezone

import click
from flask import Flask

from .extensions import db
from .models import (
    IssueType,
    Report,
    ReportStatus,
    ReportStatusHistory,
    Severity,
    User,
    UserRole,
)

DEMO_USERS = [
    {"name": "Demo Admin", "email": "admin@example.com", "role": UserRole.ADMIN, "password": "admin123"},
    {"name": "Asha Citizen", "email": "asha@example.com", "role": UserRole.CITIZEN, "password": "citizen123"},
    {"name": "Ravi Citizen", "email": "ravi@example.com", "role": UserRole.CITIZEN, "password": "citizen123"},
]

# (issue_type, severity, status, latitude, longitude, description)
DEMO_REPORTS = [
    (IssueType.BLOCKED_DRAIN, Severity.HIGH, ReportStatus.NEW, 28.6139, 77.2090, "Demo: drain choked with plastic waste near the market entrance."),
    (IssueType.WATERLOGGING, Severity.CRITICAL, ReportStatus.VERIFIED, 28.6304, 77.2177, "Demo: knee-deep water across the road after light rain."),
    (IssueType.DRAIN_OVERFLOW, Severity.MEDIUM, ReportStatus.IN_PROGRESS, 28.5921, 77.2290, "Demo: overflow spilling onto the footpath."),
    (IssueType.SEWAGE_OVERFLOW, Severity.CRITICAL, ReportStatus.ASSIGNED, 28.5672, 77.2100, "Demo: sewage backing up near residential gate."),
    (IssueType.DAMAGED_DRAIN, Severity.LOW, ReportStatus.PENDING_VERIFICATION, 28.6508, 77.2311, "Demo: broken drain cover, trip hazard."),
    (IssueType.FLOODING, Severity.HIGH, ReportStatus.RESOLVED, 28.7041, 77.1025, "Demo: street flooding cleared after desilting."),
    (IssueType.OTHER, Severity.LOW, ReportStatus.REJECTED, 28.5355, 77.3910, "Demo: duplicate of an earlier report."),
    (IssueType.BLOCKED_DRAIN, Severity.MEDIUM, ReportStatus.NEW, 28.4595, 77.0266, "Demo: silt build-up slowing drainage."),
    (IssueType.WATERLOGGING, Severity.HIGH, ReportStatus.VERIFIED, 28.6692, 77.4538, "Demo: water pooling at the bus stop."),
    (IssueType.DRAIN_OVERFLOW, Severity.MEDIUM, ReportStatus.IN_PROGRESS, 28.6100, 77.2300, "Demo: overflow near school gate, foul smell."),
]


def seed_data(reset: bool = False) -> dict:
    """Insert demo users and reports. Idempotent on user email."""
    if reset:
        ReportStatusHistory.query.delete()
        Report.query.delete()
        User.query.filter(User.email.in_([u["email"] for u in DEMO_USERS])).delete(
            synchronize_session=False
        )
        db.session.commit()

    users: list[User] = []
    for spec in DEMO_USERS:
        user = User.query.filter_by(email=spec["email"]).first()
        if user is None:
            user = User(name=spec["name"], email=spec["email"], role=spec["role"])
            user.set_password(spec["password"])
            db.session.add(user)
        users.append(user)
    db.session.flush()

    admin = users[0]
    citizens = users[1:]

    created = 0
    now = datetime.now(timezone.utc)
    for index, (issue_type, severity, status, lat, lng, description) in enumerate(DEMO_REPORTS):
        reporter = citizens[index % len(citizens)]
        report = Report(
            user_id=reporter.id,
            issue_type=issue_type,
            description=description,
            severity=severity,
            status=status,
            created_at=now - timedelta(days=index),
        )
        report.set_coordinates(lat, lng)
        if status == ReportStatus.RESOLVED:
            report.resolved_at = now - timedelta(days=index, hours=-6)
        db.session.add(report)
        db.session.flush()

        # Trail: NEW -> current status
        db.session.add(
            ReportStatusHistory(
                report_id=report.id,
                old_status=None,
                new_status=ReportStatus.NEW,
                changed_by=reporter.id,
                changed_at=report.created_at,
                comment="Demo: report submitted by citizen.",
            )
        )
        if status != ReportStatus.NEW:
            db.session.add(
                ReportStatusHistory(
                    report_id=report.id,
                    old_status=ReportStatus.NEW,
                    new_status=status,
                    changed_by=admin.id,
                    changed_at=report.created_at + timedelta(hours=3),
                    comment=f"Demo: moved to {status.value} by admin.",
                )
            )
        created += 1

    db.session.commit()
    return {"users": len(users), "reports": created}


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    @click.option("--reset", is_flag=True, help="Delete existing demo rows first.")
    def seed_command(reset: bool) -> None:
        """Seed the database with development demo data."""
        result = seed_data(reset=reset)
        click.echo(
            f"Seeded {result['users']} users and {result['reports']} demo reports."
        )
