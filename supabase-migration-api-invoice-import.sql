-- ─── Invoice Import + Stock Movements (NestJS API database) ──────────────────
-- Equivalent to Prisma migration: add-invoice-import
-- Run this directly in your PostgreSQL database (psql or any SQL client)
-- ─────────────────────────────────────────────────────────────────────────────

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
