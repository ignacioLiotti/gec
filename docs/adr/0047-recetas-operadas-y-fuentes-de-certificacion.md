# ADR 0047. Recetas operadas y fuentes de certificación

## Estado

Implementado en la rama `final-a`.

## Decisión

- La receta de orden de compra se aplica sobre una plantilla existente. Los ajustes guiados y el JSON versionado cambian campos obligatorios y el recargo predeterminado cuando la plantilla lo admite. Un logo adicional se incorpora como imagen local. El HTML y el esquema siguen disponibles en configuración avanzada.
- Publicar una orden de compra activa crea una versión con nuevo ID bajo la misma clave y el mismo tenant. La selección de documentos nuevos prefiere la última versión compatible. Los borradores conservan el ID de su plantilla. El operador puede seleccionar una versión anterior y volver a publicar su configuración como una versión nueva. Se conserva la revisión de órdenes.
- El análisis de un ejemplo puede preparar una propuesta JSON para los campos de la receta que coincidan con los de la muestra. Usa el endpoint de análisis y sus permisos existentes. Aplicar la propuesta a la vista previa y publicarla son decisiones separadas.
- La receta de certificados define `PMC Resumen` con monto del período, monto acumulado y avance físico acumulado. General distingue la curva física de los importes de la ficha. El modelo de Macro contable incorpora fuentes por plantilla y deja editables los campos contables propios de la Macro.
- El evaluador de automatizaciones usa la selección por plantilla de Macro y la restringe a la obra evaluada. Lee el dato de origen. Los ajustes de presentación y los datos contables de la Macro conservan su alcance. Para que un importe corregido alimente una automatización, se corrige la fila de origen mediante sus permisos y trazabilidad.

## Consecuencias

Las recetas conviven con las configuraciones históricas. La publicación utiliza la unicidad existente de tenant, clave y versión. Al publicarse dos configuraciones con el mismo número de versión se devuelve un conflicto. La validación de esa publicación es independiente de la numeración comercial de órdenes.
