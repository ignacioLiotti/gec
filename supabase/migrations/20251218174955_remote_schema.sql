drop extension if exists "pg_net";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_superadmin_to_new_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.expire_old_invitations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invitation_token text)
 RETURNS TABLE(id uuid, tenant_id uuid, tenant_name text, email text, invited_role text, status text, expires_at timestamp with time zone, inviter_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.tenant_id,
    t.name as tenant_name,
    i.email,
    i.invited_role,
    i.status,
    i.expires_at,
    p.full_name as inviter_name
  FROM public.invitations i
  JOIN public.tenants t ON i.tenant_id = t.id
  LEFT JOIN public.profiles p ON i.invited_by = p.user_id
  WHERE i.token = invitation_token
    AND i.status = 'pending'
    AND i.expires_at > now();
END;
$function$
;


