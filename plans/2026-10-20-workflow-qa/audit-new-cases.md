# New E2E case and evidence audit

Audit date: 2026-10-20. This is a read-only review of Playwright discovery, the new specifications, and the workflow plan evidence. It makes no runtime pass claim for the frozen 81-case regression.

## Discovery and selection

`npm exec playwright test -- --list` discovers 83 tests in 33 files. One test, `independent-launch-qa-host.spec.ts`, is an explicitly requested interactive host that calls `test.skip` unless its external control file requests a session. It is not a regression case. Excluding only that host leaves the complete current regression population at 82 tests in 32 files.

The preceding frozen run `7481fcd3-758d-470e-abe6-4746a2983c13` contains 49 passed tests in 21 files. Running discovery over those same file selectors still returns exactly 49 tests. The new work adds 33 tests in 11 files:

| Slice | New tests | Files |
| --- | ---: | ---: |
| Access and notifications | 7 | 2 |
| Billing and signed mobile forms | 15 | 2 |
| Document recovery, preview, and PDF selection | 5 | 4 |
| Financial workflows and direct RLS | 6 | 3 |
| **Total additions** | **33** | **11** |

The authorized frozen checkpoint excludes the unapproved direct-RLS specification as well as the manual host. Its discovery is exactly 81 tests in 31 files: the prior 49 plus 32 new cases. This 81-case run must be named as such. It is not the full 82-case current regression because `financial/financial-rls.spec.ts` remains pending.

The exact frozen selector is:

```text
tests/e2e/public
tests/e2e/access
tests/e2e/admin
tests/e2e/billing-mobile
tests/e2e/document-generation
tests/e2e/documents
tests/e2e/excel
tests/e2e/excel-navigation.spec.ts
tests/e2e/financial/certificates.spec.ts
tests/e2e/financial/insurance-policies.spec.ts
tests/e2e/integration
```

Using the whole `tests/e2e/financial` directory would select the pending RLS case and produce 82 cases after the manual host is excluded.

`playwright.config.ts` sets `retries: 0`, one worker, and no setup project. None of the 81 selected tests contains `skip`, `fixme`, or `only`. There is no `auth.setup.ts` file or storage-state setup dependency to omit. Authenticated identities are created by `tests/e2e/fixtures/scenario.ts`; the 81-case selector includes `integration/auth-boundary.spec.ts`. The only conditional skip under `tests/e2e` belongs to the excluded manual host.

The label “prior 49” describes case lineage, not proof for the current source. The integrated source and harness changed after run `7481fcd3-758d-470e-abe6-4746a2983c13`, so those 49 cases still require the frozen regression.

## Durable evidence in the 33 additions

| Slice | Durable evidence present | Limits that remain |
| --- | --- | --- |
| Access and notifications, 7 | Invitation cases read memberships and invitation status through authenticated actor clients after the UI or RPC transition. Notification cases read the real notification row, including `read_at`, user, and tenant, after visible toast behavior. Duplicate, mismatch, expiry, second-use, failed-dismissal, recipient, and active-tenant outcomes therefore do not rely only on a toast or HTTP status. | The local runtime does not deliver invitation email. Notifications inserted before navigation prove initial fetch, not an INSERT received after the Realtime subscription is live. No case covers a user-level `tenant_id = null` notification, an active-tenant switch with stale callbacks/toasts, or the notification action link. The dismissal outage is a synthetic HTTP 503, followed by real database readback and reload. |
| Billing and signed mobile, 15 | Signed-form cases read `whatsapp_manual_submissions`, run rows, and chat-action rows through the owner actor and verify foreign invisibility. Billing cases combine subscription SQL readback, fresh authenticated API access, and exact owned provider-request observations. Concurrent and replay cases assert one durable winner rather than accepting response status alone. | The flow insert, run update, and action audit are separate SQL operations; a process failure between them is not covered transactionally. Cancel/expiry racing an in-flight insert, recurring replay/cancellation, scheduler delivery, native Meta flows, actual WhatsApp delivery, real MercadoPago execution, and live-provider compatibility remain outside the suite. |
| Document additions, 5 | Offline and stale-tab cases read `generated_document_drafts` after failure/conflict and verify a fresh or reloaded editor. The route-boundary case reads the row after a 409. DOCX preview compares downloaded bytes with the uploaded artifact, checks a foreign 404, and renders the content in a fresh context. PDF selection reads the stored PDF bytes, the owned OCR provider observation, and the exact persisted `obra_tabla_rows` data including selected page provenance. | The stale-tab resolved save is verified by reloading the other editor, without a final direct SQL query. The matching final update in the route-boundary case is verified from the mutation response, without a second independent SQL read. DOCX content is exact locally, but Microsoft Office compatibility is not evaluated. The PDF case proves one two-page selection shape, not arbitrary ranges or live OCR quality. |
| Financial additions, 6 | Certificate and policy workflows verify visible reload state and authenticated route readback. The completion case also reads policy rows directly through the owner actor. The separate RLS case performs direct actor inserts, updates, and deletes, then uses owner readback and owner positive controls. | Certificate lifecycle persistence is observed through the database-backed product route rather than an independent actor SQL query. Import/cancellation readback also uses the product route. The direct RLS case is deliberately excluded from the 81-case run because the policy migration is not approved or applied. Parent/active-parent database invariants, macro projection readback, notification-dispatch scope, and retained superadmin bulk-delete behavior remain follow-ups. |

## Plan evidence audit

- `plans/2026-10-19-deep-document-qa/full-final-results.json` records 49 expected, zero skipped, zero unexpected, and zero flaky tests with retries set to zero. That artifact supports the historical 49-case result only.
- The four runs summarized in the workflow README match their stored case and cleanup evidence. Their fixture totals are 4 + 22 + 31 + 27 = 84, with zero reported cleanup failures and disposed run manifests.
- Run `7130d341-9ef8-4296-9b82-1a4920da891e` supports all three notification claims. It does not support the complete invitation claim because acceptance and expiry stopped at stale semantic-role locators.
- Run `5209ea46-64af-45ed-b98d-35e7f9a02197` is newer evidence: 25 passed and 2 failed, zero skipped/flaky, with 27/27 fixture cleanup. It proves all 15 billing/mobile cases, the expired invitation, the other two invitation denials, all three notification cases, both certificate cases, and two of three insurance cases. The acceptance case lost its first click before client hydration; the completion-derived policy case failed an observer shape. Both source repairs postdate that run and require the frozen regression.
- `billing-mobile.md` correctly describes a 15-case strengthened suite, but its static-validation bullet still says discovery found 12 cases. Current supported discovery is 15 tests in two files.
- `financial.md` accurately states that `financial-rls-proposal.sql` is review-only, is not a numbered migration, and has not been applied. A green 81-case run must not be presented as proof of direct financial RLS enforcement.
- Static checks and list discovery establish compilation and selection only. SQL, Storage, provider, browser, and cleanup claims require a completed owned run plus its `results.json`, `run.json`, fixture manifests, and retained artifacts where applicable.

## Reporting rule for the frozen run

Report the result as “81 selected tests: prior 49 plus 32 authorized additions.” State both exclusions by name. If all 81 pass, that proves the selected integrated regression but leaves direct financial RLS pending approval and leaves the declared live-provider and delivery boundaries unchanged.
