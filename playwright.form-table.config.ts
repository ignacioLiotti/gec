import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/components/form-table/browser",
	testMatch: "**/*.spec.ts",
	fullyParallel: false,
	workers: 1,
	timeout: 30_000,
	expect: { timeout: 8_000 },
	reporter: "list",
	outputDir: "test-results/form-table",
	use: {
		channel: process.env.PLAYWRIGHT_CHANNEL,
		baseURL: "http://127.0.0.1:4317",
		viewport: { width: 1280, height: 900 },
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "node tests/components/form-table/browser/serve.mjs",
		url: "http://127.0.0.1:4317",
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
