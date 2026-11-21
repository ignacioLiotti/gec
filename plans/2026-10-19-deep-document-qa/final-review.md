# Final coverage review

Reviewed snapshot: 791 files, aggregate `a55fd1a6`.

Scope: 13 deep authenticated tests across seven specs.

- `documents/files-and-extraction.spec.ts` (3)
- `documents/folder-navigation.spec.ts` (1)
- `documents/ocr-provider-boundary.spec.ts` (3)
- `documents/ocr-user-flow.spec.ts` (1)
- `document-generation/templates.spec.ts` (3)
- `document-generation/lifecycle.spec.ts` (1)
- `document-generation/recovery.spec.ts` (1)

## Verdict

No material false-green risk remains in the requested folder, file, template, create, edit, approve, reject, retry, and tenant-boundary journeys.

The expected business values come from literal fixtures rather than application responses. This includes uploaded bytes, CSV rows, OCR items, typed template values, rendered PDF text, draft revisions, review comments, state transitions, and event actors. Generated IDs are used as handles for later reads. Those reads cross the API, actor-scoped SQL or Storage, a fresh browser context, or the downloaded artifact.

The custom-template workflow reuses the returned filename when it checks path consistency and the stored row. That does not make the main outcome circular: it independently checks the exact tenant, obra, folder, template, source draft, actor, typed inputs, one-row cardinality, HTML marker, and literal text parsed from the downloaded PDF. The lifecycle workflow separately pins its configured filename to `lifecycle-first persisted draft.pdf`.

## Observable proof

- Folder and file cases compare real Storage objects byte-for-byte, recover the tree in a fresh session, decode the DOCX XML, and verify literal CSV rows through API, RLS, exact count, lineage, and UI readback.
- The stale-folder case delays only a real request and proves the newer selection, file interaction, and both folders in a fresh context.
- OCR cases register literal extraction payloads at the external provider boundary, validate the source SHA-256, MIME type, byte count, safe model path, attempt count, and prompt hash, then check zero rows on failure, persisted processing state, exact rows after retry, stable IDs on reimport, and foreign calls that never reach the provider.
- Template cases create and edit through the UI, read the stored schema and HTML through RLS and a fresh UI, reject missing or invalid typed values, recover the same draft, and parse literal values from the generated PDF. Duplicate, viewer, and known foreign-ID writes have independent absence or unchanged-state checks.
- The lifecycle case drives review decisions through the reviewer UI, checks denied author and foreign decisions leave the document under review, parses unsigned and signed PDFs, denies both rejected download forms, restores editing after approval and rejection, and reads the exact six-event actor audit.
- The delayed-save case continues both requests to the real route, proves the first literal revision reached SQL, preserves the newer visible revision, updates the same draft without duplication, and reloads that revision while the foreign tenant remains unable to read it.

The foreign upload assertion checks the real route's `404` and foreign Storage denial. It does not take a second owner-side Storage snapshot after that request. Source inspection shows the route resolves the obra within the actor tenant and returns before reading multipart data or calling Storage, so this is a hardening opportunity rather than a material gap in the frozen coverage. The invalid-folder upload already has a full before-and-after snapshot of actor-visible write state.

## Declared limits

- The loopback provider proves OCR transport and orchestration. It does not prove live Gemini compatibility or recognition quality.
- DOCX coverage proves valid OOXML bytes, persistence, protected download, and document text in `word/document.xml`. It does not prove rendered preview or Word editing.
- The delayed save proves a same-tab in-flight ordering recovery. It does not cover browser-offline recovery or cross-tab conflict resolution.
- Folder creation starts from an actor-owned normal parent because the current UI has no first-time root-folder creation action.
- These tests cover the named deep document journeys, not the wider product workflow matrix listed in `README.md`.

This was a static review. The root-owned run `c4e28499-9260-421b-bc3b-55aeceba3f2a` was active during review, so this file makes no runtime pass claim.
