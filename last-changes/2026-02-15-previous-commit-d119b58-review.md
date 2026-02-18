# Previous Commit Review - d119b58 - 2026-02-15

## Scope
Review of commit `d119b58` ("changes") from repository history.
Focus: correctness, DB/API performance, React render/effect behavior, and structural impact.

## Commit Shape (High Level)
- Large feature commit across admin config, reporting, file manager, forms, routing guard/access, and migrations.
- Introduced main-table-config APIs and admin UI.
- Expanded OCR/file-manager and reporting modules.

## Architecture Impact

### What it introduced
- Tenant-aware main table configuration persisted in DB.
- Expanded reporting/rule/signal plumbing.
- OCR documents/tree integration improvements.

### How it leverages prior system
- Reused existing obra/tablas/reporting primitives.
- Added configuration and orchestration layers without replacing baseline entities.

## Findings

### 1. Medium - N+1 row fetch in documents-tree OCR composition
- File: `app/api/obras/[id]/documents-tree/route.ts`
- Evidence:
  - One query per tabla for `obra_tabla_rows` in `Promise.all` loop.
- Risk:
  - DB pressure and tail-latency growth with number of tablas.

### 2. Medium - Duplicate endpoint fetch path in file manager bootstrap
- File: `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`
- Evidence:
  - `refreshOcrFolderLinks()` and `buildFileTree()` both fetch `/api/obras/${obraId}/documents-tree?limit=500`.
  - Bootstrap can call both depending on freshness checks.
- Risk:
  - Redundant network calls and duplicate JSON processing.

### 3. Medium - Reporting signal recompute reads full tabla rows without pagination/limits
- File: `lib/reporting/index.ts`
- Evidence:
  - `fetchRows()` reads all rows for `tabla_id`.
- Risk:
  - Memory and compute cost increase with historical row growth.

### 4. Low/Medium - Repeated tenant resolution query pattern
- File: `lib/reporting/index.ts`
- Evidence:
  - `resolveTenantId()` does multi-query lookup and is called by several operations.
- Risk:
  - Extra DB roundtrips in hot paths; likely acceptable now but costly at scale.

### 5. Low - File manager complexity/maintainability risk
- File: `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`
- Evidence:
  - Very high effect and callback density.
- Risk:
  - Harder to reason about state transitions and prevent accidental over-fetch in future changes.

## React/Effects/API Call Observations
- No direct infinite rerender defect detected in reviewed commit sections.
- Main risk is duplicated fetches and expensive data hydration paths, not immediate render loops.

## Recommended Next Steps
1. Collapse documents-tree row fetching into a batched query and group by `tabla_id`.
2. Consolidate file-manager bootstrap into a single source-of-truth fetch for tree + OCR links.
3. Add limits/windowing or incremental processing to reporting recompute row reads.
4. Cache/resuse tenant resolution in request scope for reporting functions.
5. Consider splitting file-manager logic into focused hooks (tree loading, OCR linkage, selection state, usage tracking).

## Notes
- This review is static analysis of commit content, not runtime profiling.
- Priority should focus first on query-shape improvements (N+1 and duplicate fetches).
