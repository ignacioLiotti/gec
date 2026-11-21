# Deep document QA: visible OCR recovery

Source HEAD: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

## Covered journey

`tests/e2e/documents/ocr-user-flow.spec.ts` exercises the legacy Documents screen with an owner actor. A scenario fixture creates the obra, one OCR table and its columns as preconditions. The test registers the deterministic provider response before the browser upload because the product starts OCR automatically.

The user opens the OCR folder, uploads a real PNG with the visible file chooser and receives the real 503 provider message. The route and Storage remain real: no application response is fulfilled or mocked. The test proves there are no tenant-visible rows after the failed attempt, reads the persisted failed processing record, and downloads the exact PNG bytes from actor-scoped Storage.

Without reloading, the user opens the failed document, sees its OCR failure state and clicks **Reprocesar OCR**. The second real route call succeeds. Actor-RLS reads prove that two rows, lineage keys, extraction IDs, source metadata and completed processing state persisted. A fresh owner context opens the table view and renders both returned rows.

## Provider boundary

The owned loopback provider substitutes only the external Gemini transport. Its control state must record exactly two calls for the registered source: attempt 1 fails, attempt 2 returns the deterministic extraction. Both calls must carry the PNG SHA-256, MIME type, byte length, model endpoint and the same prompt hash. This proves application upload, orchestration, validation, persistence and retry behavior; it does not evaluate OCR interpretation quality.

## Verification status

The following static checks passed:

- `npm run typecheck:tests -- --pretty false`
- `npx eslint tests/e2e/documents/ocr-user-flow.spec.ts`
- `git diff --check -- tests/e2e/documents/ocr-user-flow.spec.ts plans/2026-10-19-deep-document-qa/ocr-ui.md`
- `npx playwright test tests/e2e/documents/ocr-user-flow.spec.ts --list` — one authenticated test discovered

The complete visible journey passed in the final frozen run `7481fcd3-758d-470e-abe6-4746a2983c13`, including the failure badge and direct retry without reload, both provider calls, exact source bytes, persisted failure/completion and fresh-session table values. [README](README.md) records final cleanup and unchanged source inputs.

Source inspection found a presentation lag: after automatic OCR failed, the locally inserted file node remained `pending` because the upload error branch did not refresh the derived file tree. Root integrated the existing refresh path into that failure branch. The test now requires the persisted `Error OCR` badge and direct retry control without a reload. The failed processing count is the actual initialized zero, and row comparison is ordered by the business item code rather than an opaque lineage hash.

No production code, schema, dependency, shared fixture or runtime script is changed by this slice.
