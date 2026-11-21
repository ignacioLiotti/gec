import { test } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const controlPath = join(process.cwd(), "plans/2026-10-19-launch-qa/independent-control.json");
const readControl = () => existsSync(controlPath)
	? JSON.parse(readFileSync(controlPath, "utf8"))
	: {};

test("independent five-persona launch QA session", async ({ baseURL }) => {
	test.skip(readControl().status !== "requested", "Explicitly started interactive QA only.");
	test.setTimeout(45 * 60_000);
	const manifestPath = process.env.E2E_INSTANCE_MANIFEST;
	if (!manifestPath) throw new Error("An owned integration manifest is required.");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (manifest.kind !== "owned-local-integration" || manifest.appUrl !== baseURL) {
		throw new Error("Independent QA runtime identity mismatch.");
	}
	writeFileSync(controlPath, JSON.stringify({
		status: "ready",
		baseURL,
		supabaseURL: manifest.supabaseUrl,
		runId: manifest.runId,
		workspace: manifest.workspace,
		startedAt: new Date().toISOString(),
		scope: "Independent synthetic signup; no OAuth, outbound email or payments",
	}, null, 2));
	while (readControl().status !== "stop") {
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	writeFileSync(controlPath, JSON.stringify({ ...readControl(), status: "finished" }, null, 2));
});
