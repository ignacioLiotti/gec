'use client';

import { memo, Fragment } from "react";
import type { Row as TanStackRow } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
	AccordionRowConfig,
	ColumnDef,
	FormFieldComponent,
	FormTableRow,
	RowColorInfo,
	RowColorTone,
} from "./types";
import { MemoizedTableCell } from "./table-cell";

const TONE_CELL_CLASSES: Record<RowColorTone, string> = {
	red: "bg-red-50 border-red-500 outline-red-600/50 z-100",
	amber: "bg-amber-50 border-amber-500 outline-amber-600/50 z-100",
	green: "bg-emerald-50 outline-emerald-600/50 z-100",
	blue: "bg-blue-50 border-blue-500 outline-blue-600/50 z-100",
};

type TableRowProps<Row extends FormTableRow> = {
	row: TanStackRow<Row>;
	rowIndex: number;
	externalRefreshVersion: number;
	columnsById: Record<string, ColumnDef<Row>>;
	rowClassName?: (row: Row, rowIndex: number) => string | undefined;
	rowColorInfo?: (row: Row, rowIndex: number) => RowColorInfo | undefined;
	rowOverlayBadges?: (
		row: Row,
		rowIndex: number
	) => Array<{ id: string; label: string; tone?: "amber" | "red" | "green" | "blue" }>;
	FieldComponent: FormFieldComponent<Row>;
	highlightQuery: string;
	hasInitialSnapshot: boolean;
	hasAccordionRows: boolean;
	accordionRowConfig?: AccordionRowConfig<Row>;
	accordionAlwaysOpen: boolean;
	isExpanded: boolean;
	isRowDirty: boolean;
	dirtyCellIds: string;
	hiddenColumnIdsKey: string;
	showActionsColumn: boolean;
	isColumnHidden: (columnId: string) => boolean;
	isCellDirty: (rowId: string, column: ColumnDef<Row>) => boolean;
	getStickyProps: (columnId: string, baseClassName?: string) => {
		className: string;
		style?: React.CSSProperties;
	};
	onToggleAccordion: (rowId: string) => void;
	onDelete: (rowId: string) => void;
	onClearCell: (rowId: string, column: ColumnDef<Row>) => void;
	onRestoreCell: (rowId: string, column: ColumnDef<Row>) => void;
	onCopyCell: (value: unknown) => void;
	onCopyColumn: (column: ColumnDef<Row>) => void;
	onCopyRow: (row: Row) => void;
};

function TableRowInner<Row extends FormTableRow>({
	row,
	rowIndex,
	externalRefreshVersion,
	columnsById,
	rowClassName,
	rowColorInfo,
	rowOverlayBadges,
	FieldComponent,
	highlightQuery,
	hasInitialSnapshot,
	hasAccordionRows,
	accordionRowConfig,
	accordionAlwaysOpen,
	isExpanded,
	isRowDirty,
	dirtyCellIds,
	hiddenColumnIdsKey,
	showActionsColumn,
	isColumnHidden,
	isCellDirty,
	getStickyProps,
	onToggleAccordion,
	onDelete,
	onClearCell,
	onRestoreCell,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
}: TableRowProps<Row>) {
	void externalRefreshVersion;
	// dirtyCellIds is used for memoization comparison (see MemoizedTableRow below)
	void dirtyCellIds;
	void hiddenColumnIdsKey;
	const visibleCells = row.getVisibleCells();
	const filteredCells = visibleCells.filter((cell) => !isColumnHidden(cell.column.id));
	const visibleLeafCount = filteredCells.length;
	const accordionLabel = accordionRowConfig?.triggerLabel ?? "detalles";
	const rowData = row.original;
	const resolvedRowClassName = rowClassName?.(rowData, rowIndex);
	const colorInfo = rowColorInfo?.(rowData, rowIndex);
	const overlayBadges = rowOverlayBadges?.(rowData, rowIndex) ?? [];

	return (
		<Fragment>
			<tr
				data-index={rowIndex}
				className={cn(
					"border-b group relative",
					rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
					isRowDirty
						? "group/row-dirty shadow-[inset_0_0_0_2px_rgba(217,119,6,0.85)] border border-amber-500 z-100"
						: "",
					colorInfo && TONE_CELL_CLASSES[colorInfo.tone],
				)}
			>
				{filteredCells.map((cell, cellIndex) => {
					const columnId = cell.column.id;
					const columnMeta = columnsById[columnId];
					if (!columnMeta) return null;

					const baseClassName = cn(
						"outline outline-border border-border relative px-4 py-4 group-hover:bg-[#fffaf5]",
						rowIndex % 2 === 0 ? "bg-white" : "bg-[#fafafa]",
						colorInfo && TONE_CELL_CLASSES[colorInfo.tone],
						colorInfo?.previewing && "shadow-[inset_0_0_0_2px_rgba(14,165,233,0.85)]",
						typeof columnMeta.cellClassName === "function"
							? columnMeta.cellClassName(rowData)
							: columnMeta.cellClassName
					);
					const cellDirty = isCellDirty(rowData.id, columnMeta);

					return (
						<td key={cell.id} {...getStickyProps(columnId, baseClassName)}>
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
								highlightQuery={highlightQuery}
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
				{showActionsColumn && (
					<td
						className={cn(
							"px-4 py-3 text-right outline outline-border border-border group-hover:bg-[hsl(50,17%,95%)] space-y-2",
							rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
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
									<div className="text-[10px] uppercase tracking-wide absolute p-0 h-5 text-transparent group-hover/row-dirty:text-primary group-hover/row-dirty:px-2 group-hover/row-dirty:py-1 group-hover/row-dirty:max-h-5 group-hover/row-dirty:-top-5 max-h-2 top-0 left-0 z-100 bg-amber-300 group-hover/row-dirty:rounded-t-sm group-hover/row-dirty:rounded-b-none rounded-b-sm">
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
										className="gap-1 text-muted-foreground hover:text-foreground"
									>
										{isExpanded ? (
											<>
												<ChevronDown className="h-4 w-4" />
												<span>{`Ocultar ${accordionLabel}`}</span>
											</>
										) : (
											<>
												<ChevronRight className="h-4 w-4" />
												<span>{`Ver ${accordionLabel}`}</span>
											</>
										)}
									</Button>
								)}
							</div>
						)}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onDelete(rowData.id)}
							className="text-destructive hover:text-destructive"
						>
							Eliminar
						</Button>
					</td>
				)}
			</tr>
			{accordionRowConfig && isExpanded && (
				<tr className="bg-muted/40">
					<td
						colSpan={visibleLeafCount + (showActionsColumn ? 1 : 0)}
						className={cn(
							"px-6 py-4 text-left text-sm text-foreground border-b border-border",
							accordionRowConfig.contentClassName
						)}
					>
						{accordionRowConfig.renderContent(rowData)}
					</td>
				</tr>
			)}
		</Fragment>
	);
}

export const MemoizedTableRow = memo(TableRowInner, (prevProps, nextProps) => {
	// Include the TanStack row object reference so table model changes repaint immediately.
	return (
		prevProps.row === nextProps.row &&
		prevProps.rowIndex === nextProps.rowIndex &&
		prevProps.externalRefreshVersion === nextProps.externalRefreshVersion &&
		prevProps.highlightQuery === nextProps.highlightQuery &&
		prevProps.isExpanded === nextProps.isExpanded &&
		prevProps.hasInitialSnapshot === nextProps.hasInitialSnapshot &&
		prevProps.showActionsColumn === nextProps.showActionsColumn &&
		prevProps.isRowDirty === nextProps.isRowDirty &&
		prevProps.dirtyCellIds === nextProps.dirtyCellIds &&
		prevProps.hiddenColumnIdsKey === nextProps.hiddenColumnIdsKey
	);
}) as typeof TableRowInner;
