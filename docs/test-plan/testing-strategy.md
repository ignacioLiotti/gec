# Testing the application through its contracts and user journeys

Status: The audit, cleanup and owned local integration runtime are implemented. The latest frozen run on 2026-10-19 passed 49/49 E2E/integration cases with zero retries, flaky results or skips, including thirteen new deep document cases. All 44 fixture scopes were verified and disposed, with fresh Docker/process/port/snapshot readback. The shared checkout passed 359 Vitest tests in 48 files. The complete forty-workflow matrix remains a target. Current proof and boundaries are in the [deep document verification](../../plans/2026-10-19-deep-document-qa/README.md); the earlier migration/permission repair proof remains in the [integration implementation](../../plans/2026-10-17-isolated-integration/README.md).

The [audit](../../plans/2026-10-17-test-strategy/README.md) reviews every existing test file and runtime validator. The product scope is the 40 workflows G01–G40 in the [feature catalog](../feature-capture-catalog.md), rather than a target number of assertions or a line-coverage percentage.

## What counts as proof

A test must fail when a plausible product contract is broken and keep passing when the implementation changes without changing that contract. Test return values, rendered outcomes, external payloads, persisted records, downloaded contents and permission denials. Avoid testing private helper call order, CSS durations, implementation constants or expected values produced by the same code being tested.

Small tests remain useful for dangerous boundaries: tenant redirects, permission composition, localized amounts, row identity, formula precedence and billing dates. They complement complete workflows. They cannot establish that a route invokes a guard, that a write commits, or that RLS isolates two tenants.

Each user journey needs a known initial state, meaningful actions, an independent final read and a recovery or denial case. Creating an obra should prove its identity and fields after a new browser context loads it. A success toast alone is insufficient. A downloaded report should be parsed and contain the fixture's amounts and source evidence, rather than merely exist as a byte array.

## Layers with different responsibilities

| Layer | Execute | Keep real | Replace only | Evidence |
| --- | --- | --- | --- | --- |
| Domain contracts | Vitest through public functions/controllers | Formulas, parsing, composition, reconciliation, state transitions | Time and outbound transport when needed | Literal outcomes, boundary cases, deferred-request sequences, scoped idempotency |
| Component workflows | Browser, real production React component | Event handlers, DOM, focus/caret, validation, rendering | HTTP/service boundary with deterministic responses | Visible results, outgoing payload, missing/error/retry states, downloads |
| Route and persistence integration | Real Next route against disposable local Supabase | Auth cookies/JWT, membership, permission checks, DB/RLS, storage | Paid/external providers | HTTP result plus fresh user-scoped DB/API read and unchanged unauthorized data |
| Customer journeys | Real browser against that same local app | Navigation, state across pages/reloads, persistence, effective permissions | Paid/external providers | End-to-end business result, cross-session recovery and denied direct access |
| Provider compatibility | Explicit sandbox job, outside ordinary PR gates | One provider adapter and its documented protocol | Everything outside that adapter | Representative real response/notification, fixed contract fixtures, replay handling |

Use existing Vitest and Playwright. A fixture-backed Storybook or portfolio run belongs to the component layer. Copied redesign screens validate their own demos; they are not evidence of Next routes or database behavior. The static UI contract checker is lint. `verify-folder-move.mjs` is a manual operational tool and stays outside automated app gates.

## Disposable integration environment

The legacy fixed-tenant fixture and global auth file have been removed. The implementation gives each attempt unique tenants/users and checked resource cleanup. The final full run verified actual sessions, RLS and Auth/profile/Storage cleanup. Existing product soft-delete triggers leave residual SQL rows until disposal of the complete owned stack. Fixture manifests are marked disposed only after checking Docker containers, volumes and networks, app process and port, and snapshot removal. The [final cleanup readback](../../plans/2026-10-17-isolated-integration/full-final-cleanup.json) independently checked all 31 fixture manifests and the stopped runtime.

1. Start a dedicated local Supabase instance from migrations and synthetic fixtures. Keep it separate from local copies of production data. The implemented runner creates a temporary project and application snapshot and passes only that instance's configuration. It excludes ordinary `.env*` files and the normal seed.
2. Give every run/worker its own tenant IDs and fixture namespace. Seed tenant A with owner, member and viewer, plus tenant B with its own owner. Create unique synthetic auth identities and refuse collisions. Do not reset an existing user's password or grant it membership.
3. Allow service-role setup/cleanup in a fixture module only. Exercise and verify business behavior with each user's actual session and RLS, including unauthorized attempts. An admin readback must not be the only proof of user access.
4. Keep a manifest of every created identity, row and object. Register cleanup as each resource is created, including partial setup failures. Clean in dependency order and fail if any operation or residual-resource check fails. A disposable CI instance may be destroyed after evidence is captured.
5. Start a dedicated Next process with known local configuration. Never reuse an arbitrary development server. Separate Playwright projects for public requests, component fixtures and authenticated journeys, so a harmless UI fixture does not provision an owner account.
6. Stub OCR, LLM, email, WhatsApp, payment and APS adapters at their transport boundary. Preserve business logic, validation and writes. Assert their outbound effects, including no duplicate delivery after retry. Test-only headers/adapters must be unavailable in production mode.

Discovery remains credential-free:

```text
npm exec playwright test -- --list
```

Use `npm run test:e2e:public` for an isolated Next process without DB provisioning. `npm run test:e2e` creates the owned app and fresh Supabase instance and requires a working Docker Linux engine. No operator account, `.env.e2e.local` or existing database is selected. The fixed Next process receives the generated local keys with its versioned service-role selector disabled. Direct execution without the run manifest fails. See [ADR 0039](../adr/0039-owned-local-integration-fixtures.md).

## Release-critical scenarios

| Scope and catalog IDs | State and user actions | Required proof |
| --- | --- | --- |
| Onboarding and invitations, G01–G05 | Create tenant, provision partial→retry→ready, invite another identity, accept/expire/mismatch, switch A→B→A | Correct roles/resources after reload; no duplicate provision or invite acceptance; old tenant IDs/cache do not survive; direct foreign-ID requests denied |
| Obra creation and daily work, G06–G10 | Create, import CSV with rejected rows, edit numbers/dates, save/reload, invoke quick action, complete | Persisted identity opens immediately; totals and status match; failed save preserves edits; completion triggers once; duplicate command creates no duplicate effect |
| Obra trash and notes, G11/G13 | Delete, inspect trash, restore before deadline, reject after deadline; save/reload notes | Active/detail visibility and downstream access agree; audit names actor; second restore/delete is deliberate; no data loss after recovery |
| Dashboard and company files, G12/G23 | Filter policies/KPIs, navigate to obra, upload/preview/download an organization file | Values reflect known fixtures; correct tenant and bytes; no stale filter result or wrong destination |
| Automation and reminders, G14/G33 | Create immediate/delayed action, dispatch, retry same event, complete/reschedule | One notification/delivery; correct due time/recipient/tenant; error→retry retains job; completion prevents repeated delivery |
| Documents and extraction, G15–G20 | Upload local object, parse known OCR/spreadsheet, edit extracted rows, generate report, reimport changed source | Storage bytes and metadata agree; input maps to actual table; manual override survives; stable identity/version and conflicts are persisted; unrelated tenant/source rows unchanged |
| Document deletion and models, G21/G22 | Trash/restore object; purge in dedicated destructive job; model pending→ready/error→retry | DB and storage converge; restored object is readable only by authorized user; viewer uses the correct derivative; provider contract job covers APS separately |
| Certificates and insurance, G24–G26 | Save certificate, invoice/collect, import policies, resolve unmatched obra, request/confirm cancellation | Persisted lifecycle and totals; localized values and date boundaries; policy coverage and financial balance remain separate; retry does not duplicate |
| Macro tables and data flow, G27/G28 | Configure sources, aggregate, override, reimport, compute→suggest→accept, retry | Scoped row identity; no override loss; correct dependency/totals; same pending suggestion dedupes while changed/foreign/nonpending state does not; cyclic writeback blocked |
| Reports and Document AI, G29/G30 | Filter/group/preset/export/share; ask over selected sources; create formal output | Fresh-context preset/share behavior; expired link denied; parsed CSV/XLSX/PDF/DOCX/PPTX contains expected business values and citations; no invented totals or hidden duplicates |
| Generated documents and templates, G31/G32 | Edit draft during save/assist, switch context/template, generate, reject→correct→review→approve, reopen approved, download | Requested revision generates; later typing survives; no parallel draft writes; reload recovers input; permissions/lifecycle and rejected-download denial hold; source draft retained |
| Roles and people, G34/G35 | Grant/revoke role, explicit block/allow, direct user override, reload another session | Visible controls and direct URL/API access agree; revoke takes effect; nonadmin cannot elevate privileges; changed permissions do not widen another tenant |
| Billing, G36 | Checkout pending→authorized, paused/grace→blocked, cancel at period end, duplicated/out-of-order webhook | Persisted subscription and route access match; signature binds event/request/time; repeated delivery has one effect; stale event cannot regress newer subscription state |
| WhatsApp and support, G37–G40 | Configure capability scope, submit signed mobile form/upload, retry/expire, impersonate and exit, inspect audit | Correct tenant/obra destination; expired/tampered link denied; duplicate submission dedupes; support session respects intended permissions; immutable actor/audit evidence |

These grouped scenarios cover every catalog ID. Split a group into named tests at independent outcomes; do not create one giant browser test whose first failure hides all later assertions. Reuse setup fixtures, not the mutations performed by another test. Each test must pass alone and in a different order.

For every P0 journey run the ordinary path, a permission/tenant denial and a relevant failure/recovery path. Use pairwise role/context combinations where they are independent, and enumerate all branches for access rules, financial decisions and destructive lifecycle transitions.

## State and concurrency testing

Use compact explicit transition tables for stateful domains. For the document session, commands include edit, save, assist, generate, change context, resolve/reject request and unmount. Assert that newer edits survive, only the submitted revision is acknowledged, stale results have no current effects, and physical writes never overlap.

Add deterministic generated command sequences with a recorded seed where combinations exceed a hand-written matrix. Keep the reference model independent of implementation helpers. Begin with these invariants:

- Tenant A commands never read or mutate tenant B resources.
- Retry/replay of one operation has one durable business effect.
- A pending suggestion only deduplicates within its tenant, obra, result, field, value and pending state.
- Reimport preserves source identity and accepted manual corrections; ambiguity creates a conflict rather than choosing silently.
- A response never acknowledges or replaces edits submitted after its request snapshot.
- Permissions, document approval, billing access and deletion deadlines are authoritative at the server boundary.

Cover multiple tabs/workers against the same persisted record in integration tests. A controller confined to one mounted editor cannot prove cross-tab ordering or server idempotency.

## CI and diagnosis

| Gate | Target responsibilities |
| --- | --- |
| Every PR | Public-domain tests, test-source type checking, changed-code lint, actual component workflows, local route/DB integration for isolation and critical writes |
| Before merge | P0 customer journeys on Chromium desktop plus mobile-critical navigation/editing; clean browser console, failed requests, accessible keyboard interactions and parsed artifact checks |
| Nightly | Remaining G01–G40 journeys, broader browser/viewport matrix, generated transition sequences, storage/restore/destructive jobs in a disposable instance |
| Explicit provider job | Sandbox OCR/LLM/payment/email/WhatsApp/APS compatibility, cost and rate limits declared by the operator |

The repository currently has no checked-in CI workflow discovered by the audit. These are proposed gates, not claims about an existing remote CI service. The existing full-repository lint/default-TypeScript debt must be resolved or tracked separately with zero new errors; a green Vitest run does not cover that debt.

Use one assertion/reporting system per layer. Named Playwright cases should emit traces on the first failure, screenshots, relevant request/response evidence and deterministic seed/fixture IDs. Assert console/page/network errors rather than merely collecting them. Any allowed failure must name an exact known resource and reason. Capture evidence before cleanup, then verify cleanup. Retries must remain visible as flaky results and must not silently re-run unsafe provisioning.

## Implementation order and acceptance

1. Prove the implemented local run-owned fixtures and cleanup against the actual stack, including partial setup and interruption. Public and authenticated projects are separate. Runtime checks verify Auth/profile/Storage cleanup; product soft deletes retain SQL until the runner verifies removal of the owned stack's containers, volumes and network. A fixture status must not claim SQL absence from a successful DELETE alone.
2. Execute and expand the implemented tenant/role matrix through actual APIs/RLS. Foreign-ID read/write and known-document Storage/download denials now run against actual actors and RLS. A service-role mock is insufficient.
3. Verify the migrated obra and lineage specs. Their create/reload and reimport/override/conflict behaviors remain; the latter still replace provider extraction/storage.
4. Generated-document/template persistence, reviewer UI, signed PDF content, rejection/correction, four-format upload, CSV persistence, provider-bound OCR retry/reimport, delayed save and delayed folder navigation have passing durable cases. The 2026-10-20 checkpoint adds actual PDF canvas/text rendering and selected-page instructions, broken-to-valid DOCX preview, offline save recovery and independent-tab draft conflicts. Live OCR recognition quality, Word editing and remaining report/export variants still need their own journeys. Preserve the component-state tests as fast race coverage.
5. Approved full run `a62e7a53` passed all 82 local regressions under migrations 0134 and 0135, with zero skips, retries or flaky results. It covers certificate invoicing/collection, policy import/cancellation and completion/replay/undo, direct financial-RLS permissions, notification dismissal recovery and tenant scoping, invitation acceptance and denials, signed mobile expiry/concurrency and recurring payloads, and billing event ordering. All 77 fixture scopes were disposed and 1,070 source inputs stayed unchanged. See `plans/2026-10-20-workflow-qa/`. Support, remaining data-flow paths and P1/P2 cases remain catalog targets; this local regression result does not complete the target matrix or establish live-provider compatibility.
6. Migrate monolithic Storybook/portfolio scripts to named fixture-project cases. Preserve useful keyboard, reduced-motion, narrow-container and export assertions; move screenshot-only runs to an artifact command. Delete duplicate runners only after their unique contracts have an owner.
7. Add seeded transition generation and focused mutation checks for high-risk modules. Use survived mutations to choose missing cases; do not optimize a mutation percentage by excluding difficult code.

A workflow becomes covered only when its named test, final persisted/artifact observation, tenant/permission outcome and recovery case are linked in the coverage matrix and run successfully. File presence, helper coverage and a screenshot are partial evidence, not completion.
