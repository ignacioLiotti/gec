import { NextResponse } from "next/server";

import {
	buildMercadoPagoPreapprovalRequest,
	getMercadoPagoRuntimeDebug,
	resolveMercadoPagoPlanConfig,
} from "@/lib/billing/mercadopago";
import {
	evaluateTenantSubscriptionAccess,
	resolveSubscriptionGraceDays,
	resolveSubscriptionPendingGraceMinutes,
} from "@/lib/billing/subscription-access";
import { resolveRequestAccessContext } from "@/lib/demo-session";

type SubscriptionPlanRow = {
	plan_key: string;
	name: string;
	description: string | null;
	storage_limit_bytes: number | null;
	ai_token_budget: number | null;
	whatsapp_message_budget: number | null;
	metadata: Record<string, unknown> | null;
};

type TenantSubscriptionRow = {
	tenant_id: string;
	plan_key: string;
	status: string;
	current_period_start: string | null;
	current_period_end: string | null;
	external_customer_id: string | null;
	external_subscription_id: string | null;
	metadata: Record<string, unknown> | null;
};

function resolveCancellationMetadata(
	metadata: Record<string, unknown> | null | undefined,
) {
	const raw = metadata ?? {};
	const cancelAtPeriodEnd = raw.cancelAtPeriodEnd === true;
	const scheduledCancellationAt =
		typeof raw.scheduledCancellationAt === "string"
			? raw.scheduledCancellationAt
			: null;
	return { cancelAtPeriodEnd, scheduledCancellationAt };
}

function getConfiguredAppUrl() {
	const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
	if (configured && configured.trim().length > 0) {
		return configured.replace(/\/+$/, "");
	}
	return null;
}

export async function GET() {
	const access = await resolveRequestAccessContext();
	if (!access.user && access.actorType !== "demo") {
		return NextResponse.json({ error: "Inicia sesion para continuar." }, { status: 401 });
	}
	if (!access.tenantId) {
		return NextResponse.json(
			{ error: "No pudimos resolver la organizacion activa." },
			{ status: 400 },
		);
	}

	const supabase = access.supabase;
	const [plansResult, subscriptionResult] = await Promise.all([
		supabase
			.from("subscription_plans")
			.select(
				"plan_key, name, description, storage_limit_bytes, ai_token_budget, whatsapp_message_budget, metadata",
			)
			.order("created_at", { ascending: true }),
		supabase
			.from("tenant_subscriptions")
			.select(
				"tenant_id, plan_key, status, current_period_start, current_period_end, external_customer_id, external_subscription_id, metadata",
			)
			.eq("tenant_id", access.tenantId)
			.maybeSingle(),
	]);

	if (plansResult.error) {
		return NextResponse.json({ error: plansResult.error.message }, { status: 500 });
	}
	if (subscriptionResult.error) {
		return NextResponse.json({ error: subscriptionResult.error.message }, { status: 500 });
	}

	const subscription = (subscriptionResult.data as TenantSubscriptionRow | null) ?? null;
	const cancellationMetadata = resolveCancellationMetadata(subscription?.metadata);
	const accessResult = evaluateTenantSubscriptionAccess(
		{
			status: subscription?.status ?? "active",
			currentPeriodStart: subscription?.current_period_start ?? null,
			currentPeriodEnd: subscription?.current_period_end ?? null,
			cancelAtPeriodEnd: cancellationMetadata.cancelAtPeriodEnd,
			scheduledCancellationAt: cancellationMetadata.scheduledCancellationAt,
		},
		{
			gracePeriodDays: resolveSubscriptionGraceDays(),
			pendingGraceMinutes: resolveSubscriptionPendingGraceMinutes(),
		},
	);

	const appUrl = getConfiguredAppUrl();
	const runtimeDebug = getMercadoPagoRuntimeDebug(access.user?.email ?? null);
	const checkoutPreview = (plansResult.data ?? []).map((plan) => {
		const typedPlan = plan as SubscriptionPlanRow;
		const planConfig = resolveMercadoPagoPlanConfig(
			typedPlan.plan_key,
			typedPlan.metadata,
		);
		if (!planConfig) {
			return {
				planKey: typedPlan.plan_key,
				planName: typedPlan.name,
				canCheckout: false,
				reason: "missing_plan_config",
			};
		}

		if (!runtimeDebug.payerEmail || !appUrl) {
			return {
				planKey: typedPlan.plan_key,
				planName: typedPlan.name,
				canCheckout: false,
				reason: !runtimeDebug.payerEmail ? "missing_payer_email" : "missing_app_url",
				planConfig,
			};
		}

		try {
			const payload = buildMercadoPagoPreapprovalRequest({
				planKey: typedPlan.plan_key,
				planName: typedPlan.name,
				tenantId: access.tenantId,
				payerEmail: runtimeDebug.payerEmail,
				notificationUrl: `${appUrl}/api/billing/mercadopago/webhook`,
				backUrl: `${appUrl}/billing`,
				config: planConfig,
			});
			return {
				planKey: typedPlan.plan_key,
				planName: typedPlan.name,
				canCheckout: true,
				planConfig,
				payload,
			};
		} catch (error) {
			return {
				planKey: typedPlan.plan_key,
				planName: typedPlan.name,
				canCheckout: false,
				reason: error instanceof Error ? error.message : "payload_error",
				planConfig,
			};
		}
	});

	return NextResponse.json({
		tenantId: access.tenantId,
		subscription,
		plans: (plansResult.data ?? []) as SubscriptionPlanRow[],
		paywall: accessResult,
		mercadoPagoDebug: {
			appUrl,
			runtime: runtimeDebug,
			checkoutPreview,
		},
	});
}
