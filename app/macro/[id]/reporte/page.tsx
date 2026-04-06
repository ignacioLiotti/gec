"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportPage } from "@/components/report";
import type { ReportConfig } from "@/components/report/types";
import {
	buildMacroReportConfig,
	type MacroReportFilters,
	type MacroTableWithColumns,
} from "@/components/report/builders/macro-report-config";
import { ContextualWizard, type WizardFlow } from "@/components/ui/contextual-wizard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MacroTableResponse = {
	macroTable: MacroTableWithColumns;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildReportConfig(
	macroTable: MacroTableResponse["macroTable"]
): ReportConfig<any, MacroReportFilters> {
	return buildMacroReportConfig(macroTable);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function MacroTableReportContent() {
	const params = useParams();
	const id = params?.id as string;
	const router = useRouter();
	const searchParams = useSearchParams();

	const [macroTable, setMacroTable] =
		useState<MacroTableResponse["macroTable"] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const isMacroReportTour = searchParams.get("tour") === "macro-report";

	useEffect(() => {
		if (!id) return;

		let cancelled = false;

		const loadMacroTable = async () => {
			try {
				setIsLoading(true);
				setError(null);
				const res = await fetch(`/api/macro-tables/${id}`);
				if (!res.ok) {
					throw new Error("No se pudo cargar la macro tabla");
				}
				const data: MacroTableResponse = await res.json();
				if (!cancelled) {
					setMacroTable(data.macroTable);
				}
			} catch (err) {
				console.error(err);
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Error desconocido"
					);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		void loadMacroTable();

		return () => {
			cancelled = true;
		};
	}, [id]);

	const reportConfig = useMemo(() => {
		if (!macroTable) return null;
		return buildReportConfig(macroTable);
	}, [macroTable]);

	const macroReportFlow = useMemo<WizardFlow | null>(() => {
		if (!isMacroReportTour) return null;
		return {
			id: "macro-report",
			title: "Recorrido guiado",
			steps: [
				{
					id: "report-preview",
					targetId: "report-preview-area",
					title: "Listo para exportar o compartir",
					content:
						"Los mismos datos de la tabla, ahora en formato reporte. Descargalo como PDF para enviárselo a alguien, o como Excel para seguir trabajando con los números.",
					placement: "left",
					skippable: false,
					waitForMs: 3500,
				},
				{
					id: "agrupar-obra",
					targetId: "report-config-agrupar-obra",
					title: "Organizá los gastos por obra",
					content:
						"Hacé clic en 'Agrupar' para separar los ítems de cada obra. En vez de una lista mezclada, cada obra va a aparecer con sus propios gastos agrupados.",
					placement: "left",
					allowClickThrough: true,
					requiredAction: "click_target",
					skippable: false,
					waitForMs: 3000,
				},
				{
					id: "sumar-precio-total",
					targetId: "report-config-total-precio-total",
					title: "Sumá el gasto total por obra",
					content:
						"Elegí 'Suma' en el menú de Precio Total. Cada grupo de obra va a mostrar el total gastado al final. Cuando lo hagas, hacé clic en Finalizar.",
					placement: "left",
					allowClickThrough: true,
					skippable: false,
					waitForMs: 2500,
				},
			],
		};
	}, [isMacroReportTour]);

	const finishMacroReportTour = useCallback(() => {
		router.push("/dashboard?tour=demo-conclusion");
	}, [router]);

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
				<p>
					{error ??
						"No se pudo generar el reporte para esta macro tabla."}
				</p>
				<Button
					variant="outline"
					onClick={() => window.history.back()}
				>
					Volver
				</Button>
			</div>
		);
	}

	return (
		<>
			<ReportPage
				config={reportConfig}
				backUrl={`/macro?macroId=${macroTable?.id}`}
			/>
			{macroReportFlow ? (
				<ContextualWizard
					open
					onOpenChange={() => {}}
					flow={macroReportFlow}
					showCloseButton={false}
					finishLabel="Finalizar"
					onComplete={finishMacroReportTour}
				/>
			) : null}
		</>
	);
}

export default function MacroTableReportPage() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen">
					Cargando...
				</div>
			}
		>
			<MacroTableReportContent />
		</Suspense>
	);
}
