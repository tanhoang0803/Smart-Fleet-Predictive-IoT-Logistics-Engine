# Smart-Fleet: IoT Logistics & Predictive Maintenance Engine

> Turning reactive repairs into predictive intelligence — one sensor at a time.

**Developer:** TanQHoang © 2026
**Stack:** React · Redux Toolkit · Node.js · Express · Supabase · Upstash Redis · Docker
**Optimized for:** Honda Wave RSX · Ho Chi Minh City tropical climate · E10 fuel blend

[![CI/CD — Lint, Test, Build & Deploy](https://github.com/tanhoang0803/Smart-Fleet-Predictive-IoT-Logistics-Engine/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/tanhoang0803/Smart-Fleet-Predictive-IoT-Logistics-Engine/actions/workflows/ci-deploy.yml)

---

## The Vision

Most vehicle maintenance is driven by a simple number: odometer mileage. But in a tropical city like Ho Chi Minh City — where humidity regularly exceeds 85%, seasonal rain accelerates oxidation, and E10 fuel increases combustion residue — mileage alone is a lie.

**Smart-Fleet** resolves this gap. It correlates raw telemetry (mileage, trip frequency) with real-time atmospheric data from the OpenWeather API to compute *true* component wear. The result: maintenance predictions that account for the actual environment your fleet operates in — not just the distance traveled.

The system transitions vehicle upkeep from a reactive model ("wait until something breaks") to a predictive intelligence model ("intervene before wear becomes failure").

---

## Features

### Live Weather-Aware Maintenance
A dynamic multiplier system adjusts base service intervals in real time. When humidity crosses 70% RH, rain is detected, or temperature exceeds 37°C, the system automatically reduces maintenance thresholds — accounting for accelerated chain corrosion, lubricant breakdown, and air filter clogging specific to tropical conditions.

### Enterprise Alert State Machine
Maintenance tickets progress through a full lifecycle: `NORMAL → WARNING → CRITICAL → OVERDUE`. Each transition triggers appropriate notifications and UI state changes, preventing missed service events without alert fatigue.

### Route Optimizer with Weather Integration
Enter origin and destination coordinates to get:
- **Route distance** (Haversine × 1.3 urban road factor — no API key needed)
- **Duration estimate** at 25 km/h urban average
- **Live weather** at origin (temperature, humidity, wind, visibility, pressure, sunrise/sunset)
- **Weather-adjusted load factor** (reduced 10% if rain/storm detected)
- **Adjusted fuel estimate** (corrected for humidity degradation)
- **Maintenance warnings** ([CRITICAL] / [WARNING] / [INFO]) based on conditions
- **Smart destination recommendation** — when the destination doesn't meet maintenance safety thresholds, a nearby service station is surfaced with a "Change to [name]?" button; the user confirms before the route is redrawn (no silent auto-redirect)
- **Accept Route** automatically updates vehicle mileage and recalculates the full maintenance schedule

### Location-Aware Weather Widget
The Weather Conditions board updates immediately when a route is optimized — showing live conditions at the route's origin. Refresh/Accept resets it to the default Ho Chi Minh City view. Full display: city + date, large temperature + condition icon, 3×2 stats grid (humidity, wind speed, visibility, pressure, sunrise, sunset), wear multiplier, and 5-day forecast with icons.

### Latency Optimization via Redis Caching
All OpenWeather API calls are intercepted by an Upstash Redis caching layer:
- Current weather: 30-minute TTL
- 5-day forecast: 3-hour TTL
- Route results: 1-hour TTL

### Firebase FCM Push Notifications
Critical and overdue maintenance alerts are delivered via Firebase Cloud Messaging — ensuring drivers receive push notifications even when the app is backgrounded.

### Demo Credentials on Login Page
A collapsible demo credentials box is displayed below the Sign In form, allowing evaluators to log in instantly with pre-seeded test account details — no registration required for first-time exploration.

### Session Persistence
User sessions survive page refresh via `GET /auth/me` — no re-login required. The app shows a spinner until session state is confirmed before making auth routing decisions.

### Zero-Cost Map Stack
Map display uses **Leaflet + OpenStreetMap** (free, no API key). Route distance uses **Haversine formula** (zero dependency, always available). Google Maps is not required.

### Docker-Ready Infrastructure
Zero-config local deployment via Docker Compose. A multi-stage Dockerfile builds the React frontend with Vite and serves it through Nginx. The backend runs on a lightweight Alpine Node image.

---

## Technical Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | Component-driven UI with fast HMR |
| State | Redux Toolkit | Centralized fleet, auth, and weather state |
| Styling | Tailwind CSS | Utility-first responsive design |
| Backend | Node.js + Express | RESTful API, business logic, 3rd-party orchestration |
| Database | Supabase (PostgreSQL) | Persistent storage with Row Level Security |
| Cache | Upstash Redis | Rate-limit protection, API response caching |
| Weather | OpenWeather API | Real-time humidity, temperature, rain forecast |
| Map Display | Leaflet + OpenStreetMap | Free interactive map, no API key required |
| Route Distance | Haversine Formula | Zero-dependency distance calculation |
| Push Notifications | Firebase FCM | Critical alert delivery to mobile clients |
| Container | Docker + Docker Compose | Multi-service orchestration, environment parity |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│         Redux Store · Axios JWT Interceptor             │
│  FleetDashboard · MaintenanceGauge · WeatherWidget      │
│       MapView (Leaflet+OSM) · Route Optimizer           │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS + JWT (httpOnly cookies)
┌──────────────────────▼──────────────────────────────────┐
│                   Express API (/api/v1)                  │
│   Auth · Fleet · Maintenance · Weather · Routes · FCM   │
│              Zod Validation · Rate Limiter               │
└───┬──────────┬───────────┬────────────┬─────────────────┘
    │          │           │            │
    ▼          ▼           ▼            ▼
Supabase   Upstash     OpenWeather  Haversine
(Postgres)  (Redis)      API        (built-in)
    │          │
    │     ┌────┴───────────┐
    │     │  Cache Layer   │
    │     │  TTL: 30m/3h   │
    │     └────────────────┘
    │
    ▼
Firebase FCM
(Push Alerts)
```

---

## Predictive Logic: How It Works

The core algorithm in `MaintenanceService` computes adjusted service intervals using this formula:

```
Adjusted Interval (km) =
  Base Interval (km)
  × Humidity Multiplier   [0.6 – 1.0, derived from OpenWeather RH%]
  × Fuel Multiplier       [0.9 for E10 blend, 1.0 for RON95]
  × Load Factor           [0.75 – 1.0, derived from route distance + weather]
```

**Example — Engine Oil (Honda Wave RSX, mineral oil):**
- Base interval: 2,000 km
- Humidity: 88% RH → multiplier: 0.65
- E10 fuel → multiplier: 0.90
- Heavy load route → multiplier: 0.80
- **Adjusted interval: 2,000 × 0.65 × 0.90 × 0.80 = 936 km**

The same vehicle that could go 2,000 km between oil changes in ideal conditions needs service at under 1,000 km during monsoon season. Smart-Fleet surfaces this automatically.

---

## Alert Lifecycle

```
NORMAL (>20% remaining)
    → WARNING (10–20% remaining)         [in-app notification]
        → CRITICAL (<10% OR humidity >85% for 72h)  [FCM push + dashboard banner]
            → OVERDUE (interval exceeded)            [FCM push + UI lock]
```

---

## Project Structure

```
smart-fleet-iot/
├── CLAUDE.md                        # L1: AI Governance Rules
├── README.md                        # Project story (you are here)
├── .env / .env.example              # Environment config
│
├── .claude/                         # AI Layer
│   ├── settings.json
│   ├── memory/
│   │   ├── index.md                 # Architecture decisions & tech debt
│   │   └── mechanics.md             # Honda Wave wear data & E10 formulas
│   ├── skills/
│   │   ├── api-design.md            # REST standards & response format
│   │   ├── redux-patterns.md        # RTK slice & selector guidelines
│   │   └── environmental-logic.md   # Weather → wear multiplier math
│   ├── hooks/
│   │   └── pre-commit.json          # Safety gates (API docs, Docker, env vars)
│   └── agents/
│       └── mechanic-pro.md          # Senior Mechanic AI persona
│
├── docs/
│   ├── api.md                       # Full endpoint reference
│   ├── database.md                  # ERD & schema definitions
│   └── flow.md                      # Data flow diagrams
│
├── frontend/
│   └── src/
│       ├── api/                     # Axios instance + JWT interceptors
│       ├── components/              # Gauge, FleetCard, WeatherWidget, MapView
│       ├── redux/                   # fleetSlice, userSlice, weatherSlice, alertSlice
│       ├── hooks/                   # useWeather
│       └── test/                    # 32 Vitest tests (all Redux slices)
│
├── backend/
│   └── src/
│       ├── controllers/             # Route handlers (thin layer)
│       ├── services/                # Core predictive logic
│       ├── middlewares/             # JWT auth, rate limiting, Zod validation
│       └── models/                  # Supabase query helpers
│
├── infrastructure/
│   ├── docker-compose.yml
│   ├── frontend.Dockerfile          # Vite build → Nginx serve
│   └── backend.Dockerfile           # Alpine Node image
│
└── scripts/
    ├── setup.sh                     # npm install + Docker pull
    ├── dev.sh                       # Start frontend + backend concurrently
    └── migrate.sh                   # Supabase DB migrations
```

---

## Quick Start

### Prerequisites
- Node.js 24+
- Docker + Docker Compose
- A Supabase project (free tier)
- An Upstash Redis database (free tier)
- OpenWeather API key (free tier: 1,000 calls/day)
- Firebase project with FCM enabled (for push notifications)

### 1. Clone and configure

```bash
git clone https://github.com/tanhoang0803/Smart-Fleet-Predictive-IoT-Logistics-Engine.git
cd Smart-Fleet-Predictive-IoT-Logistics-Engine
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Install dependencies and start

```bash
bash scripts/setup.sh   # Install all npm packages
bash scripts/dev.sh     # Start frontend (port 5173) + backend (port 3001)
```

### 3. Run with Docker (production-like)

```bash
docker-compose -f infrastructure/docker-compose.yml up --build
# Frontend: http://localhost:80
# Backend:  http://localhost:3001
```

### 4. Run database migrations

Apply the SQL from `docs/database.md` in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

---

## API Overview

Base URL: `http://localhost:3001/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Authenticate, receive JWT cookies |
| GET | `/auth/me` | Get current user (session restore) |
| GET | `/fleet` | List all vehicles |
| POST | `/fleet` | Register a new vehicle |
| PATCH | `/fleet/:id/mileage` | Update vehicle mileage |
| GET | `/fleet/:id/status` | Get maintenance status with wear score |
| POST | `/maintenance/log` | Log a completed service |
| GET | `/maintenance/:vehicleId` | Get full service history |
| GET | `/weather/current?lat=&lon=` | Live conditions + humidity multiplier + full stats |
| GET | `/weather/forecast?lat=&lon=` | 5-day forecast with icons |
| GET | `/routes/optimize?origin=&destination=` | Route with weather, load factor, maintenance warnings |
| POST | `/notifications/fcm-token` | Register FCM device token |

Full documentation: `docs/api.md`

---

## Environment Variables

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# OpenWeather
OPENWEATHER_API_KEY=
OPENWEATHER_DEFAULT_LAT=10.7769
OPENWEATHER_DEFAULT_LON=106.7009

# Firebase (FCM)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=
JWT_REFRESH_SECRET=
```

> `GOOGLE_MAPS_API_KEY` is no longer required — route distance uses Haversine (built-in).

---

## Test Suite

**Backend** — 18 unit tests (Jest), zero live API connections required:

```bash
cd backend && npm test
```

| Test Group | Tests | Coverage |
|---|---|---|
| `getFuelMultiplier` | 5 tests | RON95, E10, E5, RON92, unknown fuel default |
| `calculateAdjustedInterval` | 7 tests | Floor clamping, humidity-exempt, fuel-exempt components |
| `getAlertStatus` | 6 tests | NORMAL/WARNING/CRITICAL/OVERDUE thresholds + sustained humidity override |

**Frontend** — 32 unit tests (Vitest), all Redux slices:

```bash
cd frontend && npm run test -- --run
```

| Test File | Tests |
|---|---|
| `userSlice.test.js` | 8 tests — login, register, logout, session restore, initialized flag |
| `fleetSlice.test.js` | 10 tests — vehicle CRUD, mileage update, status fetch |
| `weatherSlice.test.js` | 7 tests — fetch, forecast, routeLocation |
| `alertSlice.test.js` | 7 tests — FCM token, alert queue |

---

## CI/CD Pipeline

Single workflow: `.github/workflows/ci-deploy.yml`

**On every push/PR to `develop` or `main`:**
1. Lint Backend
2. Lint Frontend
3. Test Backend (dummy env vars, no live connections)
4. Test Frontend
5. Docker Build Validation

**On push to `main` only** (after all CI jobs pass):
- Deploy backend to **Render** (`RENDER_API_KEY` + `RENDER_SERVICE_ID`)
- Deploy frontend to **Vercel** (`VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`)
- Steps are skipped safely if secrets are not configured

---

## AI-Assisted Development Model

This project was built using a structured 4-layer AI governance protocol:

| Layer | Tool | Role |
|---|---|---|
| L1 | `CLAUDE.md` | High-level rules, architectural constraints, domain truth |
| L2 | `.claude/memory/` | Historical context: architecture decisions, mechanical domain data |
| L3 | `.claude/skills/` | Procedural knowledge: how to design APIs, Redux slices, wear formulas |
| L4 | `.claude/agents/mechanic-pro.md` | Specialist persona: validates all maintenance algorithm changes |

---

## Why This Architecture

**No Google Maps dependency:** The original design used Google Maps Distance Matrix API, but it requires billing. Route distance now uses a Haversine formula with a 1.3× urban road factor — accurate enough for load factor calculation, zero cost, zero API key.

**The Problem with Free-Tier APIs:** OpenWeather's free plan allows 1,000 calls/day. A fleet of 10 vehicles refreshing weather every 5 minutes would exhaust that in under 1 hour. The Redis caching layer solves this with a 30-minute TTL, reducing real API calls by ~97%.

**The Problem with Simple Mileage Tracking:** A 2,000 km oil change interval was determined by engineers in controlled laboratory conditions — not Ho Chi Minh City monsoon season. The multiplier system codifies real-world wear patterns observed in tropical fleet operations.

**The Problem with Monolithic State:** Without Redux Toolkit's centralized state, maintenance status, weather data, alert counts, and vehicle lists would require deep prop-drilling or scattered local state. The slice architecture makes every piece of state traceable and testable.

---

## Future Improvements

### AI & Intelligence
- [ ] **Gemini Flash chat interface** — conversational maintenance Q&A ("Is my oil okay this week?") with context from the vehicle's current status and weather
- [ ] **Predictive failure scoring** — ML model trained on tropical fleet data to estimate failure probability per component, not just interval-based thresholds
- [ ] **Auto-scheduled maintenance reminders** — calendar integration (Google Calendar / local notification) triggered when status transitions to WARNING

### Hardware & Telemetry
- [ ] **OBD-II Bluetooth integration** — replace manual mileage entry with real-time odometer polling via Web Bluetooth API
- [ ] **IoT sensor pipeline** — ingest temperature, vibration, and fuel consumption data from onboard microcontrollers (ESP32 / Raspberry Pi) via MQTT

### Fleet Management
- [ ] **Multi-vehicle comparison dashboard** — side-by-side wear index, alert status, and cost-per-km across the full fleet
- [ ] **Export as PDF service record** — printable maintenance history per vehicle for mechanics and insurance purposes
- [ ] **Fleet cost analytics** — cumulative maintenance spend, saved-repair estimates, and cost trend charts

### Notifications & Reach
- [ ] **SMS alerts via Twilio** — FCM fallback for drivers without smartphones or backgrounded apps
- [ ] **Telegram bot integration** — maintenance alerts and quick status queries over chat

### Infrastructure & Reliability
- [ ] **Offline-capable PWA** — service worker caching for dashboard access without connectivity
- [ ] **WebSocket live telemetry** — real-time mileage and alert updates without polling
- [ ] **Multi-region Redis failover** — Upstash geo-replication for Southeast Asian edge deployment

---

## License

MIT — free to use, fork, and build on.

---

*Built with structured AI collaboration and a deep respect for the Honda Wave RSX.*
