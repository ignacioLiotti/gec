# Agent Context: components/form-table

## Purpose

This folder owns the shared editable table engine used by the obras list and extracted-data tables. It provides table config types, rendering, dirty tracking, sorting/searching/filtering, pagination, cell renderers, suggestions, copy/export helpers, and table-specific configs.

This is a shared UI engine. Changes here can affect multiple product surfaces, especially `app/excel`, file-manager extracted data tables, reports, and any future editable tables.

## Main files

- `form-table.tsx`: main `FormTable` implementation plus toolbar, tabs, pagination, required validator, form state, virtualized table, save/delete behavior, sorting/search/filter integration, column visibility, pinned columns, and public subcomponents.
- `types.ts`: config contract for rows, columns, cell types, filters, server pagination, save/fetch functions, row coloring, accordion rows, and table state.
- `table-body.tsx`: memoized row rendering, hover/active-cell behavior, row color overlays, accordion rows, delete actions.
- `table-cell.tsx`: editable/read-only cell behavior, focus handling, context menu, copy/clear/restore, suggestions, date parsing.
- `cell-renderers.tsx`: display/input rendering by cell type.
- `cell-suggestions.ts`: typed suggestions for date/number/currency/math/text/select inputs.
- `dirty-tracking.ts`: row/cell dirty comparison against initial snapshots.
- `table-utils.ts`: row creation, search/sort helpers, CSV/copy helpers, shallow equality.
- `filter-components.tsx`: reusable filter UI.
- `search-highlight.tsx`: reusable controlled-search + match-highlight kit for any FormTable consumer: normalized (accent/spacing-insensitive) matching, `useFormTableSearch` (owns the committed query and returns `searchProps` to spread onto `FormTable`), `SearchHighlightProvider`/`HighlightedSearchText` (subscribe cells to the query via an external store so highlighting never rebuilds the table config). Highlights update with the debounced committed query by default; `liveHighlight` opts into per-keystroke updates at the cost of re-rendering every highlighted cell per keystroke.
- `context.tsx`: table context and public `useFormTable`.
- `persistence.ts`: persistence helpers.
- `configs/obras-detalle.tsx`: obras main-table config and row mapping; high-impact consumer config.
- `configs/certificados.tsx`: certificates table config.

## Local rules

- Treat `types.ts` as a public API. Changing config shapes requires checking all configs/usages.
- Prefer adding behavior through config options over special-casing one consumer.
- Preserve virtualization and memoization boundaries; avoid changes that force all cells/rows to re-render on every keystroke.
- Keep cell behavior keyboard-accessible. Existing active-cell, focus, Enter navigation, copy, clear, restore, and context menu behavior are intentional.
- Dirty tracking must compare against initial snapshots without mutating row objects.
- Do not introduce domain-specific logic into core table files. Put obras/certificados behavior in `configs/**`.
- UI pattern changes here should be reflected in `docs/styleguide` once styleguide pages exist.

## Dependencies

- TanStack React Form, TanStack Table, TanStack Virtual.
- UI primitives: `components/ui/button`, `input`, `sheet`, `select`, `dropdown-menu`, `context-menu`, `tooltip`, `column-resizer`.
- Shared utilities: `@/lib/utils`, `@/lib/tablas` for date parsing/formatting in cells, `@/lib/main-table-select` in config.
- Consumers: `app/excel/**`, `app/excel/[obraId]/tabs/file-manager/**`, `components/report/**`, tests under `tests/components/form-table`.

## Related documentation

- `docs/obsidian-brain/05 - Tablas (Data Tables).md`
- `docs/obsidian-brain/06 - Excel View.md`
- `docs/obsidian-brain/36 - Dynamic Tables Deep Dive.md`
- `docs/styleguide/README.md`

## Related ADRs

- `docs/adr/0001-stable-lineage-for-extracted-rows.md` when table rows display or preserve extracted-row identity.
- `docs/adr/0002-macro-table-overrides-bind-to-lineage.md` when table behavior affects macro override sources.
- `docs/adr/0005-general-tab-layout-owned-by-data-flow.md` only if table config feeds General-tab layout/results.

## Common tasks

### Add or change a column/cell type

Read first:

- `types.ts`
- `cell-renderers.tsx`
- `table-cell.tsx`
- `form-table.tsx` only if table-level config changes
- `tests/components/form-table/cell-suggestions.test.ts` if suggestions are involved

Do not read first:

- `app/excel/**`, unless the new type is for a specific consumer
- API routes

### Change save, dirty, delete, or restore behavior

Read first:

- `form-table.tsx`
- `dirty-tracking.ts`
- `table-utils.ts`
- `table-body.tsx`
- relevant consumer config under `configs/**`

Do not read first:

- cell renderers, unless value serialization changes
- unrelated consumer pages

### Change search, sort, filters, tabs, or pagination

Read first:

- `form-table.tsx`
- `types.ts`
- `table-utils.ts`
- `filter-components.tsx`
- relevant config file under `configs/**`

Do not read first:

- table-cell internals, unless highlighting or cell display changes
- API routes, unless server pagination/fetch contract changes

### Change obras main-table config

Read first:

- `configs/obras-detalle.tsx`
- `app/excel/AGENT_CONTEXT.md`
- `app/excel/schema.ts`
- `app/api/obras/AGENT_CONTEXT.md`

Do not read first:

- core `form-table.tsx`, unless the config cannot express the behavior
- file-manager internals

### Change keyboard/focus/context menu behavior

Read first:

- `table-cell.tsx`
- `table-body.tsx`
- `form-table.tsx`
- `cell-renderers.tsx` if inputs are involved

Do not read first:

- consumer configs, unless behavior is gated by config

## Context boundary

Normally read the core file matching the task plus `types.ts` and the relevant config. Do not scan all consumers unless changing public config/types or response assumptions.

Do not explore broadly:

- `app/**`: only the specific consumer listed in the task.
- `lib/**`: only direct helpers used by table code.
- `components/ui/**`: only if changing primitive integration.
- `app/api/**`: only if server pagination/fetch/save contracts change.

Exploration is justified when public types change, a config option is used by multiple consumers, or a table behavior bug appears only in a consumer.

## Stop conditions

Start editing when you know whether the change belongs in core table code, a renderer, dirty/search/sort utilities, or a consumer config.

Continue exploring only if the public `FormTableConfig` contract changes or a consumer config proves the behavior is not local.

Stop exploring when remaining questions are about unrelated table consumers or future table features.

## Documentation triggers

- Update styleguide docs when changing reusable table, toolbar, filters, loading, empty, error, or cell interaction patterns.
- Update architecture docs when changing server pagination/fetch/save contract.
- Update domain docs only when table behavior changes product semantics, not for visual-only table changes.
- Update ADRs only for table behavior that affects lineage, macro override identity, or data-flow ownership.

## Known risks

- Core changes can affect every table.
- Type changes can silently break configs if generics still compile loosely.
- Re-render regressions are likely in virtualized tables.
- Dirty tracking mistakes can drop edits or show false unsaved changes.
- Keyboard/focus changes can break dense spreadsheet-like workflows.

## Pre-commit checklist for this folder

- State whether the change is core table behavior or consumer config behavior.
- Confirm `types.ts` public contract impact.
- Confirm dirty/save/delete behavior still preserves row IDs.
- Confirm keyboard/focus and context menu behavior were considered for cell changes.
- Confirm large table performance was not obviously worsened.
- Confirm affected consumers were checked selectively.
- Decide whether styleguide docs need updates.
- Do not commit unless explicitly asked.

## Validation

- General changes: `pnpm lint`.
- Cell suggestions: `pnpm test -- tests/components/form-table/cell-suggestions.test.ts`.
- Parsing/formula behavior used by cells: `pnpm test -- tests/lib/tablas.test.ts`.
- Obra table config changes: targeted Excel UI/e2e tests under `tests/e2e/excel/ui` when relevant.
