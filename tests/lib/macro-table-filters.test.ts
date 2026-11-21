import { describe, expect, it } from "vitest";

import { matchesMacroSearch } from "@/lib/macro-table-filters";

const policyColumns = [
	{ id: "policyNumber", dataType: "text" as const },
	{ id: "obraLabel", dataType: "text" as const },
];

describe("macro table search", () => {
	it("matches policy numbers in macro rows regardless of slash spacing", () => {
		const row = {
			id: "row-1",
			_sourceTablaId: "table-1",
			_sourceTablaName: "Pólizas",
			_obraId: "obra-1",
			policyNumber: "1006726 / 0",
			obraLabel: "Obra Central",
			_obraName: "Obra Central",
		};

		expect(matchesMacroSearch(row, policyColumns, "1006726/0")).toBe(true);
		expect(
			matchesMacroSearch(
				{ ...row, policyNumber: "1006726/0" },
				policyColumns,
				"1006726 / 0",
			),
		).toBe(true);
	});
});
