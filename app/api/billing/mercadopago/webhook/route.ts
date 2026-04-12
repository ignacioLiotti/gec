import { NextRequest, NextResponse } from "next/server";

import {
	fetchMercadoPagoPreapproval,
	mapMercadoPagoPreapprovalStatus,
	parseMercadoPagoExternalReference,
	verifyMercadoPagoWebhookSignature,
} from "@/lib/billing/mercadopago";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type MercadoPagoWebhookPayload = {
	type?: string | null;
	topic?: string | null;
	id?: string | number | null;
	resource?: string | null;
	data?: {
		id?: string | number | null;
	} | null;
};

type TenantSubscriptionLookup = {
	tenant_id: string;
	plan_key: string;
	current_period_start: string | null;
	current_period_end: string | null;
	metadata: Record<string, unknown> | null;
};

function toNonEmptyString(value: unknown) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function parsePreapprovalIdFromResource(resource: string | null | undefined) {
	const parsed = toNonEmptyString(resource);
	if (!parsed) return null;
	const match = parsed.match(/\/preapproval\/([^/?#]+)/i);
	if (!match?.[1]) return null;
	return decodeURIComponent(match[1]);
}

function resolveWebhookDataId(
	request: NextRequest,
	payload: MercadoPagoWebhookPayload,
) {
	const fromQuery = toNonEmptyString(request.nextUrl.searchParams.get("data.id"));
	if (fromQuery) return fromQuery;

	const fromPayloadDataId =
		payload.data?.id != null ? String(payload.data.id).trim() : null;
	if (fromPayloadDataId) return fromPayloadDataId;

	return null;
}

function resolvePreapprovalId(
	request: NextRequest,
	payload: MercadoPagoWebhookPayload,
) {
	const dataId = resolveWebhookDataId(request, payload);
	if (dataId) return dataId;

	const fromResource = parsePreapprovalIdFromResource(payload.resource);
	if (fromResource) return fromResource;

	const topic =
		toNonEmptyString(request.nextUrl.searchParams.get("topic")) ??
		toNonEmptyString(payload.topic) ??
		toNonEmptyString(payload.type) ??
		"";
	const isPreapprovalTopic = topic.toLowerCase().includes("preapproval");
	if (isPreapprovalTopic && payload.id != null) {
		const fromPayloadId = String(payload.id).trim();
		if (fromPayloadId) return fromPayloadId;
	}

	return null;
}

export async function GET() {
	return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
	const payload = (await request.json().catch(() => ({}))) as MercadoPagoWebhookPayload;
	const preapprovalId = resolvePreapprovalId(request, payload);
	const dataId = resolveWebhookDataId(request, payload) ?? preapprovalId;
	const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();

	if (webhookSecret) {
		const signatureValid = verifyMercadoPagoWebhookSignature({
			secret: webhookSecret,
			signatureHeader: request.headers.get("x-signature"),
			requestIdHeader: request.headers.get("x-request-id"),
			dataId,
		});
		if (!signatureValid) {
			return NextResponse.json(
				{ error: "Firma de webhook invalida." },
				{ status: 401 },
			);
		}
	}

	if (!preapprovalId) {
		return NextResponse.json(
			{ ok: true, ignored: true, reason: "missing_preapproval_id" },
			{ status: 202 },
		);
	}

	try {
		const preapproval = await fetchMercadoPagoPreapproval(preapprovalId);
		const admin = createSupabaseAdminClient();
		const reference = parseMercadoPagoExternalReference(
			preapproval.external_reference ?? null,
		);

		const { data: existingByExternal, error: existingByExternalError } =
			await admin
				.from("tenant_subscriptions")
				.select(
					"tenant_id, plan_key, current_period_start, current_period_end, metadata",
				)
				.eq("external_subscription_id", preapproval.id)
				.maybeSingle();
		if (existingByExternalError) {
			return NextResponse.json(
				{ error: existingByExternalError.message },
				{ status: 500 },
			);
		}

		const byExternal = (existingByExternal as TenantSubscriptionLookup | null) ?? null;
		const tenantId = reference.tenantId ?? byExternal?.tenant_id ?? null;
		const planKey = reference.planKey ?? byExternal?.plan_key ?? null;

		if (!tenantId || !planKey) {
			return NextResponse.json(
				{ ok: true, ignored: true, reason: "missing_reference" },
				{ status: 202 },
			);
		}

		const { data: existingByTenant, error: existingByTenantError } = await admin
			.from("tenant_subscriptions")
			.select("current_period_start, current_period_end, metadata")
			.eq("tenant_id", tenantId)
			.maybeSingle();
		if (existingByTenantError) {
			return NextResponse.json(
				{ error: existingByTenantError.message },
				{ status: 500 },
			);
		}

		const byTenant = (existingByTenant as TenantSubscriptionLookup | null) ?? null;
		const previousMetadata =
			(byTenant?.metadata ?? byExternal?.metadata ?? {}) as Record<string, unknown>;
		const previousMercadoPagoMetadata =
			previousMetadata.mercadoPago &&
			typeof previousMetadata.mercadoPago === "object"
				? (previousMetadata.mercadoPago as Record<string, unknown>)
				: {};

		const nowIso = new Date().toISOString();
		const status = mapMercadoPagoPreapprovalStatus(preapproval.status);
		const metadata: Record<string, unknown> = {
			...previousMetadata,
			billingProvider: "mercadopago",
			mercadoPago: {
				...previousMercadoPagoMetadata,
				lastWebhookAt: nowIso,
				preapprovalId: preapproval.id,
				rawStatus: preapproval.status ?? null,
				externalReference: preapproval.external_reference ?? null,
				planKey,
			},
		};

		const { error: upsertError } = await admin.from("tenant_subscriptions").upsert(
			{
				tenant_id: tenantId,
				plan_key: planKey,
				status,
				current_period_start:
					byTenant?.current_period_start ?? byExternal?.current_period_start ?? nowIso,
				current_period_end:
					preapproval.next_payment_date ??
					byTenant?.current_period_end ??
					byExternal?.current_period_end ??
					null,
				external_customer_id:
					preapproval.payer_id != null ? String(preapproval.payer_id) : null,
				external_subscription_id: preapproval.id,
				metadata,
			},
			{ onConflict: "tenant_id" },
		);
		if (upsertError) {
			return NextResponse.json({ error: upsertError.message }, { status: 500 });
		}

		return NextResponse.json({
			ok: true,
			tenantId,
			planKey,
			status,
			preapprovalId: preapproval.id,
		});
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "No se pudo procesar el webhook de MercadoPago.";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
