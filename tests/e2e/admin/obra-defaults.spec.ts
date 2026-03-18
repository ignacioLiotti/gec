import { expect, test } from "@playwright/test";

test.describe("Obra defaults authoring", () => {
	test("builds a certificados recipe with resumen and items datasets", async ({ page }) => {
		let createPayload: Record<string, unknown> | null = null;

		await page.route("**/api/ocr-templates", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					templates: [
						{
							id: "tmpl-certificados",
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
				createPayload = (request.postDataJSON() as Record<string, unknown>) ?? null;
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
							extractedTables: (createPayload?.extractedTables as unknown[]) ?? [],
						},
					}),
				});
				return;
			}

			await route.continue();
		});

		await page.goto("/admin/obra-defaults");
		await page.waitForLoadState("networkidle");

		await page.getByRole("tab", { name: /extracci/i }).click();
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

		await page.getByTestId("extracted-table-tab-0").click();
		await expect(page.getByTestId("active-dataset-name")).toHaveValue("resumen");
		await page.getByTestId("ocr-template-select").click();
		await page.getByRole("option", { name: /certificados ocr/i }).click();

		await page.getByTestId("folder-wizard-continue").click();
		await expect(page.locator('input[value="Nro certificado"]').first()).toBeVisible();

		await page.getByTestId("folder-wizard-continue").click();
		await page.getByTestId("folder-wizard-save").click();

		expect(createPayload).not.toBeNull();
		const payload = createPayload as unknown as Record<string, unknown>;
		expect(payload.name).toBe("Certificados");
		const extractedTables = (payload.extractedTables as Array<Record<string, unknown>>) ?? [];
		expect(extractedTables).toHaveLength(2);
		expect(extractedTables[0]?.name).toBe("resumen");
		expect(extractedTables[0]?.rowMode).toBe("single");
		expect(extractedTables[1]?.name).toBe("items");
		expect(extractedTables[1]?.rowMode).toBe("multiple");
		expect(extractedTables.every((table) => table.spreadsheetTemplate === "certificado")).toBe(true);
	});
});
