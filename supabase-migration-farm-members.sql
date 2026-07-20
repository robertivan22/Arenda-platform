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

-- ── 3. ADD MEMBER SELECT POLICIES (additive — keeps existing owner policies) ─

-- Helper macro: for each table with user_id, we add a "member_select" policy.
-- Pattern: SELECT USING (public.can_access_farm(user_id))

DROP POLICY IF EXISTS "lessors_member_select"   ON lessors;
CREATE POLICY "lessors_member_select"   ON lessors   FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "contracts_member_select" ON contracts;
CREATE POLICY "contracts_member_select" ON contracts FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "parcels_member_select"   ON parcels;
CREATE POLICY "parcels_member_select"   ON parcels   FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "payments_member_select"  ON payments;
CREATE POLICY "payments_member_select"  ON payments  FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "cs_member_select" ON company_settings;
CREATE POLICY "cs_member_select" ON company_settings FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "prod_member_select" ON products;
CREATE POLICY "prod_member_select" ON products FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "crl_member_select" ON contract_rent_levels;
CREATE POLICY "crl_member_select" ON contract_rent_levels FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "txn_member_select" ON transactions;
CREATE POLICY "txn_member_select" ON transactions FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "inv_member_select" ON invoices;
CREATE POLICY "inv_member_select" ON invoices FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "amend_member_select" ON contract_amendments;
CREATE POLICY "amend_member_select" ON contract_amendments FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "deed_member_select" ON property_deeds;
CREATE POLICY "deed_member_select" ON property_deeds FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "campaigns_member_select" ON campaigns;
CREATE POLICY "campaigns_member_select" ON campaigns FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "crop_plans_member_select" ON crop_plans;
CREATE POLICY "crop_plans_member_select" ON crop_plans FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "machines_member_select" ON machines;
CREATE POLICY "machines_member_select" ON machines FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "work_orders_member_select" ON work_orders;
CREATE POLICY "work_orders_member_select" ON work_orders FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "work_order_inputs_member_select" ON work_order_inputs;
CREATE POLICY "work_order_inputs_member_select" ON work_order_inputs FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "fuel_logs_member_select" ON fuel_logs;
CREATE POLICY "fuel_logs_member_select" ON fuel_logs FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "maintenance_member_select" ON maintenance_tasks;
CREATE POLICY "maintenance_member_select" ON maintenance_tasks FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "implements_member_select" ON implements;
CREATE POLICY "implements_member_select" ON implements FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "operators_member_select" ON operators;
CREATE POLICY "operators_member_select" ON operators FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "harvest_lots_member_select" ON harvest_lots;
CREATE POLICY "harvest_lots_member_select" ON harvest_lots FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "parcel_transactions_member_select" ON parcel_transactions;
CREATE POLICY "parcel_transactions_member_select" ON parcel_transactions FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "arenda_conv_member_select" ON arenda_conversions;
CREATE POLICY "arenda_conv_member_select" ON arenda_conversions FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "txn_dist_member_select" ON transaction_distributions;
CREATE POLICY "txn_dist_member_select" ON transaction_distributions FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "contract_files_member_select" ON contract_files;
CREATE POLICY "contract_files_member_select" ON contract_files FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "iiv_imports_member_select" ON input_invoice_imports;
CREATE POLICY "iiv_imports_member_select" ON input_invoice_imports FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "iiv_items_member_select" ON input_invoice_import_items;
CREATE POLICY "iiv_items_member_select" ON input_invoice_import_items FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "purchase_invoices_member_select" ON purchase_invoices;
CREATE POLICY "purchase_invoices_member_select" ON purchase_invoices FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "purchase_invoice_items_member_select" ON purchase_invoice_items;
CREATE POLICY "purchase_invoice_items_member_select" ON purchase_invoice_items FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "stock_movements_member_select" ON stock_movements;
CREATE POLICY "stock_movements_member_select" ON stock_movements FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "efactura_member_select" ON efactura_submissions;
CREATE POLICY "efactura_member_select" ON efactura_submissions FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "machine_work_logs_member_select" ON machine_work_logs;
CREATE POLICY "machine_work_logs_member_select" ON machine_work_logs FOR SELECT
  USING (public.can_access_farm(user_id));

DROP POLICY IF EXISTS "parcele_fitosanitar_member_select" ON parcele_fitosanitar;
CREATE POLICY "parcele_fitosanitar_member_select" ON parcele_fitosanitar FOR SELECT
  USING (public.can_access_farm(user_id));

-- ── 4. WRITE POLICIES FOR MEMBERS ────────────────────────────
-- Members with write roles (administrator, operator, contabil) can insert/update.
-- They MUST set user_id = farm_owner_id in their INSERT.
-- Admins can also delete; read-only (vizualizare) cannot write at all.

-- Helper: is current user a write-access member for this farm owner?
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

-- For INSERT: user_id must equal one of the farms the member has write access to
CREATE OR REPLACE FUNCTION public.member_writable_farm_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT farm_owner_id FROM farm_members
  WHERE member_id = auth.uid()
    AND status = 'active'
    AND role IN ('administrator','operator','contabil');
$$;

-- Apply write policies to the most critical tables.
-- Pattern: INSERT (user_id must be a farm the member can write to)
--          UPDATE/DELETE (must be active write member for that row's farm)

DO $$
DECLARE
  tbl text;
  write_tables text[] := ARRAY[
    'lessors','contracts','parcels','payments','transactions','invoices',
    'contract_rent_levels','contract_amendments','property_deeds',
    'campaigns','crop_plans','machines','work_orders','work_order_inputs',
    'fuel_logs','maintenance_tasks','implements','operators','harvest_lots',
    'parcel_transactions','arenda_conversions','transaction_distributions',
    'contract_files','input_invoice_imports','input_invoice_import_items',
    'purchase_invoices','purchase_invoice_items','stock_movements',
    'efactura_submissions','machine_work_logs','parcele_fitosanitar'
  ];
BEGIN
  FOREACH tbl IN ARRAY write_tables LOOP
    -- INSERT: user_id must be a writable farm
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_insert" ON %I;
       CREATE POLICY "%s_member_insert" ON %I FOR INSERT WITH CHECK (
         user_id IN (SELECT public.member_writable_farm_ids())
       );',
      tbl, tbl, tbl, tbl
    );

    -- UPDATE: must be write member for that row's owner
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_update" ON %I;
       CREATE POLICY "%s_member_update" ON %I FOR UPDATE
         USING  (public.can_member_write(user_id))
         WITH CHECK (public.can_member_write(user_id));',
      tbl, tbl, tbl, tbl
    );

    -- DELETE: only administrator role
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_delete" ON %I;
       CREATE POLICY "%s_member_delete" ON %I FOR DELETE
         USING (public.can_member_admin(user_id));',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END
$$;

-- company_settings: members can read but NOT write (ownership change risk)
-- The owner-managed cs_user policy already handles owner writes.
-- Members should update settings only via the API (server-side validated).

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
