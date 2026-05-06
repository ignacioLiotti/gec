# Agent Context: app/excel/[obraId]/tabs/file-manager

## Purpose

This folder owns the per-obra document/file manager UI. It shows folders and files, uploads documents, previews files, manages data folders, connects folders to extraction tables, displays OCR/spreadsheet extracted data, runs imports, and surfaces lineage/traceability panels.

This is a high-risk UI folder because it is coupled to Supabase Storage, `/api/obras/[id]/documents*`, `/api/obras/[id]/tablas*`, OCR processing, spreadsheet import previews, tenant storage limits, and lineage identity.

## Main files

- `file-manager.tsx`: main client component; owns file tree state, upload flow, signed URL/download helpers, OCR folder mapping, table selection, spreadsheet preview flow, data-folder creation, document views, and many dialogs.
- `types.ts`: shared file tree, OCR link, table row, document status, lineage, and selection types.
- `cache.ts`: in-memory caches for file tree, signed URLs, blob URLs, OCR links, and APS models.
- `hooks/useDocumentsStore.ts`: global-ish document store and prefetch logic for file tree, OCR links, and APS models.
- `hooks/useSelectionStore.ts`: selection state helpers.
- `components/file-tree-sidebar.tsx`: folder/file tree navigation.
- `components/document-sheet.tsx`: side sheet for selected document metadata/actions.
- `components/document-preview.tsx`: document preview surface.
- `components/document-data-sheet.tsx`: extracted data display for a document.
- `components/spreadsheet-*.tsx`: spreadsheet preview, extraction cards, adjustment drawer, and summary modal.
- `components/viewer/forgeviewer.tsx` and `forge.css`: APS/Forge viewer integration.

## Local rules

- Keep storage paths normalized and obra-scoped. Do not build paths without `normalizeFolderPath` / related helpers.
- Preserve document metadata fields: `storagePath`, `ocrDocumentStatus`, `ocrExtractionId`, fingerprints, and `lineage_row_key` on rows.
- Do not change API response shape assumptions without checking `app/api/obras/AGENT_CONTEXT.md` and the exact route.
- Treat `file-manager.tsx` as a coordinator. Prefer editing smaller component files when the behavior is localized there.
- Do not invalidate or bypass caches casually; signed URLs and blob URLs have expiration behavior.
- Do not call Supabase Storage directly for behavior that is mediated by `/api/obras/[id]/documents/access` unless there is an existing local pattern.
- Preserve demo/guided-tour targets and blocked states when editing visible workflow steps.
- Changes to OCR/spreadsheet import UX must preserve lineage conflict display and preview/confirm flow.

## Dependencies

- API context: `app/api/obras/AGENT_CONTEXT.md`.
- Documents routes: `/api/obras/[id]/documents-tree`, `/documents/upload`, `/documents/access`, `/documents/deletes`, `/documents/deletes/restore`.
- Table/import routes: `/api/obras/[id]/tablas`, `/tablas/[tablaId]/rows`, `/tablas/[tablaId]/import/ocr`, `/tablas/import/ocr-multi`, `/tablas/import/spreadsheet-multi`, `/tablas/ocr-links`.
- Lineage route: `/api/obras/[id]/lineage-graph`.
- Storage/usage: `/api/tenant-usage`, Supabase Storage bucket `obra-documents`.
- Helpers: `@/lib/tablas`, `@/lib/spreadsheet-preview-summary`, `@/lib/tenant-expenses`.
- Shared table UI: `components/form-table/**`.
- Viewer: `components/viewer/enhanced-document-viewer`, APS routes under `app/api/aps`.
- Admin OCR template UI: `app/admin/obra-defaults/_components/OcrTemplateConfigurator`.

## Related documentation

- `CONTEXT.md`: Flujo Documental, Pipeline de Extraccion, Tabla de Extraccion, Lineage Row Key, File Fingerprint, Content Fingerprint Normalized.
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/obsidian-brain/18 - OCR Pipeline.md`
- `docs/obsidian-brain/36 - Dynamic Tables Deep Dive.md`
- `docs/obsidian-brain/44 - Excel Navigation Prefetch & Obra Selector.md`
- `DOCUMENTACION-NUEVA/excel/obraid/data-flows-y-apis.md`
- `DOCUMENTACION-NUEVA/excel/obraid/reglas-y-gotchas.md`

## Related ADRs

- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `docs/adr/0002-macro-table-overrides-bind-to-lineage.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/adr/0010-layered-traceability-canvas-separates-real-and-projected-nodes.md`

## Common tasks

### Change file tree loading or document selection

Read first:

- `file-manager.tsx`
- `types.ts`
- `hooks/useDocumentsStore.ts`
- `cache.ts`
- `components/file-tree-sidebar.tsx`
- `app/api/obras/[id]/documents-tree/route.ts`

Do not read first:

- OCR import routes, unless OCR metadata in the tree changes
- spreadsheet components
- APS viewer code

### Change upload behavior

Read first:

- `file-manager.tsx`
- `app/api/obras/[id]/documents/upload/route.ts`
- `@/lib/tablas` path normalization helpers
- `@/lib/tenant-usage`
- `@/lib/subscription-plans`

Do not read first:

- table row routes, unless upload should trigger extraction/table writes
- viewer components, unless preview after upload changes

### Change document preview or signed URL behavior

Read first:

- `file-manager.tsx`
- `components/document-preview.tsx`
- `components/document-sheet.tsx`
- `cache.ts`
- `app/api/obras/[id]/documents/access/route.ts`
- `components/viewer/enhanced-document-viewer`

Do not read first:

- OCR import routes
- table config code
- APS routes, unless the file type is a 3D model

### Change OCR folder setup or extraction table mapping

Read first:

- `file-manager.tsx`
- `types.ts`
- `app/api/obras/[id]/tablas/route.ts`
- `app/api/obras/[id]/folders/extraction-pipeline/route.ts`
- ADR 0007

Do not read first:

- all admin defaults code; only read `OcrTemplateConfigurator` if template UI behavior is reused
- spreadsheet import route, unless the folder supports spreadsheet input

### Change OCR processing UX

Read first:

- `file-manager.tsx`
- `components/document-data-sheet.tsx`
- `app/api/obras/[id]/tablas/[tablaId]/import/ocr/route.ts`
- `app/api/obras/[id]/tablas/import/ocr-multi/route.ts`
- ADR 0001 and ADR 0007

Do not read first:

- data-flow screens
- general obra page except for props passed into the documents tab

### Change spreadsheet import preview/adjustment UX

Read first:

- `file-manager.tsx`
- `components/spreadsheet-preview-types.ts`
- `components/spreadsheet-grid-preview.tsx`
- `components/spreadsheet-import-summary-modal.tsx`
- `components/spreadsheet-adjustment-drawer.tsx`
- `app/api/obras/[id]/tablas/import/spreadsheet-multi/route.ts`
- `@/lib/spreadsheet-preview-summary`

Do not read first:

- OCR provider code
- file tree sidebar, unless selection/upload integration changes

### Change lineage panel behavior

Read first:

- `app/api/obras/[id]/lineage-graph/route.ts`
- ADRs 0001, 0002, 0010
- `CONTEXT.md` traceability entries

Do not read first:

- React Flow/data-flow UI unless node/edge shape is shared
- macro table admin screens, unless override binding changes

## Context boundary

Normally read the local component/hook plus the exact API route it calls. Use `rg "fetch(" app/excel/[obraId]/tabs/file-manager` to find the route if needed.

Do not explore broadly:

- `app/excel/**`: only the parent tab/page if props passed into file manager change.
- `app/api/**`: use `app/api/obras/AGENT_CONTEXT.md`, then read only the matching route.
- `components/form-table/**`: only when extracted-data table behavior changes.
- `supabase/migrations/**`: only when storage/RLS/table columns are unclear.
- `lib/**`: only direct imports.

Exploration is justified when storage paths, signed URLs, OCR status, import response shape, lineage identity, or table row metadata cannot be proven locally.

## Stop conditions

Start editing when you know the selected UI flow, the route it calls, the affected local state/cache, and whether the change touches storage, OCR/import, table rows, or lineage.

Continue exploring only when a called route owns the behavior, a type is defined outside this folder, or a response shape is unclear.

Stop exploring when the remaining unknowns are unrelated document modes, unused dialogs, or broad `file-manager.tsx` internals outside the task.

## Documentation triggers

- Update domain docs when changing document workflows, extraction semantics, lineage meaning, or user-visible folder contracts.
- Update ADRs when changing storage layout, document-flow contracts, lineage identity, or projected vs real traceability.
- Update architecture docs when changing API/storage flow or cache/signing behavior.
- Update styleguide docs when changing reusable file-tree, import preview, empty/loading/error, destructive action, or document sheet patterns.

## Known risks

- `file-manager.tsx` is very large; broad edits can easily affect unrelated flows.
- Incorrect storage path normalization can expose, hide, duplicate, or orphan documents.
- Caches can show stale documents or signed URLs if invalidation is missed.
- OCR/spreadsheet imports can break lineage continuity or duplicate rows.
- UI state spans folder selection, document selection, sheet document, modal state, and guided tours.
- Direct Supabase Storage calls can bypass API-side usage and access checks.

## Pre-commit checklist for this folder

- List the exact flow changed: tree, upload, preview, OCR, spreadsheet, lineage, or delete/restore.
- Confirm matching `/api/obras/*` route contract was checked.
- Confirm storage paths remain normalized and obra-scoped.
- Confirm caches are invalidated or preserved intentionally.
- Confirm lineage/fingerprint fields are preserved when touching extracted data.
- Confirm loading, empty, and error states still exist for the changed flow.
- Confirm guided-tour target attributes were not broken if editing visible steps.
- Run the smallest relevant validation below.
- Decide whether domain, ADR, architecture, or styleguide docs need updates.
- Do not commit unless explicitly asked.

## Validation

- General changes: `pnpm lint`.
- Table/extracted data behavior: `pnpm test -- tests/lib/tablas.test.ts`.
- Spreadsheet preview behavior: `pnpm test -- tests/lib/spreadsheet-preview-summary.test.ts`.
- Lineage/import behavior: `pnpm test -- tests/lib/lineage.test.ts tests/lib/ocr-row-policy.test.ts`.
- UI workflow changes: targeted Playwright tests under `tests/e2e/excel/ui` if the changed path has coverage.
