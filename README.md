# Urban Drainage Monitor

A community / SDG-based, crowdsourced urban drainage issue reporting,
monitoring and risk-analysis platform.

> Citizens report drainage problems with a map location → Flask validates and
> stores them in PostgreSQL/PostGIS → the city sees hotspots, analytics and a
> prototype risk model → duplicate reports for the same problem are caught
> before they pile up.

Companion documents: [DEMO.md](DEMO.md) (5–8 minute demonstration script) and
[VIVA_NOTES.md](VIVA_NOTES.md) (evaluation questions and factual answers).

## Problem statement

Blocked, silted and overflowing urban drains cause street flooding, waterlogging,
property damage, traffic disruption and water-borne health risks. Complaints today
are scattered across phone calls, social media posts and walk-ins, so:

- residents have no way to see whether a problem was already reported,
- municipal teams have no single, location-accurate picture of where problems concentrate,
- the same drain is reported many times while other areas go unrecorded,
- there is no historical, geographic record to prioritise maintenance with.

## Community context

Drainage is a shared civic asset: one blocked drain floods a whole street. The
people who see the problem first are residents, not officials. This project treats
residents as the primary sensor network — anyone can register, report a problem
with a precise location, and follow what happens to it — while an admin
(municipal staff) role verifies, assigns and resolves reports. The public map is
open without login, so accountability is visible to the whole community, while
citizen identities are never exposed on public endpoints.

## Objectives

1. Let a resident report a drainage problem in under a minute: issue type,
   severity, description and an exact map location.
2. Show every reported problem on an open public map with filters and a
   heatmap so hotspots are visible.
3. Give municipal staff a workflow: verify → assign → in progress → resolved,
   with a full status history.
4. Aggregate the data into analytics that support maintenance prioritisation.
5. Reduce duplicate reporting of the same physical problem.
6. Demonstrate, as an explicitly labelled prototype, how area-level drainage
   risk could be modelled from the collected data.
7. Provide a clean integration layer for official civic / environmental data.

## SDG mapping

| SDG | How this project relates |
| --- | --- |
| **SDG 6 — Clean water and sanitation** | Faster identification and resolution of blocked/overflowing drains and sewage overflow, reducing contaminated standing water. |
| **SDG 11 — Sustainable cities and communities** | Community participation in urban infrastructure monitoring; geographic evidence for municipal maintenance planning. |
| **SDG 13 — Climate action** | Waterlogging and urban flooding worsen with heavier rainfall events; the platform builds the local record needed to adapt. |
| **SDG 9 — Industry, innovation and infrastructure** (supporting) | Spatial data and analytics applied to drainage infrastructure upkeep. |

## Key features

- Citizen registration and login with role-based access (citizen / admin).
- Drainage issue reporting with issue type, severity, description and a
  Leaflet map location (plus browser geolocation where the device allows it).
- Duplicate detection using PostGIS distance queries, with a warning the
  citizen can accept or cancel — nothing is auto-deleted or auto-rejected.
- "My Reports", report detail view and a status timeline for every citizen.
- Public GIS map (no login) with markers, filters, heatmap and PostGIS hotspot
  clustering — privacy-safe, no citizen identity exposed.
- Admin dashboard: live statistics, filter/search/paginated report table,
  report detail, validated status transitions and history.
- Analytics aggregated in SQL/PostGIS: totals, breakdowns, trends over time,
  resolution metrics and geographic spread.
- ML risk-prediction **prototype** producing LOW / MEDIUM / HIGH area scores
  from crowdsourced report features and a documented proxy target.
- Civic / environmental data integration layer, currently served by a clearly
  labelled **demo** provider.
- Security hardening: hashed passwords, JWT auth, database-backed admin checks,
  input limits, safe JSON errors, protective headers, restricted CORS.
- 150 automated backend tests against a real PostgreSQL + PostGIS database.

## System architecture

```text
                    ┌───────────────────────────┐
                    │     Lovable React PWA     │
                    │                           │
                    │ Citizen + Admin UI        │
                    │ Leaflet GIS Maps          │
                    │ Analytics                 │
                    │ Risk Visualization        │
                    │ Civic Data UI             │
                    └─────────────┬─────────────┘
                                  │
                                  │ /api
                                  ▼
                    ┌───────────────────────────┐
                    │     Flask REST API        │
                    │                           │
                    │ Authentication            │
                    │ Reports                   │
                    │ Admin                     │
                    │ GIS / PostGIS queries     │
                    │ Duplicate detection       │
                    │ Analytics                 │
                    │ ML prototype              │
                    │ Civic data provider       │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │ Supabase PostgreSQL       │
                    │ + PostGIS                 │
                    │                           │
                    │ Users                     │
                    │ Reports                   │
                    │ Status history            │
                    │ Risk predictions          │
                    │ Spatial indexes           │
                    └───────────────────────────┘
```

**Request path.** The browser only ever calls `/api/*` on its own origin
(`VITE_API_URL=/api`). A server-side route (`src/routes/api.$.ts`) forwards those
calls to the Flask API, so no backend host is baked into the browser bundle. In
local development the proxy targets `http://127.0.0.1:5000`; in production it
targets the deployed Render service (`BACKEND_URL` / `src/config/backend.ts`).

**Intended production topology.**

```text
Lovable frontend  →  Render Flask API (gunicorn)  →  Supabase PostgreSQL + PostGIS
```

**Current deployment state — important.** The frontend is published at
<https://flowfinder-community.lovable.app>. The Render + Supabase production
setup is fully *prepared and documented* (`render.yaml`, `Procfile`,
`backend/wsgi.py`, environment variable list, migration command, proxy target),
but **the production backend has not been deployed**: creating the Supabase
project, entering the connection string and starting the Render service require
account-side actions by the project owner. See "Production deployment — Render +
Supabase (Step 12)" below. Until that is done, the full end-to-end system runs
locally only.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite (TypeScript/TSX, TanStack Start routing) |
| Maps | Leaflet + react-leaflet (markers, heatmap, hotspot circles) |
| Backend | Python 3 + Flask (application factory, blueprints) |
| ORM / migrations | SQLAlchemy 2 + Flask-Migrate (Alembic) |
| Database | PostgreSQL + PostGIS (`geography(POINT, 4326)`, GiST indexes) |
| Auth | Flask-JWT-Extended (bearer tokens), Werkzeug password hashing |
| ML | Python + scikit-learn (StandardScaler + Logistic Regression baseline) |
| Production server | Gunicorn (`backend.wsgi:app`) |
| Hosting (intended) | Lovable (frontend), Render Free Web Service (API), Supabase (database) |
| Tests | pytest against a real PostgreSQL/PostGIS test database |

TensorFlow is intentionally **not** used: the available data does not justify a
deep-learning model, and an explainable baseline is the honest choice.

## Feature inventory (implemented only)

### A. Citizen features

- Registration and login (public registration always creates a citizen role).
- Report a drainage issue: issue type, severity, description.
- Pick the location on an interactive Leaflet map.
- Use the device's current location where the browser/device permits it.
- Duplicate warning for a similar nearby report, with **Continue Anyway** / **Cancel**.
- "My Reports" list and per-report detail page with a read-only location map.
- Status timeline showing every status change on their report.

### B. Public features (no login)

- Public GIS map at `/map`.
- Report markers with issue type, severity, status and timestamp.
- Filters (issue type, severity, status, time window).
- Heatmap / spatial visualisation and PostGIS hotspot clusters.
- Privacy-safe report information only — no names, emails or user IDs.
- Prototype risk areas overlay, labelled as a prototype.

### C. Admin features

- Admin dashboard with live statistics.
- Report table with filters, text search and pagination.
- Report detail with location map and report metadata.
- Validated status updates with optional comment.
- Full status timeline per report.
- Analytics section: summary cards, trends, breakdowns, resolution metrics, spatial spread.
- ML risk-prediction prototype: train the model, view LOW/MEDIUM/HIGH areas and the indicators behind each score.
- Civic / environmental data section with a visible demo-data banner.
- Multi-marker monitoring map of all reports.

### D. System / backend capabilities

- Flask application factory, blueprints, environment-based configuration.
- JWT authentication with expiry; admin role re-checked in the database.
- Server-side validation of every field, coordinate range and enum value.
- PostGIS spatial queries: `ST_DWithin`, `ST_Distance`, `ST_ClusterDBSCAN`, centroids, aggregation.
- GiST spatial indexes on all geography columns.
- Alembic migration chain including PostGIS extension creation.
- SQL/PostGIS analytics aggregation (the browser never counts records itself).
- Safe JSON error responses, request size limits, protective HTTP headers, restricted CORS.
- `flask seed` command for clearly-labelled demo data (never run automatically).
- 150 pytest tests against a real PostgreSQL + PostGIS database.

### E. Prototype / future integration capabilities

- ML risk prediction prototype (proxy target, no real flood labels — see below).
- Civic / environmental data provider abstraction (demo provider by default; a
  real verified public API can be connected with environment variables alone).
- `risk_predictions` table storing area, score, level, indicators, model version
  and timestamp — no citizen data.

## Implementation status

```text
IMPLEMENTATION STATUS

Core MVP:                                     Complete
GIS mapping and spatial analysis:             Complete
Analytics:                                    Complete
Duplicate detection:                          Complete
ML risk prediction prototype:                 Complete
Civic/environmental data integration layer:   Complete
Security hardening:                           Complete
Automated backend tests:                      150 passing
Production deployment configuration:          Complete
Actual production deployment:                 Pending account-side Render/Supabase setup
```

## Testing summary

150 backend tests pass against a real PostgreSQL + PostGIS database (one
expected PyJWT warning, raised by a deliberately short attacker key inside a
security test). The counts below are the actual collected test counts per file:

| Area | Test file | Tests |
| --- | --- | --- |
| Authentication and roles | `backend/tests/test_auth.py` | 18 |
| Citizen reporting | `backend/tests/test_reports.py` | 18 |
| Admin report management | `backend/tests/test_admin_reports.py` | 16 |
| Public map / spatial analysis | `backend/tests/test_map.py` | 10 |
| Dashboard analytics | `backend/tests/test_admin_analytics.py` | 9 |
| Duplicate detection | `backend/tests/test_duplicates.py` | 11 |
| ML risk prediction prototype | `backend/tests/test_risk_predictions.py` | 16 |
| Civic / environmental data | `backend/tests/test_civic_data.py` | 24 |
| Security regression (Step 11) | `backend/tests/test_security.py` | 28 |
| **Total** | | **150** |

28 of those are the Step 11 security regression tests (authorization,
authentication, tampered tokens, privacy, injection attempts, malformed input,
headers, configuration).

Also verified:

- Frontend type check clean (`bunx tsgo --noEmit`).
- Lint: `bun run lint` reports **0 errors** (11 non-blocking warnings remain:
  React Fast-Refresh export hints and two `react-hooks/exhaustive-deps` notices).
- Production build succeeds (`bun run build`).
- Production server verified locally: Gunicorn serving `backend.wsgi:app`, with
  `/api/health` returning 200, protective headers and no version disclosure.
- Browser regression verification of the citizen, admin and public flows with no
  console errors.

Run them with:

```bash
# backend (needs PostgreSQL + PostGIS and TEST_DATABASE_URL)
python -m pytest

# frontend
bunx tsgo --noEmit
bun run lint
bun run build
```

## Project structure

```text
urban-drainage-monitor/
├── src/                          # Frontend (React 18 + Vite, TanStack Start)
│   ├── routes/                   # /, /login, /register, /report, /reports, /map, /dashboard, /admin
│   │   └── api.$.ts              # Server-side /api/* proxy to the Flask API
│   ├── components/               # UI, admin sections, maps, nav/footer
│   ├── config/backend.ts         # Which Flask origin the proxy targets
│   └── services/api.ts           # Typed API client (JWT handling, error mapping)
├── backend/
│   ├── app.py                    # Flask application factory + error handlers + headers
│   ├── wsgi.py                   # Production entry point (backend.wsgi:app)
│   ├── config.py                 # Environment-based configuration
│   ├── extensions.py             # SQLAlchemy + Migrate
│   ├── seed.py                   # `flask seed` demo data (opt-in)
│   ├── models/                   # users, reports, report_status_history, risk_predictions, enums
│   ├── routes/                   # health, auth, reports, admin, map, risk, civic
│   ├── services/                 # spatial, duplicates, analytics, risk, civic
│   ├── utils/                    # validators, auth helpers
│   ├── migrations/               # Alembic history (includes PostGIS extension)
│   ├── tests/                    # 150 pytest tests
│   └── requirements.txt
├── ml/                           # risk_model.py, train_risk_model.py, README
├── docs/                         # Additional documentation
├── DEMO.md                       # Demonstration script
├── VIVA_NOTES.md                 # Evaluation questions and answers
├── render.yaml                   # Render blueprint (no Render database)
├── Procfile                      # Gunicorn start command
├── .env.example                  # Placeholders only — never real credentials
└── README.md
```

## Known limitations

- **The production backend is not deployed yet** — Render + Supabase setup needs
  the owner's accounts. The published frontend cannot reach an API until then.
- **ML is a prototype**: no real flood-outcome labels exist, so no accuracy claim
  is made and predictions are not official flood warnings.
- **Civic / environmental data is demo data**, clearly labelled
  "DEMO DATA — NOT OFFICIAL GOVERNMENT DATA"; no government API is connected.
- No login rate limiting (would need an extra dependency or a proxy rule).
- Logout clears the client session but does not revoke an already-issued JWT
  before its expiry (no token blocklist).
- No image upload for reports.
- No email/SMS notifications to citizens on status changes.
- No admin audit log beyond report status history.
- Free-tier hosting: Render Free sleeps when idle and Supabase Free projects
  pause after long inactivity — availability is not guaranteed.
- Duplicate detection is geometric and categorical (distance, issue type,
  recency, status) — it does not compare photos or text semantics.

## Future improvements

- Deploy the backend on Render with Supabase and connect the published frontend.
- Photo upload with server-side validation and storage.
- Real rainfall, flood-history and drainage-capacity datasets feeding the model.
- Connect a verified official civic API through the existing provider layer.
- Notifications (email/SMS/push) on status changes.
- Login rate limiting and JWT revocation on logout.
- Assignment to specific municipal crews and SLA tracking.
- Offline-first reporting for poor connectivity.
- Multi-language UI for wider community reach.

## Detailed documentation

The sections below document each implementation stage in depth: database and
PostGIS design, local setup, authentication and roles, citizen reporting, admin
management, the public map and spatial analysis, analytics, duplicate detection,
the ML prototype, civic data integration, security hardening and production
deployment.

> Note on test numbers: any test count quoted *inside* a step section is the
> suite total **at that stage** of development. The current total is **150**
> (see "Testing summary" above).

## Database

### Tables

| Table | Purpose |
| --- | --- |
| `users` | Citizens and admins (`role` = `citizen` / `admin`, unique email) |
| `reports` | Drainage issue reports with a PostGIS `geography(POINT, 4326)` location |
| `report_status_history` | Audit trail of every status change on a report |
| `risk_predictions` | Flood/blockage risk points written later by the ML module |

### Relationships

```
users 1 ── many reports 1 ── many report_status_history
users 1 ── many report_status_history   (who changed the status)
```

Foreign keys: `reports.user_id → users.id` (ON DELETE CASCADE),
`report_status_history.report_id → reports.id` (CASCADE),
`report_status_history.changed_by → users.id` (SET NULL, so history survives
user deletion).

### Enumerations

- **Issue type:** `BLOCKED_DRAIN`, `WATERLOGGING`, `DRAIN_OVERFLOW`,
  `SEWAGE_OVERFLOW`, `DAMAGED_DRAIN`, `FLOODING`, `OTHER`
- **Severity:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **Status:** `NEW`, `PENDING_VERIFICATION`, `VERIFIED`, `ASSIGNED`,
  `IN_PROGRESS`, `RESOLVED`, `REJECTED`
- **Risk level:** `LOW`, `MEDIUM`, `HIGH`

These are stored as native PostgreSQL enum types, so the database itself
rejects invalid values.

### Coordinates

Each report stores plain `latitude` / `longitude` columns (easy to read and
validate, with CHECK constraints on the valid ranges) *and* a PostGIS
`geography(POINT, 4326)` column. PostGIS expects **`POINT(longitude latitude)`**,
which is what `Report.set_coordinates()` builds — never swap the order.

### Spatial indexes

```sql
CREATE INDEX idx_reports_location ON reports USING gist (location);
CREATE INDEX idx_risk_predictions_location ON risk_predictions USING gist (location);
```

A GiST spatial index stores an approximate bounding box for every geometry, so
PostgreSQL can discard almost all rows without measuring real distances.
Without it, a "reports within 500 m" query must compute the distance for every
row in the table (a full scan). With it, later features stay fast even with
hundreds of thousands of reports:

- reports near a location
- reports within a radius
- drainage hotspot clustering
- detecting nearby duplicate reports

### Migrations

We use **Flask-Migrate (Alembic)** rather than `db.create_all()`, so schema
changes are versioned, reviewable, and repeatable instead of requiring the
tables to be dropped and recreated. The migration environment is configured to
ignore PostGIS-managed tables such as `spatial_ref_sys`, and the first migration
runs `CREATE EXTENSION IF NOT EXISTS postgis` before creating spatial columns.

## Database setup (Step 2)

### 1. Install PostgreSQL

Install PostgreSQL 14 or newer:

- **Windows / macOS:** the installer from https://www.postgresql.org/download/
  (on Windows, keep Stack Builder — it offers PostGIS).
- **macOS (Homebrew):** `brew install postgresql@16`
- **Ubuntu/Debian:** `sudo apt install postgresql postgresql-contrib`

Verify: `psql --version`

### 2. Install PostGIS

- **Windows:** in Stack Builder choose *Spatial Extensions → PostGIS*.
- **macOS:** `brew install postgis`
- **Ubuntu/Debian:** `sudo apt install postgis postgresql-16-postgis-3`

### 3. Create the database and enable PostGIS

```bash
# create the database (enter your postgres password when prompted)
createdb -U postgres urban_drainage_db
# or, from inside psql:  CREATE DATABASE urban_drainage_db;

# enable the extension inside that database
psql -U postgres -d urban_drainage_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d urban_drainage_db -c "SELECT postgis_version();"
```

### 4. Configure `.env`

```bash
cp .env.example .env
```

Then edit `.env` and replace `YOUR_PASSWORD` with your local postgres password:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/urban_drainage_db
SECRET_KEY=change-this-in-development
FLASK_APP=backend.app
```

`.env` is git-ignored — never commit real credentials.

### 5. Install Python dependencies

Run from the **project root** (the folder containing `backend/`):

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 6. Run migrations

```bash
flask --app backend.app db upgrade
```

The migration history is already committed. If you later change a model:

```bash
flask --app backend.app db migrate -m "describe your change"
flask --app backend.app db upgrade
```

(`flask db init` is only needed once, and has already been done — the
`backend/migrations/` folder is in the repository.)

### 7. Seed demo data

```bash
flask --app backend.app seed
flask --app backend.app seed --reset   # wipe demo rows and re-insert
```

This creates 1 admin, 2 citizens, and 10 fictional drainage reports with mixed
locations, issue types, severities and statuses, plus their status history.
Demo passwords: `admin123` / `citizen123` (development only).

### 8. Start Flask

```bash
python -m backend.app
# or
flask --app backend.app run --port 5000
```

### 9. Test the database connection

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected",
  "postgis": "3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1",
  "message": "Urban Drainage Monitor API is running"
}
```

If the database is unreachable the endpoint returns HTTP 503 with
`"database": "disconnected"` and an error type only — never the connection
string or password.

### 10. Verify the data directly

```bash
psql -U postgres -d urban_drainage_db -c "\dt"
psql -U postgres -d urban_drainage_db -c "SELECT id, issue_type, severity, status, ST_AsText(location::geometry) FROM reports ORDER BY id;"
psql -U postgres -d urban_drainage_db -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('reports','risk_predictions');"

# example spatial query: reports within 3 km of a point
psql -U postgres -d urban_drainage_db -c "SELECT id, ROUND(ST_Distance(location, ST_GeogFromText('SRID=4326;POINT(77.2090 28.6139)'))) AS metres FROM reports WHERE ST_DWithin(location, ST_GeogFromText('SRID=4326;POINT(77.2090 28.6139)'), 3000) ORDER BY metres;"
```

### Common database errors and fixes

| Error | Fix |
| --- | --- |
| `type "geography" does not exist` | Run `CREATE EXTENSION IF NOT EXISTS postgis;` in `urban_drainage_db`. |
| `database "urban_drainage_db" does not exist` | Run `createdb -U postgres urban_drainage_db`. |
| `password authentication failed for user "postgres"` | Fix the password in `DATABASE_URL` in `.env`. |
| `could not connect to server: Connection refused` | Start PostgreSQL (`brew services start postgresql@16` / `sudo service postgresql start`). |
| `ModuleNotFoundError: No module named 'backend'` | Run commands from the project root, not from inside `backend/`. |
| `Error: Could not locate a Flask application` | Add `--app backend.app` or set `FLASK_APP=backend.app`. |
| `pg_config executable not found` (installing psycopg2) | `requirements.txt` uses `psycopg2-binary`; make sure you installed from it. |
| `Target database is not up to date` | Run `flask --app backend.app db upgrade`. |
| Coordinates appear swapped on a map | PostGIS uses `POINT(longitude latitude)`; use `Report.set_coordinates(lat, lng)`. |

## Getting started

### Frontend

The frontend runs as the main app (React + Vite):

```bash
bun install   # or npm install
bun run dev   # or npm run dev
```

Open http://localhost:8080 (or the port Vite reports).

### Backend

Run everything from the **project root**:

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
cp .env.example .env            # then edit DATABASE_URL
flask --app backend.app db upgrade
flask --app backend.app seed
python -m backend.app
```

The API runs at http://localhost:5000. Verify it:

```bash
curl http://localhost:5000/api/health
# {"status":"ok","database":"connected","postgis":"enabled","message":"Urban Drainage Monitor API is running"}
# (the exact PostGIS version is only included when EXPOSE_SERVER_DETAILS=1 or FLASK_DEBUG=1)
```

## Expected result (Step 2)

- A responsive landing page with the project name, description, "Report an
  Issue" and "View Drainage Map" buttons, and working navigation.
- `urban_drainage_db` with PostGIS enabled and the tables `users`, `reports`,
  `report_status_history`, `risk_predictions` plus GiST spatial indexes.
- 3 demo users and 10 demo reports inserted by the seed command.
- A Flask API whose `/api/health` returns `"status": "ok"` and
  `"database": "connected"`.

## Common errors and fixes

| Error | Fix |
| --- | --- |
| `ModuleNotFoundError: No module named 'flask'` | Activate the venv and run `pip install -r requirements.txt`. |
| `Address already in use` (port 5000) | Set `PORT=5001` in `.env` or stop the other process. |
| CORS error from the frontend | Add the frontend origin to `CORS_ORIGINS` in `.env`. |
| `pip: command not found` | Use `python -m pip install ...` or install Python 3.10+. |
| Blank page on frontend | Run `bun install` (or `npm install`) first, then restart the dev server. |

## Environment variables

Copy `.env.example` to `.env` and adjust values. Never commit `.env` or real
API keys / passwords.


---

## Authentication (Step 3)

### Architecture

```text
React form  ──►  src/services/api.ts  ──►  Flask /api/auth/*
   ▲                                            │
   │                                     Werkzeug PBKDF2 hash
AuthContext (token in localStorage)  ◄──  signed JWT access token
```

- **Passwords** are hashed with Werkzeug PBKDF2 (`User.set_password`). Plain
  text passwords are never stored, logged, or returned.
- **Tokens** are stateless JWTs signed with `JWT_SECRET_KEY` and expiring after
  `JWT_ACCESS_TOKEN_MINUTES` (default 120). The identity is the user id; the
  role and email travel as extra claims.
- **Frontend state** lives in a single `AuthProvider` (`src/context/AuthContext.tsx`).
  On load it revalidates the stored token against `/api/auth/me`, so a tampered
  or expired token can never produce a signed-in UI.

### Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Create a **citizen** account, returns token + user |
| POST | `/api/auth/login` | — | Verify credentials, returns token + user |
| GET | `/api/auth/me` | JWT | Current user (`id`, `name`, `email`, `role`, `created_at`) |
| POST | `/api/auth/logout` | JWT | Stateless acknowledgement (client deletes the token) |
| GET | `/api/admin/stats` | JWT + admin | Example admin-only endpoint |

#### Register

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'
```

```json
{
  "access_token": "eyJhbGciOi...",
  "user": { "id": 4, "name": "John Doe", "email": "john@example.com", "role": "citizen", "created_at": "..." }
}
```

Validation: name 2–120 chars, valid and normalised (trimmed + lowercased)
email, password 8–128 chars containing at least one letter and one digit.
A `"role"` field in the request body is **ignored** — public registration
always creates a citizen.

#### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Unknown email and wrong password both return the same `401` body,
`{"error": "Invalid email or password"}`, so the endpoint cannot be used to
discover which emails are registered.

#### Current user

```bash
curl http://localhost:5000/api/auth/me -H "Authorization: Bearer <token>"
```

#### Logout

JWTs are self-contained, so the server cannot revoke an already-issued token
without a blocklist (not implemented in this project stage). Logout is
therefore **client-side**: the React app deletes the stored token and clears
auth state, and the token expires on its own. `POST /api/auth/logout` only
acknowledges this and returns `"stateless": true`.

### Roles and authorization

| Role | Created by | Can access |
| --- | --- | --- |
| `citizen` | public registration, seed | `/dashboard`, all public pages |
| `admin` | seed / controlled backend process only | `/admin` plus everything above |

`backend/utils/auth.py` provides `@admin_required` (and the general
`roles_required(...)` factory):

- missing / invalid / expired token → **401** `{"error": "..."}`
- valid token, insufficient role → **403** `{"error": "Administrator access required"}`

Frontend protection mirrors this in `src/components/ProtectedRoute.tsx`:
unauthenticated visitors are redirected to `/login`; a signed-in citizen who
opens `/admin` sees an "Unauthorized" page instead of admin content. The
navigation itself changes with the session (Dashboard / Admin / Log out).

### Environment variables

```env
SECRET_KEY=change-this-in-development
JWT_SECRET_KEY=change-this-jwt-secret-in-development
JWT_ACCESS_TOKEN_MINUTES=120
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/urban_drainage_db
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/urban_drainage_test_db
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
VITE_API_URL=http://localhost:5000/api
# Optional: Google Maps JavaScript API browser key for the Google basemap on /map
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

Secrets live only in `.env` (git-ignored) — never in source code.

#### Google Maps basemap (optional)

`/map` offers two basemaps over the **same** PostGIS-backed data: **Google Maps**
(`src/components/map/GoogleMapCanvas.tsx`, lazily loaded via
`src/components/map/LazyGoogleMap.tsx` and `googleMapsLoader.ts`) and the
existing **Leaflet GIS** canvas (`MapCanvas.tsx`), which is unchanged and stays
the fallback. The Google basemap needs a browser-restricted key in
`VITE_GOOGLE_MAPS_API_KEY`, read only through `import.meta.env`, never
hardcoded or printed. In Google Cloud: enable the **Maps JavaScript API**, keep
billing active, and restrict the key to the site's domains. Without the key (or
on an auth failure) the map shows a clear message and Leaflet remains usable.

### Database

Step 3 reuses the existing `users` table from Step 2 unchanged, so **no new
migration is required** and no existing data is touched.

### Install and run

```bash
# backend
pip install -r backend/requirements.txt      # adds Flask-JWT-Extended, pytest
flask --app backend.app db upgrade
flask --app backend.app seed
python -m backend.app                        # http://localhost:5000

# frontend (separate terminal)
bun install && bun run dev                   # http://localhost:8080
```

### Tests

```bash
export TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/urban_drainage_test_db
pytest                                       # 18 tests
```

Covers successful registration, role-escalation attempts, email
normalisation, duplicate email, invalid email, weak password, missing name,
hash verification, successful login, wrong password, unknown account,
`/api/auth/me` without / with / with an invalid token, citizen vs admin access
to an admin endpoint, and stateless logout.

The browser flow (register → dashboard → `/admin` blocked → logout → admin
login → `/admin` allowed) was verified end to end against a live
PostgreSQL + PostGIS 3.6 database.

### Demo credentials (seeded development data only)

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@example.com` | `admin123` |
| citizen | `asha@example.com` | `citizen123` |
| citizen | `ravi@example.com` | `citizen123` |

These are intentionally seeded demo accounts for local development. Never
reuse them anywhere real.

### Common authentication errors and fixes

| Error | Fix |
| --- | --- |
| `Cannot reach the server...` in the browser | Start Flask (`python -m backend.app`) and check `VITE_API_URL`. |
| CORS error on `/api/auth/login` | Add the frontend origin to `CORS_ORIGINS` in `.env`, then restart Flask. |
| `Session expired, please log in again` | The access token passed `JWT_ACCESS_TOKEN_MINUTES`; sign in again. |
| `401 Authentication required` on `/api/auth/me` | Send the header `Authorization: Bearer <token>`. |
| `403 Administrator access required` | The account is a citizen; sign in with the seeded admin. |
| `An account with this email already exists` | Emails are unique and case-insensitive — sign in instead. |
| Signed-in UI still shows Login | Hard-refresh; the token is validated against `/api/auth/me` on load. |
| `pytest` skipped with "Test database unavailable" | Create the test database and set `TEST_DATABASE_URL`. |
| `RuntimeError: JWT_SECRET_KEY` missing | Set `JWT_SECRET_KEY` (or `SECRET_KEY`) in `.env`. |

## Reporting drainage issues (Step 4)

### Flow

```text
Citizen signs in ─► /report (form + Leaflet map)
        │                 │ click map / "use my location" / type coordinates
        ▼                 ▼
POST /api/reports (JWT)  ─► validation ─► PostGIS geography POINT (SRID 4326)
        │                                        │
        └────────────► /report/<id> ◄── status history row (NULL → NEW)
```

### Endpoints

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/api/reports` | any signed-in user | Creates a report. Owner comes from the JWT; status is always `NEW`. |
| GET | `/api/reports` | any signed-in user | Citizens get only their own reports; admins get all. |
| GET | `/api/reports/<id>` | any signed-in user | Citizens only their own (403 otherwise); admins any. Includes status history. |

Create a report:

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"asha@example.com","password":"citizen123"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -X POST http://localhost:5000/api/reports \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"issue_type":"BLOCKED_DRAIN","severity":"HIGH","description":"The drain is blocked and water collects on the road.","latitude":28.6139,"longitude":77.2090}'
```

List and read:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/reports
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/reports/1
```

### Validation rules (enforced server-side)

- `issue_type` — one of `BLOCKED_DRAIN`, `WATERLOGGING`, `DRAIN_OVERFLOW`,
  `SEWAGE_OVERFLOW`, `DAMAGED_DRAIN`, `FLOODING`, `OTHER` (case-insensitive).
- `severity` — one of `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- `description` — 10–2000 characters after trimming.
- `latitude` — number between -90 and 90; `longitude` — between -180 and 180.
  `NaN`, infinity, booleans and text are rejected.
- `status` and `user_id` sent by a client are ignored: status is always `NEW`
  and ownership always comes from the JWT.

### Frontend pages

| Route | Purpose |
| --- | --- |
| `/report` | Protected report form with Leaflet picker, geolocation and client-side validation. |
| `/reports` | The citizen's own reports with counts by status (admins see all). |
| `/report/<id>` | Single report: details, read-only map, status history. |
| `/dashboard` | Report statistics plus the five most recent reports. |

Leaflet is loaded browser-only (client-only + lazy import), so server-side
rendering never touches `window`.

### Run it

```bash
# backend
pip install -r backend/requirements.txt
python -m backend.app                       # http://localhost:5000

# frontend
bun install && bun run dev                  # http://localhost:8080
```

### Tests

```bash
export TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/urban_drainage_test_db
pytest                                      # 36 tests (18 auth + 18 reporting)
```

The reporting tests cover creation, unauthenticated rejection, every invalid
field, the forced `NEW` status, JWT-derived ownership, the initial status
history row, the stored PostGIS geometry (`POINT(longitude latitude)` verified
via `ST_X`/`ST_Y`), citizen-only listing, cross-citizen 403, admin access to all
reports, 404 for a missing report, and that password hashes are never
serialised.

The browser flow (sign in → dashboard → report form → pick a point on the map →
submit → report detail with map and history → My Reports) was verified end to
end against live Flask + PostgreSQL/PostGIS with no console errors.

### Common reporting errors and fixes

| Error | Fix |
| --- | --- |
| `401 Authentication required` on `POST /api/reports` | Sign in again; send `Authorization: Bearer <token>`. |
| `Issue type must be one of: ...` | Use one of the seven issue-type values. |
| `Description must be at least 10 characters` | Write a longer description. |
| `Latitude must be between -90 and 90` | Coordinates are latitude first in JSON, but stored as `POINT(lon lat)`. |
| Map area stays blank | Leaflet renders after hydration; hard-refresh and check the browser can reach the OpenStreetMap tiles. |
| Marker appears in the wrong country | Check the longitude/latitude order — PostGIS expects `POINT(longitude latitude)`. |
| Geolocation blocked | Allow location in the browser, or click the map / type coordinates instead. |
| `403 You can only view your own reports` | Citizens can only open their own reports; use the admin account. |
| Empty `/reports` list | Reports are per account — submit one, or sign in as the account that reported it. |

## Admin report management (Step 5)

### API

All four endpoints require a JWT **and** the `ADMIN` role (`@admin_required`).
Unauthenticated → `401`, citizen → `403`, admin → `200`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/stats` | User counts, total reports and live `by_status` counts |
| `GET` | `/api/admin/reports` | All reports, paginated and filtered |
| `GET` | `/api/admin/reports/<id>` | Any single report + status history + allowed next statuses |
| `PUT` | `/api/admin/reports/<id>/status` | Change a report's status |

`GET /api/admin/reports` query parameters:

```
?page=1&per_page=20&status=NEW&severity=HIGH&issue_type=BLOCKED_DRAIN&search=drain
```

Filtering, searching (description, citizen name, citizen email) and pagination
all run in SQL — the browser never downloads the whole table. `per_page` is
capped at 100. The response includes `page`, `per_page`, `total`, `pages`,
`has_next`, `has_prev` and the normalised `filters`.

Status update request:

```json
{ "status": "VERIFIED", "comment": "Drainage issue verified by administrator." }
```

Responses never contain `password_hash`, JWT secrets or any other private field.
History entries expose only the administrator's `changed_by_name` and
`changed_by_role`.

### Status workflow

```
NEW → PENDING_VERIFICATION → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED
```

Additionally allowed, and documented deliberately:

- `NEW → VERIFIED` (shortcut when an administrator can confirm the report immediately)
- `NEW → REJECTED`, `PENDING_VERIFICATION → REJECTED`, `VERIFIED → REJECTED`

`RESOLVED` and `REJECTED` are terminal — the update form then offers no options.
Unknown or disallowed statuses are rejected with `400`. Setting the same status
again is a no-op: no duplicate history row is written. Every real change writes
one `report_status_history` row (report, old status, new status, admin, comment,
timestamp) and entering `RESOLVED` sets `resolved_at`.

Citizens have **no** status endpoint. They can only create reports and read
their own reports and history; the database is the single source of truth, so a
status an admin sets appears immediately on the citizen's report page.

### Frontend routes

| Route | Contents |
| --- | --- |
| `/admin` | Eight live count cards, filter bar (status / severity / issue type / search), responsive reports table (cards on phones), pagination, loading / empty / error states |
| `/admin/reports/<id>` | Report and citizen details, Leaflet location map, current status, update-status form (allowed transitions only, disabled while saving), vertical status timeline |
| `/admin/map` | All reports as markers; popup shows ID, issue type, severity, status, date and opens the report |

### Tests

```bash
pytest                     # 52 tests (18 auth + 18 reporting + 16 admin)
```

The Step 5 tests cover admin listing, citizen `403` and unauthenticated `401` on
every admin endpoint, admin access to any report, the full
`VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED` chain, invalid and disallowed
statuses, the duplicate no-op, history creation, citizen visibility of the new
status, status/severity/issue-type filters, search, pagination and statistics
that match the database. All 52 tests pass against real PostgreSQL/PostGIS.

### Browser verification

Verified end to end in a real browser against live Flask + PostgreSQL/PostGIS,
with no console errors: citizen signs in → files a report → logs out → admin
signs in → sees the report (#13) in the dashboard table → opens it → sets
`VERIFIED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED` with comments → views the
reports map → logs out → citizen signs in → My Reports shows **Resolved** →
report detail shows the complete five-entry timeline with administrator names
and comments.

### Common admin errors and fixes

| Error | Fix |
| --- | --- |
| `403 Administrator access required` | Sign in with an admin account (`admin@example.com`). |
| `401 Authentication required` | Token expired — sign in again. |
| `Status must be one of: ...` | Send one of the seven valid status values. |
| `Cannot change status from RESOLVED to ...` | `RESOLVED` and `REJECTED` are terminal. |
| `Status is already VERIFIED` / nothing happens | Same-status updates are ignored on purpose so history stays clean. |
| Status dropdown is empty | The report is in a terminal status. |
| Table shows no rows | Clear the filters, or check the search box. |
| Admin map is blank | Leaflet loads after hydration and needs access to OpenStreetMap tiles. |

## Production deployment — Flask backend on Render (Step 5.5)

The published frontend cannot reach a backend running on your laptop, so the
existing Flask + PostgreSQL/PostGIS backend is deployed separately. Nothing in
the authentication, reporting, admin or database logic changes — only the way
the app is served.

### WSGI entry point

| Purpose | Command |
| --- | --- |
| Production entry point | `backend.wsgi:app` (thin wrapper over the existing `create_app()`) |
| Gunicorn start command | `gunicorn backend.wsgi:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120` |
| Local development (unchanged) | `python -m backend.app` or `flask --app backend.app run --port 5000` |

`backend/app.py` already binds `0.0.0.0` and reads `PORT`; in production
Gunicorn binds `0.0.0.0:$PORT`, where `$PORT` is supplied by the host. No
hard-coded `localhost:5000` anywhere on the server side.

### 1. Create the managed database (PostGIS)

Render → **New → Postgres** (PostgreSQL 16). Then, once from a shell or
`psql "<External Database URL>"`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

The first Alembic migration also runs `CREATE EXTENSION IF NOT EXISTS postgis`
before any spatial column is created, so a fresh database gets PostGIS through
`db upgrade` alone — running it manually first only helps if the database user
lacks extension privileges.

### 2. Create the web service

Render → **New → Web Service** → connect this repository (or use the committed
`render.yaml` via **New → Blueprint**, which creates the service *and* the
database):

| Setting | Value |
| --- | --- |
| Runtime | Python 3.12 |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `gunicorn backend.wsgi:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120` |
| Health check path | `/api/health` |

### 3. Required environment variables (Render dashboard)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | from the Render Postgres instance (`postgres://…` is accepted — the app rewrites the scheme for SQLAlchemy 2) |
| `SECRET_KEY` | generated long random value |
| `JWT_SECRET_KEY` | generated long random value (≥32 bytes recommended) |
| `JWT_ACCESS_TOKEN_MINUTES` | `120` (optional) |
| `CORS_ORIGINS` | `https://flowfinder-community.lovable.app` (comma-separated for more origins) |
| `FLASK_APP` | `backend.app` (needed by the migrate/seed commands) |
| `FLASK_DEBUG` | `0` |
| `PORT` | supplied by Render automatically — do not set it manually |

Never commit real values: `.env` is git-ignored and `render.yaml` uses
`generateValue` / `fromDatabase` instead of literals.

### 4. Run migrations and seeding on Render

From the service's **Shell** tab (or as a one-off job), with `DATABASE_URL`
already in the environment:

```bash
# migrations (creates PostGIS extension, tables, GiST indexes)
flask --app backend.app db upgrade

# demo data (optional — 3 users + 10 reports; demo passwords, dev use only)
flask --app backend.app seed
```

### 5. Verify production

```bash
curl https://<your-service>.onrender.com/api/health
curl -X POST https://<your-service>.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

`/api/health` must return `"status": "ok"` and `"database": "connected"`.

### 6. Point the published frontend at it (next step)

Once the Render URL responds, set the frontend to use it instead of the
Preview-only forwarder:

```env
VITE_API_URL=https://<your-service>.onrender.com/api
```

then republish the site. The frontend API URL is intentionally **not** changed
yet.

### Files added/changed for deployment

| File | Change |
| --- | --- |
| `backend/wsgi.py` | new — production WSGI entry point (`backend.wsgi:app`) |
| `backend/requirements.txt` | added `gunicorn` |
| `backend/config.py` | rewrites `postgres://` → `postgresql://`; CORS default now includes the published origin |
| `render.yaml` | new — Render blueprint (web service + PostGIS database, generated secrets) |
| `Procfile` | new — same Gunicorn command for any Procfile-based host |
| `.env.example` | documented production variables (no real values) |
| `README.md` | this deployment section |

### Common deployment errors and fixes

| Error | Fix |
| --- | --- |
| `Can't load plugin: sqlalchemy.dialects:postgres` | Old code path — the config now normalises `postgres://`; redeploy the latest commit. |
| `type "geography" does not exist` | Run `CREATE EXTENSION IF NOT EXISTS postgis;` on the managed database, then `flask --app backend.app db upgrade`. |
| `permission denied to create extension "postgis"` | Use a database whose user is owner (Render Postgres is), or ask the provider to enable PostGIS. |
| CORS error from the published site | Add the exact published origin (scheme + host, no trailing slash) to `CORS_ORIGINS` and redeploy. |
| `Error: Could not locate a Flask application` on Render shell | Set `FLASK_APP=backend.app` or pass `--app backend.app`. |
| Service starts then exits | Check the start command binds `0.0.0.0:$PORT`, not a fixed port. |
| First request very slow | Render free instances sleep when idle; the next request wakes them. |
| `InsecureKeyLengthWarning` in logs | Use a `JWT_SECRET_KEY` of at least 32 characters. |

## Public map and spatial analysis (Step 6)

The city map is public: no token, no account, no personal data.

### Endpoints (no authentication)

| Method | Endpoint                | Purpose |
| ------ | ----------------------- | ------- |
| GET    | `/api/reports/map`      | Privacy-safe report points + summary counts |
| GET    | `/api/reports/hotspots` | PostGIS density clusters (`ST_ClusterDBSCAN`) |

Shared query parameters (comma-separated, `ALL`/omitted means no filter):

- `issue_type=BLOCKED_DRAIN,FLOODING`
- `severity=HIGH,CRITICAL`
- `status=NEW,IN_PROGRESS` (rejected reports are hidden unless asked for)
- `days=30` — only reports newer than N days

`/api/reports/map` extras: `limit` (max 2000) and a radius filter
`lat=28.6139&lon=77.2090&radius_m=5000`, evaluated with `ST_DWithin` on the
geography column so the GiST index is used.

`/api/reports/hotspots` extras: `radius_m` (cluster distance, default 400),
`min_points` (default 2), `limit` (default 25). Unknown filter values return
400; a database problem returns 503 with a readable message.

Example:

```bash
curl "http://localhost:5000/api/reports/map?severity=HIGH,CRITICAL"
curl "http://localhost:5000/api/reports/hotspots?radius_m=2000&min_points=2"
```

Response shape (map):

```json
{
  "count": 1,
  "summary": { "total": 1, "resolved": 0, "high_severity": 1 },
  "reports": [
    {
      "id": 1, "issue_type": "BLOCKED_DRAIN", "severity": "HIGH", "status": "NEW",
      "latitude": 28.6139, "longitude": 77.209, "weight": 3.0,
      "created_at": "2026-01-01T10:00:00+00:00", "resolved_at": null
    }
  ]
}
```

### Privacy

`backend/services/spatial.py` never joins the `users` table, so no name,
e-mail, user id, description or image path can appear in a public response.
A regression test asserts this.

### Frontend

`/map` (public, in the main navigation) shows:

- severity-coloured markers with popups (id, issue type, severity, status, date)
- a heatmap layer weighted by severity (LOW 1 → CRITICAL 4), toggleable
- hotspot circles plus a ranked hotspot list, with a cluster-distance selector
- summary cards, and loading / empty / error states

Leaflet and leaflet.heat stay out of the server bundle: `MapCanvas` is loaded
lazily inside `<ClientOnly>` via `LazyMap`.

### Files added/changed in Step 6

- `backend/services/spatial.py` (new) — PostGIS queries
- `backend/routes/reports.py` — public `/map` and `/hotspots` endpoints
- `backend/tests/test_map.py` (new) — 10 tests
- `src/components/map/MapCanvas.tsx`, `src/components/map/pin.css` — heat layer, hotspot circles, severity colours
- `src/routes/map.tsx` — the public map page
- `src/services/api.ts` — `publicMapApi` and map types
- `package.json` — `leaflet.heat`

### Tests

```bash
python -m pytest -q     # 62 passed (52 from Steps 1-5 + 10 new map tests)
```

## Dashboard analytics (Step 7)

Administrators get aggregated insight into drainage trends and problem areas
directly on `/admin`, below the existing status cards. The report table,
filters, pagination and status workflow from Step 5 are unchanged.

### API

`GET /api/admin/analytics` — **admin only** (401 unauthenticated, 403 for a
citizen, 200 for an admin; the same `@admin_required` decorator as every other
admin route).

Query parameters:

| Parameter | Default | Meaning                                             |
| --------- | ------- | --------------------------------------------------- |
| `days`    | `30`    | Length of the daily trend window (1–365)            |
| `months`  | `6`     | Number of months in the monthly breakdown (1–36)    |

Response shape:

```json
{
  "totals": {
    "total": 10, "resolved": 1, "rejected": 1, "unresolved": 8,
    "high_severity": 5, "recent": 10, "awaiting_review": 2,
    "recent_days": 30, "resolution_rate": 10.0
  },
  "by_status":     [{ "key": "NEW", "count": 2 }, ...],
  "by_severity":   [{ "key": "LOW", "count": 2 }, ...],
  "by_issue_type": [{ "key": "BLOCKED_DRAIN", "count": 2, "resolved": 0 }, ...],
  "over_time":     [{ "day": "2026-09-10", "count": 1, "high_severity": 1, "resolved": 0 }, ...],
  "by_month":      [{ "month": "2026-09", "count": 10, "resolved": 1 }, ...],
  "resolution_speed": { "resolved_count": 1, "avg_hours": 6.0, "median_hours": 6.0 },
  "spatial": { "located": 10, "center_latitude": 28.6033, "center_longitude": 77.2301, "spread_m": 53000.0 },
  "params": { "days": 30, "months": 6, "recent_days": 30 }
}
```

Notes:

- Every figure is computed **in SQL** (`backend/services/analytics.py`) with
  `COUNT(*) FILTER (...)`, `GROUP BY`, `date_trunc` and `generate_series`, so the
  response is a few dozen numbers rather than a list of reports.
- `generate_series` fills days/months with no reports, so charts have no gaps,
  and every enum value appears in the breakdowns even when its count is zero.
- The spatial block is PostGIS: `ST_Centroid(ST_Collect(location))` for the
  centre of gravity and `ST_MaxDistance` for the extent of the reported area.
- The endpoint is read-only; it never writes to the database.

### Frontend

`src/components/admin/AnalyticsSection.tsx`, rendered from `src/routes/admin.tsx`:

- summary cards: total reports, open/unresolved (with "awaiting first review"),
  resolved (with resolution rate), high/critical (with recent count);
- reports over time as an inline SVG area chart with day labels;
- reports by status, severity (colour-coded), issue type and month as bar lists;
- average and median time to resolve, and the reported area spread in km;
- a period selector (7 / 30 / 90 days) that re-queries the backend;
- loading, empty ("no reports have been submitted yet") and error states;
- responsive: one column on mobile, two chart columns and four cards on desktop.
- No charting dependency was added — the visuals use the existing design tokens.

### Verify locally

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin123"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -s "http://localhost:5000/api/admin/analytics?days=30" -H "Authorization: Bearer $TOKEN"

# authorization
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5000/api/admin/analytics   # 401
```

### Tests

`backend/tests/test_admin_analytics.py` (9 tests) covers 401/403/200
authorization, totals matching the database, breakdown correctness and stable
enum axes, the continuous daily/monthly series, resolution speed, the PostGIS
spatial block, an empty database, and that the Step 5 admin endpoints still
work. Complete suite: **71 tests passing** against real PostgreSQL + PostGIS.


## Duplicate report detection (Step 8)

Several citizens often notice the same blocked drain. Step 8 detects that
before a second report is stored, warns the citizen and lets them decide.

### The rule

Implemented in `backend/services/duplicates.py`:

1. **Candidates** - reports whose `location` is within **100 m** of the new
   point (`ST_DWithin` on the `geography(POINT, 4326)` column, so the existing
   GiST index is used and the distance is real metres, longitude first).
2. **Time window** - only reports created in the last **30 days**. An old
   problem that comes back is a new report, not a duplicate.
3. **Confidence score** (0 - 1) per candidate:
   | Signal | Contribution |
   | ------ | ------------ |
   | distance <= 25 m / <= 50 m / <= 100 m | 0.50 / 0.40 / 0.25 |
   | same issue type / different issue type | +0.35 / +0.05 |
   | status still active (not RESOLVED/REJECTED) | +0.10 |
   | created <= 7 days ago / older | +0.10 / +0.05 |
   | same severity | +0.05 |
   A RESOLVED or REJECTED report is capped at **0.45**, so it is shown as
   context but never blocks a new report.
4. **Likely duplicate** when the issue type matches, the report is still active
   and the score is **>= 0.75**. Nearby reports that fail the rule are still
   returned as `nearby` context - "nearby" alone is never treated as duplicate.

### PostGIS query

```sql
SELECT id, issue_type, severity, status, created_at,
       ST_Distance(location, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) AS distance_m
FROM reports
WHERE location IS NOT NULL
  AND created_at >= now() - (:days || ' days')::interval
  AND ST_DWithin(location,
                 ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                 :radius_m)
ORDER BY distance_m ASC;
```

### API

`POST /api/reports/check-duplicate` - signed-in citizens/admins (401 without a
token), read-only.

```json
// request
{ "latitude": 28.7411, "longitude": 77.1101, "issue_type": "BLOCKED_DRAIN",
  "severity": "HIGH", "radius_m": 100, "days": 30 }

// response
{
  "duplicate": true,
  "message": "A similar drainage report already exists nearby.",
  "matches": [{ "id": 11, "issue_type": "BLOCKED_DRAIN", "severity": "HIGH",
                "status": "NEW", "created_at": "2026-09-16T19:41:02+00:00",
                "distance_m": 0.0, "age_days": 0.1, "same_issue_type": true,
                "confidence": 1.0, "likely_duplicate": true }],
  "nearby": [ ... same shape, all candidates ... ],
  "count": 1, "nearby_count": 1,
  "params": { "radius_m": 100.0, "days": 30, "threshold": 0.75 }
}
```

`POST /api/reports` (unchanged otherwise) now runs the same check server-side.
If a likely duplicate exists it answers **409** with `duplicate: true` and the
matches instead of saving. Resending the same body with
`"confirm_duplicate": true` stores the report normally (201). The report is
never silently dropped, altered or deleted, and if the duplicate query itself
fails the report is saved rather than blocked.

Privacy: the duplicate payload contains ids, issue type, severity, status,
distance and dates only - never a reporter's name, e-mail, user id or the
description.

### Citizen workflow

1. Fill in the report form and press **Submit report**.
2. "Checking for similar reports nearby…" while the backend runs the check.
3. No match - the report is submitted as before.
4. Likely match - an amber panel appears: *"A similar drainage report already
   exists nearby."* plus each existing report's id, issue type, status,
   distance, severity, date and match confidence, with two buttons:
   * **Continue Anyway** - submits with `confirm_duplicate: true`;
   * **Cancel** - nothing is submitted, the form keeps its content so the
     citizen can change the location or issue type.
5. If the check cannot run, the report is still submitted and a note explains it.

### Limitations

- Location-and-classification based only: descriptions and photos are not
  compared (no text similarity or ML yet).
- A single fixed 100 m radius; a long flooded street may exceed it, and in dense
  areas two genuinely different drains can fall inside it - hence the warning
  is advisory, never a hard block.
- GPS accuracy on phones can be 10-30 m, which the scoring absorbs but cannot
  remove.
- Admins are not yet offered a "merge/link duplicates" action; duplicates are
  visible to them through the map and the hotspot analysis.

### Tests

`backend/tests/test_duplicates.py` (11 tests): unauthenticated 401, no nearby
report, nearby same issue, nearby different issue type, several nearby reports
ordered by distance, resolved/old reports not blocking, privacy, invalid
coordinates/issue type/radius, the 409 warning on creation, **Continue Anyway**
(201) and normal creation. Complete suite: **82 tests passing** against real
PostgreSQL + PostGIS.


## ML risk prediction prototype (Step 9)

A deliberately small, explainable machine-learning prototype that highlights the
areas under the most reported drainage pressure. It is **not** a flood forecast.

### The four layers, kept separate

| Layer | Where it lives | What it is |
| --- | --- | --- |
| Observed report data | `reports` table | Real citizen reports: location, issue type, severity, status, dates |
| Engineered features | `backend/services/risk.py` (PostGIS SQL) | Nine numeric per-area features |
| Proxy target | `ml/risk_model.py` -> `proxy_risk()` | A documented 0-1 "reported pressure" score used as a stand-in label |
| Model prediction | `ml/risk_model.py` -> `train_baseline()` | Logistic regression output, turned into a risk score and LOW/MEDIUM/HIGH |

The API returns all four (`indicators`, `proxy_risk`, `model_probability`,
`risk_score`), so nothing is hidden behind a single number.

### Areas and features

Reports are grouped into square grid cells with PostGIS
(`ST_SnapToGrid(location::geometry, 0.005)`, about 550 m per side, configurable
through `cell_degrees` between 0.001 and 0.05). Each cell becomes one training
sample with these features:

`report_count`, `recent_count` (last 30 days), `high_severity_count`
(HIGH + CRITICAL), `unresolved_count`, `flood_related_count`,
`issue_type_variety`, `density_per_km2`, `recency_score` (1 / (1 + days since the
last report)), `spread_m` (PostGIS `ST_MaxDistance` inside the cell).

Context that is shown but never fed to the model: `resolved_count`,
`days_since_last_report`, `days_since_first_report`.

### The proxy target (no real flood labels exist)

There is no verified dataset of historical flooding outcomes in this project, so
inventing labels would be dishonest. Instead a transparent, capped formula turns
observed indicators into a 0-1 proxy score:

```
proxy = 0.30 * min(report_count / 8, 1)
      + 0.25 * min(recent_count / 5, 1)
      + 0.20 * min(high_severity_count / 4, 1)
      + 0.15 * min(unresolved_count / 5, 1)
      + 0.10 * recency_score
```

The proxy is binarised at 0.50. If no area crosses that threshold - normal on a
small dataset - the areas are labelled *relative to the median of the current
dataset* and the API returns an explicit warning that the classes are relative,
not absolute. If every area has the same proxy score, training stops and reports
insufficient data rather than fitting noise.

### Model, score and validation

- Model: `StandardScaler` + `LogisticRegression(class_weight="balanced")`,
  `random_state=42`, no deep learning - the data does not justify it.
- Reproducible: same rows in, same model and same predictions out. Run it from
  the command line with `python -m ml.train_risk_model`.
- Risk score = geometric mean of the model probability and the proxy score. The
  classifier only learns to *separate* areas, so on a small dataset it is very
  confident even about an area with one report; multiplying by the proxy
  magnitude keeps its ranking while ensuring a barely-reported area can never
  reach a high score. Bands: LOW < 0.34, MEDIUM < 0.67, HIGH from 0.67.
- Validation: stratified 5-fold cross-validation (accuracy + ROC-AUC) **only**
  when there are at least 20 areas with at least 5 in the smaller class.
  Otherwise no number is reported and the response explains that any score would
  be noise. Even when reported, the score measures how learnable the *proxy* is -
  never accuracy against real flooding.

### API

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/admin/risk-model/train` | admin | Train/retrain, store predictions. Body (optional): `cell_degrees`, `days` |
| GET | `/api/admin/risk-predictions` | admin | Latest stored run + supporting indicators |
| GET | `/api/reports/risk-areas` | public | Coordinates, level, score, date, report count only |

Training returns `trained`, `samples`, `features`, `model_type`,
`model_version`, `stored_predictions`, `target`, `validation`,
`feature_importance`, `warnings`, `limitations` and `disclaimer`. Insufficient
data is a normal `200` response with `trained: false` and a plain-language
`reason` - not an error.

Predictions are stored in the existing `risk_predictions` table (score, level,
`prediction_date`, geography point, `model_version`); each run replaces the
previous one for that model version. **No citizen data is ever written to or
returned from predictions** - only counts and coordinates.

### Frontend

The admin dashboard has a "Risk prediction (prototype)" section with a
Train/Retrain button, LOW/MEDIUM/HIGH area counts, a colour-coded Leaflet
overlay on the existing map component, and a table of areas with risk score,
report count, recent count, high/critical count, unresolved count and the
prediction date. It shows loading, empty, insufficient-data and error states,
displays the training summary, warnings and limitations, and repeats the
disclaimer in a neutral, non-official tone:

> Prototype risk prediction based on available crowdsourced report data.
> Predictions are not official flood warnings.

### ML Prototype Limitations

- **Not production-accurate and not an official warning.** Do not use it for
  emergency or evacuation decisions.
- **The target is a proxy**, derived from report volume, severity, backlog and
  recency - not a measured flooding event.
- **Reporting bias**: engaged neighbourhoods look riskier than quiet ones. Low
  risk can simply mean "nobody reported here".
- **Small data**: with a handful of areas the labels are relative and no
  meaningful validation score can be produced.
- **Missing inputs**: no rainfall or weather data, no elevation/terrain, no
  drainage-network capacity, no verified historical flooding, no land use or
  population density, no maintenance records.
- **Fixed grid**: a coarse square grid does not follow catchment boundaries.

To become a genuine prediction model this needs: historical rainfall time series,
verified flooding incident records with dates and locations, drainage
infrastructure data (pipe capacity, condition, maintenance), elevation/terrain,
and municipal validation of the reports. The feature pipeline in
`backend/services/risk.py` and the model in `ml/risk_model.py` are separated
precisely so those datasets can be added as extra feature columns and a real
label without rewriting the platform.

### Tests

`backend/tests/test_risk_predictions.py` (16 tests): proxy bounds and
monotonicity, risk bands, the score composition, insufficient data, data without
variance, reproducibility, 401/403 authorization for both endpoints, training
with no reports, empty predictions before training, training storing and reading
back predictions, retraining replacing the previous run, privacy (no email, name
or `user_id` anywhere), older reports scoring lower than fresh ones, invalid
`cell_degrees`, and the public endpoint's exact safe field set. Complete suite:
**98 tests passing** against real PostgreSQL + PostGIS.

Run everything:

```bash
source .venv/bin/activate
pytest -q                       # 98 tests
python -m ml.train_risk_model   # reproducible training from the command line
```

---

## Civic / environmental data integration (Step 10)

### Is the data real?

**No official government API is used.** No verified, publicly accessible
government drainage/rainfall API was available and confirmed for this project, so
the platform ships a **clearly labelled mock provider** plus a pluggable
provider interface. Every mock record, and the whole API response, carries:

> `Demo/Mock Civic Data — Not Official Government Data`

and the admin UI shows a prominent banner:

> `DEMO DATA — NOT OFFICIAL GOVERNMENT DATA`

Nothing in the codebase claims an official source, and no real measurements are
fabricated as if observed.

### Architecture

`backend/services/civic.py`

- `CivicDataProvider` — abstract provider interface (`fetch(data_type, latitude, longitude)`).
- `MockCivicDataProvider` — deterministic sample records, always `is_mock=True`.
- `HttpCivicDataProvider` — generic adapter (stdlib `urllib`, no new dependency)
  used **only** when an operator configures a real endpoint through environment
  variables. It handles timeouts, HTTP 429 rate limiting, non-2xx responses,
  invalid JSON and unexpected shapes, and maps records into the same safe schema.
- `build_provider()` — returns the HTTP provider when `CIVIC_API_BASE_URL` is
  set, otherwise the mock provider.
- In-memory TTL cache (`CIVIC_CACHE_TTL_SECONDS`, default 300 s) so repeated
  dashboard loads do not hammer an external API. `?refresh=1` bypasses it.

Supported data types: `RAINFALL`, `DRAINAGE_INFRASTRUCTURE`, `FLOOD_INCIDENT`,
`MUNICIPAL_SERVICE`. Unsupported/missing types return a per-type error entry
rather than failing the whole response.

### Endpoints

Both require a valid JWT (any signed-in user) and are read-only.

```
GET /api/civic-data
    ?data_type=RAINFALL          # or types=RAINFALL,FLOOD_INCIDENT
    &latitude=12.9716&longitude=77.5946
    &refresh=1
GET /api/civic-data/provider     # provider name, mock flag, supported types, cache TTL
```

Response shape:

```json
{
  "provider": "mock",
  "is_mock": true,
  "label": "Demo/Mock Civic Data — Not Official Government Data",
  "disclaimer": "...",
  "retrieved_at": "2026-09-17T18:21:20+00:00",
  "cached": false,
  "count": 6,
  "records": [
    {
      "data_type": "RAINFALL",
      "title": "Rainfall observation (sample)",
      "source": "Demo/Mock Civic Data (local sample data)",
      "source_url": null,
      "observed_at": "2026-09-17T17:21:20+00:00",
      "is_mock": true,
      "location": { "latitude": 12.9716, "longitude": 77.5946, "area_name": "Demo ward (sample area)" },
      "values": { "rainfall_mm_last_1h": 4.2, "rainfall_mm_last_24h": 38.6, "intensity": "MODERATE", "station_id": "DEMO-RAIN-01" },
      "notes": "Demo/Mock Civic Data — Not Official Government Data"
    }
  ],
  "errors": []
}
```

### Replacing the mock provider with a real API

Set these in the environment (never in Git) — the mock provider is bypassed
automatically:

```bash
CIVIC_API_BASE_URL=https://example-official-api.gov/api
CIVIC_API_KEY=your-key                 # optional
CIVIC_API_KEY_HEADER=X-API-Key         # header the provider expects
CIVIC_API_SOURCE_NAME=Official source name
CIVIC_API_SOURCE_URL=https://example-official-api.gov
CIVIC_API_TIMEOUT_SECONDS=8
CIVIC_CACHE_TTL_SECONDS=300
```

If the real API's payload differs from the expected `{ "records": [...] }` shape,
subclass `CivicDataProvider` (or adjust the mapping in `HttpCivicDataProvider`)
and return `CivicRecord` objects — routes, cache and frontend need no changes.

### Privacy and security

- API keys are read from the environment, sent only in the outbound request
  header, and never returned in any response or logged.
- Records contain no citizen identity: no user ids, names, emails or report
  ownership — only environmental/infrastructure values, coordinates and timestamps.
- The endpoints are read-only; nothing external can write to the database.
- External failures (unavailable, timeout, invalid response, rate limited) are
  surfaced as safe messages; a total provider failure returns HTTP 503.

### Frontend

`src/components/admin/CivicDataSection.tsx`, rendered on `/admin` below the risk
section: type filter, refresh, loading/empty/error/partial-error states, source
and timestamp per record, responsive card grid, and the demo-data banner whenever
`is_mock` is true. Styling deliberately avoids any official/government look.

### Limitations

- Sample values are illustrative placeholders, not measurements — do not use them
  for decisions.
- The cache is per-process in memory (resets on restart, not shared across workers).
- Civic data is displayed alongside reports but is not yet fed into the ML model;
  the model was intentionally left unchanged in this step.

### Tests

`backend/tests/test_civic_data.py` (24 tests): provider selection, every mock data
type, cache hit/bypass, unsupported and missing data, external API unavailable,
timeout, invalid JSON, invalid shape, rate limiting, HTTP status mapping,
401 without a token, type filtering, coordinate validation, privacy (no citizen
fields) and secret protection (no API key in responses).

Complete suite: **122 tests passing** against real PostgreSQL + PostGIS.

```bash
source .venv/bin/activate
pytest -q      # 150 tests
```

## Security hardening and full-system testing (Step 11)

A security pass over the whole application (Steps 1-10 behaviour unchanged). No
new dependencies were added.

### Authentication and sessions

- Passwords are hashed with Werkzeug PBKDF2; no endpoint ever returns a hash.
- Public registration always creates a `citizen`; a client-supplied `role` or
  `is_admin` field is ignored.
- Login returns one generic `Invalid email or password` for an unknown account
  and for a wrong password, so accounts cannot be enumerated.
- Login inputs are length-capped (email 255, password 128) **before** the
  database lookup and hash comparison, so an oversized credential cannot be
  used to burn server CPU. The reply stays generic.
- JWTs are signed with `JWT_SECRET_KEY`, carried in the `Authorization: Bearer`
  header only, and expire (default 120 minutes). A token signed with any other
  key is rejected.
- The `role` claim inside a token is **not** trusted for authorization: every
  admin check re-reads the user row from the database.

### Authorization

- Every `/api/admin/*` route is wrapped in `@admin_required`: 401 without a
  token, 403 for a citizen. Frontend route guards are convenience only.
- Citizens can only read and list their own reports; another citizen's report
  is not returned and does not appear in their list.
- Citizens cannot change report status - that route is admin-only.
- Public endpoints (`/api/reports/map`, `/hotspots`, `/risk-areas`) return
  aggregates, classifications and coordinates only: no name, email, user id or
  description of any reporter.

### Input handling and injection

- All PostGIS/raw SQL uses bound parameters. The only interpolated SQL
  fragments come from internally validated enum values, and the analytics
  group-by column is now checked against an explicit whitelist.
- The admin free-text search is capped at 120 characters and `%`, `_` and `\`
  are escaped, so a crafted term cannot become an expensive wildcard scan.
- Report input keeps its strict validation: enum issue type and severity,
  description 10-2000 characters, finite coordinates inside valid bounds.
- Request bodies larger than `MAX_CONTENT_LENGTH` (1 MB default) are rejected
  with a JSON 413 before parsing.
- Malformed JSON returns a JSON 400, never a stack trace.

### Error handling and information disclosure

- `FLASK_DEBUG` now defaults to **off**: a forgotten environment variable on a
  host can no longer expose the interactive debugger or tracebacks.
- A catch-all handler logs unexpected exceptions server-side, rolls back the
  session and returns `{"error": "Internal server error"}`.
- `/api/health` reports `"postgis": "enabled"` instead of the exact version;
  set `EXPOSE_SERVER_DETAILS=1` (or run in debug) to see version details.
- Startup logs a warning when `SECRET_KEY` / `JWT_SECRET_KEY` are unset in a
  non-debug environment.

### Transport and browser headers

Every response carries `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control:
no-store` and a restrictive `Permissions-Policy`; the `Server` header is
removed. CORS stays an explicit allowlist (`CORS_ORIGINS`), credentials off,
`Authorization` allowed.

### Known limitations (deliberate, documented)

- **No login rate limiting / lockout.** Adding it needs a dependency
  (Flask-Limiter) or a reverse-proxy rule; put it in front of `/api/auth/login`
  before real deployment.
- **Stateless logout.** JWTs cannot be revoked without a blocklist, so a stolen
  token stays valid until it expires. Keep `JWT_ACCESS_TOKEN_MINUTES` short in
  production.
- **No audit log** of admin actions beyond report status history.
- Demo seed accounts (`admin@example.com` / `admin123`) are development-only and
  must never be seeded in production.
- The published frontend still needs the separately hosted Flask + PostGIS
  backend (see the Render section).

### Verification

```bash
source .venv/bin/activate
pytest -q      # 150 tests (122 from Steps 1-10 + 28 security regression tests)
```

Browser flows re-checked after hardening: public landing page and map,
citizen registration/login, report creation with duplicate detection, My
Reports, admin login, report management and status workflow, analytics, risk
prediction, civic data, and admin-only access denial for citizens.

## Production deployment — Render + Supabase (Step 12)

This supersedes the Render-managed-database instructions in the Step 5.5
section above: **the production database is Supabase PostgreSQL + PostGIS**, and
`render.yaml` no longer creates a Render database.

### Architecture

```text
Lovable published frontend (https://flowfinder-community.lovable.app)
        |  browser calls same-origin /api/*
        v
src/routes/api.$.ts  (server-side proxy)
        |  forwards to BACKEND_URL
        v
Render Free Web Service  ->  gunicorn backend.wsgi:app
        |  DATABASE_URL (Session Pooler)
        v
Supabase PostgreSQL + PostGIS
```

### 1. Supabase database

1. Create a Supabase project (Free plan).
2. SQL Editor → `CREATE EXTENSION IF NOT EXISTS postgis;`
   (the first Alembic migration also does this, but Supabase already ships the
   extension available, so enabling it explicitly is the reliable path).
3. Project Settings → Database → Connection string → **Session pooler**. Copy it
   and replace `[YOUR-PASSWORD]` with the database password. Never commit it.

Session pooler (port `5432`, host `…pooler.supabase.com`) is the right choice
here: it is IPv4-reachable from Render Free and supports the long-lived
connections SQLAlchemy uses.

### 2. Render web service

Render → **New → Blueprint** (uses the committed `render.yaml`) or **New → Web
Service** with:

| Setting | Value |
| --- | --- |
| Runtime | Python 3.12 |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `gunicorn backend.wsgi:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120` |
| Health check path | `/api/health` |
| Plan | Free (no Render database) |

### 3. Environment variables (Render dashboard only)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase Session Pooler connection string (secret) |
| `SECRET_KEY` | strong unique random value (secret) |
| `JWT_SECRET_KEY` | different strong unique random value, ≥32 chars (secret) |
| `CORS_ORIGINS` | `https://flowfinder-community.lovable.app` |
| `FLASK_APP` | `backend.app` |
| `FLASK_DEBUG` | `0` |
| `JWT_ACCESS_TOKEN_MINUTES` | `120` |
| `PORT` | supplied by Render — do not set |

No wildcard CORS: only the origins listed in `CORS_ORIGINS` are accepted.

### 4. Migrations

From the Render service **Shell** (or a one-off job), with `DATABASE_URL` set:

```bash
flask --app backend.app db upgrade
```

This creates the PostGIS extension, `users`, `reports`,
`report_status_history`, `risk_predictions`, their indexes and the GiST spatial
indexes, and stamps the Alembic version.

Demo data is **not** seeded automatically. Only run
`flask --app backend.app seed` if the demo accounts and 10 sample reports are
wanted; they use well-known demo passwords and are clearly demo data, not real
production records.

### 5. Point the published frontend at the Render API

The browser always calls same-origin `/api/*`; the server route
`src/routes/api.$.ts` forwards those calls to Flask. Set the target with either:

* `BACKEND_URL=https://<your-render-service>.onrender.com`, or
* `PRODUCTION_BACKEND_ORIGIN` in `src/config/backend.ts`

Leave both empty for local development / Lovable Preview — the proxy then falls
back to `http://127.0.0.1:5000`. `VITE_API_URL` stays `/api`, so no
`localhost`/`127.0.0.1` value is ever baked into the published bundle.

Republish the frontend after setting the backend origin.

### 6. Verify the deployment

```bash
curl -i https://<your-render-service>.onrender.com/api/health
curl -X POST https://<your-render-service>.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'
curl -i https://flowfinder-community.lovable.app/api/health   # through the proxy
```

`/api/health` returns HTTP 200 with `"status": "ok"`, `"database":
"connected"`, `"postgis": "enabled"` — no version strings, no secrets, no stack
traces (exact PostGIS version only appears when `EXPOSE_SERVER_DETAILS=1`).

### Known limitations (free tier)

* Render Free web services **sleep after ~15 minutes of inactivity**; the first
  request afterwards can take 30–60 seconds. Availability is not guaranteed.
* Render Free has monthly instance-hour limits and no persistent disk.
* Supabase Free projects pause after extended inactivity and have limited
  storage/connection quotas.
* Free-tier hosting is suitable for the demo, not for a real civic deployment.
* Civic/environmental data remains clearly labelled demo data, and the ML risk
  output remains labelled a prototype — not official flood warnings.

### Common deployment errors

| Error | Fix |
| --- | --- |
| `type "geography" does not exist` | Run `CREATE EXTENSION IF NOT EXISTS postgis;` in Supabase, then `db upgrade`. |
| `could not translate host name … pooler.supabase.com` | Copy the connection string again; use the Session pooler entry. |
| `password authentication failed` | Replace `[YOUR-PASSWORD]` in the Supabase string with the real password. |
| `Backend service is unavailable` from the published site | `BACKEND_URL` / `PRODUCTION_BACKEND_ORIGIN` is unset or wrong; set it and republish. |
| CORS error | Add the exact published origin (no trailing slash) to `CORS_ORIGINS`. |
| First request very slow | Render Free instance was asleep. |
