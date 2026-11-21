import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

const environmentSchema = z.object({
	E2E_LOCAL: z.literal("1"),
	E2E_MODE: z.literal("authenticated"),
	E2E_RUN_ID: z.string().uuid(),
	E2E_INSTANCE_MANIFEST: z.string().min(1),
	E2E_OCR_PROVIDER_URL: z.string().url(),
	E2E_OCR_PROVIDER_TOKEN: z.string().uuid(),
});

const manifestSchema = z.object({
	kind: z.literal("owned-local-integration"),
	runId: z.string().uuid(),
	projectId: z.string().min(1),
	workspace: z.string().min(1),
	mode: z.literal("authenticated"),
	status: z.literal("running"),
	ocrProvider: z.object({
		enabled: z.literal(true),
		url: z.string().url(),
	}),
});

const fixtureSourceSchema = z.object({
	mimeType: z.enum(["image/png", "image/jpeg", "application/pdf"]),
	buffer: z.instanceof(Buffer),
});

const fixtureIdSchema = z.object({ id: z.string().uuid() });
const providerRequestSchema = z.object({
	sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
	mimeType: fixtureSourceSchema.shape.mimeType,
	bytes: z.number().int().positive(),
	modelPath: z.string().min(1),
	attempt: z.number().int().positive(),
	promptHash: z.string().regex(/^[a-f0-9]{64}$/),
	promptRequirementMet: z.boolean().optional(),
}).strict();
const fixtureStateSchema = z.object({
	requests: z.array(providerRequestSchema),
	remainingFailures: z.number().int().min(0),
}).strict();

export type OcrProviderRequest = z.infer<typeof providerRequestSchema>;
export type OcrProviderFixtureState = z.infer<typeof fixtureStateSchema>;

type RegisteredOcrFixture = {
	sourceHash: string;
	read(): Promise<OcrProviderFixtureState>;
};

function providerOrigin(value: string) {
	const url = new URL(value);
	const port = Number(url.port);
	if (
		url.protocol !== "http:" ||
		url.hostname !== "127.0.0.1" ||
		!Number.isInteger(port) ||
		port < 1 ||
		port > 65_535 ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error("The OCR provider must be an owned HTTP 127.0.0.1 origin.");
	}
	return url.origin;
}

async function ownedProviderControl() {
	const environment = environmentSchema.parse(process.env);
	const manifest = manifestSchema.parse(JSON.parse(
		await readFile(environment.E2E_INSTANCE_MANIFEST, "utf8"),
	));
	const expectedProjectId = `e2e_${environment.E2E_RUN_ID.replaceAll("-", "")}`;
	if (
		manifest.runId !== environment.E2E_RUN_ID ||
		manifest.projectId !== expectedProjectId ||
		resolve(environment.E2E_INSTANCE_MANIFEST) !== join(resolve(manifest.workspace), "instance.json") ||
		manifest.ocrProvider.url !== environment.E2E_OCR_PROVIDER_URL
	) {
		throw new Error("The OCR provider configuration does not match the owned integration run.");
	}
	return {
		origin: providerOrigin(environment.E2E_OCR_PROVIDER_URL),
		token: environment.E2E_OCR_PROVIDER_TOKEN,
	};
}

async function controlRequest(control: Awaited<ReturnType<typeof ownedProviderControl>>, path: string, init?: RequestInit) {
	const response = await fetch(`${control.origin}${path}`, {
		...init,
		headers: {
			...init?.headers,
			"x-e2e-provider-token": control.token,
		},
	});
	if (!response.ok) {
		throw new Error(`OCR provider control request ${path} failed with ${response.status}: ${await response.text()}`);
	}
	return response;
}

export async function withRegisteredOcrProviderFixture<T>(args: {
	namespace: string;
	source: { mimeType: string; buffer: Buffer };
	extraction: Record<string, unknown>;
	failures?: number;
	requiredPromptText?: string;
}, run: (fixture: RegisteredOcrFixture) => Promise<T>): Promise<T> {
	const control = await ownedProviderControl();
	const source = fixtureSourceSchema.parse(args.source);
	const sourceHash = createHash("sha256").update(source.buffer).digest("hex");
	const registration = await controlRequest(control, "/fixtures", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			namespace: args.namespace,
			sourceHash,
			mimeType: source.mimeType,
			extraction: args.extraction,
			failures: args.failures ?? 0,
			requiredPromptText: args.requiredPromptText,
		}),
	});
	const { id } = fixtureIdSchema.parse(await registration.json());
	try {
		return await run({
			sourceHash,
			read: async () => fixtureStateSchema.parse(
				await (await controlRequest(control, `/fixtures/${id}`)).json(),
			),
		});
	} finally {
		await controlRequest(control, `/fixtures/${id}`, { method: "DELETE" });
	}
}
