# Document generation state machine pilot

Status: Implemented and verified locally. Branch: `codex/structure-improvements-2026-10-17`. No commit or deployment.

The authorized pilot gives document-generation operations and draft persistence explicit ownership. It must preserve existing user edits while requests complete, discard stale responses after a context switch, and generate the saved revision intended by the user.

## Scope

The product entry is `app/document-generation/page-client.tsx`. Keep persisted document lifecycle and permissions authoritative on the server. Preserve purchase-order-only autosave, the existing debounce, draft recovery and URL identity, generated-document editing and review status, inline focus/caret behavior, and existing visual components. Add no runtime dependency, database migration, or server API change.

The repository already contains extensive unrelated local work. A copy of the inherited page, its Git diff, source hashes and status baseline are retained in `%TEMP%/multi-tenant-generation-machine-2026-10-17/`. Do not commit, push, or replace the design worktrees.

## Work sequence

1. Ground current request, content, revision, and identity ownership in code and ADRs.
2. Compare two independent designs: a complete editor session reducer and a smaller operation/persistence machine.
3. Choose the smallest design that owns admission, stale-result checks, content revisions and draft write ordering together.
4. Implement through one assigned writer and replace obsolete flags/refs.
5. Run transition and deferred-request regressions, existing document-generation tests, type/lint/UI checks, and a local runtime harness using the real component.
6. Independently review the integrated diff and record documentation/visual-map changes or precise outstanding gaps.

## Acceptance

- A save of revision 1 never replaces or marks revision 2 saved.
- Context A success, failure, or completion never changes context B.
- Autosave, explicit draft save, assistance, and generation have deliberate admission rules rather than independent busy flags.
- Generation with an existing draft waits for the intended content to be persisted, because the server reloads draft contents instead of trusting request input.
- Switching templates preserves the existing draft identity and avoids overlapping writes to it.
- Retry preserves content and does not create an unbounded automatic retry loop.
- Inline editing retains the DOM node/caret contract and validation behavior.

## Design criteria

Prefer a small semantic API that owns a complete behavior, removes synchronized state, keeps independent concepts separate, and can be verified through observable results. Reject forwarding wrappers, global caches, a generic state-machine framework, and refactoring unrelated catalogs or document renderers. Machine-only tests must be complemented by actual request-ordering and component/runtime evidence.

## Design selection

Two independent source-grounded proposals were compared. Candidate A owns the full editor, including bootstrap/catalog loading and source lifecycle. Candidate B owns input revisions, draft identity and persistence operations while leaving catalogs and presentation local. An independent design review selected B, with context/template activation and assistance integrated into operation ownership.

The selected machine must keep request admission, immutable snapshots, revision acknowledgment and the physical write sequence together. Context invalidation rejects obsolete UI results but never releases an unresolved write. Generation holds ownership across draft save and the subsequent generate request, since the API reloads persisted draft input. Inline keystrokes advance edit ownership even before blur, while retaining the existing DOM buffer and focus behavior.

Candidate A's full loading/catalog reducer was rejected as unnecessary scope for the pilot. B's original assistance-outside-the-machine boundary was rejected because it leaves a second writer of input. No new machine library is needed.

The runtime fixture mounts the real client in Storybook with synthetic API responses. `next-dev-loop` is inapplicable at the installed Next 16.2 dependency floor because that workflow requires 16.3. No dependency upgrade is part of this pilot.

## Implemented behavior

`editor-session.ts` owns one immutable input snapshot, revision acknowledgments, draft identity and the current operation. The page subscribes through `useSyncExternalStore`. Save, assistance and generation share admission and a serialized request queue. Catalog loading, server lifecycle and presentation stay in the page.

Inline native input events advance the session before blur. Memoized inline markup retains the actual DOM node and selection through request completion. Obsolete saves cannot replace newer content. Late assistance and validation responses are discarded when their input revision has changed. Template selection waits for bootstrap to finish so it cannot retain another context's sequence or label.

## Verification

| Check | Result |
| --- | --- |
| `npm test -- --run` | 38 files, 233 tests passed, including 15 editor-session tests |
| `npm run typecheck:ui` | Passed |
| `npm run typecheck:storybook` | Passed |
| Targeted ESLint over the six pilot source/test/runtime files | Passed, zero diagnostics |
| `npm run check:ui` | Passed, 1112 controls |
| `npm run test:document-generation:runtime -- http://127.0.0.1:6017` | Nine browser scenarios passed under React Strict Mode |
| Independent integrated review | One missing command-success return found, corrected, and verified by controller tests and generated-file UI/success-toast assertions |
| Inherited tracked changes | All 132 baseline files preserved except the two authorized pilot targets, `page-client.tsx` and `package.json` |

The browser check drives the real client under React Strict Mode and delays synthetic API responses. It covers draft recovery, rejected generated-document editing, focused typing during autosave/manual save/assistance, generated artifact content, template write ordering, bootstrap loading and obsolete-context failure suppression. Recovery must create no draft POST, and an explicit delayed save must create exactly one. The generated-file UI and success toast must also appear. Final output and run context are retained in [runtime-after.json](runtime-after.json); source hashes and checks are in [verification.json](verification.json).

The earlier runtime run reproduced lost focused edits and generation from an older draft. Its output is retained in [runtime-before.json](runtime-before.json); the inherited page snapshot remains in the temporary baseline directory. Browser assertions were strengthened during implementation, so the before and after files describe their respective runs rather than identical test suites. The final browser run reports no page errors. Its only failed HTTP resource is Storybook's missing `/favicon.ico`.

Controller tests cover the later autosave of edits preserved during an operation; the browser scenario verifies preservation and focus rather than waiting for a second autosave. No authenticated Next route, real database, storage write, external assistance or PDF renderer was exercised. Full-repository lint and default TypeScript debt are documented by the preceding structure audit; this pilot does not claim those checks pass.

`docs/supabase-backup.md` changed independently during verification. It was not read or edited by the pilot. Its concurrent changes were preserved.

## Documentation and visual map

- Architecture and tradeoffs: ADR 0037.
- Domain behavior: `docs/obsidian-brain/10 - Documents & File Manager.md`.
- Local ownership and verification: `app/document-generation/AGENT_CONTEXT.md` and `scripts/AGENT_CONTEXT.md`.
- Product styleguide requires no update because visual components and tokens did not change. Busy/loading controls now reflect the session's admission rules.
- [Product OS](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P), document-flow cell `T1:56;1:4;1:9`, updated for revision save before generation.
- [Journeys 03](https://www.figma.com/board/nnPSyRwgsNseS3cm9BIMTp), nodes `1:33`, `1:42` and `1:45`, updated for revision autosave, edit preservation and ordered generation. Both boards label the work as a local pilot dated 17 October 2026. No new screen or material visual redesign requires a screenshot-board update.
