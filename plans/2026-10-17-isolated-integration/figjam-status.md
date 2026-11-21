# FigJam permission repair status

Date: 2026-10-17

Status: Visual update pending because the Figma MCP Starter plan call limit rejected the write attempts. Do not retry until quota is available. Keep this work in `Verify`: local verification is complete, but there is no commit or deployment and the 40-workflow strategy remains incomplete.

Evidence: [full-final-run.json](full-final-run.json), [full-final-results.json](full-final-results.json), [vitest-final.json](vitest-final.json) and [final-static-checks.json](final-static-checks.json).

## Product OS

Board: [Product OS](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P)

Node ID: `T1:191;1:13;1:18`

Replace the current permission line:

> 🟡 Permisos 0123/0132: reparación aplicada localmente; migraciones fresh completan; suite real pendiente mientras se instala Chromium.

With:

> 🟡 Integración aislada · Verify · 2026-10-17: 34/34 E2E y 31/31 scopes con cleanup verificado y disposición completa. Permisos 0123/0132, conflictos de macrotabla, cinco selectores controlados y flujo Excel create/edit/Tab/save/reload verificados. Run cf2a3a85-33a9-4a38-bacc-9d134c3c6000. Sin commit ni despliegue; estrategia de 40 workflows incompleta.

Preserve every other line in the `Verify` cell.

## Journeys 04

Board: [Journeys 04 / Plataforma y Acceso](https://www.figma.com/board/ySjUIomuoMG00LNK0sKajF)

Node ID: `9:420`

Replace the current text:

> Estado · Verify · sin commit ni despliegue
>
> Flujo: Administrador → Roles / usuarios → Heredar, Permitir o Bloquear → guardar → mostrar selección persistida.
>
> Precedencia para miembros: denegación de usuario → permiso de usuario → denegación de rol → permiso de rol. Superadmin y owner/admin mantienen bypass.
>
> Reparación local 2026-10-17: 0123 agrega el prerrequisito nullable; 0125 conserva backfill, restricciones y RLS; 0132 restaura la función final.
>
> Migraciones fresh completan. Suite real pendiente mientras se instala Chromium. No marcar Shipped ni verificación integral todavía.

With:

> Estado · Verify · sin commit ni despliegue
>
> Flujo: Administrador → Roles / usuarios → Heredar, Permitir o Bloquear → guardar → mostrar selección persistida.
>
> Precedencia para miembros: denegación de usuario → permiso de usuario → denegación de rol → permiso de rol. Superadmin y owner/admin mantienen bypass.
>
> Reparación local 2026-10-17: 0123 agrega el prerrequisito nullable; 0125 conserva backfill, restricciones y RLS; 0132 restaura la función final.
>
> Verificación · 2026-10-17: run cf2a3a85-33a9-4a38-bacc-9d134c3c6000 pasó 34/34 E2E. 31/31 fixture scopes con runtime cleanup verificado y estado disposed; 0 containers/volumes/networks, proceso cerrado, puerto cerrado, snapshot eliminado y failures vacío. Matriz real cubre user/role denies, owner/admin bypass y overrides cross-tenant. SQL backfill/convergencia pass. Vitest 349/349 en 46 archivos; tipos, ESLint focalizado y check:ui 1163 pass. Mantener Verify: sin commit ni despliegue y la estrategia de 40 workflows sigue incompleta.

Preserve the existing permission precedence node `1:72` and the `Verify` section/title nodes `9:418` and `9:419`.

## Product regression proposals

Figma writes remain blocked by quota. These are local proposals only.

### Journeys 02 / Datos y Reportes

Board: [Journeys 02 / Datos y Reportes](https://www.figma.com/board/8dX4sV8kJYDwf1qa1jY5zb)

Exact node selection remains unavailable. Add this note to the existing macro override/reimport conflict flow:

> Verify · 2026-10-17: un conflicto real conserva el valor vacío y muestra una advertencia con fila, obra y columna afectadas; ningún candidato gana en silencio. Navegar a una macrotabla sana limpia el aviso y conserva su valor manual. Verificado en el run cf2a3a85-33a9-4a38-bacc-9d134c3c6000.

### Journeys 01 / Inicio y Obras

Board: [Journeys 01 / Inicio y Obras](https://www.figma.com/board/W6SZcSjlbhn1XdFLSktU03)

Exact node selection remains unavailable. Add this note to the default-folder authoring flow:

> Verify · 2026-10-17: cinco selectores OCR/planilla corregidos para permanecer controlados. El test de navegador verifica la transición items → resumen, elegir la misma plantilla OCR y enviar ambos IDs y columnas correctos. El flujo Excel real create/edit/Tab/save/reload también pasa. Verificado en el run cf2a3a85-33a9-4a38-bacc-9d134c3c6000; otras variantes de selector no están cubiertas por ese caso.
