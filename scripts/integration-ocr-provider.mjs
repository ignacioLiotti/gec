import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";

const mimeSchema = z.enum(["image/png", "image/jpeg", "application/pdf"]);
const fixtureSchema = z.object({
	namespace: z.string().regex(/^e2e-[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
	sourceHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
	mimeType: mimeSchema,
	extraction: z.record(z.unknown()),
	failures: z.number().int().min(0).max(3).optional().default(0),
	requiredPromptText: z.string().min(1).max(500).optional(),
}).strict();
const geminiPartSchema = z.union([
	z.object({ text: z.string().min(1) }).strict(),
	z.object({ inline_data: z.object({ mime_type: mimeSchema, data: z.string().min(1) }).strict() }).strict(),
]);
const geminiBodySchema = z.object({
	contents: z.array(z.object({ parts: z.array(geminiPartSchema).min(1) }).strict()).min(1),
}).passthrough();
class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}
function sendJson(response, status, value) {
	const body = JSON.stringify(value);
	response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
	response.end(body);
}
async function readJson(request) {
	if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
		throw new HttpError(415, "Content-Type must be application/json");
	}
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += bytes.length;
		if (size > 20 * 1024 * 1024) throw new HttpError(413, "Request body too large");
		chunks.push(bytes);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new HttpError(400, "Malformed JSON body");
	}
}
function decodeBase64(value) {
	if (value.length % 4 !== 0 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(value)) {
		throw new HttpError(400, "Invalid inline base64 data");
	}
	const bytes = Buffer.from(value, "base64");
	if (bytes.length === 0 || bytes.toString("base64") !== value) {
		throw new HttpError(400, "Invalid inline base64 data");
	}
	return bytes;
}
function parseGeminiRequest(value) {
	const parsed = geminiBodySchema.safeParse(value);
	if (!parsed.success) throw new HttpError(400, "Malformed Gemini request body");
	const parts = parsed.data.contents.flatMap((content) => content.parts);
	const textParts = parts.filter((part) => "text" in part);
	const inlineParts = parts.filter((part) => "inline_data" in part);
	if (parts.length !== 2 || textParts.length !== 1 || inlineParts.length !== 1) {
		throw new HttpError(400, "Gemini request requires one prompt and one inline source");
	}
	return {
		prompt: textParts[0].text,
		mimeType: inlineParts[0].inline_data.mime_type,
		bytes: decodeBase64(inlineParts[0].inline_data.data),
	};
}
export async function startOcrProviderFixture() {
	const token = randomUUID();
	const fixtures = new Map();
	const fixtureIdByHash = new Map();
	const fixtureIdByNamespace = new Map();
	const sockets = new Set();

	const server = createServer(async (request, response) => {
		try {
			const url = new URL(request.url ?? "/", "http://127.0.0.1");
			if (request.method === "GET" && url.pathname === "/health") {
				sendJson(response, 200, { ok: true });
				return;
			}
			if (request.headers["x-e2e-provider-token"] !== token) {
				throw new HttpError(401, "Unauthorized provider fixture request");
			}

			if (request.method === "POST" && url.pathname === "/fixtures") {
				const result = fixtureSchema.safeParse(await readJson(request));
				if (!result.success) throw new HttpError(400, "Invalid OCR fixture registration");
				const sourceHash = result.data.sourceHash.toLowerCase();
				if (fixtureIdByHash.has(sourceHash) || fixtureIdByNamespace.has(result.data.namespace)) {
					throw new HttpError(409, "OCR fixture already registered");
				}
				const id = randomUUID();
				fixtures.set(id, { ...result.data, sourceHash, remainingFailures: result.data.failures, requests: [] });
				fixtureIdByHash.set(sourceHash, id);
				fixtureIdByNamespace.set(result.data.namespace, id);
				sendJson(response, 201, { id });
				return;
			}

			const fixtureMatch = url.pathname.match(/^\/fixtures\/([0-9a-f-]+)$/i);
			if (fixtureMatch) {
				const fixture = fixtures.get(fixtureMatch[1]);
				if (!fixture) throw new HttpError(404, "OCR fixture not found");
				if (request.method === "GET") {
					sendJson(response, 200, { requests: fixture.requests, remainingFailures: fixture.remainingFailures });
					return;
				}
				if (request.method === "DELETE") {
					fixtures.delete(fixtureMatch[1]);
					fixtureIdByHash.delete(fixture.sourceHash);
					fixtureIdByNamespace.delete(fixture.namespace);
					sendJson(response, 200, { deleted: true });
					return;
				}
				throw new HttpError(405, "Method not allowed");
			}

			const providerMatch = url.pathname.match(/^\/google\/v1beta\/models\/([^/]+):generateContent$/);
			if (providerMatch) {
				if (request.method !== "POST") throw new HttpError(405, "Method not allowed");
				const gemini = parseGeminiRequest(await readJson(request));
				const sourceHash = createHash("sha256").update(gemini.bytes).digest("hex");
				const fixtureId = fixtureIdByHash.get(sourceHash);
				const fixture = fixtureId ? fixtures.get(fixtureId) : null;
				if (!fixture) throw new HttpError(404, "No OCR fixture matches these bytes");
				if (fixture.mimeType !== gemini.mimeType) throw new HttpError(422, "OCR fixture MIME type does not match");
				fixture.requests.push({
					sourceHash,
					mimeType: gemini.mimeType,
					bytes: gemini.bytes.length,
					modelPath: url.pathname,
					attempt: fixture.requests.length + 1,
					promptHash: createHash("sha256").update(gemini.prompt).digest("hex"),
					...(fixture.requiredPromptText ? { promptRequirementMet: gemini.prompt.includes(fixture.requiredPromptText) } : {}),
				});
				if (fixture.remainingFailures > 0) {
					fixture.remainingFailures -= 1;
					sendJson(response, 503, {
						error: { code: 503, message: "Synthetic OCR provider unavailable", status: "UNAVAILABLE" },
					});
					return;
				}
				sendJson(response, 200, {
					candidates: [{ content: { parts: [{ text: JSON.stringify(fixture.extraction) }] } }],
					usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40, totalTokenCount: 140 },
				});
				return;
			}

			throw new HttpError(404, "Provider fixture route not found");
		} catch (error) {
			const status = error instanceof HttpError ? error.status : 500;
			const message = error instanceof HttpError ? error.message : "Provider fixture failure";
			if (!response.headersSent) sendJson(response, status, { error: message });
			else response.destroy();
		}
	});

	server.on("connection", (socket) => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("OCR provider fixture did not bind a loopback port");
	let closePromise = null;
	return {
		url: `http://127.0.0.1:${address.port}`,
		token,
		close() {
			if (!closePromise) {
				closePromise = new Promise((resolve, reject) => {
					server.close((error) => error ? reject(error) : resolve({ port: address.port, closed: true }));
					server.closeAllConnections?.();
					for (const socket of sockets) socket.destroy();
				});
			}
			return closePromise;
		},
	};
}
