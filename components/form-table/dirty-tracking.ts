import type { ColumnDef, FormTableRow } from "./types";
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
	initialRowsById: Record<string, Row>
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

	for (const column of columns) {
		if (column.field === ("id" as any)) continue;
		const currentValue = currentRow[column.field];
		const initialValue = initialRow[column.field];
		if (!shallowEqualValues(currentValue, initialValue)) {
			dirtyCells.push(column);
		}
	}

	return { dirty: dirtyCells.length > 0, cells: dirtyCells };
}

export function hasUnsavedChanges<Row extends FormTableRow>(
	rowOrder: string[],
	rowsById: Record<string, Row>,
	columns: ColumnDef<Row>[],
	initialRowsById: Record<string, Row>
) {
	return rowOrder.some((rowId) => computeRowDirty(rowId, rowsById, columns, initialRowsById).dirty);
}




