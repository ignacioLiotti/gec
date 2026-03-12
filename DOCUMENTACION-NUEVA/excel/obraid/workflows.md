# Workflows funcionales

## 1. Carga inicial de una obra

### Flujo

1. El usuario abre `/excel/[obraId]`.
2. `page.tsx` dispara queries para obra, memoria, materiales, flujo, pendientes, links OCR y datos de reporting.
3. La obra se aplica al form de TanStack Form.
4. Se calcula el tab inicial desde `searchParams`.
5. Se renderiza la shell con tabs y panel de memoria.

### Resultado

- la UI queda lista para editar obra, navegar documentos y operar workflows

## 2. Edicion de la obra en General

### Flujo

1. El usuario cambia a modo `Edicion`.
2. Edita campos base del form.
3. Para columnas custom de tabla principal, la data se escribe en `customData`.
4. Al enviar, `form.onSubmit` hace `PUT /api/obras/:id`.
5. Se invalida cache de obra y dashboard.

### Notas

- `applyObraToForm` normaliza fechas y setea valores iniciales.
- `isFieldDirty` y `hasUnsavedChanges` comparan contra `initialFormValues`.

## 3. Derivacion de metricas desde certificados extraidos

### Flujo

1. El page detecta filas de certificados extraidos.
2. Calcula:
   - `certificadoALaFecha`
   - `saldoACertificar`
   - `porcentaje`
3. Si el valor guardado no fue sobrescrito manualmente y el campo no esta dirty, actualiza el form.

### Objetivo

Mantener los KPI financieros alineados con la tabla OCR de certificados sin pisar overrides manuales.

## 4. Uso de Quick Actions

### Flujo

1. El usuario abre el panel de quick actions en General.
2. Selecciona una accion.
3. Se construye un stepper a partir de folders default y tablas asociadas.
4. Cada paso puede ser:
   - upload de archivo
   - OCR
   - carga manual
   - combinacion OCR/manual
5. Al completar un paso, se refresca Documents.

### Resultado

- acelera cargas repetitivas
- centraliza tareas de una obra sin obligar a navegar manualmente por carpetas

## 5. Crear una accion de flujo

### Flujo

1. El usuario entra a tab `Flujo`.
2. Crea una accion nueva.
3. Define:
   - tipo
   - timing
   - titulo
   - mensaje
   - destinatarios
4. Al guardar:
   - se hace `POST /api/flujo-actions`
   - se resuelven usuarios por rol
   - se actualiza cache optimistamente

### Resultado

- la accion queda lista para dispararse cuando la obra llegue a 100%

## 6. Activar, editar o eliminar una accion de flujo

### Activar/desactivar

- `PUT /api/flujo-actions`

### Eliminar

- `DELETE /api/flujo-actions?id=...`

### Editar

- `updateFlujoAction(...)`
- envia cambios parciales a la API correspondiente

## 7. Gestion de pendientes

### Flujo

1. El usuario edita o crea un pendiente.
2. `savePendingDoc` hace:
   - `POST /api/obras/:id/pendientes` si es nuevo
   - `PUT /api/obras/:id/pendientes` si ya existe
3. Si el pendiente es de vencimiento fijo, se agenda recordatorio con:
   - `POST /api/doc-reminders`

### Borrado

- `DELETE /api/obras/:id/pendientes?id=...`

## 8. Navegacion del tab Documentos

### Flujo

1. El usuario elige carpeta o archivo.
2. `documents-tab.tsx` sincroniza seleccion con query params:
   - `folder`
   - `file`
3. `FileManager` reconstruye la vista.

### Objetivo

- conservar seleccion navegable
- permitir deep linking interno a carpeta/documento

## 9. Upload de archivo normal

### Flujo

1. El usuario selecciona una carpeta normal.
2. Sube archivo.
3. El archivo va a bucket `obra-documents`.
4. Se reconstruye el arbol visual.

### Resultado

- el documento aparece en la carpeta
- puede abrirse en preview

## 10. Upload OCR sobre carpeta OCR

### Flujo

1. El usuario sube archivo en carpeta OCR.
2. Se resuelven tablas OCR asociadas a esa carpeta.
3. Si hay mas de una, el usuario elige tablas destino.
4. La carga dispara:
   - `POST /api/obras/:id/tablas/import/ocr-multi?skipStorage=1`
5. La API:
   - obtiene columnas y settings
   - arma schemas de extraccion
   - llama al modelo OCR
   - coercea por tipo
   - guarda filas y estado de procesamiento
6. UI refresca el arbol y las filas.

### Resultado

- documento procesado
- filas nuevas en la tabla OCR
- metadata de documento disponible para trazabilidad

## 11. Importacion desde planilla

### Flujo

1. El usuario sube CSV/XLS/XLSX en contexto de tablas.
2. Se ejecuta preview:
   - `POST /api/obras/:id/tablas/import/spreadsheet-multi?preview=1&skipStorage=1`
3. Se detectan hojas, encabezados y mappings.
4. El usuario revisa preview y confirma.
5. Se ejecuta import real contra la misma familia de endpoint sin `preview=1`.

### Capacidades

- deteccion de header row
- resolucion de secciones conocidas:
  - PMC Resumen
  - PMC Items
  - Curva Plan
- coercion tipada por columna

## 12. Operar la tabla OCR desde la carpeta

### Flujo

1. El usuario cambia Documentos a modo `Tabla`.
2. `FileManager` arma `ocrFormTableConfig`.
3. La tabla muestra:
   - filas de la carpeta/tabla activa
   - filtros por documento y por columna
   - menu contextual por celda
4. Al guardar:
   - `POST /api/obras/:id/tablas/:tablaId/rows`

### Adicional

- puede agregar fila vacia
- puede subir documento desde footer
- puede abrir editor de columnas
- puede navegar al reporte de la tabla

## 13. Abrir un documento y su data extraida

### Flujo

1. El usuario abre un archivo.
2. Se muestra `DocumentSheet` con preview.
3. Si el documento tiene datos extraidos:
   - aparece boton `Ver datos`
4. Al abrir datos:
   - aparece `DocumentDataSheet`
   - se monta un `FormTable` embebido

### Resultado

- se edita la data del documento sin salir del preview

## 14. Editar filas desde la hoja lateral de datos

### Flujo

1. El usuario edita una fila de la hoja lateral.
2. La tabla usa el mismo renderer compartido de `FormTable`.
3. Al guardar:
   - se hace `POST /api/obras/:id/tablas/:tablaId/rows`
   - se preservan `__docPath` y `__docFileName`
4. `buildFileTree({ skipCache: true })` refresca el estado documental.

### Importante

- esta vista edita solo las filas del documento activo, no la tabla completa

## 15. Editar esquema de columnas

### Flujo

1. El usuario hace click en `Editar columnas`.
2. Se abre dialogo de esquema.
3. Puede:
   - cambiar label
   - cambiar tipo
   - marcar required
   - definir formulas/config
4. Al guardar:
   - se actualiza la metadata de la tabla

### Impacto

- afecta renderizado
- afecta coercion en guardado
- afecta filtros
- afecta import OCR/spreadsheet
- afecta reportes

## 16. Reprocesar OCR de un documento

### Flujo

1. El usuario abre un documento ya procesado.
2. Usa `Reprocesar Extraccion`.
3. Si el archivo es spreadsheet:
   - reabre flujo de preview/import de planilla
4. Si es PDF o imagen:
   - vuelve a correr OCR multi
5. Se refrescan filas y estados.

## 17. Generar reportes

### Reporte general de obra

1. El usuario abre `/excel/[obraId]/report`.
2. Configura mappings de reglas.
3. Ejecuta recompute de signals.
4. Ejecuta evaluacion de findings.
5. Guarda configuracion.

### Reporte por tabla

1. El usuario entra desde `Generar reporte` en una tabla OCR.
2. La pagina carga metadata de columnas.
3. Construye un `ReportConfig` dinamico.
4. Renderiza `ReportPage`.
