# Folder selection async-fix review

Date: 2026-10-19  
Scope: read-only review of `file-manager.tsx`, `useDocumentsStore.ts`, the documents-list route and direct selection callers.

## Findings

### 1. Root-request deduplication can deliver an obra A payload to obra B

Severity: high.

`documentsTreeRequestRef` stores only a promise. `fetchDocumentsTreePayload()` returns that promise for any root request while it is pending, without checking which `obraId` created it. A concrete sequence is:

1. obra A starts a root documents request;
2. the same file-manager instance receives obra B and `resetDocumentsStore(B)` resets the global store;
3. obra B starts its bootstrap root request while A's promise remains in the ref;
4. B receives A's payload;
5. the consumer's new `currentObraId === obraId` check succeeds because both values now identify B, then A's tree is written to B's store and cache.

The store reset effect shows that changing `obraId` on the mounted component is an intentional lifecycle. The payload itself carries no obra identity, so the downstream live-state guard cannot detect this provenance mismatch.

The request ref should be keyed by obra ID and dedupe only when the pending entry belongs to the requested obra. Clearing or aborting the old entry on an obra switch is also sufficient if the consumer still checks the captured request identity.

### 2. A path-scoped refresh can preserve the selected ID while removing that folder from the current tree

Severity: medium-high.

`buildFileTree()` chooses its `?path=` from `selectedAtStart`. After the await it reads the live selection, but it installs the response tree before establishing that the response contains that live folder. The documents-list route builds a path response from the requested branch/current level, not a complete recursively loaded tree.

If a request begins for folder A and the user moves to B before it completes, the A response can replace `fileTree` and the B folder cannot resolve by ID or segments. The fix correctly avoids changing `selectedFolder` back to A, but B remains as a detached object outside the installed tree. A later A response can also overwrite a newer `loadFolderChildren(B)` merge. `refreshOcrFolderLinks()` has the related case that it always requests the shallow root; a nested live selection is not necessarily present in that response.

Before replacing the whole tree, the callback should prove that the response resolves the live selection. If it does not, it should fetch the live path or merge the returned folder into the current tree instead of installing the scoped response wholesale.

### 3. Late null/429 results can mark a different obra as fetched

Severity: low.

The guarded `finally` in `buildFileTree()` prevents a normal late obra A completion from marking obra B fetched. The earlier `!payload` branches in both refresh callbacks still call `markDocumentsFetched()` before checking the current obra. `fetchDocumentsTreePayload()` returns null on a 429 response, so a late rate-limited A request can clear B's loading state and advance B's freshness timestamp.

The null branches should use the same obra guard as the normal response and `finally` paths. This is primarily loading/freshness corruption because `needsRefetch()` still returns true while B has no tree.

## Confirmed properties of the change

- `getDocumentsState()` returns the current module-store snapshot and is typed consistently with the hook's state. The added reads introduce no temporal-dead-zone risk.
- The helper callbacks used by the three changed callbacks are declared earlier in the component. The imported store getter and action setters are stable.
- Removing `selectedFolder`, selected documents and expanded IDs from the callback dependency lists is correct for the new live-read design. It prevents selection changes from recreating `buildFileTree` and retriggering its bootstrap effect.
- `loadFolderChildren()` now merges into the current tree after the await. Concurrent loads of different folders therefore preserve whichever folder completed first.
- `loadFolderChildren()` updates `selectedFolder` only when the requested folder remains selected. A late parent response cannot steal a newer child selection.
- The expanded-folder calculation uses the live expanded set and live focused folder. It no longer collapses navigation to a captured selection.
- The obra guard prevents normal old-obras responses from mutating the new obra's tree, links or selection when the response came from the correct request closure.

## Runtime boundary

Later CDP evidence showed that both observed parent-to-child navigation failures included a page reload initiated by the Next development hot reloader after a build-hash mismatch. Those failures therefore do not isolate the folder race. The provenance and scoped-replacement bugs above are independently established by the source sequences. The next focused runtime pins only the SYNC hash on the owned `/_next/webpack-hmr` connection, forwarding all other frames. Passing navigation establishes user-visible traversal under that stable runtime, but will not exercise the obra-switch request-coalescing sequence unless a test deliberately keeps obra A's root request pending while mounting obra B.

The later pinned-hash run removed that reload and exposed two separate facts. The parent-path API returned `childrenLoaded: true` and included the nested child, so the backend traversal succeeded. Its visible name was the storage slug, while the extraction driver expected a title-cased label; that driver expectation was corrected independently. The UI still ended at the root because `handleFolderClick()` wrote the selection and started its child load before recording its pending URL intent. During that window the URL-to-store effect could observe the old empty `folder` parameter and select the root again. Returning to root had the same defect permanently because an empty pending path was tested by truthiness and therefore treated as no pending transition.

## Implemented repair

The repair remains local to `file-manager.tsx` and keeps the documents-list route and global store contracts unchanged.

- Each response now carries the obra ID and normalized requested path that produced it. Root-request coalescing and the 429 cooldown are keyed by obra, and both are reset when the mounted obra changes.
- Every async consumer checks response provenance and the live store obra before changing tree, cache, links, selection or freshness. A null or 429 result marks the tree fetched only when its captured obra is still current.
- Root and path-scoped responses merge by stable item ID. A folder with `childrenLoaded: true` is authoritative for its direct children. A folder with `childrenLoaded: false` is a partial ancestor and overlays only children present in the response, preserving other live siblings and loaded descendants.
- Folder-child loads also verify the requested path and confirm the requested folder still belongs to the live tree before replacing it. A removed folder cannot become a detached selection through a late response.
- Folder selection records the normalized pending path before changing the store or starting an async child load. The URL synchronization effect distinguishes `null` (no pending transition) from `''` (a pending transition to root), ignores an older controlled path, and acknowledges a non-root transition only after that path resolves in the current tree. This prevents the previous URL from restoring root or another folder while `router.replace()` is pending.
- The automatic OCR upload failure branch now awaits the existing selected-path derived-data refresh. The UI therefore reads the persisted `failed` processing record immediately and can expose the retry control without a page reload. The later shallow-root refresh merges into that loaded branch instead of reverting its per-file status.

This establishes the following contract: async document-list results may mutate UI state only for their originating obra and requested folder scope; responses may replace only levels they declare loaded; selection is rehydrated from the resulting live tree; persisted OCR failure is the source of the visible failure and retry state.

## Verification after implementation

- `npm run typecheck:ui`: passed.
- `npm exec eslint -- "app/excel/[obraId]/tabs/file-manager/file-manager.tsx"`: passed with zero errors. The large existing component still reports 42 warnings; none points to the added merge, provenance checks or OCR failure refresh.
- `git diff --check -- app/excel/[obraId]/tabs/file-manager/file-manager.tsx plans/2026-10-19-deep-document-qa/folder-selection-review.md`: passed.
- `npm run typecheck:tests`: passed after adding `tests/e2e/documents/folder-navigation.spec.ts`.
- `npx playwright test tests/e2e/documents/folder-navigation.spec.ts --list`: passed and discovered one authenticated test.
- Focused ESLint over the component and navigation spec: zero errors. The component's same 42 existing warnings remain.
- Repository-wide `npm exec tsc -- --noEmit --pretty false`: initially found the existing `portfolio-guide/guide.tsx` raw-import error plus new tooling-test environment override types. Root corrected the new helper to accept partial environment overrides and reran it; only the portfolio error remains in `typecheck-full.txt`. The UI-specific TypeScript project covers the edited component and passed.

The new browser regression retains a real `GET /documents/list?path=<alpha>` response, navigates through the visible UI to root and folder Bravo, then releases Alpha's response. It checks that Bravo and its file remain current, opens the visible Bravo file and requires its sheet heading, then verifies both folders from a fresh actor context. The route handler forwards the real request and waits for `route.continue()` to finish before unregistering interception.

The root-owned run `16894ba6-5d2f-4b8e-b6bd-b47590e95ca0` passed fresh parent-to-child extraction traversal; its second case failed on an obra-setup connection reset before navigation. The independent fresh run `5f5ab628-88fe-4a90-9248-0222c6b3531c` then passed the delayed response, file-sheet interaction and fresh context 1/1. The first complete frozen run `c4e28499-9260-421b-bc3b-55aeceba3f2a` passed both navigation cases again and 48/49 overall, with its only failure being another setup connection reset. The final regression after the fixture transport repair is authoritative in the root report. The merge assumes documents-list IDs remain stable for a storage path, which is the current route contract. Concurrent responses for the same loaded folder remain last-completion-wins; no write request is issued by these reads, and changing that policy would require request generations beyond this focused repair.
