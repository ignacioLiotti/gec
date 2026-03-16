import { describe, expect, it } from "vitest";

import { resolveCellSuggestion } from "@/components/form-table/cell-suggestions";
import type { ColumnDef } from "@/components/form-table/types";

type TestRow = {
	id: string;
	fecha: string;
};

const fechaColumn: ColumnDef<TestRow> = {
	id: "fecha",
	label: "Fecha",
	field: "fecha",
	cellType: "text",
};

const row: TestRow = {
	id: "row-1",
	fecha: "",
};

describe("cell date suggestions", () => {
	it("does not prompt for already-complete slash dates", () => {
		const suggestion = resolveCellSuggestion({
			rawValue: "8/3/2021",
			currentValue: "8/3/2021",
			cellType: "text",
			column: fechaColumn,
			row,
		});

		expect(suggestion).toBeNull();
	});

	it("still prompts for non-standard full dates", () => {
		const suggestion = resolveCellSuggestion({
			rawValue: "05.10.2026",
			currentValue: "05.10.2026",
			cellType: "text",
			column: fechaColumn,
			row,
		});

		expect(suggestion?.suggestedDisplayValue).toBe("05/10/2026");
	});
});
