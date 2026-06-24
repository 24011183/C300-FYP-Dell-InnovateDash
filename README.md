# QuickTap Connect
### Dell InnovateDash 2026 — Republic Polytechnic

A cloud-native event lead capture, enrichment, and routing system built for the **Dell Technologies Forum Singapore**.

---

## Problem Statement

Dell booth representatives currently share a single mobile device running a third-party lead-capture tool managed by an external events agency. Leads are not automatically segmented or routed to the right sales teams, reps have no time to record detailed notes, and the agency only sends a consolidated spreadsheet days after the event — by then leads are cold.

**QuickTap Connect** solves this by providing:
- A self-service attendee registration form accessible from any device via QR code
- Automatic lead routing to the correct Dell sales team based on interest area
- AI-powered follow-up recommendations using Gemini 2.5 Flash
- Real-time lead dashboard with scoring, filtering, and follow-up logging
- Offline-tolerant operation with automatic sync when connectivity is restored
- PDPA-compliant personal data handling — no plaintext files, consent mandatory

---

## Team

| Member | Role |
|--------|------|
| Wee Teck | Backend, routing, lead scoring, follow-up logging, Docker |
| Haad | Attendee registration form |
| Fiona | Rep dashboard |
| Alicia | NFC integration and backend support |

---

## Architecture

```
Attendee scans QR code → opens registration form on their phone
        │  POST /register
        ▼
  Node.js / Express (server.js)
        │
        ├── Input validation + PDPA consent check
        ├── Duplicate check (email + interest)
        ├── MySQL 8.0 — lead inserted immediately
        ├── Response sent to client instantly
        │
        └── Gemini 2.5 Flash API (background enrichment)
                └── Recommendation written back to MySQL async
```

All components are containerised via Docker Compose — one command starts everything, no manual setup per device.

---

## Pages

| URL | Who Uses It | Purpose |
|-----|-------------|---------|
| `/` | Attendee / Booth rep | Self-registration form — captures lead details, PDPA consent, current IT challenge |
| `/dashboard` | Booth rep + Dell sales team | All leads in real time — searchable, filterable, sortable, follow-up logging, CSV export |

---

## REST API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | None | Capture a new lead (validates PDPA consent) |
| GET | `/api/leads` | API Key | All leads ordered by newest first |
| GET | `/api/leads/team/:teamName` | API Key | Leads filtered by Dell team |
| PATCH | `/api/leads/:id` | API Key | Update routing status or recommendation |
| POST | `/api/leads/:id/followup` | API Key | Log a follow-up action for a lead |
| GET | `/api/export` | API Key | Download all leads as CSV (?team= filter optional) |
| POST | `/api/webhook/delivery` | HMAC sig | CRM delivery webhook for future Salesforce integration |
| GET | `/api/health` | None | Returns DB connection status |

---

## Team Routing

Interest area selected at registration maps directly to a Dell sales team:

| Interest | Routed To |
|----------|-----------|
| AI PCs | Client Solutions Group (CSG) |
| Storage | Infrastructure Solutions Group (ISG) |
| Cloud | APEX & Cloud Services |
| Consultancy | Professional Services |

---

## Lead Scoring (Rule-Based, Auditable)

Scoring is deterministic — no AI in the numbers. Every point is justifiable.

| Factor | Max Points | Logic |
|--------|------------|-------|
| Company size | 50 | Enterprise >=1000 = 50, Mid-market >=200 = 30, Small >=50 = 15, Micro = 5 |
| Job title seniority | 30 | C-suite/Owner = 30, VP/Director = 20, Manager/Senior = 10, Other = 0 |
| Current challenge captured | 20 | Rep recorded context = real conversation happened |
| Maximum | 100 | |

- HOT >= 60 — prioritise within 24 hours
- WARM >= 35 — follow up within 48 hours
- COLD < 35 — needs more qualification

---

## AI Enrichment

Each lead triggers a background call to **Gemini 2.5 Flash** with the full lead profile:
- Company name, size tier, job title
- Interest area with Dell product context
- Current IT challenge if captured by the rep

Returns one specific, actionable follow-up recommendation. If Gemini is unavailable, a rule-based fallback template fires automatically — no lead is ever left blank.

---

## Duplicate Prevention

Duplicate check is email AND interest:
- Same person, same booth (same email + same interest) — blocked
- Same person, different booth (same email + different interest) — allowed, creates a second lead routed to the other Dell team

---

## Offline Resilience

If the server is unreachable mid-event:
1. Lead is saved to browser localStorage queue
2. Rep sees a message: "Saved locally — will auto-sync when connection restores"
3. window.addEventListener("online") fires when connectivity returns
4. Queue flushes automatically — no action needed from the rep

---

## Privacy and PDPA Compliance

- PDPA consent checkbox is mandatory — blocked client-side and server-side without it
- Consent stored per lead (pdpaConsent column), visible in dashboard
- No facial recognition, no video recording
- All personal data stored only in the containerised MySQL instance
- No plaintext file fallback — attendees.json does not exist in this project
- Data can be deleted on request via MySQL

---

## Getting Started

### Prerequisites
- Docker Desktop
- A Gemini API key from https://aistudio.google.com/app/apikey

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/24011183/C300-FYP-Dell-InnovateDash
cd C300-FYP-Dell-InnovateDash

# 2. Create your .env file
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# 3. Start everything
docker compose up --build

# 4. Open in browser
# http://localhost:3000           - Registration form
# http://localhost:3000/dashboard - Rep dashboard
# http://localhost:3000/api/health - Health check
```

### Reset the database (wipe all leads)

```bash
docker compose down -v
docker compose up --build
```

### Generate a QR code for the booth

1. Run ipconfig (Windows) or ifconfig (Mac/Linux) to find your IPv4 address
2. Your registration URL is http://<your-ip>:3000
3. Generate a QR code at https://www.qrcode-monkey.com and print it
4. Attendees on the same network scan it and the form opens on their phone

---

## Cloud-Native Design

| Principle | Implementation |
|-----------|---------------|
| Containerisation | Docker (Node 18 Alpine + MySQL 8.0) |
| Declarative config | docker-compose.yml, init.sql |
| Portability | Runs on any Docker host — laptop, cloud VM, or Dell server |
| Health monitoring | GET /api/health pings MySQL, Docker healthcheck on both containers |
| Offline resilience | localStorage queue auto-flushes on reconnect |
| API-first | All data via REST — ready for CRM/Salesforce integration |
| Separation of concerns | Frontend (HTML) / Backend (Express) / Database (MySQL) fully decoupled |
| Future integration | Webhook endpoint with HMAC signature verification |

---

## File Structure

```
├── server.js           # Express backend — all routes and business logic
├── attendee.html       # Attendee self-registration form
├── dashboard.html      # Rep and sales team dashboard
├── init.sql            # MySQL schema
├── Dockerfile          # Node 18 Alpine container
├── docker-compose.yml  # Multi-container orchestration with healthchecks
├── .env.example        # Environment variable template
├── .gitignore          # Excludes .env, node_modules
└── README.md           # This file
```