import Link from "next/link";
import {
	AlertTriangle,
	ArrowUpRight,
	Banknote,
	Bell,
	BriefcaseBusiness,
	CheckCircle2,
	FileText,
	ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserRoles } from "@/lib/route-guard";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";

import {
	OperationalTrendChart,
	type OperationalTrendPoint,
} from "./_components/operational-trend-chart";
import { Peek } from "./_components/peek";

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

function formatCompactMoney(value: number, currency = "ARS") {
	try {
		return new Intl.NumberFormat("es-AR", {
			style: "currency",
			currency: normalizeCurrency(currency),
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(value);
	} catch {
		return `${normalizeCurrency(currency)} ${compactNumberFmt.format(value)}`;
	}
}

function formatCompactMoneyGroups(groups: Map<string, number>) {
	const entries = Array.from(groups.entries()).filter(([, amount]) => amount !== 0);
	if (entries.length === 0) return "Sin saldo";
	return entries
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([currency, amount]) => formatCompactMoney(amount, currency))
		.join(" + ");
}

function addMoneyGroup(groups: Map<string, number>, currency: string, amount: number) {
	groups.set(currency, (groups.get(currency) ?? 0) + amount);
}

function buildPolicyTrend(
	policies: PolicyRow[],
	riskPolicyIds: Set<string>,
): OperationalTrendPoint[] {
	const now = new Date();
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const labelFormatter = new Intl.DateTimeFormat("es-AR", {
		month: "short",
		timeZone: "UTC",
	});
	const buckets = Array.from({ length: 12 }, (_, offset) => {
		const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
		return {
			key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
			label: labelFormatter.format(date).replace(".", ""),
			expiring: 0,
			atRisk: 0,
		};
	});
	const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));

	for (const policy of policies) {
		const key = dateIso(policy.end_date).slice(0, 7);
		const bucket = byMonth.get(key);
		if (!bucket) continue;
		bucket.expiring += 1;
		if (riskPolicyIds.has(policy.id)) bucket.atRisk += 1;
	}

	return buckets.map(({ label, expiring, atRisk }) => ({ label, expiring, atRisk }));
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

function daysUntil(value: string | null | undefined) {
	const iso = dateIso(value);
	if (!iso) return null;
	const [year, month, day] = iso.split("-").map(Number);
	if (!year || !month || !day) return null;
	const end = Date.UTC(year, month - 1, day);
	const now = new Date();
	const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((end - today) / 86_400_000);
}

function deadlineLabel(value: string | null | undefined) {
	const days = daysUntil(value);
	if (days === null) return "Sin fecha";
	if (days < 0) return `Vencida hace ${numberFmt.format(Math.abs(days))} d`;
	if (days === 0) return "Vence hoy";
	return `En ${numberFmt.format(days)} d`;
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

function StatTile({
	label,
	value,
	sub,
	icon: Icon,
	tone,
	progress,
}: {
	label: string;
	value: string;
	sub: string;
	icon: React.ComponentType<{ className?: string }>;
	tone: "brand" | "success" | "warning" | "destructive" | "neutral";
	progress?: number;
}) {
	const toneClass = {
		brand: "bg-orange-primary/10 text-orange-primary",
		success: "bg-success/10 text-success",
		warning: "bg-warning/15 text-warning-foreground",
		destructive: "bg-destructive/10 text-destructive",
		neutral: "bg-surface-recessed text-content-secondary",
	}[tone];

	return (
		<div className="min-w-0 px-4 py-3.5">
			<div className="flex items-center gap-2">
				<span className={cn("grid size-6 shrink-0 place-items-center rounded-md", toneClass)}>
					<Icon className="size-3.5" />
				</span>
				<p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-content-muted">
					{label}
				</p>
			</div>
			<p className="mt-2.5 truncate text-[22px] font-semibold leading-none tracking-tight text-content tabular-nums">
				{value}
			</p>
			{progress !== undefined ? (
				<div className="admin-dashboard-progress-track mt-2 h-1 w-full rounded-full">
					<div
						className="admin-dashboard-progress-value h-1 rounded-full bg-orange-primary"
						style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
					/>
				</div>
			) : null}
			<p className="mt-1.5 truncate text-xs text-content-muted">{sub}</p>
		</div>
	);
}

function MeterBar({
	value,
	tone = "progress",
	className,
}: {
	value: number;
	tone?: "progress" | "warning" | "success" | "danger";
	className?: string;
}) {
	const toneClass = {
		progress: "bg-orange-primary",
		warning: "bg-warning",
		success: "bg-success",
		danger: "bg-destructive",
	}[tone];
	return (
		<div className={cn("admin-dashboard-progress-track h-1.5 w-full rounded-full", className)}>
			<div
				className={cn("admin-dashboard-progress-value h-1.5 rounded-full", toneClass)}
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</div>
	);
}

function BulletMeter({
	progress,
	time,
	className,
}: {
	progress: number;
	time: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"admin-dashboard-progress-track relative block h-2 w-28 shrink-0 rounded-full",
				className,
			)}
		>
			<span
				className="admin-dashboard-progress-value absolute inset-y-0 left-0 rounded-full bg-orange-primary"
				style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
			/>
			<span
				className="absolute inset-y-[-2px] w-0.5 -translate-x-1/2 rounded-full bg-content/60"
				style={{ left: `${Math.max(1, Math.min(99, time))}%` }}
			/>
		</span>
	);
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-3 text-xs">
			<span className="shrink-0 text-content-muted">{label}</span>
			<span className="min-w-0 truncate text-right font-medium text-content tabular-nums">
				{children}
			</span>
		</div>
	);
}

const GLANCE_ROW_CLASS =
	"group -mx-2 flex h-9 min-w-0 items-center gap-2.5 rounded-md px-2 transition-colors hover:bg-surface-muted/60";

function EmptyState({ children }: { children: React.ReactNode }) {
	return (
		<div className="admin-dashboard-empty px-4 py-7 text-center text-sm text-content-muted">
			{children}
		</div>
	);
}

function DataSection({
	title,
	subtitle,
	action,
	children,
	className,
	contentClassName,
}: {
	title: string;
	subtitle?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
}) {
	return (
		<Card className={cn("admin-dashboard-card admin-dashboard-card-unfold", className)}>
			<CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
				<div className="min-w-0">
					<CardTitle className="text-sm font-semibold tracking-tight text-content">
						{title}
					</CardTitle>
					{subtitle ? <p className="mt-0.5 truncate text-xs text-content-muted">{subtitle}</p> : null}
				</div>
				{action}
			</CardHeader>
			<CardContent className={contentClassName}>{children}</CardContent>
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
			className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold text-content-secondary transition-colors hover:bg-surface-recessed hover:text-content"
		>
			{children}
			<ArrowUpRight className="size-3" />
		</Link>
	);
}

function SectionDivider({ label, className }: { label: string; className?: string }) {
	return (
		<div className={cn("flex items-center gap-3 pt-1", className)}>
			<p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-muted">
				{label}
			</p>
			<span className="h-px flex-1 bg-stroke-soft" />
		</div>
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
	const totalContract = workModels.reduce(
		(sum, row) => sum + toNumber(row.obra.contrato_mas_ampliaciones),
		0,
	);
	const totalCertified = workModels.reduce(
		(sum, row) => sum + toNumber(row.obra.certificado_a_la_fecha),
		0,
	);
	const certifiedPct = totalContract > 0 ? (totalCertified / totalContract) * 100 : 0;

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

	const reasonCounts = new Map<string, number>();
	for (const row of riskPolicies) {
		for (const reason of row.reasons) {
			reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
		}
	}
	const reasonSummary = Array.from(reasonCounts.entries()).sort(
		([, left], [, right]) => right - left,
	);

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
			detail: formatCompactMoneyGroups(riskBalanceGroups),
			href: "/dashboard",
			tone: riskPolicies.length > 0 ? "danger" : "success",
		},
		{
			label: "Polizas por vencer",
			value: dueSoonPolicies.length,
			detail: formatCompactMoneyGroups(dueSoonBalanceGroups),
			href: "/dashboard",
			tone: dueSoonPolicies.length > 0 ? "warning" : "success",
		},
		{
			label: "Obras atrasadas",
			value: delayedWorks.length,
			detail: `de ${numberFmt.format(activeWorks.length)} obras activas`,
			href: "/excel",
			tone: delayedWorks.length > 0 ? "warning" : "success",
		},
		{
			label: "Documentos pendientes",
			value: pendingDocumentsResult.rows.length,
			detail: "en cola de revision",
			href: "/document-generation/review",
			tone: pendingDocumentsResult.rows.length > 0 ? "brand" : "success",
		},
		{
			label: "Notificaciones sin leer",
			value: notificationsResult.rows.length,
			detail: "de tu bandeja personal",
			href: "/notifications",
			tone: notificationsResult.rows.length > 0 ? "brand" : "success",
		},
	] as const;
	const policyTrend = buildPolicyTrend(
		policiesResult.rows,
		new Set(riskPolicies.map((row) => row.policy.id)),
	);
	const maxAlertValue = Math.max(1, ...alerts.map((alert) => alert.value));

	return (
		<div className="admin-dashboard-sheet space-y-5 p-4 md:p-5">
			<header className="admin-dashboard-reveal flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-muted">
						Panorama operativo
					</p>
					<h1 className="text-xl font-semibold tracking-tight text-content">
						Dashboard administrativo
					</h1>
					<p className="mt-0.5 text-sm text-content-muted">
						Cartera, polizas y documentos al {formatDate(new Date().toISOString())}.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="neutral" size="sm" className="shadow-card tabular-nums">
						{numberFmt.format(obrasResult.rows.length)} obras
					</Badge>
					<Badge variant="neutral" size="sm" className="shadow-card tabular-nums">
						{numberFmt.format(policiesResult.rows.length)} polizas
					</Badge>
				</div>
			</header>

			{queryErrors.length > 0 ? (
				<div className="admin-dashboard-row flex items-start gap-2.5 border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<p>No se pudo cargar una parte del dashboard: {queryErrors.join(" | ")}</p>
				</div>
			) : null}

			<Card className="admin-dashboard-card admin-dashboard-card-raised admin-dashboard-card-unfold admin-dashboard-reveal-step-1 overflow-hidden py-0">
				<CardContent className="grid p-0 sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-stroke-soft">
					<StatTile
						label="Cartera total"
						value={formatCompactMoney(totalContract)}
						sub={`${numberFmt.format(workModels.length)} obras en cartera`}
						icon={BriefcaseBusiness}
						tone="brand"
					/>
					<StatTile
						label="Certificado"
						value={formatCompactMoney(totalCertified)}
						sub={`${certifiedPct.toFixed(0)}% de la cartera`}
						icon={CheckCircle2}
						tone="success"
						progress={certifiedPct}
					/>
					<StatTile
						label="Saldo a certificar"
						value={formatCompactMoney(totalActiveSaldo)}
						sub={`${numberFmt.format(activeWorks.length)} obras activas`}
						icon={Banknote}
						tone="neutral"
					/>
					<StatTile
						label="Riesgo en polizas"
						value={numberFmt.format(riskPolicies.length)}
						sub={formatCompactMoneyGroups(riskBalanceGroups)}
						icon={ShieldAlert}
						tone="destructive"
					/>
					<StatTile
						label="Docs pendientes"
						value={numberFmt.format(pendingDocumentsResult.rows.length)}
						sub="en cola de revision"
						icon={FileText}
						tone="warning"
					/>
				</CardContent>
			</Card>

			<div className="admin-dashboard-reveal-grid admin-dashboard-reveal-step-2 grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
				<DataSection
					title="Tendencia de vencimientos"
					subtitle="Polizas que vencen por mes y cuantas mantienen senales de riesgo"
					action={
						<Badge variant="neutral" size="sm" className="shrink-0">
							12 meses
						</Badge>
					}
					contentClassName="pt-0"
				>
					<div className="flex flex-wrap items-center gap-4 pb-1 text-xs text-content-muted">
						<span className="inline-flex items-center gap-1.5">
							<span className="size-2 rounded-sm bg-orange-primary" /> Vencimientos
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-[var(--src-mixed)]" /> Con riesgo
						</span>
					</div>
					<OperationalTrendChart data={policyTrend} />
				</DataSection>

				<DataSection
					title="Salud operativa"
					subtitle="Frentes que necesitan atencion hoy"
				>
					<div className="space-y-3.5">
						{alerts.map((alert) => (
							<Link key={alert.label} href={alert.href} className="group block">
								<div className="mb-1 flex items-end justify-between gap-3">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium text-content group-hover:text-orange-primary">
											{alert.label}
										</p>
										<p className="truncate text-xs text-content-muted">{alert.detail}</p>
									</div>
									<p className="text-lg font-semibold leading-none tabular-nums text-content">
										{numberFmt.format(alert.value)}
									</p>
								</div>
								<div className="h-1.5 overflow-hidden rounded-full bg-surface-recessed">
									<span
										className={cn(
											"admin-dashboard-progress-value block h-full rounded-full",
											alert.tone === "danger" && "bg-destructive",
											alert.tone === "warning" && "bg-warning",
											alert.tone === "brand" && "bg-orange-primary",
											alert.tone === "success" && "bg-success",
										)}
										style={{
											width: `${alert.value === 0 ? 0 : Math.max(8, (alert.value / maxAlertValue) * 100)}%`,
										}}
									/>
								</div>
							</Link>
						))}
					</div>
				</DataSection>
			</div>

			<SectionDivider
				label="Obras"
				className="admin-dashboard-reveal admin-dashboard-reveal-step-3"
			/>

			<DataSection
				title="Obras activas por desvio"
				subtitle={`${numberFmt.format(activeWorks.length)} activas · ${formatCompactMoney(totalActiveSaldo)} por certificar`}
				action={<TextLink href="/excel">Ver obras</TextLink>}
				className="admin-dashboard-reveal-step-3"
			>
				{activeWorks.length === 0 ? (
					<EmptyState>No hay obras activas.</EmptyState>
				) : (
					<>
						<div className="mb-1 flex items-center justify-end gap-4 text-[11px] text-content-muted">
							<span className="inline-flex items-center gap-1.5">
								<span className="h-1.5 w-4 rounded-full bg-orange-primary" /> Avance
							</span>
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2.5 w-0.5 rounded-full bg-content/60" /> Plazo
							</span>
						</div>
						<div className="divide-y divide-stroke-soft">
							{activeWorks.slice(0, 10).map((row) => (
								<Peek
									key={row.obra.id}
									content={
										<>
											<p className="line-clamp-2 text-sm font-semibold text-content">
												{row.obra.n ?? "-"} - {row.obra.designacion_y_ubicacion ?? "Sin nombre"}
											</p>
											<p className="mt-0.5 truncate text-xs text-content-muted">
												{row.obra.entidad_contratante || "Sin contratante"}
											</p>
											<div className="mt-2.5 space-y-2 border-t border-stroke-soft pt-2.5">
												<div>
													<DetailRow label="Avance">{row.progressPct.toFixed(0)}%</DetailRow>
													<MeterBar value={row.progressPct} className="mt-1 h-1" />
												</div>
												<div>
													<DetailRow label="Plazo transcurrido">{row.timePct.toFixed(0)}%</DetailRow>
													<MeterBar
														value={row.timePct}
														tone={row.delayPct >= 10 ? "warning" : "success"}
														className="mt-1 h-1"
													/>
												</div>
												<DetailRow label="Desvio">
													{row.delayPct >= 1 ? `+${row.delayPct.toFixed(0)} pp` : "Al dia"}
												</DetailRow>
												<DetailRow label="Saldo a certificar">{formatMoney(row.saldo)}</DetailRow>
												<DetailRow label="Actualizada">{formatDate(row.updatedAt)}</DetailRow>
											</div>
										</>
									}
								>
									<Link href={`/excel/${row.obra.id}`} className={GLANCE_ROW_CLASS}>
										<span
											className={cn(
												"size-1.5 shrink-0 rounded-full",
												row.delayPct >= 10 ? "bg-warning" : "bg-success",
											)}
										/>
										<span className="min-w-0 flex-1 truncate text-sm font-medium text-content group-hover:text-orange-primary">
											{row.obra.n ?? "-"} - {row.obra.designacion_y_ubicacion ?? "Sin nombre"}
										</span>
										{row.delayPct >= 10 ? (
											<Badge variant="warning" size="xs" className="hidden shrink-0 tabular-nums md:inline-flex">
												+{row.delayPct.toFixed(0)} pp
											</Badge>
										) : null}
										<BulletMeter
											progress={row.progressPct}
											time={row.timePct}
											className="hidden sm:block"
										/>
										<span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-content">
											{formatCompactMoney(row.saldo)}
										</span>
									</Link>
								</Peek>
							))}
						</div>
					</>
				)}
			</DataSection>

			<SectionDivider
				label="Polizas"
				className="admin-dashboard-reveal admin-dashboard-reveal-step-4"
			/>

			<div className="admin-dashboard-reveal-grid admin-dashboard-reveal-step-4 grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
				<DataSection
					title="Polizas con riesgo"
					subtitle={`${numberFmt.format(riskPolicies.length)} con senales · ${formatCompactMoneyGroups(riskBalanceGroups)}`}
					action={<TextLink href="/dashboard">Panel de polizas</TextLink>}
				>
					{riskPolicies.length === 0 ? (
						<EmptyState>Sin polizas con senales de riesgo.</EmptyState>
					) : (
						<>
							<div className="mb-2 flex flex-wrap gap-1.5">
								{reasonSummary.map(([reason, count]) => (
									<Badge key={reason} variant="warning" size="xs" count={count}>
										{reason}
									</Badge>
								))}
							</div>
							<div className="divide-y divide-stroke-soft">
								{riskPolicies.slice(0, 8).map((row) => (
									<Peek
										key={row.policy.id}
										content={
											<>
												<p className="text-sm font-semibold text-content">
													{row.policy.policy_number || "Sin numero"}
													<span className="font-normal text-content-muted">
														{row.policy.section ? ` · ${row.policy.section}` : ""}
													</span>
												</p>
												<p className="mt-0.5 line-clamp-2 text-xs text-content-muted">
													{getPolicyObraLabel(row.policy)}
												</p>
												<div className="mt-2.5 space-y-2 border-t border-stroke-soft pt-2.5">
													<DetailRow label="Vence">
														{formatDate(row.policy.end_date)} · {deadlineLabel(row.policy.end_date)}
													</DetailRow>
													<DetailRow label="Saldo">
														{formatMoney(row.balance, row.currency)}
													</DetailRow>
													<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
														<span className="text-content-muted">Senales</span>
														<span className="flex flex-wrap justify-end gap-1">
															{row.reasons.map((reason) => (
																<Badge key={reason} variant="warning" size="xs">
																	{reason}
																</Badge>
															))}
														</span>
													</div>
												</div>
											</>
										}
									>
										<Link href={getPolicyHref(row.policy)} className={GLANCE_ROW_CLASS}>
											<span className="min-w-0 flex-1 truncate text-sm font-medium text-content group-hover:text-orange-primary">
												{row.policy.policy_number || "Sin numero"}
												<span className="font-normal text-content-muted">
													{row.policy.section ? ` · ${row.policy.section}` : ""}
												</span>
											</span>
											<Badge variant="warning" size="xs" className="shrink-0">
												{row.reasons[0]}
											</Badge>
											<span className="hidden w-24 shrink-0 text-right text-xs tabular-nums text-content-muted md:block">
												{deadlineLabel(row.policy.end_date)}
											</span>
											<span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-content">
												{formatCompactMoney(row.balance, row.currency)}
											</span>
										</Link>
									</Peek>
								))}
							</div>
						</>
					)}
				</DataSection>

				<DataSection
					title="Proximos vencimientos"
					subtitle="Polizas activas que vencen dentro de 60 dias"
				>
					{dueSoonPolicies.length === 0 ? (
						<EmptyState>No hay polizas venciendo en los proximos 60 dias.</EmptyState>
					) : (
						<div className="divide-y divide-stroke-soft">
							{dueSoonPolicies.slice(0, 8).map((row) => (
								<Peek
									key={row.policy.id}
									content={
										<>
											<p className="text-sm font-semibold text-content">
												{row.policy.policy_number || "Sin numero"}
												<span className="font-normal text-content-muted">
													{row.policy.section ? ` · ${row.policy.section}` : ""}
												</span>
											</p>
											<p className="mt-0.5 line-clamp-2 text-xs text-content-muted">
												{getPolicyObraLabel(row.policy)}
											</p>
											<div className="mt-2.5 space-y-2 border-t border-stroke-soft pt-2.5">
												<DetailRow label="Vence">
													{formatDate(row.policy.end_date)} · {deadlineLabel(row.policy.end_date)}
												</DetailRow>
												<DetailRow label="Saldo">
													{formatMoney(row.balance, row.currency)}
												</DetailRow>
											</div>
										</>
									}
								>
									<Link href={getPolicyHref(row.policy)} className={GLANCE_ROW_CLASS}>
										<Badge
											variant="warning"
											size="xs"
											className="min-w-14 shrink-0 justify-center tabular-nums"
										>
											{deadlineLabel(row.policy.end_date)}
										</Badge>
										<span className="min-w-0 flex-1 truncate text-sm font-medium text-content group-hover:text-orange-primary">
											{row.policy.policy_number || "Sin numero"}
										</span>
										<span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-content">
											{formatCompactMoney(row.balance, row.currency)}
										</span>
									</Link>
								</Peek>
							))}
						</div>
					)}
				</DataSection>
			</div>

			<SectionDivider
				label="Documentos y actividad"
				className="admin-dashboard-reveal admin-dashboard-reveal-step-5"
			/>

			<div className="admin-dashboard-reveal-grid admin-dashboard-reveal-step-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<DataSection
					title="Documentos pendientes de revisar"
					subtitle={`${numberFmt.format(pendingDocumentsResult.rows.length)} en cola`}
					action={<TextLink href="/document-generation/review">Ir a revision</TextLink>}
				>
					{pendingDocumentsResult.rows.length === 0 ? (
						<EmptyState>La cola de revision esta limpia.</EmptyState>
					) : (
						<div className="divide-y divide-stroke-soft">
							{pendingDocumentsResult.rows.slice(0, 8).map((document) => {
								const obra = document.obras;
								const workLabel = obra?.designacion_y_ubicacion
									? `${obra.n ?? "-"} - ${obra.designacion_y_ubicacion}`
									: document.obra_id ?? "Sin obra";
								const underReview = document.status === "UNDER_REVIEW";
								return (
									<Peek
										key={document.id}
										content={
											<>
												<p className="line-clamp-2 break-all text-sm font-semibold text-content">
													{document.file_name || document.document_type || "Documento"}
												</p>
												<p className="mt-0.5 line-clamp-2 text-xs text-content-muted">{workLabel}</p>
												<div className="mt-2.5 space-y-2 border-t border-stroke-soft pt-2.5">
													<div className="flex items-center justify-between gap-3 text-xs">
														<span className="text-content-muted">Estado</span>
														<Badge variant={underReview ? "info" : "neutral"} size="xs">
															{underReview ? "En revision" : "Generado"}
														</Badge>
													</div>
													{document.document_generation_templates?.name ? (
														<DetailRow label="Plantilla">
															{document.document_generation_templates.name}
														</DetailRow>
													) : null}
													<DetailRow label="Generado">{formatDate(document.generated_at)}</DetailRow>
												</div>
											</>
										}
									>
										<Link
											href={`/document-generation/review?id=${encodeURIComponent(document.id)}`}
											className={GLANCE_ROW_CLASS}
										>
											<span
												className={cn(
													"size-1.5 shrink-0 rounded-full",
													underReview ? "bg-orange-primary" : "bg-stroke-strong",
												)}
											/>
											<span className="min-w-0 flex-1 truncate text-sm font-medium text-content group-hover:text-orange-primary">
												{document.file_name || document.document_type || "Documento"}
											</span>
											<span className="w-20 shrink-0 text-right text-xs tabular-nums text-content-muted">
												{formatDate(document.generated_at)}
											</span>
										</Link>
									</Peek>
								);
							})}
						</div>
					)}
				</DataSection>

				<div className="flex min-w-0 flex-col gap-4">
					<DataSection
						title="Obras terminadas recientemente"
						subtitle={`${numberFmt.format(completedWorks.length)} al 100%`}
					>
						{completedWorks.length === 0 ? (
							<EmptyState>No hay obras terminadas.</EmptyState>
						) : (
							<div className="divide-y divide-stroke-soft">
								{completedWorks.slice(0, 4).map((row) => (
									<Link
										key={row.obra.id}
										href={`/excel/${row.obra.id}`}
										className={GLANCE_ROW_CLASS}
									>
										<span className="size-1.5 shrink-0 rounded-full bg-success" />
										<span className="min-w-0 flex-1 truncate text-sm font-medium text-content group-hover:text-orange-primary">
											{row.obra.n ?? "-"} - {row.obra.designacion_y_ubicacion ?? "Sin nombre"}
										</span>
										<span className="w-20 shrink-0 text-right text-xs tabular-nums text-content-muted">
											{formatDate(row.updatedAt)}
										</span>
									</Link>
								))}
							</div>
						)}
					</DataSection>

					<DataSection
						title="Notificaciones sin leer"
						subtitle={`${numberFmt.format(notificationsResult.rows.length)} en tu bandeja`}
						action={<TextLink href="/notifications">Ver todas</TextLink>}
					>
						{notificationsResult.rows.length === 0 ? (
							<EmptyState>No hay notificaciones sin leer.</EmptyState>
						) : (
							<div className="divide-y divide-stroke-soft">
								{notificationsResult.rows.slice(0, 4).map((notification) => (
									<Peek
										key={notification.id}
										content={
											<>
												<p className="text-sm font-semibold text-content">
													{notification.title || "Alerta"}
												</p>
												<p className="mt-1 text-xs leading-5 text-content-muted">
													{notification.body || notification.type || "Sin detalle"}
												</p>
												<p className="mt-2 text-[11px] tabular-nums text-content-muted">
													{formatDate(notification.created_at)}
												</p>
											</>
										}
									>
										<Link
											href={notification.action_url || "/notifications"}
											className={GLANCE_ROW_CLASS}
										>
											<Bell className="size-3.5 shrink-0 text-orange-primary" />
											<span className="min-w-0 flex-1 truncate text-sm font-medium text-content group-hover:text-orange-primary">
												{notification.title || "Alerta"}
											</span>
											<span className="w-20 shrink-0 text-right text-xs tabular-nums text-content-muted">
												{formatDate(notification.created_at)}
											</span>
										</Link>
									</Peek>
								))}
							</div>
						)}
					</DataSection>
				</div>
			</div>
		</div>
	);
}
