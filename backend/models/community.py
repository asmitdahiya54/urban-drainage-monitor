"""Community Action Hub persistence models."""
from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, Index, UniqueConstraint
from geoalchemy2 import Geography
from ..extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class CommunityEvent(db.Model):
    __tablename__ = "community_events"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(40), nullable=False)
    location_name = db.Column(db.String(200), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    location = db.Column(Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    starts_at = db.Column(db.DateTime(timezone=True), nullable=False)
    ends_at = db.Column(db.DateTime(timezone=True))
    registration_deadline = db.Column(db.DateTime(timezone=True))
    capacity = db.Column(db.Integer, nullable=False, default=10)
    status = db.Column(db.String(20), nullable=False, default="PENDING", index=True)
    safety_instructions = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    review_note = db.Column(db.String(500))
    related_report_id = db.Column(db.Integer, db.ForeignKey("reports.id", ondelete="SET NULL"), nullable=True, index=True)
    before_photo_url = db.Column(db.String(500), nullable=True)
    after_photo_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    completed_at = db.Column(db.DateTime(timezone=True))
    creator = db.relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_community_event_latitude"),
        CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_community_event_longitude"),
        CheckConstraint("capacity BETWEEN 1 AND 500", name="ck_community_event_capacity"),
        CheckConstraint("status IN ('PENDING','APPROVED','REJECTED','CANCELLED','COMPLETED')", name="ck_community_event_status"),
        Index("idx_community_events_location", "location", postgresql_using="gist"),
        Index("idx_community_events_status_start", "status", "starts_at"),
    )

    @staticmethod
    def point_wkt(latitude, longitude):
        return f"SRID=4326;POINT({longitude} {latitude})"

class CommunityEventPhoto(db.Model):
    __tablename__ = "community_event_photos"

    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("community_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    photo_url = db.Column(db.String(500), nullable=False)

    photo_type = db.Column(db.String(10), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    location_accuracy = db.Column(db.Float, nullable=True)

    uploaded_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utcnow
    )

    event = db.relationship("CommunityEvent", backref="photos")
    uploader = db.relationship("User", foreign_keys=[uploaded_by])

    __table_args__ = (
        CheckConstraint(
            "photo_type IN ('BEFORE','AFTER')",
            name="ck_community_event_photo_type"
        ),
        Index(
            "idx_community_event_photos_event_type",
            "event_id",
            "photo_type"
        ),
    )
class EventVolunteer(db.Model):
    __tablename__ = "event_volunteers"
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("community_events.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    attendance_status = db.Column(db.String(20), nullable=False, default="REGISTERED")
    user = db.relationship("User")
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_volunteer_user"),
        CheckConstraint("attendance_status IN ('REGISTERED','ATTENDED','ABSENT')", name="ck_event_volunteer_attendance"),
    )


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = db.Column(db.Integer, db.ForeignKey("community_events.id", ondelete="SET NULL"), nullable=True)
    type = db.Column(db.String(40), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    read_at = db.Column(db.DateTime(timezone=True))


class EventUpdate(db.Model):
    __tablename__ = "event_updates"
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("community_events.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    message = db.Column(db.String(1000), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
