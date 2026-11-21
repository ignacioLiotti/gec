import { afterEach, describe, expect, it } from "vitest";

import {
	buildMercadoPagoExternalReference,
	buildMercadoPagoPreapprovalRequest,
	buildMercadoPagoSignatureManifest,
	createMercadoPagoPreapproval,
	fetchMercadoPagoPreapproval,
	getMercadoPagoRuntimeDebug,
	mapMercadoPagoPreapprovalStatus,
	parseMercadoPagoExternalReference,
	parseMercadoPagoSignatureHeader,
	resolveMercadoPagoModeFromToken,
	resolveMercadoPagoPayerEmail,
	resolveMercadoPagoPlanConfig,
	updateMercadoPagoPreapproval,
	verifyMercadoPagoWebhookSignature,
} from "@/lib/billing/mercadopago";

const ENV_KEYS = [
	"MERCADOPAGO_ACCESS_TOKEN",
	"MERCADOPAGO_API_BASE_URL",
	"MERCADOPAGO_TEST_PAYER_EMAIL",
	"MERCADOPAGO_PLAN_GROWTH_PREAPPROVAL_PLAN_ID",
	"MERCADOPAGO_PLAN_GROWTH_AMOUNT_ARS",
	"MERCADOPAGO_PLAN_GROWTH_FREQUENCY",
	"MERCADOPAGO_PLAN_GROWTH_FREQUENCY_TYPE",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
	ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (typeof ORIGINAL_ENV[key] === "undefined") {
			delete process.env[key];
		} else {
			process.env[key] = ORIGINAL_ENV[key];
		}
	}
});

describe("mercadopago signature helpers", () => {
	it("parses valid signature headers", () => {
		expect(parseMercadoPagoSignatureHeader("ts=1710000000,v1=abc123")).toEqual({
			ts: "1710000000",
			v1: "abc123",
		});
		expect(parseMercadoPagoSignatureHeader("invalid")).toBeNull();
	});

	it("verifies an independently signed provider notification", () => {
		expect(buildMercadoPagoSignatureManifest({
			dataId: "pre_123",
			requestId: "req-1",
			ts: "1710000000",
		})).toBe("id:pre_123;request-id:req-1;ts:1710000000;");

		expect(
			verifyMercadoPagoWebhookSignature({
				secret: "webhook-secret",
				signatureHeader: "ts=1710000000,v1=7f3e0cfafba6fc14f4d6e7615b03037064132ba97e6edf87dfd70ce6dbff21fc",
				requestIdHeader: "req-1",
				dataId: "pre_123",
			}),
		).toBe(true);
	});

	it.each([
		{ changed: "event id", patch: { dataId: "pre_456" } },
		{ changed: "request id", patch: { requestIdHeader: "req-2" } },
		{ changed: "secret", patch: { secret: "different-secret" } },
		{ changed: "timestamp", patch: { signatureHeader: "ts=1710000001,v1=7f3e0cfafba6fc14f4d6e7615b03037064132ba97e6edf87dfd70ce6dbff21fc" } },
		{ changed: "signature", patch: { signatureHeader: "ts=1710000000,v1=wrong" } },
		{ changed: "missing signature", patch: { signatureHeader: null } },
		{ changed: "missing request id", patch: { requestIdHeader: null } },
		{ changed: "missing event id", patch: { dataId: null } },
	])("rejects a notification with $changed", ({ patch }) => {
		expect(
			verifyMercadoPagoWebhookSignature({
				secret: "webhook-secret",
				signatureHeader: "ts=1710000000,v1=7f3e0cfafba6fc14f4d6e7615b03037064132ba97e6edf87dfd70ce6dbff21fc",
				requestIdHeader: "req-1",
				dataId: "pre_123",
				...patch,
			}),
		).toBe(false);
	});
});

describe("mercadopago mapping helpers", () => {
	it("resolves runtime mode from token", () => {
		expect(resolveMercadoPagoModeFromToken("TEST-123")).toBe("test");
		expect(resolveMercadoPagoModeFromToken("APP_USR-123")).toBe("production");
		expect(resolveMercadoPagoModeFromToken("")).toBe("unknown");
	});

	it("maps preapproval statuses to internal status", () => {
		expect(mapMercadoPagoPreapprovalStatus("authorized")).toBe("active");
		expect(mapMercadoPagoPreapprovalStatus("paused")).toBe("paused");
		expect(mapMercadoPagoPreapprovalStatus("rejected")).toBe("past_due");
		expect(mapMercadoPagoPreapprovalStatus("cancelled")).toBe("cancelled");
		expect(mapMercadoPagoPreapprovalStatus("")).toBe("pending");
	});

	it("builds and parses external references", () => {
		const reference = buildMercadoPagoExternalReference({
			tenantId: "tenant-1",
			planKey: "growth",
		});
		expect(reference).toBe("tenant:tenant-1|plan:growth");
		expect(parseMercadoPagoExternalReference(reference)).toEqual({
			tenantId: "tenant-1",
			planKey: "growth",
		});
	});
});

describe("mercadopago runtime debug helpers", () => {
	it("uses forced test payer email in test mode", () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-abc";
		process.env.MERCADOPAGO_TEST_PAYER_EMAIL = "buyer-ar@testuser.com";
		expect(resolveMercadoPagoPayerEmail("real@example.com")).toBe(
			"buyer-ar@testuser.com",
		);
	});

	it("falls back to default test payer email", () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-abc";
		delete process.env.MERCADOPAGO_TEST_PAYER_EMAIL;
		expect(resolveMercadoPagoPayerEmail("real@example.com")).toBe(
			"test@testuser.com",
		);
	});

	it("uses user email in production mode", () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-abc";
		expect(resolveMercadoPagoPayerEmail("owner@example.com")).toBe(
			"owner@example.com",
		);
	});

	it("does not expose the access token in runtime debug data", () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-1234567890";
		process.env.MERCADOPAGO_TEST_PAYER_EMAIL = "buyer-ar@testuser.com";
		const runtimeDebug = getMercadoPagoRuntimeDebug("owner@example.com");
		expect(runtimeDebug.mode).toBe("test");
		expect(runtimeDebug.payerEmail).toBe("buyer-ar@testuser.com");
		expect(runtimeDebug.sellerAccessTokenPreview).toBeTypeOf("string");
		expect(JSON.stringify(runtimeDebug)).not.toContain("TEST-1234567890");
	});
});

describe("mercadopago plan config", () => {
	it("prefers metadata values", () => {
		const config = resolveMercadoPagoPlanConfig("growth", {
			mercado_pago_preapproval_plan_id: "plan_123",
			mercado_pago_amount_ars: 45000,
			mercado_pago_frequency: 1,
			mercado_pago_frequency_type: "months",
		});
		expect(config).toEqual({
			preapprovalPlanId: "plan_123",
			amountArs: 45000,
			frequency: 1,
			frequencyType: "months",
			currencyId: "ARS",
		});
	});

	it("falls back to env config", () => {
		process.env.MERCADOPAGO_PLAN_GROWTH_PREAPPROVAL_PLAN_ID = "plan_env";
		process.env.MERCADOPAGO_PLAN_GROWTH_AMOUNT_ARS = "35000";
		process.env.MERCADOPAGO_PLAN_GROWTH_FREQUENCY = "2";
		process.env.MERCADOPAGO_PLAN_GROWTH_FREQUENCY_TYPE = "days";

		const config = resolveMercadoPagoPlanConfig("growth", null);
		expect(config).toEqual({
			preapprovalPlanId: "plan_env",
			amountArs: 35000,
			frequency: 2,
			frequencyType: "days",
			currencyId: "ARS",
		});
	});

	it("returns null if no pricing or preapproval plan exists", () => {
		expect(resolveMercadoPagoPlanConfig("growth", {})).toBeNull();
	});
});

describe("mercadopago preapproval payload", () => {
	it("builds payload with preapproval plan id", () => {
		const payload = buildMercadoPagoPreapprovalRequest({
			planKey: "growth",
			planName: "Growth",
			tenantId: "tenant-1",
			payerEmail: "foo@example.com",
			notificationUrl: "https://app.test/api/billing/mercadopago/webhook",
			backUrl: "https://app.test/billing",
			config: {
				preapprovalPlanId: "plan_123",
				amountArs: undefined,
				frequency: 1,
				frequencyType: "months",
				currencyId: "ARS",
			},
		}) as Record<string, unknown>;

		expect(payload.preapproval_plan_id).toBe("plan_123");
		expect(payload.auto_recurring).toBeUndefined();
		expect(payload.external_reference).toBe("tenant:tenant-1|plan:growth");
	});

	it("builds payload with auto recurring amount", () => {
		const payload = buildMercadoPagoPreapprovalRequest({
			planKey: "growth",
			planName: "Growth",
			tenantId: "tenant-1",
			payerEmail: "foo@example.com",
			notificationUrl: "https://app.test/api/billing/mercadopago/webhook",
			backUrl: "https://app.test/billing",
			config: {
				amountArs: 42000,
				frequency: 1,
				frequencyType: "months",
				currencyId: "ARS",
			},
		}) as Record<string, unknown>;

		expect(payload.preapproval_plan_id).toBeUndefined();
		expect(payload.auto_recurring).toEqual({
			frequency: 1,
			frequency_type: "months",
			transaction_amount: 42000,
			currency_id: "ARS",
		});
	});

	it("throws when plan has no payment config", () => {
		expect(() =>
			buildMercadoPagoPreapprovalRequest({
				planKey: "growth",
				planName: "Growth",
				tenantId: "tenant-1",
				payerEmail: "foo@example.com",
				notificationUrl: "https://app.test/api/billing/mercadopago/webhook",
				backUrl: "https://app.test/billing",
				config: {
					frequency: 1,
					frequencyType: "months",
					currencyId: "ARS",
				},
			}),
		).toThrowError("No hay precio configurado");
	});
});

describe("mercadopago API wrappers", () => {
	it("creates preapproval through API", async () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "token-1";
		process.env.MERCADOPAGO_API_BASE_URL = "https://api.example.com";
		let capturedRequest:
			| { url: string; init: RequestInit | undefined }
			| undefined;

		const preapproval = await createMercadoPagoPreapproval({
			planKey: "growth",
			planName: "Growth",
			tenantId: "tenant-1",
			payerEmail: "foo@example.com",
			notificationUrl: "https://app.test/api/billing/mercadopago/webhook",
			backUrl: "https://app.test/billing",
			config: {
				amountArs: 42000,
				frequency: 1,
				frequencyType: "months",
				currencyId: "ARS",
			},
			fetchImpl: async (url, init) => {
				capturedRequest = { url: String(url), init };
				return new Response(
					JSON.stringify({
						id: "pre_123",
						init_point: "https://mp.example/init",
						status: "pending",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			},
		});

		expect(capturedRequest?.url).toBe("https://api.example.com/preapproval");
		expect(capturedRequest?.init?.method).toBe("POST");
		const headers = new Headers(capturedRequest?.init?.headers);
		expect(headers.get("authorization")).toBe("Bearer token-1");
		expect(headers.get("content-type")).toBe("application/json");
		expect(
			JSON.parse(String(capturedRequest?.init?.body)) as unknown,
		).toEqual({
			reason: "Suscripcion Growth (growth)",
			external_reference: "tenant:tenant-1|plan:growth",
			payer_email: "foo@example.com",
			back_url: "https://app.test/billing",
			notification_url:
				"https://app.test/api/billing/mercadopago/webhook",
			status: "pending",
			auto_recurring: {
				frequency: 1,
				frequency_type: "months",
				transaction_amount: 42000,
				currency_id: "ARS",
			},
		});
		expect(preapproval.id).toBe("pre_123");
	});

	it("fetches preapproval details", async () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "token-1";
		process.env.MERCADOPAGO_API_BASE_URL = "https://api.example.com";
		const preapprovalId = "pre 999/with?query";
		let capturedRequest:
			| { url: string; init: RequestInit | undefined }
			| undefined;

		const preapproval = await fetchMercadoPagoPreapproval(preapprovalId, {
			fetchImpl: async (url, init) => {
				capturedRequest = { url: String(url), init };
				return new Response(
					JSON.stringify({
						id: preapprovalId,
						status: "authorized",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			},
		});

		expect(capturedRequest?.url).toBe(
			"https://api.example.com/preapproval/pre%20999%2Fwith%3Fquery",
		);
		expect(capturedRequest?.init?.method).toBe("GET");
		const headers = new Headers(capturedRequest?.init?.headers);
		expect(headers.get("authorization")).toBe("Bearer token-1");
		expect(headers.get("content-type")).toBe("application/json");
		expect(capturedRequest?.init?.body).toBeUndefined();
		expect(preapproval.id).toBe(preapprovalId);
		expect(preapproval.status).toBe("authorized");
	});

	it("updates preapproval details", async () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "token-1";
		process.env.MERCADOPAGO_API_BASE_URL = "https://api.example.com";
		let capturedRequest:
			| { url: string; init: RequestInit | undefined }
			| undefined;

		const updated = await updateMercadoPagoPreapproval(
			"pre_123",
			{
				auto_recurring: {
					end_date: "2026-05-01T00:00:00.000Z",
				},
			},
			{
				fetchImpl: async (url, init) => {
					capturedRequest = { url: String(url), init };
					return new Response(
						JSON.stringify({
							id: "pre_123",
							status: "authorized",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				},
			},
		);

		expect(capturedRequest?.url).toBe(
			"https://api.example.com/preapproval/pre_123",
		);
		expect(capturedRequest?.init?.method).toBe("PUT");
		const headers = new Headers(capturedRequest?.init?.headers);
		expect(headers.get("authorization")).toBe("Bearer token-1");
		expect(headers.get("content-type")).toBe("application/json");
		expect(
			JSON.parse(String(capturedRequest?.init?.body)) as unknown,
		).toEqual({
			auto_recurring: {
				end_date: "2026-05-01T00:00:00.000Z",
			},
		});
		expect(updated.id).toBe("pre_123");
	});
});
