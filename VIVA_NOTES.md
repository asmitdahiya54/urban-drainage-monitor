# Urban Drainage Monitor — Evaluation / viva notes

Short factual answers based only on what is actually implemented.

## Project and context

**What problem does the project solve?**
Blocked, silted and overflowing urban drains cause flooding, waterlogging and
health risks, but complaints are scattered and un-mapped. The platform collects
drainage reports with exact locations, shows them publicly on a map, gives
municipal staff a tracked workflow, aggregates analytics for prioritisation, and
reduces duplicate reports for the same physical problem.

**Why is this a community / SDG project?**
The reporters are residents, not officials — the community is the sensor network.
The map is public without login, so the state of the city's drainage and the
progress on complaints is visible to everyone, while citizen identities are never
exposed publicly.

**Which SDGs are addressed?**
SDG 6 (clean water and sanitation), SDG 11 (sustainable cities and communities)
and SDG 13 (climate action), with a supporting link to SDG 9 (infrastructure).

## Technology choices

**Why PostgreSQL + PostGIS?**
Every report is a geographic point, and the core questions are spatial: what is
near this location, where do reports cluster, how spread out are they. PostGIS
answers those inside the database with `ST_DWithin`, `ST_Distance`,
`ST_ClusterDBSCAN` and centroid/aggregate functions, using GiST spatial indexes,
instead of pulling all rows into Python. Locations are stored as
`geography(POINT, 4326)`, so distances come back in real metres.

**Why Leaflet?**
It is open source, needs no API key or billing account, works with OpenStreetMap
tiles, and supports everything needed here: click-to-pick location, markers,
circles for hotspots and a heatmap layer.

**Why Flask?**
A small, explicit REST API is all the frontend needs. The app uses the Flask
application factory pattern with blueprints per feature area (auth, reports,
admin, map, risk, civic), SQLAlchemy 2 for models and Flask-Migrate/Alembic for
migrations.

**Why not TensorFlow / deep learning?**
There is no large labelled dataset. With a few hundred crowdsourced reports and a
proxy target, an explainable logistic-regression baseline is the defensible
choice; a deep model would only look impressive while being unjustifiable.

## Core functionality

**How does location-based reporting work?**
The citizen clicks the Leaflet map (or uses browser geolocation where permitted).
The chosen latitude/longitude is sent to Flask, which validates the ranges, and
PostGIS stores it as `POINT(longitude latitude)` with SRID 4326 —
longitude-first, which is the usual source of bugs in spatial code.

**How are users authenticated?**
Passwords are hashed with Werkzeug (never stored in plain text). Login returns a
JWT access token (Flask-JWT-Extended) with an expiry; the frontend sends it as an
`Authorization: Bearer …` header. Invalid credentials always return the same
generic error so accounts cannot be probed.

**How are citizen and admin roles separated?**
`role` is a column on `users`. Public registration always creates a **citizen** —
a role field in the request is ignored. Admin-only endpoints re-read the user's
role from the database rather than trusting the token payload. Citizens can only
read their own reports; requesting someone else's returns 403.

**How does the admin workflow work?**
`NEW → PENDING_VERIFICATION → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED`, with
a `NEW → VERIFIED` shortcut, rejection allowed from the early states, and
`RESOLVED` / `REJECTED` terminal. Invalid transitions are rejected server-side.
Every accepted change writes a row to `report_status_history` with the admin,
timestamp and optional comment; `resolved_at` is recorded on resolution.

**How does duplicate detection work?**
Before saving, the backend asks PostGIS for reports within **100 metres** and the
last **30 days** using `ST_DWithin` / `ST_Distance` on the indexed geography
column. A confidence score combines distance, same issue type, active status,
freshness and matching severity. A likely duplicate needs the same issue type, an
active status and confidence at or above the threshold. The citizen sees the
existing report's ID, issue type, status and distance, and chooses **Continue
Anyway** or **Cancel** — nothing is auto-rejected or deleted, and resolved or
rejected reports are shown as context only, never as blocking duplicates.

**Why 100 metres?**
It is roughly the length of one street segment: close enough that two reports are
plausibly the same drain, wide enough to absorb GPS/manual-pin inaccuracy of tens
of metres, and narrow enough not to merge genuinely different drains on
neighbouring streets. It is a configurable parameter, not a hard assumption.

## Analytics, ML and civic data

**What do the analytics show, and where are they computed?**
Totals, breakdowns by status/severity/issue type, daily and monthly trends,
average and median time to resolve, and the geographic spread of reports — all
aggregated by SQL/PostGIS in one admin-only endpoint. The browser never counts
records itself.

**What is the ML model actually predicting?**
Reports are aggregated into small grid areas with PostGIS. Nine numeric features
are engineered per area (report count, recent report count, high/critical count,
unresolved count, density, recency, issue-type spread and related signals). The
model is `StandardScaler` + class-balanced `LogisticRegression` with a fixed
random seed, so training is reproducible. It outputs a relative area risk score,
banded into LOW / MEDIUM / HIGH.

**Why can't you claim accuracy?**
Because there are no real flood-outcome labels. The target is a documented
**proxy** derived from report volume, severity, backlog and recency — not measured
flooding. It also inherits reporting bias (engaged neighbourhoods look riskier)
and the dataset is small, so no meaningful validation score can be claimed. The
UI always states: *"Prototype risk prediction based on available crowdsourced
report data. Predictions are not official flood warnings."*

**What would make the model meaningful?**
Historical rainfall time series, verified flood incident records with dates and
locations, drainage infrastructure data (capacity, condition, maintenance),
elevation/terrain, land use and population density, and municipal validation of
reports. The feature pipeline (`backend/services/risk.py`) and the model
(`ml/risk_model.py`) are separated so those become extra feature columns and a
real label without rewriting the platform.

**What is the civic / environmental data?**
Rainfall, drainage-infrastructure, flood-incident and municipal-service records
shown in an admin section through a pluggable provider layer.

**Why is the civic data labelled demo?**
No verified, publicly accessible government API was available for this
implementation, so inventing one would be dishonest. The default provider returns
clearly labelled placeholder records and every response and screen carries
**"DEMO DATA — NOT OFFICIAL GOVERNMENT DATA"**. No government organisation is
named as a source.

**How would a real government API be connected?**
Set `CIVIC_API_BASE_URL` (plus optional key/header/source-name variables) in the
server environment. The provider layer then calls that API instead of the demo
provider, maps its records into the same safe shape, keeps the API key
server-side (never returned or logged), and already handles timeouts, HTTP 429
rate limiting, non-2xx responses and malformed payloads.

## Security

**What security measures were implemented?**
Hashed passwords; JWT authentication with token expiry; admin role re-checked in
the database rather than trusted from the token; server-side validation of all
fields, enums and coordinate ranges; email/password length caps before any
database or hash work; admin search length-capped with SQL `LIKE` wildcards
escaped; a whitelist on the only interpolated SQL column names; a 1 MB request
body limit; safe JSON error responses with no stack traces; debug mode off by
default; protective headers (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Cache-Control`, `Permissions-Policy`); explicit CORS origin
allowlist with no wildcard; all secrets from environment variables only; and
privacy-safe public endpoints that never return names, emails or user IDs.
28 automated security regression tests cover these.

**What are the current security limitations?**
No login rate limiting or account lockout (needs an extra dependency or a proxy
rule). Logout clears the client session but cannot revoke an already-issued JWT
before it expires, because there is no token blocklist. No admin audit log beyond
report status history. The system is hardened, not perfectly secure.

## Deployment and failure behaviour

**How is the system deployed?**
Frontend published on Lovable; the browser calls same-origin `/api/*`, which a
server-side proxy forwards to the Flask API; Flask runs under Gunicorn
(`backend.wsgi:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`) on a Render
Free Web Service; the database is Supabase PostgreSQL + PostGIS. The
configuration is complete and documented, but the backend deployment itself is
still pending because it requires account-side actions (creating the Supabase
project, pasting the connection string, starting the Render service).

**Why Render + Supabase?**
Both have usable free tiers for a college project, Render runs a standard Python
WSGI service with no container work, and Supabase provides managed PostgreSQL
with PostGIS available — which a plain hosted database often does not.

**Why is the connection string the Supabase "Session pooler" one?**
It is IPv4-reachable from Render Free and suits the long-lived connections
SQLAlchemy uses.

**What happens if Render sleeps?**
Render Free web services sleep after roughly 15 minutes of inactivity; the next
request wakes the instance and can take 30–60 seconds. Availability is not
guaranteed on a free plan — worth warming the service up before a demo.

**What happens if the civic API fails?**
The provider layer catches timeouts, rate limiting (HTTP 429), non-2xx responses
and malformed payloads, and returns a safe error the admin UI displays as an
error state. The API key is never included in the error. The rest of the
dashboard keeps working.

**What happens if duplicate detection fails?**
It is non-blocking. If the check cannot complete, the report form still lets the
citizen submit; a failing check never silently discards a report.

**What happens if there is insufficient ML data?**
Training returns a clear "insufficient data" response instead of a model, and the
admin UI shows that state. Degenerate data (no variance between areas) is handled
the same way rather than producing fake confident predictions.

**How is the system tested?**
150 pytest tests run against a real PostgreSQL + PostGIS database: 18 auth, 18
citizen reporting, 16 admin management, 10 public map/spatial, 9 analytics, 11
duplicate detection, 16 ML prototype, 24 civic data and 28 security regression
tests. Plus frontend type checks, lint, a production build, a Gunicorn health
check and browser verification of the citizen, admin and public flows.

**What would you build next?**
Complete the Render + Supabase deployment, add photo upload, connect real
rainfall and verified flood-incident data to the model, connect a verified
official civic API, add notifications on status changes, and add login rate
limiting plus JWT revocation.
