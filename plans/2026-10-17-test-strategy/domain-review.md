# Revisión de pruebas de dominio

Fecha: 2026-10-17  
HEAD revisado: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`

## Alcance y criterio

Se revisaron 21 archivos, 130 declaraciones de test y 142 ejecuciones de casos (los `it.each` de `locale-number` y `document-generation-server` expanden 12 casos adicionales). La revisión cubre el bloque de dominio de `tests/lib` salvo billing, security, access/permissions y `tests/lib/http/validation.test.ts` (asignado al reviewer raíz), más `tests/app/document-generation/editor-session.test.ts`. Se leyeron los imports directos de producción; no se infirieron disposiciones por nombre o tamaño de archivo.

Quedaron fuera, porque pertenecen a la revisión de seguridad/acceso/billing: `tests/lib/admin/tenant-limit-access.test.ts`, `tests/lib/billing/*`, `tests/lib/impersonation-access.test.ts`, `tests/lib/obras/permissions.test.ts`, `tests/lib/permission-simulation.test.ts`, `tests/lib/pre-tenant-routes.test.ts`, `tests/lib/security/rate-limit.test.ts`, `tests/lib/superadmin.test.ts` y `tests/lib/tenant-switch-*.test.ts`.

La suite de este bloque contiene bastante cobertura útil. Las pruebas pequeñas de parsing, fechas, dinero, identidad de filas y precedencia de estados detectan defectos plausibles y no conviene borrarlas por ser unitarias. Los problemas principales son otros:

1. Los mocks de Supabase en generación documental, data flow y writeback devuelven datos por nombre de tabla pero ignoran los filtros `.eq(...)`. Por eso no prueban aislamiento por tenant/obra/estado.
2. Un test de extracción documental usa el input ambiguo `10/05/2026` y fija como resultado 5 de octubre debido a `new Date(value)`. Si el editor entrega ISO desde un input HTML, ese fixture está fuera del contrato; si se acepta DMY, la expectativa es incorrecta. En ambos casos debe reemplazarse por un contrato explícito, sin inferir aquí un cambio de producción.
3. Los renderers DOCX/PPTX se consideran correctos si devuelven cualquier `Uint8Array`, incluso uno vacío.
4. La sincronización OCR, el borrado/restauración de obra y la persistencia de writeback tienen lógica de efectos considerable, pero hoy sólo se prueban helpers o un camino aislado.
5. Hay tres pruebas débiles que deben reemplazarse y una duplicación concreta que puede fusionarse sin perder cobertura.

## Matriz de disposición

| Archivo | Specs / casos ejecutados | Disposición | Riesgo principal |
| --- | ---: | --- | --- |
| `tests/app/document-generation/editor-session.test.ts` | 15 / 15 | KEEP + REWRITE 1 | bootstrap no verifica el target que dice instalar |
| `tests/lib/document-generation.test.ts` | 22 / 22 | KEEP + REWRITE 2 | fixture de fecha ambiguo; CSS verificado por strings internos |
| `tests/lib/document-generation-server.test.ts` | 5 / 8 | REWRITE harness | mock ignora tenant, obra y predicados |
| `tests/lib/document-ai.test.ts` | 9 / 9 | KEEP + REWRITE renderer proof | bytes vacíos pasan como documento válido |
| `tests/lib/data-flow-builder.test.ts` | 16 / 16 | KEEP + REWRITE harness | consultas no están acotadas realmente por el mock |
| `tests/lib/data-flow-writeback.test.ts` | 1 / 1 | REWRITE/EXPAND | sólo prueba el caso de no inserción y sin scope real |
| `tests/lib/lineage.test.ts` | 3 / 3 | KEEP | faltan business key y conflicto irreconciliable |
| `tests/lib/tablas.test.ts` | 14 / 14 | KEEP | falta conectar coerción de fecha con extracción |
| `tests/lib/locale-number.test.ts` | 2 / 11 | KEEP | falta decidir explícitamente si vacío significa cero |
| `tests/lib/ocr-row-policy.test.ts` | 6 / 6 | KEEP | faltan profile `materials`, preset y límites inválidos |
| `tests/lib/ocr-template-sync.test.ts` | 2 / 2 | KEEP/EXPAND | no prueba propagación ni preservación de filas persistidas |
| `tests/lib/macro-table-source-selection.test.ts` | 4 / 4 | KEEP/EXPAND | faltan selección por nombre, dedupe y fallback |
| `tests/lib/macro-table-filters.test.ts` | 2 / 2 | MERGE | normalización slash se prueba dos veces en capas contiguas |
| `tests/lib/spreadsheet-preview-summary.test.ts` | 5 / 5 | KEEP/EXPAND | faltan secciones unknown/empty y `canImportAll=false` |
| `tests/lib/insurance-policies.test.ts` | 1 / 1 | KEEP/EXPAND | sólo cubre un formato y un tomador |
| `tests/lib/insurance-policy-status.test.ts` | 4 / 4 | KEEP | faltan igualdad del vencimiento y timezone límite |
| `tests/lib/sample-analysis.test.ts` | 5 / 5 | KEEP | faltan selecciones desconocidas y dedupe de ejemplos |
| `tests/lib/tenant-blueprints/standard-construction.test.ts` | 2 / 2 | REWRITE 1, KEEP 1 | conteos exactos fallan ante ampliaciones legítimas |
| `tests/lib/tenant-setup-status.test.ts` | 6 / 6 | KEEP | faltan `running`, teamReady y límites superiores |
| `tests/lib/obras/delete-lifecycle.test.ts` | 4 / 4 | KEEP/EXPAND | no prueba soft-delete/restore ni storage/auditoría |
| `tests/lib/excel/obra-csv-import.test.ts` | 2 / 2 | KEEP/EXPAND | faltan comillas, multilinea, múltiples archivos y errores |

## Revisión por archivo

### `tests/app/document-generation/editor-session.test.ts`

**Entrada de producción:** `app/document-generation/editor-session.ts`, mediante `createEditorSession`.  
**Tests (15):** `acknowledges only the saved revision and preserves an edit made while saving`; `records every buffered inline edit before blur`; `atomically installs a bootstrap-resolved folder and document type`; `keeps a late create identity across a consecutive template switch without applying old input`; `does not adopt an old identity after leaving and re-entering the same coordinates`; `drops a queued command when its context changes before transport starts`; `holds one write lane across save-before-generate and preserves newer edits`; `uses a late create identity to save the active template before generation`; `discards late assistance, ends the operation, and autosaves the newer edit`; `does not retry a failed autosave until the next edit and guards duplicate saves`; `suppresses obsolete assist and generate failures after a context change`; `suppresses generation validation from an older revision`; `suppresses completion work after its final subscriber unmounts`; `suppresses an autosave error callback after unmount`; `never autosaves or saves a generated-document editing target`.

**Comportamiento y mocks:** simula `persistDraft`, `assist`, `generate` y `persistOptions` con promesas diferidas. Observa snapshot, revisiones, draft identity, lane serial, cancelación lógica por cambio de contexto/unmount y bloqueo de guardado para documentos generados. Son invariantes de estado concurrente visibles para el editor y tienen alto valor.

**Disposición:** KEEP el archivo. REWRITE `atomically installs a bootstrap-resolved folder and document type`: sólo comprueba `inputData`, `draftId` y `operation`; una mutación que ignore por completo el `target` hidratado sigue pasando. Debe comprobar `snapshot.target.folderPath`, `documentType` y `templateId` en una única notificación. `records every buffered inline edit before blur` prueba el contrato de `edit`, pero no prueba blur ni integración del componente: conservar el comportamiento y renombrar el caso o agregar una prueba de UI.

**Mutaciones:** si el save tardío pisa `revision two`, si se reutiliza una identidad al volver a coordenadas antiguas, si autosave reintenta en loop o si generate corre en paralelo con save, los tests fallan. Una refactorización que cambie la cola interna pero preserve snapshots/resultados debe pasar. Los asserts de orden exacto en `uses a late create identity...` fijan algo observable (orden de escrituras externas), por lo que son válidos.

**Estados faltantes:** `persistOptions` exitoso y fallido mientras el contexto sigue activo; error de autosave con subscriber activo; generación exitosa y transición completa del snapshot; `dispose` con timer aún no disparado; hydrate de draft existente con edición local pendiente; transporte que normaliza input y no hay una edición más nueva; dos subscribers, donde sólo uno se desmonta; integración React que escriba antes de blur y cambie template rápidamente.

### `tests/lib/document-generation.test.ts`

**Entrada de producción:** exports públicos de `lib/document-generation.ts`; la coerción de filas delega a `lib/tablas.ts`.  
**Tests (22):** `normalizes tenant document types and legacy labels`; `computes formula fields when all referenced values are present`; `defaults the optional purchase-order bonus to zero`; `recomputes purchase-order line totals before rolling them up`; `computes purchase-order line totals when the template omits the formula`; `hydrates default values from schema`; `computes the next folder sequence from existing document input data`; `refreshes stale auto sequence values without lowering manual future values`; `uses only the configured order number for default purchase-order filenames`; `keeps an explicit generated filename ahead of the purchase-order default`; `validates required fields`; `hydrates duplicated template aliases before validation`; `renders placeholders with html escaping`; `renders repeatable groups as html blocks`; `overrides oc template font size from the wrapper scale`; `hydrates and validates table fields with configured columns`; `builds extraction rows from repeatable document items and duplicates parent fields`; `maps extraction table columns through document field aliases`; `maps extraction table columns through explicit template configuration`; `falls back to a single extraction row for flat schemas and computes formulas`; `does not create metadata-only extraction rows when no table column has data`; `hydrates missing document fields from extracted obra rows with source references`.

**Comportamiento y mocks:** no hay mocks externos. Se ejercen normalización de schema/tipo, fórmulas de orden de compra, secuencias, nombre de archivo, validación, alias, escaping HTML, grupos repetibles, extracción de filas y trazabilidad de contexto AI. La mayoría usa entradas y salidas concretas del API público y sobrevive a refactors internos.

**Disposición:** KEEP la mayoría. REWRITE `builds extraction rows from repeatable document items and duplicates parent fields`: el input `10/05/2026` espera hoy `2026-10-05T03:00:00.000Z` porque `coerceValueForType` usa `new Date(value)`. Primero hay que fijar el contrato del caller: si el editor usa `<input type="date">`, el fixture debe ser ISO (`2026-05-10`) y el test debe verificar ese camino; si además se promete aceptar DMY, hace falta un test separado que espere 10 de mayo y una normalización explícita. Esta auditoría no propone cambiar producción ni la expectativa sin esa decisión. REWRITE `overrides oc template font size from the wrapper scale`: buscar strings como `!important` y un nombre de atributo fija la técnica CSS; verificar el HTML parseado/renderizado o un PDF visual donde cambiar la escala cambie el resultado.

**Mutaciones:** quitar escape HTML, no duplicar parent fields, ignorar `extractionFieldKey`, no recalcular totales o bajar manualmente una secuencia futura hacen fallar los tests. Cambiar helpers internos o el orden de propiedades no debería afectarlos. En el caso CSS actual, renombrar una custom property con comportamiento equivalente hace fallar el test: ésa es la señal de acoplamiento.

**Estados faltantes:** contrato de fecha ISO y, sólo si se admite, DMY; fecha inválida y timezone; cero como valor válido frente a vacío; fórmulas con referencia faltante/ciclo/división por cero; select/boolean/date validation; filename con caracteres prohibidos, extensión y colisiones (`withNumericSuffix`); auto-populate distinto de secuencia; firma de aprobación; aliases ambiguos; varias tablas repetibles; extracción que mezcla parent/item con falsos booleanos; fuentes AI conflictivas y dos filas del mismo campo.

### `tests/lib/document-generation-server.test.ts`

**Entrada de producción:** `canEditGeneratedDocument`, `canDeleteGeneratedDocument` y `validateGenerationTarget` de `lib/document-generation-server.ts`.  
**Tests:** 5 specs, 8 ejecuciones: `allows users with create permission to edit %s documents` para cuatro estados; `does not allow editing cancelled documents or editing without create permission`; `allows only the user who generated the document to delete it`; `rejects a virtual tenant folder without a materialized obra extraction table`; `accepts a materialized extraction table with columns`.

**Comportamiento y mocks:** autorización pura y dos caminos de validación con un Supabase chain mock. Ese mock devuelve todas las filas configuradas para una tabla e ignora columnas/valores de `.eq`, `.in` y `.order`.

**Disposición:** KEEP los helpers puros; REWRITE los dos casos de target con un fake sensible a predicados o integración contra Supabase local. Una mutación que elimine `.eq("tenant_id", tenantId)` o use otro `workId` sigue pasando hoy, aunque rompería aislamiento. Una refactorización del orden de queries debería seguir pasando si el estado final es el mismo.

**Estados faltantes:** obra inexistente o de otro tenant; default folder inexistente; document type no permitido; tabla materializada de otra obra; tabla sin columnas; error de DB; path normalizado; configuraciones legacy; user sin permiso en el entrypoint completo. No duplicar aquí las matrices generales de acceso del reviewer de security.

### `tests/lib/document-ai.test.ts`

**Entradas de producción:** parser de intent, continuidad, normalización de OC, compositor, layout plan y renderers en `lib/document-ai/**`.  
**Tests (9):** `parses natural requests into auditable intent`; `keeps certificate and purchase-order intent for financial PDF requests`; `resolves the next certificate draft from previous certificates`; `composes reports with charts, sources, continuity and conflicts`; `composes monthly income vs expense reports from certificates and purchase orders`; `keeps purchase orders without dates outside monthly spending`; `enriches purchase-order dates from auxiliary rows with the same order number`; `reads OCR purchase-order CSV headers with Fecha and Total Orden`; `plans financial reports as visual blocks instead of a flat table dump`.

**Comportamiento y mocks:** no hay mocks de red/modelo; el parser es determinista. Los tests ejercen conciliación mensual, exclusión de OC sin fecha, enriquecimiento por número, aliases OCR y selección de layout. Es cobertura de negocio valiosa.

**Disposición:** KEEP, salvo la prueba de render en `composes reports with charts, sources, continuity and conflicts`: `toBeInstanceOf(Uint8Array)` pasa con un archivo vacío o ZIP corrupto. REWRITE para comprobar tamaño mínimo, abrir el ZIP, validar entradas XML principales y que títulos/cifras/fuentes estén presentes. Idealmente agregar render a PDF/imagen y comparación estructural/visual estable.

**Mutaciones:** incluir OC sin fecha en abril, sumar líneas como órdenes completas, perder fecha enriquecida o elegir layout genérico hace fallar los tests. Reordenar helpers de composición debería pasar. Devolver bytes vacíos no falla hoy.

**Estados faltantes:** dos OC con mismo número y datos conflictivos; duplicados por líneas de una misma OC; moneda/negativos/notas de crédito; periodo sin año; certificados acumulados vs montos del mes; intent sin obra o sin año; cero filas; fuentes/citas incluyendo también las OC (varios fixtures pasan `sources` sólo de certificados); warnings/conflicts concretos; integridad real de DOCX/PPTX.

### `tests/lib/data-flow-builder.test.ts`

**Entrada de producción:** API pública de `lib/data-flow-builder.ts`.  
**Tests (16):** `lists base obra fields plus configured and stored custom fields`; `resolves base fields from the obra row and custom fields from custom_data`; `keeps the original default calculation fields available`; `migrates stored legacy default KPI definitions to the official certificate data-flow`; `preserves explicit tenant overrides for default KPI ids`; `allows local config to delete inherited builder calculations and results`; `builds writeback patches for base and custom obra fields`; `blocks writeback when a result depends on the same obra field`; `resolves latest certificate by fecha_certificacion and ignores null accumulated amounts`; `uses periodo MM/YYYY before falling back to created_at for latest certificates`; `falls back to created_at when business date fields are absent`; `calculates official certificate suggestions for obra 80 values without duplicating current field dependencies`; `blocks percentage suggestion when contract is invalid`; `evaluates text template results from obra fields and can suggest text writeback`; `allows suggested text writeback to the same field used by its template`; `formats text template results as text even if the result was left as number`.

**Comportamiento y mocks:** los helpers puros cubren merge/migración de config, custom fields, plan/patch, ciclos simples y texto. Las evaluaciones usan un mock de `obra_tablas`, `obra_tabla_rows` y `macro_table_sources` que sólo respeta `.in(tabla_id, ...)`; ignora `.eq` de obra/tenant y otros predicados.

**Disposición:** KEEP todos los contratos actuales; REWRITE el harness de evaluación para registrar y aplicar filtros. Los tres tests de fecha son ramas distintas, no duplicación. El caso “obra 80” es un buen ejemplo de resultado integrado y no debe sustituir los casos límite.

**Mutaciones:** ordenar latest por `created_at` antes que `fecha_certificacion`, usar un monto null, escribir sobre la misma dependencia o formatear texto como número falla. Quitar el filtro de `obra_id` no falla actualmente; debe hacerlo. Refactors de evaluación que preserven valores/plan deben pasar.

**Estados faltantes:** filas de dos obras/tenants en la misma respuesta del fake; sources de macro table; agregaciones sum/avg/min/max/count; fechas inválidas y empates; dependencia entre calculations y ciclos largos; alias duplicados; expression error/NaN; source ausente; writeback `none`, `suggest` y `auto` en una misma config; no-op cuando valor destino ya coincide; deleted override de layout; errores de query.

### `tests/lib/data-flow-writeback.test.ts`

**Entrada de producción:** `persistDataFlowWritebackRun` de `lib/data-flow-writeback.ts`.  
**Test (1):** `does not insert duplicate pending suggestions for the same result, field and value`.

**Comportamiento y mocks:** fake de Supabase captura inserts en sugerencias y devuelve una sugerencia pendiente preexistente. Ignora los filtros tenant/obra/status y responde el mismo conjunto para cualquier consulta.

**Disposición:** REWRITE/EXPAND. Conservar la deduplicación, pero agregar un control positivo que inserte cuando cambia valor/result/field, y verificar la fila de run y audit. La deduplicación debería probar tolerancia numérica y valores no numéricos. Una mutación que nunca inserte pasa el único test actual; una mutación que deduplique contra otra obra también pasa.

**Estados faltantes:** run `completed_with_blocks`; audit de auto aplicado y blocked; suggest no duplicada; status no pendiente; misma sugerencia de otro tenant/obra; errores 42P01/42703 traducidos y error genérico propagado; run insert fallido; audit insert fallido; appliedFields parcial; idempotencia de dos ejecuciones concurrentes, que idealmente requiere constraint/DB real.

### `tests/lib/lineage.test.ts`

**Entrada de producción:** `lib/lineage.ts`.  
**Tests (3):** `keeps the same semantic content fingerprint regardless of item order`; `preserves row lineage for equivalent reimports even if the binary file changes`; `uses position fallback to disambiguate repeated identical items`.

**Comportamiento y mocks:** sin mocks. Comprueba fingerprint canónico, estabilidad entre reimports y separación de duplicados. Son invariantes persistentes de negocio, no detalles de hash.

**Disposición:** KEEP. Quitar el sort canónico, incorporar el fingerprint binario a structural identity o no desambiguar duplicados rompe tests. Cambiar SHA-256 por otra implementación estable preservando prefijos/contrato podría requerir migración; no es una refactorización inocua si las keys están persistidas.

**Estados faltantes:** business keys explícitas y precedencia parent/item; whitespace/case/null normalization; `disableStructuralFallback`; conflicto final que lance `LineageReconciliationConflictError` con code/context; reorder de filas con duplicados; cambio real de contenido que sí cambie lineage.

### `tests/lib/tablas.test.ts`

**Entrada de producción:** `lib/tablas.ts`.  
**Tests (14):** cuatro de número/fórmula (`accepts es-AR...`, `keeps supporting US-style...`, `handles grouped integers...`, `evaluates formulas...`); tres de remap (`adds new columns...`, `preserves values when a column key changes...`, `recomputes formulas...`); siete de fecha (`normalizes dotted...`, `uses the current cell year...`, `uses the current cell day...`, `supports textual day-month...`, `falls back to day 01...`, `supports textual day-month values without...`, `supports mixed day-month-name-year...`).

**Comportamiento y mocks:** sin mocks. Los casos son ramas de parsing reales y migración de payload/schema. Aunque son pequeños, una inversión de separadores o pérdida de identidad destruye datos; deben conservarse.

**Disposición:** KEEP. No fusionar fechas distintas como si fueran duplicadas; se pueden parametrizar para legibilidad sin reducir casos. Cambiar helpers internos preservando output pasa. Interpretar `1.000.000` como `1`, perder metadata `__docPath` o usar día/año equivocado falla.

**Estados faltantes:** fechas imposibles/bisiesto y timezone; coerción `date` debe reutilizar la semántica DMY (hoy no lo hace); fórmulas con cero, negativos, referencias ausentes, precedencia/paréntesis y expresiones inválidas; boolean false durante remap; columnas eliminadas; dos columnas con misma identity.

### `tests/lib/locale-number.test.ts`

**Entrada de producción:** `parseArgentineNumber` de `lib/locale-number.ts`.  
**Tests:** 2 specs parametrizados, 11 casos: `parses %s` para vacío, entero, puntos de miles, decimal argentino, decimal US; `rejects %s` para negativos, texto y separadores inválidos.

**Comportamiento y mocks:** sin mocks. Es frontera de ingreso de setup y evita montos/superficies erróneos.

**Disposición:** KEEP. Una mutación que trate todos los puntos como decimales o acepte basura falla; refactorizar regex/normalización pasa. Confirmar con producto si `"" -> 0` es contrato: si vacío significa “sin dato”, cambiar a `null` y ajustar el flujo, no conservar cero por inercia.

**Estados faltantes:** espacios internos/no-break space, `0`, ceros a la izquierda, `1,234` ambiguo, valores enormes, signo positivo y whitespace-only.

### `tests/lib/ocr-row-policy.test.ts`

**Entrada de producción:** `applyOcrExtractionRowPolicy` de `lib/ocr-row-policy.ts`.  
**Tests (6):** `keeps multiple extracted rows by default when the table has item columns`; `still allows forcing a single row explicitly`; `keeps multiple item rows when legacy single-row defaults include maxRows=1`; `defaults to a single row when the table has no item columns`; `respects extractionMaxRows for multi-row OCR tables`; `ignores legacy maxRows=1 when an item table is configured as multiple`.

**Comportamiento y mocks:** sin mocks. Cubre precedencia entre configuración explícita, inferencia por columnas y excepciones legacy. Cada caso representa pérdida potencial de filas, por lo que no es ruido atómico.

**Disposición:** KEEP. Mutar la precedencia o aplicar siempre `slice(0, 1)` falla. Reordenar implementación manteniendo tabla de decisión pasa.

**Estados faltantes:** `ocrProfile=materials`; `spreadsheetPresetKey=pmc_items` sin `hasItemColumns`; arrays vacíos; maxRows como string, cero, negativo, decimal e inválido; single explícito con maxRows > 1; aclarar si la excepción legacy debe depender de provenance/version y no de la combinación de valores solamente.

### `tests/lib/ocr-template-sync.test.ts`

**Entrada de producción:** `deriveTemplateColumnsFromRegions` de `lib/ocr-template-sync.ts`; el archivo productivo también exporta `propagateTemplateUpdate`.  
**Tests (2):** `preserves a single-field key when the region label changes`; `preserves table column keys by region id and position`.

**Comportamiento y mocks:** sin mocks; verifica identidad de columnas durante renombre visual.

**Disposición:** KEEP y EXPAND. Cambiar field keys al cambiar label rompe integraciones y los tests lo detectan; refactorizar el mapa interno pasa.

**Estados faltantes de alta prioridad:** propagación a `obra_default_tablas` y `obra_tablas`; update/insert/delete de columnas; remap de filas preservando datos por `templateColumnId`; settings de tabla primaria y tabla secundaria en `extractedTables`; tenant scope; errores intermedios; región reordenada, agregada o eliminada; dos tablas; column id faltante; preservación de required/dataType/aliases. El nombre “template-sync” promete hoy más cobertura de la que entrega.

### `tests/lib/macro-table-source-selection.test.ts`

**Entrada de producción:** `lib/macro-table-source-selection.ts`.  
**Tests (4):** `extracts the base table name from obra-specific labels`; `infers template mode for legacy macrotables built from one default tabla`; `keeps manual mode when sources come from different templates`; `adds future obra tablas when template mode is active`.

**Comportamiento y mocks:** sin mocks. Prueba migración legacy y auto-inclusión de futuras tablas de obra.

**Disposición:** KEEP. Quitar inferencia legacy, mezclar templates o no sumar tabla futura falla. Refactorizar normalización/dedupe pasa.

**Estados faltantes:** sourceMode persistido debe ganar; selección por `sourceTemplateName` con acentos/case; allowed table names vacíos; candidatos duplicados; candidato sin id; cero candidatos conserva explícitos; nombres con cada separador; manual deduplica sin agregar futuros.

### `tests/lib/macro-table-filters.test.ts`

**Entrada de producción:** `matchesMacroSearchValue` y `matchesMacroSearch` de `lib/macro-table-filters.ts`.  
**Tests (2):** `matches policy numbers regardless of slash spacing`; `matches policy numbers in macro rows with compact formatting`.

**Comportamiento y mocks:** sin mocks. Ambos recorren esencialmente la misma normalización compacta; el segundo además prueba la API de fila/columnas.

**Disposición:** MERGE. Eliminar `matches policy numbers regardless of slash spacing` después de mover su dirección inversa (`value` compacto/query espaciada) al caso de fila. Cobertura retenida: `matches policy numbers in macro rows with compact formatting` seguirá validando búsqueda pública y ambas direcciones. Si `matchesMacroSearchValue` se considera API pública independiente, convertir el archivo a tabla de caracteres/diacríticos en vez de mantener dos ejemplos casi idénticos.

**Mutaciones:** quitar compactación de slash falla; cambiar la implementación de `matchesMacroSearch` sin afectar resultado debe pasar. Faltan diacríticos, columnas omitidas, metadata `_obraName`, query vacía y otros filtros de texto/número/fecha, que son la mayor parte de `macro-table-filters.ts` y no están cubiertos.

### `tests/lib/spreadsheet-preview-summary.test.ts`

**Entrada de producción:** `lib/spreadsheet-preview-summary.ts`.  
**Tests (5):** `detects section types from known field keys`; `marks pmc resumen as review when key values are missing`; `flags an invalid certificate number and exposes the origin label`; `marks pmc items as ready when key columns are populated`; `builds a top-level summary from section statuses`.

**Comportamiento y mocks:** sin mocks. Verifica clasificación, readiness y warnings que el usuario ve antes de importar.

**Disposición:** KEEP/EXPAND. Una mutación que acepte `$-` como certificado, o habilite ready sin monto, falla. Cambiar la estructura interna de scoring pasa si conserva insight.

**Estados faltantes:** `curva`, `generic`, `unknown` y `empty`; inserted=0 con preview; fechas/montos inválidos; fill ratio parcial; source label de archivo/hoja; sample rows truncadas; secciones review excluidas; summary sin secciones y caso `canImportAll=false`.

### `tests/lib/insurance-policies.test.ts`

**Entrada de producción:** `parseInsurancePoliciesWorkbook` de `lib/insurance-policies.ts`; XLSX se usa para construir un workbook real en memoria.  
**Test (1):** `imports producer policy lists grouped by policyholder`.

**Comportamiento y mocks:** no mockea XLSX; prueba título/cutoff, tomador, fila de póliza, fechas y montos en un archivo real. Es un buen test de parser.

**Disposición:** KEEP/EXPAND. Romper detección de header, herencia de tomador o conversión de fecha/monto falla. Refactorizar lectura manteniendo output pasa.

**Estados faltantes:** varios tomadores/pólizas y totales intermedios; otra hoja; workbook exigible; fechas serial Excel; póliza/endoso; moneda y números localizados; obra encontrada/ambigua/no encontrada; fila inválida con error parcial; archivo sin header; cancellation rules; `buildInsurancePolicyRowData` y update al finalizar obra.

### `tests/lib/insurance-policy-status.test.ts`

**Entrada de producción:** `getInsurancePolicyStatus` de `lib/insurance-policy-status.ts`.  
**Tests (4):** `shows expired coverage even when cancellation is scheduled later`; `gives confirmed cancellation precedence over expired coverage`; `keeps the 60 day cancellation window inclusive`; `does not invent a cancellation deadline from coverage or invalid dates`.

**Comportamiento y mocks:** reloj explícito sin fake timer. Cubre precedencia y límite inclusivo, por lo que todos los casos son útiles.

**Disposición:** KEEP. Cambiar orden de precedencia o usar `< 60` falla. Refactorizar cálculo de días pasa.

**Estados faltantes:** endDate igual a hoy; cancellationDate en pasado; timezone cerca de medianoche/DST; ISO con hora; fecha inválida en endDate; labels exhaustivos si son parte del contrato UI.

### `tests/lib/sample-analysis.test.ts`

**Entrada de producción:** `lib/obra-defaults/sample-analysis.ts`.  
**Tests (5):** `keeps only selected fields and table columns`; `drops tables with no selected columns`; `appends answer-derived instructions after the analysis ones`; `returns no lines for defaults that need no special handling`; `maps each variance answer to one instruction line`.

**Comportamiento y mocks:** sin mocks. Convierte la selección revisada por el usuario en ImportedDefinition y crea instrucciones de extracción.

**Disposición:** KEEP. Incluir campos deseleccionados, conservar tablas vacías o perder instrucciones falla. Cambiar composición interna pasa.

**Estados faltantes:** selected keys/labels inexistentes; duplicados; sample values vacíos y dedupe de ejemplos; más de tres ejemplos; dos tablas con mismo label; ninguna selección; warnings y suggestedInstructions vacíos; copy exacto sólo debe fijarse si lo consume el modelo como contrato.

### `tests/lib/tenant-blueprints/standard-construction.test.ts`

**Entrada de producción:** `buildStandardConstructionBlueprint` de `lib/tenant-blueprints/standard-construction.ts`.  
**Tests (2):** `provides the complete, versioned setup baseline`; `uses unique symbolic keys and valid folder references`.

**Comportamiento y mocks:** sin mocks. El segundo prueba invariantes referenciales. El primero mezcla versión/identity con conteos exactos de folders/tables/roles/macros/calculations/results.

**Disposición:** KEEP el segundo. REWRITE el primero: agregar un folder, rol o macro válido rompe el test aunque mejore el blueprint. Sustituir conteos por requeridos concretos (keys/paths/roles/tables/KPIs), versiones y contratos mínimos. Una mutación que reemplaza un recurso requerido por otro manteniendo el mismo conteo pasa hoy; una ampliación inocua falla.

**Estados faltantes:** unicidad de role/macro/calculation/result ids; referencias calculation→result; sourceTableKey y columnas requeridas por cada macro; permisos válidos; compatibilidad entre `obraDefaultsMaterializerVersion` y schema; materialización integrada en tenant temporal.

### `tests/lib/tenant-setup-status.test.ts`

**Entrada de producción:** `getTenantSetupStatus` de `lib/tenant-setup-status.ts`.  
**Tests (6):** `treats the standard blueprint as a completed workspace model`; `completes the essential setup when a first obra exists`; `does not mark a partially provisioned workspace ready`; `keeps a blueprint tenant incomplete while first-obra provisioning is partial`; `requires a ready provisioning record for a blueprint tenant`; `preserves the obra-count fallback for legacy tenants`.

**Comportamiento y mocks:** sin mocks. Prueba estados de onboarding/provisioning y fallback legacy.

**Disposición:** KEEP. Una mutación que considere partial como ready o exija provisioning a legacy falla. Refactorizar cálculo pasa.

**Estados faltantes:** status `running`; `requiresProvisioningHealth=true` con status null; teamReady con segundo miembro; cero tenant; counts mayores al mínimo; todos los pasos incompletos; consistencia de `completedSteps/totalSteps/progress` para cada combinación.

### `tests/lib/obras/delete-lifecycle.test.ts`

**Entrada de producción:** sólo `resolveObraDeleteStatus` de `lib/obras/delete-lifecycle.ts`, aunque el módulo contiene `softDeleteObraWithDocuments` y `restoreSoftDeletedObra`.  
**Tests (4):** `returns purged when purged_at exists`; `returns restored when restored_at exists and not purged`; `returns expired when deadline elapsed`; `returns deleted when still inside restore window`.

**Comportamiento y mocks:** sin mocks. La matriz de precedencia del resolver es correcta y útil.

**Disposición:** KEEP/EXPAND. Quitar precedencia purged/restored o invertir deadline falla. Refactorizar la forma de calcular estado pasa.

**Estados faltantes de alta prioridad:** igualdad exacta con deadline; deadline null/inválido; soft-delete atómico de obra y documentos; rutas de storage movidas a recovery; rollback/compensación ante fallo parcial; restore dentro/fuera de ventana; colisión de path al restaurar; auditoría/eventos; idempotencia de delete/restore repetido. Requiere fake de storage sensible a rutas o integración local, no sólo mocks que devuelvan éxito.

### `tests/lib/excel/obra-csv-import.test.ts`

**Entrada de producción:** `prepareCsvObraImport` y `buildCsvObraUpdates` de `app/excel/_components/obra-csv-import.ts`, con `File` real.  
**Tests (2):** `maps single-row aliases, skips incomplete rows, and normalizes updates`; `maps multi-row grouped headers`.

**Comportamiento y mocks:** no hay mocks de parser; se prueba CSV real, aliases, fechas, número argentino, clamp de porcentaje, skip y headers agrupados.

**Disposición:** KEEP/EXPAND. Romper alias, header depth o normalización falla. Refactorizar parser interno pasa.

**Estados faltantes:** delimitador coma/tab, BOM/encoding, campos entre comillas con separador/newline, archivos múltiples y numeración continua, header ausente/ambiguo, fila parcialmente inválida con mensaje, porcentaje negativo, fecha inválida, decimal con miles y campos extra.

## Candidatos concretos de eliminación o reemplazo

1. **DELETE/MERGE** `tests/lib/macro-table-filters.test.ts` — `matches policy numbers regardless of slash spacing`. Mover la segunda dirección al caso `matches policy numbers in macro rows with compact formatting`. Retiene la cobertura de slash spacing a través de la API de fila y reduce duplicación.
2. **DELETE+REPLACE** `tests/app/document-generation/editor-session.test.ts` — `atomically installs a bootstrap-resolved folder and document type` tal como está, porque no aserta folder ni document type. Reemplazar por una prueba que hidrate el target y luego guarde, verificando que el transporte recibe folder/documentType/template correctos junto con el input; esto prueba el efecto observable y no sólo el snapshot inmediato.
3. **DELETE+REPLACE** `tests/lib/tenant-blueprints/standard-construction.test.ts` — `provides the complete, versioned setup baseline` en su forma de conteos exactos. Retener key/version y recursos requeridos por identidad; `uses unique symbolic keys and valid folder references` ya conserva invariantes de referencias.
4. **DELETE+REPLACE FIXTURE** `tests/lib/document-generation.test.ts` — `builds extraction rows from repeatable document items and duplicates parent fields`: eliminar el input ambiguo `10/05/2026` y su expectativa incidental. Usar ISO si ése es el contrato del editor; agregar un caso DMY separado sólo si el producto lo promete. La cobertura de parent/item, coerción numérica y metadata permanece en el mismo test.

No recomiendo borrar los casos de `tablas`, `locale-number`, `lineage`, `ocr-row-policy`, insurance status o delete status por ser “atómicos”: representan ramas con pérdida de dinero, fechas, filas o identidad, y cada una falla ante una mutación funcional plausible.

## Pruebas nuevas por experiencia real y estado persistido

### 1. Jornada de generación documental

Crear tenant/obra/template/folder materializados en Supabase local; abrir el editor; escribir tres cambios antes de blur; dejar un autosave pendiente; cambiar template; resolver el save viejo; ejecutar asistencia; editar mientras responde; generar. Verificar en UI y DB que:

- el texto más nuevo permanece;
- el draft id no se adopta en un contexto abandonado;
- hay una sola escritura activa y ninguna repetición automática después de error;
- el archivo generado es PDF válido y está en el path esperado;
- las filas de extracción contienen fecha DMY correcta, aliases, parent/item y lineage;
- un reload lee el mismo draft/documento;
- otro tenant no puede usar la obra/tabla del fixture.

Mantener los tests puros de `editor-session` para explorar interleavings deterministas; agregar integración React para blur/template switch y una integración de servicio para DB/storage.

### 2. OCR → schema → import → macro

Crear template con una región parent y una tabla item; materializar tabla; importar dos filas; renombrar labels sin cambiar region ids; propagar template; reimportar archivo binariamente distinto con contenido equivalente. Verificar:

- field keys y datos existentes se preservan;
- nuevas columnas quedan null y eliminadas desaparecen de schema sin corromper metadata;
- dos items permanecen, también con config legacy `single + maxRows=1`;
- lineage keys son estables;
- macro en template mode descubre la tabla de una obra creada después;
- búsqueda `1006726/0` encuentra `1006726 / 0`.

Esta jornada cubre la brecha mayor de `ocr-template-sync`: efectos persistidos y consumidores downstream.

### 3. Data flow y writeback idempotente

Seedear dos tenants y dos obras con tablas PMC. Para la obra objetivo, incluir fechas de negocio fuera del orden de `created_at`, nulls y un empate. Evaluar, persistir suggestion, repetir el run, aceptar/aplicar y reevaluar. Verificar:

- sólo se consultan filas del tenant/obra;
- latest sigue fecha de certificación/periodo y regla de desempate documentada;
- el cálculo oficial produce certified/balance/progress correctos;
- sólo existe una suggestion pending equivalente;
- otra obra puede tener la misma suggestion sin ser deduplicada;
- run y audit registran ready/blocked/appliedFields;
- una falla parcial no deja un estado que la UI presente como aplicado.

El caso concurrente debe usar DB real y constraint/idempotency, porque un fake secuencial no demuestra ausencia de duplicados.

### 4. Spreadsheet/CSV e insurance

Usar fixtures XLSX/CSV mínimos versionados, generados por builder donde sea legible. Importar archivo, revisar preview, confirmar, recargar. Verificar warnings, readiness, counts y filas persistidas. Para pólizas, incluir dos tomadores, total rows, Excel serial date, póliza/endoso, unmatched obra y archivo exigible. Para CSV de obras, incluir quoted separator, BOM, multiline y dos archivos.

### 5. Borrado y restauración de obra

Con obra, documentos y objetos de storage reales en prefijo temporal: borrar, confirmar estado `deleted`, path recovery y deadline; restaurar y comprobar paths/filas; repetir operaciones para idempotencia; avanzar reloj al deadline y verificar `expired`; simular fallo de storage para demostrar compensación o error visible. Este flujo debe validar auditoría y no sólo el resolver puro.

## Fixtures, aislamiento y gates sugeridos

- **Unit gate en cada PR:** parsers, fechas/números, lineage, row policy, config merge, editor-session con fake timers. Sin red ni reloj real.
- **Service integration gate en cada PR relevante:** Supabase local con tenant/obra únicos por test y cleanup en `afterEach`; fakes de storage sólo cuando registren path/body y errores. Queries deben fallar si falta un predicate esperado.
- **Artifact gate:** abrir DOCX/PPTX como ZIP, validar XML y contenido. Para PDF/HTML de documento, smoke de render y una pequeña prueba visual sólo para layout crítico.
- **Playwright smoke:** las cinco jornadas anteriores con setup API determinista y cleanup por tenant/prefijo. No reutilizar datos compartidos ni credenciales reales.
- **Nightly:** matriz amplia de archivos XLSX/CSV, concurrencia de autosave/writeback, restore/storage y render visual. Publicar traces/artifacts sólo al fallar.

La secuencia recomendada es: aclarar y corregir primero el fixture de fecha; endurecer mocks de Supabase; reemplazar los tres tests débiles y fusionar la duplicación de macro search; agregar writeback positivo/audit; cubrir propagación OCR y lifecycle de obra; después sumar las jornadas Playwright. Así la expansión se apoya en contratos confiables en vez de multiplicar tests sobre fakes permisivos.

## Verificación de la auditoría

`pnpm test -- ...` no inició porque el proyecto está configurado para npm. Se ejecutó el mismo conjunto con `npm test --` sobre los 21 archivos revisados: **21 archivos pasaron, 142 tests pasaron**. Este verde confirma el estado actual de la suite; no corrige las debilidades de mutación, mocks permisivos o contratos ambiguos descritas arriba.

## Limpieza completada

Se implementaron los reemplazos de bajo riesgo identificados en esta revisión, sin cambios de producción:

- `macro-table-filters.test.ts`: se eliminó `matches policy numbers regardless of slash spacing` y se conservaron ambas direcciones de espaciado en el caso de búsqueda pública por fila.
- `editor-session.test.ts`: `atomically installs a bootstrap-resolved folder and document type` fue reemplazado por `uses the canonical bootstrap target on the next save`, que observa el target enviado al transporte después de hydrate.
- `standard-construction.test.ts`: los conteos exactos fueron reemplazados por recursos requeridos, unicidad de claves y referencias válidas entre folders, quick actions, tablas, macros, calculations y results.
- `document-generation.test.ts`: el fixture ambiguo `10/05/2026` fue reemplazado por el valor ISO `2026-05-10` y su serialización UTC de 10 de mayo.
- `document-ai.test.ts`: DOCX y PPTX ahora se abren con JSZip; se verifican partes OpenXML requeridas y el contenido único `row-1.pdf` dentro del documento y las slides.
- `data-flow-writeback.test.ts`: el único caso negativo fue reemplazado por `persists a new pending suggestion with its completed run` y `deduplicates only an identical pending suggestion in the same work`. El fake mantiene runs/suggestions y aplica filtros tenant/obra/status, por lo que una sugerencia nueva, un valor distinto, otra obra, otro tenant y una sugerencia previa no pendiente producen inserts independientes. Esto prueba el contrato público de persistencia simulada; no demuestra políticas RLS ni concurrencia de base real.

Verificación de los cambios: los cinco primeros archivos pasaron **49 tests** y ESLint; `data-flow-writeback.test.ts` pasó **2 tests** y ESLint.
