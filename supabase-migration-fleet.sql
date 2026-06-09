-- ─── Fleet Management — Full Schema ──────────────────────────────────────────
-- Run AFTER supabase-migration-machines.sql in Supabase Dashboard → SQL Editor
-- Adds: implements, operators, fuel_logs, maintenance_tasks, machine_work_logs, telematics

-- ── 1. Expand machines table (idempotent) ─────────────────────────────────────
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS current_hours  NUMERIC(10,1),   -- engine hours meter reading
  ADD COLUMN IF NOT EXISTS current_km     INTEGER,          -- odometer reading
  ADD COLUMN IF NOT EXISTS engine_hp      INTEGER,          -- horsepower (CP)
  ADD COLUMN IF NOT EXISTS vin            TEXT,             -- vehicle identification number
  ADD COLUMN IF NOT EXISTS purchase_date  DATE,
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);

-- ── 2. Implements (attachments: plows, seeders, sprayers, etc.) ───────────────
CREATE TABLE IF NOT EXISTS implements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,         -- e.g. "Plug cu 5 brăzdare"
  type        TEXT NOT NULL DEFAULT 'ALTELE',
                                     -- PLUG | DISC | SEMANATOARE | CULTIVATOR
                                     -- STROPITOARE | REMORCA | COSITOR | ALTELE
  brand       TEXT,
  model       TEXT,
  year        INTEGER,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS implements_user_id_idx ON implements(user_id);
ALTER TABLE implements ENABLE ROW LEVEL SECURITY;
CREATE POLICY implements_user ON implements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 3. Operators (machine drivers / mecanizatori) ─────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  phone            TEXT,
  license_category TEXT,   -- e.g. "B, C, TR"
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operators_user_id_idx ON operators(user_id);
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY operators_user ON operators
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 4. Fuel logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id     UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  log_date       DATE NOT NULL,
  liters         NUMERIC(8,2) NOT NULL,
  cost_per_liter NUMERIC(6,2),
  -- GENERATED: NULL when cost_per_liter is NULL
  total_cost     NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(liters * cost_per_liter, 2)) STORED,
  odometer_km    INTEGER,
  hours_meter    NUMERIC(10,1),
  location       TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fuel_logs_machine_id_idx ON fuel_logs(machine_id);
CREATE INDEX IF NOT EXISTS fuel_logs_date_idx       ON fuel_logs(log_date DESC);
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY fuel_logs_user ON fuel_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 5. Maintenance tasks (schedule + history) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id       UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,     -- e.g. "Schimb ulei motor + filtru"
  type             TEXT NOT NULL DEFAULT 'SERVICE'
                     CHECK (type IN ('SERVICE','REVIZIE','REPARATIE','ITP','ALTELE')),
  -- Triggers (at least one should be set)
  due_date         DATE,
  due_hours        NUMERIC(10,1),     -- at this engine hour reading
  due_km           INTEGER,
  -- Completion
  completed_date   DATE,
  completed_hours  NUMERIC(10,1),
  cost             NUMERIC(10,2),
  service_provider TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'PLANIFICAT'
                     CHECK (status IN ('PLANIFICAT','IN_EXECUTIE','FINALIZAT','ANULAT')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maintenance_machine_id_idx ON maintenance_tasks(machine_id);
CREATE INDEX IF NOT EXISTS maintenance_due_date_idx   ON maintenance_tasks(due_date);
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_user ON maintenance_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 6. Machine work logs (linked to parcels and operations) ───────────────────
CREATE TABLE IF NOT EXISTS machine_work_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id      UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  implement_id    UUID REFERENCES implements(id) ON DELETE SET NULL,
  operator_id     UUID REFERENCES operators(id) ON DELETE SET NULL,
  work_order_id   UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  parcel_id       UUID REFERENCES parcels(id) ON DELETE SET NULL,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  log_date        DATE NOT NULL,
  operation_type  TEXT,               -- mirrors work_orders.operation_type
  hours_worked    NUMERIC(6,2),
  area_worked_ha  NUMERIC(8,2),
  fuel_consumed_l NUMERIC(8,2),
  start_hours     NUMERIC(10,1),      -- odometer/hours meter at session start
  end_hours       NUMERIC(10,1),      -- odometer/hours meter at session end
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mwl_machine_id_idx    ON machine_work_logs(machine_id);
CREATE INDEX IF NOT EXISTS mwl_work_order_id_idx ON machine_work_logs(work_order_id);
CREATE INDEX IF NOT EXISTS mwl_parcel_id_idx     ON machine_work_logs(parcel_id);
CREATE INDEX IF NOT EXISTS mwl_date_idx          ON machine_work_logs(log_date DESC);
ALTER TABLE machine_work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY machine_work_logs_user ON machine_work_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 7. Telematics — integration architecture (schema only) ───────────────────
-- Supports Teltonika, Samsara, Ruptela, and other GPS/CAN providers

CREATE TABLE IF NOT EXISTS telematics_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id    UUID REFERENCES machines(id) ON DELETE SET NULL,
  device_serial TEXT,
  provider      TEXT,     -- 'Teltonika' | 'Samsara' | 'Ruptela' | 'Custom'
  -- api_key stored externally (never in DB); only reference token stored
  api_token_ref TEXT,
  last_sync_at  TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE telematics_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY telematics_user ON telematics_devices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Raw GPS/CAN events — append-only, high-volume table
CREATE TABLE IF NOT EXISTS telematics_events (
  id               BIGSERIAL PRIMARY KEY,
  device_id        UUID NOT NULL REFERENCES telematics_devices(id) ON DELETE CASCADE,
  machine_id       UUID REFERENCES machines(id) ON DELETE SET NULL,
  event_at         TIMESTAMPTZ NOT NULL,
  lat              NUMERIC(10,7),
  lng              NUMERIC(10,7),
  speed_kmh        SMALLINT,
  engine_hours     NUMERIC(10,1),
  fuel_level_pct   SMALLINT,
  ignition         BOOLEAN,
  raw              JSONB         -- full provider payload for future parsing
);
CREATE INDEX IF NOT EXISTS tel_events_machine_time_idx
  ON telematics_events(machine_id, event_at DESC);
-- Consider time-series partitioning for event_at in production

COMMENT ON TABLE telematics_devices IS 'GPS/CAN telematics device registry';
COMMENT ON TABLE telematics_events  IS 'Raw GPS/CAN telemetry events — high volume, append-only';
COMMENT ON TABLE machine_work_logs  IS 'Per-session machine activity linked to parcels/operations/operators';
COMMENT ON TABLE maintenance_tasks  IS 'Maintenance schedule and history (date/hours/km triggers)';
COMMENT ON TABLE fuel_logs          IS 'Fuel fill-up log per machine';
COMMENT ON TABLE operators          IS 'Machine operators / mecanizatori';
COMMENT ON TABLE implements         IS 'Implements and attachments (plows, seeders, sprayers, etc.)';
