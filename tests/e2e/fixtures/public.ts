import { expect, test as base } from "@playwright/test";

export const test = base.extend({
	context: async ({ browser, contextOptions, baseURL }, provide) => {
		if (!baseURL) throw new Error("The public fixture requires an owned app URL.");
		const appOrigin = new URL(baseURL).origin;
		const context = await browser.newContext({ ...contextOptions, storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });
		await context.route("**/*", (route) => new URL(route.request().url()).origin === appOrigin ? route.continue() : route.abort("blockedbyclient"));
		try { await provide(context); } finally { await context.close(); }
	},
});

export { expect };
