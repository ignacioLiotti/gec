import { describe, expect, it } from "vitest";
import {
	countActiveAutoColumnFilters,
	createAutoColumnFilters,
	matchesAutoColumnFilters,
	type AutoColumnFilters,
} from "@/components/form-table/column-filters";
import type { ColumnDef, FormTableRow } from "@/components/form-table/types";

type TestRow = FormTableRow & {
	name: string;
	amount: number;
	status: boolean;
	progress: number;
	ignored: string;
};

const columns: ColumnDef<TestRow>[] = [
	{ id: "name", label: "Nombre", field: "name", cellType: "text" },
	{ id: "amount", label: "Monto", field: "amount", cellType: "currency" },
	{ id: "status", label: "Activo", field: "status", cellType: "checkbox" },
	{ id: "progress", label: "Avance", field: "progress", cellType: "badge", filterType: "number" },
	{ id: "ignored", label: "Ignorado", field: "ignored", cellType: "text", filterType: false },
];

describe("auto column filters", () => {
	it("creates filter values from column definitions", () => {
		const filters = createAutoColumnFilters(columns);

		expect(filters.name?.type).toBe("text");
		expect(filters.amount?.type).toBe("number");
		expect(filters.status?.type).toBe("boolean");
		expect(filters.progress?.type).toBe("number");
		expect(filters.ignored).toBeUndefined();
	});

	it("counts and applies active filters by column type", () => {
		const filters: AutoColumnFilters = {
			...createAutoColumnFilters(columns),
			name: { type: "text", value: { condition: "contains", value: "central" } },
			amount: { type: "number", value: { condition: "gte", value: "1000", min: "", max: "" } },
			status: { type: "boolean", value: "yes" },
			progress: { type: "number", value: { condition: "between", value: "", min: "20", max: "80" } },
		};

		expect(countActiveAutoColumnFilters(filters)).toBe(4);
		expect(
			matchesAutoColumnFilters(
				{ id: "1", name: "Obra Central", amount: 1500, status: true, progress: 50, ignored: "x" },
				columns,
				filters
			)
		).toBe(true);
		expect(
			matchesAutoColumnFilters(
				{ id: "2", name: "Obra Central", amount: 900, status: true, progress: 50, ignored: "x" },
				columns,
				filters
			)
		).toBe(false);
	});
});
