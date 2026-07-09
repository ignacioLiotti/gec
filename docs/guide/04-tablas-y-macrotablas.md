# 4 · Tablas y consolidación

## Tablas de la obra

Cada obra tiene tablas de datos (certificados, mediciones, materiales, etc.) definidas por la configuración de tu empresa. Funcionan como una hoja de cálculo:

- **Edición directa**: clic en la celda y escribí. Los tipos se respetan (fechas, números, texto).
- **Filtros y orden**: desde el encabezado de cada columna.
- **Edición masiva**: seleccioná varias filas para operaciones en lote.
- **Filas extraídas vs. manuales**: las filas que vienen de documentos conservan el enlace a su archivo de origen; también podés agregar filas a mano.

## ¿De dónde sale la estructura de mis tablas?

Tu empresa define una **plantilla** (carpetas, tablas y columnas comunes). Cada obra materializa esa plantilla y puede tener **personalizaciones locales** (una columna extra, un ajuste propio) que no afectan a las demás obras.

- Los cambios seguros de la plantilla pueden aplicarse a obras existentes desde las herramientas de sincronización. Confirmá el resultado cuando el alcance incluya muchas obras.
- Los cambios que podrían perder información **no se aplican automáticamente**. Las eliminaciones destructivas están bloqueadas hasta contar con una migración explícita, vista previa del impacto y aprobación auditable.

## Macrotablas: ver todas las obras juntas

Una **macrotabla** consolida la misma tabla a través de todas las obras (por ejemplo, todos los certificados de todas las obras en una sola vista):

- Filtrá por obra, período o cualquier columna.
- **Valores personalizados**: podés sobrescribir un valor puntual en la macrotabla sin tocar el dato original de la obra. La permanencia después de reimportar depende de que la fila tenga lineage estable; revisá los overrides luego de una reextracción.
- Si detectás valores en competencia después de una reimportación, revisalos antes de exportar o decidir.

## Cálculos e indicadores

Los indicadores de la solapa General (contrato, certificado a la fecha, saldo, avance) se calculan a partir de tus tablas y campos de obra según la configuración de tu empresa. Puntos clave:

- **Trazabilidad**: el canvas muestra las fuentes reales que estén registradas y puede completar el diagrama con nodos proyectados. Ambos tipos se distinguen en pantalla.
- **Resultados**: verificá el cálculo efectivo y las fuentes antes de comparar períodos; el historial completo depende del flujo configurado.
- **Sugerencias**: algunos flujos pueden proponer una actualización. La decisión de aplicarla sigue siendo del usuario autorizado.

Siguiente: [Administración →](05-administracion.md)
