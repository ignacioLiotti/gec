# ADR-0029: Role-level permission denies

## Status

Accepted

## Date

2026-06-22

## Context

Tenant admins can already create per-user permission exceptions, but the same deny/grant configurability was not available at the custom role level. Roles only carried granted permissions, which made the role editor an expanding checklist and prevented admins from defining a role that explicitly hides baseline navigation items such as Dashboard, Excel, Macro, or Notifications.

The permission model must still preserve the ability to make a single user the exception to a shared role.

## Decision

`role_permissions` now has `is_granted boolean not null default true`.

For regular members, permission resolution is:

1. explicit per-user deny blocks the permission
2. explicit per-user grant allows the permission
3. explicit role deny blocks the permission
4. role grant allows the permission
5. otherwise the permission is absent

Superadmin and tenant `owner`/`admin` memberships continue to bypass custom grants and denies.

The role editor now presents each supported permission as `Heredar`, `Permitir`, or `Bloquear`. `Heredar` stores no row, `Permitir` stores a true `role_permissions.is_granted` row, and `Bloquear` stores a false row.

## Consequences

- Admins can create roles that explicitly hide baseline navbar items without configuring each user individually.
- A per-user grant can still override a role deny, preserving user-specific exceptions.
- Existing role permission rows remain grants because `is_granted` defaults to true.
- The database RPC, route guard helpers, sidebar deny list, and admin role editor must stay aligned on the same precedence order.

## Migration history

Migration `0123` originally defined `has_permission` with the role-deny precedence above, but it referenced `user_permission_overrides.tenant_id` before migration `0125` added that column. A fresh database therefore stopped at `0123`. The approved 2026-10-17 historical exception adds the nullable column prerequisite to `0123` so a fresh migration run can continue to `0125`, which remains unchanged and completes the tenant-scoping migration.

Migration `0125` then replaced `has_permission` without the role-deny branch. Migration `0132` restores the complete function as the final database definition, including per-user deny, per-user grant, role deny, and role grant precedence. The additive migration repairs databases that already passed `0125`; changing `0123` alone would only repair fresh migration runs. See the [migration repair record](../../plans/2026-10-17-isolated-integration/migration-repair.md) for the failure evidence and approved scope.

## Related files

- `supabase/migrations/0123_role_permission_denies.sql`
- `supabase/migrations/0125_tenant_scoped_permission_denies.sql`
- `supabase/migrations/0136_restore_role_permission_denies.sql`
- `lib/route-guard.ts`
- `lib/route-access.ts`
- `app/admin/roles/permissions-actions.ts`
- `app/admin/roles/server-actions.ts`
- `app/admin/roles/_components/role-editor.tsx`
- `app/admin/roles/_components/permission-matrix.tsx`
- `components/app-sidebar.tsx`

## Related domain docs

- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`
