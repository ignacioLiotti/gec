# Actualización FigJam pendiente · simplificación

Fecha: 2026-09-07. Estado: **Inbox / propuesta**, sin cambio de comportamiento productivo.

Se intentó leer Product OS (`NDzN30GN3koTteiTdkgV3P`, nodo raíz `0:1`) y Journeys 03 (`nnPSyRwgsNseS3cm9BIMTp`, nodo raíz `0:1`). Ambas llamadas a `get_figjam` fueron rechazadas por el cupo del plan Starter: «You've reached the Figma MCP tool call limit on the Starter plan». No se conocen los IDs de los nodos interiores actuales. No se afirma que los recorridos existentes falten del board ni se crearon nodos sin comprobarlo.

Cuando vuelva a estar disponible el acceso, primero verificar la representación actual y sus vínculos; después agregar las propuestas de [la investigación](./2026-09-simplification.md).

| Board | Flujos/nodos que revisar y agregar | Estado y material |
| --- | --- | --- |
| [Product OS](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P) | Usuario de carga, consulta, revisión y administración; recorrido documento → datos → uso; backlog U01–U15 | Inbox. Aclarar capacidades existentes frente a interfaces propuestas y trabajos nuevos de agregación. |
| [Journeys 01 / Inicio y Obras](https://www.figma.com/board/W6SZcSjlbhn1XdFLSktU03) | Acciones contextuales, salida con cambios pendientes, invitación a primera tarea, configuración con ejemplo y aplicación a nuevas/existentes obras | U01, U04, U05, U07, U09, U12, U13. Capturas 01 y 05 del laboratorio. |
| [Journeys 02 / Datos y Reportes](https://www.figma.com/board/8dX4sV8kJYDwf1qa1jY5zb) | Documento y datos, conflicto de reimportación, vista guardada a reporte, cálculos avanzados, estados de póliza y certificado | U03–U06, U14. Capturas 01 y 04. No presentar saldo como ahorro ni descarga como archivo archivado. |
| [Journeys 03 / Documentos y Automatización](https://www.figma.com/board/nnPSyRwgsNseS3cm9BIMTp) | Generar desde carpeta con 0/1/varias plantillas; borrador/generado/revisión; consultar con alcance y fuente; aviso leído frente a tarea resuelta; recordatorios | U01, U02, U08, U11. Capturas 02, 03 y 06. Añadir ramas de error, vacío, falta de permiso y procesamiento. |
| [Journeys 04 / Plataforma y Acceso](https://www.figma.com/board/ySjUIomuoMG00LNK0sKajF) | Acceso a documentos de empresa, enlace con vencimiento, permisos efectivos, soporte y retorno desde WhatsApp | U06, U10, U13, U15. Captura 04. Mantener ámbitos y capacidades de servidor. |
| [Screenshots actuales](https://www.figma.com/board/mC50ck1vEmJzOvrdW9s9AU) | Sección separada «Propuestas de simplificación · 2026-09-07» | Las capturas del laboratorio son **prototipos**, no screenshots actuales. No reemplazar las capturas productivas por estas. |

Capturas sanitizadas en `prototypes/user-flows/verification/`: `01-capture-desktop.png`, `02-generate-desktop.png`, `03-ask-desktop.png`, `04-report-desktop.png`, `05-configure-desktop.png`, `06-inbox-desktop.png`, `07-capture-mobile.png`, `08-inbox-mobile.png`.

No hay captura comparativa real de producción para esta propuesta. El modo Existente del laboratorio es un mapa textual. Si se quiere un antes/después visual del producto, queda pendiente capturar el mismo caso con datos sanitizados en el checkout final. No marcar estas propuestas como Shipped ni agregar un hash de implementación: la rama contiene investigación y prototipos, sin commit nuevo.
