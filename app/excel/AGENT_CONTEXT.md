# Agent Context: app/excel

## Purpose

This folder owns the main obra workspace UI: the obras list/table, obra detail page, per-obra tabs, reports, trash views, and data-flow screens. It is the primary product surface for users working with obras.

This is a broad UI folder. Treat this file as high-level routing and workflow context. The file manager has its own context at `app/excel/[obraId]/tabs/file-manager/AGENT_CONTEXT.md`; read that one for document, storage, OCR, spreadsheet import, and lineage work.

## Main files

- `page.tsx`: renders the Excel landing/list route and resolves load mode via `@/lib/excel/load-mode`.
- `landing-page.tsx`: landing/list page composition entry.
- `desktop-excel-page-full.tsx`: main desktop obras table client; handles CSV import preview, table config, toolbar actions, guided tour wiring, and `FormTable` usage.
- `desktop-excel-page-preview.tsx`: alternate/preview desktop table implementation.
- `mobile-excel-page-client.tsx`: mobile obras list/client experience.
- `excel-page-client.tsx` and `desktop-excel-page-client.tsx`: client wrappers/load-mode glue.
- `schema.ts`: `obraSchema`, `obrasFormSchema`, and `Obra` types shared with API routes.
- `[obraId]/page.tsx`: large obra detail client page; loads obra data, certificates, materials, OCR links, macro table data, tabs, notes, completion messages, and guided flows.
- `[obraId]/tabs/general-tab.tsx`: General tab layout and data-flow/result presentation.
- `[obraId]/tabs/documents-tab.tsx`: wrapper for document/file-manager experience.
- `[obraId]/tabs/flujo-tab.tsx`: obra workflow/flujo UI.
- `[obraId]/tabs/certificates-tab.tsx`: certificates UI.
- `[obraId]/tabs/types.ts`: shared per-obra tab types.
- `[obraId]/report/**` and `[obraId]/tabla/[tablaId]/reporte/page.tsx`: obra-level reporting surfaces.
- `data-flow/**` and `[obraId]/data-flow/**`: general and obra-specific data-flow screens.
- `papelera-obras/**` and `[obraId]/papelera/**`: obra/document trash views.
- `_components/**`: table-list subcomponents for search, columns, views, and in-body states.

## Local rules

- Keep route-level UI changes scoped to the relevant page/tab. Do not edit file-manager internals for general obra table work.
- `schema.ts` is shared with `app/api/obras`; changing it affects API validation and table saves.
- Preserve query params used by load modes, guided tours, tabs, and navigation state.
- The obras list is built on `components/form-table`; table behavior changes should usually happen in config or the shared component, not by one-off DOM changes.
- The obra detail page fetches multiple `/api/obras/*` endpoints. Changing response shapes requires checking the matching API route and consumer together.
- Treat `porcentaje` updates as domain behavior because API completion side effects can emit notifications and flujo actions.
- `/app/excel/[obraId]/data-flow/page-client.tsx` is the canonical obra data-flow UI; legacy/prototype data-flow artifacts should not be reintroduced.

## Dependencies

- API routes: `app/api/obras/**`, `app/api/macro-tables/**`, `app/api/reports/**`, `app/api/data-flow-*`.
- Shared table UI: `components/form-table/**`, especially `configs/obras-detalle.tsx`.
- UI primitives: `components/ui/**`, `components/excel-page-tabs.tsx`, `components/viewer/**`.
- Data/model helpers: `@/app/excel/schema`, `@/lib/excel/page-data`, `@/lib/excel/load-mode`, `@/lib/main-table-columns`, `@/lib/use-prefetch-obra`, `@/lib/data-flow-builder`.
- Guided/demo flows: `@/lib/demo-tours/**`, `components/demo-tours/**`.
- Supabase browser client: `@/utils/supabase/client` in client-heavy screens.

## Related documentation

- `CONTEXT.md`: Obra, Tabla de Obras Operativa, Detalle de Obra, Data-flow General, Data-flow de Obra.
- `docs/obsidian-brain/03 - Routing & Navigation.md`
- `docs/obsidian-brain/04 - Obras (Construction Projects).md`
- `docs/obsidian-brain/05 - Tablas (Data Tables).md`
- `docs/obsidian-brain/06 - Excel View.md`
- `docs/obsidian-brain/10 - Documents & File Manager.md`
- `docs/obsidian-brain/27 - User Flow Walkthrough.md`
- `DOCUMENTACION-NUEVA/excel/obraid/README.md`
- `DOCUMENTACION-NUEVA/excel/obraid/pantallas-y-rutas.md`

## Related ADRs

- `docs/adr/0003-tenant-and-obra-data-flow-configs.md`
- `docs/adr/0005-general-tab-layout-owned-by-data-flow.md`
- `docs/adr/0006-react-flow-for-data-flow-traceability.md`
- `docs/adr/0010-layered-traceability-canvas-separates-real-and-projected-nodes.md`

## Common tasks

### Change obras list/table behavior

Read first:

- `app/excel/desktop-excel-page-full.tsx`
- `app/excel/schema.ts`
- `components/form-table/configs/obras-detalle.tsx`
- `components/form-table/AGENT_CONTEXT.md`
- `app/api/obras/AGENT_CONTEXT.md`

Do not read first:

- `[obraId]/tabs/file-manager/**`
- data-flow screens
- admin screens

### Change obra detail top-level behavior

Read first:

- `app/excel/[obraId]/page.tsx`
- `app/excel/[obraId]/tabs/types.ts`
- the specific tab file if the change is tab-local
- `app/api/obras/AGENT_CONTEXT.md`

Do not read first:

- all tabs; open only the tab whose behavior changes
- `components/form-table/**`, unless a `FormTable` config or table behavior changes

### Change General tab or data-flow display

Read first:

- `app/excel/[obraId]/tabs/general-tab.tsx`
- `app/excel/[obraId]/data-flow/page-client.tsx`
- `@/lib/data-flow-builder`
- ADRs 0003, 0005, 0006, 0010

Do not read first:

- document/file-manager code
- OCR/import API routes, unless a data source contract changes

### Change document tab behavior

Read first:

- `app/excel/[obraId]/tabs/documents-tab.tsx`
- `app/excel/[obraId]/tabs/file-manager/AGENT_CONTEXT.md`

Do not read first:

- general obras list files
- report screens

### Change reports under Excel

Read first:

- `app/excel/[obraId]/report/report-client.tsx`
- `app/excel/[obraId]/report/page.tsx`
- `app/excel/[obraId]/tabla/[tablaId]/reporte/page.tsx`
- `components/report/**`
- `@/lib/reporting`

Do not read first:

- file-manager internals
- macro admin screens, unless report config depends on macro table config

## Context boundary

Normally read the page/tab file being changed, its direct imports, and the matching API context if a fetch contract changes.

Do not explore broadly:

- `app/api/**`: use `app/api/obras/AGENT_CONTEXT.md` and then only the matching route.
- `components/**`: open only directly used components or `components/form-table` for table behavior.
- `lib/**`: open only direct imports.
- `supabase/migrations/**`: only for schema/RLS/storage contract questions.
- `[obraId]/tabs/file-manager/**`: only for document/OCR/storage/lineage tasks.

Exploration is justified when response shape, route params, tenant visibility, data-flow semantics, or shared `schema.ts` changes.

## Stop conditions

Start editing when you know the exact route/page, the API endpoint or helper it consumes, and whether the change is list-level, detail-level, tab-level, or shared table behavior.

Continue exploring only if a direct import owns the behavior, the API response shape is unclear, or a targeted test points elsewhere.

Stop exploring when remaining questions are about unrelated tabs, visual polish outside the changed surface, or future refactors.

## Documentation triggers

- Update domain docs when changing obra workflow, detail semantics, completion behavior, or user-visible business rules.
- Update ADRs when changing data-flow ownership, general-tab layout ownership, or traceability contracts.
- Update styleguide docs when introducing reusable table, tab, loading, empty, destructive, or modal patterns.
- Update architecture docs when route/API contracts or page data loading strategy changes.

## Known risks

- `schema.ts` changes can break API validation.
- `porcentaje` changes can trigger completion side effects.
- Large client files mix data fetching, UI, and guided-tour state; avoid broad edits.
- Query param changes can break guided tours, tab restoration, and load modes.
- `FormTable` behavior is shared across multiple product surfaces.

## Pre-commit checklist for this folder

- List exact page/tab files changed.
- Confirm API response shape changes were checked against the route.
- Confirm route/query params and guided-tour params still work.
- Confirm `schema.ts` changes were checked against `app/api/obras`.
- Confirm table changes were checked against `components/form-table`.
- Decide whether domain, ADR, architecture, or styleguide docs need updates.
- Do not commit unless explicitly asked.

## Validation

- General UI/type changes: `pnpm lint`.
- Obra list/table behavior: `pnpm test -- tests/lib/tablas.test.ts` when parsing/formula logic is touched.
- Navigation/workspace behavior: targeted Playwright tests under `tests/e2e/excel-navigation.spec.ts` or `tests/e2e/excel/ui`.
- API contract changes: run targeted tests under `tests/e2e/excel/api` when relevant.
