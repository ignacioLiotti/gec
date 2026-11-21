import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";

import { expect, test, type Actor, type Scenario } from "../fixtures/test";
import { withRegisteredOcrProviderFixture, type OcrProviderFixtureState } from "../helpers/ocr-provider";
import { uploadedDocumentFixtures, type DocumentFileFixture } from "./files-and-extraction-fixtures";

const uploadResponseSchema = z.object({
	ok: z.literal(true),
	bucket: z.literal("obra-documents"),
	path: z.string().min(1),
	fileName: z.string().min(1),
	uploadedBytes: z.number().int().positive(),
});
const importResponseSchema = z.object({
	ok: z.literal(true),
	inserted: z.literal(2),
	extractionId: z.string().uuid(),
	perTable: z.array(z.object({
		tablaId: z.string().uuid(),
		inserted: z.literal(2),
	})),
});
const singleImportResponseSchema = z.object({
	ok: z.literal(true),
	inserted: z.literal(2),
	extractionId: z.string().uuid(),
});
const tableSettingsSchema = z.object({
	ocrFolder: z.string().min(1),
}).passthrough();
const rowSchema = z.object({
	id: z.string().uuid(),
	lineage_row_key: z.string().min(1),
	extraction_id: z.string().uuid(),
	materialization_version: z.number().int().positive(),
	data: z.record(z.unknown()),
	source: z.literal("ocr"),
});
const processingSchema = z.object({
	status: z.enum(["failed", "completed"]),
	error_code: z.string().nullable(),
	rows_extracted: z.number().int().nullable(),
	extraction_id: z.string().uuid().nullable(),
	file_fingerprint: z.string().nullable(),
	content_fingerprint_normalized: z.string().nullable(),
	fingerprint_status: z.string(),
});

const expectedItems = [
	{ item_code: "QA-001", description: "Transport verified", amount: 1250.5 },
	{ item_code: "QA-002", description: "Second persisted item", amount: 99 },
];

type StoredUpload = z.infer<typeof uploadResponseSchema>;

async function uploadSource(args: {
	request: APIRequestContext;
	obraId: string;
	folderPath: string;
	source: DocumentFileFixture;
}) {
	const response = await args.request.post(`/api/obras/${args.obraId}/documents/upload`, {
		multipart: {
			folderPath: args.folderPath,
			file: {
				name: args.source.name,
				mimeType: args.source.mimeType,
				buffer: args.source.buffer,
			},
		},
	});
	expect(response.status()).toBe(200);
	return uploadResponseSchema.parse(await response.json());
}

function ocrMultipart(tablaId: string, upload: StoredUpload) {
	return {
		tablaIds: JSON.stringify([tablaId]),
		existingBucket: "obra-documents",
		existingPath: upload.path,
		existingFileName: upload.fileName,
	};
}

async function importStoredSource(request: APIRequestContext, obraId: string, tablaId: string, upload: StoredUpload) {
	return request.post(`/api/obras/${obraId}/tablas/import/ocr-multi`, {
		multipart: ocrMultipart(tablaId, upload),
	});
}

async function importSingleStoredSource(request: APIRequestContext, obraId: string, tablaId: string, upload: StoredUpload) {
	return request.post(`/api/obras/${obraId}/tablas/${tablaId}/import/ocr`, {
		multipart: {
			existingBucket: "obra-documents",
			existingPath: upload.path,
			existingFileName: upload.fileName,
		},
	});
}

async function readRows(actor: Actor, tablaId: string) {
	const { data, error } = await actor.db
		.from("obra_tabla_rows")
		.select("id, lineage_row_key, extraction_id, materialization_version, data, source")
		.eq("tabla_id", tablaId);
	expect(error).toBeNull();
	return z.array(rowSchema).parse(data ?? []).sort((left, right) =>
		String(left.data.item_code).localeCompare(String(right.data.item_code))
	);
}

async function readProcessing(actor: Actor, tablaId: string, sourcePath: string) {
	const { data, error } = await actor.db
		.from("ocr_document_processing")
		.select("status, error_code, rows_extracted, extraction_id, file_fingerprint, content_fingerprint_normalized, fingerprint_status")
		.eq("tabla_id", tablaId)
		.eq("source_path", sourcePath)
		.maybeSingle();
	expect(error).toBeNull();
	return data ? processingSchema.parse(data) : null;
}

async function assertForeignBoundary(args: {
	foreign: Actor;
	obraId: string;
	tablaId: string;
	upload: StoredUpload;
}) {
	const response = await importStoredSource(
		args.foreign.request,
		args.obraId,
		args.tablaId,
		args.upload,
	);
	expect(response.status()).toBe(404);
	expect(await readRows(args.foreign, args.tablaId)).toEqual([]);
	expect(await readProcessing(args.foreign, args.tablaId, args.upload.path)).toBeNull();
	const storage = await args.foreign.db.storage.from("obra-documents").download(args.upload.path);
	expect(storage.data).toBeNull();
	expect(storage.error).not.toBeNull();
}

function expectProviderRequests(args: {
	state: OcrProviderFixtureState;
	count: number;
	sourceHash: string;
	source: DocumentFileFixture;
}) {
	expect(args.state.remainingFailures).toBe(0);
	expect(args.state.requests).toHaveLength(args.count);
	const promptHash = args.state.requests[0]?.promptHash;
	expect(promptHash).toMatch(/^[a-f0-9]{64}$/);
	expect(args.state.requests).toEqual(
		Array.from({ length: args.count }, (_, index) => ({
			sourceHash: args.sourceHash,
			mimeType: args.source.mimeType,
			bytes: args.source.buffer.byteLength,
			modelPath: expect.stringMatching(
				/^\/google\/v1beta\/models\/[A-Za-z0-9_.-]+:generateContent$/,
			),
			attempt: index + 1,
			promptHash,
		})),
	);
}

async function prepareJourney(scenario: Scenario, source: DocumentFileFixture, label: string) {
	const owner = await scenario.actor("owner");
	const foreign = await scenario.actor("otherOwner");
	const lineage = await scenario.lineage.createSingle(label);
	const { data: table, error } = await owner.db
		.from("obra_tablas")
		.select("settings")
		.eq("id", lineage.tablaId)
		.single();
	expect(error).toBeNull();
	const settings = tableSettingsSchema.parse(table?.settings);
	const upload = await uploadSource({
		request: owner.request,
		obraId: lineage.obraId,
		folderPath: `${lineage.obraId}/${settings.ocrFolder}`,
		source,
	});
	const stored = await owner.db.storage.from("obra-documents").download(upload.path);
	expect(stored.error).toBeNull();
	if (!stored.data) throw new Error(`Owner could not read uploaded OCR source ${upload.path}.`);
	expect(Buffer.from(await stored.data.arrayBuffer()).equals(source.buffer)).toBe(true);
	return { owner, foreign, lineage, upload };
}

function expectPersistedItems(rows: Awaited<ReturnType<typeof readRows>>, sourcePath: string) {
	expect(rows).toHaveLength(2);
	expect(rows.map((row) => row.data)).toEqual(expectedItems.map((item) => ({
		...item,
		__docBucket: "obra-documents",
		__docPath: sourcePath,
		__docFileName: expect.any(String),
	})));
}

test.describe.configure({ timeout: 180_000 });

test("retries a real PNG OCR provider outage and reimports with stable persisted identity", async ({ scenario }) => {
	const source = uploadedDocumentFixtures.find((fixture) => fixture.mimeType === "image/png");
	if (!source) throw new Error("The PNG document fixture is missing.");
	const journey = await prepareJourney(scenario, source, "Provider PNG retry");

	await withRegisteredOcrProviderFixture({
		namespace: `${scenario.namespace}-png-provider`,
		source,
		failures: 1,
		extraction: { tables: { [journey.lineage.tablaId]: { items: expectedItems } } },
	}, async (provider) => {
		await assertForeignBoundary({ ...journey, obraId: journey.lineage.obraId, tablaId: journey.lineage.tablaId });
		expect((await provider.read()).requests).toHaveLength(0);

		const failed = await importStoredSource(
			journey.owner.request,
			journey.lineage.obraId,
			journey.lineage.tablaId,
			journey.upload,
		);
		expect(failed.status()).toBe(503);
		await expect(failed.json()).resolves.toMatchObject({ code: "OCR_PROVIDER_UNAVAILABLE" });
		expect(await readRows(journey.owner, journey.lineage.tablaId)).toEqual([]);
		expect(await readProcessing(journey.owner, journey.lineage.tablaId, journey.upload.path)).toMatchObject({
			status: "failed",
			error_code: "OCR_PROVIDER_UNAVAILABLE",
		});

		const retry = await importStoredSource(
			journey.owner.request,
			journey.lineage.obraId,
			journey.lineage.tablaId,
			journey.upload,
		);
		expect(retry.status()).toBe(200);
		importResponseSchema.parse(await retry.json());
		const firstRows = await readRows(journey.owner, journey.lineage.tablaId);
		expectPersistedItems(firstRows, journey.upload.path);
		const completed = await readProcessing(journey.owner, journey.lineage.tablaId, journey.upload.path);
		expect(completed).toMatchObject({
			status: "completed",
			error_code: null,
			rows_extracted: 2,
			file_fingerprint: `sha256:${provider.sourceHash}`,
			fingerprint_status: "completed",
		});
		expect(completed?.content_fingerprint_normalized).toMatch(/^sha256:[a-f0-9]{64}$/);

		const reimport = await importStoredSource(
			journey.owner.request,
			journey.lineage.obraId,
			journey.lineage.tablaId,
			journey.upload,
		);
		expect(reimport.status()).toBe(200);
		importResponseSchema.parse(await reimport.json());
		const reimportedRows = await readRows(journey.owner, journey.lineage.tablaId);
		expectPersistedItems(reimportedRows, journey.upload.path);
		expect(reimportedRows.map((row) => row.id)).toEqual(firstRows.map((row) => row.id));
		expect(reimportedRows.map((row) => row.materialization_version)).toEqual(
			firstRows.map((row) => row.materialization_version + 1),
		);

		expectProviderRequests({ state: await provider.read(), count: 3, sourceHash: provider.sourceHash, source });
		await assertForeignBoundary({ ...journey, obraId: journey.lineage.obraId, tablaId: journey.lineage.tablaId });
		expectProviderRequests({ state: await provider.read(), count: 3, sourceHash: provider.sourceHash, source });
	});
});

test("retries a real single-table PDF provider outage and persists the extracted rows", async ({ scenario }) => {
	const source = uploadedDocumentFixtures.find((fixture) => fixture.mimeType === "application/pdf");
	if (!source) throw new Error("The PDF document fixture is missing.");
	const journey = await prepareJourney(scenario, source, "Provider single PDF retry");

	await withRegisteredOcrProviderFixture({
		namespace: `${scenario.namespace}-single-pdf-provider`,
		source,
		failures: 1,
		extraction: { items: expectedItems },
	}, async (provider) => {
		const failed = await importSingleStoredSource(
			journey.owner.request,
			journey.lineage.obraId,
			journey.lineage.tablaId,
			journey.upload,
		);
		expect(failed.status()).toBe(503);
		await expect(failed.json()).resolves.toMatchObject({ code: "OCR_PROVIDER_UNAVAILABLE" });
		expect(await readRows(journey.owner, journey.lineage.tablaId)).toEqual([]);
		expect(await readProcessing(journey.owner, journey.lineage.tablaId, journey.upload.path)).toMatchObject({
			status: "failed",
			error_code: "OCR_PROVIDER_UNAVAILABLE",
		});

		const retry = await importSingleStoredSource(
			journey.owner.request,
			journey.lineage.obraId,
			journey.lineage.tablaId,
			journey.upload,
		);
		expect(retry.status()).toBe(200);
		singleImportResponseSchema.parse(await retry.json());
		expectPersistedItems(await readRows(journey.owner, journey.lineage.tablaId), journey.upload.path);
		const completed = await readProcessing(journey.owner, journey.lineage.tablaId, journey.upload.path);
		expect(completed).toMatchObject({
			status: "completed",
			error_code: null,
			rows_extracted: 2,
			file_fingerprint: `sha256:${provider.sourceHash}`,
			fingerprint_status: "completed",
		});
		expect(completed?.content_fingerprint_normalized).toMatch(/^sha256:[a-f0-9]{64}$/);
		expectProviderRequests({ state: await provider.read(), count: 2, sourceHash: provider.sourceHash, source });
	});
});

test("imports and reimports a stored PDF through the real OCR provider boundary", async ({ scenario }) => {
	const source = uploadedDocumentFixtures.find((fixture) => fixture.mimeType === "application/pdf");
	if (!source) throw new Error("The PDF document fixture is missing.");
	const journey = await prepareJourney(scenario, source, "Provider PDF persistence");

	await withRegisteredOcrProviderFixture({
		namespace: `${scenario.namespace}-pdf-provider`,
		source,
		extraction: { tables: { [journey.lineage.tablaId]: { items: expectedItems } } },
	}, async (provider) => {
		await assertForeignBoundary({ ...journey, obraId: journey.lineage.obraId, tablaId: journey.lineage.tablaId });
		expect((await provider.read()).requests).toHaveLength(0);

		const firstImport = await importStoredSource(
			journey.owner.request,
			journey.lineage.obraId,
			journey.lineage.tablaId,
			journey.upload,
		);
		expect(firstImport.status()).toBe(200);
		importResponseSchema.parse(await firstImport.json());
		const firstRows = await readRows(journey.owner, journey.lineage.tablaId);
		expectPersistedItems(firstRows, journey.upload.path);

		const secondImport = await importStoredSource(
			journey.owner.request,
			journey.lineage.obraId,
			journey.lineage.tablaId,
			journey.upload,
		);
		expect(secondImport.status()).toBe(200);
		importResponseSchema.parse(await secondImport.json());
		const secondRows = await readRows(journey.owner, journey.lineage.tablaId);
		expectPersistedItems(secondRows, journey.upload.path);
		expect(secondRows.map((row) => row.id)).toEqual(firstRows.map((row) => row.id));
		expect(secondRows.map((row) => row.materialization_version)).toEqual(
			firstRows.map((row) => row.materialization_version + 1),
		);
		const processing = await readProcessing(journey.owner, journey.lineage.tablaId, journey.upload.path);
		expect(processing).toMatchObject({
			status: "completed",
			error_code: null,
			rows_extracted: 2,
			file_fingerprint: `sha256:${provider.sourceHash}`,
			fingerprint_status: "completed",
		});
		expect(processing?.content_fingerprint_normalized).toMatch(/^sha256:[a-f0-9]{64}$/);

		expectProviderRequests({ state: await provider.read(), count: 2, sourceHash: provider.sourceHash, source });
		await assertForeignBoundary({ ...journey, obraId: journey.lineage.obraId, tablaId: journey.lineage.tablaId });
		expectProviderRequests({ state: await provider.read(), count: 2, sourceHash: provider.sourceHash, source });
	});
});
