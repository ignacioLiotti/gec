# Plan 010: Gate unfinished demo/playground pages out of production

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- app/dashboard2/ app/system-design/ app/certexampleplayground/ app/permissions-demo/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (gating only; no deletion, fully reversible)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

Three substantial playground/prototype routes — `app/dashboard2/`, `app/system-design/`, `app/certexampleplayground/` — are reachable **in production by any authenticated user** (they're not in `lib/route-access.ts`, and per its rules at lines 16-17, unlisted routes are open to all authenticated users). They're unmaintained prototypes: confusing if discovered, shipped in the build, and an unreviewed attack/maintenance surface. The repo already has the pattern for this: `app/permissions-demo/page.tsx` returns `notFound()` in production. This plan applies that pattern to the other three. Deletion is deliberately deferred (product owner's call — `dashboard2` looks like a candidate future dashboard).

## Current state

- The exemplar gate (copy this pattern):
  ```ts
  // app/permissions-demo/page.tsx:1-5
  import { notFound } from "next/navigation";
  ...
  if (process.env.NODE_ENV === "production") notFound();
  ```
- Ungated targets (verified: no `NODE_ENV`/`notFound` guard in their `page.tsx`):
  - `app/dashboard2/page.tsx` — prototype analytics dashboard (~700 lines)
  - `app/system-design/page.tsx` — design studio prototype (~1500 lines, may have sub-routes; check `ls app/system-design`)
  - `app/certexampleplayground/page.tsx` — certificate column-matcher playground (has `_lib/excel-parser.ts`)
- References elsewhere are **label strings only**, not imports (verified):
  - `app/admin/obra-defaults/page.tsx:4596` — `<SelectItem value="certificado">Certificado (certexampleplayground)</SelectItem>`
  - `app/excel/[obraId]/tabs/file-manager/file-manager.tsx:7821` — same label
  Leave both labels alone (they name a select option, value `"certificado"`; only the parenthetical mentions the playground — cosmetic, out of scope).
- Repo precedent for gated lab pages (memory/docs): `app/lab/` pages are production-gated via `notFound()` the same way.

## Commands you will need

| Purpose   | Command                                     | Expected on success |
|-----------|---------------------------------------------|---------------------|
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit`) | exit 0              |
| Lint      | `npm run lint`                              | exit 0              |
| Unit      | `npm test`                                  | all pass            |

## Scope

**In scope**:
- `app/dashboard2/page.tsx`
- `app/system-design/page.tsx` (and any sibling `page.tsx` files under `app/system-design/**` — enumerate with `Get-ChildItem -Recurse app/system-design -Filter page.tsx`)
- `app/certexampleplayground/page.tsx` (and sub-pages likewise)

**Out of scope** (do NOT touch):
- Deleting any of these directories — deferred to the product owner (record in Maintenance notes).
- `app/permissions-demo/` — already gated.
- `app/demo/` and `app/landings/` — different features (demo links are a real product surface; landings are in active development on this branch).
- The two SelectItem label strings.

## Git workflow

- Branch: `advisor/010-gate-demo-pages`
- One commit (e.g. "Gate prototype pages out of production").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Enumerate every page entry under the three directories

`Get-ChildItem -Recurse app/dashboard2, app/system-design, app/certexampleplayground -Filter page.tsx` — list them all. Also check for `route.ts` files (API handlers) under those dirs; if any exist, they need the same treatment (return 404 in production).

**Verify**: list produced; note each file's first lines (server vs `"use client"` component — see Step 2).

### Step 2: Add the production gate to each page

For **server components** (no `"use client"` at top), add at the top of the default export, exactly like the exemplar:

```ts
import { notFound } from "next/navigation";
// first line inside the component:
if (process.env.NODE_ENV === "production") notFound();
```

For **client components** (`"use client"`), `notFound()` cannot run during server render the same way — instead create a thin server wrapper: rename the existing file to `page-client.tsx` (keep `"use client"`), and create a new `page.tsx`:

```tsx
import { notFound } from "next/navigation";
import PageClient from "./page-client";

export default function Page() {
    if (process.env.NODE_ENV === "production") notFound();
    return <PageClient />;
}
```

(This wrapper pattern matches `app/excel/[obraId]/page.tsx` → `page-client.tsx` used elsewhere in the repo.) If the client page exports metadata or receives props/params, carry them through the wrapper.

**Verify** after each file: `npm run typecheck` → exit 0.

### Step 3: Confirm dev still renders and prod build hides them

- `npm run lint` → exit 0; `npm test` → all pass.
- If feasible, `npm run build` (writes only `.next/`): build must succeed. (A production smoke of the 404 requires `npm start`; optional.)

**Verify**: commands above green.

## Test plan

No unit tests for `notFound()` gating (matches the repo's treatment of `permissions-demo` and lab pages — none have tests). Verification is typecheck + build.

## Done criteria

- [ ] Every `page.tsx` under the three directories contains the production gate (grep: `grep -rln "NODE_ENV" app/dashboard2 app/system-design app/certexampleplayground` covers all page entries found in Step 1)
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0
- [ ] `npm run build` succeeds (if run)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any of the three pages turns out to be linked from live navigation (`grep -rn "dashboard2\|system-design\|certexampleplayground" components/ app/ --include="*.tsx" | grep -v "app/dashboard2\|app/system-design\|app/certexampleplayground"` returns hits beyond the two known label strings) — someone may be using it; report before gating.
- A `route.ts` API handler exists under these dirs and is called from elsewhere — report; gating it could break a real flow.

## Maintenance notes

- Deferred decision for the product owner, per page: productize (remove gate, add to `lib/route-access.ts` + sidebar) or delete the directory. `certexampleplayground` deletion would also delete `_lib/excel-parser.ts` (an `xlsx` usage site — see plan 009's inventory).
- If a new prototype page is added, the wrapper pattern from Step 2 is the convention to follow from day one.
