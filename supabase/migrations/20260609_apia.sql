-- ─────────────────────────────────────────────────────────────────────────────
-- APIA Module — Supabase migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. APIA Campaigns (one per user per year)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apia_campaigns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year             INTEGER     NOT NULL,
  name             TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'DRAFT',
  -- DRAFT | ACTIVE | CLOSED
  submission_start DATE,
  submission_end   DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year)
);

-- 2. APIA Dossiers (one per user per campaign year)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apia_dossiers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_year         INTEGER     NOT NULL,

  -- Official APIA AGI Online dossier number (known after submission to portal)
  agi_dossier_number    TEXT,

  -- ANSVSA exploitation code (only if the farmer has livestock)
  exploitation_code     TEXT,

  -- Dossier lifecycle
  status                TEXT        NOT NULL DEFAULT 'DRAFT',
  -- DRAFT | CHECKING | READY | SUBMITTED | UNDER_REVIEW | ACCEPTED | CORRECTED | ARCHIVED

  submission_date       DATE,
  accepted_date         DATE,
  correction_deadline   DATE,

  -- Cached totals (recomputed on demand)
  total_declared_ha     NUMERIC(10,4) NOT NULL DEFAULT 0,
  total_eligible_ha     NUMERIC(10,4) NOT NULL DEFAULT 0,

  -- Dossier-level notes
  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, campaign_year)
);

-- 3. Parcels declared in a dossier
-- ─────────────────────────────────
CREATE TABLE IF NOT EXISTS apia_dossier_parcels (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id            UUID        NOT NULL REFERENCES apia_dossiers(id) ON DELETE CASCADE,

  -- Link to existing parcel (optional — some APIA parcels may not be in internal DB)
  parcel_id             UUID        REFERENCES parcels(id) ON DELETE SET NULL,

  -- LPIS / AGI Online parcel identification
  lpis_block_code       TEXT,        -- APIA physical block (bloc fizic LPIS)
  tarla_nr              TEXT,
  parcel_nr             TEXT,
  county                TEXT,
  locality              TEXT,
  siruta_code           TEXT,

  -- Declared values
  declared_surface_ha   NUMERIC(10,4) NOT NULL DEFAULT 0,
  land_use_code         TEXT,
  -- AR=arabil, PS=pășune, FN=fânețe, LV=livadă, VI=vie, AL=alte terenuri agricole

  -- LPIS alignment
  lpis_reference_ha     NUMERIC(10,4),  -- Area from LPIS reference parcel (if available)
  overlap_flag          BOOLEAN DEFAULT false,  -- Declared > LPIS reference

  -- Eligibility
  eligible              BOOLEAN DEFAULT true,
  ineligible_reason     TEXT,

  -- Land-use right document
  land_right_type       TEXT,
  -- ARENDA | PROPRIETATE | CONCESIUNE | COMODAT | ASOCIERE | OTHER
  land_right_reference  TEXT,        -- Contract number or deed reference
  land_right_valid_from  DATE,
  land_right_valid_until DATE,

  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- View that exposes the computed expiry flag (CURRENT_DATE is STABLE, not IMMUTABLE,
-- so it cannot be used in a GENERATED ALWAYS AS STORED column).
CREATE OR REPLACE VIEW apia_dossier_parcels_v AS
SELECT *,
  (land_right_valid_until IS NOT NULL AND land_right_valid_until < CURRENT_DATE) AS land_right_expired
FROM apia_dossier_parcels;

-- 4. Global intervention catalog (seeded below, not per-user)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apia_interventions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  category    TEXT    NOT NULL,
  -- DIRECT | ANT | ECO_SCHEMA | DR | ZOOTEHNIC | OTHER
  subcategory TEXT,
  description TEXT,
  year_from   INTEGER NOT NULL DEFAULT 2023,
  year_to     INTEGER,        -- NULL = still active
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 5. Interventions selected per dossier
-- ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS apia_dossier_interventions (
  id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id      UUID   NOT NULL REFERENCES apia_dossiers(id) ON DELETE CASCADE,
  intervention_id UUID   NOT NULL REFERENCES apia_interventions(id),
  status          TEXT   NOT NULL DEFAULT 'PENDING',
  -- PENDING | ELIGIBLE | INELIGIBLE
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dossier_id, intervention_id)
);

-- 6. Documents per dossier
-- ─────────────────────────
CREATE TABLE IF NOT EXISTS apia_dossier_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id       UUID        NOT NULL REFERENCES apia_dossiers(id) ON DELETE CASCADE,
  -- Links to specific intervention (NULL = applies to entire dossier)
  intervention_id  UUID        REFERENCES apia_interventions(id) ON DELETE SET NULL,

  document_type    TEXT        NOT NULL,
  -- CERERE_PLATA | CI_BENEFICIAR | DOVADA_UTILIZARE | CONTRACT_ARENDA |
  -- COD_EXPLOATATIE | DECLARATIE_ZOOTEHNICA | BND_CONFIRMARE | OTHER
  document_label   TEXT        NOT NULL,
  file_url         TEXT,       -- Supabase storage URL (if digitized)
  reference_number TEXT,
  issue_date       DATE,
  valid_until      DATE,
  status           TEXT        NOT NULL DEFAULT 'MISSING',
  -- MISSING | UPLOADED | VERIFIED | EXPIRED | NOT_APPLICABLE
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Change request forms (M1–M4)
-- ────────────────────────────────
CREATE TABLE IF NOT EXISTS apia_change_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id      UUID        NOT NULL REFERENCES apia_dossiers(id) ON DELETE CASCADE,
  form_type       TEXT        NOT NULL,
  -- M1 | M1.1 | M1.2 | M1.3 | M1.4 | M1.5 | M2 | M3 | M4
  description     TEXT,
  submission_date DATE,
  deadline_date   DATE,
  status          TEXT        NOT NULL DEFAULT 'DRAFT',
  -- DRAFT | SUBMITTED | PROCESSED | REJECTED
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Zootechnical declarations
-- ─────────────────────────────
CREATE TABLE IF NOT EXISTS apia_zootechnical_declarations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id       UUID        NOT NULL REFERENCES apia_dossiers(id) ON DELETE CASCADE,
  exploitation_code TEXT,
  species          TEXT        NOT NULL,
  -- BOVINE_CARNE | BOVINE_LAPTE | OVINE_CAPRINE | BIVOLITE | SUINE | ECVINE | PASARI | ALTE
  head_count       INTEGER     NOT NULL DEFAULT 0,
  uat_code         TEXT,
  bnd_updated      BOOLEAN     NOT NULL DEFAULT false,
  ansvsa_confirmed BOOLEAN     NOT NULL DEFAULT false,
  declaration_date DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Dossier audit log
-- ─────────────────────
CREATE TABLE IF NOT EXISTS apia_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id   UUID        REFERENCES apia_dossiers(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL,
  -- CREATE_DOSSIER | STATUS_CHANGE | ADD_PARCEL | ADD_INTERVENTION |
  -- ADD_DOCUMENT | DOCUMENT_VERIFIED | SUBMIT | ADD_CHANGE_REQUEST
  entity_type  TEXT,
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS apia_dossiers_user_year_idx   ON apia_dossiers(user_id, campaign_year);
CREATE INDEX IF NOT EXISTS apia_dossier_parcels_d_idx    ON apia_dossier_parcels(dossier_id);
CREATE INDEX IF NOT EXISTS apia_dossier_intervs_d_idx    ON apia_dossier_interventions(dossier_id);
CREATE INDEX IF NOT EXISTS apia_dossier_docs_d_idx       ON apia_dossier_documents(dossier_id);
CREATE INDEX IF NOT EXISTS apia_change_requests_d_idx    ON apia_change_requests(dossier_id);
CREATE INDEX IF NOT EXISTS apia_zootehnic_d_idx          ON apia_zootechnical_declarations(dossier_id);
CREATE INDEX IF NOT EXISTS apia_audit_d_idx              ON apia_audit_log(dossier_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE apia_campaigns                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE apia_dossiers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE apia_dossier_parcels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE apia_dossier_interventions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE apia_dossier_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE apia_change_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE apia_zootechnical_declarations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE apia_audit_log                   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_campaigns'           AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_campaigns                 USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_dossiers'            AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_dossiers                  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_dossier_parcels'     AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_dossier_parcels           USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_dossier_interventions' AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_dossier_interventions     USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_dossier_documents'   AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_dossier_documents         USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_change_requests'     AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_change_requests           USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_zootechnical_declarations' AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_zootechnical_declarations USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='apia_audit_log'           AND policyname='users_own') THEN
    CREATE POLICY users_own ON apia_audit_log                 USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid()); END IF;
END $$;

-- apia_interventions is a global catalog — allow all authenticated users to read
ALTER TABLE apia_interventions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_all_authenticated" ON apia_interventions;
CREATE POLICY "read_all_authenticated" ON apia_interventions FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Seed: Intervention catalog (2023–2027 CAP SP Romania) ───────────────────
INSERT INTO apia_interventions (code, name, category, subcategory, sort_order, description, year_from) VALUES
  -- ── Direct payments ──────────────────────────────────────────────────────
  ('PS1-1',  'BISS – Plata de bază pentru sustenabilitate',             'DIRECT',     'Plăți de bază',       10,  'Plata decuplată de bază pentru fermieri activi cu min. 1 ha eligibil', 2023),
  ('PS1-2',  'Plată redistributivă – Zona I',                          'DIRECT',     'Redistributive',      20,  'Primele 30 ha, zona de câmpie',                                          2023),
  ('PS1-3',  'Plată redistributivă – Zona II',                         'DIRECT',     'Redistributive',      21,  'Primele 30 ha, zona colinară',                                           2023),
  ('PS1-4',  'Plată redistributivă – Zona III',                        'DIRECT',     'Redistributive',      22,  'Primele 30 ha, zona montană',                                            2023),
  ('PS2',    'Plată pentru tineri fermieri',                            'DIRECT',     'Complementare',       30,  'Fermieri sub 41 ani, max. 5 ani de la înregistrare',                     2023),
  -- ── ANT Vegetal ──────────────────────────────────────────────────────────
  ('ANT-1',  'ANT Grâu comun + Triticale',                             'ANT',        'Vegetal',             110, 'Sprijin cuplat vegetal – cereale panificație',                           2023),
  ('ANT-2',  'ANT Orez',                                               'ANT',        'Vegetal',             111, 'Sprijin cuplat vegetal – orez',                                          2023),
  ('ANT-3',  'ANT Proteaginoase (mazăre, fasole, bob, năut)',          'ANT',        'Vegetal',             112, 'Sprijin cuplat vegetal – proteaginoase',                                 2023),
  ('ANT-4',  'ANT Hamei',                                              'ANT',        'Vegetal',             113, 'Sprijin cuplat vegetal – hamei',                                         2023),
  ('ANT-5',  'ANT Sfeclă de zahăr',                                    'ANT',        'Vegetal',             114, 'Sprijin cuplat vegetal – sfeclă de zahăr',                               2023),
  ('ANT-6',  'ANT In pentru fibră',                                    'ANT',        'Vegetal',             115, 'Sprijin cuplat vegetal – in pentru fibră',                               2023),
  ('ANT-7',  'ANT Cânepă pentru fibră',                                'ANT',        'Vegetal',             116, 'Sprijin cuplat vegetal – cânepă',                                        2023),
  ('ANT-8',  'ANT Tomate industriale',                                 'ANT',        'Vegetal',             117, 'Sprijin cuplat vegetal – tomate pentru industrializare',                 2023),
  ('ANT-9',  'ANT Soia',                                               'ANT',        'Vegetal',             118, 'Sprijin cuplat vegetal – soia',                                          2023),
  ('ANT-10', 'ANT Floarea soarelui',                                   'ANT',        'Vegetal',             119, 'Sprijin cuplat vegetal – floarea soarelui',                              2023),
  ('ANT-11', 'ANT Rapiță',                                             'ANT',        'Vegetal',             120, 'Sprijin cuplat vegetal – rapiță',                                        2023),
  -- ── ANT Zootehnic ────────────────────────────────────────────────────────
  ('ANT-12', 'ANT Bovine de carne',                                    'ANT',        'Zootehnic',           200, 'Sprijin cuplat zootehnic – taurine carne',                               2023),
  ('ANT-13', 'ANT Bovine de lapte',                                    'ANT',        'Zootehnic',           201, 'Sprijin cuplat zootehnic – vaci de lapte',                               2023),
  ('ANT-14', 'ANT Ovine-caprine',                                      'ANT',        'Zootehnic',           202, 'Sprijin cuplat zootehnic – oi și capre',                                 2023),
  ('ANT-15', 'ANT Bivolițe de lapte',                                  'ANT',        'Zootehnic',           203, 'Sprijin cuplat zootehnic – bivolițe de lapte',                           2023),
  -- ── Eco-scheme ───────────────────────────────────────────────────────────
  ('ECO-M1', 'Eco-schema 1 – Rotație culturi + culturi acoperire',     'ECO_SCHEMA', 'Eco-scheme',          310, 'Rotație anuală, culturi de acoperire, fâșii tampon',                     2023),
  ('ECO-M2', 'Eco-schema 2 – Pajiști permanente extensive',            'ECO_SCHEMA', 'Eco-scheme',          320, 'Managementul pajiștilor permanente fără input chimic',                   2023),
  ('ECO-M3', 'Eco-schema 3 – Agricultură bio (în conversie sau bio)',  'ECO_SCHEMA', 'Eco-scheme',          330, 'Ferme certificate sau în conversie la agricultură biologică',             2023),
  ('ECO-M4', 'Eco-schema 4 – Pășuni HNV (valoare naturală ridicată)', 'ECO_SCHEMA', 'Eco-scheme',          340, 'Pășuni permanente cu habitate HNV identificate',                         2023),
  ('ECO-M5', 'Eco-schema 5 – Bunăstarea animalelor',                  'ECO_SCHEMA', 'Eco-scheme',          350, 'Condiții îmbunătățite de adăpostire și gestionare animale',               2023),
  ('ECO-M6', 'Eco-schema 6 – Utilizare durabilă a pesticidelor',      'ECO_SCHEMA', 'Eco-scheme',          360, 'Reducere utilizare pesticide, IPM avansat',                              2023)
ON CONFLICT (code) DO UPDATE SET
  name       = EXCLUDED.name,
  category   = EXCLUDED.category,
  subcategory= EXCLUDED.subcategory,
  sort_order = EXCLUDED.sort_order,
  description= EXCLUDED.description;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- SELECT code, name, category FROM apia_interventions ORDER BY sort_order;
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'apia_%';
