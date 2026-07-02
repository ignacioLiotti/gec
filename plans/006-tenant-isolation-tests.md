# Plan 006: Build a tenant-isolation regression test suite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- tests/ playwright.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M–L
- **Risk**: LOW (test-only; no production code changes allowed in this plan)
- **Depends on**: 001 (CI), and conceptually pairs with 002 (its 403 is a test case here once landed)
- **Category**: tests / security
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

This is a multi-tenant platform whose core security promise is that tenant A can never read or mutate tenant B's data — and that promise has **zero automated coverage**. Of 119 API `route.ts` files, exactly one has a unit test; the 4 Playwright specs cover navigation and lineage for a single signed-in user. The audit found one live cross-tenant hole (impersonation, plan 002) by reading code; this suite is what catches the next one before it ships. The deliverable is two layers: (A) fast Vitest guards asserting unauthenticated requests are rejected by critical route handlers, and (B) a Playwright cross-tenant scenario with two real tenants.

## Current state

- Unit-test exemplar that imports a route handler directly:
  ```ts
  // tests/app/api/tenant-usage-post.test.ts (entire file)
  import { describe, expect, it } from "vitest";
  import { POST } from "@/app/api/tenant-usage/route";
  describe("POST /api/tenant-usage", () => {
      it("returns 405 because client-side usage writes are disabled", async () => {
          const response = await POST();
          ...
  ```
- E2E infra: `playwright.config.ts` auto-loads `.env*` files, starts `npm run dev` (unless `PLAYWRIGHT_SKIP_WEBSERVER=true`), stores auth state at `playwright/.auth/user.json` via `tests/e2e/auth.setup.ts`. Helpers exist at `tests/e2e/helpers/` (`auth.ts`, `obras.ts`, `lineage.ts`); `tests/e2e/helpers/obras.ts` exposes obra-creation helpers used by existing specs.
- Auth conventions in routes (what layer A asserts): most routes call either `getAuthContext()` (obras routes, defined in `app/api/obras/route.ts`) or `resolveRequestAccessContext()` from `@/lib/demo-session`, returning 401 on no user. Tenant scoping is `.eq("tenant_id", tenantId)` on queries.
- Middleware does NOT gate API auth: `proxy.ts:277-279` passes unauthenticated requests through. Every route defends itself — which is exactly why per-route guards need tests.
- Seeding: `scripts/bootstrap-demo-tenant.mjs` (`npm run seed:demo-tenant`) bootstraps a demo tenant; read it before designing the two-tenant fixture.

## Commands you will need

| Purpose      | Command                                             | Expected on success |
|--------------|-----------------------------------------------------|---------------------|
| Unit tests   | `npx vitest run tests/app/api/`                     | all pass            |
| Full unit    | `npm test`                                          | all pass            |
| E2E (local)  | `npx playwright test tests/e2e/tenant-isolation.spec.ts` | all pass (needs `.env` + Supabase reachable) |
| Typecheck    | `npm run typecheck`                                 | exit 0              |

## Scope

**In scope** (create only; modify nothing outside `tests/`):
- `tests/app/api/auth-guards.test.ts` (create — layer A)
- `tests/e2e/tenant-isolation.spec.ts` (create — layer B)
- `tests/e2e/helpers/tenants.ts` (create if needed for the second-tenant fixture)

**Out of scope** (do NOT touch):
- ANY production source file. If a test exposes a real isolation bug, that is a **successful outcome of this plan**: write the failing test, mark it `test.fixme(...)` with a comment, and report it — do not fix the route in this plan.
- `playwright.config.ts` — only touch if the second storage-state file strictly requires a new project entry; if so, keep the existing projects untouched.
- CI wiring for e2e (plan 001 deliberately excluded it).

## Git workflow

- Branch: `advisor/006-tenant-isolation-tests`
- Commit per layer; short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory the target routes for layer A

Layer A covers these critical mutation surfaces (chosen for money/data impact). For each, open the file and identify the exported methods and their auth check:

1. `app/api/obras/[id]/route.ts` — PUT/PATCH/DELETE (uses `getAuthContext`)
2. `app/api/obras/[id]/complete/route.ts` — POST
3. `app/api/insurance-policies/route.ts` — mutating methods
4. `app/api/company-files/route.ts` — GET/POST (uses `resolveRequestAccessContext`)
5. `app/api/macro-tables/[id]/rows/route.ts` — mutating methods
6. `app/api/impersonate/start/route.ts` — POST

**Verify**: produce (in your report) a table route → methods → auth helper used. If any route in this list has NO auth check at all, that's a STOP condition (real finding).

### Step 2: Write layer A — unauthenticated-request guards

Create `tests/app/api/auth-guards.test.ts`. For each route from Step 1: mock the auth source to return "no user", call the handler, assert 401 (or 403). Mechanics:

- For `resolveRequestAccessContext` routes: `vi.mock("@/lib/demo-session", ...)` returning `{ user: null, tenantId: null, actorType: "anonymous" }`.
- For `getAuthContext` routes: `getAuthContext` builds a Supabase server client from cookies; mock `@/utils/supabase/server`'s `createClient` to return a stub whose `auth.getUser()` resolves `{ data: { user: null } }`. Inspect `utils/supabase/server.ts` first and mock at that boundary.
- Handlers with dynamic params receive `{ params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) }`.
- Requests: `new NextRequest("http://localhost/api/...", { method, body, headers })`.

One `describe` per route, one `it` per method. If a particular handler proves unmockable within ~30 minutes (deep import side effects), skip it with `it.todo("...")` and note why in the report — partial coverage beats stalling.

**Verify**: `npx vitest run tests/app/api/auth-guards.test.ts` → all pass (≥ 6 tests, no unhandled-promise warnings).

### Step 3: Design the two-tenant e2e fixture

Read `tests/e2e/auth.setup.ts`, `tests/e2e/helpers/auth.ts`, and `scripts/bootstrap-demo-tenant.mjs`. Decide the cheapest way to obtain **two users in two different tenants**:
- Preferred: a `tests/e2e/helpers/tenants.ts` helper that uses the Supabase service-role key (already in `.env` locally, loaded by playwright.config) to create a throwaway tenant + user + membership via the admin API, and cleans them up in `afterAll`.
- Acceptable fallback: require two pre-seeded env-var credential pairs (`E2E_TENANT_B_EMAIL/PASSWORD`) and document them in the spec header.

**Verify**: the helper (or fixture doc) exists; running the spec's `beforeAll` against the local stack creates/locates both tenants without error.

### Step 4: Write layer B — cross-tenant access spec

Create `tests/e2e/tenant-isolation.spec.ts` with these scenarios (use `request` fixtures with each user's storage state / auth cookies):

1. **Obra read isolation**: user A creates an obra (reuse `tests/e2e/helpers/obras.ts`); user B requests `GET /api/obras/<thatId>` (and the page `/excel/<thatId>`) → API responds 404/403/empty (anything except the obra data), page does not render tenant A's obra name.
2. **Obra mutation isolation**: user B sends `PUT /api/obras/<thatId>` with a valid body → not 2xx, and a follow-up GET as user A shows the obra unchanged.
3. **Impersonation isolation** (post-plan-002): user B (admin of tenant B) posts `user_id` of user A to `/api/impersonate/start` → 403. Until plan 002 lands this test documents the hole: write it, and if it fails (i.e. impersonation succeeds), wrap in `test.fixme` with a comment referencing `plans/002-impersonation-lockdown.md`.

Assert on status codes AND on data absence, not just one.

**Verify**: `npx playwright test tests/e2e/tenant-isolation.spec.ts` → passes locally (or `fixme`-skips exactly the documented cases).

## Test plan

This plan IS the test plan. Net new: ≥6 unit guard tests + 3 e2e scenarios. Full gates: `npm test` green; the e2e spec green locally (e2e cannot run in CI yet — note in report).

## Done criteria

- [ ] `tests/app/api/auth-guards.test.ts` exists, ≥6 passing tests, `npm test` exits 0
- [ ] `tests/e2e/tenant-isolation.spec.ts` exists with the 3 scenarios (passing or explicitly `fixme`-documented)
- [ ] Report includes the Step 1 route→auth-helper table and any `it.todo`/`fixme` items with reasons
- [ ] No files outside `tests/` (and optionally `playwright.config.ts` per scope note) modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds a route with no auth check at all — report immediately (security finding outranks finishing the suite).
- The local environment lacks `.env` Supabase credentials needed for e2e — deliver layer A only, mark layer B BLOCKED in the index with the missing prerequisite.
- Creating a second tenant programmatically requires schema/RPC work — report the gap; do not write migrations from this plan.
- A cross-tenant e2e assertion FAILS against current code (other than the known impersonation case) — that's a live vulnerability; report it with the reproduction, `fixme` the test, and stop expanding scope.

## Maintenance notes

- Every new API route family should get a row in `auth-guards.test.ts` — cheap to add, and the file doubles as documentation of which auth helper each route uses.
- When CI gains Supabase credentials (follow-up to plan 001), wire `test:e2e` into a separate workflow job with `PLAYWRIGHT_SKIP_WEBSERVER` semantics reviewed.
- The two-tenant fixture helper is reusable for future permission-matrix tests (roles, `requiredPermissions` in `lib/route-access.ts`).
