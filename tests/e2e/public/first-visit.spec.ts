import { expect, test } from "../fixtures/public";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
	test(`first visitor can review information and start signup at ${viewport.width}px`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize(viewport);
		await page.goto("/");

		const contactTrigger = page.getByRole("button", { name: "Consultar precios y condiciones", exact: true });
		await contactTrigger.click();
		const dialog = page.getByRole("dialog", { name: "Consultar precios y condiciones" });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel(/^Nombre/).fill("Primera visita QA");
		await expect(dialog.getByLabel(/^Nombre/)).toHaveValue("Primera visita QA");
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(contactTrigger).toBeFocused();

		await page.getByRole("link", { name: "Política de privacidad", exact: true }).click();
		await expect(page).toHaveURL(/\/privacy$/);
		await expect(page.getByRole("heading", { name: /privacidad/i }).first()).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);

		await page.goBack();
		await page.getByRole("link", { name: "Crear cuenta", exact: true }).click();
		await expect(page).toHaveURL(/\/auth\/sign-up$/);
		const email = page.getByLabel("Correo electrónico", { exact: true });
		await email.fill("primera-visita@example.invalid");
		await expect(page.getByRole("button", { name: "Crear cuenta", exact: true })).toBeEnabled();

		const policyTabPromise = page.waitForEvent("popup");
		await page.getByRole("link", { name: /Política de privacidad/ }).click();
		const policyTab = await policyTabPromise;
		await expect(policyTab.getByRole("heading", { name: /privacidad/i }).first()).toBeVisible();
		await expect(policyTab.getByRole("dialog")).toHaveCount(0);
		await policyTab.close();
		await expect(email).toHaveValue("primera-visita@example.invalid");
	});
}
