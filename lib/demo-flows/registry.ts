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

const presentacionCompletaFlow: DemoFlowDefinition = {
	id: "presentacion-completa",
	eyebrow: "Presentación guiada",
	title: "Síntesis, explicado en 5 minutos",
	description:
		"Un recorrido guiado por toda la aplicación, pensado para una presentación rápida: del panel de control a la cartera de obras, el detalle de una obra, la carga de documentos con extracción automática de datos, las tablas consolidadas y los reportes listos para compartir.",
	features: [
		"Panel de control con los indicadores de toda la empresa",
		"Cartera de obras completa, editable y exportable",
		"Ficha de cada obra con avance, alertas y curva real vs plan",
		"Documentos que se procesan solos: la IA extrae los datos del PDF",
		"Tablas consolidadas entre obras y reportes en PDF o Excel",
	],
	steps: [
		{
			id: "dashboard",
			title: "Empezar la presentación",
			description: "",
			ctaLabel: "Empezar la presentación",
			href: "/dashboard?tour=demo-dashboard",
		},
	],
};

export const demoFlowRegistry: Record<string, DemoFlowDefinition> = {
	[defaultOverviewFlow.id]: defaultOverviewFlow,
	[presentacionCompletaFlow.id]: presentacionCompletaFlow,
};

export const DEFAULT_DEMO_FLOW_ID = defaultOverviewFlow.id;

export const PRESENTACION_COMPLETA_FLOW_ID = presentacionCompletaFlow.id;

/** Flujos disponibles cuando el tenant no configuró `enabledFlowIds`. */
export const DEFAULT_ENABLED_DEMO_FLOW_IDS = [
	defaultOverviewFlow.id,
	presentacionCompletaFlow.id,
];
