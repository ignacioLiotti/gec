'use client';

import { memo, useState, useCallback, useEffect, useRef } from "react";
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
	FormFieldRenderState,
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
	tableReadOnly: boolean;
	highlightQuery: string;
	editMode: "always" | "active-cell";
	activeCell: { rowId: string; columnId: string } | null;
	setActiveCell: (cell: { rowId: string; columnId: string } | null) => void;
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
	field: FormFieldRenderState;
	column: ColumnDef<Row>;
	row: Row;
	rowId: string;
	highlightQuery: string;
	isRowDirty: boolean;
	isCellDirty: boolean;
	hasInitialSnapshot: boolean;
	editable: boolean;
	isActive: boolean;
	onActivate: () => void;
	onCopyCell: (value: unknown) => void;
	onCopyColumn: () => void;
	onCopyRow: () => void;
	onClearValue?: () => void;
	onRestoreValue?: () => void;
	customMenuItems?: ColumnDef<Row>["cellMenuItems"];
};

type StaticReadOnlyCellContentProps<Row extends FormTableRow> = {
	value: unknown;
	column: ColumnDef<Row>;
	row: Row;
	highlightQuery: string;
	isRowDirty: boolean;
	isCellDirty: boolean;
};

/**
 * Inner component that uses hooks safely (not inside a callback)
 */
function CellContent<Row extends FormTableRow>({
	field,
	column,
	row,
	rowId,
	highlightQuery,
	isRowDirty,
	isCellDirty,
	hasInitialSnapshot,
	editable,
	isActive,
	onActivate,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
	onClearValue,
	onRestoreValue,
	customMenuItems,
}: CellContentProps<Row>) {
	const fieldValue = field.state.value;
	const setValue = useCallback((value: unknown) => field.handleChange(value), [field]);
	const rawErrorMessage = field.state.meta?.errors?.[0];
	const errorMessage =
		typeof rawErrorMessage === "string"
			? rawErrorMessage
			: rawErrorMessage == null
				? null
				: String(rawErrorMessage);

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
			rowId,
			value: fieldValue as EditableCellValue,
			setValue,
			handleBlur: field.handleBlur,
			highlightQuery,
		})
		: renderReadOnlyValue(fieldValue, row, column, highlightQuery);

	const canRestore = isCellDirty && hasInitialSnapshot;
	const contentRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!isActive) return;
		const frame = window.requestAnimationFrame(() => {
			const target = contentRef.current?.querySelector<HTMLElement>(
				'input, textarea, [role="combobox"], button'
			);
			target?.focus();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [isActive]);

	const body = (
		<div
			ref={contentRef}
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

	if (!isActive) {
		return (
			<button
				type="button"
				onClick={onActivate}
				onDoubleClick={editable ? onActivate : undefined}
				onKeyDown={(event) => {
					if (!editable) return;
					if (event.key === "Enter" || event.key === "F2") {
						event.preventDefault();
						onActivate();
					}
				}}
				className="block h-full w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-orange-primary/40"
			>
				{body}
			</button>
		);
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

function StaticReadOnlyCellContent<Row extends FormTableRow>({
	value,
	column,
	row,
	highlightQuery,
	isRowDirty,
	isCellDirty,
}: StaticReadOnlyCellContentProps<Row>) {
	return (
		<div
			className={cn(
				"absolute top-0 left-0 w-full h-full flex items-center justify-start pl-2",
				isRowDirty ? "outline outline-amber-500/60 shadow-sm border-b border-amber-500" : "",
				isCellDirty
					? "bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--color-amber-200)_5px,var(--color-amber-200)_6px,transparent_6px)] bg-repeat border-2 border-l-1 border-t-0 border-amber-600/50"
					: ""
			)}
		>
			{renderReadOnlyValue(value, row, column, highlightQuery)}
		</div>
	);
}

function TableCellInner<Row extends FormTableRow>({
	column,
	row,
	rowId,
	FieldComponent,
	tableReadOnly,
	highlightQuery,
	editMode,
	activeCell,
	setActiveCell,
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
	const isNewRow = !hasInitialSnapshot;
	const forceEditableForNewObraNameCell =
		isNewRow && String(column.field) === "designacionYUbicacion";
	const editable =
		!tableReadOnly && (column.editable !== false || forceEditableForNewObraNameCell);
	const usesActiveCellEditing = editable && editMode === "active-cell";
	const isActive =
		usesActiveCellEditing &&
		activeCell?.rowId === rowId &&
		activeCell?.columnId === column.id;
	const validators = column.validators;

	if (!editable) {
		return (
			<StaticReadOnlyCellContent
				value={row[column.field]}
				column={column}
				row={row}
				highlightQuery={highlightQuery}
				isRowDirty={isRowDirty}
				isCellDirty={isCellDirty}
			/>
		);
	}

	if (usesActiveCellEditing && !isActive) {
		return (
			<div
				role="button"
				tabIndex={0}
				onClick={() => setActiveCell({ rowId, columnId: column.id })}
				onDoubleClick={() => setActiveCell({ rowId, columnId: column.id })}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === "F2") {
						event.preventDefault();
						setActiveCell({ rowId, columnId: column.id });
					}
				}}
				className="relative block h-full w-full cursor-text outline-none focus-visible:ring-2 focus-visible:ring-orange-primary/40"
			>
				<StaticReadOnlyCellContent
					value={row[column.field]}
					column={column}
					row={row}
					highlightQuery={highlightQuery}
					isRowDirty={isRowDirty}
					isCellDirty={isCellDirty}
				/>
			</div>
		);
	}

	return (
		<FieldComponent name={fieldPath} validators={validators}>
			{(field) => (
				<CellContent
					field={field}
					column={column}
					row={row}
					rowId={rowId}
					highlightQuery={highlightQuery}
					isRowDirty={isRowDirty}
					isCellDirty={isCellDirty}
					hasInitialSnapshot={hasInitialSnapshot}
					editable={editable}
					isActive={!usesActiveCellEditing || isActive}
					onActivate={() => setActiveCell({ rowId, columnId: column.id })}
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
	const prevIsActive =
		prevProps.activeCell?.rowId === prevProps.rowId &&
		prevProps.activeCell?.columnId === prevProps.column.id;
	const nextIsActive =
		nextProps.activeCell?.rowId === nextProps.rowId &&
		nextProps.activeCell?.columnId === nextProps.column.id;
	const activeStateChanged =
		prevIsActive !== nextIsActive ||
		(prevIsActive &&
			nextIsActive &&
			`${prevProps.activeCell?.rowId}:${prevProps.activeCell?.columnId}` !==
				`${nextProps.activeCell?.rowId}:${nextProps.activeCell?.columnId}`);
	return (
		prevProps.rowId === nextProps.rowId &&
		prevProps.column.id === nextProps.column.id &&
		prevProps.tableReadOnly === nextProps.tableReadOnly &&
		prevProps.highlightQuery === nextProps.highlightQuery &&
		prevProps.editMode === nextProps.editMode &&
		!activeStateChanged &&
		prevProps.isRowDirty === nextProps.isRowDirty &&
		prevProps.isCellDirty === nextProps.isCellDirty &&
		prevProps.hasInitialSnapshot === nextProps.hasInitialSnapshot &&
		prevProps.row === nextProps.row
	);
}) as typeof TableCellInner;
