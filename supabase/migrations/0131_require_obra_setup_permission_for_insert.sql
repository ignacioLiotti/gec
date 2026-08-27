-- Keep obra creation aligned with the permission required to materialize defaults.
-- Without this, a tenant member can create an obra that cannot finish setup.

BEGIN;

DROP POLICY IF EXISTS "insert obras in tenant" ON public.obras;
DROP POLICY IF EXISTS "Users can insert obras in their tenant" ON public.obras;
DROP POLICY IF EXISTS "Users can insert obras with edit permission" ON public.obras;
DROP POLICY IF EXISTS "Users can insert obras with setup permission" ON public.obras;

CREATE POLICY "Users can insert obras with setup permission"
  ON public.obras
  FOR INSERT
  WITH CHECK (
    public.has_permission(tenant_id, 'obras:edit')
    OR public.has_permission(tenant_id, 'admin:obra-defaults')
  );

COMMIT;
