import type {
	ReportColumn,
	ReportColumnType,
	ReportConfig,
	ReportFilterField,
} from "@/components/report/types";
import type {
	MacroTable,
	MacroTableColumn,
	MacroTableDataType,
	MacroTableRow,
} from "@/lib/macro-tables";

export type MacroReportFilters = {
	search: string;
	[key: string]: string;
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

function toNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const normalized = trimmed.replace(/\./g, "").replace(",", ".");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function toDateMs(value: unknown): number | null {
	if (value instanceof Date) {
		const ms = value.getTime();
		return Number.isFinite(ms) ? ms : null;
	}
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Date.parse(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown): boolean | null {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	if (!normalized) return null;
	if (["true", "1", "si", "sí", "yes", "y"].includes(normalized)) return true;
	if (["false", "0", "no", "n"].includes(normalized)) return false;
	return null;
}

export function buildMacroReportConfig(
	macroTable: MacroTableWithColumns
): ReportConfig<MacroTableRow, MacroReportFilters> {
	const baseColumns = macroTable.columns ?? [];
	const hasNativeObraColumn = baseColumns.some((col) => {
		const label = col.label.trim().toLowerCase();
		if (label === "obra") return true;
		if (col.columnType === "computed" && col.config?.compute === "obra_name") return true;
		if (col.columnType === "source" && col.sourceFieldKey?.startsWith("obra.")) return true;
		return false;
	});

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

	if (!hasNativeObraColumn && !reportColumns.some((col) => col.id === "_obraName")) {
		reportColumns.unshift({
			id: "_obraName",
			label: "Obra",
			accessor: (row: MacroTableRow) => row._obraName,
			type: "text",
			align: "left",
		});
	}

	const dynamicFilterFields: ReportFilterField<MacroReportFilters>[] = [];
	for (const column of reportColumns) {
		if (column.id === "id" || column.id.startsWith("_source")) continue;
		if (column.type === "number" || column.type === "currency") {
			dynamicFilterFields.push({
				id: `${column.id}__min`,
				label: `${column.label} mínimo`,
				type: "number",
				placeholder: "Min",
			});
			dynamicFilterFields.push({
				id: `${column.id}__max`,
				label: `${column.label} máximo`,
				type: "number",
				placeholder: "Max",
			});
			continue;
		}
		if (column.type === "date") {
			dynamicFilterFields.push({
				id: `${column.id}__min`,
				label: `${column.label} desde`,
				type: "date",
			});
			dynamicFilterFields.push({
				id: `${column.id}__max`,
				label: `${column.label} hasta`,
				type: "date",
			});
			continue;
		}
		if (column.type === "boolean") {
			dynamicFilterFields.push({
				id: `${column.id}__eq`,
				label: column.label,
				type: "select",
				options: [
					{ value: "", label: "Todos" },
					{ value: "true", label: "Sí" },
					{ value: "false", label: "No" },
				],
			});
			continue;
		}
		dynamicFilterFields.push({
			id: `${column.id}__contains`,
			label: `${column.label} contiene`,
			type: "text",
			placeholder: "Texto...",
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
			...dynamicFilterFields,
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

			rows = rows.filter((row) => {
				for (const column of reportColumns) {
					if (column.id === "id" || column.id.startsWith("_source")) continue;
					const value = row[column.id];

					if (column.type === "number" || column.type === "currency") {
						const min = toNumber(filters[`${column.id}__min`]);
						const max = toNumber(filters[`${column.id}__max`]);
						const numeric = toNumber(value);
						if (min != null && (numeric == null || numeric < min)) return false;
						if (max != null && (numeric == null || numeric > max)) return false;
						continue;
					}

					if (column.type === "date") {
						const min = toDateMs(filters[`${column.id}__min`]);
						const max = toDateMs(filters[`${column.id}__max`]);
						const dateMs = toDateMs(value);
						if (min != null && (dateMs == null || dateMs < min)) return false;
						if (max != null && (dateMs == null || dateMs > max)) return false;
						continue;
					}

					if (column.type === "boolean") {
						const expectedRaw = filters[`${column.id}__eq`];
						if (!expectedRaw) continue;
						const expected = expectedRaw === "true";
						const actual = toBoolean(value);
						if (actual == null || actual !== expected) return false;
						continue;
					}

					const contains = filters[`${column.id}__contains`]?.trim();
					if (!contains) continue;
					const haystack = String(value ?? "").toLowerCase();
					if (!haystack.includes(contains.toLowerCase())) return false;
				}
				return true;
			});

			return rows;
		},
		getRowId: (row: MacroTableRow) => String(row.id),
	};
}
