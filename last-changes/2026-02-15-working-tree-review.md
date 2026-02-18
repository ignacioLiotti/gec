# Working Tree Review - 2026-02-15

## Scope
Review of unstaged/uncommitted changes present in the working tree at the time of writing.
Focus: correctness, DB performance, API efficiency, React rendering behavior, effects/call patterns, and architecture impact.

## What Changed (Semantic)
- Added tenant-extensible obra data via `custom_data` JSONB in `obras`.
- Extended main table config kind from `base|formula` to `base|formula|custom`.
- Added admin UI to create custom columns for main table.
- Extended obra save/load flows to read/write `customData`.
- Extended main Excel table resolution to include custom columns and formula columns.
- Added a dynamic "Campos de tabla principal" block in `excel/[obraId]` to render all configured columns.
- Expanded report filters in obras report UI and state handling.

## Architecture: New Structure and How It Leverages Previous Design

### Before
- Core obra fields were fixed SQL columns.
- Per-tenant table layout lived in `tenant_main_table_configs`.
- Formula/base behavior existed, but no durable custom per-tenant fields persisted in obra rows.

### Now
- **Configuration layer:** `tenant_main_table_configs.columns` remains the schema definition source per tenant.
- **Data layer:** `obras.custom_data` stores per-row dynamic values for custom columns.
- **Compatibility layer:** fixed SQL columns remain unchanged and continue powering existing flows.
- **Rendering layer:** table/detail pages now resolve base + formula + custom from the same tenant config.

This extends prior architecture rather than replacing it: it keeps existing stable business fields and introduces a flexible extension surface per tenant.

## Findings

### 1. High - Migration rollout fragility (`custom_data` hard dependency)
- Files:
  - `app/api/obras/route.ts`
  - `app/api/obras/[id]/route.ts`
  - `app/api/obras/bulk/route.ts`
- Issue:
  - Reads/writes now assume `custom_data` exists.
  - Existing fallback logic handles missing `on_finish_*` columns, not missing `custom_data`.
- Risk:
  - Environments where migration `0080_obras_custom_data.sql` has not run can fail with 500 on core obra APIs.

### 2. Medium - N+1 DB query pattern in OCR links endpoint
- File: `app/api/obras/[id]/tablas/ocr-links/route.ts`
- Issue:
  - Executes one query per `tablaId` for rows in a `Promise.all` loop.
- Risk:
  - Higher DB load and latency for obras with many OCR tablas.

### 3. Medium - Report filtering still client-side over full data
- File: `components/report/configs/obras.ts`
- Issue:
  - Fetches all obras and filters in browser.
- Risk:
  - Payload size and client CPU scale with dataset size.

### 4. Medium - `customData` can accumulate stale keys
- File: `components/form-table/configs/obras-detalle.tsx`
- Issue:
  - Save path copies any non-fixed row key into `customData`.
- Risk:
  - Deleted/renamed custom columns can leave orphan keys over time.

### 5. Low/Medium - Custom field editor coercion is partial
- File: `app/excel/[obraId]/page.tsx`
- Issue:
  - Dynamic editor maps to `number/date/text`, while several `cellType`s exist.
- Risk:
  - Value typing drift for boolean/toggle/tag-like types.

### 6. Low - Potential render overhead in dynamic details block
- File: `app/excel/[obraId]/page.tsx`
- Issue:
  - Per-render formula/value computation per configured column and object clone on each custom input change.
- Risk:
  - Potential UI lag with high column count.

## React/Effects/API Call Observations
- No infinite effect loop found in introduced effects.
- One new config fetch in obra detail (`/api/main-table-config`) is one-time mount behavior.
- Risk pattern remains mostly data-volume and query-shape related, not runaway rerender loops.

## Recommended Next Steps
1. Add backward-compatible fallback for missing `custom_data` (read and write paths) to avoid hard-fail rollout windows.
2. Refactor OCR links query to single batched row query (`in(tabla_id, ...)`) and group in memory.
3. Move obras report filtering to server-side query params and pagination.
4. Enforce custom key whitelist from tenant config on save; optionally prune unknown keys.
5. Expand dynamic editor controls/coercion per `cellType`.
6. Memoize dynamic column view-model computation in obra detail for large schemas.

## Validation Snapshot
- Type-check run completed successfully: `npx tsc --noEmit`.
