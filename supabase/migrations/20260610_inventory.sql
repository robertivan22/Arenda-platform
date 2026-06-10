-- ============================================================
-- ArendaPro — Inventory Domain Migration
-- Phase 1: suppliers, input_lots, warehouses, input_stock_mvt
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Suppliers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  cui         TEXT,
  address     TEXT,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'suppliers_owner'
  ) THEN
    CREATE POLICY "suppliers_owner" ON suppliers
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ── Input lots ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS input_lots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id         UUID        REFERENCES suppliers(id) ON DELETE SET NULL,
  category            TEXT        NOT NULL
                        CHECK (category IN ('SEED','FERTILIZER','PPP','FUEL','OTHER')),
  product_name        TEXT        NOT NULL,
  unit                TEXT        NOT NULL DEFAULT 'kg',
  quantity            NUMERIC(12,3) NOT NULL CHECK (quantity >= 0),
  quantity_available  NUMERIC(12,3) NOT NULL CHECK (quantity_available >= 0),
  unit_price          NUMERIC(10,4),
  batch_number        TEXT,
  expiry_date         DATE,
  received_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  invoice_ref         TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE input_lots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'input_lots' AND policyname = 'input_lots_owner'
  ) THEN
    CREATE POLICY "input_lots_owner" ON input_lots
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ── Warehouses ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  location    TEXT,
  notes       TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'warehouses' AND policyname = 'warehouses_owner'
  ) THEN
    CREATE POLICY "warehouses_owner" ON warehouses
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ── Stock movements ────────────────────────────────────────
-- Note: work_order_id, parcel_id, campaign_id are soft FKs
-- (no ON DELETE CASCADE) so archiving never breaks history.
CREATE TABLE IF NOT EXISTS input_stock_mvt (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lot_id          UUID        NOT NULL REFERENCES input_lots(id) ON DELETE RESTRICT,
  warehouse_id    UUID        REFERENCES warehouses(id) ON DELETE SET NULL,
  work_order_id   UUID,
  parcel_id       UUID,
  campaign_id     UUID,
  mvt_type        TEXT        NOT NULL
                    CHECK (mvt_type IN ('IN','OUT','TRANSFER','ADJUSTMENT')),
  quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  mvt_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE input_stock_mvt ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'input_stock_mvt' AND policyname = 'stock_mvt_owner'
  ) THEN
    CREATE POLICY "stock_mvt_owner" ON input_stock_mvt
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ── Trigger: maintain quantity_available on input_lots ─────
CREATE OR REPLACE FUNCTION update_lot_quantity_available()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.mvt_type IN ('IN', 'ADJUSTMENT') THEN
    UPDATE input_lots
    SET quantity_available = quantity_available + NEW.quantity
    WHERE id = NEW.lot_id;
  ELSIF NEW.mvt_type = 'OUT' THEN
    UPDATE input_lots
    SET quantity_available = quantity_available - NEW.quantity
    WHERE id = NEW.lot_id;
  -- TRANSFER: handled at application level (OUT from source, IN to dest)
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_lot_qty ON input_stock_mvt;
CREATE TRIGGER trg_update_lot_qty
  AFTER INSERT ON input_stock_mvt
  FOR EACH ROW EXECUTE FUNCTION update_lot_quantity_available();

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_input_lots_user    ON input_lots (user_id, category);
CREATE INDEX IF NOT EXISTS idx_stock_mvt_lot      ON input_stock_mvt (lot_id);
CREATE INDEX IF NOT EXISTS idx_stock_mvt_campaign ON input_stock_mvt (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_mvt_parcel   ON input_stock_mvt (parcel_id) WHERE parcel_id IS NOT NULL;

-- ── Convenience view: current stock by product ────────────
CREATE OR REPLACE VIEW v_input_stock AS
SELECT
  il.id,
  il.user_id,
  il.category,
  il.product_name,
  il.unit,
  il.quantity_available,
  il.unit_price,
  il.batch_number,
  il.expiry_date,
  il.received_date,
  s.name AS supplier_name
FROM input_lots il
LEFT JOIN suppliers s ON s.id = il.supplier_id
WHERE il.quantity_available > 0;
