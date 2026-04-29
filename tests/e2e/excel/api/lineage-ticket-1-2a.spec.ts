import crypto from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

import {
	cleanupLineageFixture,
	cleanupSimpleFixture,
	createLineageFixture,
	createOcrMultiLineageFixture,
	createSpreadsheetLineageFixture,
	fetchLineageGraph,
	getLineageAdminClient,
	importOcrMultiStub,
	importOcrStub,
	importSpreadsheetMultiCsv,
	saveMacroOverride,
	type LineageFixture,
	type OcrMultiLineageFixture,
	type SpreadsheetLineageFixture,
} from "../../helpers/lineage";

async function fetchRowsForTable(
	request: APIRequestContext,
	args: { obraId: string; tablaId: string },
) {
	const response = await request.get(`/api/obras/${args.obraId}/tablas/${args.tablaId}/rows`);
	expect(response.ok()).toBeTruthy();
	const payload = (await response.json()) as { rows?: Array<Record<string, unknown>> };
	return Array.isArray(payload.rows) ? payload.rows : [];
}

test.describe("Ticket 1.2A lineage contract extension", () => {
	const simpleFixtures: Array<OcrMultiLineageFixture | SpreadsheetLineageFixture> = [];
	const fullFixtures: LineageFixture[] = [];

	test.afterEach(async () => {
		while (simpleFixtures.length > 0) {
			const fixture = simpleFixtures.pop();
			if (!fixture) continue;
			await cleanupSimpleFixture(fixture);
		}
		while (fullFixtures.length > 0) {
			const fixture = fullFixtures.pop();
			if (!fixture) continue;
			await cleanupLineageFixture(fixture);
		}
	});

	test("ocr-multi reimport preserves stable identity across tables", async ({ request }) => {
		const fixture = await createOcrMultiLineageFixture(request, "Reimport");
		simpleFixtures.push(fixture);

		const firstImport = await importOcrMultiStub(request, fixture, {
			docKey: "ocr-multi-reimport",
			extraction: {
				tables: {
					[fixture.tablaIds[0]]: {
						items: [{ item_code: "MULTI-A", description: "Primera A", amount: 10 }],
					},
					[fixture.tablaIds[1]]: {
						items: [{ item_code: "MULTI-B", description: "Primera B", amount: 20 }],
					},
				},
			},
		});
		expect(firstImport.ok()).toBeTruthy();
		const firstPayload = (await firstImport.json()) as { extractionId?: string };

		const firstRowsByTable = await Promise.all(
			fixture.tablaIds.map((tablaId) => fetchRowsForTable(request, { obraId: fixture.obraId, tablaId })),
		);
		for (const rows of firstRowsByTable) {
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				lineage_row_key: expect.any(String),
				materialization_version: 1,
				extraction_id: firstPayload.extractionId,
			});
		}

		const secondImport = await importOcrMultiStub(request, fixture, {
			docKey: "ocr-multi-reimport",
			extraction: {
				tables: {
					[fixture.tablaIds[0]]: {
						items: [{ item_code: "MULTI-A", description: "Segunda A", amount: 11 }],
					},
					[fixture.tablaIds[1]]: {
						items: [{ item_code: "MULTI-B", description: "Segunda B", amount: 21 }],
					},
				},
			},
		});
		expect(secondImport.ok()).toBeTruthy();
		const secondPayload = (await secondImport.json()) as { extractionId?: string };
		expect(secondPayload.extractionId).not.toBe(firstPayload.extractionId);

		for (const [index, tablaId] of fixture.tablaIds.entries()) {
			const rows = await fetchRowsForTable(request, { obraId: fixture.obraId, tablaId });
			expect(rows).toHaveLength(1);
			const firstRow = firstRowsByTable[index][0];
			expect(new Set(rows.map((row) => String(row.lineage_row_key ?? ""))).size).toBe(rows.length);
			expect(rows[0]).toMatchObject({
				lineage_row_key: firstRow.lineage_row_key,
				extraction_id: secondPayload.extractionId,
			});
			expect(Number(rows[0].materialization_version ?? 0)).toBeGreaterThan(
				Number(firstRow.materialization_version ?? 0),
			);
		}
	});

	test("ocr-multi conflict persists explicit error_code for affected tables", async ({ request }) => {
		const fixture = await createOcrMultiLineageFixture(request, "Conflict");
		simpleFixtures.push(fixture);

		const response = await importOcrMultiStub(request, fixture, {
			docKey: "ocr-multi-conflict",
			extraction: {
				tables: {
					[fixture.tablaIds[0]]: {
						items: [
							{ item_code: "CONFLICT-A1", description: "Conflict A1", amount: 1 },
							{ item_code: "CONFLICT-A2", description: "Conflict A2", amount: 2 },
						],
					},
					[fixture.tablaIds[1]]: {
						items: [{ item_code: "CONFLICT-B", description: "Conflict B", amount: 3 }],
					},
				},
			},
			forceLineageConflict: true,
		});

		expect(response.status()).toBe(409);
		const payload = (await response.json()) as { code?: string };
		expect(payload.code).toBe("LINEAGE_RECONCILIATION_CONFLICT");

		const admin = getLineageAdminClient();
		const { data: processing, error } = await admin
			.from("ocr_document_processing")
			.select("tabla_id, status, error_code")
			.in("tabla_id", fixture.tablaIds)
			.eq("source_path", `${fixture.obraId}/e2e-lineage/ocr-multi-conflict.png`);
		expect(error).toBeNull();
		expect(processing).toHaveLength(fixture.tablaIds.length);
		expect(
			(processing ?? []).every(
				(record) =>
					record.status === "failed" &&
					record.error_code === "LINEAGE_RECONCILIATION_CONFLICT",
			),
		).toBeTruthy();
	});

	test("spreadsheet-multi reimport preserves stable identity with conservative lineage contract", async ({
		request,
	}) => {
		const fixture = await createSpreadsheetLineageFixture(request, "Reimport");
		simpleFixtures.push(fixture);

		const firstImport = await importSpreadsheetMultiCsv(request, fixture, {
			docKey: "spreadsheet-lineage",
			csv: ["cert_id,description,amount", "CERT-001,Primera fila,100"].join("\n"),
		});
		expect(firstImport.ok()).toBeTruthy();
		const firstPayload = (await firstImport.json()) as { extractionId?: string };

		const firstRows = await fetchRowsForTable(request, {
			obraId: fixture.obraId,
			tablaId: fixture.tablaId,
		});
		expect(firstRows).toHaveLength(1);
		const firstLineageRowKey = String(firstRows[0].lineage_row_key ?? "");
		const firstVersion = Number(firstRows[0].materialization_version ?? 0);

		const secondImport = await importSpreadsheetMultiCsv(request, fixture, {
			docKey: "spreadsheet-lineage",
			csv: ["cert_id,description,amount", "CERT-001,Segunda fila,150"].join("\n"),
		});
		expect(secondImport.ok()).toBeTruthy();
		const secondPayload = (await secondImport.json()) as { extractionId?: string };
		expect(secondPayload.extractionId).not.toBe(firstPayload.extractionId);

		const rows = await fetchRowsForTable(request, {
			obraId: fixture.obraId,
			tablaId: fixture.tablaId,
		});
		expect(rows).toHaveLength(1);
		expect(new Set(rows.map((row) => String(row.lineage_row_key ?? ""))).size).toBe(rows.length);
		expect(rows[0]).toMatchObject({
			lineage_row_key: firstLineageRowKey,
			extraction_id: secondPayload.extractionId,
		});
		expect(Number(rows[0].materialization_version ?? 0)).toBeGreaterThan(firstVersion);
	});

	test("lineage graph exposes real macro_table and override nodes with downstream states", async ({
		request,
	}) => {
		const fixture = await createLineageFixture(request, "Graph");
		fullFixtures.push(fixture);

		const importResponse = await importOcrStub(request, fixture, {
			docKey: "graph-doc",
			extraction: {
				items: [{ item_code: "GRAPH-001", description: "Graph row", amount: 100 }],
			},
		});
		expect(importResponse.ok()).toBeTruthy();
		const rows = await fetchRowsForTable(request, {
			obraId: fixture.obraId,
			tablaId: fixture.tablaId,
		});
		expect(rows).toHaveLength(1);
		const rowId = String(rows[0].id);
		const lineageRowKey = String(rows[0].lineage_row_key ?? "");

		const stableSave = await saveMacroOverride(request, fixture, rowId, "override estable");
		expect(stableSave.ok()).toBeTruthy();

		const stableGraph = await fetchLineageGraph(request, {
			obraId: fixture.obraId,
			tablaId: fixture.tablaId,
			docPath: `${fixture.obraId}/e2e-lineage/graph-doc.png`,
		});
		const stableNodes = Array.isArray(stableGraph.nodes) ? stableGraph.nodes : [];
		expect(stableNodes.some((node) => node.type === "macro_table")).toBeTruthy();
		expect(
			stableNodes.some((node) => node.type === "override" && node.status === "stable"),
		).toBeTruthy();

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

		const conflictResponse = await saveMacroOverride(
			request,
			fixture,
			rowId,
			"override conflictivo",
		);
		expect(conflictResponse.status()).toBe(409);

		const conflictGraph = await fetchLineageGraph(request, {
			obraId: fixture.obraId,
			tablaId: fixture.tablaId,
			docPath: `${fixture.obraId}/e2e-lineage/graph-doc.png`,
		});
		const conflictNodes = Array.isArray(conflictGraph.nodes) ? conflictGraph.nodes : [];
		expect(
			conflictNodes.some(
				(node) =>
					node.type === "override" &&
					node.status === "conflict" &&
					typeof (node.data as Record<string, unknown>)?.errorCode === "string",
			),
		).toBeTruthy();
		expect(Number(conflictGraph.summary?.macroTables ?? 0)).toBeGreaterThan(0);
		expect(Number(conflictGraph.summary?.overrides ?? 0)).toBeGreaterThan(0);
	});
});
