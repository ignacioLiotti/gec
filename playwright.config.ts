import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFiles() {
	const cwd = process.cwd();
	const nodeEnv = process.env.NODE_ENV ?? "development";
	const envFiles = [
		".env",
		".env.local",
		`.env.${nodeEnv}`,
		`.env.${nodeEnv}.local`,
	];

	for (const file of envFiles) {
		const filePath = resolve(cwd, file);
		if (!existsSync(filePath)) continue;

		const content = readFileSync(filePath, "utf8");
		for (const line of content.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			const separatorIndex = trimmed.indexOf("=");
			if (separatorIndex === -1) continue;

			const key = trimmed.slice(0, separatorIndex).trim();
			if (!key || key in process.env) continue;

			const rawValue = trimmed.slice(separatorIndex + 1).trim();
			const unquoted =
				(rawValue.startsWith('"') && rawValue.endsWith('"')) ||
				(rawValue.startsWith("'") && rawValue.endsWith("'"))
					? rawValue.slice(1, -1)
					: rawValue;

			process.env[key] = unquoted.replace(/\\n/g, "\n");
		}
	}
}

loadEnvFiles();

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const authFile = "playwright/.auth/user.json";
const webServerCommand =
	process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "npm run dev";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true";
const slowMo = Number.parseInt(
	process.env.PLAYWRIGHT_SLOW_MO_MS ?? "0",
	10,
);

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 60_000,
	expect: {
		timeout: 15_000,
	},
	fullyParallel: false,
	retries: process.env.CI ? 2 : 0,
	reporter: "list",
	outputDir: "test-results/playwright",
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		launchOptions: slowMo > 0 ? { slowMo } : undefined,
	},
	webServer: skipWebServer
		? undefined
		: {
			command: webServerCommand,
			url: baseURL,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
			use: {},
		},
		{
			name: "chromium",
			testIgnore: /auth\.setup\.ts/,
			use: {
				...devices["Desktop Chrome"],
				storageState: authFile,
			},
			dependencies: ["setup"],
		},
	],
});
