-- Role-level permission grants and denies.
--
-- Existing role_permissions rows remain grants. A false row is an explicit role
-- deny for regular members, below per-user overrides and above role grants.

ALTER TABLE public.role_permissions
ADD COLUMN IF NOT EXISTS is_granted BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS role_permissions_permission_grant_idx
  ON public.role_permissions(permission_id, is_granted);

COMMENT ON COLUMN public.role_permissions.is_granted IS
  'True grants the permission through the role; false explicitly denies it for regular members unless a per-user grant overrides it.';

CREATE OR REPLACE FUNCTION public.has_permission(tenant UUID, perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.is_superadmin() OR public.is_admin_of(tenant) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      JOIN public.permissions p ON p.id = upo.permission_id
      WHERE upo.user_id = auth.uid()
        AND upo.tenant_id = tenant
        AND upo.is_granted = FALSE
        AND p.key = perm_key
    ) THEN FALSE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      JOIN public.permissions p ON p.id = upo.permission_id
      WHERE upo.user_id = auth.uid()
        AND upo.tenant_id = tenant
        AND upo.is_granted = TRUE
        AND p.key = perm_key
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid()
        AND r.tenant_id = tenant
        AND rp.is_granted = FALSE
        AND p.key = perm_key
    ) THEN FALSE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid()
        AND r.tenant_id = tenant
        AND rp.is_granted = TRUE
        AND p.key = perm_key
    ) THEN TRUE
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.has_permission(UUID, TEXT) IS
  'SECURITY DEFINER function to check tenant-scoped permissions. Owner/admin/superadmin bypass; per-user denies beat grants, per-user grants beat role denies, and role denies beat role grants for regular members.';
