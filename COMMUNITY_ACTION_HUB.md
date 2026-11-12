# Community Action Hub integration

This update adds a first end-to-end Community Action Hub slice to the existing Urban Drainage Monitor application.

## Included

- Citizen activity proposals are persisted as `PENDING` and cannot set their own approval status.
- Public activity listings and details expose only approved or completed activities.
- Administrator review, cancellation and completion APIs use the existing database-backed `admin_required` authorization.
- Volunteer registration and withdrawal use JWT identity, capacity checks, a PostgreSQL row lock and a unique `(event_id, user_id)` constraint.
- Private in-app notifications for proposal decisions, volunteer signups and event status changes.
- Organizer announcements and notifications to registered volunteers.
- Administrator volunteer roster and attendance verification endpoints.
- React routes for browsing/proposing, event details, My Activities, Notifications and admin review.
- Community statistics are queried from database records; attendance-based unique volunteer totals remain zero until an administrator records attendance.

## Database migration

The migration is additive and does not alter existing report/user records:

```bash
flask --app backend.app db upgrade
```

The new revision is `7c2f9a1b4d60` and follows `5ee70871431e`. PostGIS must already be enabled, as it is for the existing report schema.

For local migration generation in future schema changes:

```bash
flask --app backend.app db migrate -m "describe change"
flask --app backend.app db upgrade
```

Review migrations before applying them to Supabase production. Back up the database and test the migration in staging first.

## Main API routes

- `GET /api/community/stats`
- `GET /api/community/events?category=...&status=APPROVED|COMPLETED`
- `GET /api/community/events/<id>`
- `POST /api/community/events`
- `GET /api/community/my-events`
- `POST|DELETE /api/community/events/<id>/join`
- `POST /api/community/events/<id>/updates`
- `GET /api/community/notifications`
- `PATCH /api/community/notifications/<id>/read`
- `PATCH /api/community/notifications/read-all`
- `GET /api/admin/community/events?status=PENDING`
- `PATCH /api/admin/community/events/<id>/review`
- `PATCH /api/admin/community/events/<id>/status`
- `GET /api/admin/community/events/<id>/volunteers`
- `PATCH /api/admin/community/events/<id>/attendance`

## Safety and limitations

Community activities are for safe, authorized awareness, observation and public-area activities only. Volunteers must not enter drains, handle sewage, remove hazardous waste or perform infrastructure repairs. The relevant municipal authority must handle hazardous work and repairs.

The UI does not claim that a drainage report was repaired. Completed activities and verified attendance are separate concepts. Before/after media uploads, scheduled reminders, distance-based nearby search and an organizer-facing volunteer roster UI are not included in this first integration slice.

## Verification

Python source files were syntax-compiled with `python -m compileall -q backend`. Full backend tests require the project's configured PostgreSQL/PostGIS test database and the dependencies in `backend/requirements.txt`. Frontend build/type/lint checks could not be run in this environment because dependency installation did not complete. Run the repository's normal `npm ci`, frontend build and lint checks before deploying.
