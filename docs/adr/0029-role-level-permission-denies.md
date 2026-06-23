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

## Related files

- `supabase/migrations/0123_role_permission_denies.sql`
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
