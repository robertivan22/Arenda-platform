-- =================================================================
-- PHASE 1 MIGRATION — Agricultural Lease Platform
-- Run this entire script in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS)
-- =================================================================

-- ─── 1. COMPANY SETTINGS (one row per user = furnizor pe facturi) ────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT '',
  cif             text NOT NULL DEFAULT '',
  reg_com         text NOT NULL DEFAULT '',
  address         text NOT NULL DEFAULT '',
  county          text NOT NULL DEFAULT '',
  locality        text NOT NULL DEFAULT '',
  iban            text NOT NULL DEFAULT '',
  bank_name       text NOT NULL DEFAULT '',
  phone           text NOT NULL DEFAULT '',
  email           text NOT NULL DEFAULT '',
  invoice_series  text NOT NULL DEFAULT 'A',
  invoice_counter integer NOT NULL DEFAULT 0,
  aviz_counter    integer NOT NULL DEFAULT 0,
  logo_url        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ─── 2. PRODUCTS (configurable per user — Grau, Porumb, RON, etc.) ──────────
CREATE TABLE IF NOT EXISTS products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  unit        text NOT NULL DEFAULT 'kg',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. CONTRACT RENT LEVELS (niveluri arenda per contract) ──────────────────
CREATE TABLE IF NOT EXISTS contract_rent_levels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id  uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  level_per_ha numeric(12,4) NOT NULL DEFAULT 0,
  level_type   text NOT NULL DEFAULT 'NET' CHECK (level_type IN ('BRUT','NET')),
  tax_rate     numeric(5,2) NOT NULL DEFAULT 10,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. TRANSACTIONS (tranzactii detaliate — inlocuieste payments) ───────────
CREATE TABLE IF NOT EXISTS transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id      uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  lessor_id        uuid REFERENCES lessors(id) ON DELETE SET NULL,
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name     text NOT NULL DEFAULT '',
  campaign_year    integer NOT NULL,
  transaction_date date NOT NULL,
  kg_brut          numeric(12,4) NOT NULL DEFAULT 0,
  kg_net           numeric(12,4) NOT NULL DEFAULT 0,
  price_per_unit   numeric(10,4) NOT NULL DEFAULT 0,
  ron_brut         numeric(14,2) NOT NULL DEFAULT 0,
  ron_net          numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(14,2) NOT NULL DEFAULT 0,
  payment_type     text NOT NULL DEFAULT 'Proces Verbal',
  pv_number        text,
  is_previzionata  boolean NOT NULL DEFAULT false,
  invoice_id       uuid,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. CONTRACT AMENDMENTS (acte aditionale) ────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_amendments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id  uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  number       text NOT NULL DEFAULT '',
  sign_date    date,
  description  text,
  file_url     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 6. PROPERTY DEEDS (acte de proprietate — atasate la parcele/contracte) ──
CREATE TABLE IF NOT EXISTS property_deeds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id    uuid REFERENCES parcels(id) ON DELETE CASCADE,
  contract_id  uuid REFERENCES contracts(id) ON DELETE CASCADE,
  deed_nr      text,
  deed_date    date,
  deed_type    text NOT NULL DEFAULT 'Titlu proprietate',
  file_url     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 7. INVOICES (facturi si avize generate) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lessor_id       uuid REFERENCES lessors(id) ON DELETE SET NULL,
  invoice_number  text NOT NULL,
  invoice_series  text NOT NULL DEFAULT 'A',
  invoice_date    date NOT NULL,
  due_date        date,
  total_ron       numeric(14,2) NOT NULL DEFAULT 0,
  tva_amount      numeric(14,2) NOT NULL DEFAULT 0,
  tva_rate        numeric(5,2) NOT NULL DEFAULT 9,
  doc_type        text NOT NULL DEFAULT 'FACTURA' CHECK (doc_type IN ('FACTURA','AVIZ')),
  status          text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINAL')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── ALTER EXISTING TABLES ───────────────────────────────────────────────────

-- Contracts: fields from ISAGRI
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS primarie_nr    text,
  ADD COLUMN IF NOT EXISTS primarie_date  date,
  ADD COLUMN IF NOT EXISTS tax_method     text NOT NULL DEFAULT 'COTA_FORFETARA',
  ADD COLUMN IF NOT EXISTS localities     text;

-- Company settings: logo
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Parcels: extended ISAGRI fields
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS cadastral_nr  text,
  ADD COLUMN IF NOT EXISTS neighbor_n    text,
  ADD COLUMN IF NOT EXISTS neighbor_s    text,
  ADD COLUMN IF NOT EXISTS neighbor_e    text,
  ADD COLUMN IF NOT EXISTS neighbor_w    text,
  ADD COLUMN IF NOT EXISTS former_owner  text,
  ADD COLUMN IF NOT EXISTS sola_nr       text,
  ADD COLUMN IF NOT EXISTS popular_name  text,
  ADD COLUMN IF NOT EXISTS apia_parcel   text,
  ADD COLUMN IF NOT EXISTS use_mode      text,
  ADD COLUMN IF NOT EXISTS entity_name   text,
  ADD COLUMN IF NOT EXISTS sub_gaj       boolean NOT NULL DEFAULT false;

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS crl_contract_idx     ON contract_rent_levels(contract_id);
CREATE INDEX IF NOT EXISTS crl_product_idx      ON contract_rent_levels(product_id);
CREATE INDEX IF NOT EXISTS txn_contract_idx     ON transactions(contract_id);
CREATE INDEX IF NOT EXISTS txn_lessor_idx       ON transactions(lessor_id);
CREATE INDEX IF NOT EXISTS txn_year_idx         ON transactions(campaign_year);
CREATE INDEX IF NOT EXISTS txn_invoice_idx      ON transactions(invoice_id);
CREATE INDEX IF NOT EXISTS inv_lessor_idx        ON invoices(lessor_id);
CREATE INDEX IF NOT EXISTS amend_contract_idx   ON contract_amendments(contract_id);
CREATE INDEX IF NOT EXISTS deed_parcel_idx      ON property_deeds(parcel_id);
CREATE INDEX IF NOT EXISTS deed_contract_idx    ON property_deeds(contract_id);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE company_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_rent_levels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_amendments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_deeds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices              ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (safe re-run)
DROP POLICY IF EXISTS "cs_user"   ON company_settings;
DROP POLICY IF EXISTS "prod_user" ON products;
DROP POLICY IF EXISTS "crl_user"  ON contract_rent_levels;
DROP POLICY IF EXISTS "txn_user"  ON transactions;
DROP POLICY IF EXISTS "amend_user" ON contract_amendments;
DROP POLICY IF EXISTS "deed_user" ON property_deeds;
DROP POLICY IF EXISTS "inv_user"  ON invoices;

CREATE POLICY "cs_user"    ON company_settings    FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "prod_user"  ON products             FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "crl_user"   ON contract_rent_levels FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "txn_user"   ON transactions         FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "amend_user" ON contract_amendments  FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "deed_user"  ON property_deeds       FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "inv_user"   ON invoices             FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- =================================================================
-- DONE. 7 new tables + alterations to contracts + parcels.
-- =================================================================
