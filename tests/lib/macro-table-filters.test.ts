import { describe, expect, it } from "vitest";

import { matchesMacroSearch, matchesMacroSearchValue } from "@/lib/macro-table-filters";

const policyColumns = [
	{ id: "policyNumber", dataType: "text" as const },
	{ id: "obraLabel", dataType: "text" as const },
];

describe("macro table search", () => {
	it("matches policy numbers regardless of slash spacing", () => {
		expect(matchesMacroSearchValue("1006726 / 0", "1006726/0")).toBe(true);
		expect(matchesMacroSearchValue("1006726/0", "1006726 / 0")).toBe(true);
	});

	it("matches policy numbers in macro rows with compact formatting", () => {
		const row = {
			id: "row-1",
			policyNumber: "1006726 / 0",
			obraLabel: "Obra Central",
			_obraName: "Obra Central",
		};

		expect(matchesMacroSearch(row, policyColumns, "1006726/0")).toBe(true);
	});
});
