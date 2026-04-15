"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
	AlertTriangle,
	BadgeCheck,
	Check,
	ChevronDown,
	Loader2,
	RefreshCw,
	Wallet,
	Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SubscriptionPlan = {
	plan_key: string;
	name: string;
	description: string | null;
	storage_limit_bytes: number | null;
	ai_token_budget: number | null;
	whatsapp_message_budget: number | null;
	metadata: Record<string, unknown> | null;
	resolvedAmountArs: number | null;
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

function formatCurrencyArs(value: number | null) {
	if (value == null) return "Configurado en backend";
	return new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
	}).format(value);
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

function getStatusStyle(status: string | null | undefined) {
	switch ((status ?? "").trim().toLowerCase()) {
		case "active":
		case "authorized":
		case "trialing":
			return {
				badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
				panelClass: "border-stone-200 bg-stone-50/60",
				hint: "La suscripcion esta al dia y el tenant tiene acceso normal.",
			};
		case "pending":
			return {
				badgeClass: "border-amber-300 bg-amber-50 text-amber-800",
				panelClass: "border-stone-200 bg-stone-50/60",
				hint: "El pago esta pendiente. Completa checkout para activar el plan.",
			};
		case "past_due":
			return {
				badgeClass: "border-orange-300 bg-orange-50 text-orange-800",
				panelClass: "border-stone-200 bg-stone-50/60",
				hint: "Hay un cobro pendiente. Revisa el estado y regulariza el pago.",
			};
		case "paused":
			return {
				badgeClass: "border-stone-300 bg-stone-100 text-stone-700",
				panelClass: "border-stone-200 bg-stone-50/60",
				hint: "La suscripcion esta pausada temporalmente.",
			};
		case "cancelled":
		case "canceled":
			return {
				badgeClass: "border-red-300 bg-red-50 text-red-800",
				panelClass: "border-stone-200 bg-stone-50/60",
				hint: "La suscripcion fue cancelada. Para reactivar, selecciona un plan.",
			};
		default:
			return {
				badgeClass: "border-stone-300 bg-stone-50 text-stone-700",
				panelClass: "border-stone-200 bg-stone-50/60",
				hint: "Revisa la suscripcion para confirmar estado y proximo cobro.",
			};
	}
}

function extractAmountArs(plan: SubscriptionPlan) {
	// Prefer the server-resolved value (from env vars via resolveMercadoPagoPlanConfig)
	if (typeof plan.resolvedAmountArs === "number" && plan.resolvedAmountArs > 0) {
		return plan.resolvedAmountArs;
	}
	// Fall back to metadata fields
	const metadata = plan.metadata;
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
	const [debugOpen, setDebugOpen] = useState(false);

	const blockedFromQuery = searchParams.get("blocked") === "1";
	const blockedReason = searchParams.get("reason");
	const returnTo = searchParams.get("returnTo");
	const isDevBuild = process.env.NODE_ENV !== "production";

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
	const statusStyle = useMemo(
		() => getStatusStyle(data?.subscription?.status),
		[data?.subscription?.status],
	);
	const cancelAtPeriodEnd = data?.subscription?.metadata?.cancelAtPeriodEnd === true;
	const scheduledCancellationAt =
		typeof data?.subscription?.metadata?.scheduledCancellationAt === "string"
			? data.subscription.metadata.scheduledCancellationAt
			: null;
	const normalizedStatus = (data?.subscription?.status ?? "").trim().toLowerCase();
	const showBlockedBanner = blockedFromQuery || data?.paywall?.blocked;
	const canCancelSubscription =
		Boolean(data?.subscription?.external_subscription_id) &&
		normalizedStatus !== "cancelled" &&
		normalizedStatus !== "canceled";
	const currentPlan = useMemo(
		() =>
			(data?.plans ?? []).find(
				(plan) => plan.plan_key === data?.subscription?.plan_key,
			) ?? null,
		[data?.plans, data?.subscription?.plan_key],
	);
	const currentPlanAmount = currentPlan ? extractAmountArs(currentPlan) : null;
	const shouldShowDebugPanel = isDevBuild && Boolean(data?.mercadoPagoDebug);

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
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-4">
			{/* Main subscription card */}
			<div className="rounded-xl border border-stone-200 bg-white shadow-sm">
				{/* Header */}
				<div className="flex flex-col gap-4 border-b border-stone-200 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-3">
						<div className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium tracking-wide text-stone-500 uppercase">
							<Wallet className="size-3" />
							<span>Facturacion</span>
						</div>
						<div className="space-y-1.5">
							<div className="flex flex-wrap items-center gap-2.5">
								<h1 className="text-2xl font-semibold tracking-tight text-stone-900">
									Suscripcion del tenant
								</h1>
								<span
									className={cn(
										"inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium",
										statusStyle.badgeClass,
									)}
								>
									{statusLabel}
								</span>
							</div>
							<p className="text-sm text-stone-500">
								{loading ? "Cargando estado de suscripcion..." : statusStyle.hint}
							</p>
						</div>
					</div>
					<div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
						{canCancelSubscription ? (
							<Button
								variant={cancelAtPeriodEnd ? "destructiveSecondary" : "destructive"}
								size="sm"
								onClick={() => void handleCancelAtPeriodEnd()}
								disabled={cancelPending || cancelAtPeriodEnd}
								className="sm:min-w-[210px]"
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
								<Loader2 className="size-4 animate-spin" />
							) : (
								<RefreshCw className="size-4" />
							)}
							Actualizar
						</Button>
					</div>
				</div>

				{/* Body */}
				<div className="space-y-4 px-6 py-5">
					{/* Blocked banner */}
					{showBlockedBanner && (
						<div className="flex gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-500" />
							<div className="space-y-0.5">
								<p className="font-medium text-orange-900">
									El tenant esta bloqueado por suscripcion.
								</p>
								<p className="text-orange-700">
									Elegi un plan y completa el pago para habilitar acceso.
									{blockedReason ? ` Motivo: ${blockedReason}.` : ""}
								</p>
							</div>
						</div>
					)}

					{/* Error banner */}
					{error && (
						<div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
							<p className="text-red-800">{error}</p>
						</div>
					)}

					{/* Subscription stats */}
					{data?.subscription ? (
						<div className="space-y-3">
							<div className="grid divide-x divide-stone-200 rounded-lg border border-stone-200 sm:grid-cols-2 xl:grid-cols-4">
								<div className="px-4 py-3">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
										Plan actual
									</p>
									<p className="mt-1 text-sm font-semibold text-stone-900">
										{currentPlan?.name ?? data.subscription.plan_key}
									</p>
								</div>
								<div className="px-4 py-3">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
										Proximo cobro
									</p>
									<p className="mt-1 text-sm font-semibold text-stone-900">
										{formatDate(data.subscription.current_period_end)}
									</p>
								</div>
								<div className="px-4 py-3">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
										Estado del ciclo
									</p>
									<p className="mt-1 text-sm font-semibold text-stone-900">{statusLabel}</p>
								</div>
								<div className="px-4 py-3">
									<p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
										Monto actual
									</p>
									<p className="mt-1 text-sm font-semibold text-stone-900">
										{formatCurrencyArs(currentPlanAmount)}
									</p>
								</div>
							</div>

							{cancelAtPeriodEnd ? (
								<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
									<BadgeCheck className="mt-0.5 size-4 shrink-0 text-amber-600" />
									<p>
										Cancelacion programada para fin de ciclo:{" "}
										<strong>
											{formatDate(
												scheduledCancellationAt ??
												data.subscription.current_period_end,
											)}
										</strong>
									</p>
								</div>
							) : null}

							{returnTo ? (
								<p className="text-xs text-stone-400">
									Despues de pagar podras volver a:{" "}
									<span className="font-medium text-stone-700">{returnTo}</span>
								</p>
							) : null}
						</div>
					) : null}

					{/* Debug panel */}
					{/* {shouldShowDebugPanel && data?.mercadoPagoDebug ? (
						<Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
							<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-left text-sm transition-colors hover:bg-stone-100 data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
								<span className="text-sm text-stone-600">
									Debug tecnico MercadoPago
								</span>
								<ChevronDown
									className={cn(
										"size-4 text-stone-400 transition-transform duration-200",
										debugOpen && "rotate-180",
									)}
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="overflow-hidden rounded-b-lg border border-t-0 bg-[#111] px-4 py-3 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
								<pre className="max-h-80 overflow-auto text-xs text-white/80">
									{JSON.stringify(data.mercadoPagoDebug, null, 2)}
								</pre>
							</CollapsibleContent>
						</Collapsible>
					) : null} */}
				</div>
			</div>

			{/* Plans section */}
			<div className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold tracking-tight text-stone-900">Plan disponible</h2>
					<p className="mt-0.5 text-sm text-stone-500">
						Todo lo que necesitas para gestionar tu organizacion.
					</p>
				</div>

				{(() => {
					const starterPlan = (data?.plans ?? []).find((p) => p.plan_key === "starter");
					if (!starterPlan && !loading) {
						return (
							<div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-400">
								No hay planes disponibles para mostrar.
							</div>
						);
					}
					if (!starterPlan) return null;

					const plan = starterPlan;
					const isCurrentPlan = data?.subscription?.plan_key === plan.plan_key;
					const amount = extractAmountArs(plan);
					const isPending = pendingPlanKey === plan.plan_key;
					const isDisabled = isPending || (isCurrentPlan && !data?.paywall?.blocked);

					return (
						<div className="mx-auto max-w-lg">
							<div
								className={cn(
									"relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow duration-200",
									isCurrentPlan
										? "border-orange-400 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]"
										: "border-stone-200 hover:shadow-md",
								)}
							>
								<div className="px-8 pb-8 pt-7">
									{/* Top row: plan name + badge */}
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-2.5">
											<div className="flex size-9 items-center justify-center rounded-lg bg-orange-50 border border-orange-200">
												<Zap className="size-4 text-orange-500" />
											</div>
											<div>
												<h3 className="text-lg font-bold tracking-tight text-stone-900">
													{plan.name}
												</h3>
												<p className="text-xs text-stone-400">
													{plan.description ?? "Plan de suscripcion"}
												</p>
											</div>
										</div>
										{isCurrentPlan ? (
											<span className="inline-flex h-6 items-center rounded-full border border-orange-300 bg-orange-50 px-2.5 text-xs font-semibold text-orange-600">
												Tu plan actual
											</span>
										) : null}
									</div>

									{/* Price */}
									<div className="mt-6 flex items-end gap-1.5">
										<span className="text-5xl font-bold tracking-tight text-stone-900">
											{formatCurrencyArs(amount)}
										</span>
										<span className="mb-1.5 text-sm text-stone-400">/ mes</span>
									</div>

									{/* Divider */}
									<div className="my-6 border-t border-stone-100" />

									{/* Feature list */}
									<div className="space-y-1">
										<p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
											Lo que incluye
										</p>
										{[
											`Almacenamiento ${formatStorageLimit(plan.storage_limit_bytes)}`,
											`Tokens IA ${formatCountLimit(plan.ai_token_budget)}`,
											`Mensajes WhatsApp ${formatCountLimit(plan.whatsapp_message_budget)}`,
											"Gestión de obras y certificados",
											"Extraccion optica y captura de documentos",
											"Flujos de trabajo automatizados",
											"Soporte técnico incluido",
										].map((feature) => (
											<div key={feature} className="flex items-center gap-3 py-1.5">
												<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-50 border border-orange-200">
													<Check className="size-3 text-orange-500" strokeWidth={2.5} />
												</div>
												<span className="text-sm text-stone-700">{feature}</span>
											</div>
										))}
									</div>

									{/* CTA */}
									<button
										type="button"
										onClick={() => void handleCheckout(plan.plan_key)}
										disabled={isDisabled}
										className={cn(
											"mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98]",
											isDisabled && !isPending
												? "cursor-not-allowed bg-stone-100 text-stone-400"
												: "bg-orange-500 text-white shadow-sm hover:bg-orange-600 disabled:opacity-60",
										)}
									>
										{isPending ? (
											<>
												<Loader2 className="size-4 animate-spin" />
												Redirigiendo a MercadoPago...
											</>
										) : isCurrentPlan && !data?.paywall?.blocked ? (
											<>
												<Check className="size-4" />
												Plan activo
											</>
										) : (
											<>
												Suscribirme con MercadoPago
											</>
										)}
									</button>

									{!isCurrentPlan && (
										<p className="mt-3 text-center text-xs text-stone-400">
											Pago seguro procesado por MercadoPago · Cancel any time
										</p>
									)}
								</div>
							</div>
						</div>
					);
				})()}
			</div>
		</div>
	);
}
