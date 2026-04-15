'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportPage } from "@/components/report";
import type { ReportConfig } from "@/components/report/types";
import {
	buildOcrReportConfig,
	type TablaColumn,
	type OcrReportFilters,
} from "@/components/report/builders/ocr-report-config";
import { ContextualWizard, type WizardFlow } from "@/components/ui/contextual-wizard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildReportConfig(
	obraId: string,
	tablaId: string,
	tablaName: string,
	tablaColumns: TablaColumn[],
	hasDocSource: boolean
): ReportConfig<any, OcrReportFilters> {
	return buildOcrReportConfig(obraId, tablaId, tablaName, tablaColumns, hasDocSource);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function OcrReportePageContent() {
	const params = useParams();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const obraId = params?.obraId as string;
	const tablaId = params?.tablaId as string;

	const [tablaName, setTablaName] = useState<string>("");
	const [tablaColumns, setTablaColumns] = useState<TablaColumn[]>([]);
	const [hasDocSource, setHasDocSource] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isMaterialsReportWizardOpen, setIsMaterialsReportWizardOpen] = useState(false);
	const isMaterialsReportTour = searchParams.get("tour") === "materials-report";

	useEffect(() => {
		const loadTabla = async () => {
			if (!obraId || !tablaId) return;
			try {
				setIsLoading(true);
				setError(null);

				// Fetch tabla metadata to get columns
				const tablasRes = await fetch(`/api/obras/${obraId}/tablas`);
				if (!tablasRes.ok) throw new Error("No se pudo cargar las tablas");
				const tablasData = await tablasRes.json();

				const tabla = (tablasData.tablas || []).find(
					(t: { id: string }) => t.id === tablaId
				);
				if (!tabla) throw new Error("Tabla no encontrada");

				const cols: TablaColumn[] = (tabla.columns || []).map(
					(col: {
						id: string;
						fieldKey: string;
						label: string;
						dataType: string;
						required: boolean;
						config?: Record<string, unknown>;
					}) => ({
						id: col.id,
						fieldKey: col.fieldKey,
						label: col.label,
						dataType: col.dataType,
						required: col.required,
						config: col.config ?? {},
					})
				);

				setTablaName(tabla.name || "Tabla OCR");
				setTablaColumns(cols);

				// Quick check if any rows have doc source info
				const rowsRes = await fetch(
					`/api/obras/${obraId}/tablas/${tablaId}/rows?limit=1`
				);
				if (rowsRes.ok) {
					const rowsData = await rowsRes.json();
					const firstRow = (rowsData.rows || [])[0];
					setHasDocSource(!!firstRow?.data?.__docFileName);
				}
			} catch (err) {
				console.error(err);
				setError(
					err instanceof Error ? err.message : "Error al cargar datos"
				);
			} finally {
				setIsLoading(false);
			}
		};

		void loadTabla();
	}, [obraId, tablaId]);

	const reportConfig = useMemo(() => {
		if (!tablaColumns.length) return null;
		return buildReportConfig(
			obraId,
			tablaId,
			tablaName,
			tablaColumns,
			hasDocSource
		);
	}, [obraId, tablaId, tablaName, tablaColumns, hasDocSource]);

	const clearMaterialsTourQuery = useCallback(() => {
		if (!isMaterialsReportTour) return;
		const params = new URLSearchParams(searchParams.toString());
		params.delete("tour");
		const nextUrl = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
		router.replace(nextUrl, { scroll: false });
	}, [isMaterialsReportTour, pathname, router, searchParams]);

	useEffect(() => {
		if (isMaterialsReportTour) {
			setIsMaterialsReportWizardOpen(true);
		}
	}, [isMaterialsReportTour]);

	const materialsReportFlow = useMemo<WizardFlow | null>(() => {
		if (!isMaterialsReportTour) return null;
		return {
			id: "materials-report",
			title: "Análisis de Precios",
			steps: [
				{
					id: "report-preview",
					targetId: "report-preview-area",
					title: "Personaliza este reporte",
					content:
						"Desde Filtros podes filtrar filas, y desde Configuracion podes ocultar columnas o agrupar por valores.",
					placement: "left",
					skippable: false,
					waitForMs: 2600,
				},

				{
					id: "open-settings-tab",
					targetId: "report-tab-settings",
					title: "Volver a Configuracion",
					content:
						"Volve a Configuracion para ajustar columnas y agrupacion.",
					placement: "bottom",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "hide-documento-column",
					targetId: "report-config-toggle-documento",
					title: "Oculta Documento",
					content:
						"Desmarca la columna Documento.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "hide-unidad-column",
					targetId: "report-config-toggle-unidad",
					title: "Oculta Item Unidad",
					content:
						"Desmarca tambien Item Unidad.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "hide-cantidad-column",
					targetId: "report-config-toggle-cantidad",
					title: "Oculta Item Cantidad",
					content:
						"Desmarca tambien Item Cantidad.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "group-by-description",
					targetId: "report-config-agrupar-descripcion",
					title: "Agrupa por Descripcion",
					content:
						"Para terminar, hace clic en Agrupar de la columna Descripcion.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2600,
				},
				{
					id: "open-filters-tab",
					targetId: "report-tab-filters",
					title: "Ir a Filtros",
					content:
						"Hace clic en Filtros para ver donde filtrar filas del reporte.",
					placement: "bottom",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "show-all-filters",
					targetId: "report-filters-panel",
					title: "Todos los filtros",
					content:
						"Aca tenes todos los filtros disponibles para acotar las filas del reporte.",
					placement: "left",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "filter-description-arena",
					targetId: "report-filter-input-descripcion",
					title: "Filtra por Descripcion",
					content:
						"Hace clic en el filtro de Descripcion e ingresa el texto \"arena\" para probar como se filtran las filas.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "apply-filters",
					targetId: "report-apply-filters-button",
					title: "Aplicar filtros",
					content:
						"Ahora hace clic en Aplicar filtros para ver el resultado del filtro en el reporte.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "preview-filtered-report",
					targetId: "report-preview-area",
					title: "Resultado del filtro",
					content:
						"Mira el reporte: ya se aplico el filtro y ahora ves como quedan las filas filtradas.",
					placement: "left",
					skippable: false,
					waitForMs: 2400,
				},
				{
					id: "download-formats",
					targetId: "report-export-actions",
					title: "Descargar el reporte",
					content:
						"Cuando termines, podes descargar el reporte en formato Excel o PDF desde estos botones.",
					placement: "bottom",
					skippable: false,
					waitForMs: 2400,
				},
			],
		};
	}, [isMaterialsReportTour]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-[70vh]">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error || !reportConfig) {
		return (
			<div className="flex flex-col items-center justify-center h-[70vh] gap-3 text-muted-foreground">
				<AlertCircle className="h-10 w-10" />
				<p>{error ?? "No se pudo generar el reporte para esta tabla."}</p>
				<Button variant="outline" onClick={() => window.history.back()}>
					Volver
				</Button>
			</div>
		);
	}

	return (
		<>
			<ReportPage
				config={reportConfig}
				backUrl={`/excel/${obraId}`}
			/>
			{materialsReportFlow ? (
				<ContextualWizard
					open={isMaterialsReportWizardOpen}
					onOpenChange={(nextOpen) => {
						setIsMaterialsReportWizardOpen(nextOpen);
						if (!nextOpen) {
							clearMaterialsTourQuery();
						}
					}}
					flow={materialsReportFlow}
					finishLabel="Entendido"
					onComplete={clearMaterialsTourQuery}
				/>
			) : null}
		</>
	);
}

export default function Page() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen">
					Cargando...
				</div>
			}
		>
			<OcrReportePageContent />
		</Suspense>
	);
}
