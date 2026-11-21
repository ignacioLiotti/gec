# Persona literal, ronda 3 final

Resultado: **ISSUES**, firstSuccess: **true**. Se completó registro → organización → puesta en marcha → tablero con organización activa, sin recargar. La pestaña Archivos globales respondió y mostró su contenido. Solo queda una confusión menor de texto.

## Recorrido

1. Abrí / en un contexto nuevo de Chrome y elegí el enlace visible Crear cuenta.
2. Completé Correo electrónico y Contraseña en Crear tu cuenta, y envié Crear cuenta.
3. En Bienvenido a Síntesis elegí Crear mi organización.
4. Completé Nombre de la empresa u organización con Constructora Literal R3 y envié Crear y preparar mi espacio una sola vez.
5. La navegación fue a /setup. Puesta en marcha mostró Constructora Literal R3 y Empresa / Modelo de trabajo listos.
6. Elegí el enlace Inicio. Apareció Panel de Control.
7. Abrí el selector de organización. Mostró Constructora Literal R3 seleccionada, sin Sin organizaciones disponibles.
8. Cerré el selector y elegí Archivos globales. La pestaña quedó seleccionada y mostró la tabla vacía de archivos de empresa, Actualizar y Subir archivo.
9. Guardé y revisé capturas y cerré el navegador. No recargué ni usé rutas ocultas.

## Hallazgo menor

P3, `dashboard-empty-state-asks-configured-user-to-configure`. El selector muestra Constructora Literal R3 seleccionada y Puesta en marcha marcó Empresa y Modelo de trabajo como Listo. Sin embargo, Resumen dice: Si acabas de registrarte, configura tu organizacion primero.

Como lector literal, esa frase hace dudar si falta repetir la configuración. Pude continuar y cambiar de pestaña.

Evidencia: [organización seleccionada y texto del resumen](02-organization-selected.png).

## Verificación

POST /tenants/new respondió 303 con x-action-redirect `/setup;push`. El selector mostró la organización creada y seleccionada. La pestaña Archivos globales cambió al estado seleccionado y mostró documentos de la empresa. [Puesta en marcha](01-setup.png) y [estado final](final.png), capturas abiertas y revisadas.

Tiempos locales observados: registro a onboarding 3162 ms; envío de organización a respuesta POST 1839 ms; envío a /setup 2297 ms. Son tiempos de desarrollo, no un benchmark de producción.

Sin pageerrors ni fallas HTTP del origen de la app. Hubo scripts externos bloqueados por aislamiento y errores 503 de WebSocket del Supabase local. Se registraron como evidencia ambiental, sin atribuirles un fallo del recorrido.

Run ID: `ebf28309-24f4-4aae-93fb-078b45b85b3a`. Revisión: `round3-final`. Snapshot identificado por independent-final-snapshot.json, capturado 2026-10-19T22:41:35.774Z, con hashes guardados en report.json. App http://127.0.0.1:61709. Cuenta nueva qa-literal-r3-1792450050053@example.test. Chrome independiente, es-AR, 1365 × 900.

No cambios de producto ni runtime; navegador cerrado. Informe estructurado en [report.json](report.json), historial en [state.json](state.json), controlador en [browser.cjs](browser.cjs).
