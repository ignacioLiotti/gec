"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportPage } from "@/components/report";
import type {
	ReportColumn,
	ReportColumnType,
	ReportConfig,
} from "@/components/report/types";
import type {
	MacroTable,
	MacroTableColumn,
	MacroTableDataType,
	MacroTableRow,
} from "@/lib/macro-tables";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MacroReportFilters = {
	search: string;
};

type MacroTableResponse = {
	macroTable: MacroTable & { columns: MacroTableColumn[] };
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapColumnType(type: MacroTableDataType): ReportColumnType {
	switch (type) {
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

function buildReportConfig(
	macroTable: MacroTableResponse["macroTable"]
): ReportConfig<MacroTableRow, MacroReportFilters> {
	const baseColumns = macroTable.columns ?? [];

	const reportColumns: ReportColumn<MacroTableRow>[] = baseColumns.map((col) => ({
		id: col.id,
		label: col.label,
		accessor: (row: MacroTableRow) => row[col.id],
		type: mapColumnType(col.dataType),
		align:
			col.dataType === "number" || col.dataType === "currency"
				? ("right" as const)
				: ("left" as const),
		defaultAggregation:
			col.dataType === "number" || col.dataType === "currency" ? "sum" : "none",
	}));

	// Add obra name column if not already present
	if (!reportColumns.some((col) => col.id === "_obraName")) {
		reportColumns.unshift({
			id: "_obraName",
			label: "Obra",
			accessor: (row: MacroTableRow) => row._obraName,
			type: "text",
			align: "left",
		});
	}

	return {
		id: `macro-report-${macroTable.id}`,
		title: macroTable.name,
		description: macroTable.description ?? "Reporte de macro tabla",
		columns: reportColumns,
		currencyCode: "ARS",
		currencyLocale: "es-AR",
		filterFields: [
			{
				id: "search",
				label: "Buscar",
				type: "text",
				placeholder: "Buscar en todas las columnas",
			},
		],
		defaultFilters: () => ({ search: "" }),
		fetchData: async (filters: MacroReportFilters) => {
			const query = new URLSearchParams({ limit: "1000" });
			const res = await fetch(
				`/api/macro-tables/${macroTable.id}/rows?${query.toString()}`
			);
			if (!res.ok) {
				throw new Error(
					"No se pudieron obtener los datos de la macro tabla"
				);
			}
			const data = await res.json();
			let rows: MacroTableRow[] = data.rows ?? [];

			const term = filters.search?.trim().toLowerCase();
			if (term) {
				rows = rows.filter((row) =>
					reportColumns.some((column) => {
						const value = row[column.id];
						if (value == null) return false;
						return String(value).toLowerCase().includes(term);
					})
				);
			}

			return rows;
		},
		getRowId: (row: MacroTableRow) => String(row.id),
	};
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
