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

**Permission Categories:** navigation, obras, certificados, macro, documents, data-flow, admin

**Permission Levels (for macro tables):** `read`, `edit`, `admin`

**Role Templates** (migration 0060) — pre-configured role bundles:

| Key | Permissions |
|-----|------------|
| `viewer` | nav:dashboard, obras:read, certificados:read, macro:read |
| `editor` | obras:read+edit, certificados:edit, macro:edit |
| `obra_manager` | obras:admin, obras:delete, documents:delete:file, documents:delete:folder, certificados:read |
| `accountant` | certificados:admin |
| `macro_analyst` | macro:admin |

### Data-flow permissions

Data-flow now uses explicit capability permissions:

| Permission | Meaning |
|---|---|
| `data-flow:read` | View tenant/obra data-flow screens and graph/config APIs |
| `data-flow:edit` | Edit obra-level data-flow overrides |
| `data-flow:tenant-edit` | Edit tenant-level data-flow defaults |
| `data-flow:apply-suggestion` | Accept or reject data-flow suggestions for obra fields |
| `data-flow:auto-write` | Allow data-flow results to automatically overwrite obra fields |

Dashboard route access is available to all authenticated users and appears in the sidebar for regular members.
| `document_reviewer` | documents:review |
| `document_manager` | documents:review, documents:templates |
| `document_ai_operator` | nav:document-ai, document-ai:run |
| `document_ai_manager` | nav:document-ai, document-ai:run, document-ai:admin |

### Delete lifecycle permissions

Soft delete actions use explicit permissions so destructive capabilities can be assigned independently from broad admin access:

| Permission | Meaning |
|---|---|
| `obras:delete` | Send obras to the obra trash |
| `documents:delete:file` | Send individual document files to the document trash |
| `documents:delete:folder` | Send folders and their descendants to the document trash |

`owner` and `admin` memberships still bypass custom role restrictions through `has_permission`. Migration 0102 backfills these three permissions into roles that already had `obras:admin`, and the `obra_manager` template includes them for new tenants/roles.

### Admin configuration permissions

Some tenant admin pages can be delegated to custom roles without making the user a tenant `admin`/`owner`:

| Permission | Meaning |
|---|---|
| `admin:obra-defaults` | View and mutate `/admin/obra-defaults` and `/admin/obra-defaults/reporting`, including default folders/tables, OCR templates, reporting defaults, and backfill/apply flows |
| `admin:main-table-config` | View and mutate `/admin/main-table-config`, including main obras table columns and select/badge options |

These permissions are alternatives to membership admin for the specific route/API surface. They do not grant access to users, roles, audit, billing, tenant secrets, or other admin pages.

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

For document generation there is an additional feature-level filter on top of route access:

- `Generar` and `Historial` are available to authenticated tenant members
- `documents:review` shows `Revision`
- `documents:templates` shows `Plantillas` and `Configuracion`

This means `/document-generation` is no longer one flat screen from an authorization perspective. The app resolves document review/config capabilities server-side and the sidebar only renders privileged screens when allowed.

---

## Document Generation Permissions

Document generation now gives tenant members baseline creation access and keeps explicit feature permissions for review/config:

| Permission | Purpose |
|------|-------------|
| `nav:document-ai` | Show Document AI workspace in the sidebar |
| `document-ai:run` | Create and inspect auditable Document AI runs |
| `document-ai:admin` | Rebuild Document AI index and manage generated outputs |
| `documents:review` | Access the review queue and approve/reject documents |
| `documents:templates` | Access template/configuration screens and mutate template overrides |

**Screen access model:**

- `/document-generation` -> authenticated tenant member
- `/document-generation/drafts` -> authenticated tenant member, own drafts only
- `/document-generation/review` â†’ `documents:review`
- `/document-generation/templates` â†’ `documents:templates`
- `/document-generation/config` â†’ `documents:templates`

**API access model:**

- `bootstrap`, `drafts POST`, `generate` -> authenticated tenant member
- `drafts GET` -> authenticated tenant member, own drafts only
- `generated GET/PATCH` â†’ `documents:review`
- `templates GET/PUT` â†’ `documents:templates`

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
- Checks `ROUTE_ACCESS_CONFIG` for required roles and explicit required permissions
- Returns `true` when the route is public to authenticated users, the user has a matching membership/custom role, or the user has every `requiredPermissions` key configured for that route

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
