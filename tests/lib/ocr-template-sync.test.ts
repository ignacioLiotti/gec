import { describe, expect, it } from "vitest";

import {
	deriveTemplateColumnsFromRegions,
	type TemplateRegionDefinition,
} from "@/lib/ocr-template-sync";

describe("deriveTemplateColumnsFromRegions", () => {
	it("preserves a single-field key when the region label changes", () => {
		const previousRegions: TemplateRegionDefinition[] = [
			{
				id: "region-1",
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				label: "Numero",
				type: "single",
			},
		];

		const columns = deriveTemplateColumnsFromRegions({
			regions: [
				{
					...previousRegions[0],
					label: "Numero de certificado",
				},
			],
			previousTemplate: {
				regions: previousRegions,
				columns: [
					{
						id: "parent:region-1",
						fieldKey: "nro_certificado",
						label: "Numero",
						dataType: "text",
						ocrScope: "parent",
					},
				],
			},
		});

		expect(columns).toEqual([
			expect.objectContaining({
				id: "parent:region-1",
				fieldKey: "nro_certificado",
				label: "Numero de certificado",
				ocrScope: "parent",
			}),
		]);
	});

	it("preserves table column keys by region id and position", () => {
		const previousRegions: TemplateRegionDefinition[] = [
			{
				id: "table-1",
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				label: "Items",
				type: "table",
				tableColumns: ["Detalle", "Monto"],
			},
		];

		const columns = deriveTemplateColumnsFromRegions({
			regions: [
				{
					...previousRegions[0],
					tableColumns: ["Descripcion", "Importe"],
				},
			],
			previousTemplate: {
				regions: previousRegions,
				columns: [
					{
						id: "item:table-1:0",
						fieldKey: "detalle_descriptivo",
						label: "Detalle",
						dataType: "text",
						ocrScope: "item",
					},
					{
						id: "item:table-1:1",
						fieldKey: "monto_total",
						label: "Monto",
						dataType: "currency",
						ocrScope: "item",
					},
				],
			},
		});

		expect(columns.map((column) => column.fieldKey)).toEqual([
			"detalle_descriptivo",
			"monto_total",
		]);
		expect(columns.map((column) => column.id)).toEqual([
			"item:table-1:0",
			"item:table-1:1",
		]);
		expect(columns.map((column) => column.label)).toEqual([
			"Descripcion",
			"Importe",
		]);
	});
});
