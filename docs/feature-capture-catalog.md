# Product Feature and Capture Catalog

This catalog is the capture checklist for SÍNTESIS. It separates complete user journeys from atomic interactions so screenshots and recordings can prove both the product's end-to-end value and the small behaviors that make daily work understandable.

The detailed list of 146 independently demonstrable interactions lives in [Atomic Feature Capture Catalog](./atomic-feature-capture-catalog.md).

Implementation and domain documentation remain authoritative. Internal playgrounds are not customer workflow evidence. Captures must use sanitized local/demo data and must never contain credentials, tokens, private URLs, production identifiers, or real tenant information.

## Capture status and safety

| Marker        | Meaning                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `READ`        | Read-only navigation or inspection. Safe to capture without changing application state.                                                            |
| `LOCAL`       | Only changes the local browser, clipboard, download folder, or local storage.                                                                      |
| `DB`          | Creates or changes application records. Use a disposable test tenant and explicit authorization.                                                   |
| `FILE`        | Uploads, moves, restores, or deletes stored files. Use disposable files and explicit authorization.                                                |
| `EXT`         | Calls an external service such as AI/OCR, email, WhatsApp, APS, or MercadoPago.                                                                    |
| `DESTRUCTIVE` | Soft-delete, purge, reject, cancel, or similarly consequential action. Capture the confirmation safely; execute only when specifically authorized. |

Priority uses `P0` for flagship or release-critical evidence, `P1` for important supporting behavior, and `P2` for administrative or advanced behavior.

## General workflows

### Access and tenant onboarding

| ID  | Workflow                                       | Primary surface                                                        | Effects  | Priority | Recording checkpoints                                                                                                                           |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| G01 | Create a new customer tenant                   | `/onboarding` → `/tenants/new` → `/setup`                              | DB, FILE | P0       | Choose create path; organization form; preparing state; setup checklist; first-obra dialog; partial/retry state; 100% ready; obras destination. |
| G02 | Join by invitation                             | `/invitations/[token]`                                                 | DB       | P0       | Invitation details; role/access explanation; email mismatch; expired state; accept progress; destination; reject warning.                       |
| G03 | Switch active tenant                           | Sidebar tenant selector                                                | LOCAL    | P0       | Selector; current organization; switch progress; tenant-neutral destination; changed navigation/data; no stale obra ID.                         |
| G04 | Review and customize the recommended workspace | `/admin/obra-defaults`, `/admin/main-table-config`, `/excel/data-flow` | DB, FILE | P0       | Overview; folder recipe; OCR/spreadsheet/manual inputs; quick-action order; main columns; data-flow canvas; impact warning.                     |
| G05 | Invite and onboard a teammate                  | `/admin/users` → `/invitations/[token]`                                | DB, EXT  | P0       | Invite form; access level; work role; multiple recipients; delivery result/fallback link; pending list; recipient first login.                  |

### Obra lifecycle and daily work

| ID  | Workflow                                | Primary surface                         | Effects         | Priority | Recording checkpoints                                                                                                           |
| --- | --------------------------------------- | --------------------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| G06 | Create an additional obra               | `/excel`                                | DB, FILE        | P0       | New row; required fields; dirty cells; validation; save progress; new obra; generated General/Documents structure.              |
| G07 | Bulk-import obras from CSV              | `/excel`                                | DB              | P1       | File selection; preview; skipped files/rows; assigned numbers; cancel path; confirmation; resulting portfolio rows.             |
| G08 | Search, filter, edit and save obra data | `/excel`, `/excel/[obraId]?tab=general` | DB              | P0       | Search/filter/sort; inline edit; changed-cell highlight; save bar; General read/edit modes; calculated cards; success.          |
| G09 | Run an obra quick action                | Obra General                            | DB, FILE, EXT   | P0       | Action chooser; ordered stepper; upload/OCR/manual branch; processing; verification; completion; refreshed Documents/General.   |
| G10 | Complete an obra                        | Obra General                            | DB, EXT         | P1       | Pre-completion checks; warning; confirmation; completed badge; recalculated policy dates; resulting notification/calendar item. |
| G11 | Delete and restore an obra              | `/excel` → `/excel/papelera-obras`      | DB, DESTRUCTIVE | P1       | Delete confirmation; removal from active list; trash item; recovery deadline; restore; history.                                 |
| G12 | Review the daily dashboard              | `/dashboard`                            | READ            | P0       | KPIs; warnings; recent obras; obra preview; risk card; filtered policies; company files; responsive layout.                     |
| G13 | Add and review obra notes               | Obra General → Memoria                  | DB              | P1       | Closed/open panel; empty state; note draft; save; author/time in timeline.                                                      |
| G14 | Configure obra workflow actions         | `/excel/[obraId]?tab=flujo`             | DB, EXT         | P1       | Add action; immediate/relative/scheduled timing; channels; recipients; saved card; enable/edit/delete; calendar result.         |

### Documents, extraction and dynamic tables

| ID  | Workflow                                         | Primary surface                                               | Effects               | Priority | Recording checkpoints                                                                                                                |
| --- | ------------------------------------------------ | ------------------------------------------------------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| G15 | Upload, preview and download a normal document   | Obra Documents                                                | FILE, DB, LOCAL       | P0       | Folder tree; dropzone; capacity/progress; uploaded item; metadata sheet; PDF/image preview; download.                                |
| G16 | Upload and OCR a document                        | OCR-enabled Documents folder                                  | FILE, DB, EXT         | P0       | OCR folder indicator; upload; target/page selection; pending/processing; processed/error/conflict; row count; retry; lineage.        |
| G17 | Import a spreadsheet into data tables            | Spreadsheet-enabled Documents folder                          | FILE, DB              | P1       | Upload warning; detected sheets/sections; grid preview; selection/mapping; row summary; confirmation; generated rows; source link.   |
| G18 | Enter or correct table data manually             | Data folder table view                                        | DB                    | P0       | Documents/table toggle; add row; edit extracted row; dirty highlight; typed validation; save; source filter.                         |
| G19 | Go from document to OCR table to report          | Documents → table → `/excel/[obraId]/tabla/[tablaId]/reporte` | FILE, DB, EXT, LOCAL  | P0       | Upload; OCR statuses; correction; report entry; columns/filters/grouping; preview; preset; export; share.                            |
| G20 | Reimport a corrected document                    | OCR-enabled Documents folder                                  | FILE, DB, EXT         | P0       | Original extraction; replacement upload; reconciliation; changed rows; conflict warning; preserved manual correction; evidence link. |
| G21 | Delete, restore and permanently purge a document | Obra Documents → papelera                                     | FILE, DB, DESTRUCTIVE | P1       | Trash action; recovery deadline; restore; audit/history; purge warning. Do not execute purge during normal capture.                  |
| G22 | Upload and view a 3D/BIM model                   | Obra Documents/model viewer                                   | FILE, DB, EXT         | P2       | Supported model upload; APS submission; processing; ready state; viewer load; model navigation.                                      |
| G23 | Manage organization-wide files                   | Dashboard/company files                                       | FILE, DB              | P1       | Explanation of company vs obra files; upload; list; preview; download.                                                               |

### Financial, reporting and analytical work

| ID  | Workflow                                          | Primary surface                                           | Effects              | Priority | Recording checkpoints                                                                                                                    |
| --- | ------------------------------------------------- | --------------------------------------------------------- | -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| G24 | Manage certificate lifecycle                      | `/certificados` → `/certificados/reporte`                 | DB, LOCAL            | P0       | Filter; add row; obra/number/date/amount; save; invoiced; collected; totals; report; export.                                             |
| G25 | Import and triage insurance policies              | Dashboard/policy table                                    | DB, LOCAL            | P1       | Excel preview; create/update/match/error summary; confirm; unmatched filter; reassign; cancellation fields; save; export.                |
| G26 | Manage policies for one obra                      | `/excel/[obraId]?tab=polizas`                             | DB                   | P1       | Risk states; provisional/definitive cancellation basis; request; confirmation; balance vs coverage distinction.                          |
| G27 | Create and use a macro table                      | `/admin/macro-tables/new` → `/macro` → report             | DB, LOCAL            | P1       | Source mode; mapping; column preview; sidebar toggle; aggregate table; filter/search; override; report/export.                           |
| G28 | Configure and inspect data-flow                   | `/excel/data-flow`, `/excel/[obraId]/data-flow`           | DB                   | P1       | Empty/configured canvas; sources/formulas/results; validation; unsaved badge; traceability; suggestion confirmation; writeback result.   |
| G29 | Customize, export and share a report              | Obra, certificate, table and macro report routes          | DB, LOCAL            | P0       | Filters; hide/reorder columns; visual settings; preset; CSV/XLSX/PDF; expiring share link; anonymous `/r/[token]`.                       |
| G30 | Ask Document AI and generate a formal output      | `/document-ai`                                            | DB, FILE, EXT, LOCAL | P0       | Scope picker; question; streaming answer; tool trace; cited source preview; report card; PDF/PPTX/DOCX/XLSX; history.                    |
| G31 | Generate, review and approve a templated document | `/document-generation`, `/drafts`, `/review`, `/approved` | DB, FILE             | P0       | Context/template; provenance-filled fields; missing-data warnings; draft; generation; review; reject loop; signature approval; download. |
| G32 | Configure document-generation templates           | `/document-generation/config`                             | DB                   | P2       | Template selector; field editor; data aliases; extracted-table bindings; preview; tenant override; test draft.                           |

### Notifications, access, billing and field operations

| ID  | Workflow                                   | Primary surface                                                    | Effects       | Priority | Recording checkpoints                                                                                                                     |
| --- | ------------------------------------------ | ------------------------------------------------------------------ | ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| G33 | Create and resolve reminders/calendar work | Obra pendiente/Flujo → `/notifications`                            | DB, EXT       | P0       | Pendiente form; due date; assignees; reminders; unread notification; metrics; calendar event; edit/move; complete.                        |
| G34 | Create roles and assign permissions        | `/admin/roles`                                                     | DB            | P1       | Role metadata; permission search/matrix; navigation preview; grants/denials; save; assignment; effective access explanation.              |
| G35 | Manage one person's organization access    | `/admin/users`                                                     | DB            | P0       | Person selection; authoritative loading/error; access-level warning; work roles; advanced permissions; direct override; batch assignment. |
| G36 | Subscribe, upgrade or cancel billing       | `/billing`                                                         | DB, EXT       | P1       | Plan/usage; active/pending/blocked states; checkout handoff; return; cancellation-at-period-end warning.                                  |
| G37 | Configure WhatsApp operations              | `/admin/whatsapp`                                                  | DB, EXT       | P2       | Readiness; authorized contact; obra/capability scope; template; flow builder; recurring assignment; limits; history.                      |
| G38 | Capture field data through WhatsApp        | WhatsApp → `/whatsapp/flow/[runId]` or `/whatsapp/respond/[runId]` | DB, FILE, EXT | P1       | Phone menu/template; signed mobile form; validation; upload; submission; thank-you; admin history and obra destination.                   |
| G39 | Support through impersonation              | `/admin/users`                                                     | LOCAL         | P1       | Start warning; impersonation banner; reduced target navigation; read-only diagnosis; return to owner.                                     |
| G40 | Review the audit trail                     | `/admin/audit-log`                                                 | READ          | P1       | Actor/action/entity/time filters; event list; changed fields; permission or delete/restore example.                                       |

## Flagship recording set

1. New customer from zero to ready: G01, G05, and G02.
2. Obra from creation to active work: G06, G08, and G09.
3. Document to structured data to report: G16, G18, and G19.
4. Corrected document to recalculated project decision: G20 plus General KPIs and G28.
5. Insurance import to formal cancellation tracking: G25 and G26.
6. Cross-obra management report: G27 and G29.
7. AI question to downloadable formal deliverable: G30.
8. Generated document draft to signed approval: G31.
9. Reminder from creation to calendar resolution: G33.
10. Field submission from WhatsApp to the obra record: G37 and G38.

## Known capture caveats

- Obra detail currently exposes both `Documentos Legacy` and `Documentos New`. The implemented upload/OCR behavior is associated with the legacy file manager; capture the duplicate labels as a UX issue, not as two equivalent finished products.
- `/dashboard2`, certificate playgrounds, and `/system-design/**` are internal iteration surfaces and must not be presented as current customer workflow proof.
- Spreadsheet upload stores the binary before the user confirms row import.
- A PDF export is a download; it does not mean that the report was archived into Documents.
- OCR, AI, email, WhatsApp, APS, and MercadoPago recordings require configured external services.
- Every workflow marked `DB`, `FILE`, `EXT`, or `DESTRUCTIVE` must run only in a disposable test tenant with explicit authorization.

## Prioritized UX risks to prove in captures

| Priority | Risk                                                                                                                      | Evidence surface                     | Capture proof                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| P0       | Customers see both `Documentos Legacy` and `Documentos New`, but the complete OCR-to-report action exists only in Legacy. | Obra tab bar and both document views | Same folder in both tabs; report action present in Legacy and missing in New.                    |
| P0       | Documentos New has no visible upload button; upload is discoverable only by dragging onto the content surface.            | Empty folder in Documentos New       | Desktop and mobile empty states, followed by a drag-over state.                                  |
| P0       | A newly saved obra retains a temporary client ID and cannot be opened until the user reloads.                             | `/excel` inline creation             | Create, save, click the obra name, and capture the reload instruction.                           |
| P1       | Unsaved General and table edits have no navigation guard.                                                                 | Obra General and dynamic tables      | Edit without saving, navigate away, return, and show the lost draft.                             |
| P1       | Missing table schema instructions point to a nonexistent obra `Tablas` tab.                                               | Both document implementations        | Missing-schema copy next to the actual tab bar.                                                  |
| P1       | Setup can label a still-running provision as a failed provision and offer another retry.                                  | `/setup`                             | Fixture captures for `running`, `partial`, and `ready`.                                          |
| P1       | Setup recovery sends a non-technical customer into the expert tenant-defaults configurator.                               | `/setup` → `/admin/obra-defaults`    | Incomplete card, recovery CTA, and destination complexity.                                       |
| P1       | `Copiar columna` does not explain whether it copied the current page, current filter, or every record.                    | Paginated FormTable                  | Copy in unfiltered and filtered/page states; paste into a neutral scratch area and count values. |
| P2       | Spreadsheet context actions are powerful but invisible until right-click.                                                 | Table cells                          | Right-click discovery; copy value/row/column; edit then restore previous value.                  |
| P2       | Dirty-cell stripes and the tiny hover-only `Sin guardar` label are weak compared with the explicit General save banner.   | FormTable and Obra General           | Clean, one edit, multiple edits, conditional row colors, and the General banner for comparison.  |
| P2       | OCR recovery copy exposes implementation terms such as lineage, materialization, provider, and reconciliation.            | Document detail sheet                | Generic failure, provider failure, and lineage-conflict messages with recovery actions.          |
| P2       | Generated report share links have no one-click copy affordance.                                                           | Report share dialog                  | Before generation, generated URL, and manual-selection-only final state.                         |
| P2       | The report workshop uses a fixed right sidebar and crowded single-row action toolbar.                                     | Report workbench                     | Same report at 1440, 1024, 768, and mobile widths.                                               |
| P3       | Blank optional numbers in first-obra setup can become real zero values instead of unknown values.                         | First-obra dialog → General/table    | Leave optional values blank, create only with authorization, then inspect persisted values.      |

## FigJam destinations

- [Product OS / dashboard](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P)
- [Journeys 01 / Inicio y Obras](https://www.figma.com/board/W6SZcSjlbhn1XdFLSktU03)
- [Journeys 02 / Datos y Reportes](https://www.figma.com/board/8dX4sV8kJYDwf1qa1jY5zb)
- [Journeys 03 / Documentos y Automatización](https://www.figma.com/board/nnPSyRwgsNseS3cm9BIMTp)
- [Journeys 04 / Plataforma y Acceso](https://www.figma.com/board/ySjUIomuoMG00LNK0sKajF)
- [Screenshots actuales](https://www.figma.com/board/mC50ck1vEmJzOvrdW9s9AU)

## Capture batches

| Batch | Scope                                                 | Current status                                                                                                                                       |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01   | Public landing and authentication, desktop and mobile | Sanitized screenshots and two short GIF walkthroughs captured locally; awaiting FigJam edit access.                                                  |
| C02   | Current read-only customer surfaces                   | Existing screenshots already visible on the screenshots board; new static playground captures rejected after visual QA because of render corruption. |
| C03   | Tenant onboarding and first obra                      | Awaiting app sign-in and explicit disposable-record authorization.                                                                                   |
| C04   | Obra edit and daily work                              | Awaiting app sign-in and explicit disposable-record authorization.                                                                                   |
| C05   | Upload, OCR, correction and report                    | Awaiting app sign-in, a disposable source file, configured OCR, and explicit disposable-record authorization.                                        |
| C06   | Atomic table, form, document and report interactions  | Inventory in progress; read-only/clipboard actions can be captured after app sign-in.                                                                |
