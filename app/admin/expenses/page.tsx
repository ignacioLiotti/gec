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
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
	tenant_id: string;
	role: string;
	tenants: { name: string | null } | null;
};

type UsageEvent = {
	id: string;
	tenant_id: string;
	kind: "storage_bytes" | "ai_tokens" | "whatsapp_messages";
	amount: number;
	context: string | null;
	metadata: Record<string, unknown> | null;
	created_at: string;
};

export default async function TenantExpensesPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return <div className="p-6 text-sm">Iniciá sesión para ver tus consumos.</div>;
	}

	const { data: memberships, error: membershipError } = await supabase
		.from("memberships")
		.select("tenant_id, role, tenants(name)")
		.eq("user_id", user.id)
		.in("role", ["owner", "admin"])
		.order("created_at", { ascending: true });

	if (membershipError) {
		console.error("[admin/expenses] memberships error", membershipError);
		return (
			<div className="p-6 text-sm text-destructive">
				No pudimos verificar tus organizaciones. Intentá de nuevo en unos minutos.
			</div>
		);
	}

	type MembershipRowRaw = {
		tenant_id: string;
		role: string;
		tenants: { name: string | null } | { name: string | null }[] | null;
	};
	const membershipRows: MembershipRow[] = (memberships ?? []).map((row) => {
		const typedRow = row as MembershipRowRaw;
		const tenantInfo = Array.isArray(typedRow.tenants)
			? typedRow.tenants[0] ?? null
			: typedRow.tenants;
		return {
			tenant_id: typedRow.tenant_id,
			role: typedRow.role,
			tenants: tenantInfo,
		};
	});
	if (membershipRows.length === 0) {
		return (
			<div className="p-6 text-sm">
				Necesitás ser administrador de una organización para ver sus gastos.
			</div>
		);
	}

	const tenantNameById = new Map(
		membershipRows.map((row) => [row.tenant_id, row.tenants?.name ?? "Organización"])
	);
	const tenantIds = membershipRows.map((row) => row.tenant_id);

	let normalizedRows: TenantExpenseSnapshot[] = [];
	let usageEvents: UsageEvent[] = [];
	if (tenantIds.length > 0) {
		const { data: expenses, error: expensesError } = await supabase
			.from("tenant_api_expenses")
			.select(TENANT_EXPENSE_SELECT_FIELDS)
			.in("tenant_id", tenantIds)
			.order("billing_period_start", { ascending: false });

		if (expensesError) {
			console.error("[admin/expenses] expenses error", expensesError);
			return (
				<div className="p-6 text-sm text-destructive">
					No pudimos cargar los gastos. Reintentá más tarde.
				</div>
			);
		}

		normalizedRows = (expenses ?? []).map((row) =>
			normalizeTenantExpense(row as TenantExpenseRecord, {
				tenantName: tenantNameById.get(row.tenant_id) ?? "Organización",
			})
		);

		const { data: eventsData } = await supabase
			.from("tenant_usage_events")
			.select("id, tenant_id, kind, amount, context, metadata, created_at")
			.in("tenant_id", tenantIds)
			.order("created_at", { ascending: false })
			.limit(25);
		usageEvents = (eventsData ?? []) as UsageEvent[];
	}

	const usageSummary = summarizeLatestUsage(normalizedRows);
	const tenantsWithoutData = findTenantsWithoutUsage(tenantIds, normalizedRows);
	const missingTenantNames = tenantsWithoutData.map(
		(id) => tenantNameById.get(id) ?? "Organización"
	);

	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-semibold">Gastos de mis organizaciones</h1>
				<p className="text-sm text-muted-foreground">
					Seguimiento mensual de almacenamiento, tokens de IA y uso de WhatsApp API para tus tenants.
				</p>
			</div>

			<div className="grid gap-4 lg:grid-cols-4">
				<SummaryCard
					title="Organizaciones monitoreadas"
					value={`${usageSummary.trackedTenants}/${tenantIds.length}`}
					description={
						usageSummary.trackedTenants === tenantIds.length
							? "Todas tienen consumos cargados."
							: "Faltan cargar datos en algunas."
					}
				/>
				<SummaryCard
					title="Supabase Storage"
					value={formatReadableBytes(usageSummary.storageBytesUsed)}
					description={
						usageSummary.storageBytesLimit > 0
							? `de ${formatReadableBytes(usageSummary.storageBytesLimit)} disponibles`
							: "Sin límite configurado."
					}
				/>
				<SummaryCard
					title="Tokens de IA"
					value={`${formatCompactNumber(usageSummary.aiTokensUsed)} tokens`}
					description={
						usageSummary.aiTokenBudget > 0
							? `de ${formatCompactNumber(usageSummary.aiTokenBudget)} tokens asignados`
							: "Sin cupo definido."
					}
				/>
				<SummaryCard
					title="WhatsApp API"
					value={`${formatCompactNumber(usageSummary.whatsappMessages)} mensajes`}
					description={
						usageSummary.whatsappBudget > 0
							? `de ${formatCompactNumber(usageSummary.whatsappBudget)} mensajes disponibles`
							: "Sin cupo definido."
					}
				/>
			</div>

			{missingTenantNames.length > 0 && (
				<div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4 text-sm">
					<p className="font-medium text-amber-900">Faltan consumos</p>
					<p className="text-amber-800">
						Todavía no cargaste gastos para: {missingTenantNames.join(", ")}.
					</p>
				</div>
			)}

			<TenantExpenseTable
				rows={normalizedRows}
				emptyMessage="Cargá el gasto mensual de tus tenants desde la tabla tenant_api_expenses para verlos acá."
			/>

			<div className="space-y-3">
				<h2 className="text-lg font-semibold">Últimos movimientos</h2>
				<UsageEventLog
					events={usageEvents}
					tenantNameById={tenantNameById}
					emptyMessage="Aún no registramos movimientos en tus organizaciones."
				/>
			</div>
		</div>
	);
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
