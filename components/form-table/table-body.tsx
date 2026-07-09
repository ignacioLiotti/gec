'use client';

import { memo, Fragment, useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Row as TanStackRow } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
	AccordionRowRenderContext,
	AccordionRowConfig,
	ColumnField,
	ColumnDef,
	FormFieldComponent,
	FormTableRow,
	RowColorInfo,
	RowColorTone,
} from "./types";
import { MemoizedTableCell } from "./table-cell";

const HOVER_INTENT_DELAY_MS = 60;

const TONE_CELL_CLASSES: Record<RowColorTone, string> = {
	red: "bg-red-50 border-red-50 outline-red-200 z-[100]",
	amber: "bg-amber-50 border-amber-500 outline-amber-600/50 z-[100]",
	green: "bg-emerald-50 outline-emerald-200 z-[100]",
	blue: "bg-blue-50 border-blue-500 outline-blue-600/50 z-[100]",
};

const COMPACT_EDITOR_CELL_TYPES = new Set([
	"currency",
	"number",
	"date",
	"boolean",
	"checkbox",
	"toggle",
	"select",
	"badge",
	"avatar",
	"image",
]);

function isInteractiveCellTarget(target: EventTarget | null) {
	return target instanceof Element && Boolean(target.closest(
		'input, textarea, select, button, a, [contenteditable="true"], [role="combobox"], [role="switch"], [role="checkbox"]'
	));
}

type TableRowProps<Row extends FormTableRow> = {
	row: TanStackRow<Row>;
	rowIndex: number;
	externalRefreshVersion: number;
	hoveredCell: { rowId: string; columnId: string } | null;
	setHoveredCell: (cell: { rowId: string; columnId: string } | null) => void;
	columnsById: Record<string, ColumnDef<Row>>;
	rowClassName?: (row: Row, rowIndex: number) => string | undefined;
	rowElementClassName?: (row: Row, rowIndex: number) => string | undefined;
	rowColorInfo?: (row: Row, rowIndex: number) => RowColorInfo | undefined;
	rowOverlayBadges?: (
		row: Row,
		rowIndex: number
	) => Array<{ id: string; label: string; tone?: "amber" | "red" | "green" | "blue" }>;
	FieldComponent: FormFieldComponent<Row>;
	tableReadOnly: boolean;
	highlightQuery: string;
	editMode: "always" | "active-cell";
	editOnHover: boolean;
	activeCell: { rowId: string; columnId: string } | null;
	setActiveCell: (cell: { rowId: string; columnId: string } | null) => void;
	onCommitCellValue?: (rowId: string, column: ColumnDef<Row>, value: unknown) => boolean;
	hasInitialSnapshot: boolean;
	accordionRowConfig?: AccordionRowConfig<Row>;
	accordionAlwaysOpen: boolean;
	isExpanded: boolean;
	isRowDirty: boolean;
	dirtyCellIds: string;
	hiddenColumnIdsKey: string;
	stickyStateKey: string;
	showRowNumbers: boolean;
	rowNumberColumnWidth: number;
	showActionsColumn: boolean;
	actionsColumnPosition: "start" | "end";
	actionsColumnWidth: number;
	canDeleteRows: boolean;
	isCellDirty: (rowId: string, column: ColumnDef<Row>) => boolean;
	bulkSelectedColumnId: string | null;
	bulkSelectedCount: number;
	isRowBulkSelected: boolean;
	onBulkSelectionStart: (
		event: ReactMouseEvent<HTMLTableCellElement>,
		rowId: string,
		column: ColumnDef<Row>
	) => void;
	onBulkSelectionExtend: (
		event: ReactMouseEvent<HTMLTableCellElement>,
		rowId: string,
		column: ColumnDef<Row>
	) => void;
	onBulkSelectionEnd: (event: ReactMouseEvent<HTMLTableCellElement>) => void;
	getStickyProps: (columnId: string, baseClassName?: string) => {
		className: string;
		style?: React.CSSProperties;
	};
	onToggleAccordion: (rowId: string) => void;
	onDelete: (rowId: string) => void;
	onClearCell: (rowId: string, column: ColumnDef<Row>) => void;
	onRestoreCell: (rowId: string, column: ColumnDef<Row>) => void;
	onSetCellValue: (rowId: string, field: ColumnField<Row>, value: unknown) => void;
	onUpdateRow: (rowId: string, updater: (row: Row) => Row) => void;
	onCopyCell: (value: unknown) => void;
	onCopyColumn: (column: ColumnDef<Row>) => void;
	onCopyRow: (row: Row) => void;
	measureElement?: (element: HTMLTableRowElement | null) => void;
};

function TableRowInner<Row extends FormTableRow>({
	row,
	rowIndex,
	externalRefreshVersion,
	hoveredCell,
	setHoveredCell,
	columnsById,
	rowClassName,
	rowElementClassName,
	rowColorInfo,
	rowOverlayBadges,
	FieldComponent,
	tableReadOnly,
	highlightQuery,
	editMode,
	editOnHover,
	activeCell,
	setActiveCell,
	onCommitCellValue,
	hasInitialSnapshot,
	accordionRowConfig,
	accordionAlwaysOpen,
	isExpanded,
	isRowDirty,
	dirtyCellIds,
	hiddenColumnIdsKey,
	stickyStateKey,
	showRowNumbers,
	rowNumberColumnWidth,
	showActionsColumn,
	actionsColumnPosition,
	actionsColumnWidth,
	canDeleteRows,
	isCellDirty,
	bulkSelectedColumnId,
	bulkSelectedCount,
	isRowBulkSelected,
	onBulkSelectionStart,
	onBulkSelectionExtend,
	onBulkSelectionEnd,
	getStickyProps,
	onToggleAccordion,
	onDelete,
	onClearCell,
	onRestoreCell,
	onSetCellValue,
	onUpdateRow,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
	measureElement,
}: TableRowProps<Row>) {
	void externalRefreshVersion;
	// dirtyCellIds is used for memoization comparison (see MemoizedTableRow below)
	void dirtyCellIds;
	void hiddenColumnIdsKey;
	void stickyStateKey;
	const filteredCells = row.getVisibleCells();
	const visibleLeafCount = filteredCells.length;
	const accordionLabel = accordionRowConfig?.triggerLabel ?? "detalles";
	const rowData = row.original;
	const resolvedRowClassName = rowClassName?.(rowData, rowIndex);
	const resolvedRowElementClassName = rowElementClassName?.(rowData, rowIndex);
	const colorInfo = rowColorInfo?.(rowData, rowIndex);
	const overlayBadges = rowOverlayBadges?.(rowData, rowIndex) ?? [];
	const rowSurfaceClassName = rowIndex % 2 === 0 ? "bg-card" : "bg-table-row-alt";
	const activeColumn =
		activeCell?.rowId === rowData.id ? columnsById[activeCell.columnId] ?? null : null;
	const shouldExpandActiveTextRow = Boolean(
		activeColumn &&
		activeColumn.editable !== false &&
		!COMPACT_EDITOR_CELL_TYPES.has(activeColumn.cellType ?? "text")
	);
	const shouldTrackHover = editMode === "active-cell" && editOnHover && !tableReadOnly;
	const hoverIntentTimeoutRef = useRef<number | null>(null);
	const cancelHoverIntent = useCallback(() => {
		if (hoverIntentTimeoutRef.current !== null) {
			window.clearTimeout(hoverIntentTimeoutRef.current);
			hoverIntentTimeoutRef.current = null;
		}
	}, []);
	useEffect(() => {
		return () => {
			cancelHoverIntent();
		};
	}, [cancelHoverIntent]);
	const getAccordionFieldName = useCallback(
		(field: ColumnField<Row>) =>
			`rowsById.${rowData.id}.${field}` as `rowsById.${string}.${Extract<keyof Row, string>}`,
		[rowData.id]
	);
	const setAccordionValue = useCallback(
		(field: ColumnField<Row>, value: unknown) => {
			onSetCellValue(rowData.id, field, value);
		},
		[onSetCellValue, rowData.id]
	);
	const updateAccordionRow = useCallback(
		(updater: (row: Row) => Row) => {
			onUpdateRow(rowData.id, updater);
		},
		[onUpdateRow, rowData.id]
	);
	const accordionRenderContext: AccordionRowRenderContext<Row> = {
		rowId: rowData.id,
		FieldComponent,
		columnsById,
		getFieldName: getAccordionFieldName,
		getValue: (field) => rowData[field],
		setValue: setAccordionValue,
		updateRow: updateAccordionRow,
		isDirty: isRowDirty,
		isCellDirty: (column) => isCellDirty(rowData.id, column),
	};

	const actionsCell = showActionsColumn ? (
		<td
			className={cn(
				"h-11 whitespace-nowrap border-b border-r border-stroke-soft px-2 text-center transition-colors group-hover:bg-table-row-hover",
				actionsColumnPosition === "end" && "text-right",
				rowSurfaceClassName,
				colorInfo && TONE_CELL_CLASSES[colorInfo.tone],
				colorInfo?.previewing && "shadow-[inset_0_0_0_2px_rgba(14,165,233,0.85)]",
				resolvedRowClassName
			)}
			style={{
				width: actionsColumnWidth,
				minWidth: actionsColumnWidth,
				maxWidth: actionsColumnWidth,
			}}
		>
			{overlayBadges.length > 0 && (
				<div className="pointer-events-none absolute right-2 top-1 z-20 flex flex-wrap justify-end gap-1">
					{overlayBadges.map((badge) => (
						<span
							key={badge.id}
							className={cn(
								"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm",
								badge.tone === "red" && "bg-red-500",
								badge.tone === "amber" && "bg-amber-500",
								badge.tone === "green" && "bg-emerald-500",
								badge.tone === "blue" && "bg-blue-500",
								!badge.tone && "bg-slate-500"
							)}
						>
							{badge.label}
						</span>
					))}
				</div>
			)}
			{isRowDirty && (
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="text-[10px] uppercase tracking-wide absolute p-0 h-5 text-transparent group-hover/row-dirty:text-primary group-hover/row-dirty:px-2 group-hover/row-dirty:py-1 group-hover/row-dirty:max-h-5 group-hover/row-dirty:-top-5 max-h-2 top-0 left-0 z-[100] bg-amber-300 group-hover/row-dirty:rounded-t-sm group-hover/row-dirty:rounded-b-none rounded-b-sm">
							Sin guardar
						</div>
					</TooltipTrigger>
					<TooltipContent>
						Los cambios de esta fila aÃºn no han sido guardados.
					</TooltipContent>
				</Tooltip>
			)}
			{accordionRowConfig && !accordionAlwaysOpen && (
				<div className={cn("flex justify-center", actionsColumnPosition === "end" && "justify-end")}>
					{accordionRowConfig.renderTrigger ? (
						accordionRowConfig.renderTrigger({
							row: rowData,
							isOpen: isExpanded,
							toggle: () => onToggleAccordion(rowData.id),
						})
					) : (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-expanded={isExpanded}
							onClick={() => onToggleAccordion(rowData.id)}
							className="h-7 gap-1 text-content-muted hover:text-content"
						>
							{isExpanded ? (
								<>
									<ChevronDown className="size-4" />
									<span>{`Ocultar ${accordionLabel}`}</span>
								</>
							) : (
								<>
									<ChevronRight className="size-4" />
									<span>{`Ver ${accordionLabel}`}</span>
								</>
							)}
						</Button>
					)}
				</div>
			)}
			{canDeleteRows ? (
				<Button
					type="button"
					variant="destructiveSecondary"
					size="icon-sm"
					onClick={() => onDelete(rowData.id)}
					className="size-7 opacity-70 transition-opacity group-hover:opacity-100"
					aria-label="Eliminar fila"
					title="Eliminar fila"
				>
					<Trash2 className="size-3.5" />
				</Button>
			) : null}
		</td>
	) : null;

	return (
		<Fragment>
			<tr
				ref={measureElement}
				data-index={rowIndex}
				data-row-id={rowData.id}
				onPointerLeave={() => {
					if (!shouldTrackHover) return;
					cancelHoverIntent();
					if (hoveredCell?.rowId === rowData.id) {
						setHoveredCell(null);
					}
				}}
				className={cn(
					"group relative border-b border-stroke-soft",
					rowSurfaceClassName,
					isRowDirty
						? "group/row-dirty shadow-[inset_0_0_0_2px_rgba(217,119,6,0.85)] border border-amber-500 z-[100]"
						: "",
					colorInfo && TONE_CELL_CLASSES[colorInfo.tone],
					resolvedRowElementClassName,
					shouldExpandActiveTextRow && " align-top",
					" has-[textarea:focus]:align-top",
				)}
			>
				{showRowNumbers && (
					<td
						className={cn(
							"sticky left-0 z-[35] h-11 border-b border-r border-stroke-soft px-2 text-center text-[11px] font-semibold tabular-nums text-content-disabled transition-colors group-hover:bg-table-row-hover",
							rowSurfaceClassName,
							colorInfo && TONE_CELL_CLASSES[colorInfo.tone],
							resolvedRowClassName
						)}
						style={{
							width: rowNumberColumnWidth,
							minWidth: rowNumberColumnWidth,
							maxWidth: rowNumberColumnWidth,
						}}
					>
						{rowIndex + 1}
					</td>
				)}
				{actionsColumnPosition === "start" ? actionsCell : null}
				{filteredCells.map((cell, cellIndex) => {
					const columnId = cell.column.id;
					const columnMeta = columnsById[columnId];
					if (!columnMeta) return null;
					const isEditableColumn = !tableReadOnly && columnMeta.editable !== false;
					const cellBulkSelected = isRowBulkSelected && bulkSelectedColumnId === columnMeta.id;
					const cellBulkEditing = cellBulkSelected && bulkSelectedCount > 1;

					const baseClassName = cn(
						"relative h-11 border-b border-r border-stroke-soft",
						// isActiveExpandedTextCell && "overflow-visible align-top",
						"has-[textarea:focus]:h-auto has-[textarea:focus]:max-h-40 has-[textarea:focus]:overflow-visible has-[textarea:focus]:align-top",
						!cellBulkSelected &&
						"hover:shadow-[inset_0_0_0_1px_rgba(249,115,22,0.55)] hover:z-[1] focus-within:shadow-[inset_0_0_0_2px_var(--color-orange-primary)] focus-within:z-[1]",
						rowSurfaceClassName,
						colorInfo && TONE_CELL_CLASSES[colorInfo.tone],
						colorInfo?.previewing && "shadow-[inset_0_0_0_2px_rgba(14,165,233,0.85)]",
						!cellBulkSelected && "group-hover:bg-table-row-hover",
						typeof columnMeta.cellClassName === "function"
							? columnMeta.cellClassName(rowData)
							: columnMeta.cellClassName,
						cellBulkSelected && "bg-orange-50 outline-orange-primary/80 shadow-[inset_0_0_0_2px_rgba(249,115,22,0.7)]",
					);
					const cellDirty = isCellDirty(rowData.id, columnMeta);

					return (
						<td
							key={cell.id}
							data-form-table-cell="true"
							data-row-id={rowData.id}
							data-column-id={columnMeta.id}
							{...getStickyProps(columnId, baseClassName)}
							onMouseDownCapture={(event) => {
								if (isInteractiveCellTarget(event.target)) return;
								onBulkSelectionStart(event, rowData.id, columnMeta);
							}}
							onMouseOverCapture={(event) => {
								if (isInteractiveCellTarget(event.target)) return;
								onBulkSelectionExtend(event, rowData.id, columnMeta);
							}}
							onMouseUpCapture={(event) => {
								if (isInteractiveCellTarget(event.target)) return;
								onBulkSelectionEnd(event);
							}}
							onPointerEnter={() => {
								if (!shouldTrackHover || !isEditableColumn) return;
								if (
									hoveredCell?.rowId === rowData.id &&
									hoveredCell?.columnId === columnMeta.id
								) {
									return;
								}
								cancelHoverIntent();
								hoverIntentTimeoutRef.current = window.setTimeout(() => {
									setHoveredCell({ rowId: rowData.id, columnId: columnMeta.id });
									hoverIntentTimeoutRef.current = null;
								}, HOVER_INTENT_DELAY_MS);
							}}
							onPointerLeave={() => {
								if (!shouldTrackHover || !isEditableColumn) return;
								cancelHoverIntent();
								if (
									hoveredCell?.rowId === rowData.id &&
									hoveredCell?.columnId === columnMeta.id
								) {
									setHoveredCell(null);
								}
							}}
						>
							{!showActionsColumn && cellIndex === filteredCells.length - 1 && overlayBadges.length > 0 && (
								<div className="pointer-events-none absolute right-2 top-1 z-20 flex flex-wrap justify-end gap-1">
									{overlayBadges.map((badge) => (
										<span
											key={badge.id}
											className={cn(
												"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm",
												badge.tone === "red" && "bg-red-500",
												badge.tone === "amber" && "bg-amber-500",
												badge.tone === "green" && "bg-emerald-500",
												badge.tone === "blue" && "bg-blue-500",
												!badge.tone && "bg-slate-500"
											)}
										>
											{badge.label}
										</span>
									))}
								</div>
							)}
							<MemoizedTableCell
								column={columnMeta}
								row={rowData}
								rowId={rowData.id}
								FieldComponent={FieldComponent}
								tableReadOnly={tableReadOnly}
								highlightQuery={highlightQuery}
								editMode={editMode}
								editOnHover={editOnHover}
								isHovered={
									isEditableColumn &&
									hoveredCell?.rowId === rowData.id &&
									hoveredCell?.columnId === columnMeta.id
								}
								activeCell={activeCell}
								setActiveCell={setActiveCell}
								onCommitCellValue={onCommitCellValue}
								isBulkEditing={cellBulkEditing}
								isRowDirty={isRowDirty}
								hasInitialSnapshot={hasInitialSnapshot}
								isCellDirty={cellDirty}
								onCopyCell={onCopyCell}
								onCopyColumn={() => onCopyColumn(columnMeta)}
								onCopyRow={() => onCopyRow(rowData)}
								onClearValue={
									columnMeta.editable === false
										? undefined
										: () => onClearCell(rowData.id, columnMeta)
								}
								onRestoreValue={() => onRestoreCell(rowData.id, columnMeta)}
								customMenuItems={columnMeta.cellMenuItems}
							/>
						</td>
					);
				})}
				{actionsColumnPosition === "end" && showActionsColumn && (
					<td
						className={cn(
							"h-11 border-b px-3 text-right transition-colors group-hover:bg-table-row-hover",
							rowSurfaceClassName,
							colorInfo && TONE_CELL_CLASSES[colorInfo.tone],
							colorInfo?.previewing && "shadow-[inset_0_0_0_2px_rgba(14,165,233,0.85)]",
							resolvedRowClassName
						)}
					>
						{overlayBadges.length > 0 && (
							<div className="pointer-events-none absolute right-2 top-1 z-20 flex flex-wrap justify-end gap-1">
								{overlayBadges.map((badge) => (
									<span
										key={badge.id}
										className={cn(
											"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm",
											badge.tone === "red" && "bg-red-500",
											badge.tone === "amber" && "bg-amber-500",
											badge.tone === "green" && "bg-emerald-500",
											badge.tone === "blue" && "bg-blue-500",
											!badge.tone && "bg-slate-500"
										)}
									>
										{badge.label}
									</span>
								))}
							</div>
						)}
						{isRowDirty && (
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="text-[10px] uppercase tracking-wide absolute p-0 h-5 text-transparent group-hover/row-dirty:text-primary group-hover/row-dirty:px-2 group-hover/row-dirty:py-1 group-hover/row-dirty:max-h-5 group-hover/row-dirty:-top-5 max-h-2 top-0 left-0 z-[100] bg-amber-300 group-hover/row-dirty:rounded-t-sm group-hover/row-dirty:rounded-b-none rounded-b-sm">
										Sin guardar
									</div>
								</TooltipTrigger>
								<TooltipContent>
									Los cambios de esta fila aún no han sido guardados.
								</TooltipContent>
							</Tooltip>
						)}
						{accordionRowConfig && !accordionAlwaysOpen && (
							<div className="flex justify-end">
								{accordionRowConfig.renderTrigger ? (
									accordionRowConfig.renderTrigger({
										row: rowData,
										isOpen: isExpanded,
										toggle: () => onToggleAccordion(rowData.id),
									})
								) : (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										aria-expanded={isExpanded}
										onClick={() => onToggleAccordion(rowData.id)}
										className="h-7 gap-1 text-content-muted hover:text-content"
									>
										{isExpanded ? (
											<>
												<ChevronDown className="size-4" />
												<span>{`Ocultar ${accordionLabel}`}</span>
											</>
										) : (
											<>
												<ChevronRight className="size-4" />
												<span>{`Ver ${accordionLabel}`}</span>
											</>
										)}
									</Button>
								)}
							</div>
						)}
						{canDeleteRows ? (
							<Button
								type="button"
								variant="destructiveSecondary"
								size="icon-sm"
								onClick={() => onDelete(rowData.id)}
								className="size-7 opacity-70 transition-opacity group-hover:opacity-100"
								aria-label="Eliminar fila"
								title="Eliminar fila"
							>
								<Trash2 className="size-3.5" />
							</Button>
						) : null}
					</td>
				)}
			</tr>
			{accordionRowConfig && isExpanded && (
				<tr className="bg-muted/40">
					<td
						colSpan={visibleLeafCount + (showActionsColumn ? 1 : 0) + (showRowNumbers ? 1 : 0)}
						className={cn(
							"px-6 py-4 text-left text-sm text-foreground border-b border-border",
							accordionRowConfig.contentClassName
						)}
					>
						{accordionRowConfig.renderContent(rowData, accordionRenderContext)}
					</td>
				</tr>
			)}
		</Fragment>
	);
}

export const MemoizedTableRow = memo(TableRowInner, (prevProps, nextProps) => {
	const rowId = prevProps.row.original.id;
	const prevAffectsRow =
		prevProps.activeCell?.rowId === rowId || nextProps.activeCell?.rowId === rowId;
	const prevHoveredAffectsRow =
		prevProps.hoveredCell?.rowId === rowId || nextProps.hoveredCell?.rowId === rowId;
	const accordionConfigAffectsRow = prevProps.isExpanded || nextProps.isExpanded;
	return (
		prevProps.row.id === nextProps.row.id &&
		prevProps.row.original === nextProps.row.original &&
		prevProps.rowIndex === nextProps.rowIndex &&
		prevProps.externalRefreshVersion === nextProps.externalRefreshVersion &&
		prevProps.tableReadOnly === nextProps.tableReadOnly &&
		prevProps.highlightQuery === nextProps.highlightQuery &&
		prevProps.editMode === nextProps.editMode &&
		prevProps.editOnHover === nextProps.editOnHover &&
		(!prevAffectsRow ||
			(prevProps.activeCell?.rowId === nextProps.activeCell?.rowId &&
				prevProps.activeCell?.columnId === nextProps.activeCell?.columnId)) &&
		(!prevHoveredAffectsRow ||
			(prevProps.hoveredCell?.rowId === nextProps.hoveredCell?.rowId &&
				prevProps.hoveredCell?.columnId === nextProps.hoveredCell?.columnId)) &&
		prevProps.isExpanded === nextProps.isExpanded &&
		(!accordionConfigAffectsRow ||
			prevProps.accordionRowConfig === nextProps.accordionRowConfig) &&
		prevProps.hasInitialSnapshot === nextProps.hasInitialSnapshot &&
		prevProps.showRowNumbers === nextProps.showRowNumbers &&
		prevProps.rowNumberColumnWidth === nextProps.rowNumberColumnWidth &&
		prevProps.showActionsColumn === nextProps.showActionsColumn &&
		prevProps.actionsColumnPosition === nextProps.actionsColumnPosition &&
		prevProps.actionsColumnWidth === nextProps.actionsColumnWidth &&
		prevProps.canDeleteRows === nextProps.canDeleteRows &&
		prevProps.measureElement === nextProps.measureElement &&
		prevProps.rowElementClassName === nextProps.rowElementClassName &&
		prevProps.isRowDirty === nextProps.isRowDirty &&
		prevProps.dirtyCellIds === nextProps.dirtyCellIds &&
		prevProps.hiddenColumnIdsKey === nextProps.hiddenColumnIdsKey &&
		prevProps.stickyStateKey === nextProps.stickyStateKey &&
		prevProps.bulkSelectedColumnId === nextProps.bulkSelectedColumnId &&
		prevProps.bulkSelectedCount === nextProps.bulkSelectedCount &&
		prevProps.isRowBulkSelected === nextProps.isRowBulkSelected &&
		prevProps.onCommitCellValue === nextProps.onCommitCellValue &&
		prevProps.onSetCellValue === nextProps.onSetCellValue &&
		prevProps.onUpdateRow === nextProps.onUpdateRow &&
		prevProps.onBulkSelectionStart === nextProps.onBulkSelectionStart &&
		prevProps.onBulkSelectionExtend === nextProps.onBulkSelectionExtend &&
		prevProps.onBulkSelectionEnd === nextProps.onBulkSelectionEnd
	);
}) as typeof TableRowInner;
