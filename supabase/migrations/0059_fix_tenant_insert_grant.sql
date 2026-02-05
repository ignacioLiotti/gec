-- Ensure authenticated users can insert tenants (fix missing grant)
-- The policy exists but the grant may not have been applied

GRANT INSERT ON public.tenants TO authenticated;

-- Also ensure the policy is correctly set
DROP POLICY IF EXISTS "insert tenants" ON public.tenants;
CREATE POLICY "insert tenants" ON public.tenants
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
