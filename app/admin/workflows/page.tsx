import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
	{ key: "all", label: "Todo" },
	{ key: "pending", label: "Pendiente" },
	{ key: "completed", label: "Completado" },
	{ key: "failed", label: "Fallido" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

type ExecutionRow = {
	id: string;
	status: "pending" | "completed" | "failed";
	scheduled_for: string | null;
	executed_at: string | null;
	updated_at: string | null;
	created_at: string | null;
	error_message: string | null;
	recipient_user_id: string | null;
	notification_types: string[] | null;
	obra: {
		id: string;
		designacion_y_ubicacion: string | null;
	} | null;
	flujo_action: {
		id: string;
		title: string | null;
		action_type: string | null;
	} | null;
};

type RecipientProfile = {
	user_id: string;
	full_name: string | null;
	email?: string | null;
};

export default async function WorkflowMonitorPage({
	searchParams,
}: {
	searchParams?: Record<string, string | string[] | undefined>;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return (
			<div className="p-6">
				<p className="text-sm text-muted-foreground">
					Necesitás iniciar sesión para ver el monitor de workflows.
				</p>
			</div>
		);
	}

	const { data: memberships } = await supabase
		.from("memberships")
		.select("tenant_id")
		.order("created_at", { ascending: true });

	const tenantId = memberships?.[0]?.tenant_id ?? null;

	if (!tenantId) {
		return (
			<div className="p-6">
				<p className="text-sm text-muted-foreground">
					No encontramos ningún tenant asociado a tu usuario.
				</p>
			</div>
		);
	}

	const requestedStatus = normalizeStatus(searchParams?.status);

	let executionsQuery = supabase
		.from("obra_flujo_executions")
		.select(
			`
				id,
				status,
				scheduled_for,
				executed_at,
				updated_at,
				created_at,
				error_message,
				recipient_user_id,
				notification_types,
				obra:obras(id, designacion_y_ubicacion, tenant_id),
				flujo_action:obra_flujo_actions(id, title, action_type)
			`
		)
		.eq("obra.tenant_id", tenantId)
		.order("created_at", { ascending: false })
		.limit(200);

	if (requestedStatus !== "all") {
		executionsQuery = executionsQuery.eq("status", requestedStatus);
	}

	const { data: executionRows, error: executionsError } =
		await executionsQuery;

	if (executionsError) {
		return (
			<div className="p-6">
				<p className="text-sm text-red-500">
					Error cargando workflows: {executionsError.message}
				</p>
			</div>
		);
	}

	const lookupIds = Array.from(
		new Set(
			(executionRows ?? [])
				.map((row) => row.recipient_user_id)
				.filter((id): id is string => Boolean(id))
		)
	);

	let profileMap = new Map<string, RecipientProfile>();

	if (lookupIds.length) {
		const { data: profiles } = await supabase
			.from("profiles")
			.select("user_id, full_name")
			.in("user_id", lookupIds);

		profileMap = new Map(
			(profiles ?? []).map((profile) => [profile.user_id, profile])
		);
	}

	const rows = executionRows ?? [];
	const stats = rows.reduce(
		(acc, row) => {
			acc[row.status] = (acc[row.status] ?? 0) + 1;
			return acc;
		},
		{ pending: 0, completed: 0, failed: 0 } as Record<
			"pending" | "completed" | "failed",
			number
		>
	);

	return (
		<div className="p-6 space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold">Workflows de Flujo</h1>
				<p className="text-sm text-muted-foreground">
					Monitoreá los envíos programados de acciones de flujo y verificá el
					estado real de cada destinatario.
				</p>
			</div>

			<StatsRow stats={stats} />

			<StatusFilter active={requestedStatus} />

			<div className="overflow-x-auto rounded-md border">
				<table className="w-full text-sm">
					<thead className="bg-foreground/5 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Acción</th>
							<th className="px-3 py-2 font-medium">Obra</th>
							<th className="px-3 py-2 font-medium">Destinatario</th>
							<th className="px-3 py-2 font-medium">Estado</th>
							<th className="px-3 py-2 font-medium">Programado</th>
							<th className="px-3 py-2 font-medium">Ejecutado</th>
							<th className="px-3 py-2 font-medium">Última actualización</th>
							<th className="px-3 py-2 font-medium">Detalles</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 && (
							<tr>
								<td
									colSpan={8}
									className="px-3 py-6 text-center text-muted-foreground"
								>
									No hay ejecuciones registradas para este filtro.
								</td>
							</tr>
						)}
						{rows.map((row) => (
							<tr key={row.id} className="border-t">
								<td className="px-3 py-2 align-top">
									<div className="font-medium">
										{row.flujo_action?.title ?? "Acción"}
									</div>
									<div className="text-xs text-muted-foreground">
										{row.flujo_action?.action_type ?? "-"}
									</div>
								</td>
								<td className="px-3 py-2 align-top">
									{row.obra?.designacion_y_ubicacion ?? row.obra?.id ?? "-"}
								</td>
								<td className="px-3 py-2 align-top">
									{renderRecipient(row.recipient_user_id, profileMap)}
								</td>
								<td className="px-3 py-2 align-top">
									<StatusBadge status={row.status} />
								</td>
								<td className="px-3 py-2 align-top">
									{formatDate(row.scheduled_for)}
								</td>
								<td className="px-3 py-2 align-top">
									{formatDate(row.executed_at)}
								</td>
								<td className="px-3 py-2 align-top">
									{formatDate(row.updated_at)}
								</td>
								<td className="px-3 py-2 align-top">
									<div className="text-xs text-muted-foreground">
										Tipos: {formatList(row.notification_types)}
									</div>
									{row.error_message && (
										<p className="text-xs text-red-500">
											{row.error_message}
										</p>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function normalizeStatus(input: string | string[] | undefined): StatusKey {
	if (Array.isArray(input)) return normalizeStatus(input[0]);
	if (!input) return "all";
	const lower = input.toLowerCase();
	return STATUS_FILTERS.some((filter) => filter.key === lower)
		? (lower as StatusKey)
		: "all";
}

function formatDate(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleString();
}

function formatList(values: string[] | null): string {
	if (!values || values.length === 0) return "—";
	return values.join(", ");
}

function renderRecipient(
	recipientId: string | null,
	profileMap: Map<string, RecipientProfile>
) {
	if (!recipientId) {
		return <span className="text-muted-foreground">—</span>;
	}
	const profile = profileMap.get(recipientId);
	if (!profile) {
		return <span className="font-mono text-xs">{recipientId}</span>;
	}
	return (
		<div>
			<div className="font-medium text-xs">
				{profile.full_name ?? "Sin nombre"}
			</div>
			<div className="text-[11px] text-muted-foreground font-mono">
				{recipientId.slice(0, 8)}…
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: "pending" | "completed" | "failed" }) {
	const labelMap: Record<typeof status, string> = {
		pending: "Pendiente",
		completed: "Completado",
		failed: "Fallido",
	};
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
				status === "pending" && "bg-amber-100 text-amber-900",
				status === "completed" && "bg-emerald-100 text-emerald-900",
				status === "failed" && "bg-red-100 text-red-900"
			)}
		>
			{labelMap[status]}
		</span>
	);
}

function StatusFilter({ active }: { active: StatusKey }) {
	return (
		<div className="flex flex-wrap gap-2">
			{STATUS_FILTERS.map((filter) => {
				const href =
					filter.key === "all"
						? "/admin/workflows"
						: `/admin/workflows?status=${filter.key}`;
				return (
					<Link
						key={filter.key}
						className={cn(
							"rounded-full border px-3 py-1 text-sm",
							active === filter.key
								? "border-foreground bg-foreground text-background"
								: "border-border text-foreground"
						)}
						href={href}
					>
						{filter.label}
					</Link>
				);
			})}
		</div>
	);
}

function StatsRow({
	stats,
}: {
	stats: Record<"pending" | "completed" | "failed", number>;
}) {
	const items = [
		{ label: "Pendientes", value: stats.pending, tone: "text-amber-600" },
		{ label: "Completados", value: stats.completed, tone: "text-emerald-600" },
		{ label: "Fallidos", value: stats.failed, tone: "text-red-600" },
	];
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{items.map((item) => (
				<div key={item.label} className="rounded-md border p-4">
					<div className="text-sm text-muted-foreground">{item.label}</div>
					<div className={cn("text-2xl font-semibold", item.tone)}>
						{item.value}
					</div>
				</div>
			))}
		</div>
	);
}
