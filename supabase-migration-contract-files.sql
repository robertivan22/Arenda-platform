-- ─── Contract Files (PDF upload + compression) ───────────────────────────────
-- Stores contract PDF attachments with original + compressed versions

CREATE TABLE IF NOT EXISTS contract_files (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  contract_id           UUID          NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  original_file_name    TEXT          NOT NULL,
  storage_key           TEXT          NOT NULL,           -- original file key
  compressed_storage_key TEXT,                            -- compressed file key (null if skipped)
  mime_type             TEXT          NOT NULL DEFAULT 'application/pdf',
  original_size_bytes   BIGINT        NOT NULL,
  compressed_size_bytes BIGINT,
  compression_ratio     NUMERIC(5,4),                     -- e.g. 0.4200 = 42% reduction
  compression_status    TEXT          NOT NULL DEFAULT 'pending'
                          CHECK (compression_status IN ('pending','completed','skipped','failed')),
  label                 TEXT,
  uploaded_by           UUID,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_files_contract ON contract_files(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_files_tenant   ON contract_files(tenant_id);

-- RLS
ALTER TABLE contract_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_files_tenant" ON contract_files;
CREATE POLICY "contract_files_tenant" ON contract_files
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Product Aliases (for OCR invoice product matching) ──────────────────────

CREATE TABLE IF NOT EXISTS product_aliases (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID    NOT NULL,
  product_id            UUID    NOT NULL,                 -- references products/catalog table
  supplier_tax_id       TEXT,                             -- CUI of supplier (optional scoping)
  alias_name            TEXT    NOT NULL,
  normalized_alias_name TEXT    NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_aliases ON product_aliases(tenant_id, normalized_alias_name);
CREATE INDEX IF NOT EXISTS idx_product_aliases_product ON product_aliases(tenant_id, product_id);
