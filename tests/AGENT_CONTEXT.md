# Agent Context: tests

## Purpose

All automated tests. Structure mirrors the source tree: unit/integration tests with Vitest, browser flows with Playwright.

## Area map

- `lib/` — Vitest contracts for `lib/**`: parsing, formulas, lineage, OCR policy, billing, access and simulated persistence. These do not establish HTTP authorization, real database isolation or complete user journeys.
- `app/` — Vitest tests for route handlers / server logic under `app/**`.
- `components/` — Vitest tests for shared components.
- `e2e/` — Playwright specs under `public/`, `integration/`, `excel/` and `admin/`. `fixtures/test.ts` owns authenticated scenarios; `fixtures/public.ts` provides auth-free browser isolation. Shared auth setup and fixed identities were removed.
- `tooling/` — checks of test execution boundaries, including the local-only E2E target guard.

## Commands

```bash
npm test                          # all Vitest
npm test -- tests/lib/lineage.test.ts   # targeted file
npm run test:watch
npm run typecheck:tests            # test source and Playwright/Vitest configuration
npm exec playwright test -- --list # discovery, no credentials or server
npm run test:e2e:public            # owned temporary Next app, no database/auth setup
npm run test:e2e                   # owned temporary app + fresh Supabase, requires Docker
```

## Local rules

- Prefer the smallest targeted run that covers the change; full suites are for pre-handoff.
- Add tests around observable contracts and failure risks, not one file per helper. A public workflow or state sequence may protect several helpers. Keep small cases when they guard dangerous parsing, financial or access boundaries.
- Expected values must come from a requirement or independent fixture. Do not use production helpers to manufacture their own expected answer, or validate a copied implementation instead of the production entry.
- Check both positive and negative behavior. A test of deduplication must also prove that an eligible new record is inserted. A mock that ignores tenant/obra/status filters cannot prove scoping or RLS.
- Browser fixtures must import real product components. Label their fake network/storage boundaries; do not count copied demo screens as app E2E coverage.
- Vitest setup lives in `vitest.setup.ts` (root); Playwright config in `playwright.config.ts`. `test-results/` is output, never edited.
- When a test fails after your change, fix the code or the contract — do not weaken assertions to pass.

## Local E2E execution

Playwright discovery is credential-free. Execute through `scripts/test-integration.mjs` using the package commands. It creates a fresh temporary Supabase project and application snapshot, disables the ordinary seed and external auth, excludes `.env*`, and passes only owned local keys. Direct execution without a matching run manifest fails. `--list` starts no runtime. Do not print key values.

The runner starts a fixed Next dev command with webpack in the temporary snapshot. It retains the real proxy and instrumentation, uses its own build cache, and disables the versioned service-role selector. Test processes receive per-run artifact paths. `public` needs no Supabase runtime; `authenticated` uses the actual local stack.

Authenticated browser contexts pin only the SYNC compilation hash on the owned app's `/_next/webpack-hmr` transport to its initial value. The snapshot is immutable; a later development hash otherwise looks like a server restart and reloads an in-progress flow during cold compilation. The socket remains connected and all other development messages, product HTTP, Supabase and business WebSockets remain real. This is a development-stack verification boundary, not production-build or performance proof. The causal CDP evidence is in `plans/2026-10-19-deep-document-qa/hmr-runtime.md`.

Those contexts also send `Connection: close` for HTTP requests. Playwright's browser-bound API contexts otherwise share a pooled socket across test identities, including after a context closes; a server closing that idle socket can reset the next test's setup write. The owned HTTP probe reproduces the shared-socket failure and verifies distinct connections plus a working browser WebSocket upgrade. Keep retries at zero; never replay a setup mutation to hide a connection error. See `plans/2026-10-19-deep-document-qa/http-connection-probe.mjs` and its JSON evidence. This policy belongs to the local test runtime and makes no production performance claim.

Each authenticated test attempt owns two tenants and lazy owner/admin/editor/viewer/otherOwner actors. Admin has an actual admin membership. Editor/viewer are member identities with operational roles, not membership enum variants. Actors have actual SSR sessions and anon-key RLS clients. Service role is private to setup/cleanup; business assertions use actor requests/DB clients. Purpose-named seed operations prepare lineage, role conflicts and tenant-scoped user overrides.

The fixture-lifecycle specification may use a private administrator observer to verify rollback and Storage residuals. The permission-migration specification uses a verified owned database container for a transactional legacy backfill simulation and rolls back all synthetic schema/data changes. Neither is a substitute for authenticated business assertions.

Fixtures persist secret-free resource intents before writes, drain pending setup, close contexts and verify auth/profile/Storage cleanup. Product soft-delete triggers leave SQL rows present, so fixtures retain their unique tenants and record `awaiting-stack-disposal`. The runner verifies removal of the owned stack's containers, volumes and network plus the app process/port/snapshot before marking manifests `disposed`. It preserves runtime-cleanup failures. Errors during readback do not establish absence. A stopped worker can leave resources; use the recorded run/project identity for recovery and never adopt an ordinary development instance.

Runtime verification is recorded in `plans/2026-10-17-isolated-integration/README.md`. Discovery and type checking do not prove cleanup, RLS or auth works. Existing lineage specs deliberately stub OCR extraction/storage while exercising routes and SQL. Permission specs express ADR 0029 and protect the `0132` repair; do not skip them or change fixtures to hide a regression.

`e2e/documents/` and `e2e/document-generation/` add complete file, extraction, template, draft and review cases. The lifecycle fixture seeds only the obra/table/template/signature preconditions. Business writes and readbacks use actual actor sessions. PDF assertions parse actual downloaded bytes. The recovery spec delays one real save request and continues it to the actual backend; it does not fulfill application responses.

Authenticated runs also own a synthetic Gemini transport. `helpers/ocr-provider.ts` registers an exact input hash, MIME and response, then inspects metadata-only request evidence and removes its registration. The app's actual upload, OCR validation, token accounting, Storage, SQL, reimport and RLS remain real. This proves orchestration and failure recovery, not OCR recognition quality or live-provider compatibility. Keep the older lineage stubs labeled separately. See `plans/2026-10-19-deep-document-qa/` for named cases and runtime evidence.

No database, auth account, storage or provider execution is authorized merely by reading this context. Follow the task's authority and use a disposable instance.

## Related documentation

- `docs/obsidian-brain/23 - Observability & Testing.md`
- `docs/test-plan/obra-flows.md` (manual test plan)
- `docs/test-plan/testing-strategy.md` (target layers, all 40 product workflows, fixtures and CI gates)
- `docs/adr/0038-local-only-e2e-execution.md`
- `docs/adr/0039-owned-local-integration-fixtures.md`
- `plans/2026-10-17-test-strategy/` (file-by-file audit and mutation evidence)
- `plans/2026-10-17-isolated-integration/` (fixture design, implementation and runtime evidence)

## Validation

This folder *is* the validation. Keep it green.
