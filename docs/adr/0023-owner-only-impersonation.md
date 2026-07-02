# ADR-0023: Owner-Only User Impersonation

## Status

Accepted

## Date

2026-06-10

## Context

The `/api/impersonate/start` route lets a privileged actor exchange their
session for another user's session for support and debugging. The previous
route-level check allowed any owner/admin membership in any tenant to start
impersonation, even when the target user belonged to another tenant.

The product model is stricter: impersonation is an app-owner support tool, not
a tenant-admin capability.

## Decision

Only resolved superadmins may start impersonation. App-level superadmin checks
use `lib/superadmin.ts`, which accepts `profiles.is_superadmin`,
`SUPERADMIN_USER_IDS`, or `SUPERADMIN_EMAILS`.

The impersonation route rate-limits attempts by client IP and writes an
`audit_log` row after a successful impersonation start.

## Consequences

Tenant owners and admins cannot impersonate users, even inside their own
tenant. This reduces cross-tenant takeover risk and keeps the dangerous support
tool tied to the app-owner identity.

Deployments must configure the app owner via `profiles.is_superadmin` and/or
the `SUPERADMIN_USER_IDS` / `SUPERADMIN_EMAILS` environment variables before
relying on impersonation in production.

## Alternatives considered

- Tenant-scoped impersonation for owners/admins: rejected because the intended
  product model does not delegate impersonation to tenant admins.
- Keeping the hardcoded owner UUID/email in call sites: rejected because it
  scattered a high-privilege identity across the app and made rotation harder.

## Related files

- `app/api/impersonate/start/route.ts`
- `lib/impersonation-access.ts`
- `lib/superadmin.ts`
- `tests/lib/impersonation-access.test.ts`
- `tests/lib/superadmin.test.ts`

## Related domain docs

- `docs/obsidian-brain/02 - Multi-Tenancy & Auth.md`
- `docs/obsidian-brain/33 - Superadmin Implementation.md`

## Agent notes

Do not broaden impersonation to tenant admins without a new product decision
and an ADR update. The route must continue to fail closed for non-superadmins.
