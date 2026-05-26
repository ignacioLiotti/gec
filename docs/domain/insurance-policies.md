# Pólizas de seguro

Una **Póliza de seguro** pertenece a un tenant y a una **Obra**. La póliza conserva su número, una fecha de finalización informativa y el estado operativo de baja.

## Regla de vencimiento

Cada póliza define cuándo corresponde darla de baja respecto de la finalización real de la obra:

- `on_finish`: al finalizar obra.
- `days_after`: N días después.
- `months_after`: N meses después.

Cuando una obra pasa a 100% de avance, el sistema toma esa fecha como `obra_finished_at` de las pólizas asociadas y recalcula `calculated_cancellation_date`. Si la póliza ya estaba dada de baja, no se notifica.

## Importación

El importador de Excel hace una vista previa antes de persistir. Cada fila debe poder resolverse a una obra del tenant por número o por designación, y debe tener número de póliza. Las filas con errores quedan visibles y bloquean la confirmación.

## Macrotabla

La macrotabla de pólizas es una proyección sincronizada desde `insurance_policies` + `obras`, no una copia editable separada. Por eso refleja el estado actual de obra, fecha de finalización de obra, fecha calculada de baja y baja de póliza.

## Notificación

El tenant puede configurar un usuario responsable. El despachador automático agrupa pólizas vencidas, no dadas de baja y no notificadas, y envía una notificación con el listado de pólizas.

