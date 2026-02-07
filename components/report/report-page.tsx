'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileDown, ChevronLeft, Filter, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReportConfig, ReportState, AggregationType } from "./types";
import { ReportTable } from "./report-table";
import { generatePdf } from "@/lib/pdf/generate-pdf";

type ReportPageProps<Row, Filters> = {
	config: ReportConfig<Row, Filters>;
	initialFilters?: Partial<Filters>;
	backUrl?: string;
};

export function ReportPage<Row, Filters extends Record<string, unknown>>({
	config,
	initialFilters,
	backUrl,
}: ReportPageProps<Row, Filters>) {
	const router = useRouter();
	const reportContentRef = useRef<HTMLDivElement>(null);

	// Stabilize config reference
	const configRef = useRef(config);
	configRef.current = config;

	// Data state
	const [data, setData] = useState<Row[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

	// Filters state
	const [filters, setFilters] = useState<Filters>(() => {
		const defaults = config.defaultFilters?.() ?? ({} as Filters);
		return { ...defaults, ...initialFilters };
	});

	// Report display state
	const [reportState, setReportState] = useState<ReportState>(() => ({
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
	}));

	// Fetch data
	const fetchData = useCallback(async () => {
		try {
			setIsLoading(true);
			const result = await configRef.current.fetchData(filters);
			setData(result);
		} catch (err) {
			console.error(err);
			toast.error("Error al cargar datos para el reporte");
		} finally {
			setIsLoading(false);
		}
	}, [filters]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

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
	const groupByOptions = useMemo(() => config.groupByOptions, [config.groupByOptions]);
	const filterFields = useMemo(() => config.filterFields, [config.filterFields]);

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
		<div className="flex h-[calc(100vh-4rem)] overflow-hidden w-full">
			{/* Main Content - Report Preview */}
			<div className="flex-1 flex flex-col min-w-0 bg-[#d5d0c8] dark:bg-zinc-900 relative">
				{/* Toolbar */}
				<div className="flex items-center gap-3 px-4 py-2.5 bg-[#cbc5bb] dark:bg-zinc-800 border-b border-[#b8b0a4] dark:border-zinc-700 no-print shrink-0">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleBack}
						className="gap-1.5 text-[#4a4540] dark:text-zinc-300 hover:bg-[#bfb8ad] dark:hover:bg-zinc-700"
					>
						<ChevronLeft className="h-4 w-4" />
						Volver
					</Button>
					<div className="ml-auto">
						<Button
							onClick={handleGeneratePdf}
							disabled={isGeneratingPdf || isLoading}
							size="sm"
							className="gap-2 bg-[#3d3a36] hover:bg-[#2a2825] text-[#f5f2ed] dark:bg-zinc-600 dark:hover:bg-zinc-500"
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
					<div className="report-paper pdf-preview">
						<div ref={reportContentRef}>
							{/* Decorative top border - double line */}
							<div className="report-border-top" />

							{/* Document Header */}
							<div className="report-header-block">
								<div className="report-company font-serif text-balance">
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
								{isLoading ? (
									<div className="flex items-center justify-center py-16">
										<Loader2 className="h-6 w-6 animate-spin text-[#8a8078]" />
									</div>
								) : (
									groupedData.map(({ key, data: groupData }) => (
										<ReportTable
											key={key}
											title={key}
											data={groupData}
											columns={columns}
											hiddenColumnIds={reportState.hiddenColumnIds}
											sortColumnId={reportState.sortColumnId}
											sortDirection={reportState.sortDirection}
											onSort={handleSort}
											aggregations={reportState.aggregations}
											getRowId={configRef.current.getRowId}
											currencyLocale={config.currencyLocale}
											currencyCode={config.currencyCode}
										/>
									))
								)}
							</div>

							{/* Footer line */}
							<div className="report-footer-line" />
						</div>
					</div>
				</div>
			</div>

			{/* Right Sidebar - Filters & Settings */}
			<div className="w-80 border-l border-[#c5bfb6] dark:border-zinc-700 bg-[#eae7e1] dark:bg-zinc-800 flex flex-col shrink-0">
				<Tabs defaultValue="settings" className="flex-1 flex flex-col">
					<div className="px-4 pt-4 pb-3 border-b border-[#d5d0c8] dark:border-zinc-700">
						<TabsList className="grid w-full grid-cols-2 bg-[#d5d0c8] dark:bg-zinc-700">
							<TabsTrigger value="settings" className="gap-1.5 text-xs data-[state=active]:bg-[#f5f2ed] dark:data-[state=active]:bg-zinc-600">
								<Settings className="h-3.5 w-3.5" />
								Configuracion
							</TabsTrigger>
							<TabsTrigger value="filters" className="gap-1.5 text-xs data-[state=active]:bg-[#f5f2ed] dark:data-[state=active]:bg-zinc-600">
								<Filter className="h-3.5 w-3.5" />
								Filtros
							</TabsTrigger>
						</TabsList>
					</div>

					{/* SETTINGS TAB */}
					<TabsContent value="settings" className="flex-1 p-0 m-0 overflow-hidden">
						<ScrollArea className="h-full max-h-[calc(100vh-10rem)]">
							<div className="p-4 space-y-5">
								{/* Header fields */}
								<div className="space-y-3">
									<h3 className="text-[11px] font-semibold text-[#8a8078] dark:text-zinc-400 uppercase tracking-widest">
										Encabezado
									</h3>
									<div className="space-y-2">
										<div className="space-y-1">
											<Label className="text-xs text-[#6b645c] dark:text-zinc-400">Empresa</Label>
											<Input
												value={reportState.companyName}
												onChange={(e) =>
													setReportState((prev) => ({
														...prev,
														companyName: e.target.value,
													}))
												}
												className="h-8 text-sm bg-[#f5f2ed] dark:bg-zinc-700 border-[#c5bfb6] dark:border-zinc-600"
											/>
										</div>
										<div className="space-y-1">
											<Label className="text-xs text-[#6b645c] dark:text-zinc-400">Descripcion</Label>
											<Input
												value={reportState.description}
												onChange={(e) =>
													setReportState((prev) => ({
														...prev,
														description: e.target.value,
													}))
												}
												className="h-8 text-sm bg-[#f5f2ed] dark:bg-zinc-700 border-[#c5bfb6] dark:border-zinc-600"
											/>
										</div>
									</div>
								</div>

								<Separator className="bg-[#d5d0c8] dark:bg-zinc-700" />

								{/* View Mode */}
								{groupByOptions && groupByOptions.length > 0 && (
									<>
										<div className="space-y-3">
											<h3 className="text-[11px] font-semibold text-[#8a8078] dark:text-zinc-400 uppercase tracking-widest">
												Modo de Vista
											</h3>
											<div className="grid grid-cols-1 gap-1.5">
												<Button
													variant={reportState.viewMode === "full" ? "default" : "outline"}
													size="sm"
													className={`justify-start text-xs h-8 ${
														reportState.viewMode === "full"
															? "bg-[#3d3a36] text-[#f5f2ed] hover:bg-[#2a2825]"
															: "border-[#c5bfb6] text-[#4a4540] hover:bg-[#d5d0c8] bg-transparent"
													}`}
													onClick={() =>
														setReportState((prev) => ({ ...prev, viewMode: "full" }))
													}
												>
													Vista Completa
												</Button>
												{groupByOptions.map((opt) => (
													<Button
														key={opt.id}
														variant={reportState.viewMode === opt.id ? "default" : "outline"}
														size="sm"
														className={`justify-start text-xs h-8 ${
															reportState.viewMode === opt.id
																? "bg-[#3d3a36] text-[#f5f2ed] hover:bg-[#2a2825]"
																: "border-[#c5bfb6] text-[#4a4540] hover:bg-[#d5d0c8] bg-transparent"
														}`}
														onClick={() =>
															setReportState((prev) => ({ ...prev, viewMode: opt.id }))
														}
													>
														{opt.label}
													</Button>
												))}
											</div>
										</div>
										<Separator className="bg-[#d5d0c8] dark:bg-zinc-700" />
									</>
								)}

								{/* Columns */}
								<div className="space-y-3">
									<h3 className="text-[11px] font-semibold text-[#8a8078] dark:text-zinc-400 uppercase tracking-widest">
										Columnas Visibles
									</h3>
									<div className="space-y-1.5">
										{columns.map((col) => {
											const isVisible = !reportState.hiddenColumnIds.includes(col.id);
											return (
												<div key={col.id} className="flex items-center gap-2">
													<Checkbox
														id={`col-${col.id}`}
														checked={isVisible}
														onCheckedChange={() => toggleColumnVisibility(col.id)}
													/>
													<Label
														htmlFor={`col-${col.id}`}
														className="text-xs font-normal cursor-pointer text-[#4a4540] dark:text-zinc-300"
													>
														{col.label}
													</Label>
												</div>
											);
										})}
									</div>
								</div>

								<Separator className="bg-[#d5d0c8] dark:bg-zinc-700" />

								{/* Aggregations */}
								<div className="space-y-3">
									<h3 className="text-[11px] font-semibold text-[#8a8078] dark:text-zinc-400 uppercase tracking-widest">
										Totales
									</h3>
									<div className="space-y-2.5">
										{visibleColumns.map((col) => (
											<div key={col.id} className="space-y-1">
												<Label className="text-[11px] text-[#6b645c] dark:text-zinc-400">{col.label}</Label>
												<select
													className="w-full rounded border border-[#c5bfb6] dark:border-zinc-600 bg-[#f5f2ed] dark:bg-zinc-700 px-2.5 py-1 text-xs text-[#3d3a36] dark:text-zinc-200"
													value={reportState.aggregations[col.id] || "none"}
													onChange={(e) =>
														setAggregation(col.id, e.target.value as AggregationType)
													}
												>
													<option value="none">Sin total</option>
													<option value="sum">Suma</option>
													<option value="count">Contar</option>
													<option value="count-checked">Contar marcados</option>
													<option value="average">Promedio</option>
												</select>
											</div>
										))}
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
										<Label className="text-xs text-[#6b645c] dark:text-zinc-400">{field.label}</Label>
										{field.type === "text" && (
											<Input
												placeholder={field.placeholder}
												value={String(filters[field.id] || "")}
												onChange={(e) =>
													setFilters((prev) => ({
														...prev,
														[field.id]: e.target.value,
													}))
												}
												className="h-8 text-sm bg-[#f5f2ed] dark:bg-zinc-700 border-[#c5bfb6] dark:border-zinc-600"
											/>
										)}
										{field.type === "number" && (
											<Input
												type="number"
												placeholder={field.placeholder}
												value={String(filters[field.id] || "")}
												onChange={(e) =>
													setFilters((prev) => ({
														...prev,
														[field.id]: e.target.value,
													}))
												}
												className="h-8 text-sm bg-[#f5f2ed] dark:bg-zinc-700 border-[#c5bfb6] dark:border-zinc-600"
											/>
										)}
										{field.type === "date" && (
											<Input
												type="date"
												value={String(filters[field.id] || "")}
												onChange={(e) =>
													setFilters((prev) => ({
														...prev,
														[field.id]: e.target.value,
													}))
												}
												className="h-8 text-sm bg-[#f5f2ed] dark:bg-zinc-700 border-[#c5bfb6] dark:border-zinc-600"
											/>
										)}
										{field.type === "select" && field.options && (
											<select
												className="w-full rounded border border-[#c5bfb6] dark:border-zinc-600 bg-[#f5f2ed] dark:bg-zinc-700 px-2.5 py-1.5 text-xs text-[#3d3a36] dark:text-zinc-200"
												value={String(filters[field.id] || "")}
												onChange={(e) =>
													setFilters((prev) => ({
														...prev,
														[field.id]: e.target.value,
													}))
												}
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
															filters[field.id] === opt.value ? "default" : "outline"
														}
														size="sm"
														className={`flex-1 text-xs h-7 ${
															filters[field.id] === opt.value
																? "bg-[#3d3a36] text-[#f5f2ed]"
																: "border-[#c5bfb6] text-[#4a4540] bg-transparent"
														}`}
														onClick={() =>
															setFilters((prev) => ({
																...prev,
																[field.id]: opt.value,
															}))
														}
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
										className="w-full bg-[#3d3a36] hover:bg-[#2a2825] text-[#f5f2ed] text-xs"
										onClick={fetchData}
									>
										Aplicar Filtros
									</Button>
								</div>
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
