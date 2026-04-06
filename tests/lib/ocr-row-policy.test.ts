import { describe, expect, it } from "vitest";

import { applyOcrExtractionRowPolicy } from "@/lib/ocr-row-policy";

describe("applyOcrExtractionRowPolicy", () => {
	it("keeps multiple extracted rows by default when the table has item columns", () => {
		const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];

		const result = applyOcrExtractionRowPolicy(rows, {}, { hasItemColumns: true });

		expect(result).toEqual(rows);
	});

	it("still allows forcing a single row explicitly", () => {
		const rows = [{ a: 1 }, { a: 2 }];

		const result = applyOcrExtractionRowPolicy(
			rows,
			{ extractionRowMode: "single" },
			{ hasItemColumns: true },
		);

		expect(result).toEqual([{ a: 1 }]);
	});

	it("defaults to a single row when the table has no item columns", () => {
		const rows = [{ a: 1 }, { a: 2 }];

		const result = applyOcrExtractionRowPolicy(rows, {}, { hasItemColumns: false });

		expect(result).toEqual([{ a: 1 }]);
	});

	it("respects extractionMaxRows for multi-row OCR tables", () => {
		const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];

		const result = applyOcrExtractionRowPolicy(
			rows,
			{ extractionMaxRows: 2 },
			{ hasItemColumns: true },
		);

		expect(result).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it("ignores legacy maxRows=1 when an item table is configured as multiple", () => {
		const rows = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }];

		const result = applyOcrExtractionRowPolicy(
			rows,
			{ extractionRowMode: "multiple", extractionMaxRows: 1 },
			{ hasItemColumns: true },
		);

		expect(result).toEqual(rows);
	});
});
