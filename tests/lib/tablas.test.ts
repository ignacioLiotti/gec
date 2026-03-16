import { describe, expect, it } from "vitest";

import {
	coerceValueForType,
	evaluateTablaFormula,
	formatDateAsDmy,
	parseLocalizedNumber,
	parseLooseDateInput,
	remapTablaRowDataToSchema,
	toNumericValue,
} from "@/lib/tablas";

describe("numeric locale parsing", () => {
	it("accepts es-AR thousands and decimal separators", () => {
		expect(parseLocalizedNumber("1.000.000,10")).toBeCloseTo(1000000.1);
		expect(toNumericValue("$ 1.000.000,10")).toBeCloseTo(1000000.1);
		expect(coerceValueForType("currency", "1.000.000,10")).toBeCloseTo(1000000.1);
	});

	it("keeps supporting US-style separators", () => {
		expect(parseLocalizedNumber("1,000,000.10")).toBeCloseTo(1000000.1);
		expect(parseLocalizedNumber("12.5")).toBeCloseTo(12.5);
	});

	it("handles grouped integers without decimals", () => {
		expect(parseLocalizedNumber("1.000.000")).toBe(1000000);
		expect(parseLocalizedNumber("1,000,000")).toBe(1000000);
	});

	it("evaluates formulas with locale-formatted numeric strings", () => {
		expect(
			evaluateTablaFormula("[anticipo] + [ajuste]", {
				anticipo: "1.000.000,10",
				ajuste: "250,25",
			})
		).toBeCloseTo(1000250.35);
	});
});

describe("schema remapping", () => {
	it("adds new columns as empty values while preserving existing values and metadata", () => {
		expect(
			remapTablaRowDataToSchema({
				previousData: {
					periodo: "Enero 2026",
					nro_certificado: "12",
					__docPath: "obra/certificados/file.pdf",
				},
				nextColumns: [
					{ id: "periodo", fieldKey: "periodo", dataType: "text" },
					{ id: "nro_certificado", fieldKey: "nro_certificado", dataType: "text" },
					{ id: "nro_expediente", fieldKey: "nro_expediente", dataType: "text" },
				],
				previousFieldKeyByColumnId: {
					periodo: "periodo",
					nro_certificado: "nro_certificado",
				},
			})
		).toEqual({
			periodo: "Enero 2026",
			nro_certificado: "12",
			nro_expediente: null,
			__docPath: "obra/certificados/file.pdf",
		});
	});

	it("preserves values when a column key changes but identity stays the same", () => {
		expect(
			remapTablaRowDataToSchema({
				previousData: {
					nro_expediente_antiguo: "EXP-55",
				},
				nextColumns: [
					{ id: "default-col-1", fieldKey: "nro_expediente", dataType: "text" },
				],
				previousFieldKeyByColumnId: {
					"default-col-1": "nro_expediente_antiguo",
				},
			})
		).toEqual({
			nro_expediente: "EXP-55",
		});
	});

	it("recomputes formulas after remapping the row payload", () => {
		expect(
			remapTablaRowDataToSchema({
				previousData: {
					monto: "1000",
				},
				nextColumns: [
					{ id: "monto", fieldKey: "monto", dataType: "currency" },
					{
						id: "doble",
						fieldKey: "doble",
						dataType: "currency",
						config: { formula: "[monto] * 2" },
					},
				],
				previousFieldKeyByColumnId: {
					monto: "monto",
				},
			})
		).toEqual({
			monto: 1000,
			doble: 2000,
		});
	});
});

describe("date normalization helpers", () => {
	it("normalizes dotted day-month-year inputs", () => {
		const parsed = parseLooseDateInput("05.10.2026");
		expect(parsed).not.toBeNull();
		expect(formatDateAsDmy(parsed!.date)).toBe("05/10/2026");
		expect(parsed!.inferredParts).toEqual([]);
	});

	it("uses the current cell year for day-month shorthands", () => {
		const parsed = parseLooseDateInput("05/10", {
			referenceDate: new Date(2026, 9, 5),
		});
		expect(parsed).not.toBeNull();
		expect(formatDateAsDmy(parsed!.date)).toBe("05/10/2026");
		expect(parsed!.inferredParts).toEqual(["year"]);
	});

	it("uses the current cell day for month-year shorthands", () => {
		const parsed = parseLooseDateInput("octubre 2026", {
			referenceDate: new Date(2026, 9, 5),
		});
		expect(parsed).not.toBeNull();
		expect(formatDateAsDmy(parsed!.date)).toBe("05/10/2026");
		expect(parsed!.inferredParts).toEqual(["day"]);
	});

	it("supports textual day-month values with an inferred year", () => {
		const parsed = parseLooseDateInput("5 de octubre", {
			referenceDate: new Date(2026, 0, 12),
		});
		expect(parsed).not.toBeNull();
		expect(formatDateAsDmy(parsed!.date)).toBe("05/10/2026");
		expect(parsed!.inferredParts).toEqual(["year"]);
	});

	it("falls back to day 01 when month-year values have no current cell date", () => {
		const parsed = parseLooseDateInput("OCT/26", {
			fallbackYear: 2026,
		});
		expect(parsed).not.toBeNull();
		expect(formatDateAsDmy(parsed!.date)).toBe("01/10/2026");
		expect(parsed!.inferredParts).toEqual(["day"]);
	});

	it("supports textual day-month values without the 'de' connector", () => {
		const parsed = parseLooseDateInput("20 octubre", {
			fallbackYear: 2026,
		});
		expect(parsed).not.toBeNull();
		expect(formatDateAsDmy(parsed!.date)).toBe("20/10/2026");
		expect(parsed!.inferredParts).toEqual(["year"]);
	});

	it("supports mixed day-month-name-year values", () => {
		const parsed = parseLooseDateInput("15-oct-25");
		expect(parsed).not.toBeNull();
		expect(formatDateAsDmy(parsed!.date)).toBe("15/10/2025");
		expect(parsed!.inferredParts).toEqual([]);
	});
});
