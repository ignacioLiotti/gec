#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
	lstat,
	readFile,
	realpath,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { parseRecoveryStatus, RECOVERY_COMPONENTS as COMPONENTS } from "./status-contract.mjs";

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const SHA_256 = /^[a-f0-9]{64}$/;

const captureWindowSchema = z
	.object({
		startedAt: z.string().datetime({ offset: true }),
		endedAt: z.string().datetime({ offset: true }),
	})
	.strict()
	.refine(
		(window) => Date.parse(window.startedAt) <= Date.parse(window.endedAt),
		"Capture window ends before it starts",
	);

const relativeFileSchema = z
	.string()
	.min(1)
	.refine((value) => !path.isAbsolute(value), "Path must be relative")
	.refine((value) => {
		const segments = value.split(/[\\/]+/u);
		return segments.every(
			(segment) =>
				segment.length > 0 &&
				segment !== "." &&
				segment !== ".." &&
				!segment.includes(":"),
		);
	}, "Path contains a forbidden segment");

const artifactSchema = z
	.object({
		id: z.string().regex(SAFE_ID),
		component: z.enum(COMPONENTS),
		path: relativeFileSchema,
		sizeBytes: z.number().int().nonnegative(),
		sha256: z.string().regex(SHA_256),
		captureWindow: captureWindowSchema,
	})
	.strict();

const componentSchema = (scopeNames) =>
	z
		.object({
			artifactIds: z.array(z.string().regex(SAFE_ID)).min(1),
			scopes: z.object(
				Object.fromEntries(scopeNames.map((scope) => [scope, z.literal(true)])),
			).strict(),
		})
		.strict();

const manifestSchema = z
	.object({
		schemaVersion: z.literal(1),
		runId: z.string().regex(SAFE_ID),
		environment: z.string().min(1).max(128),
		sourceProjectRef: z.string().min(1).max(256),
		captureWindow: captureWindowSchema,
		postgresVersion: z.string().min(1).max(128),
		toolVersions: z.record(z.string().min(1).max(128)).refine(
			(value) => Object.keys(value).length > 0,
			"At least one capture tool version is required",
		),
		migrationVersion: z.string().min(1).max(256),
		applicationReleaseSha: z.string().regex(/^[a-fA-F0-9]{7,64}$/).nullable(),
		declaredState: z.enum(["incomplete", "complete"]),
		consistency: z
			.object({
				model: z.literal("bounded-capture-window"),
				limitations: z.string().min(1).max(2_000),
			})
			.strict(),
		artifacts: z.array(artifactSchema).min(4),
		components: z
			.object({
				database: componentSchema([
					"schema",
					"data",
					"functions",
					"policies",
					"rolesAndExtensions",
					"migrationHistory",
				]),
				auth: componentSchema([
					"identities",
					"authenticationData",
					"externalSettingsInventory",
				]),
				storage: componentSchema([
					"bucketConfiguration",
					"objectBytes",
					"objectMetadata",
					"objectVersionsOrChecksums",
				]),
				configuration: componentSchema([
					"inventory",
					"secretReferences",
					"provisioningProcedure",
				]),
			})
			.strict(),
		restoreProof: z
			.object({
				path: relativeFileSchema,
				sizeBytes: z.number().int().nonnegative(),
				sha256: z.string().regex(SHA_256),
			})
			.strict(),
	})
	.strict()
	.superRefine((manifest, context) => {
		const ids = new Set();
		const paths = new Set();
		for (const artifact of manifest.artifacts) {
			const normalizedPath = artifact.path.replaceAll("\\", "/").toLowerCase();
			if (ids.has(artifact.id)) {
				context.addIssue({ code: "custom", message: "Duplicate artifact id" });
			}
			if (paths.has(normalizedPath)) {
				context.addIssue({ code: "custom", message: "Duplicate artifact path" });
			}
			ids.add(artifact.id);
			paths.add(normalizedPath);
		}

		const normalizedProofPath = manifest.restoreProof.path.replaceAll("\\", "/").toLowerCase();
		if (paths.has(normalizedProofPath)) {
			context.addIssue({ code: "custom", message: "Restore proof path overlaps an artifact" });
		}

		for (const component of COMPONENTS) {
			const declaredIds = manifest.components[component].artifactIds;
			if (new Set(declaredIds).size !== declaredIds.length) {
				context.addIssue({ code: "custom", message: "Duplicate component artifact id" });
			}
			for (const artifactId of declaredIds) {
				const artifact = manifest.artifacts.find((item) => item.id === artifactId);
				if (!artifact || artifact.component !== component) {
					context.addIssue({ code: "custom", message: "Component artifact reference is invalid" });
				}
			}
			if (manifest.artifacts.some(
				(artifact) => artifact.component === component && !declaredIds.includes(artifact.id),
			)) {
				context.addIssue({ code: "custom", message: "Artifact is not assigned to its component" });
			}
		}
	});

const restoreProofSchema = z
	.object({
		schemaVersion: z.literal(1),
		kind: z.literal("isolated-restore-proof"),
		recoverySetRunId: z.string().regex(SAFE_ID),
		drillId: z.string().regex(SAFE_ID),
		startedAt: z.string().datetime({ offset: true }),
		endedAt: z.string().datetime({ offset: true }),
		target: z
			.object({
				isolated: z.literal(true),
				production: z.literal(false),
				outboundSideEffectsDisabled: z.literal(true),
			})
			.strict(),
		components: z.object(
			Object.fromEntries(
				COMPONENTS.map((component) => [
					component,
					z.object({ restored: z.literal(true), validated: z.literal(true) }).strict(),
				]),
			),
		).strict(),
		applicationChecks: z
			.array(
				z
					.object({
						id: z.string().regex(SAFE_ID),
						status: z.literal("passed"),
					})
					.strict(),
			)
			.min(1),
		result: z.literal("passed"),
	})
	.strict()
	.refine(
		(proof) => Date.parse(proof.startedAt) <= Date.parse(proof.endedAt),
		"Restore drill ends before it starts",
	);

function issue(code, component) {
	return component ? { code, component } : { code };
}

function emptyStatus(state, code) {
	return {
		schemaVersion: 1,
		state,
		verificationScope: "artifact-integrity-and-recorded-restore-attestation",
		evaluatedAt: new Date().toISOString(),
		latestRecoverySet: null,
		restoreProof: { status: "missing", validatedAt: null },
		issues: code ? [issue(code)] : [],
	};
}

function isWithin(parent, candidate) {
	const relative = path.relative(parent, candidate);
	return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function assertPathHasNoSymlinks(absolutePath, missingCode) {
	const parsed = path.parse(absolutePath);
	let current = parsed.root;
	const segments = absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean);
	for (const segment of segments) {
		current = path.join(current, segment);
		let stats;
		try {
			stats = await lstat(current);
		} catch {
			throw new RecoveryFileError(missingCode);
		}
		if (stats.isSymbolicLink()) {
			throw new RecoveryFileError("SYMLINK_REJECTED");
		}
	}
}

async function readRegularFileWithoutSymlinks(root, relativePath) {
	const absoluteRoot = path.resolve(root);
	const candidate = path.resolve(absoluteRoot, relativePath);
	if (!isWithin(absoluteRoot, candidate)) {
		throw new RecoveryFileError("PATH_OUTSIDE_RECOVERY_SET");
	}

	await assertPathHasNoSymlinks(candidate, "ARTIFACT_MISSING");

	const stats = await lstat(candidate);
	if (!stats.isFile()) {
		throw new RecoveryFileError("NOT_A_REGULAR_FILE");
	}
	const resolvedRoot = await realpath(absoluteRoot);
	const resolvedCandidate = await realpath(candidate);
	if (!isWithin(resolvedRoot, resolvedCandidate)) {
		throw new RecoveryFileError("PATH_OUTSIDE_RECOVERY_SET");
	}
	const bytes = await readFile(resolvedCandidate);
	return { bytes, sizeBytes: bytes.byteLength };
}

class RecoveryFileError extends Error {
	constructor(code) {
		super(code);
		this.code = code;
	}
}

function validateCaptureWindows(manifest) {
	const setStart = Date.parse(manifest.captureWindow.startedAt);
	const setEnd = Date.parse(manifest.captureWindow.endedAt);
	let earliest = Number.POSITIVE_INFINITY;
	let latest = Number.NEGATIVE_INFINITY;

	for (const artifact of manifest.artifacts) {
		const start = Date.parse(artifact.captureWindow.startedAt);
		const end = Date.parse(artifact.captureWindow.endedAt);
		if (start < setStart || end > setEnd) {
			return false;
		}
		earliest = Math.min(earliest, start);
		latest = Math.max(latest, end);
	}

	return earliest === setStart && latest === setEnd;
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

export async function evaluateRecoverySet({ manifestPath, verifyArtifacts = false }) {
	let manifestFile;
	try {
		const absoluteManifest = path.resolve(manifestPath);
		try {
			await assertPathHasNoSymlinks(absoluteManifest, "MANIFEST_NOT_CONFIGURED");
		} catch (error) {
			if (error instanceof RecoveryFileError && error.code === "MANIFEST_NOT_CONFIGURED") {
				return emptyStatus("unconfigured", "MANIFEST_NOT_CONFIGURED");
			}
			if (error instanceof RecoveryFileError && error.code === "SYMLINK_REJECTED") {
				return emptyStatus("partial", "MANIFEST_SYMLINK_REJECTED");
			}
			throw error;
		}
		const manifestStats = await lstat(absoluteManifest);
		if (!manifestStats.isFile()) {
			return emptyStatus("partial", "MANIFEST_NOT_A_REGULAR_FILE");
		}
		manifestFile = await readFile(absoluteManifest, "utf8");
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			return emptyStatus("unconfigured", "MANIFEST_NOT_CONFIGURED");
		}
		return emptyStatus("partial", "MANIFEST_UNREADABLE");
	}

	let unknownManifest;
	try {
		unknownManifest = JSON.parse(manifestFile);
	} catch {
		return emptyStatus("partial", "MANIFEST_INVALID_JSON");
	}
	const parsedManifest = manifestSchema.safeParse(unknownManifest);
	if (!parsedManifest.success) {
		return emptyStatus("partial", "MANIFEST_INVALID");
	}
	const manifest = parsedManifest.data;
	const evaluatedAt = new Date().toISOString();
	if (Date.parse(manifest.captureWindow.endedAt) > Date.parse(evaluatedAt)) {
		return {
			...emptyStatus("partial", "EVALUATION_PREDATES_CAPTURE"),
			evaluatedAt,
		};
	}
	const componentStatuses = Object.fromEntries(
		COMPONENTS.map((component) => [component, "declared"]),
	);
	const status = {
		schemaVersion: 1,
		state: "partial",
		verificationScope: "artifact-integrity-and-recorded-restore-attestation",
		evaluatedAt,
		latestRecoverySet: {
			runId: manifest.runId,
			captureStartedAt: manifest.captureWindow.startedAt,
			captureEndedAt: manifest.captureWindow.endedAt,
			artifactVerification: verifyArtifacts ? "failed" : "not_run",
			components: componentStatuses,
		},
		restoreProof: { status: "missing", validatedAt: null },
		issues: [],
	};

	if (manifest.declaredState !== "complete") {
		status.issues.push(issue("MANIFEST_DECLARED_INCOMPLETE"));
	}
	if (!validateCaptureWindows(manifest)) {
		status.issues.push(issue("CAPTURE_WINDOWS_INCONSISTENT"));
	}
	if (!verifyArtifacts) {
		status.issues.push(issue("ARTIFACT_VERIFICATION_NOT_RUN"));
		status.issues.push(issue("RESTORE_PROOF_NOT_VERIFIED"));
		return status;
	}

	const manifestRoot = path.dirname(path.resolve(manifestPath));
	for (const artifact of manifest.artifacts) {
		try {
			const file = await readRegularFileWithoutSymlinks(manifestRoot, artifact.path);
			if (file.sizeBytes !== artifact.sizeBytes) {
				status.issues.push(issue("ARTIFACT_SIZE_MISMATCH", artifact.component));
				continue;
			}
			if (sha256(file.bytes) !== artifact.sha256) {
				status.issues.push(issue("ARTIFACT_CHECKSUM_MISMATCH", artifact.component));
			}
		} catch (error) {
			const code = error instanceof RecoveryFileError ? error.code : "ARTIFACT_UNREADABLE";
			status.issues.push(issue(code, artifact.component));
		}
	}

	for (const component of COMPONENTS) {
		if (!status.issues.some((entry) => entry.component === component)) {
			componentStatuses[component] = "verified";
		}
	}
	const allArtifactsVerified = COMPONENTS.every(
		(component) => componentStatuses[component] === "verified",
	);
	status.latestRecoverySet.artifactVerification = allArtifactsVerified ? "passed" : "failed";

	let restoreProofFile;
	try {
		restoreProofFile = await readRegularFileWithoutSymlinks(
			manifestRoot,
			manifest.restoreProof.path,
		);
		if (restoreProofFile.sizeBytes !== manifest.restoreProof.sizeBytes) {
			status.issues.push(issue("RESTORE_PROOF_SIZE_MISMATCH"));
		} else if (sha256(restoreProofFile.bytes) !== manifest.restoreProof.sha256) {
			status.issues.push(issue("RESTORE_PROOF_CHECKSUM_MISMATCH"));
		} else {
			let unknownProof;
			try {
				unknownProof = JSON.parse(restoreProofFile.bytes.toString("utf8"));
			} catch {
				status.issues.push(issue("RESTORE_PROOF_INVALID_JSON"));
			}
			if (unknownProof !== undefined) {
				const parsedProof = restoreProofSchema.safeParse(unknownProof);
				if (!parsedProof.success || parsedProof.data.recoverySetRunId !== manifest.runId) {
					status.issues.push(issue("RESTORE_PROOF_INVALID"));
				} else if (Date.parse(parsedProof.data.startedAt) < Date.parse(manifest.captureWindow.endedAt)) {
					status.issues.push(issue("RESTORE_PROOF_PREDATES_CAPTURE"));
				} else if (Date.parse(parsedProof.data.endedAt) > Date.parse(status.evaluatedAt)) {
					status.issues.push(issue("EVALUATION_PREDATES_RESTORE"));
				} else {
					status.restoreProof = {
						status: "recorded",
						validatedAt: parsedProof.data.endedAt,
					};
				}
			}
		}
	} catch (error) {
		const code = error instanceof RecoveryFileError ? error.code : "RESTORE_PROOF_UNREADABLE";
		status.issues.push(issue(`RESTORE_PROOF_${code}`));
	}

	if (status.restoreProof.status !== "recorded") {
		status.restoreProof.status = "invalid";
	}
	if (
		manifest.declaredState === "complete" &&
		validateCaptureWindows(manifest) &&
		allArtifactsVerified &&
		status.restoreProof.status === "recorded"
	) {
		status.state = "verified";
	}

	return status;
}

function parseArguments(argv) {
	const options = { manifestPath: null, verifyArtifacts: false, outputStatus: null };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--verify-artifacts") {
			options.verifyArtifacts = true;
		} else if (argument === "--manifest" || argument === "--output-status") {
			const value = argv[index + 1];
			if (!value) throw new Error("MISSING_OPTION_VALUE");
			if (argument === "--manifest") options.manifestPath = value;
			else options.outputStatus = value;
			index += 1;
		} else {
			throw new Error("UNKNOWN_OPTION");
		}
	}
	if (!options.manifestPath) throw new Error("MANIFEST_REQUIRED");
	return options;
}

async function writeStatusFile(relativePath, serializedStatus) {
	if (path.isAbsolute(relativePath)) throw new Error("OUTPUT_PATH_MUST_BE_RELATIVE");
	const segments = relativePath.split(/[\\/]+/u);
	if (segments.some(
		(segment) => !segment || segment === "." || segment === ".." || segment.includes(":"),
	)) {
		throw new Error("OUTPUT_PATH_INVALID");
	}
	const outputRoot = process.cwd();
	const outputPath = path.resolve(outputRoot, relativePath);
	if (!isWithin(outputRoot, outputPath)) throw new Error("OUTPUT_PATH_OUTSIDE_WORKSPACE");
	let current = outputRoot;
	for (const segment of segments.slice(0, -1)) {
		current = path.join(current, segment);
		const stats = await lstat(current);
		if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error("OUTPUT_PARENT_INVALID");
	}
	try {
		const existing = await lstat(outputPath);
		if (existing.isSymbolicLink() || !existing.isFile()) throw new Error("OUTPUT_FILE_INVALID");
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
	}
	await writeFile(outputPath, `${serializedStatus}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function runCli(argv) {
	let options;
	try {
		options = parseArguments(argv);
	} catch {
		process.stderr.write("Usage: verify-recovery-set --manifest <path> [--verify-artifacts] [--output-status <workspace-relative-path>]\n");
		return 64;
	}
	const status = await evaluateRecoverySet({
		manifestPath: options.manifestPath,
		verifyArtifacts: options.verifyArtifacts,
	});
	const serializedStatus = JSON.stringify(parseRecoveryStatus(status), null, 2);
	if (options.outputStatus) {
		try {
			await writeStatusFile(options.outputStatus, serializedStatus);
		} catch {
			process.stderr.write("Could not write the sanitized status output.\n");
			return 74;
		}
	}
	process.stdout.write(`${serializedStatus}\n`);
	return status.state === "verified" ? 0 : 2;
}

const isDirectExecution = process.argv[1]
	? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
	: false;
if (isDirectExecution) {
	process.exitCode = await runCli(process.argv.slice(2));
}
