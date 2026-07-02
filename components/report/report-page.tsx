'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	FileDown,
	ChevronLeft,
	Filter,
	Settings,
	Loader2,
	FileSpreadsheet,
	Share2,
	Sparkles,
	Columns3,
	Layers,
	Eye,
	Save,
	Trash2,
	Search,
	BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import type {
	ReportConfig,
	ReportState,
	AggregationType,
	ReportColumn,
	ReportColumnType,
} from "./types";
import { ReportTable } from "./report-table";
import { generatePdf } from "@/lib/pdf/generate-pdf";
import { exportToCsv, exportToXlsx } from "@/lib/report/export";

type ReportPageProps<Row, Filters> = {
	config: ReportConfig<Row, Filters>;
	initialFilters?: Partial<Filters>;
	initialReportState?: Partial<ReportState>;
	initialCompareEnabled?: boolean;
	backUrl?: string;
	readOnly?: boolean;
};

type SavedReportPreset<Filters> = {
	id: string;
	name: string;
	filters?: Partial<Filters>;
	report_state?: Partial<ReportState>;
};

type SavedReportTemplate<Filters> = {
	id: string;
	name: string;
	payload?: {
		filters?: Partial<Filters>;
		reportState?: Partial<ReportState>;
	};
};

type ReportSidebarPanel = "settings" | "filters" | "columns" | "visual" | "presets";

function normalizeWizardLabel(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/\s+/g, "")
		.trim();
}

const DEFAULT_VISIBLE_FILTER_FIELDS = 7;
const DEFAULT_VISIBLE_COLUMN_CONTROLS = 9;

function hasFilterValue(value: unknown): boolean {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		return normalized.length > 0 && normalized !== "all";
	}
	return value != null && value !== false;
}

function getAggregationLabel(opt: AggregationType): string {
	if (opt === "none") return "Sin total";
	if (opt === "sum") return "Suma";
	if (opt === "count") return "Contar";
	if (opt === "count-checked") return "Contar marcados";
	if (opt === "average") return "Promedio";
	if (opt === "min") return "Minimo";
	return "Maximo";
}

const naturalSortCollator = new Intl.Collator("es", {
	numeric: true,
	sensitivity: "base",
});

function parseNumericValue(value: unknown): number | null {
	if (value == null) return null;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value !== "string") {
		const num = Number(value);
		return Number.isFinite(num) ? num : null;
	}

	let str = value.trim();
	if (!str) return null;

	let isNegative = false;
	if (str.startsWith("(") && str.endsWith(")")) {
		isNegative = true;
		str = str.slice(1, -1).trim();
	}

	str = str.replace(/[^\d,.-]/g, "");
	const hasComma = str.includes(",");
	const hasDot = str.includes(".");

	if (hasComma && hasDot) {
		str = str.replace(/\./g, "").replace(",", ".");
	} else if (hasComma && !hasDot) {
		str = str.replace(",", ".");
	} else if (hasDot && !hasComma) {
		const dotCount = (str.match(/\./g) ?? []).length;
		if (dotCount > 1) {
			str = str.replace(/\./g, "");
		}
	}

	const num = Number(str);
	if (!Number.isFinite(num)) return null;
	return isNegative ? -num : num;
}

function parseDateValue(value: unknown): number | null {
	if (value == null) return null;
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;

	const raw = value.trim();
	if (!raw) return null;
	const native = Date.parse(raw);
	if (!Number.isNaN(native)) return native;

	const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+.*)?$/);
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]) - 1;
	const year = Number(match[3]);
	const date = new Date(year, month, day);
	const ts = date.getTime();
	return Number.isNaN(ts) ? null : ts;
}

function resolveDefaultGroupAggregation(type: ReportColumnType): AggregationType {
	switch (type) {
		case "number":
		case "currency":
			return "sum";
		case "boolean":
			return "count-checked";
		case "date":
			return "max";
		default:
			return "count";
	}
}

function resolveGroupSortValue<Row>(
	rows: Row[],
	column: ReportColumn<Row>,
	configuredAggregation: AggregationType | undefined
): string | number | null {
	const aggregation =
		configuredAggregation && configuredAggregation !== "none"
			? configuredAggregation
			: resolveDefaultGroupAggregation(column.type);
	const values = rows.map((row) => column.accessor(row));

	if (aggregation === "count") {
		return values.filter((value) => value != null && value !== "").length;
	}
	if (aggregation === "count-checked") {
		return values.filter((value) => value === true).length;
	}

	if (column.type === "date") {
		const timestamps = values
			.map((value) => parseDateValue(value))
			.filter((value): value is number => value != null && Number.isFinite(value));
		if (timestamps.length === 0) return null;
		if (aggregation === "min") return Math.min(...timestamps);
		if (aggregation === "average") {
			return timestamps.reduce((acc, value) => acc + value, 0) / timestamps.length;
		}
		return Math.max(...timestamps);
	}

	const numericValues = values
		.map((value) => parseNumericValue(value))
		.filter((value): value is number => value != null && Number.isFinite(value));

	if (numericValues.length > 0) {
		if (aggregation === "min") return Math.min(...numericValues);
		if (aggregation === "max") return Math.max(...numericValues);
		if (aggregation === "average") {
			return numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length;
		}
		return numericValues.reduce((acc, value) => acc + value, 0);
	}

	const textValues = values
		.map((value) => String(value ?? "").trim())
		.filter((value) => value.length > 0);
	if (textValues.length === 0) return null;
	return [...textValues].sort((left, right) => naturalSortCollator.compare(left, right))[0];
}

function compareGroupSortValues(
	left: string | number | null,
	right: string | number | null,
	direction: "asc" | "desc"
): number {
	const dir = direction === "asc" ? 1 : -1;
	if (left == null && right == null) return 0;
	if (left == null) return dir;
	if (right == null) return -dir;
	if (typeof left === "number" && typeof right === "number") {
		return dir * (left - right);
	}
	return dir * naturalSortCollator.compare(String(left), String(right));
}

export function ReportPage<Row, Filters extends Record<string, unknown>>({
	config,
	initialFilters,
	initialReportState,
	initialCompareEnabled,
	backUrl,
	readOnly = false,
}: ReportPageProps<Row, Filters>) {
	const router = useRouter();
  const { back, push } = router;
	const reportContentRef = useRef<HTMLDivElement>(null);
	const localStorageKey = `report:last:${config.id}`;

	const readLocalSnapshot = () => {
		if (typeof window === "undefined") return null as null | {
			filters?: Partial<Filters>;
			reportState?: Partial<ReportState>;
			compareEnabled?: boolean;
		};
		try {
			const raw = window.localStorage.getItem(localStorageKey);
			if (!raw) return null;
			return JSON.parse(raw) as {
				filters?: Partial<Filters>;
				reportState?: Partial<ReportState>;
				compareEnabled?: boolean;
			};
		} catch {
			return null;
		}
	};
	const localSnapshot = readLocalSnapshot();

	// Stabilize config reference
	const configRef = useRef(config);
	configRef.current = config;

	// Data state
	const [data, setData] = useState<Row[]>([]);
	const [compareData, setCompareData] = useState<Row[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
	const [isSharing, setIsSharing] = useState(false);
	const [isExportingXlsx, setIsExportingXlsx] = useState(false);
	const [presets, setPresets] = useState<SavedReportPreset<Filters>[]>([]);
	const [templates, setTemplates] = useState<SavedReportTemplate<Filters>[]>([]);
	const [presetName, setPresetName] = useState("");
	const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
	const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [shareExpiryDays, setShareExpiryDays] = useState<string>("7");
	const [showAllFilters, setShowAllFilters] = useState(false);
	const [showAllColumns, setShowAllColumns] = useState(false);
	const [activePanel, setActivePanel] = useState<ReportSidebarPanel>("settings");
	const [isCompareEnabled, setIsCompareEnabled] = useState(
		typeof localSnapshot?.compareEnabled === "boolean"
			? localSnapshot.compareEnabled
			: Boolean(initialCompareEnabled)
	);
	const [, startFetchTransition] = useTransition();

	// Filters state
	const [filters, setFilters] = useState<Filters>(() => {
		const defaults = config.defaultFilters?.() ?? ({} as Filters);
		return {
			...defaults,
			...(localSnapshot?.filters ?? {}),
			...initialFilters,
		};
	});
	const [draftFilters, setDraftFilters] = useState<Filters>(() => {
		const defaults = config.defaultFilters?.() ?? ({} as Filters);
		return {
			...defaults,
			...(localSnapshot?.filters ?? {}),
			...initialFilters,
		};
	});

	// Report display state
	const [reportState, setReportState] = useState<ReportState>(() => {
		const baseState: ReportState = {
			companyName: "Nombre de la empresa",
			description: config.description || `Reporte de ${config.title}`,
			date: new Date().toLocaleDateString("es-AR"),
			viewMode: "full",
			hiddenColumnIds: [],
			sortColumnId: null,
			sortDirection: "asc",
			groupSortColumnId: null,
			groupSortDirection: "asc",
			aggregations: config.columns.reduce<Record<string, AggregationType>>(
				(acc, col) => {
					acc[col.id] = col.defaultAggregation || "none";
					return acc;
				},
				{}
			),
			summaryDisplay: "row",
			showMiniCharts: true,
			summaryChartType: "bar",
		};
		return {
			...baseState,
			...(localSnapshot?.reportState ?? {}),
			...(initialReportState ?? {}),
		};
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(
				localStorageKey,
				JSON.stringify({
					filters,
					reportState,
					compareEnabled: isCompareEnabled,
				})
			);
		} catch {
			// ignore persistence failures
		}
	}, [filters, isCompareEnabled, localStorageKey, reportState]);

	// Fetch data
	const fetchData = useCallback(async () => {
		try {
			setIsLoading(true);
			const currentResult = await configRef.current.fetchData(filters);
			setData(currentResult);
			if (configRef.current.compare && isCompareEnabled) {
				const compareFilters = configRef.current.compare.buildCompareFilters(filters);
				if (compareFilters) {
					const previousResult = await configRef.current.fetchData(compareFilters);
					setCompareData(previousResult);
				} else {
					setCompareData(null);
				}
			} else {
				setCompareData(null);
			}
		} catch (err) {
			console.error(err);
			toast.error("Error al cargar datos para el reporte");
		} finally {
			setIsLoading(false);
		}
	}, [filters, isCompareEnabled]);

	useEffect(() => {
		startFetchTransition(() => {
			void fetchData();
		});
	}, [fetchData]);

	const loadPresets = useCallback(async () => {
		try {
			const res = await fetch(`/api/reports/presets?reportKey=${configRef.current.id}`);
			if (!res.ok) throw new Error("No se pudieron cargar los presets");
			const payload = (await res.json()) as { presets?: SavedReportPreset<Filters>[] };
			setPresets(payload.presets ?? []);
		} catch (err) {
			console.error(err);
		}
	}, []);

	const loadTemplates = useCallback(async () => {
		try {
			const res = await fetch(`/api/reports/templates?reportKey=${configRef.current.id}`);
			if (!res.ok) throw new Error("No se pudieron cargar las plantillas");
			const payload = (await res.json()) as { templates?: SavedReportTemplate<Filters>[] };
			setTemplates(payload.templates ?? []);
		} catch (err) {
			console.error(err);
		}
	}, []);

	useEffect(() => {
		if (readOnly) return;
		void loadPresets();
		void loadTemplates();
	}, [loadPresets, loadTemplates, readOnly]);

	// Handle PDF generation
	const handleGeneratePdf = useCallback(async () => {
		if (!reportContentRef.current) {
			toast.error("No se pudo capturar el contenido del reporte");
			return;
		}

		setIsGeneratingPdf(true);
		toast.info("Generando PDF...");

		try {
			const result = await generatePdf(reportContentRef.current, {
				companyName: reportState.companyName,
				reportTitle: reportState.description,
				date: reportState.date,
				format: "A4",
				landscape: false,
			});

			if (result.success) {
				toast.success("PDF generado correctamente");
			} else {
				toast.error(result.error || "Error al generar el PDF");
			}
		} catch (error) {
			console.error("PDF generation error:", error);
			toast.error("Error inesperado al generar el PDF");
		} finally {
			setIsGeneratingPdf(false);
		}
	}, [reportState.companyName, reportState.description, reportState.date]);

	const handleExportCsv = useCallback(() => {
		const visibleColumns = config.columns.filter(
			(col) => !reportState.hiddenColumnIds.includes(col.id)
		);
		exportToCsv(data, visibleColumns, config.title, {
			title: reportState.description,
			companyName: reportState.companyName,
			date: reportState.date,
			generatedAt: new Date().toLocaleString("es-AR"),
			viewMode: reportState.viewMode,
			filters,
		});
	}, [config.columns, config.title, data, filters, reportState.companyName, reportState.date, reportState.description, reportState.hiddenColumnIds, reportState.viewMode]);

	const handleExportXlsx = useCallback(async () => {
		try {
			setIsExportingXlsx(true);
			const visibleColumns = config.columns.filter(
				(col) => !reportState.hiddenColumnIds.includes(col.id)
			);
			await exportToXlsx(data, visibleColumns, config.title, {
				title: reportState.description,
				companyName: reportState.companyName,
				date: reportState.date,
				generatedAt: new Date().toLocaleString("es-AR"),
				viewMode: reportState.viewMode,
				filters,
			});
		} catch (err) {
			console.error(err);
			toast.error("No se pudo exportar a Excel");
		} finally {
			setIsExportingXlsx(false);
		}
	}, [config.columns, config.title, data, filters, reportState.companyName, reportState.date, reportState.description, reportState.hiddenColumnIds, reportState.viewMode]);

	const handleSavePreset = useCallback(async () => {
		const name = presetName.trim();
		if (!name) {
			toast.error("Ingresá un nombre para el preset");
			return;
		}
		try {
			const res = await fetch("/api/reports/presets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					reportKey: config.id,
					name,
					filters,
					reportState,
				}),
			});
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload.error || "No se pudo guardar el preset");
			}
			setPresetName("");
			await loadPresets();
			toast.success("Preset guardado");
		} catch (err) {
			console.error(err);
			toast.error(err instanceof Error ? err.message : "No se pudo guardar el preset");
		}
	}, [config.id, filters, loadPresets, presetName, reportState]);

	const handleApplyPreset = useCallback((preset: SavedReportPreset<Filters>) => {
		const nextFilters = (prev: Filters) => ({ ...prev, ...(preset.filters ?? {}) });
		setFilters(nextFilters);
		setDraftFilters(nextFilters);
		if (preset.report_state) {
			setReportState((prev) => ({
				...prev,
				...preset.report_state,
			}));
		}
		setSelectedPresetId(preset.id);
		toast.success("Preset aplicado");
	}, []);

	const handleApplyTemplate = useCallback((template: SavedReportTemplate<Filters>) => {
		const payload = template.payload;
		if (payload?.filters) {
			const nextFilters = (prev: Filters) => ({ ...prev, ...(payload.filters ?? {}) });
			setFilters(nextFilters);
			setDraftFilters(nextFilters);
		}
		if (payload?.reportState) {
			setReportState((prev) => ({ ...prev, ...payload.reportState }));
		}
		toast.success("Plantilla aplicada");
	}, []);

	const handleDeletePreset = useCallback(
		async (presetId: string) => {
			try {
				const res = await fetch(`/api/reports/presets?id=${presetId}`, {
					method: "DELETE",
				});
				if (!res.ok) {
					const payload = await res.json().catch(() => ({}));
					throw new Error(payload.error || "No se pudo eliminar el preset");
				}
				if (selectedPresetId === presetId) {
					setSelectedPresetId(null);
				}
				await loadPresets();
				toast.success("Preset eliminado");
			} catch (err) {
				console.error(err);
				toast.error(
					err instanceof Error ? err.message : "No se pudo eliminar el preset"
				);
			}
		},
		[loadPresets, selectedPresetId]
	);

	const handleResetFilters = useCallback(() => {
		const defaults = config.defaultFilters?.() ?? ({} as Filters);
		setDraftFilters(defaults);
		setFilters(defaults);
		toast.success("Filtros reiniciados");
	}, [config]);

	const handleSaveFiltersOnly = useCallback(async () => {
		if (readOnly) return;
		const suggested = `Filtros ${new Date().toLocaleDateString("es-AR")}`;
		const name = window.prompt("Nombre para guardar este filtro", suggested)?.trim();
		if (!name) return;
		try {
			const res = await fetch("/api/reports/presets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					reportKey: config.id,
					name,
					filters,
					reportState: {},
				}),
			});
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				throw new Error(payload.error || "No se pudo guardar el filtro");
			}
			await loadPresets();
			toast.success("Filtro guardado");
		} catch (err) {
			console.error(err);
			toast.error(err instanceof Error ? err.message : "No se pudo guardar el filtro");
		}
	}, [config.id, filters, loadPresets, readOnly]);

	const handleCreateShareLink = useCallback(async () => {
		try {
			setIsSharing(true);
			const expiresAt =
				shareExpiryDays === "never"
					? null
					: new Date(Date.now() + Number(shareExpiryDays) * 24 * 60 * 60 * 1000).toISOString();
			const res = await fetch("/api/reports/share", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					reportKey: config.id,
					presetId: selectedPresetId,
					expiresAt,
					payload: {
						filters,
						reportState,
						compareEnabled: isCompareEnabled,
						shareMeta: config.shareMeta ?? null,
					},
				}),
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(payload.error || "No se pudo crear el enlace");
			}
			const fullUrl = payload.url
				? `${window.location.origin}${payload.url}`
				: null;
			setShareUrl(fullUrl);
			toast.success("Enlace generado");
		} catch (err) {
			console.error(err);
			toast.error(err instanceof Error ? err.message : "No se pudo generar el enlace");
		} finally {
			setIsSharing(false);
		}
	}, [config.id, config.shareMeta, filters, isCompareEnabled, reportState, selectedPresetId, shareExpiryDays]);

	// Handle sorting
	const handleSort = useCallback((columnId: string) => {
		setReportState((prev) => ({
			...prev,
			sortColumnId: columnId,
			sortDirection:
				prev.sortColumnId === columnId && prev.sortDirection === "asc"
					? "desc"
					: "asc",
		}));
	}, []);

	// Toggle column visibility
	const toggleColumnVisibility = useCallback((columnId: string) => {
		setReportState((prev) => ({
			...prev,
			hiddenColumnIds: prev.hiddenColumnIds.includes(columnId)
				? prev.hiddenColumnIds.filter((id) => id !== columnId)
				: [...prev.hiddenColumnIds, columnId],
		}));
	}, []);

	// Set aggregation for a column
	const setAggregation = useCallback((columnId: string, aggType: AggregationType) => {
		setReportState((prev) => ({
			...prev,
			aggregations: { ...prev.aggregations, [columnId]: aggType },
		}));
	}, []);

	const getAggregationOptions = useCallback((type: string) => {
		switch (type) {
			case "number":
			case "currency":
				return ["none", "sum", "count", "average", "min", "max"];
			case "boolean":
				return ["none", "count", "count-checked"];
			case "date":
				return ["none", "count", "min", "max", "average"];
			default:
				return ["none", "count"];
		}
	}, []);

	// Stable column references
	const columns = useMemo(() => config.columns, [config.columns]);
	const autoGroupByOptions = useMemo(() => {
		return columns
			.filter((col) => col.groupable)
			.map((col) => ({
				id: `col-${col.id}`,
				label: `Agrupar por ${col.label}`,
				groupBy: (row: Row) => {
					const value = col.accessor(row);
					if (value == null || value === "") return "Sin asignar";
					return String(value);
				},
			}));
	}, [columns]);

	const groupByOptions = useMemo(() => {
		const base = config.groupByOptions ?? [];
		const existingIds = new Set(base.map((opt) => opt.id));
		const merged = [...base];
		for (const opt of autoGroupByOptions) {
			if (!existingIds.has(opt.id)) merged.push(opt);
		}
		return merged;
	}, [config.groupByOptions, autoGroupByOptions]);
	const filterFields = useMemo(() => config.filterFields, [config.filterFields]);
	const suggestedTemplates = useMemo(() => {
		if (!config.templateCategory) return [];
		const hideAllExcept = (keepIds: string[]) =>
			columns
				.map((col) => col.id)
				.filter((id) => !keepIds.includes(id));
		const byType = (types: string[]) =>
			columns.filter((col) => types.includes(col.type)).map((col) => col.id);
		const templates: SavedReportTemplate<Filters>[] = [];
		if (config.templateCategory === "obras") {
			templates.push({
				id: "obras-resumen-financiero",
				name: "Resumen financiero",
				payload: {
					reportState: {
						viewMode: "full",
						hiddenColumnIds: hideAllExcept([
							"designacionYUbicacion",
							"contratoMasAmpliaciones",
							"certificadoALaFecha",
							"saldoACertificar",
						]),
					},
				},
			});
			templates.push({
				id: "obras-por-estado",
				name: "Agrupar por estado",
				payload: { reportState: { viewMode: "by-estado" } },
			});
		}
		if (config.templateCategory === "certificados") {
			templates.push({
				id: "certificados-cobranza",
				name: "Seguimiento de cobranza",
				payload: {
					reportState: {
						viewMode: "by-ente",
						hiddenColumnIds: hideAllExcept([
							"obraName",
							"ente",
							"monto",
							"facturado",
							"cobrado",
							"fecha_facturacion",
							"vencimiento",
						]),
					},
				},
			});
		}
		if (config.templateCategory === "ocr-tabla") {
			const numericCols = byType(["currency", "number"]);
			if (numericCols.length) {
				templates.push({
					id: "ocr-montos",
					name: "Solo montos",
					payload: {
						reportState: {
							hiddenColumnIds: hideAllExcept(numericCols),
						},
					},
				});
			}
		}
		if (config.templateCategory === "macro") {
			templates.push({
				id: "macro-resumen",
				name: "Resumen general",
				payload: { reportState: { viewMode: "full" } },
			});
		}
		return templates;
	}, [columns, config.templateCategory]);

	// Shared grouping helper using Map for O(n) grouping (avoids Object.entries + sort overhead)
	const groupRows = useCallback(
		(rows: Row[]): Array<{ key: string; data: Row[] }> => {
			if (reportState.viewMode === "full") {
				return [{ key: config.title, data: rows }];
			}

			const groupOption = groupByOptions?.find(
				(opt) => opt.id === reportState.viewMode
			);
			if (!groupOption) {
				return [{ key: config.title, data: rows }];
			}

			// Use Map for insertion-order and O(1) lookup
			const groups = new Map<string, Row[]>();
			for (const row of rows) {
				const key = groupOption.groupBy(row) || "Sin asignar";
				const existing = groups.get(key);
				if (existing) {
					existing.push(row);
				} else {
					groups.set(key, [row]);
				}
			}

			const grouped = Array.from(groups.entries()).map(([key, data]) => ({
				key,
				data,
			}));
			const groupSortColumn = reportState.groupSortColumnId
				? columns.find((column) => column.id === reportState.groupSortColumnId) ?? null
				: null;

			if (!groupSortColumn) {
				return grouped.sort((left, right) =>
					naturalSortCollator.compare(left.key, right.key)
				);
			}

			const configuredAggregation = reportState.aggregations[groupSortColumn.id];
			const metricByKey = new Map<string, string | number | null>();
			for (const group of grouped) {
				metricByKey.set(
					group.key,
					resolveGroupSortValue(group.data, groupSortColumn, configuredAggregation)
				);
			}

			return grouped.sort((left, right) => {
				const leftMetric = metricByKey.get(left.key) ?? null;
				const rightMetric = metricByKey.get(right.key) ?? null;
				const metricDiff = compareGroupSortValues(
					leftMetric,
					rightMetric,
					reportState.groupSortDirection
				);
				if (metricDiff !== 0) return metricDiff;
				return naturalSortCollator.compare(left.key, right.key);
			});
		},
		[
			columns,
			config.title,
			groupByOptions,
			reportState.aggregations,
			reportState.groupSortColumnId,
			reportState.groupSortDirection,
			reportState.viewMode,
		]
	);

	// Group data
	const groupedData = useMemo(
		() => groupRows(data),
		[data, groupRows]
	);

	const compareGroupedData = useMemo(
		() => (compareData ? groupRows(compareData) : null),
		[compareData, groupRows]
	);

	const compareLookup = useMemo(() => {
		if (!compareGroupedData) return new Map<string, Row[]>();
		return new Map(compareGroupedData.map((group) => [group.key, group.data]));
	}, [compareGroupedData]);


	// Visible columns
	const visibleColumns = useMemo(
		() => columns.filter((col) => !reportState.hiddenColumnIds.includes(col.id)),
		[columns, reportState.hiddenColumnIds]
	);

	const activeFilterCount = useMemo(() => {
		return (filterFields ?? []).reduce(
			(count, field) => count + (hasFilterValue(filters[field.id]) ? 1 : 0),
			0
		);
	}, [filterFields, filters]);

	const priorityColumnIds = useMemo(() => {
		const ids = new Set<string>();
		for (const col of columns) {
			const normalizedLabel = normalizeWizardLabel(col.label);
			const isPriority =
				normalizedLabel === "obra" ||
				normalizedLabel.includes("documento") ||
				normalizedLabel.includes("unidad") ||
				normalizedLabel.includes("cantidad") ||
				normalizedLabel.includes("descripcion") ||
				normalizedLabel.includes("descriptivo") ||
				(normalizedLabel.includes("precio") && normalizedLabel.includes("total"));
			if (isPriority) ids.add(col.id);
		}
		return ids;
	}, [columns]);

	const displayedColumns = useMemo(() => {
		if (showAllColumns || columns.length <= DEFAULT_VISIBLE_COLUMN_CONTROLS) return columns;
		return columns.filter(
			(col, index) =>
				index < DEFAULT_VISIBLE_COLUMN_CONTROLS || priorityColumnIds.has(col.id)
		);
	}, [columns, priorityColumnIds, showAllColumns]);

	const hiddenColumnControlCount = columns.length - displayedColumns.length;

	const displayedFilterFields = useMemo(() => {
		const fields = filterFields ?? [];
		if (showAllFilters || fields.length <= DEFAULT_VISIBLE_FILTER_FIELDS) return fields;
		return fields.filter((field, index) => {
			const fieldId = normalizeWizardLabel(String(field.id));
			const fieldLabel = normalizeWizardLabel(field.label);
			const isSearch = fieldId === "search" || fieldLabel.includes("buscar");
			const isDescription =
				fieldId.includes("descripcion") ||
				fieldLabel.includes("descripcion") ||
				fieldLabel.includes("descriptivo");
			const isActive =
				hasFilterValue(filters[field.id]) || hasFilterValue(draftFilters[field.id]);
			return index < DEFAULT_VISIBLE_FILTER_FIELDS || isSearch || isDescription || isActive;
		});
	}, [draftFilters, filterFields, filters, showAllFilters]);

	const hiddenFilterFieldCount = (filterFields?.length ?? 0) - displayedFilterFields.length;

	const activeGroupLabel = useMemo(() => {
		if (reportState.viewMode === "full") return "Sin agrupar";
		return groupByOptions.find((opt) => opt.id === reportState.viewMode)?.label ?? "Agrupado";
	}, [groupByOptions, reportState.viewMode]);

	const quickFilterField = useMemo(() => {
		return (
			(filterFields ?? []).find((field) => {
				const fieldId = normalizeWizardLabel(String(field.id));
				const fieldLabel = normalizeWizardLabel(field.label);
				return (
					field.type === "text" &&
					(fieldId === "search" ||
						fieldLabel.includes("buscar") ||
						fieldId.includes("descripcion") ||
						fieldLabel.includes("descripcion") ||
						fieldLabel.includes("descriptivo"))
				);
			}) ?? null
		);
	}, [filterFields]);

	const quickColumnToggles = useMemo(() => {
		const preferred = columns.filter((col) => {
			const normalizedLabel = normalizeWizardLabel(col.label);
			return (
				normalizedLabel.includes("documento") ||
				normalizedLabel.includes("unidad") ||
				normalizedLabel.includes("cantidad")
			);
		});
		return (preferred.length > 0 ? preferred : columns.slice(0, 3)).slice(0, 3);
	}, [columns]);

	const quickTotalColumn = useMemo(() => {
		const totalColumn =
			columns.find((col) => normalizeWizardLabel(col.label) === "preciototal") ??
			columns.find((col) => {
				const normalizedLabel = normalizeWizardLabel(col.label);
				return normalizedLabel.includes("precio") && normalizedLabel.includes("total");
			}) ??
			columns.find((col) => {
				const normalizedLabel = normalizeWizardLabel(col.label);
				return normalizedLabel.includes("total");
			});
		return totalColumn ?? columns.find((col) => col.type === "currency" || col.type === "number") ?? null;
	}, [columns]);

	const quickGroupOptions = useMemo(() => groupByOptions.slice(0, 3), [groupByOptions]);

	const sectionClassName =
		"rounded-lg border border-[#d7dce2] bg-[#f8f9fb] p-3 shadow-[0_1px_0_rgba(255,255,255,.92)_inset,0_8px_18px_rgba(30,41,59,.06)]";
	const sectionHeaderClassName =
		"text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8a29e]";
	const inputClassName =
		"h-8 border-[#d9dee5] bg-white text-xs text-[#1f2937] shadow-[inset_0_1px_2px_rgba(30,41,59,.05)]";
	const softButtonClassName =
		"h-8 border-[#d9dee5] bg-[#f9fafb] text-[11px] text-[#334155] hover:bg-white active:scale-[0.98]";
	const activeButtonClassName =
		"h-8 bg-[#1f2937] text-[11px] text-[#f8fafc] hover:bg-[#111827] active:scale-[0.98]";
	const dockButtonClassName =
		"min-h-[76px] rounded-lg border border-[#d7dce2] bg-[#f8f9fb] p-3 text-left shadow-[0_1px_0_rgba(255,255,255,.92)_inset,0_8px_18px_rgba(30,41,59,.06)] transition duration-150 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_1px_0_rgba(255,255,255,.96)_inset,0_12px_24px_rgba(30,41,59,.09)] active:translate-y-0 active:scale-[0.985]";

	// Handle back navigation
	const handleBack = useCallback(() => {
		if (backUrl) {
			push(backUrl);
		} else {
			back();
		}
	}, [back, backUrl, push]);

	return (
		<Fragment>
			<div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#d7dce2]">
				{/* Main Content - Report Preview */}
				<div className="relative flex min-w-0 flex-1 flex-col bg-[#f3f4f5] dark:bg-zinc-900">
					{/* Toolbar */}
					<div className="no-print flex shrink-0 items-center gap-3 border-b border-[#d7dce2] bg-[#f0f1f3] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.86)] dark:border-zinc-700 dark:bg-zinc-800">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleBack}
							className="gap-1.5 text-[#1f2937] hover:bg-[#e5e7eb] dark:text-zinc-300 dark:hover:bg-zinc-700"
						>
							<ChevronLeft className="size-4" />
							Volver
						</Button>
						<div className="hidden items-center gap-2 text-xs text-[#78716c] md:flex">
							<span className="size-2 rounded-full bg-[#ff5800]" />
							<span className="font-mono">{data.length} filas</span>
							<span className="text-[#cbd5e1]">/</span>
							<span>{activeGroupLabel}</span>
						</div>
						<div
							className="ml-auto flex items-center gap-2"
							data-wizard-target="report-export-actions"
						>
							<Button
								variant="outline"
								size="sm"
								onClick={handleExportCsv}
								disabled={isLoading}
								className="gap-2"
							>
								<FileSpreadsheet className="size-4" />
								CSV
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleExportXlsx}
								disabled={isLoading || isExportingXlsx}
								className="gap-2"
							>
								{isExportingXlsx ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<FileSpreadsheet className="size-4" />
								)}
								Excel
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsShareDialogOpen(true)}
								disabled={readOnly || isLoading}
								className="gap-2"
							>
								<Share2 className="size-4" />
								Compartir
							</Button>
							<Button
								onClick={handleGeneratePdf}
								disabled={isGeneratingPdf || isLoading}
								size="sm"
								className="gap-2 bg-[#1f2937] text-[#f8fafc] hover:bg-[#111827] dark:bg-zinc-600 dark:hover:bg-zinc-500"
							>
								{isGeneratingPdf ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<FileDown className="size-4" />
								)}
								{isGeneratingPdf ? "Generando..." : "Descargar PDF"}
							</Button>
						</div>
					</div>

					{/* Paper area */}
					<div data-wizard-target="report-preview-area" className="flex flex-1 justify-center overflow-auto px-4 py-8">
						<div ref={reportContentRef} className="flex flex-col gap-8">
							{isLoading ? (
								<div className="report-paper pdf-preview ">
									<div className="report-body flex items-center justify-center py-16">
										<Loader2 className="size-6 animate-spin text-[#a8a29e]" />
									</div>
								</div>
							) : groupedData.length === 0 ? (
								<div className="report-paper pdf-preview ">
									<div className="report-body flex items-center justify-center py-20 text-[#78716c]">
										Sin datos para mostrar
									</div>
								</div>
							) : (
								<div className="report-paper pdf-preview ">
									{/* Decorative top border - double line */}
									<div className="report-border-top" />

									{/* Document Header */}
									<div className="report-header-block">
										<div className="report-brand">
											<span className="report-brand-dot" />
											<div>
												<div className="report-company">
													{reportState.companyName}
												</div>
												<div className="report-kicker">Sintesis</div>
											</div>
										</div>
										<div className="report-doc-head">
											<p className="report-doc-title">Reporte</p>
											<p className="report-title-text">
												{reportState.description}
											</p>
											<p className="report-date-text font-mono">
												<span>Emitido</span>
												<span>{reportState.date}</span>
											</p>
										</div>
										<div className="report-divider" />
									</div>

									{/* Report Tables */}
									<div className="report-body">
										{groupedData.map(({ key, data: groupData }) => (
											<ReportTable
												key={key}
												title={key}
												data={groupData}
												compareData={compareLookup.get(key) ?? null}
												showCompare={Boolean(config.compare && isCompareEnabled)}
												columns={columns}
												hiddenColumnIds={reportState.hiddenColumnIds}
												sortColumnId={reportState.sortColumnId}
												sortDirection={reportState.sortDirection}
												onSort={handleSort}
												aggregations={reportState.aggregations}
												summaryDisplay={reportState.summaryDisplay}
												showMiniCharts={reportState.showMiniCharts}
												summaryChartType={reportState.summaryChartType}
												getRowId={configRef.current.getRowId}
												getRowClassName={configRef.current.getRowClassName}
												currencyLocale={config.currencyLocale}
												currencyCode={config.currencyCode}
											/>
										))}
									</div>

									{/* Footer line */}
									<div className="report-footer-line" />
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Sidebar - Report Workshop */}
				<div className="no-print flex w-[22.5rem] shrink-0 flex-col border-l border-[#d7dce2] bg-[#eef0f2] shadow-[inset_1px_0_0_rgba(255,255,255,.72)] dark:border-zinc-700 dark:bg-zinc-800">
					<Tabs
						value={activePanel}
						onValueChange={(value) => setActivePanel(value as ReportSidebarPanel)}
						className="flex min-h-0 flex-1 flex-col"
					>
						<div className="border-b border-[#d7dce2] bg-[#f0f1f3] px-4 pb-3 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] dark:border-zinc-700 dark:bg-zinc-800">
							<div className="flex items-start gap-3">
								<span className="mt-1 size-3 shrink-0 rounded-full bg-[#ff5800] shadow-[0_0_0_3px_rgba(255,88,0,.12)]" />
								<div className="min-w-0">
									<p className={sectionHeaderClassName}>Taller del reporte</p>
									<h2 className="truncate text-sm font-semibold text-[#1c1917] dark:text-zinc-100">
										{config.title}
									</h2>
								</div>
							</div>
							<div className="mt-3 grid grid-cols-3 gap-2">
								<div className="rounded-md border border-[#d7dce2] bg-white/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
									<div className="font-mono text-sm font-semibold text-[#1c1917]">{data.length}</div>
									<div className="text-[10px] uppercase tracking-[0.12em] text-[#a8a29e]">filas</div>
								</div>
								<div className="rounded-md border border-[#d7dce2] bg-white/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
									<div className="font-mono text-sm font-semibold text-[#1c1917]">
										{visibleColumns.length}/{columns.length}
									</div>
									<div className="text-[10px] uppercase tracking-[0.12em] text-[#a8a29e]">cols</div>
								</div>
								<div className="rounded-md border border-[#d7dce2] bg-white/80 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
									<div className="font-mono text-sm font-semibold text-[#1c1917]">{activeFilterCount}</div>
									<div className="text-[10px] uppercase tracking-[0.12em] text-[#a8a29e]">filtros</div>
								</div>
							</div>
							<div className="mt-3 grid grid-cols-4 gap-1.5">
								<button
									type="button"
									className={`flex h-7 items-center justify-center gap-1 rounded-md border text-[11px] transition active:scale-[0.97] ${
										activePanel === "settings"
											? "border-[#1f2937] bg-[#1f2937] text-white"
											: "border-[#d7dce2] bg-white/75 text-[#475569] hover:bg-white"
									}`}
									onClick={() => setActivePanel("settings")}
								>
									<Settings className="size-3.5" />
									Inicio
								</button>
								<button
									type="button"
									data-wizard-target="report-filters-panel"
									className={`flex h-7 items-center justify-center gap-1 rounded-md border text-[11px] transition active:scale-[0.97] ${
										activePanel === "filters"
											? "border-[#1f2937] bg-[#1f2937] text-white"
											: "border-[#d7dce2] bg-white/75 text-[#475569] hover:bg-white"
									}`}
									onClick={() => setActivePanel("filters")}
								>
									<Filter className="size-3.5" />
									Filtros
								</button>
								<button
									type="button"
									data-wizard-target="report-config-columns"
									className={`flex h-7 items-center justify-center gap-1 rounded-md border text-[11px] transition active:scale-[0.97] ${
										activePanel === "columns"
											? "border-[#1f2937] bg-[#1f2937] text-white"
											: "border-[#d7dce2] bg-white/75 text-[#475569] hover:bg-white"
									}`}
									onClick={() => setActivePanel("columns")}
								>
									<Columns3 className="size-3.5" />
									Columnas
								</button>
								<button
									type="button"
									className={`flex h-7 items-center justify-center gap-1 rounded-md border text-[11px] transition active:scale-[0.97] ${
										activePanel === "visual"
											? "border-[#1f2937] bg-[#1f2937] text-white"
											: "border-[#d7dce2] bg-white/75 text-[#475569] hover:bg-white"
									}`}
									onClick={() => setActivePanel("visual")}
								>
									<Sparkles className="size-3.5" />
									Estilo
								</button>
							</div>
						</div>

						{/* SETTINGS TAB */}
						<TabsContent value="settings" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="space-y-4 p-4">
									<div className="grid grid-cols-2 gap-2">
										<button
											type="button"
											data-wizard-target="report-filters-panel"
											className={dockButtonClassName}
											onClick={() => setActivePanel("filters")}
										>
											<div className="flex items-center justify-between gap-2">
												<Filter className="size-4 text-[#475569]" />
												<span className="rounded-full border border-[#d7dce2] bg-white px-2 py-0.5 font-mono text-[10px] text-[#64748b]">
													{activeFilterCount}
												</span>
											</div>
											<p className="mt-2 text-xs font-semibold text-[#1f2937]">Filtros</p>
											<p className="mt-0.5 text-[11px] text-[#64748b]">
												{activeFilterCount > 0 ? "Ajustar activos" : "Abrir busqueda"}
											</p>
										</button>
										<button
											type="button"
											data-wizard-target="report-config-columns"
											className={dockButtonClassName}
											onClick={() => setActivePanel("columns")}
										>
											<div className="flex items-center justify-between gap-2">
												<Columns3 className="size-4 text-[#475569]" />
												<span className="rounded-full border border-[#d7dce2] bg-white px-2 py-0.5 font-mono text-[10px] text-[#64748b]">
													{visibleColumns.length}/{columns.length}
												</span>
											</div>
											<p className="mt-2 text-xs font-semibold text-[#1f2937]">Columnas</p>
											<p className="mt-0.5 text-[11px] text-[#64748b]">{activeGroupLabel}</p>
										</button>
										<button
											type="button"
											className={dockButtonClassName}
											onClick={() => setActivePanel("visual")}
										>
											<div className="flex items-center justify-between gap-2">
												<Eye className="size-4 text-[#475569]" />
												<span className="rounded-full border border-[#d7dce2] bg-white px-2 py-0.5 text-[10px] text-[#64748b]">
													{reportState.summaryDisplay === "card" ? "card" : "fila"}
												</span>
											</div>
											<p className="mt-2 text-xs font-semibold text-[#1f2937]">Estilo</p>
											<p className="mt-0.5 text-[11px] text-[#64748b]">
												{reportState.showMiniCharts ? "Mini graficos on" : "Resumen simple"}
											</p>
										</button>
										<button
											type="button"
											className={dockButtonClassName}
											onClick={() => setActivePanel("presets")}
										>
											<div className="flex items-center justify-between gap-2">
												<Layers className="size-4 text-[#475569]" />
												<span className="rounded-full border border-[#d7dce2] bg-white px-2 py-0.5 font-mono text-[10px] text-[#64748b]">
													{presets.length}
												</span>
											</div>
											<p className="mt-2 text-xs font-semibold text-[#1f2937]">Presets</p>
											<p className="mt-0.5 text-[11px] text-[#64748b]">Guardar o aplicar</p>
										</button>
									</div>

									<section className={sectionClassName}>
										<div className="mb-3 flex items-center justify-between gap-2">
											<h3 className={sectionHeaderClassName}>Documento</h3>
											<Settings className="size-4 text-[#78716c]" />
										</div>
										<div className="space-y-2">
											<div className="grid grid-cols-2 gap-2">
												<div className="space-y-1">
													<Label className="text-xs text-[#57534e] dark:text-zinc-400">Empresa</Label>
													<Input
														value={reportState.companyName}
														onChange={(e) =>
															setReportState((prev) => ({
																...prev,
																companyName: e.target.value,
															}))
														}
														className={inputClassName}
														disabled={readOnly}
													/>
												</div>
												<div className="space-y-1">
													<Label className="text-xs text-[#57534e] dark:text-zinc-400">Fecha</Label>
													<Input
														type="date"
														value={reportState.date}
														onChange={(e) =>
															setReportState((prev) => ({
																...prev,
																date: e.target.value,
															}))
														}
														className={inputClassName}
														disabled={readOnly}
													/>
												</div>
											</div>
											<div className="space-y-1">
												<Label className="text-xs text-[#57534e] dark:text-zinc-400">Descripcion</Label>
												<Input
													value={reportState.description}
													onChange={(e) =>
														setReportState((prev) => ({
															...prev,
															description: e.target.value,
														}))
													}
													className={inputClassName}
													disabled={readOnly}
												/>
											</div>
										</div>
									</section>

									{quickFilterField && (
										<section className={sectionClassName}>
											<div className="mb-3 flex items-center justify-between gap-2">
												<div>
													<h3 className={sectionHeaderClassName}>Filtro rapido</h3>
													<p className="mt-1 text-[11px] text-[#78716c]">{quickFilterField.label}</p>
												</div>
												<Search className="size-4 text-[#78716c]" />
											</div>
											<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
												<Input
													data-wizard-target="report-filter-input-descripcion"
													placeholder={quickFilterField.placeholder}
													value={String(draftFilters[quickFilterField.id] || "")}
													onChange={(e) =>
														setDraftFilters((prev) => ({
															...prev,
															[quickFilterField.id]: e.target.value,
														}))
													}
													className={inputClassName}
													disabled={readOnly}
												/>
												<Button
													data-wizard-target="report-apply-filters-button"
													size="sm"
													className={activeButtonClassName}
													onClick={() => setFilters(draftFilters)}
													disabled={readOnly}
												>
													Aplicar
												</Button>
											</div>
										</section>
									)}

									<section className={sectionClassName}>
										<div className="mb-3 flex items-center justify-between gap-2">
											<div>
												<h3 className={sectionHeaderClassName}>Atajos</h3>
												<p className="mt-1 text-[11px] text-[#78716c]">Acciones frecuentes sin abrir listas</p>
											</div>
											<Sparkles className="size-4 text-[#78716c]" />
										</div>
										{quickGroupOptions.length > 0 && (
											<div className="space-y-2">
												<Label className="text-xs text-[#57534e] dark:text-zinc-400">Agrupar por</Label>
												<div className="grid grid-cols-2 gap-2">
													<Button
														variant={reportState.viewMode === "full" ? "default" : "outline"}
														size="sm"
														className={
															reportState.viewMode === "full"
																? activeButtonClassName
																: softButtonClassName
														}
														onClick={() => setReportState((prev) => ({ ...prev, viewMode: "full" }))}
														disabled={readOnly}
													>
														Sin agrupar
													</Button>
													{quickGroupOptions.map((option) => {
														const normalizedLabel = normalizeWizardLabel(option.label);
														const isGrouped = reportState.viewMode === option.id;
														return (
															<Button
																key={option.id}
																variant={isGrouped ? "default" : "outline"}
																size="sm"
																data-wizard-target={
																	normalizedLabel === "obra"
																		? "report-config-agrupar-obra"
																		: normalizedLabel.includes("descripcion") ||
																			  normalizedLabel.includes("descriptivo")
																			? "report-config-agrupar-descripcion"
																			: undefined
																}
																className={isGrouped ? activeButtonClassName : softButtonClassName}
																onClick={() =>
																	setReportState((prev) => ({
																		...prev,
																		viewMode: isGrouped ? "full" : option.id,
																	}))
																}
																disabled={readOnly}
															>
																{option.label}
															</Button>
														);
													})}
												</div>
											</div>
										)}
										{quickTotalColumn && (
											<div
												className="mt-3 space-y-1.5"
												data-wizard-target={
													normalizeWizardLabel(quickTotalColumn.label) === "preciototal"
														? "report-config-total-precio-total"
														: undefined
												}
											>
												<Label className="text-xs text-[#57534e] dark:text-zinc-400">
													Total destacado: {quickTotalColumn.label}
												</Label>
												<select
													className="h-8 w-full rounded-md border border-[#d9dee5] bg-white px-2 py-1 text-xs text-[#1f2937] shadow-[inset_0_1px_2px_rgba(30,41,59,.05)]"
													value={reportState.aggregations[quickTotalColumn.id] || "none"}
													onChange={(e) =>
														setAggregation(quickTotalColumn.id, e.target.value as AggregationType)
													}
													disabled={
														readOnly || reportState.hiddenColumnIds.includes(quickTotalColumn.id)
													}
												>
													{getAggregationOptions(quickTotalColumn.type || "text").map((opt) => (
														<option key={opt} value={opt}>
															{getAggregationLabel(opt as AggregationType)}
														</option>
													))}
												</select>
											</div>
										)}
										{quickColumnToggles.length > 0 && (
											<div className="mt-3 space-y-1.5">
												<Label className="text-xs text-[#57534e] dark:text-zinc-400">
													Columnas clave
												</Label>
												<div className="grid grid-cols-1 gap-1.5">
													{quickColumnToggles.map((col) => {
														const normalizedLabel = normalizeWizardLabel(col.label);
														const isVisible = !reportState.hiddenColumnIds.includes(col.id);
														const checkboxWizardTarget =
															normalizedLabel.includes("documento")
																? "report-config-toggle-documento"
																: normalizedLabel.includes("unidad")
																	? "report-config-toggle-unidad"
																	: normalizedLabel.includes("cantidad")
																		? "report-config-toggle-cantidad"
																		: undefined;
														return (
															<label
																key={col.id}
																className="flex h-8 items-center justify-between gap-2 rounded-md border border-[#d9dee5] bg-white px-2.5 text-xs text-[#1f2937] shadow-[inset_0_1px_0_rgba(255,255,255,.9)]"
															>
																<span className="truncate">{col.label}</span>
																<Checkbox
																	data-wizard-target={checkboxWizardTarget}
																	checked={isVisible}
																	onCheckedChange={() => toggleColumnVisibility(col.id)}
																	disabled={readOnly}
																/>
															</label>
														);
													})}
												</div>
											</div>
										)}
									</section>

									<div className="hidden">
									{(suggestedTemplates.length > 0 || templates.length > 0) && (
										<section className={sectionClassName}>
											<div className="mb-3 flex items-center justify-between gap-2">
												<h3 className={sectionHeaderClassName}>Plantillas rapidas</h3>
												<Sparkles className="size-4 text-[#ff5800]" />
											</div>
											<div className="grid grid-cols-1 gap-2">
												{suggestedTemplates.map((template) => (
													<Button
														key={template.id}
														variant="outline"
														size="sm"
														className={`${softButtonClassName} justify-between`}
														onClick={() => handleApplyTemplate(template)}
													>
														<span className="truncate">{template.name}</span>
														<span className="text-[10px] text-[#a8a29e]">Sugerida</span>
													</Button>
												))}
												{templates.slice(0, 3).map((template) => (
													<Button
														key={template.id}
														variant="outline"
														size="sm"
														className={`${softButtonClassName} justify-between`}
														onClick={() => handleApplyTemplate(template)}
													>
														<span className="truncate">{template.name}</span>
														<span className="text-[10px] text-[#a8a29e]">Aplicar</span>
													</Button>
												))}
											</div>
										</section>
									)}

									{/* Header fields */}
									<section className={sectionClassName} data-wizard-target="report-config-columns">
										<div className="mb-3 flex items-center justify-between gap-2">
											<h3 className={sectionHeaderClassName}>Encabezado</h3>
											<Settings className="size-4 text-[#78716c]" />
										</div>
										<div className="space-y-2">
											<div className="space-y-1">
												<Label className="text-xs text-[#57534e] dark:text-zinc-400">Empresa</Label>
												<Input
													value={reportState.companyName}
													onChange={(e) =>
														setReportState((prev) => ({
															...prev,
															companyName: e.target.value,
														}))
													}
													className={inputClassName}
													disabled={readOnly}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs text-[#57534e] dark:text-zinc-400">Descripcion</Label>
												<Input
													value={reportState.description}
													onChange={(e) =>
														setReportState((prev) => ({
															...prev,
															description: e.target.value,
														}))
													}
													className={inputClassName}
													disabled={readOnly}
												/>
											</div>
										</div>
									</section>

									<Separator className="bg-[#d7dce2] dark:bg-zinc-700" />

									{config.compare && (
										<>
											<section className={sectionClassName}>
												<div className="mb-3 flex items-center justify-between gap-2">
													<h3 className={sectionHeaderClassName}>Comparar</h3>
													<BarChart3 className="size-4 text-[#78716c]" />
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-xs text-[#44403c] dark:text-zinc-300">
														Comparar período anterior
													</span>
													<Checkbox
														checked={isCompareEnabled}
														onCheckedChange={(value) => setIsCompareEnabled(Boolean(value))}
														disabled={readOnly}
													/>
												</div>
											</section>
											<Separator className="bg-[#d7dce2] dark:bg-zinc-700" />
										</>
									)}

									<section
										id="report-filters-section"
										className={sectionClassName}
										data-wizard-target="report-filters-panel"
									>
										<div className="mb-3 flex items-center justify-between gap-2">
											<div>
												<h3 className={sectionHeaderClassName}>Filtros</h3>
												<p className="mt-1 text-[11px] text-[#78716c]">
													{activeFilterCount > 0
														? `${activeFilterCount} activos`
														: "Sin filtros activos"}
												</p>
											</div>
											<Search className="size-4 text-[#78716c]" />
										</div>

										{!readOnly && (
											<div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
												<Select
													value={selectedPresetId ?? "__none__"}
													onValueChange={(value) => {
														if (value === "__none__") return;
														const preset = presets.find((p) => p.id === value);
														if (!preset) return;
														const nextFilters = (prev: Filters) => ({
															...prev,
															...(preset.filters ?? {}),
														});
														setFilters(nextFilters);
														setDraftFilters(nextFilters);
														setSelectedPresetId(preset.id);
														toast.success("Filtro aplicado");
													}}
												>
													<SelectTrigger className={inputClassName}>
														<SelectValue placeholder="Filtro guardado" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="__none__">Filtro guardado</SelectItem>
														{presets.map((preset) => (
															<SelectItem key={preset.id} value={preset.id}>
																{preset.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Button
													size="sm"
													variant="outline"
													className={softButtonClassName}
													onClick={handleSaveFiltersOnly}
												>
													<Save className="size-3.5" />
													Guardar
												</Button>
											</div>
										)}

										<div className="space-y-2">
											{displayedFilterFields.length === 0 ? (
												<p className="rounded-md border border-dashed border-[#d9dee5] px-3 py-2 text-xs text-[#78716c]">
													Este reporte no tiene filtros configurados.
												</p>
											) : (
												displayedFilterFields.map((field) => {
													const fieldId = String(field.id);
													const fieldIdNormalized = normalizeWizardLabel(fieldId);
													const fieldLabelNormalized = normalizeWizardLabel(field.label);
													const isDescripcionField =
														fieldIdNormalized.includes("descripcion") ||
														fieldLabelNormalized.includes("descripcion") ||
														fieldLabelNormalized.includes("descriptivo");
													return (
														<div key={String(field.id)} className="space-y-1.5">
															<Label className="text-xs text-[#57534e] dark:text-zinc-400">
																{field.label}
															</Label>
															{field.type === "text" && (
																<Input
																	data-wizard-target={
																		isDescripcionField
																			? "report-filter-input-descripcion"
																			: undefined
																	}
																	placeholder={field.placeholder}
																	value={String(draftFilters[field.id] || "")}
																	onChange={(e) =>
																		setDraftFilters((prev) => ({
																			...prev,
																			[field.id]: e.target.value,
																		}))
																	}
																	className={inputClassName}
																	disabled={readOnly}
																/>
															)}
															{field.type === "number" && (
																<Input
																	type="number"
																	placeholder={field.placeholder}
																	value={String(draftFilters[field.id] || "")}
																	onChange={(e) =>
																		setDraftFilters((prev) => ({
																			...prev,
																			[field.id]: e.target.value,
																		}))
																	}
																	className={inputClassName}
																	disabled={readOnly}
																/>
															)}
															{field.type === "date" && (
																<Input
																	type="date"
																	value={String(draftFilters[field.id] || "")}
																	onChange={(e) =>
																		setDraftFilters((prev) => ({
																			...prev,
																			[field.id]: e.target.value,
																		}))
																	}
																	className={inputClassName}
																	disabled={readOnly}
																/>
															)}
															{field.type === "select" && field.options && (
																<select
																	className={`${inputClassName} w-full rounded-md px-2.5`}
																	value={String(draftFilters[field.id] || "")}
																	onChange={(e) =>
																		setDraftFilters((prev) => ({
																			...prev,
																			[field.id]: e.target.value,
																		}))
																	}
																	disabled={readOnly}
																>
																	{field.options.map((opt) => (
																		<option key={opt.value} value={opt.value}>
																			{opt.label}
																		</option>
																	))}
																</select>
															)}
															{field.type === "multi-select" && field.options && (
																<div className="space-y-2 rounded-md border border-[#d9dee5] bg-white px-2.5 py-2">
																	{field.options.map((opt) => {
																		const current = Array.isArray(draftFilters[field.id])
																			? (draftFilters[field.id] as string[])
																			: [];
																		const checked = current.includes(opt.value);
																		return (
																			<label
																				key={opt.value}
																				className="flex items-center gap-2 text-xs text-[#292524] dark:text-zinc-200"
																			>
																				<Checkbox
																					checked={checked}
																					onCheckedChange={(nextChecked) =>
																						setDraftFilters((prev) => {
																							const prevValues = Array.isArray(prev[field.id])
																								? ([...(prev[field.id] as string[])] as string[])
																								: [];
																							const nextValues = nextChecked
																								? Array.from(new Set([...prevValues, opt.value]))
																								: prevValues.filter((value) => value !== opt.value);
																							return {
																								...prev,
																								[field.id]: nextValues,
																							};
																						})
																					}
																					disabled={readOnly}
																				/>
																				<span>{opt.label}</span>
																			</label>
																		);
																	})}
																</div>
															)}
															{field.type === "boolean-toggle" && (
																<div className="grid grid-cols-3 gap-1.5">
																	{[
																		{ value: "all", label: "Todos" },
																		{ value: "si", label: "Si" },
																		{ value: "no", label: "No" },
																	].map((opt) => (
																		<Button
																			key={opt.value}
																			variant={
																				draftFilters[field.id] === opt.value
																					? "default"
																					: "outline"
																			}
																			size="sm"
																			className={
																				draftFilters[field.id] === opt.value
																					? activeButtonClassName
																					: softButtonClassName
																			}
																			onClick={() =>
																				setDraftFilters((prev) => ({
																					...prev,
																					[field.id]: opt.value,
																				}))
																			}
																			disabled={readOnly}
																		>
																			{opt.label}
																		</Button>
																	))}
																</div>
															)}
														</div>
													);
												})
											)}
										</div>

										{hiddenFilterFieldCount > 0 && (
											<Button
												variant="outline"
												size="sm"
												className={`${softButtonClassName} mt-3 w-full`}
												onClick={() => setShowAllFilters(true)}
											>
												Mostrar {hiddenFilterFieldCount} filtros mas
											</Button>
										)}

										<div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
											<Button
												data-wizard-target="report-apply-filters-button"
												size="sm"
												className={activeButtonClassName}
												onClick={() => setFilters(draftFilters)}
												disabled={readOnly}
											>
												<Filter className="size-3.5" />
												Aplicar
											</Button>
											<Button
												size="sm"
												variant="outline"
												className={softButtonClassName}
												onClick={handleResetFilters}
												disabled={readOnly}
											>
												Reiniciar
											</Button>
										</div>
									</section>

									<Separator className="bg-[#d7dce2] dark:bg-zinc-700" />

									{/* View Mode */}
									{/* Column config */}
									<section id="report-columns-section" className={sectionClassName}>
										<div className="flex items-center justify-between gap-2">
											<div>
												<h3 className={sectionHeaderClassName}>Columnas</h3>
												<p className="mt-1 text-[11px] text-[#78716c]">
													{visibleColumns.length} visibles de {columns.length}
												</p>
											</div>
											{groupByOptions.length > 0 && (
												<Button
													variant={reportState.viewMode === "full" ? "default" : "outline"}
													size="sm"
													className={
														reportState.viewMode === "full"
															? activeButtonClassName
															: softButtonClassName
													}
													onClick={() =>
														setReportState((prev) => ({ ...prev, viewMode: "full" }))
													}
													disabled={readOnly}
												>
													Sin agrupar
												</Button>
											)}
										</div>
										{reportState.viewMode !== "full" && (
											<div className="mt-3 space-y-2 rounded-md border border-[#d9dee5] bg-white p-2.5">
												<div className="space-y-1">
													<Label className="text-xs text-[#57534e] dark:text-zinc-400">
														Orden global de grupos
													</Label>
													<Select
														value={reportState.groupSortColumnId ?? "__group_key__"}
														disabled={readOnly}
														onValueChange={(value) =>
															setReportState((prev) => ({
																...prev,
																groupSortColumnId: value === "__group_key__" ? null : value,
															}))
														}
													>
														<SelectTrigger className={inputClassName}>
															<SelectValue placeholder="Nombre del grupo" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="__group_key__">Nombre del grupo</SelectItem>
															{columns.map((col) => (
																<SelectItem key={`group-sort-${col.id}`} value={col.id}>
																	{col.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="grid grid-cols-2 gap-2">
													<Button
														variant={
															reportState.groupSortDirection === "asc" ? "default" : "outline"
														}
														size="sm"
														className={
															reportState.groupSortDirection === "asc"
																? activeButtonClassName
																: softButtonClassName
														}
														onClick={() =>
															setReportState((prev) => ({
																...prev,
																groupSortDirection: "asc",
															}))
														}
														disabled={readOnly}
													>
														Ascendente
													</Button>
													<Button
														variant={
															reportState.groupSortDirection === "desc" ? "default" : "outline"
														}
														size="sm"
														className={
															reportState.groupSortDirection === "desc"
																? activeButtonClassName
																: softButtonClassName
														}
														onClick={() =>
															setReportState((prev) => ({
																...prev,
																groupSortDirection: "desc",
															}))
														}
														disabled={readOnly}
													>
														Descendente
													</Button>
												</div>
											</div>
										)}
										<div className="mt-3 space-y-2">
											{displayedColumns.map((col) => {
												const isVisible = !reportState.hiddenColumnIds.includes(col.id);
												const normalizedLabel = normalizeWizardLabel(col.label);
												const checkboxWizardTarget =
													normalizedLabel.includes("documento")
														? "report-config-toggle-documento"
														: normalizedLabel.includes("unidad")
															? "report-config-toggle-unidad"
															: normalizedLabel.includes("cantidad")
																? "report-config-toggle-cantidad"
																: undefined;
												const groupOption =
													groupByOptions.find((opt) => opt.id === `col-${col.id}`) ??
													groupByOptions.find((opt) =>
														opt.id.toLowerCase().includes(col.id.toLowerCase())
													) ??
													groupByOptions.find((opt) =>
														opt.label.toLowerCase().includes(col.label.toLowerCase())
													) ??
													null;
												const isGrouped = groupOption
													? reportState.viewMode === groupOption.id
													: false;

												return (
													<div
														key={col.id}
														className={`space-y-2 rounded-md border px-2.5 py-2 ${isVisible
															? "border-[#d9dee5] bg-white dark:border-zinc-700 dark:bg-zinc-800/70"
															: "border-[#e1e5ea] bg-[#eceff2] opacity-65 dark:border-zinc-700/60 dark:bg-zinc-800/40"
															}`}
													>
														<div className="flex items-center justify-between gap-2">
															<div className="flex items-center gap-2 min-w-0">
																<Checkbox
																	id={`col-${col.id}`}
																	data-wizard-target={checkboxWizardTarget}
																	checked={isVisible}
																	onCheckedChange={() => toggleColumnVisibility(col.id)}
																	disabled={readOnly}
																/>
																<Label
																	htmlFor={`col-${col.id}`}
																	className="cursor-pointer truncate text-xs font-medium text-[#292524] dark:text-zinc-200"
																>
																	{col.label}
																</Label>
															</div>
															{groupOption && (
																<Button
																	variant={isGrouped ? "default" : "outline"}
																	size="sm"
																	data-wizard-target={
																		normalizedLabel === "obra"
																			? "report-config-agrupar-obra"
																			: normalizedLabel.includes("descripcion") ||
																				  normalizedLabel.includes("descriptivo")
																				? "report-config-agrupar-descripcion"
																				: undefined
																	}
																	className={`h-7 px-2 text-[11px] ${isGrouped
																		? "bg-[#1f2937] text-[#f8fafc] hover:bg-[#111827]"
																		: "border-[#d9dee5] bg-[#f9fafb] text-[#334155] hover:bg-white"
																		}`}
																	onClick={() =>
																		setReportState((prev) => ({
																			...prev,
																			viewMode: isGrouped ? "full" : groupOption.id,
																		}))
																	}
																	disabled={readOnly || !isVisible}
																>
																	{isGrouped ? "Agrupado" : "Agrupar"}
																</Button>
															)}
														</div>
														<div
															className="flex items-center gap-2"
															data-wizard-target={
																normalizedLabel === "preciototal"
																	? "report-config-total-precio-total"
																	: undefined
															}
														>
															<span className="text-[11px] text-[#78716c] dark:text-zinc-400">
																Total
															</span>
															<select
																className="flex-1 rounded-md border border-[#d9dee5] bg-white px-2 py-1 text-[11px] text-[#1f2937] shadow-[inset_0_1px_2px_rgba(30,41,59,.05)] dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
																value={reportState.aggregations[col.id] || "none"}
																onChange={(e) =>
																	setAggregation(col.id, e.target.value as AggregationType)
																}
																disabled={readOnly || !isVisible}
															>
																{getAggregationOptions(col.type || "text").map((opt) => (
																	<option key={opt} value={opt}>
																		{getAggregationLabel(opt as AggregationType)}
																	</option>
																))}
															</select>
														</div>
													</div>
												);
											})}
										</div>
										{hiddenColumnControlCount > 0 && (
											<Button
												variant="outline"
												size="sm"
												className={`${softButtonClassName} mt-3 w-full`}
												onClick={() => setShowAllColumns(true)}
											>
												Mostrar {hiddenColumnControlCount} columnas mas
											</Button>
										)}
									</section>

									<section id="report-visual-section" className={sectionClassName}>
										<div className="mb-3 flex items-center justify-between gap-2">
											<div>
												<h3 className={sectionHeaderClassName}>Estilo</h3>
												<p className="mt-1 text-[11px] text-[#78716c]">
													Resumen y mini graficos
												</p>
											</div>
											<Eye className="size-4 text-[#78716c]" />
										</div>
										<div className="grid grid-cols-2 gap-2">
											<Button
												variant={reportState.summaryDisplay === "row" ? "default" : "outline"}
												size="sm"
												className={
													reportState.summaryDisplay === "row"
														? activeButtonClassName
														: softButtonClassName
												}
												onClick={() =>
													setReportState((prev) => ({ ...prev, summaryDisplay: "row" }))
												}
												disabled={readOnly}
											>
												Fila total
											</Button>
											<Button
												variant={reportState.summaryDisplay === "card" ? "default" : "outline"}
												size="sm"
												className={
													reportState.summaryDisplay === "card"
														? activeButtonClassName
														: softButtonClassName
												}
												onClick={() =>
													setReportState((prev) => ({ ...prev, summaryDisplay: "card" }))
												}
												disabled={readOnly}
											>
												Tarjeta
											</Button>
										</div>
										<div className="mt-3 flex items-center justify-between gap-2">
											<span className="text-xs text-[#44403c] dark:text-zinc-300">
												Mini graficos
											</span>
											<Checkbox
												checked={reportState.showMiniCharts}
												onCheckedChange={(value) =>
													setReportState((prev) => ({
														...prev,
														showMiniCharts: Boolean(value),
													}))
												}
												disabled={readOnly}
											/>
										</div>
										{reportState.showMiniCharts && (
											<div className="mt-2 grid grid-cols-2 gap-2">
												<Button
													variant={
														reportState.summaryChartType === "bar"
															? "default"
															: "outline"
													}
													size="sm"
													className={
														reportState.summaryChartType === "bar"
															? activeButtonClassName
															: softButtonClassName
													}
													onClick={() =>
														setReportState((prev) => ({ ...prev, summaryChartType: "bar" }))
													}
													disabled={readOnly}
												>
													Barras
												</Button>
												<Button
													variant={
														reportState.summaryChartType === "line"
															? "default"
															: "outline"
													}
													size="sm"
													className={
														reportState.summaryChartType === "line"
															? activeButtonClassName
															: softButtonClassName
													}
													onClick={() =>
														setReportState((prev) => ({ ...prev, summaryChartType: "line" }))
													}
													disabled={readOnly}
												>
													Lineas
												</Button>
											</div>
										)}
									</section>

									{!readOnly && (
										<section className={sectionClassName}>
											<div className="mb-3 flex items-center justify-between gap-2">
												<div>
													<h3 className={sectionHeaderClassName}>Presets</h3>
													<p className="mt-1 text-[11px] text-[#78716c]">
														Guardar esta mesa de trabajo
													</p>
												</div>
												<Layers className="size-4 text-[#78716c]" />
											</div>
											<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
												<Input
													placeholder="Nombre del preset"
													value={presetName}
													onChange={(e) => setPresetName(e.target.value)}
													className={inputClassName}
													disabled={readOnly}
												/>
												<Button
													size="sm"
													className={activeButtonClassName}
													onClick={handleSavePreset}
													disabled={readOnly}
												>
													<Save className="size-3.5" />
													Guardar
												</Button>
											</div>
											<div className="mt-3 space-y-1.5">
												{presets.length === 0 ? (
													<p className="text-xs text-[#78716c]">No hay presets guardados.</p>
												) : (
													presets.slice(0, 4).map((preset) => (
														<div key={preset.id} className="flex items-center gap-2">
															<Button
																variant="outline"
																size="sm"
																className={`${softButtonClassName} min-w-0 flex-1 justify-between`}
																onClick={() => handleApplyPreset(preset)}
															>
																<span className="truncate">{preset.name}</span>
																<span className="text-[10px] text-[#a8a29e]">Aplicar</span>
															</Button>
															<Button
																variant="outline"
																size="icon-sm"
																title="Eliminar preset"
																className="border-[#d9dee5] bg-[#f9fafb] text-[#8a3b3b] hover:bg-white hover:text-[#a23f3f]"
																onClick={() => handleDeletePreset(preset.id)}
																disabled={readOnly}
															>
																<Trash2 className="size-3.5" />
															</Button>
														</div>
													))
												)}
											</div>
										</section>
									)}
									</div>
								</div>
							</ScrollArea>
						</TabsContent>

						{/* COLUMNS PANEL */}
						<TabsContent value="columns" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="space-y-4 p-4" data-wizard-target="report-config-columns">
									<section className={sectionClassName}>
										<div className="flex items-start justify-between gap-3">
											<div>
												<h3 className={sectionHeaderClassName}>Panel de columnas</h3>
												<p className="mt-1 text-xs text-[#475569]">
													{visibleColumns.length} visibles de {columns.length}
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												className={softButtonClassName}
												onClick={() => setActivePanel("settings")}
											>
												Inicio
											</Button>
										</div>
									</section>

									{groupByOptions.length > 0 && (
										<section className={sectionClassName}>
											<div className="mb-3 flex items-center justify-between gap-2">
												<div>
													<h3 className={sectionHeaderClassName}>Agrupar</h3>
													<p className="mt-1 text-[11px] text-[#78716c]">{activeGroupLabel}</p>
												</div>
												<Layers className="size-4 text-[#78716c]" />
											</div>
											<div className="grid grid-cols-2 gap-2">
												<Button
													variant={reportState.viewMode === "full" ? "default" : "outline"}
													size="sm"
													className={
														reportState.viewMode === "full"
															? activeButtonClassName
															: softButtonClassName
													}
													onClick={() => setReportState((prev) => ({ ...prev, viewMode: "full" }))}
													disabled={readOnly}
												>
													Sin agrupar
												</Button>
												{groupByOptions.map((option) => {
													const normalizedLabel = normalizeWizardLabel(option.label);
													const isGrouped = reportState.viewMode === option.id;
													return (
														<Button
															key={option.id}
															variant={isGrouped ? "default" : "outline"}
															size="sm"
															data-wizard-target={
																normalizedLabel === "obra"
																	? "report-config-agrupar-obra"
																	: normalizedLabel.includes("descripcion") ||
																		  normalizedLabel.includes("descriptivo")
																		? "report-config-agrupar-descripcion"
																		: undefined
															}
															className={isGrouped ? activeButtonClassName : softButtonClassName}
															onClick={() =>
																setReportState((prev) => ({
																	...prev,
																	viewMode: isGrouped ? "full" : option.id,
																}))
															}
															disabled={readOnly}
														>
															{option.label}
														</Button>
													);
												})}
											</div>
											{reportState.viewMode !== "full" && (
												<div className="mt-3 space-y-2 rounded-md border border-[#d9dee5] bg-white p-2.5">
													<div className="space-y-1">
														<Label className="text-xs text-[#57534e] dark:text-zinc-400">
															Orden global de grupos
														</Label>
														<Select
															value={reportState.groupSortColumnId ?? "__group_key__"}
															disabled={readOnly}
															onValueChange={(value) =>
																setReportState((prev) => ({
																	...prev,
																	groupSortColumnId: value === "__group_key__" ? null : value,
																}))
															}
														>
															<SelectTrigger className={inputClassName}>
																<SelectValue placeholder="Nombre del grupo" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="__group_key__">Nombre del grupo</SelectItem>
																{columns.map((col) => (
																	<SelectItem key={`column-panel-group-sort-${col.id}`} value={col.id}>
																		{col.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
													<div className="grid grid-cols-2 gap-2">
														<Button
															variant={
																reportState.groupSortDirection === "asc" ? "default" : "outline"
															}
															size="sm"
															className={
																reportState.groupSortDirection === "asc"
																	? activeButtonClassName
																	: softButtonClassName
															}
															onClick={() =>
																setReportState((prev) => ({
																	...prev,
																	groupSortDirection: "asc",
																}))
															}
															disabled={readOnly}
														>
															Ascendente
														</Button>
														<Button
															variant={
																reportState.groupSortDirection === "desc" ? "default" : "outline"
															}
															size="sm"
															className={
																reportState.groupSortDirection === "desc"
																	? activeButtonClassName
																	: softButtonClassName
															}
															onClick={() =>
																setReportState((prev) => ({
																	...prev,
																	groupSortDirection: "desc",
																}))
															}
															disabled={readOnly}
														>
															Descendente
														</Button>
													</div>
												</div>
											)}
										</section>
									)}

									<section className={sectionClassName}>
										<div className="mb-3 flex items-center justify-between gap-2">
											<div>
												<h3 className={sectionHeaderClassName}>Visibilidad y totales</h3>
												<p className="mt-1 text-[11px] text-[#78716c]">
													Columnas principales del reporte
												</p>
											</div>
											<Columns3 className="size-4 text-[#78716c]" />
										</div>
										<div className="space-y-2">
											{displayedColumns.map((col) => {
												const isVisible = !reportState.hiddenColumnIds.includes(col.id);
												const normalizedLabel = normalizeWizardLabel(col.label);
												const checkboxWizardTarget =
													normalizedLabel.includes("documento")
														? "report-config-toggle-documento"
														: normalizedLabel.includes("unidad")
															? "report-config-toggle-unidad"
															: normalizedLabel.includes("cantidad")
																? "report-config-toggle-cantidad"
																: undefined;
												const groupOption =
													groupByOptions.find((opt) => opt.id === `col-${col.id}`) ??
													groupByOptions.find((opt) =>
														opt.id.toLowerCase().includes(col.id.toLowerCase())
													) ??
													groupByOptions.find((opt) =>
														opt.label.toLowerCase().includes(col.label.toLowerCase())
													) ??
													null;
												const isGrouped = groupOption
													? reportState.viewMode === groupOption.id
													: false;

												return (
													<div
														key={`column-panel-${col.id}`}
														className={`space-y-2 rounded-md border px-2.5 py-2 transition ${
															isVisible
																? "border-[#d9dee5] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,.9)]"
																: "border-[#e1e5ea] bg-[#eceff2] opacity-70"
														}`}
													>
														<div className="flex items-center justify-between gap-2">
															<label className="flex min-w-0 items-center gap-2">
																<Checkbox
																	data-wizard-target={checkboxWizardTarget}
																	checked={isVisible}
																	onCheckedChange={() => toggleColumnVisibility(col.id)}
																	disabled={readOnly}
																/>
																<span className="truncate text-xs font-medium text-[#292524]">
																	{col.label}
																</span>
															</label>
															{groupOption && (
																<Button
																	variant={isGrouped ? "default" : "outline"}
																	size="sm"
																	data-wizard-target={
																		normalizedLabel === "obra"
																			? "report-config-agrupar-obra"
																			: normalizedLabel.includes("descripcion") ||
																				  normalizedLabel.includes("descriptivo")
																				? "report-config-agrupar-descripcion"
																				: undefined
																	}
																	className={`h-7 px-2 text-[11px] ${
																		isGrouped
																			? "bg-[#1f2937] text-[#f8fafc] hover:bg-[#111827]"
																			: "border-[#d9dee5] bg-[#f9fafb] text-[#334155] hover:bg-white"
																	}`}
																	onClick={() =>
																		setReportState((prev) => ({
																			...prev,
																			viewMode: isGrouped ? "full" : groupOption.id,
																		}))
																	}
																	disabled={readOnly || !isVisible}
																>
																	{isGrouped ? "Agrupado" : "Agrupar"}
																</Button>
															)}
														</div>
														<div
															className="flex items-center gap-2"
															data-wizard-target={
																normalizedLabel === "preciototal"
																	? "report-config-total-precio-total"
																	: undefined
															}
														>
															<span className="text-[11px] text-[#78716c] dark:text-zinc-400">
																Total
															</span>
															<select
																className="flex-1 rounded-md border border-[#d9dee5] bg-white px-2 py-1 text-[11px] text-[#1f2937] shadow-[inset_0_1px_2px_rgba(30,41,59,.05)]"
																value={reportState.aggregations[col.id] || "none"}
																onChange={(e) =>
																	setAggregation(col.id, e.target.value as AggregationType)
																}
																disabled={readOnly || !isVisible}
															>
																{getAggregationOptions(col.type || "text").map((opt) => (
																	<option key={opt} value={opt}>
																		{getAggregationLabel(opt as AggregationType)}
																	</option>
																))}
															</select>
														</div>
													</div>
												);
											})}
										</div>
										{hiddenColumnControlCount > 0 && (
											<Button
												variant="outline"
												size="sm"
												className={`${softButtonClassName} mt-3 w-full`}
												onClick={() => setShowAllColumns(true)}
											>
												Mostrar {hiddenColumnControlCount} columnas mas
											</Button>
										)}
									</section>
								</div>
							</ScrollArea>
						</TabsContent>

						{/* FILTERS TAB */}
						<TabsContent value="filters" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="p-4 space-y-5" data-wizard-target="report-filters-panel">
									<section className={sectionClassName}>
										<div className="flex items-start justify-between gap-3">
											<div>
												<h3 className={sectionHeaderClassName}>Panel de filtros</h3>
												<p className="mt-1 text-xs text-[#475569]">
													{activeFilterCount > 0
														? `${activeFilterCount} filtros activos`
														: "Sin filtros activos"}
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												className={softButtonClassName}
												onClick={() => setActivePanel("settings")}
											>
												Inicio
											</Button>
										</div>
									</section>
									{!readOnly && (
										<div className="space-y-2 rounded border border-[#d5d8df] dark:border-zinc-600 bg-[#f7f7f8] dark:bg-zinc-700 p-2.5">
											<Label className="text-xs text-[#5f6670] dark:text-zinc-400">
												Filtros guardados
											</Label>
											<div className="flex gap-2">
												<Select
													value={selectedPresetId ?? "__none__"}
													onValueChange={(value) => {
														if (value === "__none__") return;
														const preset = presets.find((p) => p.id === value);
														if (!preset) return;
														const nextFilters = (prev: Filters) => ({
															...prev,
															...(preset.filters ?? {}),
														});
														setFilters(nextFilters);
														setDraftFilters(nextFilters);
														setSelectedPresetId(preset.id);
														toast.success("Filtro aplicado");
													}}
												>
													<SelectTrigger className="h-8 text-xs bg-white dark:bg-zinc-800">
														<SelectValue placeholder="Seleccionar filtro guardado" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="__none__">Seleccionar?</SelectItem>
														{presets.map((preset) => (
															<SelectItem key={preset.id} value={preset.id}>
																{preset.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Button
													size="sm"
													variant="outline"
													className="h-8 text-xs"
													onClick={handleSaveFiltersOnly}
												>
													Guardar
												</Button>
											</div>
										</div>
									)}
									<div className="flex flex-col gap-2 max-h-[calc(100vh-20rem)] overflow-y-auto">

										{filterFields?.map((field) => {
											const fieldId = String(field.id);
											const fieldIdNormalized = normalizeWizardLabel(fieldId);
											const fieldLabelNormalized = normalizeWizardLabel(field.label);
											const isDescripcionField =
												fieldIdNormalized.includes("descripcion") ||
												fieldLabelNormalized.includes("descripcion") ||
												fieldLabelNormalized.includes("descriptivo");
											return (
											<div key={String(field.id)} className="space-y-1.5">
												<Label className="text-xs text-[#5f6670] dark:text-zinc-400">{field.label}</Label>
												{field.type === "text" && (
													<Input
														data-wizard-target={
															isDescripcionField ? "report-filter-input-descripcion" : undefined
														}
														placeholder={field.placeholder}
														value={String(draftFilters[field.id] || "")}
														onChange={(e) =>
															setDraftFilters((prev) => ({
																...prev,
																[field.id]: e.target.value,
															}))
														}
														className="h-8 text-sm bg-[#f7f7f8] dark:bg-zinc-700 border-[#d5d8df] dark:border-zinc-600"
														disabled={readOnly}
													/>
												)}
												{field.type === "number" && (
													<Input
														type="number"
														placeholder={field.placeholder}
														value={String(draftFilters[field.id] || "")}
														onChange={(e) =>
															setDraftFilters((prev) => ({
																...prev,
																[field.id]: e.target.value,
															}))
														}
														className="h-8 text-sm bg-[#f7f7f8] dark:bg-zinc-700 border-[#d5d8df] dark:border-zinc-600"
														disabled={readOnly}
													/>
												)}
												{field.type === "date" && (
													<Input
														type="date"
														value={String(draftFilters[field.id] || "")}
														onChange={(e) =>
															setDraftFilters((prev) => ({
																...prev,
																[field.id]: e.target.value,
															}))
														}
														className="h-8 text-sm bg-[#f7f7f8] dark:bg-zinc-700 border-[#d5d8df] dark:border-zinc-600"
														disabled={readOnly}
													/>
												)}
												{field.type === "select" && field.options && (
													<select
														className="w-full rounded border border-[#d5d8df] dark:border-zinc-600 bg-[#f7f7f8] dark:bg-zinc-700 px-2.5 py-1.5 text-xs text-[#2b2f36] dark:text-zinc-200"
														value={String(draftFilters[field.id] || "")}
														onChange={(e) =>
															setDraftFilters((prev) => ({
																...prev,
																[field.id]: e.target.value,
															}))
														}
														disabled={readOnly}
													>
														{field.options.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</select>
												)}
												{field.type === "multi-select" && field.options && (
													<div className="space-y-2 rounded border border-[#d5d8df] dark:border-zinc-600 bg-[#f7f7f8] dark:bg-zinc-700 px-2.5 py-2">
														{field.options.map((opt) => {
															const current = Array.isArray(draftFilters[field.id])
																? (draftFilters[field.id] as string[])
																: [];
															const checked = current.includes(opt.value);
															return (
																<label
																	key={opt.value}
																	className="flex items-center gap-2 text-xs text-[#2b2f36] dark:text-zinc-200"
																>
																	<Checkbox
																		checked={checked}
																		onCheckedChange={(nextChecked) =>
																			setDraftFilters((prev) => {
																				const prevValues = Array.isArray(prev[field.id])
																					? ([...(prev[field.id] as string[])] as string[])
																					: [];
																				const nextValues = nextChecked
																					? Array.from(new Set([...prevValues, opt.value]))
																					: prevValues.filter((value) => value !== opt.value);
																				return {
																					...prev,
																					[field.id]: nextValues,
																				};
																			})
																		}
																		disabled={readOnly}
																	/>
																	<span>{opt.label}</span>
																</label>
															);
														})}
													</div>
												)}
												{field.type === "boolean-toggle" && (
													<div className="flex gap-1.5">
														{[
															{ value: "all", label: "Todos" },
															{ value: "si", label: "Si" },
															{ value: "no", label: "No" },
														].map((opt) => (
															<Button
																key={opt.value}
																variant={
																	draftFilters[field.id] === opt.value ? "default" : "outline"
																}
																size="sm"
																className={`flex-1 text-xs h-7 ${draftFilters[field.id] === opt.value
																	? "bg-[#2b2f36] text-[#f7f7f8]"
																	: "border-[#d5d8df] text-[#3a3f45] bg-transparent"
																	}`}
																onClick={() =>
																	setDraftFilters((prev) => ({
																		...prev,
																		[field.id]: opt.value,
																	}))
																}
																disabled={readOnly}
															>
																{opt.label}
															</Button>
														))}
													</div>
												)}
											</div>
										)})}
									</div>

									<div className="pt-3">
										<div className="flex gap-2">
											<Button
												data-wizard-target="report-apply-filters-button"
												size="sm"
												className="flex-1 bg-[#2b2f36] hover:bg-[#1f2328] text-[#f7f7f8] text-xs"
												onClick={() => setFilters(draftFilters)}
												disabled={readOnly}
											>
												Aplicar filtros
											</Button>
											<Button
												size="sm"
												variant="outline"
												className="text-xs"
												onClick={handleResetFilters}
												disabled={readOnly}
											>
												Reiniciar
											</Button>
										</div>
									</div>
								</div>
							</ScrollArea>
						</TabsContent>

						{/* VISUAL TAB */}
						<TabsContent value="visual" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="p-4 space-y-5">
									<section className={sectionClassName}>
										<div className="flex items-start justify-between gap-3">
											<div>
												<h3 className={sectionHeaderClassName}>Panel de estilo</h3>
												<p className="mt-1 text-xs text-[#475569]">
													Resumen, tarjetas y mini graficos
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												className={softButtonClassName}
												onClick={() => setActivePanel("settings")}
											>
												Inicio
											</Button>
										</div>
									</section>
									<div className="space-y-3">
										<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
											Resumen de tabla
										</h3>
										<div className="grid grid-cols-2 gap-2">
											<Button
												variant={reportState.summaryDisplay === "row" ? "default" : "outline"}
												size="sm"
												className={`h-9 text-xs ${reportState.summaryDisplay === "row"
													? "bg-[#2b2f36] text-[#f7f7f8] hover:bg-[#1f2328]"
													: "border-[#d5d8df] text-[#3a3f45] hover:bg-[#e2e5eb] bg-transparent"
													}`}
												onClick={() =>
													setReportState((prev) => ({ ...prev, summaryDisplay: "row" }))
												}
												disabled={readOnly}
											>
												Fila de totales
											</Button>
											<Button
												variant={reportState.summaryDisplay === "card" ? "default" : "outline"}
												size="sm"
												className={`h-9 text-xs ${reportState.summaryDisplay === "card"
													? "bg-[#2b2f36] text-[#f7f7f8] hover:bg-[#1f2328]"
													: "border-[#d5d8df] text-[#3a3f45] hover:bg-[#e2e5eb] bg-transparent"
													}`}
												onClick={() =>
													setReportState((prev) => ({ ...prev, summaryDisplay: "card" }))
												}
												disabled={readOnly}
											>
												Tarjeta resumen
											</Button>
										</div>
									</div>

									<Separator className="bg-[#d5d8df] dark:bg-zinc-700" />

									<div className="space-y-3">
										<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
											Gráficos rápidos
										</h3>
										<div className="flex items-center justify-between gap-2">
											<span className="text-xs text-[#3a3f45] dark:text-zinc-300">
												Mostrar mini gráficos en totales
											</span>
											<Checkbox
												checked={reportState.showMiniCharts}
												onCheckedChange={(value) =>
													setReportState((prev) => ({
														...prev,
														showMiniCharts: Boolean(value),
													}))
												}
												disabled={readOnly}
											/>
										</div>
										{reportState.showMiniCharts && (
											<div className="grid grid-cols-2 gap-2">
												<Button
													variant={
														reportState.summaryChartType === "bar"
															? "default"
															: "outline"
													}
													size="sm"
													className={`h-8 text-xs ${reportState.summaryChartType === "bar"
														? "bg-[#2b2f36] text-[#f7f7f8] hover:bg-[#1f2328]"
														: "border-[#d5d8df] text-[#3a3f45] hover:bg-[#e2e5eb] bg-transparent"
														}`}
													onClick={() =>
														setReportState((prev) => ({ ...prev, summaryChartType: "bar" }))
													}
													disabled={readOnly}
												>
													Barras
												</Button>
												<Button
													variant={
														reportState.summaryChartType === "line"
															? "default"
															: "outline"
													}
													size="sm"
													className={`h-8 text-xs ${reportState.summaryChartType === "line"
														? "bg-[#2b2f36] text-[#f7f7f8] hover:bg-[#1f2328]"
														: "border-[#d5d8df] text-[#3a3f45] hover:bg-[#e2e5eb] bg-transparent"
														}`}
													onClick={() =>
														setReportState((prev) => ({ ...prev, summaryChartType: "line" }))
													}
													disabled={readOnly}
												>
													Líneas
												</Button>
											</div>
										)}
										<p className="text-[11px] text-[#5f6670] dark:text-zinc-400">
											Útil para valores como montos, cantidades o avances (estilo Excel).
										</p>
									</div>

									<Separator className="bg-[#d5d8df] dark:bg-zinc-700" />

									<div className="space-y-2.5">
										<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
											Próximamente
										</h3>
										<div className="grid grid-cols-1 gap-2">
											<Button variant="outline" size="sm" disabled className="h-8 text-xs">
												Comparativas visuales
											</Button>
											<Button variant="outline" size="sm" disabled className="h-8 text-xs">
												Gráficos por grupo
											</Button>
											<Button variant="outline" size="sm" disabled className="h-8 text-xs">
												Resumen por período
											</Button>
										</div>
									</div>
								</div>
							</ScrollArea>
						</TabsContent>

						{/* PRESETS TAB */}
						<TabsContent value="presets" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="p-4 space-y-5">
									<section className={sectionClassName}>
										<div className="flex items-start justify-between gap-3">
											<div>
												<h3 className={sectionHeaderClassName}>Panel de presets</h3>
												<p className="mt-1 text-xs text-[#475569]">
													{presets.length} guardados y {templates.length + suggestedTemplates.length} plantillas
												</p>
											</div>
											<Button
												variant="outline"
												size="sm"
												className={softButtonClassName}
												onClick={() => setActivePanel("settings")}
											>
												Inicio
											</Button>
										</div>
									</section>
									<div className="space-y-3">
										<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
											Presets guardados
										</h3>
										<div className="space-y-1.5">
											{presets.length === 0 && (
												<p className="text-xs text-[#5f6670] dark:text-zinc-400">
													No hay presets guardados.
												</p>
											)}
											{presets.map((preset) => (
												<div
													key={preset.id}
													className="flex items-center gap-2"
												>
													<Button
														variant="outline"
														size="sm"
														className="flex-1 justify-between border-[#d5d8df] text-[#3a3f45] bg-transparent"
														onClick={() => handleApplyPreset(preset)}
													>
														<span className="truncate">{preset.name}</span>
														<span className="text-[10px] text-muted-foreground">Aplicar</span>
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="h-8 px-2 border-[#d5d8df] text-[#8a3b3b] hover:text-[#a23f3f] bg-transparent"
														onClick={() => handleDeletePreset(preset.id)}
														disabled={readOnly}
													>
														Eliminar
													</Button>
												</div>
											))}
										</div>
									</div>

									<Separator className="bg-[#d5d8df] dark:bg-zinc-700" />

									<div className="space-y-2.5">
										<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
											Guardar preset
										</h3>
										<Input
											placeholder="Nombre del preset"
											value={presetName}
											onChange={(e) => setPresetName(e.target.value)}
											className="h-8 text-sm bg-[#f7f7f8] dark:bg-zinc-700 border-[#d5d8df] dark:border-zinc-600"
											disabled={readOnly}
										/>
										<Button
											size="sm"
											className="w-full bg-[#2b2f36] hover:bg-[#1f2328] text-[#f7f7f8] text-xs"
											onClick={handleSavePreset}
											disabled={readOnly}
										>
											Guardar preset
										</Button>
									</div>

									<Separator className="bg-[#d5d8df] dark:bg-zinc-700" />

									<div className="space-y-2.5">
										<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
											Plantillas recomendadas
										</h3>
										<div className="space-y-1.5">
											{suggestedTemplates.length === 0 && templates.length === 0 && (
												<p className="text-xs text-[#5f6670] dark:text-zinc-400">
													No hay plantillas disponibles.
												</p>
											)}
											{suggestedTemplates.map((template) => (
												<Button
													key={template.id}
													variant="outline"
													size="sm"
													className="w-full justify-between border-[#d5d8df] text-[#3a3f45] bg-transparent"
													onClick={() => handleApplyTemplate(template)}
												>
													<span className="truncate">{template.name}</span>
													<span className="text-[10px] text-muted-foreground">Sugerida</span>
												</Button>
											))}
											{templates.map((template) => (
												<Button
													key={template.id}
													variant="outline"
													size="sm"
													className="w-full justify-between border-[#d5d8df] text-[#3a3f45] bg-transparent"
													onClick={() => handleApplyTemplate(template)}
												>
													<span className="truncate">{template.name}</span>
													<span className="text-[10px] text-muted-foreground">Aplicar</span>
												</Button>
											))}
										</div>
									</div>
								</div>
							</ScrollArea>
						</TabsContent>
					</Tabs>
				</div>
			</div>

			<Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Compartir reporte</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<Label>Expiración</Label>
						<Select value={shareExpiryDays} onValueChange={setShareExpiryDays}>
							<SelectTrigger>
								<SelectValue placeholder="Seleccionar" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">1 día</SelectItem>
								<SelectItem value="7">7 días</SelectItem>
								<SelectItem value="30">30 días</SelectItem>
								<SelectItem value="never">Sin expiración</SelectItem>
							</SelectContent>
						</Select>
						{shareUrl && (
							<div className="space-y-1">
								<Label>Enlace</Label>
								<Input value={shareUrl} readOnly />
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
							Cerrar
						</Button>
						<Button onClick={handleCreateShareLink} disabled={isSharing}>
							{isSharing ? "Generando..." : "Generar enlace"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Fragment>
	);
}
