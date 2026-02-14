import type { ReportConfig, ReportColumn } from "../types";

export type ObraRow = {
	id: string;
	n: number | null;
	designacionYUbicacion: string | null;
	supDeObraM2: number | null;
	entidadContratante: string | null;
	mesBasicoDeContrato: string | null;
	iniciacion: string | null;
	contratoMasAmpliaciones: number | null;
	certificadoALaFecha: number | null;
	saldoACertificar: number | null;
	segunContrato: number | null;
	prorrogasAcordadas: number | null;
	plazoTotal: number | null;
	plazoTransc: number | null;
	porcentaje: number | null;
};

export type ObraFilters = {
	supMin: string;
	supMax: string;
	entidades: string[];
	entidadContains: string;
	porcentajeMin: string;
	porcentajeMax: string;
	estado: "all" | "en-proceso" | "completadas";
};

const columns: ReportColumn<ObraRow>[] = [
	{
		id: "n",
		label: "N°",
		accessor: (row) => row.n,
		type: "number",
		align: "center",
		width: "60px",
	},
	{
		id: "designacionYUbicacion",
		label: "Designación y Ubicación",
		accessor: (row) => row.designacionYUbicacion,
		type: "text",
		align: "left",
	},
	{
		id: "supDeObraM2",
		label: "Sup. (m²)",
		accessor: (row) => row.supDeObraM2,
		type: "number",
		align: "right",
	},
	{
		id: "entidadContratante",
		label: "Entidad Contratante",
		accessor: (row) => row.entidadContratante,
		type: "text",
		align: "left",
		groupable: true,
	},
	{
		id: "mesBasicoDeContrato",
		label: "Mes Básico",
		accessor: (row) => row.mesBasicoDeContrato,
		type: "text",
		align: "center",
	},
	{
		id: "iniciacion",
		label: "Iniciación",
		accessor: (row) => row.iniciacion,
		type: "text",
		align: "center",
	},
	{
		id: "contratoMasAmpliaciones",
		label: "Contrato + Ampliaciones",
		accessor: (row) => row.contratoMasAmpliaciones,
		type: "currency",
		align: "right",
		defaultAggregation: "sum",
	},
	{
		id: "certificadoALaFecha",
		label: "Certificado a la Fecha",
		accessor: (row) => row.certificadoALaFecha,
		type: "currency",
		align: "right",
		defaultAggregation: "sum",
	},
	{
		id: "saldoACertificar",
		label: "Saldo a Certificar",
		accessor: (row) => row.saldoACertificar,
		type: "currency",
		align: "right",
		defaultAggregation: "sum",
	},
	{
		id: "segunContrato",
		label: "Según Contrato",
		accessor: (row) => row.segunContrato,
		type: "number",
		align: "right",
	},
	{
		id: "prorrogasAcordadas",
		label: "Prórrogas",
		accessor: (row) => row.prorrogasAcordadas,
		type: "number",
		align: "right",
	},
	{
		id: "plazoTotal",
		label: "Plazo Total",
		accessor: (row) => row.plazoTotal,
		type: "number",
		align: "right",
	},
	{
		id: "plazoTransc",
		label: "Plazo Transc.",
		accessor: (row) => row.plazoTransc,
		type: "number",
		align: "right",
	},
	{
		id: "porcentaje",
		label: "% Avance",
		accessor: (row) => row.porcentaje,
		type: "number",
		align: "right",
		defaultAggregation: "average",
	},
];

export const obrasReportConfig: ReportConfig<ObraRow, ObraFilters> = {
	id: "obras",
	title: "Obras",
	description: "Reporte de obras",
	templateCategory: "obras",
	columns,
	groupByOptions: [
		{
			id: "by-entidad",
			label: "Agrupado por Entidad",
			groupBy: (row) => row.entidadContratante || "Sin entidad",
		},
		{
			id: "by-estado",
			label: "Agrupado por Estado",
			groupBy: (row) => {
				const pct = row.porcentaje ?? 0;
				return pct >= 100 ? "Completadas" : "En proceso";
			},
		},
	],
	filterFields: [
		{
			id: "supMin",
			label: "Superficie mínima (m²)",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "supMax",
			label: "Superficie máxima (m²)",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "entidadContains",
			label: "Entidad contiene",
			type: "text",
			placeholder: "Nombre de entidad",
		},
		{
			id: "porcentajeMin",
			label: "Avance mínimo (%)",
			type: "number",
			placeholder: "0",
		},
		{
			id: "porcentajeMax",
			label: "Avance máximo (%)",
			type: "number",
			placeholder: "100",
		},
		{
			id: "estado",
			label: "Estado",
			type: "select",
			options: [
				{ value: "all", label: "Todas" },
				{ value: "en-proceso", label: "En proceso" },
				{ value: "completadas", label: "Completadas" },
			],
		},
	],
	defaultFilters: () => ({
		supMin: "",
		supMax: "",
		entidades: [],
		entidadContains: "",
		porcentajeMin: "",
		porcentajeMax: "",
		estado: "all",
	}),
	fetchData: async (filters) => {
		const response = await fetch("/api/obras", { cache: "no-store" });
		if (!response.ok) {
			throw new Error("No se pudieron obtener las obras");
		}
		const payload = await response.json();
		const obras = Array.isArray(payload.detalleObras) ? payload.detalleObras : [];

		// Apply filters client-side
		return obras.filter((obra: ObraRow) => {
			// Surface filter
			if (filters.supMin) {
				const min = Number(filters.supMin);
				if ((obra.supDeObraM2 ?? 0) < min) return false;
			}
			if (filters.supMax) {
				const max = Number(filters.supMax);
				if ((obra.supDeObraM2 ?? 0) > max) return false;
			}

			// Porcentaje filter
			if (filters.porcentajeMin) {
				const min = Number(filters.porcentajeMin);
				if ((obra.porcentaje ?? 0) < min) return false;
			}
			if (filters.porcentajeMax) {
				const max = Number(filters.porcentajeMax);
				if ((obra.porcentaje ?? 0) > max) return false;
			}

			// Estado filter
			if (filters.estado === "en-proceso") {
				if ((obra.porcentaje ?? 0) >= 100) return false;
			} else if (filters.estado === "completadas") {
				if ((obra.porcentaje ?? 0) < 100) return false;
			}
			if (filters.entidadContains?.trim()) {
				const entity = (obra.entidadContratante ?? "").toLowerCase();
				if (!entity.includes(filters.entidadContains.trim().toLowerCase())) {
					return false;
				}
			}
			if (filters.entidades.length > 0) {
				const entity = (obra.entidadContratante ?? "").trim();
				if (!filters.entidades.includes(entity)) return false;
			}

			return true;
		});
	},
	getRowId: (row) => row.id,
	currencyLocale: "es-AR",
	currencyCode: "ARS",
};
