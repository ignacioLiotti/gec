import type { WizardFlow } from "@/components/ui/contextual-wizard";

export const dashboardOverviewTour: WizardFlow = {
	id: "dashboard-overview",
	title: "Tour del dashboard",
	steps: [
		{
			id: "header",
			targetId: "dashboard-header",
			title: "Tu cartera de obras, de un vistazo",
			content:
				"Acá ves el estado actual de toda la cartera: obras activas, alertas importantes y los números que más importan. Sin navegar ni abrir nada.",
			placement: "bottom",
		},
		{
			id: "stats",
			targetId: "dashboard-stats",
			title: "Los indicadores que más usás",
			content:
				"Obras activas, certificados del mes y avance promedio. Estos números te dicen en segundos si todo va bien o si hay algo que requiere atención.",
			placement: "bottom",
		},
		{
			id: "recent-obras",
			targetId: "dashboard-recent-obras",
			title: "Tus obras más recientes",
			content:
				"Las últimas obras que trabajaste aparecen acá. Hacé clic en cualquiera para entrar directo al detalle: datos financieros, avance, documentos y más.",
			placement: "right",
		},
		{
			id: "preview",
			targetId: "dashboard-preview",
			title: "El estado de una obra, sin entrar al detalle",
			content:
				"Desde el dashboard ya ves el avance real vs el plan, los importes clave y el tiempo transcurrido. Suficiente para saber si la obra está encaminada.",
			placement: "left",
		},
	],
};

export const excelOverviewTour: WizardFlow = {
	id: "excel-overview",
	title: "Tour del panel de obras",
	steps: [
		{
			id: "header",
			targetId: "excel-page-header",
			title: "Todas tus obras en un solo lugar",
			content:
				"Acá está la cartera completa. Cada fila es una obra y las columnas se configuran para cada empresa: mostrás solo lo que necesitás, en el orden que querés.",
			placement: "bottom",
		},
		{
			id: "toolbar",
			targetId: "excel-page-toolbar",
			title: "Buscá o filtrá lo que necesitás",
			content:
				"Filtrá por entidad, fechas o importes. También podés buscar una obra por nombre y exportar la tabla completa a Excel desde acá.",
			placement: "bottom",
		},
		{
			id: "content",
			targetId: "excel-page-table",
			title: "La vista de toda tu cartera",
			content:
				"Una fila por obra, con las columnas más importantes a la vista. Ideal para controlar el estado de toda la cartera de un solo vistazo.",
			placement: "top",
			allowClickThrough: true,
		},
		{
			id: "open-obra",
			targetId: "excel-page-open-obra",
			title: "Abrí una obra para ver el detalle",
			content:
				"Hacé clic en el nombre de cualquier obra para entrar a su página completa con todos sus datos, certificados y documentos.",
			placement: "left",
			requiredAction: "click_target",
			waitForMs: 1500,
		},
	],
};

export const obraOverviewTour: WizardFlow = {
	id: "obra-overview",
	title: "Tour de la obra",
	steps: [
		{
			id: "tabs",
			targetId: "obra-page-tabs",
			title: "General, Flujo y Documentos",
			content:
				"Toda la información de esta obra está en tres pestañas. General tiene los datos y el avance. Flujo muestra el proceso. Documentos tiene todos los archivos cargados.",
			placement: "bottom",
		},
		{
			id: "content",
			targetId: "obra-page-content",
			title: "Todo lo de la obra, acá",
			content:
				"Datos financieros, avance, curva y alertas activas. Lo que necesitás para tomar decisiones sobre esta obra, todo en un solo lugar.",
			placement: "top",
		},
		{
			id: "documents",
			targetId: "obra-page-file-manager-tab",
			title: "Documentos: subí, procesá y revisá",
			content:
				"Hacé clic en Documentos para ver las carpetas de la obra, subir archivos y dejar que el sistema extraiga los datos automáticamente.",
			placement: "bottom",
			allowClickThrough: true,
			requiredAction: "click_target",
			fallback: "continue",
			waitForMs: 2500,
		},
	],
};

export const documentosOverviewTour: WizardFlow = {
	id: "documentos-overview",
	title: "Tour de documentos",
	steps: [
		{
			id: "sidebar",
			targetId: "documents-sidebar",
			title: "Las carpetas de la obra",
			content:
				"A la izquierda están todas las carpetas: Certificados, Curva de Avance, Órdenes de Compra y Fotos. Hacé clic en cualquiera para ver lo que ya tiene cargado.",
			placement: "bottom",
		},
		{
			id: "loaded-documents",
			targetId: "documents-loaded-files",
			title: "Estos archivos ya están procesados",
			content:
				"Estos documentos ya fueron subidos y el sistema los procesó automáticamente. Podés abrirlos para ver los datos que extrajo.",
			placement: "left",
			fallback: "continue",
			waitForMs: 1800,
		},
		{
			id: "dropzone",
			targetId: "documents-dropzone",
			title: "Cargá archivos nuevos acá",
			content:
				"Arrastrá un PDF o imagen acá para subirlo. El sistema lo procesa, extrae los datos y los guarda en la tabla de la carpeta correspondiente.",
			placement: "top",
			allowClickThrough: true,
		},
	],
};

export const macroOverviewTour: WizardFlow = {
	id: "macro-overview",
	title: "Recorrido guiado",
	steps: [
		{
			id: "table",
			targetId: "macro-page-table",
			title: "Gastos de todas las obras, en una sola tabla",
			content:
				"Cada fila viene de una orden de compra distinta, de obras distintas. Esta tabla las reúne automáticamente para que puedas analizar el gasto total sin armar ninguna planilla.",
			placement: "top",
			skippable: false,
		},
		{
			id: "generar-reporte",
			targetId: "macro-generar-reporte",
			title: "Convertilo en un reporte",
			content:
				"Hacé clic para ver estos mismos datos en formato reporte, listo para descargar como PDF o Excel y compartirlo con quien necesitás.",
			placement: "left",
			allowClickThrough: true,
			requiredAction: "click_target",
			skippable: false,
		},
	],
};

/* ------------------------------------------------------------------ */
/*  Presentación completa (~5 minutos)                                  */
/*                                                                      */
/*  Cadena de tours que recorre toda la aplicación, pensada para una    */
/*  presentación rápida a clientes:                                     */
/*    /dashboard?tour=demo-dashboard                                    */
/*      → /excel?tour=demo-cartera                                      */
/*      → /excel/[obraId]?tour=demo-obra        (clic en una obra)      */
/*      → tab Documentos, tour=demo-documentos  (clic en la pestaña)    */
/*      → /macro?tour=demo-macro                                        */
/*      → /macro/[id]/reporte?tour=demo-reporte (clic en Generar)       */
/*      → /dashboard?tour=demo-cierre                                   */
/* ------------------------------------------------------------------ */

export const presentacionDashboardTour: WizardFlow = {
	id: "demo-dashboard",
	title: "Síntesis · 1 de 7",
	steps: [
		{
			id: "bienvenida",
			targetId: "dashboard-header",
			title: "Bienvenido a Síntesis",
			content:
				"Síntesis centraliza la gestión de obras de construcción: cartera, certificados, documentos y reportes en un solo lugar. Este es el panel de control, lo primero que ves al entrar: el estado de toda la empresa de un vistazo.",
			placement: "bottom",
		},
		{
			id: "stats",
			targetId: "dashboard-stats",
			title: "Los números que importan, siempre al día",
			content:
				"Obras activas, certificados del mes y avance promedio. Estos indicadores se actualizan solos con cada dato que se carga: en segundos sabés si todo va bien o si algo necesita atención.",
			placement: "bottom",
		},
		{
			id: "recent-obras",
			targetId: "dashboard-recent-obras",
			title: "Tus obras más recientes",
			content:
				"Las últimas obras trabajadas aparecen acá, listas para retomar. Un clic y estás dentro del detalle completo.",
			placement: "right",
		},
		{
			id: "preview",
			targetId: "dashboard-preview",
			title: "El estado de una obra, sin entrar al detalle",
			content:
				"Avance real contra el plan, importes clave y tiempo transcurrido. Muchas decisiones se toman desde acá, sin abrir nada más. Ahora veamos de dónde salen estos datos: la cartera de obras.",
			placement: "left",
		},
	],
};

export const presentacionCarteraTour: WizardFlow = {
	id: "demo-cartera",
	title: "Síntesis · 2 de 7",
	steps: [
		{
			id: "header",
			targetId: "excel-page-header",
			title: "Toda la cartera en una sola planilla",
			content:
				"Esta vista reemplaza el Excel que la empresa venía usando: cada fila es una obra y las columnas se configuran a medida. La diferencia es que acá los datos se actualizan solos a partir de los documentos que se cargan.",
			placement: "bottom",
		},
		{
			id: "toolbar",
			targetId: "excel-page-toolbar",
			title: "Buscá, filtrá y exportá",
			content:
				"Filtrás por entidad, fechas o importes, buscás una obra por nombre y, si lo necesitás, exportás la tabla completa a Excel. Nadie pierde la planilla: la planilla ahora vive acá.",
			placement: "bottom",
		},
		{
			id: "table",
			targetId: "excel-page-table",
			title: "Control de toda la cartera de un vistazo",
			content:
				"Avance, importes, certificados y fechas de cada obra, en una sola pantalla. Lo que antes era consolidar planillas a mano, acá ya está consolidado.",
			placement: "top",
			allowClickThrough: true,
		},
		{
			id: "open-obra",
			targetId: "excel-page-open-obra",
			title: "Entremos a una obra",
			content:
				"Hacé clic en el nombre de la obra para ver su ficha completa: datos financieros, avance, alertas y documentos.",
			placement: "left",
			requiredAction: "click_target",
			waitForMs: 2000,
		},
	],
};

export const presentacionObraTour: WizardFlow = {
	id: "demo-obra",
	title: "Síntesis · 3 de 7",
	steps: [
		{
			id: "tabs",
			targetId: "obra-page-tabs",
			title: "La ficha completa de la obra",
			content:
				"Todo lo de esta obra vive en estas pestañas: General tiene los datos y el avance, Flujo muestra el proceso de certificación y Documentos guarda todos los archivos.",
			placement: "bottom",
		},
		{
			id: "content",
			targetId: "obra-page-content",
			title: "Datos financieros y avance, en un solo lugar",
			content:
				"Montos de contrato, certificado a la fecha, redeterminaciones y plazos. Lo que necesitás para tomar decisiones sobre esta obra, sin buscar en carpetas ni planillas.",
			placement: "top",
		},
		{
			id: "findings",
			targetId: "obra-general-findings",
			title: "El sistema avisa qué falta",
			content:
				"Estas alertas se generan solas: si falta el certificado del mes o un dato clave, Síntesis lo detecta y lo marca. Nadie tiene que acordarse de revisar obra por obra.",
			placement: "bottom",
			fallback: "continue",
			waitForMs: 2500,
		},
		{
			id: "curva",
			targetId: "obra-curva-avance",
			title: "Curva de avance: real contra plan",
			content:
				"La curva compara el avance certificado con el planificado. Si la obra se atrasa, se ve acá antes de que sea un problema.",
			placement: "top",
			fallback: "continue",
			waitForMs: 2500,
		},
		{
			id: "go-documents",
			targetId: "obra-page-file-manager-tab",
			title: "Ahora, la parte que más tiempo ahorra",
			content:
				"Hacé clic en Documentos para ver cómo se cargan los archivos y cómo el sistema extrae los datos automáticamente.",
			placement: "bottom",
			allowClickThrough: true,
			requiredAction: "click_target",
			fallback: "continue",
			waitForMs: 2500,
		},
	],
};

export const presentacionDocumentosTour: WizardFlow = {
	id: "demo-documentos",
	title: "Síntesis · 4 de 7",
	steps: [
		{
			id: "sidebar",
			targetId: "documents-sidebar",
			title: "Una carpeta por tipo de documento",
			content:
				"Certificados, curvas de avance, órdenes de compra, pólizas, fotos. Cada carpeta sabe qué tipo de documento recibe y qué datos hay que extraerle.",
			placement: "bottom",
		},
		{
			id: "loaded",
			targetId: "documents-loaded-files",
			title: "Estos archivos ya fueron procesados",
			content:
				"Cada documento subido queda guardado y procesado: el sistema leyó el PDF y extrajo los datos a una tabla. Podés abrir cualquiera para ver el original junto a lo que se extrajo.",
			placement: "left",
			fallback: "continue",
			waitForMs: 2000,
		},
		{
			id: "dropzone",
			targetId: "documents-dropzone",
			title: "Arrastrás el PDF y el sistema hace el resto",
			content:
				"Acá está el corazón de Síntesis: soltás un certificado o una factura y la IA extrae montos, fechas e ítems, y actualiza la obra y los indicadores. Sin tipeo manual y sin errores de carga. Ahora veamos qué pasa cuando juntamos los datos de todas las obras.",
			placement: "top",
			allowClickThrough: true,
		},
	],
};

export const presentacionMacroTour: WizardFlow = {
	id: "demo-macro",
	title: "Síntesis · 5 de 7",
	steps: [
		{
			id: "header",
			targetId: "macro-page-header",
			title: "Tablas consolidadas entre obras",
			content:
				"Las macro tablas cruzan datos de todas las obras automáticamente. El consolidado que antes llevaba días de copiar y pegar, acá ya existe y se mantiene solo.",
			placement: "bottom",
			fallback: "continue",
			waitForMs: 2000,
		},
		{
			id: "table",
			targetId: "macro-page-table",
			title: "Cada fila viene de un documento real",
			content:
				"Estas filas salen de órdenes de compra y certificados de obras distintas. Se puede analizar el gasto total de la empresa por proveedor, por material o por obra, sin armar ninguna planilla.",
			placement: "top",
		},
		{
			id: "generar-reporte",
			targetId: "macro-generar-reporte",
			title: "Convirtamos esto en un reporte",
			content:
				"Hacé clic en Generar reporte para ver estos datos en un formato listo para presentar y compartir.",
			placement: "left",
			allowClickThrough: true,
			requiredAction: "click_target",
		},
	],
};

export const presentacionReporteTour: WizardFlow = {
	id: "demo-reporte",
	title: "Síntesis · 6 de 7",
	steps: [
		{
			id: "preview",
			targetId: "report-preview-area",
			title: "Listo para presentar",
			content:
				"Los mismos datos, ahora en formato reporte: con membrete, agrupado y totalizado. Lo que ves acá es exactamente lo que se exporta.",
			placement: "left",
			waitForMs: 3500,
		},
		{
			id: "config",
			targetId: "report-config-columns",
			title: "Cada reporte se arma a medida",
			content:
				"Elegís qué columnas mostrar, cómo agrupar y qué totales calcular. La configuración queda guardada para la próxima vez.",
			placement: "left",
			fallback: "continue",
			waitForMs: 2000,
		},
		{
			id: "export",
			targetId: "report-export-actions",
			title: "PDF para compartir, Excel para seguir trabajando",
			content:
				"Un clic y el reporte sale en PDF para enviar, o en Excel para seguir analizando los números. Con esto cerramos el recorrido.",
			placement: "bottom",
			fallback: "continue",
			waitForMs: 2000,
		},
	],
};

export const presentacionCierreTour: WizardFlow = {
	id: "demo-cierre",
	title: "Síntesis · 7 de 7",
	steps: [
		{
			id: "recap",
			targetId: "dashboard-header",
			title: "Eso es Síntesis: el ciclo completo",
			content:
				"Viste el recorrido entero: la cartera de obras siempre al día, la ficha de cada obra con sus alertas, los documentos que se procesan solos, los datos consolidados entre obras y los reportes listos para compartir. Todo conectado: cargás un documento una vez y se actualiza todo lo demás.",
			placement: "bottom",
			skippable: false,
			waitForMs: 2500,
		},
		{
			id: "y-hay-mas",
			targetId: "dashboard-stats",
			title: "Y hay más",
			content:
				"Síntesis también incluye roles y permisos por usuario, notificaciones automáticas, asistente de consultas sobre documentos con IA, generación de documentos a partir de plantillas y configuración a medida de cada empresa. Cuando quieran, lo vemos en profundidad con sus propios datos.",
			placement: "bottom",
			skippable: false,
			waitForMs: 1500,
		},
	],
};

export const demoConclusionTour: WizardFlow = {
	id: "demo-conclusion",
	title: "Recorrido guiado",
	steps: [
		{
			id: "dashboard-overview",
			targetId: "dashboard-header",
			title: "Tu cartera, siempre a la vista",
			content:
				"El dashboard muestra el estado de todas las obras en segundos: avance, alertas y certificados recientes, sin abrir nada. Es el punto de partida para el trabajo diario.",
			placement: "bottom",
			skippable: false,
			waitForMs: 2000,
		},
		{
			id: "conclusion",
			targetId: "dashboard-stats",
			title: "Eso fue lo más importante",
			content:
				"Viste la cartera de obras, la carga de documentos con extracción automática de datos y los reportes consolidados. Síntesis tiene mucho más: reglas de color personalizadas, roles de usuario, notificaciones y configuración por empresa. Cuando quieras profundizar, estamos.",
			placement: "bottom",
			skippable: false,
			waitForMs: 1500,
		},
	],
};
