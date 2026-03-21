# CLAUDE.md — Smart Fleet IoT | AI Governance Layer

> **L1 Authority Document.** This file governs all AI-assisted development on this project.
> All agents, skills, and hooks inherit from this document. Contradictions resolve in favor of this file.

---

## 1. Project Identity

**Name:** Smart-Fleet | Predictive IoT Maintenance Engine
**Developer:** TanQHoang © 2026
**Domain:** Fleet logistics / preventive vehicle maintenance / IoT telemetry
**Target Vehicle:** Honda Wave RSX (Southeast Asian urban/rural commuter)
**Target Environment:** Tropical climates — high humidity, heavy rainfall, E10 fuel degradation
**Stack:** React + Redux Toolkit | Node.js + Express | Supabase (PostgreSQL) | Upstash Redis | Docker

---

## 2. Dev Commands

```bash
# First-time setup (npm install + Docker pull)
bash scripts/setup.sh

# Start local development (frontend + backend concurrently)
bash scripts/dev.sh

# Run predictive service unit tests
node backend/src/services/predictiveService.test.js

# Run DB migrations
bash scripts/migrate.sh

# Build and start Docker containers
docker-compose -f infrastructure/docker-compose.yml up --build
```

---

## 3. Architecture Overview

```
[React Frontend]  ←→  [Express API]  ←→  [Supabase DB]
       ↑                    ↑                   ↑
  Redux Store          Redis Cache         PostgreSQL
       ↑                    ↑
  Axios + JWT       OpenWeather API
                    Google Maps API
                    Firebase FCM
```

### Layer Responsibilities

| Layer | Directory | Responsibility |
|---|---|---|
| Client | `frontend/` | UI rendering, Redux state, Axios JWT interceptors |
| Server | `backend/` | Business logic, predictive algorithms, 3rd-party orchestration |
| Persistence | Supabase | PostgreSQL schemas, RLS policies, auth tokens |
| Cache | Upstash Redis | Rate-limit protection, weather data TTL, session cache |
| Container | `infrastructure/` | Docker-Compose multi-service orchestration |
| AI | `.claude/` | Agents, skills, hooks, domain memory |

---

## 4. Architecture Constraints (Enforced Rules)

1. **Free-Tier First:** Every call to OpenWeather, Google Maps, or any paid 3rd-party API MUST be cached in Upstash Redis. No cache miss should trigger more than one upstream call per TTL window.
2. **State Management:** Use Redux Toolkit exclusively. No prop-drilling for fleet or maintenance data. All async fetches go through `createAsyncThunk`.
3. **Database Security:** Supabase Row Level Security (RLS) MUST be enabled on ALL user-facing tables. No service-role key usage in client-facing endpoints.
4. **AI Logic Gate:** The `mechanic-pro` agent MUST review and approve all refactors to wear-calculation logic before merge. Tag changes with `# mechanic-pro-reviewed` comment.
5. **Response Format:** All API responses conform to the envelope below — no exceptions:
   - Success: `{ "success": true, "data": { ... }, "meta": { "timestamp": "", "requestId": "" } }`
   - Error: `{ "success": false, "data": null, "error": { "code": "ERR_CODE", "message": "..." } }`

---

## 5. Core Domain Rules (Non-Negotiable)

### 5.1 Maintenance Interval Logic

All service interval calculations MUST follow this priority chain:

```
Base Interval (km)
  × Humidity Multiplier     (from OpenWeather API)
  × Fuel Quality Multiplier (E10 default for Vietnam)
  × Load Factor             (from Google Maps route data)
  = Adjusted Interval (km)
```

**Base intervals for Honda Wave RSX:**
- Engine oil: 2,000 km (mineral) / 3,500 km (semi-synthetic)
- Air filter: 5,000 km (dry season) / 3,000 km (wet season)
- Spark plug: 8,000 km
- Chain lubrication: 500 km (wet) / 1,000 km (dry)
- Brake pads: 15,000 km (inspect at 10,000 km)

**Multiplier reference:** See `.claude/skills/environmental-logic.md` for full formula set.

### 5.2 Alert Thresholds

| Status | Condition | Action |
|---|---|---|
| `NORMAL` | > 20% interval remaining | No alert |
| `WARNING` | 10–20% remaining | In-app notification |
| `CRITICAL` | < 10% remaining OR humidity > 85% for 72h | FCM push + in-app |
| `OVERDUE` | 0% remaining (interval exceeded) | FCM push + dashboard lock |

### 5.3 Weather Integration Contract

- Weather data is fetched via OpenWeather API (current + 5-day forecast)
- Cache TTL in Redis: **30 minutes** for current, **3 hours** for forecast
- Humidity threshold for multiplier activation: **> 70% RH**
- Never call OpenWeather directly from the frontend — always proxy through `/api/v1/weather`

---

## 6. API Design Contract

All endpoints follow the standard defined in `.claude/skills/api-design.md`.

### Base URL
```
/api/v1
```

### Response Envelope (ALL responses)
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "ISO8601",
    "requestId": "uuid-v4"
  },
  "error": null
}
```

### Error Envelope
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MAINTENANCE_NOT_FOUND",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### Endpoint Groups
| Group | Prefix | Auth Required |
|---|---|---|
| Auth | `/api/v1/auth` | No (login/register), Yes (refresh/logout) |
| Fleet | `/api/v1/fleet` | Yes |
| Maintenance | `/api/v1/maintenance` | Yes |
| Weather | `/api/v1/weather` | Yes |
| Routes | `/api/v1/routes` | Yes |
| Notifications | `/api/v1/notifications` | Yes |

---

## 7. Frontend Architecture Rules

### Redux Slice Ownership

| Slice | File | Owns |
|---|---|---|
| `fleetSlice` | `redux/fleetSlice.js` | Vehicle list, selected vehicle, maintenance status |
| `userSlice` | `redux/userSlice.js` | Auth state, JWT token, user profile |
| `weatherSlice` | `redux/weatherSlice.js` | Current conditions, forecast, multiplier values |
| `alertSlice` | `redux/alertSlice.js` | Notification queue, FCM token |

### Rules
- **Never** fetch API data outside of Redux Thunks or RTK Query hooks
- **Never** store JWT in `localStorage` — use `httpOnly` cookies via the backend
- Selectors MUST be memoized via `createSelector` (see `.claude/skills/redux-patterns.md`)
- All API calls go through the centralized Axios instance at `frontend/src/api/axiosClient.js`

### Component Hierarchy
```
App
├── AuthGuard (JWT validation)
│   ├── Dashboard
│   │   ├── FleetOverview (vehicle cards)
│   │   ├── MaintenanceGauge (arc progress, color-coded)
│   │   ├── WeatherWidget (humidity, rain forecast)
│   │   └── AlertBanner (CRITICAL/OVERDUE)
│   └── RouteOptimizer
│       ├── MapView (Google Maps embed)
│       └── FuelLoadRatioPanel
└── AuthPages (Login / Register)
```

---

## 8. Backend Service Architecture

### Service Responsibilities

| Service | File | Description |
|---|---|---|
| `MaintenanceService` | `services/maintenanceService.js` | Core predictive logic, interval calculation |
| `WeatherService` | `services/weatherService.js` | OpenWeather fetch + Redis cache layer |
| `RouteService` | `services/routeService.js` | Google Maps Matrix API integration |
| `NotificationService` | `services/notificationService.js` | FCM push notification dispatch |
| `AuthService` | `services/authService.js` | JWT sign/verify, Supabase auth bridge |

### Controller → Service → Model flow (strict)
```
Request → Middleware (auth, rate-limit) → Controller (validate) → Service (logic) → Model (DB) → Response
```

Controllers MUST NOT contain business logic. Services MUST NOT contain request/response objects.

---

## 9. Database Schema Rules

Full ERD in `docs/database.md`. Key rules:

- All tables have `id UUID DEFAULT gen_random_uuid()` primary key
- All tables have `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ`
- Foreign keys are always named `{referenced_table}_id`
- Supabase RLS is enabled on ALL user-facing tables
- Soft deletes via `deleted_at TIMESTAMPTZ NULL` — never hard delete fleet or maintenance records

### Core Tables
```
users           — Supabase Auth bridge + profile
vehicles        — Fleet registry (vehicle_id, owner_id, model, mileage_current)
maintenance_logs — Service history (vehicle_id, component, km_at_service, notes)
maintenance_schedule — Predicted next service (vehicle_id, component, km_due, status)
weather_cache   — Local snapshot (lat, lon, humidity, condition, recorded_at)
route_logs      — Trip history (vehicle_id, origin, destination, km, load_factor)
```

---

## 10. Security Rules

1. **JWT:** Short-lived access tokens (15 min) + refresh tokens (7 days) stored in `httpOnly` cookies
2. **Rate Limiting:** All `/api/v1` routes limited to 100 req/min via Redis-backed rate limiter
3. **Input Validation:** Use `zod` for ALL incoming request bodies — no raw `req.body` access in controllers
4. **SQL Injection:** Supabase client uses parameterized queries by default — never interpolate user input into query strings
5. **Secrets:** ALL secrets via environment variables — never hardcode API keys. Validate at startup via `validateEnv()` utility
6. **CORS:** Whitelist only `FRONTEND_URL` env var — never `*` in production

---

## 11. Environment Variables Contract

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
OPENWEATHER_DEFAULT_CITY=Ho Chi Minh City
OPENWEATHER_DEFAULT_LAT=10.8231
OPENWEATHER_DEFAULT_LON=106.6297

# Google Maps
GOOGLE_MAPS_API_KEY=

# Firebase (FCM)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# App Config
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=
JWT_REFRESH_SECRET=
```

---

## 12. Docker / Infrastructure Rules

- **Never** run `npm install` inside a running container — rebuild the image
- `docker-compose.yml` defines two services: `backend` and `redis` (Upstash is remote; local Redis is for dev only)
- Frontend is served via Nginx in production (see `infrastructure/frontend.Dockerfile` multi-stage build)
- Health checks MUST be defined for all services
- No ports exposed to `0.0.0.0` in production — use reverse proxy (Nginx/Caddy)

---

## 13. AI Agent Protocol

### Active Agents

| Agent | File | Trigger |
|---|---|---|
| `mechanic-pro` | `.claude/agents/mechanic-pro.md` | Any changes to maintenance interval logic or wear formulas |

### When to invoke `mechanic-pro`
- Modifying multiplier values in `environmental-logic.md`
- Adding new component types to maintenance schedules
- Reviewing any service interval calculation in `maintenanceService.js`
- Validating Honda Wave RSX-specific wear patterns

### Skill Invocation Guide

| Task | Skill |
|---|---|
| Design or modify API endpoint | `.claude/skills/api-design.md` |
| Add Redux slice or selector | `.claude/skills/redux-patterns.md` |
| Modify weather→maintenance math | `.claude/skills/environmental-logic.md` |
| Review service interval logic | Invoke `mechanic-pro` agent |

---

## 14. Pre-Commit Hook Rules

The hook at `.claude/hooks/pre-commit.json` blocks commits that:

1. Add a new API endpoint without a corresponding entry in `docs/api.md`
2. Modify `docker-compose.yml` without updating `infrastructure/` documentation
3. Change service interval base values without a comment citing the Honda Wave RSX service manual reference
4. Introduce environment variable usage without a corresponding entry in `.env.example`
5. Leave `console.log` statements (use the `logger` service instead)

---

## 15. Code Quality Standards

- **Linting:** ESLint with `eslint-config-airbnb-base` (backend), `eslint-config-airbnb` (frontend)
- **Formatting:** Prettier — single quotes, 2-space indent, 100-char line width
- **Testing:** Jest for backend unit tests, Vitest for frontend. Minimum coverage: services 80%, controllers 60%
- **Commits:** Conventional Commits format — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Branches:** `main` (production), `develop` (integration), `feat/*`, `fix/*`

---

## 16. Domain Memory Index

| File | Contents |
|---|---|
| `.claude/memory/index.md` | Architecture decisions, technical debt log, ADR history |
| `.claude/memory/mechanics.md` | Honda Wave RSX service intervals, E10 fuel impact data, tropical wear coefficients |

---

*Last updated: 2026-03-21 | Authority: L1*
