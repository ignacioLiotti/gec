-- Create a superadmin user with all permissions
-- User ID: 77b936fb-3e92-4180-b601-15c31125811e

-- Add a superadmin column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- Mark the specific user as superadmin
UPDATE public.profiles
SET is_superadmin = true
WHERE user_id = '77b936fb-3e92-4180-b601-15c31125811e';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = '77b936fb-3e92-4180-b601-15c31125811e'
  ) THEN
    INSERT INTO public.profiles (user_id, is_superadmin)
    VALUES ('77b936fb-3e92-4180-b601-15c31125811e', true)
    ON CONFLICT (user_id) DO UPDATE SET is_superadmin = true;
  END IF;
END;
$$;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = '77b936fb-3e92-4180-b601-15c31125811e'
  ) THEN
    -- Ensure the superadmin user is an owner in all existing tenants
    INSERT INTO public.memberships (tenant_id, user_id, role)
    SELECT t.id, '77b936fb-3e92-4180-b601-15c31125811e', 'owner'
    FROM public.tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = t.id
        AND m.user_id = '77b936fb-3e92-4180-b601-15c31125811e'
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
  END IF;
END;
$$;

-- Create a trigger to automatically add superadmin as owner to new tenants
CREATE OR REPLACE FUNCTION add_superadmin_to_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add superadmin user as owner to the new tenant, if the superadmin user exists
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = '77b936fb-3e92-4180-b601-15c31125811e'
  ) THEN
    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (NEW.id, '77b936fb-3e92-4180-b601-15c31125811e', 'owner')
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS add_superadmin_to_tenant ON public.tenants;
CREATE TRIGGER add_superadmin_to_tenant
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION add_superadmin_to_new_tenant();

COMMENT ON COLUMN public.profiles.is_superadmin IS 'Superadmin users bypass all permission checks and are automatically owners of all tenants';
COMMENT ON FUNCTION add_superadmin_to_new_tenant() IS 'Automatically adds superadmin users as owners to newly created tenants';
