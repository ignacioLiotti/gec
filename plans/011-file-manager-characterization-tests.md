# Plan 011: Characterization tests for the file manager (prerequisite to any decomposition)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- "app/excel/[obraId]/tabs/file-manager/" tests/e2e/`
> The file-manager is the highest-churn file in the repo — drift is EXPECTED.
> The tests below assert user-visible behavior, not implementation, so drift
> only matters if a workflow itself changed; check the UI flows, not the code.

## Status

- **Priority**: P3
- **Effort**: M–L
- **Risk**: LOW (test-only)
- **Depends on**: 006 strongly recommended first (it establishes/validates the e2e fixture workflow this plan reuses)
- **Category**: tests
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

`app/excel/[obraId]/tabs/file-manager/file-manager.tsx` is **8,798 lines**, the single highest-churn file in the repo (58 commits touching it in the last 3 months — uploads, folder navigation, previews, OCR links, document moves), and has **zero test coverage** of any kind. Every change to it ships blind. Decomposing it (a future plan) is unsafe without a behavioral safety net. This plan builds that net: Playwright characterization tests for the core user workflows, asserting what the user sees — so they survive the eventual refactor and fail only when behavior actually changes.

## Current state

- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx` — the god component (8,798 lines). You should NOT need to read most of it; characterization tests target the rendered UI.
- The file manager renders inside the obra workspace at `/excel/<obraId>` under a documents tab (`components/excel-page-tabs.tsx` defines the tab strip; `app/excel/[obraId]/page-client.tsx` hosts it). Open the app and navigate once before writing selectors.
- E2E infra (same as plan 006): `playwright.config.ts` auto-loads `.env*`, starts `npm run dev`, auth state in `playwright/.auth/user.json` via `tests/e2e/auth.setup.ts`. Existing spec exemplar: `tests/e2e/excel-navigation.spec.ts` (read it for selector style and the `test.use`/setup conventions). Obra creation helper: `tests/e2e/helpers/obras.ts` (`createObraViaBulkApi` or similar — read the file for the exact export).
- Relevant API surfaces the UI calls (useful for request-assertions and seeding): `app/api/obras/[id]/documents/**` (upload, deletes, deletes/restore, access/batch), folder tree under `documents-tree` (note: `proxy.ts:160-161` exempts `documents-tree` from rate limiting — it's chatty).
- Uploads in Playwright: `page.setInputFiles` on the file input with a small fixture file; create `tests/e2e/fixtures/sample.pdf` (a minimal valid PDF, ~1 KB — generate with a few bytes: `%PDF-1.4` header + empty page object; or check whether `tests/` already has any fixture to reuse: `Get-ChildItem -Recurse tests -Include *.pdf,*.xlsx`).

## Commands you will need

| Purpose      | Command                                                  | Expected on success |
|--------------|----------------------------------------------------------|---------------------|
| Run the spec | `npx playwright test tests/e2e/file-manager.spec.ts`     | all pass            |
| Headed debug | `npx playwright test tests/e2e/file-manager.spec.ts --headed` | for selector work |
| Typecheck    | `npm run typecheck`                                      | exit 0              |

## Scope

**In scope** (create only):
- `tests/e2e/file-manager.spec.ts`
- `tests/e2e/fixtures/sample.pdf` (tiny binary fixture)
- `tests/e2e/helpers/documents.ts` (optional, if shared steps emerge)

**Out of scope** (do NOT touch):
- `file-manager.tsx` itself or ANY production code — including adding `data-testid` attributes. If selectors are impossible without testids, that's a STOP condition (it's a 1-line production change that needs sign-off, not improvisation).
- Refactoring/decomposing the component — explicitly a later plan that depends on this one.
- Unit/component tests for file-manager internals — at 8,798 lines with heavy context dependencies, component testing is not cost-effective pre-decomposition.

## Git workflow

- Branch: `advisor/011-file-manager-tests`
- Commit per scenario or as one commit; short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reconnaissance run

Start the stack (`npm run dev`, or rely on Playwright's webServer), create a fresh obra via the helper in `tests/e2e/helpers/obras.ts`, navigate to its documents tab, and record (screenshots or notes): the folder-create control, upload control, document row/card rendering, context-menu or action buttons for move/delete, and the trash/restore surface. Identify stable selectors (`getByRole`, `getByText` with Spanish labels — the UI is es-AR).

**Verify**: you can reach the file manager for a fresh obra in a headed run.

### Step 2: Scenario 1 — folder create + upload + listing

Test: create folder "Pólizas Test" → assert it appears; upload `sample.pdf` into it → assert the document appears with its name; reload the page → both still present (persistence, not just optimistic state).

**Verify**: `npx playwright test tests/e2e/file-manager.spec.ts -g "upload"` → passes.

### Step 3: Scenario 2 — move document between folders

Test: with two folders and one uploaded document, move the document (via whatever UI affordance exists — context menu/move dialog; discovered in Step 1) → assert it disappears from the source folder listing and appears in the target after reload.

**Verify**: `-g "move"` → passes.

### Step 4: Scenario 3 — delete and restore

Test: delete the uploaded document → assert removal from listing; locate the deleted/trash surface (the API has `documents/deletes` and `deletes/restore`) → restore → assert it reappears.

**Verify**: `-g "delete"` → passes.

### Step 5: Scenario 4 — upload validation/error surface

Test the unhappy path that's cheapest to trigger deterministically: e.g. uploading a duplicate filename (the backend dedupes with numeric suffixes — assert the renamed file appears, e.g. `sample (2).pdf`), or an empty folder name rejection. Pick ONE deterministic case from Step 1 observations.

**Verify**: `-g "duplicate"` (or chosen tag) → passes.

### Step 6: Stability pass

Run the full spec 3 times consecutively. Flaky selectors/waits get fixed now (prefer `await expect(locator).toBeVisible()` auto-waits; never `waitForTimeout`). Ensure each test creates its own obra (isolation) and cleans up or uses unique names so reruns don't collide.

**Verify**: `npx playwright test tests/e2e/file-manager.spec.ts` ×3 → 3/3 green.

## Test plan

This plan IS tests: 4 scenarios (upload+folder, move, delete+restore, duplicate-name). Gate: full spec green 3× consecutively against the local stack.

## Done criteria

- [ ] `tests/e2e/file-manager.spec.ts` exists with ≥4 scenarios
- [ ] Spec passes 3 consecutive runs locally
- [ ] No production files modified — `git status` shows only `tests/e2e/**` additions
- [ ] `npm run typecheck` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The local environment lacks Supabase/`.env` to run e2e — mark BLOCKED with the missing prerequisite; do not fake it with mocks.
- Selectors are impossible without adding `data-testid` to production markup — stop and report which elements need them (a follow-up 5-line production PR), rather than writing brittle nth-child selectors.
- A scenario exposes a real bug (e.g. restore doesn't restore) — write the failing test, mark `test.fixme` with a comment, report it as a finding, and continue with the other scenarios.
- The documents tab has been replaced (note: `app/excel/[obraId]/tabs/documents-new-tab.tsx` exists untracked on the planning branch — a new implementation may be landing). If the UI you find doesn't match `file-manager.tsx`, report which component actually renders before writing tests against it.

## Maintenance notes

- These tests are the gate for the future decomposition plan ("split file-manager.tsx into folder-tree / list / preview components"): that plan must run this spec green before AND after.
- When `documents-new-tab.tsx` ships, rerun this spec against it — characterization tests are exactly what makes that swap safe; expect selector updates, not scenario changes.
- Keep scenarios behavioral (user-visible). Anyone adding implementation-coupled assertions (store state, network call counts) is eroding the suite's refactor-survival property.
