# Architecture Memory — Smart Fleet IoT
**TanQHoang © 2026**

This file records Architecture Decision Records (ADR), technical debt, and non-obvious design choices. Consult before refactoring any core system.

---

## ADR-001: Redis as Dual-Purpose Layer
**Date:** 2026-03-21
**Decision:** Upstash Redis serves both the rate limiter and the weather/route cache.
**Rationale:** Free-tier APIs (OpenWeather: 1,000/day, Google Maps: $200 credit) would be exhausted within hours without caching. Redis is already in the stack — adding a second TTL store would be redundant.
**Key detail:** Namespace all keys to avoid collisions:
- Rate limiter: `rl:{ip}:{window_start}`
- Weather current: `weather:current:{lat}:{lon}`
- Weather forecast: `weather:forecast:{lat}:{lon}`
- Route matrix: `route:{origin_hash}:{dest_hash}`

---

## ADR-002: httpOnly Cookies for JWT (Not localStorage)
**Date:** 2026-03-21
**Decision:** JWT access tokens and refresh tokens are stored in `httpOnly` cookies, not `localStorage`.
**Rationale:** XSS attacks can steal `localStorage` tokens. `httpOnly` cookies are inaccessible to JavaScript. The Vite dev proxy (`/api → localhost:3001`) ensures cookies work in development without CORS issues.
**Key detail:** The Axios client must set `withCredentials: true`. The Express CORS config must whitelist `FRONTEND_URL` and set `credentials: true`.

---

## ADR-003: Soft Deletes Only for Fleet Data
**Date:** 2026-03-21
**Decision:** `vehicles` and `maintenance_logs` tables use `deleted_at TIMESTAMPTZ NULL` for soft deletes. Hard deletes are prohibited.
**Rationale:** Maintenance history is legally and operationally significant for fleet operators. Accidental deletion of a vehicle's service record could create liability. The data is small enough that soft deletes don't create performance problems.
**Key detail:** All model queries must include `WHERE deleted_at IS NULL` by default. Expose a separate admin-only hard-delete endpoint if cleanup is ever needed.

---

## ADR-004: Supabase RLS as Primary Authorization
**Date:** 2026-03-21
**Decision:** Supabase Row Level Security (RLS) is the last line of defense for data access. It is enabled on all user-facing tables and enforces `user_id = auth.uid()` at the database level.
**Rationale:** Application-layer auth bugs (e.g., a missing `authMiddleware` on a route) should not expose another user's fleet data. RLS provides defense-in-depth.
**Key detail:** Never disable RLS for convenience. If a query fails due to RLS, fix the policy — don't use the service role key as a bypass in user-facing endpoints.

---

## ADR-005: maintenanceService.js is Mechanic-Pro Territory
**Date:** 2026-03-21
**Decision:** Any change to wear multipliers, base intervals, or alert thresholds in `maintenanceService.js` must be reviewed by the `mechanic-pro` agent and marked with `# mechanic-pro-reviewed`.
**Rationale:** These values are derived from Honda Wave RSX manufacturer specifications and field data from tropical fleet operations. Incorrect values silently produce wrong service recommendations — a safety concern, not just a bug.

---

## Technical Debt Log

| ID | Description | Severity | Created |
|----|-------------|----------|---------|
| TD-001 | MapView uses iframe embed — limited interactivity | Low | 2026-03-21 |
| TD-002 | No OBD-II integration — mileage is manual input | Medium | 2026-03-21 |
| TD-003 | FCM token refresh not implemented (tokens expire) | Medium | 2026-03-21 |
| TD-004 | No i18n — Vietnamese language support missing | Low | 2026-03-21 |
