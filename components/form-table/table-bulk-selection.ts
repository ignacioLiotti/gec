"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ColumnDef, FormTableRow } from "./types";

import { shallowEqualStringArrays } from "./table-utils";

type BulkCellSelection = {
	columnId: string | null;
	rowIds: string[];
	anchorRowId: string | null;
	isDragging: boolean;
};

export function useTableBulkSelection<Row extends FormTableRow>({
	processedRows,
	columnsById,
	isReadOnly,
	activeCell,
	updateActiveCell,
	setFormFieldValue,
}: {
	processedRows: Row[];
	columnsById: Record<string, ColumnDef<Row>>;
	isReadOnly: boolean;
	activeCell: { rowId: string; columnId: string } | null;
	updateActiveCell: (cell: { rowId: string; columnId: string } | null) => void;
	setFormFieldValue: (path: string, updater: unknown) => void;
}) {
	const [bulkSelection, setBulkSelection] = useState<BulkCellSelection>({
		columnId: null,
		rowIds: [],
		anchorRowId: null,
		isDragging: false,
	});

	const processedRowsRef = useRef(processedRows);
	const processedRowIds = useMemo(() => processedRows.map((row) => row.id), [processedRows]);
	const processedRowIndexById = useMemo(() => {
		const map = new Map<string, number>();
		processedRowIds.forEach((rowId, index) => {
			map.set(rowId, index);
		});
		return map;
	}, [processedRowIds]);
	const processedRowIdsRef = useRef<string[]>(processedRowIds);
	const processedRowIndexByIdRef = useRef<Map<string, number>>(processedRowIndexById);
	useEffect(() => {
		processedRowsRef.current = processedRows;
		processedRowIdsRef.current = processedRowIds;
		processedRowIndexByIdRef.current = processedRowIndexById;
	}, [processedRows, processedRowIds, processedRowIndexById]);
	const selectedColumn = bulkSelection.columnId
		? (columnsById[bulkSelection.columnId] ?? null)
		: null;
	const selectedRowIdsSet = useMemo(() => new Set(bulkSelection.rowIds), [bulkSelection.rowIds]);
	const clearBulkSelection = useCallback(() => {
		setBulkSelection({
			columnId: null,
			rowIds: [],
			anchorRowId: null,
			isDragging: false,
		});
	}, []);
	const isBulkCellSelected = useCallback(
		(rowId: string, columnId: string) =>
			bulkSelection.columnId === columnId && selectedRowIdsSet.has(rowId),
		[bulkSelection.columnId, selectedRowIdsSet]
	);
	const resolveVisibleRowRange = useCallback((anchorRowId: string, currentRowId: string) => {
		const visibleRowIds = processedRowIdsRef.current;
		const indexById = processedRowIndexByIdRef.current;
		const anchorIndex = indexById.get(anchorRowId) ?? -1;
		const currentIndex = indexById.get(currentRowId) ?? -1;
		if (anchorIndex < 0 || currentIndex < 0) {
			return [anchorRowId, currentRowId].filter(Boolean);
		}
		const start = Math.min(anchorIndex, currentIndex);
		const end = Math.max(anchorIndex, currentIndex);
		return visibleRowIds.slice(start, end + 1);
	}, []);
	const beginBulkSelectionDrag = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly || column.editable === false) return;
			updateActiveCell({ rowId, columnId: column.id });
			setBulkSelection({
				columnId: column.id,
				rowIds: [rowId],
				anchorRowId: rowId,
				isDragging: true,
			});
		},
		[isReadOnly, updateActiveCell]
	);
	const extendBulkSelectionDrag = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly || column.editable === false) return;
			setBulkSelection((prev) => {
				if (!prev.isDragging || prev.columnId !== column.id || !prev.anchorRowId) {
					return prev;
				}
				const rowIds = resolveVisibleRowRange(prev.anchorRowId, rowId);
				return shallowEqualStringArrays(prev.rowIds, rowIds) ? prev : { ...prev, rowIds };
			});
		},
		[isReadOnly, resolveVisibleRowRange]
	);
	const endBulkSelectionDrag = useCallback(() => {
		setBulkSelection((prev) => (prev.isDragging ? { ...prev, isDragging: false } : prev));
	}, []);
	if (
		bulkSelection.columnId &&
		!bulkSelection.isDragging &&
		(!activeCell ||
			activeCell.columnId !== bulkSelection.columnId ||
			!bulkSelection.rowIds.includes(activeCell.rowId))
	) {
		setBulkSelection({ columnId: null, rowIds: [], anchorRowId: null, isDragging: false });
	}
	const commitBulkCellValue = useCallback(
		(rowId: string, column: ColumnDef<Row>, value: unknown) => {
			if (isReadOnly || column.editable === false) return false;
			if (bulkSelection.columnId !== column.id || bulkSelection.rowIds.length < 2) {
				return false;
			}
			if (!bulkSelection.rowIds.includes(rowId)) return false;

			const selectedIds = bulkSelection.rowIds;
			setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
				let changed = false;
				const next = { ...prev };
				selectedIds.forEach((selectedRowId) => {
					const row = next[selectedRowId];
					if (!row) return;
					next[selectedRowId] = {
						...row,
						[column.field]: value,
					};
					changed = true;
				});
				return changed ? next : prev;
			});
			return true;
		},
		[bulkSelection.columnId, bulkSelection.rowIds, isReadOnly, setFormFieldValue]
	);
	const applyBulkSelectionValue = useCallback(
		(value: unknown) => {
			if (isReadOnly || !selectedColumn || selectedColumn.editable === false) return;
			const selectedIds = bulkSelection.rowIds;
			if (selectedIds.length === 0) return;
			setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
				let changed = false;
				const next = { ...prev };
				selectedIds.forEach((rowId) => {
					const row = next[rowId];
					if (!row) return;
					next[rowId] = {
						...row,
						[selectedColumn.field]: value,
					};
					changed = true;
				});
				return changed ? next : prev;
			});
			toast.success(`${selectedIds.length} celdas actualizadas`);
			clearBulkSelection();
		},
		[bulkSelection.rowIds, clearBulkSelection, isReadOnly, selectedColumn, setFormFieldValue]
	);

	return {
		bulkSelection,
		selectedColumn,
		clearBulkSelection,
		isBulkCellSelected,
		beginBulkSelectionDrag,
		extendBulkSelectionDrag,
		endBulkSelectionDrag,
		commitBulkCellValue,
		applyBulkSelectionValue,
	};
}
