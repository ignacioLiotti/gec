# Product regressions exposed by the authenticated suite

## Macro manual-value conflicts

The initial full run `c350205a-0655-4456-8141-990db21f23ec` returned an actual conflict from `GET /api/macro-tables/[id]/rows`. The client discarded `overrideConflicts` and showed an empty cell without identifying its cause. The backend correctly preserved ADR 0002's no-arbitrary-winner behavior.

The repair attaches a validated projection of those conflicts to the same fetched rows. A local notice derives its content from FormTable's current rows, including accordion children, without another query, state or Effect. It describes affected business rows, obras and columns on the current page. It does not reuse the API's global summary as a page count or offer a resolution action that does not exist.

The browser regression checks the actual API conflict and null value, visible warning and business identifiers, absence of either candidate in the cell, and a healthy-macro control with its stable manual value and no stale warning. It attaches a synthetic screenshot. Final run `cf2a3a85-33a9-4a38-bacc-9d134c3c6000` verified this behavior.

## Default-folder dataset selectors

The wizard can display a template that was selected for another dataset while the current dataset's template ID remains empty. `value={newFolderOcrTemplateId || undefined}` changes Radix Select from controlled to uncontrolled when switching datasets. Radix retains its internal selection; selecting the same option again does not fire a change. The user reaches review with an empty template ID and a disabled create button.

The repair keeps the OCR and spreadsheet selectors controlled with their string values, including the empty placeholder. It changes the five matching selectors in the existing wizard, without changing its persistence or adding Effects. The regression follows the ordinary items-to-summary authoring flow and observes both selected template IDs and dataset columns in the outgoing command.

The browser regression verified the items-to-summary transition, selecting the same OCR template for both datasets, and the resulting template IDs and columns in the command. The source repair covers five selectors; the browser test does not exercise every selector variant. The final run also passed the real Excel create/edit/Tab/save/reload flow, confirming that an edited cell persists after keyboard navigation, save and reload.

Final evidence is in [full-final-run.json](full-final-run.json) and [full-final-results.json](full-final-results.json). The run exited `0` with 34/34 E2E cases passed and disposed all 31 fixture scopes after verified runtime cleanup.

## Visual documentation gap

Figma's MCP Starter call limit blocked final writes and further board inspection. Existing permission-precedence nodes were updated earlier; the final verified annotations remain local proposals in [figjam-status.md](figjam-status.md).

The new product repairs also require updates to:

- [Product OS](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P), Verify lane `T1:191;1:13;1:18`: record the verified 34/34 E2E result, macro conflict warning and dataset-selection correction. No commit or deployment exists.
- [Journeys 02 / Datos y Reportes](https://www.figma.com/board/8dX4sV8kJYDwf1qa1jY5zb): existing macro override/reimport conflict flow should branch to a visible warning, affected cell left unapplied, and healthy-table navigation clearing the notice. Node inspection and the synthetic screenshot upload remain blocked by the call limit.
- [Journeys 01 / Inicio y Obras](https://www.figma.com/board/W6SZcSjlbhn1XdFLSktU03): default-folder authoring should retain independent OCR/spreadsheet choices per dataset when moving between datasets and continuing to review. Exact node selection remains blocked by the call limit.

Code, ADRs and actual browser evidence establish these behaviors. The unavailable boards were not used to infer the product contract. Preserve `Verify` because there is no commit or deployment, and do not imply completion of all forty workflows.

## Follow-ups outside this repair

- Production tenant purging needs an explicit physical-disposal contract. The existing soft-delete and audit interaction prevents assuming that deleting a tenant will remove its children successfully. This unit preserves that product behavior and disposes only its complete synthetic stack.
- `lib/route-guard.ts` currently logs an error reading a user's permission override and continues to role grants. A database failure could therefore omit a configured user deny. This is a source-level finding; the current permission suite verifies normal database responses. Add a fault-injection regression and decide the unavailable-permission outcome before changing that separate permission path.
- Generated-document review/PDF content, storage/download authorization, remaining forty-workflow journeys, provider compatibility and CI execution remain work in the target strategy. Passing the existing suite does not establish their coverage.
