# Agent Context: lib

## Purpose

This folder contains shared business logic, server helpers, domain utilities, integrations, and client helpers used across routes and UI. It is intentionally broad: do not treat this context as permission to scan all of `lib`.

Use this file as a high-level map. Several subfolders deserve their own later context files: `lib/security`, `lib/notifications`, `lib/workflow`, `lib/reporting`, `lib/obra-defaults`, `lib/obras`, `lib/billing`, and `lib/demo-flows`.

## Main files and areas

- `tablas.ts`: dynamic table data types, folder/path normalization, field key normalization, date/number parsing, formula evaluation, and materials OCR prompt.
- `lineage.ts`: stable lineage row key derivation, file/content fingerprints, business-key and structural fallback identity, conflict errors.
- `ocr-row-policy.ts`, `ocr-error-message.ts`, `ocr-template-sync.ts`: OCR row replacement/conflict policy, error localization/classification, template sync.
- `spreadsheet-preview-summary.ts`: spreadsheet import preview summaries, section classification, and import insight text.
- `obra-defaults.ts` and `obra-defaults/**`: applying/removing tenant default folders/tables to obras.
- `obras/delete-lifecycle.ts`: obra soft-delete lifecycle, restore/deadline status, document interactions.
- `data-flow-builder.ts`: tenant/obra data-flow config model, merge/evaluation, source listing, default calculations/results/layout.
- `macro-tables.ts`, `macro-table-filters.ts`, `macro-table-source-selection.ts`: macro table source/row/filter logic.
- `route-access.ts`, `route-guard.ts`: route access config, role/macro permissions, superadmin/admin checks.
- `demo-session.ts`, `demo-capabilities.ts`: demo link/session access context and capability checks.
- `tenant-selection.ts`, `tenant-usage.ts`, `subscription-plans.ts`, `tenant-expenses.ts`: active tenant, usage metering, plan limits, expense display.
- `notifications/**`, `workflow/**`, `email/**`, `events/**`: notification/workflow/email/event helpers.
- `security/**`: rate limits, request signing, secrets.
- `billing/**`: MercadoPago and subscription access.
- `excel/**`: Excel page data/load-mode/types.
- `reporting/**`, `report/**`, `pdf/**`: reports, signals/findings, exports, PDF generation.
- `http/validation.ts`: API validation helpers.

## Local rules

- Start from the direct import named by the caller. Do not browse all of `lib`.
- Keep domain logic framework-light where possible; avoid importing UI or route modules into pure helpers.
- Preserve tenant isolation assumptions. Helpers used by routes must accept/pass `tenantId` explicitly when data is tenant-scoped.
- Do not use admin/service-role clients inside generic helpers unless the helper name and caller make the bypass explicit.
- Treat `tablas.ts`, `lineage.ts`, `data-flow-builder.ts`, `obra-defaults.ts`, `route-guard.ts`, and `tenant-usage.ts` as high-impact shared modules.
- Changes to helper return shapes require checking all direct consumers with `rg`.
- For server-only helpers, avoid accidental client imports from browser components.

## Dependencies

- Supabase clients from `utils/supabase/**`.
- API routes under `app/api/**`.
- UI consumers under `app/excel/**`, `components/form-table/**`, `components/report/**`.
- Tests under `tests/lib/**`, `tests/app/**`, and `tests/components/**`.
- Existing docs/ADRs listed below.

## Related documentation

- `CONTEXT.md`
- `docs/obsidian-brain/01 - Architecture Overview.md`
- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/23 - Observability & Testing.md`
- `docs/obsidian-brain/24 - Database Schema.md`
- `docs/obsidian-brain/26 - Key Libraries & Utilities.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`
- `docs/obsidian-brain/36 - Dynamic Tables Deep Dive.md`
- `docs/obsidian-brain/39 - API Secrets & Request Signing.md`

## Related ADRs

- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `docs/adr/0002-macro-table-overrides-bind-to-lineage.md`
- `docs/adr/0003-tenant-and-obra-data-flow-configs.md`
- `docs/adr/0004-base-kpis-are-builder-results.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/adr/0008-persist-chat-per-user-and-tenant.md`
- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`
- `docs/adr/0010-layered-traceability-canvas-separates-real-and-projected-nodes.md`

## Common tasks

### Change table parsing, normalization, formula, or field keys

Read first:

- `lib/tablas.ts`
- direct consumer route/component from the task
- `tests/lib/tablas.test.ts`
- `docs/obsidian-brain/36 - Dynamic Tables Deep Dive.md`

Do not read first:

- all table UI
- all API routes

### Change lineage or fingerprint behavior

Read first:

- `lib/lineage.ts`
- `lib/ocr-row-policy.ts`
- import route that calls it
- ADR 0001
- `tests/lib/lineage.test.ts`

Do not read first:

- UI lineage panels, unless response display changes
- migrations, unless schema columns/indexes change

### Change default folders/tables behavior

Read first:

- `lib/obra-defaults.ts`
- `lib/obra-defaults/**` if apply/remove behavior is local there
- `app/api/obra-defaults/**` or `app/api/obras/backfill-defaults/route.ts` if called by the task
- ADR 0009
- `CONTEXT.md` default/migration entries

Do not read first:

- all admin UI
- all migrations, unless schema changes

### Change data-flow builder behavior

Read first:

- `lib/data-flow-builder.ts`
- `app/api/obras/[id]/data-flow-config/route.ts` or matching route
- ADRs 0003, 0004, 0005, 0010

Do not read first:

- file-manager/OCR code, unless sources include extracted table data

### Change auth, route access, permissions, or demo access

Read first:

- `lib/route-access.ts`
- `lib/route-guard.ts`
- `lib/demo-session.ts` or `lib/demo-capabilities.ts` for demo paths
- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

Do not read first:

- unrelated feature helpers
- UI pages, unless sidebar/route visibility changes

### Change usage, billing, or plan enforcement

Read first:

- `lib/tenant-usage.ts`
- `lib/subscription-plans.ts`
- `lib/tenant-expenses.ts`
- `lib/billing/**` if payment/subscription behavior changes
- relevant API route
- `docs/obsidian-brain/35 - Usage Metering & Subscriptions.md`

Do not read first:

- OCR/import code, unless the task is usage metering for OCR/storage

## Context boundary

Normally read one helper file, its direct imports, its direct callers found with `rg "<exportName>"`, and targeted tests.

Do not explore broadly:

- `app/**`: only direct callers.
- `components/**`: only direct callers.
- `supabase/migrations/**`: only when schema/RLS/storage contracts change.
- sibling `lib` modules: only direct imports or direct callers.

Exploration is justified when helper behavior is shared, return shape changes, a helper crosses server/client boundaries, or tenant/security assumptions are unclear.

## Stop conditions

Start editing when you know the helper contract, direct callers, relevant tests, and tenant/security/storage implications.

Continue exploring only when `rg` shows multiple important callers or the helper delegates core behavior.

Stop exploring when remaining questions are about unrelated helpers, possible future abstractions, or modules that neither import nor call the target helper.

## Documentation triggers

- Update domain docs when helper behavior changes product semantics.
- Update ADRs when changing lineage, data-flow, storage, permissions, destructive defaults, or integration architecture.
- Update architecture docs when changing shared request/auth/storage/helper contracts.
- Update styleguide only when a helper change drives reusable UI behavior.

## Known risks

- Broad helper edits can create cross-feature regressions.
- Server-only imports can accidentally break client bundles.
- Tenant/security helpers affect authorization across the app.
- Lineage/default/data-flow helpers encode ADR-backed decisions.
- Some docs may lag behind current migration count and provider choices.

## Pre-commit checklist for this folder

- Identify the exported functions/types changed.
- List direct callers checked with `rg`.
- Confirm server/client import boundary remains valid.
- Confirm tenantId/RLS/admin-client implications.
- Confirm targeted tests were run or explain why not.
- Decide whether docs or ADRs need updates.
- Do not commit unless explicitly asked.

## Validation

- General helper changes: `pnpm lint`.
- Dynamic table helpers: `pnpm test -- tests/lib/tablas.test.ts`.
- Lineage/OCR policy: `pnpm test -- tests/lib/lineage.test.ts tests/lib/ocr-row-policy.test.ts tests/lib/ocr-template-sync.test.ts`.
- Spreadsheet preview: `pnpm test -- tests/lib/spreadsheet-preview-summary.test.ts`.
- Delete lifecycle: `pnpm test -- tests/lib/obras/delete-lifecycle.test.ts`.
- Billing/subscription: `pnpm test -- tests/lib/billing/subscription-access.test.ts tests/lib/billing/mercadopago.test.ts`.
- Security/rate limits: `pnpm test -- tests/lib/security/rate-limit.test.ts`.
