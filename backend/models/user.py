"""User model — citizens who submit reports and admins who manage them.

Note: password hashing helpers live here, but no authentication routes /
JWT are implemented in this step.
"""

from datetime import datetime, timezone

from sqlalchemy import Enum as SAEnum
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from .enums import UserRole


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(
        SAEnum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=UserRole.CITIZEN,
        server_default=UserRole.CITIZEN.value,
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    # One user -> many reports
    reports = db.relationship(
        "Report", back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    # One user -> many status changes they performed
    status_changes = db.relationship(
        "ReportStatusHistory", back_populates="changed_by_user", lazy="selectin"
    )

    # --- password helpers (used by the seed script) ---
    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.value if self.role else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.email} ({self.role})>"
