import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
	E2E_LOCAL: z.literal("1"), E2E_MODE: z.literal("authenticated"),
	E2E_RUN_ID: z.string().uuid(), E2E_INSTANCE_MANIFEST: z.string(),
	E2E_BILLING_PROVIDER_URL: z.string().url(), E2E_BILLING_PROVIDER_TOKEN: z.string().uuid(),
	E2E_BILLING_WEBHOOK_SECRET: z.string().uuid(), E2E_WHATSAPP_RESPONSE_SECRET: z.string().uuid(),
});
const manifestSchema = z.object({
	kind: z.literal("owned-local-integration"), runId: z.string().uuid(),
	projectId: z.string(), workspace: z.string(), status: z.literal("running"),
	billingProvider: z.object({ enabled: z.literal(true), url: z.string().url() }),
});
const statusSchema = z.enum(["pending", "authorized", "paused", "cancelled", "rejected"]);
const requestsSchema = z.object({
	requests: z.array(z.object({ method: z.enum(["GET", "POST", "PUT"]), path: z.string(), payload: z.record(z.unknown()).optional() })),
});

async function control() {
	const env = environmentSchema.parse(process.env);
	const manifest = manifestSchema.parse(JSON.parse(await readFile(env.E2E_INSTANCE_MANIFEST, "utf8")));
	const url = new URL(env.E2E_BILLING_PROVIDER_URL);
	if (
		url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port ||
		url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
		manifest.runId !== env.E2E_RUN_ID || manifest.projectId !== `e2e_${env.E2E_RUN_ID.replaceAll("-", "")}` ||
		resolve(env.E2E_INSTANCE_MANIFEST) !== join(resolve(manifest.workspace), "instance.json") ||
		manifest.billingProvider.url !== env.E2E_BILLING_PROVIDER_URL
	) throw new Error("Billing control does not match the owned local runtime");
	return env;
}

export async function signedMobileUrl(kind: "flow" | "respond", runId: string) {
	const env = await control();
	const signature = createHmac("sha256", env.E2E_WHATSAPP_RESPONSE_SECRET).update(runId).digest("hex");
	return `/whatsapp/${kind}/${runId}?token=${signature}`;
}

export async function withBillingProvider<T>(input: {
	namespace: string; tenantId: string; planKey: string; status: z.infer<typeof statusSchema>;
}, run: (provider: {
	id: string; periodEnd: string;
	read(): Promise<z.infer<typeof requestsSchema>>;
	setStatus(status: z.infer<typeof statusSchema>): Promise<void>;
	headers(requestId?: string): Record<string, string>;
}) => Promise<T>) {
	const env = await control();
	async function request(path: string, init?: RequestInit) {
		const response = await fetch(`${env.E2E_BILLING_PROVIDER_URL}${path}`, {
			...init, headers: { "x-e2e-provider-token": env.E2E_BILLING_PROVIDER_TOKEN, "content-type": "application/json" },
		});
		if (!response.ok) throw new Error(`Billing control ${path} failed with ${response.status}`);
		return response;
	}
	const id = randomUUID();
	const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
	const registration = z.object({ id: z.string().uuid() }).parse(await (await request("/fixtures", {
		method: "POST", body: JSON.stringify({
			namespace: input.namespace,
			preapproval: {
				id, status: input.status, external_reference: `tenant:${input.tenantId}|plan:${input.planKey}`,
				next_payment_date: periodEnd, init_point: `${env.E2E_BILLING_PROVIDER_URL}/checkout/${id}`,
			},
		}),
	})).json());
	try {
		return await run({
			id, periodEnd,
			read: async () => requestsSchema.parse(await (await request(`/fixtures/${registration.id}`)).json()),
			setStatus: async (status) => { await request(`/fixtures/${registration.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); },
			headers: (requestId = randomUUID()) => {
				const ts = String(Date.now());
				const v1 = createHmac("sha256", env.E2E_BILLING_WEBHOOK_SECRET).update(`id:${id};request-id:${requestId};ts:${ts};`).digest("hex");
				return { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${v1}` };
			},
		});
	} finally {
		await request(`/fixtures/${registration.id}`, { method: "DELETE" });
	}
}
