# OCR provider boundary QA

## Scope

This slice exercises the application OCR route against the owned loopback provider while leaving the application route, Storage, SQL, authentication, and tenant policies real. The provider fixture controls only the external Gemini boundary. It proves request transport and persistence behavior; it does not prove Gemini extraction quality.

Source revision: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`.

Document fixtures:

- PNG: 68 bytes, SHA-256 `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460`
- PDF: 595 bytes, SHA-256 `afedfb792f8f182a09427319335d3107fe02c55c6813a51f38d2a6202a353e31`

## Durable journeys

`retries a real PNG OCR provider outage and reimports with stable persisted identity`

- Creates an isolated obra and typed OCR table through `scenario.lineage.createSingle`.
- Reads the table folder through the owner's RLS client and uploads real PNG bytes through `/documents/upload`.
- Registers the exact source hash, MIME type, extraction, and one synthetic provider failure.
- Requires the first real `/ocr-multi` call to return 503 with `OCR_PROVIDER_UNAVAILABLE`, leave rows empty, and record failed processing for the stored path.
- Retries successfully, verifies two typed rows and completed file/content fingerprints, then reimports the same path and verifies stable IDs, two rows rather than four, and incremented materialization versions.
- Verifies exact provider metadata without retaining the prompt or source bytes.
- Checks the foreign tenant before and after owner processing: API 404, empty row/processing queries, denied Storage read, and no provider request.

`imports and reimports a stored PDF through the real OCR provider boundary`

- Repeats the owned upload and tenant boundary with real PDF bytes.
- Verifies successful typed persistence, completed fingerprints, stable IDs, incremented versions, and exactly two provider calls across the initial import and reimport.

`retries a real single-table PDF provider outage and persists the extracted rows`

- Calls the stored-document `/tablas/[tablaId]/import/ocr` route with a provider response shaped as `{ items }`.
- Requires the provider outage to remain an API 503 with `OCR_PROVIDER_UNAVAILABLE`, verifies the failed processing record and zero rows, then retries and verifies two real persisted rows and completed fingerprints.
- Covers the single-table provider adapter separately from the multi-table `{ tables }` response contract.

The helper validates that control traffic belongs to an authenticated owned run: local mode, UUID run and token, derived project ID, owned manifest path, running status, and identical loopback provider URL. Every registration is deleted in `finally`.

## Verification

- `npm run typecheck:tests` — passed.
- `npm exec eslint -- tests/e2e/helpers/ocr-provider.ts tests/e2e/documents/ocr-provider-boundary.spec.ts` — passed.
- `npm exec playwright test -- --list tests/e2e/documents/ocr-provider-boundary.spec.ts` — passed; three authenticated tests discovered.

All three journeys passed in the final frozen run `7481fcd3-758d-470e-abe6-4746a2983c13`. The separate visible-upload/retry case also passed. These are real route/Storage/SQL/RLS results with a synthetic external Gemini response. Final cleanup, input hashes and detailed boundaries are recorded in [README](README.md).

## Provider outage classification

The initial review found that the OCR routes discarded the upstream 503 and classified only phrase-matched demand as `OCR_PROVIDER_HIGH_DEMAND`. The runtime contract keeps that phrase-specific classification and uses `OCR_PROVIDER_UNAVAILABLE` for a generic upstream 503. These tests preserve that distinction for both single- and multi-table routes. Product source remains outside this slice.
