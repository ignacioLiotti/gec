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
} from "./types";
import { MemoizedTableCell } from "./table-cell";

type TableRowProps<Row extends FormTableRow> = {
	row: TanStackRow<Row>;
	rowIndex: number;
	columnsById: Record<string, ColumnDef<Row>>;
	FieldComponent: FormFieldComponent<Row>;
	highlightQuery: string;
	hasInitialSnapshot: boolean;
	hasAccordionRows: boolean;
	accordionRowConfig?: AccordionRowConfig<Row>;
	accordionAlwaysOpen: boolean;
	isExpanded: boolean;
	isRowDirty: boolean;
	showActionsColumn: boolean;
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
	columnsById,
	FieldComponent,
	highlightQuery,
	hasInitialSnapshot,
	hasAccordionRows,
	accordionRowConfig,
	accordionAlwaysOpen,
	isExpanded,
	isRowDirty,
	showActionsColumn,
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
	const visibleCells = row.getVisibleCells();
	const visibleLeafCount = visibleCells.length;
	const accordionLabel = accordionRowConfig?.triggerLabel ?? "detalles";
	const rowData = row.original;

	return (
		<Fragment>
			<tr
				className={cn(
					"border-b transition-colors duration-150 group relative",
					"animate-virtualized-debug", // DEBUG: Testing virtualization - remove after testing
					rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]",
					isRowDirty ? "bg-amber-50/60 group/row-dirty" : ""
				)}
				style={{
					// DEBUG: Fade animation for virtualization testing - remove after testing
					animation: "virtualized-fade 2s ease-out",
				}}
			>
				{visibleCells.map((cell) => {
					const columnId = cell.column.id;
					const columnMeta = columnsById[columnId];
					if (!columnMeta) return null;

					const baseClassName = cn(
						"outline outline-border border-border relative px-4 py-4 group-hover:bg-[hsl(50,17%,95%)]",
						rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]"
					);
					const cellDirty = isCellDirty(rowData.id, columnMeta);

					return (
						<td key={cell.id} {...getStickyProps(columnId, baseClassName)}>
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
							rowIndex % 2 === 0 ? "bg-white" : "bg-[hsl(50,17%,98%)]"
						)}
					>
						{isRowDirty && (
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="text-[10px] uppercase tracking-wide absolute p-0 h-5 text-transparent group-hover/row-dirty:text-primary group-hover/row-dirty:px-2 group-hover/row-dirty:py-1 group-hover/row-dirty:max-h-5 group-hover/row-dirty:-top-5 max-h-2 top-0 left-0 z-100 bg-amber-300 group-hover/row-dirty:rounded-t-sm group-hover/row-dirty:rounded-b-none rounded-b-sm transition-all duration-150">
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
	// Only re-render if these specific props change
	return (
		prevProps.row.original.id === nextProps.row.original.id &&
		prevProps.rowIndex === nextProps.rowIndex &&
		prevProps.highlightQuery === nextProps.highlightQuery &&
		prevProps.isExpanded === nextProps.isExpanded &&
		prevProps.hasInitialSnapshot === nextProps.hasInitialSnapshot &&
		prevProps.showActionsColumn === nextProps.showActionsColumn &&
		prevProps.isRowDirty === nextProps.isRowDirty
	);
}) as typeof TableRowInner;
