-- ============================================================
-- Fitosanitar Migration
-- Registru de Evidență a Tratamentelor cu Produse de Protecție a Plantelor
--
-- Legal basis:
--   OG nr. 4/1995 privind fabricarea, comercializarea și utilizarea
--     produselor de uz fitosanitar
--   Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023
--   EU Regulation on sustainable use of plant protection products
--   APIA ecocondiționality requirements (SMR 7 și SMR 8)
--
-- Run in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/<your-project>/sql/new
-- ============================================================


-- ============================================================
-- 1. REGISTRU FITOSANITAR
--    One row = one phytosanitary treatment event.
--    Append-only (is_deleted soft-flag, no hard deletes).
--    The numar_inregistrare sequence is per-user via trigger.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registru_fitosanitar (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Entry metadata
  numar_inregistrare       INTEGER     NOT NULL,  -- sequential per user (set by trigger)
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 1. Data efectuării tratamentului
  data_tratament           DATE        NOT NULL,

  -- 2. Cultură și teren
  cultura                  TEXT        NOT NULL,
  parcela_id               UUID,       -- soft reference; no FK (parcele table managed separately)
  locul_terenului          TEXT        NOT NULL,
  nr_parcela               TEXT,
  judet                    TEXT,

  -- 3. Fenofaza (BBCH)
  bbch_code                TEXT        NOT NULL,
  bbch_descriere           TEXT        NOT NULL,

  -- 4. Agentul de dăunare
  tip_agent                TEXT        NOT NULL
                             CHECK (tip_agent IN ('boala','daunator','buruiana','mixt')),
  agent_daunare            TEXT        NOT NULL,

  -- 5. Produsul de Protecție a Plantelor (PPP)
  denumire_produs          TEXT        NOT NULL,
  substanta_activa         TEXT,
  nr_omologare             TEXT,

  -- 6. Doze
  doza_omologata_min       NUMERIC(10,3),
  doza_omologata_max       NUMERIC(10,3),
  doza_folosita            NUMERIC(10,3) NOT NULL CHECK (doza_folosita > 0),
  unitate_doza             TEXT        NOT NULL DEFAULT 'l/ha'
                             CHECK (unitate_doza IN ('l/ha','kg/ha','g/ha','ml/ha')),

  -- 7. Suprafața tratată
  suprafata_tratata        NUMERIC(10,4) NOT NULL CHECK (suprafata_tratata > 0),

  -- 8. Cantitate utilizată
  cantitate_utilizata      NUMERIC(10,3) NOT NULL CHECK (cantitate_utilizata > 0),
  unitate_cantitate        TEXT        NOT NULL DEFAULT 'litri'
                             CHECK (unitate_cantitate IN ('litri','kg')),

  -- 9. Persoana responsabilă
  nume_prenume_responsabil TEXT        NOT NULL,
  semnatura_url            TEXT,

  -- 10. Date recoltare (PHI)
  data_incepere_recoltare  DATE,
  phi_zile                 INTEGER,

  -- 11. Document dare în consum
  numar_document           TEXT,
  data_document            DATE,

  -- 12. Informații suplimentare
  conditii_meteo           TEXT,
  echipament_utilizat      TEXT,
  observatii               TEXT,

  -- Audit / soft-delete
  is_deleted               BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at               TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT chk_data_recoltare_dupa_tratament CHECK (
    data_incepere_recoltare IS NULL
    OR data_incepere_recoltare > data_tratament
  ),
  CONSTRAINT chk_numar_inregistrare_pozitiv CHECK (numar_inregistrare > 0)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fitosanitar_user_id
  ON public.registru_fitosanitar (user_id);

CREATE INDEX IF NOT EXISTS idx_fitosanitar_user_data
  ON public.registru_fitosanitar (user_id, data_tratament DESC);

CREATE INDEX IF NOT EXISTS idx_fitosanitar_cultura
  ON public.registru_fitosanitar (user_id, cultura);

CREATE INDEX IF NOT EXISTS idx_fitosanitar_not_deleted
  ON public.registru_fitosanitar (user_id, is_deleted)
  WHERE is_deleted = FALSE;

-- Unique entry number per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_fitosanitar_numar_per_user
  ON public.registru_fitosanitar (user_id, numar_inregistrare);


-- ============================================================
-- 2. AUTO-INCREMENT numar_inregistrare PER USER (trigger)
--    Each user's register starts at 1 and increments independently.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_fitosanitar_numar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(numar_inregistrare), 0) + 1
    INTO v_next
    FROM public.registru_fitosanitar
   WHERE user_id = NEW.user_id;

  NEW.numar_inregistrare := v_next;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fitosanitar_numar ON public.registru_fitosanitar;
CREATE TRIGGER trg_fitosanitar_numar
  BEFORE INSERT ON public.registru_fitosanitar
  FOR EACH ROW
  WHEN (NEW.numar_inregistrare IS NULL OR NEW.numar_inregistrare = 0)
  EXECUTE FUNCTION public.set_fitosanitar_numar();


-- ============================================================
-- 3. updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fitosanitar_updated_at ON public.registru_fitosanitar;
CREATE TRIGGER trg_fitosanitar_updated_at
  BEFORE UPDATE ON public.registru_fitosanitar
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.registru_fitosanitar ENABLE ROW LEVEL SECURITY;

-- Users see and manage only their own entries
DROP POLICY IF EXISTS "Users manage own fitosanitar entries" ON public.registru_fitosanitar;
CREATE POLICY "Users manage own fitosanitar entries"
  ON public.registru_fitosanitar
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins see everything (uses the is_admin_user() function from admin migration)
DROP POLICY IF EXISTS "Admins see all fitosanitar entries" ON public.registru_fitosanitar;
CREATE POLICY "Admins see all fitosanitar entries"
  ON public.registru_fitosanitar
  FOR ALL
  USING (public.is_admin_user());


-- ============================================================
-- 5. AUDIT LOG
--    Immutable append-only log for every change to the register.
--    Required for APIA/ANFDF inspection compliance.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fitosanitar_audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   UUID        REFERENCES public.registru_fitosanitar(id) ON DELETE SET NULL,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fitosanitar_audit_entry
  ON public.fitosanitar_audit_log (entry_id);

CREATE INDEX IF NOT EXISTS idx_fitosanitar_audit_user
  ON public.fitosanitar_audit_log (user_id, changed_at DESC);

-- Audit log: admins read, no direct user writes (written only by trigger)
ALTER TABLE public.fitosanitar_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log" ON public.fitosanitar_audit_log;
CREATE POLICY "Admins read audit log"
  ON public.fitosanitar_audit_log
  FOR SELECT
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Users read own audit log" ON public.fitosanitar_audit_log;
CREATE POLICY "Users read own audit log"
  ON public.fitosanitar_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================
-- 6. AUDIT TRIGGER
--    Fires on INSERT / UPDATE / DELETE and writes to audit_log.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fitosanitar_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.fitosanitar_audit_log (entry_id, user_id, action, new_values)
    VALUES (NEW.id, NEW.user_id, 'INSERT', to_jsonb(NEW));
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.fitosanitar_audit_log (entry_id, user_id, action, old_values, new_values)
    VALUES (NEW.id, NEW.user_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.fitosanitar_audit_log (entry_id, user_id, action, old_values)
    VALUES (OLD.id, OLD.user_id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_fitosanitar_audit ON public.registru_fitosanitar;
CREATE TRIGGER trg_fitosanitar_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.registru_fitosanitar
  FOR EACH ROW
  EXECUTE FUNCTION public.fitosanitar_audit_trigger();


-- ============================================================
-- 7. HELPER VIEW — active entries (non-deleted)
--    Use this in reports / exports instead of querying the table
--    directly with is_deleted = false every time.
-- ============================================================
CREATE OR REPLACE VIEW public.registru_fitosanitar_activ AS
SELECT *
  FROM public.registru_fitosanitar
 WHERE is_deleted = FALSE;


-- ============================================================
-- DONE — verify with:
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
--
-- Expected new tables:
--   registru_fitosanitar
--   fitosanitar_audit_log
--
-- Expected new view:
--   registru_fitosanitar_activ
-- ============================================================
