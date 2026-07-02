# Plan 005: Remove the hardcoded superadmin UUID from 14 files behind one env-driven helper

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- proxy.ts lib/route-guard.ts app/layout.tsx app/admin/ app/api/tenant-usage/route.ts lib/superadmin.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (a mistake here can lock the platform owner out of superadmin, or grant it to nobody; behavior must be bit-identical when the env var contains the same UUID)
- **Depends on**: none (001 recommended first)
- **Category**: security
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

The user ID `77b936fb-3e92-4180-b601-15c31125811e` is hardcoded as an always-superadmin identity in **14 files** (verified by grep). It cannot be rotated without a deploy, it grants global platform access (bypasses billing paywall in middleware), and the copies are already drifting (e.g. `app/admin/expenses/all/page.tsx` checks the UUID without OR-ing the `profiles.is_superadmin` flag). Consolidating into one helper driven by an env var makes the identity rotatable, makes the privilege grep-able, and removes 13 duplicate definitions.

## Current state

- The canonical pattern, repeated with small variations:
  ```ts
  // proxy.ts:13
  const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";
  // proxy.ts:287-288
  const isSuperAdmin =
      (profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;
  ```
- All 14 files containing the literal UUID (verified: `grep -rln "77b936fb" --include="*.ts" --include="*.tsx" app lib utils components proxy.ts`):
  1. `proxy.ts` (middleware — runs in the Edge runtime; the helper must not import Node-only modules)
  2. `lib/route-guard.ts`
  3. `app/layout.tsx`
  4. `app/api/tenant-usage/route.ts`
  5. `app/admin/demo-links/actions.ts`
  6. `app/admin/demo-links/page.tsx`
  7. `app/admin/expenses/all/page.tsx`
  8. `app/admin/roles/page.tsx`
  9. `app/admin/roles/permissions-actions.ts`
  10. `app/admin/roles/server-actions.ts`
  11. `app/admin/tenant-secrets/page.tsx`
  12. `app/admin/tenants/page.tsx`
  13. `app/admin/users/invitation-actions.ts`
  14. `app/admin/users/page.tsx`
- The DB already has a first-class flag: `profiles.is_superadmin`, fetched right before each UUID comparison in most files. The hardcoded UUID is a fallback for when the flag isn't set.
- `proxy.ts:12` also hardcodes `DEFAULT_TENANT_ID` — **leave it alone** (see Out of scope).
- `env.example` exists at repo root and is the documented env contract.

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit`)          | exit 0              |
| Lint      | `npm run lint`                                       | exit 0              |
| New test  | `npx vitest run tests/lib/superadmin.test.ts`        | all pass            |
| Sweep     | `grep -rn "77b936fb" --include="*.ts" --include="*.tsx" app lib utils components proxy.ts` | no matches |

## Scope

**In scope**:
- `lib/superadmin.ts` (create)
- `tests/lib/superadmin.test.ts` (create)
- `env.example` (add `SUPERADMIN_USER_IDS=`)
- The 14 files listed above (mechanical replacement only)

**Out of scope** (do NOT touch):
- `DEFAULT_TENANT_ID` in `proxy.ts` and the membership-fallback logic around it (`proxy.ts:303-321`) — changing tenant-fallback behavior is a product decision; flagged as a follow-up in Maintenance notes.
- `supabase/migrations/**` — `profiles.is_superadmin` already exists; no schema work.
- Any change to who is *currently* superadmin: the env var will be set to the existing UUID by the operator, so effective access is unchanged.

## Git workflow

- Branch: `advisor/005-superadmin-env`
- Two commits: (1) add helper + tests + env.example, (2) replace the 14 call sites. Short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the helper

Create `lib/superadmin.ts`:

```ts
const envSuperadminIds = (process.env.SUPERADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

/**
 * A user is superadmin if their profile flag says so, or their user id is in
 * the SUPERADMIN_USER_IDS env allowlist (comma-separated UUIDs).
 */
export function isSuperAdminUser(
    userId: string | null | undefined,
    profileIsSuperadmin?: boolean | null,
): boolean {
    if (profileIsSuperadmin === true) return true;
    if (!userId) return false;
    return envSuperadminIds.includes(userId);
}
```

Only `process.env` is used — safe for the Edge runtime (`proxy.ts`). Note: env vars read in middleware/edge must be defined at build/deploy time; that matches how `RATE_LIMIT_IP` etc. are already consumed in `proxy.ts`.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Unit tests

Create `tests/lib/superadmin.test.ts` (plain style, see `tests/lib/tablas.test.ts`). Because the module reads the env at import time, use `vi.resetModules()` + `vi.stubEnv("SUPERADMIN_USER_IDS", ...)` + dynamic `await import("@/lib/superadmin")` per case. Cases:
1. Profile flag true, env empty → true.
2. Flag false/undefined, id in env list → true.
3. Env list with two ids and spaces (`"aaa, bbb"`) → both true.
4. Flag false, id not in list → false.
5. `userId` null → false.

**Verify**: `npx vitest run tests/lib/superadmin.test.ts` → 5 tests pass.

### Step 3: Add the env var to env.example

Append to `env.example` (near the other security/limits vars):

```
# Comma-separated user UUIDs that are always treated as superadmin (fallback to profiles.is_superadmin)
SUPERADMIN_USER_IDS=
```

Do NOT write the real UUID into `env.example`.

**Verify**: `grep -n "SUPERADMIN_USER_IDS" env.example` → 1 match.

### Step 4: Replace the 14 call sites

For each file in the list: delete the local `const SUPERADMIN_USER_ID = "..."` line, import `isSuperAdminUser` from `@/lib/superadmin`, and rewrite the comparison. Pattern:

- Before: `(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID`
- After: `isSuperAdminUser(user.id, profile?.is_superadmin)`

Watch the variants: some files name the profile variable differently or omit the flag check (e.g. `app/admin/expenses/all/page.tsx:48` compares only the UUID — still pass whatever profile flag the file has available, or `undefined` if it truly has none). Preserve each file's surrounding logic exactly; this is a mechanical substitution, not a refactor. Typecheck after every 3-4 files.

**Verify**: `grep -rn "77b936fb" --include="*.ts" --include="*.tsx" app lib utils components proxy.ts` → **no matches**; `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm test` → all pass.

## Test plan

- `tests/lib/superadmin.test.ts` — 5 cases from Step 2.
- The 14 call-site changes are guarded by typecheck + the grep sweep (no behavioral tests exist for these pages; do not invent page-level tests in this plan).
- `npm test` → entire suite green.

## Done criteria

- [ ] `grep -rn "77b936fb" --include="*.ts" --include="*.tsx" app lib utils components proxy.ts` returns no matches
- [ ] `lib/superadmin.ts` exists; all 14 files import `isSuperAdminUser`
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0 (incl. 5 new tests)
- [ ] `env.example` documents `SUPERADMIN_USER_IDS`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The grep at planning time (14 files) no longer matches reality — re-run it and reconcile before editing.
- Any call site uses the UUID for something other than a superadmin check (e.g. as a default owner for seeding) — that site needs a different treatment; report it.
- `proxy.ts` fails to build/typecheck after importing the helper (edge-runtime import restriction) — report; do not inline the env parsing back into proxy.ts without noting the duplication.

## Maintenance notes

- **Deploy note (must accompany the PR):** set `SUPERADMIN_USER_IDS=77b936fb-3e92-4180-b601-15c31125811e` in all deployment environments BEFORE merging, and/or ensure that user's `profiles.is_superadmin = true` in production. Otherwise the platform owner loses superadmin on deploy. (The UUID itself is an identifier, not a secret, but treat the env var as config.)
- Long-term: prefer flipping `profiles.is_superadmin` in DB and emptying the env list — then superadmin is purely data-driven and rotatable without deploys.
- Deferred follow-up (operator decision): `proxy.ts:321` falls back to `DEFAULT_TENANT_ID` for *any* user with zero memberships, not just superadmins — worth a product review; see audit finding #6.
- Plan 002 (impersonation) adds its own `profiles.is_superadmin` lookup; if both land, the impersonation route should use `isSuperAdminUser` too.
