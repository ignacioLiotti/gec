import { NextRequest, NextResponse } from "next/server";

import {
	createMercadoPagoPreapproval,
	mapMercadoPagoPreapprovalStatus,
	resolveMercadoPagoPayerEmail,
	resolveMercadoPagoPlanConfig,
} from "@/lib/billing/mercadopago";
import { resolveRequestAccessContext } from "@/lib/demo-session";

type SubscriptionPlanRow = {
	plan_key: string;
	name: string;
	description: string | null;
	metadata: Record<string, unknown> | null;
};

type TenantSubscriptionRow = {
	plan_key: string | null;
	status: string | null;
	current_period_start: string | null;
	current_period_end: string | null;
	metadata: Record<string, unknown> | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authorized", "trialing"]);

function getPublicAppUrl(request: NextRequest) {
	const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
	if (configured && configured.trim().length > 0) {
		return configured.replace(/\/+$/, "");
	}
	return new URL(request.url).origin;
}

function normalizeStatus(status: string | null | undefined) {
	return (status ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
	const access = await resolveRequestAccessContext();
	if (access.actorType === "demo") {
		return NextResponse.json(
			{ error: "La demo no permite suscripciones reales." },
			{ status: 403 },
		);
	}
	if (!access.user) {
		return NextResponse.json({ error: "Inicia sesion para continuar." }, { status: 401 });
	}
	if (!access.tenantId) {
		return NextResponse.json(
			{ error: "No pudimos resolver la organizacion activa." },
			{ status: 400 },
		);
	}

	const isTenantAdmin =
		access.isSuperAdmin ||
		access.membershipRole === "owner" ||
		access.membershipRole === "admin";
	if (!isTenantAdmin) {
		return NextResponse.json(
			{ error: "Solo owner/admin puede gestionar suscripciones." },
			{ status: 403 },
		);
	}

	const body = (await request.json().catch(() => ({}))) as {
		planKey?: unknown;
		backUrl?: unknown;
	};
	const planKey = typeof body.planKey === "string" ? body.planKey.trim() : "";
	if (!planKey) {
		return NextResponse.json({ error: "planKey es obligatorio." }, { status: 400 });
	}

	const payerEmail = resolveMercadoPagoPayerEmail(access.user.email);
	if (!payerEmail) {
		return NextResponse.json(
			{
				error:
					"No pudimos resolver el email para facturacion. Define MERCADOPAGO_TEST_PAYER_EMAIL en pruebas o usa un usuario con email.",
			},
			{ status: 400 },
		);
	}

	const supabase = access.supabase;
	const [{ data: planRow, error: planError }, { data: existingSubscription }] =
		await Promise.all([
			supabase
				.from("subscription_plans")
				.select("plan_key, name, description, metadata")
				.eq("plan_key", planKey)
				.maybeSingle(),
			supabase
				.from("tenant_subscriptions")
				.select("plan_key, status, current_period_start, current_period_end, metadata")
				.eq("tenant_id", access.tenantId)
				.maybeSingle(),
		]);

	if (planError) {
		return NextResponse.json({ error: planError.message }, { status: 500 });
	}
	if (!planRow) {
		return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
	}

	const plan = planRow as SubscriptionPlanRow;
	const planConfig = resolveMercadoPagoPlanConfig(plan.plan_key, plan.metadata);
	if (!planConfig) {
		return NextResponse.json(
			{
				error:
					"Este plan no tiene configuracion de cobro en MercadoPago. Configura metadata del plan o variables de entorno.",
			},
			{ status: 400 },
		);
	}

	const appUrl = getPublicAppUrl(request);
	const backUrl =
		typeof body.backUrl === "string" && body.backUrl.trim().length > 0
			? body.backUrl.trim()
			: `${appUrl}/billing`;

	try {
		const nowIso = new Date().toISOString();
		const preapproval = await createMercadoPagoPreapproval({
			planKey: plan.plan_key,
			planName: plan.name,
			tenantId: access.tenantId,
			payerEmail,
			notificationUrl: `${appUrl}/api/billing/mercadopago/webhook`,
			backUrl,
			config: planConfig,
		});

		const requestedStatus = mapMercadoPagoPreapprovalStatus(preapproval.status);
		const existing = (existingSubscription as TenantSubscriptionRow | null) ?? null;
		const existingStatus = normalizeStatus(existing?.status);
		const preserveExistingActiveStatus =
			requestedStatus === "pending" && ACTIVE_SUBSCRIPTION_STATUSES.has(existingStatus);
		const persistedStatus =
			preserveExistingActiveStatus && existingStatus ? existingStatus : requestedStatus;
		const persistedPlanKey =
			preserveExistingActiveStatus && existing?.plan_key
				? existing.plan_key
				: plan.plan_key;

		const previousMetadata =
			(existing?.metadata ?? {}) as Record<
				string,
				unknown
			>;
		const metadata: Record<string, unknown> = {
			...previousMetadata,
			cancelAtPeriodEnd: false,
			scheduledCancellationAt: null,
			billingProvider: "mercadopago",
			mercadoPago: {
				lastCheckoutAt: new Date().toISOString(),
				initPoint: preapproval.init_point ?? null,
				preapprovalId: preapproval.id,
				planKey: persistedPlanKey,
				requestedPlanKey: plan.plan_key,
				requestedStatus,
				payerEmail,
				cancelAtPeriodEndRequestedAt: null,
				scheduledCancellationAt: null,
			},
		};

		const { error: upsertError } = await supabase.from("tenant_subscriptions").upsert(
			{
				tenant_id: access.tenantId,
				plan_key: persistedPlanKey,
				status: persistedStatus,
				current_period_start:
					existing?.current_period_start ?? nowIso,
				current_period_end:
					preserveExistingActiveStatus
						? (existing?.current_period_end ?? null)
						: (preapproval.next_payment_date ??
							existing?.current_period_end ??
							null),
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
			provider: "mercadopago",
			initPoint: preapproval.init_point ?? null,
			preapprovalId: preapproval.id,
			status: persistedStatus,
			requestedStatus,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "No se pudo iniciar la suscripcion.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
