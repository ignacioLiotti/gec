import { TenantExpenseTable } from "@/components/expenses/tenant-expense-table";
import { UsageEventLog } from "@/components/expenses/usage-event-log";
import {
	TENANT_EXPENSE_SELECT_FIELDS,
	type TenantExpenseRecord,
	type TenantExpenseSnapshot,
	normalizeTenantExpense,
	summarizeLatestUsage,
	findTenantsWithoutUsage,
	formatReadableBytes,
	formatCompactNumber,
} from "@/lib/tenant-expenses";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { updateTenantLimitsAction } from "./actions";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

type UsageEvent = {
	id: string;
	tenant_id: string;
	kind: "storage_bytes" | "ai_tokens" | "whatsapp_messages";
	amount: number;
	context: string | null;
	metadata: Record<string, unknown> | null;
	created_at: string;
};

export default async function GlobalTenantExpensesPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return <div className="p-6 text-sm">Iniciá sesión para revisar los gastos globales.</div>;
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	const isSuperAdmin =
		(profile?.is_superadmin ?? false) ||
		user.id === SUPERADMIN_USER_ID ||
		user.email === "ignacioliotti@gmail.com";

	if (!isSuperAdmin) {
		return (
			<div className="p-6 text-sm text-muted-foreground">
				Esta vista solo está disponible para superadministradores.
			</div>
		);
	}

	const adminClient = createSupabaseAdminClient();
	const [{ data: tenantDirectory, error: tenantsError }, { data: expenses, error: expensesError }] =
		await Promise.all([
			adminClient.from("tenants").select("id, name").order("name"),
			adminClient
				.from("tenant_api_expenses")
				.select(TENANT_EXPENSE_SELECT_FIELDS)
				.order("billing_period_start", { ascending: false }),
		]);

	if (tenantsError || expensesError) {
		console.error("[admin/expenses/all] failed to load tenants/expenses", tenantsError, expensesError);
		return (
			<div className="p-6 text-sm text-destructive">
				No pudimos cargar los gastos globales. Verificá la consola del servidor.
			</div>
		);
	}

	const tenantNameById = new Map(
		(tenantDirectory ?? []).map((tenant) => [tenant.id, tenant.name ?? "Organización"])
	);
	const tenantIds = tenantDirectory?.map((tenant) => tenant.id) ?? [];
	const expenseTenantIds = Array.from(new Set((expenses ?? []).map((row) => row.tenant_id)));

	const ownerMetadata = await fetchOwnerMetadata(adminClient, expenseTenantIds);

	const normalizedRows: TenantExpenseSnapshot[] = (expenses ?? []).map((row) => {
		const owner = ownerMetadata.get(row.tenant_id);
		return normalizeTenantExpense(row as TenantExpenseRecord, {
			tenantName: tenantNameById.get(row.tenant_id) ?? "Organización",
			ownerName: owner?.name,
			ownerId: owner?.id,
		});
	});

	const { data: subscriptionOverrides } = await adminClient
		.from("tenant_subscriptions")
		.select(
			"tenant_id, storage_limit_bytes_override, ai_token_budget_override, whatsapp_message_budget_override"
		);
	const overridesByTenant = new Map(
		(subscriptionOverrides ?? []).map((row) => [
			row.tenant_id,
			{
				storage: row.storage_limit_bytes_override,
				aiTokens: row.ai_token_budget_override,
				whatsapp: row.whatsapp_message_budget_override,
			},
		])
	);

	const usageSummary = summarizeLatestUsage(normalizedRows);
	const tenantsWithoutData = findTenantsWithoutUsage(tenantIds, normalizedRows);
	const { data: eventsData } = await adminClient
		.from("tenant_usage_events")
		.select("id, tenant_id, kind, amount, context, metadata, created_at")
		.order("created_at", { ascending: false })
		.limit(50);
	const usageEvents = (eventsData ?? []) as UsageEvent[];

	const alertingTenants = normalizedRows
		.map((row) => {
			const highestRatio = Math.max(
				calcRatio(row.supabaseStorageBytes, row.supabaseStorageLimitBytes),
				calcRatio(row.aiTokensUsed, row.aiTokenBudget),
				calcRatio(row.whatsappMessages, row.whatsappBudget)
			);
			return { row, highestRatio };
		})
		.filter((entry) => entry.highestRatio >= 0.8)
		.sort((a, b) => b.highestRatio - a.highestRatio)
		.slice(0, 5);

	return (
		<div className="space-y-6 p-6">
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Vista Superadmin
				</div>
				<div>
					<h1 className="text-2xl font-semibold">Gastos de todas las organizaciones</h1>
					<p className="text-sm text-muted-foreground">
						Monitoreá almacenamiento, tokens de IA y uso de WhatsApp API por tenant para anticipar límites.
					</p>
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-4">
				<SummaryCard
					title="Organizaciones con seguimiento"
					value={`${usageSummary.trackedTenants}/${tenantIds.length}`}
					description="Tenants con al menos un gasto cargado este período."
				/>
				<SummaryCard
					title="Supabase Storage"
					value={formatReadableBytes(usageSummary.storageBytesUsed)}
					description={
						usageSummary.storageBytesLimit > 0
							? `de ${formatReadableBytes(usageSummary.storageBytesLimit)} provisionados`
							: "Registrá el límite para ver porcentajes."
					}
				/>
				<SummaryCard
					title="Tokens de IA"
					value={`${formatCompactNumber(usageSummary.aiTokensUsed)} tokens`}
					description={
						usageSummary.aiTokenBudget > 0
							? `de ${formatCompactNumber(usageSummary.aiTokenBudget)} disponibles`
							: "Sin cupos cargados."
					}
				/>
				<SummaryCard
					title="WhatsApp API"
					value={`${formatCompactNumber(usageSummary.whatsappMessages)} mensajes`}
					description={
						usageSummary.whatsappBudget > 0
							? `de ${formatCompactNumber(usageSummary.whatsappBudget)} configurados`
							: "Sin cupos cargados."
					}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-2xl border bg-card p-4">
					<p className="text-sm font-semibold">Alertas destacadas</p>
					{alertingTenants.length === 0 ? (
						<p className="mt-2 text-sm text-muted-foreground">
							Todas las organizaciones se encuentran dentro de sus límites configurados.
						</p>
					) : (
						<ul className="mt-3 space-y-2 text-sm">
							{alertingTenants.map(({ row, highestRatio }) => (
								<li key={row.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
									<div>
										<p className="font-medium">{row.tenantName}</p>
										<p className="text-xs text-muted-foreground">
											{(highestRatio * 100).toFixed(0)}% del límite utilizado
										</p>
									</div>
									<div className="text-right text-xs">
										<p>
											Storage: {formatRatio(row.supabaseStorageBytes, row.supabaseStorageLimitBytes)}
										</p>
										<p>IA: {formatRatio(row.aiTokensUsed, row.aiTokenBudget)}</p>
										<p>WhatsApp: {formatRatio(row.whatsappMessages, row.whatsappBudget)}</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
				<div className="rounded-2xl border bg-card p-4">
					<p className="text-sm font-semibold">Organizaciones sin datos</p>
					{tenantsWithoutData.length === 0 ? (
						<p className="mt-2 text-sm text-muted-foreground">Todas tienen al menos un gasto registrado.</p>
					) : (
						<div className="mt-3 space-y-1">
							{tenantsWithoutData.slice(0, 6).map((tenantId) => (
								<p key={tenantId} className="text-sm">
									{tenantNameById.get(tenantId) ?? tenantId}
								</p>
							))}
							{tenantsWithoutData.length > 6 && (
								<p className="text-xs text-muted-foreground">
									+ {tenantsWithoutData.length - 6} organizaciones adicionales sin datos
								</p>
							)}
						</div>
					)}
				</div>
			</div>

			<TenantExpenseTable
				rows={normalizedRows}
				showOwnerColumn
				emptyMessage="Aún no se cargaron gastos para ninguna organización."
			/>

			<div className="space-y-3">
				<h2 className="text-lg font-semibold">Historial global de uso</h2>
				<UsageEventLog
					events={usageEvents}
					tenantNameById={tenantNameById}
					emptyMessage="Aún no registramos movimientos en el sistema."
				/>
			</div>

			<div className="space-y-3">
				<h2 className="text-lg font-semibold">Límites por organización</h2>
				<p className="text-sm text-muted-foreground">
					Dejando un campo vacío se aplica “sin límite”. Los valores guardados se aplican al instante.
				</p>
				<div className="grid gap-4 lg:grid-cols-2">
					{(tenantDirectory ?? []).map((tenant) => {
						const overrides = overridesByTenant.get(tenant.id);
						const currentStorage =
							overrides?.storage != null
								? `${(overrides.storage / (1024 * 1024 * 1024)).toFixed(2)} GB`
								: "Sin límite";
						const currentAi =
							overrides?.aiTokens != null ? `${overrides.aiTokens.toLocaleString("es-AR")} tokens` : "Sin límite";
						const currentWhatsapp =
							overrides?.whatsapp != null ? `${overrides.whatsapp.toLocaleString("es-AR")} mensajes` : "Sin límite";

						return (
							<form
								key={tenant.id}
								action={updateTenantLimitsAction}
								className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm"
							>
								<input type="hidden" name="tenantId" value={tenant.id} />
								<div>
									<p className="text-sm font-semibold">{tenant.name}</p>
									<p className="text-xs text-muted-foreground">ID: {tenant.id}</p>
								</div>
								<div className="grid gap-3 md:grid-cols-3">
									<label className="space-y-1 text-sm">
										<span className="text-xs text-muted-foreground block">Límite Storage (GB)</span>
										<input
											type="number"
											step="1"
											name="storageLimitGb"
											defaultValue={
												overrides?.storage != null
													? (overrides.storage / (1024 * 1024 * 1024)).toString()
													: ""
											}
											className="w-full rounded-md border px-2 py-1 text-sm"
										/>
										<span className="text-xs text-muted-foreground block">Actual: {currentStorage}</span>
									</label>
									<label className="space-y-1 text-sm">
										<span className="text-xs text-muted-foreground block">Límite Tokens IA</span>
										<input
											type="number"
											step="1000"
											name="aiTokenLimit"
											defaultValue={overrides?.aiTokens ?? ""}
											className="w-full rounded-md border px-2 py-1 text-sm"
										/>
										<span className="text-xs text-muted-foreground block">Actual: {currentAi}</span>
									</label>
									<label className="space-y-1 text-sm">
										<span className="text-xs text-muted-foreground block">Límite WhatsApp</span>
										<input
											type="number"
											step="100"
											name="whatsappLimit"
											defaultValue={overrides?.whatsapp ?? ""}
											className="w-full rounded-md border px-2 py-1 text-sm"
										/>
										<span className="text-xs text-muted-foreground block">Actual: {currentWhatsapp}</span>
									</label>
								</div>
								<div className="flex items-center gap-2">
									<button
										type="submit"
										className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
									>
										Guardar
									</button>
									<span className="text-xs text-muted-foreground">
										Dejá el campo vacío para quitar el límite.
									</span>
								</div>
							</form>
						);
					})}
				</div>
			</div>
		</div>
	);
}

async function fetchOwnerMetadata(adminClient: ReturnType<typeof createSupabaseAdminClient>, tenantIds: string[]) {
	const metadata = new Map<
		string,
		{
			id: string;
			name: string | null;
		}
	>();
	if (tenantIds.length === 0) {
		return metadata;
	}

	const { data: ownerMemberships, error: ownerError } = await adminClient
		.from("memberships")
		.select("tenant_id, user_id")
		.eq("role", "owner")
		.in("tenant_id", tenantIds);

	if (ownerError) {
		console.error("[admin/expenses/all] owner lookup failed", ownerError);
		return metadata;
	}

	const ownerIds = ownerMemberships?.map((row) => row.user_id) ?? [];
	if (ownerIds.length === 0) {
		return metadata;
	}

	const { data: profiles, error: profileError } = await adminClient
		.from("profiles")
		.select("user_id, full_name")
		.in("user_id", ownerIds);

	if (profileError) {
		console.error("[admin/expenses/all] profile lookup failed", profileError);
		return metadata;
	}

	const nameByUserId = new Map(
		(profiles ?? []).map((profile) => [profile.user_id, profile.full_name ?? null])
	);

	for (const membership of ownerMemberships ?? []) {
		if (metadata.has(membership.tenant_id)) continue;
		metadata.set(membership.tenant_id, {
			id: membership.user_id,
			name: nameByUserId.get(membership.user_id) ?? membership.user_id,
		});
	}

	return metadata;
}

function calcRatio(value: number, limit: number): number {
	if (!limit || limit <= 0) return 0;
	return value / limit;
}

function formatRatio(value: number, limit: number): string {
	if (!limit || limit <= 0) {
		return "—";
	}
	const percent = (value / limit) * 100;
	return `${percent.toFixed(0)}%`;
}

function SummaryCard({
	title,
	value,
	description,
}: {
	title: string;
	value: string;
	description: string;
}) {
	return (
		<div className="rounded-2xl border bg-card p-4 shadow-sm">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
			<p className="mt-2 text-2xl font-semibold">{value}</p>
			<p className="text-xs text-muted-foreground">{description}</p>
		</div>
	);
}
