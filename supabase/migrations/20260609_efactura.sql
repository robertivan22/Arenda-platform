-- ─────────────────────────────────────────────────────────────────────────────
-- RO e-Factura integration — Supabase migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add e-Factura tracking columns to the existing `invoices` table
-- -------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS efactura_status          TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
  -- Possible values: NOT_SUBMITTED | SUBMITTED | PROCESSING | ACCEPTED | REJECTED | ERROR

  ADD COLUMN IF NOT EXISTS efactura_upload_id       TEXT,
  -- ANAF id_incarcare returned after successful upload

  ADD COLUMN IF NOT EXISTS efactura_download_id     TEXT,
  -- ANAF id_descarcare returned when invoice is ACCEPTED (use to fetch signed ZIP)

  ADD COLUMN IF NOT EXISTS efactura_submitted_at    TIMESTAMPTZ,
  -- Timestamp of last successful upload to ANAF

  ADD COLUMN IF NOT EXISTS efactura_accepted_at     TIMESTAMPTZ,
  -- Timestamp when ANAF returned status = 'ok'

  ADD COLUMN IF NOT EXISTS efactura_rejection_reason TEXT;
  -- Error/rejection message from ANAF (when status = REJECTED)


-- 2. Submission audit trail
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS efactura_submissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id       UUID        NOT NULL,
  -- Note: not FK to invoices to allow archiving without cascade issues

  attempt          INTEGER     NOT NULL DEFAULT 1,
  status           TEXT        NOT NULL DEFAULT 'PENDING',
  -- PENDING | SUBMITTED | PROCESSING | ACCEPTED | REJECTED | ERROR

  upload_id        TEXT,
  -- ANAF id_incarcare

  download_id      TEXT,
  -- ANAF id_descarcare (populated when accepted)

  xml_sent         TEXT        NOT NULL,
  -- Exact UBL XML string that was submitted — immutable audit record

  response_status  INTEGER,
  -- HTTP status code returned by ANAF upload endpoint

  response_body    TEXT,
  -- Raw JSON response body from ANAF (upload or status check)

  error_message    TEXT,
  -- Application-level error (network failure, validation error, etc.)

  signed_zip_url   TEXT,
  -- Supabase Storage URL for the ANAF-signed ZIP artifact (optional)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS efactura_submissions_invoice_id_idx
  ON efactura_submissions(invoice_id);

CREATE INDEX IF NOT EXISTS efactura_submissions_user_id_idx
  ON efactura_submissions(user_id);

-- Row Level Security
ALTER TABLE efactura_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_efactura_submissions" ON efactura_submissions;
CREATE POLICY "users_own_efactura_submissions"
  ON efactura_submissions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 3. ANAF OAuth / SPV token storage (one row per user)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anaf_oauth_tokens (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token     TEXT        NOT NULL,
  refresh_token    TEXT,
  expires_at       TIMESTAMPTZ NOT NULL,
  token_scope      TEXT,
  cif              TEXT,
  -- The supplier CUI this token is authorized for (informational)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE anaf_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_anaf_tokens" ON anaf_oauth_tokens;
CREATE POLICY "users_own_anaf_tokens"
  ON anaf_oauth_tokens
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 4. Verify
-- -------------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' AND column_name LIKE 'efactura%';
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('efactura_submissions', 'anaf_oauth_tokens');
