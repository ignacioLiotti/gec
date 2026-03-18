# Onboarding Flow

tags: #auth #onboarding #tenants #user-flow

## Overview

New users land on `/onboarding` when they have no tenant memberships. They can either **create a new organization** or **accept a pending invitation**. After joining, a tenant cookie is set and they're redirected to the main app.

---

## Complete New User Sequence

```
1. User visits app (unauthenticated)
   ↓
2. Clicks "Sign Up" or "Continue with Google"
   ↓
3. Auth Modal:
   ├── Email/password → supabase.auth.signUp() → redirects to /onboarding immediately
   └── Google OAuth → Google consent screen
   ↓
4. /auth/callback?code=xxx (OAuth only)
   ├── exchangeCodeForSession(code)
   ├── Check memberships count
   │   ├── 0 memberships → redirect to /onboarding
   │   └── >0 memberships → set ACTIVE_TENANT_COOKIE + redirect to /dashboard
   ↓
5. /onboarding page
   ├── Load pending invitations
   ├── If invitations exist → default to "Join" tab
   └── If no invitations → default to "Create" tab
   ↓
6A. CREATE PATH: User enters org name → submit
   ├── createTenantAction() server action
   ├── INSERT INTO tenants (name)
   ├── INSERT INTO memberships (tenant_id, user_id, role='owner')
   └── Redirect to /api/tenants/{tenantId}/switch
   ↓
6B. JOIN PATH: User clicks "Accept" on invitation card
   ├── acceptInvitation(token)
   ├── Validate email match + expiry
   ├── INSERT INTO memberships (role from invitation)
   ├── UPDATE invitations SET status='accepted'
   └── Redirect home
   ↓
7. /api/tenants/{tenantId}/switch
   ├── Verify user has membership in tenantId
   ├── Set cookie: ACTIVE_TENANT_COOKIE = tenantId (30-day maxAge)
   └── Redirect to /excel
   ↓
8. User is fully onboarded — sees their empty org workspace
```

---

## Auth Callback Route (`app/auth/callback/route.ts`)

The OAuth callback is the critical routing decision point:

```typescript
const code = searchParams.get('code');
await supabase.auth.exchangeCodeForSession(code);

// Check if user has any memberships
const { data: memberships } = await supabase
  .from('memberships')
  .select('tenant_id')
  .limit(1);

if (!memberships?.length) {
  // First time user → onboarding
  return redirect('/onboarding');
}

// Returning user → restore session
const tenantId = memberships[0].tenant_id;
response.cookies.set(ACTIVE_TENANT_COOKIE, tenantId, { ... });
return redirect('/dashboard');
```

---

## Onboarding Page Modes (`app/onboarding/page.tsx`)

### Mode: Create Organization
```typescript
// Form submission
await createTenantAction("/onboarding", formData);

// Server action (app/tenants/actions.ts):
// 1. Validate name >= 3 characters
// 2. USE ADMIN CLIENT to bypass RLS:
const adminClient = createSupabaseAdminClient();
// 3. INSERT INTO tenants (name)
// 4. INSERT INTO memberships (tenant_id, user_id, role='owner')
// 5. Redirect to /api/tenants/${tenantId}/switch
```

### Mode: Join Existing Organization
Invitations are loaded via `getMyPendingInvitations()` which queries the `invitations` table filtered by the user's email address.

Each card shows:
- Organization name
- Inviter's name
- Expiration time (72h window)
- Role to be granted

---

## What Gets Initialized on Tenant Creation

**Created immediately:**
- `tenants` row (name only)
- `memberships` row (user as `owner`)
- Superadmin auto-enrolled as `owner` (DB trigger, migration 0027)

**NOT automatically created:**
- Default folders
- Default tablas
- Subscription plan assignment
- Sample obras or data

Default folders and tablas are configured separately by the tenant admin in `/admin/defaults`.

---

## Tenant Switch Route (`app/api/tenants/[tenantId]/switch/route.ts`)

```typescript
// GET /api/tenants/{tenantId}/switch
// Validates the user actually belongs to tenantId, then:
response.cookies.set(ACTIVE_TENANT_COOKIE, tenantId, {
  path: "/",
  maxAge: 60 * 60 * 24 * 30,  // 30 days
  sameSite: "lax",
});
return redirect("/excel");
```

The switch route is also used for the **org switcher** in the sidebar — when a user with multiple tenant memberships switches context.

---

## Tenant Resolution (`lib/tenant-selection.ts`)

On every authenticated request, the active tenant is resolved:

```typescript
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

export function resolveTenantMembership(memberships, cookieTenantId?, isSuperadmin?) {
  // Priority order:
  // 1. Membership matching the cookie value
  // 2. First membership (oldest)
  // 3. Superadmin with no memberships → DEFAULT_TENANT_ID
}
```

**DEFAULT_TENANT_ID** (`00000000-0000-0000-0000-000000000001`):
- Used as superadmin sandbox tenant
- Originally all users were auto-enrolled here (migration 0006)
- Auto-enrollment was **removed** in migration 0042

---

## Invitation Acceptance Flow

```typescript
// app/admin/users/invitation-actions.ts
async function acceptInvitation(token: string) {
  // 1. Lookup invitation by token (SECURITY DEFINER function)
  const invitation = await get_invitation_by_token(token);

  // 2. Validate
  if (!invitation) throw "Invalid or expired token";
  if (invitation.email !== currentUserEmail) throw "Email mismatch";

  // 3. Check if already member
  const alreadyMember = await checkExistingMembership(invitation.tenant_id);
  if (alreadyMember) {
    // Still mark invitation as accepted, but no new membership created
    await updateInvitationStatus(invitation.id, 'accepted');
    return;
  }

  // 4. Create membership
  await supabase.from('memberships').insert({
    tenant_id: invitation.tenant_id,
    user_id: currentUserId,
    role: invitation.invited_role
  });

  // 5. Update invitation
  await supabase.from('invitations').update({
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    accepted_by: currentUserId
  }).eq('id', invitation.id);
}
```

---

## Domain Split Support

When `NEXT_PUBLIC_ENABLE_DOMAIN_SPLIT=true`, the auth callback handles cross-domain redirects:
- Marketing domain (`sintesis.dev`) redirects to app domain (`app.sintesis.dev`)
- The switch route preserves the correct cookie domain

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[34 - Invitation System]]
- [[03 - Routing & Navigation]]
- [[33 - Superadmin Implementation]]
- [[27 - User Flow Walkthrough]]
