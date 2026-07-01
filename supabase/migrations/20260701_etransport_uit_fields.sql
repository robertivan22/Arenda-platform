-- ============================================================
-- ArendaPro: e-Transport — add UIT generation tracking fields
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Add missing columns to etransport_shipments ─────────
ALTER TABLE etransport_shipments
  ADD COLUMN IF NOT EXISTS uit_generated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anaf_last_status    TEXT,
  ADD COLUMN IF NOT EXISTS anaf_declaration_code TEXT,
  ADD COLUMN IF NOT EXISTS anaf_reference      TEXT,
  ADD COLUMN IF NOT EXISTS validation_errors   JSONB;  -- array of error strings from last validation

-- ── 2. Extend status CHECK to include new lifecycle states ──
-- Drop old constraint and recreate with new values
ALTER TABLE etransport_shipments
  DROP CONSTRAINT IF EXISTS etransport_shipments_status_check;

ALTER TABLE etransport_shipments
  ADD CONSTRAINT etransport_shipments_status_check
  CHECK (status IN (
    'draft',
    'ready_to_submit',
    'validated',
    'validation_failed',
    'submitted',
    'processing',
    'accepted',
    'rejected',
    'uit_generated',
    'corrected',
    'deleted',
    'vehicle_modified',
    'confirmed'
  ));

-- ── 3. Index for polling job (submitted/processing) ─────────
CREATE INDEX IF NOT EXISTS idx_etship_poll
  ON etransport_shipments (user_id, status, anaf_upload_index)
  WHERE status IN ('submitted', 'processing') AND anaf_upload_index IS NOT NULL;
