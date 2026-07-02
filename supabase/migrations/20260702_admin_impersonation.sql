-- ═══════════════════════════════════════════════════════════════════════════════
-- ArendaPro: Admin Impersonation — Full Control
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Notă despre coloana `scope` ─────────────────────────────────────────────
-- Coloana `scope` este PĂSTRATĂ în tabelă exclusiv pentru compatibilitate
-- istorică și auditabilitate. Ea NU mai este citită de nicio logică de
-- autorizare în aplicație.
-- La inserare, valoarea este ÎNTOTDEAUNA hardcodată la 'full_control'.
-- Adminul are control complet, identic cu cel al utilizatorului impersonat.
-- Singurele restricții rămase sunt: (1) RLS Supabase al userului respectiv,
-- (2) lista PROTECTED_ROUTES_DURING_IMPERSONATION din middleware, și
-- (3) redactarea automată a câmpurilor sensibile din răspunsurile API.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Sesiuni de impersonare ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason                      TEXT        NOT NULL CHECK (char_length(reason) >= 10),

  -- scope: păstrat doar istoric; valoarea funcțională este întotdeauna 'full_control'
  scope                       TEXT        NOT NULL DEFAULT 'full_control'
                                CHECK (scope IN ('read_only', 'read_write', 'full_control')),

  started_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  ended_at                    TIMESTAMPTZ,

  ip_address                  TEXT,
  user_agent                  TEXT,

  -- Refresh token-ul adminului, criptat AES-256-GCM, pentru restaurarea sesiunii
  admin_refresh_token_encrypted TEXT
);

-- ── 2. Audit log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_impersonation_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES admin_impersonation_sessions(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,   -- HTTP method: GET/POST/PUT/PATCH/DELETE
  resource    TEXT        NOT NULL,   -- pathname-ul requestului
  record_id   TEXT,                   -- ID-ul resursei, dacă e disponibil
  detail      JSONB,                  -- body-ul requestului după redactare
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_impersonation_audit_log ENABLE ROW LEVEL SECURITY;

-- Doar adminii pot citi/scrie (verificat și server-side prin service_role)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_impersonation_sessions' AND policyname = 'impersonation_admin_only') THEN
    CREATE POLICY "impersonation_admin_only" ON admin_impersonation_sessions
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_impersonation_audit_log' AND policyname = 'audit_log_admin_only') THEN
    CREATE POLICY "audit_log_admin_only" ON admin_impersonation_audit_log
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- ── 4. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_impersonation_admin     ON admin_impersonation_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target    ON admin_impersonation_sessions (target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_active    ON admin_impersonation_sessions (expires_at, ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_session       ON admin_impersonation_audit_log (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created       ON admin_impersonation_audit_log (created_at DESC);
