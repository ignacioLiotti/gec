-- Tenant-scoped user permission overrides with explicit deny precedence.
--
-- Existing override rows did not carry tenant_id, so they behaved globally for a
-- user. Preserve that behavior during migration by copying each legacy row to
-- every tenant membership for that user, then make future rows tenant-scoped.

ALTER TABLE public.user_permission_overrides
ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE public.user_permission_overrides
DROP CONSTRAINT IF EXISTS user_permission_overrides_pkey;

INSERT INTO public.user_permission_overrides (
  user_id,
  tenant_id,
  permission_id,
  is_granted,
  created_at
)
SELECT
  upo.user_id,
  m.tenant_id,
  upo.permission_id,
  upo.is_granted,
  upo.created_at
FROM public.user_permission_overrides upo
JOIN public.memberships m ON m.user_id = upo.user_id
WHERE upo.tenant_id IS NULL
  AND m.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permission_overrides existing
    WHERE existing.user_id = upo.user_id
      AND existing.tenant_id = m.tenant_id
      AND existing.permission_id = upo.permission_id
  );

DELETE FROM public.user_permission_overrides
WHERE tenant_id IS NULL;

DELETE FROM public.user_permission_overrides a
USING public.user_permission_overrides b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.tenant_id = b.tenant_id
  AND a.permission_id = b.permission_id;

ALTER TABLE public.user_permission_overrides
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.user_permission_overrides
DROP CONSTRAINT IF EXISTS user_permission_overrides_tenant_id_fkey;

ALTER TABLE public.user_permission_overrides
ADD CONSTRAINT user_permission_overrides_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES public.tenants(id)
ON DELETE CASCADE;

ALTER TABLE public.user_permission_overrides
ADD CONSTRAINT user_permission_overrides_pkey
PRIMARY KEY (user_id, tenant_id, permission_id);

CREATE INDEX IF NOT EXISTS user_permission_overrides_tenant_user_idx
  ON public.user_permission_overrides(tenant_id, user_id);

DROP POLICY IF EXISTS "read overrides" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "read overrides in tenant" ON public.user_permission_overrides;
CREATE POLICY "read overrides in tenant"
  ON public.user_permission_overrides
  FOR SELECT
  USING (public.is_member_of(tenant_id));

DROP POLICY IF EXISTS "manage overrides in tenant" ON public.user_permission_overrides;
CREATE POLICY "manage overrides in tenant"
  ON public.user_permission_overrides
  FOR ALL
  USING (public.is_admin_of(tenant_id))
  WITH CHECK (
    public.is_admin_of(tenant_id)
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = user_permission_overrides.user_id
        AND m.tenant_id = user_permission_overrides.tenant_id
    )
  );

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
        AND p.key = perm_key
    ) THEN TRUE
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.has_permission(UUID, TEXT) IS
  'SECURITY DEFINER function to check tenant-scoped permissions. Owner/admin/superadmin bypass; explicit per-user deny beats grants for regular members.';
