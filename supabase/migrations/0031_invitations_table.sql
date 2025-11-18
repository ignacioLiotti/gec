-- Create invitations table for tenant invitation flow
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_role TEXT NOT NULL DEFAULT 'member' CHECK (invited_role IN ('member', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_invitation_token ON public.invitations(token) WHERE status = 'pending';

-- Prevent duplicate pending invitations for same email to same tenant (partial unique index)
CREATE UNIQUE INDEX unique_pending_invite ON public.invitations(tenant_id, email)
  WHERE status = 'pending';
CREATE INDEX idx_invitation_tenant_email ON public.invitations(tenant_id, email);
CREATE INDEX idx_invitation_status ON public.invitations(status);
CREATE INDEX idx_invitation_expires_at ON public.invitations(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admins can read all invitations for their tenant
CREATE POLICY "admins_read_tenant_invitations" ON public.invitations
  FOR SELECT
  USING (public.is_admin_of(tenant_id));

-- Admins can create invitations for their tenant
CREATE POLICY "admins_create_invitations" ON public.invitations
  FOR INSERT
  WITH CHECK (
    public.is_admin_of(tenant_id)
    AND invited_by = auth.uid()
    AND status = 'pending'
  );

-- Admins can update (cancel) their own invitations
CREATE POLICY "admins_update_invitations" ON public.invitations
  FOR UPDATE
  USING (public.is_admin_of(tenant_id))
  WITH CHECK (public.is_admin_of(tenant_id));

-- Users can read their own pending invitations by email
CREATE POLICY "users_read_own_invitations" ON public.invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
    AND expires_at > now()
  );

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= now();
END;
$$;

-- Create a helper function to get invitation details by token (public access)
CREATE OR REPLACE FUNCTION get_invitation_by_token(invitation_token TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  email TEXT,
  invited_role TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  inviter_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

COMMENT ON TABLE public.invitations IS 'Stores tenant invitation tokens for inviting users to join organizations';
COMMENT ON FUNCTION expire_old_invitations() IS 'Marks expired invitations as expired';
COMMENT ON FUNCTION get_invitation_by_token(TEXT) IS 'Retrieves invitation details by token for public invitation pages';
