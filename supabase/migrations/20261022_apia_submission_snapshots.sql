-- Add immutable snapshots for submissions recorded by the user after filing externally.
CREATE TABLE IF NOT EXISTS apia_dossier_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id UUID NOT NULL REFERENCES apia_dossiers(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE (dossier_id, version)
);

CREATE INDEX IF NOT EXISTS apia_dossier_snapshots_dossier_idx
  ON apia_dossier_snapshots (dossier_id, version DESC);

ALTER TABLE apia_dossier_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apia_dossier_snapshots_read_own ON apia_dossier_snapshots;
CREATE POLICY apia_dossier_snapshots_read_own
  ON apia_dossier_snapshots FOR SELECT
  USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('apia-documents', 'apia-documents', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

DROP POLICY IF EXISTS apia_documents_select_own ON storage.objects;
CREATE POLICY apia_documents_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'apia-documents' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS apia_documents_insert_own ON storage.objects;
CREATE POLICY apia_documents_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'apia-documents' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS apia_documents_delete_own ON storage.objects;
CREATE POLICY apia_documents_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'apia-documents' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE OR REPLACE FUNCTION prevent_apia_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'APIA submission snapshots are immutable';
END;
$$;

DROP TRIGGER IF EXISTS apia_dossier_snapshots_immutable ON apia_dossier_snapshots;
CREATE TRIGGER apia_dossier_snapshots_immutable
  BEFORE UPDATE OR DELETE ON apia_dossier_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_apia_snapshot_mutation();

CREATE OR REPLACE FUNCTION record_apia_submission(
  p_dossier_id UUID,
  p_submission_date DATE,
  p_agi_dossier_number TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_dossier apia_dossiers%ROWTYPE;
  v_version INTEGER;
  v_snapshot JSONB;
  v_campaign_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_dossier
  FROM apia_dossiers
  WHERE id = p_dossier_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier not found';
  END IF;

  IF v_dossier.status <> 'READY' THEN
    RAISE EXCEPTION 'Dossier must be prepared for final review before submission is recorded';
  END IF;

  IF p_submission_date IS NULL THEN
    RAISE EXCEPTION 'Submission date is required';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM apia_dossier_snapshots
  WHERE dossier_id = p_dossier_id;

  SELECT id INTO v_campaign_id
  FROM campaigns
  WHERE user_id = v_user_id AND year = v_dossier.campaign_year;

  v_snapshot := jsonb_build_object(
    'version', v_version,
    'captured_at', NOW(),
    'recorded_by', v_user_id,
    'submission_date', p_submission_date,
    'agi_dossier_number', NULLIF(BTRIM(p_agi_dossier_number), ''),
    'dossier', to_jsonb(v_dossier),
    'campaign', (SELECT to_jsonb(c) FROM campaigns c WHERE c.id = v_campaign_id AND c.user_id = v_user_id),
    'land_use_sources', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'parcel', to_jsonb(p),
        'contract', to_jsonb(c),
        'lessor', to_jsonb(l),
        'documents', COALESCE((
          SELECT jsonb_agg(to_jsonb(cd) ORDER BY cd.created_at, cd.id)
          FROM contract_documents cd
          WHERE cd.contract_id = c.id AND cd.user_id = v_user_id
        ), '[]'::jsonb)
      ) ORDER BY p.id)
      FROM apia_dossier_parcels dp
      JOIN parcels p ON p.id = dp.parcel_id AND p.user_id = v_user_id
      LEFT JOIN contracts c ON c.id = p.contract_id AND c.user_id = v_user_id
      LEFT JOIN lessors l ON l.id = c.lessor_id AND l.user_id = v_user_id
      WHERE dp.dossier_id = p_dossier_id AND dp.user_id = v_user_id
    ), '[]'::jsonb),
    'crop_plans', COALESCE((
      SELECT jsonb_agg(to_jsonb(cp) ORDER BY cp.parcel_id)
      FROM crop_plans cp
      WHERE cp.campaign_id = v_campaign_id AND cp.user_id = v_user_id
        AND cp.parcel_id IN (SELECT parcel_id FROM apia_dossier_parcels WHERE dossier_id = p_dossier_id AND user_id = v_user_id)
    ), '[]'::jsonb),
    'completed_work_orders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'work_order', to_jsonb(wo),
        'inputs', COALESCE((
          SELECT jsonb_agg(to_jsonb(wi) ORDER BY wi.created_at, wi.id)
          FROM work_order_inputs wi
          WHERE wi.work_order_id = wo.id AND wi.user_id = v_user_id
        ), '[]'::jsonb)
      ) ORDER BY wo.executed_date, wo.id)
      FROM work_orders wo
      WHERE wo.campaign_id = v_campaign_id AND wo.user_id = v_user_id AND wo.status = 'FINALIZAT'
        AND wo.parcel_id IN (SELECT parcel_id FROM apia_dossier_parcels WHERE dossier_id = p_dossier_id AND user_id = v_user_id)
    ), '[]'::jsonb),
    'phytosanitary_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.data_tratament, r.id)
      FROM registru_fitosanitar r
      WHERE r.campaign_id = v_campaign_id AND r.user_id = v_user_id AND r.is_deleted = FALSE
        AND r.parcela_id IN (SELECT parcel_id FROM apia_dossier_parcels WHERE dossier_id = p_dossier_id AND user_id = v_user_id)
    ), '[]'::jsonb),
    'parcels', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at, p.id)
      FROM apia_dossier_parcels p
      WHERE p.dossier_id = p_dossier_id AND p.user_id = v_user_id
    ), '[]'::jsonb),
    'interventions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('selection', to_jsonb(di), 'catalog', to_jsonb(i)) ORDER BY i.sort_order, i.code)
      FROM apia_dossier_interventions di
      JOIN apia_interventions i ON i.id = di.intervention_id
      WHERE di.dossier_id = p_dossier_id AND di.user_id = v_user_id
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id)
      FROM apia_dossier_documents d
      WHERE d.dossier_id = p_dossier_id AND d.user_id = v_user_id
    ), '[]'::jsonb),
    'changes', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at, c.id)
      FROM apia_change_requests c
      WHERE c.dossier_id = p_dossier_id AND c.user_id = v_user_id
    ), '[]'::jsonb),
    'zootechnical_declarations', COALESCE((
      SELECT jsonb_agg(to_jsonb(z) ORDER BY z.created_at, z.id)
      FROM apia_zootechnical_declarations z
      WHERE z.dossier_id = p_dossier_id AND z.user_id = v_user_id
    ), '[]'::jsonb)
  );

  INSERT INTO apia_dossier_snapshots (user_id, dossier_id, version, snapshot, submitted_by)
  VALUES (v_user_id, p_dossier_id, v_version, v_snapshot, v_user_id);

  UPDATE apia_dossiers
  SET status = 'SUBMITTED',
      submission_date = p_submission_date,
      agi_dossier_number = COALESCE(NULLIF(BTRIM(p_agi_dossier_number), ''), agi_dossier_number),
      updated_at = NOW()
  WHERE id = p_dossier_id AND user_id = v_user_id;

  INSERT INTO apia_audit_log (user_id, dossier_id, action, entity_type, entity_id, new_value, notes)
  VALUES (
    v_user_id,
    p_dossier_id,
    'SUBMISSION_RECORDED',
    'apia_dossier_snapshot',
    (SELECT id FROM apia_dossier_snapshots WHERE dossier_id = p_dossier_id AND version = v_version),
    jsonb_build_object('version', v_version, 'submission_date', p_submission_date, 'agi_dossier_number', NULLIF(BTRIM(p_agi_dossier_number), '')),
    'User confirmed submission through an official APIA channel.'
  );

  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION record_apia_submission(UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_apia_submission(UUID, DATE, TEXT) TO authenticated;