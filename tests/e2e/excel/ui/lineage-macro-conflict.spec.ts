import crypto from "node:crypto";
import { expect, test } from "@playwright/test";

import {
	cleanupLineageFixture,
	createLineageFixture,
	fetchTablaRows,
	getLineageAdminClient,
	importOcrStub,
	saveMacroOverride,
	type LineageFixture,
} from "../../helpers/lineage";

test.describe("Lineage conflict UX", () => {
	const fixtures: LineageFixture[] = [];

	test.afterEach(async () => {
		while (fixtures.length > 0) {
			const fixture = fixtures.pop();
			if (!fixture) continue;
			await cleanupLineageFixture(fixture);
		}
	});

	test("macro tables show downstream conflict without relying on the lineage panel", async ({
		page,
		request,
	}) => {
		const fixture = await createLineageFixture(request, "MacroConflictUI");
		fixtures.push(fixture);

		const importResponse = await importOcrStub(request, fixture, {
			docKey: "macro-conflict-ui",
			extraction: {
				items: [
					{ item_code: "ITEM-UI", description: "UI conflict", amount: 450 },
				],
			},
		});
		expect(importResponse.ok()).toBeTruthy();

		const rows = await fetchTablaRows(request, fixture);
		expect(rows).toHaveLength(1);
		const rowId = String(rows[0].id);
		const lineageRowKey = String(rows[0].lineage_row_key);

		const stableOverride = await saveMacroOverride(request, fixture, rowId, "valor ui");
		expect(stableOverride.ok()).toBeTruthy();

		const admin = getLineageAdminClient();
		const { error: injectedConflictError } = await admin
			.from("macro_table_custom_values")
			.insert({
				macro_table_id: fixture.macroTableId,
				source_row_id: crypto.randomUUID(),
				source_tabla_id: fixture.tablaId,
				lineage_row_key: lineageRowKey,
				column_id: fixture.macroCustomColumnId,
				value: "legacy conflict",
				binding_status: "legacy",
				binding_error: null,
			});
		expect(injectedConflictError).toBeNull();

		await page.goto(`/macro?macroId=${fixture.macroTableId}`);
		await page.waitForLoadState("networkidle");

		await expect(page.getByText("Conflictos de reattach visibles")).toBeVisible();
		await expect(page.getByText(/lineage biz:/i)).toBeVisible();
	});
});
