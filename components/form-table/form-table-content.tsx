"use client";

import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import { useMemo, useRef } from "react";
import { useFormTable } from "./context";
import { MemoizedTableRow } from "./table-body";
import type { FormTableRow } from "./types";

import { DEFAULT_ROW_NUMBER_COLUMN_WIDTH, shouldUseSpreadsheetChrome } from "./table-layout";

import { TableHeader } from "./table-header";
import { useTableNavigation } from "./table-navigation";
function getTableActivityMessage(kind: TableActivityKind, isSlow: boolean) {
	if (!isSlow) {
		switch (kind) {
			case "sorting":
				return "Ordenando...";
			case "search":
				return "Filtrando por busqueda...";
			case "filter":
				return "Aplicando filtros...";
			case "pagination":
				return "Actualizando pagina...";
			case "loading":
			default:
				return "Cargando datos...";
		}
	}

	switch (kind) {
		case "sorting":
			return "Ordenando... esto esta tardando un poco mas de lo normal";
		case "search":
			return "Buscando... esto esta tardando un poco mas de lo normal";
		case "filter":
			return "Aplicando filtros... esto puede tomar unos segundos";
		case "pagination":
			return "Cambiando pagina... estamos procesando el resultado";
		case "loading":
		default:
			return "Cargando datos... la respuesta del servidor viene lenta";
	}
}

type TableActivityKind = import("./context").FormTableMetaState["activityKind"];
export function FormTableContent({
	className,
	innerClassName,
	tableHeight,
}: {
	className?: string;
	innerClassName?: string;
	tableHeight?: string;
}) {
	const { tableId, config, columns, rows, bulkSelection, meta, pagination } = useFormTable<
		FormTableRow,
		unknown
	>();
	const { externalRefreshVersion } = meta;
	const rowClassName = config.rowClassName as
		| ((row: FormTableRow, rowIndex: number) => string | undefined)
		| undefined;
	const rowElementClassName = config.rowElementClassName as
		| ((row: FormTableRow, rowIndex: number) => string | undefined)
		| undefined;
	const rowColorInfo = config.rowColorInfo as
		| ((row: FormTableRow, rowIndex: number) => import("./types").RowColorInfo | undefined)
		| undefined;
	const rowOverlayBadges = config.rowOverlayBadges as
		| ((
				row: FormTableRow,
				rowIndex: number
		  ) => Array<{ id: string; label: string; tone?: "amber" | "red" | "green" | "blue" }>)
		| undefined;

	const columnDefs = columns.list;
	const {
		tableRef,
		columnOffsets,
		isColumnHidden,
		getStickyProps,
		columnsById,
		hiddenIds,
		pinnedIds,
	} = columns;
	const hiddenColumnIdsKey = useMemo(() => hiddenIds.join(","), [hiddenIds]);
	const bulkSelectedRowIdsSet = useMemo(
		() => new Set(bulkSelection.selectedRowIds),
		[bulkSelection.selectedRowIds]
	);
	const {
		table,
		FieldComponent,
		highlightQuery,
		editMode,
		editOnHover,
		activeCell,
		setActiveCell,
		getRowDirtyState,
		isCellDirty,
		hasInitialRow,
		hasAccordionRows,
		accordionRowConfig,
		isRowExpanded,
		toggleAccordionRow,
		handleDelete,
		handleClearCell,
		handleRestoreCell,
		handleCommitCellValue,
		setCellValue,
		updateRow,
		handleCopyCell,
		handleCopyColumn,
		handleCopyRow,
		visibleDataColumnCount,
	} = rows;
	const accordionAlwaysOpen = Boolean(accordionRowConfig?.alwaysOpen);
	const isReadOnly = config.readOnly === true;
	const showRowNumbers = shouldUseSpreadsheetChrome(config);
	const rowNumberColumnWidth = config.rowNumberColumnWidth ?? DEFAULT_ROW_NUMBER_COLUMN_WIDTH;
	const showActionsColumn = config.showActionsColumn !== false;
	const actionsColumnPosition = config.actionsColumnPosition ?? "end";
	const actionsColumnWidth = config.actionsColumnWidth ?? 140;
	const tableLayoutClassName = config.tableLayout === "auto" ? "table-auto" : "table-fixed";
	// Rows only consume sticky left offsets, so the key that busts row memoization
	// tracks exactly those — resizing unpinned columns no longer re-renders rows
	// (their widths are applied through <col> elements).
	const stickyStateKey = useMemo(() => {
		if (pinnedIds.length === 0) return "none";
		const offsetKey = pinnedIds
			.map((columnId) => `${columnId}:${columnOffsets[columnId] ?? "?"}`)
			.join(",");
		return `${pinnedIds.join(",")}::${offsetKey}`;
	}, [pinnedIds, columnOffsets]);
	const canDeleteRows = !isReadOnly && config.allowDeleteRows !== false;
	const { serverError, activityKind, isBusy, isSlowOperation } = meta;
	const { isServerPaging, isFetching } = pagination;
	const scrollParentRef = useRef<HTMLDivElement | null>(null);
	const tableRows = table.getRowModel().rows;
	const shouldVirtualize =
		config.enableRowVirtualization === true && !hasAccordionRows && tableRows.length > 24;
	const virtualizedRowEstimate = config.virtualizationEstimateSize ?? 58;
	const rowVirtualizer = useVirtualizer({
		count: shouldVirtualize ? tableRows.length : 0,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => virtualizedRowEstimate,
		overscan: config.virtualizationOverscan ?? 5,
	});
	const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
	const paddingTop = shouldVirtualize && virtualRows.length > 0 ? virtualRows[0]!.start : 0;
	const paddingBottom =
		shouldVirtualize && virtualRows.length > 0
			? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
			: 0;
	const {
		hoveredCell,
		setHoveredCell,
		handleClearHoveredCell,
		handleArrowNavigation,
		handleBulkSelectionMouseDown,
		handleBulkSelectionMouseEnter,
		handleBulkSelectionMouseUp,
	} = useTableNavigation({
		tableRows,
		columnDefs,
		tableRef,
		isColumnHidden,
		editMode,
		isReadOnly,
		activeCell,
		setActiveCell,
		bulkSelection,
		shouldVirtualize,
		rowVirtualizer,
	});

	return (
		<>
			{serverError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
					{serverError}
				</div>
			)}
			<div className={cn("relative w-full flex-1 overflow-x-auto rounded-none bg-card", className)}>
				{isServerPaging && isFetching && tableRows.length === 0 && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-surface/80 backdrop-blur-sm">
						<Loader2 className="size-6 animate-spin text-primary" />
						<p className="text-sm font-medium text-content-muted">
							Sincronizando con el servidor...
						</p>
					</div>
				)}
				{isBusy && activityKind && tableRows.length > 0 && (
					<div className="pointer-events-none absolute right-3 top-3 z-40">
						<div
							role="status"
							aria-live="polite"
							className={cn(
								"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm",
								isSlowOperation
									? "border-amber-300 bg-amber-50 text-amber-800"
									: "border-accent-border bg-surface/90 text-orange-primary"
							)}
						>
							<Loader2 className="size-3.5 animate-spin" />
							<span>{getTableActivityMessage(activityKind, isSlowOperation)}</span>
						</div>
					</div>
				)}
				<div
					ref={scrollParentRef}
					onPointerLeave={handleClearHoveredCell}
					onKeyDownCapture={handleArrowNavigation}
					className={cn(
						"h-full overflow-y-auto bg-card scrollbar",
						bulkSelection.isDragging && "select-none cursor-crosshair",
						innerClassName
					)}
				>
					<table
						ref={tableRef}
						data-table-id={tableId}
						className={cn(
							"w-full max-w-full border-separate border-spacing-0 text-[13px] relative",
							tableLayoutClassName,
							tableHeight
						)}
					>
						<TableHeader />
						<tbody className="bg-card">
							{tableRows.length === 0 ? (
								<tr>
									<td
										colSpan={
											visibleDataColumnCount +
											(showActionsColumn ? 1 : 0) +
											(showRowNumbers ? 1 : 0)
										}
										className="px-6 py-12 text-center text-sm text-content-muted"
									>
										{config.emptyStateMessage ??
											"No encontramos filas que coincidan con tu búsqueda o filtros. Ajusta los criterios o agrega una nueva fila vacía para comenzar."}
									</td>
								</tr>
							) : (
								<>
									{paddingTop > 0 && (
										<tr>
											<td
												colSpan={
													visibleDataColumnCount +
													Number(showActionsColumn) +
													Number(showRowNumbers)
												}
												style={{ height: paddingTop }}
											/>
										</tr>
									)}
									{(shouldVirtualize
										? virtualRows.map((item) => item.index)
										: tableRows.map((_, index) => index)
									).map((rowIndex) => {
										const row = tableRows[rowIndex];
										const rowId = row.original.id;
										const { dirty: rowIsDirty, cellIdsKey: dirtyCellIds } = getRowDirtyState(rowId);
										return (
											<MemoizedTableRow
												key={rowId}
												row={row}
												rowIndex={rowIndex}
												externalRefreshVersion={externalRefreshVersion}
												hoveredCell={hoveredCell}
												setHoveredCell={setHoveredCell}
												columnsById={columnsById}
												rowClassName={rowClassName}
												rowElementClassName={rowElementClassName}
												rowColorInfo={rowColorInfo}
												rowOverlayBadges={rowOverlayBadges}
												FieldComponent={FieldComponent}
												tableReadOnly={isReadOnly}
												highlightQuery={highlightQuery}
												editMode={editMode}
												editOnHover={editOnHover}
												activeCell={activeCell}
												setActiveCell={setActiveCell}
												onCommitCellValue={handleCommitCellValue}
												hasInitialSnapshot={hasInitialRow(rowId)}
												accordionRowConfig={accordionRowConfig}
												accordionAlwaysOpen={accordionAlwaysOpen}
												isExpanded={isRowExpanded(rowId)}
												isRowDirty={rowIsDirty}
												dirtyCellIds={dirtyCellIds}
												hiddenColumnIdsKey={hiddenColumnIdsKey}
												stickyStateKey={stickyStateKey}
												showRowNumbers={showRowNumbers}
												rowNumberColumnWidth={rowNumberColumnWidth}
												showActionsColumn={showActionsColumn}
												actionsColumnPosition={actionsColumnPosition}
												actionsColumnWidth={actionsColumnWidth}
												canDeleteRows={canDeleteRows}
												isCellDirty={isCellDirty}
												bulkSelectedColumnId={bulkSelection.selectedColumn?.id ?? null}
												bulkSelectedCount={bulkSelection.count}
												isRowBulkSelected={bulkSelectedRowIdsSet.has(rowId)}
												onBulkSelectionStart={handleBulkSelectionMouseDown}
												onBulkSelectionExtend={handleBulkSelectionMouseEnter}
												onBulkSelectionEnd={handleBulkSelectionMouseUp}
												getStickyProps={getStickyProps}
												onToggleAccordion={toggleAccordionRow}
												onDelete={handleDelete}
												onClearCell={handleClearCell}
												onRestoreCell={handleRestoreCell}
												onSetCellValue={setCellValue}
												onUpdateRow={updateRow}
												onCopyCell={handleCopyCell}
												onCopyColumn={handleCopyColumn}
												onCopyRow={handleCopyRow}
												measureElement={
													shouldVirtualize ? rowVirtualizer.measureElement : undefined
												}
											/>
										);
									})}
									{paddingBottom > 0 && (
										<tr>
											<td
												colSpan={
													visibleDataColumnCount +
													Number(showActionsColumn) +
													Number(showRowNumbers)
												}
												style={{ height: paddingBottom }}
											/>
										</tr>
									)}
								</>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
