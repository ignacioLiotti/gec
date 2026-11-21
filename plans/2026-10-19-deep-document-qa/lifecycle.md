# Generated document lifecycle QA

Date: 2026-10-19  
Starting HEAD: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

## Executable journey

Playwright test:

- `tests/e2e/document-generation/lifecycle.spec.ts`
- `persists a draft and enforces the generated document review lifecycle`

The journey uses the isolated authenticated fixture and the real application routes, database, RLS, Storage, browser UI and Chromium PDF renderer. It does not intercept application requests or replace PDF output.

The test proves this sequence on one persisted document:

1. A tenant member enters a required template value in the browser, saves a draft, reloads the editor and recovers the saved value.
2. The browser generates the document through `POST /api/document-generation/generate`.
3. The response and actor-RLS row must place the configured filename under the seeded obra and exact target folder. The stored artifact downloads as `application/pdf`, begins with `%PDF-`, and contains more than 1,000 bytes. The installed `pdf-parse` package extracts text from the downloaded bytes, and the test independently expects `first persisted draft` in the initial PDF.
4. The author has an explicit `documents:review` deny. A separate member has an explicit `documents:review` grant and a fixture signature. The denied author cannot approve, and an owner from the other fixture tenant receives no document to mutate.
5. The reviewer enters a comment and approves through `/document-generation/review`. Reloading that page shows the persisted comment. The approved PDF differs byte-for-byte from the unsigned PDF, and extracted text contains both the document value and the fixture reviewer's signer label. The approval event carries valid signature metadata, checked without printing its data URL.
6. The author edits the approved document in the browser; the write regenerates the real PDF and resets the persisted state to `UNDER_REVIEW`. Reloading retains the edit, and text extracted from the newly downloaded PDF contains `member edit after approval`.
7. The reviewer enters a reason and rejects through the visible review controls. Reloading the review page shows that feedback. Both direct byte download and signed-URL access return `403` while rejected.
8. The author corrects the rejected document in the browser. The document returns to `UNDER_REVIEW`, and the reviewer approves it again through the UI. The final approved PDF differs from the corrected unsigned PDF and independently contains the correction and signer label.
9. Actor-RLS reads of `generated_document_events` must contain the exact six-event sequence, including every from/to status, decision comment and author/reviewer user ID.

All lifecycle reads after writes use an authenticated actor's RLS client or request context. The service-role client is confined to fixture setup and cleanup.

## Fixture boundary

The journey needs a purpose-named fixture seed that creates only its preconditions:

- an obra in tenant A;
- a materialized extraction table with at least one column and `settings.ocrFolder` matching the returned folder path;
- one active tenant template for `ACT`, with required field `lifecycle_note` and HTML containing `{{lifecycle_note}}`;
- a small fixture-only digital signature for the reviewer profile.

Template setup is not counted as template-management UI coverage. The test uses the template only to exercise draft, rendering, editing, review, access and persistence contracts.

## Evidence and artifacts

Successful runtime execution attaches these screenshots to the Playwright result:

- `draft-recovered-after-reload`
- `rejected-document-editor`
- `final-approved-document`

The runner's normal trace and retained failure screenshot/video remain available under its per-run `test-results` directory.

## Verification status

- `npm run typecheck:tests`: passed after the shared fixture contract was integrated and PDF text extraction was added.
- `npx eslint tests/e2e/document-generation/lifecycle.spec.ts`: passed with no findings.
- `npm exec playwright test -- --list tests/e2e/document-generation/lifecycle.spec.ts`: discovered the single authenticated journey named above.
- Authenticated runtime: the complete strengthened journey passed in the root's final frozen run `7481fcd3-758d-470e-abe6-4746a2983c13`.
- Provider gap: none. The PDF route uses local Chromium and requires no external provider credential. The installed Puppeteer and Playwright Chromium executables were confirmed available by the root QA task before runtime execution.

PDF content is inspected through the shared `tests/e2e/helpers/pdf.ts` helper with the already-installed `pdf-parse` 1.1.4 package. Its untyped CommonJS export is treated as `unknown`, checked to be callable, and its resolved payload is parsed with Zod before the extracted text is asserted. The byte change plus extracted signer label proves that approval replaced the artifact with approval content. The test does not inspect PDF image objects or claim pixel-level proof that the signature bitmap is visible.

The earlier root-owned lifecycle run passed the API-driven version of this journey. The final frozen run passes the stronger reviewer UI, signed-artifact comparison, exact destination and six-event audit assertions. The three passing screenshots are retained under [evidence](evidence/) as decoded copies of their actual result attachments.

Frozen run `f6206f33-4fd6-4dce-ba9a-698816867bf3` reached the first reviewer approval and exposed a Playwright driver condition. The trace records the exact reviewer `PATCH`, then queue and detail `GET` requests with `200`; the failure snapshot shows the approved status, embedded signature, signer label and persisted approval comment. Chromium recorded the PATCH resource with status/time `-1` and no failure, so `page.waitForResponse` never observed the response even though the client completed its success path. The helper now waits for the exact PATCH request body, polls the real reviewer detail API until both status and event comment persist, then reloads and checks the visible comment. That earlier run established the driver diagnosis; the final frozen run now proves the later rejection, correction and complete audit assertions as well.

The final runtime result, manifest, cleanup readback and concrete screenshot paths are linked from [README](README.md). Discovery and type checking are reported separately from the actual database, RLS, Storage and renderer proof.
