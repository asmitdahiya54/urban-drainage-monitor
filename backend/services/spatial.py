"""PostGIS spatial analysis used by the public map (Step 6).

Everything here is read-only and privacy-safe: it never touches the users
table, so no citizen name or email can leak into a public response.

Two pieces of real spatial SQL:

* `public_map_reports` – filtered list of report locations, ordered newest
  first, with an optional radius filter that uses `ST_DWithin` on the
  geography column (metres, index-friendly thanks to the GiST index).
* `report_hotspots` – density clustering with `ST_ClusterDBSCAN`, returning
  the cluster centroid, how many reports it contains and a severity-weighted
  intensity score.
"""

from __future__ import annotations

from sqlalchemy import text

from ..extensions import db

# ST_ClusterDBSCAN works on geometry, where 1 degree ~= 111.32 km near the
# equator. Good enough for city-scale clustering of a few hundred points.
METRES_PER_DEGREE = 111_320.0

SEVERITY_WEIGHT = {"LOW": 1.0, "MEDIUM": 2.0, "HIGH": 3.0, "CRITICAL": 4.0}


def _filter_sql(
    *,
    issue_types: list[str] | None,
    severities: list[str] | None,
    statuses: list[str] | None,
    exclude_rejected: bool,
) -> tuple[str, dict]:
    clauses: list[str] = []
    params: dict = {}

    if issue_types:
        clauses.append("r.issue_type::text = ANY(:issue_types)")
        params["issue_types"] = issue_types
    if severities:
        clauses.append("r.severity::text = ANY(:severities)")
        params["severities"] = severities
    if statuses:
        clauses.append("r.status::text = ANY(:statuses)")
        params["statuses"] = statuses
    elif exclude_rejected:
        # Rejected reports are not shown publicly unless explicitly requested.
        clauses.append("r.status::text <> 'REJECTED'")

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def public_map_reports(
    *,
    issue_types: list[str] | None = None,
    severities: list[str] | None = None,
    statuses: list[str] | None = None,
    days: int | None = None,
    center: tuple[float, float] | None = None,
    radius_m: float | None = None,
    limit: int = 1000,
) -> list[dict]:
    """Privacy-safe report points for the public map."""
    where, params = _filter_sql(
        issue_types=issue_types,
        severities=severities,
        statuses=statuses,
        exclude_rejected=True,
    )

    extra: list[str] = []
    if days is not None:
        extra.append("r.created_at >= now() - (:days || ' days')::interval")
        params["days"] = str(days)
    if center is not None and radius_m is not None:
        extra.append(
            "ST_DWithin(r.location, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,"
            " :radius_m)"
        )
        params["lat"], params["lon"] = center[0], center[1]
        params["radius_m"] = radius_m

    if extra:
        where = f"{where} AND {' AND '.join(extra)}" if where else " WHERE " + " AND ".join(extra)

    params["limit"] = limit

    sql = text(
        f"""
        SELECT r.id,
               r.issue_type::text AS issue_type,
               r.severity::text   AS severity,
               r.status::text     AS status,
               ST_Y(r.location::geometry) AS latitude,
               ST_X(r.location::geometry) AS longitude,
               r.created_at,
               r.resolved_at
        FROM reports r
        {where}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT :limit
        """
    )

    rows = db.session.execute(sql, params).mappings().all()
    return [
        {
            "id": row["id"],
            "issue_type": row["issue_type"],
            "severity": row["severity"],
            "status": row["status"],
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "weight": SEVERITY_WEIGHT.get(row["severity"], 1.0),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "resolved_at": row["resolved_at"].isoformat() if row["resolved_at"] else None,
        }
        for row in rows
    ]


def report_hotspots(
    *,
    radius_m: float = 400.0,
    min_points: int = 2,
    issue_types: list[str] | None = None,
    severities: list[str] | None = None,
    statuses: list[str] | None = None,
    days: int | None = None,
    limit: int = 25,
) -> list[dict]:
    """Cluster nearby reports with ST_ClusterDBSCAN and rank them by density."""
    where, params = _filter_sql(
        issue_types=issue_types,
        severities=severities,
        statuses=statuses,
        exclude_rejected=True,
    )

    if days is not None:
        clause = "r.created_at >= now() - (:days || ' days')::interval"
        where = f"{where} AND {clause}" if where else f" WHERE {clause}"
        params["days"] = str(days)

    params["eps"] = radius_m / METRES_PER_DEGREE
    params["min_points"] = min_points
    params["limit"] = limit

    sql = text(
        f"""
        WITH points AS (
            SELECT r.id,
                   r.severity::text AS severity,
                   r.status::text   AS status,
                   r.location::geometry AS geom
            FROM reports r
            {where}
        ),
        clustered AS (
            SELECT ST_ClusterDBSCAN(geom, eps := :eps, minpoints := :min_points)
                       OVER () AS cluster_id,
                   id, severity, status, geom
            FROM points
        )
        SELECT cluster_id,
               COUNT(*) AS report_count,
               ST_Y(ST_Centroid(ST_Collect(geom))) AS latitude,
               ST_X(ST_Centroid(ST_Collect(geom))) AS longitude,
               ROUND(
                 (ST_MaxDistance(ST_Collect(geom), ST_Collect(geom))::numeric
                  * :metres_per_degree) / 2, 0
               ) AS radius_m,
               SUM(CASE severity
                     WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3
                     WHEN 'MEDIUM' THEN 2 ELSE 1 END) AS severity_score,
               COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_count
        FROM clustered
        WHERE cluster_id IS NOT NULL
        GROUP BY cluster_id
        ORDER BY severity_score DESC, report_count DESC
        LIMIT :limit
        """
    )
    params["metres_per_degree"] = METRES_PER_DEGREE

    rows = db.session.execute(sql, params).mappings().all()
    return [
        {
            "cluster_id": int(row["cluster_id"]),
            "report_count": int(row["report_count"]),
            "resolved_count": int(row["resolved_count"]),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "radius_m": float(row["radius_m"] or 0),
            "severity_score": float(row["severity_score"]),
        }
        for row in rows
    ]


def public_summary(
    *,
    issue_types: list[str] | None = None,
    severities: list[str] | None = None,
    statuses: list[str] | None = None,
    days: int | None = None,
) -> dict:
    """Aggregate counts for the public map, computed in SQL."""
    where, params = _filter_sql(
        issue_types=issue_types,
        severities=severities,
        statuses=statuses,
        exclude_rejected=True,
    )
    if days is not None:
        clause = "r.created_at >= now() - (:days || ' days')::interval"
        where = f"{where} AND {clause}" if where else f" WHERE {clause}"
        params["days"] = str(days)

    sql = text(
        f"""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE r.status::text = 'RESOLVED') AS resolved,
               COUNT(*) FILTER (WHERE r.severity::text IN ('HIGH','CRITICAL')) AS high_severity
        FROM reports r
        {where}
        """
    )
    row = db.session.execute(sql, params).mappings().one()
    return {
        "total": int(row["total"]),
        "resolved": int(row["resolved"]),
        "high_severity": int(row["high_severity"]),
    }
