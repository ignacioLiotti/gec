-- Fix permissions table RLS to allow admins/superadmins to manage permissions
-- Currently only SELECT is allowed, blocking all INSERT/UPDATE/DELETE operations

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "admins_insert_permissions" ON public.permissions;
DROP POLICY IF EXISTS "admins_update_permissions" ON public.permissions;
DROP POLICY IF EXISTS "admins_delete_permissions" ON public.permissions;

-- Allow superadmins to insert permissions
CREATE POLICY "admins_insert_permissions" ON public.permissions
  FOR INSERT
  WITH CHECK (
    COALESCE(
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
  );

-- Allow superadmins to update permissions
CREATE POLICY "admins_update_permissions" ON public.permissions
  FOR UPDATE
  USING (
    COALESCE(
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
  )
  WITH CHECK (
    COALESCE(
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
  );

-- Allow superadmins to delete permissions
CREATE POLICY "admins_delete_permissions" ON public.permissions
  FOR DELETE
  USING (
    COALESCE(
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
  );

COMMENT ON POLICY "admins_insert_permissions" ON public.permissions IS 'Superadmins can create new permissions';
COMMENT ON POLICY "admins_update_permissions" ON public.permissions IS 'Superadmins can update permissions';
COMMENT ON POLICY "admins_delete_permissions" ON public.permissions IS 'Superadmins can delete permissions';
