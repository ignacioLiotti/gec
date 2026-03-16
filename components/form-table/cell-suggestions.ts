import {
	formatDateAsDmy,
	formatDateAsIso,
	normalizeTextForDetection,
	parseFlexibleDateValue,
	parseLooseDateInput,
} from "@/lib/tablas";
import type {
	CellSuggestion,
	CellSuggestionDetectorArgs,
	CellSuggestionKind,
	CellType,
	ColumnDef,
	FormTableRow,
} from "./types";

function isAlreadyAcceptableSlashDate(value: string) {
	return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value.trim());
}

function describeDateSuggestion(
	inferredParts: Array<"day" | "month" | "year">,
	hasReferenceDate: boolean
) {
	if (inferredParts.length === 0) {
		return "Detectamos una fecha y la podemos normalizar al formato dd/mm/aaaa.";
	}

	if (inferredParts.length === 1 && inferredParts[0] === "year") {
		return hasReferenceDate
			? "Detectamos una fecha y completamos el año usando la fecha actual de la celda."
			: "Detectamos una fecha y completamos el año actual para normalizarla.";
	}

	if (inferredParts.length === 1 && inferredParts[0] === "day") {
		return hasReferenceDate
			? "Detectamos una fecha y completamos el día usando la fecha actual de la celda."
			: "Detectamos una fecha y usamos el día 01 para normalizarla.";
	}

	return "Detectamos una fecha y completamos las partes faltantes para normalizarla.";
}

function shouldAutoDetectDate<Row extends FormTableRow>(
	column: ColumnDef<Row>,
	cellType: CellType
) {
	if (cellType === "date") return true;
	if (cellType !== "text") return false;
	const haystack = normalizeTextForDetection(`${column.label} ${String(column.field)}`);
	return haystack.includes("fecha") || haystack.includes("date");
}

function buildDateSuggestion<Row extends FormTableRow>({
	rawValue,
	currentValue,
	cellType,
	column,
	row,
}: CellSuggestionDetectorArgs<Row>): CellSuggestion<Row> | null {
	const referenceDate = parseFlexibleDateValue(currentValue);
	const parsed = parseLooseDateInput(rawValue, {
		referenceDate,
	});
	if (!parsed) return null;

	const suggestedDisplayValue = formatDateAsDmy(parsed.date);
	if (parsed.inferredParts.length === 0 && isAlreadyAcceptableSlashDate(rawValue)) {
		return null;
	}
	if (rawValue.trim() === suggestedDisplayValue) {
		return null;
	}

	return {
		kind: "date",
		suggestedValue: cellType === "date" ? formatDateAsIso(parsed.date) : suggestedDisplayValue,
		suggestedDisplayValue,
		description: describeDateSuggestion(parsed.inferredParts, Boolean(referenceDate)),
		sourceInput: rawValue.trim(),
		column,
		row,
	};
}

function getBuiltInSuggestionKinds<Row extends FormTableRow>(
	column: ColumnDef<Row>,
	cellType: CellType
): CellSuggestionKind[] {
	const configured = column.cellConfig?.suggestionDetection;
	if (configured === false) return [];
	if (configured && configured !== "auto") return [configured];

	const kinds: CellSuggestionKind[] = [];
	if (shouldAutoDetectDate(column, cellType)) {
		kinds.push("date");
	}
	return kinds;
}

export function resolveCellSuggestion<Row extends FormTableRow>(
	args: CellSuggestionDetectorArgs<Row>
): CellSuggestion<Row> | null {
	const customDetectors = args.column.cellConfig?.suggestionDetectors ?? [];
	for (const detector of customDetectors) {
		const suggestion = detector(args);
		if (suggestion) return suggestion;
	}

	for (const kind of getBuiltInSuggestionKinds(args.column, args.cellType)) {
		if (kind === "date") {
			const suggestion = buildDateSuggestion(args);
			if (suggestion) return suggestion;
		}
	}

	return null;
}
