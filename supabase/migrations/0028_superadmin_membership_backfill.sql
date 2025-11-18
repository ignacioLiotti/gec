-- Ensure the default tenant exists
INSERT INTO public.tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = '77b936fb-3e92-4180-b601-15c31125811e'
  ) THEN
    -- Backfill membership for the hardcoded superadmin user in every tenant
    INSERT INTO public.memberships (tenant_id, user_id, role)
    SELECT t.id, '77b936fb-3e92-4180-b601-15c31125811e', 'owner'
    FROM public.tenants t
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.tenant_id = t.id
        AND m.user_id = '77b936fb-3e92-4180-b601-15c31125811e'
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
  END IF;
END;
$$;

-- Ensure the user keeps owner membership whenever memberships change
CREATE OR REPLACE FUNCTION public.ensure_superadmin_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id = '77b936fb-3e92-4180-b601-15c31125811e' THEN
    NEW.role := 'owner';
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_superadmin_role ON public.memberships;
CREATE TRIGGER enforce_superadmin_role
  BEFORE INSERT OR UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_superadmin_membership();
