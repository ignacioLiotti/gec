import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";

const preapprovalSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["pending", "authorized", "paused", "cancelled", "rejected"]),
	external_reference: z.string().regex(/^tenant:[0-9a-f-]+\|plan:e2e-/),
	next_payment_date: z.string().datetime(),
	init_point: z.string().url(),
}).strict();
const registrationSchema = z.object({
	namespace: z.string().startsWith("e2e-"),
	preapproval: preapprovalSchema,
}).strict();

function send(response, status, value) {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify(value));
}

async function body(request) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > 65536) throw new Error("Provider request exceeds limit");
		chunks.push(chunk);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function startBillingProviderFixture() {
	const token = randomUUID();
	const accessToken = `TEST-${randomUUID()}`;
	const fixtures = new Map();
	const sockets = new Set();
	const server = createServer(async (request, response) => {
		try {
			const url = new URL(request.url ?? "/", "http://127.0.0.1");
			if (url.pathname === "/health" && request.method === "GET") return send(response, 200, { ok: true });
			if (url.pathname.startsWith("/fixtures")) {
				if (request.headers["x-e2e-provider-token"] !== token) return send(response, 401, { error: "Unauthorized control" });
				if (url.pathname === "/fixtures" && request.method === "POST") {
					const parsed = registrationSchema.parse(await body(request));
					if ([...fixtures.values()].some((item) => item.preapproval.id === parsed.preapproval.id || item.preapproval.external_reference === parsed.preapproval.external_reference)) {
						return send(response, 409, { error: "Duplicate fixture" });
					}
					const id = randomUUID();
					fixtures.set(id, { ...parsed, requests: [] });
					return send(response, 201, { id });
				}
				const id = url.pathname.slice("/fixtures/".length);
				const fixture = fixtures.get(id);
				if (!fixture) return send(response, 404, { error: "Unknown fixture" });
				if (request.method === "GET") return send(response, 200, { requests: fixture.requests });
				if (request.method === "PATCH") {
					const update = z.object({ status: preapprovalSchema.shape.status }).strict().parse(await body(request));
					fixture.preapproval.status = update.status;
					return send(response, 200, { updated: true });
				}
				if (request.method === "DELETE") {
					fixtures.delete(id);
					return send(response, 200, { deleted: true });
				}
				return send(response, 405, { error: "Unsupported control method" });
			}
			if (request.headers.authorization !== `Bearer ${accessToken}`) return send(response, 401, { message: "Unauthorized provider" });
			if (url.pathname === "/preapproval" && request.method === "POST") {
				const payload = z.object({
					external_reference: z.string(), status: z.literal("pending"),
					payer_email: z.string().email(), reason: z.string(),
					back_url: z.string().url(), notification_url: z.string().url(),
					auto_recurring: z.object({
						frequency: z.number(), frequency_type: z.string(),
						transaction_amount: z.number(), currency_id: z.literal("ARS"),
					}).strict(),
				}).strict().parse(await body(request));
				const fixture = [...fixtures.values()].find((item) => item.preapproval.external_reference === payload.external_reference);
				if (!fixture) return send(response, 404, { message: "Unregistered checkout" });
				if (!request.headers["x-idempotency-key"]) return send(response, 400, { message: "Missing idempotency key" });
				fixture.requests.push({ method: "POST", path: url.pathname, payload });
				return send(response, 201, fixture.preapproval);
			}
			const match = url.pathname.match(/^\/preapproval\/([^/]+)$/);
			if (match) {
				const fixture = [...fixtures.values()].find((item) => item.preapproval.id === decodeURIComponent(match[1]));
				if (!fixture) return send(response, 404, { message: "Unregistered preapproval" });
				if (request.method === "GET") {
					fixture.requests.push({ method: "GET", path: url.pathname });
					return send(response, 200, fixture.preapproval);
				}
				if (request.method === "PUT") {
					const payload = z.object({ auto_recurring: z.object({ end_date: z.string().datetime() }).strict() }).strict().parse(await body(request));
					fixture.requests.push({ method: "PUT", path: url.pathname, payload });
					return send(response, 200, { ...fixture.preapproval, ...payload });
				}
			}
			send(response, 404, { message: "Unknown synthetic provider route" });
		} catch {
			if (!response.headersSent) send(response, 400, { message: "Invalid synthetic provider request" });
			else response.destroy();
		}
	});
	server.on("connection", (socket) => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Billing fixture failed to bind");
	let closePromise;
	return {
		url: `http://127.0.0.1:${address.port}`, token, accessToken,
		webhookSecret: randomUUID(), responseSecret: randomUUID(),
		close() {
			closePromise ??= new Promise((resolve, reject) => {
				server.close((error) => error ? reject(error) : resolve({ closed: true, port: address.port }));
				server.closeAllConnections?.();
				for (const socket of sockets) socket.destroy();
			});
			return closePromise;
		},
	};
}
