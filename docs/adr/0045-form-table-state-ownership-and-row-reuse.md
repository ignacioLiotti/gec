# ADR-0045: FormTable state ownership and incremental flat row model

## Status

Accepted for the local refactor; not deployed.

## Date

2026-09-07

## Context

The shared FormTable entry file contained roughly 3,880 lines combining toolbar, headers, viewport, pagination, editing, fetches, filters, persistence and keyboard behavior. Finding a button or effect required following code across unrelated responsibilities. Large client datasets also rebuilt TanStack row objects after a single immutable edit and repeatedly evaluated unchanged rows.

## Decision

Keep the public exports and config/context shapes compatible. Use flat files named for the visible region (`form-table-toolbar.tsx`, `table-header.tsx`, etc.) or the state it owns (`table-editing.ts`, `table-search.ts`, etc.). Keep local input state beside its editor JSX. `form-table.tsx` coordinates these owners and public context; the default layout lives in `form-table-layout.tsx`.

Use an incremental core row model for flat FormTable data. Build changed rows through TanStack's exported `createRow`; reuse a previous row only when its original object, index, columns reference and row-ID function are unchanged. Rebuild the row index on every data-array replacement to prune removed rows. Fall back to TanStack's `getCoreRowModel` when `getSubRows` is supplied. FormTable owns pagination and does not use TanStack's automatic page-reset mechanism.

Cache search/filter/tab evaluation with a WeakMap scoped to the current query and predicate identities. Retain the existing dirty-row cache, initialize its baseline once, and use a Set to find deleted IDs during save.

Keep Effects for browser storage hydration, DOM measurements, event subscriptions, debounce timers, and fetch lifecycle. Reconcile derived selections directly when their inputs change; do not mirror draft/applied filters through an Effect chain. A few storage/DOM effects retain narrowly explained lint exceptions because they synchronize external browser state after hydration.

## Consequences

- Editing one row preserves other row objects and their accessor caches. Changing columns or row positions invalidates those caches.
- Immutable rows and stable IDs remain required. Predicate callbacks must change identity when captured rules change.
- Counts and dirty summaries still traverse rows. Sorting and new queries still scale with dataset size. This does not promise constant-time edits or universal latency improvements.
- The custom row model must be checked against TanStack's reference model when upgrading the dependency. Tests cover column accessors, visibility, reindexing, row-ID replacement, deletion, nested fallback and mixed operation sequences.
- Public context remains compatible with existing custom layouts. No dependency, database, permission, tenant, extraction or lineage change is introduced.

## Alternatives considered

- Extract only JSX: improves navigation but leaves row construction and repeated filtering costs unchanged.
- Replace TanStack or add another grid dependency: requires a wider compatibility effort and consumer migration.
- Split the public context into new stores: could reduce further broadcasts, but changes the composition boundary and is unnecessary for the measured row-allocation bottleneck.

## Related files

- `components/form-table/README.md`
- `components/form-table/table-row-model.ts`
- `components/form-table/table-row-pipeline.ts`
- `tests/components/form-table/row-model.test.ts`
- `tests/components/form-table/row-pipeline.test.ts`
- `tests/components/form-table/browser/form-table.spec.ts`
- `docs/architecture/form-table-refactor-validation.md`

## Related domain docs

- `docs/obsidian-brain/05 - Tablas (Data Tables).md`
- `docs/obsidian-brain/36 - Dynamic Tables Deep Dive.md`

## Agent notes

Use the maintenance map to identify one visual owner and its state owner before editing. Preserve the submitted snapshot across async saves. Blur a focused editor before changing active-cell ownership. Run the focused unit and browser suites; a type check alone cannot detect lost drafts or stale cell presentation.
