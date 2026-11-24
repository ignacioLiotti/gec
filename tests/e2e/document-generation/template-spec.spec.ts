import { z } from "zod";

import { expect, test } from "../fixtures/test";
import { buildExcelObraName, createObraViaBulkApi } from "../helpers/obras";

const folderPath = "documentos-e2e";
const documentType = "DOCUMENTO";

const guideSchema = z.object({
	format: z.literal("sintesis.template-spec"),
	steps: z.array(z.string()).min(4),
	sources: z.array(z.object({ key: z.string(), attributes: z.array(z.object({ key: z.string() }).passthrough()) }).passthrough()),
	example: z.object({ version: z.literal(1), sections: z.array(z.unknown()) }).passthrough(),
}).passthrough();

const issuesSchema = z.object({
	ok: z.literal(false),
	errors: z.array(z.object({ path: z.string(), message: z.string() })).min(1),
}).passthrough();

const templateResponseSchema = z.object({
	template: z.object({
		id: z.string().uuid(),
		version: z.number(),
		schema: z.object({
			fields: z.array(z.object({ key: z.string(), type: z.string() }).passthrough()),
			spec: z.object({ version: z.literal(1) }).passthrough().nullable().optional(),
		}).passthrough(),
	}).passthrough(),
}).passthrough();

const recordsSchema = z.object({
	records: z.record(z.string(), z.array(z.object({ id: z.string(), label: z.string(), values: z.record(z.string(), z.unknown()) }))),
});

function receptionSpec(name: string) {
	return {
		version: 1,
		name,
		documentType,
		targetFolderPath: folderPath,
		numberPrefix: "REC-",
		sections: [
			{ kind: "header" },
			{
				kind: "fields",
				title: "Datos",
				fields: [
					{ key: "responsable", label: "Recibió", type: "reference", required: true, reference: { source: "usuarios", display: "nombre", match: "email" } },
					{ key: "responsable_email", label: "Email de quien recibió", type: "lookup", lookup: { from: "responsable", attribute: "email" } },
				],
			},
			{
				kind: "table",
				key: "items",
				title: "Materiales",
				required: true,
				columns: [
					{ key: "descripcion", label: "Material", type: "text", required: true },
					{ key: "cantidad", label: "Cantidad", type: "number", required: true },
					{ key: "precio_unitario", label: "Precio unitario", type: "money", required: true },
					{ key: "precio_total", label: "Total", type: "formula", formula: "[cantidad] * [precio_unitario]" },
				],
			},
			{ kind: "totals", fields: [{ key: "total", label: "Total", type: "formula", formula: "SUMA(items.precio_total)" }] },
			{ kind: "signatures", labels: ["Recibió"] },
		],
	};
}

test("a client builds a linked template from the spec API and generation resolves links and formulas", async ({ scenario }) => {
	test.setTimeout(180_000);
	const owner = await scenario.actor("owner");

	// 1. Discover: the guide lists this tenant's sources and a working example.
	const guideResponse = await owner.request.get("/api/document-generation/spec");
	expect(guideResponse.status()).toBe(200);
	const guide = guideSchema.parse(await guideResponse.json());
	const sourceKeys = guide.sources.map((source) => source.key);
	expect(sourceKeys).toEqual(expect.arrayContaining(["usuarios", "obras", "tabla:documentos_e2e"]));

	// 2. Validate: errors name the path to fix.
	const broken = receptionSpec(`${scenario.namespace} Recepción`);
	(broken.sections[1] as { fields: Array<Record<string, unknown>> }).fields[1].lookup = { from: "no_existe", attribute: "email" };
	const brokenResponse = await owner.request.post("/api/document-generation/spec", { data: { spec: broken } });
	expect(brokenResponse.status()).toBe(422);
	expect(issuesSchema.parse(await brokenResponse.json()).errors[0].path).toBe("sections[1].fields[1].lookup.from");

	const spec = receptionSpec(`${scenario.namespace} Recepción`);
	const validResponse = await owner.request.post("/api/document-generation/spec", { data: { spec } });
	expect(validResponse.status()).toBe(200);
	const valid = z.object({ ok: z.literal(true), previewHtml: z.string() }).passthrough().parse(await validResponse.json());
	expect(valid.previewHtml).toContain("Materiales");

	// 3. Create: the template stores the spec and the linked field types.
	const createResponse = await owner.request.post("/api/document-generation/templates", { data: { spec } });
	const createPayload: unknown = await createResponse.json();
	expect(createResponse.status(), JSON.stringify(createPayload)).toBe(200);
	const created = templateResponseSchema.parse(createPayload).template;
	expect(created.schema.spec?.version).toBe(1);
	expect(created.schema.fields.find((field) => field.key === "responsable")?.type).toBe("reference");

	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: buildExcelObraName(`${scenario.namespace} recepcion`),
	});
	const recordsResponse = await owner.request.get(`/api/document-generation/sources?records=usuarios&workId=${obra.id}`);
	expect(recordsResponse.status()).toBe(200);
	const ownerRecord = recordsSchema.parse(await recordsResponse.json()).records.usuarios.find((record) => record.id === owner.userId);
	if (!ownerRecord) throw new Error("The owner is missing from the usuarios source.");
	const ownerName = String(ownerRecord.values.nombre);
	const ownerEmail = String(ownerRecord.values.email);

	// 4. Fill in the browser: choosing the user fills the email.
	const page = await owner.context.newPage();
	page.setDefaultTimeout(20_000);
	page.setDefaultNavigationTimeout(60_000);
	await page.goto(`/document-generation?workId=${encodeURIComponent(obra.id)}&folder=${folderPath}&documentType=${documentType}`);
	await page.getByRole("button", { name: "Formulario", exact: true }).click();
	await page.getByRole("combobox").filter({ hasText: "Seleccionar recibió" }).click();
	// The option adds the email only when it differs from the shown name.
	const optionName = ownerName === ownerEmail ? ownerName : `${ownerName} · ${ownerEmail}`;
	await page.getByRole("option", { name: optionName, exact: true }).click();
	await expect(page.getByPlaceholder("Completar email de quien recibió")).toHaveValue(ownerEmail);

	const draftResponsePromise = page.waitForResponse((response) =>
		response.url().includes("/api/document-generation/drafts") && response.request().method() === "POST",
	);
	await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
	const draftResponse = await draftResponsePromise;
	expect(draftResponse.status()).toBe(200);
	const draftInput = z.object({ draft: z.object({ input_data: z.record(z.string(), z.unknown()) }) }).parse(await draftResponse.json()).draft.input_data;
	expect(draftInput).toMatchObject({
		responsable: ownerName,
		responsable_email: ownerEmail,
		__refs: { responsable: owner.userId },
	});

	// 5. Generate: the server resolves the link and computes rows and totals.
	const rejected = await owner.request.post("/api/document-generation/generate", {
		data: {
			workId: obra.id,
			folderPath,
			documentType,
			templateId: created.id,
			inputData: { responsable: "Nadie Conocido", items: [{ descripcion: "Cemento", cantidad: "1", precio_unitario: "1" }] },
		},
	});
	expect(rejected.status()).toBe(400);
	expect(JSON.stringify(await rejected.json())).toContain("Recibió debe elegirse de la lista.");

	const generateResponse = await owner.request.post("/api/document-generation/generate", {
		data: {
			workId: obra.id,
			folderPath,
			documentType,
			templateId: created.id,
			inputData: {
				responsable: ownerEmail,
				items: [
					{ descripcion: "Cemento", cantidad: "120", precio_unitario: "9800" },
					{ descripcion: "Arena", cantidad: "6", precio_unitario: "38500" },
				],
			},
		},
	});
	const generatePayload: unknown = await generateResponse.json();
	expect(generateResponse.status(), JSON.stringify(generatePayload)).toBe(200);
	const generated = z.object({
		generatedDocument: z.object({ input_data: z.record(z.string(), z.unknown()) }).passthrough(),
		previewHtml: z.string(),
	}).passthrough().parse(generatePayload);
	expect(generated.generatedDocument.input_data).toMatchObject({
		responsable: ownerName,
		responsable_email: ownerEmail,
		total: 1407000,
		items: [
			{ descripcion: "Cemento", precio_total: 1176000 },
			{ descripcion: "Arena", precio_total: 231000 },
		],
	});
	expect(generated.previewHtml).toContain("$ 1.407.000,00");
	expect(generated.previewHtml).toContain(ownerEmail);
});

test("the visual builder opens a spec template and publishes a new version", async ({ scenario }) => {
	test.setTimeout(150_000);
	const owner = await scenario.actor("owner");
	const createResponse = await owner.request.post("/api/document-generation/templates", {
		data: { spec: receptionSpec(`${scenario.namespace} Recepción visual`) },
	});
	expect(createResponse.status()).toBe(200);
	const created = templateResponseSchema.parse(await createResponse.json()).template;

	const page = await owner.context.newPage();
	page.setDefaultTimeout(20_000);
	page.setDefaultNavigationTimeout(60_000);
	await page.goto(`/document-generation/builder?templateId=${created.id}`);
	await expect(page.getByRole("button", { name: /Recibió/ }).first()).toBeVisible();

	// Add a column to the table and make the total use it.
	await page.getByRole("button", { name: "Materiales", exact: true }).click();
	await page.getByRole("button", { name: "Número", exact: true }).click();
	const label = page.getByLabel("Etiqueta");
	await label.fill("Bonificación");
	await expect(page.getByLabel("Clave")).toHaveValue("bonificacion");

	await page.getByRole("button", { name: /^Total\s/ }).first().click();
	const formula = page.getByLabel("Fórmula");
	await formula.fill("[cantidad] * [precio_unitario] - [bonificacion]");
	await expect(page.getByText("Con datos de ejemplo")).toBeVisible();

	await page.getByRole("tab", { name: "Vista previa" }).click();
	await expect(page.frameLocator("iframe[title='Vista previa del documento']").getByText("Bonificación")).toBeVisible();

	const publishPromise = page.waitForResponse((response) =>
		response.url().endsWith("/api/document-generation/templates") && response.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Publicar", exact: true }).click();
	const publishResponse = await publishPromise;
	const publishPayload: unknown = await publishResponse.json();
	expect(publishResponse.status(), JSON.stringify(publishPayload)).toBe(200);
	const published = templateResponseSchema.parse(publishPayload).template;
	expect(published.version).toBe(created.version + 1);
	const items = published.schema.fields.find((field) => field.key === "items") as { columns?: Array<{ key: string; formula?: string | null }> } | undefined;
	expect(items?.columns?.map((column) => column.key)).toContain("bonificacion");
	expect(items?.columns?.find((column) => column.key === "precio_total")?.formula).toBe("[cantidad] * [precio_unitario] - [bonificacion]");
	await expect(page).toHaveURL(new RegExp(`templateId=${published.id}`));
});
