import type {
	ReportColumn,
	ReportColumnType,
	ReportConfig,
} from "@/components/report/types";
import type {
	MacroTable,
	MacroTableColumn,
	MacroTableDataType,
	MacroTableRow,
} from "@/lib/macro-tables";

export type MacroReportFilters = {
	search: string;
};

export type MacroTableWithColumns = MacroTable & { columns: MacroTableColumn[] };

function mapColumnType(type: MacroTableDataType): ReportColumnType {
	switch (type) {
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

export function buildMacroReportConfig(
	macroTable: MacroTableWithColumns
): ReportConfig<MacroTableRow, MacroReportFilters> {
	const baseColumns = macroTable.columns ?? [];

	const reportColumns: ReportColumn<MacroTableRow>[] = baseColumns.map((col) => ({
		id: col.id,
		label: col.label,
		accessor: (row: MacroTableRow) => row[col.id],
		type: mapColumnType(col.dataType),
		align:
			col.dataType === "number" || col.dataType === "currency"
				? ("right" as const)
				: ("left" as const),
		defaultAggregation:
			col.dataType === "number" || col.dataType === "currency" ? "sum" : "none",
	}));

	if (!reportColumns.some((col) => col.id === "_obraName")) {
		reportColumns.unshift({
			id: "_obraName",
			label: "Obra",
			accessor: (row: MacroTableRow) => row._obraName,
			type: "text",
			align: "left",
		});
	}

	return {
		id: `macro-report-${macroTable.id}`,
		title: macroTable.name,
		description: macroTable.description ?? "Reporte de macro tabla",
		shareMeta: { type: "macro", macroTableId: macroTable.id },
		templateCategory: "macro",
		columns: reportColumns,
		currencyCode: "ARS",
		currencyLocale: "es-AR",
		filterFields: [
			{
				id: "search",
				label: "Buscar",
				type: "text",
				placeholder: "Buscar en todas las columnas",
			},
		],
		defaultFilters: () => ({ search: "" }),
		fetchData: async (filters: MacroReportFilters) => {
			const query = new URLSearchParams({ limit: "1000" });
			const res = await fetch(
				`/api/macro-tables/${macroTable.id}/rows?${query.toString()}`
			);
			if (!res.ok) {
				throw new Error(
					"No se pudieron obtener los datos de la macro tabla"
				);
			}
			const data = await res.json();
			let rows: MacroTableRow[] = data.rows ?? [];

			const term = filters.search?.trim().toLowerCase();
			if (term) {
				rows = rows.filter((row) =>
					reportColumns.some((column) => {
						const value = row[column.id];
						if (value == null) return false;
						return String(value).toLowerCase().includes(term);
					})
				);
			}

			return rows;
		},
		getRowId: (row: MacroTableRow) => String(row.id),
	};
}
