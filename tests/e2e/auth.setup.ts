import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { ensureE2EUser } from "./helpers/auth";

const authFile = path.join(process.cwd(), "playwright", ".auth", "user.json");

setup("authenticate e2e user", async ({ page }) => {
	const email = process.env.E2E_EMAIL;
	const password = process.env.E2E_PASSWORD;

	if (!email || !password) {
		throw new Error(
			"Missing E2E_EMAIL or E2E_PASSWORD. Define both variables before running Playwright.",
		);
	}

	await ensureE2EUser({ email, password });

	await page.goto("/excel");

	const authDialog = page.getByRole("dialog");
	await expect(authDialog).toBeVisible();

	const otherMethodsButton = page.getByRole("button", {
		name: /otros metodos/i,
	});
	if (await otherMethodsButton.isVisible()) {
		await otherMethodsButton.click();
	}

	await authDialog.getByLabel(/correo electr/i).fill(email);
	await authDialog.getByLabel(/contrase/i).fill(password);
	await authDialog.getByRole("button", { name: /iniciar sesi/i }).click();

	await expect(
		page.getByRole("button", { name: email, exact: true }),
	).toBeVisible();
	await page.goto("/excel");

	if (page.url().includes("/onboarding")) {
		throw new Error(
			"The configured E2E user authenticated correctly but has no tenant membership. Assign the user to a tenant before running the UI flow.",
		);
	}

	await expect(
		page.getByRole("heading", { name: /panel de obras/i }),
	).toBeVisible();

	fs.mkdirSync(path.dirname(authFile), { recursive: true });
	await page.context().storageState({ path: authFile });
});
