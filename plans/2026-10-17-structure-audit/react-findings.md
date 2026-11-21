# React findings

Review used local contexts, the read-only React readability workflow, direct consumers, and actual-source isolated reproductions. Product files were not edited. Mechanisms below predate the inspected visual diffs.

## F01 Fresh rows with stable IDs

`components/form-table/form-table.tsx:2580` skips clean-table synchronization when `hasSameRowIdentity` at `:1889` sees the same IDs/order. Changed cell values are ignored. The real document consumer passes query rows at `app/excel/[obraId]/tabs/documents-new-tab.tsx:891` and `:1727` with a key based only on table identity, then refetches after reprocessing at `:1438`.

The proof extracts the actual function/effect from the AST and supplies updated same-ID rows. It observes zero setter calls. Define one applied-data version and dirty baseline contract. Clean tables adopt external values; dirty tables preserve edits or expose a deliberate reconciliation rule. Verify stable IDs, reordered/new/deleted rows, unsaved edits, save, and refetch.

The existing sibling table refactor retains this defect at `multi-tenant-form-table/components/form-table/table-editing.ts:123`. Reuse its decomposition after review and correct the behavior rather than treating fewer lines as proof.

## F02 Blob download and lifetime

`app/excel/[obraId]/tabs/file-manager/cache.ts:94` and `:102` have no pending-promise deduplication. A second completion replaces the cached URL and revokes the first at `:144`. Active consumers include `components/file-thumbnail.tsx:100`, `:180`, `components/ocr-document-source-cell.tsx:149`, `:161`, and file-manager preview loading at `:1767` and `:1794`.

The proof starts two requests before releasing fake fetch responses. It observes two downloads and revocation of the first returned URL. `clearCachesForObra` also leaves the blob entry present. A TTL checked only on lookup does not bound resources that are never looked up again.

Use one pending operation per owned file and explicit invalidation/lifetime behavior. Include obra blobs in invalidation. Verify a preview with an active thumbnail, invalidation during fetch, file replacement, deletion/restoration, and eventual URL release. No browser memory profile was captured.

## F03 Response ownership across obra navigation

`file-manager/hooks/useDocumentsStore.ts:62`, `:70`, and `:110` expose one singleton store and setters without an obra identity. File-manager resets the store for a new obra but delayed loaders can still apply previous results at `file-manager.tsx:1240`, `:1353`, and `:1445`.

The code permits A to start loading, B to reset the singleton, and A to complete and replace B's tree/selection/links. This is a static race finding; a real navigation reproduction remains outstanding. Add response ownership/generation checks and cancellation before changing the storage model. Later use the existing query cache for remote tree data and keep selection as identifiers. `refreshOcrFolderLinks` and `buildFileTree` already repeat reconciliation and should share one accepted-response boundary, not forwarding hooks.

Verify delayed A after B, return to A, aborts, removed selections, and selection after refresh. Do not describe a client display race as a proven cross-tenant data exposure.

## F09 and F10 Remove inactive work

`lib/use-prefetch-obra.ts:45` fetches pendientes into a query key with no observed subscriber. The hook is live in `components/excel-obra-name.tsx:149`, `components/app-sidebar.tsx:284`, and obra row links. Remove only the unused pendientes prefetch after a full reference check; obra and memoria prefetches have consumers. The directly supported saving is one redundant request for a nonfresh prefetch, not a measured latency reduction.

`file-manager/hooks/useSelectionStore.ts:46` duplicates tree/selection without observed imports. `useDocumentsStore.ts:160` exports another prefetch path disabled by `DOCUMENTS_TREE_PREFETCH_ENABLED=false` at `:158`, also without observed callers. Remove the inactive owners and update the local context that still describes them. Verify references, typecheck, navigation, selection, and refresh.

Keep both `documents-tab` and `documents-new-tab`, which remain mounted and exposed in tab navigation. Keep the progressive desktop full/preview pair.

## F15 Detail warmup policy

`app/excel/[obraId]/page-client.tsx:1857` loads four secondary tab modules and launches six queries after General is ready. The work happens even when the user remains on General. It deliberately trades background resources for faster tab changes.

Measure the proportion of prefetched data/modules actually consumed, bytes, requests, and tab transition behavior. Only then choose a smaller warmup set or intent-driven loading. Avoid claiming every eager import is a defect or promising a speedup without measurements.

## Existing table refactor

`multi-tenant-form-table` separates editing, fetch, columns, navigation, and visual regions. Its public contract and new tests are useful starting evidence. Evaluation and row-model caches depend on immutable row, column, and predicate references. Review those assumptions, execute its isolated tests, reconcile current visual changes, and fix F01 before integration. Its suite and complete integration were not validated in this audit.

## Coverage

Inspected shell/query-provider ownership, responsive Excel entry, desktop rows/configuration, detail query warmup, both document tabs, file-manager store/cache/bootstrap/preview, FormTable hydration/fetch/dirty tracking, and direct consumers. Individual renderers and every dialog in the largest files were not exhaustively reviewed.
