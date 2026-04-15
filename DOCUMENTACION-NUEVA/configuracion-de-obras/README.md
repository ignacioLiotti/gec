# Configuracion de Obras

## 1. Objetivo del modulo

`Configuracion de Obras` es el modulo administrativo que define la estructura base que va a heredar cada nueva obra del tenant.

Desde esta pantalla se configuran cuatro cosas:

1. `Carpetas Predeterminadas`
2. `Acciones rapidas`
3. `Plantillas de extraccion`
4. `Defaults de reporting`

Este modulo no trabaja aislado. Lo que se configura aca impacta en:

- la estructura de carpetas de cada obra nueva
- las tablas OCR/manuales asociadas a carpetas de datos
- los documentos que se suben en la pestana `Documentos`
- las tablas dinamicas que aparecen en el file manager
- las acciones rapidas que aparecen en la pestana `General` de una obra
- los datos extraidos que luego alimentan reportes, macros, certificados y workflows

---

## 2. Vista general de la pantalla

La pantalla principal de `Configuracion de Obras` esta dividida en tres bloques visuales, mas un acceso al hub de reporting:

### 2.1. Carpetas Predeterminadas

Muestra la estructura de carpetas que se crea automaticamente dentro de cada nueva obra.

Hay dos tipos de carpeta:

- `Carpeta normal`: solo organiza archivos.
- `Carpeta de datos`: ademas de organizar archivos, crea una tabla asociada para carga manual, OCR o ambos.

Las carpetas de datos se muestran con badge `Extraccion` y se pueden expandir para ver:

- path de carpeta
- cantidad de campos
- plantilla OCR vinculada
- si tiene datos anidados
- columnas a nivel documento
- columnas a nivel item

### 2.2. Acciones rapidas

Permite definir flujos guiados de varios pasos basados en carpetas.

Cada accion rapida es una secuencia ordenada de carpetas. En tiempo de uso, el sistema decide si cada paso es:

- subida de archivo
- OCR
- carga manual
- OCR o manual

### 2.3. Plantillas de extraccion

Permite definir plantillas OCR por tipo de documento.

Cada plantilla guarda:

- nombre
- imagen base del documento
- regiones de extraccion
- tipo de region (`single` o `table`)
- columnas derivadas desde esas regiones

Estas plantillas luego se usan cuando se crea o edita una `carpeta de datos`.

### 2.4. Defaults de reporting

Desde el boton `Hub de defaults de reporting` se abre:

- ruta: `/admin/obra-defaults/reporting`

Ese hub define reglas base para todas las obras del tenant:

- que tablas alimentan cada pack
- que columnas usa cada calculo
- que umbrales usa cada hallazgo

Si una obra no tiene override propio en `/excel/[obraId]/report`, hereda esta configuracion.

---

## 3. Conceptos base del modulo

## 3.1. Carpeta normal

Es una carpeta que solo existe en storage.

Ejemplos:

- `Documentacion`
- `Oferta`
- `Pliego`
- `Polizas`

No crea tabla dinamica.
No tiene columnas.
No ejecuta OCR.

## 3.2. Carpeta de datos

Es una carpeta que, ademas de existir en storage, queda vinculada a una tabla dinamica.

Puede trabajar con tres modos de entrada:

- `ocr`
- `manual`
- `both`

Esto se usa para que, dentro de la obra, la carpeta no sea solo un contenedor de archivos sino tambien una fuente estructurada de datos.

## 3.3. Tabla default

Cuando una carpeta de datos se guarda en `Configuracion de Obras`, el sistema crea o actualiza una definicion default de tabla para el tenant.

Esa definicion vive separada de las obras concretas y funciona como plantilla.

## 3.4. Tabla de obra

Cuando se crea una obra nueva, o cuando se sincroniza una carpeta default sobre obras existentes, esa definicion default se clona como tabla concreta de la obra.

## 3.5. Columnas default vs columnas de obra

El sistema diferencia entre:

- columnas del template tenant (`obra_default_tabla_columns`)
- columnas reales dentro de una obra (`obra_tabla_columns`)

La sincronizacion entre ambas es importante para poder:

- agregar nuevas columnas a todas las obras
- renombrar columnas sin perder datos
- eliminar columnas obsoletas
- mantener consistencia entre configuracion y datos extraidos

---

## 4. Pantallas y subflujos

## 4.1. Crear carpeta nueva

Boton: `Nueva carpeta`

Abre un dialogo que permite elegir:

- `Carpeta normal`
- `Carpeta de datos`

Campos principales del dialogo:

- `Carpeta padre (opcional)`
- `Nombre de la carpeta`

Si se elige `Carpeta normal`, el alta termina ahi.

Si se elige `Carpeta de datos`, se habilitan opciones extra:

- `Metodo de carga de datos`
- `Plantilla de extraccion XLSX/CSV`
- `Plantilla de extraccion`
- `Datos anidados`
- `Columnas de la tabla`

## 4.2. Editar carpeta existente

Accion: icono de lapiz en una fila de carpeta

Al editar una carpeta se puede cambiar:

- nombre
- path padre
- si es carpeta de datos
- modo de carga
- plantilla OCR
- columnas
- required
- scope documento/item

En una carpeta de datos, la edicion no solo actualiza la configuracion tenant. Tambien encola una sincronizacion para obras existentes.

## 4.3. Eliminar carpeta

Accion: icono de papelera

La eliminacion hace dos cosas:

1. elimina la definicion default
2. encola un job para remover la carpeta y sus tablas vinculadas de obras existentes

## 4.4. Crear accion rapida

Boton: `Nueva accion`

Campos:

- nombre
- descripcion
- carpetas seleccionadas en orden

El orden de seleccion es el orden de pasos.

## 4.5. Crear plantilla OCR

Boton: `Nueva plantilla`

Workflow:

1. subir imagen del documento
2. dibujar regiones
3. marcar si cada region es `single` o `table`
4. definir labels
5. guardar

La pantalla de plantillas hoy trabaja principalmente con imagenes. El soporte PDF en este configurador todavia no esta resuelto como flujo principal.

---

## 5. Workflow completo de carpetas predeterminadas

## 5.1. Alta de carpeta normal

### Flujo funcional

1. Admin crea carpeta normal.
2. Se guarda en `obra_default_folders`.
3. Se encola un job `apply_default_folder`.
4. Ese job crea la carpeta en obras existentes.
5. Las obras nuevas tambien la heredaran automaticamente.

### Resultado visible

- aparece en `Configuracion de Obras`
- aparece en la estructura de documentos de cada obra

## 5.2. Alta de carpeta de datos

### Flujo funcional

1. Admin crea carpeta de datos.
2. Se guarda la carpeta en `obra_default_folders`.
3. Se crea una tabla default en `obra_default_tablas`.
4. Se crean sus columnas en `obra_default_tabla_columns`.
5. Se encola `apply_default_folder`.
6. El job:
   - crea la carpeta en cada obra existente
   - crea o actualiza la tabla OCR/manual de esa obra
   - crea sus columnas concretas

### Resultado visible

- la carpeta aparece con badge `Extraccion`
- en obras existentes aparece una nueva carpeta con tabla asociada
- en obras nuevas se crea automaticamente

## 5.3. Edicion de carpeta de datos

### Flujo funcional

1. Admin edita la carpeta.
2. Se actualiza `obra_default_folders`.
3. Se actualiza `obra_default_tablas`.
4. Se sincronizan columnas default sin destruir identidad logica de columnas existentes.
5. Se encola un `apply_default_folder` con `forceSync: true`.
6. El job sincroniza todas las obras existentes vinculadas a esa carpeta.

### Que se sincroniza

- nombre de carpeta
- path
- settings
- plantilla OCR
- columnas
- columna required
- scope documento/item

### Que pasa con los datos ya extraidos

Si la tabla ya tenia filas:

- columnas nuevas se agregan vacias/null
- columnas removidas dejan de formar parte del schema activo
- renombres se intentan preservar por identidad de columna
- formulas se recalculan despues del remapeo

Este fue el workflow que se corrigio para soportar casos como `Certificados Extraidos -> agregar "N° Expediente"` tanto para obras viejas como nuevas.

## 5.4. Eliminacion de carpeta de datos

### Flujo funcional

1. Se elimina la carpeta default.
2. Se eliminan tablas default vinculadas.
3. Se encola un `remove_default_folder`.
4. El worker:
   - busca tablas de obra vinculadas por folder o por defaultTablaId
   - elimina tablas y archivos asociados

---

## 6. Workflow de columnas en carpetas de datos

## 6.1. Como se definen

Cada columna tiene:

- `label`
- `fieldKey`
- `dataType`
- `required`
- `scope` si hay datos anidados
- `description` opcional

Tipos de dato soportados:

- `text`
- `number`
- `currency`
- `boolean`
- `date`

## 6.2. Como se usa el `fieldKey`

`fieldKey` es la clave tecnica con la que los valores quedan guardados dentro del JSON de cada fila.

Ejemplo:

- label: `N° Expediente`
- fieldKey normalizado: `n_expediente` o `nro_expediente`

El label es lo que ve el usuario.
El fieldKey es lo que usa el sistema para persistencia y formulas.

## 6.3. Alta de una columna nueva

Ejemplo:

- agregar `N° Expediente` a `Certificados Extraidos`

Efecto:

- se crea la nueva columna en la definicion tenant
- se replica en tablas de obras existentes
- las filas viejas quedan con esa columna vacia/null
- las filas nuevas ya podran llenarla manualmente o via OCR

## 6.4. Cambio de una columna existente

Si cambia:

- label
- tipo
- required
- descripcion

el sistema intenta conservar el mismo vinculo con la columna original.

## 6.5. Eliminacion de una columna

La columna se remueve del schema activo.

Los datos viejos quedan fuera del schema visible luego del remapeo.

## 6.6. Datos anidados

Cuando `Datos anidados` esta activo, una columna puede ser:

- `parent`: dato a nivel documento
- `item`: dato a nivel item/tabla

Esto sirve para documentos donde una parte del OCR corresponde al encabezado y otra parte a una tabla de items.

---

## 7. Workflow de plantillas de extraccion

## 7.1. Que resuelve

Una plantilla OCR define como leer un tipo de documento repetitivo.

Ejemplos:

- orden de compra
- certificado
- factura
- resumen de medicion

## 7.2. Como se construye

El usuario dibuja regiones sobre una imagen del documento.

Tipos de region:

- `single`: un solo valor
- `table`: una tabla repetitiva

Desde esas regiones se derivan columnas:

- regiones `single` generan columnas de scope `parent`
- regiones `table` generan columnas de scope `item`

## 7.3. Como se conecta con carpetas de datos

Una carpeta de datos puede apuntar a:

- una `Plantilla de extraccion`
- una `Plantilla de extraccion XLSX/CSV`

Si la carpeta tiene plantilla OCR, el OCR puede usarla para interpretar documentos subidos a esa carpeta.

## 7.4. Plantillas XLSX/CSV

Hay dos caminos importantes:

- `auto`
- `certificado`

En el caso `certificado`, el sistema tiene presets especiales como:

- `PMC Resumen`
- `PMC Items`
- `Curva Plan`

Estos presets generan tablas con columnas predefinidas orientadas a certificados.

---

## 8. Workflow de acciones rapidas

## 8.1. Que son

Las acciones rapidas son secuencias guiadas de carga.

Se configuran en admin, pero se ejecutan dentro de cada obra.

## 8.2. Como se configuran

Desde `Configuracion de Obras`:

1. crear accion
2. poner nombre y descripcion
3. seleccionar carpetas en el orden correcto
4. guardar

## 8.3. Como se ejecutan en la obra

Lugar de uso: pestana `General` de una obra

La UI abre un panel flotante con pasos.

Cada paso decide automaticamente su naturaleza segun la carpeta:

- carpeta normal -> subir archivo
- carpeta OCR -> OCR
- carpeta manual -> carga manual
- carpeta both -> elegir OCR o manual

## 8.4. Que pasa al terminar cada paso

Despues de cada paso se emite un refresh para la documentacion de la obra.

Esto hace que:

- se refresque el tree de documentos
- se refresquen links OCR
- se refresquen filas extraidas visibles

---

## 9. Que pasa cuando se crea una obra nueva

Cuando nace una obra nueva, el sistema aplica defaults del tenant.

### Flujo

1. se crea la obra
2. `applyObraDefaults` busca carpetas default
3. crea placeholders `.keep` en storage
4. busca tablas default OCR
5. crea tablas concretas `obra_tablas`
6. clona columnas `obra_tabla_columns`
7. deja lista la estructura para documentacion y OCR

### Resultado

La nueva obra ya nace con:

- sus carpetas
- sus carpetas de datos
- sus tablas OCR/manuales
- sus columnas
- sus quick actions disponibles

---

## 10. Que pasa en obras existentes cuando cambia la configuracion

Este es uno de los puntos mas importantes del modulo.

Cuando se edita una carpeta default, no solo cambia el template. Tambien se encola una sincronizacion sobre obras existentes.

### Flujo tecnico

1. admin guarda cambios
2. backend inserta job en `background_jobs`
3. `POST /api/jobs/run` toma jobs pendientes
4. `applyDefaultFolderToExistingObras` busca todas las obras del tenant
5. actualiza carpeta y tabla vinculada
6. recrea el schema de columnas
7. remapea filas existentes para que queden alineadas al schema nuevo

### Ejemplo concreto

Carpeta:

- `Certificados Extraidos`

Cambio:

- agregar columna `N° Expediente`

Resultado:

- obras nuevas: la columna ya existe desde el alta
- obras viejas: la columna se agrega vacia/null en filas ya existentes

---

## 11. Workflow dentro de la pestana Documentos

Lo configurado en `Configuracion de Obras` se consume en el file manager de cada obra.

## 11.1. Document tree

El arbol de documentos se construye a partir de:

- storage `obra-documents`
- carpetas configuradas
- tablas OCR de la obra
- estados de OCR

## 11.2. OCR links

`/api/obras/:id/tablas/ocr-links` devuelve por cada tabla OCR:

- tablaId
- tablaName
- folderName
- columns
- rows
- documents
- dataInputMethod

Eso permite que el file manager muestre:

- carpeta OCR
- columnas visibles
- filas extraidas
- documentos procesados
- estado de OCR

## 11.3. Guardado manual de filas

Si una carpeta tiene modo manual o both, la tabla se puede editar directamente.

Los datos se guardan en:

- `obra_tabla_rows`

Cada fila guarda un JSON `data` con claves basadas en `fieldKey`.

## 11.4. Importacion OCR

Cuando se sube un archivo a una carpeta OCR:

1. se guarda archivo
2. se lanza OCR
3. se persisten filas extraidas
4. se actualiza estado en `ocr_document_processing`
5. el file manager vuelve a consultar rows y documents

---

## 12. Modelo de datos

## 12.1. Tablas tenant/default

### `obra_default_folders`

Guarda carpetas predeterminadas del tenant.

Campos clave:

- `tenant_id`
- `name`
- `path`
- `position`

### `obra_default_tablas`

Guarda tablas default vinculadas a carpetas de datos.

Campos clave:

- `tenant_id`
- `name`
- `source_type`
- `linked_folder_path`
- `settings`
- `ocr_template_id`

### `obra_default_tabla_columns`

Guarda columnas default de cada tabla default.

Campos clave:

- `default_tabla_id`
- `field_key`
- `label`
- `data_type`
- `position`
- `required`
- `config`

### `obra_default_quick_actions`

Guarda acciones rapidas.

Campos clave:

- `tenant_id`
- `name`
- `description`
- `folder_paths`
- `position`
- `obra_id` opcional

### `ocr_templates`

Guarda plantillas OCR del tenant.

Campos clave:

- `tenant_id`
- `name`
- `regions`
- `columns`
- `template_file_name`
- `is_active`

## 12.2. Tablas por obra

### `obra_tablas`

Tabla dinamica real de una obra.

Campos clave:

- `obra_id`
- `name`
- `source_type`
- `settings`

### `obra_tabla_columns`

Columnas reales de la tabla de una obra.

Campos clave:

- `tabla_id`
- `field_key`
- `label`
- `data_type`
- `position`
- `required`
- `config`

Nota importante:

En sincronizaciones desde defaults, `config.defaultColumnId` se usa para conservar identidad entre columna default y columna concreta de la obra.

### `obra_tabla_rows`

Filas reales de datos.

Campos clave:

- `tabla_id`
- `data` JSONB
- `source`

### `ocr_document_processing`

Estado de procesamiento OCR por documento.

Campos clave:

- `obra_id`
- `tabla_id`
- `source_path`
- `status`
- `rows_extracted`
- `error_message`

### `background_jobs`

Cola simple para cambios que deben aplicarse a obras existentes.

Tipos usados por este modulo:

- `apply_default_folder`
- `remove_default_folder`

---

## 13. APIs involucradas

## 13.1. Configuracion de obras

### `GET /api/obra-defaults`

Devuelve:

- folders
- quickActions

### `POST /api/obra-defaults`

Usos:

- crear carpeta
- crear carpeta de datos
- crear quick action

### `PUT /api/obra-defaults`

Usos:

- editar carpeta
- editar carpeta de datos

### `DELETE /api/obra-defaults`

Usos:

- eliminar carpeta
- eliminar quick action

## 13.2. Plantillas OCR

### `GET /api/ocr-templates`

Lista templates activos del tenant.

### `POST /api/ocr-templates`

Crea una plantilla OCR.

### `DELETE /api/ocr-templates`

Hace soft delete de una plantilla.

## 13.3. Aplicacion de defaults

### `applyObraDefaults(...)`

Helper principal para nuevas obras.

### `POST /api/jobs/run`

Procesa jobs pendientes para obras existentes.

### `POST /api/obra-defaults/apply`

Ruta auxiliar/manual para aplicar defaults a una obra ya existente.

## 13.4. Runtime de tablas OCR/manuales

### `GET /api/obras/:id/tablas/ocr-links`

Devuelve tablas OCR de la obra con columnas, rows y documentos.

### `PATCH /api/obras/:id/tablas/:tablaId`

Edita el schema de una tabla concreta de obra.

### `POST /api/obras/:id/tablas/:tablaId/rows`

Guarda filas manuales.

### `POST /api/obras/:id/tablas/:tablaId/import/ocr`

Importa OCR de un documento.

## 13.5. Runtime de reporting (tenant y obra)

### `GET/PUT/DELETE /api/reporting/defaults`

Administra el default de reporting del tenant (`tenant_reporting_config`).

### `GET/POST/DELETE /api/obras/:id/rules`

Lee, guarda o limpia override de reporting para una obra (`obra_rule_config`).

### `POST /api/obras/:id/signals/recompute`

Recalcula señales para la obra y persiste en `obra_signals`.

### `POST /api/obras/:id/findings/evaluate`

Evalua hallazgos abiertos usando señales + config efectiva.

---

## 14. Reglas de sincronizacion y consistencia

## 14.1. Nuevas obras

Siempre heredan la version actual del default del tenant.

## 14.2. Obras existentes

Se sincronizan por job cuando cambia una carpeta default.

## 14.3. Matching de columnas

El sistema intenta resolver columnas por:

1. `id`
2. `fieldKey`
3. si no encuentra match, la trata como nueva

Esto evita errores al editar schemas y permite que no falle el guardado por ids stale del frontend.

## 14.4. Remapeo de filas

Cuando cambia el schema:

- se vuelve a construir el JSON de cada fila
- se preservan metadatos `__...`
- se recalculan formulas
- se coercionan tipos

---

## 15. Caso de uso: Certificados Extraidos + N° Expediente

## 15.1. Necesidad

Ya existia la carpeta:

- `Certificados Extraidos`

Y ya habia obras con datos extraidos historicos.

Se necesitaba agregar:

- `N° Expediente`

sin perder compatibilidad con:

- obras nuevas
- obras viejas
- filas ya extraidas

## 15.2. Resultado esperado

Despues de editar la carpeta y guardar:

- la columna aparece en el schema default
- la columna aparece en obras nuevas
- la columna aparece en obras existentes
- las filas historicas la muestran vacia/null

## 15.3. Dependencia operativa

Si el worker/cron no esta ejecutando `POST /api/jobs/run`, la sincronizacion a obras existentes no corre sola.

En ese caso hay que dispararlo manualmente.

---

## 16. Troubleshooting

## 16.1. Guarde una carpeta y no se ve reflejada en obras existentes

Posibles causas:

- el job se encolo pero no se proceso
- no esta corriendo `POST /api/jobs/run`

Que revisar:

- tabla `background_jobs`
- estado del job
- logs del endpoint de jobs

## 16.2. La carpeta existe pero no tiene columnas

Posibles causas:

- la carpeta se creo sin columnas
- la plantilla OCR no devolvio columnas
- hubo error insertando `obra_default_tabla_columns`

## 16.3. El OCR corre pero no aparecen datos

Posibles causas:

- la plantilla OCR no mapea correctamente el documento
- el documento no coincide con el template
- la tabla no tiene columnas compatibles
- error en el import OCR o en `ocr_document_processing`

## 16.4. Error al guardar columnas

Casos comunes:

- `fieldKey` duplicado
- columna stale del frontend
- mismatch entre schema actual y payload del editor

La resolucion actual intenta hacer fallback por `fieldKey` antes de tratar la columna como nueva.

---

## 17. Archivos clave del codigo

### UI admin

- `app/admin/obra-defaults/page.tsx`
- `app/admin/obra-defaults/_components/OcrTemplateConfigurator.tsx`

### APIs admin/defaults

- `app/api/obra-defaults/route.ts`
- `app/api/obra-defaults/apply/route.ts`
- `app/api/ocr-templates/route.ts`
- `app/api/jobs/run/route.ts`

### Helpers

- `lib/obra-defaults.ts`
- `lib/obra-defaults/apply-default-folder.ts`
- `lib/obra-defaults/remove-default-folder.ts`
- `lib/tablas.ts`

### Runtime en obra

- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`
- `app/excel/[obraId]/tabs/general-tab.tsx`
- `components/quick-actions/quick-actions-panel.tsx`
- `app/api/obras/[id]/tablas/ocr-links/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/rows/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/import/ocr/route.ts`

---

## 18. Resumen ejecutivo

`Configuracion de Obras` es el punto de origen de la estructura operativa de cada obra.

Desde aca se define:

- como se ordenan los documentos
- que carpetas generan tablas de datos
- como se extraen datos por OCR
- que acciones rapidas existen
- como se sincronizan cambios hacia obras nuevas y existentes

La pieza mas delicada del modulo es la sincronizacion entre defaults tenant y tablas reales de obra. Esa sincronizacion hoy ya contempla cambios de schema, incluyendo el agregado de nuevas columnas sobre datos historicos.
