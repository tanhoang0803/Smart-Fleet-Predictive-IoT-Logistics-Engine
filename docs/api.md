# API Reference — Smart Fleet IoT
**TanQHoang © 2026** | Base URL: `/api/v1`

All responses conform to the envelope defined in `.claude/skills/api-design.md`.

---

## Authentication

### POST /api/v1/auth/register
**Auth:** Not required
**Body:**
```json
{ "email": "string", "password": "string", "name": "string" }
```
**Response 201:**
```json
{ "data": { "user": { "id": "uuid", "email": "string", "name": "string" } } }
```
**Errors:** `VALIDATION_ERROR` 422, `DUPLICATE_EMAIL` 409

---

### POST /api/v1/auth/login
**Auth:** Not required
**Body:**
```json
{ "email": "string", "password": "string" }
```
**Response 200:** Sets `httpOnly` cookies: `access_token`, `refresh_token`
```json
{ "data": { "user": { "id": "uuid", "email": "string", "name": "string" } } }
```
**Errors:** `VALIDATION_ERROR` 422, `UNAUTHORIZED` 401

---

### POST /api/v1/auth/refresh
**Auth:** Requires valid `refresh_token` cookie
**Body:** None
**Response 200:** Rotates `access_token` cookie
```json
{ "data": { "refreshed": true } }
```
**Errors:** `UNAUTHORIZED` 401

---

### POST /api/v1/auth/logout
**Auth:** Required
**Body:** None
**Response 200:** Clears auth cookies
```json
{ "data": { "loggedOut": true } }
```

---

## Fleet

### GET /api/v1/fleet
**Auth:** Required
**Query:** `?page=1&limit=20`
**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "model": "Honda Wave RSX",
        "plateNumber": "59B1-12345",
        "mileageCurrent": 15420,
        "fuelType": "E10",
        "alertStatus": "WARNING",
        "createdAt": "ISO8601"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "hasNext": false }
  }
}
```

---

### POST /api/v1/fleet
**Auth:** Required
**Body:**
```json
{
  "model": "string",
  "plateNumber": "string",
  "mileageCurrent": "number",
  "fuelType": "E10 | E5 | RON92 | RON95",
  "lat": "number (optional)",
  "lon": "number (optional)"
}
```
**Response 201:**
```json
{ "data": { "vehicle": { "id": "uuid", "model": "string", "plateNumber": "string" } } }
```
**Errors:** `VALIDATION_ERROR` 422, `DUPLICATE_VEHICLE` 409

---

### GET /api/v1/fleet/:id/status
**Auth:** Required
**Response 200:**
```json
{
  "data": {
    "vehicle": { "id": "uuid", "model": "string", "mileageCurrent": 15420 },
    "weather": { "humidity": 82, "condition": "Rain", "humidityMultiplier": 0.80 },
    "schedule": [
      {
        "component": "engine_oil",
        "baseIntervalKm": 2000,
        "adjustedIntervalKm": 1440,
        "kmDue": 16440,
        "kmRemaining": 1020,
        "percentRemaining": 70.8,
        "alertStatus": "NORMAL"
      }
    ],
    "worstStatus": "NORMAL"
  }
}
```
**Errors:** `VEHICLE_NOT_FOUND` 404

---

### PATCH /api/v1/fleet/:id/mileage
**Auth:** Required
**Body:**
```json
{ "mileageCurrent": "number" }
```
**Response 200:**
```json
{ "data": { "updated": true, "mileageCurrent": 15500 } }
```
**Errors:** `VEHICLE_NOT_FOUND` 404, `VALIDATION_ERROR` 422

---

## Maintenance

### POST /api/v1/maintenance/log
**Auth:** Required
**Body:**
```json
{
  "vehicleId": "uuid",
  "component": "engine_oil | air_filter | spark_plug | drive_chain | brake_pads | brake_shoes | fuel_filter | transmission_fluid",
  "mileageAtService": "number",
  "notes": "string (optional)"
}
```
**Response 201:**
```json
{ "data": { "log": { "id": "uuid", "component": "string", "mileageAtService": 15000 } } }
```

---

### GET /api/v1/maintenance/:vehicleId
**Auth:** Required
**Query:** `?page=1&limit=20`
**Response 200:**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "component": "engine_oil",
        "mileageAtService": 13000,
        "notes": "Used semi-synthetic",
        "createdAt": "ISO8601"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 8, "hasNext": false }
  }
}
```

---

### GET /api/v1/maintenance/:vehicleId/schedule
**Auth:** Required
**Response 200:**
```json
{
  "data": {
    "schedule": [
      {
        "component": "engine_oil",
        "lastServicedKm": 13000,
        "adjustedIntervalKm": 1440,
        "kmDue": 14440,
        "alertStatus": "OVERDUE"
      }
    ]
  }
}
```

---

## Weather

### GET /api/v1/weather/current
**Auth:** Required
**Query:** `?lat=10.8231&lon=106.6297` (optional — defaults to OPENWEATHER_DEFAULT_LAT/LON)
**Response 200:** (Redis-cached, 30-min TTL)
```json
{
  "data": {
    "city": "Ho Chi Minh City",
    "humidity": 85,
    "temperature": 31.2,
    "condition": "Rain",
    "icon": "10d",
    "humidityMultiplier": 0.70,
    "cachedAt": "ISO8601"
  }
}
```

---

### GET /api/v1/weather/forecast
**Auth:** Required
**Query:** `?lat=10.8231&lon=106.6297`
**Response 200:** (Redis-cached, 3-hour TTL)
```json
{
  "data": {
    "forecast": [
      { "date": "2026-03-22", "avgHumidity": 88, "condition": "Rain", "minTemp": 26, "maxTemp": 33 }
    ]
  }
}
```

---

## Routes

### GET /api/v1/routes/optimize
**Auth:** Required
**Query:** `?origin=10.8231,106.6297&destination=10.7769,106.7009`
**Response 200:** (Redis-cached, 1-hour TTL)
```json
{
  "data": {
    "distanceKm": 12.4,
    "durationMin": 35,
    "loadFactor": 0.80,
    "polyline": "encoded_polyline_string",
    "fuelEstimateL": 0.62
  }
}
```
**Errors:** `ROUTE_FETCH_FAILED` 500

---

## Notifications

### POST /api/v1/notifications/fcm-token
**Auth:** Required
**Body:**
```json
{ "fcmToken": "string" }
```
**Response 200:**
```json
{ "data": { "registered": true } }
```
