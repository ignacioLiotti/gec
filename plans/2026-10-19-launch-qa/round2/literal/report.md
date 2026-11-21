# Persona literal, ronda 2

Resultado: **BLOCKED**. firstSuccess: false. Se creó la cuenta y se mostró Panel de Control, pero el selector indicó "Sin organizaciones disponibles". No hubo tablero usable para la organización solicitada.

## Pasos

1. Abrí / en Chrome nuevo. Esperé Preparando acceso… y leí Crear cuenta.
2. Elegí Crear cuenta, completé correo sintético y contraseña nueva, y envié Crear cuenta.
3. La portada mostró la sesión iniciada; intenté Mis obras. La navegación automática llegó a /onboarding a los 13.71 s y ese enlace dejó de estar presente.
4. Elegí Crear mi organización en el onboarding.
5. Completé Nombre de la empresa u organización con Constructora Literal R2.
6. Envié Crear y preparar mi espacio una única vez. Mostró Preparando tu espacio… a los 0 y 2 s.
7. Registré estados a 0, 2, 7, 15, 30, 45 y 60 s. Desde el estado de 7 s había Panel de Control, sin organización seleccionada.
8. Tras completar 60 s abrí Seleccionar organización. Mostró Sin organizaciones disponibles y Crear organización.
9. Guardé la captura final y cerré el navegador. No repetí creación ni seguí rutas ocultas.

## Hallazgos

### P1: Después de crear la organización, el tablero no ofrece ninguna organización

Fingerprint: `organization-create-redirect-loses-active-context`.

Un único envío terminó en /dashboard. El selector muestra Sin organizaciones disponibles y el tablero pide configura tu organizacion primero. El estado no cambió durante 60 segundos.

No pude seleccionar el espacio recién solicitado ni confirmar un tablero usable. No se reenvió el formulario para evitar duplicados.

Capturas revisadas: [organization-7s.png](organization-7s.png), [organization-60s.png](organization-60s.png), [02-organization-selector.png](02-organization-selector.png), [final.png](final.png).

### P3: El registro deja la portada autenticada visible antes de mostrar el siguiente paso

Fingerprint: `signup-redirect-delayed-feedback`.

Tras Crear cuenta, la portada mostró Mis obras y el correo autenticado, sin instrucciones de organización. Onboarding apareció 13.71 segundos después del clic.

Intenté seguir Mis obras mientras esperaba. La navegación automática cambió la página antes del clic; el timeout del controlador por ese enlace ya ausente no se cuenta como un defecto adicional.

Capturas revisadas: [01-signup-result.png](01-signup-result.png).

## Tiempos y respuestas

Envío de organización: 2026-10-19T22:37:29.304Z. Respuesta POST /tenants/new: 2026-10-19T22:37:33.876Z, 4572 ms desde el clic, estado 303. Cabecera x-action-redirect: `/api/tenants/2787a735-a7c3-458b-bb3c-186898558bdd/switch?next=%2Fsetup;push`. Navegación observada: switch → / → /dashboard. Dashboard: 2026-10-19T22:37:35.559Z, 6255 ms desde el clic. No hubo navegación a /setup.

Se capturaron estados a 0, 2, 7, 15, 30, 45 y 60 segundos y se revisaron todas las imágenes. La carga mostró "Preparando tu espacio…". Desde 7 segundos hasta 60, el tablero seguía sin organización seleccionada.

Sin pageerrors ni fallos HTTP del origen de la app registrados. Los scripts externos bloqueados son ambientales. El WebSocket local de Supabase devolvió 503; no se afirma que eso explique el fallo. Las credenciales de URLs se redactaron en los artefactos.

Instancia aislada: `owned-local-integration`. Run ID: `ebf28309-24f4-4aae-93fb-078b45b85b3a`. Snapshot: `C:\Users\Usuario\AppData\Local\Temp\multi-tenant-integration-uINfbN`, iniciado 2026-10-19T22:27:52.193Z. App: http://127.0.0.1:61709. Nueva cuenta qa-literal-r2-1792449330121@example.test. Chrome nuevo, contexto independiente, es-AR, 1365 × 900.

No se modificó producto ni runtime, no se consultó BD y no se repitió creación. Navegador cerrado. Evidencia estructurada en [report.json](report.json), historial en [state.json](state.json) y controlador en [browser.cjs](browser.cjs).
