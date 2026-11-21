import { createRow, getCoreRowModel, type RowModel, type Table } from "@tanstack/react-table";
import type { FormTableRow } from "./types";

/** FormTable has flat rows. Accordion content is presentation, not a TanStack subrow. */
export function getFormTableRowModel<Row extends FormTableRow>() {
	return (table: Table<Row>): (() => RowModel<Row>) => {
		const getNestedModel = getCoreRowModel<Row>()(table);
		let previousData: Row[] | undefined;
		let previousColumns = table.options.columns;
		let previousGetRowId = table.options.getRowId;
		let model: RowModel<Row> = { rows: [], flatRows: [], rowsById: {} };

		return () => {
			if (table.options.getSubRows) return getNestedModel();
			const { data, columns, getRowId } = table.options;
			const sameColumns = columns === previousColumns;
			const sameGetRowId = getRowId === previousGetRowId;
			if (data === previousData && sameColumns && sameGetRowId) return model;

			const next: RowModel<Row> = { rows: [], flatRows: [], rowsById: {} };
			for (let index = 0; index < data.length; index++) {
				const original = data[index];
				const id = getRowId?.(original, index) ?? original.id;
				const cached = model.rowsById[id];
				const row =
					sameColumns && sameGetRowId && cached?.original === original && cached.index === index
						? cached
						: createRow(table, id, original, index, 0);
				next.rows.push(row);
				next.rowsById[id] = row;
			}
			next.flatRows = next.rows;
			previousData = data;
			previousColumns = columns;
			previousGetRowId = getRowId;
			model = next;
			return model;
		};
	};
}
