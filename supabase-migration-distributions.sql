-- ─── Product Distribution Tracker ───────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor

-- 1. parcel_transactions — total allocation per product per contract
CREATE TABLE IF NOT EXISTS parcel_transactions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id     UUID          NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  product_type    TEXT          NOT NULL,
  total_quantity  NUMERIC(12,4) NOT NULL CHECK (total_quantity > 0),
  quantity_unit   TEXT          NOT NULL DEFAULT 'kg',
  campaign_year   INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parcel_transactions_contract_idx ON parcel_transactions(contract_id);
CREATE INDEX IF NOT EXISTS parcel_transactions_user_idx    ON parcel_transactions(user_id);

ALTER TABLE parcel_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcel_transactions_owner"
  ON parcel_transactions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. transaction_distributions — individual deliveries, soft-deletable
CREATE TABLE IF NOT EXISTS transaction_distributions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id    UUID          NOT NULL REFERENCES parcel_transactions(id) ON DELETE CASCADE,
  lessor_id         UUID          REFERENCES lessors(id),
  quantity_given    NUMERIC(12,4) NOT NULL CHECK (quantity_given > 0),
  distribution_date DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  deleted_at        TIMESTAMPTZ,                         -- soft delete
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transaction_distributions_txn_idx    ON transaction_distributions(transaction_id);
CREATE INDEX IF NOT EXISTS transaction_distributions_lessor_idx ON transaction_distributions(lessor_id);
CREATE INDEX IF NOT EXISTS transaction_distributions_user_idx   ON transaction_distributions(user_id);

ALTER TABLE transaction_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transaction_distributions_owner"
  ON transaction_distributions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Helper function: compute remaining quantity for a parcel_transaction
CREATE OR REPLACE FUNCTION remaining_quantity(p_transaction_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT pt.total_quantity
       - COALESCE(
           SUM(td.quantity_given) FILTER (WHERE td.deleted_at IS NULL),
           0
         )
  FROM parcel_transactions pt
  LEFT JOIN transaction_distributions td ON td.transaction_id = pt.id
  WHERE pt.id = p_transaction_id
  GROUP BY pt.total_quantity;
$$;

-- 4. Trigger to prevent over-distribution at DB level
CREATE OR REPLACE FUNCTION check_distribution_qty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  available NUMERIC;
BEGIN
  -- For UPDATE: pretend the old row hasn't been counted yet
  SELECT pt.total_quantity
       - COALESCE(
           SUM(td.quantity_given) FILTER (WHERE td.deleted_at IS NULL AND td.id <> COALESCE(NEW.id, gen_random_uuid())),
           0
         )
  INTO available
  FROM parcel_transactions pt
  LEFT JOIN transaction_distributions td ON td.transaction_id = pt.id
  WHERE pt.id = NEW.transaction_id
  GROUP BY pt.total_quantity;

  IF available IS NULL THEN
    RAISE EXCEPTION 'Tranzacție negăsită.';
  END IF;

  IF available < NEW.quantity_given THEN
    RAISE EXCEPTION 'Cantitate insuficientă. Disponibil: % unități.', available;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_dist_qty ON transaction_distributions;
CREATE TRIGGER trg_check_dist_qty
  BEFORE INSERT OR UPDATE OF quantity_given, deleted_at ON transaction_distributions
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION check_distribution_qty();

-- 5. Auto-update updated_at on parcel_transactions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_pt_updated_at ON parcel_transactions;
CREATE TRIGGER trg_pt_updated_at
  BEFORE UPDATE ON parcel_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
