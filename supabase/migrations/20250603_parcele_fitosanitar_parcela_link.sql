-- ============================================================
-- Migration: Add parcela_id FK to parcele_fitosanitar
-- Allows map polygons to be linked to a registered parcel
-- Run in Supabase SQL Editor for project hsaomcgssyyxroezhgcp
-- ============================================================

ALTER TABLE public.parcele_fitosanitar
  ADD COLUMN IF NOT EXISTS parcela_id UUID
    REFERENCES public.parcels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcele_fitosanitar_parcela_id
  ON public.parcele_fitosanitar(parcela_id);

COMMENT ON COLUMN public.parcele_fitosanitar.parcela_id
  IS 'Optional FK to parcels table — links the drawn polygon to a registered contract parcel';
