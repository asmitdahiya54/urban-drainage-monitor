"""Drainage-risk prototype service (Step 9).

This is the bridge between PostgreSQL/PostGIS and the baseline model in
``ml/risk_model.py``:

* ``area_features`` aggregates the existing reports into square grid cells with
  PostGIS (``ST_SnapToGrid`` on the geography column) and turns each cell into
  the engineered feature row the model expects. Only counts and geometry are
  read — never a reporter's name, email or user id.
* ``train_and_store`` fits the baseline and stores one ``risk_predictions`` row
  per area (score, level, timestamp, model version).
* ``latest_predictions`` reads the most recent stored run back, and re-attaches
  the live aggregate indicators so an admin can see what drove each score.

Nothing here writes citizen data into predictions.
"""

from __future__ import annotations

from sqlalchemy import text

from ml.risk_model import (
    FEATURE_NAMES,
    LIMITATIONS,
    MODEL_TYPE,
    MODEL_VERSION,
    RISK_THRESHOLDS,
    risk_level,
    train_baseline,
)

from ..extensions import db
from ..models import RiskLevel, RiskPrediction

#: Grid size in degrees (~0.005° ≈ 550 m at Delhi's latitude).
CELL_DEGREES = 0.005
#: Window used for the "recent reports" feature.
RECENT_DAYS = 30

DISCLAIMER = (
    "Prototype risk prediction based on available crowdsourced report data. "
    "Predictions are not official flood warnings."
)

FLOOD_RELATED = ("FLOODING", "WATERLOGGING", "DRAIN_OVERFLOW", "SEWAGE_OVERFLOW")

_AREA_SQL = text(
    f"""
    WITH snapped AS (
        SELECT ST_SnapToGrid(location::geometry, :cell) AS cell,
               location,
               issue_type::text  AS issue_type,
               severity::text    AS severity,
               status::text      AS status,
               created_at
        FROM reports
        WHERE location IS NOT NULL
    )
    SELECT ST_Y(ST_Centroid(ST_Collect(location::geometry)))          AS latitude,
           ST_X(ST_Centroid(ST_Collect(location::geometry)))          AS longitude,
           ST_Y(cell)                                                 AS cell_latitude,
           ST_X(cell)                                                 AS cell_longitude,
           COUNT(*)                                                   AS report_count,
           COUNT(*) FILTER (
               WHERE created_at >= now() - (:days || ' days')::interval
           )                                                          AS recent_count,
           COUNT(*) FILTER (WHERE severity IN ('HIGH','CRITICAL'))     AS high_severity_count,
           COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','REJECTED'))
                                                                      AS unresolved_count,
           COUNT(*) FILTER (WHERE status = 'RESOLVED')                 AS resolved_count,
           COUNT(*) FILTER (
               WHERE issue_type IN {FLOOD_RELATED!r}
           )                                                          AS flood_related_count,
           COUNT(DISTINCT issue_type)                                 AS issue_type_variety,
           MIN(EXTRACT(EPOCH FROM (now() - created_at)) / 86400.0)     AS days_since_last,
           MAX(EXTRACT(EPOCH FROM (now() - created_at)) / 86400.0)     AS days_since_first,
           ST_MaxDistance(
               ST_Collect(location::geometry), ST_Collect(location::geometry)
           ) * 111320.0                                               AS spread_m
    FROM snapped
    GROUP BY cell
    ORDER BY report_count DESC, cell_latitude, cell_longitude
    """
)


def _cell_area_km2(cell_degrees: float) -> float:
    side_km = cell_degrees * 111.32
    return max(side_km * side_km, 1e-6)


def area_features(*, cell_degrees: float = CELL_DEGREES, days: int = RECENT_DAYS) -> list[dict]:
    """Aggregate reports into grid cells and engineer the model features."""
    rows = (
        db.session.execute(_AREA_SQL, {"cell": cell_degrees, "days": str(days)}).mappings().all()
    )
    area_km2 = _cell_area_km2(cell_degrees)

    features: list[dict] = []
    for row in rows:
        report_count = int(row["report_count"])
        days_since_last = float(row["days_since_last"] or 0.0)
        features.append(
            {
                "area_id": f"{round(float(row['cell_latitude']), 4)}:"
                f"{round(float(row['cell_longitude']), 4)}",
                "latitude": round(float(row["latitude"]), 6),
                "longitude": round(float(row["longitude"]), 6),
                # --- engineered features (model input) ---
                "report_count": report_count,
                "recent_count": int(row["recent_count"]),
                "high_severity_count": int(row["high_severity_count"]),
                "unresolved_count": int(row["unresolved_count"]),
                "flood_related_count": int(row["flood_related_count"]),
                "issue_type_variety": int(row["issue_type_variety"]),
                "density_per_km2": round(report_count / area_km2, 3),
                "recency_score": round(1.0 / (1.0 + days_since_last), 4),
                "spread_m": round(float(row["spread_m"] or 0.0), 1),
                # --- observed context (never model input) ---
                "resolved_count": int(row["resolved_count"]),
                "days_since_last_report": round(days_since_last, 2),
                "days_since_first_report": round(float(row["days_since_first"] or 0.0), 2),
            }
        )
    return features


def _store(predictions: list[dict]) -> int:
    """Replace the stored run with the new one (latest run is what admins see)."""
    RiskPrediction.query.filter_by(model_version=MODEL_VERSION).delete(synchronize_session=False)
    for item in predictions:
        row = RiskPrediction(
            risk_score=float(item["risk_score"]),
            risk_level=RiskLevel(item["risk_level"]),
            model_version=MODEL_VERSION,
        )
        row.set_coordinates(item["latitude"], item["longitude"])
        db.session.add(row)
    db.session.commit()
    return len(predictions)


def train_and_store(*, cell_degrees: float = CELL_DEGREES, days: int = RECENT_DAYS) -> dict:
    """Train the baseline on current report data and store its predictions."""
    rows = area_features(cell_degrees=cell_degrees, days=days)
    result = train_baseline(rows)
    result.pop("pipeline", None)

    stored = 0
    if result["trained"]:
        stored = _store(result["predictions"])

    result.update(
        {
            "stored_predictions": stored,
            "areas": len(rows),
            "params": {"cell_degrees": cell_degrees, "recent_days": days},
            "thresholds": RISK_THRESHOLDS,
            "disclaimer": DISCLAIMER,
        }
    )
    return result


def latest_predictions(*, cell_degrees: float = CELL_DEGREES, days: int = RECENT_DAYS) -> dict:
    """Stored predictions from the most recent run + live area indicators."""
    rows = (
        RiskPrediction.query.filter_by(model_version=MODEL_VERSION)
        .order_by(RiskPrediction.risk_score.desc())
        .all()
    )
    if not rows:
        return {
            "predictions": [],
            "count": 0,
            "trained": False,
            "model_type": MODEL_TYPE,
            "model_version": MODEL_VERSION,
            "features": list(FEATURE_NAMES),
            "generated_at": None,
            "message": "No prototype predictions yet — train the baseline model first.",
            "disclaimer": DISCLAIMER,
            "limitations": list(LIMITATIONS),
        }

    indicators = {item["area_id"]: item for item in area_features(cell_degrees=cell_degrees, days=days)}

    def area_key(latitude: float, longitude: float) -> str:
        # Mirrors PostGIS ST_SnapToGrid, which snaps to the NEAREST grid node.
        snap = lambda value: round(round(value / cell_degrees) * cell_degrees, 4)  # noqa: E731
        return f"{snap(latitude)}:{snap(longitude)}"

    predictions = []
    for row in rows:
        payload = row.to_dict()
        match = indicators.get(area_key(row.latitude, row.longitude))
        if match is None:
            # Nearest area within roughly one cell, if the grid key drifted.
            match = min(
                indicators.values(),
                key=lambda item: abs(item["latitude"] - row.latitude)
                + abs(item["longitude"] - row.longitude),
                default=None,
            )
        payload["indicators"] = (
            {
                key: match[key]
                for key in (
                    "report_count",
                    "recent_count",
                    "high_severity_count",
                    "unresolved_count",
                    "resolved_count",
                    "flood_related_count",
                    "issue_type_variety",
                    "density_per_km2",
                    "days_since_last_report",
                )
            }
            if match
            else None
        )
        predictions.append(payload)

    return {
        "predictions": predictions,
        "count": len(predictions),
        "trained": True,
        "model_type": MODEL_TYPE,
        "model_version": MODEL_VERSION,
        "features": list(FEATURE_NAMES),
        "generated_at": max(
            (row.prediction_date.isoformat() for row in rows if row.prediction_date), default=None
        ),
        "thresholds": RISK_THRESHOLDS,
        "disclaimer": DISCLAIMER,
        "limitations": list(LIMITATIONS),
    }


def public_risk_areas(*, limit: int = 100) -> dict:
    """Public-safe view: coordinates, level, score, date and report count only."""
    rows = (
        RiskPrediction.query.filter_by(model_version=MODEL_VERSION)
        .order_by(RiskPrediction.risk_score.desc())
        .limit(limit)
        .all()
    )
    detail = latest_predictions()["predictions"] if rows else []
    counts = {
        (round(item["latitude"], 6), round(item["longitude"], 6)): (item.get("indicators") or {}).get(
            "report_count"
        )
        for item in detail
    }
    areas = [
        {
            "latitude": row.latitude,
            "longitude": row.longitude,
            "risk_level": row.risk_level.value if row.risk_level else risk_level(row.risk_score),
            "risk_score": round(float(row.risk_score), 4),
            "prediction_date": row.prediction_date.isoformat() if row.prediction_date else None,
            "report_count": counts.get((round(row.latitude, 6), round(row.longitude, 6))),
        }
        for row in rows
    ]
    return {
        "areas": areas,
        "count": len(areas),
        "model_version": MODEL_VERSION,
        "disclaimer": DISCLAIMER,
    }
