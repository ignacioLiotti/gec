# Plan 008: Make obra-completion side-effects fire exactly once (fix the read-then-write race)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- "app/api/obras/[id]/route.ts" app/api/obras/route.ts "app/api/obras/[id]/complete/route.ts" supabase/migrations/ docs/adr/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (schema migration + change to a money-adjacent workflow; mitigated by the claim being purely additive)
- **Depends on**: 007 recommended first (touches the same completion flow; merging both into one branch is fine)
- **Category**: bug
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

Completion detection is read-then-write: the PUT handler reads `porcentaje`, updates the row, and treats `prev < 100 && committed >= 100` as "newly completed", then fires side-effects (workflow event `obra.completed`, flujo actions, insurance recalculation, calendar/reminders). Two concurrent PUTs that both observe `prev < 100` and both commit `>= 100` fire **all side-effects twice** — duplicate workflow runs, duplicate reminders. The code itself admits it (`app/api/obras/[id]/route.ts:370-372`: "To properly eliminate race conditions, consider using a database trigger"). The same transition logic is duplicated in the bulk route. Fix: an atomic, idempotent claim — a `completion_claimed_at` column set via a conditional `UPDATE ... IS NULL` that only one concurrent caller can win — gating the side-effects in all three routes.

## Current state

- Race acknowledgment + read:
  ```ts
  // app/api/obras/[id]/route.ts:370-379
  // Fetch existing porcentaje atomically with update using single query
  // Note: We still need to fetch first because Supabase's RETURNING only gives us NEW values
  // To properly eliminate race conditions, consider using a database trigger
  const { data: existingRow, error: existingError } = await supabase
      .from("obras")
      .select("porcentaje, designacion_y_ubicacion")
      ...
  ```
  Update + transition detection at lines 426-490, ending in `await handleObraCompletionTransitions({ ..., prevPorcentaje, committedPorcentaje, ... })`.
- The side-effect dispatcher:
  ```ts
  // app/api/obras/[id]/route.ts:124-127
  const becameCompleted = prevPorcentaje < 100 && committedPorcentaje >= 100;
  const becameIncomplete = prevPorcentaje >= 100 && committedPorcentaje < 100;
  if (becameCompleted) { /* emitEvent("obra.completed"), executeFlujoActions, insurance updates */ }
  if (becameIncomplete) { /* deletes scheduled artifacts */ }
  ```
  `handleObraCompletionTransitions` is called from PUT (line 482) and PATCH (line 631) in the same file.
- Duplicated logic in the bulk route: `app/api/obras/route.ts` around lines 1140-1210 (its own `emitEvent("obra.completed")` + `executeFlujoActions` + insurance block inside the per-obra loop of the bulk PUT).
- Third entry point: `app/api/obras/[id]/complete/route.ts` — force-completes (`porcentaje: 100`) and runs insurance updates directly (no event emission today).
- Migrations: SQL files in `supabase/migrations/`, numbered `NNNN_description.sql`; latest is `0118_whatsapp_flow_editor.sql` (note: `0116` is duplicated by two files — use `0119` or higher). Applied locally with `npm run db:push` (`supabase db push`). Repo rule (AGENTS.md): schema changes need an ADR — `docs/adr/` numbering reached `0019`.

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit`)          | exit 0              |
| Migration | `npm run db:push` (requires local Supabase running: `npm run supabase:start`) | applies cleanly |
| Unit      | `npm test`                                           | all pass            |
| Lint      | `npm run lint`                                       | exit 0              |

## Scope

**In scope**:
- `supabase/migrations/0119_obra_completion_claim.sql` (create; bump the number if taken by then)
- `app/api/obras/[id]/route.ts` (claim gate inside `handleObraCompletionTransitions`)
- `app/api/obras/route.ts` (same gate in the bulk completion block)
- `app/api/obras/[id]/complete/route.ts` (same gate)
- `docs/adr/0020-obra-completion-claim.md` (create; bump number if taken)

**Out of scope** (do NOT touch):
- The side-effects themselves (`emitEvent`, `executeFlujoActions`, insurance functions) — only WHEN they fire changes, not WHAT they do.
- `lib/insurance-policies.ts` — that's plan 007.
- Any attempt at full transactional atomicity across side-effects — the claim makes them at-most-once per completion episode, which is the goal.

## Git workflow

- Branch: `advisor/008-obra-completion-claim`
- Commits: (1) migration + ADR, (2) route changes. Short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Migration — add the claim column

Create `supabase/migrations/0119_obra_completion_claim.sql`:

```sql
-- Tracks that completion side-effects were dispatched for the current
-- completion episode. NULL = not dispatched (or obra went back below 100%).
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS completion_claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.obras.completion_claimed_at IS
  'Set atomically when obra.completed side-effects are dispatched; cleared when porcentaje drops below 100. Guarantees at-most-once dispatch per completion episode.';

-- Backfill: obras already at 100% are treated as already-dispatched so this
-- migration does not retrigger side-effects for historical completions.
UPDATE public.obras
SET completion_claimed_at = now()
WHERE completion_claimed_at IS NULL
  AND COALESCE(porcentaje, 0) >= 100;
```

(Check the actual type of `porcentaje` in earlier migrations — if it's text/numeric adjust the COALESCE cast accordingly; `grep -rn "porcentaje" supabase/migrations/*.sql | head` will show the column definition.)

**Verify**: `npm run supabase:start` (if not running) then `npm run db:push` → migration applies, exit 0.

### Step 2: The claim helper (single-obra routes)

In `app/api/obras/[id]/route.ts`, inside `handleObraCompletionTransitions`, replace the gate:

- For `becameCompleted`: before running any side-effect, attempt the claim —
  ```ts
  const { data: claim } = await supabase
      .from("obras")
      .update({ completion_claimed_at: new Date().toISOString() })
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("completion_claimed_at", null)
      .gte("porcentaje", 100)
      .select("id")
      .maybeSingle();
  if (!claim) return; // another request already dispatched, or obra is no longer at 100
  ```
  Keep the existing `becameCompleted` heuristic as a cheap pre-filter (skip the claim query entirely when the transition didn't happen from this request's perspective), but the CLAIM, not the heuristic, decides dispatch.
- For `becameIncomplete`: in the same place the existing teardown runs, also clear the claim:
  `update({ completion_claimed_at: null }).eq("id", obraId).eq("tenant_id", tenantId).lt("porcentaje", 100)`.

Note RLS: `supabase` here is the user's client; obra updates already work through it in this handler (the porcentaje update at line 426 uses it), so the claim update is equally permitted.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Apply the same gate to the bulk route and the complete route

- `app/api/obras/route.ts` (~lines 1140-1210): wrap its `emitEvent`/`executeFlujoActions`/insurance block with the identical claim attempt (same query, per obra inside the loop). Extract the claim into a small local helper function if both files can't share one cleanly — duplication of 10 lines is acceptable; changing module structure is not required.
- `app/api/obras/[id]/complete/route.ts`: after forcing `porcentaje: 100`, attempt the claim; only run `updateInsurancePoliciesForObraCompletion` + `syncInsurancePoliciesToMacroTable` when the claim wins; respond `{ ok: true, alreadyCompleted: true }` when it doesn't.

**Verify**: `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm test` → all pass.

### Step 4: ADR

Create `docs/adr/0020-obra-completion-claim.md` following the format of an existing ADR (read `docs/adr/0019-*.md` for the shape): context (the race + duplicated side-effects), decision (claim column with conditional UPDATE, at-most-once semantics, clearing on un-complete), alternatives considered (DB trigger — rejected: side-effects live in app code; advisory locks — rejected: connection pooling), consequences (re-completion after un-complete re-fires side-effects by design).

**Verify**: file exists, references the migration filename.

## Test plan

- No reliable way to unit-test the race itself without a real DB; the conditional-UPDATE semantics carry the guarantee.
- Manual/e2e check if a local stack runs: mark an obra 100% via the UI or `PUT /api/obras/<id>` twice in quick succession; confirm via logs (`OBRA TERMINADA` appears once) and `select completion_claimed_at from obras where id=...` is set. Drop it below 100, confirm the column clears; raise again, side-effects fire once more.
- Regression safety: `npm test` green (existing suite); typecheck/lint green.

## Done criteria

- [ ] Migration file exists and applies with `npm run db:push` on the local stack
- [ ] All three routes gate completion side-effects on the conditional claim update (`grep -n "completion_claimed_at" app/api/obras -r` → ≥3 files)
- [ ] `becameIncomplete` path clears the claim
- [ ] ADR exists in `docs/adr/`
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `handleObraCompletionTransitions` or the bulk-route block has materially changed since planning (this area had uncommitted work at planning time).
- RLS blocks the claim UPDATE through the user client (the `.update` returns an RLS error) — report; switching to the admin client for the claim changes the security shape and needs a decision.
- `porcentaje` turns out to be stored as text and `.gte("porcentaje", 100)` misbehaves — report with the column type; the filter may need a different predicate.
- A local Supabase stack cannot be started to apply/verify the migration — deliver the code + migration, mark the plan BLOCKED on migration verification.

## Maintenance notes

- Anyone adding a new completion side-effect must put it INSIDE the claim-gated block, or it regains the duplicate-fire bug.
- Reviewer: scrutinize the `becameIncomplete` clearing — if it's missed, an obra that un-completes and re-completes will never re-fire side-effects (silent under-fire, the opposite bug).
- Interaction with plan 007: both touch the same blocks; if 007 landed first, the claim wraps the new summary-logging code unchanged.
