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
