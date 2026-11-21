import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

export const RECOVERY_COMPONENTS = ["database", "auth", "storage", "configuration"];

const componentSchema = z.enum(RECOVERY_COMPONENTS);
const componentStatusSchema = z.enum(["missing", "declared", "verified"]);

export const recoveryStatusSchema = z
	.object({
		schemaVersion: z.literal(1),
		state: z.enum(["unconfigured", "partial", "verified"]),
		verificationScope: z.literal("artifact-integrity-and-recorded-restore-attestation"),
		evaluatedAt: z.string().datetime({ offset: true }),
		latestRecoverySet: z
			.object({
				runId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/),
				captureStartedAt: z.string().datetime({ offset: true }),
				captureEndedAt: z.string().datetime({ offset: true }),
				artifactVerification: z.enum(["not_run", "failed", "passed"]),
				components: z
					.object({
						database: componentStatusSchema,
						auth: componentStatusSchema,
						storage: componentStatusSchema,
						configuration: componentStatusSchema,
					})
					.strict(),
			})
			.strict()
			.nullable(),
		restoreProof: z
			.object({
				status: z.enum(["missing", "invalid", "recorded"]),
				validatedAt: z.string().datetime({ offset: true }).nullable(),
			})
			.strict(),
		issues: z.array(
			z
				.object({
					code: z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/),
					component: componentSchema.optional(),
				})
				.strict(),
		),
	})
	.strict()
	.superRefine((status, context) => {
		if (status.state === "unconfigured" && status.latestRecoverySet !== null) {
			context.addIssue({ code: "custom", message: "Unconfigured status cannot contain a recovery set" });
		}
		const evaluatedAt = Date.parse(status.evaluatedAt);
		if (status.latestRecoverySet !== null) {
			const captureStartedAt = Date.parse(status.latestRecoverySet.captureStartedAt);
			const captureEndedAt = Date.parse(status.latestRecoverySet.captureEndedAt);
			if (captureStartedAt > captureEndedAt) {
				context.addIssue({ code: "custom", path: ["latestRecoverySet", "captureEndedAt"], message: "Capture ends before it starts" });
			}
			if (evaluatedAt < captureEndedAt) {
				context.addIssue({ code: "custom", path: ["evaluatedAt"], message: "Status was evaluated before capture ended" });
			}
		}
		if (status.restoreProof.status === "recorded") {
			if (status.restoreProof.validatedAt === null) {
				context.addIssue({ code: "custom", path: ["restoreProof", "validatedAt"], message: "Recorded restore proof requires a validation time" });
			} else {
				const validatedAt = Date.parse(status.restoreProof.validatedAt);
				if (
					status.latestRecoverySet === null ||
					validatedAt < Date.parse(status.latestRecoverySet.captureEndedAt)
				) {
					context.addIssue({ code: "custom", path: ["restoreProof", "validatedAt"], message: "Restore proof predates capture completion" });
				}
				if (evaluatedAt < validatedAt) {
					context.addIssue({ code: "custom", path: ["evaluatedAt"], message: "Status was evaluated before restore validation" });
				}
			}
		} else if (status.restoreProof.validatedAt !== null) {
			context.addIssue({ code: "custom", path: ["restoreProof", "validatedAt"], message: "Unrecorded restore proof cannot have a validation time" });
		}
		if (status.state !== "verified") return;
		if (
			status.latestRecoverySet === null ||
			status.latestRecoverySet.artifactVerification !== "passed" ||
			RECOVERY_COMPONENTS.some(
				(component) => status.latestRecoverySet?.components[component] !== "verified",
			) ||
			status.restoreProof.status !== "recorded" ||
			status.issues.length > 0
		) {
			context.addIssue({ code: "custom", message: "Verified status lacks complete evidence" });
		}
	});

export function parseRecoveryStatus(input) {
	return recoveryStatusSchema.parse(input);
}

export function createUnconfiguredRecoveryStatus(now = new Date()) {
	return parseRecoveryStatus({
		schemaVersion: 1,
		state: "unconfigured",
		verificationScope: "artifact-integrity-and-recorded-restore-attestation",
		evaluatedAt: now.toISOString(),
		latestRecoverySet: null,
		restoreProof: { status: "missing", validatedAt: null },
		issues: [{ code: "STATUS_PATH_NOT_CONFIGURED" }],
	});
}

export async function loadRecoveryStatusFile(statusPath) {
	const absolutePath = path.resolve(statusPath);
	const parsedPath = path.parse(absolutePath);
	let current = parsedPath.root;
	try {
		for (const segment of absolutePath.slice(parsedPath.root.length).split(path.sep).filter(Boolean)) {
			current = path.join(current, segment);
			const stats = await lstat(current);
			if (stats.isSymbolicLink()) throw new Error("RECOVERY_STATUS_FILE_INVALID");
		}
		const stats = await lstat(absolutePath);
		if (!stats.isFile()) throw new Error("RECOVERY_STATUS_FILE_INVALID");
	} catch {
		throw new Error("RECOVERY_STATUS_FILE_INVALID");
	}
	let input;
	try {
		input = JSON.parse(await readFile(absolutePath, "utf8"));
	} catch {
		throw new Error("RECOVERY_STATUS_FILE_INVALID");
	}
	return parseRecoveryStatus(input);
}
