import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import "../preview.css";

import DashboardHome, { type DashboardDemoData } from "@/app/dashboard/page";
import {
	OperationalWorkspace,
	type OperationalWorkspaceData,
} from "@/app/dashboard/_components/operational-workspace";
import ExcelPageClient from "@/app/excel/excel-page-client";
import {
	DataFlowPageClient,
	type DataFlowConfigPayload,
} from "@/app/excel/[obraId]/data-flow/page-client";
import ObraDetailPage from "@/app/excel/[obraId]/page-client";
import type { Obra } from "@/app/excel/schema";
import {
	BUILDER_PRESET_TABLE_SOURCE_IDS,
	DEFAULT_OBRA_FIELD_SOURCES,
	getTenantDataFlowBuilderConfig,
} from "@/lib/data-flow-builder";
import type {
	ExcelPageMainTableColumnConfig,
	ExcelPageObra,
} from "@/lib/excel/types";
import type { GeneralTabReportsData } from "@/lib/obra-queries";
import { OcrReviewWorkspace } from "../_components/ocr-review-workspace";

export const metadata: Metadata = {
	title: "Síntesis product preview",
	robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const portfolioObras = [
	{
		id: "10000000-0000-4000-8000-000000000024",
		n: 24,
		designacionYUbicacion: "Torre Madero · Dique 2",
		supDeObraM2: 18600,
		entidadContratante: "Arqline Desarrollos",
		mesBasicoDeContrato: "Enero 2025",
		iniciacion: "2025-02-03",
		contratoMasAmpliaciones: 4820000000,
		certificadoALaFecha: 3140000000,
		saldoACertificar: 1680000000,
		segunContrato: 540,
		prorrogasAcordadas: 24,
		plazoTotal: 564,
		plazoTransc: 328,
		porcentaje: 68.4,
		customData: { especialidad: "Arquitectura" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000019",
		n: 19,
		designacionYUbicacion: "Distrito Norte · Etapa II",
		supDeObraM2: 12400,
		entidadContratante: "Brava Urbanismo",
		mesBasicoDeContrato: "Agosto 2024",
		iniciacion: "2024-09-16",
		contratoMasAmpliaciones: 3270000000,
		certificadoALaFecha: 2740000000,
		saldoACertificar: 530000000,
		segunContrato: 420,
		prorrogasAcordadas: 0,
		plazoTotal: 420,
		plazoTransc: 352,
		porcentaje: 84.1,
		customData: { especialidad: "Arquitectura" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000031",
		n: 31,
		designacionYUbicacion: "Campus Río · Pabellón Central",
		supDeObraM2: 9200,
		entidadContratante: "Lumen Educación",
		mesBasicoDeContrato: "Marzo 2026",
		iniciacion: "2026-04-01",
		contratoMasAmpliaciones: 1980000000,
		certificadoALaFecha: 614000000,
		saldoACertificar: 1366000000,
		segunContrato: 360,
		prorrogasAcordadas: 0,
		plazoTotal: 360,
		plazoTransc: 108,
		porcentaje: 31,
		customData: { especialidad: "Vial" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000014",
		n: 14,
		designacionYUbicacion: "Centro Cívico 14",
		supDeObraM2: 7400,
		entidadContratante: "Terranova SA",
		mesBasicoDeContrato: "Noviembre 2025",
		iniciacion: "2025-12-10",
		contratoMasAmpliaciones: 1740000000,
		certificadoALaFecha: 912000000,
		saldoACertificar: 828000000,
		segunContrato: 390,
		prorrogasAcordadas: 15,
		plazoTotal: 405,
		plazoTransc: 268,
		porcentaje: 52.4,
		customData: { especialidad: "Arquitectura" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000035",
		n: 35,
		designacionYUbicacion: "Parque Central · Nodo Oeste",
		supDeObraM2: 22100,
		entidadContratante: "Nodo Infraestructura",
		mesBasicoDeContrato: "Mayo 2026",
		iniciacion: "2026-06-02",
		contratoMasAmpliaciones: 1060000000,
		certificadoALaFecha: 187000000,
		saldoACertificar: 873000000,
		segunContrato: 480,
		prorrogasAcordadas: 0,
		plazoTotal: 480,
		plazoTransc: 72,
		porcentaje: 17.6,
		customData: { especialidad: "Vial" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000042",
		n: 42,
		designacionYUbicacion: "Hospital del Sur · Ala ambulatoria",
		supDeObraM2: 8300,
		entidadContratante: "Lumen Educación",
		mesBasicoDeContrato: "Febrero 2025",
		iniciacion: "2025-03-10",
		contratoMasAmpliaciones: 1210000000,
		certificadoALaFecha: 968000000,
		saldoACertificar: 242000000,
		segunContrato: 390,
		prorrogasAcordadas: 12,
		plazoTotal: 402,
		plazoTransc: 346,
		porcentaje: 80,
		customData: { especialidad: "Arquitectura" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000056",
		n: 56,
		designacionYUbicacion: "Corredor Metropolitano · Tramo 3",
		supDeObraM2: 41500,
		entidadContratante: "Nodo Infraestructura",
		mesBasicoDeContrato: "Julio 2025",
		iniciacion: "2025-08-18",
		contratoMasAmpliaciones: 5980000000,
		certificadoALaFecha: 2210000000,
		saldoACertificar: 3770000000,
		segunContrato: 620,
		prorrogasAcordadas: 0,
		plazoTotal: 620,
		plazoTransc: 244,
		porcentaje: 37,
		customData: { especialidad: "Vial" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000063",
		n: 63,
		designacionYUbicacion: "Escuela Técnica 63 · Ampliación",
		supDeObraM2: 6100,
		entidadContratante: "Lumen Educación",
		mesBasicoDeContrato: "Julio 2025",
		iniciacion: "2026-01-20",
		contratoMasAmpliaciones: 934000000,
		certificadoALaFecha: 268000000,
		saldoACertificar: 666000000,
		segunContrato: 300,
		prorrogasAcordadas: 0,
		plazoTotal: 300,
		plazoTransc: 148,
		porcentaje: 28.7,
		customData: { especialidad: "Arquitectura" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
	{
		id: "10000000-0000-4000-8000-000000000071",
		n: 71,
		designacionYUbicacion: "Polo Logístico Oeste · Nave 4",
		supDeObraM2: 16200,
		entidadContratante: "Terranova SA",
		mesBasicoDeContrato: "Abril 2024",
		iniciacion: "2024-05-06",
		contratoMasAmpliaciones: 2860000000,
		certificadoALaFecha: 2860000000,
		saldoACertificar: 0,
		segunContrato: 420,
		prorrogasAcordadas: 18,
		plazoTotal: 438,
		plazoTransc: 438,
		porcentaje: 100,
		customData: { especialidad: "Industrial" },
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	},
] satisfies Obra[];

const portfolioObrasColumns: ExcelPageMainTableColumnConfig[] = [
	{ id: "n", kind: "base", baseColumnId: "n", label: "N°", enabled: true, width: 42 },
	{
		id: "designacionYUbicacion",
		kind: "base",
		baseColumnId: "designacionYUbicacion",
		label: "Designación y ubicación",
		enabled: true,
		width: 360,
	},
	{
		id: "especialidad",
		kind: "custom",
		label: "Especialidad",
		enabled: true,
		width: 120,
		cellType: "select",
		selectOptions: [
			{ text: "Arquitectura", color: "amber", icon: "dot" },
			{ text: "Vial", color: "blue", icon: "dot" },
			{ text: "Industrial", color: "slate", icon: "dot" },
		],
	},
	{
		id: "entidadContratante",
		kind: "base",
		baseColumnId: "entidadContratante",
		label: "Entidad contratante",
		enabled: true,
		width: 170,
		cellType: "select",
		selectOptions: [
			{ text: "Arqline Desarrollos", color: "blue", icon: "dot" },
			{ text: "Brava Urbanismo", color: "violet", icon: "dot" },
			{ text: "Lumen Educación", color: "green", icon: "dot" },
			{ text: "Terranova SA", color: "amber", icon: "dot" },
			{ text: "Nodo Infraestructura", color: "slate", icon: "dot" },
		],
	},
	{
		id: "mesBasicoDeContrato",
		kind: "base",
		baseColumnId: "mesBasicoDeContrato",
		label: "Mes básico de contrato",
		enabled: true,
		width: 145,
	},
	{
		id: "iniciacion",
		kind: "base",
		baseColumnId: "iniciacion",
		label: "Iniciación",
		enabled: true,
		width: 110,
	},
	{
		id: "contratoMasAmpliaciones",
		kind: "base",
		baseColumnId: "contratoMasAmpliaciones",
		label: "Contrato + ampliaciones",
		enabled: true,
		width: 190,
	},
	{
		id: "porcentaje",
		kind: "base",
		baseColumnId: "porcentaje",
		label: "% avance",
		enabled: true,
		width: 160,
	},
];

const operationalWorkspaceData: OperationalWorkspaceData = {
	company: "Constructora Norte S.A.",
	updatedAt: "Martes 21 de julio 2026 · 07:40",
	unreadNotifications: 2,
	expiredPolicies: 35,
	flaggedAmount: "$ 6,0 M",
	lateWorks: 4,
	activeWorks: 9,
	kpis: [
		{ id: "contract", label: "Contrato total", value: "$ 21.043 M", note: "98 obras · 9 activas", detail: { title: "Contrato total", description: "Suma de contratos más ampliaciones de todas las obras no eliminadas del tenant.", row: "certificado sobre contrato", value: "86,1%", percentage: 86.1, tone: "dark" } },
		{ id: "certified", label: "Certificado a la fecha", value: "$ 18.126 M", note: "86,1% del contrato", detail: { title: "Certificado a la fecha", description: "Monto ya certificado y aprobado por las entidades contratantes.", row: "% del contrato total", value: "86,1%", percentage: 86.1, tone: "dark" } },
		{ id: "balance", label: "Saldo a certificar", value: "$ 2.809 M", note: "ingreso futuro · activas", tone: "warning", detail: { title: "Saldo a certificar", description: "Ingreso futuro pendiente sobre las 9 obras activas. La obra 98 concentra el 62%.", row: "% del contrato activo", value: "13,9%", percentage: 13.9, tone: "orange" } },
		{ id: "policies", label: "Expuesto en pólizas", value: "$ 6,0 M", note: "+ USD 26.800 · 43 pólizas", tone: "danger", detail: { title: "Expuesto en pólizas", description: "Saldos adeudados en pólizas con señales de riesgo. Montos en ARS y USD nunca se suman.", row: "pólizas con saldo y riesgo", value: "43", percentage: 37, tone: "danger" } },
	],
	policyMonths: [
		{ label: "JUL", count: 9, risk: 6, balance: "$ 1,4 M" },
		{ label: "AGO", count: 7, risk: 4, balance: "$ 940.200" },
		{ label: "SEP", count: 8, risk: 5, balance: "$ 1,1 M" },
		{ label: "OCT", count: 6, risk: 3, balance: "$ 612.400" },
		{ label: "NOV", count: 5, risk: 2, balance: "$ 488.000" },
		{ label: "DIC", count: 4, risk: 2, balance: "$ 402.600" },
		{ label: "ENE", count: 3, risk: 1, balance: "$ 214.900" },
		{ label: "FEB", count: 5, risk: 2, balance: "$ 530.700" },
		{ label: "MAR", count: 2, risk: 1, balance: "$ 121.300" },
		{ label: "ABR", count: 4, risk: 1, balance: "$ 366.800" },
		{ label: "MAY", count: 3, risk: 1, balance: "$ 240.500" },
		{ label: "JUN", count: 1, risk: 0, balance: "$ 88.100" },
	],
	signals: [
		{ value: "35", label: "Vencidas sin baja", note: "$ 4,8 M + USD 18.400", tone: "danger" },
		{ value: "57", label: "Por vencer (60 días)", note: "próximos 2 meses", tone: "warning" },
		{ value: "8", label: "Bajas con saldo", note: "$ 1,2 M + USD 8.400", tone: "neutral" },
		{ value: "6", label: "Sin vencimiento", note: "fecha no registrada", tone: "neutral" },
	],
	projects: [
		{ id: 63, name: "Refacción Escuela N° 663 — Sauce", title: "ADJUDICACIÓN DIRECTA N° 211/25 - REFACCIÓN EN ESCUELA N° 663 ARQUÍMEDES GONZÁLEZ - LOCALIDAD DE PASO BERMÚDEZ - DPTO. SAUCE - PROVINCIA DE CORRIENTES", entity: "IN.VI.CO", updated: "hace 3 días", progress: 42, elapsed: 78, balance: "$ 239,3 M", balanceShare: 8.5, contract: "$ 412,5 M", certified: "$ 173,2 M", timeframe: "234 de 300 días" },
		{ id: 87, name: "24 Viviendas e Infraestructura — Goya", title: "LICITACIÓN PÚBLICA N° 14/24 - CONSTRUCCIÓN DE 24 VIVIENDAS E INFRAESTRUCTURA - LOCALIDAD DE GOYA - DPTO. GOYA - PROVINCIA DE CORRIENTES", entity: "IN.VI.CO", updated: "hoy", progress: 65, elapsed: 90, balance: "$ 345,1 M", balanceShare: 12.3, contract: "$ 986,0 M", certified: "$ 640,9 M", timeframe: "324 de 360 días" },
		{ id: 91, name: "Ampliación Hospital San Roque", title: "LICITACIÓN PRIVADA N° 03/25 - AMPLIACIÓN SALA DE INTERNACIÓN - HOSPITAL SAN ROQUE - CORRIENTES CAPITAL", entity: "Ministerio de Salud Pública", updated: "ayer", progress: 58, elapsed: 71, balance: "$ 127,0 M", balanceShare: 4.5, contract: "$ 302,4 M", certified: "$ 175,4 M", timeframe: "128 de 180 días" },
		{ id: 74, name: "Pavimento Urbano B° San Gerónimo", title: "LICITACIÓN PÚBLICA N° 09/24 - PAVIMENTO URBANO EN BARRIO SAN GERÓNIMO - DPTO. LAVALLE - PROVINCIA DE CORRIENTES", entity: "Dirección Provincial de Vialidad", updated: "hace 2 días", progress: 81, elapsed: 92, balance: "$ 124,4 M", balanceShare: 4.4, contract: "$ 654,8 M", certified: "$ 530,4 M", timeframe: "331 de 360 días" },
		{ id: 82, name: "SUM Escuela N° 154 — Mercedes", title: "LICITACIÓN PÚBLICA N° 11/24 - CONSTRUCCIÓN DE SUM EN ESCUELA N° 154 - LOCALIDAD DE MERCEDES", entity: "Ministerio de Educación", updated: "hace 5 días", progress: 93, elapsed: 96, balance: "$ 14,8 M", balanceShare: 0.5, contract: "$ 210,7 M", certified: "$ 195,9 M", timeframe: "259 de 270 días" },
		{ id: 96, name: "Refacción Comisaría Cuarta", title: "ADJUDICACIÓN DIRECTA N° 244/25 - REFACCIÓN COMISARÍA CUARTA - CURUZÚ CUATIÁ", entity: "Ministerio de Seguridad", updated: "hace 4 días", progress: 22, elapsed: 25, balance: "$ 69,1 M", balanceShare: 2.5, contract: "$ 88,6 M", certified: "$ 19,5 M", timeframe: "45 de 180 días" },
		{ id: 89, name: "Veredas y Rampas — Bella Vista", title: "ADJUDICACIÓN DIRECTA N° 198/25 - VEREDAS Y RAMPAS ACCESIBLES - CASCO CÉNTRICO - BELLA VISTA", entity: "Municipalidad de Bella Vista", updated: "hoy", progress: 47, elapsed: 44, balance: "$ 51,0 M", balanceShare: 1.8, contract: "$ 96,3 M", certified: "$ 45,3 M", timeframe: "79 de 180 días" },
		{ id: 95, name: "Playón Deportivo — Santo Tomé", title: "LICITACIÓN PÚBLICA N° 18/25 - PLAYÓN DEPORTIVO MUNICIPAL - SANTO TOMÉ", entity: "Municipalidad de Santo Tomé", updated: "ayer", progress: 35, elapsed: 31, balance: "$ 96,3 M", balanceShare: 3.4, contract: "$ 148,2 M", certified: "$ 51,9 M", timeframe: "56 de 180 días" },
		{ id: 98, name: "Red Cloacal B° Pirayuí — Etapa I", title: "LICITACIÓN PÚBLICA N° 21/25 - RED CLOACAL BARRIO PIRAYUÍ - ETAPA I - CORRIENTES CAPITAL", entity: "Secretaría de Obras Públicas", updated: "hoy", progress: 12, elapsed: 10, balance: "$ 1.742,4 M", balanceShare: 62, contract: "$ 1.980,0 M", certified: "$ 237,6 M", timeframe: "36 de 360 días" },
	],
	notifications: [
		{ title: "Certificado N° 14 observado", detail: "IN.VI.CO devolvió el certificado de la obra 87 con observaciones.", when: "hace 1 h" },
		{ title: "Nueva plantilla disponible", detail: "La plantilla OC estándar v3 reemplaza a la v2 en generación de documentos.", when: "ayer" },
	],
	reviews: [
		{ name: "Orden de compra", work: 91, status: "Generado", when: "hace 2 h", file: "purchase_order-3-licitacion-privada-03-25-ampliacion-hospital-.pdf" },
		{ name: "Certificado N° 14", work: 87, status: "En revisión", when: "hace 5 h", file: "certificado-14-licitacion-publica-14-24-construccion-viviendas-.pdf" },
		{ name: "Nota de pedido", work: 63, status: "Generado", when: "ayer", file: "nota_pedido-7-adjudicacion-directa-211-25-refaccion-escuela-663-.pdf" },
		{ name: "Acta de medición", work: 74, status: "En revisión", when: "ayer", file: "acta_medicion-9-licitacion-publica-09-24-pavimento-urbano-.pdf" },
		{ name: "Certificado N° 3", work: 96, status: "Generado", when: "hace 2 días", file: "certificado-3-adjudicacion-directa-244-25-refaccion-comisaria-.pdf" },
		{ name: "Orden de compra", work: 98, status: "Generado", when: "hace 2 días", file: "purchase_order-1-licitacion-publica-21-25-red-cloacal-pirayui-.pdf" },
		{ name: "Nota de elevación", work: 82, status: "En revisión", when: "hace 3 días", file: "nota_elevacion-2-licitacion-publica-11-24-sum-escuela-154-.pdf" },
		{ name: "Acta de inicio", work: 95, status: "Generado", when: "hace 3 días", file: "acta_inicio-1-licitacion-publica-18-25-playon-deportivo-.pdf" },
		{ name: "Certificado N° 21", work: 87, status: "En revisión", when: "hace 4 días", file: "certificado-21-licitacion-publica-14-24-construccion-viviendas-.pdf" },
		{ name: "Endoso de póliza", work: 89, status: "Generado", when: "hace 4 días", file: "endoso_poliza-4-adjudicacion-directa-198-25-veredas-rampas-.pdf" },
	],
};

const portfolioDataFlowConfig = getTenantDataFlowBuilderConfig(null);
const portfolioDataFlowPayload: DataFlowConfigPayload = {
	scope: "tenant",
	config: portfolioDataFlowConfig,
	inheritedConfig: null,
	effectiveConfig: portfolioDataFlowConfig,
	sources: {
		tables: [
			{
				id: BUILDER_PRESET_TABLE_SOURCE_IDS.pmcResumen,
				name: "Certificados extraídos",
				columns: [
					{ key: "monto_acumulado", label: "Certificado acumulado", dataType: "currency" },
					{ key: "fecha_certificacion", label: "Período", dataType: "date" },
				],
			},
		],
		macroTables: [],
		obraFields: DEFAULT_OBRA_FIELD_SOURCES,
	},
	canWrite: true,
	updatedAt: "2026-07-21T10:40:00.000Z",
};

const dashboardDemoData: DashboardDemoData = {
	isAuthenticated: true,
	obras: portfolioObras.map((obra) => ({
		id: obra.id,
		n: obra.n,
		designacionYUbicacion: obra.designacionYUbicacion,
		porcentaje: obra.porcentaje,
		contratoMasAmpliaciones: obra.contratoMasAmpliaciones,
		certificadoALaFecha: obra.certificadoALaFecha,
		saldoACertificar: obra.saldoACertificar,
		entidadContratante: obra.entidadContratante,
		plazoTotal: obra.plazoTotal,
		plazoTransc: obra.plazoTransc,
		segunContrato: obra.segunContrato,
		prorrogasAcordadas: obra.prorrogasAcordadas,
		updatedAt: "2026-07-21T14:18:00.000Z",
	})),
	previewCurve: {
		hasCurvaRows: true,
		hasResumenRows: true,
		points: [
			["Dic 25", 10, 9],
			["Ene 26", 18, 17],
			["Feb 26", 27, 25],
			["Mar 26", 38, 35],
			["Abr 26", 49, 45],
			["May 26", 60, 54],
			["Jun 26", 70, 61],
			["Jul 26", 78, 68],
		].map(([label, planPct, realPct], index) => ({
			key: `portfolio-${index}`,
			label: String(label),
			obra: "Torre Madero · Dique 2",
			planPct: Number(planPct),
			realPct: Number(realPct),
			sortOrder: index,
		})),
	},
};

const obraReportsDemo: GeneralTabReportsData = {
	findings: [
		{
			id: "portfolio-finding-1",
			rule_key: "schedule.facade_delay",
			severity: "warn",
			title: "Fachada por debajo del avance planificado",
			message: "El último parte muestra un desvío de 9 puntos frente a la curva aprobada.",
			created_at: "2026-07-21T13:40:00.000Z",
		},
	],
	curve: {
		planTableName: "Curva Plan",
		resumenTableName: "PMC Resumen",
		planRowsCount: 8,
		resumenRowsCount: 8,
		planPointsCount: 8,
		realPointsCount: 8,
		points: [
			["Dic 25", 10, 9],
			["Ene 26", 18, 17],
			["Feb 26", 27, 25],
			["Mar 26", 38, 35],
			["Abr 26", 49, 45],
			["May 26", 60, 54],
			["Jun 26", 70, 61],
			["Jul 26", 78, 68],
		].map(([label, planPct, realPct], index) => ({
			label: String(label),
			planPct: Number(planPct),
			realPct: Number(realPct),
			sortOrder: index,
		})),
	},
};

function PreviewSurface({ children }: { children: ReactNode }) {
	return <div className="portfolio-live-preview">{children}</div>;
}

export default async function PortfolioPreviewPage({
	params,
}: {
	params: Promise<{ view: string }>;
}) {
	const { view } = await params;

	if (view === "operations") {
		return (
			<PreviewSurface>
				<OperationalWorkspace data={operationalWorkspaceData} />
			</PreviewSurface>
		);
	}

	if (view === "obra") {
		return (
			<PreviewSurface>
				<ObraDetailPage
					initialObraId={portfolioObras[0].id}
					initialObra={portfolioObras[0]}
					initialTab="general"
					initialMainTableColumnsConfig={null}
					demoMode
					demoGeneralReportsData={obraReportsDemo}
				/>
			</PreviewSurface>
		);
	}

	if (view === "obras") {
		return (
			<PreviewSurface>
				<ExcelPageClient
					initialMainTableColumnsConfig={portfolioObrasColumns}
					initialObras={portfolioObras satisfies ExcelPageObra[]}
					initialLoadMode="before"
					initialIsMobile={false}
					demoMode
				/>
			</PreviewSurface>
		);
	}

	if (view === "ocr-workflow") {
		return (
			<PreviewSurface>
				<OcrReviewWorkspace />
			</PreviewSurface>
		);
	}

	if (view === "dashboard") {
		return (
			<PreviewSurface>
				<DashboardHome demoData={dashboardDemoData} />
			</PreviewSurface>
		);
	}

	if (view === "data-flow") {
		return (
			<PreviewSurface>
				<DataFlowPageClient
					scope="tenant"
					graphEndpoint="/api/data-flow-graph"
					configEndpoint="/api/data-flow-config"
					backHref="/excel"
					backLabel="Excel"
					breadcrumbRoot="Excel"
					demoPayload={portfolioDataFlowPayload}
					initialSemanticScope="all"
					initialAdvanced
					initialExpanded
				/>
			</PreviewSurface>
		);
	}

	notFound();
}
