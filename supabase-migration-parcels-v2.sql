-- ─── Parcel metadata extensions ────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS nr_cadastral  TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS culture        TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS apia_eligible  BOOLEAN DEFAULT TRUE;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS lat            NUMERIC(10,7);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS lng            NUMERIC(10,7);

COMMENT ON COLUMN parcels.nr_cadastral  IS 'Număr cadastral (ex: CAD-001234)';
COMMENT ON COLUMN parcels.culture       IS 'Cultura agricolă (ex: Grâu, Porumb)';
COMMENT ON COLUMN parcels.apia_eligible IS 'Eligibil APIA';
COMMENT ON COLUMN parcels.lat           IS 'Latitudine GPS';
COMMENT ON COLUMN parcels.lng           IS 'Longitudine GPS';
