# Simplificar los recorridos de Síntesis

Propuesta para revisión, 7 de septiembre de 2026. Rama `codex/simplify-user-flows`, basada en `e04d72020f0fea28c42bf603ae2960ca5e63bb07`.

La prioridad es que una persona pueda **cargar un documento, encontrarlo, corregir sus datos y usarlo** sin aprender cómo se configuran carpetas, tablas, macrotablas y flujos. La app ya tiene gran parte de las capacidades necesarias. Hay que acercarlas a la tarea y conservar la configuración que permite adaptarlas a cada empresa.

El cliente conocido es una constructora de Corrientes que usa documentos, centralización y OCR, con poco soporte. El objetivo del propietario es un ingreso complementario. Eso orienta la prioridad hacia recorridos repetibles y soporte bajo; no prueba qué pantallas usa cada empleado ni cuánto tiempo pierde. No contamos con analítica de uso ni observación de sus operadores.

## Qué se entregó

Un [laboratorio interactivo](../../prototypes/user-flows/index.html) con seis propuestas independientes y un esquema del recorrido existente para cada una. Los interruptores conservan su selección en el navegador y en la URL. Los datos de los ejemplos permanecen en memoria durante la sesión. No son flags conectados a la aplicación productiva.

Desde esta rama, ejecutar `node prototypes/user-flows/serve.mjs` y abrir `http://127.0.0.1:4318`. No requiere instalar dependencias ni configurar Supabase. Carga los tokens existentes de `design-system/tokens.css`. La integración futura debe usar los componentes de `components/ui`.

La rama tiene un worktree separado en `C:/Users/Usuario/Desktop/projects/multi-tenant-ux-flows`. El checkout original sigue en `mobile-navigation`, con cambios concurrentes de diseño. No se copiaron esos cambios ni se modificó su trabajo. La evidencia final se contrastó contra el commit base de esta rama; los nombres de componentes y líneas deben revisarse de nuevo al integrar sobre el diseño actualizado.

## Modelo que conviene mostrar

| Concepto actual | Experiencia propuesta | Qué sigue existiendo internamente |
| --- | --- | --- |
| Tenant / organización | Empresa activa, siempre visible al cambiar contexto | Aislamiento por tenant, membresías y RLS |
| Obra | Obra: el lugar habitual de trabajo | Identidad, datos generales y ciclo de finalización |
| Carpeta con OCR y tabla vinculada | Compras, Certificados u otro nombre del cliente; vistas **Documentos** y **Datos** | Ubicación, método de entrada y una o varias tablas |
| Fila extraída / lineage | Dato y documento de origen; explicar conflictos con una acción | Identidad estable y política de reimportación |
| Macrotabla | Vista consolidada con nombre útil, por ejemplo Compras de todas las obras | Fuentes, mapeos, fórmulas y correcciones propias de la vista |
| Data-flow | Cómo se calcula, junto al resultado; editor para quien configura | Grafos, fórmulas, fuentes reales/proyectadas y escritura confirmada |
| Modelo de obras | Configuración de las próximas obras, con prueba e impacto | Defaults, carpetas, tablas y acciones rápidas |
| Preset de reporte | Vista guardada | Filtros, columnas y presentación persistidos |
| Borrador / generado / aprobado | Estados visibles dentro del recorrido de un documento | Propiedad privada del borrador y permisos de creación, edición y revisión |
| Notificación / pendiente / acción de flujo | Aviso y tarea de origen, con verbo concreto | Estados separados: leído, resuelto y ejecutado |

Esto es vocabulario propuesto para la interfaz. No se renombraron entidades, tablas ni permisos. Tampoco corresponde sustituir cada tabla por tarjetas: las grillas son útiles para cargas masivas, comparación y corrección.

## Cobertura de la investigación

Se usaron el mapa de rutas, el catálogo de 40 recorridos y el catálogo de interacciones para recorrer las familias del producto, y se leyó su implementación representativa. No se ejecutaron los 40 recorridos contra un tenant autenticado ni se revisó cada línea del repositorio. Los playgrounds y fixtures del portfolio no prueban comportamiento productivo.

| Familia y recorridos del catálogo | Fuentes de implementación/documentación contrastadas | Decisión |
| --- | --- | --- |
| Acceso, invitaciones, empresa y preparación (G01–G05) | `app/onboarding`, `app/setup`, `app/admin/users/_components/invite-users-dialog.tsx`, `lib/tenant-blueprints/standard-construction.ts`, ADR 0030 | Mantener preparación guiada; invitado entra a su tarea. Mejorar recuperación sin enviarlo directamente a un editor experto. |
| Obra, creación, edición, acciones, memoria y cierre (G06–G14) | `app/excel`, `tabs/general-tab.tsx`, `components/quick-actions/quick-actions-panel.tsx`, `tabs/flujo-tab.tsx` | Reutilizar acciones rápidas y contexto; proteger borradores y explicar efectos del cierre. |
| Archivo, OCR, planillas, edición, reproceso y papelera (G15–G23) | Ambos gestores en `app/excel/[obraId]/tabs`, `file-manager`, `lib/lineage.ts`, ADRs 0001/0002/0015/0018 | Un recorrido documental; paridad antes de ocultar un gestor. Empresa y obra conservan ámbitos separados. |
| Certificados y pólizas (G24–G26) | `app/certificados`, `tabs/insurance-policies-tab.tsx`, `app/dashboard/page.tsx`, `docs/domain/insurance-policies.md` | Mantener módulos específicos y acciones por estado; no confundir saldo con cobertura ni certificado con cobro. |
| Consolidación, cálculos y reportes (G27–G29) | `app/macro/macro-page-client.tsx`, ambos `data-flow`, `components/report/report-page.tsx`, builders OCR/macro | Separar uso diario de configuración; acceso directo a vistas guardadas y procedencia. |
| Consulta de documentos (G30) | `app/document-ai/page-client.tsx`, `_components/scope-picker.tsx`, ADRs 0008/0016/0017 | Consulta contextual con alcance visible y fuentes. |
| Generación y plantillas (G31–G32) | `app/document-generation/page-client.tsx`, `lib/document-generation-server.ts`, rutas drafts/review/config | Generar desde obra/carpeta; conservar borrador privado, revisión y permisos. |
| Pendientes, calendario, roles y personas (G33–G35) | `app/notifications/page.tsx`, sus componentes, `app/admin/users`, `app/admin/roles`, ADRs 0028/0029 | Una entrada de trabajo, múltiples estados de origen. Roles diarios ya están simplificados parcialmente. |
| Facturación (G36) | `app/billing/billing-client.tsx`, `lib/subscription-plans.ts` | Consumo y acciones de cuenta en administración; mantener estados pendientes y cancelación al fin de período. |
| WhatsApp (G37–G38) | `app/admin/whatsapp/page.tsx`, `app/whatsapp/flow`, `app/whatsapp/respond`, ADRs 0021/0022 | Canal de carga que devuelve obra, destino y resultado; configuración avanzada para administrador. |
| Soporte, auditoría, perfil, ayuda, acceso compartido (G39–G40 y rutas auxiliares) | `app/admin/users`, `app/admin/audit-log`, `app/profile`, `components/report/share-report-client.tsx`, mapas de acceso | Accesos secundarios claros, sin mezclar herramientas internas con trabajo diario. |

En las filas amplias, los destinos auxiliares se cubrieron por rutas, consumidores y contratos; no por una prueba visual exhaustiva. Se priorizó la lógica de recorrido. Tipografía, superficies y adaptación se verificaron en el laboratorio; animaciones, iconografía y rendimiento de toda la app quedan fuera de este diagnóstico.

## Quince propuestas, ordenadas

Las prioridades son una recomendación según el uso informado. Los tamaños son relativos: **S** cambia presentación o contexto; **M** conecta varias pantallas/estados; **L** necesita paridad o agregación de fuentes. No son estimaciones de días. Los IDs son candidatos para una implementación posterior, no interruptores de producción ya instalados.

| Prioridad / ID / tamaño | Cambio observable | Capacidad que se reutiliza | Comprobación necesaria |
| --- | --- | --- | --- |
| Alta · U01 · M | **Generar desde esta carpeta.** Entrar por una obra/carpeta válida, elegir el documento y completar lo faltante. No volver a preguntar obra y destino conocidos. | `page-client.tsx` del generador ya lee `workId`, `folder` y `folderPath` cerca de la línea 1205. El detalle de obra ya tiene acceso a generación. | Una plantilla permite avanzar; varias requieren elegir; ninguna explica cómo resolver. Editar un generado conserva su ciclo de revisión. Prototipo 02. |
| Alta · U02 · M | **Consultar esta obra/carpeta.** Pregunta contextual, alcance visible y fuente a un clic. | ChatScope, ScopePicker, ScopeChips y consulta existente. Estado inicial normal vacío en `document-ai/page-client.tsx:72`. | El servidor valida el contexto; cambiar de empresa descarta IDs ajenos; cero documentos y cero evidencia tienen mensajes diferentes. Prototipo 03. |
| Alta · U03 · L | **Una sola entrada Documentos.** Documentos y Datos son vistas de la misma carpeta; desaparece la elección Legacy/New después de comprobar equivalencia. | Ambos gestores son consumidores vivos; `components/excel-page-tabs.tsx:8` los expone. New tiene OCR y edición; Legacy tiene acceso a reporte en `file-manager.tsx:4448`. | Matriz de paridad de abajo, enlaces antiguos y permisos. No borrar el gestor anterior como primer paso. Prototipo 01. |
| Alta · U04 · M | **Cargar → extraer → revisar en contexto.** Botón visible, destino, progreso por archivo y resultado junto al original. Una carga normal termina sin obligar a entrar en una tabla. | Acciones rápidas con stepper, `uploadFilesToCurrentFolder`, visor, datos extraídos y FormTable. | Lote parcial, extracción lenta, cero filas, reintento del archivo fallido y correcciones manuales. No afirmar guardado mientras hay un error. Prototipo 01. |
| Alta · U05 · M | **Guardar de forma coherente.** Una señal visible de cambios pendientes, guardado explícito y protección al salir. Mantener la edición de grilla para operaciones masivas. | Estado de cambios y guardado en General y FormTable. | Navegación interna, cambio de obra/pestaña y respuesta fallida. No recomendar autosave global sin resolver validaciones, conflictos y errores parciales. |
| Media · U06 · M | **Reporte listo para revisar.** Desde los datos, abrir un resumen útil, con alcance y vista guardada; el editor completo queda en Ajustar reporte. | ReportPage, presets, filtros, exportadores, enlace con vencimiento. | Mostrar registros incluidos, período, fuentes y qué queda accesible al compartir. CSV/PDF descargado no significa archivado. Prototipo 04. |
| Media · U07 · M | **Configurar con un ejemplo como entrada habitual.** Elegir datos sobre el ejemplo y revisar el registro resultante; columnas, grupos y modos bajo opciones avanzadas. | SampleAnalysisCard y `buildImportedDefinitionFromAnalysis`; ADR 0032. | Campos de documento frente a ítems, varias filas/tablas y alcance sobre obras existentes. El análisis de ejemplo ya existe; falta simplificar la exposición. Prototipo 05. |
| Media · U08 · L | **Mi trabajo con acciones concretas.** Reunir accesos a revisión, pendientes y seguimiento, explicando obra y motivo. | Notificaciones con `action_url`, pendientes, calendario y bandeja de revisión. | Identidad por tipo + ID; fuentes parcialmente fallidas; leído no resuelto; cada origen sigue autorizando su mutación. La agregación todavía hay que implementarla. Prototipo 06. |
| Media · U09 · S/M | **Navegación según trabajo.** Obras e Inicio siguen centrales. Reportes/vistas con nombres del cliente; Configuración agrupa modelo, columnas, personas e integraciones. Acciones de generar/consultar también viven dentro de la obra. | Arrays de navegación en `components/app-sidebar.tsx:96`, capacidades existentes y tablas fijadas en sidebar. | No esconder funciones necesarias al cambiar un rótulo. Conservar accesos permitidos y rutas directas. Evitar convertir Documentos en una biblioteca global sin construir esa consulta. |
| Media · U10 · S/M | **Documentos de empresa identificables.** Acceso claro a archivos comunes desde la navegación secundaria; encabezado dice Empresa o la obra concreta. | `companyFilesQuery` y carga en `app/dashboard/page.tsx:3181`; ADR 0018. | No mover archivos entre ámbitos automáticamente. Búsqueda global de todas las obras sería trabajo adicional, no algo ya resuelto por este listado. |
| Media · U11 · M | **Configurar recordatorios con una frase.** Qué recordar, cuándo y a quién; debajo, resumen de fecha y canal. El editor de Flujo queda para combinaciones avanzadas. | `tabs/flujo-tab.tsx:86`: inmediato, relativo y programado; calendario y canales existentes. | Fechas, zona horaria, destinatarios, evento de origen y comportamiento al cambiar la finalización. Un recordatorio no marca completada la obra. |
| Media · U12 · M | **Móvil centrado en abrir, cargar y consultar.** Lista legible, botón de carga sin arrastre obligatorio y documento/datos apilados. | `app/excel/mobile-excel-page-client.tsx` ya es una lista, no la grilla de escritorio reducida; visores y formularios existentes. | Tacto, cámara/selector de archivos real, teclado, permisos, scroll y devolución de WhatsApp al registro. No prometer captura offline: no se comprobó esa capacidad. |
| Baja · U13 · S | **Invitación con resumen de acceso y primera tarea.** Mostrar qué podrá hacer y destino inicial; recuperación de setup con instrucción concreta. | Invitación ya distingue Nivel de acceso y Trabajo que realizará, `invite-users-dialog.tsx:208`; blueprint y estados de provisión. | No duplicar la simplificación ya hecha ni colapsar nivel administrativo y roles operativos. Email distinto, expiración, denegaciones y preparación parcial. |
| Baja · U14 · M | **Siguiente acción por estado en pólizas/certificados.** Póliza: revisar, pedir baja, confirmar respuesta. Certificado: registrar, facturar, cobrar según sus campos reales. | Módulos y reglas existentes, `docs/domain/insurance-policies.md:7`. | Baja solicitada ≠ confirmada; saldo ≠ gasto indebido ni ahorro; recepción provisoria ≠ definitiva. No convertirlos en un único semáforo. |
| Baja · U15 · S/M | **Soporte junto al problema.** Error con siguiente paso; origen y auditoría en detalle; consumo de cuenta en administración; WhatsApp con resultado y destino de carga. | Papelera, auditoría, estados de billing, historial WhatsApp y links de documentos. | Error no se presenta como vacío. Confirmaciones conservan objeto y alcance; no convertir avisos técnicos en acciones que el usuario no puede ejecutar. |

Para iniciar una implementación real elegiría **U01 y U02**: permiten evaluar el valor de entrar desde la obra reutilizando contexto existente. Luego **U04 y U05**. **U03** tiene mucho valor, pero debe esperar una comparación de capacidades; suprimir una pestaña antes de esa revisión puede quitar funciones útiles.

## Antes de unificar los gestores

Esta es una matriz de salida, no una afirmación de equivalencia completa. La lectura confirma carga, OCR y datos en New; no confirma todos los casos con el backend funcionando.

| Capacidad | Evidencia / diferencia actual | Condición para ocultar la entrada anterior |
| --- | --- | --- |
| Subir en carpeta normal y OCR | New tiene función de carga, arrastre y progreso; su cabecera no ofrece el mismo acceso visible que Legacy | Botón + arrastre + estados accesibles en desktop y móvil |
| Ver original y datos | New consume DocumentSheet, DocumentDataSheet y FormTable de los componentes existentes | Mismo documento y origen al alternar vistas; errores separados de vacío |
| Reintentar / reprocesar | New usa OCR multi con `skipStorage=1` | Un archivo y lote, fallo parcial y conflictos; no duplicar binario por reintento |
| Reporte de la tabla | Acceso localizado en Legacy; New no tiene el mismo CTA en su cabecera | Preservar tabla de origen, filtros y acceso al reporte |
| XLSX/CSV y múltiples tablas | Documentado en el gestor y contratos de importación | Selección de hojas, confirmación de filas y archivo ya almacenado al cancelar |
| Papelera, restauración, descarga y organización | Existen rutas y acciones diferentes según gestor | Mismos permisos, vencimientos y contexto; no perder enlaces por mover archivos |
| Plantillas, generación, adjuntos y modelos 3D | Capacidades adyacentes al gestor | Accesos y tipos válidos; mantener visor específico donde corresponde |
| Enlaces profundos, tours y regreso | Las pestañas y parámetros actuales son distintos | Resolver URLs antiguas; conservar carpeta seleccionada y avisar sobre edición pendiente |

## Correcciones de documentación y hallazgos concretos

1. `docs/feature-capture-catalog.md` atribuye la carga/OCR solamente al gestor Legacy. `documents-new-tab.tsx` contiene `uploadFilesToCurrentFolder`, estados de extracción y reproceso. La limitación documental no debe convertirse en una feature supuestamente nueva. Se deja el ajuste del catálogo para la verificación de paridad sobre el checkout final.
2. En `document-ai/_components/scope-picker.tsx:80`, después de `isLoading`, se usa `foldersQuery.data ?? []` sin una rama de error. Una consulta fallida puede mostrarse como «Sin carpetas». Es un hallazgo de código específico: mostrar error/reintento en vez de vacío. No se ejecutó un fallo real del backend.
3. El walkthrough habla de una pestaña de tabla «Facturas», mientras la barra de obra leída muestra General, Pólizas, Flujo y los dos gestores. Hay que documentar el acceso por Documentos/Datos de la implementación elegida, no seguir instrucciones de una pestaña inexistente.
4. `OperationalWorkspace` tiene componentes para una pantalla operativa, pero la búsqueda de consumidores no lo conecta al dashboard publicado. No se presenta como una bandeja unificada ya implementada.
5. El catálogo enumera otros riesgos —ID temporal al crear obra, salida con cambios sin guardar y setup—. Aquí se consideran comprobaciones pendientes, no fallos reproducidos. Algunas partes del código ya cambiaron y requieren nueva evidencia.

## Cambios pequeños y comparables al integrar

Primero contrastar esta rama con la renovación visual en curso. No trasladar sus estilos antiguos a la app actual. Integrar un recorrido por vez, desde una base limpia acordada, manteniendo los endpoints y permisos actuales.

| Lote | Alcance | Activación / reversión | Prueba de aceptación |
| --- | --- | --- | --- |
| A | U01: acceso desde carpeta y selección contextual | Flag de presentación independiente, apagado por defecto; desactivar devuelve el acceso actual | Generar con 0/1/varias plantillas, contexto inválido y capacidades distintas; borrador conservado |
| B | U02: consulta contextual y error de alcance | Flag independiente; URL de chat global sigue disponible | La pregunta recibe el alcance correcto y las fuentes pertenecen a él; no ensanchar en un fallo |
| C | U04/U05: carga y revisión coherentes | Activar en el gestor elegido sin cambiar importadores | PDF normal/OCR, extracción lenta/parcial, corrección, error al guardar, salida con borrador |
| D | U03/U06: entrada documental y reporte | Solo después de paridad; URLs anteriores resuelven a un destino válido | Archivos, tablas múltiples, planillas, reporte, papelera, permisos y móvil |
| E | U07/U08 y restantes | Experimentos separados; configuración y agregación requieren diseño adicional | Impacto de defaults; deduplicación y estados por origen; fallos parciales visibles |

Los flags futuros solo eligen interfaz. Nunca sustituyen permisos de servidor, controles de tenant, validaciones o estados persistidos. Apagarlos no debe borrar datos. Si una propuesta exige una nueva entidad o estado compartido, deja de ser un simple experimento de presentación y necesita contrato de dominio, ADR y pruebas propias.

La opción «Existente» del laboratorio es un mapa textual respaldado por código; no es el frontend anterior montado dentro del prototipo. «Propuesta» es una simulación navegable. Esta separación permite discutir decisiones sin afirmar que la integración ya está hecha.

## Cómo decidir con el cliente

Probar tareas concretas con documentos de prueba: cargar y corregir una factura; generar una orden; ubicar el plazo contractual y mostrar su fuente; preparar un resumen de compras. Alternar el orden de las variantes entre participantes para reducir el efecto de aprendizaje. Los valores y respuestas del laboratorio son preparados, así que no sirven para medir precisión OCR/IA ni rendimiento de backend.

Registrar si terminó sin ayuda, qué decisiones no entendió, cuántas veces cambió de pantalla, si encontró el original y si reconoció cambios pendientes. Medir tiempo total y separar espera de procesamiento de tiempo de interacción. Comparar con la app actual en condiciones similares, sin inventar un porcentaje de mejora.

Para este cliente, mantendría una propuesta cuando resuelva la misma tarea con menos ayuda y sin perder trazabilidad, recuperación de errores o acceso a funciones habituales. La bandeja nueva y los cambios administrativos pueden esperar hasta comprobar que se usan con frecuencia.

## Validación y límites

El laboratorio tiene verificación ejecutable en `prototypes/user-flows/verify.cjs`. Se comprobaron 13 grupos: los seis recorridos y sus cinco estados, corrección conservada al alternar, cancelación de reinicio, contexto y fuentes, archivo CSV, vista de enlace, selección de campos, estados de revisión/baja, persistencia de interruptores, teclado y adaptación. Se inspeccionaron capturas de escritorio y móvil. Ver [resultados](../../prototypes/user-flows/verification/results.json).

La prueba usa Edge con Playwright y datos ficticios. No usa credenciales, ejecuta OCR, llama a WhatsApp, comparte reportes reales ni modifica registros de la empresa. No se ejecutó el lint/build completo de Next: no se alteró código de la app y el worktree no tiene dependencias instaladas. Se verificó sintaxis de los scripts y comportamiento real del artefacto en navegador.

No se modificaron documentos canónicos de dominio, ADRs ni el design system porque las propuestas aún no cambian comportamiento productivo. Las decisiones que se adopten deben actualizar sus documentos correspondientes al implementarse.

FigJam rechazó la lectura de Product OS y Journeys 03 por el límite de llamadas del plan Starter. Ningún board fue actualizado. El [pendiente de documentación visual](./figjam-simplification-pending.md) identifica destinos, flujos y capturas propuestos, siempre con estado Inbox.
