import type {
	ReportColumn,
	ReportColumnType,
	ReportConfig,
} from "@/components/report/types";

export type TablaColumn = {
	id: string;
	fieldKey: string;
	label: string;
	dataType: string;
	required: boolean;
};

export type TablaRow = {
	id: string;
	data: Record<string, unknown>;
};

export type OcrTableRow = {
	id: string;
	[key: string]: unknown;
};

export type OcrReportFilters = {
	search: string;
};

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

export function buildOcrReportConfig(
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
		shareMeta: { type: "ocr-tabla", obraId, tablaId },
		templateCategory: "ocr-tabla",
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
