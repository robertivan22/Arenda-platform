-- ============================================================
-- Migration: Distribuire Arendă (ArendaPro)
-- Tables: crop_prices, arenda_conversions, admin_audit_log
-- RPC: execute_arenda_distribution (atomic)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. CROP PRICES
-- Stores MADR reference prices and user-defined manual prices.
-- Latest row per (user_id, crop_name) with a given source is used.
CREATE TABLE IF NOT EXISTS crop_prices (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = system MADR default
  crop_name       TEXT          NOT NULL,
  price_per_kg    NUMERIC(10,4) NOT NULL CHECK (price_per_kg > 0),
  source          TEXT          NOT NULL DEFAULT 'MADR' CHECK (source IN ('MADR', 'MANUAL')),
  effective_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_prices_user_crop ON crop_prices(user_id, crop_name);
CREATE INDEX IF NOT EXISTS idx_crop_prices_date ON crop_prices(effective_date DESC);

ALTER TABLE crop_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crop_prices_read" ON crop_prices;
CREATE POLICY "crop_prices_read"
  ON crop_prices FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "crop_prices_write" ON crop_prices;
CREATE POLICY "crop_prices_write"
  ON crop_prices FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Seed MADR reference prices (Feb 2024 reference – user can update)
INSERT INTO crop_prices (user_id, crop_name, price_per_kg, source, effective_date, notes) VALUES
  (NULL, 'Porumb',            0.85, 'MADR', '2024-02-01', 'MADR Feb 2024'),
  (NULL, 'Grâu',              1.20, 'MADR', '2024-02-01', 'MADR Feb 2024'),
  (NULL, 'Floarea-soarelui',  2.18, 'MADR', '2024-02-01', 'MADR Feb 2024'),
  (NULL, 'Soia',              1.82, 'MADR', '2024-02-01', 'MADR Feb 2024'),
  (NULL, 'Rapiță',            2.44, 'MADR', '2024-02-01', 'MADR Feb 2024'),
  (NULL, 'Orz',               0.93, 'MADR', '2024-02-01', 'MADR Feb 2024')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. ARENDA CONVERSIONS
-- Tracks each distribution event: crop-to-crop conversion.
-- ============================================================
CREATE TABLE IF NOT EXISTS arenda_conversions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lessor_id           UUID          NOT NULL REFERENCES lessors(id) ON DELETE RESTRICT,
  contract_id         UUID          NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  campaign_id         UUID          REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Source crop (what we distribute from contract)
  from_crop_name      TEXT          NOT NULL,
  from_quantity_kg    NUMERIC(12,4) NOT NULL CHECK (from_quantity_kg > 0),
  from_price_per_kg   NUMERIC(10,4) NOT NULL CHECK (from_price_per_kg > 0),

  -- Destination crop (what lessor receives)
  to_crop_name        TEXT          NOT NULL,
  to_quantity_kg      NUMERIC(12,4) NOT NULL CHECK (to_quantity_kg > 0),
  to_price_per_kg     NUMERIC(10,4) NOT NULL CHECK (to_price_per_kg > 0),

  -- Derived values (stored for reporting)
  conversion_rate     NUMERIC(12,6) NOT NULL,
  value_ron           NUMERIC(14,2) NOT NULL CHECK (value_ron > 0),

  -- Logistics
  delivery_method     TEXT          NOT NULL CHECK (delivery_method IN ('siloz', 'livrare_ferma', 'transfer_bancar')),
  distribution_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes               TEXT,
  status              TEXT          NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'draft', 'cancelled')),

  -- Back-link to transactions table entry
  transaction_id      UUID          REFERENCES transactions(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arenda_conv_user     ON arenda_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_arenda_conv_lessor   ON arenda_conversions(lessor_id);
CREATE INDEX IF NOT EXISTS idx_arenda_conv_contract ON arenda_conversions(contract_id);
CREATE INDEX IF NOT EXISTS idx_arenda_conv_campaign ON arenda_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_arenda_conv_date     ON arenda_conversions(distribution_date DESC);

ALTER TABLE arenda_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arenda_conv_owner" ON arenda_conversions;
CREATE POLICY "arenda_conv_owner"
  ON arenda_conversions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_arenda_conv_updated_at ON arenda_conversions;
CREATE TRIGGER trg_arenda_conv_updated_at
  BEFORE UPDATE ON arenda_conversions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. ADMIN AUDIT LOG
-- Append-only log of all significant user actions.
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  table_name  TEXT,
  record_id   TEXT,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user    ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit log; writes happen via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "audit_log_read" ON admin_audit_log;
CREATE POLICY "audit_log_read"
  ON admin_audit_log FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 4. ATOMIC RPC: execute_arenda_distribution
-- Inserts arenda_conversion + transaction + audit log in one
-- database transaction. Rolls back fully on any error.
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_arenda_distribution(
  p_user_id           UUID,
  p_lessor_id         UUID,
  p_contract_id       UUID,
  p_campaign_id       UUID,
  p_from_crop_name    TEXT,
  p_from_quantity_kg  NUMERIC,
  p_from_price_per_kg NUMERIC,
  p_to_crop_name      TEXT,
  p_to_quantity_kg    NUMERIC,
  p_to_price_per_kg   NUMERIC,
  p_conversion_rate   NUMERIC,
  p_value_ron         NUMERIC,
  p_delivery_method   TEXT,
  p_distribution_date DATE,
  p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion_id  UUID;
  v_transaction_id UUID;
  v_campaign_year  INTEGER;
  v_distributed_kg NUMERIC;
  v_total_kg       NUMERIC;
BEGIN
  -- ── Security check ──────────────────────────────────────────
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  -- ── Derive campaign year ─────────────────────────────────────
  v_campaign_year := EXTRACT(YEAR FROM p_distribution_date)::INTEGER;

  -- ── Guard: check remaining quantity from contract ────────────
  SELECT COALESCE(SUM(from_quantity_kg), 0)
    INTO v_distributed_kg
    FROM arenda_conversions
   WHERE contract_id = p_contract_id
     AND from_crop_name = p_from_crop_name
     AND status = 'confirmed'
     AND user_id = p_user_id;

  SELECT COALESCE(SUM(pt.total_quantity), 0)
    INTO v_total_kg
    FROM parcel_transactions pt
   WHERE pt.contract_id = p_contract_id
     AND pt.product_type = p_from_crop_name
     AND pt.user_id = p_user_id;

  -- Only enforce if parcel_transactions data exists for this crop
  IF v_total_kg > 0 AND (v_distributed_kg + p_from_quantity_kg) > v_total_kg THEN
    RAISE EXCEPTION 'Cantitate insuficientă. Disponibil: % kg, solicitat: % kg.',
      (v_total_kg - v_distributed_kg), p_from_quantity_kg;
  END IF;

  -- ── 1. Insert transaction record ─────────────────────────────
  INSERT INTO transactions (
    user_id, contract_id, lessor_id,
    product_name, campaign_year, transaction_date,
    kg_brut, kg_net, price_per_unit,
    ron_brut, ron_net, tax_amount,
    payment_type, notes, campaign_id, is_paid
  )
  SELECT
    p_user_id, p_contract_id, p_lessor_id,
    p_to_crop_name, v_campaign_year, p_distribution_date,
    p_to_quantity_kg, p_to_quantity_kg, p_to_price_per_kg,
    p_value_ron, p_value_ron, 0,
    'Distribuire Arendă', p_notes, p_campaign_id, TRUE
  RETURNING id INTO v_transaction_id;

  -- ── 2. Insert arenda conversion ──────────────────────────────
  INSERT INTO arenda_conversions (
    user_id, lessor_id, contract_id, campaign_id,
    from_crop_name, from_quantity_kg, from_price_per_kg,
    to_crop_name, to_quantity_kg, to_price_per_kg,
    conversion_rate, value_ron,
    delivery_method, distribution_date, notes,
    status, transaction_id
  ) VALUES (
    p_user_id, p_lessor_id, p_contract_id, p_campaign_id,
    p_from_crop_name, p_from_quantity_kg, p_from_price_per_kg,
    p_to_crop_name, p_to_quantity_kg, p_to_price_per_kg,
    p_conversion_rate, p_value_ron,
    p_delivery_method, p_distribution_date, p_notes,
    'confirmed', v_transaction_id
  )
  RETURNING id INTO v_conversion_id;

  -- ── 3. Audit log ─────────────────────────────────────────────
  INSERT INTO admin_audit_log (user_id, action, table_name, record_id, metadata)
  VALUES (
    p_user_id, 'DISTRIBUTION_EXECUTED', 'arenda_conversions',
    v_conversion_id::TEXT,
    jsonb_build_object(
      'lessor_id',      p_lessor_id,
      'contract_id',    p_contract_id,
      'from_crop',      p_from_crop_name,
      'from_qty_kg',    p_from_quantity_kg,
      'to_crop',        p_to_crop_name,
      'to_qty_kg',      p_to_quantity_kg,
      'value_ron',      p_value_ron,
      'delivery',       p_delivery_method,
      'date',           p_distribution_date
    )
  );

  RETURN jsonb_build_object(
    'conversion_id',  v_conversion_id,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Revoke direct public execute; called only via authenticated RPC
REVOKE EXECUTE ON FUNCTION public.execute_arenda_distribution FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.execute_arenda_distribution TO authenticated;

-- ============================================================
-- DONE.
-- Run this migration, then deploy the TypeScript components.
-- ============================================================
