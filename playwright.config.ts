import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

import { assertLocalE2ETarget } from "./tests/e2e/helpers/local-target";

const discoveryOnly = process.argv.includes("--list");
const reportDirectory = process.env.E2E_REPORT_DIR ?? "test-results/playwright";
const instanceSchema = z.object({
	kind: z.literal("owned-local-integration"),
	runId: z.string().uuid(),
	mode: z.enum(["public", "authenticated"]),
	workspace: z.string(),
	projectId: z.string(),
	appUrl: z.string().url(),
	supabaseUrl: z.string().url(),
	status: z.literal("running"),
});

function executionBaseUrl() {
	const manifestPath = process.env.E2E_INSTANCE_MANIFEST;
	if (!manifestPath) {
		throw new Error("Use npm run test:e2e or npm run test:e2e:public to create an owned isolated runtime.");
	}
	const instance = instanceSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
	if (
		dirname(resolve(manifestPath)) !== resolve(instance.workspace)
		|| instance.runId !== process.env.E2E_RUN_ID
		|| instance.mode !== process.env.E2E_MODE
		|| instance.projectId !== `e2e_${instance.runId.replaceAll("-", "")}`
		|| instance.appUrl !== process.env.PLAYWRIGHT_BASE_URL
		|| instance.supabaseUrl !== process.env.NEXT_PUBLIC_SUPABASE_URL
	) {
		throw new Error("Integration runtime ownership does not match this test process.");
	}
	const appUrl = new URL(instance.appUrl);
	if (appUrl.protocol !== "http:" || appUrl.hostname !== "127.0.0.1" || appUrl.username || appUrl.password) {
		throw new Error("The owned app must use a loopback HTTP address.");
	}
	if (instance.mode === "authenticated") {
		assertLocalE2ETarget({ kind: "execution", env: process.env });
	}
	return instance.appUrl;
}

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: discoveryOnly ? [["list"]] : [["list"], ["json", { outputFile: join(reportDirectory, "results.json") }]],
	outputDir: join(reportDirectory, "artifacts"),
	use: {
		baseURL: discoveryOnly ? "http://127.0.0.1:3000" : executionBaseUrl(),
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{ name: "public", testMatch: /public[\\/].*\.spec\.ts/, use: { storageState: { cookies: [], origins: [] } } },
		{ name: "authenticated", testIgnore: /public[\\/].*\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
	],
});
