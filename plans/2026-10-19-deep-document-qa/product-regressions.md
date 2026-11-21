# Product regressions exposed by durable document tests

The failures below came from actual Next routes and actor sessions on an owned disposable stack. The final frozen run `7481fcd3-758d-470e-abe6-4746a2983c13` passes all 49 cases, including all thirteen deep cases. [README](README.md) links the actual result, artifact and cleanup evidence.

## Template creation loses entered data during initial loading

- Evidence: run `1f28e109-6fa9-4d5e-b7f6-4e0ec8fd0920`, template UI trace. The catalog GET started at 61513.085 ms and completed around 63858.8 ms; the folder trigger was clicked at 61763.954 ms. It initially offered only the empty-folder option, then the catalog response closed/reset the form. The final screenshot contains only the default cards.
- Cause: the catalog load resets creation state while `Nuevo tipo` remains available during that same load.
- Repair: the existing button is disabled while its owning `loading` state is true. The test deliberately holds the actual GET, verifies the disabled state, then continues to the real backend before creating the template.

## A persisted import is reported as an empty table

- Evidence: the same run's `table-count-boundary` attachment records API summary 0 and exact actor-visible count 2. The aggregate query returns `PGRST100`: `failed to parse select parameter (tabla_id,row_count:count(id))`.
- Cause: the list route uses an unsupported aggregate expression, ignores the error and falls back to zero.
- Repair: exact HEAD counts scoped to each authorized table; errors propagate instead of becoming empty results. This uses one count request per table and makes no performance improvement claim. No global PostgREST configuration, database schema or permissions change is needed.

## OCR loses the link to an already uploaded source

- Evidence: the PDF OCR route succeeds and persists both literal item rows, but their data lacks `__docBucket`, `__docPath` and `__docFileName` despite the stored source request. The provider received the registered PDF bytes.
- Cause: both OCR routes call source upload even when processing `existingPath`; with no new file/data URL, that helper returns null and overwrites the valid existing Storage association.
- Repair: upload only for new file/data-URL input. Existing source association remains available for row linkage, processing state, fingerprints and reimport reconciliation. Existing uploads are not charged or uploaded again.

## Temporary provider failure becomes an internal error

- Evidence: the registered PNG provider returns a real HTTP 503; the application returns HTTP 500. The test retains the expected retryable 503 rather than accepting the incorrect result.
- Cause: the raw provider adapter throws an untyped message and discards its HTTP status; only specific high-demand wording is recognized downstream.
- Repair: classify generic provider 503 as `OcrProviderUnavailableError`, return/persist `OCR_PROVIDER_UNAVAILABLE` with HTTP 503, and retain the existing phrase-specific `OCR_PROVIDER_HIGH_DEMAND` behavior. Apply this to both single- and multi-table imports. The operations projection recognizes the bounded new code.
- The single-table test additionally exposed inner extraction catches that turned this recognized outage into HTTP 422. Recognized processing failures now reach the existing outer classifier; ordinary unprocessable extraction retains its existing 422 contract.

## Empty Storage folders disappear from the lightweight document view

- Evidence: run `f6206f33-4fd6-4dce-ba9a-698816867bf3`, data-folder test. The owner successfully uploads the normal parent's real `.keep` marker before navigation, but the actual browser shows only the configured `Documentos E2E` folder. The lightweight root response never lists Storage; nested responses also skip listing whenever any tracked file is known.
- Cause: the read model treats configured/tracked paths as a complete inventory, although normal folder creation persists only a Storage marker. Empty folders and untracked siblings therefore disappear from this view.
- Repair: merge metadata fallback files with one immediate Storage listing for the requested level, including root. Descendant folders remain lazy; no recursive tree scan or extracted-row payload is introduced. The tests require parent and newly created child folder visibility through the actual lightweight API and a fresh browser context.

## Late folder reads and URL synchronization can replace current navigation

- Evidence: runs `bc46` and `d5da` preserve root/child failures. The latter still fails after the HMR reload is removed: the API returns the correct loaded parent and extraction child, while the browser shows root. `folder-navigation.spec.ts` also exposes a move away from an outstanding folder load.
- Cause: the URL-to-store effect can apply the previous controlled folder before a click registers its pending destination. Returning to root also used an empty, falsy path, so that intent received no protection. Separately, request coalescing lacked obra identity and shallow responses could replace already loaded branches.
- Repair: register the click's destination before synchronous store writes, distinguish an empty pending root path from no pending intent, and acknowledge the intent only after the controlled path resolves. Async reads retain their obra/path provenance and merge partial ancestors while preserving loaded siblings. A delayed real folder response test must leave the newer folder usable, including opening its file, then recover it in a fresh context.
- Boundary: the delayed same-obra navigation case does not prove an obra prop switch inside a still-mounted component. That provenance repair is source-reviewed; tenant API/RLS denials are tested separately.

## Automatic OCR failure stays visually pending until reload

- Cause: upload inserts a pending local file, but the failed import branch did not read the persisted failure back into the tree.
- Repair: await the existing selected-folder derived-data refresh after the failed OCR response. The UI regression requires `Error OCR`, the document failure state and `Reprocesar OCR` without a reload. The retry must persist the exact two provider-fixture items and render both in a fresh context.
- Runtime: `d5da87ec-8fad-417a-8b42-d01f7115f08b` passes this complete case.

## Documentation and limits

- Domain: `docs/obsidian-brain/18 - OCR Pipeline.md` records source association, retry classification and exact count behavior. `10 - Documents & File Manager.md` records the actual Storage path, lightweight reader and scoped navigation contract.
- Architecture: ADR 0039 records the owned test-only provider transport. Product repairs retain the existing architecture and require no separate ADR or migration.
- Design system: no token, styling or primitive contract changes; the template loading gate uses the existing disabled button state.
- FigJam access was already exhausted in this session. The Product OS board `NDzN30GN3koTteiTdkgV3P`, data journey board `8dX4sV8kJYDwf1qa1jY5zb`, and document journey board `nnPSyRwgsNseS3cm9BIMTp` still need the verified template loading gate, actual imported row count, preserved existing-source association, empty-folder visibility, stable navigation during a delayed read and immediate provider failure → retry branch. Add the final sanitized screenshots and passing run reference; do not mark this visual update complete from local files.

Tests also document an existing product limitation: folder creation is reachable through the legacy normal-folder context menu. The current tests prepare a normal parent explicitly, then create the tested child through the real UI. They do not prove first-time root-folder creation or the newer document screen's creation affordance.
