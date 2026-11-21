import { describe, expect, it, vi } from "vitest";
import { createRowFilter } from "@/components/form-table/table-row-pipeline";
import type { ColumnDef } from "@/components/form-table/types";
type Row = { id: string; name: string; amount: number };
const columns: ColumnDef<Row>[] = [
	{ id: "name", field: "name", label: "Nombre" },
	{ id: "amount", field: "amount", label: "Monto" },
];
const row = { id: "a", name: "Obra Central", amount: 100 };
const options = {
	columns,
	searchRequestKey: "",
	filters: { min: 0 },
	tabFilters: [{ id: "all", label: "Todas" }],
	useServerDataMode: false,
};

describe("table row filtering", () => {
	it.each([
		["central", true],
		["OBRA", true],
		["100", true],
		["missing", false],
		["", true],
	])("matches query %s", (searchRequestKey, matches) => {
		expect(createRowFilter({ ...options, searchRequestKey })(row).matches).toBe(matches);
	});
	it("honors custom search and advanced filters together", () => {
		const searchFn = vi.fn(() => true);
		const match = createRowFilter({
			...options,
			searchRequestKey: "alias",
			columns: [{ ...columns[0], searchFn }],
			filters: { min: 200 },
			applyFilters: (value, filters) => value.amount >= filters.min,
		});
		expect(match(row).matches).toBe(false);
		expect(searchFn).toHaveBeenCalledWith(row, "alias");
	});
	it("counts overlapping tabs after filtering", () => {
		const match = createRowFilter({
			...options,
			tabFilters: [
				...options.tabFilters,
				{ id: "positive", label: "Positivo", predicate: (value: Row) => value.amount > 0 },
				{ id: "large", label: "Grande", predicate: (value: Row) => value.amount > 1000 },
			],
		});
		expect([...match(row).tabIds]).toEqual(["all", "positive"]);
	});
	it("leaves search and advanced filtering to the server in server mode", () => {
		const applyFilters = vi.fn(() => false);
		const result = createRowFilter({
			...options,
			useServerDataMode: true,
			searchRequestKey: "no match",
			applyFilters,
		})(row);
		expect(result.matches).toBe(true);
		expect(applyFilters).not.toHaveBeenCalled();
	});
	it("reevaluates one row after editing a 10,000-row dataset", () => {
		const predicate = vi.fn((value: Row) => value.amount > 0);
		const match = createRowFilter({
			...options,
			tabFilters: [{ id: "positive", label: "+", predicate }],
		});
		const data = Array.from({ length: 10_000 }, (_, index) => ({
			id: String(index),
			name: "Obra",
			amount: index,
		}));
		data.forEach(match);
		expect(predicate).toHaveBeenCalledTimes(10_000);
		predicate.mockClear();
		const next = [...data];
		next[50] = { ...next[50], amount: -1 };
		next.forEach(match);
		expect(predicate).toHaveBeenCalledTimes(1);
		expect(match(next[50]).tabIds.size).toBe(0);
	});
	it("does not reuse cached results across different queries", () => {
		expect(createRowFilter({ ...options, searchRequestKey: "Central" })(row).matches).toBe(true);
		expect(createRowFilter({ ...options, searchRequestKey: "No existe" })(row).matches).toBe(false);
	});
});
