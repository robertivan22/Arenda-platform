-- ─── Harvest Lots ────────────────────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor
-- Phase 1 — harvest_lots: actual yield recorded per parcel per campaign

CREATE TABLE IF NOT EXISTS harvest_lots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  parcel_id           UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  crop_plan_id        UUID REFERENCES crop_plans(id) ON DELETE SET NULL,
  crop                TEXT NOT NULL,
  harvested_date      DATE,
  area_harvested_ha   NUMERIC(10,4),
  yield_t_ha          NUMERIC(10,3),
  total_quantity_t    NUMERIC(12,3)
                      GENERATED ALWAYS AS (area_harvested_ha * yield_t_ha) STORED,
  moisture_pct        NUMERIC(5,2),
  storage_location    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, parcel_id)   -- one harvest record per parcel per campaign
);

CREATE INDEX IF NOT EXISTS harvest_lots_campaign_id_idx  ON harvest_lots(campaign_id);
CREATE INDEX IF NOT EXISTS harvest_lots_parcel_id_idx    ON harvest_lots(parcel_id);
CREATE INDEX IF NOT EXISTS harvest_lots_user_id_idx      ON harvest_lots(user_id);

CREATE OR REPLACE FUNCTION trg_harvest_lots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_harvest_lots_updated_at
  BEFORE UPDATE ON harvest_lots
  FOR EACH ROW EXECUTE FUNCTION trg_harvest_lots_updated_at();

ALTER TABLE harvest_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY harvest_lots_user_policy ON harvest_lots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE harvest_lots IS 'Actual yield recorded per parcel per campaign. Compares vs crop_plans planned yield.';
COMMENT ON COLUMN harvest_lots.total_quantity_t IS 'Computed: area_harvested_ha × yield_t_ha';
