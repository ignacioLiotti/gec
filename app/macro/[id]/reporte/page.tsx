"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportPage } from "@/components/report";
import type { ReportConfig } from "@/components/report/types";
import {
	buildMacroReportConfig,
	type MacroReportFilters,
	type MacroTableWithColumns,
} from "@/components/report/builders/macro-report-config";

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

	const [macroTable, setMacroTable] =
		useState<MacroTableResponse["macroTable"] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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
		<ReportPage
			config={reportConfig}
			backUrl={`/macro?macroId=${macroTable?.id}`}
		/>
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
