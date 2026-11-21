import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("legacy permission backfill and 0132 upgrade converge and roll back", async ({}, testInfo) => {
	test.setTimeout(70_000);
	const execution = spawnSync(process.execPath, [
		resolve("scripts/check-permission-migration.mjs"),
		"--check-owned",
	], {
		env: process.env,
		encoding: "utf8",
		windowsHide: true,
		timeout: 60_000,
	});
	expect(execution.error?.message ?? null).toBeNull();
	expect(execution.status, execution.stderr).toBe(0);
	expect(execution.stdout).toContain(
		'"result":"permission-migration: backfill, precedence, convergence and rollback passed"',
	);
	await testInfo.attach("permission-migration", {
		body: execution.stdout,
		contentType: "application/json",
	});
});
