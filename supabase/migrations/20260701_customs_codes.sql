-- ============================================================
-- ArendaPro: customs_codes — Nomenclator CN/TARIC local
-- Tabela publică (read-only pentru utilizatori autentificați).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Tabelă principală coduri NC/TARIC ───────────────────
CREATE TABLE IF NOT EXISTS customs_codes (
  id               BIGSERIAL   PRIMARY KEY,
  code             VARCHAR(10) NOT NULL,
  code_type        VARCHAR(20) NOT NULL CHECK (code_type IN ('HS_6','CN_8','TARIC_10')),
  description_ro   TEXT,
  description_en   TEXT,
  keywords_ro      TEXT[]      NOT NULL DEFAULT '{}',
  keywords_en      TEXT[]      NOT NULL DEFAULT '{}',
  chapter          VARCHAR(2),
  heading          VARCHAR(4),
  subheading       VARCHAR(6),
  source           VARCHAR(200) DEFAULT 'EU TARIC / Combined Nomenclature',
  source_url       TEXT         DEFAULT 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=ro',
  confidence_default NUMERIC(4,2) NOT NULL DEFAULT 0.70,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow any authenticated user to read (reference table, not tenant data)
ALTER TABLE customs_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customs_codes' AND policyname = 'customs_codes_read'
  ) THEN
    CREATE POLICY "customs_codes_read" ON customs_codes
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── 2. Alias-uri pentru căutare ────────────────────────────
CREATE TABLE IF NOT EXISTS customs_code_aliases (
  id              BIGSERIAL PRIMARY KEY,
  customs_code_id BIGINT      NOT NULL REFERENCES customs_codes(id) ON DELETE CASCADE,
  alias           TEXT        NOT NULL,
  language        VARCHAR(5)  NOT NULL DEFAULT 'ro',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customs_code_aliases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customs_code_aliases' AND policyname='customs_code_aliases_read') THEN
    CREATE POLICY "customs_code_aliases_read" ON customs_code_aliases FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── 3. Add tracking columns to etransport_goods ────────────
ALTER TABLE etransport_goods
  ADD COLUMN IF NOT EXISTS nc_code_confirmed  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nc_code_description TEXT,
  ADD COLUMN IF NOT EXISTS nc_code_source      TEXT;

-- ── 4. Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customs_code         ON customs_codes (code);
CREATE INDEX IF NOT EXISTS idx_customs_code_type    ON customs_codes (code_type);
CREATE INDEX IF NOT EXISTS idx_customs_keywords_ro  ON customs_codes USING GIN (keywords_ro);
CREATE INDEX IF NOT EXISTS idx_customs_keywords_en  ON customs_codes USING GIN (keywords_en);
CREATE INDEX IF NOT EXISTS idx_customs_aliases_code ON customs_code_aliases (customs_code_id);

-- ── 5. SEED — coduri frecvente în agricultură ──────────────
INSERT INTO customs_codes (code, code_type, description_ro, description_en, keywords_ro, keywords_en, chapter, heading, subheading, confidence_default)
VALUES
-- ── PORUMB ────────────────────────────────────────────────
('10059000','CN_8',
  'Porumb, altul decât pentru însămânțare',
  'Maize (corn), other than seed',
  ARRAY['porumb','porumb boabe','porumb furajer','porumb consum','porumb uscat','cereale porumb','corn','maize'],
  ARRAY['maize','corn','grain maize'],
  '10','1005','100590', 0.85),

('10051000','CN_8',
  'Porumb pentru însămânțare',
  'Maize (corn) seed',
  ARRAY['porumb samanta','samanta porumb','porumb insamantare','porumb pentru insamantare','seminte porumb','seed corn'],
  ARRAY['maize seed','seed corn','corn seed'],
  '10','1005','100510', 0.85),

-- ── GRÂU ──────────────────────────────────────────────────
('10011190','CN_8',
  'Grâu dur, altul decât pentru însămânțare',
  'Durum wheat, other than seed',
  ARRAY['grau dur','grau','grau comun','cereale grau'],
  ARRAY['durum wheat','wheat'],
  '10','1001','100111', 0.82),

('10011100','CN_8',
  'Grâu dur pentru însămânțare',
  'Durum wheat, seed',
  ARRAY['grau dur samanta','samanta grau dur','grau pentru insamantare'],
  ARRAY['durum wheat seed'],
  '10','1001','100111', 0.82),

('10019900','CN_8',
  'Grâu comun și meslin, altele decât pentru însămânțare',
  'Common wheat and meslin, other than seed',
  ARRAY['grau comun','grau moale','grau panificatie','faina grau'],
  ARRAY['common wheat','soft wheat','meslin'],
  '10','1001','100199', 0.82),

-- ── ORZOAICĂ / ORZOAICĂ ───────────────────────────────────
('10030090','CN_8',
  'Orz, altul decât pentru însămânțare',
  'Barley, other than seed',
  ARRAY['orz','orzul','cereale orz','orzoaica'],
  ARRAY['barley'],
  '10','1003','100300', 0.82),

('10030010','CN_8',
  'Orz pentru însămânțare',
  'Barley, seed',
  ARRAY['orz samanta','samanta orz','orz insamantare'],
  ARRAY['barley seed'],
  '10','1003','100300', 0.82),

-- ── FLOAREA SOARELUI ──────────────────────────────────────
('12060091','CN_8',
  'Semințe de floarea-soarelui, altele decât pentru semănat',
  'Sunflower seeds, other than seed',
  ARRAY['floarea soarelui','floarea-soarelui','seminte floarea soarelui','srot floarea soarelui'],
  ARRAY['sunflower','sunflower seeds','helianthus'],
  '12','1206','120600', 0.83),

('12060010','CN_8',
  'Semințe de floarea-soarelui pentru semănat',
  'Sunflower seeds for sowing',
  ARRAY['floarea soarelui samanta','samanta floarea soarelui','floarea soarelui insamantare'],
  ARRAY['sunflower seed sowing'],
  '12','1206','120600', 0.83),

-- ── SOIA ──────────────────────────────────────────────────
('12019090','CN_8',
  'Boabe de soia, chiar sfărâmate, altele decât pentru semănat',
  'Soya beans, whether or not broken, other than seed',
  ARRAY['soia','soia boabe','soia sfarmata','boabe soia'],
  ARRAY['soya beans','soybeans','soy'],
  '12','1201','120190', 0.83),

('12019010','CN_8',
  'Boabe de soia pentru semănat',
  'Soya beans for sowing',
  ARRAY['soia samanta','samanta soia','soia insamantare'],
  ARRAY['soya beans seed','soybean seed'],
  '12','1201','120190', 0.83),

-- ── RAPIȚĂ ────────────────────────────────────────────────
('12059000','CN_8',
  'Semințe de rapiță sau de naveta, altele decât pentru semănat',
  'Rape or colza seeds, other than seed',
  ARRAY['rapita','seminte rapita','rapita boabe'],
  ARRAY['rapeseed','colza','canola'],
  '12','1205','120590', 0.82),

-- ── ORZDOAICĂ / SECARĂ ─────────────────────────────────────
('10020090','CN_8',
  'Secară, alta decât pentru însămânțare',
  'Rye, other than seed',
  ARRAY['secara','secara boabe'],
  ARRAY['rye'],
  '10','1002','100200', 0.80),

-- ── SFECLĂ DE ZAHĂR ───────────────────────────────────────
('12129100','CN_8',
  'Sfeclă de zahăr',
  'Sugar beet',
  ARRAY['sfecla zahar','sfecla de zahar','sfecla'],
  ARRAY['sugar beet','beet'],
  '12','1212','121291', 0.82),

-- ── TRACTOARE ─────────────────────────────────────────────
('87013000','CN_8',
  'Tractoare pe șenile',
  'Track-laying tractors',
  ARRAY['tractor senile','tractor omizi'],
  ARRAY['track-laying tractor','crawler tractor'],
  '87','8701','870130', 0.78),

('87019100','CN_8',
  'Tractoare cu roți, cu putere ≤ 18 kW',
  'Wheeled tractors, power ≤ 18 kW',
  ARRAY['tractor','tractor agricol','tractor 18kw','motocultor'],
  ARRAY['tractor','agricultural tractor'],
  '87','8701','870191', 0.78),

('87019200','CN_8',
  'Tractoare cu roți, cu putere > 18 kW și ≤ 37 kW',
  'Wheeled tractors, power > 18 kW and ≤ 37 kW',
  ARRAY['tractor','tractor mic','tractor 37kw'],
  ARRAY['tractor','small tractor'],
  '87','8701','870192', 0.75),

('87019300','CN_8',
  'Tractoare cu roți, cu putere > 37 kW și ≤ 75 kW',
  'Wheeled tractors, power > 37 kW and ≤ 75 kW',
  ARRAY['tractor','tractor mediu','tractor 75kw'],
  ARRAY['tractor','medium tractor'],
  '87','8701','870193', 0.75),

('87019400','CN_8',
  'Tractoare cu roți, cu putere > 75 kW și ≤ 130 kW',
  'Wheeled tractors, power > 75 kW and ≤ 130 kW',
  ARRAY['tractor','tractor mare','tractor 130kw'],
  ARRAY['tractor','large tractor'],
  '87','8701','870194', 0.75),

('87019500','CN_8',
  'Tractoare cu roți, cu putere > 130 kW',
  'Wheeled tractors, power > 130 kW',
  ARRAY['tractor','tractor puternic','tractor 130kw plus'],
  ARRAY['tractor','high-power tractor'],
  '87','8701','870195', 0.75),

-- ── COMBINE ──────────────────────────────────────────────
('84334000','CN_8',
  'Combine pentru recoltat cereale',
  'Combine harvester-threshers',
  ARRAY['combina','combina recoltare','combina cereale','combina agricola'],
  ARRAY['combine harvester','harvester','thresher'],
  '84','8433','843340', 0.85),

-- ── ALTE UTILAJE AGRICOLE ─────────────────────────────────
('84328000','CN_8',
  'Alte mașini și aparate pentru lucrarea solului sau cultivare',
  'Other machinery for soil preparation or cultivation',
  ARRAY['utilaj agricol','masina agricola','plug','disc','cultivator','grapa'],
  ARRAY['agricultural machinery','soil preparation','cultivation'],
  '84','8432','843280', 0.72),

('84331900','CN_8',
  'Alte mașini de cosit, inclusiv bare de tăiat pentru montare pe tractoare',
  'Other mowers, including cutter bars for mounting on tractors',
  ARRAY['cositoare','cositor','bara taiat','masina cosit'],
  ARRAY['mower','cutter bar'],
  '84','8433','843319', 0.78),

-- ── ÎNGRĂȘĂMINTE ─────────────────────────────────────────
('31021000','CN_8',
  'Uree, chiar în soluție apoasă',
  'Urea, whether or not in aqueous solution',
  ARRAY['uree','ingrasamant uree','ingrasamant azot'],
  ARRAY['urea','nitrogen fertilizer'],
  '31','3102','310210', 0.85),

('31051000','CN_8',
  'Îngrășăminte în tablete sau forme similare, ori în ambalaje cu greutate brută ≤ 10 kg',
  'Fertilizers in tablets or similar forms',
  ARRAY['ingrasamant','ingrasamant mineral','ingrasamant complex','NPK'],
  ARRAY['fertilizer','mineral fertilizer','NPK'],
  '31','3105','310510', 0.72),

-- ── PESTICIDE ─────────────────────────────────────────────
('38089390','CN_8',
  'Erbicide, inhibitori de germinare și regulatori de creștere a plantelor, alții',
  'Herbicides, anti-sprouting products and plant-growth regulators, other',
  ARRAY['erbicid','erbicide','ierbicid','produs fitosanitar','tratament plante'],
  ARRAY['herbicide','weedkiller','plant growth regulator'],
  '38','3808','380893', 0.78),

('38081910','CN_8',
  'Insecticide în ambalaje pentru vânzare cu amănuntul ≤ 1 kg',
  'Insecticides in retail packaging ≤ 1 kg',
  ARRAY['insecticid','pesticide','tratament insecte'],
  ARRAY['insecticide','pest control'],
  '38','3808','380819', 0.75),

-- ── MOTORINE ─────────────────────────────────────────────
('27101943','CN_8',
  'Uleiuri de motorină — gasoil',
  'Gas oil (diesel)',
  ARRAY['motorina','diesel','gasoil','combustibil auto','combustibil motor'],
  ARRAY['diesel','gas oil','fuel'],
  '27','2710','271019', 0.88)

ON CONFLICT DO NOTHING;

-- ── 6. Seed aliases ────────────────────────────────────────
INSERT INTO customs_code_aliases (customs_code_id, alias, language)
SELECT id, unnest(ARRAY['porumb galben','mălai','hurmuz','maize corn']), 'ro'
FROM customs_codes WHERE code = '10059000'
ON CONFLICT DO NOTHING;

INSERT INTO customs_code_aliases (customs_code_id, alias, language)
SELECT id, unnest(ARRAY['grâu','grâu tare','triticum']), 'ro'
FROM customs_codes WHERE code = '10011190'
ON CONFLICT DO NOTHING;
