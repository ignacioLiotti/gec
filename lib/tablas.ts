export const TABLA_DATA_TYPES = [
	"text",
	"number",
	"currency",
	"boolean",
	"date",
] as const;
export type TablaColumnDataType = (typeof TABLA_DATA_TYPES)[number];

export type TablaSchemaColumn = {
	id?: string | null;
	fieldKey: string;
	dataType: TablaColumnDataType | string;
	config?: Record<string, unknown> | null;
};

export const MATERIALS_OCR_PROMPT = `Extraé una orden de compra de materiales en formato JSON siguiendo el esquema indicado.

Instrucciones:
- Cada ítem: cantidad (número), unidad (texto), material (texto), precioUnitario (número o null)
- Detectá y normalizá números con separador decimal coma.
- Encabezados posibles: "Cantidad", "Unidad", "Detalle Descriptivo del pedido", "Precio Unit", "Total".
- Extraé también si aparecen: nroOrden, solicitante, gestor, proveedor.
- No inventes ítems; solo lo legible.`;

export function normalizeFolderName(value: string) {
	const fallback = "";
	if (!value) return fallback;
	const normalized = value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9-_]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return normalized || fallback;
}

export function normalizeFolderPath(value: string) {
	if (!value) return "";
	const segments = value
		.split("/")
		.map((segment) => normalizeFolderName(segment))
		.filter(Boolean);
	return segments.join("/");
}

export function getParentFolderPath(value: string) {
	const normalized = normalizeFolderPath(value);
	if (!normalized) return "";
	const segments = normalized.split("/");
	segments.pop();
	return segments.join("/");
}

export function normalizeFieldKey(value: string) {
	const fallback = `col_${Math.random().toString(36).slice(2, 8)}`;
	if (!value) return fallback;
	const normalized = value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();
	const startsWithNumber = /^\d/.test(normalized);
	if (!normalized) return fallback;
	return startsWithNumber ? `c_${normalized}` : normalized;
}

export function defaultValueForType(type: TablaColumnDataType) {
	switch (type) {
		case "number":
		case "currency":
			return 0;
		case "boolean":
			return false;
		default:
			return "";
	}
}

const DOT_THOUSANDS_PATTERN = /^\d{1,3}(?:\.\d{3})+$/;
const COMMA_THOUSANDS_PATTERN = /^\d{1,3}(?:,\d{3})+$/;

function normalizeSeparatedNumber(value: string, separator: "." | ",") {
	const thousandsPattern =
		separator === "." ? DOT_THOUSANDS_PATTERN : COMMA_THOUSANDS_PATTERN;
	if (thousandsPattern.test(value)) {
		return value.replaceAll(separator, "");
	}

	const lastSeparatorIndex = value.lastIndexOf(separator);
	const integerPart = value.slice(0, lastSeparatorIndex).replaceAll(separator, "");
	const fractionPart = value.slice(lastSeparatorIndex + 1).replaceAll(separator, "");

	if (!fractionPart) {
		return integerPart || "0";
	}

	return `${integerPart || "0"}.${fractionPart}`;
}

export function normalizeNumericString(value: string): string | null {
	const compact = value.trim().replace(/\s+/g, "");
	if (!compact) return null;

	let sign = "";
	let body = compact;

	if (body.startsWith("(") && body.endsWith(")")) {
		sign = "-";
		body = body.slice(1, -1);
	}

	if (body.startsWith("+") || body.startsWith("-")) {
		if (body[0] === "-") {
			sign = "-";
		}
		body = body.slice(1);
	}

	body = body.replace(/[^\d.,]/g, "");
	if (!body || !/\d/.test(body)) return null;

	const hasComma = body.includes(",");
	const hasDot = body.includes(".");

	if (hasComma && hasDot) {
		const decimalSeparator = body.lastIndexOf(",") > body.lastIndexOf(".") ? "," : ".";
		const thousandsSeparator = decimalSeparator === "," ? "." : ",";
		const withoutThousands = body.replaceAll(thousandsSeparator, "");
		const normalizedBody = normalizeSeparatedNumber(
			withoutThousands,
			decimalSeparator
		);
		return `${sign}${normalizedBody}`;
	}

	if (hasComma) {
		return `${sign}${normalizeSeparatedNumber(body, ",")}`;
	}

	if (hasDot) {
		return `${sign}${normalizeSeparatedNumber(body, ".")}`;
	}

	return `${sign}${body}`;
}

export function parseLocalizedNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;

	const normalized = normalizeNumericString(value);
	if (!normalized) return null;

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

export function coerceValueForType(type: TablaColumnDataType, value: unknown) {
	if (value == null) {
		return type === "boolean" ? false : null;
	}
	switch (type) {
		case "number":
		case "currency": {
			const parsed = parseLocalizedNumber(value);
			return Number.isFinite(parsed) ? parsed : null;
		}
		case "boolean":
			if (typeof value === "boolean") return value;
			const stringValue = String(value).toLowerCase();
			return (
				stringValue === "true" || stringValue === "1" || stringValue === "sí"
			);
		case "date": {
			const date = new Date(value as string);
			return Number.isNaN(date.getTime()) ? null : date.toISOString();
		}
		default:
			return String(value);
	}
}

export function ensureTablaDataType(
	value: string | undefined
): TablaColumnDataType {
	if (!value) return "text";
	const lower = value.toLowerCase() as TablaColumnDataType;
	return (TABLA_DATA_TYPES as readonly string[]).includes(lower)
		? lower
		: "text";
}

export function toNumericValue(value: unknown): number | null {
	return parseLocalizedNumber(value);
}

/**
 * Evaluates intrarow formulas with the syntax:
 *   [col_a] - [col_b]
 *   ([avance] / [plan]) * 100
 */
export function evaluateTablaFormula(
	formula: string | null | undefined,
	values: Record<string, unknown>
): number | null {
	if (!formula || !formula.trim()) return null;
	let expression = formula;
	const references = formula.match(/\[[a-zA-Z_][a-zA-Z0-9_]*\]/g) ?? [];
	for (const ref of references) {
		const fieldKey = ref.slice(1, -1);
		const numeric = toNumericValue(values[fieldKey]) ?? 0;
		expression = expression.replaceAll(ref, String(numeric));
	}

	// Only allow arithmetic expressions after replacing references.
	if (!/^[0-9+\-*/().,\s]+$/.test(expression)) {
		return null;
	}

	try {
		const safe = expression.replace(/,/g, ".");
		const computed = Function(`"use strict"; return (${safe});`)();
		return typeof computed === "number" && Number.isFinite(computed)
			? computed
			: null;
	} catch {
		return null;
	}
}

export function remapTablaRowDataToSchema({
	previousData,
	nextColumns,
	previousFieldKeyByColumnId,
}: {
	previousData: Record<string, unknown> | null | undefined;
	nextColumns: TablaSchemaColumn[];
	previousFieldKeyByColumnId?: ReadonlyMap<string, string> | Record<string, string>;
}) {
	const sourceData = (previousData ?? {}) as Record<string, unknown>;
	const previousKeyMap =
		previousFieldKeyByColumnId instanceof Map
			? previousFieldKeyByColumnId
			: new Map(Object.entries(previousFieldKeyByColumnId ?? {}));
	const migratedData: Record<string, unknown> = {};

	for (const column of nextColumns) {
		const sourceKey =
			typeof column.id === "string" && column.id
				? previousKeyMap.get(column.id) ?? column.fieldKey
				: column.fieldKey;
		const rawValue = Object.prototype.hasOwnProperty.call(sourceData, sourceKey)
			? sourceData[sourceKey]
			: null;
		migratedData[column.fieldKey] = coerceValueForType(
			ensureTablaDataType(column.dataType),
			rawValue
		);
	}

	for (const [key, value] of Object.entries(sourceData)) {
		if (key.startsWith("__")) {
			migratedData[key] = value;
		}
	}

	for (const column of nextColumns) {
		const formula =
			typeof column.config?.formula === "string"
				? column.config.formula.trim()
				: "";
		if (!formula) continue;
		const computed = evaluateTablaFormula(formula, migratedData);
		migratedData[column.fieldKey] = coerceValueForType(
			ensureTablaDataType(column.dataType),
			computed
		);
	}

	return migratedData;
}
