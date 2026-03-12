# Reglas implicitas y gotchas

## 1. Tabs activas reales

Aunque existen tipos y restos de codigo para certificados dentro de `page.tsx`, la navegacion activa hoy es:

- `general`
- `flujo`
- `documentos`

El tab `certificates` no esta visible en `components/excel-page-tabs.tsx`.

## 2. La fuente mas fuerte para certificados en General no es la tabla global de certificados

El resumen de certificados del tab General prioriza:

1. `certificadosExtraidosRows`
2. `certificates`
3. `customData`

Eso significa que la percepcion del usuario puede venir del OCR, aunque exista otra fuente secundaria.

## 3. Los KPI financieros pueden autoderivarse

`certificadoALaFecha`, `saldoACertificar` y `porcentaje` pueden actualizarse automaticamente desde certificados extraidos.

Pero no siempre se pisan:

- si el valor guardado parece override manual, se respeta
- si el campo actual esta dirty, se respeta

## 4. Las filas OCR guardan metadata de documento dentro de `data`

La relacion fila-documento no vive solo en tablas auxiliares.

Tambien vive en:

- `data.__docPath`
- `data.__docFileName`

Si se pierde esa metadata, se degradan:

- filtrado por documento
- document source cell
- hoja lateral de datos por archivo

## 5. `FormTable` es infraestructura critica

El renderer compartido afecta multiples pantallas:

- tabla OCR por carpeta
- hoja lateral de datos
- certificados globales
- macro tablas

Un cambio en:

- parsing numerico
- formateo visual
- blur/save
- atajos del viewer

puede pegar en varios productos a la vez.

## 6. El viewer PDF tenia un hotkey global para `0`

Hallazgo del debugging:

- `EnhancedDocumentViewer` capturaba `0` globalmente para reset zoom
- eso rompia inputs abiertos mientras el preview estaba montado

Regla nueva:

- si el target del teclado es editable, los hotkeys del viewer no corren

## 7. `0` no es "vacio"

En numeric flows hay que evitar checks del tipo:

- `if (!value) ...`

para inputs numericos.

La diferencia correcta es:

- `null` / `undefined` / `""` para vacio
- `0` para valor valido

## 8. El tipo de columna gobierna mas de lo que parece

`dataType` impacta:

- renderer del `FormTable`
- coercion al guardar
- formulas
- filtros
- import OCR
- import spreadsheet
- reportes

Cambiar `text` a `number` o `currency` no es cosmetico.

## 9. Los reportes dependen de nombres y columnas detectables

Especialmente en:

- curva plan
- PMC resumen
- monthly missing cert
- unpaid certs

Si cambian field keys o mappings, puede romper:

- deteccion automatica
- recompute de signals
- findings

## 10. `documents-tree` no es solo un list de storage

Ese endpoint mezcla:

- storage
- tablas OCR
- columnas
- documentos procesados
- filas
- ordenes agrupadas

Por eso es una pieza central del tab Documentos.

## 11. El modo de una carpeta cambia el workflow disponible

`dataInputMethod` puede ser:

- `ocr`
- `manual`
- `both`

Eso cambia:

- botones visibles
- posibilidad de agregar filas
- posibilidad de subir documentos
- comportamiento de quick actions

## 12. La hoja lateral de datos y la tabla principal de carpeta no son la misma vista

Comparten `FormTable`, pero conceptualmente:

- la tabla de carpeta muestra la tabla entera o filtrada por documento
- la hoja lateral se enfoca en el documento abierto

Ambas guardan sobre la misma tabla backend.

## 13. El refresh de documentos es parte del workflow

Despues de:

- upload
- OCR
- spreadsheet import
- save de filas
- retry OCR

la UI suele depender de:

- `buildFileTree({ skipCache: true })`

Sin ese refresh pueden quedar vistas stale.

## 14. Los reportes por tabla asumen que la tabla ya tiene metadata consistente

`/excel/[obraId]/tabla/[tablaId]/reporte` no arregla configuraciones malas.

Solo:

- lee metadata
- arma config dinamica
- renderiza reporte

Si la tabla esta mal tipada o mal mapeada, el reporte tambien.
