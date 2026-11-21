# Independent coverage review: deep document QA

Source HEAD: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

This review describes the initial test implementation. Integration subsequently addressed findings 1, 2, 5 and 6 with reviewer UI decisions, signed-PDF text/byte evidence, exact destination checks, custom-template PDF generation and a six-event actor audit. Finding 3 was fixed within this review. Finding 4 produced the exact-count route repair. Final runtime status for those changes is authoritative in [README](README.md); the original findings below remain as the decision trail.

Reviewed:

- `tests/e2e/documents/files-and-extraction.spec.ts`
- `tests/e2e/document-generation/templates.spec.ts`
- `tests/e2e/document-generation/lifecycle.spec.ts`
- `tests/e2e/document-generation/recovery.spec.ts`
- `tests/e2e/fixtures/document-generation.ts`

## Findings

### 1. Approval and rejection do not exercise the reviewer UI, and approval can pass without proving that the signature reached the PDF

Severity: high.

The lifecycle test performs every decision through `reviewer.request.patch` (`lifecycle.spec.ts:185`, `:214`, and `:263`). It opens `/document-generation/review` only after the final approval and asserts only the already-decided message (`:282-285`). A broken review form, missing comment submission, disabled Approve/Reject controls or a client-side permission bug would not fail this test.

The fixture writes a synthetic signature (`fixtures/document-generation.ts:54-61`), but the PDF assertion only checks that the response is a PDF and contains the document note as text. The final assertion at `lifecycle.spec.ts:274-280` would still pass if approval updated SQL but failed to replace the stored PDF with the signed version. The production approval path explicitly renders and uploads a signature, so this is an observable contract. A durable check should compare the PDF bytes before and after approval and verify the approval event carries signature metadata without logging the data URL; a renderer-level image assertion would make the proof stronger.

### 2. Generated-document destination and filename are accepted from the response instead of checked against the requested folder

Severity: medium.

`generatedResponseSchema` requires only non-empty `storage_path`, `relativeFolderPath`, `relativeFilePath` and `file_name` (`lifecycle.spec.ts:16-29`). Later downloads use the returned or persisted path (`:165-171`, `:205-211`, `:274-280`). If generation wrote a correct PDF under the wrong obra or folder, the lifecycle could remain green. It should assert the relative folder equals the seeded target and the Storage path begins with `${obraId}/${folderPath}/`; the filename should also reflect the configured pattern.

### 3. The invalid-upload side-effect blind spot was corrected within actor-visible boundaries

Status: corrected in the reviewed spec; runtime rerun pending.

The upload recovery case originally submitted an unrelated UUID prefix and checked only the 400 response. It now snapshots the obra's actor-visible Storage listing, document tree, upload metadata filenames/paths and table row counts before the invalid request and requires the same snapshot afterward (`files-and-extraction.spec.ts:337-360`). This prevents the error response from hiding writes on the owned obra surfaces. The normal successful uploads, generated PDFs, tenant rows, templates and actor contexts are covered by scenario cleanup.

### 4. The first owned-stack run exposed a real table-summary boundary failure

Severity: medium until the route fix is verified.

Run `efe9e445-75b5-4c0d-a6b2-6204427addb0` reported `inserted: 2` from the real spreadsheet commit but `/api/obras/:id/tablas` returned `rowCount: 0`. The test previously stopped at that summary assertion and did not show whether rows were durable. It now reads the row endpoint, direct actor-RLS rows and an exact head count before checking the summary, and attaches `table-count-boundary` with the aggregate-query error code/message (`files-and-extraction.spec.ts:486-543`). This separates import persistence from the summary aggregate. The final owned-stack rerun must show both exact count and summary count equal 2 before this behavior is considered covered.

### 5. A UI-created and edited template is never used to emit a stored document

Severity: medium.

The template workflow proves configuration persistence, fresh-session recovery, typed controls, validation, client preview and a stored draft (`templates.spec.ts:243-379`). After valid input it clicks `Guardar borrador`, not `Generar documento` (`:342-371`). The lifecycle test emits real PDFs, but its template is inserted directly by the fixture and has one text field. A server-side incompatibility affecting the UI-created typed schema or HTML could pass both suites. One focused generation from the edited template should assert the stored PDF contains its title, amount, date and selected value.

### 6. The review-event assertion is existential rather than a lifecycle audit

Severity: low.

The lifecycle reads detail after rejection and checks that at least one event has the rejection status and comment (`lifecycle.spec.ts:241-250`). It does not verify the approval events, the transition origins, the reopen transitions or event ordering. Duplicate or missing audit events outside that single rejection could pass while the status assertions remain green.

## Requested behavior mapped to independent evidence

| Requested behavior | Test evidence | Independent observation | Assessment |
| --- | --- | --- | --- |
| Create an extraction folder | A normal parent is seeded with real owner Storage, then the user-visible legacy context menu and data-folder dialog create the tested child; persisted table/column/settings, pipeline response, real `.keep` bytes, fresh UI and foreign denial are checked | API schema and Storage are read independently from the success dialog | Strong design; final runtime rerun needed |
| Create a normal folder | A normal parent is seeded with real owner Storage, then the visible legacy context menu and normal-folder dialog create the tested child | Fresh tree and fresh UI read the folder and files | Strong design; final runtime rerun needed |
| Upload PNG, PDF, text and DOCX | One visible file chooser uploads all four; each exact Storage byte sequence is downloaded; DOCX `word/document.xml` is decoded; fresh tree/UI reload; PDF and DOCX product-route downloads; foreign route/Storage/upload denial | Storage bytes, ZIP content, product download and fresh-session tree do not depend on the upload toast | Strong for upload and persistence; it does not claim DOCX preview or editing |
| Parse and persist data | Stored CSV is previewed and committed through the real spreadsheet route; row endpoint, direct actor-RLS query, exact count, lineage and fresh UI are checked | Independent API and SQL reads prevent a success response from proving persistence by itself | Strong once the row-summary regression passes the final rerun |
| Recover after invalid input | Unsupported spreadsheet returns 400 and leaves zero direct actor-RLS rows; invalid upload leaves actor-visible Storage/tree/metadata/table surfaces unchanged; invalid template leaves no matching template; typed draft is corrected in place | Post-failure state is inspected instead of inferred from the status | Strong design; final runtime rerun needed for the updated file flow |
| Create and edit templates | Owner creates through the config UI, edits name/JSON/HTML, reads the tenant row and reopens it in a fresh context | Direct RLS-backed SQL and fresh UI agree on the same configuration | Strong for configuration, partial for generated output |
| Create a generated document | Author saves a draft, reloads, generates through UI, reads SQL and parses real PDF text | PDF access and SQL are independent of the generate response | Strong, subject to the destination-path gap in finding 2 |
| Edit generated documents | Author edits an approved document and a rejected document through UI; each returns to review, persists and produces updated PDF text | Actor DB and downloaded PDF confirm the edit | Strong |
| Approve and reject | Reviewer API transitions status; rejection comment event, download denial, corrected resubmission and final state are checked | SQL, event detail and access route corroborate backend state | Backend coverage is strong; reviewer UI and signed-PDF proof are missing |
| Recover from a delayed save | `recovery.spec.ts` holds only the outbound draft POST, continues it to the real route, preserves the newer edit, reads both revisions through actor RLS, updates the same ID and reloads | Exact request bodies, SQL state, foreign invisibility and reload all agree | Strong for same-tab request ordering; no application response is mocked |

## Remaining coverage gaps

- **Image/PDF OCR quality:** the file workflow proves upload bytes only. None of the reviewed specs asks the real OCR provider to interpret the uploaded image or PDF. Provider-bound orchestration may be tested separately with a transparent local transport, but extraction quality still requires a real provider evaluation set.
- **Cross-tab concurrency:** delayed recovery uses one page. There is no proof for two tabs editing the same draft, stale writes across sessions or one tab observing another tab's saved revision.
- **Offline recovery:** there is no browser-offline failure/retry test. The delayed-transport test covers response ordering, not a failed request and explicit reconnect.
- **DOCX preview/rendering:** a valid OOXML DOCX is now uploaded, reloaded, downloaded byte-for-byte and decoded. The file manager's DOCX preview and any document editing behavior remain outside this slice.
- **Reviewer UI:** approval, rejection, feedback entry and missing-signature errors are not driven through visible controls.
- **Custom-template artifact generation:** typed UI-created template HTML is previewed and drafted but not rendered into a stored PDF.

## Runtime and static evidence

The first root-owned run, `efe9e445-75b5-4c0d-a6b2-6204427addb0`, produced two passes and four failures across the files/templates batch. Its file snapshot showed **Documentos Legacy** and proved the test's invented `Carpetas`/top-level `Crear` path did not exist. Source inspection found the real reachable creation flow: a context menu on a normal folder in the legacy manager. Because the seeded `Documentos E2E` folder is OCR-enabled and forbids children, the revised test creates a real Storage-backed normal parent as an explicit precondition, then right-clicks that visible parent and creates the tested child through the product dialog. The CSV failure exposed the table-summary count boundary described above. The template selector failure was a strict locator ambiguity and was corrected by the owning agent.

After the DOCX and diagnostic changes:

- `npm run typecheck:tests -- --pretty false` — passed.
- `npm exec eslint -- tests/e2e/documents/files-and-extraction.spec.ts tests/e2e/documents/files-and-extraction-fixtures.ts` — passed.
- `npm exec playwright test -- --list tests/e2e/documents/files-and-extraction.spec.ts` — passed; three authenticated tests discovered.
- `git diff --check -- tests/e2e/documents/files-and-extraction.spec.ts tests/e2e/documents/files-and-extraction-fixtures.ts` — passed.

The initial review and failed-run evidence above are retained as the decision trail. The final frozen run `7481fcd3-758d-470e-abe6-4746a2983c13` passes all three file workflows and all thirteen deep cases; [final-review.md](final-review.md) records the completed independent review. The final persisted/artifact observations, cleanup and source hashes are authoritative in [README](README.md).
