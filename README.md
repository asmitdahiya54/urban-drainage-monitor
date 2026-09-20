# 🌧️ Urban Drainage Monitor

### Crowdsourced GIS-Based Urban Drainage Reporting, Monitoring & Risk Analysis Platform

> **Turning citizen observations into location-based insights for cleaner, safer and more responsive urban infrastructure.**

Urban Drainage Monitor is a community-driven civic technology platform that enables residents to report drainage problems with precise geographic locations and allows administrators to monitor, verify, analyse and resolve those issues through a centralized dashboard.

The platform combines **crowdsourced reporting, GIS mapping, spatial analysis, PostgreSQL/PostGIS, analytics, duplicate detection and an explainable machine-learning prototype** to create a structured digital record of urban drainage problems.

---

## 👥 Team

| Role            | Name           |
| --------------- | -------------- |
| **Team Name**   | **AdamX**      |
| **Team Leader** | **Asmit**      |
| **Member**      | Dikshit        |
| **Member**      | Manish Chauhan |
| **Member**      | Gourav         |
| **Member**      | Aditya Dangi   |

---

## 📌 Problem Statement

Blocked, damaged, overflowing and poorly maintained drainage systems can lead to:

* Urban waterlogging
* Street flooding
* Property damage
* Traffic disruption
* Standing contaminated water
* Public health risks
* Repeated unresolved complaints

Traditional complaint systems are often distributed across phone calls, social media, physical complaints and disconnected channels.

This creates several problems:

* Residents cannot easily determine whether an issue has already been reported.
* Municipal teams lack a unified location-based view of drainage problems.
* Multiple citizens may report the same physical problem.
* Historical geographic information is difficult to maintain.
* Maintenance teams have limited analytical information for identifying problem concentrations.

Urban Drainage Monitor addresses these challenges through a **centralized, location-aware civic reporting platform**.

---

# 💡 Our Solution

The platform allows citizens to report drainage issues using an interactive map.

A typical workflow is:

```text
Citizen
   │
   ▼
Report Drainage Issue
   │
   ├── Issue Type
   ├── Severity
   ├── Description
   └── Exact Location
   │
   ▼
Backend Validation
   │
   ▼
PostgreSQL + PostGIS
   │
   ├── Duplicate Detection
   ├── Spatial Analysis
   ├── Analytics
   └── Risk Analysis
   │
   ▼
Administrator Dashboard
   │
   ├── Verify
   ├── Assign
   ├── Track
   └── Resolve
   │
   ▼
Public GIS Map + Community Visibility
```

The system treats residents as a distributed **community sensor network**: the people who encounter infrastructure problems can report them directly, while administrators receive structured geographic information for monitoring and action.

---

# 🎯 Project Objectives

The major objectives of the project are:

1. Enable residents to report drainage problems quickly.
2. Capture accurate geographic locations for every report.
3. Provide a public GIS map of reported drainage problems.
4. Visualize high-concentration areas using heatmaps and spatial clustering.
5. Provide administrators with a structured verification and resolution workflow.
6. Maintain a complete status history for reported problems.
7. Reduce duplicate reports for the same physical issue.
8. Generate analytics from collected drainage reports.
9. Demonstrate an explainable prototype for area-level drainage risk analysis.
10. Provide an integration layer for future civic and environmental datasets.

---

# 🌍 Sustainable Development Goals

The project supports multiple United Nations Sustainable Development Goals.

| SDG                                             | Contribution                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **SDG 6 — Clean Water and Sanitation**          | Helps identify blocked and overflowing drainage systems and sewage-related issues more efficiently.              |
| **SDG 11 — Sustainable Cities and Communities** | Uses community participation and geographic information to support better urban infrastructure monitoring.       |
| **SDG 13 — Climate Action**                     | Builds a local record of waterlogging and drainage pressure that can support future climate adaptation analysis. |

The SDG mapping is based on the project's intended civic and environmental impact.

---

# ✨ Key Features

## 👤 Citizen Platform

Citizens can:

* Create an account.
* Sign in securely.
* Report drainage issues.
* Select an issue type.
* Set the severity.
* Add a description.
* Select an exact location using an interactive map.
* Use device geolocation where available.
* View their submitted reports.
* View individual report details.
* Track report status.
* View the complete status timeline.
* Receive a warning when a similar nearby report already exists.

---

## 🗺️ Public GIS Map

The public map is available without requiring an account.

It provides:

* Drainage issue markers
* Issue type information
* Severity information
* Report status
* Report timestamps
* Filters
* Heatmap visualization
* Spatial hotspot clustering
* Risk-area visualization

The public map intentionally does **not** expose citizen identities, email addresses or user IDs.

---

# 🔎 Smart Duplicate Detection

One of the major features is location-based duplicate detection.

Before a new report is stored, the backend checks nearby reports using PostGIS spatial queries.

### Detection process

The system considers:

* Geographic distance
* Issue type
* Severity
* Report age
* Current status

The current implementation searches within a **100-metre radius** and considers reports from the previous **30 days**.

A confidence score is calculated for candidate reports.

A report is considered a likely duplicate when:

```text
Same Issue Type
       +
Active Existing Report
       +
Confidence ≥ 0.75
       ↓
Likely Duplicate
```

The system does **not silently delete or reject** the citizen's report.

Instead, the citizen receives options:

```text
Similar report found nearby.

[ Continue Anyway ]    [ Cancel ]
```

This makes duplicate detection advisory rather than an irreversible automatic decision.

---

# 🏢 Administrator Dashboard

Administrators receive a centralized management interface.

### Dashboard capabilities

* Live report statistics
* Report filtering
* Text search
* Pagination
* Report details
* Geographic location
* Status management
* Status history
* Analytics
* Spatial monitoring
* Risk analysis
* Civic/environmental data interface

### Report lifecycle

```text
NEW
 ↓
PENDING VERIFICATION
 ↓
VERIFIED
 ↓
ASSIGNED
 ↓
IN PROGRESS
 ↓
RESOLVED
```

Reports may also be rejected through the documented workflow.

Every meaningful status transition creates a status-history record.

---

# 📊 Analytics

The platform aggregates report information directly through SQL/PostGIS.

Administrators can analyse:

* Total reports
* Resolved reports
* Unresolved reports
* Rejected reports
* High-severity reports
* Reports awaiting review
* Resolution rate
* Reports over time
* Reports by status
* Reports by severity
* Reports by issue type
* Monthly report trends
* Average resolution time
* Median resolution time
* Geographic spread

The analytics layer performs aggregation on the backend rather than downloading the complete report dataset to the browser.

---

# 🤖 ML Risk Prediction Prototype

The project includes a deliberately small and explainable machine-learning prototype.

Its purpose is to identify areas experiencing higher **reported drainage pressure**.

The prototype produces:

```text
LOW
MEDIUM
HIGH
```

risk levels based on available crowdsourced report information.

### Important limitation

This is **not a flood forecasting system**.

The model does not have verified flood-outcome labels and therefore does not claim real-world flood prediction accuracy.

The current prototype uses a proxy target derived from factors such as:

* Report volume
* Severity
* Outstanding report backlog
* Recency

The model is designed so that future verified datasets can be added without redesigning the entire platform.

---

# 🔐 Security

Security has been considered throughout the system.

Implemented protections include:

* JWT-based authentication
* Password hashing
* Database-backed role verification
* Server-side validation
* Coordinate validation
* Enum validation
* Request size limits
* Restricted CORS
* Protective HTTP headers
* Safe JSON error responses
* Protected administrator endpoints
* Privacy-safe public APIs
* Protection against tampered authentication tokens
* Injection-related security testing

Passwords are never stored in plaintext.

Public endpoints also avoid exposing citizen identity information.

---

# 🏗️ System Architecture

```text
                    ┌─────────────────────────────┐
                    │        React PWA             │
                    │                             │
                    │  Citizen Interface          │
                    │  Admin Dashboard            │
                    │  GIS Maps                   │
                    │  Analytics                   │
                    │  Risk Visualization         │
                    │  Civic Data Interface       │
                    └──────────────┬──────────────┘
                                   │
                                   │ /api
                                   ▼
                    ┌─────────────────────────────┐
                    │        Flask REST API        │
                    │                             │
                    │  Authentication             │
                    │  Reports                    │
                    │  Administration             │
                    │  GIS / PostGIS               │
                    │  Duplicate Detection        │
                    │  Analytics                  │
                    │  Risk Prototype             │
                    │  Civic Data Layer           │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │     PostgreSQL + PostGIS     │
                    │                             │
                    │  Users                      │
                    │  Reports                    │
                    │  Status History              │
                    │  Risk Predictions            │
                    │  Spatial Indexes              │
                    └─────────────────────────────┘
```

---

# 🧰 Technology Stack

| Layer             | Technology                                    |
| ----------------- | --------------------------------------------- |
| Frontend          | React 18 + Vite                               |
| Language          | TypeScript / TSX                              |
| Routing           | TanStack Start                                |
| Maps              | Leaflet + React Leaflet                       |
| Backend           | Python 3 + Flask                              |
| API               | Flask REST API                                |
| ORM               | SQLAlchemy 2                                  |
| Database          | PostgreSQL                                    |
| Spatial Database  | PostGIS                                       |
| Migrations        | Flask-Migrate / Alembic                       |
| Authentication    | Flask-JWT-Extended                            |
| Password Security | Werkzeug Password Hashing                     |
| Machine Learning  | Python + Scikit-learn                         |
| ML Algorithm      | StandardScaler + Logistic Regression baseline |
| Production Server | Gunicorn                                      |
| Testing           | Pytest                                        |
| Spatial Indexing  | GiST                                          |

The technology stack follows the implemented project architecture.

---

# 🗄️ Database Design

The primary database tables are:

### `users`

Stores:

* Citizens
* Administrators
* Account information
* Roles

### `reports`

Stores:

* Issue type
* Severity
* Description
* Latitude
* Longitude
* PostGIS geographic location
* Status
* Creation timestamp
* Resolution information

### `report_status_history`

Stores the complete lifecycle of report status changes.

### `risk_predictions`

Stores:

* Geographic area
* Risk score
* Risk level
* Indicators
* Model version
* Prediction timestamp

---

# 📍 Spatial Database

PostGIS is used for geographic operations.

The system uses:

```text
geography(POINT, 4326)
```

for report locations.

Spatial capabilities include:

* `ST_DWithin`
* `ST_Distance`
* `ST_ClusterDBSCAN`
* Spatial centroids
* Spatial aggregation
* Geographic spread analysis

GiST indexes are used to improve spatial query performance.

---

# 🧑‍💻 Project Structure

```text
urban-drainage-monitor/
│
├── src/
│   ├── routes/
│   │   ├── api.$.ts
│   │   ├── login
│   │   ├── register
│   │   ├── report
│   │   ├── reports
│   │   ├── map
│   │   ├── dashboard
│   │   └── admin
│   │
│   ├── components/
│   │   ├── UI
│   │   ├── maps
│   │   ├── admin
│   │   └── navigation
│   │
│   ├── services/
│   │   └── api.ts
│   │
│   └── config/
│       └── backend.ts
│
├── backend/
│   ├── app.py
│   ├── wsgi.py
│   ├── config.py
│   ├── extensions.py
│   ├── seed.py
│   │
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── migrations/
│   └── tests/
│
├── ml/
│   ├── risk_model.py
│   └── train_risk_model.py
│
├── docs/
├── DEMO.md
├── VIVA_NOTES.md
├── render.yaml
├── Procfile
├── .env.example
└── README.md
```

---

# 🚀 Getting Started

## Prerequisites

Install:

* Python 3.10+
* PostgreSQL 14+
* PostGIS
* Node.js / Bun
* Git

---

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd urban-drainage-monitor
```

---

# 🐍 Backend Setup

## 2. Create Virtual Environment

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

---

## 3. Install Backend Dependencies

```bash
pip install -r backend/requirements.txt
```

---

# 🗄️ Database Setup

Create the database:

```bash
createdb -U postgres urban_drainage_db
```

Enable PostGIS:

```bash
psql -U postgres -d urban_drainage_db \
-c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Verify:

```bash
psql -U postgres -d urban_drainage_db \
-c "SELECT postgis_version();"
```

---

# ⚙️ Environment Configuration

Create the environment file:

```bash
cp .env.example .env
```

Configure:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/urban_drainage_db

SECRET_KEY=change-this-in-development

JWT_SECRET_KEY=change-this-jwt-secret

JWT_ACCESS_TOKEN_MINUTES=120

FLASK_APP=backend.app
```

Never commit real passwords, tokens or API keys.

---

# 🔄 Run Database Migrations

```bash
flask --app backend.app db upgrade
```

---

# 🌱 Optional Demo Data

To insert development/demo data:

```bash
flask --app backend.app seed
```

To reset and recreate demo data:

```bash
flask --app backend.app seed --reset
```

Demo data should only be used for development.

---

# ▶️ Start the Backend

```bash
python -m backend.app
```

The API runs on:

```text
http://localhost:5000
```

Check the API:

```bash
curl http://localhost:5000/api/health
```

Expected result:

```json
{
  "status": "ok",
  "database": "connected"
}
```

---

# 💻 Frontend Setup

From the project root:

```bash
bun install
```

or:

```bash
npm install
```

Start the development server:

```bash
bun run dev
```

or:

```bash
npm run dev
```

Open the URL displayed by Vite.

---

# 🔑 Authentication

The system uses JWT-based authentication.

### Citizen

Public registration creates a citizen account.

Citizens can:

```text
Register
   ↓
Login
   ↓
Dashboard
   ↓
Submit Reports
   ↓
Track Reports
```

### Administrator

Administrators have additional access to:

```text
Admin Dashboard
      ↓
All Reports
      ↓
Verification
      ↓
Assignment
      ↓
Analytics
      ↓
Risk Analysis
```

Public registration cannot be used to create an administrator account.

---

# 📡 API Overview

## Authentication

| Method | Endpoint             | Purpose                |
| ------ | -------------------- | ---------------------- |
| POST   | `/api/auth/register` | Register citizen       |
| POST   | `/api/auth/login`    | Login                  |
| GET    | `/api/auth/me`       | Current user           |
| POST   | `/api/auth/logout`   | Logout acknowledgement |

---

## Citizen Reports

| Method | Endpoint                       | Purpose                 |
| ------ | ------------------------------ | ----------------------- |
| POST   | `/api/reports`                 | Create report           |
| GET    | `/api/reports`                 | List reports            |
| GET    | `/api/reports/<id>`            | View report             |
| POST   | `/api/reports/check-duplicate` | Check nearby duplicates |

---

## Public GIS

| Method | Endpoint                | Purpose          |
| ------ | ----------------------- | ---------------- |
| GET    | `/api/reports/map`      | Public map data  |
| GET    | `/api/reports/hotspots` | Spatial hotspots |

---

## Administration

| Method | Endpoint                         | Purpose               |
| ------ | -------------------------------- | --------------------- |
| GET    | `/api/admin/stats`               | Dashboard statistics  |
| GET    | `/api/admin/reports`             | Search/filter reports |
| GET    | `/api/admin/reports/<id>`        | Report details        |
| PUT    | `/api/admin/reports/<id>/status` | Update report status  |
| GET    | `/api/admin/analytics`           | Analytics             |

---

# 🗺️ GIS Capabilities

The platform uses geographic information at several levels.

### Citizen Level

```text
Select Location
      ↓
Latitude + Longitude
      ↓
PostGIS Geography Point
```

### Public Level

```text
Reports
   ↓
Markers
   ↓
Heatmap
   ↓
Hotspot Clustering
```

### Administrative Level

```text
Spatial Reports
      ↓
Geographic Aggregation
      ↓
Problem Concentrations
      ↓
Maintenance Insights
```

---

# 📈 Analytics Pipeline

```text
Citizen Reports
      │
      ▼
PostgreSQL / PostGIS
      │
      ▼
SQL Aggregation
      │
      ├── Status
      ├── Severity
      ├── Issue Type
      ├── Time
      └── Geography
      │
      ▼
Admin Analytics Dashboard
```

The browser does not independently calculate the database totals; aggregation is performed on the backend.

---

# 🧪 Testing

The project contains an automated backend test suite covering:

* Authentication
* Authorization
* Citizen reporting
* Administrator report management
* Public maps
* Spatial analysis
* Analytics
* Duplicate detection
* Risk prediction
* Civic data
* Security regression testing

The current implementation reports:

```text
150 backend tests
```

against a real PostgreSQL + PostGIS test database.

---

## Run Tests

```bash
pytest
```

Frontend type checking:

```bash
bunx tsgo --noEmit
```

Linting:

```bash
bun run lint
```

Production build:

```bash
bun run build
```

---

# 🛡️ Security Testing

The security regression suite covers areas including:

* Authentication
* Authorization
* Tampered JWT tokens
* Privacy
* Injection attempts
* Malformed input
* Security headers
* Configuration security

The documented implementation contains **28 security regression tests** within the complete test suite.

---

# 🌐 Production Deployment

The production architecture is designed as:

```text
Frontend
   │
   ▼
Flask API
   │
   ▼
PostgreSQL + PostGIS
```

The backend is prepared for deployment using:

* Gunicorn
* WSGI
* Environment variables
* PostgreSQL
* PostGIS
* Database migrations
* Health checks

Required production configuration includes:

```text
DATABASE_URL
SECRET_KEY
JWT_SECRET_KEY
JWT_ACCESS_TOKEN_MINUTES
CORS_ORIGINS
FLASK_APP
FLASK_DEBUG
```

The production backend requires account-side database and server configuration before the complete deployed system can operate end-to-end.

---

# ⚠️ Current Limitations

The project currently has several documented limitations.

### Machine Learning

The ML component is a prototype and:

* Does not use verified flood-event labels.
* Does not provide official flood warnings.
* Does not claim production prediction accuracy.
* May be affected by reporting bias.
* Does not currently use rainfall, terrain, drainage-capacity or verified historical flood datasets.

### Civic Data

The current civic/environmental provider uses clearly labelled demonstration data rather than verified government measurements.

### Platform

Current limitations also include:

* No image upload for reports.
* No email/SMS status notifications.
* No login rate limiting.
* JWT logout does not revoke an already-issued token before expiry.
* No dedicated administrator audit log beyond report status history.
* No duplicate merge/link functionality.
* Duplicate detection does not compare photos or semantic text similarity.

These limitations are documented in the implementation.

---

# 🔮 Future Enhancements

The platform can be extended with:

### 📷 Richer Reports

* Photo uploads
* Image validation
* Image-based issue analysis

### 🌧️ Environmental Intelligence

* Real rainfall data
* Historical flooding datasets
* Drainage capacity data
* Elevation and terrain information
* Verified infrastructure datasets

### 🏛️ Civic Integration

* Official government APIs
* Municipal infrastructure systems
* Maintenance databases

### 📲 Notifications

* Email notifications
* SMS notifications
* Push notifications

### 👷 Workforce Management

* Municipal crew assignment
* SLA tracking
* Maintenance scheduling

### 🌐 Accessibility

* Multi-language interface
* Offline-first reporting
* Better support for poor-connectivity environments

These extensions align with the project's documented future-improvement roadmap.

---

# 🔄 Complete User Journey

```text
                    ┌───────────────┐
                    │    Citizen    │
                    └───────┬───────┘
                            │
                            ▼
                     Create Account
                            │
                            ▼
                         Login
                            │
                            ▼
                    Report Drainage
                            │
                            ▼
                     Select Location
                            │
                            ▼
                   Duplicate Check
                       /        \
                     Yes         No
                      │           │
                      ▼           ▼
                  Warning      Submit
                      │           │
                      └─────┬─────┘
                            ▼
                     Database
                            │
                            ▼
                   Administrator
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
              Verify     Assign     Analyse
                 │          │          │
                 └──────────┼──────────┘
                            ▼
                       In Progress
                            │
                            ▼
                         Resolved
                            │
                            ▼
                    Citizen Tracking
```

---

# 🧠 Design Principles

The project follows several important principles:

### Community First

Residents are the primary source of real-world issue observations.

### Location First

Every report is associated with geographic information whenever available.

### Privacy by Design

Public interfaces expose useful infrastructure information without exposing citizen identities.

### Explainable Intelligence

The risk-analysis prototype prioritizes explainability rather than claiming unsupported prediction accuracy.

### Data-Driven Administration

Aggregated geographic and temporal information helps administrators understand patterns rather than relying only on individual complaints.

### Safe Automation

Automated systems such as duplicate detection provide warnings and decision support instead of silently removing citizen reports.

---

# 📊 Implementation Status

| Component                     | Status                       |
| ----------------------------- | ---------------------------- |
| Core MVP                      | ✅ Complete                   |
| Citizen Reporting             | ✅ Complete                   |
| Authentication                | ✅ Complete                   |
| Role-Based Access             | ✅ Complete                   |
| GIS Mapping                   | ✅ Complete                   |
| PostGIS Spatial Analysis      | ✅ Complete                   |
| Duplicate Detection           | ✅ Complete                   |
| Admin Dashboard               | ✅ Complete                   |
| Analytics                     | ✅ Complete                   |
| ML Risk Prototype             | ✅ Complete                   |
| Civic Data Integration Layer  | ✅ Complete                   |
| Security Hardening            | ✅ Complete                   |
| Automated Testing             | ✅ 150 Tests                  |
| Production Configuration      | ✅ Complete                   |
| Production Backend Deployment | ⏳ Pending account-side setup |

Current implementation status is based on the project's documented verification results.

---

# 🏁 Expected Impact

Urban Drainage Monitor is designed to create a structured connection between:

```text
Citizens
   ↓
Real-World Infrastructure Problems
   ↓
Geographic Data
   ↓
Spatial Analysis
   ↓
Administrative Action
   ↓
Better Infrastructure Monitoring
```

Instead of treating drainage complaints as isolated messages, the platform converts them into **structured, location-aware and analyzable civic data**.

---

# 📚 Project Documentation

Additional project documentation includes:

* `DEMO.md` — Demonstration workflow
* `VIVA_NOTES.md` — Viva questions and answers
* `docs/` — Additional technical documentation
* `ml/` — Machine-learning implementation
* `backend/tests/` — Automated backend tests

---

# 📜 License

This project was developed as an academic/project implementation.

If the project is later released publicly, an appropriate open-source license can be added here.

---

# 👨‍💻 Team AdamX

### Team Leader

**Asmit**

### Team Members

* **Dikshit**
* **Manish Chauhan**
* **Gourav**
* **Aditya Dangi**

---

## 🌧️ Urban Drainage Monitor

> **Report. Map. Analyse. Respond.**

*A community-driven approach to understanding and improving urban drainage infrastructure.*
