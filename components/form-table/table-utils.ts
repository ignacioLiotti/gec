import { format as formatDate } from "date-fns";
import type { ColumnDef, ColumnField, FormTableRow, FormValues } from "./types";

const FALLBACK_ID = () => `row-${Date.now()}-${Math.random()}`;

export function createRowFromColumns<Row extends FormTableRow>(columns: ColumnDef<Row>[]): Row {
	const hasCrypto =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
	const row: FormTableRow = {
		id: hasCrypto ? crypto.randomUUID() : FALLBACK_ID(),
	};

	columns.forEach((column) => {
		if (!column.field) return;

		const defaultValue = column.defaultValue;
		if (typeof defaultValue !== "undefined") {
			(row as any)[column.field] = defaultValue;
			return;
		}

		switch (column.cellType) {
			case "boolean":
			case "checkbox":
			case "toggle":
				(row as any)[column.field] = false;
				break;
			case "currency":
			case "number":
				(row as any)[column.field] = 0;
				break;
			default:
				(row as any)[column.field] = "";
		}
	});

	return row as Row;
}

export function isValueEmpty(value: unknown) {
	if (value == null) return true;
	if (typeof value === "string") return value.trim() === "";
	return false;
}

export function defaultSearchMatcher(value: unknown, query: string) {
	if (!query) return true;
	if (value == null) return false;
	if (typeof value === "string") {
		return value.toLowerCase().includes(query);
	}
	return String(value).toLowerCase().includes(query);
}

export function requiredValidator(label: string) {
	return (value: unknown) => (isValueEmpty(value) ? `${label} es obligatorio` : undefined);
}

export function shallowEqualValues(a: unknown, b: unknown) {
	if (typeof a === "number" && typeof b === "number") {
		if (Number.isNaN(a) && Number.isNaN(b)) return true;
	}
	return a === b;
}

export function getClearedValue<Row extends FormTableRow>(column: ColumnDef<Row>) {
	switch (column.cellType) {
		case "boolean":
		case "checkbox":
		case "toggle":
			return false;
		case "number":
		case "currency":
			return null;
		default:
			return "";
	}
}

export function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function defaultSortByField<Row extends FormTableRow>(field: ColumnField<Row>) {
	return (a: Row, b: Row) => {
		const valueA = a[field];
		const valueB = b[field];
		if (typeof valueA === "number" && typeof valueB === "number") {
			return valueA - valueB;
		}

		return String(valueA ?? "").localeCompare(String(valueB ?? ""), "es", {
			sensitivity: "base",
			numeric: true,
		});
	};
}

export function snapshotValues<Row extends FormTableRow>(
	rowOrder: string[],
	rowsById: Record<string, Row>
): FormValues<Row> {
	return {
		rowOrder: [...rowOrder],
		rowsById: rowOrder.reduce<Record<string, Row>>((acc, id) => {
			const row = rowsById[id];
			if (row) {
				acc[id] = { ...row };
			}
			return acc;
		}, {}),
	};
}

export function tableRowToCsv<Row extends FormTableRow>(row: Row, cols: ColumnDef<Row>[]) {
	const values = cols.map((col) => {
		const raw = row[col.field];
		if (typeof raw === "boolean") {
			return raw ? "true" : "false";
		}
		return raw ?? "";
	});

	return values
		.map((value) => {
			const safe = String(value ?? "");
			return `"${safe.replace(/"/g, '""')}"`;
		})
		.join(";");
}

export async function copyToClipboard(text: string) {
	if (typeof navigator === "undefined" || !navigator.clipboard) {
		console.warn("Clipboard API not available");
		return false;
	}
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error("copyToClipboard error", error);
		return false;
	}
}

export function formatDateSafe(date: Date, formatString: string) {
	try {
		return formatDate(date, formatString);
	} catch {
		return date.toISOString().slice(0, 10);
	}
}



