import type { DemoFlowDefinition } from "@/lib/demo-flows/types";

const defaultOverviewFlow: DemoFlowDefinition = {
	id: "default-overview",
	eyebrow: "Recorrido recomendado",
	title: "Explorar Sintesis",
	description:
		"Este flujo presenta la demo usando las pantallas reales del producto. Sirve como base para cualquier prospecto y se puede complementar con variantes por empresa.",
	steps: [
		{
			id: "dashboard",
			title: "Panorama general",
			description:
				"Empieza por el dashboard para ver la organizacion demo y los indicadores principales.",
			ctaLabel: "Abrir dashboard guiado",
			href: "/dashboard?tour=dashboard-overview",
		},
		{
			id: "excel",
			title: "Operacion en Excel",
			description:
				"Revisa obras, carpetas y la experiencia principal de trabajo en Excel con la configuracion del tenant.",
			ctaLabel: "Abrir Excel guiado",
			href: "/excel?tour=excel-overview",
		},
		{
			id: "macro",
			title: "Macro tablas",
			description:
				"Consulta tablas consolidadas, filtros y reportes de datos agregados sin salir de la demo.",
			ctaLabel: "Abrir Macro Tablas guiado",
			href: "/macro?tour=macro-overview",
		},
	],
};

export const demoFlowRegistry: Record<string, DemoFlowDefinition> = {
	[defaultOverviewFlow.id]: defaultOverviewFlow,
};

export const DEFAULT_DEMO_FLOW_ID = defaultOverviewFlow.id;
