export const TABLA_DATA_TYPES = [
	"text",
	"number",
	"currency",
	"boolean",
	"date",
] as const;
export type TablaColumnDataType = (typeof TABLA_DATA_TYPES)[number];

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

export function coerceValueForType(type: TablaColumnDataType, value: unknown) {
	if (value == null) {
		return type === "boolean" ? false : null;
	}
	switch (type) {
		case "number":
		case "currency": {
			const parsed =
				typeof value === "number"
					? value
					: Number(String(value).replace(",", "."));
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
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const normalized = value.trim().replace(",", ".");
		if (!normalized) return null;
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
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
