-- ─── SIRUTA Table ────────────────────────────────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor BEFORE running the import script

CREATE TABLE IF NOT EXISTS siruta (
  code        TEXT        PRIMARY KEY,
  name        TEXT,
  type        TEXT,
  county      TEXT,
  parent_code TEXT,
  postal_code TEXT
);

CREATE INDEX IF NOT EXISTS siruta_county_idx ON siruta (UPPER(county));
CREATE INDEX IF NOT EXISTS siruta_name_idx   ON siruta (UPPER(name));
CREATE INDEX IF NOT EXISTS siruta_county_name_idx ON siruta (UPPER(county), UPPER(name));

-- Public read (the lookup widget is used by authenticated users)
ALTER TABLE siruta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "siruta_select_authenticated"
  ON siruta FOR SELECT TO authenticated
  USING (true);

-- ─── Add siruta_code to parcels ───────────────────────────────────────────────
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS siruta_code TEXT;
