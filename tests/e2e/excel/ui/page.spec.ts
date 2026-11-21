import { expect, test } from "../../fixtures/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
} from "../../helpers/obras";
import { z } from "zod";

const bulkSavePayloadSchema = z.object({
	updates: z.array(
		z.object({
			designacionYUbicacion: z.string(),
			contratoMasAmpliaciones: z.number(),
		}),
	),
});

const obraCellIndex = {
	designacionYUbicacion: 1,
	entidadContratante: 3,
	mesBasicoDeContrato: 4,
	iniciacion: 5,
	contratoMasAmpliaciones: 6,
} as const;

const editObraCell = async (
	page: import("@playwright/test").Page,
	row: import("@playwright/test").Locator,
	field: keyof typeof obraCellIndex,
	value: string,
) => {
	await row.getByRole("cell").nth(obraCellIndex[field]).click();
	const editor = page.locator(":focus");
	await expect(editor).toHaveAttribute("data-field", field);
	await editor.fill(value);
	await editor.press("Tab");
};

test.describe("Excel page microflows", () => {
	test.use({
		viewport: { width: 1440, height: 960 },
	});

	test("creates and saves a new obra from /excel", async ({ page, scenario }) => {
		const designacionYUbicacion = buildExcelObraName(`${scenario.namespace} UI Save`);

		await page.goto("/excel");

		await expect(
			page.getByRole("heading", { name: "Tus Obras", exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Papelera obras", exact: true }),
		).toBeVisible();

		const columnsButton = page.getByRole("button", { name: "Columnas", exact: true });
		await columnsButton.click();
		const columnsMenu = page.getByRole("menu", { name: "Columnas" });
		await expect(columnsMenu).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(columnsMenu).toBeHidden();
		await expect(columnsButton).toBeFocused();

		await page.getByTestId("form-table-add-row").click();
		const dataRows = page
			.getByRole("table")
			.getByRole("rowgroup")
			.last()
			.getByRole("row");
		await expect(dataRows).toHaveCount(1);
		const newRow = dataRows.first();

		await editObraCell(
			page,
			newRow,
			"designacionYUbicacion",
			designacionYUbicacion,
		);
		await editObraCell(page, newRow, "entidadContratante", "UI Save Tenant");
		await editObraCell(page, newRow, "mesBasicoDeContrato", "01/01/2025");
		await editObraCell(page, newRow, "iniciacion", "15/01/2025");
		await editObraCell(page, newRow, "contratoMasAmpliaciones", "123456");
		await expect(newRow.getByRole("cell").nth(1)).toContainText(
			designacionYUbicacion,
		);
		await expect(newRow.getByRole("cell").nth(6)).toContainText("123.456,00");

		const saveButton = page.getByTestId("form-table-save");
		await expect(saveButton).toBeEnabled();

		const saveRequest = page.waitForResponse((response) => {
			const request = response.request();
			return (
				new URL(response.url()).pathname === "/api/obras/bulk" &&
				request.method() === "PATCH" &&
				response.ok()
			);
		});

		const [saveResponse] = await Promise.all([
			saveRequest,
			saveButton.click(),
		]);
		const savePayload = bulkSavePayloadSchema.parse(
			saveResponse.request().postDataJSON(),
		);
		expect(savePayload.updates).toContainEqual(
			expect.objectContaining({
				designacionYUbicacion,
				contratoMasAmpliaciones: 123456,
			}),
		);

		await page.reload();
		await expect(
			page.getByRole("link", { name: "Papelera obras", exact: true }),
		).toBeVisible();
		const searchInput = page.getByTestId("form-table-search");
		await expect(searchInput).toBeVisible();
		await searchInput.fill(designacionYUbicacion);

		const persistedRow = page.getByRole("row").filter({
			has: page.getByRole("cell", {
				name: designacionYUbicacion,
				exact: true,
			}),
		});
		await expect(persistedRow).toHaveCount(1);
		await expect(persistedRow.getByRole("cell").nth(6)).toContainText(
			"123.456,00",
		);
	});

	test("search and tabs isolate in-process vs completed obras", async ({
		page,
		request,
		scenario,
	}) => {
		const nameBase = buildExcelObraName(`${scenario.namespace} UI Filter`);
		const inProcessName = `${nameBase} InProcess`;
		const completedName = `${nameBase} Completed`;

		await createObraViaBulkApi(request, {
			designacionYUbicacion: inProcessName,
			porcentaje: 25,
		});
		await createObraViaBulkApi(request, {
			designacionYUbicacion: completedName,
			porcentaje: 100,
		});

		await page.goto("/excel");

		const searchInput = page.getByTestId("form-table-search");
		await expect(searchInput).toBeVisible();
		await searchInput.fill(nameBase);

		await page.getByRole("tab", { name: /todas/i }).click();
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
