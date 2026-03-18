# Permissions System

tags: #permissions #roles #access-control #rbac

## Overview

The app uses a **layered permission system**:
1. Membership roles (owner/admin/member) — coarse-grained
2. Custom tenant roles — fine-grained, per-route/feature
3. Per-user overrides — individual exceptions

---

## Layer 1: Membership Roles

Built into `tenant_memberships.role`:

| Role | Description |
|------|-------------|
| `owner` | Full access, cannot be removed by other admins |
| `admin` | Full admin access, can manage users/settings |
| `member` | Standard user access |

**Rule:** `admin` and `owner` always bypass custom role restrictions.

---

## Layer 2: Route Access Config (`lib/route-access.ts`)

```typescript
ROUTE_ACCESS_CONFIG = [
  { path: "/admin", allowedRoles: ["admin"] },
  { path: "/excel", allowedRoles: [] },         // all auth'd
  { path: "/certificados", allowedRoles: [] },
  { path: "/macro", allowedRoles: [] },         // controlled by sidebar config
  // ...
]
```

**Matching:** Dynamic segments (`[obraId]`) supported via regex conversion.

**Effect:** Both the middleware and sidebar use this config to enforce access.

---

## Layer 3: Custom Roles (per tenant)

Admins create custom roles at `/admin/roles`.

**DB Tables:**
```
roles                         — id, tenant_id, name, description, color, is_default
permissions                   — id, key, description, category, display_name, sort_order
role_permissions              — role_id, permission_id (many-to-many)
user_roles                    — user_id, role_id, tenant_id
macro_table_permissions       — macro_table_id, (user_id OR role_id), permission_level
```

**Permission Categories:** navigation, obras, certificados, macro, admin

**Permission Levels (for macro tables):** `read`, `edit`, `admin`

**Role Templates** (migration 0060) — pre-configured role bundles:

| Key | Permissions |
|-----|------------|
| `viewer` | nav:dashboard, obras:read, certificados:read, macro:read |
| `editor` | obras:read+edit, certificados:edit, macro:edit |
| `obra_manager` | obras:admin, certificados:read |
| `accountant` | certificados:admin |
| `macro_analyst` | macro:admin |

**Resolution:**
```typescript
getUserRoles(userId, tenantId)
  → returns: membership role + custom roles + overrides
  → merged into effective permission set
```

---

## Layer 4: Per-User Overrides

In `/admin/roles` → "User Overrides" tab:

```
user_permission_overrides
  user_id, tenant_id, permission_id, is_granted (boolean)
```

A user can be **granted** or **denied** a specific permission key regardless of their role.

---

## Sidebar Filtering

`components/app-sidebar.tsx` uses the same `ROUTE_ACCESS_CONFIG` to filter nav items:

```typescript
const visibleNavItems = navItems.filter(item => {
  const config = getRouteAccessConfig(item.href);
  if (!config) return true;           // not in config = accessible to all
  if (config.allowedRoles.length === 0) return true;  // explicit "all"
  return userRoles.some(r => config.allowedRoles.includes(r));
});
```

---

## Route Guard (`lib/route-guard.ts`)

Server-side auth and authorization utilities:

### getUserRoles(userId, tenantId)
Returns `{ roles, roleIds, isAdmin, isSuperAdmin, tenantId }`:
- Fetches membership role from `memberships`
- Fetches custom roles from `user_roles`
- Handles RLS circular dependency (error code 54001 → graceful fallback)
- Superadmin detected via `profiles.is_superadmin` OR hardcoded UUID

### canAccessRoute(path)
- Superadmin/admin always `true`
- Checks `ROUTE_ACCESS_CONFIG` for required roles
- Returns `true` if user has any matching role

### canAccessMacroTable(macroTableId, requiredLevel)
Permission levels: `read(1) < edit(2) < admin(3)`
1. Admin/superadmin → always true
2. Check `macro_table_permissions` for direct user grant
3. Check `macro_table_permissions` for role grant via `user_roles`
4. Returns `true` if user's effective level ≥ required

### hasPermission(permissionKey)
- Admin/superadmin → all permissions granted automatically
- Check `user_permission_overrides` (direct grants)
- Check `role_permissions` through `user_roles`

### getUserPermissionKeys()
- For admin/superadmin: returns ALL permission keys from `permissions` table
- For regular users: union of override keys + role permission keys

**Stack depth error handling:**
```typescript
if (userRoleIdsError?.code === "54001") {
  // Stack depth = RLS circular dependency on user_roles
  console.warn("Skipping user_roles to prevent recursion");
  // Continue with admin/superadmin roles only
}
```

Used in:
- Server components (page-level auth checks)
- API routes (validate caller permissions)
- No middleware.ts — enforcement is in page/route handlers directly

---

## Macro Tables Sidebar Visibility

Separate from main permission system:

`sidebar_macro_tables` DB table:
- Admin can enable/disable individual macro tables in sidebar
- Controlled per-tenant
- API: `GET /api/sidebar-macro-tables`

---

## Permissions Demo Page

`/permissions-demo` — dev/testing page to verify permission system behavior.

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[03 - Routing & Navigation]]
- [[19 - Admin Panel]]
- [[31 - RLS & Security Policies]]
- [[33 - Superadmin Implementation]]
