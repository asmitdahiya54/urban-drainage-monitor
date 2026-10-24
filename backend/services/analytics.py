"""Admin dashboard analytics (Step 7).

Every number here is computed by PostgreSQL — the frontend never receives a
list of reports to count in the browser. Aggregation is done with `COUNT(*)
FILTER (...)`, `GROUP BY` and `date_trunc`, plus one PostGIS query for the
spatial spread of reports.

Read-only: nothing in this module writes to the database.
"""

from __future__ import annotations

from sqlalchemy import text

from ..extensions import db
from ..models import IssueType, ReportStatus, Severity

# Statuses that mean "the work is finished" (one way or another).
CLOSED_STATUSES = ("RESOLVED", "REJECTED")


def _zeroed(enum_cls) -> dict[str, int]:
    return {member.value: 0 for member in enum_cls}


def totals(*, recent_days: int = 30) -> dict:
    """Headline counters, all in a single aggregate query."""
    sql = text(
        """
        SELECT COUNT(*)                                                        AS total,
               COUNT(*) FILTER (WHERE status::text = 'RESOLVED')               AS resolved,
               COUNT(*) FILTER (WHERE status::text = 'REJECTED')               AS rejected,
               COUNT(*) FILTER (WHERE status::text NOT IN ('RESOLVED','REJECTED'))
                                                                              AS unresolved,
               COUNT(*) FILTER (WHERE severity::text IN ('HIGH','CRITICAL'))   AS high_severity,
               COUNT(*) FILTER (WHERE created_at >= now() - (:days || ' days')::interval)
                                                                              AS recent,
               COUNT(*) FILTER (WHERE status::text = 'NEW')                    AS awaiting_review
        FROM reports
        """
    )
    row = db.session.execute(sql, {"days": str(recent_days)}).mappings().one()
    data = {key: int(value) for key, value in row.items()}
    data["recent_days"] = recent_days
    total = data["total"]
    data["resolution_rate"] = round(data["resolved"] / total * 100, 1) if total else 0.0
    return data


#: Columns `_grouped()` may interpolate — never derived from request input.
GROUPABLE_COLUMNS = ("status", "severity", "issue_type")


def _grouped(column: str, enum_cls) -> list[dict]:
    """`GROUP BY` one enum column, with every enum value present (even at 0)."""
    if column not in GROUPABLE_COLUMNS:  # defensive: keeps the f-string safe
        raise ValueError(f"Unsupported group-by column: {column}")
    counts = _zeroed(enum_cls)
    sql = text(
        f"""
        SELECT {column}::text AS key, COUNT(*) AS count
        FROM reports
        GROUP BY {column}
        """
    )
    for row in db.session.execute(sql).mappings():
        counts[row["key"]] = int(row["count"])
    return [{"key": key, "count": count} for key, count in counts.items()]


def by_status() -> list[dict]:
    return _grouped("status", ReportStatus)


def by_severity() -> list[dict]:
    return _grouped("severity", Severity)


def by_issue_type() -> list[dict]:
    """Issue types, busiest first, with resolved counts alongside."""
    counts = {member.value: {"count": 0, "resolved": 0} for member in IssueType}
    sql = text(
        """
        SELECT issue_type::text AS key,
               COUNT(*) AS count,
               COUNT(*) FILTER (WHERE status::text = 'RESOLVED') AS resolved
        FROM reports
        GROUP BY issue_type
        """
    )
    for row in db.session.execute(sql).mappings():
        counts[row["key"]] = {"count": int(row["count"]), "resolved": int(row["resolved"])}
    rows = [{"key": key, **value} for key, value in counts.items()]
    rows.sort(key=lambda item: (-item["count"], item["key"]))
    return rows


def over_time(*, days: int = 30) -> list[dict]:
    """One row per day for the last `days` days, including days with no reports.

    `generate_series` gives the continuous axis, so the chart has no gaps.
    """
    sql = text(
        """
        WITH span AS (
            SELECT generate_series(
                       (now() at time zone 'UTC')::date - (:days - 1) * interval '1 day',
                       (now() at time zone 'UTC')::date,
                       interval '1 day'
                   )::date AS day
        )
        SELECT span.day::text AS day,
               COUNT(r.id) AS count,
               COUNT(r.id) FILTER (WHERE r.severity::text IN ('HIGH','CRITICAL'))
                   AS high_severity,
               COUNT(r.id) FILTER (WHERE r.status::text = 'RESOLVED') AS resolved
        FROM span
        LEFT JOIN reports r
               ON date_trunc('day', r.created_at)::date = span.day
        GROUP BY span.day
        ORDER BY span.day
        """
    )
    rows = db.session.execute(sql, {"days": days}).mappings().all()
    return [
        {
            "day": row["day"],
            "count": int(row["count"]),
            "high_severity": int(row["high_severity"]),
            "resolved": int(row["resolved"]),
        }
        for row in rows
    ]


def by_month(*, months: int = 6) -> list[dict]:
    """Monthly totals — a coarser view of the same trend."""
    sql = text(
        """
        WITH span AS (
            SELECT generate_series(
                       date_trunc('month', now() at time zone 'UTC')
                           - (:months - 1) * interval '1 month',
                       date_trunc('month', now() at time zone 'UTC'),
                       interval '1 month'
                   ) AS month
        )
        SELECT to_char(span.month, 'YYYY-MM') AS month,
               COUNT(r.id) AS count,
               COUNT(r.id) FILTER (WHERE r.status::text = 'RESOLVED') AS resolved
        FROM span
        LEFT JOIN reports r
               ON date_trunc('month', r.created_at) = span.month
        GROUP BY span.month
        ORDER BY span.month
        """
    )
    rows = db.session.execute(sql, {"months": months}).mappings().all()
    return [
        {"month": row["month"], "count": int(row["count"]), "resolved": int(row["resolved"])}
        for row in rows
    ]


def resolution_speed() -> dict:
    """Average / median hours from report to resolution, computed in SQL."""
    sql = text(
        """
        SELECT COUNT(*) AS resolved_count,
               AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0) AS avg_hours,
               PERCENTILE_CONT(0.5) WITHIN GROUP (
                   ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0
               ) AS median_hours
        FROM reports
        WHERE resolved_at IS NOT NULL AND created_at IS NOT NULL
        """
    )
    row = db.session.execute(sql).mappings().one()
    return {
        "resolved_count": int(row["resolved_count"] or 0),
        "avg_hours": round(float(row["avg_hours"]), 1) if row["avg_hours"] is not None else None,
        "median_hours": (
            round(float(row["median_hours"]), 1) if row["median_hours"] is not None else None
        ),
    }


def spatial_spread() -> dict:
    """PostGIS view of where the reports are: centre of gravity and extent."""
    sql = text(
        """
        SELECT COUNT(*) AS located,
               ST_Y(ST_Centroid(ST_Collect(location::geometry))) AS center_latitude,
               ST_X(ST_Centroid(ST_Collect(location::geometry))) AS center_longitude,
               ST_MaxDistance(
                   ST_Collect(location::geometry), ST_Collect(location::geometry)
               ) * 111320.0 AS spread_m
        FROM reports
        WHERE location IS NOT NULL
        """
    )
    row = db.session.execute(sql).mappings().one()
    located = int(row["located"] or 0)
    if not located:
        return {"located": 0, "center_latitude": None, "center_longitude": None, "spread_m": None}
    return {
        "located": located,
        "center_latitude": float(row["center_latitude"]),
        "center_longitude": float(row["center_longitude"]),
        "spread_m": round(float(row["spread_m"] or 0), 1),
    }


def dashboard_analytics(*, days: int = 30, months: int = 6, recent_days: int = 30) -> dict:
    """Everything the admin analytics section needs, in one payload."""
    return {
        "totals": totals(recent_days=recent_days),
        "by_status": by_status(),
        "by_severity": by_severity(),
        "by_issue_type": by_issue_type(),
        "over_time": over_time(days=days),
        "by_month": by_month(months=months),
        "resolution_speed": resolution_speed(),
        "spatial": spatial_spread(),
        "params": {"days": days, "months": months, "recent_days": recent_days},
    }
