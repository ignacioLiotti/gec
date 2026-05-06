# Agent Context: supabase/migrations

## Purpose

This folder is the canonical history of Supabase/Postgres schema, RLS, storage buckets/policies, triggers, indexes, functions, and data migrations. Migration files are append-only operational records; do not rewrite old migrations unless explicitly asked for local cleanup before they have been applied anywhere.

## Main areas

- `0001`-`0010`: core tenants, profiles, memberships, obras, completion config.
- `0011`-`0024`: certificates, notifications, materials, storage bucket `obra-documents`, APS, pendientes, flujo actions.
- `0031`-`0039`: invitations, superadmin, permission/RLS recursion fixes, security-definer helpers.
- `0040`-`0050`: calendar, audit log, tenant API secrets, soft delete, dynamic obra tables, defaults, OCR templates.
- `0051`-`0060`: workflow execution, macro tables, onboarding hardening, permissions system.
- `0061`-`0076`: sidebar macro tables, usage/billing, report presets, OCR template uniqueness, background jobs.
- `0077`-`0086`: reporting/signals, tenant main table config, custom data, document upload tracking, audit expansion.
- `0087`-`0097`: demo sessions, document/obra soft delete, tenant reporting config, row lineage, macro override lineage, OCR errors, tenant data-flow config, document generation.

## Local rules

- Create a new numbered migration for schema changes. Do not edit existing applied migrations.
- Use `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, and idempotent patterns where practical.
- Every tenant-scoped table needs `tenant_id`, indexes for tenant lookups, RLS enabled, and policies based on membership/admin helpers.
- Every table reached through an obra or tabla FK needs RLS that preserves tenant isolation through the FK chain.
- Storage policies must be reviewed with the corresponding API access rules; bucket-level authenticated access can be broader than app-level authorization.
- Use `SECURITY DEFINER` only when necessary and document why in SQL comments.
- For destructive or cross-obra changes, check ADR 0009 before writing SQL.
- Add indexes with query patterns in mind; avoid unbounded JSONB or FK lookups without indexes.
- Keep audit triggers consistent for business-critical tables.

## Dependencies

- Supabase CLI commands in `package.json`: `pnpm supabase:start`, `pnpm supabase:status`, `pnpm db:push`, `pnpm db:reset`.
- API routes under `app/api/**`.
- Supabase clients in `utils/supabase/**`.
- Auth/permission helpers in `lib/route-guard.ts`, `lib/route-access.ts`, `lib/demo-session.ts`.
- Domain helpers in `lib/tablas.ts`, `lib/lineage.ts`, `lib/obra-defaults.ts`, `lib/data-flow-builder.ts`.

## Related documentation

- `docs/obsidian-brain/24 - Database Schema.md`
- `docs/obsidian-brain/28 - Database Migrations.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`
- `docs/obsidian-brain/38 - Soft Delete Pattern.md`
- `docs/obsidian-brain/39 - API Secrets & Request Signing.md`
- `docs/supabase-backup.md`
- `docs/secrets-rotation.md`
- `docs/orphan-cleanup.md`

## Related ADRs

- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `docs/adr/0002-macro-table-overrides-bind-to-lineage.md`
- `docs/adr/0003-tenant-and-obra-data-flow-configs.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`
- `docs/adr/0010-layered-traceability-canvas-separates-real-and-projected-nodes.md`

## Common tasks

### Add a tenant-scoped table

Read first:

- latest related migration in this folder
- `0001_base_schema.sql` for membership helper baseline
- a recent tenant-scoped table migration with RLS
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

Do not read first:

- all migrations
- UI files

### Change dynamic tables or extracted row schema

Read first:

- `0048_obra_tablas.sql`
- `0093_row_lineage_identity.sql`
- `0095_ocr_error_codes.sql` if OCR status/errors change
- `lib/tablas.ts`
- `lib/lineage.ts`
- ADR 0001

Do not read first:

- all OCR UI
- unrelated billing/security migrations

### Change storage or document lifecycle

Read first:

- `0014_storage_obra_documents.sql`
- `0082_obra_document_uploads.sql`
- `0089_document_soft_delete.sql`
- `0090_obra_soft_delete.sql` if obra delete lifecycle is involved
- `app/api/obras/AGENT_CONTEXT.md`
- `docs/obsidian-brain/10 - Documents & File Manager.md`

Do not read first:

- file-manager UI, unless API/UI contract changes
- APS migrations, unless 3D models are involved

### Change permissions, roles, or RLS helpers

Read first:

- `0035_fix_permissions_rls.sql`
- `0036_fix_user_roles_rls_recursion.sql`
- `0038_optimize_rls_policies_prevent_stack_overflow.sql`
- `0039_fix_helper_functions_security_definer.sql`
- `0060_permissions_system.sql`
- `lib/route-guard.ts`
- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

Do not read first:

- unrelated feature migrations
- admin UI, unless route visibility or management UI contract changes

### Change defaults, destructive sync, or cross-obra migration behavior

Read first:

- `0049_obra_defaults.sql`
- `0061_fix_default_tabla_columns.sql`
- `lib/obra-defaults.ts`
- ADR 0009
- `CONTEXT.md` entries for destructive sync and explicit migration

Do not read first:

- every obra route
- all background job code, unless execution tracking is part of the change

### Change data-flow storage

Read first:

- `0096_tenant_data_flow_config.sql`
- migrations for obra custom data (`0080_obras_custom_data.sql`)
- `lib/data-flow-builder.ts`
- ADRs 0003, 0004, 0010

Do not read first:

- file-manager/OCR migrations, unless data-flow sources change

## Context boundary

Read only migrations directly related to the table/function/policy being changed plus helper docs. Use filename numbers and names to locate the nearest precedent.

Do not explore broadly:

- all migrations from start to end;
- UI folders;
- unrelated `lib` modules;
- generated dumps or local Supabase temp files.

Exploration is justified when RLS helper behavior, table ownership, storage policy scope, audit triggers, or historical migration order is unclear.

## Stop conditions

Start editing when you know the new migration number, the precedent migration, affected tables/functions/policies, RLS model, indexes, and app code that will use it.

Continue exploring only if policy ownership, tenant scope, storage bucket behavior, or destructive data impact is unclear.

Stop exploring when remaining questions are unrelated historical migrations or future schema cleanup.

## Documentation triggers

- Update architecture docs for schema, RLS, storage, or API contract changes.
- Update domain docs for business entity/rule changes.
- Create/update ADRs for data model, storage, permissions, lineage, destructive migration, or data-flow decisions.
- Update local `AGENT_CONTEXT.md` files for folders whose route/helper contracts changed.

## Known risks

- Editing old migrations can break collaborators or environments that already applied them.
- Missing RLS or loose storage policies can leak tenant data.
- RLS recursion has happened before; permission policy changes need extra care.
- Destructive data migrations need explicit migration contracts, not casual update/delete SQL.
- Docs in `docs/obsidian-brain` may be stale on migration count and table naming.

## Pre-commit checklist for this folder

- Confirm migration number is next and filename is descriptive.
- Confirm migration is idempotent where practical.
- Confirm RLS is enabled and policies match tenant/admin access.
- Confirm indexes support expected route/helper queries.
- Confirm storage policies do not rely on UI-only checks.
- Confirm destructive changes are backed by ADR/domain migration contract.
- Confirm related app code/docs/context were updated when contracts changed.
- Do not commit unless explicitly asked.

## Validation

- Syntax/schema validation when local Supabase is available: `pnpm db:reset` or `pnpm db:push`.
- Check local stack status first: `pnpm supabase:status`.
- For RLS/security behavior, run targeted app/API tests if they exist.
- For lineage schema changes: `pnpm test -- tests/lib/lineage.test.ts tests/lib/ocr-row-policy.test.ts`.
- For delete lifecycle schema changes: `pnpm test -- tests/lib/obras/delete-lifecycle.test.ts`.
