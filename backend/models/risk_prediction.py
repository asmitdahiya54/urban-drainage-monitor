"""Risk prediction model — filled later by the ML module (Step: ML)."""

from datetime import datetime, timezone

from geoalchemy2 import Geography
from sqlalchemy import CheckConstraint, Enum as SAEnum, Index

from ..extensions import db
from .enums import RiskLevel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RiskPrediction(db.Model):
    __tablename__ = "risk_predictions"

    id = db.Column(db.Integer, primary_key=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    # spatial_index=False because the GiST index is declared explicitly below.
    location = db.Column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False
    )

    risk_score = db.Column(db.Float, nullable=False)
    risk_level = db.Column(
        SAEnum(RiskLevel, name="risk_level", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    prediction_date = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )
    model_version = db.Column(db.String(50), nullable=False, default="v0-placeholder")

    __table_args__ = (
        CheckConstraint("risk_score >= 0 AND risk_score <= 1", name="ck_risk_score_range"),
        Index("idx_risk_predictions_location", "location", postgresql_using="gist"),
    )

    def set_coordinates(self, latitude: float, longitude: float) -> None:
        self.latitude = latitude
        self.longitude = longitude
        self.location = f"SRID=4326;POINT({longitude} {latitude})"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level.value if self.risk_level else None,
            "prediction_date": self.prediction_date.isoformat() if self.prediction_date else None,
            "model_version": self.model_version,
        }
