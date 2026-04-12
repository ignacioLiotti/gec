'use client';

import {
	memo,
	useEffect,
	useState,
	useCallback,
	useRef,
	useMemo,
	type MouseEvent as ReactMouseEvent,
	type FocusEvent as ReactFocusEvent,
} from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
	ColumnDef,
	FormFieldRenderState,
	FormFieldComponent,
	FormTableRow,
} from "./types";
import { resolveCellSuggestion } from "./cell-suggestions";
import type { EditableCellValue } from "./cell-renderers";
import { renderEditableContent, renderReadOnlyValue } from "./cell-renderers";
import { formatDateAsDmy, parseFlexibleDateValue } from "@/lib/tablas";
type TableCellProps<Row extends FormTableRow> = {
	column: ColumnDef<Row>;
	row: Row;
	rowId: string;
	FieldComponent: FormFieldComponent<Row>;
	tableReadOnly: boolean;
	highlightQuery: string;
	editMode: "always" | "active-cell";
	isHovered: boolean;
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
	shouldAutoFocus: boolean;
	onFocusWithinChange?: (isFocusedWithin: boolean) => void;
	onRequestActivate?: () => void;
	enableContextMenu: boolean;
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
	shouldAutoFocus,
	onFocusWithinChange,
	onRequestActivate,
	enableContextMenu,
	onCopyCell,
	onCopyColumn,
	onCopyRow,
	onClearValue,
	onRestoreValue,
	customMenuItems,
}: CellContentProps<Row>) {
	const fieldValue = field.state.value;
	const contentRef = useRef<HTMLDivElement | null>(null);
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
	const focusEditableControl = useCallback(() => {
		if (!editable) return;
		const root = contentRef.current;
		if (!root) return;
		const control = root.querySelector<HTMLElement>(
			'input:not([type="hidden"]), textarea, select, button, [role="combobox"], [role="switch"], [role="checkbox"], [contenteditable="true"]'
		);
		if (!control || control === document.activeElement) return;
		try {
			control.focus({ preventScroll: true });
		} catch {
			control.focus();
		}
	}, [editable]);
	useEffect(() => {
		if (!shouldAutoFocus) return;
		const rafId = window.requestAnimationFrame(focusEditableControl);
		return () => {
			window.cancelAnimationFrame(rafId);
		};
	}, [focusEditableControl, shouldAutoFocus]);
	const handleEditableCellMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		if (!editable || event.button !== 0) return;
		const target = event.target as HTMLElement | null;
		if (
			target?.closest(
				'input, textarea, select, button, a, [contenteditable="true"], [role="combobox"], [role="switch"], [role="checkbox"]'
			)
		) {
			return;
		}
		window.requestAnimationFrame(focusEditableControl);
	}, [editable, focusEditableControl]);
	const handleFocusCapture = useCallback(() => {
		onFocusWithinChange?.(true);
		onRequestActivate?.();
	}, [onFocusWithinChange, onRequestActivate]);
	const handleBlurCapture = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
		const nextTarget = event.relatedTarget as Node | null;
		if (nextTarget && event.currentTarget.contains(nextTarget)) {
			return;
		}
		onFocusWithinChange?.(false);
	}, [onFocusWithinChange]);
	const handlePointerLeave = useCallback(() => {
		const root = contentRef.current;
		if (!root) return;
		const activeElement = document.activeElement as Node | null;
		if (activeElement && root.contains(activeElement)) {
			return;
		}
		onFocusWithinChange?.(false);
	}, [onFocusWithinChange]);

	const body = (
		<div
			ref={contentRef}
			onMouseDown={handleEditableCellMouseDown}
			onPointerLeave={handlePointerLeave}
			onFocusCapture={handleFocusCapture}
			onBlurCapture={handleBlurCapture}
			className={cn(
				"absolute top-0 left-0 w-full h-full flex items-center justify-start -ml-1 [&_.children-input-hidden]:opacity-0 [&_.children-input-hidden]:transition-opacity [&_.children-input-shown]:opacity-100 [&_.children-input-shown]:transition-opacity group-hover:[&_.children-input-hidden]:opacity-100 group-hover:[&_.children-input-shown]:opacity-0",
				isActive && "[&_.children-input-hidden]:opacity-100 [&_.children-input-shown]:opacity-0",
				isRowDirty ? "outline outline-amber-500/60 shadow-sm border-b border-amber-500" : "",
				isCellDirty
					? "bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--color-amber-200)_5px,var(--color-amber-200)_6px,transparent_6px)] bg-repeat"
					: ""
			)}
		>
			{content}
			{editable && errorMessage && (
				<p className="text-xs text-destructive">{errorMessage}</p>
			)}
		</div>
	);

	if (!enableContextMenu) {
		return body;
	}

	return (
		<ContextMenu onOpenChange={handleOpenChange}>
			<ContextMenuTrigger className={cn("group relative block h-full w-full", isActive ? 'outline-2 outline-red-500 outline-offset-2' : '', "[&[data-state=open]_.children-input-hidden]:ring-2 [&[data-state=open]_.children-input-hidden]:ring-orange-primary/40 [&[data-state=open]_.children-input-shown]:opacity-0 [&[data-state=open]_.children-input-hidden]:opacity-100")}>
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
	const cellType = (column.cellType ?? "text") as NonNullable<ColumnDef<Row>["cellType"]> | "text";
	// For date cells, use the formatted display value so ISO strings ("2023-05-03") don't
	// falsely trigger suggestions — the display layer already handles the conversion.
	const rawValue = useMemo(() => {
		if (value == null) return "";
		if (cellType === "date") {
			const parsed = parseFlexibleDateValue(value);
			return parsed ? formatDateAsDmy(parsed) : String(value);
		}
		return String(value);
	}, [value, cellType]);
	const suggestion = useMemo(() => {
		if (!rawValue.trim()) return null;
		return resolveCellSuggestion({
			rawValue,
			currentValue: value,
			cellType,
			column,
			row,
		});
	}, [rawValue, value, cellType, column, row]);

	return (
		<div
			className={cn(
				"absolute top-0 left-0 w-full h-full flex items-center justify-start pl-3 ",
				isRowDirty ? "outline outline-amber-500/60 shadow-sm border-b border-amber-500" : "",
				isCellDirty
					? "bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_5px,var(--color-amber-200)_5px,var(--color-amber-200)_6px,transparent_6px)] bg-repeat border-2 border-l-1 border-t-0 border-amber-600/50"
					: ""
			)}
		>
			{suggestion && (
				<div className="pointer-events-none absolute right-9 z-20 inline-flex h-6 items-center rounded-full border border-orange-200 bg-orange-50 px-2 text-[10px] font-semibold uppercase tracking-wide text-orange-700 shadow-sm">
					<Sparkles className="mr-1 h-3 w-3" />
					Sugerencia
				</div>
			)}
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
	isHovered,
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
	const [isFocusWithin, setIsFocusWithin] = useState(false);
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
	const isHoverEditing = usesActiveCellEditing && isHovered;
	const isInteractiveEditing = usesActiveCellEditing && (isActive || isHoverEditing || isFocusWithin);
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

	if (usesActiveCellEditing && !isInteractiveEditing) {
		return (
			<div
				data-form-table-passive-cell="true"
				tabIndex={-1}
				onMouseDown={(event) => {
					if (event.button !== 0) return;
					setActiveCell({ rowId, columnId: column.id });
				}}
				onFocus={() => {
					setActiveCell({ rowId, columnId: column.id });
				}}
				className="relative block h-full w-full cursor-text h-4! py-4!"
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
					isActive={usesActiveCellEditing ? (isActive || isFocusWithin) : true}
					shouldAutoFocus={usesActiveCellEditing ? isActive : false}
					onFocusWithinChange={usesActiveCellEditing ? setIsFocusWithin : undefined}
					onRequestActivate={
						usesActiveCellEditing
							? () => {
								if (!isActive) {
									setActiveCell({ rowId, columnId: column.id });
								}
							}
							: undefined
					}
					enableContextMenu={usesActiveCellEditing && isActive}
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
		prevProps.isHovered === nextProps.isHovered &&
		!activeStateChanged &&
		prevProps.isRowDirty === nextProps.isRowDirty &&
		prevProps.isCellDirty === nextProps.isCellDirty &&
		prevProps.hasInitialSnapshot === nextProps.hasInitialSnapshot &&
		prevProps.row === nextProps.row
	);
}) as typeof TableCellInner;
