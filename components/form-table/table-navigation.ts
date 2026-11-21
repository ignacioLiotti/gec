"use client";

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, FormTableRow } from "./types";

import type { Row } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
const FORM_TABLE_FLOATING_INTERACTION_SELECTOR = [
	'[data-slot="select-content"]',
	'[data-slot="context-menu-content"]',
	'[data-slot="context-menu-sub-content"]',
	'[data-slot="dropdown-menu-content"]',
	'[data-slot="dropdown-menu-sub-content"]',
	'[data-slot="popover-content"]',
	"[data-radix-popper-content-wrapper]",
].join(", ");

function getElementFromEventTarget(target: EventTarget | null) {
	if (target instanceof Element) return target;
	if (target instanceof Node) return target.parentElement;
	return null;
}

function escapeSelectorAttributeValue(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const BULK_SELECTION_DRAG_THRESHOLD_PX = 8;
export function useTableNavigation({
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
}: {
	tableRows: Row<FormTableRow>[];
	columnDefs: ColumnDef<FormTableRow>[];
	tableRef: React.MutableRefObject<HTMLTableElement | null>;
	isColumnHidden: (id: string) => boolean;
	editMode: "always" | "active-cell";
	isReadOnly: boolean;
	activeCell: { rowId: string; columnId: string } | null;
	setActiveCell: (cell: { rowId: string; columnId: string } | null) => void;
	bulkSelection: import("./context").FormTableBulkSelectionState<FormTableRow>;
	shouldVirtualize: boolean;
	rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
}) {
	const rowIds = useMemo(() => tableRows.map((row) => row.original.id), [tableRows]);
	const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);
	const rowIndexById = useMemo(() => {
		const map = new Map<string, number>();
		rowIds.forEach((rowId, index) => {
			map.set(rowId, index);
		});
		return map;
	}, [rowIds]);
	const [hoveredCell, setHoveredCell] = useState<{ rowId: string; columnId: string } | null>(null);
	if (
		hoveredCell &&
		(editMode !== "active-cell" || isReadOnly || !rowIdSet.has(hoveredCell.rowId))
	) {
		setHoveredCell(null);
	}
	const { isDragging, beginDrag, extendDrag, endDrag } = bulkSelection;
	const visibleColumnIds = useMemo(
		() => columnDefs.filter((column) => !isColumnHidden(column.id)).map((column) => column.id),
		[columnDefs, isColumnHidden]
	);
	const focusCellControl = useCallback(
		(rowId: string, columnId: string) => {
			if (typeof window === "undefined") return;
			const tableElement = tableRef.current;
			if (!tableElement) return;

			const locateCell = () =>
				tableElement.querySelector<HTMLElement>(
					`td[data-form-table-cell="true"][data-row-id="${escapeSelectorAttributeValue(rowId)}"][data-column-id="${escapeSelectorAttributeValue(columnId)}"]`
				);
			const attemptFocus = () => {
				const cell = locateCell();
				if (!cell) return false;
				cell.scrollIntoView({ block: "nearest", inline: "nearest" });
				const control = cell.querySelector<HTMLElement>(
					'input:not([type="hidden"]), textarea, select, button, [role="combobox"], [role="switch"], [role="checkbox"], [contenteditable="true"]'
				);
				if (control) {
					try {
						control.focus({ preventScroll: true });
					} catch {
						control.focus();
					}
					return true;
				}
				const passiveCell = cell.querySelector<HTMLElement>(
					'[data-form-table-passive-cell="true"]'
				);
				if (passiveCell) {
					try {
						passiveCell.focus({ preventScroll: true });
					} catch {
						passiveCell.focus();
					}
					return "passive";
				}
				cell.tabIndex = -1;
				try {
					cell.focus({ preventScroll: true });
				} catch {
					cell.focus();
				}
				return "cell";
			};
			const firstAttempt = attemptFocus();
			if (firstAttempt === true || firstAttempt === "cell") return;
			if (firstAttempt === "passive") {
				window.requestAnimationFrame(() => {
					window.requestAnimationFrame(() => {
						void attemptFocus();
					});
				});
				return;
			}
			window.requestAnimationFrame(() => {
				const secondAttempt = attemptFocus();
				if (secondAttempt) return;
				window.requestAnimationFrame(() => {
					void attemptFocus();
				});
			});
		},
		[tableRef]
	);
	const handleArrowNavigation = useCallback(
		(event: ReactKeyboardEvent<HTMLDivElement>) => {
			const key = event.key;
			if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") {
				return;
			}
			if (editMode !== "active-cell") return;
			if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
			if (rowIds.length === 0 || visibleColumnIds.length === 0) return;

			const target = event.target as HTMLElement | null;
			if (!target) return;
			if (target.closest('[data-form-table-ignore-arrow-navigation="true"]')) return;
			const currentCellElement = target.closest<HTMLElement>('td[data-form-table-cell="true"]');
			const currentRowId = activeCell?.rowId ?? currentCellElement?.dataset.rowId ?? rowIds[0];
			const currentColumnId =
				activeCell?.columnId ?? currentCellElement?.dataset.columnId ?? visibleColumnIds[0];
			let nextRowIndex = rowIndexById.get(currentRowId) ?? -1;
			let nextColumnIndex = visibleColumnIds.indexOf(currentColumnId);
			if (nextRowIndex < 0) nextRowIndex = 0;
			if (nextColumnIndex < 0) nextColumnIndex = 0;

			switch (key) {
				case "ArrowUp":
					nextRowIndex = Math.max(0, nextRowIndex - 1);
					break;
				case "ArrowDown":
					nextRowIndex = Math.min(rowIds.length - 1, nextRowIndex + 1);
					break;
				case "ArrowLeft":
					nextColumnIndex = Math.max(0, nextColumnIndex - 1);
					break;
				case "ArrowRight":
					nextColumnIndex = Math.min(visibleColumnIds.length - 1, nextColumnIndex + 1);
					break;
			}

			const nextCell = {
				rowId: rowIds[nextRowIndex]!,
				columnId: visibleColumnIds[nextColumnIndex]!,
			};
			if (shouldVirtualize) {
				rowVirtualizer.scrollToIndex(nextRowIndex, { align: "auto" });
			}

			event.preventDefault();
			event.stopPropagation();
			// Commit buffered input before virtualization can unmount its editor.
			if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
			setActiveCell(nextCell);
			focusCellControl(nextCell.rowId, nextCell.columnId);
		},
		[
			activeCell,
			editMode,
			focusCellControl,
			rowIds,
			rowIndexById,
			rowVirtualizer,
			setActiveCell,
			shouldVirtualize,
			visibleColumnIds,
		]
	);
	const handleClearHoveredCell = useCallback(() => {
		setHoveredCell(null);
	}, []);
	useEffect(() => {
		if (!activeCell) return;
		if (typeof document === "undefined") return;

		const shouldKeepActiveCell = (target: EventTarget | null) => {
			const element = getElementFromEventTarget(target);
			if (!element) return false;
			if (element.closest(FORM_TABLE_FLOATING_INTERACTION_SELECTOR)) return true;

			const cell = element.closest<HTMLElement>('td[data-form-table-cell="true"]');
			return Boolean(cell && tableRef.current?.contains(cell));
		};

		const clearActiveCellIfOutside = (event: PointerEvent) => {
			const target = getElementFromEventTarget(event.target);
			if (target?.closest(FORM_TABLE_FLOATING_INTERACTION_SELECTOR)) return;
			const focused = document.activeElement;
			const focusedCell = focused?.closest('td[data-form-table-cell="true"]');
			// A different cell activates on mousedown, before the browser's blur.
			// Flush now so unmounting the old editor cannot drop its draft.
			if (
				focused instanceof HTMLElement &&
				tableRef.current?.contains(focused) &&
				!focusedCell?.contains(target)
			) {
				focused.blur();
			}
			if (shouldKeepActiveCell(event.target)) return;
			setActiveCell(null);
		};

		document.addEventListener("pointerdown", clearActiveCellIfOutside, true);

		return () => {
			document.removeEventListener("pointerdown", clearActiveCellIfOutside, true);
		};
	}, [activeCell, setActiveCell, tableRef]);
	const pendingBulkSelectionRef = useRef<{
		rowId: string;
		column: ColumnDef<FormTableRow>;
		startX: number;
		startY: number;
	} | null>(null);
	const shouldIgnoreBulkSelectionStart = useCallback((event: ReactMouseEvent<HTMLElement>) => {
		const target = event.target as HTMLElement | null;
		return Boolean(
			target?.closest(
				'button, a, [role="combobox"], [role="switch"], [role="checkbox"], [data-column-resizer="true"]'
			)
		);
	}, []);
	const handleBulkSelectionMouseDown = useCallback(
		(event: ReactMouseEvent<HTMLElement>, rowId: string, column: ColumnDef<FormTableRow>) => {
			if (event.button !== 0 || isReadOnly) return;
			if (shouldIgnoreBulkSelectionStart(event)) return;
			pendingBulkSelectionRef.current = {
				rowId,
				column,
				startX: event.clientX,
				startY: event.clientY,
			};
		},
		[isReadOnly, shouldIgnoreBulkSelectionStart]
	);
	const handleBulkSelectionMouseEnter = useCallback(
		(event: ReactMouseEvent<HTMLElement>, rowId: string, column: ColumnDef<FormTableRow>) => {
			if (event.buttons !== 1) {
				pendingBulkSelectionRef.current = null;
				if (isDragging) {
					endDrag();
				}
				return;
			}
			if (isDragging) {
				event.preventDefault();
				extendDrag(rowId, column);
				return;
			}
			const pending = pendingBulkSelectionRef.current;
			if (!pending) return;
			if (pending.column.id !== column.id) {
				pendingBulkSelectionRef.current = null;
				return;
			}
			const deltaX = event.clientX - pending.startX;
			const deltaY = event.clientY - pending.startY;
			const hasIntentionalDrag =
				Math.hypot(deltaX, deltaY) >= BULK_SELECTION_DRAG_THRESHOLD_PX && rowId !== pending.rowId;
			if (!hasIntentionalDrag) return;
			event.preventDefault();
			beginDrag(pending.rowId, pending.column);
			extendDrag(rowId, column);
		},
		[isDragging, beginDrag, extendDrag, endDrag]
	);
	const handleBulkSelectionMouseUp = useCallback(() => {
		pendingBulkSelectionRef.current = null;
		if (!isDragging) return;
		endDrag();
	}, [isDragging, endDrag]);
	useEffect(() => {
		if (!isDragging && !pendingBulkSelectionRef.current) return;
		const handleWindowMouseUp = () => {
			pendingBulkSelectionRef.current = null;
			if (isDragging) {
				endDrag();
			}
		};
		window.addEventListener("mouseup", handleWindowMouseUp);
		return () => {
			window.removeEventListener("mouseup", handleWindowMouseUp);
		};
	}, [isDragging, endDrag]);

	return {
		hoveredCell,
		setHoveredCell,
		handleClearHoveredCell,
		handleArrowNavigation,
		handleBulkSelectionMouseDown,
		handleBulkSelectionMouseEnter,
		handleBulkSelectionMouseUp,
	};
}
