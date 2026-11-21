# Test audit and replacement strategy

Status: Audit and focused cleanup completed locally on `codex/structure-improvements-2026-10-17`. The whole-app integration strategy remains proposed. No commit or authenticated database run was made.

## Findings

The suite has useful domain and access-boundary tests, but weak evidence that those contracts are wired into real routes, persisted data and customer workflows. Deleting every small test would remove useful protection without filling that gap.

A concrete false-positive case justified the cleanup. Replacing the MercadoPago signature manifest with a constant still passed all 18 original billing tests. The old test used the production manifest builder to construct its expected signature. An independent fixed signature now detects the same mutation. [Before](mutation-before.json), [after](mutation-after.json), [repeatable check](mutation-check.mjs).

The original inventory contained 38 Vitest files, 7 Playwright specs plus auth setup, 52 Storybook stories, 4 portfolio validators and 8 script validators. All 113 original entries were reviewed. The final inventory has 115 entries after adding a local-target guard and its tests. The 52 stories have no interaction `play` functions; they are a component catalog, not 52 passing user journeys. No SQL tests or checked-in CI workflow were discovered.

The most urgent integration risk is fixture setup. The existing Playwright helpers can reuse a fixed tenant, reset an existing user's password and provision an owner. Cleanup is incomplete. Execution now requires explicit local targets and a dedicated server, but run-owned identities and checked cleanup still need implementation. No authenticated E2E execution was attempted during this audit.

## Cleanup performed

Five standalone cases were removed or merged:

| File | Removed case | Retained proof |
| --- | --- | --- |
| `tests/lib/admin/tenant-limit-access.test.ts` | Feeding the implementation's exported manager email back to its predicate | Literal allowed identity with case/space normalization and denied identities |
| `tests/lib/macro-table-filters.test.ts` | Duplicate helper-only slash-spacing case | Both spacing directions through public row filtering |
| `tests/e2e/excel/ui/page.spec.ts` | Exact toolbar animation dimensions/timing | User creation/save/reload journey retained |
| `tests/e2e/excel/ui/page.spec.ts` | Exact Columns-menu easing curve | Open, Escape, closed state and restored focus moved into the retained journey |
| `tests/e2e/excel/api/lineage-ticket-1-1.spec.ts` | Separate first-import lineage-key case | First identity/version checks merged into the reimport transition |

Other changes strengthen observable contracts:

- Billing uses an independent signature fixture, tamper/missing-input cases, a secret-leak assertion and exact outbound HTTP request contracts.
- HTTP validation checks coercion, unknown-field stripping, nested failures and malformed JSON.
- Document AI opens actual DOCX/PPTX packages and finds fixture content, allowing internal pagination changes.
- Blueprint tests check named resources, uniqueness and valid references instead of exact inventory sizes.
- Writeback tests create a suggestion, repeat it, and vary value, obra, tenant and pending/accepted state. Their stateful fake observes writes and filters; it does not prove database constraints or RLS.
- Editor hydration is followed by a save and inspection of its transport target. The existing revision/race cases remain.
- An ambiguous date fixture became ISO input with an exact expected timestamp. Production date parsing was not changed.
- The generation browser runner now fails on collected browser errors, requires a local Storybook URL and observes completion of the queued template save. Only the exact missing Storybook favicon is answered locally.
- Screenshot capture moved from `portfolio:check` to `portfolio:capture`. Useful interaction validators and manual design-artifact validators remain.
- A local-only Playwright preflight rejects remote targets, custom child commands and arbitrary existing servers. Next receives the validated local keys with the versioned service-role selector disabled. [ADR 0038](../../docs/adr/0038-local-only-e2e-execution.md) records its limits.

## Verification

| Check | Result | Limit |
| --- | --- | --- |
| Baseline Vitest | 233 passed in 38 files | Existing suite before cleanup |
| Final Vitest | 260 passed in 39 files | More cases is not itself a quality metric |
| Controlled signature mutation | Original suite survived; replacement catches the intended defect | One focused mutation, not a general mutation score |
| Generation component in StrictMode | 9 scenarios passed; no page, console or resource errors | Real client with fake API, no real DB/storage/PDF |
| Portfolio interaction gate | 12 checks passed | Local component fixtures, no authenticated Next/DB journey |
| UI and Storybook type checks | Passed | Full-repository TypeScript debt remains outside this check |
| New E2E guard and Playwright-config type check | Passed with an isolated config extending the project | Includes the guard's test source and explicit Vitest imports |
| Changed test/config/script lint | Passed | No claim that full-repository lint is clean |
| Playwright discovery | 19 cases in 8 files listed | These authenticated cases were not executed |
| Disposition and workflow manifests | 115/115 entries and 40/40 catalog workflows mapped | No full authenticated journey marked verified |

Detailed outputs are in [verification.json](verification.json), [component-runtime.json](component-runtime.json), [guide-verification.json](guide-verification.json) and the Vitest reports. The tracked production-source baseline is preserved. Changes in this pass are tests, test tooling/configuration, package commands and documentation.

## What remains

For the generation state-machine pilot, complete real draft save/reload, approval/rejection permissions and parsed PDF/download evidence. Exercise concurrent tabs against persisted data and server idempotency. A single mounted editor's request queue cannot establish those guarantees.

For the app, implement the [testing strategy](../../docs/test-plan/testing-strategy.md) in this order:

1. Disposable local fixtures with unique tenants/users per run and cleanup verified after partial failure.
2. Real API/RLS allow/deny cases with two tenants and owner/member/viewer sessions.
3. Obra create/edit/reload and OCR/import/reimport/manual-override/conflict journeys.
4. Generated-document save/generate/review/approve/download and failure recovery.
5. Financial, policy, data-flow, notification and remaining catalog workflows.
6. Named browser cases and proposed CI gates, plus seeded state sequences and targeted mutations.

Stub paid/external provider transports while keeping business logic, auth, routes, DB and storage real. Verify a fresh persisted read or parsed artifact after each workflow. Keep provider sandbox checks separate and explicit. The [40-workflow matrix](journey-matrix.json) records today's partial evidence and gaps.

Not every rewrite identified by the review is implemented. Generation-server and data-flow-builder query fakes still need predicate-aware or real-DB replacement. The order-template font-scale case still asserts emitted CSS strings and needs a rendered/browser proof before removing that regression protection. Writeback still lacks result/field identity variants, error mapping and auto/audit/blocked paths. These remaining cases are recorded in the reviews rather than counted as complete coverage.

## Review record

- [Domain and state review](domain-review.md)
- [Access, billing and HTTP review](boundary-review.md)
- [Browser and runtime review](journey-review.md), findings captured before cleanup
- [Per-file dispositions](dispositions.json)
- [Rerunnable inventory](inventory.mjs) and [manifest completeness check](review-manifest.mjs)

## Work list

- [x] Frame. Review every existing test and validation script, judge the observable contract, and preserve unrelated local work.
- [x] Fan out. Read domain/server tests, browser flows and external validation scripts in separate slices.
- [x] Aggregate. Record a disposition for every test file and justify removals with concrete lost or redundant assertions.
- [x] Report. Remove proven low-value tests, run the retained suite and document a practical whole-app test strategy.

## Completion criteria

Every discovered test entry has an owner and an evidence-backed disposition. Delete tests only when they are tautological, test a copied implementation, duplicate another contract without adding a risk case, or assert private structure instead of behavior. Small tests of security, financial or parsing boundaries can be valuable. Keep such tests when they catch a plausible defect.

The resulting proposal must define real user journeys, complex state transitions, tenant/permission cases, persistence evidence, deterministic setup/cleanup, external-service boundaries, CI gates and a migration order. Identify coverage gaps honestly. A mocked browser story does not establish database/RLS correctness, and listing Playwright tests does not mean they ran.

No production behavior, schema, credentials, database contents, dependencies, commits or remote accounts are changed by this audit. Test deletions and focused behavioral replacements are authorized by the user. Broad future test implementation is proposed separately from this cleanup.

## Review protocol

For each file record its actual entry point, exercised production code, behavior observed, important mocks, weak or circular assertions, and keep/rewrite/delete/merge verdict. Cite lines or test names. For a deletion identify what behavior, if any, disappears and whether a retained test covers it. Challenge each test with a plausible behavior-breaking mutation and an internal refactor that preserves behavior.

Reports and implementation assignments are partitioned by file. Agents edit only their assigned reports or test-tooling files; the root reviews the integrated result and owns the final disposition manifest. No reviewer may change production code or weaken a check to make it pass.
