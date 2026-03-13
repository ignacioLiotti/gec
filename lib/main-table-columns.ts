import type { MainTableColumnConfig } from "@/components/form-table/configs/obras-detalle";
import { parseLocalizedNumber, toNumericValue } from "@/lib/tablas";

export const formatMainColumnValue = (
	value: unknown,
	cellType: MainTableColumnConfig["cellType"]
) => {
	if (value == null || value === "") return "—";
	if (cellType === "currency") {
		return new Intl.NumberFormat("es-AR", {
			style: "currency",
			currency: "ARS",
		}).format(toNumericValue(value) ?? 0);
	}
	if (cellType === "number") {
		return (toNumericValue(value) ?? 0).toLocaleString("es-AR");
	}
	if (cellType === "boolean" || cellType === "checkbox" || cellType === "toggle") {
		return Boolean(value) ? "Sí" : "No";
	}
	return String(value);
};

export const coerceMainColumnInputValue = (
	rawValue: string,
	cellType: MainTableColumnConfig["cellType"]
): unknown => {
	const normalized = rawValue.trim();
	if (!normalized) return null;
	if (cellType === "number" || cellType === "currency") {
		const parsed = parseLocalizedNumber(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}
	if (cellType === "boolean" || cellType === "checkbox" || cellType === "toggle") {
		if (normalized === "unset") return null;
		if (normalized === "true") return true;
		if (normalized === "false") return false;
		return null;
	}
	return rawValue;
};
