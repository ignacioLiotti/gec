# ADR-0046: Demos de recorridos contextuales solo en desarrollo

## Status

Accepted for local demos. Production integration remains proposed.

## Context

Se pidió una rama nueva para probar generación desde una carpeta, consulta desde una obra y carga/revisión integrada. Ya había un laboratorio HTML independiente. Esta iteración necesita usar Next.js y el sistema visual actual sin depender de acceso al tenant que sigue operando ni de servicios de OCR/IA.

El checkout original tiene una renovación visual sin commit y otros cambios de negocio. Cambiarlo de rama o copiar todos sus cambios mezclaría trabajos independientes.

## Decision

- Crear el worktree `multi-tenant-flow-demos` en `codex/contextual-flow-demos` desde `e04d720`.
- Copiar únicamente el conjunto visual identificado en `docs/ux/contextual-demos-baseline.json`. Registrar hashes para distinguirlo de los cambios de esta tarea.
- Añadir `/portfolio/previews/contextual-flows`, siguiendo el precedente de previews del proyecto. La página usa `notFound()` excepto cuando `NODE_ENV=development` y `CONTEXTUAL_FLOW_DEMOS=1`.
- Mantener estado y fixtures junto a la ruta. Los flags de URL seleccionan solo presentación. Las capacidades y estados simulados no alteran permisos productivos.
- Reutilizar UI de `components/ui` y validación/renderizado de `lib/document-generation.ts`. No añadir dependencias, APIs, esquemas ni nuevos estados persistidos.
- Servir documentos ficticios en iframes sin permisos de script. El HTML descargado se produce con el renderizador existente y valores escapados.
- No cargar Visitors durante este modo local: el script falla en localhost. La condición incluye desarrollo para preservar su comportamiento productivo.
- Aislar también la carga del fixture de Supabase: `proxy.ts` marca únicamente GET/HEAD de la ruta exacta en desarrollo con el flag habilitado; `app/layout.tsx` devuelve su contenedor sin resolver sesiones ni montar listeners de autenticación. El proxy elimina marcadores enviados por el cliente en las demás rutas. Se mantienen los encabezados de seguridad y los controles de acceso de producto.
- Usar el favicon estático en la demo para evitar que su icono ejecute otra solicitud autenticada.

## Consequences

Las demos permiten comparar formularios, navegación, fuentes, errores y foco sin modificar archivos reales. La copia visual parcial puede mantener hallazgos de estilo en pantallas ajenas; no se declara completada la migración del sistema visual.

Las respuestas y extracciones son preparadas. La generación crea una descarga HTML local, no un PDF persistido. No se ha validado el backend autenticado ni la precisión OCR/IA. Integrar cualquiera de los recorridos en el producto requiere conectar sus consumidores actuales, conservar permisos y probar sus contratos de almacenamiento y revisión.

Una cookie de sesión local vencida reproducía una carga de más de 15 segundos por los reintentos de Supabase, aunque una visita sin cookies respondía en 285 ms. Tras aislar la ruta, la prueba con una cookie ficticia vencida respondió en 92 ms sin modificarla. Las mediciones son locales con el servidor ya compilado.

Los cuatro tests de la ruta cubren el guard de acceso y las variantes iniciales. Nueve tests adicionales verifican el aislamiento de GET/HEAD, los encabezados, producción, flag apagado, rutas vecinas, APIs, POST y marcadores falsificados. Playwright recorre la demo completa con una cookie vencida ficticia y comprueba que no haya solicitudes de autenticación. FigJam queda pendiente por el límite del plan, con destinos y cambios detallados en `docs/ux/contextual-flow-demos.md`.
