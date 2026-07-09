# Testing Guide

## Layers

| Layer | Tool | Location | Command |
| --- | --- | --- | --- |
| Unit / integration | Vitest | `tests/lib`, `tests/app`, `tests/components` | `pnpm test` |
| Browser end-to-end | Playwright | `tests/e2e` | `pnpm test:e2e` |
| Manual test plans | — | `docs/test-plan/` | — |

Configs: `vitest.config.ts` + `vitest.setup.ts`, `playwright.config.ts`. Playwright output lands in `test-results/` (gitignored territory — never edit).

## The golden rule: run the smallest thing first

```bash
pnpm test -- tests/lib/lineage.test.ts        # one file
pnpm test -- tests/lib                        # one area
pnpm test                                     # everything (pre-handoff)
pnpm test:watch                               # TDD loop
pnpm test:e2e:ui                              # Playwright with inspector
```

`lib/AGENT_CONTEXT.md` maps each high-impact helper to its guarding test file (tablas, lineage, OCR policy, spreadsheet preview, delete lifecycle, billing, rate limits).

## What to test where

- **`lib/**` helper with branching logic** → Vitest in `tests/lib/**`. This is the highest-value coverage in the repo; keep it dense.
- **API route behavior** (validation, auth failures, response shape) → `tests/app/**`.
- **Shared component logic** (not pixels) → `tests/components/**`.
- **User journeys** (login, navigate obras, edit a table) → Playwright spec in `tests/e2e/**`, using `auth.setup.ts` and `helpers/`.

## E2E specifics

- Sessions come from `tests/e2e/auth.setup.ts`; specs assume the seeded demo tenant (`pnpm seed:demo-tenant`).
- Local stack must be running (`pnpm supabase:start`) with a reset DB for deterministic runs (`pnpm db:reset`).
- Specs must never depend on production data or real credentials.

## Writing good tests here

- Test the **contract**, not the implementation: helper return shapes, error codes (e.g. classified OCR errors like `LINEAGE_RECONCILIATION_CONFLICT`), state transitions.
- Domain rules from `CONTEXT.md` are test material: lineage reconciliation, non-destructive sync, compatibility classification, recommendation dedup. If you implement a rule, encode it in a test.
- Tenant isolation is a feature: when touching queries or RLS-adjacent helpers, add a test that a second tenant *cannot* see the data.
- A failing test after your change means the code or the contract is wrong — fix that, don't loosen the assertion.

## CI status

There is currently no CI pipeline enforcing these suites (a known gap — see `plans/`). Until that lands, running `pnpm lint && pnpm test` before handing off is a social contract, not an automated one. Take it seriously.
