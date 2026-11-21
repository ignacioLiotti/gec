import { randomUUID } from "node:crypto";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { z } from "zod";

import {
	expect,
	test,
	type Actor,
} from "../fixtures/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
} from "../helpers/obras";
import {
	createUploadedDocumentFixtures,
	expectedDocxText,
	invalidSpreadsheetFixture,
	readDocxDocumentXml,
	spreadsheetFixture,
	type DocumentFileFixture,
	uploadedDocumentFixtures,
} from "./files-and-extraction-fixtures";

const uploadResponseSchema = z.object({
	ok: z.literal(true),
	bucket: z.literal("obra-documents"),
	path: z.string().min(1),
	fileName: z.string().min(1),
	uploadedBytes: z.number().nonnegative(),
});

const tablaSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	sourceType: z.string(),
	settings: z.record(z.unknown()),
	rowCount: z.number(),
	columns: z.array(z.object({
		fieldKey: z.string(),
		label: z.string(),
		dataType: z.string(),
		required: z.boolean(),
	})),
});

const tablasResponseSchema = z.object({
	tablas: z.array(tablaSchema),
});

const persistedRowSchema = z.object({
	id: z.string().uuid(),
	data: z.record(z.unknown()),
	source: z.string().nullable().optional(),
	lineage_row_key: z.string().nullable().optional(),
	extraction_id: z.string().nullable().optional(),
});

const rowsResponseSchema = z.object({
	rows: z.array(persistedRowSchema),
});

const spreadsheetImportResponseSchema = z.object({
	ok: z.literal(true),
	preview: z.boolean(),
	inserted: z.number().nonnegative(),
	perTable: z.array(z.object({
		tablaId: z.string().uuid(),
		inserted: z.number().nonnegative(),
		previewRows: z.array(z.record(z.unknown())).optional(),
	})),
});

const pipelineResponseSchema = z.object({
	folder: z.object({
		path: z.string(),
		label: z.string(),
	}),
	config: z.object({
		dataInputMethod: z.enum(["ocr", "manual", "both"]),
		spreadsheetTemplate: z.string().nullable(),
		targetTablaIds: z.array(z.string().uuid()),
	}),
	tables: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});

const treeNodeBoundarySchema = z.object({
	type: z.enum(["folder", "file"]),
	name: z.string(),
	storagePath: z.string().optional(),
	children: z.array(z.unknown()).optional(),
});

const treeResponseBoundarySchema = z.object({
	tree: z.unknown(),
});

type ParsedTreeNode = {
	type: "folder" | "file";
	name: string;
	storagePath?: string;
	children: ParsedTreeNode[];
};

const defaultFolderLabel = "Documentos E2E";

function parseTreeNode(value: unknown): ParsedTreeNode {
	const parsed = treeNodeBoundarySchema.parse(value);
	return {
		type: parsed.type,
		name: parsed.name,
		...(parsed.storagePath ? { storagePath: parsed.storagePath } : {}),
		children: (parsed.children ?? []).map(parseTreeNode),
	};
}

function collectStoragePaths(node: ParsedTreeNode): string[] {
	return [
		...(node.storagePath ? [node.storagePath] : []),
		...node.children.flatMap(collectStoragePaths),
	];
}

async function openDocuments(page: Page, obraId: string) {
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	await page.goto(`/excel/${obraId}?tab=documentos`);
	await expect(page.getByRole("heading", { name: "Todos los documentos", exact: true })).toBeVisible();
}

function exactVisibleLabel(label: string) {
	return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

async function openNestedFolderCreation(page: Page, parentLabel: string, kind: "normal" | "data") {
	await page.getByRole("button", { name: exactVisibleLabel(parentLabel) }).click({ button: "right" });
	await page.getByRole("button", {
		name: kind === "data" ? "Crear carpeta de datos" : "Crear carpeta",
		exact: true,
	}).click();
}

async function enterNestedFolder(page: Page, parentLabel: string, folderLabel: string) {
	await page.getByRole("button", { name: exactVisibleLabel(parentLabel) }).click();
	await page.getByRole("button", { name: exactVisibleLabel(folderLabel) }).click();
}

async function seedNormalParentFolder(actor: Actor, obraId: string, label: string) {
	const path = label.toLowerCase().replaceAll(" ", "-");
	const markerPath = `${obraId}/${path}/.keep`;
	const result = await actor.db.storage
		.from("obra-documents")
		.upload(markerPath, Buffer.alloc(0), { contentType: "text/plain", upsert: false });
	expect(result.error).toBeNull();
	return { label, path };
}

async function uploadViaDocumentsRoute(args: {
	request: APIRequestContext;
	obraId: string;
	folderPath: string;
	fixture: DocumentFileFixture;
}) {
	const response = await args.request.post(
		`/api/obras/${args.obraId}/documents/upload`,
		{
			multipart: {
				folderPath: args.folderPath,
				file: {
					name: args.fixture.name,
					mimeType: args.fixture.mimeType,
					buffer: args.fixture.buffer,
				},
			},
		},
	);
	expect(response.status()).toBe(200);
	return uploadResponseSchema.parse(await response.json());
}

async function expectStoredBytes(args: {
	actor: Actor;
	storagePath: string;
	expected: Buffer;
}) {
	const downloaded = await args.actor.db.storage
		.from("obra-documents")
		.download(args.storagePath);
	expect(downloaded.error).toBeNull();
	if (!downloaded.data) {
		throw new Error(`Storage returned no bytes for ${args.storagePath}`);
	}
	const bytes = Buffer.from(await downloaded.data.arrayBuffer());
	expect(bytes.equals(args.expected)).toBe(true);
	return bytes;
}

async function readTablas(request: APIRequestContext, obraId: string) {
	const response = await request.get(`/api/obras/${obraId}/tablas`);
	expect(response.status()).toBe(200);
	return tablasResponseSchema.parse(await response.json()).tablas;
}

async function snapshotObraWriteSurfaces(actor: Actor, obraId: string) {
	const treeResponse = await actor.request.get(`/api/obras/${obraId}/documents-tree`);
	expect(treeResponse.status()).toBe(200);
	const treeBoundary = treeResponseBoundarySchema.parse(await treeResponse.json());
	const storageList = await actor.db.storage
		.from("obra-documents")
		.list(obraId, { limit: 100, sortBy: { column: "name", order: "asc" } });
	expect(storageList.error).toBeNull();
	const uploadMetadata = await actor.db
		.from("obra_document_uploads")
		.select("storage_path, file_name")
		.eq("obra_id", obraId)
		.order("storage_path", { ascending: true });
	expect(uploadMetadata.error).toBeNull();
	const tablas = await readTablas(actor.request, obraId);
	return {
		treePaths: collectStoragePaths(parseTreeNode(treeBoundary.tree)).sort(),
		storageEntries: (storageList.data ?? []).map((entry) => ({ id: entry.id, name: entry.name })),
		uploadMetadata: uploadMetadata.data ?? [],
		tableCounts: tablas.map((tabla) => ({ id: tabla.id, rowCount: tabla.rowCount })),
	};
}

async function closeContext(context: BrowserContext) {
	await context.close();
}

test.describe.configure({ timeout: 120_000 });

test("creates an extraction folder in the UI and recovers its schema in a fresh session", async ({
	page,
	scenario,
}, testInfo) => {
	const owner = await scenario.actor("owner");
	const otherOwner = await scenario.actor("otherOwner");
	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: buildExcelObraName(`${scenario.namespace} extraction folder`),
	});
	const parent = await seedNormalParentFolder(
		owner,
		obra.id,
		`QA parent extraction ${scenario.namespace.slice(-8)}`,
	);
	const folderLabel = `QA extraction ${scenario.namespace.slice(-8)}`;
	const folderSlug = folderLabel.toLowerCase().replaceAll(" ", "-");
	const folderPath = `${parent.path}/${folderSlug}`;

	await openDocuments(page, obra.id);
	await openNestedFolderCreation(page, parent.label, "data");

	const dialog = page.getByRole("dialog", { name: "Nueva carpeta de datos" });
	await dialog.getByLabel("Nombre de la carpeta").fill(folderLabel);
	await dialog.getByLabel("Solo manual").click();
	await dialog.getByRole("combobox").first().click();
	await page.getByRole("option", { name: "Auto (detectar por columnas)" }).click();
	await dialog.getByPlaceholder("Nombre").fill("Código externo");
	await dialog.getByPlaceholder("Contexto u objetivo de la tabla (opcional)").fill(
		"Deterministic extraction-folder persistence check",
	);
	await dialog.getByRole("button", { name: "Crear carpeta de datos", exact: true }).click();
	await expect(dialog).toBeHidden();

	await expect.poll(async () => {
		const tablas = await readTablas(owner.request, obra.id);
		return tablas.some((tabla) => tabla.name === folderLabel);
	}).toBe(true);

	const freshContext = await scenario.newContext("owner");
	try {
		const freshTablas = await readTablas(freshContext.request, obra.id);
		const persisted = freshTablas.find((tabla) => tabla.name === folderLabel);
		expect(persisted).toMatchObject({
			name: folderLabel,
			sourceType: "ocr",
			rowCount: 0,
			columns: [
				{
					fieldKey: "codigo_externo",
					label: "Código externo",
					dataType: "text",
				},
			],
		});
		expect(persisted?.settings).toMatchObject({
			ocrFolder: folderPath,
			dataInputMethod: "manual",
			spreadsheetTemplate: "auto",
		});

		const pipelineResponse = await freshContext.request.get(
			`/api/obras/${obra.id}/folders/extraction-pipeline?folderPath=${encodeURIComponent(folderPath)}`,
		);
		expect(pipelineResponse.status()).toBe(200);
		const pipeline = pipelineResponseSchema.parse(await pipelineResponse.json());
		expect(pipeline).toMatchObject({
			folder: { path: folderPath, label: folderSlug },
			config: { dataInputMethod: "manual", spreadsheetTemplate: "auto" },
		});
		expect(pipeline.config.targetTablaIds).toContain(persisted?.id);

		const markerPath = `${obra.id}/${folderPath}/.keep`;
		await expectStoredBytes({ actor: owner, storagePath: markerPath, expected: Buffer.alloc(0) });
		const foreignPipeline = await otherOwner.request.get(
			`/api/obras/${obra.id}/folders/extraction-pipeline?folderPath=${encodeURIComponent(folderPath)}`,
		);
		expect(foreignPipeline.status()).toBe(404);

		const freshPage = await freshContext.newPage();
		await openDocuments(freshPage, obra.id);
		await enterNestedFolder(freshPage, parent.label, folderSlug);
		await expect(freshPage.getByRole("heading", { name: folderSlug, exact: true })).toBeVisible();
		await freshPage.screenshot({
			path: testInfo.outputPath("extraction-folder-fresh-session.png"),
			fullPage: true,
		});
	} finally {
		await closeContext(freshContext);
	}
});

test("uploads image, PDF, DOCX and text bytes through the UI, then reloads them while a foreign tenant stays denied", async ({
	page,
	scenario,
}, testInfo) => {
	const owner = await scenario.actor("owner");
	const otherOwner = await scenario.actor("otherOwner");
	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: buildExcelObraName(`${scenario.namespace} file bytes`),
	});
	const parent = await seedNormalParentFolder(
		owner,
		obra.id,
		`QA parent uploads ${scenario.namespace.slice(-8)}`,
	);
	const folderLabel = `Upload recovery ${scenario.namespace.slice(-8)}`;
	const folderSlug = folderLabel.toLowerCase().replaceAll(" ", "-");
	const folderPath = `${parent.path}/${folderSlug}`;
	const uploadFixtures = await createUploadedDocumentFixtures();
	const docxFixture = uploadFixtures.find((fixture) => fixture.name.endsWith(".docx"));
	if (!docxFixture) throw new Error("The upload fixture set has no DOCX document.");

	const invalidFolderPath = `${randomUUID()}/outside-owned-obra`;
	const beforeRejectedUpload = await snapshotObraWriteSurfaces(owner, obra.id);
	const rejected = await owner.request.post(`/api/obras/${obra.id}/documents/upload`, {
		multipart: {
			folderPath: invalidFolderPath,
			file: {
				name: uploadedDocumentFixtures[0].name,
				mimeType: uploadedDocumentFixtures[0].mimeType,
				buffer: uploadedDocumentFixtures[0].buffer,
			},
		},
	});
	expect(rejected.status()).toBe(400);
	await expect(rejected.json()).resolves.toMatchObject({
		error: "La carpeta destino no pertenece a la obra.",
	});
	expect(await snapshotObraWriteSurfaces(owner, obra.id)).toEqual(beforeRejectedUpload);

	await openDocuments(page, obra.id);
	await openNestedFolderCreation(page, parent.label, "normal");
	const folderDialog = page.getByRole("dialog", { name: "Nueva carpeta", exact: true });
	await folderDialog.getByLabel("Nombre de la carpeta").fill(folderLabel);
	await folderDialog.getByRole("button", { name: "Crear carpeta", exact: true }).click();
	await expect(folderDialog).toBeHidden();
	await enterNestedFolder(page, parent.label, folderLabel);
	await expect(page.getByText("Esta carpeta está vacía.", { exact: true })).toBeVisible();
	const fileChooserPromise = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "Subir archivos", exact: true }).click();
	const fileChooser = await fileChooserPromise;
	await fileChooser.setFiles(uploadFixtures);
	for (const fixture of uploadFixtures) {
		await expect(page.getByText(fixture.name, { exact: true }).first()).toBeVisible();
		const storedBytes = await expectStoredBytes({
			actor: owner,
			storagePath: `${obra.id}/${folderPath}/${fixture.name}`,
			expected: fixture.buffer,
		});
		if (fixture === docxFixture) {
			expect(await readDocxDocumentXml(storedBytes)).toContain(expectedDocxText);
		}
	}
	await page.screenshot({
		path: testInfo.outputPath("uploaded-files-current-session.png"),
		fullPage: true,
	});

	const freshContext = await scenario.newContext("owner");
	try {
		const rootListResponse = await freshContext.request.get(
			`/api/obras/${obra.id}/documents/list`,
		);
		expect(rootListResponse.status()).toBe(200);
		const rootTree = treeResponseBoundarySchema.parse(await rootListResponse.json());
		expect(collectStoragePaths(parseTreeNode(rootTree.tree))).toContain(
			`${obra.id}/${parent.path}`,
		);
		const parentListResponse = await freshContext.request.get(
			`/api/obras/${obra.id}/documents/list?path=${encodeURIComponent(parent.path)}`,
		);
		expect(parentListResponse.status()).toBe(200);
		const parentTree = treeResponseBoundarySchema.parse(await parentListResponse.json());
		expect(collectStoragePaths(parseTreeNode(parentTree.tree))).toContain(
			`${obra.id}/${folderPath}`,
		);
		const folderListResponse = await freshContext.request.get(
			`/api/obras/${obra.id}/documents/list?path=${encodeURIComponent(folderPath)}`,
		);
		expect(folderListResponse.status()).toBe(200);
		const folderTree = treeResponseBoundarySchema.parse(await folderListResponse.json());
		const storagePaths = collectStoragePaths(parseTreeNode(folderTree.tree));
		for (const fixture of uploadFixtures) {
			expect(storagePaths).toContain(`${obra.id}/${folderPath}/${fixture.name}`);
		}

		const freshPage = await freshContext.newPage();
		await openDocuments(freshPage, obra.id);
		await enterNestedFolder(freshPage, parent.label, folderLabel);
		for (const fixture of uploadFixtures) {
			await expect(freshPage.getByText(fixture.name, { exact: true }).first()).toBeVisible();
		}
		await freshPage.screenshot({
			path: testInfo.outputPath("uploaded-files-fresh-session.png"),
			fullPage: true,
		});
	} finally {
		await closeContext(freshContext);
	}

	const protectedPath = `${obra.id}/${folderPath}/${uploadedDocumentFixtures[1].name}`;
	const ownerDownload = await owner.request.get(
		`/api/obras/${obra.id}/documents/access?download=1&path=${encodeURIComponent(protectedPath)}`,
	);
	expect(ownerDownload.status()).toBe(200);
	expect(Buffer.from(await ownerDownload.body()).equals(uploadedDocumentFixtures[1].buffer)).toBe(true);
	const docxPath = `${obra.id}/${folderPath}/${docxFixture.name}`;
	const docxDownload = await owner.request.get(
		`/api/obras/${obra.id}/documents/access?download=1&path=${encodeURIComponent(docxPath)}`,
	);
	expect(docxDownload.status()).toBe(200);
	const downloadedDocxBytes = Buffer.from(await docxDownload.body());
	expect(downloadedDocxBytes.equals(docxFixture.buffer)).toBe(true);
	expect(await readDocxDocumentXml(downloadedDocxBytes)).toContain(expectedDocxText);

	const foreignDownload = await otherOwner.request.get(
		`/api/obras/${obra.id}/documents/access?download=1&path=${encodeURIComponent(protectedPath)}`,
	);
	expect(foreignDownload.status()).toBe(404);
	const foreignStorage = await otherOwner.db.storage
		.from("obra-documents")
		.download(protectedPath);
	expect(foreignStorage.data).toBeNull();
	expect(foreignStorage.error).not.toBeNull();
	const foreignUpload = await otherOwner.request.post(
		`/api/obras/${obra.id}/documents/upload`,
		{
			multipart: {
				folderPath: obra.id,
				file: {
					name: "foreign-write.txt",
					mimeType: "text/plain",
					buffer: Buffer.from("foreign write must not persist", "utf8"),
				},
			},
		},
	);
	expect(foreignUpload.status()).toBe(404);
});

test("parses a stored CSV through the real spreadsheet route and persists extracted rows after an invalid-source recovery", async ({
	scenario,
}, testInfo) => {
	const owner = await scenario.actor("owner");
	const otherOwner = await scenario.actor("otherOwner");
	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: buildExcelObraName(`${scenario.namespace} spreadsheet parsing`),
	});
	const tablas = await readTablas(owner.request, obra.id);
	const extractionTabla = tablas.find((tabla) =>
		tabla.columns.some((column) => column.fieldKey === "item_code") &&
		tabla.columns.some((column) => column.fieldKey === "amount"),
	);
	if (!extractionTabla) {
		throw new Error("The isolated obra did not materialize its deterministic extraction table.");
	}
	const folderSetting = extractionTabla.settings.ocrFolder;
	const folderPath = typeof folderSetting === "string" && folderSetting.length > 0
		? folderSetting
		: "documentos-e2e";
	const storageFolder = `${obra.id}/${folderPath}`;

	const invalidUpload = await uploadViaDocumentsRoute({
		request: owner.request,
		obraId: obra.id,
		folderPath: storageFolder,
		fixture: invalidSpreadsheetFixture,
	});
	await expectStoredBytes({
		actor: owner,
		storagePath: invalidUpload.path,
		expected: invalidSpreadsheetFixture.buffer,
	});
	const invalidImport = await owner.request.post(
		`/api/obras/${obra.id}/tablas/import/spreadsheet-multi`,
		{
			multipart: {
				tablaIds: JSON.stringify([extractionTabla.id]),
				existingBucket: "obra-documents",
				existingPath: invalidUpload.path,
				existingFileName: invalidUpload.fileName,
			},
		},
	);
	expect(invalidImport.status()).toBe(400);
	await expect(invalidImport.json()).resolves.toMatchObject({
		error: "El archivo no es CSV/XLSX/XLS.",
	});
	const rowsAfterRejectedImport = await owner.db
		.from("obra_tabla_rows")
		.select("id, data, source, lineage_row_key, extraction_id")
		.eq("tabla_id", extractionTabla.id);
	expect(rowsAfterRejectedImport.error).toBeNull();
	expect(rowsAfterRejectedImport.data).toEqual([]);

	const validUpload = await uploadViaDocumentsRoute({
		request: owner.request,
		obraId: obra.id,
		folderPath: storageFolder,
		fixture: spreadsheetFixture,
	});
	await expectStoredBytes({
		actor: owner,
		storagePath: validUpload.path,
		expected: spreadsheetFixture.buffer,
	});

	const importMultipart = {
		tablaIds: JSON.stringify([extractionTabla.id]),
		existingBucket: "obra-documents",
		existingPath: validUpload.path,
		existingFileName: validUpload.fileName,
	};
	const previewResponse = await owner.request.post(
		`/api/obras/${obra.id}/tablas/import/spreadsheet-multi?preview=1`,
		{ multipart: importMultipart },
	);
	expect(previewResponse.status()).toBe(200);
	const preview = spreadsheetImportResponseSchema.parse(await previewResponse.json());
	expect(preview.preview).toBe(true);
	expect(preview.inserted).toBe(2);
	expect(preview.perTable).toContainEqual(expect.objectContaining({
		tablaId: extractionTabla.id,
		inserted: 2,
	}));

	const importResponse = await owner.request.post(
		`/api/obras/${obra.id}/tablas/import/spreadsheet-multi`,
		{
			multipart: { ...importMultipart, replaceExisting: "true" },
		},
	);
	expect(importResponse.status()).toBe(200);
	const imported = spreadsheetImportResponseSchema.parse(await importResponse.json());
	expect(imported.preview).toBe(false);
	expect(imported.inserted).toBe(2);

	const freshContext = await scenario.newContext("owner");
	try {
		const rowsResponse = await freshContext.request.get(
			`/api/obras/${obra.id}/tablas/${extractionTabla.id}/rows`,
		);
		expect(rowsResponse.status()).toBe(200);
		const rows = rowsResponseSchema.parse(await rowsResponse.json()).rows;
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.data)).toEqual(expect.arrayContaining([
			expect.objectContaining({
				item_code: "ALFA-001",
				amount: 1250.5,
				__docPath: validUpload.path,
			}),
			expect.objectContaining({
				item_code: "BETA-002",
				amount: 99,
				__docPath: validUpload.path,
			}),
		]));
		expect(rows.every((row) => row.source === "spreadsheet")).toBe(true);
		expect(rows.every((row) => Boolean(row.lineage_row_key))).toBe(true);
		expect(rows.every((row) => Boolean(row.extraction_id))).toBe(true);

		const actorRowsResult = await owner.db
			.from("obra_tabla_rows")
			.select("id, data, source, lineage_row_key, extraction_id")
			.eq("tabla_id", extractionTabla.id);
		expect(actorRowsResult.error).toBeNull();
		const actorRows = z.array(persistedRowSchema).parse(actorRowsResult.data ?? []);
		expect(actorRows).toHaveLength(2);
		expect(actorRows.map((row) => row.data.item_code)).toEqual(
			expect.arrayContaining(["ALFA-001", "BETA-002"]),
		);

		const exactCountResult = await owner.db
			.from("obra_tabla_rows")
			.select("id", { head: true, count: "exact" })
			.eq("tabla_id", extractionTabla.id);
		expect(exactCountResult.error).toBeNull();
		expect(exactCountResult.count).toBe(2);
		const persistedTablas = await readTablas(freshContext.request, obra.id);
		const apiRowCount = persistedTablas.find((tabla) => tabla.id === extractionTabla.id)?.rowCount;
		await testInfo.attach("table-count-boundary", {
			body: Buffer.from(JSON.stringify({
				apiRowCount,
				exactCount: exactCountResult.count,
			}, null, 2)),
			contentType: "application/json",
		});
		expect(apiRowCount).toBe(2);

		const freshPage = await freshContext.newPage();
		await openDocuments(freshPage, obra.id);
		await freshPage.getByRole("button", { name: defaultFolderLabel, exact: true }).click();
		await freshPage.getByRole("button", { name: "Tabla", exact: true }).click();
		await expect(freshPage.getByText("ALFA-001", { exact: true }).first()).toBeVisible();
		await expect(freshPage.getByText("BETA-002", { exact: true }).first()).toBeVisible();
		await freshPage.screenshot({
			path: testInfo.outputPath("parsed-rows-fresh-session.png"),
			fullPage: true,
		});
	} finally {
		await closeContext(freshContext);
	}

	const foreignRows = await otherOwner.request.get(
		`/api/obras/${obra.id}/tablas/${extractionTabla.id}/rows`,
	);
	expect(foreignRows.status()).toBe(404);
	const foreignImport = await otherOwner.request.post(
		`/api/obras/${obra.id}/tablas/import/spreadsheet-multi`,
		{ multipart: importMultipart },
	);
	expect(foreignImport.status()).toBe(404);
	const foreignStorage = await otherOwner.db.storage
		.from("obra-documents")
		.download(validUpload.path);
	expect(foreignStorage.data).toBeNull();
	expect(foreignStorage.error).not.toBeNull();
});
