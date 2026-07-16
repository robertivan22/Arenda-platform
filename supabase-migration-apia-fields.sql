-- ============================================================
-- Migration: APIA Shapefile Import Support
-- Adaugă câmpurile APIA 1:1 în tabelul parcels
-- Safe to re-run (IF NOT EXISTS)
-- ============================================================

-- 1. Câmpuri de identificare APIA (1:1 cu shapefile-ul)
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS apia_farm_id   TEXT,
  ADD COLUMN IF NOT EXISTS apia_year      INTEGER,
  ADD COLUMN IF NOT EXISTS siruta         TEXT,
  ADD COLUMN IF NOT EXISTS crop_nr        TEXT,
  ADD COLUMN IF NOT EXISTS crop_code      INTEGER,
  ADD COLUMN IF NOT EXISTS agro_env       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS full_bloc      INTEGER,
  ADD COLUMN IF NOT EXISTS apia_comment   TEXT,
  ADD COLUMN IF NOT EXISTS apia_inserted  DATE,
  ADD COLUMN IF NOT EXISTS apia_updated   DATE;

-- 2. Geometrie poligon WGS84 (GeoJSON, identic cu parcele_fitosanitar)
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS geom_geojson   JSONB,
  ADD COLUMN IF NOT EXISTS centru_lat     NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS centru_lng     NUMERIC(10,6);

-- 3. Indexuri pentru căutări APIA frecvente
CREATE INDEX IF NOT EXISTS parcels_apia_farm_id_idx
  ON parcels(apia_farm_id) WHERE apia_farm_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS parcels_apia_year_idx
  ON parcels(apia_year) WHERE apia_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS parcels_siruta_idx
  ON parcels(siruta) WHERE siruta IS NOT NULL;

CREATE INDEX IF NOT EXISTS parcels_geom_gin_idx
  ON parcels USING GIN(geom_geojson) WHERE geom_geojson IS NOT NULL;

-- 4. Constrângere unicitate APIA — previne duplicate la re-import
--    O parcelă APIA e unică prin (user_id, farm_id, year, bloc_nr, parcel_nr, crop_nr)
ALTER TABLE parcels
  DROP CONSTRAINT IF EXISTS uq_apia_parcel_identity;
ALTER TABLE parcels
  ADD CONSTRAINT uq_apia_parcel_identity
  UNIQUE NULLS NOT DISTINCT (user_id, apia_farm_id, apia_year, bloc_fizic, parcel_nr, crop_nr);

-- 5. Comentarii
COMMENT ON COLUMN parcels.apia_farm_id   IS 'Cod fermă APIA (ex: RO002272619)';
COMMENT ON COLUMN parcels.apia_year      IS 'Campania agricolă APIA (ex: 2026)';
COMMENT ON COLUMN parcels.siruta         IS 'Cod SIRUTA localitate (6 cifre, text pt. zero-padding)';
COMMENT ON COLUMN parcels.crop_nr        IS 'Litera sub-parcelei multi-cultură APIA (a, b, c...)';
COMMENT ON COLUMN parcels.crop_code      IS 'Cod cultură APIA (ex: 108=Porumb, 201=Floarea Soarelui)';
COMMENT ON COLUMN parcels.agro_env       IS 'Parcelă înregistrată în măsuri agro-mediu APIA';
COMMENT ON COLUMN parcels.full_bloc      IS 'Număr total parcele în blocul fizic LPIS';
COMMENT ON COLUMN parcels.apia_comment   IS 'Câmp comentariu APIA (câmpul comment din shapefile)';
COMMENT ON COLUMN parcels.apia_inserted  IS 'Data înregistrării parcelei la APIA';
COMMENT ON COLUMN parcels.apia_updated   IS 'Data ultimei actualizări la APIA';
COMMENT ON COLUMN parcels.geom_geojson   IS 'Geometrie poligon WGS84 GeoJSON (reproiectată din Stereo 70 la import)';
COMMENT ON COLUMN parcels.centru_lat     IS 'Centroid latitudine WGS84 (derivat din geom_geojson)';
COMMENT ON COLUMN parcels.centru_lng     IS 'Centroid longitudine WGS84 (derivat din geom_geojson)';
