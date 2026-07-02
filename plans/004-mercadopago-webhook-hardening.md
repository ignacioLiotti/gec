# Plan 004: Make MercadoPago webhook signature verification mandatory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- app/api/billing/mercadopago/webhook/route.ts tests/app/api/ env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (fails closed; the only behavior change is rejecting unsigned webhooks when the secret is missing/invalid)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

The MercadoPago billing webhook verifies its HMAC signature **only if** `MERCADOPAGO_WEBHOOK_SECRET` is set; when the env var is absent the handler processes any payload, unsigned, with the service-role client. A deployment that forgets the secret silently accepts forged billing webhooks — and nothing logs or alerts that verification is off. Impact is partially mitigated (the handler re-fetches the preapproval's real state from MercadoPago's API rather than trusting the payload), but unsigned mode still lets attackers trigger processing of arbitrary preapproval IDs and must never be reachable in production silently.

## Current state

- `app/api/billing/mercadopago/webhook/route.ts:85-104` — the conditional verification:
  ```ts
  export async function POST(request: NextRequest) {
      const payload = (await request.json().catch(() => ({}))) as MercadoPagoWebhookPayload;
      const preapprovalId = resolvePreapprovalId(request, payload);
      const dataId = resolveWebhookDataId(request, payload) ?? preapprovalId;
      const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();

      if (webhookSecret) {
          const signatureValid = verifyMercadoPagoWebhookSignature({
              secret: webhookSecret,
              signatureHeader: request.headers.get("x-signature"),
              requestIdHeader: request.headers.get("x-request-id"),
              dataId,
          });
          if (!signatureValid) {
              return NextResponse.json(
                  { error: "Firma de webhook invalida." },
                  { status: 401 },
              );
          }
      }
  ```
- `verifyMercadoPagoWebhookSignature` is defined at `lib/billing/mercadopago.ts:210` and already has unit tests in `tests/lib/billing/mercadopago.test.ts`.
- `env.example:53` already documents `MERCADOPAGO_WEBHOOK_SECRET=` — no doc change needed there.
- API route test exemplar (imports the handler directly): `tests/app/api/tenant-usage-post.test.ts`.

## Commands you will need

| Purpose   | Command                                                     | Expected on success |
|-----------|-------------------------------------------------------------|---------------------|
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit`)                 | exit 0              |
| New test  | `npx vitest run tests/app/api/mercadopago-webhook.test.ts`  | all pass            |
| Full unit | `npm test`                                                  | all pass            |

## Scope

**In scope**:
- `app/api/billing/mercadopago/webhook/route.ts` (the `if (webhookSecret)` block only)
- `tests/app/api/mercadopago-webhook.test.ts` (create)

**Out of scope** (do NOT touch):
- `lib/billing/mercadopago.ts` — the verification function is correct and tested.
- The rest of the webhook handler (preapproval fetch, subscription upsert) — separate concerns.
- Checkout/cancel routes under `app/api/billing/mercadopago/`.

## Git workflow

- Branch: `advisor/004-mp-webhook-hardening`
- Single commit, short imperative subject (e.g. "Require MercadoPago webhook signature").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fail closed when the secret is missing

Replace the `if (webhookSecret) { ... }` block so the logic becomes:

```ts
if (!webhookSecret) {
    console.error(
        "[mercadopago-webhook] MERCADOPAGO_WEBHOOK_SECRET is not configured; rejecting webhook",
    );
    return NextResponse.json(
        { error: "Webhook no configurado." },
        { status: 503 },
    );
}

const signatureValid = verifyMercadoPagoWebhookSignature({
    secret: webhookSecret,
    signatureHeader: request.headers.get("x-signature"),
    requestIdHeader: request.headers.get("x-request-id"),
    dataId,
});
if (!signatureValid) {
    console.warn("[mercadopago-webhook] invalid signature", {
        hasSignatureHeader: Boolean(request.headers.get("x-signature")),
        dataId,
    });
    return NextResponse.json(
        { error: "Firma de webhook invalida." },
        { status: 401 },
    );
}
```

(503 — not 401 — for the unconfigured case so MercadoPago retries and operators see a distinct status in delivery logs. Error strings stay in Spanish, matching the file.)

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Route-level tests

Create `tests/app/api/mercadopago-webhook.test.ts` modeled on `tests/app/api/tenant-usage-post.test.ts`. Use `vi.stubEnv` / manual save-restore of `process.env.MERCADOPAGO_WEBHOOK_SECRET` around each case (the route reads the env var inside the handler, so per-test stubbing works). Cases:
1. Secret unset → `POST(new NextRequest(...))` with any JSON body → status 503.
2. Secret set, no `x-signature` header → status 401.
3. Secret set, garbage `x-signature` header → status 401.

Construct requests with `new NextRequest("http://localhost/api/billing/mercadopago/webhook", { method: "POST", body: JSON.stringify({ type: "preapproval", data: { id: "123" } }), headers: { "content-type": "application/json" } })` (import `NextRequest` from `next/server`). None of these cases reach the Supabase admin client or MercadoPago API, so no further mocking is needed — if a test errors on a missing Supabase env var, the early-return ordering is broken and that's a finding.

**Verify**: `npx vitest run tests/app/api/mercadopago-webhook.test.ts` → 3 tests pass.

## Test plan

Covered by Step 2 (3 cases: unconfigured → 503, missing signature → 401, invalid signature → 401). Existing `tests/lib/billing/mercadopago.test.ts` keeps covering the HMAC math. `npm test` → all green.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 including 3 new tests in `tests/app/api/mercadopago-webhook.test.ts`
- [ ] `grep -n "if (webhookSecret)" app/api/billing/mercadopago/webhook/route.ts` → no match (the conditional-skip pattern is gone)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The handler no longer matches the excerpt (drift).
- Tests reveal the handler reaches Supabase/MercadoPago before the signature gate — report the ordering problem rather than adding broad mocks.
- You learn (from the operator/docs) that some environment intentionally runs without the secret (e.g. MercadoPago sandbox cannot sign) — then the fail-closed design needs a product decision; do not add a bypass env var on your own.

## Maintenance notes

- **Deploy note for the operator (must accompany the PR):** production and preview deployments MUST have `MERCADOPAGO_WEBHOOK_SECRET` set before this lands, otherwise all billing webhooks will 503 (MercadoPago retries, so a short gap self-heals after the secret is added).
- Reviewer should confirm the 503/401 split is preserved — collapsing them loses the operational signal.
- Deferred: webhook delivery idempotency was audited and judged already-mitigated (state is re-fetched from MercadoPago); no action needed.
