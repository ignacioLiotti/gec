-- Fix stack depth errors by making helper functions SECURITY DEFINER
-- This allows them to bypass RLS and prevent circular dependencies

-- Update is_member_of to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_member_of(tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER -- This bypasses RLS when checking memberships/profiles
SET search_path = public, pg_temp
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

-- Update is_admin_of to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin_of(tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER -- This bypasses RLS when checking memberships/profiles
SET search_path = public, pg_temp
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

-- Update has_permission to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_permission(tenant UUID, perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER -- This bypasses RLS to prevent recursion
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.is_member_of(UUID) IS
  'SECURITY DEFINER function to check tenant membership without triggering RLS recursion';
COMMENT ON FUNCTION public.is_admin_of(UUID) IS
  'SECURITY DEFINER function to check admin status without triggering RLS recursion';
COMMENT ON FUNCTION public.has_permission(UUID, TEXT) IS
  'SECURITY DEFINER function to check permissions without triggering RLS recursion';
