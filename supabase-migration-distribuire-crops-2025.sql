-- ============================================================
-- Migration: Add more crops + updated 2025 prices
-- Run AFTER supabase-migration-distribuire-arenda.sql
-- ============================================================

-- Updated 2025 MADR reference prices for existing crops
INSERT INTO crop_prices (user_id, crop_name, price_per_kg, source, effective_date, notes) VALUES
  (NULL, 'Porumb',            0.92, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Grâu',              1.05, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Floarea-soarelui',  2.05, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Soia',              1.75, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Rapiță',            2.30, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Orz',               0.88, 'MADR', '2025-01-01', 'MADR ref 2025');

-- New crops
INSERT INTO crop_prices (user_id, crop_name, price_per_kg, source, effective_date, notes) VALUES
  (NULL, 'Ovăz',              0.75, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Secară',            0.85, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Triticale',         0.82, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Mazăre',            1.35, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Sfeclă de zahăr',   0.17, 'MADR', '2025-01-01', 'MADR ref 2025'),
  (NULL, 'Lucernă',           0.45, 'MADR', '2025-01-01', 'MADR ref 2025');
