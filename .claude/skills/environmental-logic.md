# Skill: Environmental Logic — Weather → Maintenance Math
**Smart-Fleet IoT | TanQHoang © 2026**

This is the authoritative formula set for all wear calculations.
`maintenanceService.js` MUST implement these formulas exactly.
Any change here requires `mechanic-pro` agent review.

---

## Master Formula

```
Adjusted Interval (km) = Base Interval (km) × H × F × L

Where:
  H = Humidity Multiplier     (0.60 – 1.00)
  F = Fuel Quality Multiplier (0.90 – 1.00)
  L = Load Factor Multiplier  (0.75 – 1.00)
```

Minimum adjusted interval is capped at `Base × 0.45` (no more than 55% reduction regardless of stacking).

---

## H — Humidity Multiplier

Source: Tropical fleet operations data, corrosion acceleration research (Southeast Asia).

```js
function getHumidityMultiplier(humidityPercent) {
  if (humidityPercent < 70) return 1.00;
  if (humidityPercent < 80) return 0.90;
  if (humidityPercent < 85) return 0.80;
  if (humidityPercent < 90) return 0.70;
  return 0.60; // >= 90%
}
```

**Components affected:** engine oil, air filter, drive chain, brake components
**Components NOT affected:** spark plug (sealed combustion), valve clearance (sealed engine)

---

## F — Fuel Quality Multiplier

Source: Vietnam national E10 fuel standard (QCVN 1:2015/BKHCN).

```js
function getFuelMultiplier(fuelType) {
  const multipliers = {
    'RON95':  1.00,  // Pure RON95, no ethanol
    'RON92':  0.95,  // Standard base without ethanol
    'E5':     0.95,  // 5% bioethanol blend
    'E10':    0.90,  // 10% bioethanol blend (Vietnam default)
  };
  return multipliers[fuelType] ?? 0.90; // Default E10 if unknown
}
```

**Components affected:** engine oil, spark plug, fuel filter, air filter
**Vietnam default:** `E10` (0.90 multiplier) — use unless user specifies otherwise

---

## L — Load Factor Multiplier

Source: Google Maps Distance Matrix API response (`duration_in_traffic`, `distance.value`).

```js
function getLoadFactor(routeData) {
  // routeData from Google Maps Matrix API
  const { distanceKm, durationMin, estimatedPayloadKg } = routeData;
  const avgSpeedKmh = (distanceKm / durationMin) * 60;

  // Long distance + low speed = heavy urban delivery pattern
  if (distanceKm > 50 || estimatedPayloadKg > 50) return 0.75;
  if (avgSpeedKmh < 20 || estimatedPayloadKg > 20) return 0.80; // Stop-go urban
  if (distanceKm > 20 || estimatedPayloadKg > 10) return 0.90; // Mixed
  return 1.00; // Light urban commute
}
```

If Google Maps data is unavailable (API error or cache miss), default load factor is `0.90`.

---

## Component-Multiplier Matrix

| Component | H Applied | F Applied | L Applied |
|-----------|-----------|-----------|-----------|
| Engine oil | YES | YES | YES |
| Air filter | YES | YES | NO |
| Spark plug | NO | YES | NO |
| Drive chain | YES | NO | YES |
| Brake pads | YES | NO | YES |
| Brake shoes | YES | NO | YES |
| Fuel filter | NO | YES | NO |
| Transmission fluid | NO | NO | YES |

---

## Alert Status Calculation

```js
function getAlertStatus(kmCurrent, kmDue, adjustedInterval, humidity, sustainedHumidityHours) {
  const remaining = kmDue - kmCurrent;
  const percentRemaining = (remaining / adjustedInterval) * 100;

  if (kmCurrent >= kmDue) return 'OVERDUE';

  // Critical humidity override: 85%+ sustained for 72+ hours
  if (humidity >= 85 && sustainedHumidityHours >= 72) return 'CRITICAL';

  if (percentRemaining < 10) return 'CRITICAL';
  if (percentRemaining < 20) return 'WARNING';
  return 'NORMAL';
}
```

---

## Worked Examples

### Example 1 — Monsoon season, delivery bike
```
Component: Engine oil (mineral)
Base interval: 2,000 km
Current km: 1,200 | Due at: 2,000 km

H: humidity = 88% → 0.70
F: fuel = E10 → 0.90
L: heavy delivery → 0.80

Adjusted interval: 2,000 × 0.70 × 0.90 × 0.80 = 1,008 km
Remaining: 2,000 - 1,200 = 800 km... but adjusted due = 1,200 + 1,008 = 2,208 km

Percent remaining: (2,208 - 1,200) / 1,008 × 100 = 100%
Status: NORMAL (first interval, bike is new)
```

### Example 2 — Overdue alert scenario
```
Component: Air filter (wet foam)
Base interval: 3,000 km
Current km: 5,800 | Last serviced at: 2,500 km (3,300 km ago)

H: humidity = 82% → 0.80
F: fuel = E10 → 0.90
L: N/A for air filter → 1.00

Adjusted interval: 3,000 × 0.80 × 0.90 = 2,160 km
Due at: 2,500 + 2,160 = 4,660 km
Current: 5,800 km (exceeded by 1,140 km)

Status: OVERDUE → FCM push + UI lock
```

---

## Redis Cache Strategy for Weather Data

```
Key: weather:current:{lat}:{lon}
TTL: 1,800 seconds (30 minutes)

Key: weather:forecast:{lat}:{lon}
TTL: 10,800 seconds (3 hours)

Key: weather:sustained_humidity:{vehicleId}
TTL: 259,200 seconds (72 hours) — rolling window for CRITICAL override
Value: JSON array of [{ humidity, timestamp }]
```
