"""Duplicate drainage report detection (Step 8).

Rule (documented in the README as well)
---------------------------------------
A new report is compared against existing reports **in PostGIS**:

1. Candidates are the reports whose `location` (geography, SRID 4326) is within
   `SEARCH_RADIUS_M` (100 m by default) of the new point — `ST_DWithin` on the
   geography column, so it uses the existing GiST index and real metres.
2. Only reports created in the last `RECENT_DAYS` (30) days are considered:
   an old problem that comes back is a new report, not a duplicate.
3. Each candidate gets a confidence score between 0 and 1:
   * distance      — <= 25 m: 0.50, <= 50 m: 0.40, otherwise 0.25
   * issue type    — same: +0.35, different: +0.05
   * status        — still active (not RESOLVED/REJECTED): +0.10
   * freshness     — created <= 7 days ago: +0.10, otherwise +0.05
   * severity      — same severity: +0.05
   A report that is already RESOLVED or REJECTED is capped at 0.45, so it is
   shown as context but never blocks a new report.
4. A candidate is a **likely duplicate** when the issue type matches, the
   report is still active and the score is >= `LIKELY_THRESHOLD` (0.75).

Nearby reports that are not likely duplicates are still returned as `nearby`
context; nothing is ever auto-rejected or deleted. Only report ids,
classifications, status, distance and timestamps are returned — no reporter
name, e-mail or user id, and no description.
"""

from __future__ import annotations

from sqlalchemy import text

from ..extensions import db
from ..models import IssueType, Severity

SEARCH_RADIUS_M = 100.0
RECENT_DAYS = 30
LIKELY_THRESHOLD = 0.75
CLOSED_STATUSES = {"RESOLVED", "REJECTED"}
CLOSED_MAX_SCORE = 0.45
MAX_CANDIDATES = 10


def _score(
    *,
    distance_m: float,
    same_issue: bool,
    same_severity: bool,
    status: str,
    age_days: float,
) -> float:
    if distance_m <= 25:
        score = 0.50
    elif distance_m <= 50:
        score = 0.40
    else:
        score = 0.25

    score += 0.35 if same_issue else 0.05
    if status not in CLOSED_STATUSES:
        score += 0.10
    score += 0.10 if age_days <= 7 else 0.05
    if same_severity:
        score += 0.05

    if status in CLOSED_STATUSES:
        score = min(score, CLOSED_MAX_SCORE)
    return round(min(score, 1.0), 2)


def find_possible_duplicates(
    *,
    latitude: float,
    longitude: float,
    issue_type: IssueType | str,
    severity: Severity | str | None = None,
    radius_m: float = SEARCH_RADIUS_M,
    days: int = RECENT_DAYS,
    exclude_report_id: int | None = None,
) -> dict:
    """Nearby candidate reports with a duplicate-confidence score.

    Read-only. Uses `ST_DWithin` / `ST_Distance` on the geography column, with
    `POINT(longitude latitude)` ordering — longitude first, as everywhere else
    in this project.
    """
    issue_value = issue_type.value if isinstance(issue_type, IssueType) else str(issue_type).upper()
    severity_value = (
        severity.value if isinstance(severity, Severity) else (str(severity).upper() if severity else None)
    )

    sql = text(
        """
        SELECT id,
               issue_type::text AS issue_type,
               severity::text   AS severity,
               status::text     AS status,
               created_at,
               resolved_at,
               ST_Distance(
                   location,
                   ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
               ) AS distance_m,
               EXTRACT(EPOCH FROM (now() - created_at)) / 86400.0 AS age_days
        FROM reports
        WHERE location IS NOT NULL
          AND created_at >= now() - (:days || ' days')::interval
          AND (:exclude_id IS NULL OR id <> :exclude_id)
          AND ST_DWithin(
                  location,
                  ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                  :radius_m
              )
        ORDER BY distance_m ASC
        LIMIT :limit
        """
    )

    rows = (
        db.session.execute(
            sql,
            {
                "lat": latitude,
                "lon": longitude,
                "days": str(int(days)),
                "radius_m": float(radius_m),
                "exclude_id": exclude_report_id,
                "limit": MAX_CANDIDATES,
            },
        )
        .mappings()
        .all()
    )

    matches: list[dict] = []
    for row in rows:
        distance_m = float(row["distance_m"] or 0.0)
        age_days = float(row["age_days"] or 0.0)
        status = row["status"]
        same_issue = row["issue_type"] == issue_value
        confidence = _score(
            distance_m=distance_m,
            same_issue=same_issue,
            same_severity=severity_value is not None and row["severity"] == severity_value,
            status=status,
            age_days=age_days,
        )
        likely = (
            same_issue and status not in CLOSED_STATUSES and confidence >= LIKELY_THRESHOLD
        )
        matches.append(
            {
                "id": int(row["id"]),
                "issue_type": row["issue_type"],
                "severity": row["severity"],
                "status": status,
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "resolved_at": row["resolved_at"].isoformat() if row["resolved_at"] else None,
                "distance_m": round(distance_m, 1),
                "age_days": round(age_days, 1),
                "same_issue_type": same_issue,
                "confidence": confidence,
                "likely_duplicate": likely,
            }
        )

    likely_matches = [m for m in matches if m["likely_duplicate"]]
    return {
        "duplicate": bool(likely_matches),
        "matches": likely_matches,
        "nearby": matches,
        "count": len(likely_matches),
        "nearby_count": len(matches),
        "message": (
            "A similar drainage report already exists nearby."
            if likely_matches
            else (
                "No similar report was found nearby."
                if not matches
                else "There are other reports nearby, but none look like the same problem."
            )
        ),
        "params": {
            "radius_m": float(radius_m),
            "days": int(days),
            "threshold": LIKELY_THRESHOLD,
        },
    }
