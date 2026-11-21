# ADR 0011: Pólizas de seguro asociadas a obras

## Estado

Aceptado.

## Contexto

Las pólizas deben importarse desde Excel, revisarse antes de confirmar, mostrarse dentro del detalle de obra y consolidarse en una macrotabla sincronizada. Además, la fecha de baja depende del momento en que una obra se marca como terminada.

## Decisión

Crear `insurance_policies` como tabla tenant-scoped asociada a `obras`, con regla de vencimiento persistida por póliza y fecha calculada materializada. La macrotabla se expone como proyección API sobre la tabla real más el estado actual de `obras`.

La finalización de obra recalcula las fechas de baja de sus pólizas en los flujos existentes que detectan transición a 100%. La notificación automática se centraliza en un endpoint de despacho que agrupa pólizas vencidas por tenant y usa `insurance_policy_settings.responsible_user_id`.

Los tres flujos servidor que finalizan una obra exigen `obras:edit` antes de mutarla. Después de comprobar el estado persistido de una obra activa, ejecutan solamente la actualización derivada de sus pólizas con un cliente de servicio. Esa escritura queda limitada por `tenant_id`, `obra_id` e `id` de póliza, actualiza únicamente `obra_finished_at`, `calculated_cancellation_date`, `last_notified_at` y `updated_at`, y comprueba la fila afectada. La sincronización de la macrotabla conserva el cliente del actor. Así, una política RLS puede reservar las mutaciones financieras ordinarias a `insurance-policies:manage` sin impedir que un editor complete una obra.

La migración 0134 conserva la lectura por pertenencia al tenant y exige `insurance-policies:manage` para insertar, actualizar o eliminar pólizas. Sus controles de inserción y actualización también conservan la regla de la migración 0112: una `obra_id` opcional debe corresponder a una obra activa del mismo tenant. La migración separa este permiso financiero de la actualización derivada y acotada que ejecuta la finalización de obra.

## Consecuencias

- El estado de baja vive en la póliza y se comparte entre detalle de obra y macrotabla.
- La macrotabla no introduce un segundo origen de verdad.
- El cálculo depende de que la finalización de obra pase por las APIs existentes.
- Repetir **Terminar obra** conserva la primera fecha provisoria registrada. Revertir la obra limpia esa base; una nueva transición a 100% toma una fecha nueva.
- Si una repetición conserva ambas fechas derivadas, no reinicia `last_notified_at`. Una fecha derivada distinta o una reversión sí reinicia el marcador.
- El cliente de servicio no se expone al código compartido ni a la sincronización completa de la macrotabla; sólo recibe la proyección derivada y tenant-scoped descrita arriba.
- Un miembro del tenant sin `insurance-policies:manage` no puede mutar pólizas directamente. La verificación enfocada y la regresión completa cubren inserción, actualización y eliminación denegadas, controles positivos del propietario y finalización por un editor bajo las nuevas políticas.
- Un tenant sin responsable configurado acumula pólizas vencidas sin notificar hasta completar la configuración.
