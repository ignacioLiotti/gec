'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Printer, ChevronLeft, Filter, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReportColumn, AggregationType, ReportState } from "@/components/report/types";
import { ReportTable } from "@/components/report/report-table";

type TablaColumn = {
	id: string;
	fieldKey: string;
	label: string;
	dataType: string;
	required: boolean;
};

type TablaRow = {
	id: string;
	data: Record<string, unknown>;
};

type OcrTableRow = {
	id: string;
	[key: string]: unknown;
};

function mapDataTypeToReportType(dataType: string): ReportColumn<OcrTableRow>["type"] {
	switch (dataType) {
		case "number":
			return "number";
		case "currency":
			return "currency";
		case "boolean":
			return "boolean";
		case "date":
			return "date";
		default:
			return "text";
	}
}

function OcrReportePageContent() {
	const router = useRouter();
	const params = useParams();
	const obraId = params?.obraId as string;
	const tablaId = params?.tablaId as string;

	const [tablaName, setTablaName] = useState<string>("");
	const [columns, setColumns] = useState<TablaColumn[]>([]);
	const [rows, setRows] = useState<OcrTableRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [reportState, setReportState] = useState<ReportState>({
		companyName: "Nombre de la empresa",
		description: "",
		date: new Date().toLocaleDateString("es-AR"),
		viewMode: "full",
		hiddenColumnIds: [],
		sortColumnId: null,
		sortDirection: "asc",
		aggregations: {},
	});

	// Fetch tabla data
	const fetchData = useCallback(async () => {
		if (!obraId || !tablaId) return;
		try {
			setIsLoading(true);

			// Fetch tablas list to get columns
			const tablasRes = await fetch(`/api/obras/${obraId}/tablas`);
			if (!tablasRes.ok) throw new Error("No se pudo cargar las tablas");
			const tablasData = await tablasRes.json();

			// Find the specific tabla
			const tabla = (tablasData.tablas || []).find((t: any) => t.id === tablaId);
			if (!tabla) throw new Error("Tabla no encontrada");

			const tablaColumns: TablaColumn[] = (tabla.columns || []).map((col: any) => ({
				id: col.id,
				fieldKey: col.fieldKey,
				label: col.label,
				dataType: col.dataType,
				required: col.required,
			}));
			const name = tabla.name || "Tabla OCR";

			setTablaName(name);
			setColumns(tablaColumns);

			// Fetch rows
			const rowsRes = await fetch(`/api/obras/${obraId}/tablas/${tablaId}/rows?limit=200`);
			if (!rowsRes.ok) throw new Error("No se pudieron cargar las filas");
			const rowsData = await rowsRes.json();
			const tablaRows: TablaRow[] = rowsData.rows || [];

			// Map rows to flat structure
			const mappedRows: OcrTableRow[] = tablaRows.map((row) => {
				const mapped: OcrTableRow = { id: row.id };
				tablaColumns.forEach((col) => {
					mapped[col.fieldKey] = row.data?.[col.fieldKey] ?? null;
				});
				// Include doc source info if available
				if (row.data?.__docFileName) {
					mapped.__docFileName = row.data.__docFileName;
				}
				return mapped;
			});

			setRows(mappedRows);

			// Initialize aggregations
			const initialAggregations: Record<string, AggregationType> = {};
			tablaColumns.forEach((col) => {
				initialAggregations[col.fieldKey] =
					col.dataType === "currency" || col.dataType === "number" ? "sum" : "none";
			});

			setReportState((prev) => ({
				...prev,
				description: `Reporte de ${name}`,
				aggregations: initialAggregations,
			}));
		} catch (err) {
			console.error(err);
			toast.error("Error al cargar datos para el reporte");
		} finally {
			setIsLoading(false);
		}
	}, [obraId, tablaId]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Build report columns from tabla columns
	const reportColumns = useMemo<ReportColumn<OcrTableRow>[]>(() => {
		const cols: ReportColumn<OcrTableRow>[] = columns.map((col) => ({
			id: col.fieldKey,
			label: col.label,
			accessor: (row) => row[col.fieldKey],
			type: mapDataTypeToReportType(col.dataType),
			align: col.dataType === "currency" || col.dataType === "number" ? "right" : "left",
			defaultAggregation:
				col.dataType === "currency" || col.dataType === "number" ? "sum" : "none",
		}));

		// Add doc source column if rows have it
		if (rows.some((r) => r.__docFileName)) {
			cols.unshift({
				id: "__docFileName",
				label: "Documento",
				accessor: (row) => row.__docFileName,
				type: "text",
				align: "left",
			});
		}

		return cols;
	}, [columns, rows]);

	// Handle sorting
	const handleSort = useCallback((columnId: string) => {
		setReportState((prev) => ({
			...prev,
			sortColumnId: columnId,
			sortDirection:
				prev.sortColumnId === columnId && prev.sortDirection === "asc" ? "desc" : "asc",
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

	// Visible columns (for settings)
	const visibleColumns = useMemo(
		() => reportColumns.filter((col) => !reportState.hiddenColumnIds.includes(col.id)),
		[reportColumns, reportState.hiddenColumnIds]
	);

	return (
		<div className="flex h-[calc(100vh-4rem)] overflow-hidden w-full">
			{/* Print styles */}
			<style>{`
				@media print {
					@page { size: A4; margin: 10mm; }
					body { background: white !important; }
					.no-print { display: none !important; }
					.print-only { display: block !important; }
					.report-container { overflow: visible !important; height: auto !important; }
				}
			`}</style>

			{/* Main Content - Report Preview */}
			<div className="w-full flex justify-center items-center pt-4 bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_10px,var(--border)_10px,var(--border)_11px,transparent_12px)] bg-repeat relative">
				<div className="flex justify-center items-start gap-4 mb-6 no-print absolute top-0 left-0 w-full p-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => router.back()}
						className="gap-2"
					>
						<ChevronLeft className="h-4 w-4" />
						Volver
					</Button>
					<div className="ml-auto">
						<Button onClick={() => window.print()} className="gap-2">
							<Printer className="h-4 w-4" />
							Imprimir / PDF
						</Button>
					</div>
				</div>

				<div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 report-container overflow-auto relative max-w-[210mm] max-h-[297mm] h-full overflow-y-auto">
					<div className="p-6 print:p-0">
						<div className="space-y-6 max-w-[1200px] mx-auto print:max-w-none print:mx-0">
							{/* Report Header Inputs */}
							<div className="space-y-3 border-b pb-4 print:border-none">
								<input
									type="text"
									value={reportState.companyName}
									onChange={(e) =>
										setReportState((prev) => ({
											...prev,
											companyName: e.target.value,
										}))
									}
									className="text-2xl font-bold w-full border-none outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 bg-transparent"
									placeholder="Nombre de la empresa"
								/>
								<input
									type="text"
									value={reportState.description}
									onChange={(e) =>
										setReportState((prev) => ({
											...prev,
											description: e.target.value,
										}))
									}
									className="text-lg text-muted-foreground w-full border-none outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 bg-transparent"
									placeholder="Descripción del reporte"
								/>
								<input
									type="text"
									value={reportState.date}
									onChange={(e) =>
										setReportState((prev) => ({ ...prev, date: e.target.value }))
									}
									className="text-sm text-muted-foreground w-full border-none outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 bg-transparent"
									placeholder="Fecha"
								/>
							</div>

							{/* Report Tables */}
							<div className="space-y-8">
								{isLoading ? (
									<div className="flex items-center justify-center py-12">
										<Loader2 className="h-8 w-8 animate-spin text-primary" />
									</div>
								) : (
									<ReportTable
										title={tablaName}
										data={rows}
										columns={reportColumns}
										hiddenColumnIds={reportState.hiddenColumnIds}
										sortColumnId={reportState.sortColumnId}
										sortDirection={reportState.sortDirection}
										onSort={handleSort}
										aggregations={reportState.aggregations}
										getRowId={(row) => row.id}
										currencyLocale="es-AR"
										currencyCode="ARS"
									/>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Right Sidebar - Settings */}
			<div className="w-80 border-l bg-muted/30 flex flex-col no-print">
				<Tabs defaultValue="settings" className="flex-1 flex flex-col">
					<div className="p-4 border-b">
						<TabsList className="grid w-full grid-cols-1">
							<TabsTrigger value="settings" className="gap-2">
								<Settings className="h-4 w-4" />
								Configuración
							</TabsTrigger>
						</TabsList>
					</div>

					{/* SETTINGS TAB */}
					<TabsContent value="settings" className="flex-1 p-0 m-0 overflow-hidden">
						<ScrollArea className="h-full max-h-[calc(100vh-10rem)]">
							<div className="p-4 space-y-6">
								{/* Columns */}
								<div className="space-y-3">
									<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
										Columnas Visibles
									</h3>
									<div className="space-y-2">
										{reportColumns.map((col) => {
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
				</Tabs>
			</div>
		</div>
	);
}

export default function Page() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen">Cargando...</div>
			}
		>
			<OcrReportePageContent />
		</Suspense>
	);
}
