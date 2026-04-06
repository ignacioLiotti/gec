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
