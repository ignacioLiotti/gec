# ADR-0050: Asistente de plantillas con IA

## Status

Accepted

## Date

2026-11-23

## Context

La Template Spec (ADR-0049) ya permitía que un LLM externo escribiera plantillas, pero había que copiar una guía, pegar la respuesta en la pestaña JSON y corregir los errores a mano. Queremos que cualquier usuario arme y edite plantillas conversando dentro del editor: soltar una foto o PDF del documento real y pedir cambios en lenguaje natural ("sacá Observaciones", "que Recibió sea un usuario del equipo", "agregá el IVA").

## Decision

1. **El modelo devuelve la spec completa** en cada turno, junto con una respuesta corta y etiquetas de cambio: `{ reply, changes, spec | null }`. No usamos operaciones parciales: la spec completa es más simple de pedir y validar, y el editor calcula qué cambió con `diffSpecs` para animarlo.
2. **El servidor valida antes de responder** (`lib/document-template-assistant.ts`). Si la spec no pasa `validateTemplateSpec` con el catálogo de fuentes del tenant, le devuelve los errores por ruta al modelo y reintenta, hasta 3 intentos. El navegador solo recibe specs publicables.
3. **Listas largas no viajan al modelo.** Una lista de más de 40 opciones (por ejemplo los 2.407 materiales de la orden de compra) se envía como `__KEEP_OPTIONS__:N` más una muestra, y el servidor restaura la lista original. Eso baja tokens y evita que el modelo la trunque.
4. **Modelo:** OpenAI Responses API, `gpt-6.1-terra` con esfuerzo `medium` por defecto. Se puede cambiar con `DOCUMENT_TEMPLATE_ASSISTANT_MODEL` y `DOCUMENT_TEMPLATE_ASSISTANT_EFFORT`. En la comparación del 2026-11-23, `gpt-6-luna` (high) y `gpt-6.1-terra` (medium) armaron specs válidas al primer intento, en 7 a 14 s y con 2.800 a 4.700 tokens por pedido. Terra incluyó la columna Descripción en una factura nueva y Luna no.
5. **Adjuntos:** PDF (como `input_file`) o imagen (`input_image`) de hasta 10 MB, solo en el turno donde se adjuntan. No se guardan ni se envían con `store: true`.
6. **Consumo:** el endpoint reserva 30.000 tokens de la cuota de IA del plan antes de llamar y liquida el uso real al terminar (`incrementTenantUsage`), y registra el evento `ai_tokens` con contexto `document-template-assistant`. Sin cuota disponible responde 402.
7. **Permisos:** `POST /api/document-generation/assistant` exige `canManageTemplates`, igual que el resto del editor. No guarda nada: publicar sigue pasando por `/api/document-generation/templates`.
8. **El layout impreso adopta el estilo de la orden de compra original de GEC** y la spec suma las opciones para replicar documentos reales: `header.issuer`, `width: "half"` y `boxed` en secciones, `hideLabel`, `emphasis` y `width: "full"` en campos, y `style.accent`. Cambia el aspecto de las plantillas hechas con la spec (no el de las plantillas HTML escritas a mano). Con el PDF de la OC 102 adjunto, el modelo reprodujo encabezado, bloques lado a lado, recuadro, tabla y totales al primer intento (22 s, 8.500 tokens).
9. **En modo Asistente el lienzo muestra el documento impreso**, no el esquema del editor: el mismo HTML del PDF con valores de ejemplo, en un shadow root, animado por las claves `data-k`.

## Consequences

- El editor tiene un modo **Asistente**: los paneles laterales se desvanecen, el lienzo queda centrado y el chat aparece abajo. Con una plantilla vacía muestra una zona para soltar el documento. Cada respuesta se puede deshacer.
- Las animaciones del lienzo usan `motion` (ya era dependencia). Las identidades de secciones y campos salen de keys y títulos (`sectionIds`, `fieldId`), no de índices.
- Cada pedido cuesta una llamada al modelo, o hasta tres si hay que corregir. El costo depende del precio del modelo configurado. `lib/ai-pricing.ts` no tiene precio para estos modelos, así que `costUsd` queda en `null`.
- El modelo todavía no puede poner logos ni imágenes; lo responde así.
- El e2e no llama a OpenAI: el stack aislado no tiene salida a internet. Responde con datos grabados de respuestas reales del modelo.

## Alternatives considered

- **Operaciones parciales (agregar, quitar, mover campos).** Producen menos tokens, pero obligan a un esquema de operaciones mucho más grande y a resolver índices. Con specs de 2 a 6 KB, la spec completa resultó rápida y confiable.
- **Structured outputs estrictos.** La spec tiene muchos campos opcionales y uniones; el modo estricto exige todos los campos. Usamos `json_object` y validamos con nuestro validador, que además da mensajes accionables.
- **Usar el SDK `ai` existente.** La versión instalada (`ai` 3.4, `@ai-sdk/openai` 0.0.50) es anterior a la Responses API y a los parámetros de razonamiento. El endpoint usa `fetch` directo.

## Related files

- `lib/document-template-assistant.ts`
- `app/api/document-generation/assistant/route.ts`
- `app/document-generation/builder/builder-assistant.tsx`
- `app/document-generation/builder/use-template-assistant.ts`
- `app/document-generation/builder/builder-canvas.tsx`
- `app/document-generation/builder/spec-editing.ts`
- `lib/document-template-spec.ts`
- `tests/lib/document-template-assistant.test.ts`
- `tests/e2e/document-generation/template-assistant.spec.ts`
