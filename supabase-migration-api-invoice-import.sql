-- ─── Invoice Import + Stock Movements (Supabase) ────────────────────────────
-- snake_case columns — compatible with Supabase / PostgREST
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old camelCase tables if they were accidentally created
DROP TABLE IF EXISTS "purchase_invoice_items" CASCADE;
DROP TABLE IF EXISTS "purchase_invoices" CASCADE;
DROP TABLE IF EXISTS "product_aliases" CASCADE;
DROP TABLE IF EXISTS "stock_movements" CASCADE;

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE invoice_import_status AS ENUM (
    'uploaded', 'processing', 'ocr_completed',
    'needs_review', 'approved', 'posted_to_stock', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM (
    'matched', 'unmatched', 'new_product', 'ignored'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── purchase_invoices ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name         TEXT,
  supplier_tax_id       TEXT,
  supplier_reg_no       TEXT,
  supplier_address      TEXT,
  invoice_number        TEXT,
  invoice_date          DATE,
  due_date              DATE,
  currency              TEXT          NOT NULL DEFAULT 'RON',
  subtotal              NUMERIC(14,2),
  vat_total             NUMERIC(14,2),
  total                 NUMERIC(14,2),
  source_file_path      TEXT,
  searchable_pdf_path   TEXT,
  ocr_provider          TEXT          DEFAULT 'tesseract',
  raw_ocr_text          TEXT,
  raw_ocr_json          JSONB,
  status                invoice_import_status NOT NULL DEFAULT 'uploaded',
  error_message         TEXT,
  posted_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_user
  ON purchase_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status
  ON purchase_invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_dup
  ON purchase_invoices(user_id, supplier_tax_id, invoice_number);

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_invoices_own" ON purchase_invoices;
CREATE POLICY "purchase_invoices_own" ON purchase_invoices
  FOR ALL USING (user_id = auth.uid());

-- ── purchase_invoice_items ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID          NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  line_no         INTEGER       NOT NULL,
  product_id      UUID,
  extracted_name  TEXT          NOT NULL,
  normalized_name TEXT,
  sku             TEXT,
  quantity        NUMERIC(14,4),
  unit            TEXT,
  unit_price      NUMERIC(14,4),
  vat_rate        NUMERIC(5,2),
  vat_amount      NUMERIC(14,2),
  line_total      NUMERIC(14,2),
  confidence      NUMERIC(5,2),
  match_status    match_status  NOT NULL DEFAULT 'unmatched',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice
  ON purchase_invoice_items(invoice_id);

ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_invoice_items_own" ON purchase_invoice_items;
CREATE POLICY "purchase_invoice_items_own" ON purchase_invoice_items
  FOR ALL USING (
    invoice_id IN (SELECT id FROM purchase_invoices WHERE user_id = auth.uid())
  );

-- ── product_aliases ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_aliases (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id            UUID    NOT NULL,
  supplier_tax_id       TEXT,
  alias_name            TEXT    NOT NULL,
  normalized_alias_name TEXT    NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_aliases
  ON product_aliases(user_id, normalized_alias_name);
CREATE INDEX IF NOT EXISTS idx_product_aliases_product
  ON product_aliases(user_id, product_id);

ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_aliases_own" ON product_aliases;
CREATE POLICY "product_aliases_own" ON product_aliases
  FOR ALL USING (user_id = auth.uid());

-- ── stock_movements ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_movements (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id    UUID    NOT NULL,
  source_type   TEXT    NOT NULL,
  source_id     UUID    NOT NULL,
  movement_type stock_movement_type NOT NULL,
  quantity      NUMERIC(14,4) NOT NULL,
  unit_cost     NUMERIC(14,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON stock_movements(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_source
  ON stock_movements(source_type, source_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_movements_own" ON stock_movements;
CREATE POLICY "stock_movements_own" ON stock_movements
  FOR ALL USING (user_id = auth.uid());

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_invoices_updated_at ON purchase_invoices;
CREATE TRIGGER trg_purchase_invoices_updated_at
  BEFORE UPDATE ON purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_invoice_items_updated_at ON purchase_invoice_items;
CREATE TRIGGER trg_purchase_invoice_items_updated_at
  BEFORE UPDATE ON purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "InvoiceImportStatus" AS ENUM (
    'UPLOADED', 'PROCESSING', 'OCR_COMPLETED',
    'NEEDS_REVIEW', 'APPROVED', 'POSTED_TO_STOCK', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MatchStatus" AS ENUM (
    'MATCHED', 'UNMATCHED', 'NEW_PRODUCT', 'IGNORED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM (
    'IN', 'OUT', 'ADJUSTMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── purchase_invoices ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "purchase_invoices" (
  "id"                  TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "tenantId"            TEXT          NOT NULL,
  "supplierName"        TEXT,
  "supplierTaxId"       TEXT,
  "supplierRegNo"       TEXT,
  "supplierAddress"     TEXT,
  "invoiceNumber"       TEXT,
  "invoiceDate"         TIMESTAMPTZ,
  "dueDate"             TIMESTAMPTZ,
  "currency"            TEXT          DEFAULT 'RON',
  "subtotal"            DECIMAL(14,2),
  "vatTotal"            DECIMAL(14,2),
  "total"               DECIMAL(14,2),
  "sourceFilePath"      TEXT,
  "searchablePdfPath"   TEXT,
  "ocrProvider"         TEXT          DEFAULT 'tesseract',
  "rawOcrText"          TEXT,
  "rawOcrJson"          JSONB,
  "status"              "InvoiceImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "errorMessage"        TEXT,
  "createdBy"           TEXT,
  "postedAt"            TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "purchase_invoices_tenantId_idx"
  ON "purchase_invoices"("tenantId");
CREATE INDEX IF NOT EXISTS "purchase_invoices_tenantId_status_idx"
  ON "purchase_invoices"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "purchase_invoices_dup_idx"
  ON "purchase_invoices"("tenantId", "supplierTaxId", "invoiceNumber");

-- ── purchase_invoice_items ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "purchase_invoice_items" (
  "id"             TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "invoiceId"      TEXT          NOT NULL REFERENCES "purchase_invoices"("id") ON DELETE CASCADE,
  "lineNo"         INTEGER       NOT NULL,
  "productId"      TEXT,
  "extractedName"  TEXT          NOT NULL,
  "normalizedName" TEXT,
  "sku"            TEXT,
  "quantity"       DECIMAL(14,4),
  "unit"           TEXT,
  "unitPrice"      DECIMAL(14,4),
  "vatRate"        DECIMAL(5,2),
  "vatAmount"      DECIMAL(14,2),
  "lineTotal"      DECIMAL(14,2),
  "confidence"     DECIMAL(5,2),
  "matchStatus"    "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "createdAt"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "purchase_invoice_items_invoiceId_idx"
  ON "purchase_invoice_items"("invoiceId");

-- ── product_aliases ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "product_aliases" (
  "id"                   TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "tenantId"             TEXT    NOT NULL,
  "productId"            TEXT    NOT NULL,
  "supplierTaxId"        TEXT,
  "aliasName"            TEXT    NOT NULL,
  "normalizedAliasName"  TEXT    NOT NULL,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_aliases_tenant_alias_uq"
  ON "product_aliases"("tenantId", "normalizedAliasName");
CREATE INDEX IF NOT EXISTS "product_aliases_tenant_product_idx"
  ON "product_aliases"("tenantId", "productId");

-- ── stock_movements ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id"           TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "tenantId"     TEXT    NOT NULL,
  "productId"    TEXT    NOT NULL,
  "sourceType"   TEXT    NOT NULL,
  "sourceId"     TEXT    NOT NULL,
  "movementType" "StockMovementType" NOT NULL,
  "quantity"     DECIMAL(14,4) NOT NULL,
  "unitCost"     DECIMAL(14,4),
  "createdBy"    TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "stock_movements_tenant_product_idx"
  ON "stock_movements"("tenantId", "productId");
CREATE INDEX IF NOT EXISTS "stock_movements_source_idx"
  ON "stock_movements"("sourceType", "sourceId");

-- ── updatedAt trigger (optional but recommended) ──────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchase_invoices_updated_at ON "purchase_invoices";
CREATE TRIGGER purchase_invoices_updated_at
  BEFORE UPDATE ON "purchase_invoices"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS purchase_invoice_items_updated_at ON "purchase_invoice_items";
CREATE TRIGGER purchase_invoice_items_updated_at
  BEFORE UPDATE ON "purchase_invoice_items"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
