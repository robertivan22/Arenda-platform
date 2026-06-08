-- ─── Map / parcele_fitosanitar extensions ───────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor

-- Add linked registry parcel reference
ALTER TABLE parcele_fitosanitar
  ADD COLUMN IF NOT EXISTS parcela_id UUID REFERENCES parcels(id) ON DELETE SET NULL;

-- Add culture display fields (used for polygon colouring)
ALTER TABLE parcele_fitosanitar
  ADD COLUMN IF NOT EXISTS cultura_label TEXT;
ALTER TABLE parcele_fitosanitar
  ADD COLUMN IF NOT EXISTS cultura_color TEXT;

-- Index for looking up map records by registry parcel
CREATE INDEX IF NOT EXISTS parcele_fitosanitar_parcela_id_idx
  ON parcele_fitosanitar(parcela_id)
  WHERE parcela_id IS NOT NULL;

COMMENT ON COLUMN parcele_fitosanitar.parcela_id  IS 'FK → parcels.id — links map polygon to registry entry';
COMMENT ON COLUMN parcele_fitosanitar.cultura_label IS 'Culture name for legend display';
COMMENT ON COLUMN parcele_fitosanitar.cultura_color IS 'Hex colour for polygon rendering';
