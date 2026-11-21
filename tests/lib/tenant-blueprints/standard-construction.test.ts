import { describe, expect, it } from "vitest";

import { buildStandardConstructionBlueprint } from "@/lib/tenant-blueprints/standard-construction";

describe("standard construction tenant blueprint", () => {
	it("provides the required versioned construction resources", () => {
		const blueprint = buildStandardConstructionBlueprint();

		expect(blueprint.key).toBe("standard-construction");
		expect(blueprint.version).toBe(1);
		expect(blueprint.obraDefaultsMaterializerVersion).toBe(1);
		expect(blueprint.mainTableColumns.map((column) => column.id)).toEqual(
			expect.arrayContaining([
				"n",
				"designacionYUbicacion",
				"contratoMasAmpliaciones",
				"certificadoALaFecha",
				"saldoACertificar",
				"porcentaje",
			]),
		);
		expect(blueprint.folders.map((folder) => folder.path)).toEqual(
			expect.arrayContaining([
				"contratos",
				"certificados",
				"ordenes-de-compra",
				"seguros-y-polizas",
				"planos",
				"curva-de-avance",
				"fotos-de-obra",
				"documentacion-tecnica",
			]),
		);
		expect(blueprint.tables.map((table) => table.key)).toEqual(
			expect.arrayContaining(["certificates", "purchase-orders"]),
		);
		expect(blueprint.roles.map((role) => role.templateKey)).toEqual(
			expect.arrayContaining(["viewer", "editor", "obra_manager"]),
		);
		expect(blueprint.macros.map((macro) => macro.key)).toEqual(
			expect.arrayContaining([
				"certificates-summary",
				"purchase-orders-summary",
				"progress-summary",
			]),
		);
		expect(
			blueprint.dataFlowConfig.dataFlowBuilder.calculations.map(
				(calculation) => calculation.id,
			),
		).toEqual(
			expect.arrayContaining([
				"default_contract",
				"default_certified",
				"default_balance",
				"default_progress",
			]),
		);
		expect(
			blueprint.dataFlowConfig.dataFlowBuilder.results.map((result) => result.id),
		).toEqual(
			expect.arrayContaining([
				"default_result_contract",
				"default_result_certified",
				"default_result_balance",
				"default_result_progress",
			]),
		);
	});

	it("uses unique symbolic keys and valid folder references", () => {
		const blueprint = buildStandardConstructionBlueprint();
		const mainTableColumnIds = blueprint.mainTableColumns.map((column) => column.id);
		const folderPaths = blueprint.folders.map((folder) => folder.path);
		const tableKeys = blueprint.tables.map((table) => table.key);
		const roleKeys = blueprint.roles.map((role) => role.templateKey);
		const macroKeys = blueprint.macros.map((macro) => macro.key);
		const calculationIds = blueprint.dataFlowConfig.dataFlowBuilder.calculations.map(
			(calculation) => calculation.id,
		);
		const resultIds = blueprint.dataFlowConfig.dataFlowBuilder.results.map(
			(result) => result.id,
		);

		expect(new Set(mainTableColumnIds).size).toBe(mainTableColumnIds.length);
		expect(new Set(folderPaths).size).toBe(folderPaths.length);
		expect(new Set(tableKeys).size).toBe(tableKeys.length);
		expect(new Set(roleKeys).size).toBe(roleKeys.length);
		expect(new Set(macroKeys).size).toBe(macroKeys.length);
		expect(new Set(calculationIds).size).toBe(calculationIds.length);
		expect(new Set(resultIds).size).toBe(resultIds.length);
		for (const table of blueprint.tables) {
			expect(folderPaths).toContain(table.linkedFolderPath);
			expect(new Set(table.columns.map((column) => column.fieldKey)).size).toBe(
				table.columns.length,
			);
		}
		for (const macro of blueprint.macros) {
			expect(tableKeys).toContain(macro.sourceTableKey);
			const sourceTable = blueprint.tables.find(
				(table) => table.key === macro.sourceTableKey,
			);
			const sourceFieldKeys = sourceTable?.columns.map((column) => column.fieldKey) ?? [];
			for (const column of macro.columns) {
				expect(sourceFieldKeys).toContain(column.fieldKey);
			}
		}
		for (const quickAction of blueprint.quickActions) {
			for (const folderPath of quickAction.folderPaths) {
				expect(folderPaths).toContain(folderPath);
			}
		}
		for (const result of blueprint.dataFlowConfig.dataFlowBuilder.results) {
			expect(calculationIds).toContain(result.calculationId);
		}
	});
});
