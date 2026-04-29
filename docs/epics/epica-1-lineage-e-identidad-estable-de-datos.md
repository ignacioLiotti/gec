# Épica 1 — Lineage e identidad estable de datos

Fecha de corte: 2026-04-22.

## Objetivo

Incorporar identidad estable de negocio y trazabilidad de extracción en filas materializadas para que el sistema pueda:

- reconciliar reimports sin depender de `row.id`
- preservar continuidad semántica entre materializaciones
- sostener overrides, cálculos y recomendaciones sobre una identidad de negocio estable
- distinguir con claridad identidad técnica, identidad de negocio, corrida de extracción y versión de materialización

## Estado actual en este repo

- `obra_tabla_rows` solo persiste `id`, `tabla_id`, `data`, `source`, timestamps.
- El import OCR todavía borra por `__docPath` y recrea filas, lo que cambia `row.id`.
- `macro_table_custom_values` usa `source_row_id` como clave de continuidad.
- `ocr_document_processing` ya existe y hoy es el mejor candidato inicial para representar la corrida de extracción auditable.
- `CONTEXT.md` ya fija como decisión de dominio:
  - `row.id` = identidad técnica mutable
  - `lineage_row_key` = identidad estable de negocio
  - doble fingerprint obligatorio (`file_fingerprint` + `content_fingerprint_normalized`)
  - `materialization_version` por (`tabla_id`, `lineage_row_key`)

## Alcance de la épica

- Ticket 1.1: persistir identidad estable de negocio en filas extraídas.
- Ticket 1.2: incorporar doble fingerprint documental para reconciliación.
- Adaptar lecturas/escrituras críticas para dejar de depender exclusivamente de `source_row_id`.

## No objetivo en esta épica

- Exponer `lineage_row_key` en UI como concepto visible al usuario.
- Cerrar un motor completo de eventos de dominio.
- Resolver todavía toda la explainability de cálculos históricos.
- Introducir un modelo avanzado de `row_lineage_links` si la columna física alcanza para el rollout inicial.

## Ticket 1.1 — Persistir identidad estable de negocio en filas extraídas

### Resultado esperado

Cada fila materializada debe tener:

- `id`: identidad técnica mutable
- `lineage_row_key`: identidad estable de negocio
- `extraction_id`: corrida de extracción que produjo la materialización
- `materialization_version`: versión local para (`tabla_id`, `lineage_row_key`)

### Recomendación de implementación en el modelo actual

Agregar columnas físicas a `obra_tabla_rows`:

- `lineage_row_key TEXT NOT NULL`
- `extraction_id UUID NULL`
- `materialization_version INTEGER NOT NULL DEFAULT 1`

Índices y constraints recomendados:

- índice por `tabla_id, lineage_row_key`
- unicidad inicial por `tabla_id, lineage_row_key`
- índice por `extraction_id`

Nota de adaptación:

- Si el modelo final necesita conservar más de una materialización activa por (`tabla_id`, `lineage_row_key`), la restricción puede evolucionar a una tabla de vínculos o a una unicidad compuesta distinta. Para el baseline actual del repo, la decisión vigente apunta a reconciliación directa sobre la fila vigente.

### Cambios funcionales esperados

- Reimportar un documento no debe romper continuidad lógica si el ítem representa la misma entidad de negocio.
- El sistema debe poder consultar filas por `lineage_row_key`.
- Los endpoints de lectura de filas deberían devolver, además de `row_id`:
  - `lineage_row_key`
  - `extraction_id`
  - `materialization_version`

### Puntos de integración del repo

- `app/api/obras/[id]/tablas/[tablaId]/import/ocr/route.ts`
  - hoy borra filas por `__docPath` y hace insert puro
  - debe pasar a reconciliar por `lineage_row_key`
- `app/api/obras/[id]/tablas/[tablaId]/rows/route.ts`
  - debe exponer metadata de lineage en lecturas de filas
- `app/api/macro-tables/[id]/rows/route.ts`
  - hoy resuelve overrides por `source_row_id`
  - debe soportar dual-read transitorio y luego continuidad por lineage
- `lib/macro-tables.ts`
  - debe reflejar `lineageRowKey`, `extractionId` y `materializationVersion` en el tipo de fila cuando el schema esté listo

### Passing requirements técnicos

- Existe una identidad estable distinta del ID técnico.
- El sistema puede consultar filas por identidad estable.
- El sistema distingue identidad técnica, identidad de negocio, corrida de extracción y versión de materialización.
- En reimport, el sistema puede reconciliar una fila nueva con una entidad previa cuando corresponda.
- La lectura de filas puede devolver metadata mínima de lineage sin depender de `data JSONB`.

### Passing requirements de UX

- Reimportar un documento no debe hacer que el usuario pierda el vínculo lógico con el dato anterior si el dato sigue representando la misma entidad.
- La UI puede seguir ocultando `lineage_row_key`, pero la continuidad debe verse en overrides, cálculos y navegación.

### Error semántico esperado

Si dos filas colisionan sobre la misma identidad estable y no puede resolverse automáticamente, el proceso debe devolver un error semántico equivalente a:

- `LINEAGE_RECONCILIATION_CONFLICT`

El contexto mínimo del error debería incluir:

- `tabla_id`
- `extraction_id`
- `lineage_row_key`
- filas candidatas o regla de reconciliación aplicada

## Ticket 1.2 — Incorporar doble fingerprint documental para reconciliación

### Resultado esperado

El pipeline debe preservar dos huellas distintas:

- `file_fingerprint`: identidad exacta del archivo binario
- `content_fingerprint_normalized`: identidad semántica del contenido útil normalizado

### Recomendación de implementación en el modelo actual

Persistencia inicial recomendada en `ocr_document_processing`:

- `file_fingerprint TEXT NULL`
- `content_fingerprint_normalized TEXT NULL`
- `fingerprint_status TEXT NOT NULL DEFAULT 'pending'`
- `fingerprint_error JSONB NULL`

`fingerprint_status` debería cubrir al menos:

- `pending`
- `completed`
- `degraded`
- `failed`

Motivo:

- `ocr_document_processing` ya modela la corrida documental y hoy es el mejor lugar para auditoría, replay y diagnóstico.
- `obra_tabla_rows` puede consumir esos fingerprints como insumos para derivar `lineage_row_key` sin obligar a duplicarlos de entrada en cada fila.

### Regla de derivación de identidad

La derivación de `lineage_row_key` debe seguir la prioridad ya fijada en `CONTEXT.md`:

1. clave de negocio explícita
2. clave estructural derivada con `file_fingerprint` + `content_fingerprint_normalized` + identidad de tabla + clave lógica del ítem
3. fallback determinístico con posición solo cuando no exista mejor clave

### Passing requirements técnicos

- Existen ambos fingerprints o un equivalente funcional.
- El pipeline de extracción los deja en una estructura consultable.
- El sistema puede usarlos como insumos de reconciliación.
- La corrida de extracción deja trazabilidad de si el cálculo binario, semántico o ambos fallaron.
- Un fallo del fingerprint semántico no bloquea necesariamente el flujo documental, pero sí degrada la calidad de reconciliación y queda auditado.

### Passing requirements de UX

- Reuploads idénticos o equivalentes no deberían producir resultados arbitrarios para el usuario.
- La UI no necesita mostrar fingerprints, pero sí beneficiarse de una continuidad menos frágil.

## Estrategia de rollout recomendada

### Fase A — Schema y contratos

- Migrar `obra_tabla_rows` con columnas físicas de lineage.
- Migrar `ocr_document_processing` con fingerprints y estado de cálculo.
- Extender tipos y serialización de APIs para devolver metadata de lineage.

### Fase B — Write path OCR

- Calcular `file_fingerprint` al registrar el documento.
- Calcular `content_fingerprint_normalized` desde el contenido OCR normalizado.
- Derivar `lineage_row_key` por la prioridad canónica.
- Reemplazar delete+insert ciego por reconciliación controlada.

### Fase C — Continuidad downstream

- Habilitar dual-read en macrotablas:
  - legado por `source_row_id`
  - nuevo por `lineage_row_key`
- Habilitar dual-write transitorio para overrides si hace falta compatibilidad con datos existentes.
- Ajustar cálculos/recomendaciones para aceptar referencias estables de fila.

### Fase D — Observabilidad y cleanup

- Registrar conflictos `LINEAGE_RECONCILIATION_CONFLICT`.
- Medir tasa de reconciliación exacta, degradada y fallida.
- Ejecutar backfill de lineage para filas OCR históricas cuando sea viable.
- Hacer cutover final fuera de `source_row_id` como identidad principal.

## Riesgos a controlar

- Colisiones falsas de `lineage_row_key` por una derivación demasiado agresiva.
- Continuidad rota en overrides de macrotabla durante la transición.
- Imposibilidad de backfill perfecto para materializaciones históricas sin evidencia documental suficiente.
- Coste de cómputo del fingerprint semántico si OCR es ruidoso o inconsistente.

## Criterios de aceptación de la épica

- Una fila OCR puede leerse y auditarse con `row_id`, `lineage_row_key`, `extraction_id` y `materialization_version`.
- Reimportar el mismo documento o uno semánticamente equivalente preserva continuidad cuando corresponde.
- El pipeline conserva `file_fingerprint` y `content_fingerprint_normalized` con estado auditable.
- Los conflictos de reconciliación producen error semántico explícito y contexto auditable.
- Macrotablas deja de depender exclusivamente de `source_row_id` para continuidad de overrides.

## Referencias del repo

- `CONTEXT.md`
- `docs/domain-model-backlog.md`
- `supabase/migrations/0048_obra_tablas.sql`
- `supabase/migrations/0050_ocr_templates.sql`
- `supabase/migrations/0054_macro_tables.sql`
- `app/api/obras/[id]/tablas/[tablaId]/import/ocr/route.ts`
- `app/api/macro-tables/[id]/rows/route.ts`
- `lib/macro-tables.ts`
