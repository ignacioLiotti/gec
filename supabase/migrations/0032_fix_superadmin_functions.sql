-- Fix the superadmin functions to use proper SQL language
-- This patches the broken plpgsql versions from 0027

-- Create or replace the is_admin_of function to include superadmin bypass
CREATE OR REPLACE FUNCTION public.is_admin_of(tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  -- First check if user is superadmin
  SELECT COALESCE(
    (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
    false
  ) OR EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = tenant
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin')
  );
$$;

-- Create or replace the has_permission function to include superadmin bypass
CREATE OR REPLACE FUNCTION public.has_permission(tenant UUID, perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  -- Superadmin check OR Owner/Admin of tenant have all permissions
  SELECT
    COALESCE(
      -- Check if superadmin
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
    OR COALESCE(
      (
        SELECT true WHERE public.is_admin_of(tenant)
      )
      OR (
        -- Direct user permission grant
        EXISTS (
          SELECT 1
          FROM public.user_permission_overrides upo
          JOIN public.permissions p ON p.id = upo.permission_id
          WHERE upo.user_id = auth.uid() AND upo.is_granted = true AND p.key = perm_key
        )
      )
      OR (
        -- Through any role assigned to user, scoped to this tenant
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          JOIN public.role_permissions rp ON rp.role_id = r.id
          JOIN public.permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = auth.uid()
            AND (r.tenant_id = tenant)
            AND p.key = perm_key
        )
      )
    , false);
$$;

-- Create or replace the is_member_of function to include superadmin bypass
CREATE OR REPLACE FUNCTION public.is_member_of(tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
    false
  ) OR EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.tenant_id = tenant
      AND m.user_id = auth.uid()
  );
$$;

-- Add RLS policy to allow superadmin to insert memberships
DROP POLICY IF EXISTS "superadmin_can_insert_memberships" ON public.memberships;
CREATE POLICY "superadmin_can_insert_memberships" ON public.memberships
  FOR INSERT
  WITH CHECK (
    COALESCE(
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
  );

-- Add RLS policy to allow superadmin to update memberships
DROP POLICY IF EXISTS "superadmin_can_update_memberships" ON public.memberships;
CREATE POLICY "superadmin_can_update_memberships" ON public.memberships
  FOR UPDATE
  USING (
    COALESCE(
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
  );
