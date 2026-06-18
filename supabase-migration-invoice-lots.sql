-- ─── Invoice Imports for Loturi Inputuri ──────────────────────────────────────
-- Client-side OCR workflow: PDF/image → browser OCR → structured lots
-- Run in Supabase SQL Editor

-- ─── input_invoice_imports ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS input_invoice_imports (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_file_name  TEXT      NOT NULL,
  file_size_bytes     BIGINT,
  storage_path        TEXT,
  supplier_name       TEXT,
  supplier_tax_id     TEXT,
  invoice_number      TEXT,
  invoice_date        DATE,
  currency            TEXT      NOT NULL DEFAULT 'RON',
  subtotal            NUMERIC(14,2),
  vat_total           NUMERIC(14,2),
  total               NUMERIC(14,2),
  raw_ocr_text        TEXT,
  raw_ocr_json        JSONB,
  status              TEXT      NOT NULL DEFAULT 'uploaded'
                        CHECK (status IN (
                          'uploaded','ocr_processing','ocr_completed',
                          'needs_review','draft','confirmed','lots_created','failed'
                        )),
  error_message       TEXT,
  confirmed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iiv_imports_user   ON input_invoice_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_iiv_imports_status ON input_invoice_imports(user_id, status);
CREATE INDEX IF NOT EXISTS idx_iiv_imports_dup
  ON input_invoice_imports(user_id, supplier_tax_id, invoice_number, invoice_date);

ALTER TABLE input_invoice_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "iiv_imports_own" ON input_invoice_imports;
CREATE POLICY "iiv_imports_own" ON input_invoice_imports
  FOR ALL USING (user_id = auth.uid());

-- ─── input_invoice_import_items ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS input_invoice_import_items (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id         UUID    NOT NULL REFERENCES input_invoice_imports(id) ON DELETE CASCADE,
  line_no           INTEGER NOT NULL,
  extracted_name    TEXT    NOT NULL,
  normalized_name   TEXT,
  matched_lot_id    UUID    REFERENCES input_lots(id) ON DELETE SET NULL,
  created_lot_id    UUID    REFERENCES input_lots(id) ON DELETE SET NULL,
  category          TEXT    CHECK (category IN ('SEED','FERTILIZER','PPP','FUEL','OTHER')),
  quantity          NUMERIC(14,4),
  unit              TEXT,
  unit_price        NUMERIC(14,4),
  vat_rate          NUMERIC(5,2),
  vat_amount        NUMERIC(14,2),
  line_total        NUMERIC(14,2),
  lot_number        TEXT,
  expiration_date   DATE,
  match_status      TEXT    NOT NULL DEFAULT 'unmatched'
                      CHECK (match_status IN ('matched','unmatched','new_input','ignored')),
  confidence        NUMERIC(5,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iiv_items_import ON input_invoice_import_items(import_id);

ALTER TABLE input_invoice_import_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "iiv_items_own" ON input_invoice_import_items;
CREATE POLICY "iiv_items_own" ON input_invoice_import_items
  FOR ALL USING (
    import_id IN (SELECT id FROM input_invoice_imports WHERE user_id = auth.uid())
  );

-- ─── input_product_aliases ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS input_product_aliases (
  id                    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lot_product_name      TEXT  NOT NULL,
  supplier_tax_id       TEXT,
  alias_name            TEXT  NOT NULL,
  normalized_alias_name TEXT  NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_input_product_aliases
  ON input_product_aliases(user_id, normalized_alias_name);
CREATE INDEX IF NOT EXISTS idx_input_product_aliases_supplier
  ON input_product_aliases(user_id, supplier_tax_id);

ALTER TABLE input_product_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "input_product_aliases_own" ON input_product_aliases;
CREATE POLICY "input_product_aliases_own" ON input_product_aliases
  FOR ALL USING (user_id = auth.uid());

-- ─── contract_documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_documents (
  id                      UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id             UUID   NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  lessor_id               UUID   NOT NULL,
  document_type           TEXT   NOT NULL DEFAULT 'other'
                            CHECK (document_type IN (
                              'main_contract','additional_act','annex','payment_document','other'
                            )),
  title                   TEXT,
  original_file_name      TEXT   NOT NULL,
  storage_path            TEXT   NOT NULL,
  compressed_storage_path TEXT,
  active_storage_path     TEXT   NOT NULL,
  mime_type               TEXT   NOT NULL DEFAULT 'application/pdf',
  original_size_bytes     BIGINT NOT NULL,
  compressed_size_bytes   BIGINT,
  compression_ratio       NUMERIC(5,4),
  compression_status      TEXT   NOT NULL DEFAULT 'not_attempted'
                            CHECK (compression_status IN (
                              'not_attempted','processing','compressed',
                              'skipped','failed','not_smaller'
                            )),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_docs_contract ON contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_docs_lessor   ON contract_documents(lessor_id);
CREATE INDEX IF NOT EXISTS idx_contract_docs_user     ON contract_documents(user_id);

ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contract_docs_own" ON contract_documents;
CREATE POLICY "contract_docs_own" ON contract_documents
  FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- If the table already exists and the old policy is blocking, re-run just these lines:
-- DROP POLICY IF EXISTS "contract_docs_own" ON contract_documents;
-- CREATE POLICY "contract_docs_own" ON contract_documents
--   FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Extend input_lots ────────────────────────────────────────────────────────

ALTER TABLE input_lots
  ADD COLUMN IF NOT EXISTS source_invoice_import_id UUID
    REFERENCES input_invoice_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_invoice_number    TEXT,
  ADD COLUMN IF NOT EXISTS source_invoice_date      DATE,
  ADD COLUMN IF NOT EXISTS ocr_created              BOOLEAN NOT NULL DEFAULT false;

-- ─── updated_at triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iiv_imports_updated_at ON input_invoice_imports;
CREATE TRIGGER trg_iiv_imports_updated_at
  BEFORE UPDATE ON input_invoice_imports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_iiv_items_updated_at ON input_invoice_import_items;
CREATE TRIGGER trg_iiv_items_updated_at
  BEFORE UPDATE ON input_invoice_import_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_contract_docs_updated_at ON contract_documents;
CREATE TRIGGER trg_contract_docs_updated_at
  BEFORE UPDATE ON contract_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Storage bucket + policy ──────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', false, 31457280,
  ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_auth" ON storage.objects;
CREATE POLICY "documents_auth" ON storage.objects
  FOR ALL
  USING     (bucket_id = 'documents' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
