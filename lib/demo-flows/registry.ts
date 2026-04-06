import type { DemoFlowDefinition } from "@/lib/demo-flows/types";

const defaultOverviewFlow: DemoFlowDefinition = {
	id: "default-overview",
	eyebrow: "Recorrido guiado",
	title: "Síntesis en acción",
	description:
		"En los próximos minutos vas a ver cómo Síntesis centraliza la gestión de obras de construcción. Todo lo que ves —obras, certificados, documentos y reportes— funciona igual en un entorno real.",
	features: [
		"Panel de obras con avance, importes y certificados al día",
		"Carga de documentos con extracción automática de datos",
		"Alertas automáticas cuando falta información",
		"Tablas consolidadas y reportes exportables en PDF o Excel",
	],
	steps: [
		{
			id: "excel",
			title: "Empezar el recorrido",
			description: "",
			ctaLabel: "Empezar",
			href: "/excel?tour=excel-overview",
		},
	],
};

export const demoFlowRegistry: Record<string, DemoFlowDefinition> = {
	[defaultOverviewFlow.id]: defaultOverviewFlow,
};

export const DEFAULT_DEMO_FLOW_ID = defaultOverviewFlow.id;
