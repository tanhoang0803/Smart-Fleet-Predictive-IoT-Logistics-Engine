# Smart-Fleet: IoT Logistics & Predictive Maintenance Engine

> Turning reactive repairs into predictive intelligence — one sensor at a time.

**Developer:** TanQHoang © 2026
**Stack:** React · Redux Toolkit · Node.js · Express · Supabase · Upstash Redis · Docker
**Optimized for:** Honda Wave RSX · Ho Chi Minh City tropical climate · E10 fuel blend

---

## The Vision

Most vehicle maintenance is driven by a simple number: odometer mileage. But in a tropical city like Ho Chi Minh City — where humidity regularly exceeds 85%, seasonal rain accelerates oxidation, and E10 fuel increases combustion residue — mileage alone is a lie.

**Smart-Fleet** resolves this gap. It correlates raw telemetry (mileage, trip frequency) with real-time atmospheric data from the OpenWeather API to compute *true* component wear. The result: maintenance predictions that account for the actual environment your fleet operates in — not just the distance traveled.

The system transitions vehicle upkeep from a reactive model ("wait until something breaks") to a predictive intelligence model ("intervene before wear becomes failure").

---

## Professional Features

### AI Environment Audit
A specialized AI agent (`mechanic-pro`) applies dynamic wear multipliers to base service intervals. When humidity crosses 70% RH or rain persists for 72+ hours, the system automatically reduces maintenance thresholds — accounting for accelerated chain corrosion, lubricant breakdown, and air filter clogging specific to tropical conditions.

### Enterprise State Machine
Maintenance tickets progress through a full lifecycle: `NORMAL → WARNING → CRITICAL → OVERDUE`. Each transition triggers appropriate notifications and UI state changes, preventing missed service events without alert fatigue.

### Latency Optimization via Redis Caching
All OpenWeather and Google Maps API calls are intercepted by an Upstash Redis caching layer:
- Current weather: 30-minute TTL
- 5-day forecast: 3-hour TTL
- Route matrix results: 1-hour TTL

This keeps the system within free-tier API limits at scale while delivering sub-50ms weather data responses.

### Firebase FCM Push Notifications
Critical and overdue maintenance alerts are delivered via Firebase Cloud Messaging — ensuring drivers receive push notifications even when the app is backgrounded. No alert is silently missed.

### Docker-Ready Infrastructure
Zero-config local deployment via Docker Compose. A multi-stage Dockerfile builds the React frontend with Vite and serves it through Nginx. The backend runs on a lightweight Alpine Node image. Environment parity between development and production is guaranteed.

### Google Maps Route Intelligence
The Google Maps Distance Matrix API provides route-aware load factors. Long-haul routes with high load ratios apply additional wear multipliers, ensuring service intervals for delivery motorcycles are shorter than those used for light urban commuting.

---

## Technical Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | Component-driven UI with fast HMR |
| State | Redux Toolkit | Centralized fleet and auth state management |
| Styling | Tailwind CSS | Utility-first responsive design |
| Backend | Node.js + Express | RESTful API, business logic, 3rd-party orchestration |
| Database | Supabase (PostgreSQL) | Persistent storage with Row Level Security |
| Cache | Upstash Redis | Rate-limit protection, API response caching |
| AI Engine | Gemini Flash | Conversational maintenance recommendations |
| Weather | OpenWeather API | Real-time humidity, temperature, rain forecast |
| Maps | Google Maps Matrix API | Route distance, load factor calculation |
| Push Notifications | Firebase FCM | Critical alert delivery to mobile clients |
| Container | Docker + Docker Compose | Multi-service orchestration, environment parity |
| Maps (OSM) | OpenStreetMap | Fallback tile rendering for map UI |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│         Redux Store · Axios JWT Interceptor             │
│    FleetDashboard · MaintenanceGauge · WeatherWidget    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS + JWT
┌──────────────────────▼──────────────────────────────────┐
│                   Express API (/api/v1)                  │
│   Auth · Fleet · Maintenance · Weather · Routes · FCM   │
│              Zod Validation · Rate Limiter               │
└───┬──────────┬───────────┬────────────┬─────────────────┘
    │          │           │            │
    ▼          ▼           ▼            ▼
Supabase   Upstash     OpenWeather  Google Maps
(Postgres)  (Redis)      API          Matrix API
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
  × Load Factor           [0.75 – 1.0, derived from Google Maps route data]
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
│       ├── redux/                   # fleetSlice, userSlice, weatherSlice
│       └── hooks/                   # useWeather, useMaintenance
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
- Node.js 18+
- Docker + Docker Compose
- A Supabase project (free tier works)
- An Upstash Redis database (free tier works)
- OpenWeather API key (free tier: 1,000 calls/day)

### 1. Clone and configure

```bash
git clone https://github.com/your-username/smart-fleet-iot.git
cd smart-fleet-iot
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

```bash
bash scripts/migrate.sh
```

---

## API Overview

Base URL: `http://localhost:3001/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Authenticate, receive JWT cookies |
| GET | `/fleet` | List all vehicles for authenticated user |
| POST | `/fleet` | Register a new vehicle |
| GET | `/fleet/:id/status` | Get maintenance status with wear score |
| POST | `/maintenance/log` | Log a completed service |
| GET | `/maintenance/:vehicleId` | Get full service history |
| GET | `/weather/current` | Cached current conditions + humidity multiplier |
| GET | `/routes/optimize` | Route suggestion with load factor |
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
OPENWEATHER_DEFAULT_LAT=10.8231
OPENWEATHER_DEFAULT_LON=106.6297

# Google Maps
GOOGLE_MAPS_API_KEY=

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

---

## AI-Assisted Development Model

This project was built using a structured 4-layer AI governance protocol:

| Layer | Tool | Role |
|---|---|---|
| L1 | `CLAUDE.md` | High-level rules, architectural constraints, domain truth |
| L2 | `.claude/memory/` | Historical context: architecture decisions, mechanical domain data |
| L3 | `.claude/skills/` | Procedural knowledge: how to design APIs, Redux slices, wear formulas |
| L4 | `.claude/agents/mechanic-pro.md` | Specialist persona: validates all maintenance algorithm changes |

Pre-commit hooks in `.claude/hooks/pre-commit.json` enforce:
- API endpoints must be documented before commit
- New environment variables must appear in `.env.example`
- Service interval changes require a source citation comment
- No `console.log` in production code (use the logger service)

---

## Why This Architecture

**The Problem with Free-Tier APIs:** OpenWeather's free plan allows 1,000 calls/day. A fleet of 10 vehicles refreshing weather every 5 minutes would exhaust that in under 1 hour. The Redis caching layer solves this with a 30-minute TTL, reducing real API calls by ~97% while maintaining data freshness.

**The Problem with Simple Mileage Tracking:** A 2,000 km oil change interval was determined by engineers in controlled laboratory conditions — not Ho Chi Minh City monsoon season. The multiplier system codifies real-world wear patterns observed in tropical fleet operations, making the service interval predictions genuinely useful rather than approximations.

**The Problem with Monolithic State:** Fleet management UIs are data-dense. Without Redux Toolkit's centralized state, maintenance status, weather data, alert counts, and vehicle lists would require deep prop-drilling or scattered local state that becomes impossible to debug. The slice architecture makes every piece of state traceable and testable.

---

## Roadmap

- [ ] Gemini Flash conversational interface for maintenance Q&A
- [ ] Offline-capable PWA with service worker caching
- [ ] OBD-II Bluetooth sensor integration (real mileage telemetry)
- [ ] Multi-vehicle fleet comparison dashboard
- [ ] Export maintenance history as PDF service record
- [ ] SMS alerts via Twilio as FCM fallback

---

## License

MIT — free to use, fork, and build on.

---

*Built with structured AI collaboration and a deep respect for the Honda Wave RSX.*
