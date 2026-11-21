import { createTable, getCoreRowModel, type ColumnDef, type Table } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { getFormTableRowModel } from "@/components/form-table/table-row-model";

type Row = { id: string; name: string; amount: number; children?: Row[] };
const columns: ColumnDef<Row>[] = [
	{ id: "name", accessorKey: "name" },
	{ id: "amount", accessorKey: "amount" },
];
const rows: Row[] = [
	{ id: "a", name: "Primera", amount: 1 },
	{ id: "b", name: "Segunda", amount: 2 },
	{ id: "c", name: "Tercera", amount: 3 },
];
function makeTable(data = rows, core = getFormTableRowModel<Row>()) {
	return createTable<Row>({
		data,
		columns,
		state: { columnVisibility: {}, columnPinning: { left: [], right: [] } },
		onStateChange: () => {},
		renderFallbackValue: null,
		getRowId: (row) => row.id,
		getCoreRowModel: core,
	});
}
function update(table: Table<Row>, data: Row[]) {
	table.setOptions((prev) => ({ ...prev, data }));
}

describe("FormTable row model", () => {
	it("keeps the flat TanStack row contract", () => {
		const model = makeTable().getRowModel();
		expect(model.rows.map((row) => [row.id, row.index, row.depth, row.getValue("name")])).toEqual([
			["a", 0, 0, "Primera"],
			["b", 1, 0, "Segunda"],
			["c", 2, 0, "Tercera"],
		]);
		expect(model.flatRows).toEqual(model.rows);
		expect(model.rowsById.b).toBe(model.rows[1]);
		expect(model.rows[0].getAllCells().map((cell) => cell.column.id)).toEqual(["name", "amount"]);
	});
	it("reuses an unchanged model", () => {
		const table = makeTable();
		expect(table.getRowModel()).toBe(table.getRowModel());
	});
	it("rebuilds only the edited row and refreshes its cached cell value", () => {
		const table = makeTable();
		const before = table.getRowModel();
		expect(before.rows[1].getValue("amount")).toBe(2);
		update(table, [rows[0], { ...rows[1], amount: 99 }, rows[2]]);
		const after = table.getRowModel();
		expect(after.rows[0]).toBe(before.rows[0]);
		expect(after.rows[2]).toBe(before.rows[2]);
		expect(after.rows[1]).not.toBe(before.rows[1]);
		expect(after.rows[1].getValue("amount")).toBe(99);
	});
	it.each(["reverse", "insert", "delete"])("keeps indexes correct after %s", (operation) => {
		const table = makeTable();
		table.getRowModel();
		const data =
			operation === "reverse"
				? [...rows].reverse()
				: operation === "insert"
					? [{ id: "new", name: "Nueva", amount: 0 }, ...rows]
					: rows.slice(1);
		update(table, data);
		const model = table.getRowModel();
		expect(model.rows.map((row) => row.id)).toEqual(data.map((row) => row.id));
		expect(model.rows.map((row) => row.index)).toEqual(data.map((_, index) => index));
		expect(Object.keys(model.rowsById)).toEqual(data.map((row) => row.id));
	});
	it("invalidates accessors when column definitions change", () => {
		const table = makeTable();
		expect(table.getRowModel().rows[0].getValue("name")).toBe("Primera");
		table.setOptions((prev) => ({ ...prev, columns: [{ id: "name", accessorKey: "amount" }] }));
		expect(table.getRowModel().rows[0].getValue("name")).toBe(1);
	});
	it("updates column visibility on reused rows", () => {
		const table = makeTable();
		const row = table.getRowModel().rows[0];
		table.setOptions((prev) => ({
			...prev,
			state: { ...prev.state, columnVisibility: { amount: false } },
		}));
		expect(table.getRowModel().rows[0]).toBe(row);
		expect(row.getVisibleCells().map((cell) => cell.column.id)).toEqual(["name"]);
	});
	it("invalidates custom row identity", () => {
		const table = makeTable();
		table.getRowModel();
		table.setOptions((prev) => ({ ...prev, getRowId: (row) => `new-${row.id}` }));
		expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["new-a", "new-b", "new-c"]);
	});
	it("uses the library model for nested rows", () => {
		const table = makeTable([{ ...rows[0], children: [rows[1]] }]);
		table.setOptions((prev) => ({ ...prev, getSubRows: (row) => row.children }));
		const model = table.getRowModel();
		expect(model.flatRows.map((row) => row.id)).toEqual(["a", "b"]);
		expect(model.rows[0].subRows[0].getParentRow()?.id).toBe("a");
	});
	it("matches the library across repeated edit, sort and delete operations", () => {
		const optimized = makeTable();
		const reference = makeTable(rows, getCoreRowModel<Row>());
		let data = rows;
		for (let step = 0; step < 60; step++) {
			data = data.map((row, index) =>
				index === step % data.length ? { ...row, amount: step } : row
			);
			if (step % 3 === 0) data = [...data].reverse();
			if (step % 10 === 0) data = data.slice(1);
			if (step % 10 === 5) data = [...data, { id: `added-${step}`, name: "Added", amount: step }];
			update(optimized, data);
			update(reference, data);
			const values = (table: Table<Row>) =>
				table.getRowModel().rows.map((row) => [row.id, row.index, row.getValue("amount")]);
			expect(values(optimized)).toEqual(values(reference));
		}
	});
	it("rebuilds one of 10,000 row objects for a one-cell edit", () => {
		const data = Array.from({ length: 10_000 }, (_, i) => ({
			id: String(i),
			name: `Row ${i}`,
			amount: i,
		}));
		const table = makeTable(data);
		const before = table.getRowModel();
		const next = [...data];
		next[4321] = { ...next[4321], amount: -1 };
		update(table, next);
		const after = table.getRowModel();
		expect(after.rows.filter((row, index) => row !== before.rows[index])).toHaveLength(1);
		expect(after.rows[4321].getValue("amount")).toBe(-1);
	});
});
