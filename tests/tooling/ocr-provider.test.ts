import { createHash } from "node:crypto";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { startOcrProviderFixture } from "@/scripts/integration-ocr-provider.mjs";

const registrationSchema = z.object({ id: z.string().uuid() });
const requestSchema = z.object({
	sourceHash: z.string().length(64),
	mimeType: z.string(),
	bytes: z.number().int().positive(),
	modelPath: z.string(),
	attempt: z.number().int().positive(),
	promptHash: z.string().length(64),
	promptRequirementMet: z.boolean().optional(),
}).strict();
const inspectionSchema = z.object({
	requests: z.array(requestSchema),
	remainingFailures: z.number().int().min(0),
});

function digest(value: Uint8Array | string) {
	return createHash("sha256").update(value).digest("hex");
}

function fixtureHeaders(token: string) {
	return {
		"content-type": "application/json",
		"x-e2e-provider-token": token,
	};
}

function geminiBody(bytes: Buffer, mimeType = "image/png", prompt = "Extract the registered invoice") {
	return {
		contents: [{ parts: [
			{ text: prompt },
			{ inline_data: { mime_type: mimeType, data: bytes.toString("base64") } },
		] }],
		generationConfig: { temperature: 0.1 },
	};
}

async function registerFixture(
	provider: Awaited<ReturnType<typeof startOcrProviderFixture>>,
	params: { namespace: string; bytes: Buffer; failures?: number; requiredPromptText?: string },
) {
	const response = await fetch(`${provider.url}/fixtures`, {
		method: "POST",
		headers: fixtureHeaders(provider.token),
		body: JSON.stringify({
			namespace: params.namespace,
			sourceHash: digest(params.bytes),
			mimeType: "image/png",
			extraction: { rows: [{ code: "A-17", amount: 4200 }] },
			failures: params.failures ?? 0,
			requiredPromptText: params.requiredPromptText,
		}),
	});
	expect(response.status).toBe(201);
	return registrationSchema.parse(await response.json()).id;
}

describe("isolated OCR provider boundary", () => {
	it("records whether the actual prompt honors a declared scope without retaining its text", async () => {
		const provider = await startOcrProviderFixture();
		try {
			const bytes = Buffer.from("page-scoped synthetic source");
			const scope = "Analyze page 2 only";
			const id = await registerFixture(provider, { namespace: "e2e-provider-scope", bytes, requiredPromptText: scope });
			for (const prompt of ["Analyze every page", `Extract the selected source. ${scope}`]) {
				const response = await fetch(`${provider.url}/google/v1beta/models/gemini:generateContent`, {
					method: "POST", headers: fixtureHeaders(provider.token), body: JSON.stringify(geminiBody(bytes, "image/png", prompt)),
				});
				expect(response.status).toBe(200);
			}
			const inspected = inspectionSchema.parse(await (await fetch(`${provider.url}/fixtures/${id}`, { headers: { "x-e2e-provider-token": provider.token } })).json());
			expect(inspected.requests.map(request => request.promptRequirementMet)).toEqual([false, true]);
			expect(JSON.stringify(inspected)).not.toContain(scope);
		} finally {
			await provider.close();
		}
	});

	it("matches registered bytes and returns a Gemini envelope while retaining metadata only", async () => {
		const provider = await startOcrProviderFixture();
		try {
			const bytes = Buffer.from("synthetic png bytes");
			const prompt = "Extract invoice fields without markdown";
			const fixtureId = await registerFixture(provider, {
				namespace: "e2e-provider-envelope",
				bytes,
			});
			const response = await fetch(
				`${provider.url}/google/v1beta/models/gemini-2.5-flash:generateContent?key=ignored-secret`,
				{
					method: "POST",
					headers: fixtureHeaders(provider.token),
					body: JSON.stringify(geminiBody(bytes, "image/png", prompt)),
				},
			);
			expect(response.status).toBe(200);
			const payload = z.object({
				candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string() })) }) })),
				usageMetadata: z.object({
					promptTokenCount: z.literal(100),
					candidatesTokenCount: z.literal(40),
					totalTokenCount: z.literal(140),
				}),
			}).parse(await response.json());
			expect(JSON.parse(payload.candidates[0].content.parts[0].text)).toEqual({
				rows: [{ code: "A-17", amount: 4200 }],
			});

			const inspectionResponse = await fetch(`${provider.url}/fixtures/${fixtureId}`, {
				headers: { "x-e2e-provider-token": provider.token },
			});
			expect(inspectionResponse.status).toBe(200);
			const inspection = inspectionSchema.parse(await inspectionResponse.json());
			expect(inspection).toEqual({
				requests: [{
					sourceHash: digest(bytes),
					mimeType: "image/png",
					bytes: bytes.length,
					modelPath: "/google/v1beta/models/gemini-2.5-flash:generateContent",
					attempt: 1,
					promptHash: digest(prompt),
				}],
				remainingFailures: 0,
			});
			expect(JSON.stringify(inspection)).not.toContain(prompt);
			expect(JSON.stringify(inspection)).not.toContain(bytes.toString("base64"));
		} finally {
			await provider.close();
		}
	});

	it("returns one synthetic outage and succeeds only when the caller retries", async () => {
		const provider = await startOcrProviderFixture();
		try {
			const bytes = Buffer.from("retryable png bytes");
			const fixtureId = await registerFixture(provider, {
				namespace: "e2e-provider-retry",
				bytes,
				failures: 1,
			});
			const endpoint = `${provider.url}/google/v1beta/models/gemini-retry:generateContent`;
			const request = () => fetch(endpoint, {
				method: "POST",
				headers: fixtureHeaders(provider.token),
				body: JSON.stringify(geminiBody(bytes)),
			});

			const failed = await request();
			expect(failed.status).toBe(503);
			expect(await failed.json()).toEqual({
				error: {
					code: 503,
					message: "Synthetic OCR provider unavailable",
					status: "UNAVAILABLE",
				},
			});
			const recovered = await request();
			expect(recovered.status).toBe(200);

			const inspection = inspectionSchema.parse(await (
				await fetch(`${provider.url}/fixtures/${fixtureId}`, {
					headers: { "x-e2e-provider-token": provider.token },
				})
			).json());
			expect(inspection.remainingFailures).toBe(0);
			expect(inspection.requests.map((entry) => entry.attempt)).toEqual([1, 2]);
		} finally {
			await provider.close();
		}
	});

	it("denies unauthenticated, malformed, unknown-byte, wrong-MIME and wrong-path calls", async () => {
		const provider = await startOcrProviderFixture();
		try {
			const bytes = Buffer.from("registered boundary bytes");
			await registerFixture(provider, {
				namespace: "e2e-provider-denials",
				bytes,
			});
			expect((await fetch(`${provider.url}/health`)).status).toBe(200);
			expect((await fetch(`${provider.url}/fixtures`)).status).toBe(401);
			expect((await fetch(`${provider.url}/google/v1beta/models/gemini:generateContent`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(geminiBody(bytes)),
			})).status).toBe(401);

			const endpoint = `${provider.url}/google/v1beta/models/gemini:generateContent`;
			expect((await fetch(endpoint, {
				headers: { "x-e2e-provider-token": provider.token },
			})).status).toBe(405);
			expect((await fetch(endpoint, {
				method: "POST",
				headers: { "x-e2e-provider-token": provider.token },
				body: JSON.stringify(geminiBody(bytes)),
			})).status).toBe(415);
			const request = (body: unknown) => fetch(endpoint, {
				method: "POST",
				headers: fixtureHeaders(provider.token),
				body: JSON.stringify(body),
			});
			expect((await request(geminiBody(Buffer.from("unknown bytes")))).status).toBe(404);
			expect((await request(geminiBody(bytes, "image/jpeg"))).status).toBe(422);
			expect((await request({ contents: [{ parts: [{ text: "missing source" }] }] })).status).toBe(400);
			expect((await fetch(endpoint, {
				method: "POST",
				headers: fixtureHeaders(provider.token),
				body: "{not-json",
			})).status).toBe(400);
			expect((await fetch(`${provider.url}/google/v1/models/gemini:generateContent`, {
				method: "POST",
				headers: fixtureHeaders(provider.token),
				body: JSON.stringify(geminiBody(bytes)),
			})).status).toBe(404);
		} finally {
			await provider.close();
		}
	});

	it("rejects duplicate registrations, deletes explicitly, and closes its loopback port", async () => {
		const provider = await startOcrProviderFixture();
		const bytes = Buffer.from("unique registration bytes");
		const fixtureId = await registerFixture(provider, {
			namespace: "e2e-provider-lifecycle",
			bytes,
		});
		const duplicateHash = await fetch(`${provider.url}/fixtures`, {
			method: "POST",
			headers: fixtureHeaders(provider.token),
			body: JSON.stringify({
				namespace: "e2e-provider-second-name",
				sourceHash: digest(bytes),
				mimeType: "image/png",
				extraction: {},
			}),
		});
		expect(duplicateHash.status).toBe(409);

		const deleted = await fetch(`${provider.url}/fixtures/${fixtureId}`, {
			method: "DELETE",
			headers: { "x-e2e-provider-token": provider.token },
		});
		expect(deleted.status).toBe(200);
		expect((await fetch(`${provider.url}/fixtures/${fixtureId}`, {
			headers: { "x-e2e-provider-token": provider.token },
		})).status).toBe(404);

		const closeProof = await provider.close();
		expect(closeProof).toEqual({
			port: Number(new URL(provider.url).port),
			closed: true,
		});
		await expect(fetch(`${provider.url}/health`)).rejects.toThrow();
	});
});
