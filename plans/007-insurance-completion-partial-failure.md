# Plan 007: Make insurance-policy updates on obra completion resilient to partial failure

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- lib/insurance-policies.ts tests/lib/insurance-policies.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Working-tree note**: `lib/insurance-policies.ts` has uncommitted modifications
> on the branch this plan was written from. The excerpt below reflects the
> working tree, not the commit — verify against the live file content.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (behavior change is "keep going and report" instead of "abort mid-loop"; callers already treat the whole call as best-effort)
- **Depends on**: none. Coordinates with plan 008 (same call sites, different files).
- **Category**: bug
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

When an obra reaches 100%, `updateInsurancePoliciesForObraCompletion` loops over the obra's insurance policies updating each one (`obra_finished_at`, `calculated_cancellation_date`, reset `last_notified_at`). The loop `throw`s on the first failed update: policies before the failure are updated, the failing one and **everything after it is silently skipped**, and the caller just logs. Result: some policies never get a cancellation date, never appear in cancellation alerts, and an insurance deadline is missed — with no record of which policies were skipped. The fix: process all policies, collect failures, and surface a structured summary.

## Current state

- The function (working tree):
  ```ts
  // lib/insurance-policies.ts:191-225
  export async function updateInsurancePoliciesForObraCompletion({
      supabase, tenantId, obraId, finishedAt,
  }: { ... }) {
      const { data: policies, error } = await supabase
          .from("insurance_policies")
          .select("id, cancellation_rule_type, cancellation_rule_offset, cancellation_rule_configured, definitive_reception_date")
          .eq("tenant_id", tenantId)
          .eq("obra_id", obraId);
      if (error) throw error;

      for (const policy of policies ?? []) {
          const ruleType = policy.cancellation_rule_type as InsurancePolicyRuleType;
          const offset = Number(policy.cancellation_rule_offset ?? 0);
          const ruleConfigured = policy.cancellation_rule_configured === true;
          const { error: updateError } = await supabase
              .from("insurance_policies")
              .update({
                  obra_finished_at: finishedAt,
                  calculated_cancellation_date: ruleConfigured ? calculateCancellationDate(finishedAt, ruleType, offset, policy.definitive_reception_date) : null,
                  last_notified_at: null,
                  updated_at: new Date().toISOString(),
              })
              .eq("id", policy.id)
              .eq("tenant_id", tenantId);
          if (updateError) throw updateError;   // ← aborts the loop, partial state
      }
  }
  ```
- Callers (all wrap in try/catch and only `console.error`; verified by grep):
  - `app/api/obras/[id]/route.ts:208` (inside `handleObraCompletionTransitions`)
  - `app/api/obras/route.ts:1187` (bulk PUT)
  - `app/api/obras/[id]/complete/route.ts:36` (NOT wrapped — a throw here becomes an unhandled route error; check at execution time)
- `calculateCancellationDate` is pure (`lib/insurance-policies.ts:171-189`) and currently has **no unit tests**. No `tests/lib/insurance-policies.test.ts` exists.
- Test style exemplar: `tests/lib/tablas.test.ts` (plain vitest, pure functions). For the loop function you'll need a tiny fake of the Supabase `from().update().eq().eq()` chain — build it by hand in the test file (no test framework for Supabase exists in this repo).

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit`)          | exit 0              |
| New tests | `npx vitest run tests/lib/insurance-policies.test.ts`| all pass            |
| Full unit | `npm test`                                           | all pass            |

## Scope

**In scope**:
- `lib/insurance-policies.ts` — ONLY `updateInsurancePoliciesForObraCompletion` (and its return type)
- `tests/lib/insurance-policies.test.ts` (create)
- The three caller files — ONLY if the new return value needs logging wired (keep to ≤3 lines each)

**Out of scope** (do NOT touch):
- `calculateCancellationDate` logic, `parseInsurancePoliciesWorkbook`, or anything else in `lib/insurance-policies.ts`.
- `lib/insurance-policies-macro.ts` (`syncInsurancePoliciesToMacroTable`) — separate sync step.
- Retry logic, queues, or RPC/transaction rewrites — explicitly deferred (see Maintenance notes).
- The duplicate-completion race — that is plan 008.

## Git workflow

- Branch: `advisor/007-insurance-partial-failure`
- One commit (e.g. "Collect per-policy failures in obra completion insurance update").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Change the loop to collect failures

Rewrite the loop body so a failed update records instead of throwing, and the function returns a summary:

```ts
export type InsuranceCompletionUpdateResult = {
    updated: number;
    failed: { policyId: string; message: string }[];
};
```

- Keep updates sequential (they share a connection; parallel `Promise.allSettled` is acceptable too, but sequential is the minimal diff — choose sequential).
- On `updateError`: push `{ policyId: policy.id, message: updateError.message }`, `console.error("[insurance-completion] failed to update policy", { policyId: policy.id, obraId, error: updateError })`, and continue.
- Keep the initial select's `if (error) throw error;` — if the list query fails, nothing was attempted and throwing is correct.
- Return `{ updated, failed }`.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Wire the summary at the three call sites

At each caller, capture the result and log a warning when `failed.length > 0`, e.g.:

```ts
const insuranceResult = await updateInsurancePoliciesForObraCompletion({ ... });
if (insuranceResult.failed.length > 0) {
    console.warn("[obra-completion] some insurance policies were not updated", {
        obraId, failed: insuranceResult.failed,
    });
}
```

In `app/api/obras/[id]/complete/route.ts` (which has no try/catch today), additionally include `insurance: { updated, failedCount: failed.length }` in the JSON response so the UI/operator can see partial failures.

**Verify**: `npm run typecheck` → exit 0; `npm run lint` → exit 0.

### Step 3: Unit tests

Create `tests/lib/insurance-policies.test.ts` with two groups:

A. `calculateCancellationDate` (pure — overdue for coverage):
1. `days_after` with offset 30 from `2026-01-01` → `2026-01-31`.
2. `months_after` with offset 6 from `2026-01-15` → `2026-07-15`.
3. `definitive_reception_date` takes precedence over `obraFinishedAt`.
4. Both dates null/undefined → null.
5. Negative offset clamps to 0 (the `Math.max(0, ...)`).

B. `updateInsurancePoliciesForObraCompletion` with a hand-rolled fake supabase:
- Fake `from("insurance_policies")` returning: for `.select(...).eq().eq()` → 3 policies; for `.update(...).eq().eq()` → success for policies 1 and 3, `{ error: { message: "boom" } }` for policy 2.
- Assert: result is `{ updated: 2, failed: [{ policyId: "p2", message: "boom" }] }` — i.e., **policy 3 was still attempted after policy 2 failed** (this is the regression the plan exists for).
- Second case: select returns error → function throws.

**Verify**: `npx vitest run tests/lib/insurance-policies.test.ts` → all pass (≥7 tests).

## Test plan

As Step 3. The must-have assertion: a mid-list failure does not prevent later policies from updating. Full gate: `npm test` green.

## Done criteria

- [ ] `updateInsurancePoliciesForObraCompletion` returns `InsuranceCompletionUpdateResult` and contains no `throw updateError` inside the loop
- [ ] All three callers compile against the new signature (typecheck passes)
- [ ] `tests/lib/insurance-policies.test.ts` exists with ≥7 passing tests, including the continue-after-failure case
- [ ] `npm test`, `npm run lint`, `npm run typecheck` all exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The function body no longer matches the excerpt (this file had uncommitted changes at planning time — drift is likely; reconcile first).
- More callers exist than the three listed (`grep -rn "updateInsurancePoliciesForObraCompletion" app lib --include="*.ts"`).
- The Supabase chain in the function differs from `.update().eq().eq()` (your test fake must mirror the real chain — don't force the code to fit the fake).

## Maintenance notes

- Deferred deliberately: making the whole completion side-effect set atomic (RPC/transaction) — plan 008 addresses the duplicate-emission race with a claim column; true atomicity across policies + macro sync + events would need a Postgres function and is not justified yet.
- If a notification/alerting channel exists later, the `failed` array is the payload to surface to admins instead of `console.warn`.
- Reviewer: check that no caller still relies on the old throwing behavior (e.g. a catch block whose handling assumed "nothing was updated").
