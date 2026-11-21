# Demos de generación, consulta y carga

Rama `codex/contextual-flow-demos`, worktree `C:/Users/Usuario/Desktop/projects/multi-tenant-flow-demos`. Base Git: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`. Los cambios no están commiteados.

Estas demos llevan los tres recorridos propuestos a Next.js con los controles actuales de Síntesis. Se puede alternar entre una selección manual y una entrada desde la obra, completar formularios, abrir documentos y ejercitar errores. No están conectadas a los registros de la empresa.

## Abrir

Desde este worktree:

```powershell
node scripts/dev-contextual-demos.mjs
```

Abrir `http://127.0.0.1:4320/portfolio/previews/contextual-flows`. `CONTEXTUAL_DEMOS_PORT` permite cambiar el puerto del servidor local.

El lanzador habilita `CONTEXTUAL_FLOW_DEMOS=1`, usa una configuración anónima local de Supabase y desactiva React Scan. No se copiaron archivos `.env`. Las dependencias se leen mediante una junction al `node_modules` del checkout original; no se instalaron paquetes ni se modificó el lockfile.

La página responde 404 salvo en desarrollo y con el flag explícito. Los interruptores de las tres propuestas solo seleccionan UI dentro de esta demo; no conceden permisos ni cambian rutas productivas.

La carga de la ruta está aislada de Supabase tanto en el proxy como en el layout. Una sesión local vencida no debe provocar renovación de tokens ni modificar cookies. El proxy asigna el marcador interno solo a GET/HEAD de esta ruta exacta, exige desarrollo y el flag, y elimina cualquier marcador recibido del cliente. El favicon también usa el archivo estático. Las otras rutas conservan la autenticación habitual.

## Qué probar

### Generar un documento

1. Entrar a Compras y elegir **Generar documento aquí**.
2. Con una sola plantilla compatible, la obra, la carpeta y la plantilla ya están resueltas.
3. Completar proveedor, importe y pedido. Guardar el borrador y cambiar de recorrido; al volver, el formulario conserva sus datos.
4. Alternar a **Selección manual**. Se muestran obra, tipo, carpeta y plantilla, usando el mismo borrador. Esta es una recreación simplificada del recorrido, no la pantalla productiva completa.
5. Revisar, generar y volver a Compras. Abrir el documento en revisión y descargar el HTML de ejemplo.

El selector de casos permite probar varias plantillas, ausencia de plantillas, error de generación y falta de permiso. Una plantilla se elige automáticamente solo cuando es la única compatible. Cambiar de caso no borra el texto del borrador.

La validación usa `validateTemplateInput`; la vista previa y la descarga usan `renderDocumentHtml`, ambos de `lib/document-generation.ts`. La descarga HTML es real y local. La persistencia, numeración, PDF y aprobación son simulados. No se llama al endpoint de generación.

### Consultar documentos

1. Con **Desde la obra**, preguntar por el plazo de ejecución y abrir el contrato citado.
2. Cambiar a Compras: la respuesta y su fuente anteriores desaparecen. Preguntar por el monto de la factura.
3. Elegir Planos para ver el estado sin documentos, o preguntar por algo que no está en el alcance para ver ausencia de evidencia.
4. En **Selección manual**, elegir la obra antes de consultar.

Las respuestas están preparadas para dos documentos ficticios. No hay un modelo de IA conectado. Cada respuesta se limita al alcance seleccionado; un error no cambia la consulta a todas las obras. La fuente se abre en un diálogo que devuelve el foco al control de origen al cerrarse.

### Cargar y revisar

1. Cargar la factura de ejemplo y observar los estados archivo en carga, archivo guardado y extracción en curso.
2. Comparar el total extraído de `12.500` con el original de `125.000`. Corregir el campo y alternar variantes.
3. En la variante manual, Archivos y Tabla de datos están separados. En la contextual, el original y el formulario se ven juntos, apilados cuando hay poco ancho.
4. Guardar y abrir el original para comprobar que corregir un dato no cambia el documento.

Se puede provocar un fallo de extracción y reintentar sobre el archivo ya cargado. Un fallo al guardar conserva las correcciones. Solo consulta bloquea la carga y la edición. El caso usa una factura preparada; no sube archivos ni ejecuta OCR real.

## Comparación y conservación de estado

Cada recorrido tiene un flag independiente: `generate`, `ask` y `capture`. La URL conserva esos flags con valores `1` o `0` y el recorrido activo en `flow`, por ejemplo:

```text
/portfolio/previews/contextual-flows?flow=capture&generate=0&ask=1&capture=1
```

Los tres componentes permanecen montados al navegar dentro de la demo y conservan sus formularios en memoria. Recargar conserva la selección de variantes mediante la URL, pero reinicia borradores y resultados ficticios. No hay autosave ni almacenamiento de datos privados en el navegador.

## Archivos propios y copia visual

Los cambios propios son la ruta `app/portfolio/previews/contextual-flows`, sus fixtures/componentes/CSS, los scripts de ejecución/verificación, los tests de acceso y proxy, el tsconfig acotado y esta documentación. `proxy.ts` y `app/layout.tsx` aíslan la carga local de la demo. Visitors deja de cargarse únicamente durante el modo local de estas demos porque su script lanzó un error `Localhost` al verificar. La analítica de producción conserva su comportamiento.

Además se copiaron 50 archivos de controles, tokens, estilos y utilidades que estaban modificados en el checkout original. No se tomó toda la renovación visual ni se aplicaron sus cambios de negocio. El [manifiesto de la copia](./contextual-demos-baseline.json) contiene la procedencia y el SHA-256 de cada archivo al copiarlo. Esos cambios preexistentes deben distinguirse de la implementación de demos al revisar o integrar la rama.

`scripts/check-ui-contract.mjs` formaba parte de esa copia. Se añadió la posibilidad de recibir directorios explícitos para aplicar las mismas reglas a los previews, normalmente excluidos del chequeo global. Sin argumentos mantiene su alcance anterior. Los demás archivos copiados se conservan tal como estaban en el snapshot.

Los nuevos componentes importan UI desde `components/ui`. No se cambiaron primitives para adaptar las demos, ni se crearon variantes de botón/badge locales. No se modificaron el esquema, los importadores, los permisos del backend ni el sistema de almacenamiento.

## Verificación

Resultado: TypeScript y ESLint dirigidos sin errores; contrato UI aprobado para 50 controles; 13 tests de acceso/proxy y 8 grupos de comprobaciones en navegador aprobados. La ejecución final no registró errores de navegador ni llamadas a APIs de producto o autenticación. El [resultado completo](../../deliverables/contextual-flow-demos/verification.json) acompaña las capturas de escritorio y móvil.

La regresión de carga se reprodujo con una cookie vencida ficticia: antes la solicitud seguía esperando al llegar al límite de 15 segundos; después respondió en 92 ms sin alterar la cookie. Son mediciones locales con el servidor compilado, no tiempos de arranque en frío.

```powershell
node node_modules/typescript/bin/tsc --project tsconfig.contextual-demos.json
node node_modules/eslint/bin/eslint.js app/portfolio/previews/contextual-flows app/layout.tsx proxy.ts scripts/dev-contextual-demos.mjs scripts/verify-contextual-demos.mjs scripts/check-ui-contract.mjs tests/app/contextual-flow-demos.test.ts tests/app/contextual-flow-demos-proxy.test.ts
node scripts/check-ui-contract.mjs app/portfolio/previews/contextual-flows
node node_modules/vitest/vitest.mjs run tests/app/contextual-flow-demos.test.ts tests/app/contextual-flow-demos-proxy.test.ts --reporter=dot
node scripts/verify-contextual-demos.mjs
```

El script de navegador usa Microsoft Edge con Playwright. `CONTEXTUAL_DEMOS_URL` permite apuntarlo a otro puerto local. Guarda capturas y resultados en `deliverables/contextual-flow-demos/verification.json`. Verifica los recorridos, el contenido descargado, el escape de valores, la conservación de borradores, errores, permisos simulados, foco, móvil y ausencia de llamadas a APIs de documentos/obras.

Los cuatro tests de página comprueban que el acceso exige desarrollo y habilitación explícita, y que los flags se restauran desde la URL. Los nueve tests de proxy cubren la ruta aislada, los encabezados de seguridad y los casos que deben seguir autenticándose. No sustituyen una prueba de build productivo. No se ejecutó un tenant autenticado ni proveedores externos.

El chequeo UI global reporta 320 líneas de hallazgos en pantallas heredadas de esta base: el worktree tiene controles nuevos, pero no todas las migraciones de sus consumidores. Se conserva ese resultado en `deliverables/contextual-flow-demos/diagnostics/.ui-contract-demo-check.log` y no se modifican pantallas ajenas para limpiar el chequeo. La revisión dirigida aplica las mismas reglas a los 50 controles de las demos. La carpeta `diagnostics` también conserva capturas de intentos anteriores; `verification.json` en la carpeta superior corresponde a la ejecución final aprobada.

La guía `next-dev-loop` requiere Next 16.3 y Turbopack. Esta app usa 16.2.6; no se aplicó ese flujo ni se actualizaron dependencias. La comprobación ejecutada es Next con webpack y Playwright, acompañada de TypeScript, ESLint y pruebas del guard de acceso.

## Documentación visual pendiente

Las consultas anteriores de FigJam a Product OS y Journeys 03 fueron rechazadas por el límite de llamadas del plan Starter. No se modificó ningún board ni se afirmó que sus nodos estuvieran actualizados.

| Destino | Actualización pendiente |
| --- | --- |
| [Product OS](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P) | Vincular las tres demos bajo propuestas en **Verify**, aclarando simulación local y acceso solo de desarrollo. |
| [Journeys 01 / Inicio y Obras](https://www.figma.com/board/W6SZcSjlbhn1XdFLSktU03) | Entrada desde obra/carpeta, contexto preseleccionado y borrador conservado al alternar. |
| [Journeys 02 / Datos y Reportes](https://www.figma.com/board/8dX4sV8kJYDwf1qa1jY5zb) | Archivo guardado → extracción → corrección; error de extracción frente a error al guardar; original inmutable. |
| [Journeys 03 / Documentos y Automatización](https://www.figma.com/board/nnPSyRwgsNseS3cm9BIMTp) | Generación con 0/1/varias plantillas, resultado en revisión, consulta por alcance y fuente, error/vacío/sin permiso. |
| [Screenshots](https://www.figma.com/board/mC50ck1vEmJzOvrdW9s9AU) | Añadir las capturas de `deliverables/contextual-flow-demos` bajo **demos propuestas**, sin reemplazar capturas actuales de producción. |

Antes de añadir nodos, inspeccionar los existentes. No se conocen sus IDs interiores por el bloqueo de lectura. El [ADR 0037](../adr/0046-development-only-contextual-flow-demos.md) registra el alcance técnico. Los documentos de dominio no cambian porque sus reglas productivas permanecen intactas.
