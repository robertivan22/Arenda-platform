-- ============================================================
-- Migration: ArendaPro Feature Release 2026-05-29
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add is_paid to transactions (Plăți restante tracking)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

-- 2. Add cultura fields to parcele_fitosanitar (save cultures to DB)
ALTER TABLE parcele_fitosanitar ADD COLUMN IF NOT EXISTS cultura_label TEXT;
ALTER TABLE parcele_fitosanitar ADD COLUMN IF NOT EXISTS cultura_color TEXT;

-- 3. Fix invoice status check constraint to allow EMISA, PLATITA, STORNATA
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('DRAFT', 'EMISA', 'PLATITA', 'STORNATA'));

-- 4. Add D112 Asigurat (Anexa 1.2) fields to company_settings
--    These are per-company default values for the insured person declaration
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_cnp TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_cnp_anterior TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_nume TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_prenume TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_nume_anterior TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_prenume_anterior TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_data_ang DATE;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_data_sf DATE;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_cis TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_casa_sn TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_ci TEXT DEFAULT '1';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_so TEXT DEFAULT '1';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_scu TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_exc TEXT DEFAULT '0';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_motiv_exc TEXT;

-- 5. Keep old CAS fields (still valid for company contract with CAS)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_denumire_cas TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_nr_contract_cas TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_data_contract_cas DATE;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_cont_plata TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_banca_plata TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS asig_cod_unic TEXT;

-- ============================================================
-- Optional: index on is_paid for dashboard query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_is_paid ON transactions(user_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_transactions_is_previzionata ON transactions(contract_id, is_previzionata);
