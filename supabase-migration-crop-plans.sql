-- ─── Crop Plans ──────────────────────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor
-- Phase 1 — crop_plans: links a parcel to a campaign with a planned crop

CREATE TABLE IF NOT EXISTS crop_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  parcel_id           UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  crop                TEXT NOT NULL,                      -- e.g. "Grâu", "Porumb"
  planned_area_ha     NUMERIC(10,4),                      -- may differ from parcel.surface
  seed_variety        TEXT,
  planned_yield_t_ha  NUMERIC(10,3),
  status              TEXT NOT NULL DEFAULT 'PLANIFICAT'  -- PLANIFICAT | IN_PRODUCTIE | RECOLTAT | ABANDONAT
                      CHECK (status IN ('PLANIFICAT','IN_PRODUCTIE','RECOLTAT','ABANDONAT')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, parcel_id)                         -- one crop plan per parcel per campaign
);

-- Indexes
CREATE INDEX IF NOT EXISTS crop_plans_campaign_id_idx ON crop_plans(campaign_id);
CREATE INDEX IF NOT EXISTS crop_plans_parcel_id_idx   ON crop_plans(parcel_id);
CREATE INDEX IF NOT EXISTS crop_plans_user_id_idx     ON crop_plans(user_id);

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION trg_crop_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_crop_plans_updated_at
  BEFORE UPDATE ON crop_plans
  FOR EACH ROW EXECUTE FUNCTION trg_crop_plans_updated_at();

-- RLS: users see only their own records
ALTER TABLE crop_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY crop_plans_user_policy ON crop_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE crop_plans IS 'Links a parcel to a campaign with a planned crop. One plan per parcel per campaign.';
COMMENT ON COLUMN crop_plans.status IS 'PLANIFICAT → IN_PRODUCTIE → RECOLTAT (or ABANDONAT)';
