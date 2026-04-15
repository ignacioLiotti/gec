# Reporting: Defaults de tenant, overrides de obra y recomendaciones en General

## 1. Alcance

Este documento explica la arquitectura actual de reporting para obras, incluyendo:

- estructura anterior vs estructura actual
- como se resuelve la configuracion final de reglas
- como se conecta con recomendaciones en `General`
- ineficiencias actuales y opciones de simplificacion

Aplica a:

- `app/excel/[obraId]/report/report-client.tsx`
- `app/admin/obra-defaults/reporting/page.tsx`
- `components/report/rule-config-hub.tsx`
- `lib/reporting/index.ts`
- `app/excel/[obraId]/page.tsx`
- `app/excel/[obraId]/tabs/general-tab.tsx`

---

## 2. Estructura anterior (antes)

Antes del hub de defaults de tenant, el flujo practico era:

1. Cada obra se configuraba en `/excel/[obraId]/report`.
2. Si no habia config en `obra_rule_config`, se usaba `DEFAULT_RULE_CONFIG`.
3. No existia una capa tenant clara para heredar reglas base entre obras.
4. Los mapeos dependian mucho de detectar nombres/columnas por heuristica.

Consecuencia:

- alta repeticion al crear obras nuevas
- diferencias no intencionales entre obras del mismo tenant
- dificultad para saber si una obra estaba usando "algo default" o un override

---

## 3. Estructura actual (ahora)

Hoy hay dos pantallas conectadas:

1. `admin`:
   - ruta: `/admin/obra-defaults/reporting`
   - define la configuracion base del tenant
2. `obra`:
   - ruta: `/excel/[obraId]/report`
   - permite override puntual por obra

Ambas comparten el mismo componente:

- `RuleConfigHub` (`components/report/rule-config-hub.tsx`)

El orden de prioridad (source of truth) es:

1. `obra_override` (`obra_rule_config`)
2. `tenant_default` (`tenant_reporting_config`)
3. `system_default` (`DEFAULT_RULE_CONFIG`)

La UI de obra muestra esta fuente con badge:

- `Override de esta obra`
- `Usando default del tenant`
- `Usando default global`

---

## 4. Como funciona el backend

## 4.1. Endpoints principales

- Tenant defaults:
  - `GET /api/reporting/defaults`
  - `PUT /api/reporting/defaults`
  - `DELETE /api/reporting/defaults`

- Obra:
  - `GET /api/obras/:id/rules`
  - `POST /api/obras/:id/rules`
  - `DELETE /api/obras/:id/rules`
  - `GET /api/obras/:id/tables`
  - `GET /api/obras/:id/signals`
  - `POST /api/obras/:id/signals/recompute`
  - `GET /api/obras/:id/findings`
  - `POST /api/obras/:id/findings/evaluate`

## 4.2. Tablas de datos usadas

- Config:
  - `tenant_reporting_config`
  - `obra_rule_config`

- Metadata para mapear tablas:
  - `obra_tablas`
  - `obra_tabla_columns`
  - `obra_default_tablas`
  - `obra_default_tabla_columns`

- Resultado de ejecucion:
  - `obra_signals`
  - `obra_signal_runs`
  - `obra_signal_logs`
  - `obra_findings`

## 4.3. Resolucion de config efectiva

`lib/reporting/index.ts` hace:

1. Carga `tenant_reporting_config` y `obra_rule_config`.
2. Merge parcial: tenant base + overlay de obra (`mergePartialRuleConfig`).
3. Resuelve IDs de tablas a tablas reales de la obra (`resolveConfigTableReferencesForObra`):
   - match directo por `obra_tablas.id`
   - fallback por `settings.defaultTablaId`
   - fallback adicional por nombre de `obra_default_tablas`
4. Si falta config de curva, infiere desde metadata y filas (`loadObraRuleInference`).
5. Merge final con defaults del sistema (`mergeRuleConfig`).

Punto importante:

- Esto evita usar IDs de templates o carpetas como si fueran `tabla_id` reales de una obra.

---

## 5. Como se conecta con recomendaciones en General

Las recomendaciones de campos financieros en `General` no salen de `findings`.
Salen de logica directa en `app/excel/[obraId]/page.tsx`:

- detecta ultimo certificado extraido
- calcula valores derivados sugeridos para:
  - `certificadoALaFecha`
  - `saldoACertificar`
  - `porcentaje`
- si el valor parece manual o esta dirty, no pisa el dato automaticamente
- aun asi deja recomendacion visible (`recommendedValues`) y mensaje de warning

Luego `general-tab.tsx`:

- muestra `Valor recomendado` debajo de cada input
- expone boton `Aplicar recomendacion` por campo
- marca los campos derivados visualmente

Nota UX relevante:

- los botones `Guardar cambios` en modo edicion ahora usan suscripcion al estado del form para evitar estados disabled stale al primer ingreso.

---

## 6. Cambios de UI recientes (hub de reglas)

`RuleConfigHub` paso de un formulario plano a wizard de 4 pasos:

1. `Base`: seleccionar tablas fuente
2. `Captura`: mapear columnas especificas
3. `Packs`: activar reglas y ajustar umbrales
4. `Revision`: ver resumen + JSON final

Ademas agrega previews de impacto:

- que calcula cada mapping
- que hallazgos afecta cada columna/pack
- estado listo/incompleto por bloque

---

## 7. Ineficiencias actuales

1. `Bootstrap` fragmentado en frontend de obra:
   - hoy se cargan por separado `tables`, `rules`, `signals`, `findings`
   - mas viajes de red y estados intermedios inconsistentes

2. Recomendar vs senalizar esta partido:
   - recomendaciones de `General` viven en `page.tsx`
   - senales/hallazgos viven en `lib/reporting`
   - hay logica de dominio duplicada en dos caminos

3. Recompute manual:
   - `signals` y `findings` se recalculan por accion explicita
   - no hay trigger automatico consistente al guardar filas OCR/manuales

4. Resolucion por nombre como fallback:
   - cuando falla `defaultTablaId`, se intenta por nombre
   - renombres o nombres repetidos pueden degradar el match

5. Inferencias por heuristica:
   - deteccion de tablas de curva por nombre/columnas
   - util para bootstrap, pero fragil si cambia naming

6. Dirty-state mixto en `General`:
   - parte del UI ya usa suscripcion directa del form
   - pero aun hay visibilidad de banner atada a `hasUnsavedChanges()` en algunos bloques

---

## 8. Camino mas directo para conectar todo

Una version mas simple y robusta puede ser:

1. Un endpoint de bootstrap unico por obra, por ejemplo:
   - `GET /api/obras/:id/reporting/bootstrap`
   - devuelve: `tables + configResolution + signals + findings + recommendations`

2. Unificar motor de recomendaciones:
   - mover logica de recomendacion de `General` a `lib/reporting`
   - exponer una sola fuente para UI general y reporte

3. Guardar bindings estables:
   - al guardar config, persistir `obra_tabla_id` ya resuelto
   - mantener `defaultTablaId` solo como referencia historica

4. Recompute asincrono por eventos:
   - al guardar `obra_tabla_rows`, encolar recompute por obra/periodo
   - UI consume ultimo snapshot sin requerir boton manual para estar al dia

5. Estado de sincronizacion visible:
   - mostrar ultimo `computed_at`, estado y origen de config en un bloque unico

---

## 9. Checklist de mantenimiento

Si se agrega un nuevo pack o regla:

1. Extender `RuleConfig` en `lib/reporting/types.ts`.
2. Definir defaults en `lib/reporting/defaults.ts`.
3. Mapear en `RuleConfigHub`.
4. Incluir calculo en `recomputeSignals`.
5. Incluir evaluacion en `evaluateFindings`.
6. Documentar impacto en `data-flows-y-apis.md` y este archivo.
