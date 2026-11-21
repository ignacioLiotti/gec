import { expect, test } from "../fixtures/test";
import { z } from "zod";

const certificadosTemplateId = "00000000-0000-4000-8000-000000000101";
const otherDocumentsTemplateId = "00000000-0000-4000-8000-000000000102";

const createFolderPayloadSchema = z
	.object({
		name: z.string(),
		extractedTables: z.array(
			z
				.object({
					name: z.string(),
					rowMode: z.string(),
					spreadsheetTemplate: z.string(),
					ocrTemplateId: z.string(),
					columns: z.array(z.object({ fieldKey: z.string() }).passthrough()),
				})
				.passthrough(),
		),
	})
	.passthrough();

test.describe("Obra defaults authoring", () => {
	test("builds a certificados recipe with resumen and items datasets", async ({ page }) => {
		let capturedCreatePayload: unknown;

		await page.route("**/api/ocr-templates", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					templates: [
						{
							id: certificadosTemplateId,
							name: "Certificados OCR",
							description: "Template de prueba para certificados",
							template_file_name: "certificados.png",
							regions: [],
							columns: [
								{ fieldKey: "nro_certificado", label: "Nro certificado", dataType: "text" },
								{ fieldKey: "fecha", label: "Fecha", dataType: "date" },
							],
							is_active: true,
						},
						{
							id: otherDocumentsTemplateId,
							name: "Otros documentos",
							description: "Plantilla alternativa de prueba",
							template_file_name: "otros-documentos.png",
							regions: [],
							columns: [],
							is_active: true,
						},
					],
				}),
			});
		});

		await page.route("**/api/obra-defaults", async (route) => {
			const request = route.request();
			if (request.method() === "GET") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ folders: [], quickActions: [] }),
				});
				return;
			}

			if (request.method() === "POST") {
				const createPayload = createFolderPayloadSchema.parse(
					request.postDataJSON(),
				);
				capturedCreatePayload = createPayload;
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						folder: {
							id: "folder-certificados",
							name: "Certificados",
							path: "certificados",
							position: 0,
							isOcr: true,
							extractedTables: createPayload.extractedTables,
						},
					}),
				});
				return;
			}

			await route.continue();
		});

		await page.goto("/admin/obra-defaults");

		await page.getByRole("tab", {
			name: "Datos automáticos",
			exact: true,
		}).click();
		await page.getByTestId("open-data-folder-dialog").click();

		await page.getByTestId("folder-name-input").fill("Certificados");
		await page.getByTestId("folder-wizard-continue").click();

		await page.getByTestId("folder-recipe-certificados").click();
		await expect(page.getByTestId("extracted-table-tab-0")).toContainText(/resumen/i);
		await expect(page.getByTestId("extracted-table-tab-1")).toContainText(/items/i);

		await page.getByTestId("extracted-table-tab-1").click();
		await expect(page.getByTestId("active-dataset-name")).toHaveValue("items");
		await page.getByTestId("ocr-template-select").click();
		await page.getByRole("option", { name: /certificados ocr/i }).click();
		await expect(page.getByTestId("ocr-template-select")).toContainText(
			"Certificados OCR",
		);

		await page.getByTestId("extracted-table-tab-0").click();
		await expect(page.getByTestId("active-dataset-name")).toHaveValue("resumen");
		await expect(page.getByTestId("ocr-template-select")).toContainText(
			"Elegí el tipo de documento",
		);
		await page.getByTestId("ocr-template-select").click();
		await page.getByRole("option", { name: /certificados ocr/i }).click();
		await expect(page.getByTestId("ocr-template-select")).toContainText(
			"Certificados OCR",
		);

		await page.getByTestId("folder-wizard-continue").click();
		await expect(page.locator('input[value="Nro certificado"]').first()).toBeVisible();

		await page.getByTestId("folder-wizard-continue").click();
		const saveButton = page.getByTestId("folder-wizard-save");
		await expect(saveButton).toBeEnabled();
		await saveButton.click();

		const createPayload = createFolderPayloadSchema.parse(capturedCreatePayload);
		expect(createPayload.name).toBe("Certificados");
		const extractedTables = createPayload.extractedTables;
		expect(extractedTables).toHaveLength(2);
		expect(extractedTables[0]?.name).toBe("resumen");
		expect(extractedTables[0]?.rowMode).toBe("single");
		expect(extractedTables[1]?.name).toBe("items");
		expect(extractedTables[1]?.rowMode).toBe("multiple");
		expect(extractedTables.every((table) => table.spreadsheetTemplate === "certificado")).toBe(true);
		expect(
			extractedTables.every(
				(table) => table.ocrTemplateId === certificadosTemplateId,
			),
		).toBe(true);
		expect(
			extractedTables.map((table) =>
				table.columns.map((column) => column.fieldKey),
			),
		).toEqual([
			["nro_certificado", "fecha"],
			["nro_certificado", "fecha"],
		]);
	});
});
