# FormTable refactor validation

Validated on 2026-09-07 in `codex/form-table-refactor`, based on `e04d720`, in the isolated `multi-tenant-form-table` worktree. Pending changes in the original `mobile-navigation` checkout are outside this refactor. No commit, push, deployment, database change or production dependency was added.

## Result

The main entry changed from approximately 3,880 lines to 602 lines of composition and coordination. Its table markup moved into named visual owners. The renderer module changed from approximately 1,300 lines to 735, with buffered inputs, dates and suggestion UI in their own files. Headers share one sorting control implementation and ordinary/virtualized content shares one row-rendering path.

Public entry exports, config shapes, custom children and context access remain compatible. `EditableCellValue` moved to the shared type file and remains re-exported from its previous module. The direct ownership map is in `components/form-table/README.md`.

## Verification

| Check | Result |
| --- | --- |
| Full Vitest suite, `npm test` | 251 tests across 39 files passed |
| FormTable unit cases | 42 passed, including 37 new cases |
| Related date/number helpers | 14 tests passed |
| Browser suite, `npm run test:form-table:browser` | 34 new cases passed in Chrome, 43.5 seconds in the final run |
| Focused TypeScript, `npm run typecheck:form-table` | Passed |
| Full TypeScript, `tsc --noEmit --pretty false` | Passed, including downstream consumers |
| Focused ESLint, table + tests + browser config | 0 errors, 5 warnings |
| General ESLint | Fails in unchanged source files outside this change; 272 errors excluding generated scratch files |
| `git diff --check` | Passed |

The five focused lint warnings are the existing image renderer, two warnings in the unchanged obras config, and React Compiler's compatibility warnings for TanStack Table/Virtual. No global rule was disabled. Browser-storage hydration and DOM synchronization Effects have narrow, explained exceptions to `set-state-in-effect`.

Browser coverage includes editing, save/discard, failed saves and retry, edits during an in-flight save, inserted/deleted IDs, read-only guards, sorting and locks, pagination, controlled search, draft/applied filters, tabs and persistence, reveal-new-row, hidden/pinned columns, changing a renderer/config, keyboard navigation, context-menu clear/restore, bulk edits and real mouse drag, accordion fields, server pages, stale responses, errors/recovery, targeted refresh, CSV, header groups, always-editable mode, text/number/checkbox/select/date editors, virtual scrolling to row 9,999, default layout and Extras toolbar.

The tests reproduced and now protect two existing correctness problems: active-cell changes could unmount a buffered editor before its blur committed the draft; memo comparators could retain stale column presentation/editability. The fix flushes the focused editor before pointer/arrow activation and includes column/presentation identity in memo comparisons.

## Performance evidence

| Operation | Evidence |
| --- | --- |
| Edit one row out of 10,000 | Exactly one TanStack row object changes; unchanged rows preserve cached accessors |
| Reevaluate a 10,000-row query after one immutable edit | Exactly one predicate evaluation; the aggregate traversal still visits every row |
| Render and scroll 10,000 rows | Fewer than 50 mounted name cells, including at the final row |
| Activate, type and commit one visible cell | Four name-renderer calls in the final browser run; regression assertion requires fewer than ten |
| Initial dirty baseline | Snapshot initialized once instead of evaluated as a `useRef` argument on every render |
| Find deleted IDs on save | Set membership replaces repeated `rowOrder.includes`, removing quadratic ID lookup |

Exploratory React Profiler runs of the same 10,000-row edit measured a largest update of roughly 73 ms before incremental row-model reuse, then roughly 23–28 ms after it. The final run recorded 27.6 ms. These are development-fixture observations on one machine, not production latency guarantees or a statistically controlled benchmark. The operation-count assertions provide the repeatable regression checks.

Client sorting remains O(n log n), a new search must evaluate all rows, and dirty/count aggregation remains O(n). Accordion tables retain their existing non-virtualized behavior. This refactor does not make arbitrary dataset sizes cheap; server-data mode remains the existing option when all rows should not be loaded locally.

## Visual and integration scope

Screenshots at 1280×900 were byte-identical before/after consolidating the spreadsheet and grouped headers. A 640×900 grouped-table screenshot was inspected; horizontal scrolling and wrapped footer controls remain available. The final layout/editor extraction was exercised through the browser suite with the actual application stylesheet and UI primitives.

The fixture uses synthetic rows and simulated save/fetch callbacks. Production network latency, authenticated Excel/file-manager flows and tenant-specific data were not exercised. Full TypeScript compilation checks the consumer interfaces but does not replace those integration tests. No full Next production build was run.

No domain semantics, permissions, lineage, extraction, storage or tenant behavior changed, so domain docs were not revised. No visual design pattern was introduced, so the styleguide remains unchanged. This is an internal refactor preserving existing product flows; it uses the project's FigJam exemption for internal refactors. The ownership/cache decision is recorded in ADR-0036 and the local `AGENT_CONTEXT.md` has the new file map.
