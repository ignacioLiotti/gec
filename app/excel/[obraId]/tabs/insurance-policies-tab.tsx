"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowRight,
	Check,
	Clock3,
	FileSpreadsheet,
	Inbox,
	Pencil,
	Plus,
	RotateCcw,
	Save,
	Search,
	Shield,
	TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ObraDestinationCombobox } from "@/components/obra-destination-combobox";
import { cn } from "@/lib/utils";

type RuleType = "on_finish" | "days_after" | "months_after";
type PolicyStatusFilter = "all" | "active" | "dueSoon" | "expired" | "cancelled";
type PolicySortKey = "policy" | "endDate" | "rule" | "calculatedDate" | "status";
type EditingSection = "responsibles" | "calculatedDate" | "balanceStatus" | null;
type PolicyStatus = "active" | "dueSoon" | "expired" | "cancelled";

type Policy = {
	id: string;
	obra_id: string | null;
	policy_number: string;
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
	cancellation_rule_type: RuleType;
	cancellation_rule_offset: number;
	cancellation_rule_configured: boolean | null;
	obra_finished_at: string | null;
	definitive_reception_date?: string | null;
	calculated_cancellation_date: string | null;
	is_cancelled: boolean;
};

type PolicyListPayload = {
	policies: Policy[];
	pagination?: { total: number; limit: number; page: number; totalPages: number };
};

type TenantUser = {
	id: string;
	full_name: string | null;
	email: string | null;
};

type ObraOption = {
	id: string;
	n: number | string | null;
	designacionYUbicacion: string;
	porcentaje: number;
};

type PolicyDraft = {
	endDate: string;
	balance: string;
	status: string;
	definitiveReceptionDate: string;
	cancellationRuleType: RuleType;
	cancellationRuleOffset: string;
	cancellationRuleConfigured: boolean;
};

const EMPTY_POLICY_FORM = {
	policyNumber: "",
	endDate: "",
};

const FILTERS: Array<{ value: PolicyStatusFilter; label: string }> = [
	{ value: "all", label: "Todas" },
	{ value: "active", label: "Vigentes" },
	{ value: "cancelled", label: "Dadas de baja" },
];

const MAX_RENDERED_POLICY_LIST_ITEMS = 100;
const POLICY_LIST_STALE_TIME_MS = 5 * 60 * 1000;
const POLICY_METADATA_STALE_TIME_MS = 10 * 60 * 1000;

function formatDate(value: string | null | undefined) {
	if (!value) return "-";
	return value.slice(0, 10);
}

function formatDisplayDate(value: string | null | undefined) {
	const date = formatDate(value);
	if (date === "-") return "-";
	const [year, month, day] = date.split("-");
	return `${day}/${month}/${year}`;
}

function parsePolicyDate(value: string | null | undefined) {
	if (!value) return null;
	const text = value.trim();
	if (!text) return null;
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.slice(0, 10));
	if (iso) {
		const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
		return Number.isNaN(date.getTime()) ? null : date;
	}
	const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
	if (slash) {
		const day = Number(slash[1]);
		const month = Number(slash[2]);
		const rawYear = Number(slash[3]);
		const year = rawYear < 100 ? 2000 + rawYear : rawYear;
		const date = new Date(Date.UTC(year, month - 1, day));
		if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
			return date;
		}
	}
	return null;
}

function parseCoveragePeriodRange(policy: Policy) {
	const parts = String(policy.coverage_period ?? "")
		.split(/\s+-\s+|\s+–\s+|\s+—\s+/)
		.map((part) => part.trim())
		.filter(Boolean);
	const startDate = parsePolicyDate(parts[0]);
	const endDate =
		parsePolicyDate(policy.calculated_cancellation_date) ??
		parsePolicyDate(policy.end_date) ??
		parsePolicyDate(parts[1]);
	if (!startDate || !endDate) return null;
	return { startDate, endDate };
}

function getPeriodProgress(policy: Policy) {
	const range = parseCoveragePeriodRange(policy);
	if (!range) return null;
	const today = new Date();
	const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
	const start = range.startDate.getTime();
	const end = range.endDate.getTime();
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
	const rawPercent = ((todayStart - start) / (end - start)) * 100;
	const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
	return {
		...range,
		percent,
		isBeforeStart: todayStart < start,
		isPastEnd: todayStart > end,
	};
}

function normalizeSearchText(value: unknown) {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

function ruleLabel(type: RuleType) {
	if (type === "days_after") return `N dias despues`;
	if (type === "months_after") return `N meses despues`;
	return "Al finalizar obra";
}

function calculateDraftCancellationDate(policy: Policy, draft: PolicyDraft) {
	const baseSource = draft.definitiveReceptionDate || policy.obra_finished_at;
	if (!draft.cancellationRuleConfigured || !baseSource) return null;
	const base = new Date(`${baseSource.slice(0, 10)}T00:00:00.000Z`);
	if (Number.isNaN(base.getTime())) return null;
	const amount = Math.max(0, Math.floor(Number(draft.cancellationRuleOffset || 0)));
	if (draft.cancellationRuleType === "days_after") base.setUTCDate(base.getUTCDate() + amount);
	if (draft.cancellationRuleType === "months_after") base.setUTCMonth(base.getUTCMonth() + amount);
	return base.toISOString().slice(0, 10);
}

function ruleFormula(policy: Policy, draft: PolicyDraft) {
	if (!draft.cancellationRuleConfigured) return "Sin logica definida";
	const base = draft.definitiveReceptionDate || policy.obra_finished_at || null;
	if (!base) return "Esperando finalizacion provisoria o recepcion definitiva";
	const calculatedDate = calculateDraftCancellationDate(policy, draft);
	const amount = Number(draft.cancellationRuleOffset || 0);
	if (draft.cancellationRuleType === "on_finish") {
		return `Al finalizar obra -> ${formatDisplayDate(calculatedDate)}`;
	}
	const unit = draft.cancellationRuleType === "days_after" ? "dias" : "meses";
	return `${amount} ${unit} despues -> ${formatDisplayDate(calculatedDate)}`;
}

function ruleDescription(policy: Policy, draft: PolicyDraft) {
	if (!draft.cancellationRuleConfigured) return "Sin regla definida";
	const hasDefinitiveDate = Boolean(draft.definitiveReceptionDate);
	const baseLabel = hasDefinitiveDate ? "recepcion definitiva" : "fecha provisoria en que se marco la obra terminada";
	if (!draft.definitiveReceptionDate && !policy.obra_finished_at) return "La regla espera una fecha provisoria de finalizacion o la recepcion definitiva";
	if (draft.cancellationRuleType === "on_finish") return `La baja queda igual a la ${baseLabel}`;
	const amount = Number(draft.cancellationRuleOffset || 0);
	const unit = draft.cancellationRuleType === "days_after" ? "dias" : "meses";
	return `La baja suma ${amount} ${unit} a la ${baseLabel}`;
}

function getPolicyDraft(policy: Policy, drafts: Record<string, PolicyDraft>): PolicyDraft {
	return drafts[policy.id] ?? {
		endDate: policy.end_date?.slice(0, 10) ?? "",
		balance: policy.balance == null ? "" : String(policy.balance),
		status: policy.status ?? "",
		definitiveReceptionDate: policy.definitive_reception_date?.slice(0, 10) ?? "",
		cancellationRuleType: policy.cancellation_rule_type,
		cancellationRuleOffset: String(policy.cancellation_rule_offset ?? 0),
		cancellationRuleConfigured: policy.cancellation_rule_configured === true,
	};
}

function isPolicyDraftDirty(policy: Policy, draft: PolicyDraft) {
	return (
		draft.endDate !== (policy.end_date?.slice(0, 10) ?? "") ||
		draft.balance !== (policy.balance == null ? "" : String(policy.balance)) ||
		draft.status !== (policy.status ?? "") ||
		draft.definitiveReceptionDate !== (policy.definitive_reception_date?.slice(0, 10) ?? "") ||
		draft.cancellationRuleConfigured !== (policy.cancellation_rule_configured === true) ||
		draft.cancellationRuleType !== policy.cancellation_rule_type ||
		Number(draft.cancellationRuleOffset || 0) !== Number(policy.cancellation_rule_offset ?? 0)
	);
}

function daysUntil(value: string | null | undefined) {
	if (!value) return null;
	const target = new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
	const today = new Date();
	const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
	if (!Number.isFinite(target)) return null;
	return Math.ceil((target - start) / 86_400_000);
}

function policyStatus(policy: Policy): PolicyStatus {
	if (policy.is_cancelled) return "cancelled";
	if (isFinalizedActivePolicy(policy)) return "expired";
	if (policy.cancellation_rule_configured !== true) return "active";
	const days = daysUntil(policy.calculated_cancellation_date);
	if (days !== null && days < 0) return "expired";
	if (days !== null && days <= 60) return "dueSoon";
	return "active";
}

function isFinalizedActivePolicy(policy: Policy) {
	const days = daysUntil(policy.end_date);
	return !policy.is_cancelled && days !== null && days < 0;
}

function statusLabel(status: PolicyStatus) {
	if (status === "cancelled") return "Dada de baja";
	if (status === "expired") return "Vencida";
	if (status === "dueSoon") return "Por vencer";
	return "Vigente";
}

function statusClasses(status: PolicyStatus) {
	if (status === "cancelled") return "border-sky-200 bg-sky-50 text-sky-800";
	if (status === "expired") return "border-orange-300 bg-orange-50 text-orange-700";
	if (status === "dueSoon") return "border-amber-200 bg-amber-50 text-amber-700";
	return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function statusHeaderGradient(status: PolicyStatus) {
	if (status === "cancelled") return "from-sky-50/95 via-white to-white";
	if (status === "expired" || status === "dueSoon") return "from-orange-50/95 to-white";
	return "from-emerald-50/95 to-white";
}

function statusAccentClasses(status: PolicyStatus) {
	if (status === "cancelled") return "text-sky-800";
	if (status === "expired") return "text-orange-700";
	if (status === "dueSoon") return "text-amber-700";
	return "text-emerald-700";
}

function statusProgressClasses(status: PolicyStatus) {
	if (status === "cancelled") return "bg-sky-500";
	if (status === "expired") return "bg-orange-500";
	if (status === "dueSoon") return "bg-amber-500";
	return "bg-emerald-500";
}

function statusPillClasses(status: PolicyStatus) {
	if (status === "cancelled") return "border-sky-200 bg-sky-50 text-sky-800";
	if (status === "expired") return "border-orange-200 bg-orange-50 text-orange-700";
	if (status === "dueSoon") return "border-amber-200 bg-amber-50 text-amber-700";
	return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function selectedPolicyRowClasses(status: PolicyStatus) {
	if (status === "cancelled") return "bg-sky-50/65 shadow-card border-l-4 border-sky-300";
	if (status === "expired") return "bg-white shadow-card border-l-4 border-orange-300";
	if (status === "dueSoon") return "bg-amber-50/55 shadow-card border-l-4 border-amber-300";
	return "bg-emerald-50/55 shadow-card border-l-4 border-emerald-300";
}

function statusRingClasses(status: PolicyStatus) {
	if (status === "cancelled") return "ring-2 ring-sky-100";
	if (status === "expired") return "ring-2 ring-orange-100";
	if (status === "dueSoon") return "ring-2 ring-amber-100";
	return "ring-2 ring-emerald-100";
}

function StatusIcon({ status, className }: { status: PolicyStatus; className?: string }) {
	if (status === "expired") return <TriangleAlert className={className} />;
	if (status === "cancelled") return <Check className={className} />;
	return <Clock3 className={className} />;
}

function listStatusLabel(policy: Policy, status: PolicyStatus) {
	if (status === "cancelled") return "Dada de baja";
	if (status === "expired") return policy.is_cancelled ? "Vencida" : "Activa vencida";
	if (status === "dueSoon") return "Por vencer";
	return "Activa";
}

function listStatusDescription(status: PolicyStatus) {
	if (status === "cancelled") return "Dada de baja";
	if (status === "expired") return "Activa, pero pasada de fecha";
	if (status === "dueSoon") return "Activa, proxima a vencer";
	return "Activa y dentro de plazo";
}

function listDueDate(policy: Policy, status: PolicyStatus) {
	if (status === "cancelled") return null;
	if (status === "expired" && isFinalizedActivePolicy(policy)) return policy.end_date;
	return policy.calculated_cancellation_date ?? policy.end_date;
}

function formatMoney(value: number | string | null, currency: string | null) {
	const amount = Number(value ?? 0);
	if (!Number.isFinite(amount) || amount <= 0) return "-";
	const normalizedCurrency = String(currency ?? "").trim().toUpperCase();
	const currencyCode =
		normalizedCurrency === "$" || normalizedCurrency === "PESOS" || normalizedCurrency === ""
			? "ARS"
			: normalizedCurrency;
	try {
		return new Intl.NumberFormat("es-AR", {
			style: "currency",
			currency: currencyCode,
			maximumFractionDigits: 0,
		}).format(amount);
	} catch {
		return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount)}`;
	}
}

async function getResponseErrorMessage(response: Response, fallback: string) {
	const payload = await response.json().catch(() => null);
	return typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
		? payload.error
		: fallback;
}

function getPolicySortValue(policy: Policy, sortKey: PolicySortKey) {
	if (sortKey === "policy") return policy.policy_number;
	if (sortKey === "endDate") return policy.end_date ?? "";
	if (sortKey === "rule") return `${policy.cancellation_rule_type}:${policy.cancellation_rule_offset}`;
	if (sortKey === "calculatedDate") return policy.calculated_cancellation_date ?? "";
	return policyStatus(policy);
}

function getPolicyApiOrderBy(sortKey: PolicySortKey) {
	if (sortKey === "endDate") return "end_date";
	if (sortKey === "calculatedDate") return "calculated_cancellation_date";
	if (sortKey === "status") return "status";
	return "policy_number";
}

function getPolicySearchText(policy: Policy, status: PolicyStatus) {
	return normalizeSearchText([
		policy.policy_number,
		policy.section,
		policy.insured_object,
		formatDate(policy.end_date),
		ruleLabel(policy.cancellation_rule_type),
		formatDate(policy.calculated_cancellation_date),
		statusLabel(status),
	].join(" "));
}

function FieldBadge({ children, tone = "imported" }: { children: string; tone?: "imported" | "editable" | "system" }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
				tone === "imported" && "border-emerald-200 bg-emerald-50 text-emerald-700",
				tone === "editable" && "border-stone-200 bg-white text-stone-500",
				tone === "system" && "border-blue-200 bg-blue-50 text-blue-700",
			)}
		>
			{tone === "imported" ? <FileSpreadsheet className="size-3" /> : null}
			{tone === "editable" ? <Pencil className="size-3" /> : null}
			{children}
		</span>
	);
}

function DetailField({
	label,
	value,
	children,
	tone = "imported",
	onEdit,
	className,
}: {
	label: string;
	value?: ReactNode;
	children?: ReactNode;
	tone?: "imported" | "editable" | "system";
	onEdit?: () => void;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"min-h-[86px] rounded-xl border p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
				tone === "imported" && "border-stone-200 bg-white",
				tone === "editable" && "border-stone-200 bg-white",
				tone === "system" && "border-orange-200 bg-orange-50/45",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">{label}</p>
				{onEdit ? (
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-stone-500 transition hover:border-orange-200 hover:text-orange-700"
						onClick={onEdit}
					>
						<Pencil className="size-3" />
						Editar
					</button>
				) : (
					<FieldBadge tone={tone}>
						{tone === "imported" ? "Excel" : tone === "system" ? "Sistema" : "Editable"}
					</FieldBadge>
				)}
			</div>
			{children ?? <p className="mt-2.5 text-xl font-bold tracking-tight text-stone-900">{value ?? "-"}</p>}
		</div>
	);
}

function PeriodProgressField({ policy }: { policy: Policy }) {
	const period = getPeriodProgress(policy);
	const status = policyStatus(policy);
	const dueDays = daysUntil(policy.calculated_cancellation_date ?? policy.end_date);
	const progressColor = statusProgressClasses(status);
	const dueBadge =
		dueDays === null
			? null
			: dueDays < 0
				? `${Math.abs(dueDays)}d tarde`
				: `en ${dueDays} dias`;
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Seccion / periodo</p>
					<span className="text-stone-300">•</span>
					<p className="truncate text-xs font-black text-stone-800">{policy.section || "-"}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-400">
						<FileSpreadsheet className="size-3" />
						Excel
					</span>
					{dueBadge ? (
						<span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black transition-colors duration-500 ease-out", statusPillClasses(status))}>
							{dueBadge}
						</span>
					) : null}
				</div>
			</div>
			{period ? (
				<div className="space-y-2">
					<div className="relative h-5 overflow-hidden rounded-sm bg-stone-100 transition-colors duration-500 ease-out">
						<div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0,transparent_8px,rgba(120,113,108,0.14)_8px,rgba(120,113,108,0.14)_14px)]" />
						<div
							className={cn("relative h-full transition-[width,background-color] duration-500 ease-out", progressColor)}
							style={{ width: `${period.percent}%` }}
						/>
						<span
							className="absolute top-0 h-full w-0.5 bg-stone-900/75 transition-colors duration-500 ease-out"
							style={{ left: `calc(${period.percent}% - 1px)` }}
						/>
					</div>
					<div className="flex items-start justify-between gap-3 text-[10px] font-bold text-stone-500">
						<span>{formatDisplayDate(period.startDate.toISOString().slice(0, 10))}</span>
						<span className="text-center text-stone-500">
							Transcurrido <span className="text-stone-900">{period.percent}%</span> del periodo de cobertura
						</span>
						<span className="text-right">
							<span className="block">{formatDisplayDate(period.endDate.toISOString().slice(0, 10))}</span>
							<span className="mt-1 block text-stone-500">Baja calculada</span>
						</span>
					</div>
				</div>
			) : (
				<p className="text-xs font-semibold text-stone-500">Periodo importado sin rango parseable.</p>
			)}
		</div>
	);
}

function EmptyPolicyListState({ onImportHint }: { onImportHint: () => void }) {
	return (
		<div className="flex min-h-[260px] items-center justify-center px-6 py-12 text-center">
			<div className="max-w-[220px]">
				<div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-300 shadow-sm">
					<Inbox className="size-5" />
				</div>
				<h3 className="mt-4 text-sm font-semibold text-stone-800">No hay polizas cargadas</h3>
				<p className="mt-1.5 text-xs font-medium leading-relaxed text-stone-500">
					Agrega una poliza manualmente abajo, o importa un lote desde Excel.
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mx-auto mt-4 flex h-8 w-[158px] justify-center gap-2 rounded-lg border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
					onClick={onImportHint}
				>
					<FileSpreadsheet className="size-3.5 text-emerald-600" />
					Importar desde Excel
				</Button>
			</div>
		</div>
	);
}

function EmptyPolicyDetailState({ onImportHint }: { onImportHint: () => void }) {
	return (
		<div className="flex min-h-[560px] items-center justify-center px-8 py-16 text-center">
			<div className="max-w-[360px]">
				<div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-300 shadow-sm">
					<Shield className="size-7" />
					<span className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white shadow-sm">
						<Plus className="size-4" />
					</span>
				</div>
				<h2 className="mt-5 text-lg font-semibold tracking-tight text-stone-900">Ninguna poliza seleccionada</h2>
				<p className="mx-auto mt-2 max-w-[310px] text-sm font-medium leading-relaxed text-stone-500">
					Selecciona una poliza de la lista para ver su detalle, o carga la primera con el formulario de la izquierda.
				</p>
				<div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-[11px] font-medium text-stone-500">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1">
						<Plus className="size-3 rounded-full bg-stone-200 p-0.5 text-stone-500" />
						Selecciona de la lista
					</span>
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1 transition hover:bg-stone-100"
						onClick={onImportHint}
					>
						<FileSpreadsheet className="size-3 text-emerald-600" />
						Importa desde Excel
					</button>
				</div>
			</div>
		</div>
	);
}

function LoadingPolicyListState() {
	return (
		<div className="space-y-1 p-2" aria-label="Cargando polizas">
			{Array.from({ length: 5 }).map((_, index) => (
				<div key={index} className="flex min-h-[72px] items-center gap-3 rounded-lg bg-white px-3 py-3">
					<Skeleton className="size-8 shrink-0 rounded-full" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-20" />
					</div>
					<div className="space-y-2">
						<Skeleton className="ml-auto h-3 w-16" />
						<Skeleton className="ml-auto h-3 w-10" />
					</div>
				</div>
			))}
		</div>
	);
}

function LoadingPolicyDetailState() {
	return (
		<div className="min-h-[560px]" aria-label="Cargando detalle de poliza">
			<div className="flex items-start justify-between gap-6 border-b border-stone-200 bg-gradient-to-b from-stone-50 to-white px-6 py-5">
				<div className="flex min-w-0 flex-1 items-start gap-4">
					<Skeleton className="size-11 shrink-0 rounded-xl" />
					<div className="min-w-0 flex-1 space-y-3">
						<div className="flex gap-2">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-12" />
						</div>
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-3 w-56" />
						<Skeleton className="h-10 max-w-4xl" />
					</div>
				</div>
				<div className="flex shrink-0 gap-2">
					<Skeleton className="h-10 w-20 rounded-lg" />
					<Skeleton className="h-10 w-28 rounded-lg" />
				</div>
			</div>
			<div className="space-y-4 px-5 py-5">
				<Skeleton className="h-[116px] rounded-xl" />
				<div className="grid gap-4 md:grid-cols-2">
					{Array.from({ length: 6 }).map((_, index) => (
						<div key={index} className="min-h-[104px] rounded-xl border border-stone-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
							<Skeleton className="h-3 w-32" />
							<Skeleton className="mt-5 h-6 w-40" />
							<Skeleton className="mt-2 h-3 w-56" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function InsurancePoliciesTab({ obraId }: { obraId: string }) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState(EMPTY_POLICY_FORM);
	const [isSaving, setIsSaving] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const deferredSearchTerm = useDeferredValue(searchTerm);
	const [statusFilter, setStatusFilter] = useState<PolicyStatusFilter>("all");
	const sortKey: PolicySortKey = "policy";
	const sortDirection: "asc" | "desc" = "asc";
	const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
	const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyDraft>>({});
	const [savingPolicyId, setSavingPolicyId] = useState<string | null>(null);
	const [editingSection, setEditingSection] = useState<EditingSection>(null);
	const [movePolicy, setMovePolicy] = useState<Policy | null>(null);
	const [moveTargetObraId, setMoveTargetObraId] = useState("");
	const [movingPolicyId, setMovingPolicyId] = useState<string | null>(null);
	const policiesQueryKey = ["obra", obraId, "insurance-policies", deferredSearchTerm, statusFilter, sortKey, sortDirection] as const;

	const policiesQuery = useQuery({
		queryKey: policiesQueryKey,
		queryFn: async () => {
			const params = new URLSearchParams({
				limit: String(MAX_RENDERED_POLICY_LIST_ITEMS),
				q: deferredSearchTerm.trim(),
				status: statusFilter,
				orderBy: getPolicyApiOrderBy(sortKey),
				orderDir: sortDirection,
			});
			const response = await fetch(`/api/obras/${encodeURIComponent(obraId)}/insurance-policies?${params.toString()}`);
			if (!response.ok) throw new Error("No se pudieron cargar las polizas");
			return (await response.json()) as PolicyListPayload;
		},
		staleTime: POLICY_LIST_STALE_TIME_MS,
	});

	const obrasQuery = useQuery({
		queryKey: ["insurance-policies", "move-target-obras"],
		queryFn: async () => {
			const response = await fetch("/api/obras?orderBy=updated_at&orderDir=desc");
			if (!response.ok) return [] as ObraOption[];
			const payload = (await response.json()) as { detalleObras?: Array<Record<string, unknown>> };
			return (payload.detalleObras ?? []).map((obra) => ({
				id: String(obra.id ?? ""),
				n: (obra.n as number | string | null) ?? null,
				designacionYUbicacion: String(obra.designacionYUbicacion ?? "Sin designacion"),
				porcentaje: Number(obra.porcentaje ?? 0) || 0,
			})).filter((obra) => obra.id);
		},
		staleTime: POLICY_METADATA_STALE_TIME_MS,
	});

	const recipientsQuery = useQuery({
		queryKey: ["obra", obraId, "insurance-policy-recipients"],
		queryFn: async () => {
			const params = new URLSearchParams({ obraId });
			const response = await fetch(`/api/obra-recipients?${params.toString()}`);
			if (!response.ok) return { users: [] as TenantUser[] };
			return (await response.json()) as { users: TenantUser[] };
		},
		staleTime: POLICY_METADATA_STALE_TIME_MS,
	});

	const settingsQuery = useQuery({
		queryKey: ["insurance-policies", "settings"],
		queryFn: async () => {
			const response = await fetch("/api/insurance-policies/settings");
			if (!response.ok) return { responsibleUserIds: [] as string[] };
			return (await response.json()) as { responsibleUserIds: string[]; responsibleUserId?: string | null };
		},
		staleTime: POLICY_METADATA_STALE_TIME_MS,
	});

	const policies = useMemo(() => policiesQuery.data?.policies ?? [], [policiesQuery.data?.policies]);
	const policiesTotal = policiesQuery.data?.pagination?.total ?? policies.length;
	const users = recipientsQuery.data?.users ?? [];
	const obras = obrasQuery.data ?? [];
	const responsibleUserIds = settingsQuery.data?.responsibleUserIds ?? [];
	const isInitialPoliciesLoading = policiesQuery.isLoading && !policiesQuery.data;

	const policyItems = useMemo(() => {
		return policies.map((policy) => {
			const status = policyStatus(policy);
			const dueDate = listDueDate(policy, status);
			return {
				policy,
				status,
				dueDate,
				dueDays: daysUntil(dueDate),
				searchText: getPolicySearchText(policy, status),
			};
		});
	}, [policies]);

	const counts = useMemo(() => {
		const result: Record<PolicyStatusFilter, number> = { all: policyItems.length, active: 0, dueSoon: 0, expired: 0, cancelled: 0 };
		for (const item of policyItems) result[item.status] += 1;
		return result;
	}, [policyItems]);

	const visiblePolicyItems = useMemo(() => {
		const query = normalizeSearchText(deferredSearchTerm);
		const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
		return policyItems
			.filter((item) => {
				if (statusFilter !== "all" && item.status !== statusFilter) return false;
				return !query || item.searchText.includes(query);
			})
			.map((item) => ({ item, sortValue: normalizeSearchText(getPolicySortValue(item.policy, sortKey)) }))
			.toSorted((left, right) => {
				const result = collator.compare(left.sortValue, right.sortValue);
				return sortDirection === "asc" ? result : -result;
			})
			.map(({ item }) => item);
	}, [deferredSearchTerm, policyItems, sortDirection, sortKey, statusFilter]);

	const visiblePolicies = useMemo(() => visiblePolicyItems.map((item) => item.policy), [visiblePolicyItems]);

	const selectedPolicy =
		visiblePolicies.find((policy) => policy.id === selectedPolicyId) ??
		visiblePolicies[0] ??
		null;
	const selectedPolicyItem = selectedPolicy ? visiblePolicyItems.find((item) => item.policy.id === selectedPolicy.id) ?? null : null;
	const selectedStatus = selectedPolicyItem?.status ?? "active";
	const selectedDraft = selectedPolicy ? getPolicyDraft(selectedPolicy, policyDrafts) : null;
	const selectedDirty = selectedPolicy && selectedDraft ? isPolicyDraftDirty(selectedPolicy, selectedDraft) : false;
	const renderedPolicyItems = visiblePolicyItems.slice(0, MAX_RENDERED_POLICY_LIST_ITEMS);

	async function refreshPolicies() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["obra", obraId, "insurance-policies"] }),
			queryClient.invalidateQueries({ queryKey: ["insurance-policies", "macro"] }),
			queryClient.invalidateQueries({ queryKey: ["insurance-policies", "global"] }),
		]);
	}

	async function createPolicy() {
		setIsSaving(true);
		try {
			const response = await fetch(`/api/obras/${obraId}/insurance-policies`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					policyNumber: form.policyNumber,
					endDate: form.endDate || null,
				}),
			});
			if (!response.ok) throw new Error(await getResponseErrorMessage(response, "No se pudo crear la poliza"));
			setForm(EMPTY_POLICY_FORM);
			await refreshPolicies();
			toast.success("Poliza creada");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No se pudo crear la poliza");
		} finally {
			setIsSaving(false);
		}
	}

	function updatePolicyDraft(policy: Policy, patch: Partial<PolicyDraft>) {
		setPolicyDrafts((current) => ({
			...current,
			[policy.id]: {
				...getPolicyDraft(policy, current),
				...patch,
			},
		}));
	}

	async function savePolicyDraft(policy: Policy) {
		const draft = getPolicyDraft(policy, policyDrafts);
		const payload: {
			endDate: string | null;
			balance: string | null;
			status: string | null;
			definitiveReceptionDate: string | null;
			cancellationRuleType?: RuleType;
			cancellationRuleOffset?: number;
		} = {
			endDate: draft.endDate || null,
			balance: draft.balance.trim() || null,
			status: draft.status.trim() || null,
			definitiveReceptionDate: draft.definitiveReceptionDate || null,
		};
		if (draft.cancellationRuleConfigured || policy.cancellation_rule_configured === true) {
			payload.cancellationRuleType = draft.cancellationRuleType;
			payload.cancellationRuleOffset = Number(draft.cancellationRuleOffset || 0);
		}
		setSavingPolicyId(policy.id);
		try {
			const response = await fetch(`/api/insurance-policies/${policy.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!response.ok) throw new Error(await getResponseErrorMessage(response, "No se pudo actualizar la poliza"));
			setPolicyDrafts((current) => {
				const next = { ...current };
				delete next[policy.id];
				return next;
			});
			setEditingSection(null);
			await refreshPolicies();
			toast.success("Poliza actualizada");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No se pudo actualizar la poliza");
		} finally {
			setSavingPolicyId(null);
		}
	}

	async function toggleCancelled(policy: Policy, checked: boolean) {
		const previous = queryClient.getQueryData<PolicyListPayload>(policiesQueryKey);
		queryClient.setQueryData<PolicyListPayload>(policiesQueryKey, (current) =>
			current
				? {
					...current,
					policies: current.policies.map((item) =>
						item.id === policy.id ? { ...item, is_cancelled: checked } : item,
					),
				}
				: current,
		);
		try {
			const response = await fetch(`/api/insurance-policies/${policy.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ isCancelled: checked }),
			});
			if (!response.ok) {
				throw new Error(await getResponseErrorMessage(response, "No se pudo actualizar la poliza"));
			}
			await refreshPolicies();
			toast.success(checked ? "Poliza marcada como dada de baja" : "Baja revertida");
		} catch (error) {
			if (previous) queryClient.setQueryData(policiesQueryKey, previous);
			toast.error(error instanceof Error ? error.message : "No se pudo actualizar la poliza");
		}
	}

	function openMovePolicyDialog(policy: Policy) {
		const fallbackTarget = obras.find((obra) => obra.id !== (policy.obra_id ?? obraId))?.id ?? "";
		setMovePolicy(policy);
		setMoveTargetObraId(fallbackTarget);
	}

	async function moveSelectedPolicy() {
		if (!movePolicy || !moveTargetObraId) return;
		setMovingPolicyId(movePolicy.id);
		try {
			const response = await fetch(`/api/insurance-policies/${movePolicy.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ obraId: moveTargetObraId }),
			});
			if (!response.ok) throw new Error(await getResponseErrorMessage(response, "No se pudo mover la poliza"));
			setSelectedPolicyId(null);
			setMovePolicy(null);
			setMoveTargetObraId("");
			await refreshPolicies();
			toast.success("Poliza movida a otra obra");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No se pudo mover la poliza");
		} finally {
			setMovingPolicyId(null);
		}
	}

	async function updateResponsibles(nextUserIds: string[]) {
		const response = await fetch("/api/insurance-policies/settings", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ responsibleUserIds: nextUserIds }),
		});
		if (!response.ok) {
			toast.error(await getResponseErrorMessage(response, "No se pudieron guardar los responsables"));
			return;
		}
		await queryClient.invalidateQueries({ queryKey: ["insurance-policies", "settings"] });
		toast.success("Responsables actualizados");
	}

	function toggleResponsible(userId: string) {
		const next = responsibleUserIds.includes(userId)
			? responsibleUserIds.filter((id) => id !== userId)
			: [...responsibleUserIds, userId];
		void updateResponsibles(next);
	}

	function showImportHint() {
		toast.info("La importacion de polizas desde Excel esta disponible en la vista de Macrotablas.");
	}

	return (
		<div className="grid min-h-[560px] overflow-hidden gap-2 lg:grid-cols-[minmax(340px,31%)_minmax(0,1fr)]">
			<aside className="">
				<div className="space-y-3 p-3">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
						<Input
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Buscar poliza"
							className="h-10 rounded-lg border-stone-200 bg-white pl-9 text-sm shadow-sm"
						/>
					</div>
					<div className="flex flex-wrap gap-1">
						{FILTERS.map((filter) => (
							<Button
								key={filter.value}
								type="button"
								size="sm"
								variant={statusFilter === filter.value ? "default" : "ghost"}
								className={cn(
									"h-7 rounded-lg px-2.5 text-[11px] font-bold",
									statusFilter === filter.value
										? "bg-stone-900 text-white hover:bg-stone-800"
										: "text-stone-600 hover:bg-white",
								)}
								onClick={() => setStatusFilter(filter.value)}
							>
								{filter.label}
								<span
									className={cn(
										"ml-1.5 rounded-full px-1.5 text-[10px] font-bold",
										statusFilter === filter.value ? "bg-white/15 text-white" : "bg-stone-100 text-stone-500",
									)}
								>
									{counts[filter.value]}
								</span>
							</Button>
						))}
					</div>
				</div>

				<div className="max-h-[420px] overflow-y-auto bg-stone-50 lg:max-h-[calc(85vh-360px)] shadow-card m-4">
					{isInitialPoliciesLoading ? (
						<LoadingPolicyListState />
					) : (
						<>
							{renderedPolicyItems.map((item) => {
								const { policy, status, dueDate, dueDays: days } = item;
								const active = selectedPolicy?.id === policy.id;
								return (
									<button
										key={policy.id}
										type="button"
										className={cn(
											"relative flex min-h-[72px] w-full items-center gap-3 px-5 py-3 text-left transition-all duration-300 ease-out hover:bg-stone-100 hover:outline",
											active && selectedPolicyRowClasses(status),
										)}
										onClick={() => setSelectedPolicyId(policy.id)}
									>
										<span
											className={cn(
												"flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ease-out",
												statusClasses(status),
												active && statusRingClasses(status),
											)}
											title={listStatusDescription(status)}
										>
											<StatusIcon status={status} className={status === "expired" ? "size-3.5" : "size-3"} />
										</span>
										<span className="min-w-0 flex-1">
											<span className="flex min-w-0 items-center gap-1.5">
												<span className="truncate text-[15px] font-bold text-stone-900">{policy.policy_number}</span>
												{policy.section ? (
													<span className="shrink-0 rounded-md border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-600">
														{policy.section}
													</span>
												) : null}
												{status !== "active" ? (
													<span
														className={cn(
															"shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase transition-colors duration-300 ease-out",
															statusPillClasses(status),
														)}
													>
														{listStatusLabel(policy, status)}
													</span>
												) : null}
											</span>
										</span>
										<span className="text-right">
											<span className="block text-[11px] font-semibold text-stone-500">{formatDisplayDate(dueDate)}</span>
											{days !== null ? (
												<span
													className={cn(
														"block text-[10px] font-bold transition-colors duration-300 ease-out",
														statusAccentClasses(status),
													)}
												>
													{days < 0 ? `${Math.abs(days)}d tarde` : `${days}d`}
												</span>
											) : null}
										</span>
									</button>
								);
							})}
							{policiesTotal > renderedPolicyItems.length ? (
								<div className="px-4 py-3 text-center text-xs text-stone-500">
									Mostrando {renderedPolicyItems.length} de {policiesTotal}. Usa busqueda o filtros para acotar.
								</div>
							) : null}
							{visiblePolicyItems.length === 0 ? (
								policies.length === 0 ? (
									<EmptyPolicyListState onImportHint={showImportHint} />
								) : (
									<div className="px-4 py-12 text-center text-sm font-medium text-stone-500">No hay resultados.</div>
								)
							) : null}
						</>
					)}
				</div>

				<div className="m-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
					<p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
						Agregar poliza <span className="normal-case tracking-normal text-stone-400">- carga manual</span>
					</p>
					<div className="grid gap-2">
						<Input
							value={form.policyNumber}
							onChange={(event) => setForm((current) => ({ ...current, policyNumber: event.target.value }))}
							placeholder="Numero de poliza"
							className="h-9"
						/>
						<div className="grid grid-cols-[1fr_96px] gap-2">
							<Input
								type="date"
								value={form.endDate}
								onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
								className="h-9"
							/>
							<div className="flex items-center justify-center rounded-md border border-stone-200 bg-stone-50 px-2 text-[10px] font-medium uppercase text-stone-500">
								Sin regla
							</div>
						</div>
						<Button className="h-9 gap-2 bg-orange-500 text-white hover:bg-orange-600" onClick={() => void createPolicy()} disabled={isSaving || !form.policyNumber.trim()}>
							<Plus className="size-4" />
							Agregar poliza
						</Button>
					</div>
				</div>
			</aside>

			<section className="min-w-0 overflow-hidden rounded-xl bg-white shadow-card m-0.5">
				{isInitialPoliciesLoading ? (
					<LoadingPolicyDetailState />
				) : selectedPolicy && selectedDraft ? (
					<>
						<div className={cn(
							"flex items-start justify-between gap-6 border-b border-stone-200 bg-gradient-to-b px-6 py-5 transition-[background-color,border-color,box-shadow] duration-500 ease-out",
							statusHeaderGradient(selectedStatus),
							selectedStatus === "cancelled" && "shadow-[inset_0_1px_0_rgba(14,165,233,0.18)]",
						)}>
							<div className="flex min-w-0 flex-1 items-start gap-4">
								<div className={cn(
									"relative flex size-11 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-500 ease-out",
									statusClasses(selectedStatus),
								)}>
									<StatusIcon status={selectedStatus} className={selectedStatus === "expired" ? "size-5" : "size-[18px]"} />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
										<span className="text-blue-700">{selectedPolicy.section || "Poliza"}</span>
										<span className="text-stone-300">•</span>
										<span className="text-stone-500">Poliza</span>
										<span className="inline-flex items-center gap-1 text-stone-400">
											<FileSpreadsheet className="size-3" />
											Excel
										</span>
									</div>
									<h2 className="mt-1 truncate text-2xl font-black tracking-tight text-stone-900">
										N {selectedPolicy.policy_number}
									</h2>
									<div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold">
										<span className={cn(
											"inline-flex items-center gap-1.5 transition-colors duration-500 ease-out",
											statusAccentClasses(selectedStatus),
										)}>
											<span className="size-1.5 rounded-full bg-current" />
											{statusLabel(selectedStatus)}
										</span>
										<span className="text-stone-400">
											{selectedStatus === "active"
												? "Finalizacion activa"
												: listStatusDescription(selectedStatus)}
										</span>
									</div>
									<p className="mt-4 max-w-4xl text-[11px] font-semibold uppercase leading-relaxed text-stone-500">
										{selectedPolicy.insured_object ?? selectedPolicy.risk ?? "Sin objeto asegurado"}
									</p>
								</div>
							</div>
							<div className="flex shrink-0 flex-wrap items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-10 gap-2 rounded-lg bg-white"
									onClick={() => openMovePolicyDialog(selectedPolicy)}
								>
									<ArrowRight className="size-4" />
									Mover
								</Button>
								<label
									className={cn(
										"flex h-10 items-center gap-2 rounded-lg border px-3 py-2 shadow-sm transition-all duration-300 ease-out",
										selectedPolicy.is_cancelled
											? "border-sky-200 bg-sky-50 text-sky-900 shadow-sky-100/60"
											: "border-stone-200 bg-white text-stone-700 hover:border-stone-300",
									)}
								>
									<Checkbox
										className="transition-all duration-300 ease-out data-[state=checked]:border-sky-600 data-[state=checked]:bg-sky-600"
										checked={selectedPolicy.is_cancelled}
										onCheckedChange={(checked) => void toggleCancelled(selectedPolicy, checked === true)}
									/>
									<span className="text-xs font-bold">Dar de baja</span>
								</label>
							</div>
						</div>
						<div className="space-y-4 px-5 py-5">
							<div className="rounded-xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
								<PeriodProgressField policy={selectedPolicy} />
							</div>
							<div className="grid gap-4 md:grid-cols-2">
								<DetailField label="Monto asegurado" value={formatMoney(selectedPolicy.insured_amount, selectedPolicy.currency)} />
								<DetailField label="Fecha de finalizacion">
									<div className="mt-2 space-y-0.5">
										<p className="text-xl font-black tracking-tight text-stone-900">
											{formatDisplayDate(selectedDraft.endDate)}
										</p>
										<p className="text-xs font-semibold text-stone-500">
											Fecha importada de la poliza; no define la baja automatica.
										</p>
									</div>
								</DetailField>
								<DetailField
									label="Responsables"
									tone="editable"
									onEdit={responsibleUserIds.length > 0 ? () => setEditingSection("responsibles") : undefined}
								>
									{responsibleUserIds.length === 0 && editingSection !== "responsibles" ? (
										<button
											type="button"
											className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-dashed border-blue-300 bg-blue-50/35 px-3 text-xs font-bold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50"
											onClick={() => setEditingSection("responsibles")}
										>
											<Plus className="size-3.5" />
											Asignar responsable
										</button>
									) : (
										<div className="mt-3 flex flex-wrap gap-1.5">
											{users
												.filter((user) => editingSection === "responsibles" || responsibleUserIds.includes(user.id))
												.map((user) => {
													const active = responsibleUserIds.includes(user.id);
													return (
														<button
															key={user.id}
															type="button"
															disabled={editingSection !== "responsibles"}
															className={cn(
																"rounded-full border px-2.5 py-1 text-xs font-medium disabled:cursor-default",
																active
																	? "border-orange-200 bg-orange-50 text-orange-700"
																	: "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
																editingSection !== "responsibles" && !active && "hidden",
															)}
															onClick={() => toggleResponsible(user.id)}
														>
															{user.full_name || user.email || user.id}
														</button>
													);
												})}
											{users.length === 0 ? (
												<span className="text-xs font-semibold text-stone-500">Sin usuarios disponibles</span>
											) : null}
										</div>
									)}
								</DetailField>
								<DetailField label="Fecha calculada baja" tone="system">
									<div className="mt-2 space-y-2.5">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<p className="text-xl font-black tracking-tight text-stone-900">
												{formatDisplayDate(
													selectedDraft.cancellationRuleConfigured
														? calculateDraftCancellationDate(selectedPolicy, selectedDraft)
														: selectedPolicy.calculated_cancellation_date,
												)}
											</p>
											<Button
												type="button"
												size="sm"
												className="h-8 gap-1.5 bg-orange-600 px-3 text-xs font-bold text-white hover:bg-orange-700"
												onClick={() => {
													setEditingSection("calculatedDate");
													updatePolicyDraft(selectedPolicy, { cancellationRuleConfigured: true });
												}}
											>
												<FileSpreadsheet className="size-3.5" />
												Calcular
											</Button>
										</div>
										{selectedDraft.cancellationRuleConfigured ? (
											<div className="grid gap-2 rounded-lg border border-dashed border-orange-200 bg-white/70 px-3 py-2 text-xs font-semibold text-stone-600 sm:grid-cols-3">
												<div>
													<span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400">Base usada</span>
													<span className="text-stone-800">
														{selectedDraft.definitiveReceptionDate ? "Recepcion definitiva" : "Finalizacion provisoria"}
													</span>
												</div>
												<div>
													<span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400">Regla aplicada</span>
													<span className="text-stone-800">{ruleLabel(selectedDraft.cancellationRuleType)}</span>
												</div>
												<div>
													<span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400">Resultado</span>
													<span className="text-stone-800">{ruleFormula(selectedPolicy, selectedDraft)}</span>
												</div>
												<div>
													<span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400">Finalizacion provisoria</span>
													<span className="text-stone-800">{formatDisplayDate(selectedPolicy.obra_finished_at)}</span>
												</div>
												<div>
													<span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400">Recepcion definitiva</span>
													<span className={selectedDraft.definitiveReceptionDate ? "text-stone-800" : "text-orange-600"}>
														{formatDisplayDate(selectedDraft.definitiveReceptionDate)}
													</span>
												</div>
												<p className="text-[11px] font-medium text-stone-500 sm:col-span-3">
													{ruleDescription(selectedPolicy, selectedDraft)}. Es una aproximacion si todavia no esta cargada la recepcion definitiva.
												</p>
											</div>
										) : (
											<p className="inline-flex items-center gap-1 text-xs font-bold text-orange-600">
												<TriangleAlert className="size-3.5" />
												Sin regla definida
											</p>
										)}
										{editingSection === "calculatedDate" ? (
											<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
												<Select
													value={selectedDraft.cancellationRuleType}
													onValueChange={(value) => updatePolicyDraft(selectedPolicy, { cancellationRuleType: value as RuleType, cancellationRuleConfigured: true })}
												>
													<SelectTrigger className="h-9 rounded-lg border-orange-300 bg-white focus:ring-orange-200">
														<SelectValue />
													</SelectTrigger>
													<SelectContent className="rounded-xl">
														<SelectItem value="on_finish">Al finalizar obra</SelectItem>
														<SelectItem value="days_after">N dias despues</SelectItem>
														<SelectItem value="months_after">N meses despues</SelectItem>
													</SelectContent>
												</Select>
												<Input
													type="number"
													min={0}
													value={selectedDraft.cancellationRuleOffset}
													disabled={selectedDraft.cancellationRuleType === "on_finish"}
													className="h-9 bg-white"
													onChange={(event) => updatePolicyDraft(selectedPolicy, { cancellationRuleOffset: event.target.value, cancellationRuleConfigured: true })}
												/>
												<div className="sm:col-span-2">
													<label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
														Recepcion definitiva
													</label>
													<Input
														type="date"
														value={selectedDraft.definitiveReceptionDate}
														className="h-9 border-orange-200 bg-white focus-visible:ring-orange-200"
														onChange={(event) => updatePolicyDraft(selectedPolicy, { definitiveReceptionDate: event.target.value, cancellationRuleConfigured: true })}
													/>
													<p className="mt-1 text-[11px] font-medium text-stone-500">
														Si esta vacia, el calculo usa la fecha provisoria en que se marco la obra terminada.
													</p>
												</div>
											</div>
										) : null}
									</div>
								</DetailField>
								<DetailField label="Premio / prima">
									<div className="mt-2 space-y-0.5">
										<p className="text-xl font-black tracking-tight text-stone-900">
											{formatMoney(selectedPolicy.prize, selectedPolicy.currency)}
											<span className="mx-2 text-stone-300">/</span>
											<span className="text-stone-500">{formatMoney(selectedPolicy.premium, selectedPolicy.currency)}</span>
										</p>
										<p className="text-xs font-semibold text-stone-500">Premio total / prima neta</p>
									</div>
								</DetailField>
								<DetailField label="Saldo / estado importado" tone="editable" onEdit={() => setEditingSection("balanceStatus")}>
									{editingSection === "balanceStatus" ? (
										<div className="mt-2 grid gap-2 sm:grid-cols-2">
											<Input
												value={selectedDraft.balance}
												placeholder="Saldo"
												className="h-9 border-orange-200 bg-white focus-visible:ring-orange-200"
												onChange={(event) => updatePolicyDraft(selectedPolicy, { balance: event.target.value })}
											/>
											<Input
												value={selectedDraft.status}
												placeholder="Estado importado"
												className="h-9 border-orange-200 bg-white focus-visible:ring-orange-200"
												onChange={(event) => updatePolicyDraft(selectedPolicy, { status: event.target.value })}
											/>
										</div>
									) : (
										<p className="mt-2 flex flex-wrap items-center gap-3 text-xl font-black tracking-tight text-stone-900">
											{formatMoney(selectedDraft.balance, selectedPolicy.currency)}
											{selectedDraft.status ? (
												<Badge variant="secondary" className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", statusClasses(selectedPolicyItem?.status ?? "active"))}>
													{selectedDraft.status}
												</Badge>
											) : null}
										</p>
									)}
								</DetailField>
							</div>

							<div className="flex items-center gap-3">
								{selectedDirty ? (
									<Button
										size="sm"
										className="gap-2 bg-orange-600 text-white hover:bg-orange-700"
										disabled={savingPolicyId === selectedPolicy.id}
										onClick={() => void savePolicyDraft(selectedPolicy)}
									>
										<Save className="size-4" />
										Guardar cambios
									</Button>
								) : null}
								{selectedDirty ? (
									<Button
										variant="outline"
										size="sm"
										className="gap-2"
										onClick={() => {
											setPolicyDrafts((current) => {
												const next = { ...current };
												delete next[selectedPolicy.id];
												return next;
											});
											setEditingSection(null);
										}}
									>
										<RotateCcw className="size-4" />
										Revertir cambios
									</Button>
								) : null}
								{editingSection && !selectedDirty ? (
									<Button
										variant="outline"
										size="sm"
										className="ml-auto"
										onClick={() => {
											setEditingSection(null);
										}}
									>
										Cerrar edicion
									</Button>
								) : null}
							</div>
						</div>
					</>
				) : (
					<EmptyPolicyDetailState onImportHint={showImportHint} />
				)}
			</section>

			<Dialog open={Boolean(movePolicy)} onOpenChange={(open) => {
				if (movingPolicyId) return;
				if (!open) {
					setMovePolicy(null);
					setMoveTargetObraId("");
				}
			}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Mover poliza a otra obra</DialogTitle>
						<DialogDescription>
							Selecciona la obra destino para reasignar la poliza. La poliza saldra de esta pestana despues de moverla.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
							<p className="text-sm font-bold text-stone-900">{movePolicy?.policy_number ?? "Poliza"}</p>
							<p className="mt-0.5 text-xs font-medium text-stone-500">
								Obra actual: {obraId}
							</p>
						</div>
						<label className="block space-y-1.5">
							<span className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Obra destino</span>
							<ObraDestinationCombobox
								obras={obras}
								value={moveTargetObraId}
								onChange={setMoveTargetObraId}
								excludedObraId={movePolicy?.obra_id ?? obraId}
								disabled={obrasQuery.isLoading}
							/>
						</label>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="secondary"
							disabled={Boolean(movingPolicyId)}
							onClick={() => {
								setMovePolicy(null);
								setMoveTargetObraId("");
							}}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							className="gap-2"
							disabled={!moveTargetObraId || Boolean(movingPolicyId)}
							onClick={() => void moveSelectedPolicy()}
						>
							{movingPolicyId ? <Clock3 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
							Mover
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
