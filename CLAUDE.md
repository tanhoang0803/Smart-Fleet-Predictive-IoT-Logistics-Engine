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

# Run backend unit tests (Jest, 18 tests)
cd backend && npm test

# Run frontend tests (Vitest)
cd frontend && npm run test -- --run

# Lint backend
cd backend && npm run lint

# Lint frontend
cd frontend && npm run lint

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
                    Leaflet + OSM (map display)
                    Haversine (route distance)
                    Firebase FCM
```

### Layer Responsibilities

| Layer | Directory | Responsibility |
|---|---|---|
| Client | `frontend/` | UI rendering, Redux state, Axios JWT interceptors |
| Server | `backend/` | Business logic, predictive algorithms, 3rd-party orchestration |
| Persistence | Supabase | PostgreSQL schemas, RLS policies, auth tokens |
| Cache | Upstash Redis | Rate-limit protection, weather data TTL, route cache |
| Container | `infrastructure/` | Docker-Compose multi-service orchestration |
| AI | `.claude/` | Agents, skills, hooks, domain memory |

---

## 4. Architecture Constraints (Enforced Rules)

1. **Free-Tier First:** Every call to OpenWeather or any paid 3rd-party API MUST be cached in Upstash Redis. No cache miss should trigger more than one upstream call per TTL window.
2. **State Management:** Use Redux Toolkit exclusively. No prop-drilling for fleet or maintenance data. All async fetches go through `createAsyncThunk`.
3. **Database Security:** Supabase Row Level Security (RLS) MUST be enabled on ALL user-facing tables. No service-role key usage in client-facing endpoints.
4. **AI Logic Gate:** The `mechanic-pro` agent MUST review and approve all refactors to wear-calculation logic before merge. Tag changes with `# mechanic-pro-reviewed` comment.
5. **Response Format:** All API responses conform to the envelope below — no exceptions:
   - Success: `{ "success": true, "data": { ... }, "meta": { "timestamp": "", "requestId": "" } }`
   - Error: `{ "success": false, "data": null, "error": { "code": "ERR_CODE", "message": "..." } }`
6. **No Google Maps dependency:** Route distance uses Haversine formula (zero external API). Map display uses Leaflet + OpenStreetMap (free, no API key).

---

## 5. Core Domain Rules (Non-Negotiable)

### 5.1 Maintenance Interval Logic

All service interval calculations MUST follow this priority chain:

```
Base Interval (km)
  × Humidity Multiplier     (from OpenWeather API)
  × Fuel Quality Multiplier (E10 default for Vietnam)
  × Load Factor             (from Haversine route data + weather condition)
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
- Weather endpoint accepts `?lat=&lon=` for location-specific conditions
- Route optimizer fetches weather at origin coords and enriches response with `weatherLoadFactor`, `adjustedFuelL`, `maintenanceWarnings`

### 5.4 Route Optimizer Contract

- Distance calculated using **Haversine formula × 1.3 urban road factor** (no external API)
- Cache TTL in Redis: **1 hour** per origin/destination pair
- Weather fetched in parallel with route calculation — enriches response
- `weatherLoadFactor` = base loadFactor × 0.9 if rain/storm detected
- `adjustedFuelL` = base fuelEstimate ÷ humidityMultiplier
- `maintenanceWarnings[]` generated based on humidity + condition + temperature
- Accepting a route updates vehicle mileage AND resets WeatherWidget to origin location

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
| Auth | `/api/v1/auth` | No (login/register), Yes (me/logout) |
| Fleet | `/api/v1/fleet` | Yes |
| Maintenance | `/api/v1/maintenance` | Yes |
| Weather | `/api/v1/weather` | Yes |
| Routes | `/api/v1/routes` | Yes |
| Notifications | `/api/v1/notifications` | Yes |

### Auth Endpoints
- `POST /auth/register` — creates user via `supabaseAdmin.auth.admin.createUser()` (bypasses email confirmation)
- `POST /auth/login` — returns JWT in `httpOnly` cookies
- `GET /auth/me` — returns current user profile (used for session restore on page refresh)
- `POST /auth/logout`

---

## 7. Frontend Architecture Rules

### Redux Slice Ownership

| Slice | File | Owns |
|---|---|---|
| `fleetSlice` | `redux/fleetSlice.js` | Vehicle list, selected vehicle, maintenance status |
| `userSlice` | `redux/userSlice.js` | Auth state, JWT token, user profile, `initialized` flag |
| `weatherSlice` | `redux/weatherSlice.js` | Current conditions, forecast, multiplier values, `routeLocation` |
| `alertSlice` | `redux/alertSlice.js` | Notification queue, FCM token |

### Key State Fields
- `userSlice.initialized` — `false` until `restoreSession` completes; AuthGuard shows spinner until `true`
- `weatherSlice.routeLocation` — `{ lat, lon }` set when user presses Optimize Route or Accept Route; `null` = default HCM city; WeatherWidget reads this to show location-specific weather

### Rules
- **Never** fetch API data outside of Redux Thunks or RTK Query hooks
- **Never** store JWT in `localStorage` — use `httpOnly` cookies via the backend
- Selectors MUST be memoized via `createSelector` (see `.claude/skills/redux-patterns.md`)
- All API calls go through the centralized Axios instance at `frontend/src/api/axiosClient.js`
- Session is restored on page load via `store.dispatch(restoreSession())` in `main.jsx`

### Component Hierarchy
```
App
├── AuthGuard (waits for initialized=true before redirecting)
│   ├── DashboardPage
│   │   ├── WeatherWidget (location-aware: updates on route optimize/accept)
│   │   ├── AlertBanner (CRITICAL/OVERDUE)
│   │   ├── Tab: fleet
│   │   │   ├── FleetCard (vehicle list, worst alert status badge)
│   │   │   └── MaintenanceGauge (arc progress, color-coded)
│   │   └── Tab: map
│   │       └── MapView (Leaflet+OSM, Route Optimizer, weather panel, Refresh/Accept)
└── AuthPages (Login / Register with footer)
```

### MapView Behaviour
- **Optimize Route**: draws route on map, updates WeatherWidget to origin location, shows below-map panel
- **↺ Refresh Route**: clears form + map + route panel, resets WeatherWidget to default HCM
- **✓ Accept Route**: updates vehicle mileage via `updateMileage` thunk, recalculates maintenance via `fetchVehicleStatus`, then clears form + map + resets WeatherWidget to default HCM

---

## 8. Backend Service Architecture

### Service Responsibilities

| Service | File | Description |
|---|---|---|
| `MaintenanceService` | `services/maintenanceService.js` | Core predictive logic, interval calculation |
| `WeatherService` | `services/weatherService.js` | OpenWeather fetch + Redis cache layer |
| `RouteService` | `services/routeService.js` | Haversine distance + load factor (no external API) |
| `NotificationService` | `services/notificationService.js` | FCM push notification dispatch (lazy Firebase init) |
| `AuthService` | `services/authService.js` | JWT sign/verify, Supabase auth bridge |

### WeatherService Response Fields (getCurrentConditions)
```js
{
  city, country, humidity, temperature, feelsLike,
  condition,      // main category: "Rain", "Clear", etc. — used for business logic
  description,    // detailed: "overcast clouds" — used for display
  icon,           // OpenWeather icon code e.g. "04d"
  windSpeed,      // km/h (converted from m/s)
  visibility,     // km
  pressure,       // hPa
  sunrise,        // unix timestamp
  sunset,         // unix timestamp
  humidityMultiplier, cachedAt
}
```

### RouteController enriched response (GET /routes/optimize)
```js
{
  distanceKm, durationMin, loadFactor, fuelEstimateL,
  weatherLoadFactor,   // rain-adjusted load factor
  adjustedFuelL,       // humidity-adjusted fuel estimate
  weather: { city, condition, temperature, humidity, humidityMultiplier, isRainy },
  maintenanceWarnings: [{ level: 'CRITICAL|WARNING|INFO', message }]
}
```

### Firebase Initialization Rule

`NotificationService` uses **lazy initialization** — `admin.initializeApp()` is called only when `sendAlert()` is first invoked, never at module load. This prevents Jest from crashing when importing the module with dummy `FIREBASE_PRIVATE_KEY` values in CI. Do NOT move the init call back to module top-level.

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
7. **Registration:** Uses `supabaseAdmin.auth.admin.createUser({ email_confirm: true })` to bypass email provider restrictions

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
OPENWEATHER_DEFAULT_CITY="Ho Chi Minh City"
OPENWEATHER_DEFAULT_LAT=10.7769
OPENWEATHER_DEFAULT_LON=106.7009

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

> Note: `GOOGLE_MAPS_API_KEY` is no longer required. Route distance uses Haversine (no API key needed).

---

## 12. Docker / Infrastructure Rules

- **Never** run `npm install` inside a running container — rebuild the image
- `docker-compose.yml` defines two services: `backend` and `redis` (Upstash is remote; local Redis is for dev only)
- Frontend is served via Nginx in production (see `infrastructure/frontend.Dockerfile` multi-stage build)
- Frontend Dockerfile uses `RUN printf` for nginx config (no BuildKit heredoc syntax required)
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

- **Linting (backend):** ESLint via `backend/.eslintrc.js` — extends `eslint:recommended`, env: `node + jest`, `no-console: error`
- **Linting (frontend):** ESLint via `frontend/.eslintrc.cjs` — extends `eslint:recommended + react/recommended + react-hooks/recommended`, `react/prop-types: off`
- **Formatting:** Prettier — single quotes, 2-space indent, 100-char line width
- **Testing:** Jest (`backend/`) for unit tests — 18 tests covering `maintenanceService.js`. Vitest (`frontend/`) for component tests — 32 tests covering all 4 Redux slices.
- **Coverage:** `collectCoverageFrom` scoped to `src/services/**/*.js` — no global thresholds enforced in CI
- **Line endings:** `.gitattributes` enforces `eol=lf` for all source files (Windows-safe)
- **Commits:** Conventional Commits format — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Branches:** `main` (production), `develop` (integration), `feat/*`, `fix/*`
- **CI/CD:** Single GitHub Actions workflow (`ci-deploy.yml`) — lint + test + Docker build on every push/PR; deploy job runs only on push to `main` after all CI jobs pass

---

## 16. CI/CD Pipeline

Single workflow file: `.github/workflows/ci-deploy.yml`

**CI jobs** (run on every push/PR to `develop` or `main`):
1. Lint Backend
2. Lint Frontend
3. Test Backend (18 Jest tests, dummy env vars, no live connections)
4. Test Frontend (32 Vitest tests)
5. Docker Build Validation (both Dockerfiles)

**Deploy job** (push to `main` only, `needs: [build-docker]`):
- Skipped if secrets not set (safe by default)
- Backend → Render via REST API (`RENDER_API_KEY` + `RENDER_SERVICE_ID`)
- Frontend → Vercel CLI with `--yes --no-clipboard` (`VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`)

---

## 17. Domain Memory Index

| File | Contents |
|---|---|
| `.claude/memory/index.md` | Architecture decisions, technical debt log, ADR history |
| `.claude/memory/mechanics.md` | Honda Wave RSX service intervals, E10 fuel impact data, tropical wear coefficients |

---

## 18. Repository

- **GitHub:** `https://github.com/tanhoang0803/Smart-Fleet-Predictive-IoT-Logistics-Engine`
- **CI Status:** GitHub Actions — lint + test + Docker build (Node 24, ubuntu-latest)
- **CD:** Auto-deploy to Render (backend) + Vercel (frontend) on merge to `main` (requires GitHub Secrets — see section 16)

---

*Last updated: 2026-03-24 | Authority: L1*
