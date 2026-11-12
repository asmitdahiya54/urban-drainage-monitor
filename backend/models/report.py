"""Drainage report models.

`Report.location` is a PostGIS geography POINT (SRID 4326) stored as
POINT(longitude latitude) — the order PostGIS/GeoJSON expects.
"""

from datetime import datetime, timezone

from geoalchemy2 import Geography
from sqlalchemy import CheckConstraint, Enum as SAEnum, Index

from ..extensions import db
from .enums import IssueType, ReportStatus, Severity


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    issue_type = db.Column(
        SAEnum(IssueType, name="issue_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    description = db.Column(db.Text, nullable=True)
    severity = db.Column(
        SAEnum(Severity, name="severity", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=Severity.MEDIUM,
        server_default=Severity.MEDIUM.value,
    )
    status = db.Column(
        SAEnum(ReportStatus, name="report_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=ReportStatus.NEW,
        server_default=ReportStatus.NEW.value,
        index=True,
    )

    # Plain numeric coordinates kept for easy reading/validation...
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    # ...and the spatial column used for real geographic queries.
    # spatial_index=False because the GiST index is declared explicitly below.
    location = db.Column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False
    )

    image_path = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )
    resolved_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User", back_populates="reports")
    status_history = db.relationship(
        "ReportStatusHistory",
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="ReportStatusHistory.changed_at",
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_reports_latitude_range"),
        CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_reports_longitude_range"),
        # GiST spatial index: makes "near me" / radius / hotspot queries fast.
        Index("idx_reports_location", "location", postgresql_using="gist"),
    )

    @staticmethod
    def point_wkt(latitude: float, longitude: float) -> str:
        """Build the WKT PostGIS expects: POINT(longitude latitude)."""
        return f"SRID=4326;POINT({longitude} {latitude})"

    def set_coordinates(self, latitude: float, longitude: float) -> None:
        self.latitude = latitude
        self.longitude = longitude
        self.location = self.point_wkt(latitude, longitude)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "issue_type": self.issue_type.value if self.issue_type else None,
            "description": self.description,
            "severity": self.severity.value if self.severity else None,
            "status": self.status.value if self.status else None,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "image_path": self.image_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Report {self.id} {self.issue_type} {self.status}>"


class ReportStatusHistory(db.Model):
    """Audit trail of every status transition of a report."""

    __tablename__ = "report_status_history"

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(
        db.Integer,
        db.ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    old_status = db.Column(
        SAEnum(ReportStatus, name="report_status", values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    new_status = db.Column(
        SAEnum(ReportStatus, name="report_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    # Who made the change (admin or citizen); kept if the user is deleted.
    changed_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    changed_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    comment = db.Column(db.Text, nullable=True)

    report = db.relationship("Report", back_populates="status_history")
    changed_by_user = db.relationship("User", back_populates="status_changes")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "report_id": self.report_id,
            "old_status": self.old_status.value if self.old_status else None,
            "new_status": self.new_status.value if self.new_status else None,
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
            "comment": self.comment,
        }
