-- Fix user_roles RLS policy to avoid circular dependency with is_admin_of()
-- The previous policy called is_admin_of() which created infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "read user_roles in tenant" ON public.user_roles;

-- Create a simpler policy that doesn't call is_admin_of()
-- Users can read their own role assignments
CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Superadmins can read all role assignments
CREATE POLICY "superadmins_read_all_roles" ON public.user_roles
  FOR SELECT
  USING (
    COALESCE(
      (SELECT p.is_superadmin FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
      false
    )
  );

COMMENT ON POLICY "users_read_own_roles" ON public.user_roles IS 'Users can read their own role assignments';
COMMENT ON POLICY "superadmins_read_all_roles" ON public.user_roles IS 'Superadmins can read all role assignments';
