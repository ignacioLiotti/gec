# Multi-Tenancy & Auth

tags: #auth #tenancy #security #roles

## Overview

The app is a **multi-tenant SaaS** where each organization is a "tenant." Users can belong to multiple tenants and switch between them. Auth is handled by **Supabase Auth** with JWT tokens that carry the tenant context.

---

## Auth Flow

> **No middleware.ts** — auth is enforced inside server components and `AuthGate` client component.

```
1. User visits app
2. app/layout.tsx (server component) calls supabase.auth.getUser()
3. No session → AuthGate client component dispatches "open-auth" event
4. AuthController shows non-dismissible AuthModal
5. User logs in: email/password OR Google OAuth
6. OAuth path: redirect → /auth/callback → exchangeCodeForSession → set cookies
7. Email/password: signInWithPassword → wait 300ms → router.refresh()
8. AuthListener detects SIGNED_IN → router.refresh() (re-renders server components)
9. layout.tsx re-runs: fetches user, roles, tenants
10. resolveTenantMembership() resolves active tenant from cookie
11. User lands on /dashboard (or /onboarding if no memberships)
```

### Key Files
- `utils/supabase/server.ts` — `createClient()` for server components/routes
- `utils/supabase/client.ts` — `createClient()` for browser
- `utils/supabase/admin.ts` — `createAdminClient()` with service role (bypasses RLS)
- `app/auth/callback/route.ts` — OAuth callback handler
- `lib/tenant-selection.ts` — `resolveTenantMembership()`

---

## Tenant Resolution

```typescript
// lib/tenant-selection.ts
resolveTenantMembership(memberships, options)
```

**Algorithm:**
1. Read `active_tenant_id` cookie
2. Find matching membership in user's membership list
3. Fall back to first membership
4. Super-admins fall back to `DEFAULT_TENANT_ID` = `00000000-0000-0000-0000-000000000001`

**Tenant Switching:**
- `POST /api/tenants/[tenantId]/switch` — sets `active_tenant_id` cookie, redirects
- UI: `components/tenant-switch-button.tsx`

---

## Multi-Tenant Data Model

```
tenants
  id, name, settings, created_at

tenant_memberships
  id, tenant_id, user_id, role (owner/admin/member)

profiles
  id (= auth.users.id), email, full_name, avatar_url
```

Each data table has `tenant_id` with RLS like:
```sql
CREATE POLICY "tenant isolation" ON obras
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
```

---

## User Roles

### Built-in Membership Roles
| Role | Access |
|------|--------|
| `owner` | Full admin access |
| `admin` | Full admin access |
| `member` | Standard access |

### Custom Roles (per tenant)
- Defined in `tenant_roles` table
- Each role has a set of permissions
- Managed in `/admin/roles`

**Key files:**
- `app/admin/roles/page.tsx` — Role list
- `app/admin/roles/_components/permission-matrix.tsx` — Permission grid
- `app/admin/roles/_components/user-assignments.tsx` — Assign roles to users
- `app/admin/roles/_components/user-overrides.tsx` — Per-user permission overrides
- `app/admin/roles/server-actions.ts` — Server actions for role CRUD

---

## Permissions System

Permissions are checked at two levels:

### 1. Route Level (lib/route-access.ts)
```typescript
ROUTE_ACCESS_CONFIG = [
  { path: "/admin", allowedRoles: ["admin"] },
  { path: "/excel", allowedRoles: [] }, // all authenticated
  ...
]
```
- `admin` membership role always has access
- Custom roles checked against `allowedRoles` array
- Dynamic segments supported: `/excel/[obraId]`

### 2. Sidebar Level (components/app-sidebar.tsx)
- Same `ROUTE_ACCESS_CONFIG` drives sidebar visibility
- Navigation items hidden if user lacks role access

### 3. Feature Level
- Macro tables visibility in sidebar: controlled by `sidebar_macro_tables` DB table
- Per-table permissions: planned but mostly controlled by page-level guards

---

## User Impersonation

Admins can impersonate other users for support.

```
/api/impersonate/start → sets impersonation session
/api/impersonate/stop  → reverts to original admin session
components/users/_components/impersonate-banner.tsx → shows warning banner
```

---

## User Invitations

```
Admin → /admin/users → "Invite User" dialog
    → POST invitation-actions.ts
    → lib/email/invitations.ts (Resend email)
    → Token stored in DB (72h expiry)
    → User clicks email link → /invitations/[token]/page.tsx
    → Validates token + email → creates membership
    → components/invitations/pending-invitations-banner.tsx (in-app banner)
```

---

## Super Admin

- `profiles.is_superadmin = true` flag — OR hardcoded ID: `77b936fb-3e92-4180-b601-15c31125811e`
- Special access also for email: `ignacioliotti@gmail.com` (owner/founder)
- They can access any tenant by switching to it
- Falls back to `DEFAULT_TENANT_ID` if they have no memberships
- In layout: admins/superadmins get ALL tenants via admin client (bypasses RLS)
- Regular users: only see their own memberships

---

## Security

- **RLS** enforced on every PostgreSQL table
- **Rate limiting** on sensitive endpoints: `lib/security/rate-limit.ts`
- **Request signing** for external event emitters: `lib/security/request-signing.ts`
- **Tenant secrets** stored encrypted, used for webhook verification: `/admin/tenant-secrets`

---

## Related Notes

- [[01 - Architecture Overview]]
- [[20 - Permissions System]]
- [[21 - Tenant Secrets & Security]]
- [[03 - Routing & Navigation]]
