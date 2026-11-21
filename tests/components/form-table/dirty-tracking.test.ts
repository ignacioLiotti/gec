import { describe, expect, it } from "vitest";
import {
	buildDirtyIndex,
	computeCellDirty,
	computeRowDirty,
	hasUnsavedChanges,
	type RowDirtyCacheEntry,
} from "@/components/form-table/dirty-tracking";
import { snapshotValues } from "@/components/form-table/table-utils";
import type { ColumnDef } from "@/components/form-table/types";

type Row = { id: string; name: string; amount: number | null; detail: string };
const columns: ColumnDef<Row>[] = [
	{ id: "name", field: "name", label: "Nombre" },
	{ id: "amount", field: "amount", label: "Monto" },
];
const initial = {
	a: { id: "a", name: "A", amount: 1, detail: "uno" },
	b: { id: "b", name: "B", amount: 2, detail: "dos" },
};

describe("table dirty tracking", () => {
	it("starts clean and never mutates the initial snapshot", () => {
		const frozen = Object.freeze({
			a: Object.freeze({ ...initial.a }),
			b: Object.freeze({ ...initial.b }),
		});
		expect(buildDirtyIndex(["a", "b"], ["a", "b"], frozen, columns, frozen).hasChanges).toBe(false);
		const snapshot = snapshotValues<Row>(["a", "b"], frozen);
		snapshot.rowsById.a.name = "changed";
		expect(frozen.a.name).toBe("A");
	});
	it.each([
		["edit", ["a", "b"], { ...initial, a: { ...initial.a, name: "Edited" } }],
		["delete", ["b"], { b: initial.b }],
		["reorder", ["b", "a"], initial],
		["insert", ["c", "a", "b"], { ...initial, c: { ...initial.a, id: "c" } }],
	] as const)("detects %s", (_label, order, values) => {
		expect(buildDirtyIndex([...order], ["a", "b"], values, columns, initial).hasChanges).toBe(true);
	});
	it("identifies the changed cell and restores to clean", () => {
		const values = { ...initial, a: { ...initial.a, name: "Other" } };
		const index = buildDirtyIndex(["a", "b"], ["a", "b"], values, columns, initial);
		expect(index.dirtyCellsByRowId.a).toEqual([columns[0]]);
		expect(index.cellDirtyByRowId.a).toEqual(new Set(["name"]));
		expect(computeCellDirty("a", columns[0], values, initial)).toBe(true);
		expect(computeCellDirty("b", columns[0], values, initial)).toBe(false);
		expect(buildDirtyIndex(["a", "b"], ["a", "b"], initial, columns, initial).hasChanges).toBe(
			false
		);
	});
	it("tracks accordion-only fields without inventing a dirty visible cell", () => {
		const values = { ...initial, a: { ...initial.a, detail: "Extra" } };
		const index = buildDirtyIndex(["a", "b"], ["a", "b"], values, columns, initial, ["detail"]);
		expect(index.rowDirtyById.a).toBe(true);
		expect(index.dirtyCellsByRowId.a).toEqual([]);
		expect(computeRowDirty("a", values, columns, initial, ["detail"]).dirty).toBe(true);
	});
	it("marks all new-row cells dirty and permits missing rows", () => {
		const index = buildDirtyIndex(["a", "missing"], [], { a: initial.a }, columns, {});
		expect(index.cellDirtyByRowId.a).toEqual(new Set(["name", "amount"]));
		expect(index.dirtyCellsByRowId.a).toEqual([]);
		expect(computeRowDirty("missing", initial, columns, initial).dirty).toBe(false);
	});
	it.each([
		[NaN, NaN, false],
		[null, 0, true],
		[0, 0, false],
		[1, 2, true],
	] as const)("compares %s against %s", (current, baseline, dirty) => {
		expect(
			computeCellDirty(
				"a",
				columns[1],
				{ a: { ...initial.a, amount: current } },
				{ a: { ...initial.a, amount: baseline } }
			)
		).toBe(dirty);
	});
	it("invalidates cached diffs when either row or baseline changes", () => {
		const cache = new Map<string, RowDirtyCacheEntry<Row>>();
		buildDirtyIndex(["a"], ["a"], initial, columns, initial, [], cache);
		const edited = { a: { ...initial.a, amount: 22 } };
		expect(buildDirtyIndex(["a"], ["a"], edited, columns, initial, [], cache).hasChanges).toBe(
			true
		);
		expect(buildDirtyIndex(["a"], ["a"], edited, columns, edited, [], cache).hasChanges).toBe(
			false
		);
	});
	it("prunes deleted cached rows", () => {
		const cache = new Map<string, RowDirtyCacheEntry<Row>>();
		buildDirtyIndex(["a", "b"], ["a", "b"], initial, columns, initial, [], cache);
		buildDirtyIndex(["b"], ["a", "b"], { b: initial.b }, columns, initial, [], cache);
		expect([...cache.keys()]).toEqual(["b"]);
	});
	it("agrees with the existing uncached contract across mixed edits", () => {
		const cache = new Map<string, RowDirtyCacheEntry<Row>>();
		for (let step = 0; step < 40; step++) {
			const values = {
				...initial,
				a: { ...initial.a, amount: step % 3, detail: String(step % 2) },
			};
			const order = step % 2 ? ["a", "b"] : ["b", "a"];
			const index = buildDirtyIndex(order, ["a", "b"], values, columns, initial, ["detail"], cache);
			expect(index.hasChanges).toBe(
				hasUnsavedChanges(order, ["a", "b"], values, columns, initial, ["detail"])
			);
			for (const id of order)
				expect(Boolean(index.rowDirtyById[id])).toBe(
					computeRowDirty(id, values, columns, initial, ["detail"]).dirty
				);
		}
	});
});
