import type { WizardFlow } from "@/components/ui/contextual-wizard";

export const dashboardOverviewTour: WizardFlow = {
	id: "dashboard-overview",
	title: "Tour del dashboard",
	steps: [
		{
			id: "header",
			targetId: "dashboard-header",
			title: "Resumen ejecutivo",
			content:
				"Este bloque presenta el dashboard como punto de entrada para la demo. Desde aqui ubicas rapidamente el estado general de la cartera.",
			placement: "bottom",
		},
		{
			id: "stats",
			targetId: "dashboard-stats",
			title: "Metricas clave",
			content:
				"Aqui se condensan los indicadores mas relevantes para validar si la organizacion tiene la visibilidad que necesita.",
			placement: "bottom",
		},
		{
			id: "recent-obras",
			targetId: "dashboard-recent-obras",
			title: "Acceso rapido a obras",
			content:
				"La lista de obras recientes es la salida natural hacia el trabajo operativo dentro de Excel.",
			placement: "right",
		},
		{
			id: "preview",
			targetId: "dashboard-preview",
			title: "Preview de una obra",
			content:
				"Esta vista previa mezcla avance, tiempo y curva para mostrar el valor del seguimiento sin entrar todavia al detalle.",
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
			title: "Panel principal",
			content:
				"Esta pantalla concentra la tabla principal configurable por tenant y sirve como entrada al trabajo diario.",
			placement: "bottom",
		},
		{
			id: "toolbar",
			targetId: "excel-page-toolbar",
			title: "Busqueda y filtros",
			content:
				"Desde la barra de herramientas se aplican filtros, busquedas y acciones sobre la tabla principal.",
			placement: "bottom",
		},
		{
			id: "content",
			targetId: "excel-page-table",
			title: "La tabla, sin complicarla",
			content:
				"Piensala como la vista operativa madre: cada fila es una obra y cada columna resume algo importante. En cada demo podemos precargar columnas, orden y reglas segun la empresa.",
			placement: "top",
			allowClickThrough: true,
		},
		{
			id: "open-obra",
			targetId: "excel-page-open-obra-cta",
			title: "Entrar al detalle de una obra",
			content:
				"Ahora entra a una obra concreta. Usa este acceso para abrir una obra y seguimos el recorrido dentro de su pagina de detalle.",
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
			title: "Secciones de la obra",
			content:
				"Desde estas tabs navegas entre General, Flujo y Documentos sin salir del contexto de esta obra.",
			placement: "bottom",
		},
		{
			id: "content",
			targetId: "obra-page-content",
			title: "Espacio de trabajo",
			content:
				"Aqui ves el detalle real de la obra. La pestaña activa define si estas revisando datos, flujo operativo o documentos.",
			placement: "top",
		},
		{
			id: "documents",
			targetId: "obra-page-file-manager-tab",
			title: "Continuar al flujo documental",
			content:
				"Para ver la parte de carga, OCR y extraccion, hace clic en Documentos. Ese es el mejor siguiente paso para la demo.",
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
			title: "Mapa documental de la obra",
			content:
				"Este panel organiza carpetas y tablas de datos. Desde aca se navega lo ya cargado y se entra al flujo documental sin salir de la obra.",
			placement: "right",
		},
		{
			id: "loaded-documents",
			targetId: "documents-loaded-files",
			title: "Documentos ya cargados",
			content:
				"En esta zona se ven los archivos ya disponibles para la obra. La idea de la demo es que el prospecto vea que no parte de cero: ya hay documentacion lista para revisar.",
			placement: "left",
			fallback: "continue",
			waitForMs: 1800,
		},
		{
			id: "dropzone",
			targetId: "documents-dropzone",
			title: "Carga rapida por arrastre",
			content:
				"Tambien podes arrastrar archivos aca o usar el selector de carga. Ese gesto dispara el flujo real de subida para seguir con OCR o gestion documental.",
			placement: "top",
			allowClickThrough: true,
		},
	],
};

export const macroOverviewTour: WizardFlow = {
	id: "macro-overview",
	title: "Tour de macro tablas",
	steps: [
		{
			id: "header",
			targetId: "macro-page-header",
			title: "Panel consolidado",
			content:
				"Macro Tablas es la vista agregada para seguimiento transversal. Sirve para mostrar el valor del producto sin navegar obra por obra.",
			placement: "bottom",
		},
		{
			id: "tabs",
			targetId: "macro-page-tabs",
			title: "Cambio de macro tabla",
			content:
				"Cada tab representa una consolidacion distinta. En demos futuras podemos priorizar solo las que le importan al prospecto.",
			placement: "bottom",
		},
		{
			id: "toolbar",
			targetId: "macro-page-toolbar",
			title: "Filtros y acciones",
			content:
				"El toolbar concentra filtros, busqueda y acciones de lectura para explorar grandes volumenes de datos.",
			placement: "bottom",
		},
		{
			id: "table",
			targetId: "macro-page-table",
			title: "Lectura consolidada",
			content:
				"Esta tabla unifica fuentes de multiples obras y permite bajar desde el consolidado hacia el detalle operativo.",
			placement: "top",
		},
	],
};
