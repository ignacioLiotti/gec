"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { copyToClipboard, tableRowToCsv, valuesToCsvRow } from "./table-utils";
import type { ColumnDef, FormTableConfig, FormTableRow, SortState } from "./types";

export function useTableExport<Row extends FormTableRow, Filters>({
	config,
	rows,
	sortedRows,
	processedRows,
	hiddenColumnIds,
	isColumnHidden,
	searchRequestKey,
	filters,
	activeTab,
	effectiveSortState,
}: {
	config: FormTableConfig<Row, Filters>;
	rows: Row[];
	sortedRows: Row[];
	processedRows: Row[];
	hiddenColumnIds: string[];
	isColumnHidden: (id: string) => boolean;
	searchRequestKey: string;
	filters: Filters | undefined;
	activeTab: string | null;
	effectiveSortState: SortState;
}) {
	const TABLE_ID = config.tableId;
	const columns = config.columns;
	const processedRowsRef = useRef(processedRows);
	useEffect(() => {
		processedRowsRef.current = processedRows;
	}, [processedRows]);
	const handleCopyCell = useCallback(async (value: unknown) => {
		const success = await copyToClipboard(value == null ? "" : String(value));
		toast[success ? "success" : "error"](
			success ? "Valor copiado al portapapeles" : "No se pudo copiar"
		);
	}, []);

	const handleCopyColumn = useCallback(async (column: ColumnDef<Row>) => {
		const snapshot = processedRowsRef.current;
		const values = snapshot.map((row) => row[column.field] ?? "").join("\n");
		const success = await copyToClipboard(values);
		toast[success ? "success" : "error"](
			success ? "Columna copiada" : "No se pudo copiar la columna"
		);
	}, []);

	const handleCopyRow = useCallback(
		async (row: Row) => {
			const success = await copyToClipboard(tableRowToCsv(row, columns));
			toast[success ? "success" : "error"](
				success ? "Fila copiada en CSV" : "No se pudo copiar la fila"
			);
		},
		[columns]
	);

	const handleExportCsv = useCallback(async () => {
		try {
			const exportColumns = columns.filter((column) => !isColumnHidden(column.id));
			if (exportColumns.length === 0) {
				toast.error("No hay columnas visibles para exportar");
				return;
			}
			const customExport = config.csvExport?.buildExport
				? await config.csvExport.buildExport({
						tableId: TABLE_ID,
						rows,
						sortedRows,
						visibleColumns: exportColumns,
						allColumns: columns,
						hiddenColumnIds,
						search: searchRequestKey,
						filters,
						activeTab,
						sort: effectiveSortState,
					})
				: null;
			const exportRowCount = customExport ? customExport.rows.length : sortedRows.length;
			if (exportRowCount === 0) {
				toast.error("No hay filas para exportar");
				return;
			}
			const separator = ";";
			const header = customExport
				? valuesToCsvRow(customExport.columns)
				: exportColumns.map((column) => `"${column.label.replace(/"/g, '""')}"`).join(separator);
			const body = customExport
				? customExport.rows.map((row) => valuesToCsvRow(row)).join("\n")
				: sortedRows.map((row) => tableRowToCsv(row, exportColumns)).join("\n");
			const csv = `\uFEFF${header}\n${body}`;
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `${customExport?.fileName ?? TABLE_ID}.csv`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			toast.success("Tabla exportada");
		} catch (error) {
			console.error("Error exporting table", error);
			toast.error(error instanceof Error ? error.message : "No se pudo exportar la tabla");
		}
	}, [
		TABLE_ID,
		activeTab,
		columns,
		config.csvExport,
		effectiveSortState,
		filters,
		hiddenColumnIds,
		isColumnHidden,
		rows,
		searchRequestKey,
		sortedRows,
	]);

	return { handleCopyCell, handleCopyColumn, handleCopyRow, handleExportCsv };
}
