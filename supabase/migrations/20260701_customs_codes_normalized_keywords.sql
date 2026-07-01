-- ============================================================
-- ArendaPro: customs_codes — add diacritic-free keyword variants
-- Run AFTER 20260701_customs_codes.sql
-- ============================================================

-- Update existing keywords to include both diacritic and diacritic-free forms
-- This ensures search works regardless of whether user types diacritics

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'grau','grau dur','grau comun','grau moale','grau panificatie','cereale grau',
  'grau samanta','samanta grau','grau insamantare','faina grau'
] WHERE code IN ('10011190','10011100','10019900');

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'floarea soarelui','floarea-soarelui','seminte floarea soarelui',
  'srot floarea soarelui','samanta floarea soarelui','floarea soarelui insamantare'
] WHERE code IN ('12060091','12060010');

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'rapita','seminte rapita','rapita boabe','seminte rapita insamantare'
] WHERE code = '12059000';

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'sfecla zahar','sfecla de zahar','sfecla'
] WHERE code = '12129100';

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'ingrasamant','ingrasamant mineral','ingrasamant complex','ingrasamant azot'
] WHERE code IN ('31021000','31051000');

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'erbicid','erbicide','ierbicid','produs fitosanitar'
] WHERE code = '38089390';

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'combina','combina recoltare','combina cereale','combina agricola'
] WHERE code = '84334000';

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'utilaj agricol','masina agricola','plug','disc','cultivator','grapa'
] WHERE code = '84328000';

UPDATE customs_codes SET keywords_ro = keywords_ro || ARRAY[
  'motorina','diesel','gasoil','combustibil'
] WHERE code = '27101943';

-- Add diacritic-free aliases for grâu
INSERT INTO customs_code_aliases (customs_code_id, alias, language)
SELECT id, unnest(ARRAY['grau','grau dur','grau tare','wheat','triticum durum']), 'ro'
FROM customs_codes WHERE code = '10011190'
ON CONFLICT DO NOTHING;

INSERT INTO customs_code_aliases (customs_code_id, alias, language)
SELECT id, unnest(ARRAY['grau comun','grau moale','grau panificatie','wheat common']), 'ro'
FROM customs_codes WHERE code = '10019900'
ON CONFLICT DO NOTHING;

INSERT INTO customs_code_aliases (customs_code_id, alias, language)
SELECT id, unnest(ARRAY['rapita','seminte rapita','canola','colza']), 'ro'
FROM customs_codes WHERE code = '12059000'
ON CONFLICT DO NOTHING;
