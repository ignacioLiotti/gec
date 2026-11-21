# Demo de la sesión del editor y explicación de los tests

## Qué se implementó

Se introdujo una máquina de estados de producto en [editor-session.ts](../../app/document-generation/editor-session.ts). Es un controlador local del editor documental, con contenido, revisiones, identidad del borrador, operación y una cola de requests. La página se suscribe a sus snapshots. La decisión está en [ADR 0037](../../docs/adr/0037-document-generation-editor-session.md).

No se incorporó XState. El candidato que incluía catálogos, bootstrap y toda la pantalla se descartó. Aprobación, rechazo, permisos y descarga siguen siendo contratos del servidor y no son estados nuevos de esta sesión.

| Operación | Variante | Qué significa |
| --- | --- | --- |
| `idle` | | Puede aceptar un comando. Puede haber cambios sin guardar. |
| `saving` | `auto` | Se está guardando una revisión por autosave. |
| `saving` | `manual` | Se está guardando por una acción explícita. |
| `assisting` | | Se está esperando la asistencia documental. |
| `generating` | `persisting` | Se guarda primero la revisión elegida de un borrador existente. |
| `generating` | `rendering` | Está pendiente el request que genera el documento. |
| `failed` | `autosave`, `save`, `assist`, `generate` | Falló una operación vigente. El contenido permanece disponible. |

Los cambios pendientes se calculan comparando la revisión actual con la reconocida. No existe un flag `dirty` que haya que sincronizar a mano. `success`, `failure`, `stale` e `ignored` son resultados de comandos, no nuevos estados del editor.

La cola ordena una sesión montada. No resuelve conflictos entre pestañas ni convierte un request enviado en una transacción reversible después de navegar.

## Qué ejecuta la demo

[build-demo.mjs](build-demo.mjs) compila el controlador TypeScript actual y lo inserta en la demo. No replica sus reglas con un segundo reducer. El hash del código usado queda dentro del fragmento. El reloj y las respuestas del transporte son simulados; no se llama a la API, no se accede a una base y no se renderiza un PDF real. La fila de archivo muestra el contenido que consumiría el transporte simulado.

La demo tiene once recorridos, siete variantes visibles de operación y los cuatro comandos que pueden fallar. Se avanza con Siguiente paso. Anterior reconstruye el recorrido usando el mismo controlador. Las revisiones, el contenido, los requests y los resultados se leen de la ejecución.

[check-demo.mjs](check-demo.mjs) recorre los once casos en Chromium y comprueba resultados concretos, no sólo que se ilumine un estado. Verifica que el texto nuevo sobreviva, que generación use la revisión elegida y que el autosave espere. También comprueba recuperación de errores, cambio de contexto/plantilla, navegación hacia atrás, los siete estados, los cuatro fallos y ausencia de desbordamiento a 320 y 736 px. Resultado: once recorridos aprobados y ningún error de página o consola. Se inspeccionaron ambas capturas. Evidencia en [demo-verification.json](demo-verification.json).

Los quince tests del controlador se volvieron a ejecutar el 18 de octubre y pasaron. Esta nueva comprobación no repitió la suite E2E ni los nueve escenarios del componente. Sus resultados anteriores se enlazan abajo.

## Los quince tests nuevos del controlador, en lenguaje de uso

Todos están en [editor-session.test.ts](../../tests/app/document-generation/editor-session.test.ts). Ejecutan el controlador real con promesas de transporte que el test puede detener y completar en el orden que necesita.

1. Empiezas a guardar «uno» y escribes «dos» mientras esperas. Cuando responde el servidor, el editor conserva «dos». Sólo «uno» cuenta como guardado y «dos» sigue pendiente.
2. Escribes varias letras sin salir del campo. Cada cambio llega a la sesión antes del blur y pertenece a una revisión que las respuestas anteriores no pueden pisar. El test de controlador no prueba por sí solo el DOM; los recorridos de navegador comprueban foco y escritura.
3. Abres una URL con datos incompletos y termina la carga inicial. El siguiente guardado usa la carpeta, tipo y plantilla canónicos que se resolvieron, no los valores anteriores.
4. Guardas por primera vez con plantilla A y cambias a B antes de recibir respuesta. Se conserva el ID válido del borrador recién creado, pero no vuelve el contenido viejo de A.
5. Sales de A, entras a B y vuelves a A. Una respuesta de la primera visita no se adopta como si perteneciera a la nueva sesión en esas mismas coordenadas.
6. Un comando está esperando su turno y cambias de contexto antes de que empiece. Se descarta antes de enviar el request. No alcanza con ignorar la respuesta después de haber escrito.
7. Pulsas Generar con un borrador y sigues escribiendo. Primero se guarda la revisión elegida y después se genera. El autosave no puede escribir entre ambos pasos. Las ediciones posteriores permanecen en el editor.
8. Un primer guardado devuelve su ID después de cambiar a plantilla B, donde ya pediste generar. Se usa ese ID para guardar B y luego generar B, sin crear otro borrador ni recuperar el texto viejo.
9. Pides asistencia y escribes tu propia corrección mientras esperas. La respuesta vieja no la reemplaza. La operación termina y el autosave puede guardar la corrección reciente.
10. Falla un autosave. El contenido sigue pendiente, pero no se reintenta infinitamente. Otra edición permite volver a guardar. Dos pulsaciones durante un guardado no producen dos escrituras.
11. Cambias de contexto mientras asistencia o generación están pendientes. Si fallan después, sus errores no se convierten en un error del contexto nuevo.
12. Corriges un dato mientras una generación está pendiente y llega la validación del dato anterior. Esa validación vieja se descarta.
13. Sales del editor mientras una operación está pendiente. Su finalización no guarda opciones adicionales después del desmontaje.
14. Sales antes de recibir un fallo de autosave. No aparece un callback de error tardío en la sesión que ya abandonaste.
15. Abres un documento ya generado para corregirlo. No se ejecuta autosave ni Guardar borrador sobre ese destino. La corrección no se confunde con un borrador privado.

## Los nueve escenarios del componente en navegador

[check-document-generation-state.mjs](../../scripts/check-document-generation-state.mjs) monta el cliente real en Storybook bajo React Strict Mode, con API sintética. Además de las reglas anteriores, observa DOM, foco, requests y resultados visibles.

1. Recuperar un borrador muestra su contenido y no crea otro borrador durante la recuperación.
2. Abrir un documento generado carga ese documento y mantiene deshabilitado Guardar borrador.
3. Escribir mientras termina un autosave conserva texto, campo activo y selección.
4. Hacer lo mismo durante un guardado manual conserva la edición y no duplica el POST.
5. Generar usa el contenido guardado por la revisión solicitada; el resultado y el aviso de éxito aparecen.
6. Una asistencia tardía no pisa lo escrito en el campo enfocado.
7. Cambiar de plantilla sobre el mismo borrador mantiene las escrituras en orden.
8. Una carga inicial demorada no deja elegir una plantilla antes de tener su contexto resuelto.
9. Un guardado viejo que falla después de navegar no cambia el contexto nuevo ni produce su toast de error.

El [último registro del componente](../2026-10-17-test-strategy/component-runtime.json) contiene nueve aprobados y ninguna señal de error. Esta prueba no establece permisos reales, persistencia en Postgres, almacenamiento ni contenido de un PDF renderizado.

## Los dieciséis casos nuevos de integración real

Se ejecutaron contra Next y Supabase locales descartables, con Auth real y usuarios distintos por escenario. Los permisos se ejercitan como usuario; el cliente administrador se limita a preparar y limpiar los datos.

### Aislamiento de tenants, siete ejecuciones

[tenant-isolation.spec.ts](../../tests/e2e/integration/tenant-isolation.spec.ts) comprueba:

1. Un owner crea y guarda una obra, y otro contexto autenticado la vuelve a leer con sus datos persistidos.
2. Un editor puede completar el mismo recorrido permitido.
3. Un viewer lee su obra, pero recibe una denegación al escribir y los datos permanecen intactos.
4. Un owner de A que conoce un ID de B no puede leerlo ni modificarlo por API. El owner de B confirma que su obra sigue intacta.
5. Al intentar acceder directamente por RLS, la lectura ajena queda oculta, update/delete afectan cero filas e insert se rechaza. El usuario legítimo sirve de control positivo.
6. Cambiar `active_tenant_id` no inventa una membresía en otro tenant.
7. Una denegación de rol prevalece sobre una concesión de otro rol.

### Precedencia de permisos, cinco ejecuciones

[permission-precedence.spec.ts](../../tests/e2e/integration/permission-precedence.spec.ts) comprueba:

1. Un bloqueo directo al usuario impide crear aunque su rol permita. Otro usuario autorizado confirma que no se creó la obra.
2. Dos roles en conflicto siguen bloqueando. Después, una concesión directa al usuario permite crear y el owner confirma la persistencia.
3. El owner mantiene el bypass definido por el dominio.
4. El admin mantiene su bypass.
5. El mismo usuario puede estar bloqueado en A y habilitado en B sin que una configuración contamine la otra.

### Entorno y migraciones, cuatro ejecuciones

- Dos casos en [fixture-lifecycle.spec.ts](../../tests/e2e/integration/fixture-lifecycle.spec.ts) provocan un setup parcial y comprueban limpieza real de Auth, perfiles y Storage. Las filas con soft-delete esperan la destrucción del stack completo y no se declaran físicamente eliminadas antes de tiempo.
- Un caso en [auth-boundary.spec.ts](../../tests/e2e/integration/auth-boundary.spec.ts) intenta registrarse públicamente y comprueba que el signup sigue deshabilitado, sin usuario ni sesión.
- Un caso en [permission-migration.spec.ts](../../tests/e2e/integration/permission-migration.spec.ts) reproduce datos heredados, ejecuta el backfill, verifica la precedencia final y la convergencia de `0132`, y revierte los datos de la sonda.

Los estados del runner y de los manifests son registros de infraestructura, no máquinas nuevas del producto. El runner registra preparación, arranque, ejecución y resultado. Los fixtures registran `active`, `awaiting-stack-disposal`, `cleanup-failed` y finalmente `disposed`, conservando el resultado separado de la limpieza.

## Qué se migró, reforzó y eliminó

Los 34 E2E finales son dieciséis nuevos más dieciocho existentes migrados. No son cincuenta casos. Los dieciocho conservaron importación/reimportación, overrides, filtros, creación de obra y navegación, pero pasaron a usuarios/tenants únicos y limpieza comprobada. La creación en tabla activa las celdas, confirma con Tab, guarda y recarga para comprobar el importe. Los casos de macro y defaults detectaron los dos bugs de producto que se corrigieron.

También se añadieron veinte casos del guard de destinos locales y dos pruebas de fronteras del runner. Protegen la ejecución de las pruebas, no son recorridos de negocio adicionales.

Se reforzaron estos contratos existentes:

- Firma de MercadoPago: se usa un vector HMAC independiente. Cambiar el evento, request, timestamp, secreto o firma debe invalidarla. Una mutación que antes sobrevivía ahora se detecta.
- Writeback: la primera sugerencia se inserta; repetir la misma pendiente no duplica; cambiar valor, obra o tenant, o partir de una sugerencia aceptada, permite una inserción distinta. Es un fake secuencial y no demuestra concurrencia o RLS.
- DOCX/PPTX: se abren los paquetes reales y se busca el contenido esperado en OpenXML.
- HTTP: se observan coerción, campos descartados, errores anidados y JSON inválido.
- Blueprints: se comprueban recursos necesarios, unicidad y referencias válidas, en lugar de fijar un tamaño de inventario.

Cinco casos independientes se eliminaron o fusionaron por redundancia o por observar la implementación: dos de animaciones CSS, uno circular de identidad administrativa, otro duplicado de espaciado y una primera importación ya cubierta por la transición de reimportación. Las razones por archivo están en la [auditoría](../2026-10-17-test-strategy/README.md).

## Qué demuestra el resultado final

El [run final](../2026-10-17-isolated-integration/full-final-run.json) terminó con 34/34 E2E, sin reintentos ni skips. Los 31 scopes terminaron verificados y descartados, con cero recursos Docker del stack, proceso y puerto cerrados y snapshot eliminado. La [comprobación independiente](../2026-10-17-isolated-integration/full-final-cleanup.json) volvió a leer los manifests y el entorno.

Los 349 Vitest en 46 archivos pertenecen al checkout compartido posterior, que incluye trabajo concurrente. No son 349 tests nuevos de este refactor.

Faltan los recorridos persistidos de revisión/aprobación y descarga, contenido de PDF real, autorización de Storage/descargas, concurrencia entre pestañas, idempotencia de servidor, proveedores externos y CI. La [estrategia de cuarenta workflows](../../docs/test-plan/testing-strategy.md) los identifica como trabajo pendiente.
