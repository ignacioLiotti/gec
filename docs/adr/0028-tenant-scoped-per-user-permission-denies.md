# ADR-0028: Tenant-scoped per-user permission denies

## Status

Accepted

## Date

2026-06-19

## Context

Tenant admins need to make a single regular member the exception when a role or baseline navigation entry would otherwise allow access. The schema already had `user_permission_overrides.is_granted`, but application and database permission checks only treated `true` rows as grants; `false` rows did not override role grants.

The override table also lacked `tenant_id`, despite the permission docs describing overrides as tenant-aware. That made direct user overrides global for a user across tenants.

## Decision

Per-user permission overrides are tenant-scoped by adding `tenant_id` to `user_permission_overrides` and keying rows by `(user_id, tenant_id, permission_id)`.

For regular members, permission resolution is:

1. explicit deny blocks the permission
2. explicit grant allows the permission
3. role grants allow the permission when no deny exists

Superadmin and tenant `owner`/`admin` memberships continue to bypass custom role restrictions and per-user denies.

Baseline sidebar entries use their `nav:*` permission keys as deny switches. Denying `nav:dashboard`, `nav:excel`, `nav:certificados`, `nav:macro`, and `nav:notifications` can leave a regular member with only the document-generation navbar group. Document generation create/history remains baseline tenant-member access; review and template/configuration remain controlled by `documents:review` and `documents:templates`.

## Consequences

- Admins can create user-specific exceptions without removing shared role grants.
- User overrides no longer leak across tenants for newly written rows.
- Existing global override rows are copied to each tenant membership during migration to preserve previous effective behavior.
- Permission-sensitive code must check denies before role grants for regular members.
- Owner/admin users cannot be restricted with these custom denies; downgrade the membership role to `member` before applying exceptions.

## Alternatives considered

- Keep overrides as grant-only. Rejected because it cannot express the requested exception behavior.
- Make all baseline routes require positive `nav:*` grants. Rejected because it would hide existing default surfaces for members without roles.
- Let denies override owner/admin. Rejected because the current authorization model explicitly preserves membership admin bypass.

## Related files

- `supabase/migrations/0122_tenant_scoped_permission_denies.sql`
- `lib/route-guard.ts`
- `lib/route-access.ts`
- `components/app-sidebar.tsx`
- `app/admin/roles/server-actions.ts`
- `app/admin/roles/_components/user-overrides.tsx`
- `app/admin/roles/_components/user-assignments.tsx`

## Related domain docs

- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

## Agent notes

When adding a permission-gated surface, decide whether it is grant-only or also a deny switch for baseline access. Keep the database RPC, `route-guard`, sidebar filtering, and admin override UI in agreement.
