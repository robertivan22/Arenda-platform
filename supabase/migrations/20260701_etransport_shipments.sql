-- ============================================================
-- ArendaPro: RO e-Transport — schema complet MVP 1
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. etransport_shipments ────────────────────────────────
-- Transporturi declarate în RO e-Transport (MVP 1: manual)
CREATE TABLE IF NOT EXISTS etransport_shipments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft','validated','validation_failed',
      'submitted','processing','accepted',
      'rejected','corrected','deleted','vehicle_modified','confirmed'
    )),
  etransport_required   BOOLEAN     NOT NULL DEFAULT true,
  rule_result_reason    TEXT,

  -- Operațiune
  operation_type        TEXT        NOT NULL
    CHECK (operation_type IN ('national','import','export','intracomunitar')),

  -- UIT + ANAF refs
  uit_code              TEXT,
  anaf_upload_id        TEXT,
  anaf_upload_index     INTEGER,

  -- Transport
  transport_start_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  loading_country       TEXT        NOT NULL DEFAULT 'RO',
  loading_location      TEXT        NOT NULL DEFAULT '',
  unloading_country     TEXT        NOT NULL DEFAULT 'RO',
  unloading_location    TEXT        NOT NULL DEFAULT '',

  -- Vehicul & transportator
  carrier_name          TEXT,
  carrier_cui           TEXT,
  vehicle_no            TEXT        NOT NULL DEFAULT '',
  trailer1_no           TEXT,

  -- Linkuri opționale
  machine_id            UUID        REFERENCES machines(id) ON DELETE SET NULL,
  source_document_ref   TEXT,       -- ex: "FCT-001/2026"
  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE etransport_shipments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'etransport_shipments' AND policyname = 'etransport_shipments_owner'
  ) THEN
    CREATE POLICY "etransport_shipments_owner" ON etransport_shipments
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_etship_user   ON etransport_shipments (user_id);
CREATE INDEX IF NOT EXISTS idx_etship_status ON etransport_shipments (status);
CREATE INDEX IF NOT EXISTS idx_etship_machine ON etransport_shipments (machine_id) WHERE machine_id IS NOT NULL;

-- ── 2. etransport_goods ────────────────────────────────────
CREATE TABLE IF NOT EXISTS etransport_goods (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID        NOT NULL REFERENCES etransport_shipments(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nc_code       TEXT,                         -- cod NC (TARIC 8 cifre)
  name          TEXT        NOT NULL,
  quantity      NUMERIC(18,3) NOT NULL DEFAULT 1,
  uom           TEXT        NOT NULL DEFAULT 'C62', -- UN/ECE unit code
  net_weight_kg NUMERIC(18,3),
  gross_weight_kg NUMERIC(18,3),
  value_ron     NUMERIC(18,2),
  risk_category BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE etransport_goods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'etransport_goods' AND policyname = 'etransport_goods_owner'
  ) THEN
    CREATE POLICY "etransport_goods_owner" ON etransport_goods
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_etgoods_shipment ON etransport_goods (shipment_id);

-- ── 3. etransport_api_logs ─────────────────────────────────
-- Audit trail: request/response ANAF (fără tokenuri în clar)
CREATE TABLE IF NOT EXISTS etransport_api_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id         UUID        REFERENCES etransport_shipments(id) ON DELETE SET NULL,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type        TEXT        NOT NULL,  -- UPLOAD | STATUS | CANCEL
  request_url         TEXT,
  -- Authorization header sanitizat (nu se salvează tokenul în clar)
  request_xml         TEXT,
  response_body       TEXT,
  http_status         INTEGER,
  anaf_status         TEXT,
  cod_uit             TEXT,
  upload_index        INTEGER,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE etransport_api_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'etransport_api_logs' AND policyname = 'etransport_api_logs_owner'
  ) THEN
    CREATE POLICY "etransport_api_logs_owner" ON etransport_api_logs
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_etlogs_shipment ON etransport_api_logs (shipment_id);
CREATE INDEX IF NOT EXISTS idx_etlogs_user     ON etransport_api_logs (user_id);

-- ── 4. etransport_alerts ───────────────────────────────────
CREATE TABLE IF NOT EXISTS etransport_alerts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID        REFERENCES etransport_shipments(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type    TEXT        NOT NULL,
  -- TRANSPORT_WITHOUT_UIT | ANAF_REJECTED | MISSING_NC_CODE | MISSING_VEHICLE
  -- TOKEN_EXPIRED | TRANSPORT_STARTS_SOON | VALIDATION_FAILED
  severity      TEXT        NOT NULL CHECK (severity IN ('high','medium','low')),
  message       TEXT        NOT NULL,
  is_resolved   BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

ALTER TABLE etransport_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'etransport_alerts' AND policyname = 'etransport_alerts_owner'
  ) THEN
    CREATE POLICY "etransport_alerts_owner" ON etransport_alerts
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_etalerts_unresolved
  ON etransport_alerts (user_id, is_resolved)
  WHERE is_resolved = false;

-- ── 5. updated_at trigger for etransport_shipments ─────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'etship_updated_at'
  ) THEN
    CREATE TRIGGER etship_updated_at
      BEFORE UPDATE ON etransport_shipments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ── 6. pg_cron: poll submitted/processing shipments ────────
-- Runs every 5 minutes to check ANAF status for pending shipments.
-- Requires: pg_cron extension + expire_uit() function from previous migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old job if exists, then re-create
    PERFORM cron.unschedule('etransport-poll-status') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'etransport-poll-status'
    );
    -- NOTE: Actual polling is done via the API route /api/etransport/poll
    -- triggered by a Cloudflare Cron Trigger or via pg_cron calling a DB function.
    -- For now, polling is triggered manually from the UI (button) or via app cron.
  END IF;
END;
$$;
