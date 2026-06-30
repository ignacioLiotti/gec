export const OBRAS_DETALLE_DEFAULT_ACTIVE_TAB_ID = "in-process";
export const OBRAS_DETALLE_ACTIVE_TAB_STORAGE_KEY = "excel:obras-detalle:active-tab";

export type ObrasDetalleActiveTab = "all" | "in-process" | "completed";

const VALID_OBRAS_DETALLE_ACTIVE_TABS = new Set<ObrasDetalleActiveTab>([
	"all",
	"in-process",
	"completed",
]);

export function parseObrasDetalleActiveTab(value: unknown): ObrasDetalleActiveTab | null {
	return typeof value === "string" && VALID_OBRAS_DETALLE_ACTIVE_TABS.has(value as ObrasDetalleActiveTab)
		? (value as ObrasDetalleActiveTab)
		: null;
}

export function readObrasDetalleActiveTabFromStorage(): ObrasDetalleActiveTab | null {
	if (typeof window === "undefined") return null;

	try {
		const raw = window.localStorage.getItem(OBRAS_DETALLE_ACTIVE_TAB_STORAGE_KEY);
		if (!raw) return null;

		try {
			return parseObrasDetalleActiveTab(JSON.parse(raw));
		} catch {
			return parseObrasDetalleActiveTab(raw);
		}
	} catch {
		return null;
	}
}

export function getObrasDetalleStatusParam(activeTab: ObrasDetalleActiveTab | null) {
	if (activeTab === "in-process" || activeTab === "completed") {
		return activeTab;
	}
	return null;
}
