import { createHash } from "node:crypto";
import type { BrowserContext, Page, Response } from "@playwright/test";
import { z } from "zod";

import { expect, test, type Actor } from "../fixtures/test";
import { withRegisteredOcrProviderFixture } from "../helpers/ocr-provider";
import { uploadedDocumentFixtures } from "./files-and-extraction-fixtures";

const tableSettingsSchema = z.object({
	ocrFolder: z.string().min(1),
}).passthrough();

const persistedRowSchema = z.object({
	id: z.string().uuid(),
	data: z.record(z.unknown()),
	source: z.literal("ocr"),
	lineage_row_key: z.string().min(1),
	extraction_id: z.string().uuid(),
});

const processingSchema = z.object({
	status: z.enum(["failed", "completed"]),
	error_code: z.string().nullable(),
	error_message: z.string().nullable(),
	rows_extracted: z.number().int().nullable(),
	file_fingerprint: z.string().nullable(),
	fingerprint_status: z.string(),
});

const expectedItems = [
	{ item_code: "UI-001", description: "Visible recovery", amount: 42 },
	{ item_code: "UI-002", description: "Fresh session row", amount: 18 },
];

function exactVisibleLabel(label: string) {
	return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function folderDisplayLabel(folderPath: string) {
	return folderPath.split("/").at(-1)?.replace(/[-_]+/g, " ") ?? folderPath;
}

async function openDocuments(page: Page, obraId: string) {
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	await page.goto(`/excel/${obraId}?tab=documentos`);
	await expect(page.getByRole("heading", { name: "Todos los documentos", exact: true })).toBeVisible();
}

async function openFolder(page: Page, displayLabel: string) {
	await page.getByTitle(exactVisibleLabel(displayLabel)).first().click();
}

function isOcrImportResponse(response: Response, obraId: string) {
	const url = new URL(response.url());
	return response.request().method() === "POST" &&
		url.pathname === `/api/obras/${obraId}/tablas/import/ocr-multi` &&
		url.searchParams.get("skipStorage") === "1";
}

async function readRows(actor: Actor, tablaId: string) {
	const result = await actor.db
		.from("obra_tabla_rows")
		.select("id, data, source, lineage_row_key, extraction_id")
		.eq("tabla_id", tablaId)
		.order("lineage_row_key", { ascending: true });
	expect(result.error).toBeNull();
	return z.array(persistedRowSchema).parse(result.data ?? []).sort((left, right) =>
		String(left.data.item_code).localeCompare(String(right.data.item_code))
	);
}

async function readProcessing(actor: Actor, tablaId: string, sourcePath: string) {
	const result = await actor.db
		.from("ocr_document_processing")
		.select("status, error_code, error_message, rows_extracted, file_fingerprint, fingerprint_status")
		.eq("tabla_id", tablaId)
		.eq("source_path", sourcePath)
		.maybeSingle();
	expect(result.error).toBeNull();
	return result.data ? processingSchema.parse(result.data) : null;
}

async function closeContext(context: BrowserContext) {
	await context.close();
}

test.describe.configure({ timeout: 180_000 });

test("uploads a PNG, exposes a provider outage, retries from the document UI and recovers rows", async ({
	page,
	scenario,
}, testInfo) => {
	const source = uploadedDocumentFixtures.find((fixture) => fixture.mimeType === "image/png");
	if (!source) throw new Error("The deterministic PNG fixture is missing.");
	const owner = await scenario.actor("owner");
	const lineage = await scenario.lineage.createSingle("OCR visible retry");
	const tableResult = await owner.db
		.from("obra_tablas")
		.select("settings")
		.eq("id", lineage.tablaId)
		.single();
	expect(tableResult.error).toBeNull();
	const settings = tableSettingsSchema.parse(tableResult.data?.settings);
	const folderLabel = folderDisplayLabel(settings.ocrFolder);
	const storagePath = `${lineage.obraId}/${settings.ocrFolder}/${source.name}`;
	const providerFailureMessage =
		"El proveedor OCR no esta disponible temporalmente. Intenta de nuevo mas tarde.";

	await withRegisteredOcrProviderFixture({
		namespace: `${scenario.namespace}-ocr-visible-retry`,
		source,
		failures: 1,
		extraction: {
			tables: {
				[lineage.tablaId]: { items: expectedItems },
			},
		},
	}, async (provider) => {
		await openDocuments(page, lineage.obraId);
		await openFolder(page, folderLabel);
		await expect(page.getByText("Esta carpeta está vacía.", { exact: true })).toBeVisible();

		const firstImportResponse = page.waitForResponse((response) =>
			isOcrImportResponse(response, lineage.obraId)
		);
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: "Subir archivos", exact: true }).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles(source);
		expect((await firstImportResponse).status()).toBe(503);
		await expect(page.getByText(providerFailureMessage, { exact: true }).first()).toBeVisible();
		await expect(page.getByText(source.name, { exact: true }).first()).toBeVisible();

		expect(await readRows(owner, lineage.tablaId)).toEqual([]);
		await expect.poll(async () => readProcessing(owner, lineage.tablaId, storagePath)).toMatchObject({
			status: "failed",
			error_code: "OCR_PROVIDER_UNAVAILABLE",
			rows_extracted: 0,
		});
		const failedProcessing = await readProcessing(owner, lineage.tablaId, storagePath);
		expect(failedProcessing?.error_message).toBe(providerFailureMessage);
		const storedSource = await owner.db.storage.from("obra-documents").download(storagePath);
		expect(storedSource.error).toBeNull();
		if (!storedSource.data) throw new Error(`Storage returned no bytes for ${storagePath}.`);
		expect(Buffer.from(await storedSource.data.arrayBuffer()).equals(source.buffer)).toBe(true);
		expect((await provider.read()).requests).toHaveLength(1);
		await page.screenshot({
			path: testInfo.outputPath("ocr-provider-outage-visible.png"),
			fullPage: true,
		});

		await expect(page.getByText("Error OCR", { exact: true }).first()).toBeVisible();
		await page.getByRole("button").filter({ hasText: source.name }).first().click();
		await expect(page.getByRole("heading", { name: source.name, exact: true })).toBeVisible();
		await expect(page.getByText("La extraccion OCR fallo", { exact: true })).toBeVisible();
		await expect(page.getByText(providerFailureMessage, { exact: true }).first()).toBeVisible();

		const retryImportResponse = page.waitForResponse((response) =>
			isOcrImportResponse(response, lineage.obraId)
		);
		await page.getByRole("button", { name: "Reprocesar OCR", exact: true }).click();
		expect((await retryImportResponse).status()).toBe(200);
		await expect(page.getByText(/2 filas actualizadas\./).first()).toBeVisible();

		await expect.poll(async () => readRows(owner, lineage.tablaId)).toHaveLength(2);
		const persistedRows = await readRows(owner, lineage.tablaId);
		expect(persistedRows.map((row) => row.data)).toEqual(expectedItems.map((item) => ({
			...item,
			__docBucket: "obra-documents",
			__docPath: storagePath,
			__docFileName: source.name,
		})));
		expect(persistedRows.every((row) => row.source === "ocr")).toBe(true);
		const completedProcessing = await readProcessing(owner, lineage.tablaId, storagePath);
		expect(completedProcessing).toMatchObject({
			status: "completed",
			error_code: null,
			error_message: null,
			rows_extracted: 2,
			file_fingerprint: `sha256:${provider.sourceHash}`,
			fingerprint_status: "completed",
		});

		const providerState = await provider.read();
		expect(providerState.remainingFailures).toBe(0);
		expect(providerState.requests).toHaveLength(2);
		const promptHash = providerState.requests[0]?.promptHash;
		expect(promptHash).toMatch(/^[a-f0-9]{64}$/);
		expect(providerState.requests).toEqual([1, 2].map((attempt) => ({
			sourceHash: createHash("sha256").update(source.buffer).digest("hex"),
			mimeType: source.mimeType,
			bytes: source.buffer.byteLength,
			modelPath: expect.stringMatching(
				/^\/google\/v1beta\/models\/[A-Za-z0-9_.-]+:generateContent$/,
			),
			attempt,
			promptHash,
		})));

		const freshContext = await scenario.newContext("owner");
		try {
			const freshPage = await freshContext.newPage();
			await openDocuments(freshPage, lineage.obraId);
			await openFolder(freshPage, folderLabel);
			await freshPage.getByRole("button", { name: "Tabla", exact: true }).click();
			await expect(freshPage.getByText("UI-001", { exact: true }).first()).toBeVisible();
			await expect(freshPage.getByText("Visible recovery", { exact: true }).first()).toBeVisible();
			await expect(freshPage.getByText("UI-002", { exact: true }).first()).toBeVisible();
			await expect(freshPage.getByText("Fresh session row", { exact: true }).first()).toBeVisible();
			await freshPage.screenshot({
				path: testInfo.outputPath("ocr-retry-fresh-session-rows.png"),
				fullPage: true,
			});
		} finally {
			await closeContext(freshContext);
		}
	});
});
