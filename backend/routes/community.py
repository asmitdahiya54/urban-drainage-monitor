"""Community Action Hub APIs: proposals, volunteering and private notifications."""
from datetime import datetime, timezone
import math
import uuid

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ..extensions import db
from ..models import (
    CommunityEvent,
    CommunityEventPhoto,
    EventVolunteer,
    Notification,
    EventUpdate,
    Report,
)
from ..storage import get_supabase_storage, STORAGE_BUCKET
from ..utils.auth import admin_required, current_user

community_bp = Blueprint("community", __name__, url_prefix="/api/community")
admin_community_bp = Blueprint("admin_community", __name__, url_prefix="/api/admin/community")
CATEGORIES = {"DRAINAGE_AWARENESS", "SAFE_PUBLIC_CLEANUP", "WATERLOGGING_ASSISTANCE", "COMMUNITY_REPORTING", "ENVIRONMENTAL_AWARENESS", "OTHER"}
STATUSES = {"APPROVED", "REJECTED"}


def parse_dt(value, required=True):
    if value in (None, "") and not required:
        return None
    if not isinstance(value, str):
        raise ValueError("A timezone-aware ISO-8601 date is required")
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Date/time must include a timezone")
    return result.astimezone(timezone.utc)


def count_volunteers(event_id):
    return db.session.query(func.count(EventVolunteer.id)).filter_by(event_id=event_id).scalar() or 0


def event_json(event, include_private=False):
    count = count_volunteers(event.id)
    data = {
        "id": event.id, "title": event.title, "description": event.description,
        "category": event.category, "location_name": event.location_name,
        "latitude": event.latitude, "longitude": event.longitude,
        "starts_at": event.starts_at.isoformat(),
        "ends_at": event.ends_at.isoformat() if event.ends_at else None,
        "registration_deadline": event.registration_deadline.isoformat() if event.registration_deadline else None,
        "capacity": event.capacity, "volunteer_count": count,
        "remaining_spaces": max(0, event.capacity-count), "status": event.status,
        "safety_instructions": event.safety_instructions,
        "related_report_id": event.related_report_id,
        "created_at": event.created_at.isoformat(),
        "organizer": {"id": event.creator.id, "name": event.creator.name} if event.creator else None,
    }
    if include_private:
        data.update({"created_by": event.created_by, "review_note": event.review_note,
                     "reviewed_by": event.reviewed_by,
                     "completed_at": event.completed_at.isoformat() if event.completed_at else None})
    return data


def notify(user_id, event_id, kind, message):
    db.session.add(Notification(user_id=user_id, event_id=event_id, type=kind, message=message))


def valid_event_payload(data):
    title = data.get("title")
    description = data.get("description")
    category = data.get("category")
    location = data.get("location_name")
    safety = data.get("safety_instructions")
    lat, lon = data.get("latitude"), data.get("longitude")
    capacity = data.get("capacity", 10)
    if not isinstance(title, str) or not 5 <= len(title.strip()) <= 120: raise ValueError("Title must be 5–120 characters")
    if not isinstance(description, str) or not 20 <= len(description.strip()) <= 3000: raise ValueError("Description must be 20–3000 characters")
    if category not in CATEGORIES: raise ValueError("Choose a valid activity category")
    if not isinstance(location, str) or not 3 <= len(location.strip()) <= 200: raise ValueError("Meeting location is required")
    if not isinstance(safety, str) or not 10 <= len(safety.strip()) <= 1500: raise ValueError("Safety instructions are required")
    if isinstance(lat, bool) or not isinstance(lat, (int,float)) or not math.isfinite(lat) or not -90 <= lat <= 90: raise ValueError("Invalid latitude")
    if isinstance(lon, bool) or not isinstance(lon, (int,float)) or not math.isfinite(lon) or not -180 <= lon <= 180: raise ValueError("Invalid longitude")
    if isinstance(capacity, bool) or not isinstance(capacity, int) or not 1 <= capacity <= 500: raise ValueError("Capacity must be between 1 and 500")
    starts = parse_dt(data.get("starts_at"))
    ends = parse_dt(data.get("ends_at"), required=False)
    deadline = parse_dt(data.get("registration_deadline"), required=False)
    now = datetime.now(timezone.utc)
    if starts <= now: raise ValueError("Activity must start in the future")
    if ends and ends <= starts: raise ValueError("End time must be after start time")
    if deadline and deadline > starts: raise ValueError("Registration deadline must be before the activity")
    return dict(title=title.strip(), description=description.strip(), category=category,
                location_name=location.strip(), latitude=float(lat), longitude=float(lon),
                starts_at=starts, ends_at=ends, registration_deadline=deadline,
                capacity=capacity, safety_instructions=safety.strip())


@community_bp.get("/stats")
def stats():
    approved = CommunityEvent.query.filter_by(status="APPROVED")
    completed = CommunityEvent.query.filter_by(status="COMPLETED")
    return jsonify({"approved_activities": approved.count(),
                    "upcoming_activities": approved.filter(CommunityEvent.starts_at > datetime.now(timezone.utc)).count(),
                    "volunteer_registrations": EventVolunteer.query.count(),
                    "completed_activities": completed.count(),
                    "unique_volunteers": db.session.query(func.count(func.distinct(EventVolunteer.user_id))).join(CommunityEvent).filter(CommunityEvent.status == "COMPLETED", EventVolunteer.attendance_status == "ATTENDED").scalar() or 0})


@community_bp.get("/events")
def list_events():
    requested_status = request.args.get("status", "APPROVED")
    if requested_status not in {"APPROVED", "COMPLETED"}: requested_status = "APPROVED"
    query = CommunityEvent.query.filter_by(status=requested_status)
    category = request.args.get("category")
    if category in CATEGORIES: query = query.filter_by(category=category)
    if requested_status == "APPROVED" and request.args.get("upcoming", "true").lower() == "true": query = query.filter(CommunityEvent.starts_at > datetime.now(timezone.utc))
    events = query.order_by(CommunityEvent.starts_at.asc()).limit(100).all()
    return jsonify({"events": [event_json(e) for e in events]})
@community_bp.get("/events/<int:event_id>")
@jwt_required(optional=True)
def event_detail(event_id):
    event = db.session.get(CommunityEvent, event_id)

    if not event:
        return jsonify({"error": "Event not found"}), 404

    user = current_user()

    if event.status == "PENDING":
        if not user or (
            user.id != event.created_by and user.role.value != "admin"
        ):
            return jsonify({"error": "Event not found"}), 404

    elif event.status not in {"APPROVED", "COMPLETED"}:
        return jsonify({"error": "Event not found"}), 404
    updates = (
        EventUpdate.query
        .filter_by(event_id=event.id)
        .order_by(EventUpdate.created_at.desc())
        .limit(30)
        .all()
    )

    data = event_json(event)

    data["updates"] = [
        {
            "id": u.id,
            "message": u.message,
            "created_at": u.created_at.isoformat(),
        }
        for u in updates
    ]

    photos = (
        CommunityEventPhoto.query
        .filter_by(event_id=event.id)
        .order_by(CommunityEventPhoto.created_at.asc())
        .all()
    )

    storage = get_supabase_storage()

    data["photos"] = []

    for photo in photos:
        result = storage.storage.from_(STORAGE_BUCKET).create_signed_url(
            photo.photo_url,
            3600,
        )

        signed_url = (
            result.get("signedURL")
            or result.get("signedUrl")
        )

        data["photos"].append({
    "id": photo.id,
    "photo_type": photo.photo_type,
    "photo_url": signed_url,
    "created_at": photo.created_at.isoformat(),
    "latitude": photo.latitude,
    "longitude": photo.longitude,
    "location_accuracy": photo.location_accuracy,
})

    return jsonify({"event": data})

@community_bp.post("/events")
@jwt_required()
def propose_event():
    user = current_user()
    if user is None: return jsonify({"error": "Authentication required"}), 401
    data = request.get_json(silent=True)
    if not isinstance(data, dict): return jsonify({"error": "A JSON body is required"}), 400
    try:
        fields = valid_event_payload(data)
        report_id = data.get("related_report_id")
        if report_id is not None:
            related_report = db.session.get(Report, report_id) if isinstance(report_id, int) and not isinstance(report_id, bool) else None
            if related_report is None or (related_report.user_id != user.id and user.role.value != "admin"):
                raise ValueError("Related drainage report does not exist or you cannot link it")
    except (ValueError, TypeError) as exc: return jsonify({"error": str(exc)}), 400
    event = CommunityEvent(**fields, related_report_id=data.get("related_report_id"), created_by=user.id, status="PENDING")
    event.location = CommunityEvent.point_wkt(event.latitude, event.longitude)
    db.session.add(event)
    try: db.session.commit()
    except SQLAlchemyError:
        db.session.rollback(); return jsonify({"error": "Could not save proposal"}), 500
    return jsonify({"message": "Your community activity proposal has been submitted successfully. It will become visible to other citizens after administrator approval.", "event": event_json(event, True)}), 201


@community_bp.get("/my-events")
@jwt_required()
def my_events():
    user = current_user()
    if user is None: return jsonify({"error": "Authentication required"}), 401
    proposed = CommunityEvent.query.filter_by(created_by=user.id).order_by(CommunityEvent.created_at.desc()).all()
    joined = CommunityEvent.query.join(EventVolunteer).filter(EventVolunteer.user_id == user.id).order_by(CommunityEvent.starts_at.desc()).all()
    return jsonify({"proposed": [event_json(e, True) for e in proposed], "joined": [event_json(e) for e in joined]})


@community_bp.post("/events/<int:event_id>/join")
@jwt_required()
def join_event(event_id):
    user = current_user()
    if user is None: return jsonify({"error": "Authentication required"}), 401
    try:
        event = CommunityEvent.query.filter_by(id=event_id).with_for_update().one_or_none()
        if not event or event.status != "APPROVED": return jsonify({"error": "Approved event not found"}), 404
        now = datetime.now(timezone.utc)
        if event.starts_at <= now or (event.ends_at and event.ends_at <= now): return jsonify({"error": "This activity is no longer open for registration"}), 409
        if event.registration_deadline and event.registration_deadline <= now: return jsonify({"error": "Registration is closed"}), 409
        if EventVolunteer.query.filter_by(event_id=event.id, user_id=user.id).first(): return jsonify({"error": "You are already registered"}), 409
        if count_volunteers(event.id) >= event.capacity: return jsonify({"error": "This activity is full"}), 409
        db.session.add(EventVolunteer(event_id=event.id, user_id=user.id))
        db.session.flush()
        notify(user.id, event.id, "VOLUNTEER_JOINED", f"You joined {event.title}.")
        if event.created_by != user.id: notify(event.created_by, event.id, "VOLUNTEER_REGISTERED", f"A volunteer joined {event.title}.")
        db.session.commit()
        return jsonify({"message": "You have successfully joined this activity.", "volunteer_count": count_volunteers(event.id)}), 201
    except IntegrityError:
        db.session.rollback(); return jsonify({"error": "You are already registered"}), 409
    except SQLAlchemyError:
        db.session.rollback(); return jsonify({"error": "Could not complete registration"}), 500


@community_bp.delete("/events/<int:event_id>/join")
@jwt_required()
def leave_event(event_id):
    user = current_user()
    event = db.session.get(CommunityEvent, event_id)

    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if not event or event.status != "APPROVED":
        return jsonify({"error": "Event not found"}), 404

    now = datetime.now(timezone.utc)

    if event.starts_at <= now or (
        event.registration_deadline and event.registration_deadline <= now
    ):
        return jsonify({"error": "Registration withdrawal is closed"}), 409

    registration = EventVolunteer.query.filter_by(
        event_id=event_id, user_id=user.id
    ).first()

    if not registration:
        return jsonify({"error": "You are not registered"}), 404

    db.session.delete(registration)

    if event.created_by != user.id:
        notify(
            event.created_by,
            event.id,
            "VOLUNTEER_LEFT",
            f"{user.name} has left your activity: {event.title}."
        )

    db.session.commit()

    return jsonify({"message": "You have left this activity."})
@community_bp.post("/events/<int:event_id>/photos")
@jwt_required()
def upload_event_photos(event_id):
    user = current_user()

    if user is None:
        return jsonify({"error": "Authentication required"}), 401

    event = db.session.get(CommunityEvent, event_id)

    if not event:
        return jsonify({"error": "Activity not found"}), 404

    photo_type = request.form.get("photo_type", "").upper()

    if photo_type not in {"BEFORE", "AFTER"}:
        return jsonify({"error": "Photo type must be BEFORE or AFTER"}), 400

    is_admin = user.role.value == "admin"
    is_organizer = user.id == event.created_by

    if not is_admin and not is_organizer:
        return jsonify({"error": "Only the organizer can upload activity photos"}), 403

    if photo_type == "BEFORE" and event.status not in {"PENDING", "APPROVED"}:
        return jsonify({"error": "Before photos can only be uploaded for pending or approved activities"}), 409
    
    if photo_type == "AFTER" and event.status not in {"APPROVED", "COMPLETED"}:
        return jsonify({"error": "After photos can only be uploaded for approved or completed activities"}), 409

    files = request.files.getlist("photos")

    if not files or len(files) > 5:
        return jsonify({"error": "Upload between 1 and 5 photos per request"}), 400

    allowed_types = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    latitude = request.form.get("latitude")
    longitude = request.form.get("longitude")
    location_accuracy = request.form.get("location_accuracy")

    try:
        latitude = float(latitude) if latitude else None
        longitude = float(longitude) if longitude else None
        location_accuracy = (
            float(location_accuracy) if location_accuracy else None
        )

        if (latitude is None) != (longitude is None):
            raise ValueError("Latitude and longitude must be provided together")

        if latitude is not None and not -90 <= latitude <= 90:
            raise ValueError("Invalid GPS latitude")

        if longitude is not None and not -180 <= longitude <= 180:
            raise ValueError("Invalid GPS longitude")

        if location_accuracy is not None and location_accuracy < 0:
            raise ValueError("Invalid GPS accuracy")

    except (ValueError, TypeError):
        return jsonify({"error": "Invalid GPS coordinates"}), 400

    storage = get_supabase_storage()
    uploaded_paths = []
    saved_photos = []

    try:
        for photo in files:
            if not photo or photo.mimetype not in allowed_types:
                raise ValueError("Only JPEG, PNG and WebP images are allowed")

            content = photo.stream.read(5 * 1024 * 1024 + 1)

            if not content or len(content) > 5 * 1024 * 1024:
                raise ValueError("Each photo must be smaller than 5 MB")

            extension = allowed_types[photo.mimetype]

            object_path = (
                f"{event_id}/{photo_type.lower()}/{uuid.uuid4().hex}.{extension}"
            )

            storage.storage.from_(STORAGE_BUCKET).upload(
                object_path,
                content,
                file_options={
                    "content-type": photo.mimetype,
                    "upsert": "false",
                },
            )

            uploaded_paths.append(object_path)

            photo_record = CommunityEventPhoto(
    event_id=event_id,
    photo_url=object_path,
    photo_type=photo_type,
    uploaded_by=user.id,
    latitude=latitude,
    longitude=longitude,
    location_accuracy=location_accuracy,
)

            db.session.add(photo_record)
            saved_photos.append(photo_record)

        db.session.commit()

        return jsonify({
            "message": "Photos uploaded successfully",
            "photos": [
                {
                    "id": photo.id,
                    "photo_type": photo.photo_type,
                    "photo_url": photo.photo_url,
                }
                for photo in saved_photos
            ],
        }), 201

    except ValueError as exc:
        db.session.rollback()
        for path in uploaded_paths:
            storage.storage.from_(STORAGE_BUCKET).remove([path])
        return jsonify({"error": str(exc)}), 400

    except Exception:
        db.session.rollback()
        for path in uploaded_paths:
            try:
                storage.storage.from_(STORAGE_BUCKET).remove([path])
            except Exception:
                pass
        return jsonify({"error": "Photo upload failed. Please try again."}), 500
@community_bp.get("/notifications")
@jwt_required()
def notifications():
    user = current_user(); rows = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(100).all()
    return jsonify({"notifications": [{"id": n.id, "event_id": n.event_id, "type": n.type, "message": n.message, "created_at": n.created_at.isoformat(), "read_at": n.read_at.isoformat() if n.read_at else None} for n in rows], "unread_count": sum(n.read_at is None for n in rows)})


@community_bp.patch("/notifications/<int:notification_id>/read")
@jwt_required()
def mark_notification_read(notification_id):
    user = current_user(); row = Notification.query.filter_by(id=notification_id, user_id=user.id).one_or_none()
    if not row: return jsonify({"error": "Notification not found"}), 404
    row.read_at = row.read_at or datetime.now(timezone.utc); db.session.commit()
    return jsonify({"message": "Notification marked as read"})


@community_bp.patch("/notifications/read-all")
@jwt_required()
def mark_all_read():
    user = current_user(); Notification.query.filter_by(user_id=user.id, read_at=None).update({"read_at": datetime.now(timezone.utc)})
    db.session.commit(); return jsonify({"message": "All notifications marked as read"})


@admin_community_bp.get("/events")
@admin_required
def admin_events():
    status = request.args.get("status")
    query = CommunityEvent.query
    if status in {"PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"}: query = query.filter_by(status=status)
    return jsonify({"events": [event_json(e, True) for e in query.order_by(CommunityEvent.created_at.desc()).limit(200).all()]})


@admin_community_bp.patch("/events/<int:event_id>/review")
@admin_required
def review_event(event_id):
    admin = current_user(); data = request.get_json(silent=True) or {}; decision = data.get("status"); note = data.get("review_note", "")
    if decision not in STATUSES: return jsonify({"error": "Status must be APPROVED or REJECTED"}), 400
    if not isinstance(note, str) or len(note) > 500: return jsonify({"error": "Review note must be 500 characters or fewer"}), 400
    event = db.session.get(CommunityEvent, event_id)
    if not event: return jsonify({"error": "Event not found"}), 404
    if event.status != "PENDING": return jsonify({"error": "Only pending proposals can be reviewed"}), 409
    event.status = decision; event.reviewed_by = admin.id; event.review_note = note.strip() or None
    message = f'Your proposal "{event.title}" was approved.' if decision == "APPROVED" else f'Your proposal "{event.title}" was rejected. Reason: {event.review_note or "Please contact the administration."}'
    notify(event.created_by, event.id, f"PROPOSAL_{decision}", message)
    db.session.commit(); return jsonify({"message": "Proposal reviewed", "event": event_json(event, True)})


@admin_community_bp.patch("/events/<int:event_id>/status")
@admin_required
def update_event_status(event_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in {"CANCELLED", "COMPLETED"}:
        return jsonify({"error": "Status must be CANCELLED or COMPLETED"}), 400

    event = db.session.get(CommunityEvent, event_id)

    if not event:
        return jsonify({"error": "Event not found"}), 404

    if event.status != "APPROVED":
        return jsonify({"error": "Only approved events can be changed"}), 409

    if status == "COMPLETED":
        before_count = CommunityEventPhoto.query.filter_by(
            event_id=event.id, photo_type="BEFORE"
        ).count()

        after_count = CommunityEventPhoto.query.filter_by(
            event_id=event.id, photo_type="AFTER"
        ).count()

        if before_count == 0 or after_count == 0:
            return jsonify({
                "error": "Upload both BEFORE and AFTER photos before completing this activity."
            }), 409

    event.status = status

    if status == "COMPLETED":
        event.completed_at = datetime.now(timezone.utc)

    for row in EventVolunteer.query.filter_by(event_id=event.id).all():
        notify(
            row.user_id,
            event.id,
            f"EVENT_{status}",
            f'{event.title} was {status.lower()}.'
        )

    db.session.commit()

    return jsonify({
        "message": "Event status updated",
        "event": event_json(event, True)
    })

@community_bp.post("/events/<int:event_id>/updates")
@jwt_required()
def publish_update(event_id):
    user = current_user(); data = request.get_json(silent=True) or {}; message = data.get("message")
    event = db.session.get(CommunityEvent, event_id)
    if not event or event.status != "APPROVED": return jsonify({"error": "Event not found"}), 404
    if user.id != event.created_by and user.role.value != "admin": return jsonify({"error": "Organizer access required"}), 403
    if not isinstance(message, str) or not 5 <= len(message.strip()) <= 1000: return jsonify({"error": "Update must be 5–1000 characters"}), 400
    db.session.add(EventUpdate(event_id=event.id, author_id=user.id, message=message.strip()))
    for row in EventVolunteer.query.filter_by(event_id=event.id).all(): notify(row.user_id, event.id, "ORGANIZER_UPDATE", f"Update for {event.title}: {message.strip()[:350]}")
    db.session.commit(); return jsonify({"message": "Update published"}), 201


@admin_community_bp.get("/events/<int:event_id>/volunteers")
@admin_required
def event_volunteers(event_id):
    event = db.session.get(CommunityEvent, event_id)
    if not event: return jsonify({"error": "Event not found"}), 404
    rows = EventVolunteer.query.filter_by(event_id=event_id).order_by(EventVolunteer.joined_at.asc()).all()
    return jsonify({"volunteers": [{"user_id": r.user_id, "name": r.user.name if r.user else "Participant", "joined_at": r.joined_at.isoformat(), "attendance_status": r.attendance_status} for r in rows]})


@admin_community_bp.patch("/events/<int:event_id>/attendance")
@admin_required
def update_attendance(event_id):
    event = db.session.get(CommunityEvent, event_id)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    if event.status != "COMPLETED":
        return jsonify({"error": "Attendance can only be verified after an event is completed"}), 409
    data = request.get_json(silent=True) or {}
    entries = data.get("attendance")
    if not isinstance(entries, list) or len(entries) > 500:
        return jsonify({"error": "Attendance must be a list of at most 500 entries"}), 400
    allowed = {"ATTENDED", "ABSENT"}
    registrations = {r.user_id: r for r in EventVolunteer.query.filter_by(event_id=event.id).all()}
    for item in entries:
        if not isinstance(item, dict) or isinstance(item.get("user_id"), bool) or not isinstance(item.get("user_id"), int) or item.get("status") not in allowed:
            return jsonify({"error": "Each entry needs a registered user_id and ATTENDED or ABSENT status"}), 400
        registration = registrations.get(item["user_id"])
        if registration is None:
            return jsonify({"error": "Attendance can only be recorded for registered volunteers"}), 400
        registration.attendance_status = item["status"]
    db.session.commit()
    return jsonify({"message": "Attendance records updated"})


@community_bp.get("/events/<int:event_id>/volunteers")
@jwt_required()
def organizer_volunteers(event_id):
    user = current_user()
    event = db.session.get(CommunityEvent, event_id)
    if not event or event.status not in {"APPROVED", "COMPLETED"}:
        return jsonify({"error": "Event not found"}), 404
    if user.id != event.created_by and user.role.value != "admin":
        return jsonify({"error": "Organizer access required"}), 403
    rows = EventVolunteer.query.filter_by(event_id=event_id).order_by(EventVolunteer.joined_at.asc()).all()
    return jsonify({"volunteers": [{"user_id": r.user_id, "name": r.user.name if r.user else "Participant", "joined_at": r.joined_at.isoformat(), "attendance_status": r.attendance_status} for r in rows]})
