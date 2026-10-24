# Urban Drainage Monitor — Demonstration script (5–8 minutes)

Everything below uses features that are actually implemented. Nothing shown is
an official government service, and the risk model is a prototype.

## Before you start (2 minutes of setup, not part of the demo)

```bash
# 1. Database (PostgreSQL + PostGIS) running, then:
flask --app backend.app db upgrade
flask --app backend.app seed          # demo users + 10 demo reports

# 2. Backend
python -m backend.app                 # http://localhost:5000

# 3. Frontend
bun run dev                           # http://localhost:8080
```

Demo accounts created by `flask seed` (demo passwords, development only):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `admin123` |
| Citizen | `asha@example.com` | `citizen123` |
| Citizen | `ravi@example.com` | `citizen123` |

Have two browser tabs ready: one for the citizen, one for the admin.

---

## 1. The problem (30 seconds)

"Blocked and overflowing drains flood streets every monsoon. Complaints are
scattered across phone calls and social media, so nobody — residents or the
municipality — knows where the problems actually concentrate. Urban Drainage
Monitor turns residents into the reporting network and gives the city a map,
analytics and a maintenance workflow."

## 2. Public map — no login needed (45 seconds)

Open `/map`.

- Point out that this page needs **no account**: accountability is public.
- Show the markers: each is a reported drainage problem at its real coordinates.
- Change a filter (issue type / severity / status / time window) and show the
  map responding.
- Switch on the heatmap / hotspot view: "these circles are computed by PostGIS
  in the database — clustering reports that are physically close together."
- Say explicitly: "no citizen name, email or user ID is returned by this public
  endpoint — only the problem and its location."

## 3. Become a citizen (30 seconds)

Go to `/login` and sign in as `asha@example.com`, or use **Register** to create
a fresh account live.

- Mention: public registration always creates a **citizen**; nobody can make
  themselves an admin through the signup form.
- Land on the citizen dashboard.

## 4. Report a drainage problem (1 minute 30 seconds)

Open **Report Issue**.

1. Choose an **issue type** (e.g. blocked drain, waterlogging, sewage overflow).
2. Choose a **severity** (low / medium / high / critical).
3. Type a short description.
4. Pick the location on the Leaflet map — click the map, or press "Use my
   current location" if the browser allows it.
5. Submit.

Say: "Flask validated every field and the coordinate range server-side, and
PostgreSQL stored the point as a PostGIS geography value with SRID 4326."

## 5. Duplicate detection (1 minute)

Start a **second** report at almost the same place with the same issue type.

- The app shows: *"A similar drainage report already exists nearby."* with the
  existing report's ID, issue type, status and the distance in metres.
- Press **Cancel** — nothing is saved. Explain: "the citizen stays in control;
  we never silently reject or delete a report."
- Submit again and press **Continue Anyway** — the report is created.
- Explain the rule: same issue type, still active, within **100 metres**, within
  the last **30 days**, confidence at or above the threshold. PostGIS
  `ST_DWithin` / `ST_Distance` on the indexed geography column does the search.

## 6. My Reports and the status timeline (30 seconds)

Open **My Reports**, then open one report.

- Show the read-only location map.
- Show the **status timeline**: every status change with its timestamp — this is
  how a resident follows their complaint instead of calling for updates.

## 7. Switch to admin — dashboard (45 seconds)

In the second tab, log in as `admin@example.com`.

- Show the live statistics cards (total, open, resolved, high/critical).
- Show the report table: **filter** by status or severity, **search** text, and
  **paginate**.

## 8. Process a report (1 minute)

Open the report the citizen just submitted.

- Show the location map and report details.
- Update the status: `NEW → PENDING_VERIFICATION → VERIFIED → ASSIGNED →
  IN_PROGRESS → RESOLVED` (add a comment on one change).
- Explain: invalid jumps are rejected by the backend, `RESOLVED` and `REJECTED`
  are terminal, and every change is written to the status history.
- Switch back to the citizen tab and refresh the report: the citizen sees the
  same timeline.

## 9. Analytics (45 seconds)

Scroll to the **Analytics** section.

- Summary cards, reports-over-time trend, breakdowns by status / severity /
  issue type / month, average and median time to resolve, and the geographic
  spread computed by PostGIS.
- Say: "all of this is aggregated by PostgreSQL in one admin-only endpoint — the
  browser never counts records itself."

## 10. ML risk prediction prototype (1 minute)

Open the **Risk Prediction** section and press **Train model**.

- Show the resulting LOW / MEDIUM / HIGH areas with their scores and the
  indicators behind each one (report count, recent reports, high-severity count,
  unresolved count, density, recency).
- Read the disclaimer out loud:
  > "Prototype risk prediction based on available crowdsourced report data.
  > Predictions are not official flood warnings."
- Be explicit: "There are no real flood-outcome labels available for this
  project, so we use a documented **proxy** target and we make **no accuracy
  claim**. It is an explainable logistic-regression baseline, deliberately not a
  deep-learning model, because the data does not justify one. Real rainfall,
  verified flood incidents, drainage capacity and terrain data would be needed
  to make it meaningful."

## 11. Civic / environmental data (30 seconds)

Open the **Civic / Environmental Data** section.

- Point at the banner: **"DEMO DATA — NOT OFFICIAL GOVERNMENT DATA"**.
- Say: "No verified public government API was available for this project, so
  these rainfall, drainage-infrastructure, flood-incident and municipal-service
  records are illustrative placeholders. The provider layer is built so a real
  verified API can be connected with environment variables alone, with the key
  kept server-side and timeouts, rate limits and provider failures handled."

## 12. Back to the public map (20 seconds)

Return to `/map` and show that the newly reported and processed problem now
appears in the community view.

## 13. Close — community and SDG impact (30 seconds)

"One resident's 60-second report becomes municipal evidence: a mapped location,
a tracked workflow, aggregated analytics and a prototype risk signal — without
exposing anyone's identity. That maps onto SDG 6 (clean water and sanitation),
SDG 11 (sustainable cities and communities) and SDG 13 (climate action)."

Optionally end on the honest status: the frontend is published, and the Flask +
PostGIS backend is fully prepared for Render + Supabase deployment, which is the
remaining account-side step.

---

## Fallback plan if something is unavailable

| Problem during the demo | What to do |
| --- | --- |
| Map tiles do not load | Talk through the markers/filters; OpenStreetMap tiles need internet access. |
| Backend not running | Start `python -m backend.app`; the UI shows "Cannot reach the server" until it is up. |
| Geolocation blocked | Click the map manually — that is the primary way to set a location. |
| No duplicate warning appears | Place the second report closer (within 100 m) and use the same issue type. |
| Risk training says data is insufficient | Run `flask --app backend.app seed`, or add a few reports first. |
