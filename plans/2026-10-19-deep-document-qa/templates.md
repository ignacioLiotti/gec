# Document template workflow verification

Source SHA: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

The checkout contained pre-existing uncommitted product and fixture work. This slice changes `tests/e2e/document-generation/templates.spec.ts` and this report, and consumes the shared `tests/e2e/helpers/pdf.ts` parser owned by the lifecycle workflow. It does not modify the shared scenario fixture, application runtime, product code, schema, dependencies, or provider boundaries.

## Named workflows

### `owner creates, edits and reloads a typed template, then the generator renders and saves its inputs`

- Creates a provisioned obra through the real obra API, including its materialized `documentos-e2e` extraction table.
- Creates the tenant's `DOCUMENTO` type and initial template through `/document-generation/config`.
- Holds the initial real template catalog GET long enough to prove `Nuevo tipo` stays disabled while configuration is loading, then releases the request and performs creation only after the catalog is ready.
- Configures required text, number, date, and strict-select fields through the product's JSON editor, changes the HTML renderer, and saves through the UI.
- Reads the stored template through the owner's RLS client and checks tenant, document type, target folder, schema, and HTML marker.
- Opens a fresh authenticated browser context, reloads the template configuration, and checks the stored name, field JSON, and HTML.
- Opens the real generator for the provisioned obra. It checks number/date control types, exercises missing-required validation before generation, corrects the fields, and checks the live rendered values.
- Saves a real draft, then reads it back through a fresh authenticated request and checks template identity, typed input, status, and validation state.
- Generates a real PDF through the UI from that same edited template and draft. It verifies the rendered title, amount, date, and strict-select value by parsing the downloaded PDF bytes.
- Reads `generated_documents` through the owner's RLS client and checks tenant, obra, folder, document type, edited template ID, source draft, storage path, input values, status, and generating actor.

The invalid generation click stops at the product's required-field validation; the later valid click proves actual PDF generation and persistence.

### `invalid template and typed draft payloads remain recoverable without phantom writes`

- Submits duplicate normalized template field keys and requires the API's `400` response.
- Reads through tenant RLS to prove the rejected template was not inserted.
- Retries with a valid template and persists it.
- Saves a draft containing a missing required text field, a nonnumeric number, a non-ISO date, and an unknown strict-select value.
- Checks all four persisted validation errors and `DRAFT` status.
- Updates the same draft with valid values, then reads it from a fresh session and checks the stable draft ID, corrected values, empty errors, and `READY_TO_GENERATE` status.

### `template administration rejects unprivileged writes and known foreign tenant IDs`

- Creates a real template in tenant B with tenant B's owner session.
- Proves tenant A's catalog and direct RLS query cannot see the known foreign template ID.
- Sends tenant A's authenticated update to that known ID and requires a `404` without mutation.
- Requires the viewer's template-creation API request to return `403` and its direct RLS insert to return PostgreSQL `42501`.
- Reads tenant A as owner to prove neither denied viewer path inserted a row.
- Opens the viewer's configuration page and checks the visible permission outcome.
- Reloads tenant B through a fresh owner session and verifies the foreign template is unchanged.

## Static checks run

- `npm run typecheck:tests` — passed.
- `npm exec playwright test -- --list tests/e2e/document-generation/templates.spec.ts` — passed; discovered 3 authenticated tests.
- `npm exec eslint -- tests/e2e/document-generation/templates.spec.ts` — passed.
- `git diff --check -- tests/e2e/document-generation/templates.spec.ts` — passed.

## Runtime evidence

Owned run `1f28e109-6fa9-4d5e-b7f6-4e0ec8fd0920` exposed a catalog-loading race before document generation. The initial `GET /api/document-generation/templates?` began at trace monotonic time `61513.085` and took `2345.691 ms`; the test opened the creator and clicked the folder trigger at `61763.954`, while `folderConfigs` was still empty. The load completion then reset the creator state. The workflow now gates that real GET and asserts the loading affordance prevents early creation.

All three template cases passed in the final frozen run `7481fcd3-758d-470e-abe6-4746a2983c13`, including the real custom-template PDF, required-field recovery, destination and permission assertions. Review transitions, approved edits, rejected downloads and signature artifacts also passed in the separate lifecycle case. External OCR/LLM/provider compatibility is outside this template-persistence slice.

The loading race was a product defect established by trace evidence; the root integrated the loading guard and documented the test/runtime contracts. FigJam updates for the visible repair remain pending quota, as recorded in the root report. Existing design-system tokens and primitives were retained.
