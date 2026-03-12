import { describe, expect, it } from "vitest";

import {
	coerceValueForType,
	evaluateTablaFormula,
	parseLocalizedNumber,
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
