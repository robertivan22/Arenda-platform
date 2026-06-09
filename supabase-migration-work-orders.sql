-- ─── Work Orders / Field Activities ─────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor
-- Phase 1 — work_orders: planned and executed field operations per campaign

CREATE TABLE IF NOT EXISTS work_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id      UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  parcel_id        UUID REFERENCES parcels(id) ON DELETE SET NULL,
  crop_plan_id     UUID REFERENCES crop_plans(id) ON DELETE SET NULL,
  operation_type   TEXT NOT NULL,      -- ARAT | DISCUIT | GRAPAT | SEMANAT | FERTILIZAT | ERBICIDAT | FUNGICIDAT | INSECTICID | IRIGAT | RECOLTAT | TRANSPORT | ALTELE
  planned_date     DATE,
  executed_date    DATE,
  area_ha          NUMERIC(10,4),      -- area actually worked
  status           TEXT NOT NULL DEFAULT 'PLANIFICAT'
                   CHECK (status IN ('PLANIFICAT','IN_EXECUTIE','FINALIZAT','ANULAT')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_orders_campaign_id_idx  ON work_orders(campaign_id);
CREATE INDEX IF NOT EXISTS work_orders_parcel_id_idx    ON work_orders(parcel_id);
CREATE INDEX IF NOT EXISTS work_orders_crop_plan_id_idx ON work_orders(crop_plan_id);
CREATE INDEX IF NOT EXISTS work_orders_user_id_idx      ON work_orders(user_id);

-- ─── Input consumption per work order ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_order_inputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type      TEXT NOT NULL,   -- SAMANTA | INGRASAMANT | ERBICID | FUNGICID | INSECTICID | CARBURANT | ALTELE
  product_name    TEXT NOT NULL,
  quantity        NUMERIC(12,4) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kg',   -- kg | L | t | buc
  cost_per_unit   NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_order_inputs_wo_id_idx   ON work_order_inputs(work_order_id);
CREATE INDEX IF NOT EXISTS work_order_inputs_user_id_idx ON work_order_inputs(user_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_work_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION trg_work_orders_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE work_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_orders_user_policy ON work_orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY work_order_inputs_user_policy ON work_order_inputs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE work_orders       IS 'Planned/executed field operations per parcel per campaign';
COMMENT ON TABLE work_order_inputs IS 'Input materials (seeds, fertiliser, PPP, fuel) consumed per work order';
COMMENT ON COLUMN work_orders.operation_type IS 'ARAT|DISCUIT|GRAPAT|SEMANAT|FERTILIZAT|ERBICIDAT|FUNGICIDAT|INSECTICID|IRIGAT|RECOLTAT|TRANSPORT|ALTELE';
