# Plan 009: Spike — replace the vulnerable `xlsx` package for untrusted spreadsheet parsing

> **Executor instructions**: This is a SPIKE plan — the deliverable is a
> written report plus a prototype branch, NOT a merged migration. Follow the
> steps, honor STOP conditions, and when done update the status row in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc34545..HEAD -- lib/excel-preview.ts lib/insurance-policies.ts "app/api/obras/[id]/tablas/import/spreadsheet-multi/route.ts" package.json`
> If usage sites changed, re-inventory before proceeding.

## Status

- **Priority**: P3
- **Effort**: M (spike only; the eventual migration is a separate plan informed by this one)
- **Risk**: LOW (no production code changes in this plan)
- **Depends on**: none
- **Category**: migration / security
- **Planned at**: commit `cc34545`, 2026-06-10

## Why this matters

`npm audit` reports `xlsx` (SheetJS via npm) with **high-severity advisories and "No fix available"**: prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9). The npm package is abandoned at 0.18.5 — SheetJS moved distribution to its own CDN. This repo feeds `xlsx` **user-uploaded files** (insurance-policy import, spreadsheet multi-import), which is exactly the threat model those advisories describe. This spike determines the cheapest safe exit: upgrade to the vendor-distributed SheetJS, or migrate to `exceljs`, or split (parse with a safe lib, keep xlsx only for trusted generation).

## Current state

- `package.json:108` — `"xlsx": "^0.18.5"`.
- Usage sites (verified by grep — these are all of them):
  1. `lib/insurance-policies.ts:1` — `import * as XLSX from "xlsx"`; `parseInsurancePoliciesWorkbook(buffer, obras)` at line ~227 uses `XLSX.read(buffer, { type: "array", cellDates: true })`, `sheet_to_json` with `header: 1`. **Parses untrusted uploads.**
  2. `app/api/obras/[id]/tablas/import/spreadsheet-multi/route.ts:4` — OCR/spreadsheet import route. **Parses untrusted uploads.**
  3. `lib/excel-preview.ts:1` — spreadsheet preview generation. Likely untrusted input too (uploaded docs).
  4. `app/certexampleplayground/_lib/excel-parser.ts:1` — dev playground (plan 010 gates/removes this page; deprioritize).
- Date handling caveat: `lib/insurance-policies.ts` has `parseExcelDate` handling Excel serial dates — any replacement must preserve serial-date and `cellDates` semantics (there are existing tests: `npx vitest run tests/lib/document-generation.test.ts` and check for insurance-policy parsing tests under `tests/`).
- Candidate replacements to evaluate:
  - **SheetJS official CDN build** (`https://cdn.sheetjs.com/xlsx-latest/...` installed via `npm i https://cdn.sheetjs.com/xlsx-0.2x.x/xlsx-0.2x.x.tgz`) — API-identical, patches the advisories; cost: non-registry dependency pinning.
  - **exceljs** — actively maintained on npm; different API (streaming, `workbook.xlsx.load`), weaker CSV/odd-format support, heavier.
  - Keep `xlsx` only where input is trusted; use the safer choice at the two untrusted boundaries.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Audit     | `npm audit --omit=dev`                   | shows the xlsx advisory (baseline) |
| Unit      | `npm test`                               | all pass            |
| Typecheck | `npm run typecheck` (or `npx tsc --noEmit`) | exit 0           |

## Scope

**In scope**:
- A prototype on a throwaway branch (may modify `lib/insurance-policies.ts` + `package.json` THERE only)
- `plans/009-xlsx-replacement-spike.report.md` (create — the deliverable)

**Out of scope**:
- Merging any dependency change to the main branch.
- Touching the import routes' behavior, file-size limits, or validation (worth doing, separate decision).
- `app/certexampleplayground/**` (plan 010 handles its fate).

## Git workflow

- Branch: `advisor/009-xlsx-spike` (prototype lives and dies here)
- The report file is committed; the prototype branch is referenced by name in the report.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Characterize current behavior

Locate existing tests covering `parseInsurancePoliciesWorkbook` and `lib/excel-preview.ts` (`grep -rn "parseInsurancePoliciesWorkbook\|excel-preview" tests/`). If none cover workbook parsing, write 3-4 characterization tests on the CURRENT implementation first (a small `.xlsx` fixture built in-test via `XLSX.utils.book_new()`: header row, a serial date cell, an es-AR formatted number, an empty sheet). These tests are the acceptance bar for any replacement and are worth committing regardless.

**Verify**: `npx vitest run <new test file>` → green on current code.

### Step 2: Evaluate the SheetJS CDN upgrade

On the spike branch: install the latest SheetJS from the official CDN per https://docs.sheetjs.com/docs/getting-started/installation/nodejs (pinned tarball URL in package.json). Run the Step 1 tests + `npm test` + `npm run typecheck`. Record: does `npm audit` still flag it (it audits by name — note whether the advisory disappears), install ergonomics, lockfile diff size.

**Verify**: tests green or failures documented.

### Step 3: Evaluate exceljs at one boundary

Still on the spike branch: re-implement ONLY `parseInsurancePoliciesWorkbook` against `exceljs`, keeping the function signature and return shape identical. Run the Step 1 tests. Record: API friction (serial dates! exceljs returns JS Dates differently), bundle/runtime weight, anything that breaks.

**Verify**: Step 1 tests against the exceljs implementation — green or failures documented.

### Step 4: Write the report

Create `plans/009-xlsx-replacement-spike.report.md` with: (a) usage-site inventory with trusted/untrusted classification, (b) results matrix (option × {advisories resolved, test results, effort to migrate all 3-4 sites, operational cost}), (c) a single recommendation, (d) the follow-up migration plan outline (sites, order, test gates). Keep it under ~120 lines.

**Verify**: report exists; characterization tests merged-able independently.

## Test plan

The Step 1 characterization tests ARE the test plan; they get written against current behavior and re-run against each candidate.

## Done criteria

- [ ] Characterization tests exist and pass on current `xlsx` implementation
- [ ] Both candidates evaluated with the same tests; results recorded
- [ ] `plans/009-xlsx-replacement-spike.report.md` exists with a single recommendation
- [ ] Main branch untouched except the report + characterization tests (`git status` on main branch clean otherwise)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The SheetJS CDN tarball cannot be fetched in this environment (network policy) — document and evaluate exceljs only.
- Characterization tests reveal the current parser already mishandles a case (e.g. serial dates off-by-one) — report it as a new finding; do not fix silently.

## Maintenance notes

- The follow-up migration plan should also add upload guards at the two untrusted boundaries (max file size, sheet count, cell count) regardless of which library wins — cheap defense the spike report should size.
