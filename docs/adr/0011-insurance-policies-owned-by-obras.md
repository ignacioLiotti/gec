# ADR 0011: Pólizas de seguro asociadas a obras

## Estado

Aceptado.

## Contexto

Las pólizas deben importarse desde Excel, revisarse antes de confirmar, mostrarse dentro del detalle de obra y consolidarse en una macrotabla sincronizada. Además, la fecha de baja depende del momento en que una obra se marca como terminada.

## Decisión

Crear `insurance_policies` como tabla tenant-scoped asociada a `obras`, con regla de vencimiento persistida por póliza y fecha calculada materializada. La macrotabla se expone como proyección API sobre la tabla real más el estado actual de `obras`.

La finalización de obra recalcula las fechas de baja de sus pólizas en los flujos existentes que detectan transición a 100%. La notificación automática se centraliza en un endpoint de despacho que agrupa pólizas vencidas por tenant y usa `insurance_policy_settings.responsible_user_id`.

## Consecuencias

- El estado de baja vive en la póliza y se comparte entre detalle de obra y macrotabla.
- La macrotabla no introduce un segundo origen de verdad.
- El cálculo depende de que la finalización de obra pase por las APIs existentes.
- Un tenant sin responsable configurado acumula pólizas vencidas sin notificar hasta completar la configuración.

