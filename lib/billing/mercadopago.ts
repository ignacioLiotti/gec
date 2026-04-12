import { createHmac, randomUUID } from "node:crypto";

import {
	getVersionedSecret,
	requireVersionedSecret,
} from "@/lib/security/secrets";

type FetchLike = typeof fetch;

type SignatureValues = {
	ts: string;
	v1: string;
};

export type MercadoPagoPreapproval = {
	id: string;
	status?: string;
	external_reference?: string | null;
	payer_id?: string | number | null;
	init_point?: string | null;
	next_payment_date?: string | null;
	auto_recurring?: {
		transaction_amount?: number;
		currency_id?: string;
		frequency?: number;
		frequency_type?: string;
	} | null;
};

export type MercadoPagoPreapprovalUpdate = {
	status?: string;
	auto_recurring?: {
		end_date?: string | null;
	} | null;
};

export type MercadoPagoPlanConfig = {
	preapprovalPlanId?: string;
	amountArs?: number;
	frequency: number;
	frequencyType: "days" | "months";
	currencyId: "ARS";
};

export type MercadoPagoRuntimeMode = "test" | "production" | "unknown";

export type MercadoPagoRuntimeDebug = {
	mode: MercadoPagoRuntimeMode;
	sellerAccessTokenPreview: string | null;
	payerEmail: string | null;
	payerEmailSource: "forced_test_env" | "test_fallback" | "user" | "missing";
	apiBaseUrl: string;
};

type CreatePreapprovalArgs = {
	planKey: string;
	planName: string;
	tenantId: string;
	payerEmail: string;
	notificationUrl: string;
	backUrl: string;
	config: MercadoPagoPlanConfig;
	reason?: string | null;
};

function getMercadoPagoApiBaseUrl() {
	return process.env.MERCADOPAGO_API_BASE_URL ?? "https://api.mercadopago.com";
}

function getMercadoPagoAccessToken() {
	return requireVersionedSecret(
		"MERCADOPAGO_ACCESS_TOKEN",
		"MercadoPago access token",
	).trim();
}

export function resolveMercadoPagoModeFromToken(
	accessToken: string | null | undefined,
): MercadoPagoRuntimeMode {
	const normalized = accessToken?.trim() ?? "";
	if (!normalized) return "unknown";
	if (normalized.startsWith("TEST-")) return "test";
	if (normalized.startsWith("APP_USR-")) return "production";
	return "unknown";
}

export function resolveMercadoPagoPayerEmail(
	userEmail: string | null | undefined,
	options?: { accessToken?: string | null | undefined },
) {
	const token =
		options?.accessToken ??
		getVersionedSecret("MERCADOPAGO_ACCESS_TOKEN").value ??
		null;
	const mode = resolveMercadoPagoModeFromToken(token);

	if (mode === "test") {
		const forcedTestEmail = process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim();
		return forcedTestEmail && forcedTestEmail.length > 0
			? forcedTestEmail
			: "test@testuser.com";
	}

	const normalizedUserEmail = userEmail?.trim();
	return normalizedUserEmail && normalizedUserEmail.length > 0
		? normalizedUserEmail
		: null;
}

function maskAccessToken(value: string | null | undefined) {
	const normalized = value?.trim() ?? "";
	if (!normalized) return null;
	if (normalized.length <= 12) return `${normalized.slice(0, 4)}********`;
	return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

export function getMercadoPagoRuntimeDebug(
	userEmail: string | null | undefined,
): MercadoPagoRuntimeDebug {
	const token =
		getVersionedSecret("MERCADOPAGO_ACCESS_TOKEN").value?.trim() ?? null;
	const mode = resolveMercadoPagoModeFromToken(token);
	const payerEmail = resolveMercadoPagoPayerEmail(userEmail, {
		accessToken: token,
	});

	let payerEmailSource: MercadoPagoRuntimeDebug["payerEmailSource"] = "missing";
	if (mode === "test") {
		const forcedTestEmail = process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim();
		payerEmailSource =
			forcedTestEmail && forcedTestEmail.length > 0
				? "forced_test_env"
				: "test_fallback";
	} else if (payerEmail) {
		payerEmailSource = "user";
	}

	return {
		mode,
		sellerAccessTokenPreview: maskAccessToken(token),
		payerEmail,
		payerEmailSource,
		apiBaseUrl: getMercadoPagoApiBaseUrl(),
	};
}

function toUpperSnake(value: string) {
	return value
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "_");
}

function getString(input: Record<string, unknown>, ...keys: string[]) {
	for (const key of keys) {
		const value = input[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}
	return null;
}

function getNumber(input: Record<string, unknown>, ...keys: string[]) {
	for (const key of keys) {
		const value = input[key];
		const parsed = typeof value === "number" ? value : Number(value);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return null;
}

function parseFrequencyType(
	value: string | null | undefined,
): "days" | "months" {
	return value?.toLowerCase() === "days" ? "days" : "months";
}

export function parseMercadoPagoSignatureHeader(
	headerValue: string | null | undefined,
): SignatureValues | null {
	if (!headerValue) return null;
	const parts = headerValue.split(",").map((segment) => segment.trim());
	const values = new Map<string, string>();
	for (const part of parts) {
		const separator = part.indexOf("=");
		if (separator <= 0) continue;
		const key = part.slice(0, separator).trim().toLowerCase();
		const value = part.slice(separator + 1).trim();
		if (!key || !value) continue;
		values.set(key, value);
	}

	const ts = values.get("ts");
	const v1 = values.get("v1");
	if (!ts || !v1) return null;
	return { ts, v1 };
}

export function buildMercadoPagoSignatureManifest(args: {
	dataId: string;
	requestId: string;
	ts: string;
}) {
	return `id:${args.dataId};request-id:${args.requestId};ts:${args.ts};`;
}

export function verifyMercadoPagoWebhookSignature(args: {
	secret: string;
	signatureHeader: string | null | undefined;
	requestIdHeader: string | null | undefined;
	dataId: string | null | undefined;
}) {
	const parsedSignature = parseMercadoPagoSignatureHeader(args.signatureHeader);
	if (!parsedSignature) return false;
	if (!args.requestIdHeader || !args.dataId) return false;

	const manifest = buildMercadoPagoSignatureManifest({
		dataId: args.dataId,
		requestId: args.requestIdHeader,
		ts: parsedSignature.ts,
	});
	const expected = createHmac("sha256", args.secret)
		.update(manifest)
		.digest("hex");
	return expected.toLowerCase() === parsedSignature.v1.toLowerCase();
}

export function mapMercadoPagoPreapprovalStatus(
	status: string | null | undefined,
) {
	const normalized = (status ?? "").trim().toLowerCase();
	switch (normalized) {
		case "authorized":
			return "active";
		case "paused":
			return "paused";
		case "cancelled":
		case "canceled":
			return "cancelled";
		case "pending":
		case "in_process":
			return "pending";
		case "rejected":
			return "past_due";
		default:
			return normalized || "pending";
	}
}

export function buildMercadoPagoExternalReference(args: {
	tenantId: string;
	planKey: string;
}) {
	return `tenant:${args.tenantId}|plan:${args.planKey}`;
}

export function parseMercadoPagoExternalReference(
	value: string | null | undefined,
) {
	if (!value) return { tenantId: null, planKey: null };
	const segments = value.split("|");
	let tenantId: string | null = null;
	let planKey: string | null = null;
	for (const segment of segments) {
		const separator = segment.indexOf(":");
		if (separator <= 0) continue;
		const key = segment.slice(0, separator).trim().toLowerCase();
		const segmentValue = segment.slice(separator + 1).trim();
		if (!segmentValue) continue;
		if (key === "tenant") tenantId = segmentValue;
		if (key === "plan") planKey = segmentValue;
	}
	return { tenantId, planKey };
}

export function resolveMercadoPagoPlanConfig(
	planKey: string,
	metadata: unknown,
): MercadoPagoPlanConfig | null {
	const asRecord =
		metadata && typeof metadata === "object"
			? (metadata as Record<string, unknown>)
			: {};
	const preapprovalPlanId = getString(
		asRecord,
		"mercado_pago_preapproval_plan_id",
		"mercadoPagoPreapprovalPlanId",
	);
	const amountArs = getNumber(
		asRecord,
		"mercado_pago_amount_ars",
		"mercadoPagoAmountArs",
		"amount_ars",
	);
	const frequencyFromMetadata = getNumber(
		asRecord,
		"mercado_pago_frequency",
		"mercadoPagoFrequency",
	);
	const frequencyTypeFromMetadata = getString(
		asRecord,
		"mercado_pago_frequency_type",
		"mercadoPagoFrequencyType",
	);

	const envPrefix = `MERCADOPAGO_PLAN_${toUpperSnake(planKey)}`;
	const preapprovalPlanIdFromEnv =
		process.env[`${envPrefix}_PREAPPROVAL_PLAN_ID`]?.trim() || null;
	const amountArsFromEnvRaw = process.env[`${envPrefix}_AMOUNT_ARS`];
	const amountArsFromEnv =
		amountArsFromEnvRaw && Number.isFinite(Number(amountArsFromEnvRaw))
			? Number(amountArsFromEnvRaw)
			: null;
	const frequencyFromEnvRaw = process.env[`${envPrefix}_FREQUENCY`];
	const frequencyFromEnv =
		frequencyFromEnvRaw && Number.isFinite(Number(frequencyFromEnvRaw))
			? Number(frequencyFromEnvRaw)
			: null;
	const frequencyTypeFromEnv =
		process.env[`${envPrefix}_FREQUENCY_TYPE`]?.trim() ?? null;

	const resolvedPreapprovalPlanId =
		preapprovalPlanId ?? preapprovalPlanIdFromEnv ?? undefined;
	const resolvedAmountArs = amountArs ?? amountArsFromEnv ?? undefined;
	if (!resolvedPreapprovalPlanId && !resolvedAmountArs) {
		return null;
	}

	const frequency = Math.max(
		1,
		Math.trunc(frequencyFromMetadata ?? frequencyFromEnv ?? 1),
	);
	const frequencyType = parseFrequencyType(
		frequencyTypeFromMetadata ?? frequencyTypeFromEnv,
	);

	return {
		preapprovalPlanId: resolvedPreapprovalPlanId,
		amountArs: resolvedAmountArs,
		frequency,
		frequencyType,
		currencyId: "ARS",
	};
}

export function buildMercadoPagoPreapprovalRequest(
	args: CreatePreapprovalArgs,
) {
	const reason =
		args.reason?.trim() || `Suscripcion ${args.planName} (${args.planKey})`;
	const externalReference = buildMercadoPagoExternalReference({
		tenantId: args.tenantId,
		planKey: args.planKey,
	});

	const payload: Record<string, unknown> = {
		reason,
		external_reference: externalReference,
		payer_email: args.payerEmail,
		back_url: args.backUrl,
		notification_url: args.notificationUrl,
		status: "pending",
	};

	if (args.config.preapprovalPlanId) {
		payload.preapproval_plan_id = args.config.preapprovalPlanId;
		return payload;
	}

	if (!args.config.amountArs) {
		throw new Error("No hay precio configurado para el plan seleccionado.");
	}

	payload.auto_recurring = {
		frequency: args.config.frequency,
		frequency_type: args.config.frequencyType,
		transaction_amount: args.config.amountArs,
		currency_id: args.config.currencyId,
	};
	return payload;
}

export async function createMercadoPagoPreapproval(
	args: CreatePreapprovalArgs & {
		fetchImpl?: FetchLike;
	},
) {
	const payload = buildMercadoPagoPreapprovalRequest(args);
	const fetchImpl = args.fetchImpl ?? fetch;
	const response = await fetchImpl(
		`${getMercadoPagoApiBaseUrl()}/preapproval`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
				"Content-Type": "application/json",
				"X-Idempotency-Key": randomUUID(),
			},
			body: JSON.stringify(payload),
		},
	);
	const json = (await response.json().catch(() => ({}))) as Record<
		string,
		unknown
	>;
	if (!response.ok) {
		const message =
			typeof json.message === "string"
				? json.message
				: "No se pudo crear la suscripcion en MercadoPago.";
		throw new Error(message);
	}
	return json as unknown as MercadoPagoPreapproval;
}

export async function fetchMercadoPagoPreapproval(
	preapprovalId: string,
	options?: {
		fetchImpl?: FetchLike;
	},
) {
	const fetchImpl = options?.fetchImpl ?? fetch;
	const response = await fetchImpl(
		`${getMercadoPagoApiBaseUrl()}/preapproval/${encodeURIComponent(preapprovalId)}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
				"Content-Type": "application/json",
			},
		},
	);
	const json = (await response.json().catch(() => ({}))) as Record<
		string,
		unknown
	>;
	if (!response.ok) {
		const message =
			typeof json.message === "string"
				? json.message
				: "No se pudo obtener la suscripcion de MercadoPago.";
		throw new Error(message);
	}
	return json as unknown as MercadoPagoPreapproval;
}

export async function updateMercadoPagoPreapproval(
	preapprovalId: string,
	payload: MercadoPagoPreapprovalUpdate,
	options?: {
		fetchImpl?: FetchLike;
	},
) {
	const fetchImpl = options?.fetchImpl ?? fetch;
	const response = await fetchImpl(
		`${getMercadoPagoApiBaseUrl()}/preapproval/${encodeURIComponent(preapprovalId)}`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		},
	);
	const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		const message =
			typeof json.message === "string"
				? json.message
				: "No se pudo actualizar la suscripcion de MercadoPago.";
		throw new Error(message);
	}
	return json as unknown as MercadoPagoPreapproval;
}
