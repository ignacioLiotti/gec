import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export type FixtureResourceKind =
	| "tenant"
	| "auth-user"
	| "membership"
	| "role"
	| "role-permission"
	| "user-role"
	| "obra"
	| "tabla"
	| "tabla-column"
	| "default-folder"
	| "default-tabla"
	| "default-tabla-column"
	| "macro-table"
	| "macro-source"
	| "macro-column"
	| "macro-value"
	| "storage-object"
	| "document-template"
	| "billing-plan"
	| "billing-subscription"
	| "whatsapp-contact"
	| "whatsapp-flow"
	| "whatsapp-flow-run"
	| "whatsapp-template"
	| "whatsapp-assignment"
	| "whatsapp-run"
	| "whatsapp-chat-action";

export type FixtureResource = {
	kind: FixtureResourceKind;
	id: string;
};

export class FixtureManifest {
	readonly namespace: string;
	readonly resources: FixtureResource[] = [];
	private readonly runId = z.string().uuid().parse(process.env.E2E_RUN_ID);
	private status: "active" | "awaiting-stack-disposal" | "cleanup-failed" = "active";
	private runtimeCleanup: "pending" | "verified" | "failed" = "pending";
	private errors: string[] = [];

	constructor(
		namespace: string,
		private readonly filePath: string,
	) {
		this.namespace = namespace;
		mkdirSync(dirname(filePath), { recursive: true });
		this.persist();
	}

	add(kind: FixtureResourceKind, id: string) {
		if (!this.resources.some((resource) => resource.kind === kind && resource.id === id)) {
			this.resources.push({ kind, id });
			this.persist();
		}
	}

	ids(kind: FixtureResourceKind) {
		return this.resources
			.filter((resource) => resource.kind === kind)
			.map((resource) => resource.id);
	}

	diagnostic() {
		return {
			kind: "owned-local-integration-fixture",
			runId: this.runId,
			projectId: `e2e_${this.runId.replaceAll("-", "")}`,
			namespace: this.namespace,
			status: this.status,
			runtimeCleanup: this.runtimeCleanup,
			resources: this.resources,
			errors: this.errors,
		};
	}

	markAwaitingStackDisposal() {
		this.status = "awaiting-stack-disposal";
		this.runtimeCleanup = "verified";
		this.errors = [];
		this.persist();
	}

	markCleanupFailed(errors: string[]) {
		this.status = "cleanup-failed";
		this.runtimeCleanup = "failed";
		this.errors = [...errors];
		this.persist();
	}

	private persist() {
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		writeFileSync(temporaryPath, `${JSON.stringify(this.diagnostic(), null, 2)}\n`, {
			encoding: "utf8",
			flag: "w",
		});
		renameSync(temporaryPath, this.filePath);
	}
}

export function fixtureFailure(
	message: string,
	manifest: FixtureManifest,
	errors: string[],
) {
	return new Error(
		`${message}: ${errors.join("; ")}\nFixture manifest: ${JSON.stringify(manifest.diagnostic())}`,
	);
}
