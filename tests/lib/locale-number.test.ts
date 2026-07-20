import { describe, expect, it } from "vitest";

import { parseArgentineNumber } from "@/lib/locale-number";

describe("parseArgentineNumber", () => {
	it.each([
		["", 0],
		["1250", 1250],
		["1.250", 1250],
		["1.250.000", 1250000],
		["1.250.000,50", 1250000.5],
		["1250,75", 1250.75],
		["1,250.50", 1250.5],
	])("parses %s", (value, expected) => {
		expect(parseArgentineNumber(value)).toBe(expected);
	});

	it.each(["-1", "12abc", "1,2,3", "1..2"])("rejects %s", (value) => {
		expect(parseArgentineNumber(value)).toBeNull();
	});
});
