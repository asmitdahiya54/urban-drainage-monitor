"""Civic / environmental data endpoint (Step 10).

Read-only and signed-in: the dashboard that consumes it is administrative, so
the route requires a valid JWT. It returns no citizen data and no credentials —
API keys stay inside the provider (see `backend/services/civic.py`).
"""

import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..services.civic import (
    DATA_TYPES,
    CivicDataError,
    build_provider,
    get_civic_data,
)
from ..utils.auth import current_user
from ..utils.report_validators import validate_latitude, validate_longitude
from ..utils.validators import ValidationError

logger = logging.getLogger(__name__)

civic_bp = Blueprint("civic", __name__, url_prefix="/api")


@civic_bp.get("/civic-data")
@jwt_required()
def civic_data():
    user = current_user()
    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    args = request.args
    raw_types = args.get("data_type") or args.get("types")
    data_types = None
    if raw_types and raw_types.strip().upper() != "ALL":
        data_types = [part.strip().upper() for part in raw_types.split(",") if part.strip()]

    latitude = longitude = None
    try:
        if args.get("latitude") not in (None, ""):
            latitude = validate_latitude(args.get("latitude"))
        if args.get("longitude") not in (None, ""):
            longitude = validate_longitude(args.get("longitude"))
    except ValidationError as exc:
        return jsonify({"error": exc.message, "field": exc.field}), 400

    refresh = args.get("refresh") in ("1", "true", "True")

    try:
        data = get_civic_data(
            data_types,
            latitude,
            longitude,
            use_cache=not refresh,
        )
    except CivicDataError as exc:
        return (
            jsonify({"error": exc.message, "reason": exc.reason, "available_types": list(DATA_TYPES)}),
            exc.http_status,
        )

    # Every data type failed and nothing was returned — report it as a
    # service-unavailable rather than an empty success.
    if not data["records"] and data["errors"]:
        first = data["errors"][0]
        return (
            jsonify(
                {
                    "error": first["message"],
                    "reason": first["reason"],
                    "source": data["source"],
                    "is_mock": data["is_mock"],
                    "errors": data["errors"],
                }
            ),
            503,
        )

    return jsonify(data), 200


@civic_bp.get("/civic-data/provider")
@jwt_required()
def civic_provider():
    """Which source is configured (never the key itself)."""
    user = current_user()
    if user is None:
        return jsonify({"error": "Authentication required"}), 401
    provider = build_provider()
    return jsonify({"provider": provider.describe(), "available_types": list(DATA_TYPES)}), 200
