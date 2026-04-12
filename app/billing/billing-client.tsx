"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SubscriptionPlan = {
	plan_key: string;
	name: string;
	description: string | null;
	storage_limit_bytes: number | null;
	ai_token_budget: number | null;
	whatsapp_message_budget: number | null;
	metadata: Record<string, unknown> | null;
};

type TenantSubscription = {
	tenant_id: string;
	plan_key: string;
	status: string;
	current_period_start: string | null;
	current_period_end: string | null;
	external_customer_id: string | null;
	external_subscription_id: string | null;
	metadata: Record<string, unknown> | null;
};

type SubscriptionResponse = {
	tenantId: string;
	subscription: TenantSubscription | null;
	plans: SubscriptionPlan[];
	paywall: {
		blocked: boolean;
		reason: string;
	};
	mercadoPagoDebug?: unknown;
};

function formatStorageLimit(bytes: number | null) {
	if (bytes == null) return "Sin limite";
	const gb = bytes / (1024 * 1024 * 1024);
	const value = gb >= 10 ? gb.toFixed(0) : gb.toFixed(1);
	return `${value} GB`;
}

function formatCountLimit(value: number | null) {
	if (value == null) return "Sin limite";
	return new Intl.NumberFormat("es-AR").format(value);
}

function formatDate(value: string | null) {
	if (!value) return "No definido";
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "No definido";
	return parsed.toLocaleDateString("es-AR", {
		year: "numeric",
		month: "short",
		day: "2-digit",
	});
}

function getStatusLabel(status: string | null | undefined) {
	switch ((status ?? "").trim().toLowerCase()) {
		case "active":
		case "authorized":
		case "trialing":
			return "Activa";
		case "pending":
			return "Pendiente";
		case "paused":
			return "Pausada";
		case "past_due":
			return "Pago pendiente";
		case "cancelled":
		case "canceled":
			return "Cancelada";
		default:
			return status ?? "Sin estado";
	}
}

function extractAmountArs(metadata: Record<string, unknown> | null) {
	if (!metadata) return null;
	const candidates = [
		metadata.mercado_pago_amount_ars,
		metadata.mercadoPagoAmountArs,
		metadata.amount_ars,
	];
	for (const candidate of candidates) {
		const parsed =
			typeof candidate === "number" ? candidate : Number(candidate ?? NaN);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return null;
}

export function BillingClient() {
	const searchParams = useSearchParams();
	const [data, setData] = useState<SubscriptionResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pendingPlanKey, setPendingPlanKey] = useState<string | null>(null);
	const [cancelPending, setCancelPending] = useState(false);

	const blockedFromQuery = searchParams.get("blocked") === "1";
	const blockedReason = searchParams.get("reason");
	const returnTo = searchParams.get("returnTo");

	const loadSubscription = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch("/api/billing/subscription", {
				cache: "no-store",
			});
			const json = (await response.json().catch(() => ({}))) as Record<
				string,
				unknown
			>;
			if (!response.ok) {
				throw new Error(
					typeof json.error === "string"
						? json.error
						: "No se pudo cargar la facturacion.",
				);
			}
			setData(json as SubscriptionResponse);
		} catch (requestError) {
			const message =
				requestError instanceof Error
					? requestError.message
					: "No se pudo cargar la facturacion.";
			setError(message);
			setData(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSubscription();
	}, [loadSubscription]);

	const statusLabel = useMemo(
		() => getStatusLabel(data?.subscription?.status),
		[data?.subscription?.status],
	);
	const cancelAtPeriodEnd = data?.subscription?.metadata?.cancelAtPeriodEnd === true;
	const scheduledCancellationAt =
		typeof data?.subscription?.metadata?.scheduledCancellationAt === "string"
			? data.subscription.metadata.scheduledCancellationAt
			: null;

	async function handleCheckout(planKey: string) {
		setPendingPlanKey(planKey);
		setError(null);
		try {
			const response = await fetch("/api/billing/mercadopago/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					planKey,
					backUrl: `${window.location.origin}/billing`,
				}),
			});
			const json = (await response.json().catch(() => ({}))) as Record<
				string,
				unknown
			>;
			if (!response.ok) {
				throw new Error(
					typeof json.error === "string"
						? json.error
						: "No se pudo iniciar el checkout.",
				);
			}
			if (typeof json.initPoint !== "string" || json.initPoint.trim().length === 0) {
				throw new Error("MercadoPago no devolvio URL de pago.");
			}
			window.location.assign(json.initPoint);
		} catch (checkoutError) {
			const message =
				checkoutError instanceof Error
					? checkoutError.message
					: "No se pudo iniciar el checkout.";
			setError(message);
		} finally {
			setPendingPlanKey(null);
		}
	}

	async function handleCancelAtPeriodEnd() {
		setCancelPending(true);
		setError(null);
		try {
			const response = await fetch("/api/billing/mercadopago/cancel", {
				method: "POST",
			});
			const json = (await response.json().catch(() => ({}))) as Record<
				string,
				unknown
			>;
			if (!response.ok) {
				throw new Error(
					typeof json.error === "string"
						? json.error
						: "No se pudo programar la cancelacion.",
				);
			}
			await loadSubscription();
		} catch (cancelError) {
			const message =
				cancelError instanceof Error
					? cancelError.message
					: "No se pudo programar la cancelacion.";
			setError(message);
		} finally {
			setCancelPending(false);
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
			<Card>
				<CardHeader className="gap-2">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Wallet className="size-4" />
						<span>Facturacion</span>
					</div>
					<CardTitle>Suscripcion del tenant</CardTitle>
					<CardDescription>
						{loading
							? "Cargando estado de suscripcion..."
							: `Estado actual: ${statusLabel}`}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{(blockedFromQuery || data?.paywall?.blocked) && (
						<div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
							El tenant esta bloqueado por suscripcion. Elegi un plan y completa el pago para habilitar acceso.
							{blockedReason ? ` Motivo: ${blockedReason}.` : ""}
						</div>
					)}

					{error && (
						<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
							{error}
						</div>
					)}

					{data?.subscription && (
						<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
							<p>
								Plan actual: <strong>{data.subscription.plan_key}</strong>
							</p>
							<p>
								Proximo cobro: <strong>{formatDate(data.subscription.current_period_end)}</strong>
							</p>
							{cancelAtPeriodEnd && (
								<p className="text-orange-700">
									Cancelacion programada para fin de ciclo:
									{" "}
									<strong>{formatDate(scheduledCancellationAt ?? data.subscription.current_period_end)}</strong>
								</p>
							)}
							{returnTo && (
								<p className="text-muted-foreground">
									Despues de pagar podras volver a: <strong>{returnTo}</strong>
								</p>
							)}
						</div>
					)}

					<div className="flex flex-wrap items-center justify-end gap-2">
						{data?.subscription?.external_subscription_id &&
						(data?.subscription?.status ?? "").toLowerCase() !== "cancelled" ? (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => void handleCancelAtPeriodEnd()}
								disabled={cancelPending || cancelAtPeriodEnd}
							>
								{cancelPending
									? "Programando cancelacion..."
									: cancelAtPeriodEnd
										? "Cancelacion ya programada"
										: "Cancelar al finalizar ciclo"}
							</Button>
						) : null}
						<Button
							variant="outline"
							size="sm"
							onClick={() => void loadSubscription()}
							disabled={loading}
						>
							{loading ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<RefreshCw className="mr-2 size-4" />
							)}
							Actualizar
						</Button>
					</div>

					{data?.mercadoPagoDebug ? (
						<div className="rounded-md border bg-black/95 p-3">
							<p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/80">
								Debug MercadoPago (buyer/seller/payload)
							</p>
							<pre className="max-h-80 overflow-auto text-xs text-white">
								{JSON.stringify(data.mercadoPagoDebug, null, 2)}
							</pre>
						</div>
					) : null}
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-2">
				{(data?.plans ?? []).map((plan) => {
					const isCurrentPlan = data?.subscription?.plan_key === plan.plan_key;
					const amount = extractAmountArs(plan.metadata);
					const isPending = pendingPlanKey === plan.plan_key;
					return (
						<Card key={plan.plan_key}>
							<CardHeader>
								<CardTitle className="flex items-center justify-between gap-2">
									<span>{plan.name}</span>
									{isCurrentPlan && (
										<span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
											Actual
										</span>
									)}
								</CardTitle>
								<CardDescription>
									{plan.description ?? "Plan de suscripcion"}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-1 text-sm">
									<p>Almacenamiento: {formatStorageLimit(plan.storage_limit_bytes)}</p>
									<p>Tokens IA: {formatCountLimit(plan.ai_token_budget)}</p>
									<p>Mensajes WhatsApp: {formatCountLimit(plan.whatsapp_message_budget)}</p>
									<p>
										Precio:
										{" "}
										{amount != null
											? new Intl.NumberFormat("es-AR", {
													style: "currency",
													currency: "ARS",
												}).format(amount)
											: "Configurado en backend"}
									</p>
								</div>
								<Button
									className="w-full"
									onClick={() => void handleCheckout(plan.plan_key)}
									disabled={isPending || (isCurrentPlan && !data?.paywall?.blocked)}
								>
									{isPending ? (
										<>
											<Loader2 className="mr-2 size-4 animate-spin" />
											Redirigiendo a MercadoPago...
										</>
									) : isCurrentPlan && !data?.paywall?.blocked ? (
										"Plan actual"
									) : (
										"Pagar con MercadoPago"
									)}
								</Button>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
