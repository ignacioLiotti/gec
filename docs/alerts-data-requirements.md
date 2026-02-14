# Datos necesarios para alertas

## 1. Alerta mensual por falta de certificado
Tabla sugerida: `certificados`

- `obra_id`
- `periodo` (YYYY-MM o fecha normalizada por mes)
- `monto_certificado`
- `fecha_emision` (opcional)
- `fecha_aprobacion` (opcional)

Regla:
- Si existen certificados en meses anteriores y no existe registro para el mes actual, disparar alerta.

## 2. Alerta por certificado facturado y no cobrado > X días
Tabla sugerida: `certificados` (con campos de facturación/cobro) o tabla separada `certificados_facturacion_cobro`

- `obra_id`
- `certificado_id`
- `fecha_facturacion` (o `facturado` boolean)
- `fecha_cobro` (o `cobrado` boolean)
- `dias_desde_facturacion` (derivado)

Regla:
- Si está facturado y no cobrado, y `dias_desde_facturacion > X`, disparar alerta.

## 3. Alerta por expediente detenido en etapa específica
Tabla sugerida: `expedientes` + historial `expediente_movimientos`

- `obra_id`
- `expediente_id`
- `ubicacion_actual`
- `fecha_entrada_ubicacion` (clave)
- historial de cambios de ubicación (recomendado)

Regla:
- Si `ubicacion_actual` contiene "Tesorería" y permanece más de `X` semanas, disparar alerta.

## 4. Alerta por inactividad documental
Fuente: mediciones + certificados (o tabla consolidada de actividad)

- `obra_id`
- `last_medicion_at`
- `last_certificado_at`

Regla:
- Calcular `max(last_medicion_at, last_certificado_at)`.
- Si no hay actividad en `X` meses, disparar alerta.

## 5. Alerta por desvío de curva de avance
Tabla sugerida: `curva_avance`

- `obra_id`
- `periodo`
- `avance_planificado_pct`
- `avance_real_pct`
- `desvio_pct` (derivado: `avance_real_pct - avance_planificado_pct`)

Regla:
- Si `abs(desvio_pct) > threshold_configurable`, disparar alerta.

## 6. Configuración de reglas (thresholds)
Tabla sugerida: `alert_rules` (por tenant y opcionalmente por obra)

- `tenant_id`
- `obra_id` (nullable si aplica global)
- `dias_cobro_threshold`
- `semanas_tesoreria_threshold`
- `meses_inactividad_threshold`
- `desvio_curva_threshold_pct`
- `enabled` por tipo de alerta

## 7. Salida de alertas generadas
Tabla sugerida: `alerts`

- `id`
- `tenant_id`
- `obra_id`
- `tipo_alerta`
- `severidad`
- `mensaje`
- `payload_json` (contexto para UI)
- `detected_at`
- `resolved_at` (nullable)
- `status` (`open`, `resolved`, `dismissed`)

---

## Resumen mínimo para arrancar
Si querés empezar rápido, lo mínimo es:

1. `certificados` con `obra_id`, `periodo`, `fecha_facturacion`, `fecha_cobro`
2. `expedientes` con `obra_id`, `ubicacion_actual`, `fecha_entrada_ubicacion`
3. `curva_avance` con planificado/real por período
4. `alert_rules` con thresholds
5. `alerts` como tabla de salida
