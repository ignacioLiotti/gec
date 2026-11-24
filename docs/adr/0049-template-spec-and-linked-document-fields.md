# ADR-0049: Template Spec y campos vinculados en plantillas de documentos

## Status

Accepted

## Date

2026-11-22

## Context

Las plantillas de documentos se editaban como una lista plana de campos más un HTML escrito a mano. Para armar un documento nuevo, como una recepción de materiales o una factura de compra, había que escribir HTML. Los totales de la orden de compra estaban programados para claves fijas. No había forma de vincular un campo con datos de la app (usuarios, obras, tablas de obra) ni con otro documento ya emitido.

También queremos que un LLM pueda crear plantillas sin usar la UI. Para eso necesita un formato lineal y autodescriptivo, y una validación que le diga cómo corregir sus errores.

## Decision

1. **Template Spec v1** (`lib/document-template-spec.ts`) es la única descripción de una plantilla. Es un JSON con nombre, tipo, carpeta y una lista ordenada de secciones: `header`, `fields`, `table`, `totals`, `text` y `signatures`. El editor visual edita una spec y un LLM escribe una spec.
2. La spec **se compila** al `TemplateSchema` y al HTML que ya usa el sistema. Drafts, generación, versionado, permisos y revisión no cambian. La spec se guarda en `schema.spec`, que es JSON, así que no hace falta migración. Un guardado sin spec, por ejemplo desde el editor HTML clásico, borra `schema.spec` para que no quede desactualizada.
3. Hay dos tipos de campo nuevos:
   - `reference` vincula con una fuente. Guarda el texto mostrado en el campo y el id del registro en `__refs`. `copy` copia datos del registro elegido; las filas se copian a tablas.
   - `lookup` trae un atributo del registro elegido.
4. Las **fuentes** se describen en un catálogo (`lib/document-reference-sources.ts`):
   - `usuarios` y `obras`.
   - `tabla:<slug>`: tablas por defecto del tenant.
   - `documento:<TIPO>`: documentos generados, revisados o aprobados de la obra.

   Las lecturas usan el cliente con RLS del usuario. La excepción son los miembros del tenant, que reutilizan la búsqueda existente de document generation.
5. Las **fórmulas** usan un parser propio (`lib/document-formula.ts`) con `SUMA`, `PROMEDIO`, `MIN`, `MAX`, `CONTAR`, `REDONDEAR`, `SI` y `ABS`. Reemplaza la evaluación con `Function()` en las fórmulas de plantilla. Las fórmulas de columnas OCR siguen con su evaluador.
6. El navegador resuelve los vínculos mientras se carga el documento. **La generación los vuelve a resolver en el servidor** y rechaza los valores que no identifican un registro. El documento final nunca depende de datos calculados solo en el cliente.
7. La API para clientes externos y LLMs es lineal:
   - `GET /api/document-generation/spec` devuelve la guía.
   - `POST /api/document-generation/spec` valida y devuelve una vista previa.
   - `POST` o `PUT /api/document-generation/templates { spec }` crea la plantilla o publica una versión.

   Los errores se reportan por ruta, por ejemplo `sections[2].columns[4].formula`.

## Consequences

- Cualquier tipo de documento se arma sin escribir HTML. El HTML generado usa filtros `{{campo|money}}`, `{{campo|number}}` y `{{campo|date}}`, que `renderDocumentHtml` y el editor inline ahora reconocen.
- Abrir en el editor visual una plantilla creada sin spec deriva una spec desde sus campos. Al publicar desde el editor, el HTML a mano se reemplaza por el generado; el editor lo avisa.
- `copy` se aplica solo cuando cambia el registro elegido. Las ediciones posteriores del usuario se conservan.
- La generación carga los registros de las fuentes que use la plantilla. Es una consulta extra por generación, no por autoguardado.
- La API usa la sesión del usuario. Un LLM fuera del navegador necesita credenciales; los tokens de API por tenant quedan pendientes y requieren un cambio de esquema.

## Alternatives considered

- **Editar HTML con marcadores.** Es lo que había. Un LLM puede escribirlo, pero no se puede validar ni vincular, y no lo edita alguien sin conocimientos técnicos.
- **Guardar la spec en una tabla nueva.** Habría requerido una migración sin beneficio: la spec viaja con la versión de la plantilla dentro de `schema`.
- **Resolver los vínculos solo en el servidor en cada autoguardado.** Agregaba latencia y consultas cada 1,5 s. Se resuelve en el cliente al editar y en el servidor al generar.

## Related files

- `lib/document-template-spec.ts`
- `lib/document-formula.ts`
- `lib/document-reference-sources.ts`
- `lib/document-generation.ts`
- `app/api/document-generation/spec/route.ts`
- `app/api/document-generation/sources/route.ts`
- `app/api/document-generation/templates/route.ts`
- `app/api/document-generation/generate/route.ts`
- `app/document-generation/builder/`
- `docs/architecture/document-template-spec.md`

## Related domain docs

- `docs/obsidian-brain/10 - Documents & File Manager.md`

## Agent notes

- No agregues campos a la spec sin actualizar `validateTemplateSpec`, `compileTemplateSpec`, `readTemplateSpec` y `buildTemplateSpecGuide`. La guía es el contrato que leen los LLMs.
- Las keys publicadas son estables. El editor solo renombra la key de campos nuevos y actualiza fórmulas, lookups y destinos de `copy` en el mismo cambio.
- `__refs` es estado interno del documento. No lo muestres ni lo uses como fuente de verdad sin volver a resolverlo.
