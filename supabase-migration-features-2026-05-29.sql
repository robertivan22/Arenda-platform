-- ============================================================
-- Migration: ArendaPro Feature Release 2026-05-29
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add is_paid to transactions (Plăți restante tracking)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

-- 2. Add cultura fields to parcele_fitosanitar (save cultures to DB)
ALTER TABLE parcele_fitosanitar ADD COLUMN IF NOT EXISTS cultura_label TEXT;
ALTER TABLE parcele_fitosanitar ADD COLUMN IF NOT EXISTS cultura_color TEXT;

-- 3. Add asigurat/asigurator D112 fields to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_denumire_cas TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_nr_contract_cas TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_data_contract_cas DATE;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_cont_plata TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_banca_plata TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_cod_unic TEXT;

-- 4. Make existing DRAFT invoices queryable by status (already have status column)
-- No migration needed — invoices.status already exists

-- ============================================================
-- Optional: index on is_paid for dashboard query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_is_paid ON transactions(user_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_transactions_is_previzionata ON transactions(contract_id, is_previzionata);
