import { expect, test } from "../../fixtures/test";
import { z } from "zod";

import {
	fetchMacroRows,
	fetchTablaRows,
	importOcrStub,
	saveMacroOverride,
} from "../../helpers/lineage";

const extractionResponseSchema = z.object({ extractionId: z.string().optional() });
const errorCodeResponseSchema = z.object({ code: z.string().optional() });
const macroRowsResponseSchema = z.object({
	rows: z.array(z.record(z.unknown())).optional(),
	overrideSummary: z
		.object({
			appliedStable: z.number().optional(),
			conflicts: z.number().optional(),
		})
		.optional(),
});
const conflictResponseSchema = z.object({
	code: z.string().optional(),
	conflicts: z
		.array(z.object({ candidateOverrideIds: z.array(z.string()).optional() }))
		.optional(),
});

function hasErrorCode(value: unknown, errorCode: string) {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		"errorCode" in value &&
		value.errorCode === errorCode
	);
}

// The application routes and persistence are real; OCR extraction and storage upload
// are deterministic provider-boundary stubs supplied by the import helper.
test.describe("Ticket 1.1 lineage evidence", () => {
	test("reimport preserves stable identity, increments version and avoids unexpected duplicates", async ({
		request,
		scenario,
	}) => {
		const fixture = await scenario.lineage.createSingle("Reimport");

		const firstImport = await importOcrStub(request, fixture, {
			docKey: "reimport-doc",
			extraction: {
				items: [
					{ item_code: "ITEM-REIMPORT", description: "Primera version", amount: 100 },
				],
			},
		});
		expect(firstImport.ok()).toBeTruthy();
		const firstPayload = extractionResponseSchema.parse(await firstImport.json());

		const firstRows = await fetchTablaRows(request, fixture);
		expect(firstRows).toHaveLength(1);
		const firstLineageRowKey = String(firstRows[0].lineage_row_key ?? "");
		const firstMaterializationVersion = Number(firstRows[0].materialization_version ?? 0);
		expect(firstLineageRowKey).not.toBe("");
		expect(firstMaterializationVersion).toBe(1);
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
		const secondPayload = extractionResponseSchema.parse(await secondImport.json());

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

	test("manual override survives reimport with stable binding", async ({ request, scenario }) => {
		const fixture = await scenario.lineage.createSingle("Override");

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
		const parsedMacroPayload = macroRowsResponseSchema.parse(macroPayload);
		const macroRows = parsedMacroPayload.rows ?? [];
		expect(macroRows).toHaveLength(1);
		expect(macroRows[0][fixture.macroCustomColumnId]).toBe("observacion manual");
		expect(parsedMacroPayload.overrideSummary).toMatchObject({
			appliedStable: expect.any(Number),
			conflicts: 0,
		});
		expect(parsedMacroPayload.overrideSummary?.appliedStable ?? 0).toBeGreaterThan(0);
	});

	test("OCR conflict returns LINEAGE_RECONCILIATION_CONFLICT and persists explicit error_code", async ({
		request,
		scenario,
	}) => {
		const fixture = await scenario.lineage.createSingle("OcrConflict");

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
		const payload = errorCodeResponseSchema.parse(await response.json());
		expect(payload.code).toBe("LINEAGE_RECONCILIATION_CONFLICT");

		const owner = await scenario.actor("owner");
		const { data: processing, error: processingError } = await owner.db
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
		scenario,
	}) => {
		const fixture = await scenario.lineage.createSingle("DownstreamConflict");

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

		await scenario.lineage.injectLegacyConflict(fixture, {
			lineageRowKey,
			value: "legacy conflict",
		});

		const conflictResponse = await saveMacroOverride(
			request,
			fixture,
			rowId,
			"valor conflictivo",
		);
		expect(conflictResponse.status()).toBe(409);
		const payload = conflictResponseSchema.parse(await conflictResponse.json());
		expect(payload.code).toBe("LINEAGE_OVERRIDE_REATTACH_CONFLICT");
		expect(Array.isArray(payload.conflicts)).toBeTruthy();

		const candidateIds = new Set(
			(payload.conflicts ?? []).flatMap((conflict) => conflict.candidateOverrideIds ?? []),
		);
		expect(candidateIds.size).toBeGreaterThan(0);

		const owner = await scenario.actor("owner");
		const { data: persistedConflicts, error: persistedConflictsError } = await owner.db
			.from("macro_table_custom_values")
			.select("binding_status, binding_error")
			.in("id", [...candidateIds]);
		expect(persistedConflictsError).toBeNull();
		expect((persistedConflicts ?? []).every((record) => record.binding_status === "conflict")).toBeTruthy();
		expect(
			(persistedConflicts ?? []).every((record) =>
				hasErrorCode(record.binding_error, "LINEAGE_OVERRIDE_REATTACH_CONFLICT"),
			),
		).toBeTruthy();
	});
});
