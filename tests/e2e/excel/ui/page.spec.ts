import { expect, test } from "@playwright/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
	deleteObrasByNames,
} from "../../helpers/obras";

test.describe("Excel page microflows", () => {
	test.use({
		viewport: { width: 1440, height: 960 },
	});

	const createdNames: string[] = [];
	const obraInput = (page: import("@playwright/test").Page, field: string) =>
		page.locator(`input[data-field="${field}"]`).first();

	test.afterEach(async () => {
		await deleteObrasByNames(createdNames.splice(0));
	});

	test("creates and saves a new obra from /excel", async ({ page }) => {
		const designacionYUbicacion = buildExcelObraName("UI Save");
		createdNames.push(designacionYUbicacion);

		await page.goto("/excel");

		await expect(
			page.getByRole("heading", { name: /panel de obras/i }),
		).toBeVisible();
		await page.waitForLoadState("networkidle");

		await page.getByTestId("form-table-add-row").click();

		await expect(obraInput(page, "designacionYUbicacion")).toBeVisible();

		await obraInput(page, "designacionYUbicacion").fill(designacionYUbicacion);
		await obraInput(page, "entidadContratante").fill("UI Save Tenant");
		await obraInput(page, "mesBasicoDeContrato").fill("01/01/2025");
		await obraInput(page, "iniciacion").fill("15/01/2025");
		await obraInput(page, "iniciacion").press("Tab");

		const saveButton = page.getByTestId("form-table-save");
		await expect(saveButton).toBeEnabled();

		const saveRequest = page.waitForResponse((response) => {
			const request = response.request();
			return (
				response.url().includes("/api/obras") &&
				request.method() === "PUT" &&
				response.ok()
			);
		});

		await Promise.all([
			saveRequest,
			saveButton.click(),
		]);

		await page.reload();
		await page.waitForLoadState("networkidle");
		await page.getByTestId("form-table-search").fill(designacionYUbicacion);

		await expect(obraInput(page, "designacionYUbicacion")).toHaveValue(
			designacionYUbicacion,
		);
	});

	test("search and tabs isolate in-process vs completed obras", async ({
		page,
		request,
	}) => {
		const nameBase = buildExcelObraName("UI Filter");
		const inProcessName = `${nameBase} InProcess`;
		const completedName = `${nameBase} Completed`;
		createdNames.push(inProcessName, completedName);

		await createObraViaBulkApi(request, {
			designacionYUbicacion: inProcessName,
			porcentaje: 25,
		});
		await createObraViaBulkApi(request, {
			designacionYUbicacion: completedName,
			porcentaje: 100,
		});

		await page.goto("/excel");
		await page.waitForLoadState("networkidle");

		const searchInput = page.getByTestId("form-table-search");
		await searchInput.fill(nameBase);

		await expect(page.getByRole("cell", { name: inProcessName })).toBeVisible();
		await expect(page.getByRole("cell", { name: completedName })).toBeVisible();

		await page.getByRole("tab", { name: /en proceso/i }).click();
		await expect(page.getByRole("cell", { name: inProcessName })).toBeVisible();
		await expect(page.getByRole("cell", { name: completedName })).toHaveCount(0);

		await page.getByRole("tab", { name: /completadas/i }).click();
		await expect(page.getByRole("cell", { name: completedName })).toBeVisible();
		await expect(page.getByRole("cell", { name: inProcessName })).toHaveCount(0);
	});
});
