import { describe, expect, it } from "vitest";

import { buildMacroReportConfig } from "@/components/report/builders/macro-report-config";

describe("buildMacroReportConfig", () => {
	it("marks macro report columns as groupable for visible business fields", () => {
		const config = buildMacroReportConfig({
			id: "macro-1",
			name: "Costos por obra",
			description: null,
			tenantId: "tenant-1",
			createdAt: "",
			updatedAt: "",
			columns: [
				{
					id: "proveedor",
					label: "Proveedor",
					dataType: "text",
					columnType: "source",
					sourceFieldKey: "tabla.proveedor",
					config: null,
				},
				{
					id: "detalle_descriptivo",
					label: "Detalle descriptivo",
					dataType: "text",
					columnType: "source",
					sourceFieldKey: "tabla.detalle_descriptivo",
					config: null,
				},
				{
					id: "_source_document",
					label: "Documento origen",
					dataType: "text",
					columnType: "source",
					sourceFieldKey: "_source.document",
					config: null,
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
