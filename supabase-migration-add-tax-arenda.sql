-- ─── Add tax support to arenda_conversions + update RPC ──────────────────────
--
-- Romanian Fiscal Code art. 84: rent income (venituri din arendă) taxed at
-- 10% flat rate, withheld at source by the payer (arendaș). Net = Gross × 90%.
--
-- Run this AFTER supabase-migration-fix-rpc-availability.sql

-- ── 1. Add tax columns to arenda_conversions ──────────────────────────────────
ALTER TABLE arenda_conversions
  ADD COLUMN IF NOT EXISTS tax_applied   BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_rate      NUMERIC(5,2)   NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS tax_amount    NUMERIC(14,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS value_ron_net NUMERIC(14,2);

-- Back-fill value_ron_net for existing rows (no tax was applied)
UPDATE arenda_conversions
   SET value_ron_net = value_ron
 WHERE value_ron_net IS NULL;

-- Make NOT NULL after back-fill
ALTER TABLE arenda_conversions
  ALTER COLUMN value_ron_net SET NOT NULL,
  ALTER COLUMN value_ron_net SET DEFAULT 0;

-- ── 2. Update execute_arenda_distribution RPC with tax + availability fix ─────

-- Drop old signature first (parameter names changed)
DROP FUNCTION IF EXISTS execute_arenda_distribution(uuid,uuid,uuid,text,numeric,text,numeric,numeric,numeric,numeric,numeric,text,date,text,uuid,boolean,numeric);
DROP FUNCTION IF EXISTS execute_arenda_distribution(uuid,uuid,uuid,text,numeric,text,numeric,numeric,numeric,numeric,numeric,text,date,text,boolean,numeric);

CREATE OR REPLACE FUNCTION execute_arenda_distribution(
  p_contract_id       UUID,
  p_lessor_id         UUID,
  p_user_id           UUID,
  p_from_crop_name       TEXT,
  p_from_quantity_kg     NUMERIC,
  p_to_crop_name         TEXT,
  p_to_quantity_kg       NUMERIC,
  p_from_price_per_kg    NUMERIC,
  p_to_price_per_kg      NUMERIC,
  p_conversion_rate      NUMERIC,
  p_value_ron            NUMERIC,
  p_delivery_method      TEXT,
  p_distribution_date    DATE,
  p_notes                TEXT    DEFAULT NULL,
  p_campaign_id          UUID    DEFAULT NULL,
  -- Tax parameters
  p_tax_applied          BOOLEAN DEFAULT FALSE,
  p_tax_rate             NUMERIC DEFAULT 10.00
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available       NUMERIC;
  v_pt_total        NUMERIC;
  v_da_used         NUMERIC;
  v_direct_used     NUMERIC;
  v_conversion_id   UUID;
  v_transaction_id  UUID;
  v_campaign_year   INT;
  v_tax_amount      NUMERIC;
  v_value_ron_net   NUMERIC;
BEGIN
  -- ── 1. Campaign year ────────────────────────────────────────────────────
  v_campaign_year := EXTRACT(YEAR FROM p_distribution_date)::INT;

  -- ── 2. Tax calculation ──────────────────────────────────────────────────
  v_tax_amount    := CASE WHEN p_tax_applied THEN ROUND(p_value_ron * p_tax_rate / 100, 2) ELSE 0 END;
  v_value_ron_net := p_value_ron - v_tax_amount;

  -- ── 3. Availability check (direct_txns + DA_conversions + new request ≤ total) ──
  SELECT COALESCE(SUM(total_quantity), 0)
    INTO v_pt_total
    FROM parcel_transactions
   WHERE contract_id = p_contract_id
     AND product_type = p_from_crop_name;

  SELECT COALESCE(SUM(from_quantity_kg), 0)
    INTO v_da_used
    FROM arenda_conversions
   WHERE contract_id = p_contract_id
     AND from_crop_name = p_from_crop_name
     AND status = 'confirmed';

  SELECT COALESCE(SUM(kg_net), 0)
    INTO v_direct_used
    FROM transactions
   WHERE contract_id = p_contract_id
     AND product_name = p_from_crop_name
     AND is_previzionata = FALSE
     AND payment_type <> 'Distribuire Arendă';

  v_available := v_pt_total - v_da_used - v_direct_used;

  IF v_available < p_from_quantity_kg THEN
    RETURN json_build_object(
      'success', FALSE,
      'error',   format(
        'Cantitate insuficientă. Disponibil: %s kg, solicitat: %s kg.',
        ROUND(v_available, 2), ROUND(p_from_quantity_kg, 2)
      )
    );
  END IF;

  -- ── 4. Insert arenda_conversion ─────────────────────────────────────────
  INSERT INTO arenda_conversions (
    user_id, contract_id, lessor_id, campaign_id,
    from_crop_name, from_quantity_kg, from_price_per_kg,
    to_crop_name,   to_quantity_kg,   to_price_per_kg,
    conversion_rate, value_ron,
    tax_applied, tax_rate, tax_amount, value_ron_net,
    delivery_method, distribution_date, notes, status
  ) VALUES (
    p_user_id, p_contract_id, p_lessor_id, p_campaign_id,
    p_from_crop_name, p_from_quantity_kg, p_from_price_per_kg,
    p_to_crop_name,   p_to_quantity_kg,   p_to_price_per_kg,
    p_conversion_rate, p_value_ron,
    p_tax_applied, p_tax_rate, v_tax_amount, v_value_ron_net,
    p_delivery_method, p_distribution_date, p_notes, 'confirmed'
  )
  RETURNING id INTO v_conversion_id;

  -- ── 5. Insert TO_crop transaction ───────────────────────────────────────
  --   ron_brut = gross value, ron_net = after-tax value, tax_amount populated
  INSERT INTO transactions (
    user_id, contract_id, lessor_id,
    transaction_date, campaign_year,
    product_name, kg_brut, kg_net,
    price_per_unit, ron_brut, ron_net,
    tax_amount, payment_type,
    is_previzionata, impozit_aplicat, notes
  ) VALUES (
    p_user_id, p_contract_id, p_lessor_id,
    p_distribution_date, v_campaign_year,
    p_to_crop_name, p_to_quantity_kg, p_to_quantity_kg,
    p_to_price_per_kg,
    p_value_ron,      -- gross
    v_value_ron_net,  -- net (= gross when no tax)
    v_tax_amount,
    'Distribuire Arendă',
    FALSE, p_tax_applied,
    COALESCE(p_notes, 'Distribuire din ' || p_from_crop_name)
  )
  RETURNING id INTO v_transaction_id;

  -- ── 6. Link conversion → transaction ────────────────────────────────────
  UPDATE arenda_conversions
     SET transaction_id = v_transaction_id
   WHERE id = v_conversion_id;

  -- ── 7. Audit log ────────────────────────────────────────────────────────
  INSERT INTO admin_audit_log (user_id, action, table_name, record_id, details)
  VALUES (
    p_user_id, 'ARENDA_DISTRIBUTION', 'arenda_conversions', v_conversion_id,
    json_build_object(
      'from_crop',     p_from_crop_name,
      'from_qty',      p_from_quantity_kg,
      'to_crop',       p_to_crop_name,
      'to_qty',        p_to_quantity_kg,
      'value_ron',     p_value_ron,
      'tax_applied',   p_tax_applied,
      'tax_rate',      p_tax_rate,
      'tax_amount',    v_tax_amount,
      'value_ron_net', v_value_ron_net,
      'contract_id',   p_contract_id,
      'available_was', v_available
    )
  );

  RETURN json_build_object(
    'success',        TRUE,
    'conversion_id',  v_conversion_id,
    'transaction_id', v_transaction_id,
    'tax_amount',     v_tax_amount,
    'value_ron_net',  v_value_ron_net
  );
END;
$$;
