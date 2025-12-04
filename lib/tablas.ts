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
