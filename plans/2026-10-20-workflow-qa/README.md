# Stateful application workflow verification

## Work list

- [x] Read the pstack principles and current project/test contracts.
- [x] Frame. Continue the document QA into the remaining named workflows, preserving the inherited working tree. Use only disposable local services and synthetic identities.
- [x] Fan out. Separate certificates/policies, access/notifications, and billing/mobile automation. The coordinator owns document recovery/preview and shared runtime changes.
- [x] Aggregate. Review each proposed contract, run named browser/HTTP cases against the owned stack, fix reproduced defects and rerun affected cases.
- [x] Report. Record persisted/artifact evidence, denied access, failure recovery, cleanup and explicit gaps. A provider substitute does not establish live provider compatibility.

## Current result

**All 82 local regression cases passed.** Full run `a62e7a53-6453-4843-8375-d208e03c53dd` applied approved migrations 0134 and 0135 in a fresh disposable local database, then passed all 82 cases in 82 attempts with zero skips, retries or flaky results. This includes actual invitation acceptance and fresh-session membership/reuse denial, direct financial mutation permissions with edit/admin separation, and obra completion/replay/undo under the tightened policies. Vitest passed 373 tests in 49 files. The final 77 fixture scopes were disposed, and all 1,070 source inputs matched before and after execution.

The preceding frozen regression `4ca499a8` executed 81 cases: 80 passed and invitation acceptance failed. It excluded the then-unapproved direct financial-RLS case. Both gaps are resolved in the approved full run. Only the separate manual browser host is excluded from the 82-case regression inventory. Local regression success does not establish production readiness or complete every workflow in the broader catalog.

The approved migration bodies match the reviewed proposal hashes. Live schema readback records versions 0134 and 0135, the named membership conflict target, and the eight expected financial policies. See `migration-authorization.json` and `approved-schema-readback.json`. No production database, deployment, commit or push was performed.

## Acceptance and execution

The state under test is the business record visible to an authenticated user, its lifecycle/history, stored artifact and external delivery when applicable. Each case starts independently and checks a literal expected outcome through a fresh user-scoped observation. Test setup may prepare preconditions but cannot perform the business action it claims to verify.

Use the existing owned integration runner. Only the coordinator starts the shared runtime after writers have stopped. Keep retries at zero, preserve failed attempts and never replay a setup write to hide a transport failure. Recheck relevant regressions and cleanup before handoff.

The first checkpoint is a concrete list of reachable UI/API workflows and their provider requirements. The second is the first runtime result for each slice. Work that requires live credentials, a paid service or an externally delivered message remains a declared boundary unless separately authorized.

## Coverage slices

| Owner | Scope | Required proof |
| --- | --- | --- |
| Certificates and policies | Certificate financial lifecycle; insurance import, matching and cancellation | Persisted values/status after reload; tenant/role denial; retry or invalid transition |
| Access and notifications | Invitation acceptance/mismatch/expiry; notification read/dismiss and tenant scoping | Independent actor sessions, no privilege escalation, durable recipient-specific state |
| Billing and mobile automation | Subscription/access states and webhook replay; signed mobile/WhatsApp form lifecycle | Real route/DB behavior, precise transport boundary, tampered/expired/repeated request outcomes |
| Coordinator | PDF page selection, DOCX preview, offline and independent-tab document edits | Real browser controls and artifacts; newest input recovery; explicit concurrent-write contract |

## Evidence

The preceding 49-case run remains documented separately in `../2026-10-19-deep-document-qa/`. It is not evidence that new cases pass.

| Run | Actual result | What it established |
| --- | --- | --- |
| `8523ec23-58d5-48ef-ab04-45f5527480b7` | 2/4 | Offline recovery and broken-to-valid DOCX preview passed. A stale draft was accepted and PDF.js failed during webpack module initialization. |
| `f150bcbb-7fb6-4ac6-b334-dd3d8b9e64fb` | 10/22 | Policy import/cancellation, signed positive flows and billing lifecycle passed. Expired forms, stale subscription events, financial permission bypasses and obsolete invitation selectors failed. |
| `2753c63a-850f-432f-866b-95e1d0730c64` | 23/31 | Draft conflicts/version boundaries, certificate financial UI and route denials, policy route denials, expired/stale mobile forms and billing event repair passed. A stronger notification witness exposed a tenant leak; simultaneous forms created two rows; selected PDF pages did not reach the provider instruction; direct RLS writes ignored financial denies. Four invitation cases still failed on an ambiguous driver locator. |
| `7130d341-9ef8-4296-9b82-1a4920da891e` | 23/27 | PDF canvas/text and selected-page instruction, DOCX recovery, offline/stale drafts, notification tenant isolation/dismissal recovery, simultaneous signed-form deduplication and billing passed. Two invitation checks assumed a heading role that the actual card title lacks; two recurring-form checks exposed persisted React action metadata. Both repairs require the next run. Financial cases were not selected. |
| `5209ea46-64af-45ed-b98d-35e7f9a02197` | 25/27 | All 15 billing/mobile cases, all notification cases, expired/duplicate/mismatched invitations and four financial UI/API cases passed. The first invitation click was lost before hydration; the expanded completion test assumed a field in the listing API that it does not return. The button now waits for hydration and the test reads stored fields through authenticated actor clients. These changes need the next run. |
| `4ca499a8-d596-48db-ad78-8f54e66b3e49` | 80/81 | All 49 earlier regressions and 31 of 32 selected additions passed. The invite trigger now handles its first click, but the actual acceptance RPC fails in PostgreSQL. Completion projection, recurring payload cleanup and the remaining ordinary repairs passed together. The direct financial-RLS case was explicitly not selected pending schema approval. |
| `91ca002a-0e49-47e8-8cc0-299c799d7f94` | 3/3 | Both approved forward migrations applied. Invitation acceptance/reuse, direct financial RLS insert/update/delete and edit/admin separation, and completion/replay/undo under the new policies passed. |
| `a62e7a53-6453-4843-8375-d208e03c53dd` | 82/82 | Full regression with both migrations: all 49 earlier cases and all 33 additions passed, including the previously excluded RLS contract. Zero retries, skips and flaky results; 77 fixture scopes disposed. |

Eight completed runtimes have fresh Docker/process/port/snapshot and fixture cleanup readback, covering 267 fixture scopes including earlier failed checkpoints. The final full run accounts for 77 of these scopes. See `*-cleanup.json`, `*-run.json` and `*-cases.json`; `collect-run.mjs` repeats the observations. No retry, skip or flaky result has been hidden.

The original tenant-negative notification test could pass before its initial fetch settled. Its replacement inserts tenant B first, waits for a tenant-A toast as a positive processing witness, then asserts that B stays hidden. The original green result is not counted as proof of tenant isolation.

The earlier checkpoint source files changed after its temporary app snapshot was created, while independent repairs continued. Its before/after hashes intentionally differ. The approved focused and full runs subsequently verified frozen source inputs, as recorded below.

The financial checkpoint and pre-approval regression matched 1,068 source inputs before and after execution. Adding only migrations 0134 and 0135 brought the final inventory to 1,070. The approved focused and full runs each match aggregate `1eb72f2922e07e475d0dc2ccc50df4aa7d9386e083cc59e2329bfec7330425f6` before and after execution. `approved-source-delta.json` records the two added SQL files. The manual `independent-launch-qa-host.spec.ts` is a separate long-running host, not a regression case.

Computer use independently observed the invalid-invitation screen in the owned `5209` runtime. The visible title is a `DIV` with no heading role, and the page offers `Volver al inicio`. This read-only observation does not establish authenticated invitation acceptance. The first attempt targeted an already disposed runtime and established no UI result.

## What the additions exercise

| Added cases | User behavior and independent outcome |
| --- | --- |
| Documents, 5 | Save while offline, reconnect, and recover the same draft; save conflicting revisions from separate contexts; enforce API version preconditions; recover from corrupt DOCX to readable Word content; preview a real PDF, cancel extraction, then extract only the selected page scope. Check stored text, object bytes, version conflicts and exact provider instructions. |
| Access and notifications, 7 | Invite a recipient, accept once, reject duplicate/mismatched/expired/reused invitations; dismiss and reload notifications; keep an unread notification after a failed dismissal; hide another tenant's notification for the same actor. Membership and invitation rows, recipient-scoped reads and a positive toast witness establish the outcomes. All seven cases passed in the approved full run. |
| Mobile and billing, 15 | Submit signed forms at 375px; reject tampered, expired, cancelled and stale forms; submit simultaneously; preserve assigned obra/review history for recurring answers; checkout, activate, replay and cancel a subscription; reject invalid signatures and superseded payment events. Assert exact response rows, run/audit agreement, subscription rows and registered HTTP provider calls. |
| Financial, 6 | Invoice and collect certificates while preserving totals; deny unauthorized API mutations; import matched/unmatched policies and request/confirm cancellation across reloads; complete/undo/recomplete an obra as an editor and preserve unrelated/foreign policies and notification markers; enforce direct SQL insert/update/delete permissions with positive controls and edit/admin separation. All six cases passed under migration 0134 in the approved full run. |

The 33 additions occupy 11 specifications. Together with the previous 49 cases, discovery has 82 regression cases. This is a set of named contracts, not completion of every G01–G40 workflow, live provider compatibility, browser/device matrix or transaction guarantee.

After the pre-approval regression, review strengthened `financial-rls.spec.ts`: an actor granted certificate administration must still lack edit authority and remain unable to insert/update before its authorized delete. `post-run-source-delta.json` preserves that earlier source difference. The strengthened case then passed in both the approved focused and full runs. No source changed during either approved run.

## Static checks and limits

Fresh Vitest execution passed 373 tests in 49 files; see `approved-vitest.json`. The earlier app, test and Storybook type checks and the 1,163-control UI contract apply to unchanged TypeScript and JavaScript inputs. The approved-phase source changes are exactly two SQL migrations. Changed-file lint has zero errors and three existing warnings in the bulk obra route; the final invitation/financial driver subset has zero warnings. The modified multi-OCR route retains the same 12 lint errors as the preceding checkpoint, with matching rule/message multisets; see `ocr-lint-comparison.json`.

The repository-wide TypeScript check still fails at `portfolio-guide/guide.tsx:18` because `./sample-data.ts?raw` lacks its declaration. See `static-checks.json` and `static-default-types.log`; scoped success is not a claim that every repository check is green. Production build, live OCR quality, real email/Meta/payment/APS delivery, realtime notification transport, full slow-3G journeys and the remaining catalog workflows were not established by this run.

## Review records

- [Machine-readable verification](verification.json) and [independent approved-result review](approved-final-review.md). The earlier [pre-approval review](final-review.md) remains historical evidence.
- [Case discovery and coverage audit](audit-new-cases.md).

- [Document concurrency](concurrency.md) and [ADR 0042](../../docs/adr/0042-document-draft-optimistic-concurrency.md).
- [Financial workflows](financial.md), including the permission-policy blast radius and [approved RLS proposal](financial-rls-proposal.sql).
- [Access and notifications](access-notifications.md).
- [Billing and signed mobile forms](billing-mobile.md).
- [PDF.js integration decision](../../docs/adr/0041-pdfjs-webpack-imports.md).

The two database changes were explicitly approved for disposable-local verification and implemented as migrations [0134](../../supabase/migrations/0134_financial_mutation_permissions.sql) and [0135](../../supabase/migrations/0135_fix_invitation_acceptance_conflict_target.sql). The [financial policy proposal](financial-rls-proposal.sql) preserves member reads and the existing insurance parent invariant; its companion preserves the editor's computed-date projection. The [invitation RPC proposal](invitation-rpc-proposal.sql) changes only the conflict target to `memberships_pkey`. [The original PostgreSQL log](invitation-postgres-error.log) preserves the pre-repair failure. Both repairs passed focused and full verification. The separate [anonymous RPC probe](approved-anonymous-rpc-denial.log) proves rejection with `42501` at the unchanged authentication gate.

The reviewed SQL hashes are `1f7bba7ce325621b97913ba0601b378b52ba5b074ac4bbc690169e0553e0fb40` (financial) and `24c0cf028d2c2da2d441259fe017a832b02c36f01b3e2a8dc35121cd09cc3274` (invitations).

FigJam updates remain pending because the workspace quota is exhausted. Relevant boards are Product OS, Journeys 03, Journeys 04 and the current-screenshots board. Actual code, test results and this report remain the evidence.
