-- Restore role deny precedence after tenant-scoped override migration 0125.
-- Per-user overrides keep precedence over role permissions.

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
