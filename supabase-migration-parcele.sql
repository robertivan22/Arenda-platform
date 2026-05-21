-- ============================================================
-- Parcele Fitosanitar Migration
-- Registru geographic de parcele pentru evidența tratamentelor
--
-- This table stores GeoJSON polygon geometry for agricultural
-- parcels used in the Registru Fitosanitar (phytosanitary
-- treatment register). Separate from the 'parcels' rental table.
--
-- Run in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/hsaomcgssyyxroezhgcp/sql/new
-- ============================================================

-- ── 1. PARCELE FITOSANITAR ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parcele_fitosanitar (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  nume_parcela      TEXT        NOT NULL,
  nr_cvi            TEXT,          -- APIA CVI number (optional, future LPIS integration)
  judet             TEXT,
  localitate        TEXT,
  adresa            TEXT,
  suprafata_ha      NUMERIC(10,4),

  -- GeoJSON geometry (Polygon)
  -- Format: { "type": "Polygon", "coordinates": [[[lng,lat], [lng,lat], ...]] }
  geometry_geojson  JSONB       NOT NULL,

  -- Quick lookup (centroid for map centering)
  centru_lat        NUMERIC(10,6),
  centru_lng        NUMERIC(10,6),

  -- Metadata
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  note              TEXT,

  -- Validation
  CONSTRAINT chk_suprafata CHECK (suprafata_ha IS NULL OR (suprafata_ha > 0 AND suprafata_ha <= 10000)),
  CONSTRAINT chk_centru_lat CHECK (centru_lat IS NULL OR centru_lat BETWEEN -90 AND 90),
  CONSTRAINT chk_centru_lng CHECK (centru_lng IS NULL OR centru_lng BETWEEN -180 AND 180)
);

-- ── 2. INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_parcele_fito_user_id
  ON public.parcele_fitosanitar (user_id);

CREATE INDEX IF NOT EXISTS idx_parcele_fito_centru
  ON public.parcele_fitosanitar (centru_lat, centru_lng);

CREATE INDEX IF NOT EXISTS idx_parcele_fito_judet
  ON public.parcele_fitosanitar (user_id, judet);

-- GIN index for JSONB geometry queries
CREATE INDEX IF NOT EXISTS idx_parcele_fito_geojson
  ON public.parcele_fitosanitar USING GIN (geometry_geojson);

-- ── 3. UPDATED_AT TRIGGER ────────────────────────────────────────────────────
-- Reuse set_updated_at() function if it exists, else create it
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parcele_fito_updated_at ON public.parcele_fitosanitar;
CREATE TRIGGER trg_parcele_fito_updated_at
  BEFORE UPDATE ON public.parcele_fitosanitar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────────────────
ALTER TABLE public.parcele_fitosanitar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own parcele_fitosanitar" ON public.parcele_fitosanitar;
CREATE POLICY "Users manage own parcele_fitosanitar"
  ON public.parcele_fitosanitar
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins see everything
DROP POLICY IF EXISTS "Admins see all parcele_fitosanitar" ON public.parcele_fitosanitar;
CREATE POLICY "Admins see all parcele_fitosanitar"
  ON public.parcele_fitosanitar
  FOR ALL
  USING (public.is_admin_user());

-- ── 5. LINK registru_fitosanitar.parcela_id → parcele_fitosanitar.id ────────
-- Add FK only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_parcela_fitosanitar'
      AND table_name = 'registru_fitosanitar'
  ) THEN
    ALTER TABLE public.registru_fitosanitar
      ADD CONSTRAINT fk_parcela_fitosanitar
      FOREIGN KEY (parcela_id)
      REFERENCES public.parcele_fitosanitar(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add FK fk_parcela_fitosanitar: %', SQLERRM;
END;
$$;

-- ── DONE — verify with:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'parcele_fitosanitar'
-- ORDER BY ordinal_position;
