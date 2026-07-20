# ADR-0032: Configuración de carpetas de datos a partir de un documento de ejemplo

## Status

Accepted

## Date

2026-07-16

## Context

El asistente de carpeta en `app/admin/obra-defaults` pedía que un usuario no técnico diseñara un esquema en abstracto antes de subir un solo archivo: grupos, resumen vs. lista, origen de datos, plantilla OCR, tipos de documento, indicaciones y columnas con tipo de dato. Además, la opción "Leer documentos automáticamente" quedaba bloqueada hasta que existiera un `ocr_template`, cuyo paso más laborioso (dibujar regiones sobre un documento de ejemplo) no aporta al prompt de extracción: en `app/api/obras/[id]/tablas/import/ocr-multi/route.ts` solo viajan las columnas derivadas (descripciones, aliases, ejemplos), nunca las coordenadas.

## Decision

Invertir el orden del setup: el documento de ejemplo pasa a ser el primer paso.

1. Nueva ruta `POST /api/obra-defaults/analyze-sample`: recibe un PDF, imagen o planilla (Excel/CSV convertida a texto con `xlsx`), llama a Gemini (`OCR_MODEL`, REST con `responseMimeType: application/json` + `responseSchema`) con un prompt de análisis estructural, y devuelve un `SampleAnalysis`: tipo de documento, formato (pdf_texto/escaneo/foto/planilla), campos de cabecera con el valor real leído del ejemplo y confianza, tablas de ítems con filas de muestra, instrucciones sugeridas y advertencias. Requiere permiso `admin:obra-defaults` y mide tokens con el mismo esquema de reserva/settlement que OCR (`context: sample_analysis`).
2. Contrato compartido en `lib/obra-defaults/sample-analysis.ts`: tipos + `buildImportedDefinitionFromAnalysis`, que convierte la propuesta revisada por el usuario (checkboxes + respuestas a preguntas adaptativas) en el shape `ImportedDefinition` que el editor de carpetas ya consume vía `importDefinitionToFolderConfig`/`applyImportedJsonText`. Las respuestas (llegan fotos, formato variable, hojas variables) se traducen a líneas de `global_extraction_instructions`.
3. UI `SampleAnalysisCard` en el paso "Información" del asistente: drop zone → análisis → propuesta con valores reales (no esquemas) → 1-3 preguntas adaptativas → aplica la configuración al estado existente del wizard. Al aplicar se activa `hasImportedDefinition`, que ya destrababa el gating de plantillas OCR, así que el flujo por ejemplo no exige `ocr_templates` previos.

El pipeline de extracción (`ocr-multi`) no se toca: la configuración generada aterriza en los mismos settings (`documentTypes`, `extractionInstructions`, columnas con descripciones/aliases/ejemplos) que ya se inyectan al prompt.

## Consequences

- Un admin puede configurar una carpeta de datos subiendo un ejemplo y confirmando, sin entender fieldKeys ni tipos de dato; el camino manual y el de plantillas siguen disponibles.
- Cada análisis consume tokens de IA del tenant (medidos y limitados por plan).
- Los `example_values` de la definición generada provienen del documento real, lo que mejora los hints del prompt de extracción actual sin cambiar su formato.
- Fases siguientes previstas (no implementadas): perfil de extracción persistente con ejemplares few-shot (documento + extracción dorada), aprendizaje progresivo a partir de ediciones de filas OCR (reglas aprendidas tras N correcciones, revisables en UI), y migrar `ocr-multi` a salida estructurada (`responseSchema`) para eliminar el pase de reparación y el remapeo difuso.

## Alternatives considered

- Generar un `ocr_template` implícito desde el ejemplo: descartado en esta fase; las regiones no participan del prompt y el contrato `ImportedDefinition` ya cubre la aplicación al wizard.
- Usar el AI SDK (`generateObject`): descartado por ahora; `@ai-sdk/google` 3.x instalado es incompatible con `ai` 3.4.x y no se usa en el repo. Se siguió el patrón REST probado de `ocr-multi`.
- Rediseñar el wizard completo alrededor del flujo conversacional: pospuesto; integrarlo como camino primario dentro del paso existente evita tocar la lógica de guardado y el pipeline.

## Related files

- `app/api/obra-defaults/analyze-sample/route.ts`
- `lib/obra-defaults/sample-analysis.ts`
- `app/admin/obra-defaults/_components/SampleAnalysisCard.tsx`
- `app/admin/obra-defaults/page.tsx`
- `tests/lib/sample-analysis.test.ts`
- `app/api/obras/[id]/tablas/import/ocr-multi/route.ts` (pipeline consumidor, sin cambios)
