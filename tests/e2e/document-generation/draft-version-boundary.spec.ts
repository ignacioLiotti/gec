import { z } from "zod";

import { expect, test } from "../fixtures/test";

const draftMutation = z.object({
	draft: z.object({
		id: z.string().uuid(),
		updated_at: z.string().datetime({ offset: true }),
		input_data: z.record(z.unknown()),
	}),
});

test("enforces draft version preconditions without overwriting a newer revision", async ({ scenario }) => {
	const seed = await scenario.documentGeneration.createLifecycleSeed("draft version boundary");
	const editor = await scenario.actor("editor");
	const foreignOwner = await scenario.actor("otherOwner");
	const target = {
		workId: seed.obraId,
		folderPath: seed.folderPath,
		documentType: seed.documentType,
		templateId: seed.templateId,
	};

	const createdResponse = await editor.request.post("/api/document-generation/drafts", {
		data: { ...target, inputData: { lifecycle_note: "initial revision" } },
	});
	expect(createdResponse.status()).toBe(200);
	const created = draftMutation.parse(await createdResponse.json()).draft;

	const missingVersion = await editor.request.post("/api/document-generation/drafts", {
		data: { id: created.id, ...target, inputData: { lifecycle_note: "missing token" } },
	});
	expect(missingVersion.status()).toBe(428);

	const malformedVersion = await editor.request.post("/api/document-generation/drafts", {
		data: {
			id: created.id,
			expectedUpdatedAt: "not-a-timestamp",
			...target,
			inputData: { lifecycle_note: "malformed token" },
		},
	});
	expect(malformedVersion.status()).toBe(400);

	const foreignUpdate = await foreignOwner.request.post("/api/document-generation/drafts", {
		data: {
			id: created.id,
			expectedUpdatedAt: created.updated_at,
			...target,
			inputData: { lifecycle_note: "foreign overwrite" },
		},
	});
	expect(foreignUpdate.status()).toBe(404);

	const firstUpdateResponse = await editor.request.post("/api/document-generation/drafts", {
		data: {
			id: created.id,
			expectedUpdatedAt: created.updated_at,
			...target,
			inputData: { lifecycle_note: "first saved revision" },
		},
	});
	expect(firstUpdateResponse.status()).toBe(200);
	const firstUpdate = draftMutation.parse(await firstUpdateResponse.json()).draft;
	expect(firstUpdate.updated_at).not.toBe(created.updated_at);

	const staleUpdate = await editor.request.post("/api/document-generation/drafts", {
		data: {
			id: created.id,
			expectedUpdatedAt: created.updated_at,
			...target,
			inputData: { lifecycle_note: "stale overwrite" },
		},
	});
	expect(staleUpdate.status()).toBe(409);
	expect(await staleUpdate.json()).toEqual({
		error: "Este borrador cambió en otra pestaña. Conservamos tus cambios; recargá para revisar la última versión.",
	});

	const afterConflict = await editor.db
		.from("generated_document_drafts")
		.select("input_data, updated_at")
		.eq("id", created.id)
		.single();
	expect(afterConflict.error).toBeNull();
	expect(afterConflict.data).toMatchObject({
		input_data: { lifecycle_note: "first saved revision" },
		updated_at: firstUpdate.updated_at,
	});

	const matchingUpdateResponse = await editor.request.post("/api/document-generation/drafts", {
		data: {
			id: created.id,
			expectedUpdatedAt: firstUpdate.updated_at,
			...target,
			inputData: { lifecycle_note: "matching saved revision" },
		},
	});
	expect(matchingUpdateResponse.status()).toBe(200);
	const matchingUpdate = draftMutation.parse(await matchingUpdateResponse.json()).draft;
	expect(matchingUpdate.updated_at).not.toBe(firstUpdate.updated_at);
	expect(matchingUpdate.input_data).toEqual({ lifecycle_note: "matching saved revision" });
});
