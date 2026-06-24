# QuickTap Connect
### Dell InnovateDash 2026 — Republic Polytechnic

A cloud-native event lead capture, enrichment, and routing system built for the **Dell Technologies Forum Singapore**.

---

## Problem Statement

Dell booth representatives currently share a single mobile device running a third-party lead-capture tool managed by an external events agency. Leads are not automatically segmented or routed, and reps cannot record detailed notes in the fast-paced booth environment.

**QuickTap Connect** solves this by providing:
- A self-service attendee registration form accessible from any device
- AI-powered lead enrichment and team routing (Gemini 2.5 Flash)
- Real-time team and line-manager dashboards
- Offline-tolerant operation with automatic sync
- PDPA-compliant personal data handling

---

## Team

| Member | Role |
|--------|------|
| Wee Teck | AI routing, lead scoring, analytics, follow-up logging, Docker |
| Haad | (your role) |
| Fiona | Rep dashboard |
| Alicia | (your role) |

---

## Architecture

```
Browser (attendee.html)
        │  POST /register
        ▼
  Node.js / Express (server.js)
        │
        ├── Gemini 2.5 Flash API  (async AI enrichment)
        │
        ├── MySQL 8.0             (primary store)
        │
        └── attendees.json        (offline fallback)
```

All components are containerised via Docker Compose — no manual setup per device.

---

## Pages & Endpoints

| URL | Description |
|-----|-------------|
| `/` | Attendee self-registration form (PDPA consent + offline queue) |
| `/dashboard` | Rep dashboard — all leads, searchable/filterable, sortable table |
| `/team` | Team view — leads filtered by Dell team, grouped by segment |
| `/analytics` | Line-manager analytics — KPIs, charts, hot leads list |

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Capture a new lead (validates PDPA consent) |
| GET | `/api/leads` | All leads (API key required if set) |
| GET | `/api/leads/team/:teamName` | Leads for a specific Dell team |
| PATCH | `/api/leads/:id` | Update lead status/recommendation |
| POST | `/api/leads/:id/followup` | Log a follow-up action |
| GET | `/api/analytics` | Analytics data (priority, team, segment breakdowns) |
| GET | `/api/export` | Download all leads as CSV (optional `?team=` filter) |
| POST | `/api/webhook/delivery` | CRM delivery webhook (HMAC-verified) |

---

## Lead Scoring (Rule-Based, Auditable)

| Factor | Points |
|--------|--------|
| Enterprise (≥1000 employees) | 45 |
| Mid-Market (200–999) | 28 |
| Small Business (<200) | 10 |
| Interest: Storage or Cloud | 35 |
| Interest: AI PCs or Consultancy | 20 |
| Email + Phone both provided | 20 |
| **Max score** | **100** |

- **HOT** ≥ 70 · **WARM** ≥ 45 · **COLD** < 45
- Job title is deliberately excluded — free-text fields cannot be scored reliably.

---

## AI Enrichment

Each lead triggers a background call to **Gemini 2.5 Flash** with:
- Company name + size tier
- Interest area + Dell product context
- Current IT challenge (if provided by rep)

Returns a single actionable follow-up recommendation specific to the lead's profile. Falls back to a rule-based template if the API is unavailable.

---

## Privacy & PDPA Compliance

- PDPA consent checkbox is **mandatory** — registration is blocked server-side without it
- Consent is stored (`pdpaConsent` column) and visible in all dashboards
- No facial recognition or video recording
- Contact data is stored only in the containerised MySQL instance
- Data can be deleted via the MySQL admin or by request

---

## Getting Started

### Prerequisites
- Docker Desktop
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/24011183/C300-FYP-
cd C300-FYP-

# 2. Create your .env file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Start everything
docker compose up --build

# 4. Open in browser
open http://localhost:3000
```

### Reset the database (wipe all leads)

```bash
docker compose down -v
docker compose up --build
```

---

## Cloud-Native Design

| Principle | Implementation |
|-----------|---------------|
| Containerisation | Docker (Node 18 Alpine + MySQL 8.0) |
| Declarative config | `docker-compose.yml`, `init.sql` |
| Portability | Runs on any Docker host — laptop, cloud VM, or Dell server |
| Offline resilience | `localStorage` queue flushes automatically on reconnect |
| API-first | All data exposed via REST endpoints for future CRM integration |
| Separation of concerns | Frontend (HTML) / Backend (Express) / DB (MySQL) fully decoupled |

---

## File Structure

```
├── server.js           # Express backend — all routes and business logic
├── attendee.html       # Attendee self-registration form
├── dashboard.html      # Rep dashboard (all leads)
├── team-dashboard.html # Team view (filtered by Dell team)
├── analytics.html      # Line-manager analytics
├── init.sql            # MySQL schema
├── Dockerfile          # Node app container
├── docker-compose.yml  # Multi-container orchestration
├── .env.example        # Environment variable template
└── attendees.json      # Auto-created JSON fallback store
```