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

const DATE_MONTH_INDEX: Record<string, number> = {
	ene: 0,
	enero: 0,
	feb: 1,
	febrero: 1,
	mar: 2,
	marzo: 2,
	abr: 3,
	abril: 3,
	may: 4,
	mayo: 4,
	jun: 5,
	junio: 5,
	jul: 6,
	julio: 6,
	ago: 7,
	agosto: 7,
	sep: 8,
	sept: 8,
	septiembre: 8,
	oct: 9,
	octubre: 9,
	nov: 10,
	noviembre: 10,
	dic: 11,
	diciembre: 11,
	jan: 0,
	february: 1,
	march: 2,
	apr: 3,
	april: 3,
	june: 5,
	july: 6,
	aug: 7,
	august: 7,
	septe: 8,
	september: 8,
	october: 9,
	november: 10,
	dec: 11,
	december: 11,
};

type ParsedLooseDate = {
	date: Date;
	inferredParts: Array<"day" | "month" | "year">;
};

function normalizeYear(year: number) {
	return year < 100 ? 2000 + year : year;
}

function buildLocalDate(year: number, monthIndex: number, day: number) {
	const date = new Date(year, monthIndex, day);
	if (
		Number.isNaN(date.getTime()) ||
		date.getFullYear() !== year ||
		date.getMonth() !== monthIndex ||
		date.getDate() !== day
	) {
		return null;
	}
	return date;
}

export function normalizeTextForDetection(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

export function formatDateAsDmy(value: Date) {
	const day = String(value.getDate()).padStart(2, "0");
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const year = value.getFullYear();
	return `${day}/${month}/${year}`;
}

export function formatDateAsIso(value: Date) {
	const day = String(value.getDate()).padStart(2, "0");
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const year = value.getFullYear();
	return `${year}-${month}-${day}`;
}

export function parseFlexibleDateValue(value: unknown): Date | null {
	if (!value) return null;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	const raw = String(value).trim();
	if (!raw) return null;

	const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
	if (isoMatch) {
		return buildLocalDate(
			Number(isoMatch[1]),
			Number(isoMatch[2]) - 1,
			Number(isoMatch[3])
		);
	}

	const numericMatch = raw.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})$/);
	if (numericMatch) {
		return buildLocalDate(
			normalizeYear(Number(numericMatch[3])),
			Number(numericMatch[2]) - 1,
			Number(numericMatch[1])
		);
	}

	const normalized = normalizeTextForDetection(raw).replace(/\./g, "");
	const textualMatch = normalized.match(
		/^(\d{1,2})(?:\s+de)?[\s/_-]+([a-z]+)(?:(?:\s+de)?[\s/_-]+(\d{2,4}))?$/
	);
	if (textualMatch?.[3]) {
		const monthIndex = DATE_MONTH_INDEX[textualMatch[2]];
		if (monthIndex != null) {
			return buildLocalDate(
				normalizeYear(Number(textualMatch[3])),
				monthIndex,
				Number(textualMatch[1])
			);
		}
	}

	return null;
}

export function parseLooseDateInput(
	value: string,
	options?: {
		referenceDate?: Date | null;
		fallbackYear?: number;
		defaultDay?: number;
	}
): ParsedLooseDate | null {
	const raw = value.trim();
	if (!raw) return null;

	const fullDate = parseFlexibleDateValue(raw);
	if (fullDate) {
		return { date: fullDate, inferredParts: [] };
	}

	const referenceDate = options?.referenceDate ?? null;
	const fallbackYear = options?.fallbackYear ?? new Date().getFullYear();
	const defaultDay = options?.defaultDay ?? 1;
	const normalized = normalizeTextForDetection(raw).replace(/\./g, "");

	const shortDateMatch = raw.match(/^(\d{1,2})[/. -](\d{1,2})$/);
	if (shortDateMatch) {
		const day = Number(shortDateMatch[1]);
		const monthIndex = Number(shortDateMatch[2]) - 1;
		const year = referenceDate?.getFullYear() ?? fallbackYear;
		const date = buildLocalDate(year, monthIndex, day);
		return date ? { date, inferredParts: ["year"] } : null;
	}

	const textualDayMonthMatch = normalized.match(
		/^(\d{1,2})(?:\s+de)?[\s/_-]+([a-z]+)(?:(?:\s+de)?[\s/_-]+(\d{2,4}))?$/
	);
	if (textualDayMonthMatch) {
		const monthIndex = DATE_MONTH_INDEX[textualDayMonthMatch[2]];
		if (monthIndex != null) {
			const year = textualDayMonthMatch[3]
				? normalizeYear(Number(textualDayMonthMatch[3]))
				: (referenceDate?.getFullYear() ?? fallbackYear);
			const date = buildLocalDate(year, monthIndex, Number(textualDayMonthMatch[1]));
			return date
				? {
					date,
					inferredParts: textualDayMonthMatch[3] ? [] : ["year"],
				}
				: null;
		}
	}

	const shortMonthYearMatch = normalized.match(/^([a-z]+)[\s/_-]*(\d{2,4})$/);
	if (shortMonthYearMatch) {
		const monthIndex = DATE_MONTH_INDEX[shortMonthYearMatch[1]];
		if (monthIndex != null) {
			const date = buildLocalDate(
				normalizeYear(Number(shortMonthYearMatch[2])),
				monthIndex,
				referenceDate?.getDate() ?? defaultDay
			);
			return date
				? {
					date,
					inferredParts: ["day"],
				}
				: null;
		}
	}

	const fullMonthYearMatch = normalized.match(
		/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|sept|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)[\s/_-]*(\d{2,4})$/
	);
	if (fullMonthYearMatch) {
		const monthIndex = DATE_MONTH_INDEX[fullMonthYearMatch[1]];
		if (monthIndex != null) {
			const date = buildLocalDate(
				normalizeYear(Number(fullMonthYearMatch[2])),
				monthIndex,
				referenceDate?.getDate() ?? defaultDay
			);
			return date
				? {
					date,
					inferredParts: ["day"],
				}
				: null;
		}
	}

	return null;
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
