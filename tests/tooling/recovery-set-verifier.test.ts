import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRecoveryStatusFile, parseRecoveryStatus } from "@/scripts/recovery/status-contract.mjs";
import { evaluateRecoverySet, runCli } from "@/scripts/recovery/verify-recovery-set.mjs";

const CAPTURE_START = "2026-10-17T01:00:00.000Z";
const CAPTURE_END = "2026-10-17T01:04:00.000Z";
const fixtureRoots = new Set<string>();
type RecoveryComponent = "database" | "auth" | "storage" | "configuration";
type FixtureArtifact = {
	id: string;
	component: RecoveryComponent;
	path: string;
	sizeBytes: number;
	sha256: string;
	captureWindow: { startedAt: string; endedAt: string };
};
type MutableManifestFixture = Record<string, unknown> & {
	captureWindow: { startedAt: string; endedAt: string };
	artifacts: FixtureArtifact[];
	components: Partial<Record<RecoveryComponent, unknown>>;
};
type MutableProofFixture = Record<string, unknown> & {
	startedAt: string;
	endedAt: string;
	components: Partial<Record<RecoveryComponent, unknown>>;
};
type MutableStatusFixture = ReturnType<typeof validStatusFixture>;

afterEach(async () => {
	await Promise.all(
		[...fixtureRoots].map((fixtureRoot) => rm(fixtureRoot, { recursive: true, force: true })),
	);
	fixtureRoots.clear();
});

function digest(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

function validStatusFixture() {
	return {
		schemaVersion: 1,
		state: "verified",
		verificationScope: "artifact-integrity-and-recorded-restore-attestation",
		evaluatedAt: "2026-10-17T03:00:00.000Z",
		latestRecoverySet: {
			runId: "synthetic-run",
			captureStartedAt: CAPTURE_START,
			captureEndedAt: CAPTURE_END,
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
			validatedAt: "2026-10-17T02:20:00.000Z" as string | null,
		},
		issues: [],
	};
}

async function writeFixture(options?: {
	manifestTransform?: (manifest: MutableManifestFixture) => void;
	proofTransform?: (proof: MutableProofFixture) => void;
}) {
	const root = await mkdtemp(path.join(tmpdir(), "recovery-set-"));
	fixtureRoots.add(root);
	const contents = {
		database: "synthetic database export",
		auth: "synthetic auth export",
		storage: "synthetic storage export",
		configuration: "synthetic configuration inventory",
	};
	const windows = {
		database: { startedAt: CAPTURE_START, endedAt: "2026-10-17T01:01:00.000Z" },
		auth: { startedAt: "2026-10-17T01:01:00.000Z", endedAt: "2026-10-17T01:02:00.000Z" },
		storage: { startedAt: "2026-10-17T01:02:00.000Z", endedAt: "2026-10-17T01:03:00.000Z" },
		configuration: { startedAt: "2026-10-17T01:03:00.000Z", endedAt: CAPTURE_END },
	};
	const artifacts: FixtureArtifact[] = [];
	for (const component of ["database", "auth", "storage", "configuration"] as const) {
		const fileName = `${component}-private-payload.bin`;
		await writeFile(path.join(root, fileName), contents[component]);
		artifacts.push({
			id: `${component}-capture`,
			component,
			path: fileName,
			sizeBytes: Buffer.byteLength(contents[component]),
			sha256: digest(contents[component]),
			captureWindow: windows[component],
		});
	}

	const proof: MutableProofFixture = {
		schemaVersion: 1,
		kind: "isolated-restore-proof",
		recoverySetRunId: "run-2026-10-17",
		drillId: "drill-2026-10-17",
		startedAt: "2026-10-17T02:00:00.000Z",
		endedAt: "2026-10-17T02:20:00.000Z",
		target: {
			isolated: true,
			production: false,
			outboundSideEffectsDisabled: true,
		},
		components: {
			database: { restored: true, validated: true },
			auth: { restored: true, validated: true },
			storage: { restored: true, validated: true },
			configuration: { restored: true, validated: true },
		},
		applicationChecks: [{ id: "authenticated-object-read", status: "passed" }],
		result: "passed",
	};
	options?.proofTransform?.(proof);
	const proofContent = JSON.stringify(proof);
	await writeFile(path.join(root, "restore-proof-private.json"), proofContent);

	const manifest: MutableManifestFixture = {
		schemaVersion: 1,
		runId: "run-2026-10-17",
		environment: "synthetic",
		sourceProjectRef: "private-project-reference",
		captureWindow: { startedAt: CAPTURE_START, endedAt: CAPTURE_END },
		postgresVersion: "17.synthetic",
		toolVersions: { capture: "synthetic-1" },
		migrationVersion: "synthetic-migration",
		applicationReleaseSha: "abcdef1234567",
		declaredState: "complete",
		consistency: {
			model: "bounded-capture-window",
			limitations: "Components were captured sequentially in this synthetic fixture.",
		},
		artifacts,
		components: {
			database: {
				artifactIds: ["database-capture"],
				scopes: {
					schema: true,
					data: true,
					functions: true,
					policies: true,
					rolesAndExtensions: true,
					migrationHistory: true,
				},
			},
			auth: {
				artifactIds: ["auth-capture"],
				scopes: {
					identities: true,
					authenticationData: true,
					externalSettingsInventory: true,
				},
			},
			storage: {
				artifactIds: ["storage-capture"],
				scopes: {
					bucketConfiguration: true,
					objectBytes: true,
					objectMetadata: true,
					objectVersionsOrChecksums: true,
				},
			},
			configuration: {
				artifactIds: ["configuration-capture"],
				scopes: {
					inventory: true,
					secretReferences: true,
					provisioningProcedure: true,
				},
			},
		},
		restoreProof: {
			path: "restore-proof-private.json",
			sizeBytes: Buffer.byteLength(proofContent),
			sha256: digest(proofContent),
		},
	};
	options?.manifestTransform?.(manifest);
	const manifestPath = path.join(root, "manifest-private.json");
	await writeFile(manifestPath, JSON.stringify(manifest));
	return { manifest, manifestPath, root };
}

describe("recovery set verifier", () => {
	it("requires artifact verification before publishing a verified state", async () => {
		const fixture = await writeFixture();
		const status = await evaluateRecoverySet({ manifestPath: fixture.manifestPath });

		expect(status.state).toBe("partial");
		expect(status.latestRecoverySet?.artifactVerification).toBe("not_run");
		expect(status.issues).toContainEqual({ code: "ARTIFACT_VERIFICATION_NOT_RUN" });
	});

	it("verifies all four component artifacts and a separate complete restore record", async () => {
		const fixture = await writeFixture();
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status).toMatchObject({
			state: "verified",
			latestRecoverySet: {
				artifactVerification: "passed",
				components: {
					database: "verified",
					auth: "verified",
					storage: "verified",
					configuration: "verified",
				},
			},
			restoreProof: { status: "recorded" },
			issues: [],
		});
	});

	it("detects changed bytes instead of trusting the manifest checksum", async () => {
		const fixture = await writeFixture();
		const storageArtifact = fixture.manifest.artifacts.find(
			(artifact) => artifact.component === "storage",
		);
		if (!storageArtifact) throw new Error("Synthetic fixture lacks its Storage artifact");
		await writeFile(
			path.join(fixture.root, "storage-private-payload.bin"),
			"x".repeat(storageArtifact.sizeBytes),
		);
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.latestRecoverySet?.components.storage).toBe("declared");
		expect(status.issues).toContainEqual({
			code: "ARTIFACT_CHECKSUM_MISMATCH",
			component: "storage",
		});
	});

	it("keeps a partial upload incomplete when one declared artifact is missing", async () => {
		const fixture = await writeFixture();
		await rm(path.join(fixture.root, "auth-private-payload.bin"));
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.latestRecoverySet?.components.auth).toBe("declared");
		expect(status.issues).toContainEqual({
			code: "ARTIFACT_MISSING",
			component: "auth",
		});
	});

	it("rejects a database-only manifest as incomplete recovery coverage", async () => {
		const fixture = await writeFixture({
			manifestTransform(manifest) {
				delete manifest.components.storage;
			},
		});
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.latestRecoverySet).toBeNull();
		expect(status.issues).toEqual([{ code: "MANIFEST_INVALID" }]);
	});

	it("rejects component capture windows outside the recovery-set envelope", async () => {
		const fixture = await writeFixture({
			manifestTransform(manifest) {
				manifest.artifacts[2].captureWindow = {
					startedAt: "2026-10-17T00:59:00.000Z",
					endedAt: "2026-10-17T01:03:00.000Z",
				};
			},
		});
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.issues).toContainEqual({ code: "CAPTURE_WINDOWS_INCONSISTENT" });
	});

	it("rejects an inverted recovery-set capture window", async () => {
		const fixture = await writeFixture({
			manifestTransform(manifest) {
				manifest.captureWindow = { startedAt: CAPTURE_END, endedAt: CAPTURE_START };
			},
		});
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.latestRecoverySet).toBeNull();
		expect(status.issues).toEqual([{ code: "MANIFEST_INVALID" }]);
	});

	it("rejects a recovery set whose capture ends after evaluation", async () => {
		const fixture = await writeFixture({
			manifestTransform(manifest) {
				manifest.captureWindow = {
					startedAt: "2999-10-17T01:00:00.000Z",
					endedAt: "2999-10-17T01:04:00.000Z",
				};
			},
		});
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.latestRecoverySet).toBeNull();
		expect(status.issues).toEqual([{ code: "EVALUATION_PREDATES_CAPTURE" }]);
	});

	it("does not promote a prior database-only drill to a full restore record", async () => {
		const fixture = await writeFixture({
			proofTransform(proof) {
				proof.components = {
					database: { restored: true, validated: true },
				};
			},
		});
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.restoreProof.status).toBe("invalid");
		expect(status.issues).toContainEqual({ code: "RESTORE_PROOF_INVALID" });
	});

	it("rejects a restore drill that ran before capture completed", async () => {
		const fixture = await writeFixture({
			proofTransform(proof) {
				proof.startedAt = "2026-10-17T01:02:00.000Z";
				proof.endedAt = "2026-10-17T01:03:00.000Z";
			},
		});
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.restoreProof.status).toBe("invalid");
		expect(status.issues).toContainEqual({ code: "RESTORE_PROOF_PREDATES_CAPTURE" });
	});

	it("rejects a restore drill that ends after evaluation", async () => {
		const fixture = await writeFixture({
			proofTransform(proof) {
				proof.endedAt = "2999-10-17T02:20:00.000Z";
			},
		});
		const status = await evaluateRecoverySet({
			manifestPath: fixture.manifestPath,
			verifyArtifacts: true,
		});

		expect(status.state).toBe("partial");
		expect(status.restoreProof.status).toBe("invalid");
		expect(status.issues).toContainEqual({ code: "EVALUATION_PREDATES_RESTORE" });
	});

	it("rejects traversal and symlink artifact paths without reading their targets", async () => {
		const traversalFixture = await writeFixture({
			manifestTransform(manifest) {
				manifest.artifacts[0].path = "../outside.sql";
			},
		});
		const traversalStatus = await evaluateRecoverySet({
			manifestPath: traversalFixture.manifestPath,
			verifyArtifacts: true,
		});
		expect(traversalStatus.issues).toEqual([{ code: "MANIFEST_INVALID" }]);

		const symlinkFixture = await writeFixture();
		const target = path.join(symlinkFixture.root, "database-private-payload.bin");
		const link = path.join(symlinkFixture.root, "database-link.bin");
		try {
			await symlink(target, link, "file");
		} catch (error) {
			if (error && typeof error === "object" && "code" in error && error.code === "EPERM") return;
			throw error;
		}
		const manifest = symlinkFixture.manifest;
		manifest.artifacts[0].path = "database-link.bin";
		await writeFile(symlinkFixture.manifestPath, JSON.stringify(manifest));
		const symlinkStatus = await evaluateRecoverySet({
			manifestPath: symlinkFixture.manifestPath,
			verifyArtifacts: true,
		});
		expect(symlinkStatus.state).toBe("partial");
		expect(symlinkStatus.issues).toContainEqual({
			code: "SYMLINK_REJECTED",
			component: "database",
		});
	});

	it("emits only the sanitized status contract to a workspace-relative file", async () => {
		const fixture = await writeFixture();
		const outputDirectory = await mkdtemp(path.join(process.cwd(), "tmp-recovery-status-"));
		const outputName = path.relative(process.cwd(), path.join(outputDirectory, "status.json"));
		try {
			const exitCode = await runCli([
				"--manifest",
				fixture.manifestPath,
				"--verify-artifacts",
				"--output-status",
				outputName,
			]);
			const outputPath = path.resolve(outputName);
			const output = await readFile(outputPath, "utf8");
			const loadedStatus = await loadRecoveryStatusFile(outputPath);

			expect(exitCode).toBe(0);
			expect(output).not.toContain("private-project-reference");
			expect(output).not.toContain("private-payload");
			expect(output).not.toContain("sha256");
			expect(JSON.parse(output)).toMatchObject({ state: "verified" });
			expect(loadedStatus.state).toBe("verified");
		} finally {
			await rm(outputDirectory, { recursive: true, force: true });
		}
	});

	it("rejects private or unknown fields at the dashboard status boundary", () => {
		expect(() =>
			parseRecoveryStatus({
				schemaVersion: 1,
				state: "unconfigured",
				verificationScope: "artifact-integrity-and-recorded-restore-attestation",
				evaluatedAt: "2026-10-17T03:00:00.000Z",
				latestRecoverySet: null,
				restoreProof: { status: "missing", validatedAt: null },
				issues: [],
				sourceProjectRef: "must-not-cross-the-status-boundary",
			}),
		).toThrow();
	});

	it.each([
		["capture ends before it starts", (status: MutableStatusFixture) => {
			status.latestRecoverySet.captureStartedAt = "2026-10-17T01:05:00.000Z";
		}],
		["evaluation predates capture completion", (status: MutableStatusFixture) => {
			status.evaluatedAt = "2026-10-17T01:03:00.000Z";
		}],
		["recorded restore validation predates capture completion", (status: MutableStatusFixture) => {
			status.restoreProof.validatedAt = "2026-10-17T01:03:00.000Z";
		}],
		["evaluation predates recorded restore validation", (status: MutableStatusFixture) => {
			status.evaluatedAt = "2026-10-17T02:10:00.000Z";
		}],
	] as const)("rejects sanitized status when %s", (_reason, mutate) => {
		const status = validStatusFixture();
		mutate(status);

		expect(() => parseRecoveryStatus(status)).toThrow();
	});
});
