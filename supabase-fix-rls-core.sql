-- ═══════════════════════════════════════════════════════════════════════════
-- FIX CRITIC: Activează RLS pe tabelele principale (parcels, lessors,
-- contracts, payments, parcele_fitosanitar).
-- Dacă nu este rulat, orice utilizator autentificat poate citi/modifica
-- datele tuturor utilizatorilor!
--
-- Rulează în: Supabase → SQL Editor → New query → Run
-- Este idempotent — poate fi rulat de mai multe ori fără probleme.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Activează RLS ────────────────────────────────────────────────────────
ALTER TABLE lessors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcele_fitosanitar ENABLE ROW LEVEL SECURITY;

-- ─── 2. user_id DEFAULT auth.uid() ───────────────────────────────────────────
-- Permite INSERT fără a trimite explicit user_id din client.
ALTER TABLE parcels   ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE lessors   ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE contracts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE payments  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ─── 3. Politici RLS — parcels ───────────────────────────────────────────────
DROP POLICY IF EXISTS "parcels_own"   ON parcels;
DROP POLICY IF EXISTS "parcels_select" ON parcels;
DROP POLICY IF EXISTS "parcels_insert" ON parcels;
DROP POLICY IF EXISTS "parcels_update" ON parcels;
DROP POLICY IF EXISTS "parcels_delete" ON parcels;
CREATE POLICY "parcels_own" ON parcels
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 4. Politici RLS — lessors ───────────────────────────────────────────────
DROP POLICY IF EXISTS "lessors_own"   ON lessors;
DROP POLICY IF EXISTS "lessors_select" ON lessors;
CREATE POLICY "lessors_own" ON lessors
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 5. Politici RLS — contracts ─────────────────────────────────────────────
DROP POLICY IF EXISTS "contracts_own"   ON contracts;
DROP POLICY IF EXISTS "contracts_select" ON contracts;
CREATE POLICY "contracts_own" ON contracts
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. Politici RLS — payments ──────────────────────────────────────────────
DROP POLICY IF EXISTS "payments_own"   ON payments;
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_own" ON payments
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 7. Politici RLS — parcele_fitosanitar ───────────────────────────────────
DROP POLICY IF EXISTS "Users manage own parcele_fitosanitar" ON parcele_fitosanitar;
DROP POLICY IF EXISTS "parcele_fitosanitar_own" ON parcele_fitosanitar;
CREATE POLICY "parcele_fitosanitar_own" ON parcele_fitosanitar
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 8. Verificare finală (rezultatele trebuie să arate 'row_security = on') ─
SELECT
  relname          AS "Tabel",
  relrowsecurity   AS "RLS activ",
  relforcerowsecurity AS "Force RLS"
FROM pg_class
WHERE relname IN ('parcels','lessors','contracts','payments','parcele_fitosanitar')
ORDER BY relname;
