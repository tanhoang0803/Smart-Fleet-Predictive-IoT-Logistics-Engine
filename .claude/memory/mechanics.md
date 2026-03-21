# Mechanical Domain Memory — Honda Wave RSX
**TanQHoang © 2026**

Source of truth for all vehicle-specific maintenance data. Referenced by `mechanic-pro` agent and `maintenanceService.js`.

---

## Honda Wave RSX Specifications

| Spec | Value |
|------|-------|
| Engine | 110cc, 4-stroke, SOHC, air-cooled |
| Fuel system | Carburetor (older) / PGM-FI (newer) |
| Fuel type | RON92 / RON95 / E10 blend |
| Transmission | Automatic (CVT) |
| Chain | #420 drive chain |
| Oil capacity | 0.8L |
| Recommended oil | SAE 10W-30 (mineral or semi-synthetic) |

---

## Base Service Intervals (Manufacturer Spec — Ideal Conditions)

| Component | Interval (km) | Notes |
|-----------|---------------|-------|
| Engine oil (mineral) | 2,000 | Honda service manual p.47 |
| Engine oil (semi-synthetic) | 3,500 | Honda service manual p.47 |
| Air filter (dry) | 5,000 | Inspect at 2,500; replace at 5,000 |
| Air filter (wet/foam) | 3,000 | Wash at 1,500; replace at 3,000 |
| Spark plug (standard) | 8,000 | NGK CPR6EA-9 or equivalent |
| Spark plug (iridium) | 16,000 | NGK CPR6EAIX-9 |
| Drive chain | Inspect 500 (wet) / 1,000 (dry) | Lubricate; replace at 8,000–10,000 |
| Brake pads (front disc) | 15,000 | Inspect at 10,000 |
| Brake shoes (rear drum) | 20,000 | Inspect at 12,000 |
| Coolant | N/A | Air-cooled; no coolant system |
| Transmission fluid | 8,000 | CVT variants only |
| Valve clearance | 16,000 | Adjust if noisy |
| Fuel filter | 12,000 | Carb: clean bowl; PGM-FI: replace filter |

---

## Environmental Multipliers (Tropical Climate)

### Humidity Multiplier (H)
Applied when `humidity > 70% RH`. Derived from corrosion and oxidation acceleration data for Southeast Asian fleet operations.

| Humidity (RH%) | Multiplier (H) | Effect |
|----------------|----------------|--------|
| < 70% | 1.00 | No adjustment |
| 70–79% | 0.90 | 10% shorter interval |
| 80–84% | 0.80 | 20% shorter interval |
| 85–89% | 0.70 | 30% shorter interval |
| ≥ 90% | 0.60 | 40% shorter interval |

**Applies to:** Engine oil, air filter, drive chain, brake components.
**Does NOT apply to:** Spark plug (sealed), valve clearance (sealed).

### Fuel Quality Multiplier (F)
| Fuel Type | Multiplier (F) | Notes |
|-----------|----------------|-------|
| RON95 (pure) | 1.00 | Baseline |
| RON92 | 0.95 | Slight carbon deposit increase |
| E10 (10% ethanol) | 0.90 | Ethanol increases combustion residue; accelerates rubber seal wear |
| E5 (5% ethanol) | 0.95 | Minor impact |

**Default for Vietnam market:** E10 (0.90 multiplier)
**Applies to:** Engine oil, spark plug, fuel filter, carburetor jet (if applicable).

### Load Factor Multiplier (L)
Derived from Google Maps route data (distance, terrain, estimated payload).

| Use Case | Load Factor (L) | Scenario |
|----------|-----------------|---------|
| Light urban commute | 1.00 | Single rider, flat roads |
| Mixed urban/suburban | 0.90 | Some hills, occasional 2-up riding |
| Heavy load / delivery | 0.80 | Food delivery, cargo carrier |
| Long-haul rural | 0.75 | >50km trips, rural roads |

**Applies to:** All components (higher load = more wear).

---

## Master Formula

```
Adjusted Interval (km) = Base Interval × H × F × L
```

**Example — Engine Oil (mineral), monsoon season, delivery bike:**
```
2,000 km × 0.65 (H: 88% RH) × 0.90 (F: E10) × 0.80 (L: heavy load)
= 2,000 × 0.65 × 0.90 × 0.80
= 936 km
```

---

## Alert Threshold Calculation

```
Percent remaining = (km_due - km_current) / Adjusted Interval × 100

NORMAL   → > 20% remaining
WARNING  → 10–20% remaining
CRITICAL → < 10% remaining  OR  humidity > 85% sustained for 72h
OVERDUE  → km_current >= km_due
```

---

## E10 Fuel Impact Notes (Vietnam-specific)

Vietnam's standard pump fuel is E10 (Xăng E10 — RON92 with 10% bioethanol). Key degradation effects:

1. **Rubber seals:** Ethanol is hygroscopic — absorbs moisture, swells and degrades carburetor seals and fuel hose rubber. Inspect fuel hoses every 12,000 km.
2. **Combustion residue:** Ethanol burns cleaner per combustion event but increases overall deposit accumulation at low RPM urban stop-go patterns. Oil contamination accelerates.
3. **Corrosion:** Ethanol + humidity creates a mildly acidic environment in the fuel system. Accelerates carb jet oxidation.
4. **Phase separation risk:** If the bike sits unused for >2 weeks, E10 can phase-separate (ethanol absorbs water and sinks). Drain carb bowl before extended storage.

---

## Rainy Season Calendar (Ho Chi Minh City)

| Month | Season | Avg Humidity | Maintenance Impact |
|-------|---------|-------------|-------------------|
| Nov–Apr | Dry | 60–70% RH | Normal intervals |
| May–Jun | Early wet | 75–82% RH | Apply 0.80–0.85 multiplier |
| Jul–Sep | Peak wet | 85–92% RH | Apply 0.60–0.70 multiplier; weekly chain lube |
| Oct | Transitional | 78–85% RH | Apply 0.75–0.80 multiplier |

**Critical period:** July–September. All service intervals should be treated as reduced by 30–40% during this window.
