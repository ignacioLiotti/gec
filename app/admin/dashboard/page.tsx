import Link from "next/link";
import {
	AlertTriangle,
	ArrowUpRight,
	BadgeAlert,
	BriefcaseBusiness,
	CheckCircle2,
	Clock3,
	FileText,
	ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserRoles } from "@/lib/route-guard";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ObraRow = {
	id: string;
	n: number | string | null;
	designacion_y_ubicacion: string | null;
	entidad_contratante: string | null;
	contrato_mas_ampliaciones: number | string | null;
	certificado_a_la_fecha: number | string | null;
	saldo_a_certificar: number | string | null;
	plazo_total: number | string | null;
	plazo_transc: number | string | null;
	porcentaje: number | string | null;
	updated_at: string | null;
};

type PolicyObra = {
	id?: string | null;
	n?: number | string | null;
	designacion_y_ubicacion?: string | null;
	porcentaje?: number | string | null;
};

type PolicyRow = {
	id: string;
	obra_id: string | null;
	import_obra_label: string | null;
	policy_number: string | null;
	section: string | null;
	coverage_period: string | null;
	end_date: string | null;
	insured_amount: number | string | null;
	currency: string | null;
	premium: number | string | null;
	prize: number | string | null;
	balance: number | string | null;
	status: string | null;
	risk: string | null;
	insured_object: string | null;
	is_cancelled: boolean | null;
	obras?: PolicyObra | PolicyObra[] | null;
};

type GeneratedDocumentRow = {
	id: string;
	obra_id: string | null;
	file_name: string | null;
	status: string | null;
	document_type: string | null;
	generated_at: string | null;
	updated_at: string | null;
	obras?: {
		n?: number | string | null;
		designacion_y_ubicacion?: string | null;
	} | null;
	document_generation_templates?: {
		name?: string | null;
	} | null;
};

type NotificationRow = {
	id: string;
	title: string | null;
	body: string | null;
	type: string | null;
	action_url: string | null;
	created_at: string | null;
};

type LoadResult<T> = {
	rows: T[];
	error: string | null;
};

type WorkModel = {
	obra: ObraRow;
	progressPct: number;
	timePct: number;
	delayPct: number;
	saldo: number;
	updatedAt: string | null;
};

type PolicyWithReasons = {
	policy: PolicyRow;
	reasons: string[];
	balance: number;
	currency: string;
};

const numberFmt = new Intl.NumberFormat("es-AR");
const compactNumberFmt = new Intl.NumberFormat("es-AR", {
	notation: "compact",
	maximumFractionDigits: 1,
});

function toNumber(value: unknown) {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const raw = value.trim();
		if (!raw) return 0;
		const stripped = raw.replace(/[^\d,.-]/g, "");
		const lastDot = stripped.lastIndexOf(".");
		const lastComma = stripped.lastIndexOf(",");
		const normalized =
			lastComma > lastDot
				? stripped.replace(/\./g, "").replace(",", ".")
				: stripped.replace(/,/g, "");
		const parsed = Number.parseFloat(normalized);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function normalizeCurrency(value: unknown) {
	const raw = String(value ?? "ARS").trim().toUpperCase();
	if (raw === "U$S" || raw.includes("USD")) return "USD";
	if (/^[A-Z]{3}$/.test(raw)) return raw;
	return "ARS";
}

function formatMoney(value: number, currency = "ARS") {
	try {
		return new Intl.NumberFormat("es-AR", {
			style: "currency",
			currency: normalizeCurrency(currency),
			maximumFractionDigits: 0,
		}).format(value);
	} catch {
		return `${normalizeCurrency(currency)} ${compactNumberFmt.format(value)}`;
	}
}

function formatMoneyGroups(groups: Map<string, number>) {
	const entries = Array.from(groups.entries()).filter(([, amount]) => amount !== 0);
	if (entries.length === 0) return formatMoney(0);
	return entries
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([currency, amount]) => formatMoney(amount, currency))
		.join(" + ");
}

function addMoneyGroup(groups: Map<string, number>, currency: string, amount: number) {
	groups.set(currency, (groups.get(currency) ?? 0) + amount);
}

function dateIso(value: string | null | undefined) {
	if (!value) return "";
	return value.slice(0, 10);
}

function formatDate(value: string | null | undefined) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value.slice(0, 10);
	return date.toLocaleDateString("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function addDaysIso(days: number) {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date.toISOString().slice(0, 10);
}

function getPolicyObra(policy: PolicyRow) {
	return Array.isArray(policy.obras) ? policy.obras[0] ?? null : policy.obras ?? null;
}

function getPolicyObraLabel(policy: PolicyRow) {
	const obra = getPolicyObra(policy);
	if (obra?.designacion_y_ubicacion) {
		return `${obra.n ?? "-"} - ${obra.designacion_y_ubicacion}`;
	}
	return policy.import_obra_label || "Sin obra vinculada";
}

function getPolicyHref(policy: PolicyRow) {
	const obraId = policy.obra_id ?? getPolicyObra(policy)?.id ?? null;
	return obraId ? `/excel/${obraId}` : "/dashboard";
}

function getPolicyReasons(policy: PolicyRow, todayIso: string, soonIso: string) {
	const reasons: string[] = [];
	const endDate = dateIso(policy.end_date);
	const balance = toNumber(policy.balance);
	const isCancelled = Boolean(policy.is_cancelled);
	const searchableText = [
		policy.section,
		policy.status,
		policy.risk,
		policy.insured_object,
		policy.coverage_period,
	].join(" ").toLowerCase();

	if (isCancelled && balance > 0) reasons.push("Baja con saldo");
	if (!isCancelled && endDate && endDate < todayIso) reasons.push("Vencida activa");
	if (!isCancelled && endDate && endDate >= todayIso && endDate <= soonIso) reasons.push("Por vencer");
	if (!isCancelled && !endDate) reasons.push("Sin vencimiento");
	if (
		searchableText.includes("riesgo") ||
		searchableText.includes("observ") ||
		searchableText.includes("alert")
	) {
		reasons.push("Riesgo cargado");
	}

	return Array.from(new Set(reasons));
}

function buildWorkModel(obra: ObraRow): WorkModel {
	const progressPct = Math.max(0, Math.min(100, toNumber(obra.porcentaje)));
	const plazoTotal = toNumber(obra.plazo_total);
	const plazoTransc = toNumber(obra.plazo_transc);
	const timePct = plazoTotal > 0 ? Math.max(0, Math.min(140, (plazoTransc / plazoTotal) * 100)) : 0;
	const delayPct = Math.max(0, timePct - progressPct);
	return {
		obra,
		progressPct,
		timePct,
		delayPct,
		saldo: toNumber(obra.saldo_a_certificar),
		updatedAt: obra.updated_at,
	};
}

function sortByDateDesc<T>(rows: T[], getValue: (row: T) => string | null | undefined) {
	return [...rows].sort((left, right) => {
		const leftTime = new Date(getValue(left) ?? 0).getTime();
		const rightTime = new Date(getValue(right) ?? 0).getTime();
		return rightTime - leftTime;
	});
}

async function loadObras(supabase: Supabase, tenantId: string): Promise<LoadResult<ObraRow>> {
	const { data, error } = await supabase
		.from("obras")
		.select(
			"id, n, designacion_y_ubicacion, entidad_contratante, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, plazo_total, plazo_transc, porcentaje, updated_at",
		)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.order("updated_at", { ascending: false });

	return {
		rows: ((data ?? []) as ObraRow[]),
		error: error?.message ?? null,
	};
}

async function loadPolicies(supabase: Supabase, tenantId: string): Promise<LoadResult<PolicyRow>> {
	const { data, error } = await supabase
		.from("insurance_policies")
		.select(
			"id, obra_id, import_obra_label, policy_number, section, coverage_period, end_date, insured_amount, currency, premium, prize, balance, status, risk, insured_object, is_cancelled, obras(id, n, designacion_y_ubicacion, porcentaje)",
		)
		.eq("tenant_id", tenantId)
		.order("end_date", { ascending: true, nullsFirst: false });

	return {
		rows: ((data ?? []) as PolicyRow[]),
		error: error?.message ?? null,
	};
}

async function loadPendingDocuments(
	supabase: Supabase,
	tenantId: string,
): Promise<LoadResult<GeneratedDocumentRow>> {
	const { data, error } = await supabase
		.from("generated_documents")
		.select(
			"id, obra_id, file_name, status, document_type, generated_at, updated_at, obras(n, designacion_y_ubicacion), document_generation_templates(name)",
		)
		.eq("tenant_id", tenantId)
		.in("status", ["GENERATED", "UNDER_REVIEW"])
		.order("generated_at", { ascending: false })
		.limit(12);

	return {
		rows: ((data ?? []) as GeneratedDocumentRow[]),
		error: error?.message ?? null,
	};
}

async function loadUnreadNotifications(
	supabase: Supabase,
	tenantId: string,
	userId: string,
): Promise<LoadResult<NotificationRow>> {
	const { data, error } = await supabase
		.from("notifications")
		.select("id, title, body, type, action_url, created_at")
		.eq("tenant_id", tenantId)
		.eq("user_id", userId)
		.is("read_at", null)
		.order("created_at", { ascending: false })
		.limit(8);

	return {
		rows: ((data ?? []) as NotificationRow[]),
		error: error?.message ?? null,
	};
}

function KpiCard({
	title,
	value,
	description,
	icon: Icon,
	tone = "stone",
}: {
	title: string;
	value: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
	tone?: "stone" | "amber" | "red" | "emerald" | "sky";
}) {
	const toneClass = {
		stone: "admin-dashboard-icon bg-stone-950 text-white",
		amber: "admin-dashboard-icon-orange bg-amber-500 text-white",
		red: "admin-dashboard-icon-orange bg-rose-600 text-white",
		emerald: "admin-dashboard-icon bg-emerald-600 text-white",
		sky: "admin-dashboard-icon-violet bg-sky-600 text-white",
	}[tone];

	return (
		<Card className="admin-dashboard-card admin-dashboard-card-raised">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
						{title}
					</p>
					<span className={cn("grid size-8 place-items-center rounded-lg", toneClass)}>
						<Icon className="size-4" />
					</span>
				</div>
			</CardHeader>
			<CardContent>
				<p className="break-words text-2xl font-semibold tracking-tight text-stone-950">
					{value}
				</p>
				<p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
			</CardContent>
		</Card>
	);
}

function ProgressLine({
	value,
	tone = "sky",
}: {
	value: number;
	tone?: "sky" | "amber" | "emerald" | "rose";
}) {
	const toneClass = {
		sky: "bg-sky-600",
		amber: "bg-amber-500",
		emerald: "bg-emerald-600",
		rose: "bg-rose-600",
	}[tone];
	return (
		<div className="admin-dashboard-progress-track h-2 w-full rounded-full">
			<div
				className={cn("h-2 rounded-full", toneClass)}
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</div>
	);
}

function EmptyState({ children }: { children: React.ReactNode }) {
	return (
		<div className="admin-dashboard-empty px-4 py-8 text-center text-sm text-stone-500">
			{children}
		</div>
	);
}

function DataSection({
	title,
	action,
	children,
}: {
	title: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Card className="admin-dashboard-card">
			<CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
				<CardTitle className="text-base font-semibold text-stone-950">{title}</CardTitle>
				{action}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

function TextLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className="inline-flex items-center gap-1 rounded-md bg-white/60 px-2 py-1 text-xs font-semibold text-sky-700 transition hover:bg-white"
		>
			{children}
			<ArrowUpRight className="size-3" />
		</Link>
	);
}

export default async function AdminDashboardPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return <div className="p-6 text-sm">Inicia sesion para ver el dashboard administrativo.</div>;
	}

	const userRoles = await getUserRoles();
	if (!userRoles.isAdmin && !userRoles.isSuperAdmin) {
		return <div className="p-6 text-sm">Sin permisos de administrador.</div>;
	}

	if (!userRoles.tenantId) {
		return <div className="p-6 text-sm">No hay una organizacion activa seleccionada.</div>;
	}

	const [obrasResult, policiesResult, pendingDocumentsResult, notificationsResult] =
		await Promise.all([
			loadObras(supabase, userRoles.tenantId),
			loadPolicies(supabase, userRoles.tenantId),
			loadPendingDocuments(supabase, userRoles.tenantId),
			loadUnreadNotifications(supabase, userRoles.tenantId, user.id),
		]);

	const todayIso = new Date().toISOString().slice(0, 10);
	const soonIso = addDaysIso(60);
	const workModels = obrasResult.rows.map(buildWorkModel);
	const activeWorks = workModels
		.filter((row) => row.progressPct < 100)
		.sort((left, right) => right.delayPct - left.delayPct || right.saldo - left.saldo);
	const completedWorks = sortByDateDesc(
		workModels.filter((row) => row.progressPct >= 100),
		(row) => row.updatedAt,
	);
	const delayedWorks = activeWorks.filter((row) => row.delayPct >= 10);
	const totalActiveSaldo = activeWorks.reduce((sum, row) => sum + row.saldo, 0);

	const policiesWithReasons: PolicyWithReasons[] = policiesResult.rows
		.map((policy) => {
			const currency = normalizeCurrency(policy.currency);
			return {
				policy,
				reasons: getPolicyReasons(policy, todayIso, soonIso),
				balance: toNumber(policy.balance),
				currency,
			};
		})
		.filter((row) => row.reasons.length > 0);

	const riskPolicies = [...policiesWithReasons].sort(
		(left, right) => Math.max(0, right.balance) - Math.max(0, left.balance),
	);
	const dueSoonPolicies = policiesWithReasons
		.filter((row) => row.reasons.includes("Por vencer"))
		.sort((left, right) =>
			dateIso(left.policy.end_date).localeCompare(dateIso(right.policy.end_date)),
		);

	const riskBalanceGroups = new Map<string, number>();
	for (const row of riskPolicies) {
		addMoneyGroup(riskBalanceGroups, row.currency, Math.max(0, row.balance));
	}

	const dueSoonBalanceGroups = new Map<string, number>();
	for (const row of dueSoonPolicies) {
		addMoneyGroup(dueSoonBalanceGroups, row.currency, Math.max(0, row.balance));
	}

	const queryErrors = [
		obrasResult.error ? `Obras: ${obrasResult.error}` : null,
		policiesResult.error ? `Polizas: ${policiesResult.error}` : null,
		pendingDocumentsResult.error ? `Documentos: ${pendingDocumentsResult.error}` : null,
		notificationsResult.error ? `Alertas: ${notificationsResult.error}` : null,
	].filter(Boolean);

	const alerts = [
		{
			label: "Polizas con riesgo",
			value: riskPolicies.length,
			detail: formatMoneyGroups(riskBalanceGroups),
			href: "/dashboard",
			tone: riskPolicies.length > 0 ? "rose" : "emerald",
		},
		{
			label: "Polizas por vencer",
			value: dueSoonPolicies.length,
			detail: formatMoneyGroups(dueSoonBalanceGroups),
			href: "/dashboard",
			tone: dueSoonPolicies.length > 0 ? "amber" : "emerald",
		},
		{
			label: "Obras atrasadas",
			value: delayedWorks.length,
			detail: `${numberFmt.format(activeWorks.length)} obras activas`,
			href: "/excel",
			tone: delayedWorks.length > 0 ? "amber" : "emerald",
		},
		{
			label: "Documentos pendientes",
			value: pendingDocumentsResult.rows.length,
			detail: "en cola de revision",
			href: "/document-generation/review",
			tone: pendingDocumentsResult.rows.length > 0 ? "sky" : "emerald",
		},
	];

	return (
		<div className="admin-dashboard-sheet space-y-6 p-4 md:p-6">
			<header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-stone-950">
						Dashboard administrativo
					</h1>
					<p className="mt-1 text-sm text-stone-600">
						Resumen de riesgo operativo, polizas, obras y documentos pendientes.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="secondary" className="border border-[color:var(--card-border)] bg-white text-stone-700 shadow-[var(--ring-illum)]">
						{numberFmt.format(obrasResult.rows.length)} obras
					</Badge>
					<Badge variant="secondary" className="border border-[color:var(--card-border)] bg-white text-stone-700 shadow-[var(--ring-illum-violet)]">
						{numberFmt.format(policiesResult.rows.length)} polizas
					</Badge>
				</div>
			</header>

			{queryErrors.length > 0 ? (
				<div className="admin-dashboard-row border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[var(--ring-illum-orange)]">
					No se pudo cargar una parte del dashboard: {queryErrors.join(" | ")}
				</div>
			) : null}

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<KpiCard
					title="Saldo polizas con riesgo"
					value={formatMoneyGroups(riskBalanceGroups)}
					description={`${numberFmt.format(riskPolicies.length)} polizas con senales abiertas`}
					icon={ShieldAlert}
					tone={riskPolicies.length > 0 ? "red" : "emerald"}
				/>
				<KpiCard
					title="Saldo por vencer"
					value={formatMoneyGroups(dueSoonBalanceGroups)}
					description={`Vencen dentro de 60 dias: ${numberFmt.format(dueSoonPolicies.length)}`}
					icon={Clock3}
					tone={dueSoonPolicies.length > 0 ? "amber" : "emerald"}
				/>
				<KpiCard
					title="Obras activas"
					value={numberFmt.format(activeWorks.length)}
					description={`Saldo a certificar: ${formatMoney(totalActiveSaldo)}`}
					icon={BriefcaseBusiness}
					tone="sky"
				/>
				<KpiCard
					title="Docs pendientes"
					value={numberFmt.format(pendingDocumentsResult.rows.length)}
					description="Documentos esperando revision"
					icon={FileText}
					tone={pendingDocumentsResult.rows.length > 0 ? "amber" : "emerald"}
				/>
			</div>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
				<DataSection
					title="Polizas con riesgo"
					action={<TextLink href="/dashboard">Panel de polizas</TextLink>}
				>
					{riskPolicies.length === 0 ? (
						<EmptyState>Sin polizas con senales de riesgo.</EmptyState>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[760px] text-sm">
								<thead>
									<tr className="border-b border-[color:var(--sep-fill)] text-left text-xs uppercase tracking-wide text-stone-500">
										<th className="pb-2 pr-3">Poliza</th>
										<th className="pb-2 pr-3">Obra</th>
										<th className="pb-2 pr-3">Vence</th>
										<th className="pb-2 pr-3">Saldo</th>
										<th className="pb-2 pr-3">Senal</th>
										<th className="pb-2 pr-3">Ver</th>
									</tr>
								</thead>
								<tbody>
									{riskPolicies.slice(0, 8).map((row) => (
										<tr key={row.policy.id} className="border-b border-[color:rgba(40,36,28,.08)]">
											<td className="py-3 pr-3">
												<p className="font-medium text-stone-950">
													{row.policy.policy_number || "Sin numero"}
												</p>
												<p className="text-xs text-stone-500">{row.policy.section || "-"}</p>
											</td>
											<td className="max-w-[260px] py-3 pr-3">
												<p className="truncate text-stone-700">{getPolicyObraLabel(row.policy)}</p>
											</td>
											<td className="py-3 pr-3 text-stone-700">{formatDate(row.policy.end_date)}</td>
											<td className="py-3 pr-3 font-semibold text-stone-950">
												{formatMoney(row.balance, row.currency)}
											</td>
											<td className="py-3 pr-3">
												<div className="flex flex-wrap gap-1">
													{row.reasons.slice(0, 2).map((reason) => (
														<Badge key={reason} variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-800">
															{reason}
														</Badge>
													))}
												</div>
											</td>
											<td className="py-3 pr-3">
												<TextLink href={getPolicyHref(row.policy)}>Abrir</TextLink>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</DataSection>

				<DataSection title="Alertas">
					<div className="space-y-2">
						{alerts.map((alert) => (
							<Link
								key={alert.label}
								href={alert.href}
								className="admin-dashboard-row admin-dashboard-row-interactive flex items-center justify-between gap-3 px-3 py-3"
							>
								<div className="flex min-w-0 items-center gap-3">
									<span
										className={cn(
											"grid size-8 shrink-0 place-items-center rounded-lg text-white",
											alert.tone === "rose" && "admin-dashboard-icon-orange bg-rose-600",
											alert.tone === "amber" && "admin-dashboard-icon-orange bg-amber-500",
											alert.tone === "sky" && "admin-dashboard-icon-violet bg-sky-600",
											alert.tone === "emerald" && "admin-dashboard-icon bg-emerald-600",
										)}
									>
										{alert.tone === "emerald" ? (
											<CheckCircle2 className="size-4" />
										) : (
											<BadgeAlert className="size-4" />
										)}
									</span>
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-stone-950">{alert.label}</p>
										<p className="truncate text-xs text-stone-500">{alert.detail}</p>
									</div>
								</div>
								<span className="text-xl font-semibold tabular-nums text-stone-950">
									{numberFmt.format(alert.value)}
								</span>
							</Link>
						))}
					</div>
				</DataSection>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				<DataSection title="Polizas por vencer">
					{dueSoonPolicies.length === 0 ? (
						<EmptyState>No hay polizas venciendo en los proximos 60 dias.</EmptyState>
					) : (
						<div className="space-y-3">
							{dueSoonPolicies.slice(0, 6).map((row) => (
								<div key={row.policy.id} className="admin-dashboard-row px-3 py-3">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-stone-950">
												{row.policy.policy_number || "Sin numero"}
											</p>
											<p className="truncate text-xs text-stone-500">{getPolicyObraLabel(row.policy)}</p>
										</div>
										<Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
											{formatDate(row.policy.end_date)}
										</Badge>
									</div>
									<div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-500">
										<span>Saldo {formatMoney(row.balance, row.currency)}</span>
										<TextLink href={getPolicyHref(row.policy)}>Ver poliza</TextLink>
									</div>
								</div>
							))}
						</div>
					)}
				</DataSection>

				<DataSection title="Documentos pendientes de revisar">
					{pendingDocumentsResult.rows.length === 0 ? (
						<EmptyState>La cola de revision esta limpia.</EmptyState>
					) : (
						<div className="space-y-3">
							{pendingDocumentsResult.rows.slice(0, 6).map((document) => {
								const obra = document.obras;
								const workLabel = obra?.designacion_y_ubicacion
									? `${obra.n ?? "-"} - ${obra.designacion_y_ubicacion}`
									: document.obra_id ?? "Sin obra";
								return (
									<div key={document.id} className="admin-dashboard-row px-3 py-3">
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold text-stone-950">
													{document.file_name || document.document_type || "Documento"}
												</p>
												<p className="truncate text-xs text-stone-500">{workLabel}</p>
											</div>
											<Badge variant="secondary" className="border border-[color:var(--card-border)] bg-stone-50 text-stone-700">
												{document.status === "UNDER_REVIEW" ? "En revision" : "Generado"}
											</Badge>
										</div>
										<div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-500">
											<span>{formatDate(document.generated_at)}</span>
											<TextLink href={`/document-generation/review?id=${encodeURIComponent(document.id)}`}>
												Revisar
											</TextLink>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</DataSection>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				<DataSection title="Obras activas">
					{activeWorks.length === 0 ? (
						<EmptyState>No hay obras activas.</EmptyState>
					) : (
						<div className="space-y-3">
							{activeWorks.slice(0, 6).map((row) => (
								<div key={row.obra.id} className="admin-dashboard-row px-3 py-3">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-stone-950">
												{row.obra.n ?? "-"} - {row.obra.designacion_y_ubicacion ?? "Sin nombre"}
											</p>
											<p className="truncate text-xs text-stone-500">
												{row.obra.entidad_contratante || "Sin contratante"}
											</p>
										</div>
										<TextLink href={`/excel/${row.obra.id}`}>Abrir</TextLink>
									</div>
									<div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
										<div>
											<div className="mb-1 flex justify-between text-[11px] text-stone-500">
												<span>Avance</span>
												<span>{row.progressPct.toFixed(0)}%</span>
											</div>
											<ProgressLine value={row.progressPct} tone="sky" />
										</div>
										<div>
											<div className="mb-1 flex justify-between text-[11px] text-stone-500">
												<span>Plazo</span>
												<span>{row.timePct.toFixed(0)}%</span>
											</div>
											<ProgressLine value={row.timePct} tone={row.delayPct >= 10 ? "amber" : "emerald"} />
										</div>
										<p className="text-xs font-semibold text-stone-700">
											Saldo {formatMoney(row.saldo)}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</DataSection>

				<DataSection title="Obras terminadas recientemente">
					{completedWorks.length === 0 ? (
						<EmptyState>No hay obras terminadas.</EmptyState>
					) : (
						<div className="space-y-3">
							{completedWorks.slice(0, 6).map((row) => (
								<div
									key={row.obra.id}
									className="admin-dashboard-row flex items-center justify-between gap-3 px-3 py-3"
								>
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-stone-950">
											{row.obra.n ?? "-"} - {row.obra.designacion_y_ubicacion ?? "Sin nombre"}
										</p>
										<p className="text-xs text-stone-500">
											Actualizada {formatDate(row.updatedAt)}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
											100%
										</Badge>
										<TextLink href={`/excel/${row.obra.id}`}>Abrir</TextLink>
									</div>
								</div>
							))}
						</div>
					)}
				</DataSection>
			</div>

			<DataSection title="Notificaciones sin leer">
				{notificationsResult.rows.length === 0 ? (
					<EmptyState>No hay notificaciones sin leer.</EmptyState>
				) : (
					<div className="grid gap-3 md:grid-cols-2">
						{notificationsResult.rows.map((notification) => (
							<Link
								key={notification.id}
								href={notification.action_url || "/notifications"}
								className="admin-dashboard-row admin-dashboard-row-interactive px-3 py-3"
							>
								<div className="flex items-start gap-3">
									<span className="admin-dashboard-icon-orange mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-rose-600 text-white">
										<AlertTriangle className="size-4" />
									</span>
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-stone-950">
											{notification.title || "Alerta"}
										</p>
										<p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
											{notification.body || notification.type || "Sin detalle"}
										</p>
										<p className="mt-2 text-[11px] text-stone-400">
											{formatDate(notification.created_at)}
										</p>
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</DataSection>
		</div>
	);
}
