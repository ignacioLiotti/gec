# Billing and signed mobile journey evidence

Status: all 15 cases passed in owned run `5209ea46-64af-45ed-b98d-35e7f9a02197` and again in frozen regression `4ca499a8-d596-48db-ad78-8f54e66b3e49`. This includes recurring payload cleanup and simultaneous flow submission/run/audit consistency. Provider and transaction limits below still apply.

The initial twelve cases ran in owned run `f150bcbb-7fb6-4ac6-b334-dd3d8b9e64fb`. Seven passed, four reproduced product failures, and one stopped at the client auth gate before exercising replay. The strengthened suite contains fifteen cases. Static checks do not establish that the repairs pass.

## Third runtime checkpoint

Owned run `7130d341-9ef8-4296-9b82-1a4920da891e` passed thirteen of fifteen billing/mobile cases. The simultaneous flow case now passed with two non-error HTTP responses, exactly one stored answer, and matching completed run and chat-action audit. Every other flow case and every billing case passed.

Both recurring cases failed their new exact payload assertion because `parsed_values` contained `$ACTION_ID_*` alongside the expected answer fields. The evidence directories are `billing-mobile-signed-mobi-5121f-ned-obra-and-review-outcome-authenticated` and `billing-mobile-signed-mobi-2e9dd-ned-obra-and-review-outcome-authenticated`. The recurring action parser excludes that transport prefix, matching the flow parser. Following runs `5209` and `4ca499a8` passed both cases with their exact payload and fresh-history assertions.

## Second runtime checkpoint

Owned run `2753c63a-850f-432f-866b-95e1d0730c64` passed fourteen of fifteen billing/mobile cases. This includes the three entry denials, two denials after page load, sequential stale-form rejection, both recurring modes with fresh owner history, and the strengthened stale billing event test.

MOBILE-06 failed with two persisted submissions, one for each concurrent input, after two actual POSTs were released together. Its evidence is `artifacts/billing-mobile-signed-mobi-a5e95-response-and-a-matching-run-authenticated/error-context.md` under that run. The captured values also contained a React `$ACTION_ID_*` transport field.

The repair inserts the signed flow response using the run UUID as its submission primary key and `ON CONFLICT DO NOTHING`. It reads the winner back using tenant, contact, and `raw_values._capture` provenance, then derives the run and action audit from the stored values. It never overwrites the first answer with the losing request. The parser excludes React action metadata. This uses existing columns and the existing primary key, with no migration.

The flow insert, run update, and audit update remain separate SQL operations. A retry can recover an inserted response while the run is still eligible. A process failure after run completion but before audit completion, and cancellation/expiry racing the in-flight insert, are not a transactionally verified guarantee. Native Meta replies and recurring replies use separate paths.

## First runtime baseline

- PASS: MOBILE-01, MOBILE-02, both MOBILE-05 result modes, BILL-01, BILL-02, BILL-03.
- FAIL: all three MOBILE-03 entry variants showed an editable submit button for an expired, past-deadline, or cancelled run.
- FAIL: BILL-04 changed the current active subscription back to the old cancelled provider ID and old plan.
- BLOCKED replay assertion: MOBILE-04 reached both rendered forms, filled both, then timed out clicking the first submit because the global forced login dialog covered the anonymous page. Its trace contains an unfinished `click` at `call@29`, not two completed submissions.

Evidence is in `test-results/integration/f150bcbb-7fb6-4ac6-b334-dd3d8b9e64fb/artifacts/`, under `billing-mobile-signed-mobi-d53cc-*`, `billing-mobile-signed-mobi-d5a6e-*`, `billing-mobile-signed-mobi-7c4f8-*`, `billing-mobile-signed-mobi-7b185-*`, and the BILL-04 `billing-mobile-subscriptio-*` directory. The root baseline log is `module-baseline.log`.

## Repairs awaiting runtime verification

- Flow page and action read live run status and deadline. Closed runs render a specific reason under `Respuesta no disponible`. The action rechecks a form that was opened while eligible.
- The browser auth gate exempts only `/whatsapp/flow/:runId`, `/whatsapp/respond/:runId`, and their `/thanks` paths. Server HMAC checks still govern form reads and actions.
- Billing webhooks require the event's provider ID to match the tenant's current association. An unassociated or superseded ID returns 202. The write also filters by that identity, so a checkout replacing it after the read cannot be overwritten.
- The simultaneous submission defect was reproduced in the second checkpoint and verified repaired in the third checkpoint.

## Contract and setup

Billing uses `GET /api/billing/subscription`, `POST /api/billing/mercadopago/checkout`, `POST /api/billing/mercadopago/cancel`, and `POST /api/billing/mercadopago/webhook`. Owner and admin may mutate subscriptions. A normal member may read its subscription but cannot check out or cancel. Subscription RLS must hide another tenant's row. An inactive subscription must block ordinary application APIs with 402 while billing remains reachable.

Checkout calls the external preapproval transport and persists the subscription. A pending checkout preserves an already active subscription's plan and status. An authorized provider response becomes `active`. Cancellation schedules the provider's `auto_recurring.end_date` and preserves access until that date. A repeated valid event may refresh provider metadata but must not create duplicate subscriptions. An event for a superseded preapproval must not replace or revoke the current subscription.

`scripts/integration-billing-provider.mjs` replaces only MercadoPago's HTTP transport. It binds to an owned `127.0.0.1` port. It accepts registered synthetic references, requires synthetic bearer authentication, and implements POST `/preapproval` plus GET/PUT `/preapproval/:id`. There is no network passthrough. Separate authenticated control endpoints register and inspect fixtures, update provider status, and remove registrations. Requests retain synthetic payload evidence without credentials.

The runner supplies `MERCADOPAGO_API_BASE_URL`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, and `WHATSAPP_RESPONSE_SECRET`. Test control verifies the run manifest, run ID, project ID, loopback origin, and provider identity. Billing amounts come from an independent literal fixture of ARS 1200 per month.

Mobile entry points are `/whatsapp/flow/:runId?token=...` and `/whatsapp/respond/:runId?token=...`, followed by their actual Next server actions. An anonymous mobile browser at 375 by 844 submits the real form. The signature is independently constructed with HMAC-SHA256 over the run ID. SQL observations use the owner's authenticated RLS client and the other tenant's authenticated client.

Flow setup creates a contact, definition, and run. Flow runs have status and `expires_at`. A valid open run may create one `ready_to_apply` manual submission and become completed. Expired, cancelled, and already consumed runs must not accept a new result. A signed capability for one run must not authorize another.

Recurring setup creates a contact, obra, template registry entry, assignment, chat action, and sent run. `manual_submission` produces `ready_to_apply`; `review_only` produces `needs_review`. The result must retain the assignment's tenant, obra, and folder, with its chat action linked to the same submission.

All service-role writes are private, purpose-named fixture setup. Resource intents are recorded before writes. Synthetic plans are global catalog rows but uniquely named by the owned namespace; their disposal relies on the runner destroying the complete disposable stack.

## Named cases

| Case | Observable assertion |
| --- | --- |
| BILL-01 | Member checkout/cancel denied, own subscription visible, foreign subscription hidden, no provider invocation. |
| BILL-02 | Inactive access blocked, owner checkout transports literal amount, signed authorization and replay persist one active subscription, admin cancellation preserves current access. |
| BILL-03 | Invalid signature returns 401, makes no provider request, and leaves subscription unchanged. |
| BILL-04 | After old and new checkouts, a delayed cancelled event for the old ID leaves the current plan and ID active. |
| MOBILE-01 | Anonymous signed mobile form stores one response, links the run, and hides the result from another tenant. |
| MOBILE-02 | Transplanted GET token reveals no submit form; changed run ID in a rendered form cannot submit either run. |
| MOBILE-03 expired | An explicitly expired flow exposes no editable submission. |
| MOBILE-03 past_expiry | A sent flow with a past SQL deadline exposes no editable submission. |
| MOBILE-03 cancelled | A cancelled flow exposes no editable submission. |
| MOBILE-03 already open, expired | Owner ages the persisted deadline after page load; actual anonymous submit is denied and the run remains unchanged. |
| MOBILE-03 already open, cancelled | Owner cancels the run after page load; actual anonymous submit is denied and the run remains unchanged. |
| MOBILE-04 | Two previously opened copies cannot insert two responses or overwrite the first response. |
| MOBILE-06 | Two actual POSTs are held until both arrive, released together, and must persist one result with a matching completed run. |
| MOBILE-05 manual_submission | Recurring answer preserves scoped destination and creates a ready submission with completed audit action. |
| MOBILE-05 review_only | Recurring answer preserves scoped destination and creates a review submission with review audit action. |

## Verification completed

- `npm run typecheck:tests` passed.
- `npm exec eslint -- tests/e2e/billing-mobile tests/e2e/fixtures/billing-mobile.ts scripts/integration-billing-provider.mjs` passed.
- Current discovery lists 15 cases in two specifications; the initial baseline had 12.
- `npm test -- tests/lib/billing/subscription-access.test.ts tests/lib/billing/mercadopago.test.ts` passed 39 existing unit cases.
- An executable Node transport smoke passed control authentication, provider authentication, checkout, mutable provider status, GET, PUT, request evidence, rejection of unregistered IDs, fixture deletion, and server shutdown. It ran only the synthetic transport.
- After the first repairs, `npm run typecheck:tests` and focused ESLint passed. The existing billing helper and expanded pre-tenant route suites passed 66 cases.

## Runtime hypotheses and limits

The HMAC itself has no timestamp. Flow deadlines are persisted and checked at both read and submit boundaries. The original sequential test did not reach the first submit; the second checkpoint passed that test and separately proved the simultaneous duplicate defect.

The billing stale-event defect was reproduced and repaired with an identity-conditional update. The second checkpoint verified the unchanged complete row, exact provider traffic, and fresh-session access.

The strengthened probes cover expiry after page load and simultaneous competing requests. Recurring replay and cancelled recurring assignments still need further cases. Meta webhook delivery, WhatsApp message sending, recurring scheduler dispatch, native Meta Flows, actual payment execution, and live provider compatibility are outside this unit.

Anonymous mobile contexts use real browser networking. A cold Next compilation may expose the development HMR reload issue already handled by authenticated fixture contexts. Diagnose actual trace evidence before changing that boundary.

The source documentation `35 - Usage Metering & Subscriptions.md` still says billing is not implemented despite existing MercadoPago routes. This stale documentation is recorded here; no domain or ADR behavior was changed during test authoring.

## Documentation and visual gap

The repair updates ADR 0022, the WhatsApp domain note, and the MercadoPago billing flow document. No styleguide change is needed because the new denial view uses existing tokens.

Figma access reached its tool quota in the root task. The Product OS board `NDzN30GN3koTteiTdkgV3P`, Journeys 03 `nnPSyRwgsNseS3cm9BIMTp`, and Journeys 04 `ySjUIomuoMG00LNK0sKajF` still need updates. Record anonymous signed-form entry, live expiry/cancellation/completed denial, action-time revalidation, and ignored superseded billing events as `Verify` until the second run passes. Add sanitized mobile denial screenshots after runtime verification to the screenshot board `mC50ck1vEmJzOvrdW9s9AU`; no screenshot has been uploaded. There is no commit hash.

## Files owned by this slice

- `scripts/integration-billing-provider.mjs`
- `tests/e2e/fixtures/billing-mobile.ts`
- `tests/e2e/billing-mobile/provider.ts`
- `tests/e2e/billing-mobile/subscription.spec.ts`
- `tests/e2e/billing-mobile/signed-mobile.spec.ts`
- This evidence file.

The root agent owns runtime wiring, shared fixture wiring, manifest resource kinds, final execution, and any coordinated production repair.
