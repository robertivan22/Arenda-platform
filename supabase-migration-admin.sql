-- ============================================================
-- Admin Migration: profiles, user_permissions, document_templates
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/hsaomcgssyyxroezhgcp/sql/new
-- ============================================================

-- 1. PROFILES TABLE
-- Mirrors auth.users, auto-created on signup via trigger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  display_name  TEXT,
  is_admin      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Back-fill existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Trigger: auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to check admin status (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles"
  ON public.profiles FOR UPDATE USING (public.is_admin_user());

-- ============================================================
-- 2. USER PERMISSIONS TABLE
-- One row per user, boolean per section. NULL row = all allowed.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  can_dashboard  BOOLEAN DEFAULT TRUE,
  can_arendasi   BOOLEAN DEFAULT TRUE,
  can_contracte  BOOLEAN DEFAULT TRUE,
  can_parcele    BOOLEAN DEFAULT TRUE,
  can_tranzactii BOOLEAN DEFAULT TRUE,
  can_facturi    BOOLEAN DEFAULT TRUE,
  can_rapoarte   BOOLEAN DEFAULT TRUE,
  can_declaratii BOOLEAN DEFAULT TRUE,
  can_setari     BOOLEAN DEFAULT TRUE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own permissions" ON public.user_permissions;
CREATE POLICY "Users read own permissions"
  ON public.user_permissions FOR SELECT USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Admins manage all permissions" ON public.user_permissions;
CREATE POLICY "Admins manage all permissions"
  ON public.user_permissions FOR ALL USING (public.is_admin_user());

DROP POLICY IF EXISTS "Users insert own permissions" ON public.user_permissions;
CREATE POLICY "Users insert own permissions"
  ON public.user_permissions FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. DOCUMENT TEMPLATES TABLE
-- user_id = NULL  → system default template
-- user_id = UUID  → user-specific override
-- One active template per (user_id, doc_type) pair.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = system default
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('CONTRACT', 'FACTURA', 'AVIZ')),
  name            TEXT NOT NULL,
  html_content    TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- One template per user per doc type (system defaults: user_id IS NULL treated as one per type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_user_doctype
  ON public.document_templates (COALESCE(user_id::TEXT, 'system'), doc_type);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own and system templates" ON public.document_templates;
CREATE POLICY "Users read own and system templates"
  ON public.document_templates FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL OR public.is_admin_user());

DROP POLICY IF EXISTS "Admins manage all templates" ON public.document_templates;
CREATE POLICY "Admins manage all templates"
  ON public.document_templates FOR ALL USING (public.is_admin_user());

-- ============================================================
-- 4. MAKE YOURSELF ADMIN
-- Replace the email below with YOUR Supabase account email,
-- then run this block AFTER the tables above are created.
-- ============================================================
UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'robert.ivan@lseg.com'; -- ← CHANGE THIS TO YOUR EMAIL

-- ============================================================
-- 5. INSERT SYSTEM DEFAULT TEMPLATE PLACEHOLDERS
-- These are reference rows; actual HTML is managed via Admin UI.
-- ============================================================
INSERT INTO public.document_templates (user_id, doc_type, name, html_content, is_active)
VALUES
  (NULL, 'CONTRACT', 'Default Contract', '<!-- System default: uses built-in JSX template -->', TRUE),
  (NULL, 'FACTURA',  'Default Factura',  '<!-- System default: uses built-in JSX template -->', TRUE),
  (NULL, 'AVIZ',     'Default Aviz',     '<!-- System default: uses built-in JSX template -->', TRUE)
ON CONFLICT DO NOTHING;
