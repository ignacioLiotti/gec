import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

const temporaryRoots = new Set<string>();
const preloadUrl = pathToFileURL(
	path.resolve("scripts/integration-local-network.mjs"),
).href;
const blockedMessage = "External HTTP transport disabled in isolated integration runtime";

const transportProofSchema = z.object({
	providerStatus: z.literal(200),
	received: z.object({
		count: z.literal(1),
		method: z.literal("POST"),
		url: z.literal("/google/v1beta/models/gemini-2.5-flash:generateContent"),
		contentType: z.literal("application/json; charset=utf-8"),
		customHeader: z.literal("preserved"),
		authorizationPresent: z.literal(false),
		apiKeyPresent: z.literal(false),
		tokenMatched: z.literal(true),
		bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
	}),
	blocked: z.object({
		otherHost: z.string(),
		wrongMethod: z.string(),
		wrongPath: z.string(),
	}),
});

afterEach(async () => {
	await Promise.all(
		[...temporaryRoots].map((root) => {
			const target = path.resolve(root);
			if (
				path.dirname(target) !== path.resolve(tmpdir()) ||
				!path.basename(target).startsWith("ocr-network-")
			) {
				throw new Error("Refusing to remove a directory outside this test's temporary roots.");
			}
			return rm(target, { recursive: true, force: true });
		}),
	);
	temporaryRoots.clear();
});

async function temporaryDirectory() {
	const directory = await mkdtemp(path.join(tmpdir(), "ocr-network-"));
	temporaryRoots.add(directory);
	return directory;
}

function digest(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

function runNode(script: string, env: Partial<NodeJS.ProcessEnv> = {}) {
	return spawnSync(process.execPath, ["-e", script], {
		cwd: process.cwd(),
		env: { ...process.env, ...env },
		encoding: "utf8",
		windowsHide: true,
		timeout: 15_000,
	});
}

function ownedManifest(params: {
	runId: string;
	providerUrl: string;
	overrides?: Record<string, unknown>;
}) {
	return {
		kind: "owned-local-integration",
		runId: params.runId,
		projectId: `e2e_${params.runId.replaceAll("-", "")}`,
		mode: "authenticated",
		status: "running",
		ocrProvider: { enabled: true, url: params.providerUrl },
		...params.overrides,
	};
}

describe("isolated OCR provider network rewrite", () => {
	it("forwards only Gemini generateContent fetches to the owned loopback provider", async () => {
		const root = await temporaryDirectory();
		const manifestPath = path.join(root, "instance.json");
		const runId = randomUUID();
		const requestBody = JSON.stringify({
			contents: [{ parts: [{ text: "transport contract" }] }],
		});
		const childScript = String.raw`
			const { createHash } = require("node:crypto");
			const { writeFileSync } = require("node:fs");
			const http = require("node:http");
			const token = "owned-provider-token";
			let received = null;
			let count = 0;
			const server = http.createServer((request, response) => {
				const chunks = [];
				request.on("data", (chunk) => chunks.push(chunk));
				request.on("end", () => {
					count += 1;
					const body = Buffer.concat(chunks);
					received = {
						count,
						method: request.method,
						url: request.url,
						contentType: request.headers["content-type"],
						customHeader: request.headers["x-transport-proof"],
						authorizationPresent: "authorization" in request.headers,
						apiKeyPresent: "x-goog-api-key" in request.headers,
						tokenMatched: request.headers["x-e2e-provider-token"] === token,
						bodyHash: createHash("sha256").update(body).digest("hex"),
					};
					response.writeHead(200, { "content-type": "application/json" });
					response.end('{"ok":true}');
				});
			});
			function message(error) {
				return error instanceof Error ? error.message : String(error);
			}
			async function blocked(url, init) {
				try {
					await fetch(url, init);
					return "request unexpectedly started";
				} catch (error) {
					return message(error);
				}
			}
			(async () => {
				await new Promise((resolve, reject) => {
					server.once("error", reject);
					server.listen(0, "127.0.0.1", resolve);
				});
				try {
					const address = server.address();
					if (!address || typeof address === "string") throw new Error("No provider port");
					const providerUrl = "http://127.0.0.1:" + address.port;
					writeFileSync(${JSON.stringify(manifestPath)}, JSON.stringify({
						kind: "owned-local-integration",
						runId: ${JSON.stringify(runId)},
						projectId: "e2e_" + ${JSON.stringify(runId)}.replaceAll("-", ""),
						mode: "authenticated",
						status: "running",
						ocrProvider: { enabled: true, url: providerUrl },
					}));
					process.env.E2E_LOCAL = "1";
					process.env.E2E_RUN_ID = ${JSON.stringify(runId)};
					process.env.E2E_INSTANCE_MANIFEST = ${JSON.stringify(manifestPath)};
					process.env.E2E_OCR_PROVIDER_URL = providerUrl;
					process.env.E2E_OCR_PROVIDER_TOKEN = token;
					await import(${JSON.stringify(preloadUrl)});

					const providerResponse = await fetch(
						"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=must-disappear&alt=sse",
						{
							method: "POST",
							headers: {
								"content-type": "application/json; charset=utf-8",
								"authorization": "Bearer must-disappear",
								"x-goog-api-key": "must-disappear",
								"x-transport-proof": "preserved",
							},
							body: ${JSON.stringify(requestBody)},
						},
					);
					await providerResponse.text();
					const blockedResults = {
						otherHost: await blocked("https://remote.invalid/provider", { method: "POST" }),
						wrongMethod: await blocked(
							"https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent",
							{ method: "GET" },
						),
						wrongPath: await blocked(
							"https://generativelanguage.googleapis.com/v1beta/files",
							{ method: "POST" },
						),
					};
					process.stdout.write(JSON.stringify({
						providerStatus: providerResponse.status,
						received,
						blocked: blockedResults,
					}));
				} finally {
					await new Promise((resolve) => server.close(resolve));
				}
			})().catch((error) => {
				console.error(message(error));
				process.exitCode = 1;
			});
		`;

		const child = runNode(childScript);
		expect(child.status, child.stderr).toBe(0);
		const proof = transportProofSchema.parse(JSON.parse(child.stdout));
		expect(proof.received.bodyHash).toBe(digest(requestBody));
		expect(proof.blocked).toEqual({
			otherHost: blockedMessage,
			wrongMethod: blockedMessage,
			wrongPath: blockedMessage,
		});
		expect(await readFile(manifestPath, "utf8")).not.toContain("must-disappear");
	});

	it("rejects missing or forged owned-provider configuration during preload import", async () => {
		const root = await temporaryDirectory();
		const runId = randomUUID();
		const providerUrl = "http://127.0.0.1:45678";
		const manifestPath = path.join(root, "instance.json");
		const importScript = `import(${JSON.stringify(preloadUrl)}).catch((error) => { console.error(error.message); process.exitCode = 1; });`;

		await writeFile(
			manifestPath,
			JSON.stringify(ownedManifest({ runId, providerUrl })),
		);
		const baseEnvironment = {
			E2E_LOCAL: "1",
			E2E_RUN_ID: runId,
			E2E_INSTANCE_MANIFEST: manifestPath,
			E2E_OCR_PROVIDER_URL: providerUrl,
		};
		const missingToken = runNode(importScript, baseEnvironment);
		expect(missingToken.status).toBe(1);
		expect(missingToken.stderr).toContain("E2E_OCR_PROVIDER_TOKEN is required");

		await writeFile(
			manifestPath,
			JSON.stringify(ownedManifest({
				runId,
				providerUrl,
				overrides: { runId: randomUUID() },
			})),
		);
		const forgedManifest = runNode(importScript, {
			...baseEnvironment,
			E2E_OCR_PROVIDER_TOKEN: "fixture-token",
		});
		expect(forgedManifest.status).toBe(1);
			expect(forgedManifest.stderr).toContain(
			"the owned instance manifest does not match this provider",
		);

		await writeFile(
			manifestPath,
			JSON.stringify(ownedManifest({
				runId,
				providerUrl: "http://127.0.0.1:45679",
			})),
		);
		const mismatchedProvider = runNode(importScript, {
			...baseEnvironment,
			E2E_OCR_PROVIDER_TOKEN: "fixture-token",
		});
		expect(mismatchedProvider.status).toBe(1);
		expect(mismatchedProvider.stderr).toContain(
			"the owned instance manifest does not match this provider",
		);

		const missingManifest = runNode(importScript, {
			...baseEnvironment,
			E2E_INSTANCE_MANIFEST: "",
			E2E_OCR_PROVIDER_TOKEN: "fixture-token",
		});
		expect(missingManifest.status).toBe(1);
		expect(missingManifest.stderr).toContain("E2E_INSTANCE_MANIFEST is required");
	});
});
