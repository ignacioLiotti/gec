import { describe, expect, it } from "vitest";

import { buildStandardConstructionBlueprint } from "@/lib/tenant-blueprints/standard-construction";

describe("standard construction tenant blueprint", () => {
	it("provides the complete, versioned setup baseline", () => {
		const blueprint = buildStandardConstructionBlueprint();

		expect(blueprint.key).toBe("standard-construction");
		expect(blueprint.version).toBe(1);
		expect(blueprint.obraDefaultsMaterializerVersion).toBe(1);
		expect(blueprint.mainTableColumns).toHaveLength(15);
		expect(blueprint.folders).toHaveLength(8);
		expect(blueprint.tables).toHaveLength(2);
		expect(blueprint.roles).toHaveLength(3);
		expect(blueprint.macros).toHaveLength(3);
		expect(blueprint.dataFlowConfig.dataFlowBuilder.calculations).toHaveLength(4);
		expect(blueprint.dataFlowConfig.dataFlowBuilder.results).toHaveLength(4);
	});

	it("uses unique symbolic keys and valid folder references", () => {
		const blueprint = buildStandardConstructionBlueprint();
		const folderPaths = blueprint.folders.map((folder) => folder.path);
		const tableKeys = blueprint.tables.map((table) => table.key);

		expect(new Set(folderPaths).size).toBe(folderPaths.length);
		expect(new Set(tableKeys).size).toBe(tableKeys.length);
		for (const table of blueprint.tables) {
			expect(folderPaths).toContain(table.linkedFolderPath);
			expect(new Set(table.columns.map((column) => column.fieldKey)).size).toBe(
				table.columns.length,
			);
		}
		for (const macro of blueprint.macros) {
			expect(tableKeys).toContain(macro.sourceTableKey);
		}
	});
});
