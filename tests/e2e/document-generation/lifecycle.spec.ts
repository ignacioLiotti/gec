import type { APIResponse, Page, Response, TestInfo } from "@playwright/test";
import { z } from "zod";

import { expect, test, type Actor } from "../fixtures/test";
import { expectPdfContent } from "../helpers/pdf";

const draftResponseSchema = z.object({
	draft: z.object({
		id: z.string().uuid(),
		status: z.string(),
		input_data: z.record(z.unknown()),
	}),
});

const generatedResponseSchema = z.object({
	generatedDocument: z.object({
		id: z.string().uuid(),
		status: z.string(),
		file_name: z.string().min(1),
		storage_path: z.string().min(1),
		input_data: z.record(z.unknown()).optional(),
	}),
	relativeFolderPath: z.string().min(1),
	relativeFilePath: z.string().min(1),
	previewHtml: z.string(),
});

const decisionRequestSchema = z.object({
	status: z.enum(["APPROVED", "REJECTED"]),
	comment: z.string(),
});

const generatedDetailSchema = z.object({
	document: z.object({
		id: z.string().uuid(),
		status: z.string(),
		storagePath: z.string().min(1),
		inputData: z.record(z.unknown()),
	}),
	events: z.array(
		z.object({
			eventType: z.string(),
			fromStatus: z.string().nullable(),
			toStatus: z.string().nullable(),
			payload: z.record(z.unknown()),
		}),
	),
});

const persistedDocumentSchema = z.object({
	id: z.string().uuid(),
	obra_id: z.string().uuid(),
	folder_path: z.string(),
	file_name: z.string().min(1),
	generated_by: z.string().uuid(),
	status: z.string(),
	input_data: z.record(z.unknown()),
	storage_path: z.string().min(1),
});

const persistedEventSchema = z.object({
	event_type: z.string(),
	from_status: z.string().nullable(),
	to_status: z.string().nullable(),
	payload: z.record(z.unknown()),
	created_by: z.string().uuid(),
	created_at: z.string().min(1),
});

async function parseSuccessfulJson<T>(response: APIResponse | Response, schema: z.ZodType<T>) {
	const payload: unknown = await response.json();
	expect(response.ok(), JSON.stringify(payload)).toBeTruthy();
	return schema.parse(payload);
}

async function waitForDocumentWrite(page: Page, action: () => Promise<void>) {
	const responsePromise = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().includes("/api/document-generation/generate"),
		{ timeout: 90_000 },
	);
	await action();
	return parseSuccessfulJson(await responsePromise, generatedResponseSchema);
}

async function readPersistedDocument(
	db: Actor["db"],
	documentId: string,
) {
	const result = await db
		.from("generated_documents")
		.select("id, obra_id, folder_path, file_name, generated_by, status, input_data, storage_path")
		.eq("id", documentId)
		.maybeSingle();
	expect(result.error).toBeNull();
	return persistedDocumentSchema.parse(result.data);
}

async function readPersistedEvents(db: Actor["db"], documentId: string) {
	const result = await db
		.from("generated_document_events")
		.select("event_type, from_status, to_status, payload, created_by, created_at")
		.eq("generated_document_id", documentId)
		.order("created_at", { ascending: true });
	expect(result.error).toBeNull();
	return z.array(persistedEventSchema).parse(result.data ?? []);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	await testInfo.attach(name, {
		body: await page.screenshot({ fullPage: true }),
		contentType: "image/png",
	});
}

async function decideThroughReviewUi(args: {
	page: Page;
	documentId: string;
	status: "APPROVED" | "REJECTED";
	comment: string;
}) {
	await args.page.goto(`/document-generation/review?id=${args.documentId}`);
	await expect(args.page.getByLabel("Comentario")).toBeVisible();
	await args.page.getByLabel("Comentario").fill(args.comment);
	const decisionPath = `/api/document-generation/generated/${args.documentId}`;
	const requestPromise = args.page.waitForRequest(
		(request) => {
			if (request.method() !== "PATCH" || new URL(request.url()).pathname !== decisionPath) {
				return false;
			}
			try {
				const payload = decisionRequestSchema.safeParse(request.postDataJSON());
				return payload.success && payload.data.status === args.status && payload.data.comment === args.comment;
			} catch {
				return false;
			}
		},
		{ timeout: 90_000 },
	);
	await args.page.getByRole("button", {
		name: args.status === "APPROVED" ? "Aprobar" : "Rechazar",
	}).click();
	await requestPromise;
	await expect.poll(async () => {
		const response = await args.page.request.get(decisionPath);
		if (!response.ok()) return false;
		const payload = generatedDetailSchema.safeParse(await response.json());
		return payload.success &&
			payload.data.document.status === args.status &&
			payload.data.events.some((event) =>
				event.toStatus === args.status && event.payload.comment === args.comment,
			);
	}, { timeout: 90_000 }).toBe(true);
	await expect(args.page.getByText(/No se pudo actualizar el estado|Configura tu firma digital/)).toHaveCount(0);
	await args.page.reload();
	await expect(args.page.getByText(args.comment, { exact: true })).toBeVisible();
}

function assertSignatureMetadata(payload: Record<string, unknown>, expectedSigner: string) {
	const signatureDataUrl = payload.signatureDataUrl;
	const signerLabel = payload.signerLabel;
	const signedAt = payload.signedAt;
	if (
		typeof signatureDataUrl !== "string" ||
		!signatureDataUrl.startsWith("data:image/png;base64,") ||
		typeof signerLabel !== "string" ||
		signerLabel !== expectedSigner ||
		typeof signedAt !== "string" ||
		!Number.isFinite(Date.parse(signedAt))
	) {
		throw new Error("Approval event is missing valid signature metadata.");
	}
}

test("persists a draft and enforces the generated document review lifecycle", async ({ scenario }, testInfo) => {
	test.setTimeout(420_000);

	const seed = await scenario.documentGeneration.createLifecycleSeed("durable lifecycle");
	await scenario.permissions.seedUserOverride("editor", "documents:review", {
		tenant: "a",
		decision: "deny",
	});
	await scenario.permissions.seedUserOverride("viewer", "documents:review", {
		tenant: "a",
		decision: "grant",
	});
	await scenario.documentGeneration.setActorSignature("viewer");

	const author = await scenario.actor("editor");
	const reviewer = await scenario.actor("viewer");
	const foreignOwner = await scenario.actor("otherOwner");
	const authorPage = await author.context.newPage();
	const reviewerPage = await reviewer.context.newPage();
	const editorUrl = new URL("/document-generation", "http://local.test");
	editorUrl.searchParams.set("workId", seed.obraId);
	editorUrl.searchParams.set("folderPath", seed.folderPath);
	editorUrl.searchParams.set("documentType", seed.documentType);
	await authorPage.goto(`${editorUrl.pathname}${editorUrl.search}`);

	const lifecycleInput = authorPage.getByLabel("Lifecycle note");
	await expect(lifecycleInput).toBeVisible();
	await lifecycleInput.fill("first persisted draft");
	const draftResponsePromise = authorPage.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().includes("/api/document-generation/drafts"),
	);
	await authorPage.getByRole("button", { name: "Guardar borrador" }).click();
	const draft = await parseSuccessfulJson(await draftResponsePromise, draftResponseSchema);
	expect(draft.draft.input_data.lifecycle_note).toBe("first persisted draft");
	await expect.poll(() => new URL(authorPage.url()).searchParams.get("draftId")).toBe(draft.draft.id);

	await authorPage.reload();
	await expect(authorPage.getByLabel("Lifecycle note")).toHaveValue("first persisted draft");
	await attachScreenshot(authorPage, testInfo, "draft-recovered-after-reload");

	const generated = await waitForDocumentWrite(authorPage, () =>
		authorPage.getByRole("button", { name: "Generar documento" }).click(),
	);
	const documentId = generated.generatedDocument.id;
	expect(generated.generatedDocument.status).toBe("UNDER_REVIEW");
	expect(generated.generatedDocument.input_data?.lifecycle_note).toBe("first persisted draft");
	expect(generated.generatedDocument.file_name).toBe("lifecycle-first persisted draft.pdf");
	expect(generated.relativeFolderPath).toBe(seed.folderPath);
	expect(generated.relativeFilePath).toBe(`${seed.folderPath}/${generated.generatedDocument.file_name}`);
	expect(generated.generatedDocument.storage_path).toBe(
		`${seed.obraId}/${seed.folderPath}/${generated.generatedDocument.file_name}`,
	);
	const initialPersisted = await readPersistedDocument(author.db, documentId);
	expect(initialPersisted).toMatchObject({
		obra_id: seed.obraId,
		folder_path: seed.folderPath,
		file_name: generated.generatedDocument.file_name,
		generated_by: author.userId,
		storage_path: generated.generatedDocument.storage_path,
	});

	const initialDownload = await author.request.get(
		`/api/obras/${seed.obraId}/documents/access?${new URLSearchParams({
			path: generated.generatedDocument.storage_path,
			download: "1",
		})}`,
	);
	const unsignedInitialPdf = await expectPdfContent(initialDownload, "first persisted draft");

	const deniedReview = await author.request.patch(`/api/document-generation/generated/${documentId}`, {
		data: { status: "APPROVED", comment: "author cannot approve" },
	});
	expect(deniedReview.status()).toBe(403);

	const foreignReview = await foreignOwner.request.patch(
		`/api/document-generation/generated/${documentId}`,
		{ data: { status: "APPROVED", comment: "foreign tenant cannot approve" } },
	);
	expect(foreignReview.status()).toBe(404);
	expect((await readPersistedDocument(reviewer.db, documentId)).status).toBe("UNDER_REVIEW");

	const firstApprovalComment = "First approval signed in the reviewer UI.";
	await decideThroughReviewUi({
		page: reviewerPage,
		documentId,
		status: "APPROVED",
		comment: firstApprovalComment,
	});
	const firstSignedDownload = await reviewer.request.get(
		`/api/obras/${seed.obraId}/documents/access?${new URLSearchParams({
			path: generated.generatedDocument.storage_path,
			download: "1",
		})}`,
	);
	const firstSignedPdf = await expectPdfContent(firstSignedDownload, [
		"first persisted draft",
		"E2E viewer reviewer",
	]);
	expect(firstSignedPdf.equals(unsignedInitialPdf)).toBe(false);

	await authorPage.goto(`/document-generation?generatedId=${documentId}`);
	await expect(authorPage.getByLabel("Lifecycle note")).toHaveValue("first persisted draft");
	await authorPage.getByLabel("Lifecycle note").fill("member edit after approval");
	const reopened = await waitForDocumentWrite(authorPage, () =>
		authorPage.getByRole("button", { name: "Guardar cambios" }).click(),
	);
	expect(reopened.generatedDocument.status).toBe("UNDER_REVIEW");
	await authorPage.reload();
	await expect(authorPage.getByLabel("Lifecycle note")).toHaveValue("member edit after approval");
	const persistedAfterApprovedEdit = await readPersistedDocument(author.db, documentId);
	expect(persistedAfterApprovedEdit.status).toBe("UNDER_REVIEW");
	expect(persistedAfterApprovedEdit.input_data.lifecycle_note).toBe("member edit after approval");
	const approvedEditDownload = await author.request.get(
		`/api/obras/${seed.obraId}/documents/access?${new URLSearchParams({
			path: persistedAfterApprovedEdit.storage_path,
			download: "1",
		})}`,
	);
	await expectPdfContent(approvedEditDownload, "member edit after approval");

	const rejectionReason = "The amount and delivery details require correction.";
	await decideThroughReviewUi({
		page: reviewerPage,
		documentId,
		status: "REJECTED",
		comment: rejectionReason,
	});

	const rejectedDownloadUrl = `/api/obras/${seed.obraId}/documents/access?${new URLSearchParams({
		path: reopened.generatedDocument.storage_path,
		download: "1",
	})}`;
	const rejectedDownload = await author.request.get(rejectedDownloadUrl);
	expect(rejectedDownload.status()).toBe(403);
	expect(await rejectedDownload.json()).toMatchObject({
		error: "No se puede descargar un documento rechazado.",
	});
	const rejectedSignedUrl = await author.request.get(
		`/api/obras/${seed.obraId}/documents/access?${new URLSearchParams({
			path: reopened.generatedDocument.storage_path,
		})}`,
	);
	expect(rejectedSignedUrl.status()).toBe(403);
	expect(await rejectedSignedUrl.json()).toMatchObject({
		error: "No se puede descargar un documento rechazado.",
	});

	const rejectedDetail = await parseSuccessfulJson(
		await author.request.get(`/api/document-generation/generated/${documentId}`),
		generatedDetailSchema,
	);
	expect(rejectedDetail.document.status).toBe("REJECTED");
	expect(
		rejectedDetail.events.some(
			(event) => event.toStatus === "REJECTED" && event.payload.comment === rejectionReason,
		),
	).toBeTruthy();
	await authorPage.goto(`/document-generation?generatedId=${documentId}`);
	await expect(authorPage.getByLabel("Lifecycle note")).toHaveValue("member edit after approval");
	await attachScreenshot(authorPage, testInfo, "rejected-document-editor");
	await authorPage.getByLabel("Lifecycle note").fill("corrected after rejection");
	const corrected = await waitForDocumentWrite(authorPage, () =>
		authorPage.getByRole("button", { name: "Guardar cambios" }).click(),
	);
	expect(corrected.generatedDocument.status).toBe("UNDER_REVIEW");
	const persistedCorrection = await readPersistedDocument(author.db, documentId);
	expect(persistedCorrection.input_data.lifecycle_note).toBe(
		"corrected after rejection",
	);
	const correctedDownload = await author.request.get(
		`/api/obras/${seed.obraId}/documents/access?${new URLSearchParams({
			path: persistedCorrection.storage_path,
			download: "1",
		})}`,
	);
	const unsignedCorrectedPdf = await expectPdfContent(correctedDownload, "corrected after rejection");

	const finalApprovalComment = "Correction verified in the reviewer UI.";
	await decideThroughReviewUi({
		page: reviewerPage,
		documentId,
		status: "APPROVED",
		comment: finalApprovalComment,
	});
	const finalDocument = await readPersistedDocument(reviewer.db, documentId);
	expect(finalDocument.status).toBe("APPROVED");
	expect(finalDocument.input_data.lifecycle_note).toBe("corrected after rejection");

	const finalDownload = await reviewer.request.get(
		`/api/obras/${seed.obraId}/documents/access?${new URLSearchParams({
			path: finalDocument.storage_path,
			download: "1",
		})}`,
	);
	const finalSignedPdf = await expectPdfContent(finalDownload, [
		"corrected after rejection",
		"E2E viewer reviewer",
	]);
	expect(finalSignedPdf.equals(unsignedCorrectedPdf)).toBe(false);

	const events = await readPersistedEvents(reviewer.db, documentId);
	expect(events.map((event) => ({
		eventType: event.event_type,
		fromStatus: event.from_status,
		toStatus: event.to_status,
		actorId: event.created_by,
		comment: typeof event.payload.comment === "string" ? event.payload.comment : null,
	}))).toEqual([
		{ eventType: "DocumentGenerated", fromStatus: null, toStatus: "UNDER_REVIEW", actorId: author.userId, comment: null },
		{ eventType: "GeneratedDocumentStatusChanged", fromStatus: "UNDER_REVIEW", toStatus: "APPROVED", actorId: reviewer.userId, comment: firstApprovalComment },
		{ eventType: "DocumentRegenerated", fromStatus: "APPROVED", toStatus: "UNDER_REVIEW", actorId: author.userId, comment: null },
		{ eventType: "GeneratedDocumentStatusChanged", fromStatus: "UNDER_REVIEW", toStatus: "REJECTED", actorId: reviewer.userId, comment: rejectionReason },
		{ eventType: "DocumentRegenerated", fromStatus: "REJECTED", toStatus: "UNDER_REVIEW", actorId: author.userId, comment: null },
		{ eventType: "GeneratedDocumentStatusChanged", fromStatus: "UNDER_REVIEW", toStatus: "APPROVED", actorId: reviewer.userId, comment: finalApprovalComment },
	]);
	assertSignatureMetadata(events[1]?.payload ?? {}, "E2E viewer reviewer");
	assertSignatureMetadata(events[5]?.payload ?? {}, "E2E viewer reviewer");

	await expect(reviewerPage.getByText("Este documento ya tiene una decision registrada.")).toBeVisible();
	await attachScreenshot(reviewerPage, testInfo, "final-approved-document");
	await reviewerPage.close();
	await authorPage.close();
});
