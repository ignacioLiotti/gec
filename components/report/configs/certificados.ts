import type { ReportConfig, ReportColumn } from "../types";

export type CertificadoRow = {
	id: string;
	obraId: string;
	obraName: string;
	ente: string;
	n_exp: string;
	n_certificado: number;
	monto: number;
	mes: string;
	estado: string;
	facturado: boolean;
	fecha_facturacion: string | null;
	nro_factura: string | null;
	concepto: string | null;
	cobrado: boolean;
	observaciones: string | null;
	vencimiento: string | null;
	fecha_pago: string | null;
};

export type CertificadoFilters = {
	montoMin: string;
	montoMax: string;
	entes: string[];
	facturado: "all" | "si" | "no";
	cobrado: "all" | "si" | "no";
	conceptoContains: string;
	fechaFacturacionMin: string;
	fechaFacturacionMax: string;
	fechaPagoMin: string;
	fechaPagoMax: string;
	vencimientoMin: string;
	vencimientoMax: string;
};

const columns: ReportColumn<CertificadoRow>[] = [
	{
		id: "obraName",
		label: "Obra",
		accessor: (row) => row.obraName,
		type: "text",
		align: "left",
	},
	{
		id: "ente",
		label: "Ente",
		accessor: (row) => row.ente,
		type: "text",
		align: "left",
		groupable: true,
	},
	{
		id: "facturado",
		label: "Facturado",
		accessor: (row) => row.facturado,
		type: "boolean",
		align: "center",
	},
	{
		id: "fecha_facturacion",
		label: "Fecha facturación",
		accessor: (row) => row.fecha_facturacion,
		type: "date",
		align: "center",
	},
	{
		id: "nro_factura",
		label: "N° factura",
		accessor: (row) => row.nro_factura,
		type: "text",
		align: "center",
	},
	{
		id: "monto",
		label: "Monto",
		accessor: (row) => row.monto,
		type: "currency",
		align: "right",
		defaultAggregation: "sum",
	},
	{
		id: "concepto",
		label: "Concepto",
		accessor: (row) => row.concepto,
		type: "text",
		align: "left",
	},
	{
		id: "cobrado",
		label: "Cobrado",
		accessor: (row) => row.cobrado,
		type: "boolean",
		align: "center",
	},
	{
		id: "n_exp",
		label: "N° expediente",
		accessor: (row) => row.n_exp,
		type: "text",
		align: "left",
	},
	{
		id: "observaciones",
		label: "Observaciones",
		accessor: (row) => row.observaciones,
		type: "text",
		align: "left",
	},
	{
		id: "vencimiento",
		label: "Vencimiento",
		accessor: (row) => row.vencimiento,
		type: "date",
		align: "center",
	},
	{
		id: "fecha_pago",
		label: "Fecha pago",
		accessor: (row) => row.fecha_pago,
		type: "date",
		align: "center",
	},
];

export const certificadosReportConfig: ReportConfig<CertificadoRow, CertificadoFilters> = {
	id: "certificados",
	title: "Certificados",
	description: "Reporte de certificados",
	columns,
	groupByOptions: [
		{
			id: "by-obra",
			label: "Agrupado por Obra",
			groupBy: (row) => row.obraName,
		},
		{
			id: "by-ente",
			label: "Agrupado por Ente",
			groupBy: (row) => row.ente,
		},
	],
	filterFields: [
		{
			id: "conceptoContains",
			label: "Concepto contiene",
			type: "text",
			placeholder: "Texto...",
		},
		{
			id: "montoMin",
			label: "Monto mínimo",
			type: "number",
			placeholder: "Min",
		},
		{
			id: "montoMax",
			label: "Monto máximo",
			type: "number",
			placeholder: "Max",
		},
		{
			id: "facturado",
			label: "Facturado",
			type: "boolean-toggle",
		},
		{
			id: "cobrado",
			label: "Cobrado",
			type: "boolean-toggle",
		},
		{
			id: "fechaFacturacionMin",
			label: "Facturación desde",
			type: "date",
		},
		{
			id: "fechaFacturacionMax",
			label: "Facturación hasta",
			type: "date",
		},
		{
			id: "fechaPagoMin",
			label: "Pago desde",
			type: "date",
		},
		{
			id: "fechaPagoMax",
			label: "Pago hasta",
			type: "date",
		},
	],
	defaultFilters: () => ({
		montoMin: "",
		montoMax: "",
		entes: [],
		facturado: "all",
		cobrado: "all",
		conceptoContains: "",
		fechaFacturacionMin: "",
		fechaFacturacionMax: "",
		fechaPagoMin: "",
		fechaPagoMax: "",
		vencimientoMin: "",
		vencimientoMax: "",
	}),
	fetchData: async (filters) => {
		const params = new URLSearchParams();
		if (filters.montoMin?.trim()) params.set("montoMin", filters.montoMin.trim());
		if (filters.montoMax?.trim()) params.set("montoMax", filters.montoMax.trim());
		filters.entes?.forEach((e) => {
			if (e.trim()) params.append("ente", e);
		});
		if (filters.facturado !== "all") params.set("facturado", filters.facturado);
		if (filters.cobrado !== "all") params.set("cobrado", filters.cobrado);
		if (filters.conceptoContains?.trim())
			params.set("conceptoContains", filters.conceptoContains.trim());
		if (filters.fechaFacturacionMin?.trim())
			params.set("fechaFacturacionMin", filters.fechaFacturacionMin.trim());
		if (filters.fechaFacturacionMax?.trim())
			params.set("fechaFacturacionMax", filters.fechaFacturacionMax.trim());
		if (filters.fechaPagoMin?.trim()) params.set("fechaPagoMin", filters.fechaPagoMin.trim());
		if (filters.fechaPagoMax?.trim()) params.set("fechaPagoMax", filters.fechaPagoMax.trim());
		if (filters.vencimientoMin?.trim())
			params.set("vencimientoMin", filters.vencimientoMin.trim());
		if (filters.vencimientoMax?.trim())
			params.set("vencimientoMax", filters.vencimientoMax.trim());

		params.set("limit", "10000");

		const res = await fetch(`/api/certificados?${params.toString()}`);
		if (!res.ok) throw new Error("No se pudieron cargar los certificados");
		const data = await res.json();
		return Array.isArray(data.certificados) ? data.certificados : [];
	},
	getRowId: (row) => row.id,
	currencyLocale: "es-AR",
	currencyCode: "ARS",
};
