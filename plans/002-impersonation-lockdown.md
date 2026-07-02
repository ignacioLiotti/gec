# Plan 002: Lock down user impersonation — tenant-scope check, audit log, rate limit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- app/api/impersonate/ lib/impersonation-access.ts tests/lib/impersonation-access.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches an auth-sensitive path; a bug here locks admins out of a support tool or, worse, fails open)
- **Depends on**: none (001 recommended first so CI guards the change)
- **Category**: security
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

`POST /api/impersonate/start` lets any user who is owner/admin of **any one tenant** impersonate **any user on the entire platform**: the requester's role is checked against their own memberships only, then the target is looked up with the service-role (RLS-bypassing) client with no check that the target shares a tenant with the requester. An admin of tenant A can take over the session of the owner of tenant B. There is also no audit record and no rate limit, so abuse is invisible. This is the highest-leverage security fix in the audit.

## Current state

- `app/api/impersonate/start/route.ts` — the whole route (115 lines). Key excerpts:

  Requester check — any elevated role in ANY tenant suffices:
  ```ts
  // app/api/impersonate/start/route.ts:41-51
  const { data: adminMembership, error: roleErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"]) // enforce elevated roles only
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
  if (roleErr || !adminMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  ```

  Target lookup — global, via service-role admin client, no tenant intersection check:
  ```ts
  // app/api/impersonate/start/route.ts:53-60
  const admin = createSupabaseAdminClient();
  const { data: targetUser } = await admin.auth.admin.getUserById(targetUserId);
  ```

  After that the route stores the impersonator session in a cookie, generates a magic link for the target with `admin.auth.admin.generateLink`, and verifies the OTP to swap the session. No audit insert anywhere.

- `proxy.ts:287-288` — superadmin definition used platform-wide: `profiles.is_superadmin` flag (plus a hardcoded UUID, being removed by plan 005). Superadmins legitimately need cross-tenant impersonation; preserve that.
- Audit infrastructure exists: table `public.audit_log` (created in `supabase/migrations/0044_audit_log.sql:72`) with columns `tenant_id, actor_id, actor_email, table_name, row_pk (jsonb), action (CHECK IN ('INSERT','UPDATE','DELETE')), changed_keys, before_data, after_data, context (jsonb), created_at`. It is normally populated by DB triggers, but direct inserts via the admin client are valid. The admin UI reads it at `app/admin/audit-log/page.tsx:154`.
- Rate-limit helpers exist: `lib/security/rate-limit.ts` exports `rateLimitByTenant(tenantId, scope)` and `rateLimitByIp(identifier)`, plus `getClientIp(request)`. They fail open (allow) when Upstash env vars are absent — acceptable here since the tenant check is the primary control.
- Repo auth convention for routes: check `supabase.auth.getUser()`, return Spanish-or-English error JSON with 401/403. Tests for pure lib logic live in `tests/lib/*.test.ts` (see `tests/lib/tablas.test.ts` for the plain-vitest style: import pure functions, assert).

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit` if plan 001 not landed) | exit 0 |
| Lint      | `npm run lint`                                       | exit 0              |
| New tests | `npx vitest run tests/lib/impersonation-access.test.ts` | all pass         |
| Full unit | `npm test`                                           | all pass            |

## Scope

**In scope**:
- `app/api/impersonate/start/route.ts`
- `lib/impersonation-access.ts` (create — pure authorization logic)
- `tests/lib/impersonation-access.test.ts` (create)

**Out of scope** (do NOT touch):
- `app/api/impersonate/stop/**` (or however the restore flow is implemented) — restoring your own session is not the vulnerability.
- `proxy.ts`, `lib/route-access.ts` — middleware does not gate API auth in this repo; don't try to add it there.
- `supabase/migrations/**` — no schema change needed; `audit_log` already fits.
- Any UI that triggers impersonation (`app/admin/users/**`) — behavior of authorized calls is unchanged.

## Git workflow

- Branch: `advisor/002-impersonation-lockdown`
- Commit style: short imperative subject (e.g. "Harden impersonation with tenant scoping and audit log").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the pure authorization helper

Create `lib/impersonation-access.ts`:

```ts
export type MembershipRow = { tenant_id: string; role: string };

export function canImpersonate({
    isSuperAdmin,
    requesterMemberships,
    targetMemberships,
}: {
    isSuperAdmin: boolean;
    requesterMemberships: MembershipRow[];
    targetMemberships: MembershipRow[];
}): { allowed: boolean; sharedTenantId: string | null } {
    if (isSuperAdmin) return { allowed: true, sharedTenantId: null };
    const elevated = new Set(
        requesterMemberships
            .filter((m) => m.role === "owner" || m.role === "admin")
            .map((m) => m.tenant_id),
    );
    const shared = targetMemberships.find((m) => elevated.has(m.tenant_id));
    return shared
        ? { allowed: true, sharedTenantId: shared.tenant_id }
        : { allowed: false, sharedTenantId: null };
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Write unit tests for the helper

Create `tests/lib/impersonation-access.test.ts` modeled on the plain style of `tests/lib/tablas.test.ts`. Cases (all must be present):
1. Requester admin of tenant A, target member of tenant A → allowed, sharedTenantId A.
2. Requester admin of tenant A, target member of tenant B only → **denied**.
3. Requester is only `member` (not owner/admin) of the shared tenant → denied.
4. Superadmin, disjoint tenants → allowed.
5. Target with zero memberships → denied (non-superadmin).

**Verify**: `npx vitest run tests/lib/impersonation-access.test.ts` → 5 tests pass.

### Step 3: Enforce the check in the route

In `app/api/impersonate/start/route.ts`, after the existing `user` auth check (line 37) and BEFORE generating any link:

1. Fetch the requester's superadmin flag: `supabase.from("profiles").select("is_superadmin").eq("user_id", user.id).maybeSingle()`.
2. Replace the existing single-membership query (lines 41-51) with a query for ALL of the requester's memberships: `.select("tenant_id, role").eq("user_id", user.id)`.
3. Fetch the target's memberships **with the admin client** (target's rows aren't visible under requester RLS): `admin.from("memberships").select("tenant_id, role").eq("user_id", targetUserId)`.
4. Call `canImpersonate(...)`. If `!allowed`, return 403 `{ error: "Forbidden" }`. Keep the existing 403 for requesters with no elevated role (case 3 covers it).
5. Keep the rest of the flow (cookie save, generateLink, verifyOtp) unchanged.

Note: move the `createSupabaseAdminClient()` call up so it's available for the membership lookup; it currently sits at line 53.

**Verify**: `npm run typecheck` → exit 0; `npm run lint` → exit 0.

### Step 4: Add rate limiting

At the top of the handler, after `targetUserId` parsing, add:

```ts
import { getClientIp, rateLimitByIp } from "@/lib/security/rate-limit";
// ...
const ip = getClientIp(req) ?? "unknown";
const limit = await rateLimitByIp(`impersonate:${ip}`);
if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 5: Write the audit record

Immediately after a successful `verifyOtp` (i.e., impersonation actually happened) and before `return res;`, insert with the admin client:

```ts
const { error: auditError } = await admin.from("audit_log").insert({
    tenant_id: sharedTenantId, // null for superadmin cross-tenant impersonation
    actor_id: user.id,
    actor_email: user.email ?? null,
    table_name: "impersonation",
    row_pk: { target_user_id: targetUserId },
    action: "INSERT",
    context: { kind: "impersonation_start", ip, target_email: targetUser.user.email },
});
if (auditError) {
    console.error("[impersonate] failed to write audit log", auditError);
}
```

Do NOT fail the request if the audit insert fails (log it) — but do log loudly. (`action` must be one of INSERT/UPDATE/DELETE per the table CHECK constraint.)

**Verify**: `npm run typecheck` → exit 0; `npm test` → all pass.

## Test plan

- `tests/lib/impersonation-access.test.ts` — the 5 cases from Step 2. This file is the regression guard for the vulnerability (case 2 is the exact exploit).
- The route itself is not unit-tested (it constructs a Supabase SSR client from request cookies; mocking that is out of proportion). Manual verification if a local stack is available (`npm run dev` + two tenants): admin of tenant A posting `user_id` of a tenant-B-only user must receive 403.
- Verification: `npm test` → all pass including the 5 new tests.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 and includes 5 passing tests in `tests/lib/impersonation-access.test.ts`
- [ ] `app/api/impersonate/start/route.ts` contains a call to `canImpersonate` and returns 403 when it denies
- [ ] The route inserts into `audit_log` with `table_name: "impersonation"` after successful impersonation
- [ ] `grep -n "rateLimitByIp" app/api/impersonate/start/route.ts` → at least one match
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The route content at `app/api/impersonate/start/route.ts` no longer matches the excerpts (drift).
- You find an existing impersonation-authorization helper elsewhere (search `grep -rn "impersonat" lib app --include="*.ts"` first) — extend it instead of duplicating, and report the deviation.
- The `audit_log` insert fails typecheck because generated DB types don't include the table — report rather than casting to `any`.
- You discover other impersonation entry points besides `/api/impersonate/start` (e.g. a server action) — report them; they need the same fix and the plan must be extended.

## Maintenance notes

- Plan 005 (superadmin de-hardcoding) introduces a shared superadmin helper; when it lands, this route's `is_superadmin` lookup should switch to that helper. Coordinate if executed together.
- Plan 006 (tenant-isolation tests) should include an e2e case for this exact 403.
- Reviewer should scrutinize: the target-membership query MUST use the admin client (RLS would silently return zero rows under the requester's session, which would deny superadmin-less legitimate same-tenant use — test case 1 guards the helper, but the query wiring is only visible in review).
