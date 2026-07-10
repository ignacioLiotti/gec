# Atomic Feature Capture Catalog

This checklist covers small, independently demonstrable product behaviors. Pair it with [the general workflow catalog](./feature-capture-catalog.md). Every capture should show `baseline → trigger → visible response → reset/recovery` and use sanitized data.

Risk levels:

- `R0`: read-only UI or navigation.
- `R1`: browser-local state, clipboard, download, or an unsaved draft.
- `R2`: database or storage mutation after final confirmation.
- `R3`: consequential processing, external service use, or an externally accessible artifact.

## Shared editable table engine

Canonical surfaces are `/excel`, OCR folder tables, and document extracted-data sheets. The main implementation is under `components/form-table/**`.

| ID   | Atomic feature                | Trigger and expected result                                                                                      | Risk            | Capture                                        |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------- |
| A001 | Activate editable cell        | Click a passive editable cell; it becomes its typed input/control and receives focus.                            | R1              | Short video: passive → focused editor.         |
| A002 | Arrow-key navigation          | Press arrows from an active cell; focus moves one visible row/column and virtualized content scrolls into view.  | R1              | Keyboard video in all four directions.         |
| A003 | Enter opens linked cell       | Focus a passive linked designation and press Enter; obra detail opens.                                           | R0              | Keyboard video with route change.              |
| A004 | Automatic format suggestion   | Type a recognizable malformed date/number/currency/select value; an amber `Sugerencia` control appears.          | R1              | Video of input → badge/popover.                |
| A005 | Apply format suggestion       | Choose `Aplicar`; the field adopts the normalized typed value.                                                   | R1              | Detected/suggested comparison and result.      |
| A006 | Ignore format suggestion      | Choose `Ignorar`; the popover closes and the current draft remains.                                              | R1              | Short video.                                   |
| A007 | Dirty-cell highlight          | Change and blur a cell; diagonal amber treatment appears.                                                        | R1              | Before/after close-up.                         |
| A008 | Dirty-row highlight           | A changed cell gives its row an amber surface and `Sin guardar` marker/tooltip.                                  | R1              | Full-row and close-up screenshots.             |
| A009 | Cell context menu             | Activate then right-click a cell; `Acciones de celda` appears with the column name.                              | R0              | Discovery video.                               |
| A010 | Copy cell value               | Choose `Copiar valor`; clipboard toast appears.                                                                  | R1              | Menu, toast, and safe paste.                   |
| A011 | Copy visible column           | Choose `Copiar columna`; newline-separated values from processed/rendered rows are copied.                       | R1              | Compare page/filter states and paste count.    |
| A012 | Copy row as CSV               | Choose `Copiar fila (CSV)`; semicolon-delimited visible values are copied.                                       | R1              | Menu, toast, and safe paste.                   |
| A013 | Restore previous cell value   | Right-click a dirty existing cell and choose `Restaurar valor previo`; its dirty state clears if fully restored. | R1              | Dirty → restore video.                         |
| A014 | Clear cell value              | Choose `Limpiar valor`; the empty draft is applied and marked dirty.                                             | R1              | Populated → cleared → highlighted.             |
| A015 | Drag-select cells             | Drag vertically across editable cells in one column; selected cells and the bulk bar turn amber.                 | R1              | Three-to-five-cell selection video.            |
| A016 | Typed bulk edit               | Enter/select a value in the bulk bar and apply; every selected cell changes and remains dirty until save.        | R1              | Selection → input → apply → result.            |
| A017 | Cancel bulk selection         | Press the bulk bar X; selection clears without value changes.                                                    | R1              | Short video.                                   |
| A018 | Search and highlight matches  | Enter a query; show `Buscando...`, updated count, filtered rows, and highlighted text.                           | R0              | Baseline count → query → result.               |
| A019 | Status tabs with counts       | Select `Todas`, `En proceso`, or `Completadas`; active tactile tab, count, and first page update.                | R0/R1           | Three-state video.                             |
| A020 | Advanced filter sheet         | Open `Filtros`; draft changes stay isolated until `Aplicar`, then table/count badge update.                      | R0              | Open → draft → apply.                          |
| A021 | Text filter operators         | Contains, not contains, exact, starts/ends with, empty/not empty.                                                | R0              | Operator menu plus one outcome.                |
| A022 | Number/range filter operators | Equal, greater, less, between, empty/not empty; between exposes Min/Max.                                         | R0              | Single value → range video.                    |
| A023 | Date filter operators         | Exact, before/after, range, relative periods, overdue, empty/not empty.                                          | R0              | Menu plus a relative-period outcome.           |
| A024 | Boolean and enum filters      | `Cualquiera / Sí / No`, include/exclude enum selections.                                                         | R0              | Screenshot or short video.                     |
| A025 | Obras filter groups           | Expand Superficie, Entidad, Fechas, Importes, and Plazos; each group reports active criteria.                    | R0              | Scrolling filter-sheet video.                  |
| A026 | Header click sorting          | Click a sortable heading; ascending/descending icon and row order change.                                        | R0              | Unsorted → ascending → descending.             |
| A027 | Header sort context menu      | Right-click a heading for explicit ascending, descending, and remove-sort actions.                               | R0              | Menu video.                                    |
| A028 | Clear active sort             | Click `Limpiar orden`; restore unsorted state.                                                                   | R0              | Short video.                                   |
| A029 | Column visibility             | `Columnas` toggles individual columns or all columns; table updates immediately.                                 | R1              | Hide one → show all.                           |
| A030 | Pin and unpin column          | Toggle pin; column stays sticky during horizontal scroll and preference persists.                                | R1              | Pin → scroll proof → unpin.                    |
| A031 | Balance widths                | Click `Balancear ancho`; visible widths redistribute.                                                            | R1              | Before/after video.                            |
| A032 | Manual column resize          | Drag a header divider; width follows the pointer.                                                                | R1              | Pointer video.                                 |
| A033 | Add empty row                 | `Agregar fila vacía`; a draft row appears and relevant filters/search/sort may clear.                            | R1              | Add then discard without saving.               |
| A034 | Delete row locally            | Trash an unsaved/disposable row; it disappears from the draft and is only persisted on save.                     | R1/R2           | Remove then discard.                           |
| A035 | Discard all table edits       | `Descartar cambios`; rows and order return to the initial snapshot.                                              | R1              | Multiple dirty edits → clean state.            |
| A036 | Save table edits              | `Guardar cambios` shows progress; success clears dirty marks, failure preserves edits and exposes error.         | R2              | Authorized success plus simulated error state. |
| A037 | Export table CSV              | `Exportar`; a UTF-8 semicolon CSV downloads and toast appears.                                                   | R1              | Toolbar and downloaded filename.               |
| A038 | Change page size              | Change `Filas por página`; count and page content update.                                                        | R0              | Two sizes.                                     |
| A039 | Navigate pagination           | Previous/next updates `Página X de Y` and shown count; endpoints disable.                                        | R0              | First → next → previous.                       |
| A040 | Loading/activity indicator    | Empty initial fetch uses full synchronization state; populated slow work uses compact activity status.           | R0              | State pair.                                    |
| A041 | Empty table state             | No matching rows show the configured empty message with active filters nearby.                                   | R0              | Screenshot.                                    |
| A042 | Server error state            | Failed fetch/save shows inline destructive message plus toast/recovery.                                          | R0 if simulated | Screenshot.                                    |
| A043 | Read-only table state         | Mutation controls disappear while allowed view/search/sort/export controls remain.                               | R0              | Editable/read-only comparison.                 |

## Obras-specific interactions

| ID   | Atomic feature                  | Trigger and expected result                                                                                     | Risk  | Capture                                                 |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------- |
| A044 | Open obra from designation menu | Right-click designation and select `Abrir detalle de la obra`.                                                  | R0    | Menu → route video.                                     |
| A045 | Quick row-color rule            | Right-click configured numeric cell and create a `>=` or `<=` rule; matching rows gain semantic color overlays. | R1    | Rule creation, colored rows, then reset local storage.  |
| A046 | CSV import picker               | Click `Importar CSV`; multi-file picker opens.                                                                  | R1    | Open then cancel.                                       |
| A047 | CSV import preview              | Choose sanitized CSV; right sheet shows filename, obra count, normalized sample, skips/errors.                  | R1    | Preview then cancel.                                    |
| A048 | Confirm obra CSV import         | Confirm preview; loading, toast, and refreshed rows appear.                                                     | R2    | Disposable tenant only.                                 |
| A049 | Obra tab URL persistence        | Switch General/Pólizas/Flujo/Documents; selected tab and `tab` query update without a full reload.              | R0    | Video including address bar.                            |
| A050 | General preview/edit toggle     | Toggle `Vista previa` and `Edición`; cards become inputs while values remain.                                   | R1    | Two-mode video.                                         |
| A051 | General-field dirty highlight   | Change a field; affected input/card gets amber unsaved treatment.                                               | R1    | Before/after screenshot.                                |
| A052 | Sticky unsaved-change bar       | Any General edit produces the persistent `Tenés cambios sin guardar` action bar.                                | R1    | Edit → bar animation.                                   |
| A053 | Discard obra form               | Cancel/discard restores the initial snapshot and hides the bar.                                                 | R1    | Edit → discard.                                         |
| A054 | Save obra form                  | Save shows progress and success; progress-related fields may trigger domain effects.                            | R2/R3 | Disposable obra only.                                   |
| A055 | Progress recommendation         | `Valor recomendado` explains a derived progress value; applying it updates only the local draft.                | R1    | Recommendation → apply → dirty state.                   |
| A056 | Finish obra                     | At 100%, `Terminar obra` confirms and persists completion/policy recalculation.                                 | R3    | Confirmation only unless explicitly authorized.         |
| A057 | Memoria panel toggle            | `Memoria` opens/closes the notes surface.                                                                       | R0    | Open/close video.                                       |
| A058 | Curve editor and import preview | Open editor, change mode, add/discard draft rows, or preview a spreadsheet.                                     | R1/R2 | Record through discard; import only with authorization. |

## Documents, OCR and spreadsheet extraction

Canonical surface: `/excel/[obraId]?tab=documentos` and `app/excel/[obraId]/tabs/file-manager/**`.

| ID   | Atomic feature                      | Trigger and expected result                                                                                       | Risk           | Capture                        |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------ |
| A059 | Select folder and lazy-load         | Click a folder; selected state, title/count, skeleton, then contents appear.                                      | R0             | Click → loading → result.      |
| A060 | Expand/collapse folder              | Chevron expands or collapses a non-OCR nested folder.                                                             | R0             | Short video.                   |
| A061 | Return to parent                    | Header back button returns to the named parent or all documents.                                                  | R0             | Short video.                   |
| A062 | Files/table toggle                  | In OCR folders, `Archivos` shows cards and `Tabla` shows extracted rows.                                          | R0             | Surface-swap video.            |
| A063 | Empty folder state                  | Folder illustration, `Esta carpeta está vacía`, and upload action appear.                                         | R0             | Screenshot.                    |
| A064 | Open upload picker                  | `Subir archivos` opens the picker; selecting a file begins upload.                                                | R1/R2          | Open then cancel.              |
| A065 | Drag-and-drop upload                | Drag-over shows amber target; drop uploads and may start extraction.                                              | R2/R3          | Disposable file only.          |
| A066 | Drop into a specific folder         | Folder gains target ring and receives the dropped file.                                                           | R2/R3          | Disposable file/folder.        |
| A067 | Drag folder to move                 | Source fades, target highlights, and drop changes storage/tree path.                                              | R3             | Disposable hierarchy only.     |
| A068 | File/folder context menu            | Right-click opens contextual actions at the pointer and outside click dismisses it.                               | R0             | Short video.                   |
| A069 | Open create-folder dialog           | `Crear carpeta` opens the normal-folder form.                                                                     | R0/R2          | Open, inspect, cancel.         |
| A070 | Open create-data-folder dialog      | `Crear carpeta de datos` exposes extraction method, template, and columns.                                        | R0/R3          | Scroll through, then cancel.   |
| A071 | Move nested folder to root          | `Mover a Documentos` immediately changes its parent.                                                              | R3             | Disposable folder only.        |
| A072 | Open data table from folder         | `Ver tabla de datos` opens the table surface.                                                                     | R0             | Menu → table.                  |
| A073 | Add extraction table to folder      | Opens configuration; submit creates/reprocesses extraction.                                                       | R0/R3          | Dialog only unless authorized. |
| A074 | Permission-gated delete             | Folder delete is hidden without permission; file delete follows the current file contract.                        | R0             | Role comparison.               |
| A075 | Trash confirmation                  | Consequence dialog explains children and 30-day recovery.                                                         | R0/R2          | Open then cancel.              |
| A076 | Trash list                          | Shows deleter/date/recovery deadline, descendants/thumbnail, and expired/recoverable state.                       | R0             | Screenshot.                    |
| A077 | Restore deleted entry               | Restore spinner completes and the item returns.                                                                   | R2             | Disposable item only.          |
| A078 | Download one document               | Preview toolbar starts a browser download.                                                                        | R1             | Short video.                   |
| A079 | Download folder ZIP                 | `Descargar todos` becomes `Generando ZIP…` and downloads an archive.                                              | R1             | Small sanitized folder.        |
| A080 | Open document sheet                 | Click a file card; detail sheet opens with name, uploader/date, and preview.                                      | R0             | Card → sheet video.            |
| A081 | Previous/next document              | Floating arrows move through adjacent documents and disable at ends.                                              | R0             | Short sequence.                |
| A082 | File-type preview fallback          | PDF, image, workbook, CSV/text, DOCX, model, and unsupported types select appropriate preview/download treatment. | R0             | Sanitized contact sheet.       |
| A083 | Spreadsheet sheet tabs              | Workbook sheet buttons change the rendered grid.                                                                  | R0             | Short video.                   |
| A084 | PDF/image zoom                      | Plus/minus adjust 50–300%; image can pan.                                                                         | R0             | Zoom/pan video.                |
| A085 | Fit to width and rotate             | Fit resizes the document and rotate advances 90°.                                                                 | R0             | Short video.                   |
| A086 | PDF page controls                   | Previous/next, page input, and optional thumbnails navigate pages.                                                | R0             | Short video.                   |
| A087 | PDF keyboard controls               | Arrow/PageUp/PageDown, `+`, `-`, and `0` navigate, zoom, and reset outside editors.                               | R0             | Keyboard video.                |
| A088 | OCR status badges                   | Pending, processing, failed, lineage conflict, and unprocessed states appear across tree/card/sheet.              | R0             | Sanitized state contact sheet. |
| A089 | OCR scan overlay                    | During upload/extraction, preview shows scanning animation and queue/processing pill.                             | R0 observation | 8–12 second video.             |
| A090 | Retry one OCR document              | `Reprocesar OCR` disables with spinner, then refreshes result or recovery state.                                  | R3             | Disposable document.           |
| A091 | Reprocess all OCR                   | Confirmation warns existing results will be replaced; progress, error count, and cancel-remaining appear.         | R3             | Disposable folder only.        |
| A092 | Show/hide extracted data            | `Ver datos` opens a nonmodal side-by-side sheet and shifts preview; `Ocultar datos` closes it.                    | R0             | Video.                         |
| A093 | Select extracted table              | Multi-table selector changes active table and row count.                                                          | R0             | Video.                         |
| A094 | Edit OCR cell                       | Edit a cell; typed control, dirty stripe, and table save controls appear.                                         | R1             | Edit then discard.             |
| A095 | Save OCR corrections                | Save writes dirty/deleted/manual rows, refreshes tree, and clears dirty marks.                                    | R2             | Disposable extraction.         |
| A096 | Source-document hover preview       | Hover a source cell; lazy thumbnail and path appear.                                                              | R0             | Hover-delay video.             |
| A097 | Filter rows by source document      | Source context menu adds amber `Filtrando:` badge; `Ver todos` clears it.                                         | R0             | Filter → clear.                |
| A098 | Open source document from row       | Source context menu opens the source document sheet.                                                              | R0             | Short video.                   |
| A099 | Generate report from OCR table      | `Generar reporte` opens the table report route.                                                                   | R0             | Transition video.              |
| A100 | Select multiple target tables       | OCR/spreadsheet chooser enables Continue only for selected targets.                                               | R1/R3          | Select/deselect then cancel.   |
| A101 | Select PDF pages for OCR            | Page grid supports all, clear, individual selection, and disabled Continue with none.                             | R1/R3          | All → clear → one → cancel.    |
| A102 | Spreadsheet import summary          | Overall ready/review/no-data status and per-section cards appear.                                                 | R0             | Overview screenshot.           |
| A103 | Exclude/include spreadsheet section | `No importar` turns card amber; `Volver a incluir` reverses it.                                                   | R1             | Video.                         |
| A104 | Expand extracted preview            | `Ver más` reveals extra rows/columns; `Ver menos` collapses.                                                      | R0             | Video.                         |
| A105 | Manual summary correction           | Edit, validate, press Enter/blur; preview override gets a `Manual` badge.                                         | R1/R2          | Edit → validation → badge.     |
| A106 | Open adjustment drawer              | `Ajustar` opens source workbook and extracted result side by side.                                                | R0             | Video.                         |
| A107 | Change source worksheet             | Choose a sheet; preview reloads and controls disable while working.                                               | R1             | Loading checkpoint.            |
| A108 | Show advanced mapping               | `Mostrar` reveals DB-to-Excel mappings; `Ocultar` collapses them.                                                 | R0             | Video.                         |
| A109 | Map with dropdown                   | Choose an Excel header; source/result highlights and preview update.                                              | R1             | Video.                         |
| A110 | Map with crosshair                  | Activate blue pick mode, hover a column, click it, and show mapped amber cells.                                   | R1             | Flagship atomic video.         |
| A111 | Virtualized workbook grid           | Scroll a large workbook; sticky headers remain while visible cells render.                                        | R0             | Diagonal-scroll video.         |
| A112 | Confirm spreadsheet import          | Import selected/ready sections; show progress and result summary.                                                 | R3             | Disposable workbook only.      |
| A113 | Spreadsheet preview states          | Detecting, sheet loading, parse/download error, empty, review warning, and ready.                                 | R0             | State contact sheet.           |

## Report workshop

Shared implementation: `components/report/report-page.tsx` and `components/report/report-table.tsx`.

| ID   | Atomic feature             | Trigger and expected result                                                          | Risk | Capture                                           |
| ---- | -------------------------- | ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------- |
| A114 | Live document metadata     | Edit Empresa, Fecha, or Descripción; paper header updates immediately.               | R1   | Split-view video.                                 |
| A115 | Quick filter               | Enter and apply a quick value; row count and paper update.                           | R1   | Before/apply/result.                              |
| A116 | Grouped report             | Choose ungrouped or group shortcut; preview becomes titled sections.                 | R1   | Video.                                            |
| A117 | Group sorting              | Select group sort field/direction; section order changes.                            | R1   | Video.                                            |
| A118 | Report column visibility   | Toggle columns; workshop count and preview update.                                   | R1   | Video.                                            |
| A119 | Column aggregation         | Choose supported aggregation; totals row/card updates.                               | R1   | Video.                                            |
| A120 | Report header sorting      | Click heading; chevron and order update.                                             | R1   | Video.                                            |
| A121 | Compare prior period       | Enable comparison; totals show signed delta and percentage where supported.          | R1   | Before/after screenshot.                          |
| A122 | Report filter variants     | Text, number, date, select, multi-select, and boolean controls change filter drafts. | R1   | Control contact sheet.                            |
| A123 | Apply/reset report filters | Apply changes preview; reset clears and toasts.                                      | R1   | Video.                                            |
| A124 | Apply saved filter         | Select a saved filter; inputs and preview update.                                    | R1   | Video.                                            |
| A125 | Save filters               | Name and persist the current filter setup.                                           | R2   | Disposable saved filter.                          |
| A126 | Summary style              | Toggle `Fila total` and `Tarjeta`.                                                   | R1   | Video.                                            |
| A127 | Mini charts                | Enable charts and switch bar/line style.                                             | R1   | Video.                                            |
| A128 | Save report preset         | Name and persist report state; it appears in preset list.                            | R2   | Disposable preset.                                |
| A129 | Apply preset/template      | Select preset/template; workshop and preview update.                                 | R1   | Video.                                            |
| A130 | Delete preset              | Trash a disposable saved preset.                                                     | R2   | Authorized disposable state.                      |
| A131 | Export report CSV          | Toolbar download starts.                                                             | R1   | Video.                                            |
| A132 | Export report Excel        | Spinner ends in XLSX download or error toast.                                        | R1   | Video.                                            |
| A133 | Generate PDF               | `Generando...` ends in download or error toast.                                      | R1   | Video.                                            |
| A134 | Share report               | Choose expiry and generate an externally accessible URL.                             | R3   | Explicit authorization; redact token in captures. |
| A135 | Read-only shared report    | Editing/share/workshop controls are disabled while preview/export remain.            | R0   | Editable/read-only comparison.                    |
| A136 | Report loading/empty/error | Show paper spinner, no-data state, and load error.                                   | R0   | State triptych.                                   |

## Responsive navigation and permission outcomes

| ID   | Atomic feature                      | Trigger and expected result                                                                           | Risk | Capture                                   |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| A137 | Mobile navigation sheet             | Mobile header trigger opens full-height `Navegación`; close or route change dismisses it.             | R0   | Mobile video.                             |
| A138 | Desktop sidebar expansion           | Hover/focus expands icon sidebar; leave/blur collapses; reduced-motion removes animation.             | R0   | Desktop video plus reduced-motion check.  |
| A139 | Tenant selector                     | Dropdown lists organizations, active check, switching spinner, and setup/create actions when allowed. | R1   | Use existing safe tenants; do not create. |
| A140 | Macro navigation collapsed mode     | Expanded sidebar uses collapsible list; icon sidebar uses a right-side dropdown.                      | R0   | Two-state video.                          |
| A141 | Documents navigation collapsed mode | Same adaptive collapsible/dropdown behavior for document routes.                                      | R0   | Two-state video.                          |
| A142 | Permission-filtered navigation      | Unauthorized routes disappear rather than becoming dead links; admin section is role-gated.           | R0   | Role comparison.                          |
| A143 | Permission-gated folder delete      | Folder delete is absent without permission while allowed file actions remain.                         | R0   | Role comparison.                          |
| A144 | Read-only table permission outcome  | Mutation controls/context actions disappear; view tools remain.                                       | R0   | Screenshot pair.                          |
| A145 | Read-only report permission outcome | Share/workshop controls disable; preview/export remain.                                               | R0   | Screenshot pair.                          |
| A146 | Processing-disabled controls        | Retry/import/save/mapping/pagination/navigation controls disable during work.                         | R0   | State contact sheet.                      |

## Reachability caveats

- `RowRulesDialogTrigger` exists in code but its toolbar action is commented out. Only cell-menu quick row-color rules are currently reachable.
- The visible file-tree sidebar is commented out in the canonical file-manager layout in current code; capture the deployed surface rather than assuming it is active.
- `Documentos Legacy` contains the audited file manager. `Documentos New` is a separate surface and must not be described as feature-equivalent.
- `Copiar columna` operates on currently processed/rendered rows and may be limited to the current page. Do not label it as the entire dataset without runtime verification.
- Opening dialogs and editing drafts is generally safe. Dropping uploads, moving/trashing/restoring items, OCR retries, imports, saves, finishing obras, persisting filters/presets, and generating share links require disposable data and explicit authorization.
