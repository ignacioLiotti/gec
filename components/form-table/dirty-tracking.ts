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
	return rowOrder.some((rowId) =>
		computeRowDirty(rowId, rowsById, columns, initialRowsById, dirtyFields).dirty
	);
}










