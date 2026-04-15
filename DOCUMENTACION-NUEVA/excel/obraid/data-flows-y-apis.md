# Data flows y APIs

## 1. Flujo de datos de alto nivel

### UI

- `app/excel/[obraId]/page.tsx`
- tabs hijas
- `FormTable`
- `FileManager`

### Estado cliente

- TanStack Form para la obra
- React Query para entidades relacionadas
- estado local para modales, sheets, toggles y drafts

### Backend

- route handlers en `app/api/...`
- Supabase para tablas y storage
- OCR/AI para extraccion documental

## 2. Queries de bootstrap de la pagina

### Obra

- `GET /api/obras/:id`

Uso:

- poblar form principal

### Notas de memoria

- `GET /api/obras/:id/memoria`

### Materiales

- `GET /api/obras/:id/materials`

### Certificados propios

- `GET /api/obras/:id/certificates`

### Links del arbol documental

- `GET /api/obras/:id/documents-tree?limit=500`

Retorna:

- carpetas OCR
- columnas de tablas OCR
- filas recientes
- documentos procesados
- `dataInputMethod`

### Flujo

- `GET /api/flujo-actions?obraId=...`
- `GET /api/obra-recipients?obraId=...`

### Pendientes

- `GET /api/obras/:id/pendientes`

### Reporting

- `GET /api/obras/:id/rules`
- `GET /api/obras/:id/findings`
- `GET /api/obras/:id/tablas`

## 3. Guardado de la obra

### Entrada

- submit de TanStack Form en `page.tsx`

### Salida

- `PUT /api/obras/:id`

### Payload

- copia de `Obra`
- normalizacion de `onFinishSecondSendAt`

### Post guardado

- invalidate:
  - `['obra', obraId]`
  - `['obras-dashboard']`

## 4. Data flow de columnas custom de tabla principal

### Origen

- config desde `/api/main-table-config`

### Lectura

- se arma `mainTableColumnValues` mezclando:
  - valores base de `Obra`
  - `customData`
  - formulas evaluadas

### Escritura

- `setCustomMainColumnValue(...)`
- persiste dentro de `customData`
- se termina guardando junto con `PUT /api/obras/:id`

## 5. Data flow de tablas OCR y manuales

## Metadata de columnas

- tabla: `obra_tabla_columns`
- route:
  - `GET /api/obras/:id/tablas`
  - `GET /api/obras/:id/documents-tree`

Columnas relevantes:

- `field_key`
- `label`
- `data_type`
- `required`
- `config`

## Filas

- tabla: `obra_tabla_rows`
- route principal:
  - `GET /api/obras/:id/tablas/:tablaId/rows`
  - `POST /api/obras/:id/tablas/:tablaId/rows`

### Guardado de filas

`POST /api/obras/:id/tablas/:tablaId/rows` hace:

1. carga metadata de columnas
2. para cada fila dirty:
   - coercea cada campo con `coerceValueForType`
   - evalua formulas con `evaluateTablaFormula`
   - preserva `__docPath` y `__docFileName`
3. hace upsert en `obra_tabla_rows`
4. borra filas eliminadas

## 6. Data flow del file manager

### Fuente principal

- `GET /api/obras/:id/documents-tree`

### Que mezcla

- storage tree
- tablas OCR
- columnas por tabla
- documentos OCR procesados
- filas recientes por tabla
- agrupacion de ordenes de materiales

### Resultado usado por UI

- arbol de carpetas y archivos
- carpetas OCR marcadas
- tablas disponibles por carpeta
- filas filtrables por documento

## 7. Metadata de trazabilidad por documento

Las filas OCR pueden incluir:

- `data.__docPath`
- `data.__docFileName`

### Se usa para

- abrir documento origen desde una fila
- mostrar columna `Documento origen`
- filtrar tabla por documento
- reconstruir `DocumentDataSheet`

## 8. OCR multi-documento

### Endpoint

- `POST /api/obras/:id/tablas/import/ocr-multi`

### Entradas

- documento subido o referencia a documento existente
- lista de `tablaIds`

### Pipeline

1. carga tablas y columnas
2. separa columnas parent vs item
3. arma schema zod de extraccion
4. construye prompt por tabla
5. llama al modelo OCR
6. extrae JSON
7. coercea valores segun `dataType`
8. guarda filas en `obra_tabla_rows`
9. guarda estado en `ocr_document_processing`
10. registra consumo de plan si corresponde

### Salida

- filas insertadas por tabla
- estado del procesamiento

## 9. Import de planillas

### Endpoint

- `POST /api/obras/:id/tablas/import/spreadsheet-multi`

### Modos

- preview
- import real

### Pipeline

1. parsea CSV o XLSX
2. detecta header row
3. convierte filas a objetos
4. intenta mapear secciones conocidas
5. genera preview por tabla
6. al confirmar:
   - coercea por tipo
   - guarda filas

## 10. Data flow del document preview

### Apertura

- desde click en archivo o accion contextual

### Componentes

- `DocumentSheet`
- `DocumentPreview`
- `EnhancedDocumentViewer`

### Atajos de teclado

- PDF soporta:
  - izquierda / page up
  - derecha / page down
  - `+`, `=`, `-`, `_`, `0`

### Regla nueva

- si el foco esta en un input/textarea/select/contenteditable, el viewer no roba esos atajos

## 11. Data flow del sheet de datos extraidos

### Config

- `documentDataTableConfig`

### Fuente

- `activeDocumentOcrLink`
- `activeDocumentOcrColumns`
- `activeDocumentOcrRows`

### Guardado

- `POST /api/obras/:id/tablas/:tablaId/rows`

### Refresco

- `buildFileTree({ skipCache: true })`

## 12. Data flow de Quick Actions

### Configuracion

- tenant-scoped via defaults

### Runtime

- usa:
  - defaults
  - folders
  - tablas de la obra

### Operaciones

- upload simple
- OCR puntual
- insercion manual en tabla

## 13. Data flow de Flujo

### CRUD

- `POST /api/flujo-actions`
- `PUT /api/flujo-actions`
- `DELETE /api/flujo-actions?id=...`

### Modelo

- tipo de accion
- modo de tiempo
- usuarios destinatarios
- tipos de notificacion
- enabled

### Ejecucion conceptual

Se dispara cuando la obra alcanza 100% y el backend/workflows resuelve:

- scheduling
- notificaciones
- eventos calendario

## 14. Data flow de pendientes y recordatorios

### Pendientes

- `POST/PUT/DELETE /api/obras/:id/pendientes`

### Recordatorios

- `POST /api/doc-reminders`

### Regla actual

- al guardar un pendiente con `dueMode = fixed`, se intenta programar recordatorio

## 15. Reporting

### Reporte general de obra

Usa:

- `/api/obras/:id/tables`
- `/api/obras/:id/rules`
- `/api/obras/:id/signals`
- `/api/obras/:id/findings`
- `/api/obras/:id/signals/recompute`
- `/api/obras/:id/findings/evaluate`

### Defaults de reporting del tenant

Pantalla:

- `/admin/obra-defaults/reporting`

APIs:

- `GET /api/reporting/defaults`
- `PUT /api/reporting/defaults`
- `DELETE /api/reporting/defaults`

Persistencia:

- `tenant_reporting_config`

### Resolucion de config final por obra

El backend compone la configuracion en este orden:

1. `tenant_reporting_config` (base)
2. `obra_rule_config` (overlay)
3. inferencias faltantes de curva (si aplica)
4. merge final con defaults del sistema

Adicionalmente, normaliza referencias de tabla para que el config apunte a `obra_tablas.id` validos:

- match directo por id
- fallback por `settings.defaultTablaId`
- fallback por nombre de tabla default

### Recomendaciones en tab General (no findings)

Las recomendaciones de:

- `certificadoALaFecha`
- `saldoACertificar`
- `porcentaje`

se calculan en `app/excel/[obraId]/page.tsx` usando certificados extraidos y mapping de `recommendations`.
Cuando un campo parece manual, no se pisa automaticamente, pero se muestra sugerencia y boton para aplicar.

### Reporte de tabla OCR

Usa:

- `/api/obras/:id/tablas`
- `/api/obras/:id/tablas/:tablaId/rows?limit=1`

Para:

- obtener columnas
- inferir si hay columna de documento fuente
- construir config dinamica de reporte

## 16. Cache e invalidacion

### React Query

Se invalida explicitamente en eventos como:

- guardar obra
- refrescar materiales
- guardar flujo

### FileManager

Usa `buildFileTree({ skipCache: true })` cuando una accion modifica:

- storage
- filas OCR
- estados OCR
- esquema de tablas
