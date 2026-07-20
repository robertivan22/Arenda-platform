-- ============================================================
-- Migration: Farm Members / Multi-User Access System
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. FARM MEMBERS TABLE ────────────────────────────────────
-- Stores farm membership: owner → member relationships.
-- pending = invited but user hasn't accepted yet
-- active  = member has access to the farm
-- suspended = access revoked by owner/admin
CREATE TABLE IF NOT EXISTS farm_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL until invite accepted
  role                text NOT NULL CHECK (role IN ('administrator','contabil','operator','vizualizare')),
  invited_email       text NOT NULL,    -- email used for the invite
  invited_by          uuid REFERENCES auth.users(id),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('active','suspended','pending')),
  section_permissions jsonb NOT NULL DEFAULT
    '{"can_dashboard":true,"can_arendasi":true,"can_contracte":true,"can_parcele":true,
      "can_tranzactii":true,"can_facturi":true,"can_rapoarte":true,"can_declaratii":true,
      "can_fitosanitar":true,"can_setari":false}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One active/pending membership per farm per email
CREATE UNIQUE INDEX IF NOT EXISTS farm_members_unique_email
  ON farm_members(farm_owner_id, lower(invited_email));

-- One active membership per farm per user (enforced when member_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS farm_members_unique_user
  ON farm_members(farm_owner_id, member_id) WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farm_members_owner   ON farm_members(farm_owner_id);
CREATE INDEX IF NOT EXISTS idx_farm_members_member  ON farm_members(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_farm_members_status  ON farm_members(status);

ALTER TABLE farm_members ENABLE ROW LEVEL SECURITY;

-- Owner can see/manage their farm's members
DROP POLICY IF EXISTS "farm_members_owner" ON farm_members;
CREATE POLICY "farm_members_owner"
  ON farm_members FOR ALL
  USING  (farm_owner_id = auth.uid())
  WITH CHECK (farm_owner_id = auth.uid());

-- Admins on a farm can see members (but not delete them without checking role)
DROP POLICY IF EXISTS "farm_members_admin_see" ON farm_members;
CREATE POLICY "farm_members_admin_see"
  ON farm_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM farm_members fm2
      WHERE fm2.farm_owner_id = farm_members.farm_owner_id
        AND fm2.member_id = auth.uid()
        AND fm2.status = 'active'
        AND fm2.role = 'administrator'
    )
  );

-- Member can see their own membership row
DROP POLICY IF EXISTS "farm_members_own_row" ON farm_members;
CREATE POLICY "farm_members_own_row"
  ON farm_members FOR SELECT
  USING (member_id = auth.uid());

-- ── 2. HELPER FUNCTIONS ──────────────────────────────────────

-- Returns true if current user can SELECT data belonging to p_owner_id
CREATE OR REPLACE FUNCTION public.can_access_farm(p_owner_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT
    p_owner_id = auth.uid()  -- owner
    OR EXISTS (
      SELECT 1 FROM farm_members
      WHERE farm_owner_id = p_owner_id
        AND member_id = auth.uid()
        AND status = 'active'
    );
$$;

-- Returns the role of current user in a farm (NULL if not a member)
CREATE OR REPLACE FUNCTION public.farm_member_role_for(p_owner_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT role FROM farm_members
  WHERE farm_owner_id = p_owner_id
    AND member_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- Returns all farm owner IDs the current user can access (own + member farms)
CREATE OR REPLACE FUNCTION public.accessible_farm_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT auth.uid()  -- own farm
  UNION
  SELECT farm_owner_id FROM farm_members
  WHERE member_id = auth.uid() AND status = 'active';
$$;

-- ── 3 & 4. SELECT + WRITE POLICIES (safe — skips tables that don't exist yet) ─

-- Write-permission helper functions (used inside the DO block below)
CREATE OR REPLACE FUNCTION public.can_member_write(p_owner_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM farm_members
    WHERE farm_owner_id = p_owner_id
      AND member_id = auth.uid()
      AND status = 'active'
      AND role IN ('administrator','operator','contabil')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_member_admin(p_owner_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM farm_members
    WHERE farm_owner_id = p_owner_id
      AND member_id = auth.uid()
      AND status = 'active'
      AND role = 'administrator'
  );
$$;

-- Returns all farm owner UUIDs the current member has write access to (used in INSERT WITH CHECK)
CREATE OR REPLACE FUNCTION public.member_writable_farm_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT farm_owner_id FROM farm_members
  WHERE member_id = auth.uid()
    AND status = 'active'
    AND role IN ('administrator','operator','contabil');
$$;

DO $$
DECLARE
  tbl       text;
  col       text;
  pol_sel   text;
  -- (table_name, user_id_column)
  sel_tables text[][] := ARRAY[
    ARRAY['lessors',                    'user_id'],
    ARRAY['contracts',                  'user_id'],
    ARRAY['parcels',                    'user_id'],
    ARRAY['payments',                   'user_id'],
    ARRAY['company_settings',           'user_id'],
    ARRAY['products',                   'user_id'],
    ARRAY['contract_rent_levels',       'user_id'],
    ARRAY['transactions',               'user_id'],
    ARRAY['invoices',                   'user_id'],
    ARRAY['contract_amendments',        'user_id'],
    ARRAY['property_deeds',             'user_id'],
    ARRAY['campaigns',                  'user_id'],
    ARRAY['crop_plans',                 'user_id'],
    ARRAY['machines',                   'user_id'],
    ARRAY['work_orders',                'user_id'],
    ARRAY['work_order_inputs',          'user_id'],
    ARRAY['fuel_logs',                  'user_id'],
    ARRAY['maintenance_tasks',          'user_id'],
    ARRAY['implements',                 'user_id'],
    ARRAY['operators',                  'user_id'],
    ARRAY['harvest_lots',               'user_id'],
    ARRAY['parcel_transactions',        'user_id'],
    ARRAY['arenda_conversions',         'user_id'],
    ARRAY['transaction_distributions',  'user_id'],
    ARRAY['input_invoice_imports',      'user_id'],
    ARRAY['purchase_invoices',          'user_id'],
    ARRAY['stock_movements',            'user_id'],
    ARRAY['efactura_submissions',       'user_id'],
    ARRAY['machine_work_logs',          'user_id'],
    ARRAY['parcele_fitosanitar',        'user_id'],
    ARRAY['contract_files',             'tenant_id']   -- uses tenant_id, not user_id
  ];

  -- Tables with direct user_id for write policies
  write_tables text[] := ARRAY[
    'lessors','contracts','parcels','payments','transactions','invoices',
    'contract_rent_levels','contract_amendments','property_deeds',
    'campaigns','crop_plans','machines','work_orders','work_order_inputs',
    'fuel_logs','maintenance_tasks','implements','operators','harvest_lots',
    'parcel_transactions','arenda_conversions','transaction_distributions',
    'input_invoice_imports','purchase_invoices','stock_movements',
    'efactura_submissions','machine_work_logs','parcele_fitosanitar'
  ];

  -- contract_files uses tenant_id
  contract_files_exists boolean;

  -- item tables (no direct user_id — handled via subquery after main loop)
  iiv_items_exists        boolean;
  purchase_items_exists   boolean;

BEGIN

  -- ── SELECT policies ──────────────────────────────────────────────────────────
  FOR i IN 1..array_length(sel_tables, 1) LOOP
    tbl := sel_tables[i][1];
    col := sel_tables[i][2];
    pol_sel := tbl || '_member_select';

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_sel, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (public.can_access_farm(%I))',
      pol_sel, tbl, col
    );
  END LOOP;

  -- ── input_invoice_import_items SELECT (subquery via parent) ──────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='input_invoice_import_items') THEN
    DROP POLICY IF EXISTS "iiv_items_member_select" ON input_invoice_import_items;
    CREATE POLICY "iiv_items_member_select" ON input_invoice_import_items FOR SELECT
      USING (
        import_id IN (
          SELECT id FROM input_invoice_imports WHERE public.can_access_farm(user_id)
        )
      );
  END IF;

  -- ── purchase_invoice_items SELECT (subquery via parent) ──────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchase_invoice_items') THEN
    DROP POLICY IF EXISTS "purchase_invoice_items_member_select" ON purchase_invoice_items;
    CREATE POLICY "purchase_invoice_items_member_select" ON purchase_invoice_items FOR SELECT
      USING (
        invoice_id IN (
          SELECT id FROM purchase_invoices WHERE public.can_access_farm(user_id)
        )
      );
  END IF;

  -- ── WRITE policies (user_id tables) ─────────────────────────────────────────
  FOREACH tbl IN ARRAY write_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN CONTINUE; END IF;

    -- INSERT
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I;
       CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
         user_id IN (SELECT public.member_writable_farm_ids())
       );',
      tbl || '_member_insert', tbl,
      tbl || '_member_insert', tbl
    );
    -- UPDATE
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I;
       CREATE POLICY %I ON %I FOR UPDATE
         USING (public.can_member_write(user_id))
         WITH CHECK (public.can_member_write(user_id));',
      tbl || '_member_update', tbl,
      tbl || '_member_update', tbl
    );
    -- DELETE (admin only)
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I;
       CREATE POLICY %I ON %I FOR DELETE
         USING (public.can_member_admin(user_id));',
      tbl || '_member_delete', tbl,
      tbl || '_member_delete', tbl
    );
  END LOOP;

  -- ── contract_files write (tenant_id) ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contract_files') THEN
    DROP POLICY IF EXISTS "contract_files_member_insert" ON contract_files;
    CREATE POLICY "contract_files_member_insert" ON contract_files FOR INSERT WITH CHECK (
      tenant_id IN (SELECT public.member_writable_farm_ids())
    );
    DROP POLICY IF EXISTS "contract_files_member_update" ON contract_files;
    CREATE POLICY "contract_files_member_update" ON contract_files FOR UPDATE
      USING (public.can_member_write(tenant_id))
      WITH CHECK (public.can_member_write(tenant_id));
    DROP POLICY IF EXISTS "contract_files_member_delete" ON contract_files;
    CREATE POLICY "contract_files_member_delete" ON contract_files FOR DELETE
      USING (public.can_member_admin(tenant_id));
  END IF;

  -- ── input_invoice_import_items write (subquery via parent) ──────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='input_invoice_import_items') THEN
    DROP POLICY IF EXISTS "iiv_items_member_insert" ON input_invoice_import_items;
    CREATE POLICY "iiv_items_member_insert" ON input_invoice_import_items FOR INSERT WITH CHECK (
      import_id IN (SELECT id FROM input_invoice_imports WHERE user_id IN (SELECT public.member_writable_farm_ids()))
    );
    DROP POLICY IF EXISTS "iiv_items_member_update" ON input_invoice_import_items;
    CREATE POLICY "iiv_items_member_update" ON input_invoice_import_items FOR UPDATE
      USING  (import_id IN (SELECT id FROM input_invoice_imports WHERE public.can_member_write(user_id)))
      WITH CHECK (import_id IN (SELECT id FROM input_invoice_imports WHERE public.can_member_write(user_id)));
  END IF;

  -- ── purchase_invoice_items write (subquery via parent) ───────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='purchase_invoice_items') THEN
    DROP POLICY IF EXISTS "purchase_invoice_items_member_insert" ON purchase_invoice_items;
    CREATE POLICY "purchase_invoice_items_member_insert" ON purchase_invoice_items FOR INSERT WITH CHECK (
      invoice_id IN (SELECT id FROM purchase_invoices WHERE user_id IN (SELECT public.member_writable_farm_ids()))
    );
    DROP POLICY IF EXISTS "purchase_invoice_items_member_update" ON purchase_invoice_items;
    CREATE POLICY "purchase_invoice_items_member_update" ON purchase_invoice_items FOR UPDATE
      USING  (invoice_id IN (SELECT id FROM purchase_invoices WHERE public.can_member_write(user_id)))
      WITH CHECK (invoice_id IN (SELECT id FROM purchase_invoices WHERE public.can_member_write(user_id)));
  END IF;

END
$$;

-- company_settings: members can read (cs_member_select above) but NOT write.
-- Owner writes via the existing cs_user policy.

-- ── 5. AUTO-LINK MEMBER ON FIRST LOGIN ───────────────────────
-- When an invited user signs up / logs in, link their auth.users ID to the
-- pending farm_members row (matched by email).
CREATE OR REPLACE FUNCTION public.link_pending_farm_memberships()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Link any pending invitations for this email
  UPDATE farm_members
  SET member_id = NEW.id, status = 'active', updated_at = now()
  WHERE lower(invited_email) = lower(NEW.email)
    AND status = 'pending'
    AND member_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_farm_link ON auth.users;
CREATE TRIGGER on_auth_user_farm_link
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_pending_farm_memberships();

-- ── 6. ALSO LINK EXISTING USERS (for direct creation flow) ───
-- When member_id is NULL but the email already exists in auth.users, link now.
UPDATE farm_members fm
SET member_id = u.id, status = 'active', updated_at = now()
FROM auth.users u
WHERE lower(fm.invited_email) = lower(u.email)
  AND fm.status = 'pending'
  AND fm.member_id IS NULL;
