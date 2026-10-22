-- DEMO ONLY — Pregătire dosar APIA. NU se rulează în producție.
-- Date demonstrative: „Ferma Verde SRL”, campania 2026, 24 parcele, 324,50 ha, 4 intervenții.
--   * P12 (bloc 1456, Grâu de toamnă): 8,40 ha în ArendaPro vs 8,35 ha în document  -> „Necesită verificare”
--   * Încă o diferență de suprafață (P19: 12,10 vs 12,00 ha)
--   * 1 contract expirat, 1 contract fără fișier, 1 caiet (ECO-M1) fără activități acceptate
-- Utilizare: înlocuiește v_user cu UUID-ul unui utilizator de test (auth.users), rulează în mediu non-producție.
-- Curățare: vezi blocul din finalul fișierului.
-- ATENȚIE: scriptul folosește doar coloanele citite de motor (parcels, contracts, contract_documents). Dacă tabelele reale
-- au alte coloane NOT NULL, adaugă-le în INSERT-uri înainte de rulare.

DO $$
DECLARE
  v_user uuid := '00000000-0000-0000-0000-000000000000';  -- <<< ÎNLOCUIEȘTE
  v_dossier uuid;
  v_contract uuid;
  v_ids uuid[] := '{}';
  n int;
  area numeric;
  doc_area numeric;
  crop text;
  cids uuid[] := '{}';
BEGIN
  IF v_user = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Setează v_user la un utilizator de test.';
  END IF;

  -- 6 contracte DEMO: #5 expirat, #6 fără fișier
  FOR n IN 1..6 LOOP
    INSERT INTO contracts (user_id, contract_number, contract_type, start_date, end_date, status)
    VALUES (v_user, 'DEMO-' || n || '/2024', 'arenda', '2024-01-01', CASE WHEN n = 5 THEN '2026-03-31'::date ELSE '2031-12-31'::date END, 'active')
    RETURNING id INTO v_contract;
    cids := cids || v_contract;
    IF n <> 6 THEN
      INSERT INTO contract_documents (contract_id, original_file_name, active_storage_path)
      VALUES (v_contract, 'DEMO-contract-' || n || '.pdf', 'demo/DEMO-contract-' || n || '.pdf');
    END IF;
  END LOOP;

  -- 24 parcele: 20×14,00 + 2×12,00 + P12 8,40 + P19 12,10 = 324,50 ha
  FOR n IN 1..24 LOOP
    area := CASE WHEN n = 12 THEN 8.40 WHEN n = 19 THEN 12.10 WHEN n IN (23, 24) THEN 12.00 ELSE 14.00 END;
    doc_area := CASE WHEN n = 12 THEN 8.35 WHEN n = 19 THEN 12.00 ELSE area END;
    crop := CASE WHEN n = 12 THEN 'Grâu de toamnă' WHEN n % 3 = 0 THEN 'Floarea-soarelui' WHEN n % 3 = 1 THEN 'Grâu de toamnă' ELSE 'Porumb' END;
    INSERT INTO parcels (user_id, bloc_fizic, tarla_nr, parcel_nr, locality, county, surface, surface_rented, status, culture, contract_id)
    VALUES (v_user, (1444 + n)::text, '1', n::text, 'Lehliu', 'Călărași', area, doc_area, 'active', crop, cids[((n - 1) % 6) + 1]);
  END LOOP;

  INSERT INTO apia_prep_dossiers (user_id, campaign_year, notes)
  VALUES (v_user, 2026, 'DEMO – Ferma Verde SRL')
  ON CONFLICT (user_id, campaign_year) DO UPDATE SET notes = EXCLUDED.notes
  RETURNING id INTO v_dossier;

  INSERT INTO apia_prep_interventions (user_id, dossier_id, intervention_code, status)
  SELECT v_user, v_dossier, c, 'SELECTED_FOR_ANALYSIS' FROM unnest(ARRAY['PS1-1', 'PS1-2', 'ANT-1', 'ECO-M1']) AS c
  ON CONFLICT (dossier_id, intervention_code) DO NOTHING;
END $$;

-- Curățare (rulează manual, doar pentru utilizatorul de test):
--   DELETE FROM apia_prep_dossiers WHERE user_id = '<uuid>' AND notes LIKE 'DEMO –%';
--   DELETE FROM parcels WHERE user_id = '<uuid>' AND bloc_fizic BETWEEN '1445' AND '1468' AND locality = 'Lehliu';
--   DELETE FROM contracts WHERE user_id = '<uuid>' AND contract_number LIKE 'DEMO-%';
