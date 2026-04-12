import { createHmac } from "node:crypto";
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

	it("validates webhook signatures", () => {
		const manifest = buildMercadoPagoSignatureManifest({
			dataId: "pre_123",
			requestId: "req-1",
			ts: "1710000000",
		});
		const secret = "webhook-secret";
		const signature = createHmac("sha256", secret)
			.update(manifest)
			.digest("hex");

		expect(
			verifyMercadoPagoWebhookSignature({
				secret,
				signatureHeader: `ts=1710000000,v1=${signature}`,
				requestIdHeader: "req-1",
				dataId: "pre_123",
			}),
		).toBe(true);

		expect(
			verifyMercadoPagoWebhookSignature({
				secret,
				signatureHeader: "ts=1710000000,v1=wrong",
				requestIdHeader: "req-1",
				dataId: "pre_123",
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

	it("builds masked runtime debug payload", () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-1234567890";
		process.env.MERCADOPAGO_TEST_PAYER_EMAIL = "buyer-ar@testuser.com";
		const runtimeDebug = getMercadoPagoRuntimeDebug("owner@example.com");
		expect(runtimeDebug.mode).toBe("test");
		expect(runtimeDebug.payerEmail).toBe("buyer-ar@testuser.com");
		expect(runtimeDebug.sellerAccessTokenPreview).toContain("...");
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
		let capturedUrl = "";
		let capturedAuth = "";

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
				capturedUrl = String(url);
				capturedAuth = String(
					(init?.headers as Record<string, string>)?.Authorization,
				);
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

		expect(capturedUrl).toBe("https://api.example.com/preapproval");
		expect(capturedAuth).toBe("Bearer token-1");
		expect(preapproval.id).toBe("pre_123");
	});

	it("fetches preapproval details", async () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "token-1";
		process.env.MERCADOPAGO_API_BASE_URL = "https://api.example.com";

		const preapproval = await fetchMercadoPagoPreapproval("pre_999", {
			fetchImpl: async () =>
				new Response(
					JSON.stringify({
						id: "pre_999",
						status: "authorized",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		});

		expect(preapproval.id).toBe("pre_999");
		expect(preapproval.status).toBe("authorized");
	});

	it("updates preapproval details", async () => {
		process.env.MERCADOPAGO_ACCESS_TOKEN = "token-1";
		process.env.MERCADOPAGO_API_BASE_URL = "https://api.example.com";
		let capturedUrl = "";
		let capturedMethod = "";
		let capturedBody = "";

		const updated = await updateMercadoPagoPreapproval(
			"pre_123",
			{
				auto_recurring: {
					end_date: "2026-05-01T00:00:00.000Z",
				},
			},
			{
				fetchImpl: async (url, init) => {
					capturedUrl = String(url);
					capturedMethod = String(init?.method ?? "");
					capturedBody = String(init?.body ?? "");
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

		expect(capturedUrl).toBe("https://api.example.com/preapproval/pre_123");
		expect(capturedMethod).toBe("PUT");
		expect(capturedBody).toContain("end_date");
		expect(updated.id).toBe("pre_123");
	});
});
