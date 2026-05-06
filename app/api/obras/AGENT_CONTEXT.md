# Agent Context: app/api/obras

## Purpose

This folder owns API routes for the obra-centered backend surface. It handles obra CRUD and bulk updates, soft-delete/restore views, per-obra tables, rows, documents, document upload/access/deletion, OCR and spreadsheet imports, folder extraction pipeline inspection, lineage graphs, data-flow config, materials, certificates, pendientes, findings, rules, signals, and defaults backfill.

This is a high-risk folder because most routes cross tenant boundaries, Supabase RLS, storage paths, dynamic table schemas, extracted data, lineage identity, and side effects such as notifications, calendar events, usage metering, and default template application.

## Main files

- `route.ts`: top-level `/api/obras` list/create logic plus shared helpers for auth context, obra row mapping, custom-data sanitization, default application, completion workflow side effects, and soft delete integration.
- `bulk/route.ts`: bulk upsert of obras by `tenant_id,n`; sanitizes custom columns, applies defaults to newly created obras, and has legacy column fallbacks.
- `[id]/route.ts`: read/update/delete for a single obra; validates tenant ownership, handles percentage completion transitions, emits `obra.completed`, executes flujo actions, and cleans pending completion side effects when reverting completion.
- `deletes/route.ts` and `deletes/restore/route.ts`: tenant-admin view and restore flow for deleted obras.
- `backfill-defaults/route.ts`: applies tenant defaults to existing obras.
- `[id]/tablas/route.ts`: list/create obra tablas and columns; supports manual, CSV, OCR, materials template, OCR folder settings, document types, and extraction instructions.
- `[id]/tablas/[tablaId]/route.ts`: table schema read/update/delete for a specific tabla.
- `[id]/tablas/[tablaId]/rows/route.ts`: paginated row reads and manual row upserts/deletes; evaluates column formulas and preserves document linkage metadata.
- `[id]/tablas/[tablaId]/import/ocr/route.ts`: OCR import for one tabla/document; calls the configured OCR model, coerces values, tracks usage/costs, computes fingerprints, derives lineage row keys, writes extracted rows, and records processing errors.
- `[id]/tablas/import/ocr-multi/route.ts`: multi-document OCR import orchestration.
- `[id]/tablas/import/spreadsheet-multi/route.ts`: CSV/XLSX multi-table import; detects sheet structure, builds preview summaries, coerces values, computes fingerprints, and derives lineage row keys.
- `[id]/tablas/[tablaId]/import/csv/route.ts`: CSV import for one tabla.
- `[id]/tablas/ocr-links/route.ts`: links extracted rows/documents for UI lookup.
- `[id]/tablas/[tablaId]/documents/**`: document associations for table rows/documents.
- `[id]/documents/upload/route.ts`: upload to Supabase Storage bucket `obra-documents`; enforces obra-owned folder path, file naming, tenant plan storage limits, usage events, and upload tracking.
- `[id]/documents-tree/route.ts`: builds document/file-tree data, filters soft-deleted document paths, combines OCR tablas, columns, rows, and linked documents.
- `[id]/documents/access/route.ts`: document access metadata/signing path.
- `[id]/documents/deletes/**`: document soft-delete and restore routes.
- `[id]/folders/extraction-pipeline/route.ts`: read-only projection of a folder as an extraction contract: classifier, strategy, table mapping, lineage policy, conflicts, and downstream consumers.
- `[id]/lineage-graph/route.ts`: read-only graph from OCR processing, rows, macro overrides, and lineage state.
- `[id]/data-flow-config/route.ts`: obra-level data-flow config; merges tenant config with obra overrides and can evaluate effective config.
- `[id]/data-flow-graph/route.ts`: graph projection for data-flow.
- `[id]/signals/**`, `[id]/findings/**`, `[id]/rules/route.ts`: computed signals, findings evaluation, and rule reads.
- `[id]/materials/**`, `[id]/certificates/route.ts`, `[id]/pendientes/route.ts`, `[id]/memoria/route.ts`: obra subdomains backed by tenant-scoped Supabase tables.

## Local rules

- Always resolve auth and tenant context before reading or mutating obra data. Most routes use `resolveRequestAccessContext()` from `@/lib/demo-session`; some legacy paths still call `createClient()` directly.
- Every obra-scoped query must prove the obra belongs to the current `tenantId` and is not soft-deleted, normally with `.eq("tenant_id", tenantId)` and `.is("deleted_at", null)` on `obras`, or an inner join back to `obras`.
- Demo access is capability-gated. Do not treat demo sessions as normal users; preserve `actorType === "demo"` checks and `hasDemoCapability(..., "excel")` / related capability checks.
- Do not bypass RLS with the admin client unless the existing flow already does so for a specific side effect and the reason is clear.
- Preserve `custom_data` sanitization against `tenant_main_table_configs` when accepting obra main-table custom fields.
- Preserve lineage fields on extracted/imported rows: `lineage_row_key`, `extraction_id`, `materialization_version`, `file_fingerprint`, and `content_fingerprint_normalized`.
- Document paths must stay inside the obra prefix. Use existing normalization helpers from `@/lib/tablas`; do not concatenate unchecked user input into storage paths.
- Treat default application, force sync, backfill, delete, restore, OCR import, and spreadsheet import as data consistency operations, not just UI support endpoints.
- When changing completion behavior (`porcentaje` crossing 100), check notification, calendar, and flujo side effects.

## Dependencies

- Auth and tenant context: `@/lib/demo-session`, `@/utils/supabase/server`, `@/utils/supabase/admin`.
- Obra validation/schema: `@/app/excel/schema`.
- Tabla schema and coercion: `@/lib/tablas`.
- Defaults: `@/lib/obra-defaults`.
- Delete lifecycle: `@/lib/obras/delete-lifecycle`.
- Lineage: `@/lib/lineage`, `@/lib/ocr-row-policy`, `@/lib/ocr-error-message`.
- Storage and usage limits: Supabase Storage bucket `obra-documents`, `@/lib/subscription-plans`, `@/lib/tenant-usage`, `@/lib/ai-pricing`.
- Notifications/workflows: `@/lib/notifications/engine`, `@/lib/notifications/rules`, flujo action tables.
- Data-flow: `@/lib/data-flow-builder`.
- Reporting/signals: `@/lib/reporting`.
- Spreadsheet imports: `xlsx`, `papaparse`, `@/lib/spreadsheet-preview-summary`.

## Related documentation

- `CONTEXT.md`: domain language for Obra, Tabla de Extraccion, Pipeline de Extraccion, Lineage Row Key, Flujo Documental, Data-flow General/Data-flow de Obra, destructive sync, and migration language.
- `docs/obsidian-brain/04 - Obras (Construction Projects).md`
- `docs/obsidian-brain/05 - Tablas (Data Tables).md`
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/obsidian-brain/18 - OCR Pipeline.md`
- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/24 - Database Schema.md`
- `docs/obsidian-brain/25 - API Reference.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

## Related ADRs

- `docs/adr/0001-stable-lineage-for-extracted-rows.md`: extracted rows need stable business identity beyond technical row IDs.
- `docs/adr/0002-macro-table-overrides-bind-to-lineage.md`: macro overrides depend on stable source row identity.
- `docs/adr/0003-tenant-and-obra-data-flow-configs.md`: data-flow merges tenant-level config with obra-level overrides.
- `docs/adr/0006-react-flow-for-data-flow-traceability.md`: relevant when API output feeds data-flow traceability views.
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`: folders are extraction contracts, not just storage paths.
- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`: destructive default sync or force-sync behavior needs a migration contract.
- `docs/adr/0010-layered-traceability-canvas-separates-real-and-projected-nodes.md`: lineage/data-flow graph routes must distinguish persisted facts from projected nodes.

## Common tasks

Use the smallest task-specific reading set below. After reading the listed files, start editing unless a stop condition says otherwise.

### Change obra list/create/update/delete behavior

Read first:

- `app/api/obras/route.ts`
- `app/api/obras/[id]/route.ts` when changing single-obra behavior
- `app/api/obras/bulk/route.ts` when changing bulk upserts
- `@/app/excel/schema`
- `@/lib/demo-session`
- `@/lib/obras/delete-lifecycle` for delete behavior
- `CONTEXT.md` entries for `Obra`, `Datos Historicos de Obra`, and completion-related domain language

Do not read first:

- `components/**`
- `app/excel/**`
- OCR/import routes
- `supabase/migrations/**`, unless a queried column/table is missing or the schema contract is unclear

### Change completion side effects

Read first:

- `app/api/obras/[id]/route.ts`
- `app/api/obras/route.ts` for `executeFlujoActions`
- `@/lib/notifications/engine`
- `@/lib/notifications/rules`
- `docs/obsidian-brain/12 - Workflow & Flujo System.md`
- `docs/obsidian-brain/13 - Notifications Engine.md`

Do not read first:

- document routes
- table import routes
- UI folders, unless the response contract changes

### Change tabla schema or manual row save behavior

Read first:

- `app/api/obras/[id]/tablas/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/rows/route.ts`
- `@/lib/tablas`
- `docs/obsidian-brain/05 - Tablas (Data Tables).md`
- `tests/lib/tablas.test.ts`

Do not read first:

- OCR provider code, unless the task changes OCR-created rows
- `components/form-table/**`, unless API shape or formula behavior affects the client contract
- macrotables, unless the change affects cross-obra aggregation

### Change OCR import behavior

Read first:

- `app/api/obras/[id]/tablas/[tablaId]/import/ocr/route.ts`
- `app/api/obras/[id]/tablas/import/ocr-multi/route.ts` only for multi-document orchestration
- `@/lib/tablas`
- `@/lib/lineage`
- `@/lib/ocr-row-policy`
- `@/lib/ocr-error-message`
- `@/lib/tenant-usage`
- `@/lib/ai-pricing`
- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/obsidian-brain/18 - OCR Pipeline.md`

Do not read first:

- spreadsheet import route, unless the task explicitly shares lineage/import behavior
- document tree UI, unless response metadata changes
- all ADRs; read only the lineage/document-flow ADRs above unless the change expands scope

### Change spreadsheet or CSV import behavior

Read first:

- `app/api/obras/[id]/tablas/import/spreadsheet-multi/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/import/csv/route.ts` for single-table CSV
- `@/lib/spreadsheet-preview-summary`
- `@/lib/tablas`
- `@/lib/lineage`
- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `tests/lib/spreadsheet-preview-summary.test.ts`

Do not read first:

- OCR provider code, unless lineage reconciliation is shared
- `components/form-table/**`, unless import preview/response shape changes

### Change document upload, access, tree, delete, or restore behavior

Read first:

- `app/api/obras/[id]/documents/upload/route.ts`
- `app/api/obras/[id]/documents-tree/route.ts`
- `app/api/obras/[id]/documents/access/route.ts` when access/signing changes
- `app/api/obras/[id]/documents/deletes/**` for document soft delete/restore
- `@/lib/tablas` for path normalization
- `@/lib/tenant-usage` and `@/lib/subscription-plans` for upload limits
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`

Do not read first:

- table row routes, unless document linkage metadata changes
- APS routes under `app/api/aps`, unless the task is specifically about 3D model upload/viewer access
- UI file manager components, unless API response shape changes

### Change folder extraction pipeline or lineage graph projections

Read first:

- `app/api/obras/[id]/folders/extraction-pipeline/route.ts`
- `app/api/obras/[id]/lineage-graph/route.ts`
- `@/lib/lineage`
- `docs/adr/0001-stable-lineage-for-extracted-rows.md`
- `docs/adr/0002-macro-table-overrides-bind-to-lineage.md`
- `docs/adr/0007-document-flows-as-tenant-extraction-contract.md`
- `docs/adr/0010-layered-traceability-canvas-separates-real-and-projected-nodes.md`
- `CONTEXT.md` entries for `Flujo Documental`, `Pipeline de Extraccion`, `Nodo Real de Trazabilidad`, and `Nodo Projected de Trazabilidad`

Do not read first:

- React Flow UI components, unless node/edge response shape changes
- all macro table code, unless override binding behavior changes

### Change obra data-flow config or graph behavior

Read first:

- `app/api/obras/[id]/data-flow-config/route.ts`
- `app/api/obras/[id]/data-flow-graph/route.ts`
- `@/lib/data-flow-builder`
- `docs/adr/0003-tenant-and-obra-data-flow-configs.md`
- `docs/adr/0006-react-flow-for-data-flow-traceability.md`
- `docs/adr/0010-layered-traceability-canvas-separates-real-and-projected-nodes.md`
- `CONTEXT.md` entries for `Data-flow General`, `Data-flow de Obra`, and `Configuracion Efectiva de Data-flow`

Do not read first:

- OCR/import routes, unless data-flow sources depend on newly imported fields
- app UI pages, unless response shape or layout contract changes

### Change defaults backfill or tenant-derived structures

Read first:

- `app/api/obras/backfill-defaults/route.ts`
- `app/api/obras/bulk/route.ts`
- `@/lib/obra-defaults`
- `docs/adr/0009-destructive-default-sync-needs-domain-migration-contract.md`
- `CONTEXT.md` entries for `Plantilla Tenant`, `Instancia de Obra`, `Sincronizacion No Destructiva`, `Cambio Destructivo`, and `Migracion Explicita`

Do not read first:

- every route under `app/api/obras`
- UI admin folders, unless request/response behavior for admin screens changes
- migrations, unless the task changes schema/default storage

## Context boundary

Normally read only the route file being changed plus its direct imports. For example:

- Obra CRUD or completion changes: `route.ts`, `[id]/route.ts`, `@/app/excel/schema`, `@/lib/notifications/*`, `@/lib/obra-defaults`, `@/lib/obras/delete-lifecycle`.
- Tabla schema or row changes: `[id]/tablas/**`, `@/lib/tablas`, relevant tests under `tests/lib/tablas.test.ts` or form-table tests only if UI behavior is affected.
- OCR/spreadsheet import changes: the specific import route, `@/lib/lineage`, `@/lib/ocr-row-policy`, `@/lib/spreadsheet-preview-summary`, `@/lib/tenant-usage`, `@/lib/ai-pricing`.
- Document upload/tree/delete changes: `[id]/documents**`, `[id]/documents-tree/route.ts`, `@/lib/tablas` path normalization, storage migrations/docs.
- Data-flow changes: `[id]/data-flow-config/route.ts`, `[id]/data-flow-graph/route.ts`, `@/lib/data-flow-builder`, ADRs 0003/0006/0010.
- Soft delete changes: `deletes/**`, `[id]/documents/deletes/**`, `@/lib/obras/delete-lifecycle`, soft-delete docs.

Do not explore these folders unless a direct import, failing test, or changed contract requires it:

- `components/**`: only needed when changing API response shape consumed by UI.
- `app/excel/**`: only needed when route behavior or response shape affects the obra workspace.
- `app/admin/**`: only needed for defaults, roles, document-flow, or config endpoints whose admin UI contract changes.
- `supabase/migrations/**`: only needed for schema/RLS/storage policy changes or when a queried column/table is unclear.
- `lib/**` broadly: do not scan all of `lib`; open only the direct imported module and its immediate dependencies if needed.
- `docs/obsidian-brain/**` broadly: read the specific referenced docs above, not the whole vault.
- `tests/**` broadly: run/read targeted tests by domain; do not inspect unrelated e2e suites.

Exploration is justified when:

- a route changes request/response shape used outside this folder;
- a DB column, RLS policy, storage bucket, or migration contract is unclear;
- a direct import hides important side effects;
- a failing check points to another module;
- a change touches lineage, destructive defaults, tenant permissions, or document extraction contracts.

## Stop conditions

Start editing when:

- you have read the target route file;
- you have read its direct imports that own validation, auth, tenant scope, storage, lineage, or side effects;
- you know which Supabase tables/storage bucket the route touches;
- you know whether the route supports demo access;
- you know whether the change affects response shape, DB schema, storage paths, lineage identity, or side effects.

Continue exploring only when:

- a direct import delegates core behavior to another module;
- a route uses a table/column/storage path whose contract is unclear;
- the change affects a documented ADR/domain concept;
- the change modifies response shape consumed by UI;
- a targeted test or type/lint error points outside the initial reading set;
- security, tenant isolation, RLS, destructive sync, or lineage behavior cannot be proven from the local files.

Stop exploring when:

- remaining questions are about unrelated folders or possible future refactors;
- the only reason to continue is "there might be another pattern";
- the task can be completed by following the local route pattern and direct imports;
- broader UI/admin behavior is not changing.

## Documentation triggers

Update domain docs when:

- obra lifecycle, completion behavior, document flow, extraction workflow, table semantics, or user-visible business rules change.

Create/update an ADR when:

- changing storage layout, RLS/permission enforcement, data model, lineage identity, destructive default sync, OCR/spreadsheet extraction architecture, data-flow merge semantics, or cross-obra aggregation contracts.

Update architecture docs when:

- request lifecycle, auth/tenant resolution, API response contracts, storage usage, or background/side-effect flow changes.

Update styleguide when:

- API changes require a new reusable UI pattern for tables, imports, loading states, errors, destructive actions, or empty states.

## Known risks

- Missing tenant filters can expose or mutate cross-tenant data despite RLS assumptions.
- Some routes mix demo access and real user access; treating them uniformly can create unauthorized behavior.
- Manual row saves can overwrite extracted row metadata if document linkage or lineage fields are not preserved.
- OCR and spreadsheet imports can create duplicate or conflicting business rows if lineage reconciliation is changed casually.
- Upload and document tree routes depend on normalized storage paths; path mistakes can orphan files or show another obra's documents.
- Completion side effects create notifications, calendar events, and flujo executions; reverting completion also deletes pending side effects.
- Default application/backfill can mutate many obras and may become destructive if schema/default semantics change.
- Legacy fallbacks for missing columns exist in some routes; removing them can break older local or staged databases.

## Pre-commit checklist for this folder

- List the exact routes changed.
- Confirm every changed read/write path validates auth and tenant scope.
- Confirm deleted/hidden obras are handled consistently with `.is("deleted_at", null)` or delete lifecycle rules.
- Confirm demo access behavior is unchanged or intentionally updated.
- Confirm storage paths remain normalized and obra-prefixed when touching documents.
- Confirm lineage fields are preserved or intentionally migrated when touching imports or rows.
- Confirm side effects are accounted for when touching completion, notifications, calendar events, workflow/flujo, usage metering, or defaults.
- Confirm response shape changes were checked against the consuming UI before editing UI files.
- Run the smallest relevant validation from the section below.
- Decide whether domain docs, ADRs, architecture docs, or styleguide docs need updates; explain if not.
- Do not commit unless explicitly asked.

## Validation

- For route/type changes: `pnpm lint`.
- For table parsing/coercion/formula changes: `pnpm test -- tests/lib/tablas.test.ts`.
- For lineage import changes: `pnpm test -- tests/lib/lineage.test.ts tests/lib/ocr-row-policy.test.ts tests/lib/ocr-template-sync.test.ts`.
- For spreadsheet preview changes: `pnpm test -- tests/lib/spreadsheet-preview-summary.test.ts`.
- For delete lifecycle changes: `pnpm test -- tests/lib/obras/delete-lifecycle.test.ts`.
- For API behavior touching obra navigation/workspace contracts: consider targeted Playwright tests under `tests/e2e/excel/api` or `tests/e2e/excel-navigation.spec.ts`.
