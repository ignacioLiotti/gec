import type { Page, Response, TestInfo } from "@playwright/test";
import { z } from "zod";

import { expect, test, type Actor } from "../fixtures/test";

const draftRequestSchema = z.object({
	id: z.string().uuid().optional(),
	expectedUpdatedAt: z.string().min(1).optional(),
	workId: z.string().uuid(),
	folderPath: z.string().min(1),
	documentType: z.literal("ACT"),
	templateId: z.string().uuid(),
	inputData: z.record(z.unknown()),
});

const draftResponseSchema = z.object({
	draft: z.object({
		id: z.string().uuid(),
		updated_at: z.string().min(1),
		status: z.string(),
		input_data: z.record(z.unknown()),
	}),
});

const persistedDraftSchema = z.object({
	id: z.string().uuid(),
	obra_id: z.string().uuid(),
	folder_path: z.string(),
	document_type: z.string(),
	input_data: z.record(z.unknown()),
	created_by: z.string().uuid(),
});

type DraftRequest = z.infer<typeof draftRequestSchema>;

function isDraftPost(url: string, method: string) {
	return method === "POST" && new URL(url).pathname === "/api/document-generation/drafts";
}

async function parseDraftResponse(response: Response) {
	const payload: unknown = await response.json();
	expect(response.ok(), JSON.stringify(payload)).toBeTruthy();
	return draftResponseSchema.parse(payload);
}

async function readPersistedDraft(db: Actor["db"], draftId: string) {
	const result = await db
		.from("generated_document_drafts")
		.select("id, obra_id, folder_path, document_type, input_data, created_by")
		.eq("id", draftId)
		.maybeSingle();
	expect(result.error).toBeNull();
	return persistedDraftSchema.parse(result.data);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	await testInfo.attach(name, {
		body: await page.screenshot({ fullPage: true }),
		contentType: "image/png",
	});
}

test("keeps a newer edit when the first real draft save returns late, then persists it on retry", async ({ scenario }, testInfo) => {
	test.setTimeout(180_000);

	const seed = await scenario.documentGeneration.createLifecycleSeed("late draft recovery");
	const editor = await scenario.actor("editor");
	const foreignOwner = await scenario.actor("otherOwner");
	const page = await editor.context.newPage();
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	const editorUrl = new URL("/document-generation", "http://local.test");
	editorUrl.searchParams.set("workId", seed.obraId);
	editorUrl.searchParams.set("folderPath", seed.folderPath);
	editorUrl.searchParams.set("documentType", seed.documentType);

	let announceFirstPost: (request: DraftRequest) => void = () => undefined;
	const firstPostReached = new Promise<DraftRequest>((resolve) => {
		announceFirstPost = resolve;
	});
	let releaseFirstPost: () => void = () => undefined;
	const firstPostRelease = new Promise<void>((resolve) => {
		releaseFirstPost = resolve;
	});
	const draftPosts: DraftRequest[] = [];

	await page.route("**/api/document-generation/drafts", async (route) => {
		const request = route.request();
		if (!isDraftPost(request.url(), request.method())) {
			await route.continue();
			return;
		}

		const payload: unknown = request.postDataJSON();
		const parsed = draftRequestSchema.parse(payload);
		draftPosts.push(parsed);
		if (draftPosts.length === 1) {
			announceFirstPost(parsed);
			await firstPostRelease;
		}
		await route.continue();
	});

	await page.goto(`${editorUrl.pathname}${editorUrl.search}`);
	const noteInput = page.getByLabel("Lifecycle note");
	const saveButton = page.getByRole("button", { name: "Guardar borrador" });
	await expect(noteInput).toBeVisible();

	const submittedRevision = "revision sent while transport is held";
	const newerRevision = "newer revision retained after late response";
	await noteInput.fill(submittedRevision);
	const firstResponsePromise = page.waitForResponse((response) =>
		isDraftPost(response.url(), response.request().method()),
	);
	await saveButton.click();
	const firstPost = await firstPostReached;
	expect(firstPost).toMatchObject({
		workId: seed.obraId,
		folderPath: seed.folderPath,
		documentType: seed.documentType,
		templateId: seed.templateId,
		inputData: { lifecycle_note: submittedRevision },
	});
	expect(firstPost.id).toBeUndefined();
	await expect(saveButton).toBeDisabled();
	await expect(noteInput).toBeEditable();

	await noteInput.fill(newerRevision);
	await expect(noteInput).toHaveValue(newerRevision);
	await attachScreenshot(page, testInfo, "newer-revision-while-first-save-pending");

	releaseFirstPost();
	const firstDraft = await parseDraftResponse(await firstResponsePromise);
	expect(firstDraft.draft.input_data.lifecycle_note).toBe(submittedRevision);
	await expect.poll(() => new URL(page.url()).searchParams.get("draftId")).toBe(firstDraft.draft.id);
	await expect(noteInput).toHaveValue(newerRevision);
	await expect(saveButton).toBeEnabled();
	await attachScreenshot(page, testInfo, "newer-revision-after-late-response");

	const persistedFirstRevision = await readPersistedDraft(editor.db, firstDraft.draft.id);
	expect(persistedFirstRevision).toMatchObject({
		obra_id: seed.obraId,
		folder_path: seed.folderPath,
		document_type: seed.documentType,
		created_by: editor.userId,
		input_data: { lifecycle_note: submittedRevision },
	});

	const hiddenFromForeignTenant = await foreignOwner.db
		.from("generated_document_drafts")
		.select("id")
		.eq("id", firstDraft.draft.id)
		.maybeSingle();
	expect(hiddenFromForeignTenant.error).toBeNull();
	expect(hiddenFromForeignTenant.data).toBeNull();

	const secondResponsePromise = page.waitForResponse((response) =>
		isDraftPost(response.url(), response.request().method()),
	);
	await saveButton.click();
	const secondDraft = await parseDraftResponse(await secondResponsePromise);
	expect(secondDraft.draft.id).toBe(firstDraft.draft.id);
	expect(secondDraft.draft.input_data.lifecycle_note).toBe(newerRevision);
	expect(draftPosts).toHaveLength(2);
	expect(draftPosts[1]).toMatchObject({
		id: firstDraft.draft.id,
		workId: seed.obraId,
		inputData: { lifecycle_note: newerRevision },
	});

	const persistedLatestRevision = await readPersistedDraft(editor.db, firstDraft.draft.id);
	expect(persistedLatestRevision.input_data.lifecycle_note).toBe(newerRevision);
	const matchingDrafts = await editor.db
		.from("generated_document_drafts")
		.select("id")
		.eq("obra_id", seed.obraId)
		.eq("folder_path", seed.folderPath)
		.eq("document_type", seed.documentType);
	expect(matchingDrafts.error).toBeNull();
	expect(matchingDrafts.data).toEqual([{ id: firstDraft.draft.id }]);

	await page.reload();
	await expect(page.getByLabel("Lifecycle note")).toHaveValue(newerRevision);
	await expect.poll(() => new URL(page.url()).searchParams.get("draftId")).toBe(firstDraft.draft.id);
	await attachScreenshot(page, testInfo, "latest-revision-recovered-after-reload");
	expect(draftPosts).toHaveLength(2);
});
