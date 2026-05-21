# ADR 0016: Delegated Admin Configuration Permissions

## Status

Accepted

## Context

`/admin/obra-defaults` and `/admin/main-table-config` were previously reachable only by tenant `admin`/`owner` membership. That made it impossible to delegate configuration work to a custom role without also granting full tenant administration.

## Decision

Introduce two explicit custom-role permissions:

- `admin:obra-defaults`
- `admin:main-table-config`

`owner`, `admin`, and superadmin still bypass these checks. For non-admin members, route access allows either the historical admin membership gate or the explicit required permission. The sidebar shows only the admin items whose route and permission checks pass.

The corresponding write APIs are also permission-gated:

- obra defaults, reporting defaults, OCR template mutations, and backfill flows require `admin:obra-defaults`
- main table config writes require `admin:main-table-config`

Read APIs that are shared by non-admin product surfaces remain broadly readable when needed, but the protected admin pages and mutations require the explicit permission.

## Consequences

- Custom roles can delegate the two configuration surfaces without exposing users, roles, audit, billing, tenant secrets, or other admin tools.
- Existing admin/owner behavior remains unchanged.
- New tenants/databases must apply migration `0103_admin_config_permissions.sql` before these permissions appear in the role editor.

