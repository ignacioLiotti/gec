# Deep document QA: files and extraction

Source HEAD: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

## Scope

This slice adds three independent authenticated Playwright journeys in `tests/e2e/documents/files-and-extraction.spec.ts`. They use the run-owned actor sessions, local Supabase Storage, Postgres/RLS and real Next routes. No application endpoint is mocked, no stored object is fabricated after upload, and service-role access is not used by the test.

1. **Extraction-folder creation and schema recovery** drives the product UI to create a manual extraction folder backed by the automatic spreadsheet template. A fresh owner session independently reads the persisted table, columns and folder extraction-pipeline projection. The test also downloads the real `.keep` object as the owner and checks that the other tenant cannot inspect the extraction contract.
2. **Image, PDF, DOCX and text upload persistence** first proves an invalid destination is rejected without changing actor-visible Storage/tree/upload metadata/table counts, then recovers by creating a normal child folder and uploading four deterministic files through its visible product action and browser file chooser. It compares every downloaded Storage object byte-for-byte with the local fixture, reloads the file tree in a fresh session, downloads the PDF and DOCX through the product access route, decodes the DOCX XML, and proves both the route and Storage RLS deny the foreign tenant. It also checks that the foreign tenant cannot upload into the known obra prefix.
3. **Spreadsheet parsing and persistence** stores an unsupported text source, proves the real parser rejects it, then recovers with a known CSV. Preview and commit both download the source from real Storage and run the production spreadsheet parser. A fresh owner session reads the two expected rows, document linkage, lineage keys and extraction IDs, and renders those values in the product table. Foreign API import/read and direct Storage access are denied.

Deterministic source files live in `tests/e2e/documents/files-and-extraction-fixtures.ts`. The PDF fixture has a valid xref table and stream length; the PNG is a valid one-pixel image. Each expected byte/value is defined independently from the production upload/parser helpers.

## Proof boundaries

The spec is intended to prove local Storage bytes, upload metadata, fresh-session recovery, table schema persistence, deterministic CSV extraction, row persistence, UI readback and tenant isolation.

It does **not** claim OCR quality or Gemini compatibility for the image/PDF files. Image/PDF coverage in this file stops at the real upload, Storage, access and reload boundaries. The separate `ocr-provider-boundary.spec.ts` uses the owned provider transport to validate decoded payload hash/MIME and return a synthetic Gemini response; the actual app then validates and persists it.

Folder creation uses the reachable legacy context menu on a normal parent. The test prepares that parent with an owned actor Storage marker because the seeded OCR folder cannot contain child folders and the newer document screen has no create-folder action. The tested normal/data child is created through the actual dialog; this does not establish first-time root-folder creation.

The extraction-pipeline projection has a separate label contract from the table record. When table settings do not persist `ocrFolderLabel`, `folder.label` falls back to the final normalized path segment, so the test expects the known child slug there. The durable table `name` retains the human label; the loaded extraction folder also uses the configured path slug as its display fallback. The path, target table, columns and extraction configuration are asserted independently.

## Static verification completed

- `npm exec playwright test -- --list tests/e2e/documents/files-and-extraction.spec.ts` — passed; 3 authenticated tests discovered.
- `npm run typecheck:tests -- --pretty false` — passed.
- `npm exec eslint -- tests/e2e/documents/files-and-extraction.spec.ts tests/e2e/documents/files-and-extraction-fixtures.ts` — passed.

All three journeys passed together in `f99ac0d4-1854-4162-8cc7-a313380f1a3c`, then passed again in the final frozen 49/49 run `7481fcd3-758d-470e-abe6-4746a2983c13`. The final fixture/stack cleanup and unchanged source hashes are recorded in [README](README.md). These are runtime results against actual Auth, routes, Storage, SQL and RLS.

## Repository impact

- This test slice changes no product code directly. Integration exposed the folder visibility, navigation and row-summary repairs recorded in [product-regressions.md](product-regressions.md).
- Shared fixtures: unchanged; existing owner/otherOwner actor sessions and actor-scoped Storage clients are sufficient.
- Database schema and stored data: unchanged outside the disposable test runtime.
- Domain docs: the root updated the document manager and OCR pipeline notes for the integrated repairs.
- ADR: the root updated ADR 0039 for the owned provider and transport verification boundaries.
- Styleguide: no update needed because no UI implementation changed.

The main runtime risk is selector or load-timing drift in the large file-manager screen. Persisted assertions are independently checked through fresh actor requests and Storage/RLS reads so a transient success toast cannot make these tests pass.
