import { NextResponse } from "next/server";

import {
	fetchMercadoPagoPreapproval,
	mapMercadoPagoPreapprovalStatus,
	updateMercadoPagoPreapproval,
} from "@/lib/billing/mercadopago";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type TenantSubscriptionRow = {
	plan_key: string;
	status: string | null;
	current_period_end: string | null;
	external_subscription_id: string | null;
	metadata: Record<string, unknown> | null;
};

function resolveCancellationDate(
	subscription: TenantSubscriptionRow,
	preapproval: {
		next_payment_date?: string | null;
	},
) {
	const candidate = subscription.current_period_end ?? preapproval.next_payment_date ?? null;
	if (!candidate) return null;
	const parsed = new Date(candidate);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString();
}

export async function POST() {
	const access = await resolveRequestAccessContext();
	if (access.actorType === "demo") {
		return NextResponse.json(
			{ error: "La demo no permite cancelar suscripciones reales." },
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

	const supabase = access.supabase;
	const { data: subscriptionRow, error: subscriptionError } = await supabase
		.from("tenant_subscriptions")
		.select("plan_key, status, current_period_end, external_subscription_id, metadata")
		.eq("tenant_id", access.tenantId)
		.maybeSingle();

	if (subscriptionError) {
		return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
	}
	if (!subscriptionRow) {
		return NextResponse.json(
			{ error: "No encontramos una suscripcion activa para este tenant." },
			{ status: 404 },
		);
	}

	const subscription = subscriptionRow as TenantSubscriptionRow;
	if (!subscription.external_subscription_id) {
		return NextResponse.json(
			{
				error:
					"La suscripcion no tiene ID externo en MercadoPago. No se puede programar cancelacion.",
			},
			{ status: 400 },
		);
	}

	try {
		const preapproval = await fetchMercadoPagoPreapproval(subscription.external_subscription_id);
		const cancellationAt = resolveCancellationDate(subscription, preapproval);
		if (!cancellationAt) {
			return NextResponse.json(
				{
					error:
						"No pudimos resolver la fecha de fin de periodo para programar la cancelacion.",
				},
				{ status: 400 },
			);
		}

		await updateMercadoPagoPreapproval(subscription.external_subscription_id, {
			auto_recurring: {
				end_date: cancellationAt,
			},
		});

		const previousMetadata = (subscription.metadata ?? {}) as Record<string, unknown>;
		const previousMercadoPagoMetadata =
			previousMetadata.mercadoPago && typeof previousMetadata.mercadoPago === "object"
				? (previousMetadata.mercadoPago as Record<string, unknown>)
				: {};

		const mappedStatus = mapMercadoPagoPreapprovalStatus(preapproval.status);
		const persistedStatus = mappedStatus === "pending" ? (subscription.status ?? "active") : mappedStatus;
		const metadata: Record<string, unknown> = {
			...previousMetadata,
			cancelAtPeriodEnd: true,
			scheduledCancellationAt: cancellationAt,
			billingProvider: "mercadopago",
			mercadoPago: {
				...previousMercadoPagoMetadata,
				cancelAtPeriodEndRequestedAt: new Date().toISOString(),
				scheduledCancellationAt: cancellationAt,
				preapprovalId: subscription.external_subscription_id,
			},
		};

		const admin = createSupabaseAdminClient();
		const { error: updateError } = await admin
			.from("tenant_subscriptions")
			.upsert(
				{
					tenant_id: access.tenantId,
					plan_key: subscription.plan_key,
					status: persistedStatus,
					current_period_end: cancellationAt,
					external_subscription_id: subscription.external_subscription_id,
					metadata,
				},
				{ onConflict: "tenant_id" },
			);

		if (updateError) {
			return NextResponse.json({ error: updateError.message }, { status: 500 });
		}

		return NextResponse.json({
			ok: true,
			cancelAtPeriodEnd: true,
			scheduledCancellationAt: cancellationAt,
			status: persistedStatus,
		});
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "No se pudo programar la cancelacion de la suscripcion.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
