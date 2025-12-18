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
	const [reportState, setReportState] = useState<ReportState>({
		companyName: "Nombre de la empresa",
		description: config.description || `Reporte de ${config.title}`,
		date: new Date().toLocaleDateString("es-AR"),
		viewMode: "full",
		hiddenColumnIds: [],
		sortColumnId: null,
		sortDirection: "asc",
		aggregations: config.columns.reduce(
			(acc, col) => {
				acc[col.id] = col.defaultAggregation || "none";
				return acc;
			},
			{} as Record<string, AggregationType>
		),
	});

	// Fetch data
	const fetchData = useCallback(async () => {
		try {
			setIsLoading(true);
			const result = await config.fetchData(filters);
			setData(result);
		} catch (err) {
			console.error(err);
			toast.error("Error al cargar datos para el reporte");
		} finally {
			setIsLoading(false);
		}
	}, [config, filters]);

	// Initial fetch
	useEffect(() => {
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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

	// Group data by selected option
	const groupedData = useMemo(() => {
		if (reportState.viewMode === "full") {
			return [{ key: config.title, data }];
		}

		const groupOption = config.groupByOptions?.find(
			(opt) => opt.id === reportState.viewMode
		);
		if (!groupOption) {
			return [{ key: config.title, data }];
		}

		const groups: Record<string, Row[]> = {};
		data.forEach((row) => {
			const key = groupOption.groupBy(row) || "Sin asignar";
			if (!groups[key]) groups[key] = [];
			groups[key].push(row);
		});

		return Object.entries(groups)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, rows]) => ({ key, data: rows }));
	}, [data, reportState.viewMode, config.groupByOptions, config.title]);

	// Visible columns (for settings)
	const visibleColumns = useMemo(
		() => config.columns.filter((col) => !reportState.hiddenColumnIds.includes(col.id)),
		[config.columns, reportState.hiddenColumnIds]
	);

	return (
		<div className="flex h-[calc(100vh-4rem)] overflow-hidden w-full">
			{/* Main Content - Report Preview */}
			<div className="w-full flex justify-center items-center pt-4 relative">
				<div className="flex justify-center items-start gap-4 mb-6 no-print absolute top-0 left-0 w-full p-4 z-10">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => (backUrl ? router.push(backUrl) : router.back())}
						className="gap-2 bg-background/80 backdrop-blur-sm"
					>
						<ChevronLeft className="h-4 w-4" />
						Volver
					</Button>
					<div className="ml-auto">
						<Button
							onClick={handleGeneratePdf}
							disabled={isGeneratingPdf || isLoading}
							className="gap-2"
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

				<div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 report-container overflow-auto relative max-w-[210mm] max-h-[297mm] h-full overflow-y-auto shadow-xl pdf-preview">
					<div className="p-6" ref={reportContentRef}>
						<div className="space-y-6 max-w-[1200px] mx-auto">
							{/* Report Header */}
							<div className="space-y-3 border-b pb-4">
								<div className="text-2xl font-bold">{reportState.companyName}</div>
								<div className="text-lg text-muted-foreground">{reportState.description}</div>
								<div className="text-sm text-muted-foreground">{reportState.date}</div>
							</div>

							{/* Report Tables */}
							<div className="space-y-8">
								{isLoading ? (
									<div className="flex items-center justify-center py-12">
										<Loader2 className="h-8 w-8 animate-spin text-primary" />
									</div>
								) : (
									groupedData.map(({ key, data: groupData }) => (
										<ReportTable
											key={key}
											title={key}
											data={groupData}
											columns={config.columns}
											hiddenColumnIds={reportState.hiddenColumnIds}
											sortColumnId={reportState.sortColumnId}
											sortDirection={reportState.sortDirection}
											onSort={handleSort}
											aggregations={reportState.aggregations}
											getRowId={config.getRowId}
											currencyLocale={config.currencyLocale}
											currencyCode={config.currencyCode}
										/>
									))
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Right Sidebar - Filters & Settings */}
			<div className="w-80 border-l bg-muted/30 flex flex-col">
				<Tabs defaultValue="settings" className="flex-1 flex flex-col">
					<div className="p-4 border-b">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="settings" className="gap-2">
								<Settings className="h-4 w-4" />
								Configuración
							</TabsTrigger>
							<TabsTrigger value="filters" className="gap-2">
								<Filter className="h-4 w-4" />
								Filtros
							</TabsTrigger>
						</TabsList>
					</div>

					{/* SETTINGS TAB */}
					<TabsContent value="settings" className="flex-1 p-0 m-0 overflow-hidden">
						<ScrollArea className="h-full max-h-[calc(100vh-10rem)]">
							<div className="p-4 space-y-6">
								{/* View Mode */}
								{config.groupByOptions && config.groupByOptions.length > 0 && (
									<>
										<div className="space-y-3">
											<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
												Modo de Vista
											</h3>
											<div className="grid grid-cols-1 gap-2">
												<Button
													variant={reportState.viewMode === "full" ? "default" : "outline"}
													className="justify-start"
													onClick={() =>
														setReportState((prev) => ({ ...prev, viewMode: "full" }))
													}
												>
													Vista Completa
												</Button>
												{config.groupByOptions.map((opt) => (
													<Button
														key={opt.id}
														variant={reportState.viewMode === opt.id ? "default" : "outline"}
														className="justify-start"
														onClick={() =>
															setReportState((prev) => ({ ...prev, viewMode: opt.id }))
														}
													>
														{opt.label}
													</Button>
												))}
											</div>
										</div>
										<Separator />
									</>
								)}

								{/* Columns */}
								<div className="space-y-3">
									<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
										Columnas Visibles
									</h3>
									<div className="space-y-2">
										{config.columns.map((col) => {
											const isVisible = !reportState.hiddenColumnIds.includes(col.id);
											return (
												<div key={col.id} className="flex items-center space-x-2">
													<Checkbox
														id={`col-${col.id}`}
														checked={isVisible}
														onCheckedChange={() => toggleColumnVisibility(col.id)}
													/>
													<Label
														htmlFor={`col-${col.id}`}
														className="text-sm font-normal cursor-pointer"
													>
														{col.label}
													</Label>
												</div>
											);
										})}
									</div>
								</div>

								<Separator />

								{/* Aggregations */}
								<div className="space-y-3">
									<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
										Totales
									</h3>
									<div className="space-y-3">
										{visibleColumns.map((col) => (
											<div key={col.id} className="space-y-1">
												<Label className="text-xs">{col.label}</Label>
												<select
													className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
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
							<div className="p-4 space-y-6">
								{config.filterFields?.map((field) => (
									<div key={String(field.id)} className="space-y-2">
										<Label>{field.label}</Label>
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
											/>
										)}
										{field.type === "select" && field.options && (
											<select
												className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
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
											<div className="flex gap-2">
												{[
													{ value: "all", label: "Todos" },
													{ value: "si", label: "Sí" },
													{ value: "no", label: "No" },
												].map((opt) => (
													<Button
														key={opt.value}
														variant={
															filters[field.id] === opt.value ? "default" : "outline"
														}
														size="sm"
														className="flex-1"
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

								<div className="pt-4">
									<Button className="w-full" onClick={fetchData}>
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
