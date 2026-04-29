import crypto from "node:crypto";
import { expect, test } from "@playwright/test";

import {
	cleanupLineageFixture,
	createLineageFixture,
	fetchMacroRows,
	fetchTablaRows,
	getLineageAdminClient,
	importOcrStub,
	saveMacroOverride,
	type LineageFixture,
} from "../../helpers/lineage";

test.describe("Ticket 1.1 lineage evidence", () => {
	const fixtures: LineageFixture[] = [];

	test.afterEach(async () => {
		while (fixtures.length > 0) {
			const fixture = fixtures.pop();
			if (!fixture) continue;
			await cleanupLineageFixture(fixture);
		}
	});

	test("import leaves rows with lineage_row_key", async ({ request }) => {
		const fixture = await createLineageFixture(request, "Import");
		fixtures.push(fixture);

		const importResponse = await importOcrStub(request, fixture, {
			docKey: "import-base",
			extraction: {
				items: [
					{ item_code: "ITEM-001", description: "Certificado base", amount: 1200 },
				],
			},
		});

		expect(importResponse.ok()).toBeTruthy();

		const rows = await fetchTablaRows(request, fixture);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			lineage_row_key: expect.any(String),
			materialization_version: 1,
		});
	});

	test("reimport preserves stable identity, increments version and avoids unexpected duplicates", async ({
		request,
	}) => {
		const fixture = await createLineageFixture(request, "Reimport");
		fixtures.push(fixture);

		const firstImport = await importOcrStub(request, fixture, {
			docKey: "reimport-doc",
			extraction: {
				items: [
					{ item_code: "ITEM-REIMPORT", description: "Primera version", amount: 100 },
				],
			},
		});
		expect(firstImport.ok()).toBeTruthy();
		const firstPayload = (await firstImport.json()) as { extractionId?: string };

		const firstRows = await fetchTablaRows(request, fixture);
		expect(firstRows).toHaveLength(1);
		const firstLineageRowKey = String(firstRows[0].lineage_row_key ?? "");
		const firstMaterializationVersion = Number(firstRows[0].materialization_version ?? 0);
		const firstRowExtractionId = String(firstRows[0].extraction_id ?? "");

		const secondImport = await importOcrStub(request, fixture, {
			docKey: "reimport-doc",
			extraction: {
				items: [
					{ item_code: "ITEM-REIMPORT", description: "Segunda version", amount: 150 },
				],
			},
		});
		expect(secondImport.ok()).toBeTruthy();
		const secondPayload = (await secondImport.json()) as { extractionId?: string };

		const rows = await fetchTablaRows(request, fixture);
		expect(rows).toHaveLength(1);

		const uniqueLineageKeys = new Set(rows.map((row) => String(row.lineage_row_key ?? "")));
		expect(uniqueLineageKeys.size).toBe(rows.length);
		expect([...uniqueLineageKeys]).toEqual([firstLineageRowKey]);
		expect(rows[0]).toMatchObject({
			lineage_row_key: firstLineageRowKey,
			extraction_id: secondPayload.extractionId,
		});
		expect(Number(rows[0].materialization_version ?? 0)).toBeGreaterThan(
			firstMaterializationVersion,
		);
		expect(secondPayload.extractionId).not.toBe(firstPayload.extractionId);
		expect(String(rows[0].extraction_id ?? "")).not.toBe(firstRowExtractionId);
	});

	test("manual override survives reimport with stable binding", async ({ request }) => {
		const fixture = await createLineageFixture(request, "Override");
		fixtures.push(fixture);

		const importResponse = await importOcrStub(request, fixture, {
			docKey: "override-doc",
			extraction: {
				items: [
					{ item_code: "ITEM-OVERRIDE", description: "Con override", amount: 200 },
				],
			},
		});
		expect(importResponse.ok()).toBeTruthy();

		const initialRows = await fetchTablaRows(request, fixture);
		expect(initialRows).toHaveLength(1);
		const sourceRowId = String(initialRows[0].id);

		const overrideResponse = await saveMacroOverride(
			request,
			fixture,
			sourceRowId,
			"observacion manual",
		);
		expect(overrideResponse.ok()).toBeTruthy();

		const reimportResponse = await importOcrStub(request, fixture, {
			docKey: "override-doc",
			extraction: {
				items: [
					{ item_code: "ITEM-OVERRIDE", description: "Con override reimportado", amount: 240 },
				],
			},
		});
		expect(reimportResponse.ok()).toBeTruthy();

		const macroPayload = await fetchMacroRows(request, fixture);
		const macroRows = Array.isArray(macroPayload.rows)
			? (macroPayload.rows as Array<Record<string, unknown>>)
			: [];
		expect(macroRows).toHaveLength(1);
		expect(macroRows[0][fixture.macroCustomColumnId]).toBe("observacion manual");
		expect(macroPayload.overrideSummary).toMatchObject({
			appliedStable: expect.any(Number),
			conflicts: 0,
		});
		expect(Number((macroPayload.overrideSummary as { appliedStable?: number }).appliedStable ?? 0)).toBeGreaterThan(0);
	});

	test("OCR conflict returns LINEAGE_RECONCILIATION_CONFLICT and persists explicit error_code", async ({
		request,
	}) => {
		const fixture = await createLineageFixture(request, "OcrConflict");
		fixtures.push(fixture);

		const response = await importOcrStub(request, fixture, {
			docKey: "ocr-conflict",
			extraction: {
				items: [
					{ item_code: "ITEM-CONFLICT-1", description: "Conflict", amount: 1 },
					{ item_code: "ITEM-CONFLICT-2", description: "Conflict", amount: 2 },
				],
			},
			forceLineageConflict: true,
		});

		expect(response.status()).toBe(409);
		const payload = (await response.json()) as { code?: string };
		expect(payload.code).toBe("LINEAGE_RECONCILIATION_CONFLICT");

		const admin = getLineageAdminClient();
		const { data: processing, error: processingError } = await admin
			.from("ocr_document_processing")
			.select("status, error_code")
			.eq("tabla_id", fixture.tablaId)
			.eq("source_path", `${fixture.obraId}/e2e-lineage/ocr-conflict.png`)
			.maybeSingle();
		expect(processingError).toBeNull();
		expect(processing).toMatchObject({
			status: "failed",
			error_code: "LINEAGE_RECONCILIATION_CONFLICT",
		});
	});

	test("downstream conflict returns LINEAGE_OVERRIDE_REATTACH_CONFLICT and persists explicit errorCode backing", async ({
		request,
	}) => {
		const fixture = await createLineageFixture(request, "DownstreamConflict");
		fixtures.push(fixture);

		const importResponse = await importOcrStub(request, fixture, {
			docKey: "downstream-conflict",
			extraction: {
				items: [
					{ item_code: "ITEM-DOWNSTREAM", description: "Conflict row", amount: 300 },
				],
			},
		});
		expect(importResponse.ok()).toBeTruthy();

		const rows = await fetchTablaRows(request, fixture);
		expect(rows).toHaveLength(1);
		const rowId = String(rows[0].id);
		const lineageRowKey = String(rows[0].lineage_row_key);

		const firstSave = await saveMacroOverride(request, fixture, rowId, "valor estable");
		expect(firstSave.ok()).toBeTruthy();

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
			"valor conflictivo",
		);
		expect(conflictResponse.status()).toBe(409);
		const payload = (await conflictResponse.json()) as {
			code?: string;
			conflicts?: Array<{ candidateOverrideIds?: string[] }>;
		};
		expect(payload.code).toBe("LINEAGE_OVERRIDE_REATTACH_CONFLICT");
		expect(Array.isArray(payload.conflicts)).toBeTruthy();

		const candidateIds = new Set(
			(payload.conflicts ?? []).flatMap((conflict) => conflict.candidateOverrideIds ?? []),
		);
		expect(candidateIds.size).toBeGreaterThan(0);

		const { data: persistedConflicts, error: persistedConflictsError } = await admin
			.from("macro_table_custom_values")
			.select("binding_status, binding_error")
			.in("id", [...candidateIds]);
		expect(persistedConflictsError).toBeNull();
		expect((persistedConflicts ?? []).every((record) => record.binding_status === "conflict")).toBeTruthy();
		expect(
			(persistedConflicts ?? []).every((record) => {
				const bindingError =
					record.binding_error &&
					typeof record.binding_error === "object" &&
					!Array.isArray(record.binding_error)
						? (record.binding_error as Record<string, unknown>)
						: null;
				return bindingError?.errorCode === "LINEAGE_OVERRIDE_REATTACH_CONFLICT";
			}),
		).toBeTruthy();
	});
});
