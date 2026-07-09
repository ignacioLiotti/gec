# Agent Context: tests

## Purpose

All automated tests. Structure mirrors the source tree: unit/integration tests with Vitest, browser flows with Playwright.

## Area map

- `lib/` — Vitest tests for `lib/**` helpers (tablas, lineage, OCR policy, billing, security, delete lifecycle…). The richest coverage in the repo; `lib/AGENT_CONTEXT.md` lists which test file guards which helper.
- `app/` — Vitest tests for route handlers / server logic under `app/**`.
- `components/` — Vitest tests for shared components.
- `e2e/` — Playwright specs: `auth.setup.ts` (session bootstrap), `excel/` + `excel-navigation.spec.ts` (main product surface), `admin/`, shared `helpers/`.

## Commands

```bash
pnpm test                          # all Vitest
pnpm test -- tests/lib/lineage.test.ts   # targeted file
pnpm test:watch
pnpm test:e2e                      # Playwright (config: playwright.config.ts)
pnpm test:e2e:ui
```

## Local rules

- Prefer the smallest targeted run that covers the change; full suites are for pre-handoff.
- New helper in `lib/**` with branching logic → add a matching `tests/lib/**` file.
- E2E specs must be tenant-safe: use the seeded demo tenant / auth setup helpers, never real credentials.
- Vitest setup lives in `vitest.setup.ts` (root); Playwright config in `playwright.config.ts`. `test-results/` is output, never edited.
- When a test fails after your change, fix the code or the contract — do not weaken assertions to pass.

## Related documentation

- `docs/obsidian-brain/23 - Observability & Testing.md`
- `docs/test-plan/obra-flows.md` (manual test plan)

## Validation

This folder *is* the validation. Keep it green.
