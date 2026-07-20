import { describe, expect, it } from "vitest";

import {
	answersToInstructions,
	buildImportedDefinitionFromAnalysis,
	type SampleAnalysis,
} from "@/lib/obra-defaults/sample-analysis";

const baseAnalysis: SampleAnalysis = {
	document: {
		family: "certificado mensual de obra",
		summary: "Certificado de avance mensual con resumen e ítems.",
		format: "pdf_texto",
		legibility: "alta",
		pageCount: 2,
		sheets: [],
		layoutHint: "formulario_fijo",
	},
	fields: [
		{
			fieldKey: "numero",
			label: "Número",
			dataType: "text",
			sampleValue: "12",
			confidence: "alta",
			meaning: "Número correlativo del certificado",
			aliases: ["nro", "n°"],
		},
		{
			fieldKey: "monto_total",
			label: "Monto total",
			dataType: "currency",
			sampleValue: "$ 4.850.000",
			confidence: "media",
			meaning: "Monto certificado en el período",
			aliases: [],
		},
	],
	tables: [
		{
			label: "Ítems",
			description: "Detalle de tareas certificadas",
			columns: [
				{
					fieldKey: "tarea",
					label: "Tarea",
					dataType: "text",
					sampleValue: null,
					confidence: "alta",
					meaning: "Descripción de la tarea",
					aliases: [],
				},
				{
					fieldKey: "cantidad",
					label: "Cantidad",
					dataType: "number",
					sampleValue: null,
					confidence: "alta",
					meaning: "Cantidad ejecutada",
					aliases: ["cant"],
				},
			],
			sampleRows: [
				{ tarea: "Excavación", cantidad: "10" },
				{ tarea: "Hormigón", cantidad: "4" },
			],
			totalRowsSeen: 14,
		},
	],
	suggestedInstructions: ["Usar el monto del recuadro final firmado."],
	warnings: ["El sello puede tapar el número en algunos ejemplares."],
};

describe("buildImportedDefinitionFromAnalysis", () => {
	it("keeps only selected fields and table columns", () => {
		const definition = buildImportedDefinitionFromAnalysis(baseAnalysis, {
			selectedFieldKeys: ["numero"],
			selectedTables: [{ label: "Ítems", columnFieldKeys: ["tarea"] }],
			answers: {},
		});

		expect(definition.document_family).toBe("certificado mensual de obra");
		expect(definition.fields).toHaveLength(1);
		expect(definition.fields[0]).toMatchObject({
			field_key: "numero",
			example_values: ["12"],
			aliases: ["nro", "n°"],
		});
		expect(definition.table_sections).toHaveLength(1);
		expect(definition.table_sections[0].columns).toHaveLength(1);
		expect(definition.table_sections[0].columns[0]).toMatchObject({
			field_key: "tarea",
			example_values: ["Excavación", "Hormigón"],
		});
		expect(definition.review_warnings).toEqual(baseAnalysis.warnings);
	});

	it("drops tables with no selected columns", () => {
		const definition = buildImportedDefinitionFromAnalysis(baseAnalysis, {
			selectedFieldKeys: ["numero", "monto_total"],
			selectedTables: [{ label: "Ítems", columnFieldKeys: [] }],
			answers: {},
		});
		expect(definition.table_sections).toHaveLength(0);
	});

	it("appends answer-derived instructions after the analysis ones", () => {
		const definition = buildImportedDefinitionFromAnalysis(baseAnalysis, {
			selectedFieldKeys: ["numero"],
			selectedTables: [],
			answers: { arrival: "fotos", layout: "variable", sheets: "buscar" },
		});
		expect(definition.global_extraction_instructions[0]).toBe(
			"Usar el monto del recuadro final firmado.",
		);
		expect(definition.global_extraction_instructions).toHaveLength(4);
	});
});

describe("answersToInstructions", () => {
	it("returns no lines for defaults that need no special handling", () => {
		expect(answersToInstructions({ arrival: "digital", layout: "fijo" })).toEqual(
			[],
		);
	});

	it("maps each variance answer to one instruction line", () => {
		const lines = answersToInstructions({
			arrival: "fotos",
			layout: "variable",
			sheets: "buscar",
		});
		expect(lines).toHaveLength(3);
		expect(lines.join(" ")).toContain("fotos o escaneos");
		expect(lines.join(" ")).toContain("no asumir posiciones fijas");
		expect(lines.join(" ")).toContain("varias hojas");
	});
});
