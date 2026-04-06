import { describe, expect, it } from "vitest";

import { buildMacroReportConfig } from "@/components/report/builders/macro-report-config";

describe("buildMacroReportConfig", () => {
	it("marks macro report columns as groupable for visible business fields", () => {
		const config = buildMacroReportConfig({
			id: "macro-1",
			name: "Costos por obra",
			description: null,
			tenantId: "tenant-1",
			settings: {},
			createdAt: "",
			updatedAt: "",
			columns: [
				{
					id: "proveedor",
					macroTableId: "macro-1",
					label: "Proveedor",
					dataType: "text",
					columnType: "source",
					sourceFieldKey: "tabla.proveedor",
					position: 0,
					config: {},
				},
				{
					id: "detalle_descriptivo",
					macroTableId: "macro-1",
					label: "Detalle descriptivo",
					dataType: "text",
					columnType: "source",
					sourceFieldKey: "tabla.detalle_descriptivo",
					position: 1,
					config: {},
				},
				{
					id: "_source_document",
					macroTableId: "macro-1",
					label: "Documento origen",
					dataType: "text",
					columnType: "source",
					sourceFieldKey: "_source.document",
					position: 2,
					config: {},
				},
			],
		});

		expect(config.columns.find((column) => column.id === "_obraName")?.groupable).toBe(true);
		expect(config.columns.find((column) => column.id === "proveedor")?.groupable).toBe(true);
		expect(
			config.columns.find((column) => column.id === "detalle_descriptivo")?.groupable
		).toBe(true);
		expect(config.columns.find((column) => column.id === "_source_document")?.groupable).toBe(
			false
		);
	});
});
