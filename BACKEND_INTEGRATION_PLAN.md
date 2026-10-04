# Backend Integration Plan — Urban Drainage Monitor

Status: **planning only.** The frontend features from Phases 1–6 run in demo mode
(sample data + browser storage). Nothing in this document is connected or live yet.
The Flask backend and PostgreSQL/PostGIS database were not modified in this phase.

---

## 1. Current architecture

| Layer | What exists |
|---|---|
| Frontend | React 19 + TanStack Start/Router (file routes in `src/routes/`), Tailwind v4, Leaflet + optional Google Maps, Three.js 3D city |
| API client | `src/services/api.ts` — single `apiRequest()` helper, base URL `VITE_API_URL` (default same-origin `/api`), Bearer JWT, errors normalised to `ApiError` |
| API proxy | `src/routes/api.$.ts` forwards `/api/*` server-side to Flask (`BACKEND_URL`, default `http://127.0.0.1:5000`, see `src/config/backend.ts`). Returns empty 200s only for optional public map/hotspot/risk reads when Flask is down |
| Auth | `src/context/AuthContext.tsx` — JWT in `localStorage` (`udm.access_token`), validated by `GET /api/auth/me` on load. Demo layer `src/lib/demoAuth.ts` (dev / `VITE_ENABLE_DEMO_AUTH=true`) issues `demo-session:` tokens |
| Route guard | `src/components/ProtectedRoute.tsx` (`role="admin"` for admin pages) |
| Backend | Flask + SQLAlchemy + Flask-Migrate, PostGIS Geography(POINT, 4326), JWT auth (`backend/routes/*`) |

### Demo / local-storage modules (browser only)

| Module | Storage key | Content |
|---|---|---|
| `src/lib/demoAuth.ts` | `udm.demo_users` | Demo citizen accounts (seed citizen/admin are in code, dev only) |
| `src/lib/demoReports.ts` | `udm.demo_reports`, `udm.demo_report_counter` | Citizen demo reports `UDM-DEMO-0001…` incl. downscaled photo data URLs |
| `src/lib/demoIssueAdmin.ts` | `udm.demo_issue_admin` | Admin status overrides + notes per issue id (originals never rewritten) |
| `src/lib/maintenance.ts` | `udm.demo_work_records` | Work orders (sample `WO-SAMPLE-*` overlaid by edits, admin `WO-DEMO-*`) |
| `src/data/sampleIssues.ts` | — | 12 fictional `SAMPLE-*` issues for the map |
| `src/data/demoData.ts` | — | Homepage demo weather, risk, feed, overview |

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | browser | API base path (keep `/api` so the proxy is used) |
| `VITE_DATA_MODE` | browser | **New, not yet used:** `demo` (default) or `api` — see `src/config/dataMode.ts` |
| `VITE_ENABLE_DEMO_AUTH` | browser | Enables demo sign-in outside dev builds. Must be unset in production |
| `VITE_GOOGLE_MAPS_API_KEY` | browser | Referrer-restricted Maps JS key (optional) |
| `VITE_GOOGLE_CLIENT_ID` | browser | Reserved for Google sign-in (not configured) |
| `BACKEND_URL` | website server | Where the proxy sends `/api/*` (Render URL in production) |
| `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `GOOGLE_CLIENT_ID` | Flask | Server-only secrets — never in frontend code |

---

## 2. API contract

`✅ exists` = implemented in Flask today. `🆕 proposed` = needs backend work in a later phase.
All bodies are JSON; dates are ISO 8601 UTC strings; coordinates are WGS84 decimal degrees.
Errors: `{ "error": string, "field"?: string }` with a 4xx/5xx status.

### Authentication
| Method & path | Status | Request | Response |
|---|---|---|---|
| `POST /api/auth/register` | ✅ | `{ name, email, password }` | `201 { access_token, user }` |
| `POST /api/auth/login` | ✅ | `{ email, password }` | `{ access_token, user }` |
| `POST /api/auth/logout` | ✅ | Bearer | `{ message }` (stateless — client drops token) |
| `GET /api/auth/me` | ✅ | Bearer | `{ user }` |
| `POST /api/auth/google` | ✅ (not configured) | `{ credential }` | `{ access_token, user }` |

`user = { id: number, name, email, role: "citizen" | "admin", created_at }`

### Issues (reports)
| Method & path | Status | Notes |
|---|---|---|
| `POST /api/reports` | ✅ | `{ issue_type, description, severity, latitude, longitude, confirm_duplicate? }` → `201 { message, report }`; `409` with matches when a likely duplicate exists |
| `POST /api/reports/check-duplicate` | ✅ | PostGIS 100 m / 30 days check |
| `GET /api/reports` | ✅ | Own reports (admins: all) |
| `GET /api/reports/:id` | ✅ | Owner or admin; includes status history |
| `GET /api/admin/reports` | ✅ | Filters, search, pagination |
| `PUT /api/admin/reports/:id/status` | ✅ | `{ status, comment? }`, validated transitions, writes history |
| `POST /api/reports/:id/images` | 🆕 | `multipart/form-data` (`images[]`, JPG/PNG/WebP ≤ 5 MB, max 3) → `{ images: [{ id, url }] }`. Needs object storage; `image_path` column exists but is unused |
| `title`, `landmark` fields on reports | 🆕 | Not in the schema yet; today the frontend folds them into `description` |
| Admin notes separate from status changes | 🆕 | Today only the `comment` on a status change exists |

### Location / map
| Method & path | Status | Notes |
|---|---|---|
| `GET /api/reports/map` | ✅ | Public, privacy-safe points `{ id, issue_type, severity, status, latitude, longitude, weight, created_at }` + summary |
| `GET /api/reports/hotspots?radius_m=` | ✅ | PostGIS DBSCAN clusters |
| `GET /api/reports/risk-areas` | ✅ | Prototype risk areas (not official warnings) |
| `GET /api/reports/nearby?lat=&lng=&radius_m=` | 🆕 | Public nearby lookup (ST_DWithin); bound radius ≤ 5 km |

### Maintenance
All 🆕 — no table or routes exist yet.
| Method & path | Request / response |
|---|---|
| `GET /api/maintenance?status=&type=&q=` | Public list `{ work: WorkOrder[] }` |
| `GET /api/maintenance/:id` | `WorkOrder` with `history[]` |
| `POST /api/admin/maintenance` | Admin. `{ title, type, description, location, latitude?, longitude?, start_at, expected_completion, team, status, related_report_id? }` |
| `PUT /api/admin/maintenance/:id` | Admin. Edit details |
| `PUT /api/admin/maintenance/:id/status` | Admin. `{ status, note }` — only `SCHEDULED → IN_PROGRESS → COMPLETED`; note required for COMPLETED; optional `resolve_report: true` |

`WorkOrder = { id, title, type, status, location, latitude, longitude, description, start_at, expected_completion, team, related_report_id, completion_note, photos: string[], updated_at, history: [{ at, status, note }] }`

### Weather & risk
| Method & path | Status | Notes |
|---|---|---|
| `GET /api/civic-data?data_type=weather` | ✅ | Demo provider by default (labelled not official); real provider via env |
| `GET /api/admin/risk-predictions` | ✅ | Admin, ML prototype |
| `GET /api/weather/current?lat=&lng=` | 🆕 optional | Thin server-side wrapper over a real weather API (key stays on server) |

UI states to keep: loading skeleton, "unavailable" (backend down → keep labelled demo values), error with retry. Never show demo weather as live.

---

## 3. Data mapping & mismatches

| Topic | Frontend demo | Backend | Action |
|---|---|---|---|
| Issue IDs | strings `SAMPLE-001`, `UDM-DEMO-0001`, live shown as `#12` | integer `id` | Keep string display ids; map live as `#${id}`. Demo records never sent to server |
| Work IDs | `WO-SAMPLE-001`, `WO-DEMO-0001` | none | Backend integer id; show `WO-${id}` |
| Categories | 6 labels (Blocked Drain, Waterlogging, Overflowing Manhole, Drain Damage, Garbage Blocking Drain, Other) | 7 enum values | Current mapping in `report.tsx`: Overflowing Manhole→`SEWAGE_OVERFLOW`, Drain Damage→`DAMAGED_DRAIN`, Garbage→`BLOCKED_DRAIN`. **Lossy** for Garbage; `DRAIN_OVERFLOW`/`FLOODING` have no form option. Decide: add `GARBAGE_BLOCKAGE` enum or keep mapping |
| Severity | LOW/MEDIUM/HIGH/CRITICAL | same | ✅ match |
| Issue status (admin) | REPORTED, UNDER_REVIEW, IN_PROGRESS, RESOLVED, REJECTED | NEW, PENDING_VERIFICATION, VERIFIED, ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED | Map REPORTED↔NEW, UNDER_REVIEW↔PENDING_VERIFICATION/VERIFIED, IN_PROGRESS↔ASSIGNED/IN_PROGRESS. Use backend values when live |
| Map status | OPEN/IN_PROGRESS/RESOLVED | full enum | Already mapped in `map.tsx` (`liveStatus`) |
| Title / landmark | separate fields | not stored | Proposed new columns (see §2) |
| Dates | ISO strings | ISO strings | ✅ match |
| Coordinates | `latitude`/`longitude` numbers | same (PostGIS Geography 4326) | ✅ match |
| Images | downscaled data URLs in localStorage | `image_path` (unused) | Upload endpoint returns URLs; never store data URLs server-side |
| Citizen name | owner email for demo reports | not exposed publicly | Admin endpoints only; public map stays anonymous |
| Roles | `citizen`/`admin` | same | ✅ match. Demo admin is frontend-only |
| Auth token | `demo-session:<email>` | JWT | Server rejects demo tokens (401) — expected |

---

## 4. Authentication flow (target)

1. Login/register → Flask returns `{ access_token, user }`.
2. `AuthContext.adopt()` stores the token (`udm.access_token`) and user.
3. `apiRequest(..., { auth: true })` attaches `Authorization: Bearer`.
4. On load, `GET /api/auth/me`; 401 clears the token.
5. Logout clears the token (stateless; server-side revocation is a known gap).
6. Production: unset `VITE_ENABLE_DEMO_AUTH` so demo accounts are disabled.

---

## 5. Integration order (recommended)

1. **Deploy backend** (Render + Supabase PostGIS), set `BACKEND_URL`, verify `/api/health`.
2. **Auth** with real accounts; confirm demo sign-in disabled in the published build.
3. **Report Issue** live submit (already wired for real sessions) + decide category/title/landmark schema.
4. **Image upload** endpoint + storage.
5. **Issues Map & admin report management** on live data (`VITE_DATA_MODE=api`), keeping sample data behind demo mode.
6. **Maintenance** tables/routes, then switch the tracker from `src/lib/maintenance.ts` to the API.
7. **Weather/risk**: real provider via server env, keep labelled fallback.

## 6. Risks

- Demo admin credentials exist in the frontend bundle when demo auth is enabled — must be off in production.
- Category mapping loses "Garbage Blocking Drain" detail.
- Demo records live only in one browser and are not migrated to the server.
- Free Render instances sleep → slow first request; keep loading states.
- Photo uploads need size limits, type checks and storage costs.
- Status vocabularies differ; mismatched mapping could misreport progress.
- Stateless JWT logout cannot revoke stolen tokens before expiry.
