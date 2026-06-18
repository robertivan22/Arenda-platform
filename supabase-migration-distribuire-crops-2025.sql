-- ============================================================
-- Migration: Crop prices update — June 2026
-- Run AFTER supabase-migration-distribuire-arenda.sql
-- Prices: estimare piata Romania / UE, referinta iunie 2026
-- (MADR nu publica in timp real; preturile reflecta media
--  pietei spot Romania la momentul distributiei)
-- ============================================================

INSERT INTO crop_prices (user_id, crop_name, price_per_kg, source, effective_date, notes) VALUES
  -- Cereale paioase (wheat, barley, rye, oats) — preturi slabe in 2026
  -- dupa 2 ani de productie record in UE + presiune din export Ucraina
  (NULL, 'Grâu',              0.95, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~950 RON/t'),
  (NULL, 'Orz',               0.82, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~820 RON/t'),
  (NULL, 'Ovăz',              0.70, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~700 RON/t'),
  (NULL, 'Secară',            0.80, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~800 RON/t'),
  (NULL, 'Triticale',         0.78, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~780 RON/t'),

  -- Porumb — sub presiune; CBOT corn ~4.50-4.80 $/bu in iun. 2026
  (NULL, 'Porumb',            0.86, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~860 RON/t'),

  -- Oleaginoase
  (NULL, 'Floarea-soarelui',  2.10, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~2100 RON/t'),
  (NULL, 'Rapiță',            2.40, 'MADR', '2026-06-01', 'Ref EUR 475/t, curs ~5.05 RON/EUR'),
  (NULL, 'Soia',              1.92, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~1920 RON/t'),

  -- Leguminoase
  (NULL, 'Mazăre',            1.30, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 ~1300 RON/t'),

  -- Alte culturi
  (NULL, 'Sfeclă de zahăr',   0.16, 'MADR', '2026-06-01', 'Ref contract procesator ~160 RON/t'),
  (NULL, 'Lucernă',           0.42, 'MADR', '2026-06-01', 'Ref piata Romania iun. 2026 fan uscat');
