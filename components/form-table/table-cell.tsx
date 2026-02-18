'use client';

import { memo, useState, useCallback } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type {
	ColumnDef,
	FormFieldComponent,
	FormTableRow,
} from "./types";
import type { EditableCellValue } from "./cell-renderers";
import { renderEditableContent, renderReadOnlyValue } from "./cell-renderers";
type TableCellProps<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	row: Row;
	rowId: string;
	FieldComponent: FormFieldComponent<Row>;
	highlightQuery: string;
	isRowDirty: boolean;
	isCellDirty: boolean;
	hasInitialSnapshot: boolean;
	onCopyCell: (value: unknown) => void;
	onCopyColumn: () => void;
	onCopyRow: () => void;
	onClearValue?: () => void;
	onRestoreValue?: () => void;
	customMenuItems?: ColumnDef<Row>["cellMenuItems"];
};

type CellContentProps<Row extends FormTableRow> = {
	field: any;
	column: ColumnDef<Row>;
	row: Row;
	highlightQuery: string;
	isRowDirty: boolean;
	isCellDirty: boolean;
	hasInitialSnapshot: boolean;
	editable: boolean;
	onCopyCell: (value: unknown) => void;
	onCopyColumn: () => void;
	onCopyRow: () => void;
	onClearValue?: () => void;
	onRestoreValue?: () => void;
	customMenuItems?: ColumnDef<Row>["cellMenuItems"];
};

/**
 * Inner component that uses hooks safely (not inside a callback)
 */
function CellContent<Row extends FormTableRow>({
	field,
	column,
	row,
	highlightQuery,
	isRowDirty,
	isCellDirty,
	hasInitialSnapshot,
	editable,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
	onClearValue,
	onRestoreValue,
	customMenuItems,
}: CellContentProps<Row>) {
	const fieldValue = field.state.value;
	const setValue = useCallback((value: unknown) => field.handleChange(value), [field]);
	const errorMessage = field.state.meta?.errors?.[0];

	// Track if context menu has ever been opened (lazy mount)
	const [menuOpened, setMenuOpened] = useState(false);
	const handleOpenChange = useCallback((open: boolean) => {
		if (open && !menuOpened) {
			setMenuOpened(true);
		}
	}, [menuOpened]);

	const content = editable
		? renderEditableContent({
			column,
			row,
			value: fieldValue as EditableCellValue,
			setValue,
			handleBlur: field.handleBlur,
			highlightQuery,
		})
		: renderReadOnlyValue(fieldValue, row, column, highlightQuery);

	const canRestore = isCellDirty && hasInitialSnapshot;

	const body = (
		<div
			className={cn(
				"absolute top-0 left-0 w-full h-full flex items-center justify-start pl-2",
				isRowDirty ? "outline outline-amber-500/60 shadow-sm border-b border-amber-500" : "",
				isCellDirty
					? "bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--color-amber-200)_5px,var(--color-amber-200)_6px,transparent_6px)] bg-repeat border-2 border-l-1 border-t-0 border-amber-600/50"
					: ""
			)}
		>
			{content}
			{editable && errorMessage && (
				<p className="text-xs text-destructive">{errorMessage}</p>
			)}
		</div>
	);

	// PERFORMANCE DEBUG: Set to true to test without ContextMenu overhead
	const DISABLE_CONTEXT_MENU = false;

	if (DISABLE_CONTEXT_MENU) {
		return body;
	}

	return (
		<ContextMenu onOpenChange={handleOpenChange}>
			<ContextMenuTrigger className="[&[data-state=open]_.children-input-hidden]:ring-2 [&[data-state=open]_.children-input-hidden]:ring-orange-primary/40 [&[data-state=open]_.children-input-shown]:opacity-0 [&[data-state=open]_.children-input-hidden]:opacity-100">
				<>{body}</>
			</ContextMenuTrigger>
			{/* Lazy mount: only render content after first open */}
			{menuOpened && (
				<ContextMenuContent className="w-56 z-[10000000]">
					{canRestore && onRestoreValue && (
						<>
							<ContextMenuItem onClick={onRestoreValue} className="bg-amber-100/50 rounded-none">
								Restaurar valor previo
							</ContextMenuItem>
							<ContextMenuSeparator />
						</>
					)}
					<ContextMenuItem onClick={() => onCopyCell(fieldValue)}>
						Copiar valor
					</ContextMenuItem>
					<ContextMenuItem onClick={onCopyColumn}>Copiar columna</ContextMenuItem>
					<ContextMenuItem onClick={onCopyRow}>Copiar fila (CSV)</ContextMenuItem>
					{editable && onClearValue && (
						<ContextMenuItem onClick={onClearValue}>
							Limpiar valor
						</ContextMenuItem>
					)}
					{customMenuItems && customMenuItems.length > 0 && (
						<>
							<ContextMenuSeparator />
							{customMenuItems.map((item) => (
								<ContextMenuItem key={item.id} onClick={() => item.onSelect?.(row)}>
									{item.label}
								</ContextMenuItem>
							))}
						</>
					)}
				</ContextMenuContent>
			)}
		</ContextMenu>
	);
}

function TableCellInner<Row extends FormTableRow>({
	column,
	row,
	rowId,
	FieldComponent,
	highlightQuery,
	isRowDirty,
	isCellDirty,
	hasInitialSnapshot,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
	onClearValue,
	onRestoreValue,
	customMenuItems,
}: TableCellProps<Row>) {
	const fieldPath = `rowsById.${rowId}.${column.field}` as const;
	const editable = column.editable !== false;
	const validators = column.validators;

	return (
		<FieldComponent name={fieldPath} validators={validators}>
			{(field: any) => (
				<CellContent
					field={field}
					column={column}
					row={row}
					highlightQuery={highlightQuery}
					isRowDirty={isRowDirty}
					isCellDirty={isCellDirty}
					hasInitialSnapshot={hasInitialSnapshot}
					editable={editable}
					onCopyCell={onCopyCell}
					onCopyColumn={onCopyColumn}
					onCopyRow={onCopyRow}
					onClearValue={onClearValue}
					onRestoreValue={onRestoreValue}
					customMenuItems={customMenuItems}
				/>
			)}
		</FieldComponent>
	);
}

export const MemoizedTableCell = memo(TableCellInner, (prevProps, nextProps) => {
	// Compare row reference to detect data changes
	// Row contains the actual data used by cell renderers
	return (
		prevProps.rowId === nextProps.rowId &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.highlightQuery === nextProps.highlightQuery &&
		prevProps.isRowDirty === nextProps.isRowDirty &&
		prevProps.isCellDirty === nextProps.isCellDirty &&
		prevProps.hasInitialSnapshot === nextProps.hasInitialSnapshot &&
		prevProps.row === nextProps.row
	);
}) as typeof TableCellInner;
