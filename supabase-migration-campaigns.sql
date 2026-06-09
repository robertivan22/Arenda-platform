-- ─── Campaign / Agricultural Season model ───────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor
-- Phase 0 — Architecture hardening: add Campaign as the temporal anchor

CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- e.g. "Campania 2025–2026"
  year        INTEGER NOT NULL,        -- primary year (2025 = starts autumn 2025)
  start_date  DATE NOT NULL,           -- typically Oct 1 for cereals
  end_date    DATE,                    -- typically Sep 30 next year
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

-- Only one active campaign per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_active_unique
  ON campaigns (user_id)
  WHERE is_active = TRUE;

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION trg_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION trg_campaigns_updated_at();

-- RLS: users see only their own campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_user_policy ON campaigns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Back-link existing tables to campaigns ──────────────────────────────────
-- Add nullable campaign_id to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS transactions_campaign_id_idx ON transactions(campaign_id);

-- Add nullable campaign_id to parcel_transactions
ALTER TABLE parcel_transactions
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS parcel_transactions_campaign_id_idx ON parcel_transactions(campaign_id);

-- Add nullable campaign_id to registru_fitosanitar
ALTER TABLE registru_fitosanitar
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fitosanitar_campaign_id_idx ON registru_fitosanitar(campaign_id);

-- ─── Seed campaigns from existing campaign_year data ────────────────────────
-- Creates one campaign row per (user_id, campaign_year) that already exists.
-- campaign name defaults to "Campania {year}" — users can rename later.
-- The most recent year becomes the active campaign.

DO $$
DECLARE
  rec RECORD;
  newest_year INTEGER;
BEGIN
  -- Seed from transactions
  FOR rec IN
    SELECT DISTINCT user_id, campaign_year
    FROM transactions
    WHERE campaign_year IS NOT NULL
  LOOP
    INSERT INTO campaigns (user_id, name, year, start_date, end_date, is_active)
    VALUES (
      rec.user_id,
      'Campania ' || rec.campaign_year,
      rec.campaign_year,
      make_date(rec.campaign_year, 10, 1),
      make_date(rec.campaign_year + 1, 9, 30),
      FALSE
    )
    ON CONFLICT (user_id, year) DO NOTHING;
  END LOOP;

  -- Seed from parcel_transactions
  FOR rec IN
    SELECT DISTINCT user_id, campaign_year
    FROM parcel_transactions
    WHERE campaign_year IS NOT NULL
  LOOP
    INSERT INTO campaigns (user_id, name, year, start_date, end_date, is_active)
    VALUES (
      rec.user_id,
      'Campania ' || rec.campaign_year,
      rec.campaign_year,
      make_date(rec.campaign_year, 10, 1),
      make_date(rec.campaign_year + 1, 9, 30),
      FALSE
    )
    ON CONFLICT (user_id, year) DO NOTHING;
  END LOOP;

  -- Mark the most recent campaign as active for each user
  FOR rec IN SELECT DISTINCT user_id FROM campaigns LOOP
    SELECT MAX(year) INTO newest_year FROM campaigns WHERE user_id = rec.user_id;
    UPDATE campaigns
      SET is_active = TRUE
      WHERE user_id = rec.user_id AND year = newest_year;
  END LOOP;

  -- Back-populate campaign_id on transactions
  UPDATE transactions t
    SET campaign_id = c.id
    FROM campaigns c
    WHERE c.user_id = t.user_id AND c.year = t.campaign_year
      AND t.campaign_id IS NULL AND t.campaign_year IS NOT NULL;

  -- Back-populate campaign_id on parcel_transactions
  UPDATE parcel_transactions pt
    SET campaign_id = c.id
    FROM campaigns c
    WHERE c.user_id = pt.user_id AND c.year = pt.campaign_year
      AND pt.campaign_id IS NULL AND pt.campaign_year IS NOT NULL;
END $$;

COMMENT ON TABLE campaigns IS 'Agricultural season/campaign — the temporal anchor for all operational modules';
COMMENT ON COLUMN campaigns.year IS 'Primary year (October start). 2025 = Oct 2025 – Sep 2026';
COMMENT ON COLUMN campaigns.is_active IS 'The current working campaign. Only one active per user.';
