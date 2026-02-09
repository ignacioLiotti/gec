'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, ChevronLeft, Filter, Settings, Loader2, Share2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import type { ReportConfig, ReportState, AggregationType } from "./types";
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

export function ReportPage<Row, Filters extends Record<string, unknown>>({
	config,
	initialFilters,
	initialReportState,
	initialCompareEnabled,
	backUrl,
	readOnly = false,
}: ReportPageProps<Row, Filters>) {
	const router = useRouter();
	const reportContentRef = useRef<HTMLDivElement>(null);

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
	const [presets, setPresets] = useState<any[]>([]);
	const [templates, setTemplates] = useState<any[]>([]);
	const [presetName, setPresetName] = useState("");
	const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
	const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [shareExpiryDays, setShareExpiryDays] = useState<string>("7");
	const [isCompareEnabled, setIsCompareEnabled] = useState(Boolean(initialCompareEnabled));
	const [, startFetchTransition] = useTransition();

	// Filters state
	const [filters, setFilters] = useState<Filters>(() => {
		const defaults = config.defaultFilters?.() ?? ({} as Filters);
		return { ...defaults, ...initialFilters };
	});
	const [draftFilters, setDraftFilters] = useState<Filters>(() => {
		const defaults = config.defaultFilters?.() ?? ({} as Filters);
		return { ...defaults, ...initialFilters };
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
		return { ...baseState, ...(initialReportState ?? {}) };
	});

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
			const payload = await res.json();
			setPresets(payload.presets ?? []);
		} catch (err) {
			console.error(err);
		}
	}, []);

	const loadTemplates = useCallback(async () => {
		try {
			const res = await fetch(`/api/reports/templates?reportKey=${configRef.current.id}`);
			if (!res.ok) throw new Error("No se pudieron cargar las plantillas");
			const payload = await res.json();
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

	const handleApplyPreset = useCallback((preset: any) => {
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

	const handleApplyTemplate = useCallback((template: any) => {
		const payload = template.payload ?? {};
		if (payload.filters) {
			const nextFilters = (prev: Filters) => ({ ...prev, ...(payload.filters ?? {}) });
			setFilters(nextFilters);
			setDraftFilters(nextFilters);
		}
		if (payload.reportState) {
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
		const templates: Array<{ id: string; name: string; payload: any }> = [];
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

	// Group data
	const groupedData = useMemo(() => {
		if (reportState.viewMode === "full") {
			return [{ key: config.title, data }];
		}

		const groupOption = groupByOptions?.find(
			(opt) => opt.id === reportState.viewMode
		);
		if (!groupOption) {
			return [{ key: config.title, data }];
		}

		const groups: Record<string, Row[]> = {};
		for (const row of data) {
			const key = groupOption.groupBy(row) || "Sin asignar";
			if (!groups[key]) groups[key] = [];
			groups[key].push(row);
		}

		return Object.entries(groups)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, rows]) => ({ key, data: rows }));
	}, [data, reportState.viewMode, groupByOptions, config.title]);

	const compareGroupedData = useMemo(() => {
		if (!compareData) return null;
		if (reportState.viewMode === "full") {
			return [{ key: config.title, data: compareData }];
		}
		const groupOption = groupByOptions?.find(
			(opt) => opt.id === reportState.viewMode
		);
		if (!groupOption) {
			return [{ key: config.title, data: compareData }];
		}
		const groups: Record<string, Row[]> = {};
		for (const row of compareData) {
			const key = groupOption.groupBy(row) || "Sin asignar";
			if (!groups[key]) groups[key] = [];
			groups[key].push(row);
		}
		return Object.entries(groups)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, rows]) => ({ key, data: rows }));
	}, [compareData, reportState.viewMode, groupByOptions, config.title]);

	const compareLookup = useMemo(() => {
		if (!compareGroupedData) return new Map<string, Row[]>();
		return new Map(compareGroupedData.map((group) => [group.key, group.data]));
	}, [compareGroupedData]);


	// Visible columns
	const visibleColumns = useMemo(
		() => columns.filter((col) => !reportState.hiddenColumnIds.includes(col.id)),
		[columns, reportState.hiddenColumnIds]
	);

	// Handle back navigation
	const handleBack = useCallback(() => {
		if (backUrl) {
			router.push(backUrl);
		} else {
			router.back();
		}
	}, [backUrl, router]);

	return (
		<Fragment>
			<div className="flex h-[calc(100vh-4rem)] overflow-hidden w-full">
				{/* Main Content - Report Preview */}
				<div className="flex-1 flex flex-col min-w-0 bg-[#f4f5f7] dark:bg-zinc-900 relative">
					{/* Toolbar */}
					<div className="flex items-center gap-3 px-4 py-2.5 bg-[#e9ebef] dark:bg-zinc-800 border-b border-[#d5d8df] dark:border-zinc-700 no-print shrink-0">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleBack}
							className="gap-1.5 text-[#2b2f36] dark:text-zinc-300 hover:bg-[#d9dde4] dark:hover:bg-zinc-700"
						>
							<ChevronLeft className="h-4 w-4" />
							Volver
						</Button>
						<div className="ml-auto flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsShareDialogOpen(true)}
								disabled={readOnly || isSharing}
								className="gap-2"
							>
								<Share2 className="h-4 w-4" />
								Compartir
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleExportCsv}
								disabled={isLoading}
								className="gap-2"
							>
								<FileSpreadsheet className="h-4 w-4" />
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
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<FileSpreadsheet className="h-4 w-4" />
								)}
								Excel
							</Button>
							<Button
								onClick={handleGeneratePdf}
								disabled={isGeneratingPdf || isLoading}
								size="sm"
								className="gap-2 bg-[#2b2f36] hover:bg-[#1f2328] text-[#f7f7f8] dark:bg-zinc-600 dark:hover:bg-zinc-500"
							>
								{isGeneratingPdf ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<FileDown className="h-4 w-4" />
								)}
								{isGeneratingPdf ? "Generando..." : "Descargar PDF"}
							</Button>
						</div>
					</div>

					{/* Paper area */}
					<div className="flex-1 overflow-auto flex justify-center py-8 px-4">
						<div ref={reportContentRef} className="flex flex-col gap-8">
							{isLoading ? (
								<div className="report-paper pdf-preview ">
									<div className="report-body flex items-center justify-center py-16">
										<Loader2 className="h-6 w-6 animate-spin text-[#7a8088]" />
									</div>
								</div>
							) : groupedData.length === 0 ? (
								<div className="report-paper pdf-preview ">
									<div className="report-body flex items-center justify-center py-20 text-[#7a8088]">
										Sin datos para mostrar
									</div>
								</div>
							) : (
								<div className="report-paper pdf-preview ">
									{/* Decorative top border - double line */}
									<div className="report-border-top" />

									{/* Document Header */}
									<div className="report-header-block">
										<div className="report-company font-serif">
											{reportState.companyName}
										</div>
										<div className="report-divider" />
										<div className="report-meta">
											<div className="report-title-text font-serif">
												{reportState.description}
											</div>
											<div className="report-date-text font-mono">
												{reportState.date}
											</div>
										</div>
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

				{/* Right Sidebar - Filters & Settings */}
				<div className="w-80 border-l border-[#d5d8df] dark:border-zinc-700 bg-[#f0f2f5] dark:bg-zinc-800 flex flex-col shrink-0">
					<Tabs defaultValue="settings" className="flex-1 flex flex-col">
						<div className="px-4 pt-4 pb-3 border-b border-[#d5d8df] dark:border-zinc-700">
							<TabsList className="grid w-full grid-cols-4 bg-[#e2e5eb] dark:bg-zinc-700">
								<TabsTrigger value="settings" className="gap-1.5 text-xs data-[state=active]:bg-[#f7f7f8] dark:data-[state=active]:bg-zinc-600">
									<Settings className="h-3.5 w-3.5" />
									Configuracion
								</TabsTrigger>
								<TabsTrigger value="filters" className="gap-1.5 text-xs data-[state=active]:bg-[#f7f7f8] dark:data-[state=active]:bg-zinc-600">
									<Filter className="h-3.5 w-3.5" />
									Filtros
								</TabsTrigger>
								<TabsTrigger value="visual" className="gap-1.5 text-xs data-[state=active]:bg-[#f7f7f8] dark:data-[state=active]:bg-zinc-600">
									Vista
								</TabsTrigger>
								<TabsTrigger value="presets" className="gap-1.5 text-xs data-[state=active]:bg-[#f7f7f8] dark:data-[state=active]:bg-zinc-600">
									Presets
								</TabsTrigger>
							</TabsList>
						</div>

						{/* SETTINGS TAB */}
						<TabsContent value="settings" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full max-h-[calc(100vh-10rem)]">
								<div className="p-4 space-y-5">
									{/* Header fields */}
									<div className="space-y-3">
										<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
											Encabezado
										</h3>
										<div className="space-y-2">
											<div className="space-y-1">
												<Label className="text-xs text-[#5f6670] dark:text-zinc-400">Empresa</Label>
												<Input
													value={reportState.companyName}
													onChange={(e) =>
														setReportState((prev) => ({
															...prev,
															companyName: e.target.value,
														}))
													}
													className="h-8 text-sm bg-[#f7f7f8] dark:bg-zinc-700 border-[#d5d8df] dark:border-zinc-600"
													disabled={readOnly}
												/>
											</div>
											<div className="space-y-1">
												<Label className="text-xs text-[#5f6670] dark:text-zinc-400">Descripcion</Label>
												<Input
													value={reportState.description}
													onChange={(e) =>
														setReportState((prev) => ({
															...prev,
															description: e.target.value,
														}))
													}
													className="h-8 text-sm bg-[#f7f7f8] dark:bg-zinc-700 border-[#d5d8df] dark:border-zinc-600"
													disabled={readOnly}
												/>
											</div>
										</div>
									</div>

									<Separator className="bg-[#d5d8df] dark:bg-zinc-700" />

									{config.compare && (
										<>
											<div className="space-y-3">
												<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
													Comparar
												</h3>
												<div className="flex items-center justify-between gap-2">
													<span className="text-xs text-[#3a3f45] dark:text-zinc-300">
														Comparar período anterior
													</span>
													<Checkbox
														checked={isCompareEnabled}
														onCheckedChange={(value) => setIsCompareEnabled(Boolean(value))}
														disabled={readOnly}
													/>
												</div>
											</div>
											<Separator className="bg-[#d5d8df] dark:bg-zinc-700" />
										</>
									)}

									{/* View Mode */}
									{/* Column config */}
									<div className="space-y-3">
										<div className="flex items-center justify-between gap-2">
											<h3 className="text-[11px] font-semibold text-[#7b828c] dark:text-zinc-400 uppercase tracking-widest">
												Configurar columnas
											</h3>
											{groupByOptions.length > 0 && (
												<Button
													variant={reportState.viewMode === "full" ? "default" : "outline"}
													size="sm"
													className={`h-7 px-2 text-[11px] ${reportState.viewMode === "full"
														? "bg-[#2b2f36] text-[#f7f7f8] hover:bg-[#1f2328]"
														: "border-[#d5d8df] text-[#3a3f45] hover:bg-[#e2e5eb] bg-transparent"
														}`}
													onClick={() =>
														setReportState((prev) => ({ ...prev, viewMode: "full" }))
													}
													disabled={readOnly}
												>
													Sin agrupar
												</Button>
											)}
										</div>
										<div className="space-y-2.5">
											{columns.map((col) => {
												const isVisible = !reportState.hiddenColumnIds.includes(col.id);
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
														className={`rounded border px-2.5 py-2 space-y-2 ${isVisible
															? "border-[#d5d8df] dark:border-zinc-700 bg-[#f7f7f8] dark:bg-zinc-800/70"
															: "border-[#e3e6ec] dark:border-zinc-700/60 bg-[#eef1f5] dark:bg-zinc-800/40 opacity-60"
															}`}
													>
														<div className="flex items-center justify-between gap-2">
															<div className="flex items-center gap-2 min-w-0">
																<Checkbox
																	id={`col-${col.id}`}
																	checked={isVisible}
																	onCheckedChange={() => toggleColumnVisibility(col.id)}
																	disabled={readOnly}
																/>
																<Label
																	htmlFor={`col-${col.id}`}
																	className="text-xs font-medium cursor-pointer text-[#2b2f36] dark:text-zinc-200 truncate"
																>
																	{col.label}
																</Label>
															</div>
															{groupOption && (
																<Button
																	variant={isGrouped ? "default" : "outline"}
																	size="sm"
																	className={`h-7 px-2 text-[11px] ${isGrouped
																		? "bg-[#2b2f36] text-[#f7f7f8] hover:bg-[#1f2328]"
																		: "border-[#d5d8df] text-[#3a3f45] hover:bg-[#e2e5eb] bg-transparent"
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
														<div className="flex items-center gap-2">
															<span className="text-[11px] text-[#5f6670] dark:text-zinc-400">
																Total
															</span>
															<select
																className="flex-1 rounded border border-[#d5d8df] dark:border-zinc-600 bg-white/70 dark:bg-zinc-700 px-2 py-1 text-[11px] text-[#2b2f36] dark:text-zinc-200"
																value={reportState.aggregations[col.id] || "none"}
																onChange={(e) =>
																	setAggregation(col.id, e.target.value as AggregationType)
																}
																disabled={readOnly || !isVisible}
															>
																<option value="none">Sin total</option>
																<option value="sum">Suma</option>
																<option value="count">Contar</option>
																<option value="count-checked">Contar marcados</option>
																<option value="average">Promedio</option>
																<option value="min">Mínimo</option>
																<option value="max">Máximo</option>
															</select>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								</div>
							</ScrollArea>
						</TabsContent>

						{/* FILTERS TAB */}
						<TabsContent value="filters" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="p-4 space-y-5">
									{filterFields?.map((field) => (
										<div key={String(field.id)} className="space-y-1.5">
											<Label className="text-xs text-[#5f6670] dark:text-zinc-400">{field.label}</Label>
											{field.type === "text" && (
												<Input
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
									))}

									<div className="pt-3">
										<Button
											size="sm"
											className="w-full bg-[#2b2f36] hover:bg-[#1f2328] text-[#f7f7f8] text-xs"
											onClick={() => setFilters(draftFilters)}
											disabled={readOnly}
										>
											Aplicar Filtros
										</Button>
									</div>
								</div>
							</ScrollArea>
						</TabsContent>

						{/* VISUAL TAB */}
						<TabsContent value="visual" className="flex-1 p-0 m-0 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="p-4 space-y-5">
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
