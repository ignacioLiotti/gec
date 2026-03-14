import { expect, test } from "@playwright/test";
import { ensureNavigationObra } from "./helpers/obras";

test("navigates from /excel to /excel/[obraId]", async ({ page, request }) => {
	const obra = await ensureNavigationObra(request);
	await page.setViewportSize({ width: 390, height: 844 });

	await page.goto("/excel");

	await expect(
		page.getByRole("heading", { name: /panel de obras/i }),
	).toBeVisible();
	const openDetailLink = page.locator(`a[href="/excel/${obra.id}"]`).first();
	await expect(openDetailLink).toBeVisible();

	await Promise.all([
		page.waitForURL(new RegExp(`/excel/${obra.id}$`)),
		openDetailLink.click(),
	]);

	await expect(page).toHaveURL(new RegExp(`/excel/${obra.id}$`));
	await expect(page.getByRole("tab", { name: /general/i })).toBeVisible();
});
