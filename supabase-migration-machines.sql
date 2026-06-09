-- ─── Machines / Fleet Registry ───────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor
-- Phase 2 — machines: tractors, combines, seeders, sprayers, trailers

CREATE TABLE IF NOT EXISTS machines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- e.g. "John Deere 6140R"
  type        TEXT NOT NULL,           -- TRACTOR | COMBINA | SEMANATOARE | STROPITOARE | REMORCA | ALTELE
  brand       TEXT,
  model       TEXT,
  year        INTEGER,
  plate       TEXT,                    -- license plate
  fuel_type   TEXT DEFAULT 'motorina', -- motorina | benzina | electric | hibrid
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS machines_user_id_idx ON machines(user_id);

CREATE OR REPLACE FUNCTION trg_machines_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_machines_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION trg_machines_updated_at();

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY machines_user_policy ON machines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Link machines to work orders ────────────────────────────────────────────
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS work_orders_machine_id_idx ON work_orders(machine_id);

COMMENT ON TABLE machines IS 'Fleet registry: tractors, combines, seeders, sprayers, trailers';
COMMENT ON COLUMN machines.type IS 'TRACTOR|COMBINA|SEMANATOARE|STROPITOARE|REMORCA|ALTELE';
