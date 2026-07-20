-- Fix: infinite recursion in farm_members_admin_see policy
-- The original policy had an inline subquery on farm_members which
-- re-triggered RLS on the same table, causing infinite recursion.
-- Replace with a SECURITY DEFINER function call that bypasses RLS.

DROP POLICY IF EXISTS "farm_members_admin_see" ON farm_members;
CREATE POLICY "farm_members_admin_see"
  ON farm_members FOR SELECT
  USING (public.can_member_admin(farm_owner_id));
