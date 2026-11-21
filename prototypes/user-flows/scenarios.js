// Descriptive alternatives, not production feature flags or new domain models.
export const scenarios = [
  {
    id: 'capture', number: '01', title: 'Cargar y revisar', short: 'Un documento, un recorrido', goal: 'Guardar una factura y corregir los datos extraídos sin buscar otra pantalla.',
    before: 'Obra → elegir gestor → carpeta → carga → documento / tabla.',
    after: 'Obra → cargar en Compras → revisar documento y datos → guardar.',
    current: [
      ['Abrir la obra', 'General ya ofrece acciones rápidas con pasos de carga y verificación.'],
      ['Elegir Documentos Legacy o Documentos New', 'Ambas pestañas están conectadas. New tiene carga por arrastre, OCR y vistas Archivos / Tabla.'],
      ['Entrar a la carpeta configurada', 'El método de entrada y las tablas asociadas determinan qué ocurre al cargar.'],
      ['Revisar documento y filas', 'Ya existen visores, datos extraídos, edición y reproceso; no todos los accesos están reunidos.']
    ],
    reuse: 'QuickActionsPanel, DocumentsNewTab, DocumentSheet, DocumentDataSheet, FormTable y endpoints de carga / filas existentes.',
    change: 'Una entrada Documentos; destino visible; carga accesible por botón; cierre de la carga con documento y datos. Requiere comprobar la paridad entre gestores antes de ocultar uno.',
    invariant: 'Subido ≠ extracción terminada. Guardar correcciones ≠ aprobar. Mantener origen, permisos, errores por archivo y conflictos de reimportación.',
    source: 'components/excel-page-tabs.tsx; components/quick-actions/quick-actions-panel.tsx; app/excel/[obraId]/tabs/documents-new-tab.tsx',
    empty: ['Todavía no hay documentos en Compras', 'La carpeta ya tiene definida la información que se extrae. Podés empezar con una factura.'],
    error: ['El archivo está guardado; la extracción falló', 'Reintentá la extracción de este archivo. No hace falta volver a subirlo.'],
    restricted: 'Podés consultar el documento. Tu acceso no permite subir archivos ni modificar datos.'
  },
  {
    id: 'generate', number: '02', title: 'Generar desde la obra', short: 'El contexto ya está elegido', goal: 'Preparar una orden de compra desde el lugar donde se va a guardar.',
    before: 'Generar documentos → obra / tipo / carpeta / plantilla → datos → generar.',
    after: 'Compras de esta obra → orden de compra → completar → generar.',
    current: [
      ['Entrar al generador', 'Existe un acceso global y un botón de generación desde la obra.'],
      ['Resolver obra, tipo, carpeta y plantilla', 'La pantalla ya admite workId y folder/folderPath por URL. No siempre hay que repetir la obra.'],
      ['Completar o asistir los datos', 'Hay formulario, vista de documento, borradores y plantillas.'],
      ['Generar y gestionar revisión', 'Los borradores privados y los documentos generados tienen permisos y ciclos distintos.']
    ],
    reuse: 'Contexto inicial del generador, bootstrap de plantillas, borradores privados, preview, generación y bandeja de revisión.',
    change: 'Acceso desde carpeta; opciones válidas por contexto; elegir automáticamente solo si hay una única plantilla compatible. Mostrar dónde se guarda y permitir cambiarlo.',
    invariant: 'La plantilla sigue siendo explícita cuando hay alternativas. No omitir revisión ni ampliar permisos; editar un generado puede devolverlo a revisión.',
    source: 'app/document-generation/page-client.tsx:1205; lib/document-generation-server.ts; app/excel/[obraId]/page-client.tsx',
    empty: ['No hay plantillas para esta carpeta', 'Un administrador puede configurar los documentos que se pueden generar aquí.'],
    error: ['No se pudo generar el documento', 'Conservá el borrador y reintentá. Todavía no hay un archivo generado.'],
    restricted: 'Tu acceso no permite generar documentos. Las plantillas y archivos disponibles conservan sus permisos.'
  },
  {
    id: 'ask', number: '03', title: 'Consultar esta obra', short: 'Pregunta con alcance visible', goal: 'Hacer una pregunta y abrir la fuente sin volver a seleccionar la obra.',
    before: 'Consultar documentos → seleccionar obras / carpetas → preguntar → fuentes.',
    after: 'Esta obra → preguntar → respuesta con fuente → abrir documento.',
    current: [
      ['Abrir Consultar documentos', 'Document AI tiene una entrada global en la navegación.'],
      ['Elegir el alcance', 'ScopePicker combina obras y carpetas; el estado inicial normal está vacío.'],
      ['Hacer una pregunta', 'El alcance se envía junto al mensaje.'],
      ['Consultar resultados y evidencia', 'La capacidad de consulta ya existe; la propuesta cambia el punto de entrada.']
    ],
    reuse: 'ChatScope, ScopePicker, ScopeChips, envío de mensajes y resultados del Document AI existente.',
    change: 'Entrada desde obra / carpeta con contexto prellenado; alcance siempre visible y editable; distinguir error de carga, ausencia de documentos y ausencia de evidencia.',
    invariant: 'Cambiar el rótulo no restringe datos: el servidor debe seguir validando tenant, obra y carpeta. No presentar una respuesta sin fuente como dato confirmado.',
    source: 'app/document-ai/page-client.tsx:72; app/document-ai/_components/scope-picker.tsx:80',
    empty: ['No hay documentos para consultar en esta obra', 'Cargá primero la documentación o elegí otra obra a la que tengas acceso.'],
    error: ['No pudimos cargar el alcance de la consulta', 'No cambiamos la búsqueda a todas las obras. Volvé a intentar cargar esta obra.'],
    restricted: 'La consulta de documentos no está habilitada para tu acceso.'
  },
  {
    id: 'report', number: '04', title: 'Preparar un reporte', short: 'Del dato al documento', goal: 'Compartir un resumen de compras sin configurar el taller de reportes cada vez.',
    before: 'Tabla o vista consolidada → reporte → filtros / columnas / preset → compartir.',
    after: 'Compras → resumen guardado → revisar alcance → exportar o compartir.',
    current: [
      ['Abrir la tabla o vista consolidada', 'MacroTable consolida registros entre obras y conserva sus orígenes.'],
      ['Abrir el reporte', 'Hay reportes de obras, certificados, tablas OCR y macros.'],
      ['Elegir ajustes o un preset', 'Ya existen presets, filtros, agrupación y columnas.'],
      ['Exportar o crear enlace', 'El reporte admite exportación y enlace con vencimiento. Descargar no lo archiva en Documentos.']
    ],
    reuse: 'ReportPage, configuraciones OCR/macro, presets, exportación y share endpoint existentes.',
    change: 'Resumen útil por defecto y vistas guardadas con nombres de tarea; confirmar alcance y vencimiento junto a Compartir; configuración completa en Ajustar reporte.',
    invariant: 'Indicar filas filtradas frente al total. Preservar procedencia y overrides de macro. No confundir enlace compartido, archivo descargado y documento archivado.',
    source: 'components/report/report-page.tsx:610; app/macro/macro-page-client.tsx; components/report/builders/ocr-report-config.ts',
    empty: ['No hay compras en el período elegido', 'Cambiá el período o revisá los documentos cargados antes de exportar.'],
    error: ['No pudimos preparar el reporte', 'Se conservan el período y las columnas elegidas. Podés reintentar.'],
    restricted: 'Podés ver este resumen. Tu acceso no permite crear enlaces compartidos.'
  },
  {
    id: 'configure', number: '05', title: 'Configurar con un ejemplo', short: 'Datos primero, estructura después', goal: 'Decir qué información guardar sin empezar por columnas, grupos y métodos de entrada.',
    before: 'Modelo de obras → carpeta / tabla → ejemplo / esquema → opciones de extracción.',
    after: 'Documento de ejemplo → elegir datos → probar resultado → confirmar destino.',
    current: [
      ['Abrir Modelo de obras', 'La configuración reúne carpetas, tablas, entradas y acciones rápidas.'],
      ['Analizar un ejemplo', 'SampleAnalysisCard ya ofrece esta capacidad; no es una nueva función de IA.'],
      ['Editar campos y grupos', 'Se exponen columnas, modo de filas, extracción OCR/manual/ambos y alcance parent/item.'],
      ['Guardar el modelo', 'Debe explicarse el alcance de aplicación a obras existentes y nuevas.']
    ],
    reuse: 'SampleAnalysisCard, buildImportedDefinitionFromAnalysis, configuración y previsualización de extracción.',
    change: 'Hacer del ejemplo la entrada habitual. Campos técnicos en opciones avanzadas; vista previa de filas y alcance antes de guardar.',
    invariant: 'No prometer aprendizaje automático a partir de correcciones. Respetar tablas múltiples, campos de cabecera / detalle y políticas para obras existentes.',
    source: 'app/admin/obra-defaults/page.tsx; docs/adr/0032-sample-first-folder-extraction-setup.md',
    empty: ['Todavía no hay un ejemplo', 'Usá un documento representativo para elegir qué datos guardar.'],
    error: ['No se pudo analizar el ejemplo', 'Podés reintentar o conservar la configuración actual. No aplicamos cambios al modelo.'],
    restricted: 'Solo quienes administran el modelo de obras pueden cambiar esta configuración.'
  },
  {
    id: 'inbox', number: '06', title: 'Atender pendientes', short: 'Cada aviso lleva a una acción', goal: 'Entender qué falta hacer y abrir el registro correcto desde el inicio.',
    before: 'Inicio / Notificaciones / Revisión / Flujo → identificar la tarea → abrir registro.',
    after: 'Pendiente con motivo y obra → abrir tarea → resolver → volver.',
    current: [
      ['Revisar Inicio o Notificaciones', 'Hay indicadores, notificaciones, pendientes y calendario.'],
      ['Distinguir qué tipo de aviso es', 'El registro leído, la tarea pendiente y el documento en revisión no comparten estado.'],
      ['Abrir el destino', 'Las notificaciones tienen action_url y hay una bandeja de revisión de documentos.'],
      ['Actuar en la pantalla responsable', 'Las reglas de Flujo incluyen ejecución inmediata, relativa y programada.']
    ],
    reuse: 'Notificaciones con action_url, obra_pendientes, calendario, revisión y reglas de Flujo existentes.',
    change: 'Vista inicial por tarea con origen, responsable cuando exista y acción concreta. Unificar presentación antes de crear otra entidad de tareas.',
    invariant: 'Leído ≠ resuelto. No deduplicar por título: conservar tipo e ID de origen. Unificar fuentes requiere consultas y reglas, no solo un nuevo componente.',
    source: 'app/notifications/page.tsx; app/notifications/_components/notifications-table.tsx:301; app/excel/[obraId]/tabs/flujo-tab.tsx',
    empty: ['No hay tareas pendientes en este alcance', 'Las notificaciones leídas y el calendario siguen disponibles.'],
    error: ['No pudimos cargar todos los pendientes', 'No mostramos una bandeja vacía como si estuviera al día. Volvé a intentar.'],
    restricted: 'Este pendiente requiere un permiso que tu usuario no tiene. Podés consultar su estado.'
  }
];
