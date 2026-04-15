# Excel `[obraId]` - Documentacion general

## Alcance

Esta carpeta documenta el modulo de detalle de obra en la ruta:

- `app/excel/[obraId]/page.tsx`

El objetivo es dejar claro:

- que pantallas existen
- que hace cada pantalla
- cuales son los workflows principales
- como fluye la data entre UI, APIs y Supabase
- que reglas implicitas existen en el comportamiento actual

## Mapa rapido del modulo

### Ruta principal

- Ruta: `/excel/[obraId]`
- Archivo principal: `app/excel/[obraId]/page.tsx`
- Tabs activas:
  - `general`
  - `flujo`
  - `documentos`

### Rutas relacionadas

- Reporte general de obra:
  - `/excel/[obraId]/report`
  - archivo: `app/excel/[obraId]/report/report-client.tsx`

- Defaults de reporting del tenant (admin):
  - `/admin/obra-defaults/reporting`
  - archivo: `app/admin/obra-defaults/reporting/page.tsx`

- Reporte de una tabla OCR:
  - `/excel/[obraId]/tabla/[tablaId]/reporte`
  - archivo: `app/excel/[obraId]/tabla/[tablaId]/reporte/page.tsx`

## Pantallas y subpantallas

### 1. General

Render principal:

- `app/excel/[obraId]/tabs/general-tab.tsx`

Responsabilidades:

- mostrar resumen de la obra
- alternar entre vista previa y modo edicion
- editar campos base de la obra
- mostrar KPIs financieros
- mostrar certificados extraidos resumidos
- mostrar campos configurados de tabla principal
- mostrar quick actions
- mostrar curva de avance y findings

### 2. Flujo

Render principal:

- `app/excel/[obraId]/tabs/flujo-tab.tsx`

Responsabilidades:

- configurar acciones automaticas al completar la obra
- crear acciones de tipo email o calendar event
- definir momento de ejecucion:
  - inmediato
  - offset
  - fecha programada
- asignar destinatarios por usuario o rol

### 3. Documentos

Entrada del tab:

- `app/excel/[obraId]/tabs/documents-tab.tsx`

Motor principal:

- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`

Responsabilidades:

- navegar arbol de carpetas y archivos
- subir documentos
- operar carpetas OCR o manuales
- ver tabla extraida por carpeta
- abrir preview de documento
- abrir sheet de datos extraidos
- editar filas OCR/manuales
- reprocesar OCR
- disparar importaciones desde planillas
- editar esquema de columnas
- generar reporte por tabla

### 4. Preview de documento

Componente:

- `app/excel/[obraId]/tabs/file-manager/components/document-sheet.tsx`

Viewer:

- `components/viewer/enhanced-document-viewer.tsx`

Responsabilidades:

- mostrar PDF o imagen
- navegar paginas
- zoom
- reintentar OCR
- abrir/cerrar hoja lateral de datos extraidos

### 5. Hoja lateral de datos extraidos

Componente:

- `app/excel/[obraId]/tabs/file-manager/components/document-data-sheet.tsx`

Responsabilidades:

- mostrar `FormTable` embebida para las filas del documento activo
- permitir editar filas ya extraidas
- permitir agregar filas vacias
- guardar cambios en la tabla OCR asociada

### 6. Reportes

#### Reporte general de obra

- archivo: `app/excel/[obraId]/report/report-client.tsx`
- usa:
  - `/api/obras/:id/tables`
  - `/api/obras/:id/rules`
  - `/api/obras/:id/signals`
  - `/api/obras/:id/findings`

#### Reporte de tabla OCR

- archivo: `app/excel/[obraId]/tabla/[tablaId]/reporte/page.tsx`
- construye configuracion dinamica usando columnas de la tabla

## Conceptos de dominio

### Obra

Entidad principal editada en la pagina.

Datos tipicos:

- datos generales
- datos financieros
- porcentaje de avance
- campos custom en `customData`
- mensajes de finalizacion

### Tabla de obra

Representa una tabla estructurada vinculada a la obra.

Tipos principales:

- `manual`
- `csv`
- `ocr`

Una tabla tiene:

- metadata
- columnas
- filas
- settings

### Carpeta OCR

Una carpeta del arbol documental puede estar vinculada a una tabla OCR.

La vinculacion llega principalmente desde:

- `ocrFolder`
- `dataInputMethod`
- columnas de la tabla
- documentos procesados
- filas existentes

### Fila de tabla OCR

Se guarda en `obra_tabla_rows`.

La data vive en `data` y puede incluir metadata tecnica:

- `__docPath`
- `__docFileName`

Eso permite:

- filtrar filas por documento
- abrir el documento origen desde la tabla
- reconstruir la vista por archivo

## Componentes base reutilizados

### `FormTable`

Archivo:

- `components/form-table/form-table.tsx`

Es la base comun para:

- tablas OCR del file manager
- hoja lateral de datos extraidos
- tabla de certificados global
- macro tablas

### `lib/tablas.ts`

Contiene reglas clave:

- tipos de columnas
- coercion por tipo
- formulas intrafila
- parseo numerico localizado

### `lib/main-table-columns.ts`

Encapsula formateo y coercion para los campos configurados de la tabla principal.

## Estado actual importante

- El tab `certificates` existe en codigo pero esta comentado en la navegacion principal.
- El flujo real de certificados visibles hoy pasa sobre todo por:
  - `certificadosExtraidosRows`
  - tablas OCR de certificados
  - resumenes mostrados en General
  - reportes de tabla

## Documentos de esta carpeta

- `pantallas-y-rutas.md`
- `workflows.md`
- `data-flows-y-apis.md`
- `reglas-y-gotchas.md`
- `reporting-defaults-y-overrides.md`
