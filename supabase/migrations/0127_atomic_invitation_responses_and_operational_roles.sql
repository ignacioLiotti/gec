-- Keep invitation responses atomic and carry the promised operational role
-- into the accepted membership. This migration is authored for manual
-- application and must not be run automatically.

ALTER TABLE public.roles
  ADD CONSTRAINT roles_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invited_operational_role_id UUID,
  ADD COLUMN IF NOT EXISTS invited_operational_role_name TEXT;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_operational_role_tenant_fk
  FOREIGN KEY (tenant_id, invited_operational_role_id)
  REFERENCES public.roles (tenant_id, id)
  ON DELETE SET NULL (invited_operational_role_id);

CREATE INDEX IF NOT EXISTS invitations_operational_role_idx
  ON public.invitations (invited_operational_role_id)
  WHERE invited_operational_role_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.snapshot_invitation_operational_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  IF NEW.invited_operational_role_id IS NULL THEN
    -- Preserve the promised name when the referenced role is deleted. New
    -- invitations without a role must not be allowed to forge a snapshot.
    IF TG_OP = 'INSERT' OR OLD.invited_operational_role_id IS NULL THEN
      NEW.invited_operational_role_name := NULL;
    END IF;
    RETURN NEW;
  END IF;

  SELECT role.name
  INTO v_role_name
  FROM public.roles role
  WHERE role.id = NEW.invited_operational_role_id
    AND role.tenant_id = NEW.tenant_id;

  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Operational role does not belong to invitation tenant'
      USING ERRCODE = '23503';
  END IF;

  NEW.invited_operational_role_name := v_role_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitations_snapshot_operational_role
  ON public.invitations;
CREATE TRIGGER invitations_snapshot_operational_role
  BEFORE INSERT OR UPDATE OF tenant_id, invited_operational_role_id
  ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_invitation_operational_role();

DROP POLICY IF EXISTS "admins_read_tenant_invitations" ON public.invitations;
CREATE POLICY "users_admin_read_tenant_invitations"
  ON public.invitations
  FOR SELECT
  USING (
    public.is_superadmin()
    OR (
      public.is_member_of(tenant_id)
      AND public.has_permission(tenant_id, 'admin:users')
    )
  );

DROP POLICY IF EXISTS "admins_create_invitations" ON public.invitations;
CREATE POLICY "users_admin_create_invitations"
  ON public.invitations
  FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND status = 'pending'
    AND (
      public.is_superadmin()
      OR (
        public.is_member_of(tenant_id)
        AND public.has_permission(tenant_id, 'admin:users')
      )
    )
    AND (
      invited_role <> 'admin'
      OR public.is_superadmin()
      OR public.is_admin_of(tenant_id)
    )
  );

-- Invitation state is now changed only through the transition RPCs below.
DROP POLICY IF EXISTS "admins_update_invitations" ON public.invitations;

DROP FUNCTION IF EXISTS public.get_invitation_by_token(TEXT);
CREATE FUNCTION public.get_invitation_by_token(invitation_token TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  email TEXT,
  invited_role TEXT,
  invited_operational_role_id UUID,
  invited_operational_role_name TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  inviter_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    invitation.id,
    invitation.tenant_id,
    tenant.name,
    invitation.email,
    invitation.invited_role,
    invitation.invited_operational_role_id,
    invitation.invited_operational_role_name,
    invitation.status,
    invitation.expires_at,
    profile.full_name
  FROM public.invitations invitation
  JOIN public.tenants tenant ON tenant.id = invitation.tenant_id
  LEFT JOIN public.profiles profile ON profile.user_id = invitation.invited_by
  WHERE invitation.token = invitation_token
    AND invitation.status = 'pending'
    AND invitation.expires_at > now();
END;
$$;

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
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

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

CREATE OR REPLACE FUNCTION public.decline_tenant_invitation(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_email TEXT;
  v_invitation_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT lower(trim(account.email))
  INTO v_actor_email
  FROM auth.users account
  WHERE account.id = v_actor_id;

  UPDATE public.invitations invitation
  SET status = 'declined'
  WHERE invitation.token = p_token
    AND invitation.status = 'pending'
    AND invitation.expires_at > now()
    AND lower(trim(invitation.email)) = v_actor_email
  RETURNING invitation.id INTO v_invitation_id;

  IF v_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or email-mismatched invitation'
      USING ERRCODE = '22023';
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_tenant_invitation(p_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT invitation.tenant_id
  INTO v_tenant_id
  FROM public.invitations invitation
  WHERE invitation.id = p_invitation_id
    AND invitation.status = 'pending'
    AND invitation.expires_at > now()
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Pending invitation not found' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_superadmin()
    AND NOT (
      public.is_member_of(v_tenant_id)
      AND public.has_permission(v_tenant_id, 'admin:users')
    ) THEN
    RAISE EXCEPTION 'Insufficient permission to cancel invitation'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.invitations
  SET status = 'cancelled'
  WHERE id = p_invitation_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_invitation_operational_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_tenant_invitation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_tenant_invitation(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_tenant_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_tenant_invitation(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon, authenticated;

COMMENT ON COLUMN public.invitations.invited_operational_role_id IS
  'Optional tenant role assigned atomically when the invitation is accepted.';
COMMENT ON COLUMN public.invitations.invited_operational_role_name IS
  'Immutable display snapshot of the promised operational role.';
COMMENT ON FUNCTION public.decline_tenant_invitation(TEXT) IS
  'Atomically declines a valid invitation for the authenticated recipient email.';
COMMENT ON FUNCTION public.cancel_tenant_invitation(UUID) IS
  'Atomically cancels a pending invitation after tenant-scoped admin authorization.';
