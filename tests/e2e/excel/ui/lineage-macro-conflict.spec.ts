import { expect, test } from "../../fixtures/test";
import { z } from "zod";

import {
	fetchTablaRows,
	importOcrStub,
	saveMacroOverride,
} from "../../helpers/lineage";

const macroRowsResponseSchema = z.object({
	rows: z.array(z.record(z.unknown())),
	overrideConflicts: z.array(
		z.object({
			rowId: z.string(),
			columnId: z.string(),
		}),
	),
});

// Setup reaches the real lineage routes and database while replacing provider OCR
// extraction and storage upload with the deterministic import-helper boundary.
test.describe("Lineage conflict UX", () => {
	test("macro tables show conflicting manual values without choosing a winner", async ({
		page,
		request,
		scenario,
	}, testInfo) => {
		const fixture = await scenario.lineage.createSingle("MacroConflictUI");
		const healthyFixture = await scenario.lineage.createSingle("MacroHealthyUI");

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

		await scenario.lineage.injectLegacyConflict(fixture, {
			lineageRowKey,
			value: "legacy conflict",
		});

		const healthyImportResponse = await importOcrStub(request, healthyFixture, {
			docKey: "macro-healthy-ui",
			extraction: {
				items: [
					{ item_code: "ITEM-HEALTHY", description: "UI healthy", amount: 300 },
				],
			},
		});
		expect(healthyImportResponse.ok()).toBeTruthy();
		const healthyRows = await fetchTablaRows(request, healthyFixture);
		expect(healthyRows).toHaveLength(1);
		const healthyRowId = String(healthyRows[0].id);
		const healthyOverride = await saveMacroOverride(
			request,
			healthyFixture,
			healthyRowId,
			"valor estable",
		);
		expect(healthyOverride.ok()).toBeTruthy();

		const conflictRowsResponsePromise = page.waitForResponse((response) => {
			const pathname = new URL(response.url()).pathname;
			return (
				pathname === `/api/macro-tables/${fixture.macroTableId}/rows` &&
				response.request().method() === "GET"
			);
		});
		await page.goto(`/macro?macroId=${fixture.macroTableId}`);
		const conflictRowsResponse = await conflictRowsResponsePromise;
		expect(conflictRowsResponse.ok()).toBeTruthy();
		const conflictPayload = macroRowsResponseSchema.parse(
			await conflictRowsResponse.json(),
		);
		expect(conflictPayload.overrideConflicts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					rowId,
					columnId: fixture.macroCustomColumnId,
				}),
			]),
		);
		const conflictedRow = conflictPayload.rows.find((row) => row.id === rowId);
		expect(conflictedRow?.[fixture.macroCustomColumnId]).toBeNull();

		const notice = page
			.getByRole("status")
			.filter({ hasText: "Valores manuales en conflicto" });
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("1 celda en conflicto en esta página");
		await expect(notice).toContainText("ITEM-UI");
		await expect(notice).toContainText(fixture.obraName);
		await expect(notice).toContainText("Nota manual");

		const conflictCell = page.locator(
			`[data-row-id="${rowId}"][data-column-id="${fixture.macroCustomColumnId}"]`,
		);
		await expect(conflictCell).toContainText("-");
		await expect(conflictCell).not.toContainText("valor ui");
		await expect(conflictCell).not.toContainText("legacy conflict");
		await testInfo.attach("macro-conflict-notice", {
			body: await notice.screenshot(),
			contentType: "image/png",
		});

		const healthyRowsResponsePromise = page.waitForResponse((response) =>
			new URL(response.url()).pathname ===
			`/api/macro-tables/${healthyFixture.macroTableId}/rows`,
		);
		await page.goto(`/macro?macroId=${healthyFixture.macroTableId}`);
		expect((await healthyRowsResponsePromise).ok()).toBeTruthy();
		await expect(notice).toBeHidden();
		await expect(
			page.locator(
				`[data-row-id="${healthyRowId}"][data-column-id="${healthyFixture.macroCustomColumnId}"]`,
			),
		).toContainText("valor estable");
	});
});
