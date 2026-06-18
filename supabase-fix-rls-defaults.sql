-- ─── Fix RLS: set DEFAULT auth.uid() on user_id columns ─────────────────────
-- Run in Supabase Dashboard → SQL Editor
-- This allows INSERT without explicitly passing user_id from the client.
-- The RLS WITH CHECK (auth.uid() = user_id) will still enforce ownership.

ALTER TABLE machines          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE implements        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE operators         ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE fuel_logs         ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE maintenance_tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE machine_work_logs ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ─── Fix RLS: contract_documents WITH CHECK ───────────────────────────────────
-- Fixes "new row violates row-level security policy" on INSERT.
-- Run ALL lines below in Supabase Dashboard → SQL Editor

-- Step 1: ensure table exists (safe if already exists)
CREATE TABLE IF NOT EXISTS contract_documents (
  id                      UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID   NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id             UUID   NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  lessor_id               UUID   NOT NULL,
  document_type           TEXT   NOT NULL DEFAULT 'other'
                            CHECK (document_type IN (
                              'main_contract','additional_act','annex','payment_document','other'
                            )),
  title                   TEXT,
  original_file_name      TEXT   NOT NULL,
  storage_path            TEXT   NOT NULL,
  compressed_storage_path TEXT,
  active_storage_path     TEXT   NOT NULL,
  mime_type               TEXT   NOT NULL DEFAULT 'application/pdf',
  original_size_bytes     BIGINT NOT NULL,
  compressed_size_bytes   BIGINT,
  compression_ratio       NUMERIC(5,4),
  compression_status      TEXT   NOT NULL DEFAULT 'not_attempted'
                            CHECK (compression_status IN (
                              'not_attempted','processing','compressed',
                              'skipped','failed','not_smaller'
                            )),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: set DEFAULT on user_id so it is auto-filled from session
ALTER TABLE contract_documents ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Step 3: enable RLS (idempotent)
ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;

-- Step 4: drop old policy (in case it exists without WITH CHECK)
DROP POLICY IF EXISTS "contract_docs_own" ON contract_documents;

-- Step 5: recreate with both USING + WITH CHECK
CREATE POLICY "contract_docs_own" ON contract_documents
  FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 6: indexes (safe if already exist)
CREATE INDEX IF NOT EXISTS idx_contract_docs_contract ON contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_docs_lessor   ON contract_documents(lessor_id);
CREATE INDEX IF NOT EXISTS idx_contract_docs_user     ON contract_documents(user_id);
