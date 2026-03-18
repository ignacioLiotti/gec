# Routing & Navigation

tags: #routing #navigation #layout #sidebar

## Page Map

```
/                           → Marketing root (redirects auth'd users to /dashboard)
/dashboard                  → Dashboard (Home) — main landing after login
/excel                      → Obras list (spreadsheet view)
/excel/[obraId]             → Obra workspace (tabbed view)
/macro                      → Macro tables list
/macro/[id]                 → Individual macro table view
/certificados               → Certificates management
/notifications              → Notifications inbox
/profile                    → User profile
/admin                      → Admin dashboard
/admin/users                → User management + invitations
/admin/roles                → Role and permission management
/admin/obra-defaults        → Default folder/tabla templates + quick actions
/admin/macro-tables         → Macro table configuration
/admin/macro-tables/new     → Create macro table
/admin/macro-tables/[id]    → Edit macro table
/admin/main-table-config    → Main obras table column config
/admin/audit-log            → Audit log viewer
/admin/expenses             → Expense/usage tracking
/admin/expenses/all         → All expenses across tenants
/admin/tenants              → Tenant management (super-admin)
/admin/tenant-secrets       → Tenant webhook secrets
/invitations/[token]        → Invitation acceptance page
/r/[token]                  → Shared report (public, token-gated)
/certexampleplayground      → Dev: certificate import playground
/system-design              → Dev: design system playground
/permissions-demo           → Dev: permission testing page
```

---

## Layout Hierarchy

```
app/layout.tsx              Root layout (server component — fetches user, roles, tenants, sidebar tables)
  ├── DomainMigrationGuard  Domain split redirect guard
  ├── SupabaseAuthListener  Auth state change → router.refresh()
  ├── AuthController        Custom event listener for auth modal
  ├── AuthGate              Client: checks session, shows forced login modal if none
  ├── QueryClientProvider   TanStack React Query (5min stale, no refetch-on-focus)
  ├── Toaster               sonner toast notifications
  ├── NotificationsListener Supabase Realtime for in-app notifications
  └── PathnameLayoutShell   Controls sidebar presence per route (client component)
        ├── AppSidebar      Left navigation sidebar
        │     ├── Header: Logo "Sintesis" + org switcher dropdown
        │     ├── Main nav items (filtered by role)
        │     ├── Macro tables section (from sidebar_macro_tables, role-filtered)
        │     ├── Admin section (admin/owner only)
        │     ├── Superadmin section (is_superadmin or ignacioliotti@gmail.com)
        │     └── Footer: User profile card
        ├── Header
        │     ├── ExcelObraName (shows obra name on /excel/[id] routes)
        │     ├── ImpersonateBanner (yellow warning if impersonating)
        │     └── UserMenu (email, roles, notifications, logout)
        └── Page content (children)
```

### `components/pathname-layout-shell.tsx`
- Decides whether to show sidebar based on current pathname
- Hides sidebar on: `/auth`, `/r/[token]` (shared reports), `/invitations`
- Wraps main content with proper padding/layout

---

## Sidebar Structure

Defined in `components/app-sidebar.tsx`:

### Main Navigation (all authenticated users, role-filtered)
| Item | Route | Icon |
|------|-------|------|
| Dashboard | `/` | Home |
| Obras | `/excel` | Table2 |
| Certificados | `/certificados` | FileText |
| Notificaciones | `/notifications` | Bell |

### Macro Tables Section
- Dynamically loaded from `/api/sidebar-macro-tables`
- Each macro table tenant admins have enabled appears as nav item
- Nested under a "Macro" collapsible group

### Admin Section (admin/owner only)
| Item | Route | Icon |
|------|-------|------|
| Usuarios | `/admin/users` | Users |
| Roles | `/admin/roles` | ShieldCheck |
| Obra Defaults | `/admin/obra-defaults` | FolderCogIcon |
| Macro Tables | `/admin/macro-tables` | Layers |
| Main Table Config | `/admin/main-table-config` | Columns3Cog |
| Audit Log | `/admin/audit-log` | Database |
| Gastos | `/admin/expenses` | Wallet |
| Secretos | `/admin/tenant-secrets` | KeyRound |
| Tenants | `/admin/tenants` | Building2 |

### Footer
- User menu (profile, logout)
- Tenant switcher (if multi-tenant member)

---

## Obra Workspace Tabs

Route: `/excel/[obraId]`

Tabs defined in `components/excel-page-tabs.tsx`, rendered in `app/excel/[obraId]/page.tsx`:

| Tab | Key | Content |
|-----|-----|---------|
| General | `general` | Obra details form, quick actions panel |
| [Dynamic tablas] | [tabla slug] | Per-obra data table (FormTable) |
| Documentos | `documents` | File manager + OCR viewer |
| Materiales | `materials` | Material orders table |
| Flujo | `flujo` | Workflow/automation step config |
| Memoria | `memoria` | Rich text notes |
| Modelos 3D | `models` | APS 3D model viewer |

Tab state is stored in URL search params: `/excel/[obraId]?tab=documents`

---

## Route Guards

### How Access Control Works
1. `lib/route-access.ts` — defines `ROUTE_ACCESS_CONFIG` array
2. `lib/route-guard.ts` — `checkRouteAccess(path, userRoles)` → boolean
3. `proxy.ts` — middleware that intercepts requests and checks access
4. `components/app-sidebar.tsx` — filters nav items client-side using same config

### Rules
- Routes NOT in config → accessible to all authenticated users
- Routes with `allowedRoles: []` → all authenticated users
- Routes with `allowedRoles: ["admin"]` → owner/admin membership only
- `admin` membership role always bypasses restrictions

### Dynamic Route Matching
```typescript
// "/excel/[obraId]" matches "/excel/abc-123"
pattern.replace(/\[.*?\]/g, "[^/]+")  // → regex
```

---

## Breadcrumbs

`components/page-breadcrumb.tsx` — renders contextual breadcrumbs based on current route. Used in page headers.

---

## Domain Migration Guard

`components/domain-migration-guard.tsx` — detects if user is on an old domain and prompts migration to new domain.

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[06 - Excel View]]
- [[20 - Permissions System]]
- [[07 - Macro Tables]]
