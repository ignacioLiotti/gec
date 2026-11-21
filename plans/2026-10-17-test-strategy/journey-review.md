# Browser journeys and runtime-check audit

## Scope and evidence

Reviewed every file under `tests/e2e/**`, `playwright.config.ts`, all `scripts/check*.mjs` and `scripts/verify*.mjs`, the four browser checks in `portfolio-guide/`, package-script entries, Storybook stories for `play`/fixture hooks, and the test-like files in `gloss-preview/` and `hierarchy-explorer/`.

I ran only:

```text
PLAYWRIGHT_SKIP_WEBSERVER=true npx --no-install playwright test --list
```

It enumerated 22 tests in 8 files (1 setup and 21 Chromium tests). It did not start the app, authenticate, call an API, or mutate data. No authenticated or mutating test was executed. There are no skipped/fixme Playwright tests and no Storybook `play` functions; `stories/product/document-generation.stories.tsx:21` has a fixture `beforeEach`, while all browser interactions live in external scripts.

## Stop gate: the current Playwright suite is not tenant-safe

Do not execute `npm run test:e2e` against the current configuration until these guards exist:

1. `playwright.config.ts:5-42` automatically imports `.env`, `.env.local`, and environment variants. `playwright.config.ts:45-48` then accepts any `PLAYWRIGHT_BASE_URL` and any server command. A developer's normal credentials and remote Supabase URL can therefore become test credentials without an explicit opt-in.
2. `tests/e2e/helpers/auth.ts:30-40` upserts the fixed tenant `00000000-0000-0000-0000-000000000001`; `tests/e2e/helpers/auth.ts:48-80` lists all auth users, creates a user or resets an existing matching user's password; `tests/e2e/helpers/auth.ts:88-96` grants that user owner membership. There is no user, membership, or tenant cleanup.
3. `tests/e2e/helpers/lineage.ts:32-47` and `tests/e2e/helpers/obras.ts:38-53` construct service-role clients, bypassing RLS. The lineage builders repeatedly upsert the same fixed tenant (`tests/e2e/helpers/lineage.ts:63-69`, `318-324`, `425-431`). These tests prove route/domain behavior as the seeded owner, not tenant isolation.
4. Lineage cleanup discards delete results (`tests/e2e/helpers/lineage.ts:223-234`). A failed delete still reports a passing test and leaks rows. A fixture that fails halfway before it is pushed into the spec's cleanup array also leaks its already-created rows. `ensureNavigationObra` creates a stable, permanent row and never cleans it (`tests/e2e/helpers/obras.ts:154-169`).
5. The extraction tests deliberately use `skipStorage=1`, `x-e2e-ocr-stub`, and injected extraction JSON (`tests/e2e/helpers/lineage.ts:236-264`, `519-575`). This is a sound deterministic boundary for lineage logic, but it does not prove storage upload, OCR-provider integration, or production gating of the test-only inputs.

Required preflight before enabling execution:

- Load a dedicated ignored `.env.e2e.local`, never generic `.env*`. Require an explicit `E2E_LOCAL=1` opt-in.
- Parse and reject `PLAYWRIGHT_BASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` unless their hosts are loopback/local-container hosts. Reject known cloud Supabase hostnames. Do this before starting Next or constructing a service client.
- Create a run-owned tenant, two run-owned users, and unique fixture prefix. Never reuse the product's default tenant ID and never update a pre-existing auth user. Record every created ID and fail the run if cleanup fails.
- Split projects by need: unauthenticated API tests need no auth bootstrap; fixture-only UI tests need no Supabase; authenticated integration tests depend on the local seed project.
- Keep `playwright/.auth` ignored (it is at `.gitignore:17`), delete its run-owned state after the run, and make CI start from a reset local database.

## File-by-file disposition

### Playwright configuration, setup, and helpers

| File | Actual entry and observable contract | Mocks, writes, cleanup, false-pass risks | Verdict |
| --- | --- | --- | --- |
| `playwright.config.ts` | Starts/reuses Next and makes every Chromium test depend on auth (`:72-94`). Captures retry traces and failure media. | Imports generic credentials (`:5-42`), accepts arbitrary app URL/server command, and retries mutations twice in CI (`:62`). | **REWRITE before running.** Add the local-only preflight, isolated projects, explicit fixture project, and mutation-safe retry policy. |
| `tests/e2e/auth.setup.ts` | Drives the real login modal and saves a session (`:20-50`). The searchbox assertion confirms the owner reaches `/excel`. | Delegates destructive identity setup to a service-role helper; persists a bearer session. It asserts only one privileged role and no tenant switch. | **REWRITE.** Seed dedicated local users once; test login separately; provide owner/member/viewer storage states. |
| `tests/e2e/helpers/auth.ts` | Fixture provisioning, not a test. | Resets an existing user's password and grants owner (`:48-96`), fixed tenant, no cleanup. | **REWRITE immediately.** Delete `ensureE2EUser`'s lookup/update path; refuse collisions and return a cleanup manifest. |
| `tests/e2e/helpers/obras.ts` | Creates through the real authenticated bulk API and reads back through the real list API (`:60-137`). | Cleanup is a service-role delete by names in the fixed tenant (`:139-151`); navigation fixture is permanent (`:154-169`). | **REWRITE.** Scope by run tenant/IDs, make navigation fixture ephemeral, and use checked cleanup results. Keep API create/read helpers. |
| `tests/e2e/helpers/lineage.ts` | Builds real relational fixtures, calls actual import/macro/lineage routes, and reads actual persisted results. | Direct service-role setup; fixed tenant; cleanup errors ignored; OCR and storage are stubbed; builders can leak partial fixtures. | **REWRITE the fixture helper, KEEP the route boundary.** Transactional/run-manifest setup, checked reverse-order cleanup, and an explicit label that provider/storage/RLS are outside this fixture. |

### Real app/API Playwright specs

| File | Production behavior actually exercised | Assertions and doubles | Verdict and exact action |
| --- | --- | --- | --- |
| `tests/e2e/admin/obra-defaults.spec.ts` | Renders the real `/admin/obra-defaults` page and exercises the folder wizard and outbound request shape (`:63-101`). | Both OCR-template and obra-default APIs are route-fulfilled (`:7-61`). It proves UI state/payload composition, not authorization or persistence. | **KEEP as fixture-backed component/browser integration**, moved to a no-auth fixture project. Add a separate real local-DB admin permission/persistence journey. |
| `tests/e2e/excel-navigation.spec.ts` | Real `/excel` list link to real `/excel/[obraId]` at mobile width (`:8-22`). | Uses a persisted helper row and asserts a heading/tab only. | **KEEP after fixture rewrite.** Small route smoke has value; add Back/reload/tenant ownership only in the larger obra journey rather than inflating this test. |
| `tests/e2e/excel/api/obras-api.spec.ts` | Real unauth rejection, authenticated create/read, invalid payload rejection, destructive legacy-sync guard, and status partition (`:24-176`). | Real local DB/API if safely configured. Cleanup is service-role by name. Error copy is partly pinned (`:32-34`, `:76-78`). | **KEEP after safety rewrite.** Assert error code/status rather than localized prose where possible. Put the unauth test in a project without setup. This file provides meaningful persistence and data-loss protection. |
| `tests/e2e/excel/ui/page.spec.ts:21-102` | Real UI creation, save response, reload persistence, search, and status tabs. | Real API/DB; cleanup by name. The save test correctly reloads before asserting (`:45-65`). | **KEEP after safety rewrite.** Extend the main journey to edit an existing obra and verify values after a fresh context, not only same-session reload. |
| `tests/e2e/excel/ui/page.spec.ts:104-208` | Renders the real toolbar/menu, but asserts literal widths, CSS durations, easing curves, transform origins, and intermediate animation geometry. | No mock, but it is implementation-pinned: a behavior-preserving motion-token change fails. | **DELETE these two tests** after retaining one keyboard/focus/open-close interaction in Storybook. Lost behavior: exact 32 px width, 180/150 ms timing and curve literals only; no business behavior disappears. |
| `tests/e2e/excel/ui/lineage-macro-conflict.spec.ts` | Renders the real macro page against real persisted conflict rows and proves the conflict is visible outside the lineage panel (`:25-70`). | Conflict is injected directly with service role (`:50-63`); extraction is stubbed. | **KEEP after safety rewrite.** Add user action/recovery and reload, because the current test stops at two strings. |
| `tests/e2e/excel/api/lineage-ticket-1-1.spec.ts` | Actual single-table import/reimport, stable identity, override survival, HTTP conflict contracts, and persisted error backing. | Provider/storage stub; service-role fixtures and direct conflict injection. Assertions at `:83-97`, `:136-146`, `:166-181`, and `:223-258` catch plausible data-loss/conflict regressions. | **KEEP and MERGE one case.** Fold `:26-47` into the reimport case by asserting the first version is `1`, then delete that standalone test. Lost behavior: none; the transition test retains its row/key/version claims and also covers reimport. |
| `tests/e2e/excel/api/lineage-ticket-1-2a.spec.ts` | Actual multi-table OCR, CSV import, reimport identity, conflict persistence, and graph projection (`:48-270`). | Provider/storage stub; direct DB fixtures/conflict injection. It validates outputs through routes and persisted records, not private calls. | **KEEP after the fixture rewrite.** It covers valuable state transitions. Rename away from ticket numbers toward domain contracts and add changed/deleted source-row cases. |

No E2E spec uses `test.skip`, `test.fixme`, or a catch that hides a failed assertion. The dangerous false-pass path is unchecked cleanup, while the dangerous execution path is environment/credential selection.

### Runtime, Storybook, and structural scripts

| File | What it really tests | Failure semantics and side effects | Verdict |
| --- | --- | --- | --- |
| `scripts/check-document-generation-state.mjs` | Mounts the real `DocumentGenerationPageClient` (story import at `stories/product/document-generation.stories.tsx:5-13`) with a fake fetch API. It exercises draft recovery, delayed writes, focus/caret preservation, save-before-generate ordering, late assist, template switching, bootstrap, and stale failure (`:88-254`). | The fixture owns all API responses (`stories/product/document-generation-fixtures.ts:298-346`); no DB/auth/storage. Individual failures are collected. **Bug:** console errors and failed resources are collected at `:10-18` but `:260` fails only on check failures or page errors. | **KEEP and REWRITE the runner.** Fail on all three browser-signal arrays, isolate each scenario in a fresh page/context, replace fixed sleeps with observable waits, and port scenarios to Playwright/Storybook tests for per-case traces. The real-client/fake-API state-machine runner is worth keeping. It does not test server persistence, permissions, or reload from a real draft. |
| `scripts/check-storybook.mjs` | Serves the built artifact, renders every story in both themes (`:9-100`), then checks actual production UI primitives and selected shared components (`:117-180`) plus contrast/mobile and imported motion suites. | Per-story exceptions are accumulated and cause nonzero exit (`:92-95`, `:263`). It does not explicitly fail local HTTP 4xx responses in the broad render loop. Writes only screenshots under ignored scratch paths. | **KEEP.** Add local failed-response collection and split broad render smoke from focused behavior/contrast tests. Render visibility remains a smoke signal, not evidence of app integration. |
| `scripts/check-motion-storybook.mjs` | Checks pinned copied vendor sources and their comparison-lab behavior, animation parameters, reduced motion, keyboard behavior, and overflow (`:14-155`). It uses production shell primitives but mostly copied vendor examples. | Local Storybook only; errors and failed local responses fail. It is already invoked by `check-storybook.mjs:246`. | **MERGE as a helper under Storybook validation.** Keep its useful source-hash/accessibility contracts; do not report it as product journey coverage. Remove the redundant standalone execution block (`:159-165`) if no developer command adopts it. |
| `scripts/check-motion-screens.mjs` | Exercises fixture/copy screens built in `stories/motion/screens/**`, with a few production primitives. Checks story-local create/edit/error/retry/document interactions and no `/api/` requests (`:45-169`). | Writes screenshots; actual product persistence, routes, and permissions are absent by design. Already invoked from `check-storybook.mjs:247`. | **MERGE as Storybook demo validation.** Preserve reduced-motion, error/retry, focus, and no-network assertions. Do not count the 16 renders as app E2E coverage; remove the redundant standalone block (`:171-193`) if unused. |
| `scripts/check-paper-vibe.mjs` | Interacts only with the `Vibe/Papel y luz` demo story (`:7-31`). | Fixed localhost, screenshots, exact demo copy/classes, no package script. | **DELETE after migrating the one useful reduced-motion assertion and basic keyboard/focus behavior into Storybook.** Lost behavior is only the standalone paper-demo workflow/screenshots. |
| `scripts/check-redesign.mjs` | Validates proposed/copy redesign stories, literal visual CSS, fixture filtering/download, and demo navigation (`:3-98`). | Fixed localhost, four concurrent pages, caught render failures rethrown via `expect(failures)`, screenshots. It does not exercise app routes or storage. No package script. | **DELETE as a standalone product test after moving any still-required component behavior into `check-storybook.mjs`.** Keep it only if the redesign demo itself remains a shipped deliverable, then name it as demo validation. Exact CSS and copied screen flows must not count toward product coverage. |
| `scripts/check-ui-contract.mjs` | Static AST lint for direct design-system imports, primitive appearance overrides, and canonical wrappers (`:23-67`). | Read-only. It tests a repository convention, not runtime behavior; exclusions and recognized syntax define its blind spots. | **KEEP as lint**, as wired by `package.json:11,39`. Do not count it as UI behavior coverage. Add focused self-tests only if this linter becomes complex enough to change frequently. |
| `scripts/verify-folder-move.mjs` | Read-only operational inspection of Storage and all known DB path references (`:254-314`). | Loads `.env.local` and service-role credentials (`:7-18`, `:225-243`), can query a remote project, prints object paths, and has no host guard. It does not perform the move or clean anything. | **KEEP as a manual operational verifier, not a test.** Add the same local/remote target disclosure and explicit remote confirmation guard; never run in the normal test gate. Unit-test its pure path normalization separately. |

There are no Storybook `play` tests. The external runner therefore owns all interaction discovery and cannot be selected or reported per story by Storybook's test tooling.

### Portfolio guide, gloss preview, and hierarchy explorer

The portfolio guide imports real production components such as `OperationalWorkspace`, `FormTable`, `DocumentSheet`, `ReportPage`, `DataFlowPageClient`, and `SampleAnalysisCard`. Its Vite aliases replace Next navigation/dynamic/PDF/XLSX boundaries and install a local session-storage API (`portfolio-guide/vite.config.ts:37-59`). Its browser flows prove those components can work together with curated fixture data. They do not prove Next routes, Supabase persistence, RLS, storage, or permissions.

| File | Contract | Verdict and exact action |
| --- | --- | --- |
| `portfolio-guide/check.mjs` | Loads seven guide screens, records text/a11y snapshots/screenshots, and fails on browser errors, external/API requests, or the generic load-error copy (`:18-95`). Most assertions amount to "some text rendered." | **MERGE, then DELETE.** `interactions.mjs` already visits all seven screens and checks errors/network. Move any desired per-screen artifact capture to a clearly named non-gating snapshot command. Lost test behavior: broad render smoke only. |
| `portfolio-guide/interactions.mjs` | Exercises local document correction feeding reports, fullscreen/return, report presets and CSV/XLSX contents, print handoff, clean-context share links, obra edit/reload, setup, data-flow import, reset, offline-network denial, and mobile containment (`:45-339`). | **KEEP as fixture-backed production-component integration.** Split into named Playwright cases with fresh contexts so an early failure does not hide every later contract. State is sessionStorage and a fake local API, which must be explicit in reports. |
| `portfolio-guide/journey.mjs` | A coherent guided case: wrong-save guard, resize keyboard/drag, focused edit preservation, save, report propagation, real downloaded CSV content, progress reload, exit (`:25-149`). | **KEEP.** It is the best end-user-shaped guide test, but remains local fixture persistence. Merge overlapping amount/save/export steps from `interactions.mjs` into this journey only if each unique failure remains attributable. |
| `portfolio-guide/operations-check.mjs` | Month/KPI/tooltip interactions, Escape/focus, narrow-container/mobile containment, and guide drilldown (`:23-108`). | **MERGE into `interactions.mjs`, then DELETE.** Preserve the unique narrow-container and tooltip-bounds assertions. The rest duplicates its opening operations sequence. |
| `gloss-preview/package-preview.mjs` | Reads built JS/CSS, rejects remaining JS imports, and writes a single-file offline HTML (`:1-25`). | **KEEP as packaging/post-processing, not a test.** It mutates the generated preview and has no root package-script entry. Give it an explicit build command and validate the final HTML can boot offline in a separate check if this artifact ships. |
| `hierarchy-explorer/**` | `hierarchy-explorer/package.json:6-10` exposes only dev/build/preview. No check/test script or test-like source exists. | **No tests to delete.** If this explorer ships, add one render/build smoke; if it is an internal design artifact, the build is sufficient and should not count as product coverage. |

The root `portfolio:check` chains four large scripts (`package.json:45`), so one early process failure prevents later evidence and the output has no per-test report. Convert retained guide journeys into a normal Playwright project with named tests, traces, and fresh contexts.

## Deletion and merge manifest

These are the concrete low-value or duplicate candidates for the owning agent:

1. Delete `tests/e2e/excel/ui/page.spec.ts:104-208`. Keep only observable menu keyboard/focus/open-close behavior in Storybook. No persisted or business behavior is lost.
2. Merge `tests/e2e/excel/api/lineage-ticket-1-1.spec.ts:26-47` into `:49-98`, add `expect(firstMaterializationVersion).toBe(1)`, then delete the standalone case.
3. Merge the unique assertions from `portfolio-guide/check.mjs` into the retained guide suite, then delete the file or reclassify it as a non-gating artifact generator.
4. Merge `portfolio-guide/operations-check.mjs:43-93` (narrow container, mobile tooltip bounds, Escape/focus) into `interactions.mjs`; delete the rest as duplicate.
5. Move the reduced-motion assertion from `scripts/check-paper-vibe.mjs:30-31` and any still-required demo interaction into Storybook; delete `scripts/check-paper-vibe.mjs`.
6. Migrate still-required production-component assertions from `scripts/check-redesign.mjs` to Storybook, then delete the standalone file. Its replica-screen navigation, exact 21/17/15 px CSS, and demo screenshots are not product contracts.
7. Keep `scripts/check-motion-storybook.mjs` and `scripts/check-motion-screens.mjs` as imported Storybook helpers, but remove their self-running blocks if no explicit developer command needs them. This removes duplicate ways to run the same checks without deleting the checks.

Do not delete the small navigation smoke, unauthenticated API check, lineage transition tests, or document-generation state runner. They catch plausible regressions even though each needs clearer scope and safer setup.

## Missing critical journeys

Visible headings and screenshots are useful smoke signals. They do not establish that data was authorized, committed, isolated, or recoverable. The largest absent contracts are:

| Priority | Real user journey and required proof | Missing today |
| --- | --- | --- |
| P0 | **Tenant boundary:** create tenant A and B; owner A, member A, owner B. Switch A→B and reload; list/detail/API results must change. Attempt A's obra/table/document/macro IDs while authenticated as B and receive 404/403 with no mutation. | Every authenticated E2E is a fixed-tenant owner; service-role fixture reads can mask RLS failures. |
| P0 | **Permission outcomes:** viewer can read but cannot create/edit/delete; member can perform only granted actions; tenant admin can manage roles/defaults; denied direct URLs and denied API calls agree. Verify inherited role, explicit allow, explicit block, and user override after reload. | One mocked admin wizard and a fixture permission control story; no real route/API permission enforcement. |
| P0 | **Obra persistence/lifecycle:** create, edit representative numbers/dates, reload in a fresh context, complete, search/filter, trash, restore, and permanently delete with downstream visibility checked. | Create/reload and status filter exist; edits, trash/restore/delete and cross-session persistence do not. |
| P0 | **Documents/OCR/lineage:** upload to local storage, create/move folder, import deterministic OCR, edit extracted row, reload, reimport changed/added/deleted rows, preserve overrides, show and resolve conflicts, then verify report/macro consumers. | Current route tests cover several stubbed lineage transitions. Storage, UI review-to-resolution, deleted-row, permission, and reload journeys are absent. |
| P0 | **Document generation:** create draft, autosave under slow/out-of-order responses, close/reopen from DB, assist, generate, reject/reopen, edit, approve, and enforce download rules for each role. | Excellent real-client/fake-API state-machine coverage; no actual route/DB/permission/reload integration. |
| P1 | **Invitation/onboarding/tenant switch:** invite a new user, accept token, finish onboarding, select active tenant, reload, log out/in, and verify active tenant persists without exposing the inviter's other tenants. | No browser coverage. |
| P1 | **Report/data-flow propagation:** save source rows, reload, build/filter report, save preset, export and inspect contents, share with allowed/denied users, and revoke access. | Rich portfolio fixture flow; no real app API/DB/share authorization. |
| P1 | **Admin defaults:** author defaults, create a new obra, verify defaults materialize once, change defaults, and prove existing obra data is not destructively overwritten. | Wizard payload only; persistence and the non-destructive domain rule are unproved in browser/API integration. |
| P1 | **Notifications/automation:** trigger a domain event, observe one in-app notification, reload/read state, retry dispatcher without duplicates, and prove tenant/user targeting. Stub email/WhatsApp delivery at the outbound adapter. | No E2E coverage. |
| P2 | **Impersonation and billing/access transitions:** enter/exit impersonation with audit evidence; subscription/limit change affects access after reload while preserving tenant isolation. | Unit/helper coverage may exist, but no real user journey. |

## Replacement suite design

### 1. Deterministic environments

- **Fixture browser project:** no auth dependency, no generic env loading, no network beyond loopback. Runs Storybook and portfolio-component state tests.
- **Local integration project:** reset local Supabase, seed migrations, create run-owned tenant/users, start Next with an explicit test env, and use real app/API/storage. Stub only external providers (OCR model, email, WhatsApp, payment) at their outbound adapter.
- **External contract jobs:** opt-in, read-only or sandbox accounts, never part of a normal local run. Folder-move verification remains here.

Every mutating fixture returns IDs immediately to a run manifest. Cleanup runs even after partial setup, checks every result, deletes only rows bearing the run ID/tenant ID, and fails on residue. CI should prefer database reset over ad hoc cleanup. Retries may repeat idempotent reads; mutating tests need unique run IDs and cleanup that is safe after partial completion.

### 2. Test observable state transitions

Use named state transitions rather than screen tours:

```text
draft → dirty → saving → newer local edit → stale response ignored → saved → reload → same value
document uploaded → extracted → manually corrected → reimported → override preserved/conflict shown → resolved
active tenant A → switch B → reload → B remains active → direct A resource denied
obra active → completed → trashed → restored → deleted → absent from all consumers
```

For each transition assert the user-visible result and one durable read-back through the public API/UI. A screenshot or heading may accompany the assertion but cannot replace it.

### 3. Keep boundaries honest

- Label `real client + fake API`, `real route + fake provider`, and `real local stack` in test names/report metadata.
- Never let service-role reads be the only assertion for an RLS claim. Use the authenticated user's request context for allow/deny behavior; use service role only for fixture setup and post-test residue checks.
- Assert semantic contracts: status/code, persisted value, absence of duplicate effects, enabled action, restored focus. Avoid literal animation milliseconds, pixel radii, private helper calls, or localized error prose unless those are explicit design/accessibility requirements.
- Pair negative observations with a positive control. For example, a viewer's blocked create must sit beside an owner's successful create so the test proves it can observe both paths.

### 4. Practical gates

1. Pull request: unit/domain tests, static UI contract, type checks, built Storybook render/interaction checks, fixture-backed state-machine tests.
2. Pull request when app/domain routes change: focused local-stack Playwright journey for that capability and tenant/permission case.
3. Main/nightly: all P0 local-stack journeys across Chromium; cross-browser only for shared interaction primitives and high-risk document/table flows.
4. Release/manual sandbox: external provider contracts, email/WhatsApp receipt, payment sandbox, large-file/performance, and operational folder-move verification.

## Recommended migration order

1. Add the local-only preflight and isolated run-owned fixtures. Until then, keep Playwright execution disabled/list-only.
2. Remove the two CSS-timing E2E cases and merge the redundant lineage import case.
3. Convert the document-generation runner and portfolio scripts into named Playwright tests; fix browser-signal failure handling and split stateful scenarios into fresh contexts.
4. Implement the P0 tenant/permission matrix first. It is the highest-risk gap and cannot be inferred from owner/service-role tests.
5. Add the P0 persistence journeys for obras, documents/OCR/lineage, and document generation.
6. Merge/delete the duplicate demo and portfolio scripts, leaving one clear owner for Storybook behavior and one for guide journeys.
7. Add P1 invitation, admin-default, report/share, and notification/automation journeys; keep external providers stubbed until opt-in sandbox jobs.

## Verification status

- Test discovery passed: 22 Playwright tests in 8 files, with no skip/fixme entries.
- No app server, browser journey, authenticated request, service-role client, database, storage, or external provider was started or contacted.
- No production or test source was edited by this review. Only this report was added.
