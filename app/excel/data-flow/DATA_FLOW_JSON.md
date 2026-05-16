# Data-flow Builder JSON

Esta guia documenta el JSON editable/importable de data-flow para Excel/Obras. Su objetivo es que futuros agentes puedan generar flujos validos sin tener que inferir el contrato desde la UI.

El contrato canonico vive en `lib/data-flow-builder.ts`. La pantalla principal que importa/exporta este JSON esta en `app/excel/[obraId]/data-flow/page-client.tsx`.

## Forma General

Un flujo builder siempre tiene esta forma:

```json
{
  "version": 1,
  "calculations": [],
  "results": [],
  "generalTabLayout": []
}
```

La importacion acepta tanto el objeto directo como wrappers con `config` o `dataFlowBuilder`:

```json
{ "dataFlowBuilder": { "version": 1, "calculations": [], "results": [], "generalTabLayout": [] } }
```

Tambien acepta importaciones parciales:

```json
{ "calculations": [] }
```

```json
{ "results": [] }
```

```json
{
  "id": "calc_entidad_boquita",
  "label": "Entidad + Boquita",
  "mode": "text_template",
  "template": "{entidad} Boquita",
  "inputs": []
}
```

Regla de importacion:

- Un flujo completo reemplaza el borrador completo.
- Un JSON parcial se mezcla con el borrador actual usando `id`.
- Si se importa un calculo sin result asociado, la UI crea un result borrador apuntando a ese calculo.
- Un result creado automaticamente usa `format: "text"` si el calculo es `text_template`; para otros calculos usa formato numerico por defecto.

## Conceptos

`calculations` define nodos de calculo o de origen semantico.

`results` define salidas publicables del flujo. Un resultado apunta a un calculo final mediante `calculationId`.

`generalTabLayout` define como se muestran bloques/resultados en el tab General.

Un resultado no debe duplicar la formula. Debe apuntar a un calculo. Si dos resultados usan el mismo calculo, ambos deben referenciar el mismo `calculationId`.

Los ids canonicos de campos de obra en data-flow son snake_case porque representan columnas de base de datos. La UI puede mostrar camelCase, pero el JSON debe preferir snake_case:

- `designacion_y_ubicacion`
- `entidad_contratante`
- `mes_basico_de_contrato`
- `sup_de_obra_m2`
- `contrato_mas_ampliaciones`
- `certificado_a_la_fecha`
- `saldo_a_certificar`
- `segun_contrato`
- `prorrogas_acordadas`
- `plazo_total`
- `plazo_transc`
- `porcentaje`
- `n`

## Calculation: Aggregate

Usar `mode: "aggregate"` cuando el valor sale de una tabla o macro tabla.

```json
{
  "id": "calc_certificado_a_la_fecha",
  "label": "Certificado a la fecha",
  "mode": "aggregate",
  "description": "Ultimo monto acumulado valido de PMC Resumen.",
  "sourceType": "table",
  "sourceId": "preset_pmc_resumen",
  "fieldKey": "monto_acumulado",
  "aggregation": "latest",
  "sortFieldKey": "fecha_certificacion"
}
```

Campos:

- `id`: estable y unico. No usar ids generados al azar si el flujo sera mantenido.
- `label`: nombre visible para usuarios.
- `sourceType`: `"table"` o `"macro_table"`.
- `sourceId`: id de tabla/macro tabla disponible en `payload.sources`.
- `fieldKey`: columna a leer. Para `count_rows` puede ser `null`.
- `aggregation`: `"sum"`, `"avg"`, `"min"`, `"max"`, `"latest"`, `"count_rows"` o `"count_non_empty"`.
- `sortFieldKey`: opcional. Solo aplica a `latest`; indica la columna de negocio para ordenar.

Buenas practicas para `latest`:

- Preferir una columna de negocio como `fecha_certificacion`.
- Para certificados, usar `fecha_certificacion`; el evaluador tiene fallback a `periodo` y luego `created_at`.
- No usar `latest` sin `sortFieldKey` si el concepto depende del periodo o fecha real.

## Calculation: Formula

Usar `mode: "formula"` cuando el valor se calcula desde otros calculos, campos de obra o agregados.

```json
{
  "id": "calc_porcentaje_avance",
  "label": "Porcentaje de avance",
  "mode": "formula",
  "description": "Relacion porcentual entre certificado acumulado y contrato.",
  "expression": "certificado / contrato * 100",
  "inputs": [
    {
      "id": "input_progress_contract",
      "alias": "contrato",
      "sourceType": "calculation",
      "sourceId": "calc_contrato_mas_ampliaciones",
      "fieldKey": null,
      "aggregation": null
    },
    {
      "id": "input_progress_certified",
      "alias": "certificado",
      "sourceType": "calculation",
      "sourceId": "calc_certificado_a_la_fecha",
      "fieldKey": null,
      "aggregation": null
    }
  ]
}
```

Reglas importantes:

- `expression` solo puede referenciar `alias` declarados en `inputs`, numeros y operadores.
- Los aliases deben ser identificadores simples: `contrato`, `certificado`, `avance_2`.
- Evitar espacios, acentos y simbolos en aliases.
- Si se renombra un nodo, actualizar tambien los aliases de las formulas que lo usan.
- No usar labels de usuario como expression si tienen espacios. Usar alias.

Operadores soportados en formulas:

- `+`, `-`, `*`, `/`, `%`, parentesis y numeros.
- No usar llamadas a funciones ni JavaScript. El evaluador debe mantenerse determinista.

Tipos de input:

```json
{
  "sourceType": "calculation",
  "sourceId": "calc_otro_nodo",
  "fieldKey": null,
  "aggregation": null
}
```

```json
{
  "sourceType": "obra_field",
  "sourceId": "contrato_mas_ampliaciones",
  "fieldKey": null,
  "aggregation": null
}
```

```json
{
  "sourceType": "table",
  "sourceId": "preset_pmc_resumen",
  "fieldKey": "monto_acumulado",
  "aggregation": "latest",
  "sortFieldKey": "fecha_certificacion"
}
```

## Nodos Semanticos

La UI semantica muestra algunos calculos como tipos mas humanos:

- `Dato`: formula simple con un unico input `obra_field` y expression igual al alias.
- `Origen`: aggregate desde tabla/macro tabla.
- `Formula`: formula con operaciones o dependencias.
- `Texto`: plantilla de texto con placeholders como `{entidad}`.

Ejemplo de `Dato`:

```json
{
  "id": "calc_contrato_mas_ampliaciones",
  "label": "Contrato + ampliaciones",
  "mode": "formula",
  "description": "Valor tomado desde la obra.",
  "expression": "contrato",
  "inputs": [
    {
      "id": "input_contract",
      "alias": "contrato",
      "sourceType": "obra_field",
      "sourceId": "contrato_mas_ampliaciones",
      "fieldKey": null,
      "aggregation": null
    }
  ]
}
```

## Calculation: Text Template

Usar `mode: "text_template"` cuando el resultado es texto concatenado o redactado desde campos/calculos.

```json
{
  "id": "calc_entidad_boquita",
  "label": "Entidad + Boquita",
  "mode": "text_template",
  "description": "Nombre de entidad mas texto fijo.",
  "template": "{entidad} Boquita",
  "inputs": [
    {
      "id": "input_entidad",
      "alias": "entidad",
      "sourceType": "obra_field",
      "sourceId": "entidad_contratante",
      "fieldKey": null,
      "aggregation": null
    }
  ]
}
```

Reglas importantes:

- Los placeholders usan llaves y deben coincidir con aliases declarados: `{entidad}`.
- El texto literal va directo en `template`: `{entidad} Boquita`.
- Para publicar texto, usar un result con `format: "text"`.
- Si el destino es un campo de obra textual, usar `writebackMode: "suggest"` para que aparezca como recomendacion.
- Si un result apunta a un `text_template` pero quedo con `format: "number"`, el evaluador lo formatea como texto igualmente. Aun asi, los agentes deben generar `format: "text"` para claridad.
- Se permite `suggest` de texto sobre el mismo campo usado como input. Ejemplo: leer `entidad_contratante` y sugerir `entidad_contratante = "{entidad} Boquita"`. No usar `auto` para ese caso salvo decision explicita de producto.

## Results

Un result publica un calculo.

```json
{
  "id": "result_avance",
  "label": "Avance",
  "description": "Porcentaje de avance recomendado por data-flow.",
  "calculationId": "calc_porcentaje_avance",
  "targetObraFieldId": "porcentaje",
  "writebackMode": "suggest",
  "format": "percent",
  "decimals": 0,
  "generalTabSlot": "hero",
  "generalTabOrder": 1
}
```

Campos:

- `calculationId`: calculo final que alimenta el resultado.
- `targetObraFieldId`: campo de obra al que se podria escribir/sugerir. Puede ser `null`.
- `writebackMode`: `"none"`, `"suggest"` o `"auto"`.
- `format`: `"number"`, `"currency"`, `"percent"` o `"text"`.
- `decimals`: decimales para render.
- `generalTabSlot`: `"hero"` o `"financial"`.
- `generalTabOrder`: orden relativo.

Buenas practicas de writeback:

- Usar `"suggest"` para cambios recomendados al usuario.
- Usar `"none"` para valores solo informativos.
- Evitar `"auto"` salvo que el comportamiento este explicitamente aprobado.
- No pisar valores guardados durante migraciones: crear sugerencias.
- Si `writebackMode` es `"suggest"` o `"auto"`, `targetObraFieldId` debe existir para que haya writeback. Si no hay destino, la UI lo debe tratar como resultado informativo.
- Si el usuario elige "Sin campo destino", cambiar `writebackMode` a `"none"`.
- Las sugerencias se persisten al guardar configuracion, recomputar manualmente, o recomputar por cambios de fuente/configuracion. No se crean por render del tab General.
- Recomputes repetidos no deben duplicar una sugerencia pendiente identica para el mismo `result_id`, `field_id` y `suggested_value`.
- Una sugerencia rechazada no bloquea futuras sugerencias si el valor calculado cambia; una sugerencia identica pendiente no se duplica.

## Sugerencias en General

Para que una recomendacion aparezca en General se necesitan todas estas condiciones:

1. El result debe estar `status: "ok"`.
2. `writebackMode` debe ser `"suggest"`.
3. `targetObraFieldId` debe apuntar a un campo permitido.
4. El valor calculado debe diferir del valor actual.
5. El recompute debe haber persistido una fila pending en `obra_data_flow_suggestions`.
6. El componente del campo en General debe llamar a `renderDataFlowSuggestion`.

General ya debe mostrar sugerencias para:

- Informacion General: `designacionYUbicacion`, `entidadContratante`, `mesBasicoDeContrato`, `iniciacion`, `n`, `supDeObraM2`.
- Datos Financieros: contrato, certificado, saldo, plazos y prorrogas.
- Campos configurados/custom.

Alias UI -> data-flow:

- `designacionYUbicacion` busca sugerencias para `designacion_y_ubicacion`.
- `entidadContratante` busca sugerencias para `entidad_contratante`.
- `mesBasicoDeContrato` busca sugerencias para `mes_basico_de_contrato`.
- `supDeObraM2` busca sugerencias para `sup_de_obra_m2`.
- `contratoMasAmpliaciones` busca sugerencias para `contrato_mas_ampliaciones`.
- `certificadoALaFecha` busca sugerencias para `certificado_a_la_fecha`.
- `saldoACertificar` busca sugerencias para `saldo_a_certificar`.

Si el editor muestra `Preview: -`, el calculo no esta evaluando bien o el formato del resultado no coincide con el tipo calculado. Si el preview muestra el valor correcto pero General no muestra recomendacion, revisar writeback plan, tabla `obra_data_flow_suggestions`, estado `pending`, alias del campo y render del componente General.

## General Tab Layout

`generalTabLayout` controla bloques visibles en General.

```json
{
  "id": "layout_avance",
  "type": "custom_result",
  "label": "Avance",
  "enabled": true,
  "order": 1,
  "width": "one_third",
  "gridX": 0,
  "gridY": 0,
  "gridH": 4,
  "resultId": "result_avance",
  "fieldIds": []
}
```

Tipos soportados:

- `progress`
- `curve`
- `general_info`
- `financial`
- `configured_fields`
- `certificates`
- `custom_result`

Widths soportados:

- `one_third`
- `half`
- `two_thirds`
- `full`

Notas:

- `resultId` se usa principalmente en `custom_result` y algunos bloques default.
- `fieldIds` puede contener ids de campos de obra o ids de resultados, segun el bloque.
- Para mostrar un resultado nuevo en General, crear un `result` y un bloque `custom_result` que apunte a ese `resultId`.

## Herencia, Overrides y Borrado

El sistema puede mezclar configuracion de tenant con configuracion de obra. El merge se hace por `id`.

Reglas:

- Si una obra define un calculo con el mismo `id` que tenant/default, lo reemplaza.
- Si una obra define un result con el mismo `id`, lo reemplaza.
- Para ocultar un calculo o result heredado, agregar el mismo `id` con `deleted: true`.

Ejemplo:

```json
{
  "id": "result_certificado",
  "label": "Certificado",
  "description": "",
  "deleted": true,
  "calculationId": null,
  "targetObraFieldId": null,
  "writebackMode": "none",
  "format": "number",
  "decimals": 0,
  "generalTabSlot": "financial",
  "generalTabOrder": 1
}
```

No borrar un default heredado eliminandolo del JSON local: si viene del tenant/default, reaparecera. Usar tombstone con `deleted: true`.

## Ejemplo Completo

```json
{
  "version": 1,
  "calculations": [
    {
      "id": "calc_contrato_mas_ampliaciones",
      "label": "Contrato + ampliaciones",
      "mode": "formula",
      "description": "Valor tomado desde la obra.",
      "expression": "contrato",
      "inputs": [
        {
          "id": "input_contract",
          "alias": "contrato",
          "sourceType": "obra_field",
          "sourceId": "contrato_mas_ampliaciones",
          "fieldKey": null,
          "aggregation": null
        }
      ]
    },
    {
      "id": "calc_certificado_a_la_fecha",
      "label": "Certificado a la fecha",
      "mode": "aggregate",
      "description": "Ultimo monto acumulado valido de PMC Resumen.",
      "sourceType": "table",
      "sourceId": "preset_pmc_resumen",
      "fieldKey": "monto_acumulado",
      "aggregation": "latest",
      "sortFieldKey": "fecha_certificacion"
    },
    {
      "id": "calc_porcentaje_avance",
      "label": "Porcentaje de avance",
      "mode": "formula",
      "description": "Certificado dividido contrato por cien.",
      "expression": "certificado / contrato * 100",
      "inputs": [
        {
          "id": "input_progress_contract",
          "alias": "contrato",
          "sourceType": "calculation",
          "sourceId": "calc_contrato_mas_ampliaciones",
          "fieldKey": null,
          "aggregation": null
        },
        {
          "id": "input_progress_certified",
          "alias": "certificado",
          "sourceType": "calculation",
          "sourceId": "calc_certificado_a_la_fecha",
          "fieldKey": null,
          "aggregation": null
        }
      ]
    }
  ],
  "results": [
    {
      "id": "result_avance",
      "label": "Avance",
      "description": "Porcentaje de avance recomendado por data-flow.",
      "calculationId": "calc_porcentaje_avance",
      "targetObraFieldId": "porcentaje",
      "writebackMode": "suggest",
      "format": "percent",
      "decimals": 0,
      "generalTabSlot": "hero",
      "generalTabOrder": 1
    }
  ],
  "generalTabLayout": [
    {
      "id": "layout_result_avance",
      "type": "custom_result",
      "label": "Avance",
      "enabled": true,
      "order": 1,
      "width": "one_third",
      "gridX": 0,
      "gridY": 0,
      "gridH": 4,
      "resultId": "result_avance",
      "fieldIds": []
    }
  ]
}
```

## Checklist Para Agentes

Antes de generar o modificar un flujo:

1. Leer `payload.sources` o el JSON exportado efectivo para conocer `sourceId`, `fieldKey` y campos de obra reales.
2. Elegir ids estables y descriptivos: `calc_*`, `result_*`, `layout_*`, `input_*`.
3. Crear primero los calculos fuente, luego formulas dependientes, luego results, luego layout.
4. En formulas, verificar que cada token de `expression` exista como `alias` en `inputs`.
5. Evitar ciclos: un calculo no puede depender de si mismo directa o indirectamente.
6. Usar `latest` con `sortFieldKey` cuando importa el ultimo periodo/fecha.
7. Usar `writebackMode: "suggest"` para recomendaciones.
8. Mantener `targetObraFieldId` en `null` si el resultado no debe sugerir/escribir.
9. No duplicar results para el mismo objetivo salvo que haya una razon de producto clara.
10. Si se modifica un nodo heredado/default, conservar el mismo `id` para override.
11. Si se elimina un heredado/default, usar `deleted: true`.
12. Importar primero como borrador desde la UI semantica y revisar en "Todo el flujo".
13. Para resultados de texto, usar `mode: "text_template"` y result `format: "text"`.
14. Para campos base, preferir ids snake_case aunque la UI muestre camelCase.
15. Verificar que el preview del result muestre el valor esperado antes de buscar la sugerencia en General.
16. Si un result debe sugerir, revisar que `targetObraFieldId` no sea `null` y que el modo no haya quedado en `"none"`.
17. Si se importa solo un calculo, crear o revisar el result asociado antes de esperar una recomendacion.

## Errores Comunes

- Usar el label visible dentro de `expression`: incorrecto si tiene espacios. Usar alias.
- Cambiar un `label` sin actualizar aliases dependientes.
- Usar `sourceId` inventado. Debe existir en sources o en calculations.
- Crear un result sin `calculationId`: queda incompleto.
- Crear un layout `custom_result` apuntando a un `resultId` inexistente.
- Usar `auto` writeback sin autorizacion explicita.
- Usar `latest` sin orden de negocio en tablas historicas.
- Usar `entidadContratante` como `sourceId` en data-flow. Usar `entidad_contratante`.
- Ver preview correcto en data-flow y asumir que General lo va a mostrar sin guardar/recomputar.
- Crear un result `suggest` con `targetObraFieldId: null`; no puede generar recomendacion.
- Apuntar un result de texto a un calculo numerico o dejar `format` numerico. El evaluador intenta corregirlo si el valor real es texto, pero el JSON debe ser explicito.

## Robustez Que Todavia Falta

Para que nuevas variantes de reglas/resultados no repitan estos bugs, faltan estos cierres:

1. Schema compartido y unico para builder JSON.
   Hoy hay tipos/validacion en frontend y normalizacion/evaluacion en `lib/data-flow-builder.ts`. Deben unificarse con un parser unico, idealmente Zod o equivalente, usado por import UI, API y tests.

2. Registro canonico de campos de obra.
   Debe existir un mapa unico `uiFieldId <-> dataFlowFieldId <-> dbColumn` para no depender de aliases dispersos. Ejemplo: `entidadContratante`, `entidad_contratante`, `entidad_contratante`.

3. Catalogo tipado de calculos y resultados.
   Cada `calculation.mode` debe declarar el tipo de salida (`number`, `text`, `date`, `boolean`) y el result debe inferir/validar `format` desde ese tipo.

4. Builder semantico guiado por tipo.
   La UI deberia impedir combinaciones invalidas: result texto con formato numerico, suggest sin destino, formula numerica con input textual, auto-writeback sobre self-dependency, etc.

5. Preview y writeback desde la misma fuente.
   El valor que aparece en `Preview` y el valor que se persiste como sugerencia deben salir del mismo objeto evaluado, con tests de contrato para evitar divergencias.

6. Tests de matriz.
   Crear tests parametrizados para:
   - numero -> number/currency/percent;
   - texto -> text;
   - result informativo;
   - suggest con destino;
   - suggest sin destino;
   - auto;
   - self-dependency;
   - custom fields;
   - campos base snake/camel;
   - import completo/parcial.

7. Smoke test UI de General.
   Agregar test que cree una sugerencia para `entidad_contratante` y verifique que aparece en Informacion General, no solo en Datos Financieros.

8. Diagnostico visible.
   Cuando un preview existe pero no hay sugerencia, la UI deberia mostrar el motivo: sin guardar, sin recompute, target invalido, valor igual al actual, sugerencia ya rechazada/pending, o componente General sin render de sugerencias.

9. Recompute explicito y observable.
   Despues de guardar config, la UI deberia mostrar cuantas sugerencias ready/bloqueadas se crearon y para que campos, con link o detalle.

10. Compatibilidad de import.
   Mantener import parcial, pero mostrar si se hizo merge o reemplazo completo. Si se autocrea un result para un calculo importado, mostrarlo explicitamente en el estado de importacion.

## Validacion Recomendada

Para cambios de builder/evaluacion:

```bash
pnpm test -- tests/lib/data-flow-builder.test.ts tests/lib/data-flow-writeback.test.ts
```

Para cambios de UI:

```bash
pnpm lint
```

Si el cambio toca solo documentacion, no hace falta ejecutar tests, pero dejar asentado que no se tocaron contratos de runtime.
