"""add Community Action Hub tables"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision = "7c2f9a1b4d60"
down_revision = "5ee70871431e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "community_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("location_name", sa.String(200), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("location", geoalchemy2.types.Geography(geometry_type="POINT", srid=4326, dimension=2, spatial_index=False, from_text="ST_GeogFromText", name="geography", nullable=False), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("registration_deadline", sa.DateTime(timezone=True)),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("safety_instructions", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("review_note", sa.String(500)),
        sa.Column("related_report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_community_event_latitude"),
        sa.CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_community_event_longitude"),
        sa.CheckConstraint("capacity BETWEEN 1 AND 500", name="ck_community_event_capacity"),
        sa.CheckConstraint("status IN ('PENDING','APPROVED','REJECTED','CANCELLED','COMPLETED')", name="ck_community_event_status"),
    )
    op.create_index("idx_community_events_location", "community_events", ["location"], postgresql_using="gist")
    op.create_index("idx_community_events_status_start", "community_events", ["status", "starts_at"])
    op.create_index("ix_community_events_status", "community_events", ["status"])
    op.create_index("ix_community_events_created_by", "community_events", ["created_by"])
    op.create_index("ix_community_events_related_report_id", "community_events", ["related_report_id"])
    op.create_table(
        "event_volunteers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("community_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attendance_status", sa.String(20), nullable=False, server_default="REGISTERED"),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_volunteer_user"),
        sa.CheckConstraint("attendance_status IN ('REGISTERED','ATTENDED','ABSENT')", name="ck_event_volunteer_attendance"),
    )
    op.create_index("ix_event_volunteers_event_id", "event_volunteers", ["event_id"])
    op.create_index("ix_event_volunteers_user_id", "event_volunteers", ["user_id"])
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("community_events.id", ondelete="SET NULL")),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_table(
        "event_updates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("community_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("message", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_event_updates_event_id", "event_updates", ["event_id"])


def downgrade():
    op.drop_table("event_updates")
    op.drop_table("notifications")
    op.drop_table("event_volunteers")
    op.drop_table("community_events")
