# Agent Context: app/admin/roles

## Purpose

This folder owns tenant custom role management: role creation/editing, permission selection, navigation preview, user-role assignments, user permission overrides, role templates, and macro table permission management.

This is a high-risk authorization area. Changes can alter admin access, route visibility, macro table access, and user permissions across a tenant.

## Main files

- `page.tsx`: server page; resolves current user, active tenant, superadmin/admin permission via `has_permission(admin:roles)`, fetches roles/permissions/templates/macro permissions/users, and renders `RolesPageClient`.
- `permissions-actions.ts`: main server actions and query helpers for permissions, roles, role templates, role-permission assignment, macro table permissions, and effective permissions.
- `server-actions.ts`: legacy/simple server actions for roles, user roles, role permissions, user overrides, membership role updates.
- `_components/roles-page-client.tsx`: client shell with roles and assignments tabs.
- `_components/role-editor.tsx`: create/edit role sheet; writes role metadata and permission keys through `permissions-actions`.
- `_components/permission-matrix.tsx`: permission category/checkbox matrix.
- `_components/navigation-tree.tsx`: navigation preview tied to permission keys.
- `_components/user-assignments.tsx`: assign/revoke custom roles for users.
- `_components/user-overrides.tsx`: direct per-user permission overrides.
- `_components/role-card.tsx`, `role-row.tsx`, `role-permissions.tsx`, `permissions-manager.tsx`, `create-role-form.tsx`, `delete-role-button.tsx`: supporting/legacy role UI pieces.

## Local rules

- Preserve the page-level `admin:roles` gate before fetching/managing tenant role data.
- Keep tenant-scoped queries filtered by `tenantId`.
- Do not confuse membership roles (`owner`, `admin`, `member`) with custom roles in `roles`.
- Owner/admin membership roles bypass fine-grained custom role restrictions; preserve this behavior.
- Permission keys are contracts with `lib/route-access`, sidebar/navigation logic, and DB `permissions`.
- User overrides must remain tenant-aware in semantics. Check DB schema/RLS before changing override shape.
- Macro table permissions have a separate permission-level hierarchy: `read < edit < admin`.
- Avoid service-role access except for explicit auth user lookup in server-only code.

## Dependencies

- Permission model helpers: `@/lib/route-guard`, `@/lib/route-access`, `@/lib/tenant-selection`.
- Supabase clients: `@/utils/supabase/server`, `@/utils/supabase/admin`.
- DB objects: `permissions`, `roles`, `role_permissions`, `user_roles`, `user_permission_overrides`, `role_templates`, `macro_table_permissions`, `memberships`, `profiles`, RPC `has_permission`.
- Sidebar/nav consumers: `components/app-sidebar.tsx`, `lib/route-access.ts`.
- Macro table access: `@/lib/route-guard` and `app/admin/macro-tables/**`.
- Migration context: `supabase/migrations/AGENT_CONTEXT.md`, especially permissions/RLS migrations.

## Related documentation

- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/19 - Admin Panel.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`
- `docs/obsidian-brain/33 - Superadmin Implementation.md`
- `docs/obsidian-brain/07 - Macro Tables.md`

## Related ADRs

No dedicated permissions ADR exists yet. Create one if changing the authorization model, permission resolution order, role/membership semantics, or macro table permission architecture.

## Common tasks

### Change role create/edit UI

Read first:

- `app/admin/roles/_components/role-editor.tsx`
- `app/admin/roles/permissions-actions.ts`
- `app/admin/roles/_components/permission-matrix.tsx`
- `docs/obsidian-brain/20 - Permissions System.md`

Do not read first:

- user management page
- macro table admin pages
- migrations, unless schema changes

### Change permission categories, labels, or keys

Read first:

- `app/admin/roles/_components/permission-matrix.tsx`
- `app/admin/roles/_components/navigation-tree.tsx`
- `app/admin/roles/permissions-actions.ts`
- `lib/route-access.ts`
- `components/app-sidebar.tsx`
- `supabase/migrations/0060_permissions_system.sql`

Do not read first:

- all admin pages
- unrelated RLS migrations

### Change user role assignments

Read first:

- `app/admin/roles/_components/user-assignments.tsx`
- `app/admin/roles/server-actions.ts`
- `app/admin/roles/permissions-actions.ts` if effective permissions change
- `lib/route-guard.ts`

Do not read first:

- role editor UI, unless assignment options/role data shape changes

### Change user overrides

Read first:

- `app/admin/roles/_components/user-overrides.tsx`
- `app/admin/roles/server-actions.ts`
- `app/admin/roles/permissions-actions.ts`
- `lib/route-guard.ts`
- `supabase/migrations/0060_permissions_system.sql`

Do not read first:

- macro table permissions, unless overrides should affect macro tables

### Change macro table permissions

Read first:

- `app/admin/roles/permissions-actions.ts`
- `lib/route-guard.ts`
- `supabase/migrations/0060_permissions_system.sql`
- `docs/obsidian-brain/07 - Macro Tables.md`
- `docs/obsidian-brain/20 - Permissions System.md`

Do not read first:

- macro table editor UI, unless permission UI is embedded there

### Change page-level access checks

Read first:

- `app/admin/roles/page.tsx`
- `lib/route-guard.ts`
- `lib/route-access.ts`
- `supabase/migrations/0060_permissions_system.sql`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

Do not read first:

- role editor components
- unrelated admin pages

## Context boundary

Normally read the role page/action/component being changed, `permissions-actions.ts` or `server-actions.ts`, and the permission helper/migration that owns the contract.

Do not explore broadly:

- all of `app/admin`;
- all migrations;
- all of `lib`;
- user invitation code;
- obra defaults.

Exploration is justified when permission keys, RLS, RPC `has_permission`, sidebar visibility, macro table access, or membership role semantics are affected.

## Stop conditions

Start editing when you know whether the task changes role metadata, role permissions, user assignments, user overrides, macro permissions, or access checks.

Continue exploring only if permission resolution order, tenant scope, RLS policy, or sidebar/route access contract is unclear.

Stop exploring when remaining questions are about unrelated admin surfaces or future RBAC redesign.

## Documentation triggers

- Update domain docs when user access concepts or admin workflows change.
- Create/update an ADR for permission architecture, resolution order, membership/custom role semantics, macro table permission model, or RLS strategy.
- Update architecture docs for route guard, sidebar filtering, permission RPC, or RLS changes.
- Update styleguide docs for reusable permission matrix, role editor, assignment table, or admin empty/error patterns.

## Known risks

- A bad permission change can lock admins out or expose admin-only routes.
- `admin`/`owner` membership bypass is separate from custom roles.
- RLS recursion has been fixed before; changes to role/user policy queries need caution.
- `navigation-tree.tsx` hardcodes navigation permissions and can drift from sidebar/route access config.
- Some components/actions appear legacy or partially unused; verify current call path before editing.
- `server-actions.ts` has simple mutations with limited explicit authorization; rely on page gates/RLS and be cautious extending it.

## Pre-commit checklist for this folder

- List whether role metadata, permission keys, assignments, overrides, macro permissions, or access checks changed.
- Confirm tenant filtering is present on reads/writes.
- Confirm admin/superadmin gate remains before management operations.
- Confirm membership role behavior (`owner/admin/member`) is not confused with custom roles.
- Confirm sidebar/route access impact was checked if permission keys changed.
- Confirm RLS/migration implications were checked if DB shape/query changes.
- Run targeted validation below.
- Decide whether a permissions ADR is now required.
- Do not commit unless explicitly asked.

## Validation

- General roles UI/action changes: `pnpm lint`.
- Admin permission logic: `pnpm test -- tests/lib/admin/tenant-limit-access.test.ts` if related admin access patterns are touched.
- Route/security helper changes: `pnpm test -- tests/lib/security/rate-limit.test.ts` only if security helpers are touched; otherwise run targeted tests available for the changed helper.
- Macro permission behavior: run relevant macro table tests if touching macro access; use `pnpm test -- tests/lib/macro-table-source-selection.test.ts` when source/permission assumptions overlap.
- For DB/RLS changes: validate migrations with Supabase local flow per `supabase/migrations/AGENT_CONTEXT.md`.
