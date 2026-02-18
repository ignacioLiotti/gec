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
	entidadContains: string;
	mesYear: string;
	mesContains: string;
	iniYear: string;
	iniContains: string;
	cmaMin: string;
	cmaMax: string;
	cafMin: string;
	cafMax: string;
	sacMin: string;
	sacMax: string;
	scMin: string;
	scMax: string;
	paMin: string;
	paMax: string;
	ptMin: string;
	ptMax: string;
	ptrMin: string;
	ptrMax: string;
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
			label: "Entidad de obra contiene",
			type: "text",
			placeholder: "Nombre de entidad",
		},
		{
			id: "mesYear",
			label: "Mes básico: año",
			type: "text",
			placeholder: "Ej: 2026",
		},
		{
			id: "mesContains",
			label: "Mes básico contiene",
			type: "text",
			placeholder: "Ej: marzo",
		},
		{
			id: "iniYear",
			label: "Iniciación: año",
			type: "text",
			placeholder: "Ej: 2026",
		},
		{
			id: "iniContains",
			label: "Iniciación contiene",
			type: "text",
			placeholder: "Texto de fecha",
		},
		{
			id: "cmaMin",
			label: "Contrato+Ampliaciones mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "cmaMax",
			label: "Contrato+Ampliaciones máximo",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "cafMin",
			label: "Certificado a la fecha mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "cafMax",
			label: "Certificado a la fecha máximo",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "sacMin",
			label: "Saldo a certificar mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "sacMax",
			label: "Saldo a certificar máximo",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "scMin",
			label: "Según contrato mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "scMax",
			label: "Según contrato máximo",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "paMin",
			label: "Prórrogas mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "paMax",
			label: "Prórrogas máximo",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "ptMin",
			label: "Plazo total mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "ptMax",
			label: "Plazo total máximo",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "ptrMin",
			label: "Plazo transcurrido mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "ptrMax",
			label: "Plazo transcurrido máximo",
			type: "number",
			placeholder: "Max",
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
		entidadContains: "",
		mesYear: "",
		mesContains: "",
		iniYear: "",
		iniContains: "",
		cmaMin: "",
		cmaMax: "",
		cafMin: "",
		cafMax: "",
		sacMin: "",
		sacMax: "",
		scMin: "",
		scMax: "",
		paMin: "",
		paMax: "",
		ptMin: "",
		ptMax: "",
		ptrMin: "",
		ptrMax: "",
		porcentajeMin: "",
		porcentajeMax: "",
		estado: "all",
	}),
	fetchData: async (filters) => {
		const params = new URLSearchParams();
		const add = (key: string, value: string) => {
			const normalized = value.trim();
			if (normalized) params.set(key, normalized);
		};
		add("supMin", filters.supMin);
		add("supMax", filters.supMax);
		add("entidadContains", filters.entidadContains);
		add("mesYear", filters.mesYear);
		add("mesContains", filters.mesContains);
		add("iniYear", filters.iniYear);
		add("iniContains", filters.iniContains);
		add("cmaMin", filters.cmaMin);
		add("cmaMax", filters.cmaMax);
		add("cafMin", filters.cafMin);
		add("cafMax", filters.cafMax);
		add("sacMin", filters.sacMin);
		add("sacMax", filters.sacMax);
		add("scMin", filters.scMin);
		add("scMax", filters.scMax);
		add("paMin", filters.paMin);
		add("paMax", filters.paMax);
		add("ptMin", filters.ptMin);
		add("ptMax", filters.ptMax);
		add("ptrMin", filters.ptrMin);
		add("ptrMax", filters.ptrMax);
		add("porcentajeMin", filters.porcentajeMin);
		add("porcentajeMax", filters.porcentajeMax);
		if (filters.estado === "en-proceso") {
			params.set("status", "in-process");
		} else if (filters.estado === "completadas") {
			params.set("status", "completed");
		}

		const query = params.toString();
		const response = await fetch(`/api/obras${query ? `?${query}` : ""}`, { cache: "no-store" });
		if (!response.ok) {
			throw new Error("No se pudieron obtener las obras");
		}
		const payload = await response.json();
		const obras = Array.isArray(payload.detalleObras) ? payload.detalleObras : [];
		return obras as ObraRow[];
	},
	getRowId: (row) => row.id,
	currencyLocale: "es-AR",
	currencyCode: "ARS",
};
