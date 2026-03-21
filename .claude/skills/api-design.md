# Skill: API Design Standards
**Smart-Fleet IoT | TanQHoang © 2026**

Use this skill whenever designing or modifying any REST endpoint. All endpoints MUST conform to this spec.

---

## Base URL

```
/api/v1
```

Never create routes outside this prefix. Version is part of the URL — not a header.

---

## Response Envelope (ALL responses — no exceptions)

### Success
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-03-21T10:00:00.000Z",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "error": null
}
```

### Error
```json
{
  "success": false,
  "data": null,
  "meta": {
    "timestamp": "2026-03-21T10:00:00.000Z",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "error": {
    "code": "VEHICLE_NOT_FOUND",
    "message": "Vehicle with ID abc123 does not exist or you do not have access.",
    "details": {}
  }
}
```

**Rules:**
- `requestId` is a UUID v4 generated per request in `authMiddleware` or a global middleware
- `timestamp` is always ISO 8601 UTC
- `data` is `null` on error; `error` is `null` on success — never omit either field
- `details` may contain field-level validation errors from Zod

---

## HTTP Status Code Contract

| Status | When to Use |
|--------|-------------|
| 200 | Successful GET, PATCH, DELETE (with body) |
| 201 | Successful POST that creates a resource |
| 204 | Successful DELETE with no body |
| 400 | Malformed request (bad JSON, missing required field) |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient permission (RLS violation) |
| 404 | Resource does not exist (or hidden by RLS) |
| 409 | Conflict (duplicate email on register, duplicate vehicle) |
| 422 | Zod validation failed — include field errors in `details` |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error — never expose stack trace |

---

## Endpoint Naming Conventions

- **Collection:** `GET /api/v1/fleet` (plural noun)
- **Single resource:** `GET /api/v1/fleet/:id`
- **Sub-resource:** `GET /api/v1/maintenance/:vehicleId`
- **Action on resource:** `POST /api/v1/fleet/:id/mileage` (use noun, not verb)
- **Auth actions:** `POST /api/v1/auth/login` (exception — auth uses verbs)

Never use verbs in URLs outside of the auth group.

---

## Error Code Registry

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 422 | Zod schema failed |
| `UNAUTHORIZED` | 401 | No valid JWT |
| `FORBIDDEN` | 403 | RLS or ownership check failed |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_EMAIL` | 409 | Register with existing email |
| `DUPLICATE_VEHICLE` | 409 | Same plate/model already registered |
| `VEHICLE_NOT_FOUND` | 404 | Vehicle ID doesn't exist for this user |
| `MAINTENANCE_NOT_FOUND` | 404 | No maintenance schedule exists yet |
| `WEATHER_FETCH_FAILED` | 500 | OpenWeather API unreachable |
| `ROUTE_FETCH_FAILED` | 500 | Google Maps API unreachable |
| `NOTIFICATION_FAILED` | 500 | FCM push failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Redis rate limiter triggered |
| `INTERNAL_ERROR` | 500 | Unhandled exception |

---

## Endpoint Documentation Requirement

Every endpoint MUST have an entry in `docs/api.md` in this format:
```
### METHOD /api/v1/path
**Auth:** Required | Not Required
**Body:** { field: type, ... }
**Response 200:** { data: { ... } }
**Response 4xx:** { error: { code, message } }
```

The pre-commit hook will block commits adding a new controller route without a matching `docs/api.md` entry.

---

## Pagination (for list endpoints)

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47,
      "hasNext": true
    }
  }
}
```

Query params: `?page=1&limit=20`. Default: page 1, limit 20. Max limit: 100.
