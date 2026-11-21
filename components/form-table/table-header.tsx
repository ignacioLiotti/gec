"use client";

import { ColumnResizer } from "@/components/ui/column-resizer";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { useFormTable } from "./context";
import {
	DEFAULT_COL_WIDTH,
	DEFAULT_ROW_NUMBER_COLUMN_WIDTH,
	shouldUseSpreadsheetChrome,
} from "./table-layout";
import type { ColumnDef, FormTableRow } from "./types";

// Header controls stay together here: labels, sorting menu, icons and resize handles.
function ColumnHeader({ column, rowSpan }: { column: ColumnDef<FormTableRow>; rowSpan?: number }) {
	const { config, columns, sorting, tableId } = useFormTable<FormTableRow, unknown>();
	const spreadsheet = shouldUseSpreadsheetChrome(config);
	const offset =
		Number(spreadsheet) +
		Number(config.showActionsColumn !== false && config.actionsColumnPosition === "start");
	const sortable = column.enableSort !== false;
	const sortingThisColumn = sorting.state.columnId === column.id;
	const pending =
		sorting.isProcessing && (sortingThisColumn || sorting.pendingColumnId === column.id);
	const label =
		!spreadsheet && rowSpan === 2 && sortable ? column.label.toUpperCase() : column.label;
	return (
		<th
			rowSpan={rowSpan}
			{...columns.getStickyProps(
				column.id,
				cn(
					"relative border-b border-r border-stroke-soft bg-surface-muted px-3 py-0 text-left font-bold uppercase text-content-secondary",
					spreadsheet ? "h-10 text-[11px] tracking-[0.08em]" : "h-9 text-[10px] tracking-[0.12em]",
					config.headerCellClassName
				)
			)}
		>
			<div className="absolute inset-0 flex items-center justify-between gap-2 px-3 py-2">
				{sortable ? (
					<ContextMenu>
						<ContextMenuTrigger asChild>
							<button
								type="button"
								onClick={() => sorting.toggle(column.id)}
								className="flex w-full items-center justify-between gap-2 text-left"
							>
								<span className="truncate">{label}</span>
								<span className="flex items-center gap-2 text-content-muted">
									{pending && <Loader2 className="size-3.5 animate-spin text-primary" />}
									{sortingThisColumn ? (
										sorting.state.direction === "asc" ? (
											<ArrowUp className="size-3.5" />
										) : (
											<ArrowDown className="size-3.5" />
										)
									) : (
										<ArrowUpDown className="size-3.5" />
									)}
								</span>
							</button>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem onClick={() => sorting.applyDirection(column.id, "asc")}>
								Orden ascendente
							</ContextMenuItem>
							<ContextMenuItem onClick={() => sorting.applyDirection(column.id, "desc")}>
								Orden descendente
							</ContextMenuItem>
							<ContextMenuItem onClick={sorting.clear}>Quitar orden</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				) : (
					<span className="flex w-full items-center justify-between gap-2 text-left text-content-muted">
						<span className="truncate">{label}</span>
					</span>
				)}
			</div>
			{columns.enableResizing && column.enableResize !== false && (
				<ColumnResizer
					tableId={tableId}
					colIndex={columns.columnIndexMap[column.id] + offset}
					mode="fixed"
				/>
			)}
		</th>
	);
}

function ActionsHeader({ position }: { position: "start" | "end" }) {
	const { config, columns, tableId } = useFormTable<FormTableRow, unknown>();
	if (config.showActionsColumn === false || (config.actionsColumnPosition ?? "end") !== position)
		return null;
	const spreadsheet = shouldUseSpreadsheetChrome(config);
	const width = config.actionsColumnWidth ?? 140;
	const label = config.actionsColumnLabel === undefined ? "Acciones" : config.actionsColumnLabel;
	return (
		<th
			rowSpan={spreadsheet ? undefined : 2}
			style={{ width, minWidth: width, maxWidth: width }}
			className={cn(
				"relative border-b border-stroke-soft bg-surface-muted p-0 text-[10px] font-bold uppercase text-content-secondary",
				spreadsheet ? "h-10 tracking-[0.08em]" : "h-9 tracking-[0.12em]",
				position === "start" ? "whitespace-nowrap border-r text-center" : "text-right",
				config.headerCellClassName
			)}
		>
			<div
				className={cn(
					"absolute inset-0 flex items-center gap-2 py-2",
					position === "start" ? "justify-center px-2" : "justify-end px-3"
				)}
			>
				{position === "start" ? (
					label === null ? null : (
						<span>{label}</span>
					)
				) : (
					<span className={label === null ? "sr-only" : undefined}>{label ?? "Acciones"}</span>
				)}
			</div>
			{position === "end" && columns.enableResizing && (
				<ColumnResizer
					tableId={tableId}
					colIndex={columns.list.length + Number(spreadsheet)}
					mode="fixed"
				/>
			)}
		</th>
	);
}

export function TableHeader() {
	const { config, columns } = useFormTable<FormTableRow, unknown>();
	const { list: columnDefs, colRefs, colWidths, isColumnHidden, groupedColumnLookup } = columns;
	const spreadsheet = shouldUseSpreadsheetChrome(config);
	const rowNumberWidth = config.rowNumberColumnWidth ?? DEFAULT_ROW_NUMBER_COLUMN_WIDTH;
	const showActions = config.showActionsColumn !== false;
	const actionsPosition = config.actionsColumnPosition ?? "end";
	const actionsWidth = config.actionsColumnWidth ?? 140;
	const offset = Number(spreadsheet) + Number(showActions && actionsPosition === "start");
	const visibleColumns = columnDefs.filter((column) => !isColumnHidden(column.id));
	const emittedGroups = new Set<string>();
	const firstRowHeaders = visibleColumns.map((column) => {
		const group = spreadsheet ? undefined : groupedColumnLookup.get(column.id);
		if (!group)
			return <ColumnHeader key={column.id} column={column} rowSpan={spreadsheet ? undefined : 2} />;
		if (emittedGroups.has(group.id)) return null;
		emittedGroups.add(group.id);
		return (
			<th
				key={`group-${group.id}`}
				colSpan={group.columns.filter((id) => !isColumnHidden(id)).length}
				className={cn(
					"border-b border-r border-stroke-soft bg-surface-muted px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-content-secondary",
					config.headerCellClassName,
					group.className
				)}
			>
				{group.label}
			</th>
		);
	});
	return (
		<>
			<colgroup className="max-w-full overflow-hidden">
				{spreadsheet && (
					<col
						style={{ width: rowNumberWidth, minWidth: rowNumberWidth, maxWidth: rowNumberWidth }}
					/>
				)}
				{showActions && actionsPosition === "start" && (
					<col style={{ width: actionsWidth, minWidth: actionsWidth, maxWidth: actionsWidth }} />
				)}
				{columnDefs.map((column, index) => (
					<col
						key={column.id}
						ref={(el) => {
							colRefs.current[index + offset] = el;
						}}
						style={{
							width: colWidths[index + offset] ?? DEFAULT_COL_WIDTH,
							display: isColumnHidden(column.id) ? "none" : undefined,
						}}
					/>
				))}
				{showActions && actionsPosition === "end" && (
					<col style={{ width: actionsWidth, minWidth: actionsWidth, maxWidth: actionsWidth }} />
				)}
			</colgroup>
			<thead className="sticky top-0 z-[101] bg-surface-muted">
				<tr>
					{spreadsheet && (
						<th
							className="sticky left-0 z-[130] h-10 border-b border-r border-stroke-soft bg-surface-muted px-2 text-center text-[10px] font-bold uppercase tracking-wide text-content-disabled"
							style={{
								width: rowNumberWidth,
								minWidth: rowNumberWidth,
								maxWidth: rowNumberWidth,
							}}
						>
							#
						</th>
					)}
					<ActionsHeader position="start" />
					{firstRowHeaders}
					<ActionsHeader position="end" />
				</tr>
				{!spreadsheet && (
					<tr>
						{visibleColumns
							.filter((column) => groupedColumnLookup.has(column.id))
							.map((column) => (
								<ColumnHeader key={column.id} column={column} />
							))}
					</tr>
				)}
			</thead>
		</>
	);
}
