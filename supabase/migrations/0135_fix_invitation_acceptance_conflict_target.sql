-- Approved by the user on 2026-10-20 for a new disposable local verification stack.
-- Source proposal: plans/2026-10-20-workflow-qa/invitation-rpc-proposal.sql

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
RETURNS TABLE (tenant_id UUID, tenant_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_email TEXT;
  v_invitation public.invitations%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT lower(trim(account.email))
  INTO v_actor_email
  FROM auth.users account
  WHERE account.id = v_actor_id;

  SELECT invitation.*
  INTO v_invitation
  FROM public.invitations invitation
  WHERE invitation.token = p_token
    AND invitation.status = 'pending'
    AND invitation.expires_at > now()
    AND lower(trim(invitation.email)) = v_actor_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or email-mismatched invitation'
      USING ERRCODE = '22023';
  END IF;

  IF v_invitation.invited_operational_role_id IS NULL
    AND v_invitation.invited_operational_role_name IS NOT NULL THEN
    RAISE EXCEPTION 'Promised operational role is no longer available'
      USING ERRCODE = '22023';
  END IF;

  IF v_invitation.invited_operational_role_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.roles role
      WHERE role.id = v_invitation.invited_operational_role_id
        AND role.tenant_id = v_invitation.tenant_id
    ) THEN
    RAISE EXCEPTION 'Operational role does not belong to invitation tenant'
      USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (
    v_invitation.tenant_id,
    v_actor_id,
    v_invitation.invited_role::public.membership_role
  )
  ON CONFLICT ON CONSTRAINT memberships_pkey DO NOTHING;

  IF v_invitation.invited_operational_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_actor_id, v_invitation.invited_operational_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  UPDATE public.invitations
  SET
    status = 'accepted',
    accepted_at = now(),
    accepted_by = v_actor_id
  WHERE id = v_invitation.id;

  RETURN QUERY
  SELECT tenant.id, tenant.name
  FROM public.tenants tenant
  WHERE tenant.id = v_invitation.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT) TO authenticated;
