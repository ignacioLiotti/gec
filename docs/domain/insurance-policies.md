# Polizas de seguro

Una **Poliza de seguro** pertenece a un tenant. Cuando el importador puede resolverla, queda asociada a una **Obra**; si no encuentra una obra adecuada, queda como poliza importada sin obra hasta que se la revise o asigne. La poliza conserva su numero, datos importados del productor, una fecha de finalizacion informativa y el estado operativo de baja.

## Tres conceptos separados

La UI no debe mezclar cobertura, baja y saldo:

- **Cobertura**: periodo en el que la poliza aplica. Puede estar vencida aunque todavia figure con saldo.
- **Baja**: instruccion operativa para que la poliza deje de aplicar o facturarse hacia adelante. Dar de baja no significa pagar la poliza ni cancelar automaticamente saldos viejos.
- **Saldo observado**: dato importado desde cuenta corriente o Excel del productor. Un saldo positivo no prueba por si solo gasto indebido; puede ser deuda vieja, una anulacion pendiente de trimestre, una imputacion del productor o un caso para pedir cuenta corriente.

Por eso, las pantallas deben hablar de **validacion operativa** y **riesgo de facturacion**, no de ahorro confirmado.

## Criterio confirmado por polizas

La ultima validacion operativa confirma:

- **Solo mantenimiento de oferta** se paga por unica vez.
- **Todas las demas polizas** requieren pedido formal de baja por nota y documentacion respaldatoria.
- Que una obra haya terminado o que una poliza haya vencido no alcanza para cortar la facturacion si no se pidio la baja.
- Las polizas vencidas o indeterminadas pueden seguir generando deuda si siguen activas y no tienen baja solicitada.
- Las polizas de fondo de reparo, sustitucion de fondo de reparo, mantenimiento o garantia post-obra pueden mantenerse despues de terminada la obra por el plazo contractual.
- El documento operativo clave para pedir la baja de obra es la **recepcion definitiva**.

La regla practica actual es: **tipo de caucion + fecha base de baja + plazo post-obra + baja formal solicitada**. La fecha base ideal es la recepcion definitiva. Cuando todavia no esta cargada, el sistema usa como aproximacion la fecha en que el usuario marco la obra como terminada.

## Lecturas operativas

Las polizas se interpretan como buckets de trabajo:

- **Activa en cobertura**: no esta dada de baja y su fecha de fin importada todavia no vencio. No implica que este pagada.
- **Ojo: por vencer**: no esta dada de baja, vence dentro de la ventana preventiva y no parece mantenimiento de oferta. Si no corresponde mantenerla, hay que pedir baja formal antes de que pueda seguir facturando.
- **Activa vencida**: no esta dada de baja y su fecha de fin importada ya vencio. Requiere revisar si corresponde nota formal de baja.
- **Riesgo recurrente**: esta vencida, sigue activa y no parece mantenimiento/oferta de una sola vez. Es el mejor proxy actual para alertar que puede seguir facturando si no se pide baja formal.
- **Baja solicitada**: ya se envio o registro el pedido formal de baja, pero todavia falta confirmacion/cierre del productor.
- **Baja confirmada**: el productor/aseguradora confirmo la baja. Todavia puede quedar saldo viejo para validar, pero ya no es riesgo sin gestionar.
- **Vencida no recurrente**: esta vencida y activa, pero parece mantenimiento/oferta. Se valida, pero no debe mezclarse con riesgo recurrente.
- **Baja con saldo**: esta dada de baja pero conserva saldo observado. Puede ser normal si todavia no entro en el trimestre de anulacion o si el saldo corresponde a deuda vieja.
- **Credito / compensacion**: prima, premio o saldo negativo. Debe mostrarse como posible credito compensable, no como gasto.
- **Sin fecha de fin**: no se puede calcular vencimiento. Requiere completar fecha o validar vigencia con el productor.

## Ahorro y riesgo de facturacion

El sistema puede calcular **riesgo de gasto evitable** con los datos actuales, pero no **ahorro real confirmado**.

Para alertar preventivamente usa:

- fecha de fin (`end_date`) dentro de la ventana preventiva;
- `is_cancelled = false`;
- poliza no identificada como mantenimiento de oferta;
- monto observado positivo cuando existe.

Para marcar riesgo recurrente usa:

- `end_date < hoy`;
- `is_cancelled = false`;
- sin `cancellation_requested_at`;
- no identificada como mantenimiento/oferta de una sola vez.

Si ademas tiene prima, premio o saldo positivo, la UI puede mostrar el monto observado como referencia para priorizar. Ese monto no es ahorro confirmado.

Para calcular ahorro real confirmado hace falta cuenta corriente o facturacion por poliza/endoso. El calculo seria: cargos emitidos despues de la fecha en que debia estar dada de baja menos notas de credito o compensaciones asociadas.

Con el criterio confirmado, el mejor calculo de fecha esperada de baja es:

```text
fecha esperada de baja = (recepcion definitiva ?? finalizacion provisoria de obra) + plazo post-obra
```

Ejemplos:

- Mantenimiento de oferta: no aplica como riesgo recurrente; pago unico.
- Ejecucion de obra: recepcion definitiva, salvo condicion tecnica/contractual distinta.
- Anticipo financiero: amortizacion total del anticipo o recepcion definitiva, segun contrato.
- Fondo de reparo / garantia post-obra: recepcion definitiva + plazo contractual.

El riesgo financiero fuerte aparece cuando una poliza que no es mantenimiento de oferta ya tenia fecha esperada de baja, no tiene baja solicitada, y sigue activa/facturando.

## Gestion de baja

La gestion operativa minima queda registrada en:

- `cancellation_requested_at`: fecha en que se pidio la baja formal.
- `cancellation_confirmed_at`: fecha en que el productor/aseguradora confirmo la baja.
- `cancellation_notes`: nota breve de seguimiento, documentacion o proximo paso.

Una poliza con `cancellation_requested_at` ya no debe contarse como riesgo recurrente sin gestionar; pasa a seguimiento de confirmacion. Una poliza con `cancellation_confirmed_at` debe revisarse solo por saldos viejos, notas de credito o compensaciones.

## Regla de vencimiento

Cada poliza puede definir cuando corresponde darla de baja respecto de una fecha base:

- `definitive_reception_date`: recepcion definitiva cargada por el usuario. Es la base preferida.
- `obra_finished_at`: fecha provisoria tomada cuando el usuario marco la obra como terminada. Se usa si no hay recepcion definitiva.

Sobre esa fecha base se aplica la regla:

- `on_finish`: al finalizar obra.
- `days_after`: N dias despues.
- `months_after`: N meses despues.

Cuando una obra pasa a 100% de avance, o cuando el usuario confirma **Terminar obra**, el sistema toma esa fecha como `obra_finished_at` de las polizas asociadas y recalcula `calculated_cancellation_date`. Si luego el usuario carga `definitive_reception_date`, la fecha calculada de baja se recalcula usando la recepcion definitiva como base.

Este comportamiento es una aproximacion operativa hasta que exista la recepcion definitiva. La UI debe indicar si el calculo usa base provisoria o base definitiva.

Si una poliza tiene una regla configurada (`on_finish`, `days_after` o `months_after`) pero la obra todavia no termino y no hay recepcion definitiva, la fecha calculada queda en espera. El sistema no inventa una fecha base: espera a que exista `obra_finished_at` o `definitive_reception_date`.

## Importacion

El importador de Excel hace una vista previa antes de persistir. Cada fila debe tener numero de poliza. Si puede resolverse a una obra del tenant por numero o por designacion, se importa como `matched` y se sincroniza con la tabla de la obra. Si no puede resolverse, se importa como `unmatched`, con la obra visible como **No se encontro obra adecuada** en las tablas generales.

Las filas sin numero de poliza siguen siendo errores bloqueantes. Las filas `unmatched` no bloquean la confirmacion y no aparecen en el detalle de una obra hasta ser asignadas.

El importador soporta dos familias de Excel:

- **Maestro/listado de polizas**: trae poliza, vigencia, obra u objeto asegurable, suma asegurada, prima/premio y estado operativo. Este formato actualiza la poliza canonica. Tambien se acepta el listado del productor agrupado por `Tomador`, con encabezado `Tomador / Seccion / Poliza / Vigencia / Sum.Aseg. / Mon / Prima / Premio / Saldo / Saldo $ / Estado / Riesgo / Objeto del Seguro`; las filas `Total Tomador` se ignoran, el tomador se conserva en observaciones y la fecha del titulo "al dd-mm-aaaa" se usa como fecha de corte de origen.
- **Exigible de deudores / cuenta corriente**: trae `PolizaNro`, `EndosoNro`, `CuotaNro`, vencimientos, `Premio`, `Vencido`, `AVencer` y `SaldoPremio`. Este formato se interpreta como cuenta corriente del productor. La identidad de poliza se compone como `PolizaNro / EndosoNro` para coincidir con el Excel maestro; por ejemplo `1006726` + endoso `0` es la misma poliza que `1006726 / 0`. Si el productor lo informa como vigente, las polizas se presumen activas hasta validacion, pero la importacion no debe borrar datos operativos previos como obra, responsables o reglas de baja.

En el formato exigible, los saldos negativos son **notas de credito**. Deben persistirse como movimientos financieros `credit_note`, no como deuda negativa ni como ahorro confirmado. La poliza conserva un saldo neto observado para priorizacion, pero el detalle auditable queda en movimientos financieros por poliza/endoso/cuota.

## Reasignacion entre obras

Una poliza ya asociada puede moverse a otra obra del mismo tenant cuando la importacion o carga manual quedo vinculada a una obra incorrecta. La reasignacion actualiza el `obra_id`, mantiene la poliza como origen de verdad y vuelve a sincronizar la macrotabla de polizas para la obra anterior y la nueva.

## Macrotabla

La macrotabla de polizas es una proyeccion sincronizada desde `insurance_policies` + `obras`, no una copia editable separada. Por eso refleja el estado actual de obra, fecha de finalizacion de obra, fecha calculada de baja y baja de poliza.

## Notificacion

El tenant puede configurar un usuario responsable. El despachador automatico agrupa polizas vencidas, no dadas de baja y no notificadas, y envia una notificacion con el listado de polizas.
