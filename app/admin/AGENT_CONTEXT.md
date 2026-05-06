# Agent Context: app/admin

## Purpose

This folder owns tenant and superadmin configuration surfaces: users, roles, obra defaults, document flows, macro tables, main table columns, audit log, expenses, tenant secrets, demo links, and tenant management.

This is a routing/map context. `app/admin` is too broad for one operational context; use this file to identify the target subfolder, then read the closest subfolder `AGENT_CONTEXT.md` when it exists.

## Main files and areas

- `users/**`: tenant member list, invitations, membership roles, impersonation banner.
- `roles/**`: custom roles, permission matrix, role assignments, user overrides, macro table permissions.
- `obra-defaults/**`: tenant default folder/table/OCR template/data-folder configuration and reporting defaults.
- `document-flows/**`, `document-flows-2/**`: admin surfaces for document-flow/extraction contract concepts.
- `macro-tables/**`: macro table creation/editing, sources, columns, previews.
- `main-table-config/page.tsx`: tenant configuration for main obras table columns and select/badge options.
- `audit-log/**`: audit trail UI.
- `expenses/**`: tenant and all-tenant expense/usage views.
- `tenant-secrets/**`: tenant API/webhook secrets management.
- `demo-links/**`: public demo link/capability management.
- `tenants/page.tsx`: tenant management, superadmin-scoped.

## Local rules

- Identify the admin subfolder first. Do not scan all admin pages.
- Every admin page must preserve tenant resolution and admin/superadmin permission checks.
- Do not use service-role/admin Supabase clients in client components. Server components/actions may use them only for explicit admin-only needs such as auth user lookup.
- Treat tenant defaults, permissions, tenant secrets, and macro table config as high-risk configuration surfaces.
- Preserve route permissions and sidebar/navigation expectations when adding or renaming admin routes.
- Do not change database-backed config shape without checking API routes, migrations, and related docs/ADRs.

## Dependencies

- Auth/permissions: `@/lib/tenant-selection`, `@/lib/route-guard`, `@/lib/route-access`, `@/lib/demo-session`.
- Supabase clients: `@/utils/supabase/server`, `@/utils/supabase/admin`, `@/utils/supabase/client`.
- API routes: `app/api/obra-defaults/**`, `app/api/obras/backfill-defaults`, `app/api/main-table-config`, `app/api/reporting/defaults`, `app/api/tenant-secrets`, `app/api/macro-tables/**`.
- Shared contexts: `lib/AGENT_CONTEXT.md`, `supabase/migrations/AGENT_CONTEXT.md`.

## Related documentation

- `docs/obsidian-brain/19 - Admin Panel.md`
- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/21 - Tenant Secrets & Security.md`
- `docs/obsidian-brain/22 - Expenses & Usage Tracking.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`
- `docs/obsidian-brain/33 - Superadmin Implementation.md`
- `docs/obsidian-brain/34 - Invitation System.md`
- `docs/obsidian-brain/37 - Audit Log System.md`

## Related ADRs

- `docs/adr/0003-tenant-and-obra-data-flow-configs.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`

## Common tasks

### Change user management or invitations

Read first:

- `app/admin/users/page.tsx`
- `app/admin/users/invitation-actions.ts`
- `app/admin/users/user-row.tsx`
- `app/admin/users/_components/**` only for the visible component being changed
- `docs/obsidian-brain/34 - Invitation System.md`

Do not read first:

- roles editor internals, unless role assignment behavior changes
- all admin pages

### Change roles or permissions

Read first:

- `app/admin/roles/AGENT_CONTEXT.md`

Do not read first:

- user invitation code
- obra-defaults code

### Change obra defaults or OCR templates

Read first:

- `app/admin/obra-defaults/AGENT_CONTEXT.md`

Do not read first:

- macro table admin
- roles internals, unless access control changes

### Change main obras table config

Read first:

- `app/admin/main-table-config/page.tsx`
- `components/form-table/configs/obras-detalle.tsx`
- `app/excel/AGENT_CONTEXT.md`
- `app/api/main-table-config/route.ts`

Do not read first:

- file-manager internals
- obra-defaults

### Change tenant secrets or webhooks

Read first:

- `app/admin/tenant-secrets/page.tsx`
- `app/admin/tenant-secrets/tenant-secrets-panel.tsx`
- `app/api/tenant-secrets/route.ts`
- `@/lib/security/secrets`
- `@/lib/security/request-signing`
- `docs/obsidian-brain/21 - Tenant Secrets & Security.md`
- `docs/obsidian-brain/39 - API Secrets & Request Signing.md`

Do not read first:

- roles/permissions UI, unless access checks change

### Change macro table admin

Read first:

- `app/admin/macro-tables/new/page.tsx` or `app/admin/macro-tables/[id]/page.tsx`
- `@/lib/macro-tables`
- `@/lib/macro-table-source-selection`
- ADR 0002
- `docs/obsidian-brain/07 - Macro Tables.md`

Do not read first:

- all Excel pages, unless macro table consumer response changes

## Context boundary

Normally read the target admin subfolder plus direct imports and matching API route. Use this file only to choose the subfolder.

Do not explore broadly:

- all of `app/admin`;
- all API routes;
- all migrations;
- all of `lib`.

Exploration is justified when route access, tenant ownership, RLS, config persistence, or destructive propagation is unclear.

## Stop conditions

Start editing when you have identified the subfolder, the route/API/action being changed, and the permission/tenant check involved.

Continue exploring only if the direct API/action touches tenant defaults, permissions, secrets, storage, or database schema.

Stop exploring when remaining questions are unrelated admin surfaces or possible future consolidation.

## Documentation triggers

- Update domain docs when admin changes alter user workflows, tenant defaults, permissions semantics, or document-flow behavior.
- Update ADRs for tenant defaults propagation, destructive sync, permissions architecture, storage/security, or macro/lineage decisions.
- Update architecture docs for admin API contracts, auth/permission flow, RLS, secrets, or storage.
- Update styleguide docs for reusable admin tables, forms, destructive actions, loading/empty states, or side panels.

## Known risks

- Admin pages can mutate tenant-wide behavior.
- Some pages use admin/service-role clients to fetch auth users; this must remain server-only and permission-gated.
- Permission changes can lock users out or expose admin routes.
- Default and macro-table config changes can affect many obras.
- Existing admin docs may be stale relative to current table/API names.

## Pre-commit checklist for this folder

- List the exact admin subfolder and files changed.
- Confirm tenant/admin/superadmin checks still gate the flow.
- Confirm matching API/server action and DB tables were checked.
- Confirm no unrelated admin surface was changed.
- Confirm destructive or tenant-wide propagation was documented or explicitly avoided.
- Decide whether domain, ADR, architecture, or styleguide docs need updates.
- Do not commit unless explicitly asked.

## Validation

- General admin UI/action changes: `pnpm lint`.
- Permission changes: targeted tests under `tests/lib/admin` and `tests/lib/security` if relevant.
- Tenant defaults changes: `pnpm test -- tests/lib/ocr-template-sync.test.ts tests/lib/obras/delete-lifecycle.test.ts` when touching sync/delete propagation.
- Billing/usage admin: `pnpm test -- tests/lib/billing/subscription-access.test.ts tests/lib/billing/mercadopago.test.ts` when relevant.
