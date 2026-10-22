-- Catalog intervenții PD (PSP 2023-2027, campania 2026) + politici Storage pentru bucket-ul documents.
-- PD-07..PD-20 (sprijin cuplat vegetal) nu sunt incluse: denumirile nu au fost verificate.

INSERT INTO apia_interventions (code, name, category, subcategory, sort_order, description, year_from, config) VALUES
  ('PD-01','BISS – Sprijin de bază pentru venit pentru durabilitate','DIRECT','Plăți decuplate',10,'Plata decuplată pe suprafață',2023,'{}'),
  ('PD-02','CRISS – Sprijin redistributiv complementar pentru venit','DIRECT','Plăți decuplate',20,'Sprijin redistributiv pe prima parte a suprafeței',2023,'{}'),
  ('PD-03','Sprijin complementar pentru tinerii fermieri','DIRECT','Plăți decuplate',30,'Tineri fermieri',2023,'{}'),
  ('PD-04','Practici benefice pentru mediu și climă în teren arabil','ECO_SCHEMA','Eco-scheme',40,'Eco-schemă pentru terenul arabil',2023,'{"notebook": true, "config_note": "Configurare internă ArendaPro; verifică ghidul oficial al campaniei."}'),
  ('PD-05','Agricultură prietenoasă cu mediul în fermele mici','ECO_SCHEMA','Eco-scheme',50,'Eco-schemă pentru fermele mici',2023,'{"notebook": true, "config_note": "Configurare internă ArendaPro; verifică ghidul oficial al campaniei."}'),
  ('PD-06','Înierbarea intervalului dintre rânduri în plantații pomicole/viticole','ECO_SCHEMA','Eco-scheme',60,'Eco-schemă pentru plantații',2023,'{"notebook": true, "config_note": "Configurare internă ArendaPro; verifică ghidul oficial al campaniei."}'),
  ('PD-21','Sprijin cuplat – Vaci de lapte','ANT','Zootehnic',210,'Sprijin cuplat zootehnic',2023,'{}'),
  ('PD-22','Sprijin cuplat – Carne de vită','ANT','Zootehnic',220,'Sprijin cuplat zootehnic',2023,'{}'),
  ('PD-23','Sprijin cuplat – Bivolițe de lapte','ANT','Zootehnic',230,'Sprijin cuplat zootehnic',2023,'{}'),
  ('PD-24','Sprijin cuplat – Ovine și caprine','ANT','Zootehnic',240,'Sprijin cuplat zootehnic',2023,'{}')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, subcategory = EXCLUDED.subcategory,
  sort_order = EXCLUDED.sort_order, description = EXCLUDED.description, config = EXCLUDED.config, is_active = true;

-- Coduri vechi, duplicate sau neverificate
UPDATE apia_interventions SET is_active = false
 WHERE code IN ('PS1-1','PS1-2','PS1-3','PS1-4','PS2','ECO-M1','ECO-M2','ECO-M3','ECO-M4','ECO-M5','ECO-M6','ANT-12','ANT-13','ANT-14','ANT-15');

-- Storage: încărcare/citire documente pentru utilizatori autentificați
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents','documents', false, 15728640, ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_auth" ON storage.objects;
CREATE POLICY "documents_auth" ON storage.objects FOR ALL
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
