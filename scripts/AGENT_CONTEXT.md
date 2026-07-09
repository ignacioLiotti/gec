# Agent Context: scripts

## Purpose

One-off operational scripts run manually by a developer (Node `.mjs` or PowerShell). They are **not** part of the app runtime. Most talk to the database directly, so treat them as high-impact.

## Main files

- `bootstrap-demo-tenant.mjs` — creates/refreshes the demo tenant (`pnpm seed:demo-tenant`).
- `backfill-demo-template.mjs`, `backfill-demo-certificados-config.mjs`, `backfill-demo-purchase-orders.mjs` — demo-tenant data backfills.
- `backfill-obra-defaults.mjs` — applies tenant default folders/tables to existing obras (pairs with `lib/obra-defaults.ts`; see ADR 0009 — default sync must be non-destructive).
- `clone-prod-to-local.ps1` — clones production data into the local Supabase stack (`pnpm clone:prod-to-local`). Requires prod credentials; read it fully before running.
- `export-workbook-sheets-to-csv.mjs` — spreadsheet export utility.
- `verify-folder-move.mjs` — verifies storage folder-move integrity (`pnpm verify:folder-move`).

## Local rules

- Scripts that mutate data must be idempotent or clearly documented as one-shot, and must scope by tenant explicitly — there is no RLS safety net when using service-role keys.
- Never point a backfill at production without a dry-run mode or an explicit confirmation step.
- New scripts get a `package.json` script entry and a mention here.
- Environment comes from `.env.local`; never hardcode keys.

## Related documentation

- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`
- `docs/supabase-backup.md`, `docs/orphan-cleanup.md`
- `supabase/migrations/AGENT_CONTEXT.md`

## Validation

- Run against the **local** stack first (`pnpm supabase:start` + `pnpm db:reset`), verify results, then consider remote.
