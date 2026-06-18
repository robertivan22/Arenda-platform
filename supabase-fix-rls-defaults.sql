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
-- PostgreSQL requires an explicit WITH CHECK for INSERT to be enforced correctly.

DROP POLICY IF EXISTS "contract_docs_own" ON contract_documents;
CREATE POLICY "contract_docs_own" ON contract_documents
  FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Also set DEFAULT so INSERT works even if user_id is omitted on the client
ALTER TABLE contract_documents ALTER COLUMN user_id SET DEFAULT auth.uid();
