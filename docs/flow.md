# Data Flow Diagrams — Smart Fleet IoT
**TanQHoang © 2026**

---

## Flow 1: Mileage Update → Maintenance Recalculation → Alert

```
User updates mileage (PATCH /api/v1/fleet/:id/mileage)
        │
        ▼
fleetController.updateMileage()
        │
        ├── vehicleModel.updateMileage(id, km)   → Supabase UPDATE
        │
        ▼
maintenanceService.recalculateSchedule(vehicleId)
        │
        ├── weatherService.getCurrentConditions(lat, lon)
        │       ├── redisClient.get("weather:current:{lat}:{lon}")
        │       │       HIT  → return cached data (< 30 min old)
        │       │       MISS → OpenWeather API fetch → redisClient.set(TTL 1800s)
        │       └── getHumidityMultiplier(humidity)
        │
        ├── routeService.getLatestLoadFactor(vehicleId)
        │       └── routeModel.getLastRoute(vehicleId) → Supabase SELECT
        │
        ├── For each component:
        │       adjustedKm = base × H × F × L
        │       status = getAlertStatus(kmCurrent, kmDue, adjustedKm, humidity)
        │       maintenanceModel.upsertSchedule(vehicleId, component, status)
        │
        └── If status is CRITICAL or OVERDUE:
                notificationService.sendAlert(fcmToken, vehicle, component, status)
                        └── Firebase Admin SDK → FCM Push Notification → User Device
```

---

## Flow 2: Frontend Dashboard Load

```
User opens Dashboard
        │
        ▼
App.jsx → AuthGuard checks userSlice.isAuthenticated
        │
        ├── FAIL → redirect to /login
        │
        └── PASS
                │
                ▼
        useEffect dispatches (parallel):
                ├── dispatch(fetchFleet())
                │       └── GET /api/v1/fleet → fleetSlice.vehicles
                │
                ├── dispatch(fetchWeather())
                │       └── GET /api/v1/weather/current → weatherSlice.current
                │
                └── dispatch(fetchAlerts())
                        └── GET /api/v1/notifications → alertSlice.queue

        ▼
FleetOverview renders FleetCard[] from fleetSlice.vehicles
        │
        └── User clicks a vehicle
                │
                ▼
        dispatch(fetchVehicleStatus(vehicleId))
                └── GET /api/v1/fleet/:id/status
                        └── Returns schedule[] with alertStatus per component

        ▼
MaintenanceGauge renders per-component arc with color:
        NORMAL   → green  (#22c55e)
        WARNING  → yellow (#eab308)
        CRITICAL → orange (#f97316)
        OVERDUE  → red    (#ef4444)
```

---

## Flow 3: Weather Cache Strategy

```
GET /api/v1/weather/current?lat=10.8231&lon=106.6297
        │
        ▼
weatherService.getCurrentConditions(lat, lon)
        │
        ▼
redisClient.get("weather:current:10.8231:106.6297")
        │
        ├── CACHE HIT (age < 30 min)
        │       └── return { humidity, temp, condition, humidityMultiplier, cachedAt }
        │
        └── CACHE MISS
                │
                ▼
        axios.get(OpenWeather API /weather?lat&lon&appid)
                │
                ├── SUCCESS
                │       ├── compute humidityMultiplier from getHumidityMultiplier(humidity)
                │       ├── redisClient.set("weather:current:...", data, EX 1800)
                │       ├── weatherCacheModel.insert(lat, lon, humidity, ...)  ← DB snapshot
                │       └── return data
                │
                └── FAILURE (API down / rate limit)
                        ├── Try weatherCacheModel.getLatest(lat, lon)  ← DB fallback
                        └── If no DB record → return { humidity: 75, multiplier: 0.90 } (safe default)
```

---

## Flow 4: FCM Push Notification Lifecycle

```
maintenanceService detects CRITICAL or OVERDUE status
        │
        ▼
notificationService.sendAlert(vehicleId, component, status)
        │
        ├── userModel.getFcmToken(ownerId)
        │       └── SELECT fcm_token FROM users WHERE id = ownerId
        │
        ├── token is null → log warning, skip push (user hasn't registered device)
        │
        └── token exists
                │
                ▼
        firebase.messaging().send({
          token: fcmToken,
          notification: {
            title: "⚠️ CRITICAL: Engine Oil Due",
            body: "Vehicle 59B1-12345 — service overdue by 140 km"
          },
          data: { vehicleId, component, status, kmOverdue }
        })
                │
                ├── SUCCESS → log info "FCM sent to {userId}"
                │
                └── FAILURE (invalid token / FCM error)
                        ├── log error with requestId
                        └── if error.code === 'messaging/registration-token-not-registered'
                                → userModel.clearFcmToken(ownerId)  ← auto-cleanup
```

---

## Flow 5: JWT Authentication Cycle

```
POST /api/v1/auth/login
        │
        ▼
authController.login()
        │
        ├── authService.verifyCredentials(email, password)
        │       └── Supabase Auth signInWithPassword()
        │
        ├── authService.signTokens(userId)
        │       ├── sign accessToken  (JWT, 15m, JWT_SECRET)
        │       └── sign refreshToken (JWT, 7d, JWT_REFRESH_SECRET)
        │
        └── res.cookie("access_token", accessToken, { httpOnly, secure, sameSite: 'strict' })
            res.cookie("refresh_token", refreshToken, { httpOnly, secure, sameSite: 'strict' })

─────────────────────────────────────────────────────────────

Subsequent authenticated request
        │
        ▼
authMiddleware.js
        │
        ├── Extract access_token from req.cookies
        ├── jose.jwtVerify(token, JWT_SECRET)
        │       ├── VALID → attach req.user = { id, email }; next()
        │       └── EXPIRED → return 401 UNAUTHORIZED
        │
        └── Frontend Axios interceptor catches 401
                └── POST /api/v1/auth/refresh (sends refresh_token cookie)
                        ├── SUCCESS → retry original request with new access_token
                        └── FAIL    → dispatch(logoutUser()) → redirect /login
```
