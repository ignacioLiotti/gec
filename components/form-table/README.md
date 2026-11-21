# FormTable maintenance map

Import the public API from `@/components/form-table/form-table`. Existing configs and custom layouts keep the same API. `form-table.tsx` connects the state owners, coordinates pagination, and assembles the public context; it contains no table markup.

## Find the visible control first

| Change | JSX and styles | Behavior |
| --- | --- | --- |
| Search box, filters sheet, Extras, columns/export buttons | `form-table-toolbar.tsx` | `table-search.ts`, `table-filters.ts`, `table-columns.ts`, `table-export.ts` |
| Save, discard, add-row buttons; page controls | `form-table-pagination.tsx` | `table-editing.ts`; page coordination and reveal-new-row behavior in `form-table.tsx` |
| Tabs and counts | `form-table-tabs.tsx` | `table-tabs.ts`, `table-row-pipeline.ts` |
| Bulk-edit bar | `form-table-bulk-edit.tsx` | `table-bulk-selection.ts` |
| Column label, sort button/menu, resize handle, header group | `table-header.tsx` | `table-sorting.ts`, `table-columns.ts` |
| Viewport, loading/error/empty state, virtual spacers | `form-table-content.tsx` | `table-navigation.ts`, TanStack Virtual |
| Row surface, delete button, accordion trigger/detail | `table-body.tsx` | `table-editing.ts`, `table-accordion.ts` |
| Cell focus, read-only/editable boundary, context menu | `table-cell.tsx` | `table-navigation.ts`, `table-editing.ts` |
| Input/textarea draft, debounce, blur commit | `cell-buffered-inputs.tsx` | Same file |
| Date input and calendar | `cell-date-editor.tsx` | Same file; parsers in `lib/tablas.ts` |
| Suggestion button/popover | `cell-suggestion-prompt.tsx` | `cell-suggestions.ts` |
| Display formatting; checkbox/select/link/etc. editor | `cell-renderers.tsx` | Same file |
| Default page/embedded surface | `form-table-layout.tsx` | `form-table.tsx` selects default or supplied children |

The small header components stay in `table-header.tsx`. The input and date editors own both their draft state and their markup. Do not add forwarding components just to move a few lines into another folder.

## Data and state ownership

- `table-editing.ts`: TanStack Form, initial snapshot, dirty baseline, immutable cell/row updates, add/delete, async save, discard. Save advances the baseline to the submitted snapshot; edits made during the request remain dirty.
- `dirty-tracking.ts`: pure comparisons and the incremental dirty index. Extra `dirtyFields` participate even when no visible column uses them.
- `table-fetch.ts`: initial server hydration, fetch lifecycle, refresh events, pagination metadata, and stale-response rejection. The consumer still owns transport and authorization.
- `table-search.ts`: immediate input versus the committed query (220 ms), controlled query reconciliation, and search callbacks.
- `table-filters.ts`: draft versus applied filters. Apply/reset handlers own the transition.
- `table-tabs.ts`: valid active tab and browser persistence.
- `table-sorting.ts`: sort cycle, direction, lock, and transition.
- `table-row-pipeline.ts`: search/filter evaluation, tab counts, selected tab, then client sorting. A query owns a weak cache of immutable row evaluations.
- `table-row-model.ts`: incremental flat TanStack row model; see ADR-0036 before changing its invalidation rules.
- `table-columns.ts`: hidden/pinned columns, widths, DOM offsets, resizing subscriptions and persistence.
- `table-navigation.ts`: arrow focus, pointer activation, hover and drag gestures. Commit a focused editor before activating another cell or allowing virtualization to unmount it.
- `table-bulk-selection.ts`: range membership and bulk writes in the displayed row order.
- `table-accordion.ts`: expanded IDs, remembered automatic openings and pruning removed rows.
- `table-export.ts`: clipboard and CSV, including the consumer's custom export callback.
- `form-table.tsx`: page size, page bounds, client/server page selection, activity feedback, and coordination when query/sort/filter/add changes the view.

`types.ts` defines the configuration contract; `context.tsx` defines the public composition API. `configs/**` continues to own obras/certificados semantics. `table-utils.ts`, `table-layout.ts`, and `persistence.ts` hold shared mechanics without UI state.

## Performance contract

Keep rows immutable and IDs stable. A row model object is reusable only when the row reference, index, column definitions and `getRowId` function are unchanged. A column replacement invalidates cached accessors and cell presentation. Nested TanStack data falls back to its standard model; accordion details are presentation, not nested data.

Keep predicate and column identities stable while their meaning is unchanged. Replace them when their captured rules change. Never mutate a captured rule without updating its predicate: cached matches would otherwise be stale.

An edit still traverses the row collection for counts and dirty summaries. Client sorting still costs O(n log n); a changed search reevaluates all rows. Virtualization bounds mounted DOM only when enabled and there are more than 24 rows; it remains disabled with accordion content. Use the existing server-data mode for datasets that should not be loaded entirely into the browser.

## Reproduce the checks

```sh
npm run test:form-table
npm run test:form-table:browser
npm run typecheck:form-table
npm test
npx tsc --noEmit
npx eslint components/form-table tests/components/form-table playwright.form-table.config.ts
```

The browser suite runs the real table, React/TanStack packages, UI primitives and application stylesheet in an isolated Vite fixture. It uses synthetic data and fake fetch/save callbacks; no account, credentials or database are needed. Install the normal Playwright browser if absent, or select an installed Chrome with `PLAYWRIGHT_CHANNEL=chrome`. On PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'`. If local HTTP is proxied, also set `$env:NO_PROXY='127.0.0.1,localhost'`.

The 10,000-row browser case attaches React Profiler durations to the Playwright result. Its stable assertions are bounded mounted rows and correct editing; elapsed-time values are diagnostic, not brittle machine-specific thresholds. Unit tests enforce that only one TanStack row and one predicate evaluation change after a one-row edit.

See `docs/architecture/form-table-refactor-validation.md` for results and remaining limits.
