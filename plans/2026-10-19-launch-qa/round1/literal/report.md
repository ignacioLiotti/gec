# Persona literal, ronda 1

Resultado: **BLOCKED**. La cuenta se creó y mostró el onboarding. Crear la organización falló dos veces y no se alcanzó un tablero usable.

Persona hispanohablante con inglés básico. Chrome nuevo, contexto independiente, idioma es-AR, 1365 × 900. No se usaron rutas ocultas ni conocimiento del código.

## Recorrido observado

1. Abrí / y leí el contenido visible. La navegación ofrecía Ingresar y Agendar demo.
2. Elegí Ingresar.
3. Elegí ¿Primera vez? Crear mi espacio.
4. Elegí Registrarme con correo.
5. Completé Correo electrónico con el correo sintético y Contraseña con un valor nuevo de más de ocho caracteres.
6. Elegí Crear mi espacio. Apareció Bienvenido a Síntesis y Configurá tu espacio de trabajo para empezar en /onboarding.
7. Elegí Crear mi organización.
8. Completé Nombre de la empresa u organización con Constructora Prueba Literal.
9. Elegí Crear y preparar mi espacio.
10. Apareció No pudimos crear la organización. Probá de nuevo.
11. Seguí esa indicación y pulsé Crear y preparar mi espacio otra vez. Se mantuvo el mismo error.
12. Abandoné en esa pantalla. No se alcanzó ningún tablero.

## Hallazgos

### P1: Crear organización bloquea la activación

Fingerprint: `organization-create-generic-error`.

Dos envíos desde la UI terminaron con No pudimos crear la organización. Probá de nuevo.

La cuenta existe, pero no pude preparar mi espacio ni llegar al tablero. El único remedio indicado, reintentar, tampoco funcionó.

Esperado: Después de aportar un nombre válido, se prepara la organización y se ofrece acceso al tablero; si hay un error recuperable, se explica una acción que permita continuar.

Evidencia revisada: [02-organization-error.png](02-organization-error.png), [final.png](final.png).

### P3: La portada no nombra el registro

Fingerprint: `landing-signup-hidden-under-ingresar`.

La portada ofrece Ingresar y Agendar demo. Crear mi espacio aparece recién después de abrir Ingresar.

En la primera visita tuve que probar Ingresar para encontrar cómo crear una cuenta. Pude continuar cuando apareció ¿Primera vez? Crear mi espacio.

Esperado: Una entrada visible que nombre la creación de cuenta o de espacio.

Evidencia revisada: [01-landing-no-signup.png](01-landing-no-signup.png).

## Evidencia y límites

Sin pageerror ni solicitudes fallidas del mismo origen. Dos ERR_FAILED coinciden con scripts externos bloqueados por el aislamiento, visitors.now y react-scan; son ambientales. Advertencias de CSS preload registradas sin impacto visual observado.

No se diagnosticó la causa del error de creación. No se abrió ni envió el formulario de ventas. No se hizo un recorrido de recuperación. Las capturas de cada fricción y del estado final fueron abiertas y revisadas. El navegador quedó cerrado.

HEAD observado: `e04d72020f0fea28c42bf603ae2960ca5e63bb07`, con cambios locales previos. Run ID: `632e9558-4b39-4e90-b893-3881421b89c7`. Instancia: `owned-local-integration`, creada `2026-10-19T22:12:59.212Z`. Workspace: `C:\Users\Usuario\AppData\Local\Temp\multi-tenant-integration-m7zg9L`. App: `http://127.0.0.1:62988`. Esos identificadores distinguen la instantánea local de esta ejecución; HEAD por sí solo no describe sus cambios sin commit.

El script de navegador está en [browser.cjs](browser.cjs), el registro de pasos y errores en [state.json](state.json), y el informe estructurado en [report.json](report.json). No se guardaron contraseñas ni tokens.
