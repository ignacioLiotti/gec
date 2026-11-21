import type { ColumnDef, ColumnField, FormTableRow } from "./types";
import { shallowEqualValues } from "./table-utils";

type DirtyRowResult<Row extends FormTableRow> = {
	dirty: boolean;
	cells: ColumnDef<Row>[];
};

export function computeCellDirty<Row extends FormTableRow>(
	rowId: string,
	column: ColumnDef<Row>,
	rowsById: Record<string, Row>,
	initialRowsById: Record<string, Row>
) {
	const currentRow = rowsById[rowId];
	if (!currentRow) return false;

	const initialRow = initialRowsById[rowId];
	if (!initialRow) return true;

	return !shallowEqualValues(currentRow[column.field], initialRow[column.field]);
}

export function computeRowDirty<Row extends FormTableRow>(
	rowId: string,
	rowsById: Record<string, Row>,
	columns: ColumnDef<Row>[],
	initialRowsById: Record<string, Row>,
	dirtyFields: ColumnField<Row>[] = []
): DirtyRowResult<Row> {
	const dirtyCells: ColumnDef<Row>[] = [];
	const currentRow = rowsById[rowId];
	const initialRow = initialRowsById[rowId];

	if (!currentRow) {
		return { dirty: false, cells: dirtyCells };
	}

	if (!initialRow) {
		return { dirty: true, cells: dirtyCells };
	}
	const columnFields = new Set<ColumnField<Row>>();
	for (const column of columns) {
		if (String(column.field) === "id") continue;
		columnFields.add(column.field);
		const currentValue = currentRow[column.field];
		const initialValue = initialRow[column.field];
		if (!shallowEqualValues(currentValue, initialValue)) {
			dirtyCells.push(column);
		}
	}

	const hasDirtyExtraField = dirtyFields.some((field) => {
		if (String(field) === "id" || columnFields.has(field)) return false;
		return !shallowEqualValues(currentRow[field], initialRow[field]);
	});

	return { dirty: dirtyCells.length > 0 || hasDirtyExtraField, cells: dirtyCells };
}

export function hasUnsavedChanges<Row extends FormTableRow>(
	rowOrder: string[],
	initialRowOrder: string[],
	rowsById: Record<string, Row>,
	columns: ColumnDef<Row>[],
	initialRowsById: Record<string, Row>,
	dirtyFields: ColumnField<Row>[] = []
) {
	if (rowOrder.length !== initialRowOrder.length) return true;
	for (let i = 0; i < rowOrder.length; i += 1) {
		if (rowOrder[i] !== initialRowOrder[i]) return true;
	}
	return rowOrder.some(
		(rowId) => computeRowDirty(rowId, rowsById, columns, initialRowsById, dirtyFields).dirty
	);
}

export type RowDirtyCacheEntry<Row extends FormTableRow> = {
	row: Row;
	initialRow: Row | undefined;
	dirty: boolean;
	cellDirtyIds: Set<string>;
	dirtyCells: ColumnDef<Row>[];
	dirtyCellIdsKey: string;
};

export function buildDirtyIndex<Row extends FormTableRow>(
	rowOrder: string[],
	initialRowOrder: string[],
	rowsById: Record<string, Row>,
	columns: ColumnDef<Row>[],
	initialRowsById: Record<string, Row>,
	dirtyFields: ColumnField<Row>[] = [],
	cache?: Map<string, RowDirtyCacheEntry<Row>>
) {
	let hasChanges = rowOrder.length !== initialRowOrder.length;
	if (!hasChanges) {
		for (let index = 0; index < rowOrder.length; index += 1) {
			if (rowOrder[index] !== initialRowOrder[index]) {
				hasChanges = true;
				break;
			}
		}
	}

	const rowDirtyById: Record<string, boolean> = {};
	const cellDirtyByRowId: Record<string, Set<string>> = {};
	const dirtyCellsByRowId: Record<string, ColumnDef<Row>[]> = {};
	const dirtyCellIdsByRowId: Record<string, string> = {};

	for (const rowId of rowOrder) {
		const currentRow = rowsById[rowId];
		if (!currentRow) continue;

		const initialRow = initialRowsById[rowId];
		// Rows are updated immutably, so identity equality of both the current and
		// baseline row objects means the cached diff is still valid. This keeps the
		// per-keystroke cost at one row diff instead of rows × columns.
		const cached = cache?.get(rowId);
		let entry: RowDirtyCacheEntry<Row>;
		if (cached && cached.row === currentRow && cached.initialRow === initialRow) {
			entry = cached;
		} else if (!initialRow) {
			const allColumnIds = columns.map((column) => column.id);
			entry = {
				row: currentRow,
				initialRow,
				dirty: true,
				cellDirtyIds: new Set(allColumnIds),
				dirtyCells: [],
				dirtyCellIdsKey: allColumnIds.join(","),
			};
			cache?.set(rowId, entry);
		} else {
			const dirtyCells: ColumnDef<Row>[] = [];
			const dirtyCellIds = new Set<string>();
			let hasExtraDirtyField = false;
			const columnFields = new Set<ColumnField<Row>>();
			for (const column of columns) {
				if (String(column.field) === "id") continue;
				columnFields.add(column.field);
				if (!shallowEqualValues(currentRow[column.field], initialRow[column.field])) {
					dirtyCells.push(column);
					dirtyCellIds.add(column.id);
				}
			}
			for (const field of dirtyFields) {
				if (String(field) === "id" || columnFields.has(field)) continue;
				if (!shallowEqualValues(currentRow[field], initialRow[field])) {
					hasExtraDirtyField = true;
					break;
				}
			}
			entry = {
				row: currentRow,
				initialRow,
				dirty: dirtyCells.length > 0 || hasExtraDirtyField,
				cellDirtyIds: dirtyCellIds,
				dirtyCells,
				dirtyCellIdsKey: dirtyCells.map((column) => column.id).join(","),
			};
			cache?.set(rowId, entry);
		}

		if (entry.dirty) {
			rowDirtyById[rowId] = true;
			cellDirtyByRowId[rowId] = entry.cellDirtyIds;
			dirtyCellsByRowId[rowId] = entry.dirtyCells;
			dirtyCellIdsByRowId[rowId] = entry.dirtyCellIdsKey;
			hasChanges = true;
		}
	}

	if (cache && cache.size > rowOrder.length) {
		for (const cachedRowId of cache.keys()) {
			if (!rowsById[cachedRowId]) {
				cache.delete(cachedRowId);
			}
		}
	}

	return {
		hasChanges,
		rowDirtyById,
		cellDirtyByRowId,
		dirtyCellsByRowId,
		dirtyCellIdsByRowId,
	};
}
