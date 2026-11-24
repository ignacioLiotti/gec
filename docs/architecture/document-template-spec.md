# Template Spec: plantillas de documentos como JSON

La spec es una sola descripción lineal de una plantilla. La usan el editor visual (`/document-generation/builder`), la API y cualquier LLM que genere plantillas. Las decisiones están en [ADR-0049](../adr/0049-template-spec-and-linked-document-fields.md).

## Flujo

```
GET  /api/document-generation/spec           guía: forma, tipos, funciones, fuentes del tenant, ejemplo
POST /api/document-generation/spec {spec}     valida (422 con errores por ruta) y devuelve una vista previa
POST /api/document-generation/templates {spec}                                    crea la plantilla
PUT  /api/document-generation/templates {templateId, spec, publishVersion: true}  publica una versión
GET  /api/document-generation/sources?records=usuarios,tabla:x&workId=...         registros vinculables
```

Todos los endpoints usan la sesión del usuario y el permiso `documents:templates`. `sources` también acepta a quien puede generar documentos.

## Forma

```json
{
  "version": 1,
  "name": "Recepción de materiales",
  "documentType": "RECEPCION_MATERIALES",
  "targetFolderPath": "compras/recepciones",
  "numberPrefix": "REC-",
  "sections": [
    { "kind": "header" },
    { "kind": "fields", "title": "Datos", "fields": [
      { "key": "responsable", "label": "Recibió", "type": "reference",
        "reference": { "source": "usuarios", "display": "nombre", "match": "email" } },
      { "key": "responsable_email", "label": "Email", "type": "lookup",
        "lookup": { "from": "responsable", "attribute": "email" } }
    ] },
    { "kind": "table", "key": "items", "title": "Materiales", "columns": [
      { "key": "cantidad", "label": "Cantidad", "type": "number" },
      { "key": "precio_unitario", "label": "Precio", "type": "money" },
      { "key": "precio_total", "label": "Total", "type": "formula", "formula": "[cantidad] * [precio_unitario]" }
    ] },
    { "kind": "totals", "fields": [
      { "key": "total", "label": "Total", "type": "formula", "formula": "SUMA(items.precio_total)" }
    ] },
    { "kind": "signatures", "labels": ["Recibió"] }
  ]
}
```

La guía de `GET /spec` trae el detalle de cada tipo y un ejemplo con vínculo a una orden de compra (`copy`).

## Cómo se ejecuta

| Paso | Dónde |
| --- | --- |
| Validar la spec | `validateTemplateSpec` (cliente y servidor) |
| Compilar al schema y el HTML | `compileTemplateSpec` |
| Elegir un registro, traer datos y copiar | `applyTemplateReferenceInputData`: en el navegador al editar y en `generate` |
| Rechazar vínculos inválidos | `validateTemplateReferences` en `generate` |
| Calcular fórmulas | `applyTemplateFormulaInputData` con `evaluateDocumentFormula` |
| Imprimir valores | `renderDocumentHtml` con filtros `money`, `number` y `date` |

## Conectar un LLM

1. Copiá la guía con **Copiar guía para IA** en el editor, o pedila con `GET /spec`.
2. El modelo responde con una spec JSON.
3. Pegala en la pestaña **JSON** del editor y elegí **Aplicar JSON**. También podés enviarla a `POST /spec` y corregir los errores por su `path`.
4. Publicá desde el editor o con `POST /templates`.

Para usarla como herramienta MCP, cada endpoint corresponde a una herramienta:

- `get_template_guide`
- `validate_template_spec`
- `create_template`
- `publish_template_version`
- `list_link_records`

Falta resolver la autenticación fuera del navegador; ver el ADR.

## Asistente dentro del editor

El botón **Asistente** del editor abre un chat que edita la plantilla en lenguaje natural o la arma desde una foto o PDF del documento real. El flujo:

1. El navegador envía la spec actual, la conversación y el adjunto opcional a `POST /api/document-generation/assistant`.
2. El servidor llama a OpenAI (`gpt-6.1-terra`, esfuerzo `medium`; configurable con `DOCUMENT_TEMPLATE_ASSISTANT_MODEL` y `DOCUMENT_TEMPLATE_ASSISTANT_EFFORT`) con la guía de este documento como instrucciones.
3. El modelo devuelve `{ reply, changes, spec }` con la spec completa. Si no valida, el servidor le pasa los errores y reintenta (hasta 3 intentos).
4. El editor aplica la spec, calcula qué cambió (`diffSpecs`) y lo anima. Cada respuesta se puede deshacer.

Nada se guarda hasta **Publicar**. Detalles y costos en `docs/adr/0050-template-assistant.md`.

Opciones visuales de la spec (el layout impreso sigue el estilo de la orden de compra original de GEC):

- `header.issuer`: bloque del emisor a la izquierda; la primera línea es el nombre y el resto, dirección, CUIT y teléfonos. A la derecha van el tipo de documento, el número grande y los demás campos del encabezado.
- `width: "half"` en una sección: dos secciones seguidas comparten la fila. Si en una tanda de medias filas sobra una al final, se apila bajo la celda izquierda de la fila anterior (por ejemplo, la firma bajo las notas mientras los totales ocupan la derecha).
- `boxed: true` en una sección: recuadro claro, para observaciones.
- `hideLabel: true` en un campo: imprime solo el valor, sin "Etiqueta:".
- `emphasis: true`: columna de tabla en negrita o fila de totales destacada. La última fila de totales siempre lleva una línea arriba y negrita.
- `width: "full"` en un campo: ocupa toda la fila.
- `style.accent`: color `#rrggbb` del punto del emisor y de la línea del total final.

Cada parte del HTML lleva `data-k` con la misma identidad que usa el editor (`specSectionIds`, `specFieldId`). El modo Asistente muestra ese HTML en un shadow root y anima los cambios con esas claves.
