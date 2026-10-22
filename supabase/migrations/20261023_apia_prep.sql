-- ─────────────────────────────────────────────────────────────────────────────
-- Pregătire dosar APIA — additive migration (no drops, no data changes)
-- Reuses: parcels, contracts, contract_documents, work_orders(+inputs),
--         registru_fitosanitar, company_settings, farm_members, apia_interventions,
--         apia_audit_log. Nothing here marks a dossier as eligible/approved/validated.
-- Rollback: drop the apia_prep_* tables, the apia_prep_* functions, and the added columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- Access helpers: farm owner, or active farm member (role returned) --------------
CREATE OR REPLACE FUNCTION public.apia_prep_role(owner uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN owner = auth.uid() THEN 'proprietar'
    ELSE (SELECT fm.role FROM public.farm_members fm
          WHERE fm.farm_owner_id = owner AND fm.member_id = auth.uid() AND fm.status = 'active' LIMIT 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.apia_prep_can_write(owner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.apia_prep_role(owner) IN ('proprietar','administrator','contabil','operator'), false)
$$;

-- 1. Dossier (one per farm owner per campaign year) -----------------------------
CREATE TABLE IF NOT EXISTS apia_prep_dossiers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- farm owner
  campaign_year         integer NOT NULL CHECK (campaign_year BETWEEN 2000 AND 2100),
  lifecycle             text NOT NULL DEFAULT 'PREPARATION'
    CHECK (lifecycle IN ('PREPARATION','SUBMISSION_RECORDED','UNDER_REVIEW_USER_CONFIRMED','CHANGE_REQUIRED','PARTIAL_WITHDRAWAL_RECORDED','ARCHIVED')),
  version               integer NOT NULL DEFAULT 1,
  applicant_overrides   jsonb NOT NULL DEFAULT '{}'::jsonb,
  livestock_applicable  boolean NOT NULL DEFAULT false,
  exploitation_code     text,
  livestock             jsonb NOT NULL DEFAULT '[]'::jsonb,
  bnd_confirmed_on      date,
  sign_method           text,
  submitted_on          date,
  request_number        text,
  apia_center           text,
  submission_proof_path text,
  submission_note       text,
  verification_ran_at   timestamptz,
  disclaimer_seen_at    timestamptz,
  notes                 text,
  created_by            uuid DEFAULT auth.uid(),
  updated_by            uuid DEFAULT auth.uid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_year)
);

-- 2. Campaign ↔ existing parcel link (only campaign-specific values) ------------
CREATE TABLE IF NOT EXISTS apia_prep_parcels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id      uuid NOT NULL REFERENCES apia_prep_dossiers(id) ON DELETE CASCADE,
  parcel_id       uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  included        boolean NOT NULL DEFAULT true,
  prepared_area   numeric(12,4),
  prepared_crop   text,
  review_status   text NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING','NEEDS_REVIEW','CONFIRMED')),
  exclusion_reason text,
  notes           text,
  confirmed_by    uuid,
  confirmed_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, parcel_id)
);

-- 3. Interventions selected for analysis (catalog = apia_interventions) ---------
CREATE TABLE IF NOT EXISTS apia_prep_interventions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id        uuid NOT NULL REFERENCES apia_prep_dossiers(id) ON DELETE CASCADE,
  intervention_code text NOT NULL REFERENCES apia_interventions(code),
  rule_version      text,
  status            text NOT NULL DEFAULT 'SELECTED_FOR_ANALYSIS'
    CHECK (status IN ('NOT_SELECTED','SELECTED_FOR_ANALYSIS','INCOMPLETE','NEEDS_REVIEW','READY_FOR_REVIEW','NOT_APPLICABLE')),
  parcel_ids        uuid[] NOT NULL DEFAULT '{}',
  notes             text,
  selected_by       uuid DEFAULT auth.uid(),
  selected_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, intervention_code)
);

-- 4. Notebook rows (suggested from existing records, or manual) -----------------
CREATE TABLE IF NOT EXISTS apia_prep_notebook_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id        uuid NOT NULL REFERENCES apia_prep_dossiers(id) ON DELETE CASCADE,
  intervention_code text NOT NULL,
  source_type       text NOT NULL CHECK (source_type IN ('WORK_ORDER_INPUT','FITOSANITAR','MANUAL')),
  source_id         uuid,
  source_version    text,
  parcel_id         uuid REFERENCES parcels(id) ON DELETE SET NULL,
  activity_date     date,
  culture           text,
  activity          text,
  area_ha           numeric(12,4),
  input_name        text,
  qty               numeric(14,4),
  unit              text,
  doc_name          text,
  operator_name     text,
  note              text,
  inclusion_status  text NOT NULL DEFAULT 'SUGGESTED'
    CHECK (inclusion_status IN ('SUGGESTED','ACCEPTED','NEEDS_REVIEW','EXCLUDED','SOURCE_CHANGED')),
  override_reason   text,
  imported_by       uuid DEFAULT auth.uid(),
  imported_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_by      uuid,
  confirmed_at      timestamptz,
  UNIQUE (dossier_id, intervention_code, source_type, source_id)
);

-- 5. Supporting documents (files in storage bucket `documents`, prefix apia-prep/) -
CREATE TABLE IF NOT EXISTS apia_prep_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id        uuid NOT NULL REFERENCES apia_prep_dossiers(id) ON DELETE CASCADE,
  category          text NOT NULL DEFAULT 'Alte documente',
  name              text NOT NULL,
  storage_path      text,
  file_name         text,
  mime_type         text,
  size_bytes        bigint,
  section           text NOT NULL DEFAULT 'documents',
  parcel_id         uuid REFERENCES parcels(id) ON DELETE SET NULL,
  contract_id       uuid REFERENCES contracts(id) ON DELETE SET NULL,
  intervention_code text,
  expiry            date,
  status            text NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE','MISSING','EXPIRED','EXPIRING','INCOMPLETE','NEEDS_REVIEW','NOT_APPLICABLE','REPLACED')),
  version           integer NOT NULL DEFAULT 1,
  replaces_id       uuid REFERENCES apia_prep_documents(id),
  note              text,
  archived          boolean NOT NULL DEFAULT false,
  created_by        uuid DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 6. User confirmations (generic; also used for "warning reviewed") --------------
CREATE TABLE IF NOT EXISTS apia_prep_confirmations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id    uuid NOT NULL REFERENCES apia_prep_dossiers(id) ON DELETE CASCADE,
  kind          text NOT NULL,   -- WARNING_REVIEWED | BND_VERIFIED | NOTEBOOK_COMPLETE | FINAL_REVIEW | SUBMISSION ...
  entity_key    text NOT NULL DEFAULT '',
  text_version  text,
  note          text,
  confirmed_by  uuid DEFAULT auth.uid(),
  confirmed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, kind, entity_key)
);

-- 7. Immutable submission snapshots ---------------------------------------------
CREATE TABLE IF NOT EXISTS apia_prep_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id    uuid NOT NULL REFERENCES apia_prep_dossiers(id) ON DELETE RESTRICT,
  version       integer NOT NULL,
  payload       jsonb NOT NULL,
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, version)
);

CREATE OR REPLACE FUNCTION public.apia_prep_snapshots_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Snapshot-urile depunerii nu pot fi modificate sau șterse.';
END $$;

DROP TRIGGER IF EXISTS apia_prep_snapshots_no_change ON apia_prep_snapshots;
CREATE TRIGGER apia_prep_snapshots_no_change
  BEFORE UPDATE OR DELETE ON apia_prep_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.apia_prep_snapshots_immutable();

-- 8. Post-submission change preparation (M1…M4) -----------------------------------
CREATE TABLE IF NOT EXISTS apia_prep_changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id    uuid NOT NULL REFERENCES apia_prep_dossiers(id) ON DELETE CASCADE,
  form_type     text NOT NULL CHECK (form_type IN ('M1','M1.1','M1.2','M1.3','M1.4','M1.5','M2','M3','M4')),
  status        text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PREPARED','SENT_RECORDED','CANCELLED')),
  reason        text,
  parcel_ids    uuid[] NOT NULL DEFAULT '{}',
  old_data      jsonb,
  new_data      jsonb,
  doc_names     text[] NOT NULL DEFAULT '{}',
  changed_summary text,
  sent_on       date,
  proof_note    text,
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Reuse existing catalog + audit table (additive columns only) ------------------
ALTER TABLE apia_interventions ADD COLUMN IF NOT EXISTS rule_version text NOT NULL DEFAULT '2026.1';
ALTER TABLE apia_interventions ADD COLUMN IF NOT EXISTS source_url   text;
ALTER TABLE apia_interventions ADD COLUMN IF NOT EXISTS source_date  date;
ALTER TABLE apia_interventions ADD COLUMN IF NOT EXISTS config       jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE apia_interventions ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE apia_audit_log     ADD COLUMN IF NOT EXISTS prep_dossier_id uuid REFERENCES apia_prep_dossiers(id) ON DELETE CASCADE;
ALTER TABLE apia_audit_log     ADD COLUMN IF NOT EXISTS actor_id uuid DEFAULT auth.uid();

-- Internal configuration: which interventions use a notebook (verify with the official guide).
UPDATE apia_interventions
   SET config = config || '{"notebook": true, "config_note": "Configurare internă ArendaPro; verifică ghidul oficial al campaniei."}'::jsonb
 WHERE code IN ('ECO-M1','ECO-M2','ECO-M6') AND NOT (config ? 'notebook');

-- Indexes -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS apia_prep_dossiers_user_idx  ON apia_prep_dossiers(user_id, campaign_year);
CREATE INDEX IF NOT EXISTS apia_prep_parcels_d_idx      ON apia_prep_parcels(dossier_id);
CREATE INDEX IF NOT EXISTS apia_prep_parcels_p_idx      ON apia_prep_parcels(parcel_id);
CREATE INDEX IF NOT EXISTS apia_prep_intervs_d_idx      ON apia_prep_interventions(dossier_id);
CREATE INDEX IF NOT EXISTS apia_prep_nbrows_d_idx       ON apia_prep_notebook_rows(dossier_id, intervention_code);
CREATE INDEX IF NOT EXISTS apia_prep_docs_d_idx         ON apia_prep_documents(dossier_id);
CREATE INDEX IF NOT EXISTS apia_prep_confirm_d_idx      ON apia_prep_confirmations(dossier_id);
CREATE INDEX IF NOT EXISTS apia_prep_changes_d_idx      ON apia_prep_changes(dossier_id);
CREATE INDEX IF NOT EXISTS apia_audit_prep_idx          ON apia_audit_log(prep_dossier_id);

-- RLS: read for owner/active members, write for owner/administrator/contabil/operator -
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['apia_prep_dossiers','apia_prep_parcels','apia_prep_interventions','apia_prep_notebook_rows',
                           'apia_prep_documents','apia_prep_confirmations','apia_prep_snapshots','apia_prep_changes']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS apia_prep_select ON %I', t);
    EXECUTE format('CREATE POLICY apia_prep_select ON %I FOR SELECT USING (public.apia_prep_role(user_id) IS NOT NULL)', t);
    EXECUTE format('DROP POLICY IF EXISTS apia_prep_insert ON %I', t);
    EXECUTE format('CREATE POLICY apia_prep_insert ON %I FOR INSERT WITH CHECK (public.apia_prep_can_write(user_id))', t);
  END LOOP;
  -- Mutable tables: update/delete (snapshots and dossiers are never deleted)
  FOREACH t IN ARRAY ARRAY['apia_prep_dossiers','apia_prep_parcels','apia_prep_interventions','apia_prep_notebook_rows',
                           'apia_prep_documents','apia_prep_confirmations','apia_prep_changes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS apia_prep_update ON %I', t);
    EXECUTE format('CREATE POLICY apia_prep_update ON %I FOR UPDATE USING (public.apia_prep_can_write(user_id)) WITH CHECK (public.apia_prep_can_write(user_id))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['apia_prep_parcels','apia_prep_interventions','apia_prep_notebook_rows','apia_prep_documents','apia_prep_confirmations','apia_prep_changes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS apia_prep_delete ON %I', t);
    EXECUTE format('CREATE POLICY apia_prep_delete ON %I FOR DELETE USING (public.apia_prep_can_write(user_id))', t);
  END LOOP;
END $$;

-- Audit log: members of the farm may append events for their farm dossiers.
DROP POLICY IF EXISTS apia_prep_audit_select ON apia_audit_log;
CREATE POLICY apia_prep_audit_select ON apia_audit_log FOR SELECT
  USING (prep_dossier_id IS NOT NULL AND public.apia_prep_role(user_id) IS NOT NULL);
DROP POLICY IF EXISTS apia_prep_audit_insert ON apia_audit_log;
CREATE POLICY apia_prep_audit_insert ON apia_audit_log FOR INSERT
  WITH CHECK (prep_dossier_id IS NOT NULL AND public.apia_prep_can_write(user_id) AND actor_id = auth.uid());

-- Submitted snapshot cannot be bypassed: once recorded, the dossier row keeps its submission fields.
CREATE OR REPLACE FUNCTION public.apia_prep_lock_submission() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.submitted_on IS NOT NULL AND EXISTS (SELECT 1 FROM apia_prep_snapshots s WHERE s.dossier_id = OLD.id)
     AND (NEW.submitted_on IS DISTINCT FROM OLD.submitted_on OR NEW.request_number IS DISTINCT FROM OLD.request_number
          OR NEW.apia_center IS DISTINCT FROM OLD.apia_center) THEN
    RAISE EXCEPTION 'Datele depunerii înregistrate nu pot fi modificate.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS apia_prep_dossiers_lock ON apia_prep_dossiers;
CREATE TRIGGER apia_prep_dossiers_lock BEFORE UPDATE ON apia_prep_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.apia_prep_lock_submission();
