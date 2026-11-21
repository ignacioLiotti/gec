import { z } from "zod";

import { expect, test } from "../fixtures/test";
import { buildExcelObraName, createObraViaBulkApi } from "../helpers/obras";
import { createUploadedDocumentFixtures, expectedDocxText } from "./files-and-extraction-fixtures";

test("recovers from an unreadable DOCX preview and renders the uploaded Word content after a fresh login context", async ({ page, scenario }, testInfo) => {
	test.setTimeout(180_000);
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	const owner = await scenario.actor("owner");
	const foreign = await scenario.actor("otherOwner");
	const obra = await createObraViaBulkApi(owner.request, { designacionYUbicacion: buildExcelObraName(`${scenario.namespace} Word preview`) });
	const folder = "word-preview";
	const marker = await owner.db.storage.from("obra-documents").upload(`${obra.id}/${folder}/.keep`, Buffer.alloc(0), { contentType: "text/plain" });
	expect(marker.error).toBeNull();
	const docx = (await createUploadedDocumentFixtures()).find(source => source.name.endsWith(".docx"));
	if (!docx) throw new Error("The Word fixture is missing.");
	const broken = { name: "unreadable.docx", mimeType: docx.mimeType, buffer: Buffer.from("This is not a ZIP archive.") };
	await page.goto(`/excel/${obra.id}?tab=documentos`);
	await expect(page.getByRole("heading", { name: "Todos los documentos", exact: true })).toBeVisible();
	await page.getByTitle(/^word preview$/i).first().click();
	const chooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "Subir archivos", exact: true }).click();
	await (await chooser).setFiles([broken, docx]);
	await expect(page.getByText(docx.name, { exact: true }).first()).toBeVisible();
	await page.getByRole("button").filter({ hasText: broken.name }).first().click();
	await expect(page.getByRole("heading", { name: broken.name, exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Descargar para ver", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button").filter({ hasText: docx.name }).first().click();
	await expect(page.getByRole("heading", { name: docx.name, exact: true })).toBeVisible();
	await expect(page.locator(".docx-preview-content")).toHaveText(expectedDocxText);
	await expect(page.getByRole("button", { name: "Descargar para ver", exact: true })).toHaveCount(0);
	await testInfo.attach("actual-word-preview", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
	const storedPath = `${obra.id}/${folder}/${docx.name}`;
	const downloaded = await owner.request.get(`/api/obras/${obra.id}/documents/access?download=1&path=${encodeURIComponent(storedPath)}`);
	expect(downloaded.status()).toBe(200);
	expect(Buffer.from(await downloaded.body()).equals(docx.buffer)).toBe(true);
	const denied = await foreign.request.get(`/api/obras/${obra.id}/documents/access?download=1&path=${encodeURIComponent(storedPath)}`);
	expect(denied.status()).toBe(404);
	const fresh = await scenario.newContext("owner");
	try {
		const freshPage = await fresh.newPage();
		freshPage.setDefaultNavigationTimeout(60_000);
		await freshPage.goto(`/excel/${obra.id}?tab=documentos`);
		await freshPage.getByTitle(/^word preview$/i).first().click();
		await freshPage.getByRole("button").filter({ hasText: docx.name }).first().click();
		await expect(freshPage.locator(".docx-preview-content")).toHaveText(expectedDocxText);
		const listed = await fresh.request.get(`/api/obras/${obra.id}/documents/list?path=${folder}`);
		expect(listed.status()).toBe(200);
		expect(z.object({ tree: z.unknown() }).parse(await listed.json()).tree).toBeTruthy();
	} finally {
		await fresh.close();
	}
});
