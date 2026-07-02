# Plan 001: Establish CI baseline (GitHub Actions: lint + typecheck + unit tests) and fix agent docs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- package.json AGENTS.md .github/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

This repo has ~175K lines of TypeScript, a working Vitest suite, ESLint 9, and a clean `tsc --noEmit` — but **no CI pipeline and no typecheck script**, so none of it is enforced. Type errors, lint failures, and test regressions can be merged silently. Every other plan in `plans/` relies on `lint + typecheck + test` as its verification gate; this plan makes that gate automatic. It also fixes `AGENTS.md`, which currently tells AI agents to run `pnpm lint` in an npm repo — actively wrong instructions.

## Current state

- `package.json` — npm scripts. Has `lint`, `test`, `test:e2e` but **no `typecheck`**:
  ```json
  // package.json:10-16 (excerpt)
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  ```
  `"packageManager": "npm@10.9.3"` at `package.json:5`. Node types are `@types/node: ^20`; Next.js is `^16.2.6` (requires Node >= 20.9).
- `.github/workflows/` — **does not exist**. No CI of any kind.
- `AGENTS.md:26-31` — Validation section says:
  ```
  - `pnpm lint`
  - `pnpm test`
  ```
  but the repo uses npm (there is a `package-lock.json`, no `pnpm-lock.yaml`).
- Verified at planning time: `npx tsc --noEmit` exits 0 on the current tree.
- The Playwright e2e suite requires a running app + Supabase env (`playwright.config.ts` loads `.env*` files and starts `npm run dev`). It is NOT suitable for this CI workflow — out of scope.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Install   | `npm ci`           | exit 0              |
| Lint      | `npm run lint`     | exit 0              |
| Typecheck | `npx tsc --noEmit` | exit 0, no output   |
| Tests     | `npm test`         | all pass, exit 0    |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (add one script)
- `.github/workflows/ci.yml` (create)
- `AGENTS.md` (fix package-manager references)

**Out of scope** (do NOT touch):
- `package-lock.json` beyond what `npm ci` already requires (do not upgrade deps).
- Playwright/e2e in CI — needs Supabase secrets and a seeded DB; defer.
- Pre-commit hooks (husky etc.) — separate decision, not in this plan.
- Any source code fixes. If lint or tests fail at baseline, see STOP conditions.

## Git workflow

- Branch: `advisor/001-ci-baseline` (branch from the repo's default branch `main`)
- Commit style: short imperative subject, matching history (e.g. "Add WhatsApp flow editor and test menu"). One commit is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish the local baseline

Run, in order: `npm ci`, then `npm run lint`, then `npx tsc --noEmit`, then `npm test`. Record each exit code.

**Verify**: all four exit 0. If `lint` or `test` fail, see STOP conditions (typecheck was verified green at planning time — a failure there means drift).

### Step 2: Add the typecheck script

In `package.json` scripts, after `"lint": "eslint",` add:

```json
"typecheck": "tsc --noEmit",
```

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Create the GitHub Actions workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

**Verify**: `npx --yes yaml-lint .github/workflows/ci.yml 2>$null` or simply confirm the YAML parses: `node -e "require('js-yaml')"` is NOT available — instead verify with `npx --yes js-yaml .github/workflows/ci.yml` → prints parsed JSON, exit 0. (If `js-yaml` cannot be fetched, a careful visual check of indentation is acceptable; the file is 20 lines.)

### Step 4: Fix AGENTS.md

In `AGENTS.md` Validation section, replace:
- `` `pnpm lint` `` → `` `npm run lint` ``
- `` `pnpm test` `` → `` `npm test` ``

and add a line `` - `npm run typecheck` `` directly above the lint line.

**Verify**: `grep -n "pnpm" AGENTS.md` → no matches.

## Test plan

No new unit tests (tooling-only change). The workflow itself is the test: after merge to a GitHub-hosted branch, the `checks` job must pass. Locally, Step 1's four green commands are the proxy.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0
- [ ] `.github/workflows/ci.yml` exists and contains the four run steps (`npm ci`, lint, typecheck, test)
- [ ] `grep -rn "pnpm" AGENTS.md` returns no matches
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run lint` fails at baseline (Step 1). Report the rule names and file counts — do NOT fix lint errors or weaken eslint config; the operator decides whether CI's lint step ships blocking or is deferred.
- `npm test` fails at baseline (Step 1). Report which test files fail — do NOT modify tests or source.
- `npx tsc --noEmit` fails (drift from planning-time state).
- The repo turns out to not be hosted on GitHub (no `github.com` remote in `git remote -v`) — the workflow file is then dead weight; report and ask which CI host to target.

## Maintenance notes

- Plans 002–011 list `npm run typecheck` in their command tables; they assume this plan landed.
- Follow-up explicitly deferred: e2e in CI (needs Supabase service credentials as GitHub secrets and a seed strategy — see plan 006), dependency caching for Playwright browsers, branch protection rules (operator must configure in GitHub UI).
- If the team later switches `next build` into CI, note `build` uses `--turbopack` and writes `.next/` — keep it a separate job.
