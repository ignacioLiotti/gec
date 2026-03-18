# Invitation System

tags: #auth #invitations #onboarding #email

## Overview

Users are invited to tenants via **email token links**. Invitations have a 72-hour expiry and enforce role assignment on acceptance. The system prevents duplicate pending invites and uses `SECURITY DEFINER` functions to allow unauthenticated token lookups.

---

## Database Schema (migration 0031, 0037)

```sql
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_role TEXT DEFAULT 'member'
    CHECK (invited_role IN ('member', 'admin')),

  -- Status lifecycle
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),

  -- Token for invitation link
  token TEXT NOT NULL UNIQUE DEFAULT md5(gen_random_uuid()::text),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '72 hours'),

  -- Acceptance tracking
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ
);

-- Prevent duplicate pending invites for same email+tenant
CREATE UNIQUE INDEX unique_pending_invite ON invitations(tenant_id, email)
  WHERE status = 'pending';

-- Fast token lookups (only on active invites)
CREATE INDEX idx_invitation_token ON invitations(token)
  WHERE status = 'pending';
```

---

## Status Lifecycle

```
pending
  ├── accepted   → membership created with invited_role
  ├── declined   → user explicitly rejected
  ├── expired    → 72h passed without action
  └── cancelled  → admin revoked before acceptance
```

---

## Helper Functions (SECURITY DEFINER)

These run elevated to bypass RLS, allowing unauthenticated token resolution:

### expire_old_invitations()
```sql
UPDATE public.invitations
SET status = 'expired'
WHERE status = 'pending' AND expires_at <= now();
```
Called periodically to clean up stale invitations.

### get_invitation_by_token(token TEXT)
```sql
SELECT
  i.id, i.tenant_id, t.name AS tenant_name,
  i.email, i.invited_role, i.status, i.expires_at,
  p.full_name AS inviter_name
FROM invitations i
JOIN tenants t ON i.tenant_id = t.id
LEFT JOIN profiles p ON i.invited_by = p.user_id
WHERE i.token = invitation_token
  AND i.status = 'pending'
  AND i.expires_at > now();
```
Returns enriched invitation data. Used on the public `/invite/[token]` page before the user logs in.

### check_email_is_member(tenant_id, email) (migration 0033)
```sql
SELECT EXISTS (
  SELECT 1 FROM memberships m
  JOIN auth.users u ON m.user_id = u.id
  WHERE m.tenant_id = tenant_id_param
    AND LOWER(u.email) = LOWER(email_param)
);
```
Validates that an invited email isn't already a member. Called before creating an invitation record.

---

## RLS Policies

```sql
-- Admins see all invitations in their tenant
CREATE POLICY "admins_read_tenant_invitations" ON invitations
  FOR SELECT USING (public.is_admin_of(tenant_id));

-- Users can see their own pending, non-expired invitations
CREATE POLICY "users_read_own_invitations" ON invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
    AND expires_at > now()
  );
```

---

## Invitation Flow

```
1. Admin navigates to /admin/users → Invite Member form
   ↓
2. POST /api/invitations
   ├── Validate email not already member (check_email_is_member)
   ├── Check no existing pending invite (unique_pending_invite index)
   ├── INSERT into invitations → token generated
   └── Send email via Resend with /invite/[token] link
   ↓
3. Recipient receives email → clicks link → /invite/[token]
   ↓
4. Page calls get_invitation_by_token(token)
   ├── Not found / expired → show error
   └── Found → show "Join [tenant_name]" prompt
   ↓
5. User logs in / signs up (redirected back to invite page)
   ↓
6. POST /api/invitations/[id]/accept
   ├── INSERT INTO memberships (tenant_id, user_id, role=invited_role)
   ├── UPDATE invitations SET status='accepted', accepted_at=now()
   └── Redirect to /dashboard
```

---

## Email Delivery

Invitation emails are sent via **Resend** (`RESEND_API_KEY`):
- From: `RESEND_FROM_EMAIL`
- Template: Plain transactional email with invitation link
- If Resend is not configured → logs warning, invitation exists in DB but email is never sent

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Same email invited twice | Blocked by `unique_pending_invite` partial index |
| Token used after 72h | `get_invitation_by_token` returns null (filters `expires_at > now()`) |
| User already in tenant | `check_email_is_member` fails before invitation created |
| Superadmin invites to any tenant | Uses impersonated tenant context |
| Invitation cancelled mid-flight | Status set to `cancelled`; token link shows error |

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[13 - Notifications Engine]]
- [[19 - Admin Panel]]
- [[28 - Database Migrations]]
