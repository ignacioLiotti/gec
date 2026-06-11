# Document AI context hydrates document generation from extracted obra data

Status: accepted

Date: 2026-05-28

## Context

Sintesis already has obra-scoped file management, OCR/spreadsheet extraction, stable lineage, document-generation templates, generated-document review, and generated documents saved back into the obra file manager. A generic "document AI platform" mounted beside those flows would duplicate concepts that already exist in the domain.

The product need is to connect extracted documents to generated operational documents without letting a model or UI shortcut become the source of truth.

## Decision

Document generation now has an assist step that hydrates missing template inputs from extracted `obra_tabla_rows` for the selected obra, folder, document type, and template.

The assist step writes a JSON evidence envelope into `input_data.__documentAi` with:

- extractor version
- source row/table counts
- applied source references
- lineage row key and extraction id when present
- source document path, file name, and bucket when present
- warnings when no compatible data is found

The generated document still uses deterministic template rendering and the existing validation flow. Manual values are preserved; extracted context only fills missing fields or empty repeatable/table groups.

## Consequences

- The feature lands inside the existing document-generation workflow instead of creating a separate demo surface.
- Generated documents can carry an auditable context payload without a schema migration.
- Reviewers and future traceability UI can inspect the source evidence from `input_data.__documentAi`.
- The current implementation is deterministic matching over extracted rows, not a semantic embedding search or LLM report generator.
- A future migration may promote the evidence envelope into first-class tables if review, filtering, or cross-document reporting require indexed queries.

## Related files

- `app/document-generation/page-client.tsx`
- `app/api/document-generation/assist/route.ts`
- `lib/document-generation.ts`
- `lib/document-generation-server.ts`
- `tests/lib/document-generation.test.ts`

## Related domain docs

- `CONTEXT.md`
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/adr/0011-document-generation-capability-permissions.md`
