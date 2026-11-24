import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { z } from "zod";

import { expect, test, type Actor } from "../fixtures/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
} from "../helpers/obras";
import { expectPdfContent } from "../helpers/pdf";

const templateOptionSchema = z.object({
	label: z.string(),
	value: z.string(),
	unit: z.string().nullable().optional(),
});

const templateFieldSchema = z.object({
	key: z.string(),
	label: z.string(),
	type: z.enum([
		"text",
		"number",
		"date",
		"select",
		"textarea",
		"money",
		"table",
		"work_reference",
		"supplier_reference",
	]),
	required: z.boolean(),
	options: z.array(templateOptionSchema).optional(),
	selectMode: z.enum(["strict", "creatable"]).optional(),
}).passthrough();

const templateSummarySchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	documentType: z.string(),
	targetFolderPath: z.string().nullable(),
	status: z.string(),
	tenantScoped: z.boolean(),
	version: z.number(),
	schema: z.object({
		fields: z.array(templateFieldSchema),
		documentNumberFieldKey: z.string().nullable().optional(),
		fileNamePattern: z.string().nullable().optional(),
	}),
	contentHtml: z.string(),
});

const templateMutationResponseSchema = z.object({
	template: templateSummarySchema,
	templates: z.array(templateSummarySchema).optional(),
});

const templateCatalogResponseSchema = z.object({
	templates: z.array(templateSummarySchema),
});

const errorResponseSchema = z.object({ error: z.string() });

const draftMutationResponseSchema = z.object({
	draft: z.object({
		id: z.string().uuid(),
		updated_at: z.string().min(1),
		status: z.string(),
		input_data: z.record(z.string(), z.unknown()),
		validation_errors: z.array(z.object({
			key: z.string(),
			message: z.string(),
		})),
	}),
});

const draftDetailResponseSchema = z.object({
	draft: z.object({
		id: z.string().uuid(),
		workId: z.string().uuid(),
		folderPath: z.string(),
		documentType: z.string(),
		templateId: z.string().uuid(),
		status: z.string(),
		updatedAt: z.string().min(1),
		inputData: z.record(z.string(), z.unknown()),
		validationErrors: z.array(z.object({
			key: z.string(),
			message: z.string(),
		})),
		canEdit: z.boolean(),
	}),
});

const generatedResponseSchema = z.object({
	generatedDocument: z.object({
		id: z.string().uuid(),
		status: z.string(),
		file_name: z.string().min(1),
		storage_bucket: z.literal("obra-documents"),
		storage_path: z.string().min(1),
		input_data: z.record(z.string(), z.unknown()),
	}),
	relativeFolderPath: z.string().min(1),
	relativeFilePath: z.string().min(1),
	previewHtml: z.string(),
});

const generatedDatabaseRowSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	obra_id: z.string().uuid(),
	folder_path: z.string(),
	document_type: z.string(),
	template_id: z.string().uuid(),
	source_draft_id: z.string().uuid().nullable(),
	storage_bucket: z.string(),
	storage_path: z.string().min(1),
	file_name: z.string().min(1),
	status: z.string(),
	input_data: z.record(z.string(), z.unknown()),
	generated_by: z.string().uuid(),
});

const templateDatabaseRowSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	name: z.string(),
	document_type: z.string(),
	target_folder_path: z.string().nullable(),
	status: z.string(),
	schema: z.object({
		fields: z.array(templateFieldSchema),
		documentNumberFieldKey: z.string().nullable().optional(),
		fileNamePattern: z.string().nullable().optional(),
	}),
	content_html: z.string(),
});

type TemplateFieldInput = z.input<typeof templateFieldSchema>;

type TemplatePayload = {
	name: string;
	description: string | null;
	documentType: string;
	targetFolderPath: string | null;
	status: "active";
	schema: {
		fields: TemplateFieldInput[];
		documentNumberFieldKey: string | null;
		fileNamePattern: string | null;
	};
	contentHtml: string;
};

const folderPath = "documentos-e2e";
const documentType = "DOCUMENTO";

function codeFor(namespace: string, suffix: string) {
	return `${suffix}_${namespace}`
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.toUpperCase()
		.slice(0, 80);
}

function typedFields(): TemplateFieldInput[] {
	return [
		{
			key: "title",
			label: "Titulo contractual",
			type: "text",
			required: true,
			description: "Nombre visible del documento",
		},
		{
			key: "amount",
			label: "Monto acordado",
			type: "number",
			required: true,
		},
		{
			key: "issue_date",
			label: "Fecha de emision",
			type: "date",
			required: true,
		},
		{
			key: "risk",
			label: "Categoria de riesgo",
			type: "select",
			required: true,
			selectMode: "strict",
			options: [
				{ label: "Riesgo bajo", value: "low" },
				{ label: "Riesgo alto", value: "high" },
			],
		},
	];
}

function templateHtml(marker: string) {
	return [
		`<article data-e2e-template="${marker}">`,
		"<h1>{{title}}</h1>",
		"<p class=\"amount\">{{amount}}</p>",
		"<time>{{issue_date}}</time>",
		"<p class=\"risk\">{{risk}}</p>",
		"<footer>{{workName}}</footer>",
		"</article>",
	].join("");
}

function buildTemplatePayload(params: {
	name: string;
	documentType: string;
	marker: string;
	targetFolderPath?: string | null;
	fields?: TemplateFieldInput[];
}): TemplatePayload {
	return {
		name: params.name,
		description: `Persisted template ${params.marker}`,
		documentType: params.documentType,
		targetFolderPath: params.targetFolderPath ?? null,
		status: "active",
		schema: {
			fields: params.fields ?? typedFields(),
			documentNumberFieldKey: null,
			fileNamePattern: `${params.marker}-{{title}}`,
		},
		contentHtml: templateHtml(params.marker),
	};
}

async function createTemplateViaApi(
	actor: Actor,
	payload: TemplatePayload,
) {
	const response = await actor.request.post("/api/document-generation/templates", {
		data: payload,
	});
	expect(response.status()).toBe(200);
	return templateMutationResponseSchema.parse(await response.json()).template;
}

async function expectErrorResponse(response: APIResponse, status: number) {
	expect(response.status()).toBe(status);
	return errorResponseSchema.parse(await response.json());
}

function templateNameInput(page: Page) {
	return page.getByText("Nombre", { exact: true }).locator("..").locator("input");
}

function fieldsJsonEditor(page: Page) {
	return page
		.getByText("Configuracion JSON de campos", { exact: true })
		.locator("../../..")
		.locator("textarea");
}

async function openHtmlEditor(page: Page) {
	await page.getByRole("button", { name: "HTML", exact: true }).click();
	return page.getByText(/Variables simples:/).locator("..").locator("textarea");
}

async function readDraft(request: APIRequestContext, draftId: string) {
	const response = await request.get(
		`/api/document-generation/drafts?id=${encodeURIComponent(draftId)}`,
	);
	expect(response.status()).toBe(200);
	return draftDetailResponseSchema.parse(await response.json()).draft;
}

test("publishing guided purchase order settings keeps the original template version", async ({ scenario }) => {
	test.setTimeout(120_000);
	const owner = await scenario.actor("owner");
	const catalogResponse = await owner.request.get("/api/document-generation/templates");
	expect(catalogResponse.ok()).toBe(true);
	const { templates } = templateCatalogResponseSchema.parse(await catalogResponse.json());
	const original = templates.find((entry) => entry.documentType === "PURCHASE_ORDER");
	if (!original?.schema.fields.length) throw new Error("Missing purchase order template fixture.");
	const field = original.schema.fields[0];
	const page = await owner.context.newPage();
	await page.goto("/document-generation/config");
	await page.getByRole("button").filter({ hasText: original.name }).first().click({ timeout: 45_000 });
	const checkbox = page.getByRole("checkbox", { name: field.label, exact: true });
	await checkbox.setChecked(!field.required);
	await expect(page.getByTitle("Vista previa de la orden de compra con datos de ejemplo")).toBeVisible();
	await page.getByRole("button", { name: "Publicar nueva versión" }).click();
	await expect(page.getByText("Template guardada para este tenant.")).toBeVisible();

	const updated = await owner.request.get("/api/document-generation/templates");
	expect(updated.ok()).toBe(true);
	const { templates: versions } = templateCatalogResponseSchema.parse(await updated.json());
	const copy = versions.find((entry) => entry.documentType === "PURCHASE_ORDER" && entry.id !== original.id);
	expect(copy?.version).toBe(original.version + 1);
	expect(copy?.schema.fields.find((entry) => entry.key === field.key)?.required).toBe(!field.required);
	expect(versions.find((entry) => entry.id === original.id)?.schema.fields).toEqual(original.schema.fields);
});

test("owner creates, edits and reloads a typed template, then the generator renders and saves its inputs", async ({
	scenario,
}) => {
	test.setTimeout(180_000);
	const owner = await scenario.actor("owner");
	const obraName = buildExcelObraName(`${scenario.namespace} template UI`);
	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: obraName,
	});
	const initialName = `${scenario.namespace} Documento inicial`;
	const editedName = `${scenario.namespace} Documento contractual`;
	const marker = codeFor(scenario.namespace, "ui_template").toLowerCase();
	const configuredFields = typedFields();
	const configuredHtml = templateHtml(marker);
	const page = await owner.context.newPage();
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	let releaseTemplateCatalog = () => {};
	const templateCatalogRelease = new Promise<void>((resolve) => {
		releaseTemplateCatalog = resolve;
	});
	let templateCatalogObserved = false;
	page.once("close", releaseTemplateCatalog);
	let initialTemplateCatalogPending = true;
	const templateCatalogPattern = "**/api/document-generation/templates*";
	await page.route(templateCatalogPattern, async (route) => {
		if (route.request().method() !== "GET" || !initialTemplateCatalogPending) {
			await route.continue();
			return;
		}
		initialTemplateCatalogPending = false;
		templateCatalogObserved = true;
		await templateCatalogRelease;
		await route.continue();
	});

	await page.goto("/document-generation/config");
	await expect(page.getByText("Elige un template", { exact: true })).toBeVisible();
	await expect.poll(() => templateCatalogObserved).toBe(true);
	const newTypeButton = page.getByRole("button", { name: "Nuevo tipo", exact: true });
	await expect(newTypeButton).toBeDisabled();
	releaseTemplateCatalog();
	await expect(page.getByText("Cargando templates...", { exact: true })).toBeHidden();
	await expect(newTypeButton).toBeEnabled();
	await page.unroute(templateCatalogPattern);
	await newTypeButton.click();

	const creator = page.locator("form").filter({ hasText: "Crear tipo documental" });
	await creator.getByPlaceholder("Ej. Contrato marco").first().fill("Documento QA");
	await creator.getByPlaceholder("CONTRATO_MARCO").fill(documentType);
	await creator.getByPlaceholder("Ej. Contrato marco").last().fill(initialName);
	await creator.getByRole("combobox").filter({ hasText: "Sin carpeta fija" }).click();
	await page.getByRole("option", { name: "Documentos E2E", exact: true }).click();
	await creator
		.getByPlaceholder("Uso interno de este tipo documental")
		.fill("Configuracion creada desde la interfaz E2E");
	await creator.getByRole("button", { name: "Crear tipo", exact: true }).click();

	await expect(page.getByText("Tipo documental creado.", { exact: true })).toBeVisible();
	await expect(templateNameInput(page)).toHaveValue(initialName);
	await templateNameInput(page).fill(editedName);
	await page.getByRole("button", { name: "JSON", exact: true }).click();
	await fieldsJsonEditor(page).fill(JSON.stringify(configuredFields, null, 2));
	await page.getByRole("button", { name: "Aplicar JSON", exact: true }).click();
	await expect(page.getByText("Campos actualizados desde JSON.", { exact: true })).toBeVisible();
	await (await openHtmlEditor(page)).fill(configuredHtml);
	await page.getByRole("button", { name: "Guardar configuracion", exact: true }).click();
	await expect(page.getByText("Template guardada para este tenant.", { exact: true })).toBeVisible();

	const persistedResult = await owner.db
		.from("document_generation_templates")
		.select("id, tenant_id, name, document_type, target_folder_path, status, schema, content_html")
		.eq("tenant_id", scenario.tenants.a)
		.eq("document_type", documentType)
		.single();
	expect(persistedResult.error).toBeNull();
	const persisted = templateDatabaseRowSchema.parse(persistedResult.data);
	expect(persisted).toMatchObject({
		tenant_id: scenario.tenants.a,
		name: editedName,
		document_type: documentType,
		target_folder_path: folderPath,
		status: "active",
	});
	expect(persisted.schema.fields).toMatchObject(configuredFields);
	expect(persisted.content_html).toContain(`data-e2e-template="${marker}"`);

	const freshContext = await scenario.newContext("owner");
	try {
		const freshPage = await freshContext.newPage();
		freshPage.setDefaultTimeout(15_000);
		freshPage.setDefaultNavigationTimeout(60_000);
		await freshPage.goto("/document-generation/config");
		const storedTemplateCard = freshPage
			.getByRole("button")
			.filter({ hasText: editedName });
		await expect(storedTemplateCard).toHaveCount(1);
		await storedTemplateCard.click();
		await expect(templateNameInput(freshPage)).toHaveValue(editedName);
		await freshPage.getByRole("button", { name: "JSON", exact: true }).click();
		await expect(fieldsJsonEditor(freshPage)).toContainText('"key": "amount"');
		await expect(await openHtmlEditor(freshPage)).toHaveValue(configuredHtml);

		await freshPage.goto(
			`/document-generation?workId=${encodeURIComponent(obra.id)}&folder=${folderPath}&documentType=${documentType}`,
		);
		await freshPage.getByRole("button", { name: "Formulario", exact: true }).click();
		const titleInput = freshPage.getByPlaceholder("Completar titulo contractual");
		const amountInput = freshPage.getByPlaceholder("Completar monto acordado");
		const dateInput = freshPage.getByPlaceholder("Completar fecha de emision");
		await expect(titleInput).toBeVisible();
		await expect(amountInput).toHaveAttribute("type", "number");
		await expect(dateInput).toHaveAttribute("type", "date");

		await freshPage.getByRole("button", { name: "Generar documento", exact: true }).click();
		const validationReview = freshPage.locator("section").filter({
			has: freshPage.getByRole("heading", { name: "Revision", exact: true }),
		});
		await expect(validationReview.getByText("Titulo contractual es obligatorio.", { exact: true })).toBeVisible();
		await expect(validationReview.getByText("Monto acordado es obligatorio.", { exact: true })).toBeVisible();
		await expect(validationReview.getByText("Fecha de emision es obligatorio.", { exact: true })).toBeVisible();
		await expect(validationReview.getByText("Categoria de riesgo es obligatorio.", { exact: true })).toBeVisible();
		const invalidGeneration = await owner.db.from("generated_documents").select("id").eq("obra_id", obra.id);
		expect(invalidGeneration.error).toBeNull();
		expect(invalidGeneration.data).toEqual([]);

		await freshPage.getByRole("button", { name: "Formulario", exact: true }).click();
		await titleInput.fill("Acuerdo persistido");
		await amountInput.fill("1250.50");
		await dateInput.fill("2026-10-19");
		await freshPage.getByRole("combobox").filter({ hasText: "Seleccionar categoria de riesgo" }).click();
		await freshPage.getByRole("option", { name: "Riesgo alto", exact: true }).click();
		await expect(validationReview.getByText(
			"Todo lo obligatorio esta completo. Ya puedes generar el documento.", { exact: true },
		)).toBeVisible();

		const preview = freshPage.locator(".report-preview-container");
		await expect(preview).toContainText("Acuerdo persistido");
		await expect(preview).toContainText("1250.50");
		await expect(preview).toContainText("2026-10-19");
		await expect(preview).toContainText("high");

		const draftResponsePromise = freshPage.waitForResponse((response) =>
			response.url().includes("/api/document-generation/drafts")
			&& response.request().method() === "POST",
		);
		await freshPage.getByRole("button", { name: "Guardar borrador", exact: true }).click();
		const draftResponse = await draftResponsePromise;
		expect(draftResponse.status()).toBe(200);
		const savedDraft = draftMutationResponseSchema.parse(await draftResponse.json()).draft;
		expect(savedDraft).toMatchObject({
			status: "READY_TO_GENERATE",
			input_data: {
				title: "Acuerdo persistido",
				amount: "1250.50",
				issue_date: "2026-10-19",
				risk: "high",
			},
			validation_errors: [],
		});

		const recovered = await readDraft(freshContext.request, savedDraft.id);
		expect(recovered).toMatchObject({
			id: savedDraft.id,
			workId: obra.id,
			folderPath,
			documentType,
			templateId: persisted.id,
			status: "READY_TO_GENERATE",
			inputData: savedDraft.input_data,
			validationErrors: [],
			canEdit: true,
		});

		const generateResponsePromise = freshPage.waitForResponse(
			(response) =>
				response.request().method() === "POST"
				&& response.url().includes("/api/document-generation/generate"),
			{ timeout: 90_000 },
		);
		await freshPage.getByRole("button", { name: "Generar documento", exact: true }).click();
		const generateResponse = await generateResponsePromise;
		const generatePayload: unknown = await generateResponse.json();
		expect(generateResponse.status(), JSON.stringify(generatePayload)).toBe(200);
		const generated = generatedResponseSchema.parse(generatePayload);
		expect(generated).toMatchObject({
			generatedDocument: {
				status: "UNDER_REVIEW",
				storage_bucket: "obra-documents",
				input_data: savedDraft.input_data,
			},
			relativeFolderPath: folderPath,
		});
		expect(generated.generatedDocument.storage_path).toBe(
			`${obra.id}/${folderPath}/${generated.generatedDocument.file_name}`,
		);
		expect(generated.relativeFilePath).toBe(
			`${folderPath}/${generated.generatedDocument.file_name}`,
		);
		expect(generated.previewHtml).toContain(`data-e2e-template="${marker}"`);

		const generatedResult = await owner.db
			.from("generated_documents")
			.select("id, tenant_id, obra_id, folder_path, document_type, template_id, source_draft_id, storage_bucket, storage_path, file_name, status, input_data, generated_by")
			.eq("id", generated.generatedDocument.id)
			.single();
		expect(generatedResult.error).toBeNull();
		const storedDocument = generatedDatabaseRowSchema.parse(generatedResult.data);
		const obraDocuments = await owner.db.from("generated_documents").select("id").eq("obra_id", obra.id);
		expect(obraDocuments.error).toBeNull();
		expect(obraDocuments.data).toEqual([{ id: storedDocument.id }]);
		expect(storedDocument).toMatchObject({
			id: generated.generatedDocument.id,
			tenant_id: scenario.tenants.a,
			obra_id: obra.id,
			folder_path: folderPath,
			document_type: documentType,
			template_id: persisted.id,
			source_draft_id: savedDraft.id,
			storage_bucket: "obra-documents",
			storage_path: generated.generatedDocument.storage_path,
			file_name: generated.generatedDocument.file_name,
			status: "UNDER_REVIEW",
			input_data: savedDraft.input_data,
			generated_by: owner.userId,
		});

		const download = await freshContext.request.get(
			`/api/obras/${obra.id}/documents/access?${new URLSearchParams({
				path: storedDocument.storage_path,
				download: "1",
			})}`,
		);
		await expectPdfContent(download, [
			"Acuerdo persistido",
			"1250.50",
			"2026-10-19",
			"high",
		]);
	} finally {
		await freshContext.close();
	}
});

test("invalid template and typed draft payloads remain recoverable without phantom writes", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: buildExcelObraName(`${scenario.namespace} template recovery`),
	});
	const marker = codeFor(scenario.namespace, "payload_recovery").toLowerCase();
	const name = `${scenario.namespace} payload recovery`;
	const validPayload = buildTemplatePayload({
		name,
		documentType,
		marker,
		targetFolderPath: folderPath,
	});
	const duplicatedFields = [
		...typedFields(),
		{ key: "title", label: "Titulo duplicado", type: "text", required: false },
	] satisfies TemplateFieldInput[];

	const invalidTemplateResponse = await owner.request.post(
		"/api/document-generation/templates",
		{
			data: {
				...validPayload,
				schema: { ...validPayload.schema, fields: duplicatedFields },
			},
		},
	);
	const invalidTemplateError = await expectErrorResponse(invalidTemplateResponse, 400);
	expect(invalidTemplateError.error).toBe("Los campos deben tener key unica.");
	const absentAfterFailure = await owner.db
		.from("document_generation_templates")
		.select("id")
		.eq("tenant_id", scenario.tenants.a)
		.eq("document_type", documentType);
	expect(absentAfterFailure.error).toBeNull();
	expect(absentAfterFailure.data).toEqual([]);

	const template = await createTemplateViaApi(owner, validPayload);
	const invalidInput = {
		title: "",
		amount: "not-a-number",
		issue_date: "19/10/2026",
		risk: "unlisted-risk",
	};
	const invalidDraftResponse = await owner.request.post(
		"/api/document-generation/drafts",
		{
			data: {
				workId: obra.id,
				folderPath,
				documentType,
				templateId: template.id,
				inputData: invalidInput,
			},
		},
	);
	expect(invalidDraftResponse.status()).toBe(200);
	const invalidDraft = draftMutationResponseSchema.parse(
		await invalidDraftResponse.json(),
	).draft;
	expect(invalidDraft.status).toBe("DRAFT");
	expect(invalidDraft.input_data).toMatchObject(invalidInput);
	expect(invalidDraft.validation_errors).toEqual([
		{ key: "title", message: "Titulo contractual es obligatorio." },
		{ key: "amount", message: "Monto acordado debe ser numerico." },
		{ key: "issue_date", message: "Fecha de emision debe ser una fecha valida." },
		{ key: "risk", message: "Categoria de riesgo debe elegirse de la lista." },
	]);

	const correctedInput = {
		title: "Contrato recuperado",
		amount: "8450.75",
		issue_date: "2026-10-19",
		risk: "low",
	};
	const correctedDraftResponse = await owner.request.post(
		"/api/document-generation/drafts",
		{
			data: {
				id: invalidDraft.id,
				expectedUpdatedAt: invalidDraft.updated_at,
				workId: obra.id,
				folderPath,
				documentType,
				templateId: template.id,
				inputData: correctedInput,
			},
		},
	);
	expect(correctedDraftResponse.status()).toBe(200);
	const correctedDraft = draftMutationResponseSchema.parse(
		await correctedDraftResponse.json(),
	).draft;
	expect(correctedDraft).toMatchObject({
		id: invalidDraft.id,
		status: "READY_TO_GENERATE",
		input_data: correctedInput,
		validation_errors: [],
	});

	const freshContext = await scenario.newContext("owner");
	try {
		const recovered = await readDraft(freshContext.request, invalidDraft.id);
		expect(recovered).toMatchObject({
			id: invalidDraft.id,
			workId: obra.id,
			templateId: template.id,
			status: "READY_TO_GENERATE",
			inputData: correctedInput,
			validationErrors: [],
			canEdit: true,
		});
	} finally {
		await freshContext.close();
	}
});

test("template administration rejects unprivileged writes and known foreign tenant IDs", async ({
	scenario,
}) => {
	const ownerA = await scenario.actor("owner");
	const ownerB = await scenario.actor("otherOwner");
	const viewer = await scenario.actor("viewer");
	const foreignType = codeFor(scenario.namespace, "tenant_b_template");
	const foreignName = `${scenario.namespace} tenant B template`;
	const foreignPayload = buildTemplatePayload({
		name: foreignName,
		documentType: foreignType,
		marker: foreignType.toLowerCase(),
	});
	const foreignTemplate = await createTemplateViaApi(ownerB, foreignPayload);

	const ownerCatalogResponse = await ownerA.request.get(
		"/api/document-generation/templates",
	);
	expect(ownerCatalogResponse.status()).toBe(200);
	const ownerCatalog = templateCatalogResponseSchema.parse(
		await ownerCatalogResponse.json(),
	);
	expect(ownerCatalog.templates.map((template) => template.id)).not.toContain(
		foreignTemplate.id,
	);

	const foreignRlsRead = await ownerA.db
		.from("document_generation_templates")
		.select("id")
		.eq("id", foreignTemplate.id);
	expect(foreignRlsRead.error).toBeNull();
	expect(foreignRlsRead.data).toEqual([]);

	const foreignUpdateResponse = await ownerA.request.put(
		"/api/document-generation/templates",
		{
			data: {
				...foreignPayload,
				templateId: foreignTemplate.id,
				name: "Tenant A attempted overwrite",
			},
		},
	);
	const foreignUpdateError = await expectErrorResponse(foreignUpdateResponse, 404);
	expect(foreignUpdateError.error).toBe("Template no encontrada.");

	const blockedType = codeFor(scenario.namespace, "viewer_blocked");
	const blockedPayload = buildTemplatePayload({
		name: `${scenario.namespace} viewer blocked template`,
		documentType: blockedType,
		marker: blockedType.toLowerCase(),
	});
	const viewerApiResponse = await viewer.request.post(
		"/api/document-generation/templates",
		{ data: blockedPayload },
	);
	const viewerApiError = await expectErrorResponse(viewerApiResponse, 403);
	expect(viewerApiError.error).toBe("Sin permisos para crear plantillas.");

	const viewerDirectInsert = await viewer.db
		.from("document_generation_templates")
		.insert({
			tenant_id: scenario.tenants.a,
			key: blockedType.toLowerCase(),
			name: blockedPayload.name,
			description: blockedPayload.description,
			document_type: blockedType,
			target_folder_path: null,
			version: 1,
			schema: blockedPayload.schema,
			content_html: blockedPayload.contentHtml,
			status: "active",
			is_system: false,
			created_by: viewer.userId,
		})
		.select("id");
	expect(viewerDirectInsert.error?.code).toBe("42501");

	const blockedRows = await ownerA.db
		.from("document_generation_templates")
		.select("id")
		.eq("tenant_id", scenario.tenants.a)
		.eq("document_type", blockedType);
	expect(blockedRows.error).toBeNull();
	expect(blockedRows.data).toEqual([]);

	const viewerPage = await viewer.context.newPage();
	await viewerPage.goto("/document-generation/config");
	await expect(
		viewerPage.getByText("No tienes permisos para editar configuracion de plantillas.", {
			exact: true,
		}),
	).toBeVisible();

	const freshTenantBContext = await scenario.newContext("otherOwner");
	try {
		const foreignCatalogResponse = await freshTenantBContext.request.get(
			"/api/document-generation/templates",
		);
		expect(foreignCatalogResponse.status()).toBe(200);
		const foreignCatalog = templateCatalogResponseSchema.parse(
			await foreignCatalogResponse.json(),
		);
		expect(
			foreignCatalog.templates.find((template) => template.id === foreignTemplate.id),
		).toMatchObject({
			id: foreignTemplate.id,
			name: foreignName,
			documentType: foreignType,
			contentHtml: foreignPayload.contentHtml,
		});
	} finally {
		await freshTenantBContext.close();
	}
});
