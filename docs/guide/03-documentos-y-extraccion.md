# 3 · Documentos y extracción

## Carpetas: cada tipo de documento tiene su lugar

Las carpetas de una obra no son solo almacenamiento: cada carpeta define **qué tipo de documento** recibe (certificados, pólizas, órdenes de compra, planillas…) y **cómo se extraen sus datos** (lectura automática, carga manual o ambas). Esta configuración la define el administrador de tu empresa y se aplica igual en todas las obras.

## Subir un documento

1. Entrá a la obra → solapa de documentos.
2. Elegí la carpeta correcta (el tipo de dato depende de la carpeta).
3. Subí el archivo (PDF, imagen o planilla).
4. Si la carpeta tiene extracción automática, el sistema lee el documento y genera filas en la tabla correspondiente. Vas a ver el estado del proceso junto al archivo.

Para planillas (Excel/CSV) el sistema muestra una **vista previa del import** con un resumen de qué secciones y filas detectó, antes de confirmar.

## Revisión de lo extraído

- Cuando la extracción registra su documento de origen, la fila muestra ese vínculo para volver a la evidencia. Algunas importaciones antiguas o manuales pueden no tenerlo.
- Los valores extraídos se pueden corregir a mano en la tabla. Guardá los cambios y verificá el estado antes de salir.
- Si la lectura automática falla, el sistema muestra un mensaje claro del motivo (por ejemplo, alta demanda del proveedor de OCR) y podés reintentar o cargar a mano.

## Volver a subir el mismo documento

Es un caso frecuente: llega una versión nueva del mismo certificado o corregís el archivo.

- En los flujos que tienen huella de contenido y lineage habilitados, el sistema intenta reconocer el documento por su contenido, no solo por el nombre.
- Esos flujos intentan mantener una **identidad estable** para las filas. Después de reimportar, revisá los datos y sus vínculos: no todos los importadores históricos ofrecen la misma cobertura.
- Cuando la reconciliación detecta una ambigüedad conocida, puede marcar un conflicto para revisión manual.

## Documentos generados por plantilla

Además de subir documentos, podés **generar** documentos operativos (por ejemplo, notas o certificados) desde plantillas de tu empresa:

1. Se crea un **borrador** editable, pre-llenado con los datos que la plantilla tenga configurados. Los campos con metadata de origen pueden mostrar su procedencia.
2. Al confirmarlo, el documento queda **en revisión**: puede editarse mientras espera revisión o si fue rechazado.
3. Un revisor lo **aprueba o rechaza**. Al aprobar, se aplica su firma digital y el documento ya no puede editarse.
4. El documento aprobado queda disponible en el historial de documentos generados. Verificá su destino antes de asumir que también fue copiado al gestor de archivos de la obra.

## Asistente de documentos (IA)

Podés hacer pedidos en lenguaje natural sobre los documentos de una obra ("armame un resumen de los certificados del último trimestre"). Revisá siempre las fuentes y advertencias mostradas antes de usar el resultado para una decisión: una respuesta de IA puede ser incompleta o equivocarse.

Siguiente: [Tablas y consolidación →](04-tablas-y-macrotablas.md)
