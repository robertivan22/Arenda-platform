-- =============================================================================
-- ArendaPro – Supabase schema + RLS policies
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =============================================================================

-- ─── TABLES (create if not exist) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lessors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code         text,
  type         text NOT NULL CHECK (type IN ('NATURAL','LEGAL','PFA')),
  first_name   text NOT NULL DEFAULT '',
  last_name    text NOT NULL DEFAULT '',
  company_name text,
  cnp          text NOT NULL DEFAULT '',   -- 13-digit CNP or CUI
  gender       text CHECK (gender IN ('MALE','FEMALE')),
  county       text NOT NULL DEFAULT '',
  locality     text NOT NULL DEFAULT '',
  address      text,
  phone        text,
  mobile       text,
  email        text,
  iban         text,
  bank_name    text,
  notes        text,
  status       text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lessor_id       uuid REFERENCES lessors(id) ON DELETE SET NULL,
  contract_number text NOT NULL DEFAULT '',
  contract_type   text NOT NULL DEFAULT 'ARENDA',
  zone            text,
  sign_date       date,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  total_parcels   integer NOT NULL DEFAULT 0,
  annual_rent     numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','DRAFT')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_code         text,
  tarla_nr            text,
  parcel_nr           text,
  county              text NOT NULL DEFAULT '',
  locality            text NOT NULL DEFAULT '',
  land_use_category   text,
  surface             numeric(10,4) NOT NULL DEFAULT 0,
  surface_rented      numeric(10,4),
  lessor_id           uuid REFERENCES lessors(id) ON DELETE SET NULL,
  contract_id         uuid REFERENCES contracts(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'ACTIVE',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lessor_id       uuid REFERENCES lessors(id) ON DELETE SET NULL,
  contract_id     uuid REFERENCES contracts(id) ON DELETE SET NULL,
  contract_number text,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  due_date        date NOT NULL,
  paid_date       date,
  status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','OVERDUE')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── MIGRATE EXISTING TABLES (add missing snake_case columns) ─────────────────
-- Safe to run multiple times – ADD COLUMN IF NOT EXISTS is idempotent.
-- Needed when tables were created by the old NestJS backend with camelCase columns.

ALTER TABLE lessors
  ADD COLUMN IF NOT EXISTS user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS code         text,
  ADD COLUMN IF NOT EXISTS type         text,
  ADD COLUMN IF NOT EXISTS first_name   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS cnp          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender       text,
  ADD COLUMN IF NOT EXISTS county       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS locality     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS mobile       text,
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS iban         text,
  ADD COLUMN IF NOT EXISTS bank_name    text,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now();

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lessor_id       uuid,
  ADD COLUMN IF NOT EXISTS contract_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contract_type   text NOT NULL DEFAULT 'ARENDA',
  ADD COLUMN IF NOT EXISTS zone            text,
  ADD COLUMN IF NOT EXISTS sign_date       date,
  ADD COLUMN IF NOT EXISTS start_date      date,
  ADD COLUMN IF NOT EXISTS end_date        date,
  ADD COLUMN IF NOT EXISTS total_parcels   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_rent     numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parcel_code        text,
  ADD COLUMN IF NOT EXISTS tarla_nr           text,
  ADD COLUMN IF NOT EXISTS parcel_nr          text,
  ADD COLUMN IF NOT EXISTS county             text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS locality           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS land_use_category  text,
  ADD COLUMN IF NOT EXISTS surface            numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surface_rented     numeric(10,4),
  ADD COLUMN IF NOT EXISTS lessor_id          uuid,
  ADD COLUMN IF NOT EXISTS contract_id        uuid,
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS created_at         timestamptz NOT NULL DEFAULT now();

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lessor_id       uuid,
  ADD COLUMN IF NOT EXISTS contract_id     uuid,
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS amount          numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date        date,
  ADD COLUMN IF NOT EXISTS paid_date       date,
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS lessors_user_id_idx   ON lessors(user_id);
CREATE INDEX IF NOT EXISTS contracts_user_id_idx ON contracts(user_id);
CREATE INDEX IF NOT EXISTS parcels_user_id_idx   ON parcels(user_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx  ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx   ON payments(status);
CREATE INDEX IF NOT EXISTS payments_paid_date_idx ON payments(paid_date);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- CRITICAL: Each user sees and modifies ONLY their own rows.
-- Without RLS the anon key exposes all data to every authenticated user.

ALTER TABLE lessors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "lessors_own"   ON lessors;
DROP POLICY IF EXISTS "contracts_own" ON contracts;
DROP POLICY IF EXISTS "parcels_own"   ON parcels;
DROP POLICY IF EXISTS "payments_own"  ON payments;

CREATE POLICY "lessors_own"   ON lessors   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contracts_own" ON contracts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "parcels_own"   ON parcels   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payments_own"  ON payments  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── VERIFY ──────────────────────────────────────────────────────────────────
-- After running, check policies are active:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
