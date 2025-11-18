-- Create function to check if an email is already a member of a tenant
-- This allows checking membership by email instead of user_id

CREATE OR REPLACE FUNCTION public.is_email_member_of_tenant(
  tenant_id_param UUID,
  email_param TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN auth.users u ON m.user_id = u.id
    WHERE m.tenant_id = tenant_id_param
      AND LOWER(u.email) = LOWER(email_param)
  );
$$;

COMMENT ON FUNCTION public.is_email_member_of_tenant(UUID, TEXT) IS 'Check if an email address is already a member of a tenant';
