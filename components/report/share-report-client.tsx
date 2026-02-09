"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { ReportPage } from "@/components/report";
import { obrasReportConfig } from "@/components/report/configs/obras";
import { certificadosReportConfig } from "@/components/report/configs/certificados";
import {
	buildOcrReportConfig,
	type TablaColumn,
} from "@/components/report/builders/ocr-report-config";
import {
	buildMacroReportConfig,
	type MacroTableWithColumns,
} from "@/components/report/builders/macro-report-config";

type SharePayload = {
	filters?: Record<string, unknown>;
	reportState?: Record<string, unknown>;
	compareEnabled?: boolean;
	shareMeta?: Record<string, unknown> | null;
};

type ShareRecord = {
	report_key: string;
	payload?: SharePayload | null;
};

type ShareReportClientProps = {
	share: ShareRecord;
};

export function ShareReportClient({ share }: ShareReportClientProps) {
	const payload = share.payload ?? {};
	const shareMeta = payload.shareMeta ?? {};
	const [config, setConfig] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const reportKey = share.report_key;

	useEffect(() => {
		let cancelled = false;

		const loadConfig = async () => {
			try {
				setIsLoading(true);
				setError(null);

				if (reportKey === "obras") {
					if (!cancelled) setConfig(obrasReportConfig);
					return;
				}
				if (reportKey === "certificados") {
					if (!cancelled) setConfig(certificadosReportConfig);
					return;
				}

				if (shareMeta?.type === "ocr-tabla") {
					const obraId = String(shareMeta.obraId ?? "");
					const tablaId = String(shareMeta.tablaId ?? "");
					if (!obraId || !tablaId) {
						throw new Error("Faltan datos para la tabla OCR");
					}

					const tablasRes = await fetch(`/api/obras/${obraId}/tablas`);
					if (!tablasRes.ok) throw new Error("No se pudo cargar la tabla");
					const tablasData = await tablasRes.json();
					const tabla = (tablasData.tablas || []).find(
						(t: { id: string }) => t.id === tablaId
					);
					if (!tabla) throw new Error("Tabla OCR no encontrada");

					const cols: TablaColumn[] = (tabla.columns || []).map(
						(col: {
							id: string;
							fieldKey: string;
							label: string;
							dataType: string;
							required: boolean;
						}) => ({
							id: col.id,
							fieldKey: col.fieldKey,
							label: col.label,
							dataType: col.dataType,
							required: col.required,
						})
					);

					let hasDocSource = false;
					const rowsRes = await fetch(
						`/api/obras/${obraId}/tablas/${tablaId}/rows?limit=1`
					);
					if (rowsRes.ok) {
						const rowsData = await rowsRes.json();
						const firstRow = (rowsData.rows || [])[0];
						hasDocSource = Boolean(firstRow?.data?.__docFileName);
					}

					const nextConfig = buildOcrReportConfig(
						obraId,
						tablaId,
						tabla.name || "Tabla OCR",
						cols,
						hasDocSource
					);
					if (!cancelled) setConfig(nextConfig);
					return;
				}

				if (shareMeta?.type === "macro") {
					const macroTableId = String(shareMeta.macroTableId ?? "");
					if (!macroTableId) {
						throw new Error("Faltan datos para la macro tabla");
					}
					const res = await fetch(`/api/macro-tables/${macroTableId}`);
					if (!res.ok) throw new Error("No se pudo cargar la macro tabla");
					const data: { macroTable: MacroTableWithColumns } = await res.json();
					const nextConfig = buildMacroReportConfig(data.macroTable);
					if (!cancelled) setConfig(nextConfig);
					return;
				}

				throw new Error("Tipo de reporte no soportado");
			} catch (err) {
				console.error(err);
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "No se pudo cargar el reporte"
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void loadConfig();

		return () => {
			cancelled = true;
		};
	}, [reportKey, shareMeta]);

	const initialFilters = useMemo(
		() => (payload.filters ? payload.filters : undefined),
		[payload.filters]
	);
	const initialReportState = useMemo(
		() => (payload.reportState ? payload.reportState : undefined),
		[payload.reportState]
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-[70vh]">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error || !config) {
		return (
			<div className="flex flex-col items-center justify-center h-[70vh] gap-3 text-muted-foreground">
				<AlertCircle className="h-10 w-10" />
				<p>{error ?? "No se pudo cargar el reporte compartido."}</p>
			</div>
		);
	}

	return (
		<ReportPage
			config={config}
			backUrl="/"
			initialFilters={initialFilters}
			initialReportState={initialReportState}
			initialCompareEnabled={Boolean(payload.compareEnabled)}
			readOnly
		/>
	);
}
