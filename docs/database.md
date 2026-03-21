# Database Schema — Smart Fleet IoT
**TanQHoang © 2026** | Engine: PostgreSQL via Supabase

---

## ERD (Entity Relationship Diagram)

```
users ──< vehicles ──< maintenance_logs
              │
              └──< maintenance_schedule
              │
              └──< route_logs

weather_cache (standalone, no FK — keyed by lat/lon)
```

---

## Global Conventions

- `id UUID DEFAULT gen_random_uuid()` — all PKs
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()` — updated via trigger
- `deleted_at TIMESTAMPTZ NULL` — soft delete on fleet/maintenance tables
- All FK columns named `{table}_id`
- RLS enabled on ALL user-facing tables

---

## Table: users

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid  UUID UNIQUE NOT NULL,     -- Supabase Auth user ID
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  fcm_token     TEXT,                     -- Firebase Cloud Messaging device token
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON users
  USING (supabase_uid = auth.uid());
```

---

## Table: vehicles

```sql
CREATE TABLE vehicles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model            TEXT NOT NULL DEFAULT 'Honda Wave RSX',
  plate_number     TEXT,
  mileage_current  INTEGER NOT NULL DEFAULT 0,   -- km
  fuel_type        TEXT NOT NULL DEFAULT 'E10',  -- E10 | E5 | RON92 | RON95
  lat              NUMERIC(9,6),                 -- home base location
  lon              NUMERIC(9,6),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ                   -- soft delete
);

CREATE INDEX idx_vehicles_owner ON vehicles(owner_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_owner_only" ON vehicles
  USING (owner_id = (SELECT id FROM users WHERE supabase_uid = auth.uid()));
```

---

## Table: maintenance_logs

Service history — immutable record of completed services.

```sql
CREATE TABLE maintenance_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id         UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  component          TEXT NOT NULL,     -- engine_oil | air_filter | spark_plug | drive_chain | brake_pads | brake_shoes | fuel_filter | transmission_fluid
  mileage_at_service INTEGER NOT NULL,  -- km odometer at time of service
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ        -- soft delete only
);

CREATE INDEX idx_logs_vehicle ON maintenance_logs(vehicle_id, component) WHERE deleted_at IS NULL;

-- RLS (via vehicle ownership)
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_via_vehicle_ownership" ON maintenance_logs
  USING (
    vehicle_id IN (
      SELECT v.id FROM vehicles v
      JOIN users u ON u.id = v.owner_id
      WHERE u.supabase_uid = auth.uid()
        AND v.deleted_at IS NULL
    )
  );
```

---

## Table: maintenance_schedule

Computed next-service predictions — upserted by `maintenanceService.js`.

```sql
CREATE TABLE maintenance_schedule (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id            UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  component             TEXT NOT NULL,
  last_serviced_km      INTEGER NOT NULL DEFAULT 0,
  base_interval_km      INTEGER NOT NULL,
  adjusted_interval_km  INTEGER NOT NULL,    -- after H × F × L multipliers
  km_due                INTEGER NOT NULL,    -- last_serviced_km + adjusted_interval_km
  alert_status          TEXT NOT NULL DEFAULT 'NORMAL',  -- NORMAL | WARNING | CRITICAL | OVERDUE
  humidity_at_calc      NUMERIC(5,2),        -- humidity when last recalculated
  calculated_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vehicle_id, component)              -- one schedule row per vehicle-component pair
);

CREATE INDEX idx_schedule_vehicle ON maintenance_schedule(vehicle_id);
CREATE INDEX idx_schedule_status ON maintenance_schedule(alert_status);

-- RLS
ALTER TABLE maintenance_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_via_vehicle_ownership" ON maintenance_schedule
  USING (
    vehicle_id IN (
      SELECT v.id FROM vehicles v
      JOIN users u ON u.id = v.owner_id
      WHERE u.supabase_uid = auth.uid()
        AND v.deleted_at IS NULL
    )
  );
```

---

## Table: route_logs

Trip history for load factor calculation.

```sql
CREATE TABLE route_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  origin_lat    NUMERIC(9,6) NOT NULL,
  origin_lon    NUMERIC(9,6) NOT NULL,
  dest_lat      NUMERIC(9,6) NOT NULL,
  dest_lon      NUMERIC(9,6) NOT NULL,
  distance_km   NUMERIC(7,2),
  duration_min  INTEGER,
  load_factor   NUMERIC(3,2),           -- 0.75 – 1.00
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_route_logs_vehicle ON route_logs(vehicle_id);

-- RLS
ALTER TABLE route_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes_via_vehicle_ownership" ON route_logs
  USING (
    vehicle_id IN (
      SELECT v.id FROM vehicles v
      JOIN users u ON u.id = v.owner_id
      WHERE u.supabase_uid = auth.uid()
    )
  );
```

---

## Table: weather_cache

Local weather snapshots — supplementary to Redis cache. Used for historical humidity tracking (CRITICAL override: 85%+ for 72h).

```sql
CREATE TABLE weather_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat          NUMERIC(9,6) NOT NULL,
  lon          NUMERIC(9,6) NOT NULL,
  humidity     NUMERIC(5,2) NOT NULL,
  temperature  NUMERIC(5,2),
  condition    TEXT,
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_cache_location ON weather_cache(lat, lon, recorded_at DESC);

-- No RLS — weather data is not user-specific
-- Rows older than 7 days can be purged via cron
```

---

## Updated_at Trigger (apply to all tables with updated_at)

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Repeat for: users, maintenance_schedule
```

---

## Enum Values Reference

| Column | Valid Values |
|--------|-------------|
| `vehicles.fuel_type` | `E10`, `E5`, `RON92`, `RON95` |
| `maintenance_logs.component` | `engine_oil`, `air_filter`, `spark_plug`, `drive_chain`, `brake_pads`, `brake_shoes`, `fuel_filter`, `transmission_fluid` |
| `maintenance_schedule.alert_status` | `NORMAL`, `WARNING`, `CRITICAL`, `OVERDUE` |
