# Pantallas y rutas

## 1. Shell de la pagina de obra

Archivo:

- `app/excel/[obraId]/page.tsx`

### Que hace

- resuelve `obraId`
- carga la obra y entidades relacionadas
- mantiene el tab activo sincronizado con query params
- monta los tabs de General, Flujo y Documentos
- controla el panel lateral de Memoria

### Estado principal que maneja

- `activeTab`
- `isGeneralTabEditMode`
- `isMemoriaOpen`
- `pendingDocs`
- `newFlujoAction`
- `mainTableColumnsConfig`

### Queries principales

- obra
- memoria
- materiales
- certificados
- links del arbol documental OCR
- destinatarios de flujo
- acciones de flujo
- pendientes
- findings y reglas para reportes

## 2. Tab General

Archivo:

- `app/excel/[obraId]/tabs/general-tab.tsx`

### Modos

- vista previa
- edicion

### Bloques principales

#### Avance

- preview:
  - `CircularProgress`
  - alertas abiertas derivadas de findings

- edit:
  - input de porcentaje

#### Informacion general

- designacion y ubicacion
- entidad contratante
- mes basico
- iniciacion
- numero de obra
- superficie

#### Datos financieros

- contrato + ampliaciones
- certificado a la fecha
- saldo a certificar
- segun contrato
- prorrogas
- plazo total
- plazo transcurrido

#### Certificados resumidos

Se construyen a partir de una de estas fuentes, en este orden:

1. `certificadosExtraidosRows`
2. `certificates`
3. `form.state.values.customData`

#### Campos configurados

Se muestran las columnas configuradas de tabla principal:

- columnas base
- columnas custom
- columnas formula

#### Quick actions

Panel flotante renderizado con:

- `components/quick-actions/quick-actions-panel.tsx`

#### Curva y findings

- curva plan vs curva real
- findings agrupados

## 3. Panel de Memoria

Vive dentro de `page.tsx`.

### Desktop

- panel lateral derecho animado

### Mobile

- sheet inferior

### Funcionalidad

- listar notas historicas
- mostrar usuario y fecha
- permitir agregar nuevas notas

## 4. Tab Flujo

Archivo:

- `app/excel/[obraId]/tabs/flujo-tab.tsx`

### Funcionalidad principal

- listar acciones existentes
- agrupar acciones por timing
- crear accion nueva
- editar accion
- activar/desactivar
- eliminar

### Tipos de accion

- `email`
- `calendar_event`

### Modos de tiempo

- `immediate`
- `offset`
- `scheduled`

### Destinatarios

- usuarios explicitos
- usuarios resueltos por rol

## 5. Tab Documentos

Entrada:

- `app/excel/[obraId]/tabs/documents-tab.tsx`

Motor:

- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`

### Responsabilidades visuales

- sidebar con arbol de carpetas
- encabezado contextual de carpeta
- grilla o lista de archivos
- modo tabla para carpetas OCR/manuales
- preview de documento
- hoja lateral de datos extraidos

### Query params sincronizados

- `tab=documentos`
- `folder=...`
- `file=...`

## 6. File Manager - modos importantes

### Carpeta normal

Permite:

- ver archivos
- subir archivos
- abrir preview

### Carpeta OCR o manual

Permite ademas:

- modo `Archivos`
- modo `Tabla`
- upload OCR
- filas manuales
- editar columnas
- generar reporte

### Documento abierto

Abre:

- `DocumentSheet`

Y si hay datos asociados:

- `DocumentDataSheet`

## 7. DocumentSheet

Archivo:

- `app/excel/[obraId]/tabs/file-manager/components/document-sheet.tsx`

### Funcionalidad

- preview de PDF o imagen
- boton de OCR retry
- boton para abrir/cerrar datos extraidos
- muestra status OCR del documento

## 8. DocumentDataSheet

Archivo:

- `app/excel/[obraId]/tabs/file-manager/components/document-data-sheet.tsx`

### Funcionalidad

- monta un `FormTable` embebido
- cambia de tabla si un documento alimenta mas de una tabla OCR
- permite editar filas de ese documento

## 9. Reporte general de obra

Ruta:

- `/excel/[obraId]/report`

Archivo:

- `app/excel/[obraId]/report/report-client.tsx`

### Funcionalidad

- listar tablas detectadas
- configurar mappings de reglas
- recomputar signals
- evaluar findings
- guardar override de configuracion de obra
- resetear override para volver al default del tenant

## 10. Hub de defaults de reporting (admin)

Ruta:

- `/admin/obra-defaults/reporting`

Archivo:

- `app/admin/obra-defaults/reporting/page.tsx`

### Funcionalidad

- editar default de reglas a nivel tenant
- usar el mismo wizard `RuleConfigHub` que en obra
- guardar o resetear default del tenant
- definir el baseline que heredaran obras sin override

## 11. Reporte de tabla OCR

Ruta:

- `/excel/[obraId]/tabla/[tablaId]/reporte`

Archivo:

- `app/excel/[obraId]/tabla/[tablaId]/reporte/page.tsx`

### Funcionalidad

- cargar metadata de la tabla
- detectar si existe `__docFileName`
- construir un `ReportConfig` dinamico
- renderizar `ReportPage`
