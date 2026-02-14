import type {
	ReportColumn,
	ReportColumnType,
	ReportConfig,
	ReportFilterField,
} from "@/components/report/types";
import {
	coerceValueForType,
	evaluateTablaFormula,
	ensureTablaDataType,
	toNumericValue,
} from "@/lib/tablas";

export type TablaColumn = {
	id: string;
	fieldKey: string;
	label: string;
	dataType: string;
	required: boolean;
	config?: Record<string, unknown>;
};

export type TablaRow = {
	id: string;
	data: Record<string, unknown>;
};

export type OcrTableRow = {
	id: string;
	[key: string]: unknown;
};

export type OcrReportFilters = Record<string, string | string[]>;

function getThresholdClass(value: unknown, config?: Record<string, unknown>) {
	const thresholdConfig =
		config?.conditional && typeof config.conditional === "object"
			? (config.conditional as Record<string, unknown>)
			: null;
	if (!thresholdConfig) return undefined;
	const numeric = toNumericValue(value);
	if (numeric == null) return undefined;
	const criticalBelow = toNumericValue(thresholdConfig.criticalBelow);
	const criticalAbove = toNumericValue(thresholdConfig.criticalAbove);
	const warnBelow = toNumericValue(thresholdConfig.warnBelow);
	const warnAbove = toNumericValue(thresholdConfig.warnAbove);
	if (criticalBelow != null && numeric <= criticalBelow) {
		return "bg-red-100 text-red-800";
	}
	if (criticalAbove != null && numeric >= criticalAbove) {
		return "bg-red-100 text-red-800";
	}
	if (warnBelow != null && numeric <= warnBelow) {
		return "bg-amber-100 text-amber-800";
	}
	if (warnAbove != null && numeric >= warnAbove) {
		return "bg-amber-100 text-amber-800";
	}
	return undefined;
}

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
		getCellClassName: (value) => getThresholdClass(value, col.config),
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
	const dynamicFilterFields: ReportFilterField<OcrReportFilters>[] = [];
	for (const col of tablaColumns) {
		if (col.dataType === "number" || col.dataType === "currency") {
			dynamicFilterFields.push({
				id: `${col.fieldKey}__min` as keyof OcrReportFilters,
				label: `${col.label} mínimo`,
				type: "number",
				placeholder: "Min",
			});
			dynamicFilterFields.push({
				id: `${col.fieldKey}__max` as keyof OcrReportFilters,
				label: `${col.label} máximo`,
				type: "number",
				placeholder: "Max",
			});
			continue;
		}
		dynamicFilterFields.push({
			id: `${col.fieldKey}__contains` as keyof OcrReportFilters,
			label: `${col.label} contiene`,
			type: "text",
			placeholder: "Texto...",
		});
	}

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
			...dynamicFilterFields,
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
					mapped[col.fieldKey] = coerceValueForType(
						ensureTablaDataType(col.dataType),
						row.data?.[col.fieldKey] ?? null
					);
				});
				if (row.data?.__docFileName) {
					mapped.__docFileName = row.data.__docFileName;
				}
				for (const col of tablaColumns) {
					const formula =
						typeof col.config?.formula === "string"
							? col.config.formula.trim()
							: "";
					if (!formula) continue;
					const computed = evaluateTablaFormula(formula, mapped);
					mapped[col.fieldKey] = coerceValueForType(
						ensureTablaDataType(col.dataType),
						computed
					);
				}
				return mapped;
			});

			const searchRaw = filters.search;
			const term =
				typeof searchRaw === "string" ? searchRaw.trim().toLowerCase() : "";
			if (term) {
				rows = rows.filter((row) =>
					reportColumns.some((col) => {
						const value = row[col.id];
						if (value == null) return false;
						return String(value).toLowerCase().includes(term);
					})
				);
			}

			rows = rows.filter((row) => {
				for (const col of tablaColumns) {
					const cellValue = row[col.fieldKey];
					if (col.dataType === "number" || col.dataType === "currency") {
						const minRaw = filters[`${col.fieldKey}__min`];
						const maxRaw = filters[`${col.fieldKey}__max`];
						const min = toNumericValue(minRaw);
						const max = toNumericValue(maxRaw);
						const numeric = toNumericValue(cellValue);
						if (min != null && (numeric == null || numeric < min)) return false;
						if (max != null && (numeric == null || numeric > max)) return false;
						continue;
					}
					const containsRaw = filters[`${col.fieldKey}__contains`];
					const contains = typeof containsRaw === "string" ? containsRaw.trim() : "";
					if (!contains) continue;
					const haystack = String(cellValue ?? "").toLowerCase();
					if (!haystack.includes(contains.toLowerCase())) return false;
				}
				return true;
			});

			return rows;
		},
		getRowId: (row: OcrTableRow) => row.id,
	};
}
