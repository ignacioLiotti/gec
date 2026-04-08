export type ExcelLoadMode = "before" | "after-form" | "after-list";

export const EXCEL_LOAD_MODE_QUERY_PARAM = "excelLoadMode";
export const EXCEL_LOAD_MODE_ROUTES: Record<ExcelLoadMode, string> = {
	"before": "/excel",
	"after-form": "/excel/formtext",
	"after-list": "/excel/listtest",
};

export function buildExcelLoadModeHref(
	nextMode: ExcelLoadMode,
	rawQueryString?: string,
): string {
	const basePath = EXCEL_LOAD_MODE_ROUTES[nextMode];
	if (!rawQueryString) return basePath;
	const params = new URLSearchParams(rawQueryString);
	params.delete(EXCEL_LOAD_MODE_QUERY_PARAM);
	const query = params.toString();
	return query ? `${basePath}?${query}` : basePath;
}

export function resolveExcelLoadMode(
	rawValue: string | string[] | undefined,
	defaultMode: ExcelLoadMode,
): ExcelLoadMode {
	const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
	if (value === "before" || value === "after-form" || value === "after-list") {
		return value;
	}

	if (value === "full") {
		return "before";
	}

	if (value === "preview") {
		return "after-list";
	}

	if (value === "form") {
		return "after-form";
	}

	return defaultMode;
}
