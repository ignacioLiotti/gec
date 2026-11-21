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
- `recovery/verify-recovery-set.mjs` — validates local recovery artifacts and a recorded isolated restore attestation (`npm run recovery:verify -- --manifest <path> --verify-artifacts`). It never captures production data or starts a restore. `recovery/status-contract.mjs` is also consumed by the server operations reader; only its sanitized status belongs in the console.
- `check-document-generation-state.mjs` — exercises the real document editor in local Storybook with synthetic API fixtures (`npm run test:document-generation:runtime`). Requires the Storybook URL supplied by its command options; never uses a tenant session or production API.
- `test-integration.mjs` — owns an isolated temporary application and optional fresh Supabase stack for Playwright. Uses no ordinary `.env*`, existing auth identities or shared database. `--public` needs no Docker; `--list` starts nothing. `integration-local-network.mjs` restricts HTTP transports inside that test-only Next process.
- Its programmatic `publicSignup` option defaults to false. The launch-QA launcher in `plans/2026-10-19-launch-qa/start.mjs` opts in only for fresh local first-time-user journeys; ordinary permission/integration runs retain the disabled-signup contract. Its temporary host spec is orchestration, not evidence of a successful user flow.
- `integration-ocr-provider.mjs` is a private helper of the owned authenticated runner, not an operational command. It accepts registered synthetic byte hashes and returns the Gemini response envelope or a declared failure. The test-only network preload rewrites only the exact Gemini generateContent fetch to this owned loopback server; ordinary external requests remain blocked. No provider credentials or production endpoint configuration are used. The runner closes and verifies this listener during teardown.
- `check-permission-migration.mjs` — checks legacy override backfill, permission precedence and migration convergence inside a rolled-back transaction. Its integration spec supplies a running owned manifest; the script validates the exact Docker container before SQL execution. `--emit` only prints inspectable synthetic SQL.

## Local rules

- Scripts that mutate data must be idempotent or clearly documented as one-shot, and must scope by tenant explicitly — there is no RLS safety net when using service-role keys.
- Never point a backfill at production without a dry-run mode or an explicit confirmation step.
- New scripts get a `package.json` script entry and a mention here.
- Operational scripts may use `.env.local`; never hardcode keys. The integration runner is an explicit exception: it excludes development secrets, generates its own local configuration and must not select an existing stack.

## Related documentation

- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`
- `docs/supabase-backup.md`, `docs/orphan-cleanup.md`
- `supabase/migrations/AGENT_CONTEXT.md`

## Validation

- Run against the **local** stack first (`pnpm supabase:start` + `pnpm db:reset`), verify results, then consider remote.
