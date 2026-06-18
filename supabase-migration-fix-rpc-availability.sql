-- Fix execute_arenda_distribution RPC to use the correct availability formula:
-- available = parcel_transactions.total_quantity
--             − arenda_conversions.from_quantity_kg (confirmed, same contract+crop)
--             − transactions.kg_net (direct, non-DA, same contract+crop)
--
-- Previously it only subtracted arenda_conversions, meaning direct deliveries
-- were not accounted for, allowing over-distribution.

CREATE OR REPLACE FUNCTION execute_arenda_distribution(
  p_contract_id       UUID,
  p_lessor_id         UUID,
  p_user_id           UUID,
  p_from_crop_name    TEXT,
  p_from_quantity_kg  NUMERIC,
  p_to_crop_name      TEXT,
  p_to_quantity_kg    NUMERIC,
  p_price_from        NUMERIC,
  p_price_to          NUMERIC,
  p_conversion_rate   NUMERIC,
  p_value_ron         NUMERIC,
  p_delivery_method   TEXT,
  p_distribution_date DATE,
  p_notes             TEXT DEFAULT NULL
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
BEGIN
  -- ── 1. Resolve campaign year from distribution date ──────────────────────
  v_campaign_year := EXTRACT(YEAR FROM p_distribution_date)::INT;

  -- ── 2. Calculate available quantity (consistent with client-side) ────────
  --   parcel_transactions total for this contract+crop
  SELECT COALESCE(SUM(total_quantity), 0)
    INTO v_pt_total
    FROM parcel_transactions
   WHERE contract_id = p_contract_id
     AND product_type = p_from_crop_name;

  --   Already-consumed via DA conversions (confirmed)
  SELECT COALESCE(SUM(from_quantity_kg), 0)
    INTO v_da_used
    FROM arenda_conversions
   WHERE contract_id = p_contract_id
     AND from_crop_name = p_from_crop_name
     AND status = 'confirmed';

  --   Already-delivered via direct transactions (non-DA)
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
        ROUND(v_available, 2),
        ROUND(p_from_quantity_kg, 2)
      )
    );
  END IF;

  -- ── 3. Insert arenda_conversion record ───────────────────────────────────
  INSERT INTO arenda_conversions (
    user_id, contract_id, lessor_id,
    from_crop_name, from_quantity_kg, from_price_per_kg,
    to_crop_name,   to_quantity_kg,   to_price_per_kg,
    conversion_rate, value_ron,
    delivery_method, distribution_date, notes,
    status
  ) VALUES (
    p_user_id, p_contract_id, p_lessor_id,
    p_from_crop_name, p_from_quantity_kg, p_price_from,
    p_to_crop_name,   p_to_quantity_kg,   p_price_to,
    p_conversion_rate, p_value_ron,
    p_delivery_method, p_distribution_date, p_notes,
    'confirmed'
  )
  RETURNING id INTO v_conversion_id;

  -- ── 4. Insert TO_crop transaction (the landlord "receives" the to_crop) ──
  INSERT INTO transactions (
    user_id, contract_id, lessor_id,
    transaction_date, campaign_year,
    product_name, kg_brut, kg_net,
    price_per_unit, ron_brut, ron_net,
    tax_amount, payment_type,
    is_previzionata, impozit_aplicat,
    notes
  ) VALUES (
    p_user_id, p_contract_id, p_lessor_id,
    p_distribution_date, v_campaign_year,
    p_to_crop_name, p_to_quantity_kg, p_to_quantity_kg,
    p_price_to, p_value_ron, p_value_ron,
    0, 'Distribuire Arendă',
    FALSE, FALSE,
    COALESCE(p_notes, 'Distribuire din ' || p_from_crop_name)
  )
  RETURNING id INTO v_transaction_id;

  -- ── 5. Link conversion → transaction ─────────────────────────────────────
  UPDATE arenda_conversions
     SET transaction_id = v_transaction_id
   WHERE id = v_conversion_id;

  -- ── 6. Log to audit table ─────────────────────────────────────────────────
  INSERT INTO admin_audit_log (user_id, action, table_name, record_id, details)
  VALUES (
    p_user_id,
    'ARENDA_DISTRIBUTION',
    'arenda_conversions',
    v_conversion_id,
    json_build_object(
      'from_crop',     p_from_crop_name,
      'from_qty',      p_from_quantity_kg,
      'to_crop',       p_to_crop_name,
      'to_qty',        p_to_quantity_kg,
      'value_ron',     p_value_ron,
      'contract_id',   p_contract_id,
      'available_was', v_available
    )
  );

  RETURN json_build_object(
    'success',       TRUE,
    'conversion_id', v_conversion_id,
    'transaction_id', v_transaction_id
  );
END;
$$;
