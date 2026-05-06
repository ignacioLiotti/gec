# Agent Context: app/admin/obra-defaults

## Purpose

This folder owns tenant-level defaults for obras: default folders, default extraction/data tables, OCR template selection, spreadsheet/manual/OCR data input methods, quick actions, and tenant reporting defaults.

This is a high-risk admin area. A change here can affect every newly created obra and, through apply/remove/backfill paths, existing obras, storage folders, OCR tables, document references, and extracted row lineage.

## Main files

- `page.tsx`: main client UI for default folders, data folders, extracted table configs, OCR/template selection, spreadsheet presets, quick actions, imports of definition schemas, create/update/delete dialogs.
- `reporting/page.tsx`: tenant-level reporting defaults UI; reads/writes `/api/reporting/defaults`.
- `_components/OcrTemplateConfigurator.tsx`: visual OCR template editor for PDF/image regions and extraction columns.

## Local rules

- Treat folder paths as contracts. Normalize with `normalizeFolderName` / `normalizeFolderPath`; do not change path semantics casually.
- Treat a default folder linked to a default tabla as a document-flow/extraction contract, not just UI config.
- Do not delete or rename defaults without checking existing-obra propagation behavior.
- Any change that applies, removes, renames, or syncs defaults across existing obras must check ADR 0009.
- Preserve `dataInputMethod` semantics: `ocr`, `manual`, `both`.
- Preserve nested extraction/table scopes (`parent` vs `item`) and column metadata used by OCR/spreadsheet imports.
- Do not change OCR template columns without checking `OcrTemplateConfigurator`, `/api/ocr-templates`, and `/api/obra-defaults`.
- Reporting defaults are separate from folder/table defaults; do not mix their storage contracts.

## Dependencies

- API routes: `app/api/obra-defaults/route.ts`, `app/api/obra-defaults/apply/route.ts`, `app/api/obras/backfill-defaults/route.ts`, `app/api/ocr-templates/route.ts`, `app/api/reporting/defaults/route.ts`.
- Default application helpers: `@/lib/obra-defaults`, `@/lib/obra-defaults/apply-default-folder`, `@/lib/obra-defaults/remove-default-folder`.
- Table helpers: `@/lib/tablas`.
- File manager consumer: `app/excel/[obraId]/tabs/file-manager/AGENT_CONTEXT.md`.
- API/domain context: `app/api/obras/AGENT_CONTEXT.md`, `lib/AGENT_CONTEXT.md`, `supabase/migrations/AGENT_CONTEXT.md`.
- Reporting: `components/report/rule-config-hub`, `@/lib/reporting/defaults`, `@/lib/reporting/types`.

## Related documentation

- `CONTEXT.md`: Plantilla Tenant, Instancia de Obra, Sincronizacion No Destructiva, Cambio Destructivo, Migracion Explicita, Flujo Documental, Pipeline de Extraccion.
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/obsidian-brain/11 - Quick Actions.md`
- `docs/obsidian-brain/18 - OCR Pipeline.md`
- `docs/obsidian-brain/19 - Admin Panel.md`
- `docs/obsidian-brain/36 - Dynamic Tables Deep Dive.md`
- `DOCUMENTACION-NUEVA/configuracion-de-obras/README.md`
- `DOCUMENTACION-NUEVA/configuracion-de-obras/README-USERFACING.md`

## Related ADRs

- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `docs/adr/0003-tenant-and-obra-data-flow-configs.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`

## Common tasks

### Change default folder create/edit/delete UI

Read first:

- `app/admin/obra-defaults/page.tsx`
- `app/api/obra-defaults/route.ts`
- `@/lib/tablas` normalization helpers
- `CONTEXT.md` entries for `Plantilla Tenant`, `Instancia de Obra`, and `Sincronizacion No Destructiva`

Do not read first:

- file-manager UI, unless folder response shape changes
- all migrations, unless table/column storage changes

### Change extracted table/default tabla configuration

Read first:

- `app/admin/obra-defaults/page.tsx`
- `app/api/obra-defaults/route.ts`
- `@/lib/obra-defaults`
- `@/lib/tablas`
- `docs/obsidian-brain/36 - Dynamic Tables Deep Dive.md`
- ADR 0007

Do not read first:

- OCR provider route, unless extraction processing changes
- macro table code, unless defaults feed macro aggregation

### Change apply/backfill behavior for existing obras

Read first:

- `app/api/obras/backfill-defaults/route.ts`
- `app/api/obra-defaults/apply/route.ts`
- `@/lib/obra-defaults`
- `@/lib/obra-defaults/apply-default-folder`
- ADR 0009
- `CONTEXT.md` entries for `Cambio Destructivo`, `Migracion Explicita`, `Preview de Impacto`, and `Force Sync`

Do not read first:

- main admin UI beyond the triggering button/flow
- all `app/api/obras`; use `app/api/obras/AGENT_CONTEXT.md` and exact routes only

### Change remove/rename propagation

Read first:

- `app/api/obra-defaults/route.ts`
- `@/lib/obra-defaults/remove-default-folder`
- `@/lib/obra-defaults/apply-default-folder`
- `app/api/obras/AGENT_CONTEXT.md`
- ADR 0009

Do not read first:

- unrelated defaults UI sections
- reporting defaults

### Change OCR template configurator

Read first:

- `_components/OcrTemplateConfigurator.tsx`
- `app/admin/obra-defaults/page.tsx` where the configurator is used
- `app/api/ocr-templates/route.ts`
- `docs/obsidian-brain/18 - OCR Pipeline.md`

Do not read first:

- OCR import route, unless template output consumed by import changes
- reporting defaults

### Change reporting defaults

Read first:

- `app/admin/obra-defaults/reporting/page.tsx`
- `app/api/reporting/defaults/route.ts`
- `components/report/rule-config-hub`
- `@/lib/reporting/defaults`
- `@/lib/reporting/types`
- ADR 0003 if tenant-vs-obra override semantics change

Do not read first:

- folder/table defaults
- OCR template code

## Context boundary

Normally read the local file, the matching API route, and the specific helper that persists/applies the behavior.

Do not explore broadly:

- all admin pages;
- all file-manager code;
- all migrations;
- all API routes;
- unrelated reporting or OCR code.

Exploration is justified when a change mutates existing obras, moves/deletes storage objects, updates OCR row/document references, changes default table schemas, or alters tenant-vs-obra override semantics.

## Stop conditions

Start editing when you know whether the task affects only future defaults, existing obras, storage folders, OCR templates, quick actions, or reporting defaults.

Continue exploring only when existing-obra propagation, destructive behavior, or response/storage schema is unclear.

Stop exploring when remaining questions are about unrelated admin defaults sections or future migration workflow improvements.

## Documentation triggers

- Update domain docs when default folder/table behavior changes product workflows or business terms.
- Update ADRs for destructive propagation, tenant default sync semantics, OCR extraction contracts, or tenant-vs-obra config inheritance.
- Update architecture docs for API/storage/schema changes.
- Update styleguide docs for reusable admin form, destructive action, import preview, OCR template, or empty/loading patterns.

## Known risks

- Default deletion/removal can delete or detach tables/files from existing obras.
- Folder renames can require storage moves and reference updates in uploads, OCR processing, APS, and row `__docPath`.
- OCR template/schema changes can produce incompatible extracted rows.
- Quick actions may depend on migrations `0070` and `0081`; code has missing-migration fallbacks.
- ADR 0009 says destructive default sync needs a migration contract; current implementation still has partial/TODO paths.

## Pre-commit checklist for this folder

- State whether the change affects future obras only or existing obras too.
- Confirm folder paths are normalized and stable.
- Confirm default tabla columns preserve `fieldKey`, `dataType`, `required`, `config`, and `ocrScope`.
- Confirm apply/remove/backfill paths were checked if defaults propagate.
- Confirm destructive behavior is avoided or backed by ADR/domain contract.
- Confirm OCR template changes preserve expected column output.
- Confirm reporting defaults are not mixed with folder/table defaults.
- Run targeted validation below.
- Decide whether domain, ADR, architecture, or styleguide docs need updates.
- Do not commit unless explicitly asked.

## Validation

- General UI/API changes: `pnpm lint`.
- Default/flow schema logic: `pnpm test -- tests/lib/ocr-template-sync.test.ts`.
- Existing-obra delete/remove propagation: `pnpm test -- tests/lib/obras/delete-lifecycle.test.ts`.
- Table parsing/field key changes: `pnpm test -- tests/lib/tablas.test.ts`.
- Reporting defaults: targeted report tests under `tests/components/report` or `tests/lib` when relevant.
