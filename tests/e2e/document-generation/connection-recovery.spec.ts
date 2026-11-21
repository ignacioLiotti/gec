import { z } from "zod";

import { expect, test } from "../fixtures/test";

const savedDraft = z.object({
	draft: z.object({ id: z.string().uuid(), input_data: z.record(z.unknown()) }),
});

test("retains edits after an offline save and persists the same draft after reconnection", async ({ scenario }, testInfo) => {
	test.setTimeout(180_000);
	const seed = await scenario.documentGeneration.createLifecycleSeed("offline recovery");
	const editor = await scenario.actor("editor");
	const page = await editor.context.newPage();
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	const query = new URLSearchParams({ workId: seed.obraId, folderPath: seed.folderPath, documentType: seed.documentType });
	await page.goto(`/document-generation?${query}`);
	const note = page.getByLabel("Lifecycle note");
	const save = page.getByRole("button", { name: "Guardar borrador" });
	await expect(note).toBeVisible();
	await note.fill("Stored before connection loss");
	const createdResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/document-generation/drafts");
	await save.click();
	const created = await createdResponse;
	expect(created.status()).toBe(200);
	const initial = savedDraft.parse(await created.json());
	await expect.poll(() => new URL(page.url()).searchParams.get("draftId")).toBe(initial.draft.id);
	await expect(save).toBeEnabled();

	await editor.context.setOffline(true);
	try {
		await note.fill("Retained locally while the connection is down");
		const failedRequest = page.waitForEvent("requestfailed", { predicate: request => request.method() === "POST" && new URL(request.url()).pathname === "/api/document-generation/drafts" });
		await save.click();
		await failedRequest;
		await expect(save).toBeEnabled();
		await expect(note).toHaveValue("Retained locally while the connection is down");
		const persisted = await editor.db.from("generated_document_drafts").select("id, input_data").eq("id", initial.draft.id).single();
		expect(persisted.error).toBeNull();
		expect(persisted.data).toMatchObject({ id: initial.draft.id, input_data: { lifecycle_note: "Stored before connection loss" } });
		await testInfo.attach("offline-edits-retained", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
	} finally {
		await editor.context.setOffline(false);
	}

	const recoveredResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/document-generation/drafts");
	await save.click();
	const recovered = await recoveredResponse;
	expect(recovered.status()).toBe(200);
	const latest = savedDraft.parse(await recovered.json());
	expect(latest.draft.id).toBe(initial.draft.id);
	expect(latest.draft.input_data.lifecycle_note).toBe("Retained locally while the connection is down");
	const rows = await editor.db.from("generated_document_drafts").select("id, input_data").eq("obra_id", seed.obraId);
	expect(rows.error).toBeNull();
	expect(rows.data).toEqual([{ id: initial.draft.id, input_data: { lifecycle_note: "Retained locally while the connection is down" } }]);
	const fresh = await scenario.newContext("editor");
	try {
		const freshPage = await fresh.newPage();
		await freshPage.goto(`/document-generation?draftId=${initial.draft.id}`);
		await expect(freshPage.getByLabel("Lifecycle note")).toHaveValue("Retained locally while the connection is down");
	} finally {
		await fresh.close();
	}
});

test("rejects a stale save from another tab without losing either editor's text", async ({ scenario }, testInfo) => {
	test.setTimeout(180_000);
	const seed = await scenario.documentGeneration.createLifecycleSeed("independent tabs");
	const editor = await scenario.actor("editor");
	const created = await editor.request.post("/api/document-generation/drafts", { data: {
		workId: seed.obraId, folderPath: seed.folderPath, documentType: seed.documentType,
		templateId: seed.templateId, inputData: { lifecycle_note: "Shared initial revision" },
	} });
	expect(created.status()).toBe(200);
	const initial = savedDraft.parse(await created.json());
	const secondContext = await scenario.newContext("editor");
	try {
		const first = await editor.context.newPage();
		const second = await secondContext.newPage();
		for (const page of [first, second]) {
			page.setDefaultTimeout(15_000);
			page.setDefaultNavigationTimeout(60_000);
			await page.goto(`/document-generation?draftId=${initial.draft.id}`);
			await expect(page.getByLabel("Lifecycle note")).toHaveValue("Shared initial revision");
		}
		await first.getByLabel("Lifecycle note").fill("First tab saved revision");
		const firstSave = first.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/document-generation/drafts");
		await first.getByRole("button", { name: "Guardar borrador" }).click();
		expect((await firstSave).status()).toBe(200);
		await second.getByLabel("Lifecycle note").fill("Second tab unsaved revision");
		const staleSave = second.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/document-generation/drafts");
		await second.getByRole("button", { name: "Guardar borrador" }).click();
		expect((await staleSave).status()).toBe(409);
		await expect(second.getByText("Este borrador cambió en otra pestaña. Conservamos tus cambios; recargá para revisar la última versión.", { exact: true })).toBeVisible();
		await expect(second.getByLabel("Lifecycle note")).toHaveValue("Second tab unsaved revision");
		const persisted = await editor.db.from("generated_document_drafts").select("id, input_data").eq("id", initial.draft.id).single();
		expect(persisted.error).toBeNull();
		expect(persisted.data).toMatchObject({ input_data: { lifecycle_note: "First tab saved revision" } });
		await testInfo.attach("stale-tab-conflict", { body: await second.screenshot({ fullPage: true }), contentType: "image/png" });
		await second.reload();
		await expect(second.getByLabel("Lifecycle note")).toHaveValue("First tab saved revision");
		await second.getByLabel("Lifecycle note").fill("Second tab reviewed and saved revision");
		const resolvedSave = second.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/document-generation/drafts");
		await second.getByRole("button", { name: "Guardar borrador" }).click();
		expect((await resolvedSave).status()).toBe(200);
		await first.reload();
		await expect(first.getByLabel("Lifecycle note")).toHaveValue("Second tab reviewed and saved revision");
	} finally {
		await secondContext.close();
	}
});
