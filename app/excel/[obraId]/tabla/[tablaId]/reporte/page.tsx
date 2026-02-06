'use client';

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportPage } from "@/components/report";
import type {
	ReportColumn,
	ReportColumnType,
	ReportConfig,
} from "@/components/report/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TablaColumn = {
	id: string;
	fieldKey: string;
	label: string;
	dataType: string;
	required: boolean;
};

type TablaRow = {
	id: string;
	data: Record<string, unknown>;
};

type OcrTableRow = {
	id: string;
	[key: string]: unknown;
};

type OcrReportFilters = {
	search: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapDataTypeToReportType(dataType: string): ReportColumnType {
	switch (dataType) {
		case "number":
			return "number";
		case "currency":
			return "currency";
		case "boolean":
			return "boolean";
		case "date":
			return "date";
		default:
			return "text";
	}
}

function buildReportColumns(
	tablaColumns: TablaColumn[],
	hasDocSource: boolean
): ReportColumn<OcrTableRow>[] {
	const cols: ReportColumn<OcrTableRow>[] = tablaColumns.map((col) => ({
		id: col.fieldKey,
		label: col.label,
		accessor: (row: OcrTableRow) => row[col.fieldKey],
		type: mapDataTypeToReportType(col.dataType),
		align:
			col.dataType === "currency" || col.dataType === "number"
				? ("right" as const)
				: ("left" as const),
		defaultAggregation:
			col.dataType === "currency" || col.dataType === "number" ? "sum" : "none",
	}));

	if (hasDocSource) {
		cols.unshift({
			id: "__docFileName",
			label: "Documento",
			accessor: (row: OcrTableRow) => row.__docFileName,
			type: "text",
			align: "left",
		});
	}

	return cols;
}

function buildReportConfig(
	obraId: string,
	tablaId: string,
	tablaName: string,
	tablaColumns: TablaColumn[],
	hasDocSource: boolean
): ReportConfig<OcrTableRow, OcrReportFilters> {
	const reportColumns = buildReportColumns(tablaColumns, hasDocSource);

	return {
		id: `ocr-tabla-${tablaId}`,
		title: tablaName,
		description: `Reporte de ${tablaName}`,
		columns: reportColumns,
		currencyLocale: "es-AR",
		currencyCode: "ARS",
		filterFields: [
			{
				id: "search",
				label: "Buscar",
				type: "text",
				placeholder: "Buscar en todas las columnas",
			},
		],
		defaultFilters: () => ({ search: "" }),
		fetchData: async (filters: OcrReportFilters) => {
			const rowsRes = await fetch(
				`/api/obras/${obraId}/tablas/${tablaId}/rows?limit=200`
			);
			if (!rowsRes.ok) throw new Error("No se pudieron cargar las filas");
			const rowsData = await rowsRes.json();
			const tablaRows: TablaRow[] = rowsData.rows || [];

			let rows: OcrTableRow[] = tablaRows.map((row) => {
				const mapped: OcrTableRow = { id: row.id };
				tablaColumns.forEach((col) => {
					mapped[col.fieldKey] = row.data?.[col.fieldKey] ?? null;
				});
				if (row.data?.__docFileName) {
					mapped.__docFileName = row.data.__docFileName;
				}
				return mapped;
			});

			const term = filters.search?.trim().toLowerCase();
			if (term) {
				rows = rows.filter((row) =>
					reportColumns.some((col) => {
						const value = row[col.id];
						if (value == null) return false;
						return String(value).toLowerCase().includes(term);
					})
				);
			}

			return rows;
		},
		getRowId: (row: OcrTableRow) => row.id,
	};
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function OcrReportePageContent() {
	const params = useParams();
	const obraId = params?.obraId as string;
	const tablaId = params?.tablaId as string;

	const [tablaName, setTablaName] = useState<string>("");
	const [tablaColumns, setTablaColumns] = useState<TablaColumn[]>([]);
	const [hasDocSource, setHasDocSource] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadTabla = async () => {
			if (!obraId || !tablaId) return;
			try {
				setIsLoading(true);
				setError(null);

				// Fetch tabla metadata to get columns
				const tablasRes = await fetch(`/api/obras/${obraId}/tablas`);
				if (!tablasRes.ok) throw new Error("No se pudo cargar las tablas");
				const tablasData = await tablasRes.json();

				const tabla = (tablasData.tablas || []).find(
					(t: { id: string }) => t.id === tablaId
				);
				if (!tabla) throw new Error("Tabla no encontrada");

				const cols: TablaColumn[] = (tabla.columns || []).map(
					(col: {
						id: string;
						fieldKey: string;
						label: string;
						dataType: string;
						required: boolean;
					}) => ({
						id: col.id,
						fieldKey: col.fieldKey,
						label: col.label,
						dataType: col.dataType,
						required: col.required,
					})
				);

				setTablaName(tabla.name || "Tabla OCR");
				setTablaColumns(cols);

				// Quick check if any rows have doc source info
				const rowsRes = await fetch(
					`/api/obras/${obraId}/tablas/${tablaId}/rows?limit=1`
				);
				if (rowsRes.ok) {
					const rowsData = await rowsRes.json();
					const firstRow = (rowsData.rows || [])[0];
					setHasDocSource(!!firstRow?.data?.__docFileName);
				}
			} catch (err) {
				console.error(err);
				setError(
					err instanceof Error ? err.message : "Error al cargar datos"
				);
			} finally {
				setIsLoading(false);
			}
		};

		void loadTabla();
	}, [obraId, tablaId]);

	const reportConfig = useMemo(() => {
		if (!tablaColumns.length) return null;
		return buildReportConfig(
			obraId,
			tablaId,
			tablaName,
			tablaColumns,
			hasDocSource
		);
	}, [obraId, tablaId, tablaName, tablaColumns, hasDocSource]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-[70vh]">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error || !reportConfig) {
		return (
			<div className="flex flex-col items-center justify-center h-[70vh] gap-3 text-muted-foreground">
				<AlertCircle className="h-10 w-10" />
				<p>{error ?? "No se pudo generar el reporte para esta tabla."}</p>
				<Button variant="outline" onClick={() => window.history.back()}>
					Volver
				</Button>
			</div>
		);
	}

	return (
		<ReportPage
			config={reportConfig}
			backUrl={`/excel/${obraId}`}
		/>
	);
}

export default function Page() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen">
					Cargando...
				</div>
			}
		>
			<OcrReportePageContent />
		</Suspense>
	);
}
