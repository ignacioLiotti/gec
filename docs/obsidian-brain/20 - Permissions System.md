# Permissions System

tags: #permissions #roles #access-control #rbac

## Overview

The app uses a **layered permission system**:
1. Membership roles (owner/admin/member) — coarse-grained
2. Custom tenant roles — fine-grained, per-route/feature, grant or deny
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

Invitations may carry one custom operational role for regular members. This is separate from the membership level and is inserted into `user_roles` in the same transaction that accepts the invitation.

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
role_permissions              — role_id, permission_id, is_granted (true = grant, false = deny)
user_roles                    — user_id, role_id, tenant_id
macro_table_permissions       — macro_table_id, (user_id OR role_id), permission_level
```

**Permission Categories:** navigation, obras, certificados, macro, documents, data-flow, admin

**Permission Levels (for macro tables):** `read`, `edit`, `admin`

**Role permission states:** `Heredar` stores no row, `Permitir` stores `is_granted = true`, and `Bloquear` stores `is_granted = false`.

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

Soft delete actions use explicit permissions for broad destructive capabilities, while individual document files can be sent to trash by any authenticated user with access to the obra:

| Permission | Meaning |
|---|---|
| `obras:delete` | Send obras to the obra trash |
| `documents:delete:folder` | Send folders and their descendants to the document trash |
| `documents:purge` | Permanently delete document trash-history entries from Storage and mark them purged |

`documents:delete:file` may still exist in older role data, but individual file delete no longer checks it. `documents:purge` is intentionally separate from trash/delete permissions because it removes physical Storage objects and cannot be restored. `owner` and `admin` memberships still bypass custom role restrictions through `has_permission` for permission-gated delete actions. Migration 0102 backfills the original delete permissions into roles that already had `obras:admin`; migration 0122 adds `documents:purge` to roles that already had `obras:admin` and to the `obra_manager` template for new tenants/roles.

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

A regular member can be **granted** or **denied** a specific permission key for one tenant regardless of their custom roles.

Resolution order:

1. Superadmin and tenant `owner`/`admin` memberships bypass custom grants and denies.
2. Explicit per-user deny (`is_granted = false`) blocks the permission for regular members.
3. Explicit per-user grant (`is_granted = true`) grants the permission.
4. Explicit role deny (`role_permissions.is_granted = false`) blocks the permission.
5. Custom role grants apply only when no higher-precedence deny exists.

This allows a tenant admin to make one user the exception when a role or baseline navigation item would otherwise allow or block access.

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

For baseline navigation, explicit user or role denies can hide otherwise available sidebar entries:

- `nav:dashboard` hides Dashboard
- `nav:excel` hides Excel/Obras
- `nav:certificados` hides Certificados
- `nav:macro` hides Macro table navigation
- `nav:notifications` hides Notificaciones

For document generation there is an additional feature-level filter on top of route access:

- `Generar` and `Historial` are available to authenticated tenant members
- `documents:review` shows `Revision`
- `documents:templates` shows `Plantillas` and `Configuracion`

This means `/document-generation` is no longer one flat screen from an authorization perspective. The app resolves document review/config capabilities server-side and the sidebar only renders privileged screens when allowed.

A "documents-only" regular member can be configured by blocking the baseline nav permissions above on a custom role, or by denying them directly for that user, and not granting `documents:review` or `documents:templates`. The user will still see the `Documentos` section with `Generar Documentos` and `Historial` because document creation is baseline tenant-member access.

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
- `/document-generation/drafts` -> authenticated tenant member; generated-document history is tenant-wide, draft recovery remains own drafts only
- generated documents in `GENERATED`, `UNDER_REVIEW`, or `REJECTED` can be edited by authenticated tenant members, regardless of who generated them
- approved generated documents remain non-editable
- generated documents expose permanent deletion only to the user who generated them, regardless of status
- `/document-generation/review?id={generatedDocumentId}` -> authenticated tenant member in read-only mode for a same-tenant document
- the review queue and approve/reject controls on `/document-generation/review` -> `documents:review`
- `/document-generation/templates` â†’ `documents:templates`
- `/document-generation/config` â†’ `documents:templates`

**API access model:**

- `bootstrap`, `drafts POST`, `generate` -> authenticated tenant member
- `drafts GET` -> authenticated tenant member, own drafts only
- generated list/detail -> authenticated tenant member for all generated documents in the tenant
- generated regeneration -> authenticated tenant member when the generated document is `GENERATED`, `UNDER_REVIEW`, or `REJECTED`
- generated delete -> creator only; permanently removes the PDF and generated extraction rows while retaining the source draft
- generated approve/reject PATCH -> `documents:review`
- `documents/access` refuses signed URLs and direct PDF downloads for generated documents whose status is `REJECTED`
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
- Check `user_permission_overrides` explicit denies
- Check `user_permission_overrides` direct grants
- Check `role_permissions` explicit role denies
- Check `role_permissions` grants through `user_roles`, excluding denied keys

### getUserPermissionKeys()
- For admin/superadmin: returns ALL permission keys from `permissions` table
- For regular users: union of granted override keys + role permission keys, excluding denied keys

### Superadmin permission simulation

Superadmins can open the user menu and activate a permission simulation. The
simulation is stored in the `permission_simulation` HTTP-only cookie and is
ignored for non-superadmins.

When active, app-level permission context behaves like a regular member:

- `isSuperAdmin` is exposed as `false`
- `membershipRole` is exposed as `member`
- `permissionKeys` comes only from the simulated key list
- no-permission simulation uses an empty key list

This is a support/debugging viewport only. It does not change memberships,
roles, RLS, database permissions, or the real Supabase session.

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
