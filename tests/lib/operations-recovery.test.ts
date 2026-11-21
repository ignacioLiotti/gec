import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadOperationsRecoveryStatus } from "@/lib/operations-recovery";

const STATUS_ENV = "OPERATIONS_RECOVERY_STATUS_PATH";

const validStatus = {
	schemaVersion: 1,
	state: "verified",
	verificationScope: "artifact-integrity-and-recorded-restore-attestation",
	evaluatedAt: "2026-10-17T03:00:00.000Z",
	latestRecoverySet: {
		runId: "synthetic-run",
		captureStartedAt: "2026-10-17T01:00:00.000Z",
		captureEndedAt: "2026-10-17T01:04:00.000Z",
		artifactVerification: "passed",
		components: {
			database: "verified",
			auth: "verified",
			storage: "verified",
			configuration: "verified",
		},
	},
	restoreProof: {
		status: "recorded",
		validatedAt: "2026-10-17T02:20:00.000Z",
	},
	issues: [],
};

async function withTemporaryDirectory(
	run: (directory: string) => Promise<void>,
): Promise<void> {
	const directory = await mkdtemp(path.join(tmpdir(), "operations-recovery-test-"));
	try {
		await run(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("operations recovery status loader", () => {
	it("returns unconfigured without a configured filesystem path", async () => {
		vi.stubEnv(STATUS_ENV, "");

		await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
			status: "unconfigured",
		});
	});

	it("loads a valid sanitized status file", async () => {
		await withTemporaryDirectory(async (directory) => {
			const statusPath = path.join(directory, "status.json");
			await writeFile(statusPath, JSON.stringify(validStatus));
			vi.stubEnv(STATUS_ENV, statusPath);

			await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
				status: "available",
				evidence: validStatus,
			});
		});
	});

	it("rejects a relative configured path", async () => {
		vi.stubEnv(STATUS_ENV, path.join("private", "recovery-status.json"));

		await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
			status: "unavailable",
		});
	});

	it("reports a missing absolute status file as unavailable", async () => {
		await withTemporaryDirectory(async (directory) => {
			vi.stubEnv(STATUS_ENV, path.join(directory, "missing-status.json"));

			await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
				status: "unavailable",
			});
		});
	});

	it("rejects a status file larger than the bounded read limit", async () => {
		await withTemporaryDirectory(async (directory) => {
			const statusPath = path.join(directory, "oversized-status.json");
			await writeFile(statusPath, "x".repeat(65_537));
			vi.stubEnv(STATUS_ENV, statusPath);

			await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
				status: "unavailable",
			});
		});
	});

	it("rejects status JSON containing a private manifest field", async () => {
		await withTemporaryDirectory(async (directory) => {
			const statusPath = path.join(directory, "status-with-private-field.json");
			await writeFile(
				statusPath,
				JSON.stringify({
					...validStatus,
					sourceProjectRef: "private-project-reference",
				}),
			);
			vi.stubEnv(STATUS_ENV, statusPath);

			await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
				status: "unavailable",
			});
		});
	});

	it("rejects JSON that does not satisfy the status schema", async () => {
		await withTemporaryDirectory(async (directory) => {
			const statusPath = path.join(directory, "invalid-schema.json");
			await writeFile(
				statusPath,
				JSON.stringify({
					...validStatus,
					schemaVersion: 2,
				}),
			);
			vi.stubEnv(STATUS_ENV, statusPath);

			await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
				status: "unavailable",
			});
		});
	});

	it("rejects a symlinked status file", async () => {
		await withTemporaryDirectory(async (directory) => {
			const targetPath = path.join(directory, "status-target.json");
			const linkPath = path.join(directory, "status-link.json");
			await writeFile(targetPath, JSON.stringify(validStatus));
			try {
				await symlink(targetPath, linkPath, "file");
			} catch (error) {
				if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
					return;
				}
				throw error;
			}
			vi.stubEnv(STATUS_ENV, linkPath);

			await expect(loadOperationsRecoveryStatus()).resolves.toEqual({
				status: "unavailable",
			});
		});
	});
});
