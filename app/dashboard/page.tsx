'use client';

import { type ChangeEvent, type ReactNode, useCallback, useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  File,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Activity,
  AlertTriangle,
  Check,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Trash2,
  Upload
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AdvanceCurveChart } from "@/components/advance-curve-chart";
import { FormTable } from "@/components/form-table/form-table";
import type { ColumnDef, FetchRowsArgs, FormTableConfig, FormTableCsvExport, FormTableRow } from "@/components/form-table/types";
import { QuickFormDialog, type QuickFormField } from "@/components/forms/quick-form-dialog";
import { DemoPageTour } from "@/components/demo-tours/demo-page-tour";
import { ObraDestinationCombobox } from "@/components/obra-destination-combobox";
import { toast } from "sonner";
import {
  dashboardOverviewTour,
  demoConclusionTour,
  presentacionCierreTour,
  presentacionDashboardTour,
} from "@/lib/demo-tours/screen-tour-flows";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";
import { cn } from "@/lib/utils";

type Obra = {
  id: string;
  n: number;
  designacionYUbicacion: string;
  porcentaje: number;
  contratoMasAmpliaciones: number;
  certificadoALaFecha: number;
  saldoACertificar: number;
  entidadContratante: string;
  plazoTotal: number;
  plazoTransc: number;
  segunContrato: number;
  prorrogasAcordadas: number;
  updatedAt?: string | null;
};

const EMPTY_OBRAS: Obra[] = [];

type DashboardStats = {
  total: number;
  inProgress: number;
  completed: number;
  avgProgress: number;
  totalContractValue: number;
  totalCertifiedValue: number;
  totalPendingValue: number;
  obrasAtRisk: number;
  obrasOnTrack: number;
  avgTimeProgress: number;
  totalSurface: number;
};

type DashboardObraTablaColumn = {
  fieldKey?: string | null;
};

type DashboardObraTabla = {
  id: string;
  name: string;
  columns?: DashboardObraTablaColumn[] | null;
};

type DashboardTablaRow = {
  id: string;
  data?: Record<string, unknown> | null;
};

type DashboardCurvePoint = {
  key: string;
  label: string;
  obra?: string;
  planPct: number | null;
  realPct: number | null;
  sortOrder: number;
};

type DashboardCurveRuleConfig = {
  mappings?: {
    curve?: {
      plan?: {
        startPeriod?: string;
      };
    };
  };
};

type CompanyFile = {
  name: string;
  path: string;
  size: number;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type InsurancePolicyPreviewRow = {
  rowNumber: number;
  importAction?: "create" | "update";
  obraId: string | null;
  obraLabel: string | null;
  policyNumber: string | null;
  section: string | null;
  coveragePeriod: string | null;
  endDate: string | null;
  errors: string[];
};

type GlobalInsurancePolicy = {
  id: string;
  obra_id?: string | null;
  import_obra_label?: string | null;
  import_match_status?: string | null;
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
  risk?: string | null;
  insured_object?: string | null;
  cancellation_rule_configured?: boolean | null;
  definitive_reception_date?: string | null;
  calculated_cancellation_date: string | null;
  cancellation_requested_at?: string | null;
  cancellation_confirmed_at?: string | null;
  cancellation_notes?: string | null;
  is_cancelled: boolean;
  obras?: {
    n?: number | string | null;
    designacion_y_ubicacion?: string | null;
    porcentaje?: number | string | null;
  } | Array<{
    n?: number | string | null;
    designacion_y_ubicacion?: string | null;
    porcentaje?: number | string | null;
  }>;
};

type InsurancePolicyStatusFilter = "all" | "active" | "dueSoon" | "expired" | "cancelled";
type InsurancePolicyGroupBy = "none" | "obra" | "endDate" | "calculatedDate";
type InsurancePolicyQuickFilter = "none" | "observedBalance" | "cancelledWithBalance" | "recurringRisk" | "dueSoonRisk" | "withoutEndDate" | "credits";
type InsurancePolicySummary = {
  totalPolicies: number;
  activePolicies: number;
  currentExpense: number;
  finishedWithoutCancellation: number;
  finishedWithoutCancellationExpense: number;
  observedActiveAmount?: number;
  observedBalance?: number;
  activeExpiredAmount?: number;
  cancelledWithBalance?: number;
  cancelledWithBalanceAmount?: number;
  activeWithoutEndDate?: number;
  creditSignal?: number;
  creditSignalAmount?: number;
  preventiveCancellationAlerts?: number;
  preventiveCancellationAlertAmount?: number;
  potentialOverbillingPolicies?: number;
  potentialOverbillingAmount?: number;
};

type InsurancePolicyFilters = {
  policies: string;
  obra: string;
  section: string;
  endDateFrom: string;
  endDateTo: string;
  minInsuredAmount: string;
  minPremium: string;
};

type InsurancePolicyTableRow = FormTableRow & {
  policyNumber: string;
  obraId: string | null;
  obra: string;
  obraProgress: number | null;
  section: string;
  coveragePeriod: string;
  endDate: string | null;
  insuredAmount: number | string | null;
  currency: string;
  premium: number | string | null;
  prize: number | string | null;
  balance: number | string | null;
  status: string;
  operationalStatus: string;
  risk: string;
  insuredObject: string;
  calculatedCancellationDate: string | null;
  cancellationRequestedAt: string | null;
  cancellationConfirmedAt: string | null;
  cancellationNotes: string;
  isCancelled: boolean;
  moveAction: string;
  deleteAction: string;
};

type InsurancePolicyGroupRow = FormTableRow & {
  groupLabel: string;
  searchText: string;
  groupObraId: string | null;
  groupObraProgress: number | null;
  policyCount: number;
  activeCount: number;
  cancelledCount: number;
  totalInsuredAmount: number;
  currentPremium: number;
  policyRows: InsurancePolicyTableRow[];
};

const EMPTY_POLICY_ROWS: InsurancePolicyTableRow[] = [];

function getPolicyOperationalStatus(row: Pick<InsurancePolicyTableRow, "isCancelled" | "endDate" | "balance" | "premium" | "prize" | "section" | "status" | "risk" | "insuredObject" | "coveragePeriod" | "cancellationRequestedAt" | "cancellationConfirmedAt">) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + 15);
  const warningIso = warningDate.toISOString().slice(0, 10);
  const balance = parsePolicyAmount(row.balance);
  const premium = parsePolicyAmount(row.premium);
  const prize = parsePolicyAmount(row.prize);
  const policyText = [row.section, row.status, row.risk, row.insuredObject, row.coveragePeriod].join(" ").toLowerCase();
  const isOfferMaintenance = policyText.includes("oferta");
  if (premium < 0 || prize < 0 || balance < 0) {
    return {
      label: "Credito / compensacion",
      tone: "blue" as const,
      description: "Tiene prima, premio o saldo negativo. Revisar como posible credito compensable.",
    };
  }
  if (row.isCancelled) {
    return {
      label: balance > 0 ? "Baja con saldo" : "Dada de baja",
      tone: "amber" as const,
      description: balance > 0
        ? "La baja no elimina deuda vieja; validar trimestre de anulacion o cuenta corriente."
        : "No deberia seguir aplicando, pero puede conservar historial.",
    };
  }
  if (row.cancellationConfirmedAt) {
    return {
      label: "Baja confirmada",
      tone: "green" as const,
      description: "La baja fue confirmada; revisar que no queden saldos nuevos.",
    };
  }
  if (row.cancellationRequestedAt) {
    return {
      label: "Baja solicitada",
      tone: "blue" as const,
      description: "Ya se pidio la baja; falta confirmacion o cierre del productor.",
    };
  }
  if (!row.endDate) {
    return {
      label: "Sin fecha de fin",
      tone: "blue" as const,
      description: "No se puede saber si vencio; completar fecha o validar vigencia.",
    };
  }
  if (row.endDate < todayIso) {
    if (!isOfferMaintenance) {
      return {
        label: "Riesgo recurrente",
        tone: "red" as const,
        description: "Ya vencio y sigue activa. No parece de una sola vez; pedir baja formal para cortar facturacion.",
      };
    }
    return {
      label: "Vencida no recurrente",
      tone: "amber" as const,
      description: "Parece mantenimiento/oferta de una sola vez. Validar, pero no tratar como facturacion recurrente.",
    };
  }
  if (row.endDate <= warningIso && !isOfferMaintenance) {
    return {
      label: "Ojo: por vencer",
      tone: "amber" as const,
      description: "Si no corresponde mantenerla, hay que pedir baja antes de que pueda seguir facturando.",
    };
  }
  return {
    label: "Activa en cobertura",
    tone: "green" as const,
    description: "La cobertura importada todavia esta dentro de plazo.",
  };
}

const features = [
  {
    title: "Documentos centralizados",
    description: "Gestioná planos, contratos y certificados en un único espacio seguro.",
    icon: FolderKanban,
  },
  {
    title: "Seguimiento inteligente",
    description: "Visualizá métricas clave de cada obra para anticiparte a los desvíos.",
    icon: BarChart3,
  },
  {
    title: "Control y permisos",
    description: "Definí accesos según roles para mantener la información protegida.",
    icon: ShieldCheck,
  },
];

const DS = {
  page: "bg-stone-100",
  card: "rounded-xl border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]",
  cardHeader: "border-b border-stone-200/70 p-5",
  panel: "rounded-xl border border-stone-200 bg-stone-50/60",
  frame: "rounded-xl border border-stone-200/70 bg-stone-100/70 p-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]",
  frameInner: "rounded-xl border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]",
  divider: "h-px bg-stone-200/70",
  rowHover: "hover:bg-stone-50/60",
  iconBtn: "rounded-xl border border-stone-200 bg-white p-2 text-stone-700 hover:bg-stone-50",
  chip: "inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2",
  inputWrap: "flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2",
};

function Framed({ className, innerClassName, children }: {
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(DS.frame, className)}>
      <div className={cn(DS.frameInner, innerClassName)}>{children}</div>
    </div>
  );
}

type PieSlice = { name: string; value: number; fill: string };

function SimplePieChart({ data }: { data: PieSlice[] }) {
  const total = data.reduce((acc, entry) => acc + entry.value, 0);
  const segments = total
    ? data.reduce<{ stops: string[]; current: number }>(
      (acc, entry) => {
        const start = acc.current;
        const end = start + (entry.value / total) * 100;
        acc.stops.push(`${entry.fill} ${start}% ${end}%`);
        acc.current = end;
        return acc;
      },
      { stops: [], current: 0 }
    ).stops
    : ["#e5e7eb 0% 100%"];

  return (
    <div className="relative size-[120px] mx-auto">
      <div
        className="h-full w-full rounded-full"
        style={{ backgroundImage: `conic-gradient(${segments.join(", ")})` }}
      />
      <div className="absolute inset-0 m-auto size-[70px] rounded-full bg-card" />
    </div>
  );
}

function SimpleBarList({
  data,
  labelSuffix = "",
}: {
  data: { name: string; value: number; fill: string }[];
  labelSuffix?: string;
}) {
  const maxValue = Math.max(1, ...data.map((entry) => entry.value));
  return (
    <div className="space-y-2">
      {data.map((entry) => (
        <div key={entry.name} className="grid grid-cols-[72px_1fr_56px] items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/40 px-3 py-2">
          <span className="text-[11px] font-medium text-stone-600">{entry.name}</span>
          <div className="h-4 rounded-full bg-stone-200/70">
            <div
              className="h-4 rounded-full"
              style={{
                width: `${Math.min((entry.value / maxValue) * 100, 100)}%`,
                backgroundColor: entry.fill,
              }}
            />
          </div>
          <span className="text-[11px] text-stone-600 text-right tabular-nums">
            {entry.value}
            {labelSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}

function SimpleGroupedBars({
  data,
}: {
  data: { name: string; contrato: number; certificado: number }[];
}) {
  const maxValue = Math.max(
    1,
    ...data.flatMap((entry) => [entry.contrato, entry.certificado])
  );
  return (
    <div className="space-y-4">
      {data.map((entry) => (
        <div key={entry.name} className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/40 p-3">
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span className="max-w-[70%] truncate">{entry.name}</span>
            <span className="tabular-nums">
              {entry.contrato.toFixed(1)} / {entry.certificado.toFixed(1)}M
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-stone-200/70">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min((entry.contrato / maxValue) * 100, 100)}%` }}
              />
            </div>
            <div className="h-2 rounded-full bg-stone-200/70">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${Math.min((entry.certificado / maxValue) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getPolicyObra(policy: GlobalInsurancePolicy) {
  return Array.isArray(policy.obras) ? policy.obras[0] : policy.obras;
}

function getPolicyObraLabel(policy: GlobalInsurancePolicy) {
  const obra = getPolicyObra(policy);
  if (!obra) return policy.import_obra_label || "-";
  return `${obra.n ?? "-"} - ${obra.designacion_y_ubicacion ?? "Sin designacion"}`;
}

function getPolicyObraProgress(policy: GlobalInsurancePolicy) {
  const obra = getPolicyObra(policy);
  const progress = Number(obra?.porcentaje ?? NaN);
  return Number.isFinite(progress) ? progress : null;
}

function DashboardObraLinkCell({
  row,
  selectedObra,
}: {
  row: InsurancePolicyTableRow;
  selectedObra?: Obra | null;
}) {
  const obraId = selectedObra?.id ?? row.obraId;
  const obraLabel = selectedObra
    ? `${selectedObra.n} - ${selectedObra.designacionYUbicacion}`
    : row.obra;
  const obraProgress = selectedObra ? selectedObra.porcentaje : row.obraProgress;

  if (!obraId) {
    return <span className="block truncate text-stone-500">{obraLabel || "-"}</span>;
  }

  return (
    <div
      title={obraLabel}
      className="inline-flex min-h-8 max-w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 font-semibold text-stone-900"
    >
      <span className="block min-w-0 flex-1 truncate">{obraLabel}</span>
      {obraProgress !== null ? (
        <Badge
          variant="secondary"
          className={cn(
            "ml-1 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            obraProgress >= 100
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {obraProgress >= 100 ? "Terminada" : "En curso"}
        </Badge>
      ) : null}
    </div>
  );
}

function DashboardObraGroupLinkCell({ row }: { row: InsurancePolicyGroupRow }) {
  const { prefetchObra } = usePrefetchObra();
  if (!row.groupObraId) {
    return <span className="block truncate font-semibold text-stone-900">{row.groupLabel}</span>;
  }

  return (
    <Link
      href={`/excel/${row.groupObraId}`}
      prefetch={false}
      data-form-table-enter-navigate="true"
      title={row.groupLabel}
      className="group inline-flex min-h-8 max-w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 font-semibold text-stone-900 transition hover:bg-orange-50 hover:text-orange-700"
      onMouseEnter={() => prefetchObra(row.groupObraId!)}
    >
      <span className="flex size-4.5 shrink-0 items-center justify-center rounded border border-stone-200 bg-white text-stone-500 shadow-sm transition group-hover:border-orange-200 group-hover:bg-orange-500 group-hover:text-white">
        <ArrowUpRight className="size-3" />
      </span>
      <span className="block min-w-0 flex-1 truncate">{row.groupLabel}</span>
      {row.groupObraProgress !== null ? (
        <Badge
          variant="secondary"
          className={cn(
            "ml-1 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            row.groupObraProgress >= 100
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {row.groupObraProgress >= 100 ? "Terminada" : "En curso"}
        </Badge>
      ) : null}
    </Link>
  );
}

function DashboardObraSelectCell({
  value,
  obras,
  setValue,
  handleBlur,
}: {
  value: unknown;
  obras: Obra[];
  setValue: (value: unknown) => void;
  handleBlur: () => void;
}) {
  const currentValue = String(value ?? "");
  return (
    <div className="children-input-hidden absolute inset-0 flex h-full w-full items-center px-2">
      <div className="relative w-full min-w-0">
        <select
          value={currentValue}
          onChange={(event) => {
            setValue(event.target.value);
            handleBlur();
          }}
          className="h-9 w-full min-w-0 appearance-none truncate rounded-md border border-orange-200 bg-white py-0 pl-2 pr-12 text-xs font-medium text-stone-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="" disabled>Seleccionar obra</option>
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.n} - {obra.designacionYUbicacion}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-px right-px flex w-12 items-center justify-end rounded-r-md bg-gradient-to-l from-white via-white to-white/80 pr-2 text-stone-500 shadow-[-10px_0_12px_rgba(255,255,255,0.95)] backdrop-blur-[1px]">
          <ChevronDown className="size-4" />
        </span>
      </div>
    </div>
  );
}

function formatPolicyMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function parsePolicyAmount(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

async function getResponseErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

function createInsurancePolicyFilters(): InsurancePolicyFilters {
  return {
    policies: "",
    obra: "",
    section: "",
    endDateFrom: "",
    endDateTo: "",
    minInsuredAmount: "",
    minPremium: "",
  };
}

function countInsurancePolicyFilters(filters: InsurancePolicyFilters) {
  return Object.values(filters).filter((value) => String(value).trim().length > 0).length;
}

function dateValueInRange(value: string | null, from: string, to: string) {
  const normalized = value?.slice(0, 10) ?? "";
  if (from && (!normalized || normalized < from)) return false;
  if (to && (!normalized || normalized > to)) return false;
  return true;
}

function parsePolicyFilterList(value: string) {
	return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

function matchesInsurancePolicyFilters(row: InsurancePolicyTableRow, filters: InsurancePolicyFilters) {
  const obraFilter = filters.obra.trim().toLowerCase();
  const policyFilters = parsePolicyFilterList(filters.policies);
  const sectionFilter = filters.section.trim().toLowerCase();
  const minInsuredAmount = Number(filters.minInsuredAmount || 0);
  const minPremium = Number(filters.minPremium || 0);
  if (
    policyFilters.length > 0 &&
    !policyFilters.some((policyFilter) => row.policyNumber.toLowerCase().includes(policyFilter))
  ) return false;
  if (obraFilter && !row.obra.toLowerCase().includes(obraFilter)) return false;
  if (sectionFilter && !row.section.toLowerCase().includes(sectionFilter)) return false;
  if (!dateValueInRange(row.endDate, filters.endDateFrom, filters.endDateTo)) return false;
  if (minInsuredAmount > 0 && parsePolicyAmount(row.insuredAmount) < minInsuredAmount) return false;
  if (minPremium > 0 && parsePolicyAmount(row.premium || row.prize || row.balance) < minPremium) return false;
  return true;
}

function matchesInsurancePolicySearch(row: InsurancePolicyTableRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    row.policyNumber,
    row.obra,
    row.section,
    row.coveragePeriod,
    row.status,
    getPolicyOperationalStatus(row).label,
    row.risk,
    row.insuredObject,
  ].join(" ").toLowerCase().includes(normalized);
}

function matchesInsurancePolicyQuickFilter(row: InsurancePolicyTableRow, quickFilter: InsurancePolicyQuickFilter) {
  if (quickFilter === "none") return true;
  const status = getPolicyOperationalStatus(row);
  if (quickFilter === "observedBalance") return parsePolicyAmount(row.balance) !== 0;
  if (quickFilter === "cancelledWithBalance") return row.isCancelled && parsePolicyAmount(row.balance) > 0;
  if (quickFilter === "recurringRisk") return status.label === "Riesgo recurrente";
  if (quickFilter === "dueSoonRisk") return status.label === "Ojo: por vencer";
  if (quickFilter === "withoutEndDate") return !row.isCancelled && !row.endDate;
  if (quickFilter === "credits") {
    return parsePolicyAmount(row.premium) < 0 || parsePolicyAmount(row.prize) < 0 || parsePolicyAmount(row.balance) < 0;
  }
  return true;
}

function PolicyMetricTooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" align="start" sideOffset={8} className="max-w-[300px] text-xs leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function toInsurancePolicyTableRow(policy: GlobalInsurancePolicy): InsurancePolicyTableRow {
  const row: InsurancePolicyTableRow = {
    id: policy.id,
    policyNumber: policy.policy_number,
    obraId: policy.obra_id ?? null,
    obra: getPolicyObraLabel(policy),
    obraProgress: getPolicyObraProgress(policy),
    section: policy.section ?? "",
    coveragePeriod: policy.coverage_period ?? "",
    endDate: policy.end_date?.slice(0, 10) ?? null,
    insuredAmount: policy.insured_amount,
    currency: policy.currency ?? "",
    premium: policy.premium,
    prize: policy.prize,
    balance: policy.balance,
    status: policy.status ?? "",
    operationalStatus: "",
    risk: policy.risk ?? "",
    insuredObject: policy.insured_object ?? "",
    calculatedCancellationDate: policy.cancellation_rule_configured === true ? policy.calculated_cancellation_date?.slice(0, 10) ?? null : null,
    cancellationRequestedAt: policy.cancellation_requested_at?.slice(0, 10) ?? null,
    cancellationConfirmedAt: policy.cancellation_confirmed_at?.slice(0, 10) ?? null,
    cancellationNotes: policy.cancellation_notes ?? "",
    isCancelled: policy.is_cancelled,
    moveAction: "",
    deleteAction: "",
  };
  row.operationalStatus = getPolicyOperationalStatus(row).label;
  return row;
}

function getPolicyGroupLabel(row: InsurancePolicyTableRow, groupBy: InsurancePolicyGroupBy) {
  if (groupBy === "obra") return row.obra || "Sin obra";
  if (groupBy === "endDate") return row.endDate ? formatShortDate(row.endDate) : "Sin fecha de finalizacion";
  if (groupBy === "calculatedDate") return row.calculatedCancellationDate ? formatShortDate(row.calculatedCancellationDate) : "Sin fecha calculada";
  return "Todas";
}

function buildPolicyGroupRows(rows: InsurancePolicyTableRow[], groupBy: InsurancePolicyGroupBy): InsurancePolicyGroupRow[] {
  const groups = new Map<string, InsurancePolicyTableRow[]>();
  for (const row of rows) {
    const label = getPolicyGroupLabel(row, groupBy);
    const group = groups.get(label);
    if (group) {
      group.push(row);
    } else {
      groups.set(label, [row]);
    }
  }

  return Array.from(groups.entries()).map(([label, policyRows]) => {
    const searchText = [
      label,
      ...policyRows.flatMap((policy) => [
        policy.policyNumber,
        policy.obra,
        policy.section,
        policy.coveragePeriod,
        policy.status,
        policy.risk,
        policy.insuredObject,
      ]),
    ].join(" ").toLowerCase();

    return {
      id: `group-${groupBy}-${label}`,
      groupLabel: label,
      searchText,
      groupObraId: groupBy === "obra" ? policyRows[0]?.obraId ?? null : null,
      groupObraProgress: groupBy === "obra" ? policyRows[0]?.obraProgress ?? null : null,
      policyCount: policyRows.length,
      activeCount: policyRows.filter((row) => !row.isCancelled).length,
      cancelledCount: policyRows.filter((row) => row.isCancelled).length,
      totalInsuredAmount: policyRows.reduce((total, row) => total + parsePolicyAmount(row.insuredAmount), 0),
      currentPremium: policyRows.reduce((total, row) => total + parsePolicyAmount(row.premium || row.prize || row.balance), 0),
      policyRows,
    };
  });
}

function matchesInsurancePolicyGroupSearch(row: InsurancePolicyGroupRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return row.searchText.includes(normalized);
}

function getInsurancePolicyApiOrderBy(columnId: string | null | undefined, groupBy: InsurancePolicyGroupBy) {
  if (columnId === "policyNumber") return "policy_number";
  if (columnId === "section") return "section";
  if (columnId === "coveragePeriod") return "coverage_period";
  if (columnId === "endDate") return "end_date";
  if (columnId === "insuredAmount") return "insured_amount";
  if (columnId === "currency") return "currency";
  if (columnId === "premium") return "premium";
  if (columnId === "prize") return "prize";
  if (columnId === "balance") return "balance";
  if (columnId === "status") return "status";
  if (columnId === "operationalStatus") return "end_date";
  if (columnId === "risk") return "risk";
  if (columnId === "insuredObject") return "insured_object";
  if (columnId === "calculatedCancellationDate") return "calculated_cancellation_date";
  if (columnId === "isCancelled") return "is_cancelled";
  if (groupBy === "endDate") return "end_date";
  if (groupBy === "calculatedDate") return "calculated_cancellation_date";
  return "policy_number";
}

async function fetchAllInsurancePolicyRowsForExport(
  statusFilter: InsurancePolicyStatusFilter,
  groupBy: InsurancePolicyGroupBy,
  quickFilter: InsurancePolicyQuickFilter = "none",
) {
  const params = new URLSearchParams({
    all: "1",
    view: "related",
    status: statusFilter,
    orderBy: getInsurancePolicyApiOrderBy(null, groupBy),
    orderDir: "asc",
  });
  const response = await fetch(`/api/insurance-policies?${params.toString()}`);
  if (!response.ok) throw new Error("No se pudieron exportar todas las polizas");
  const payload = (await response.json()) as { policies: GlobalInsurancePolicy[] };
  return (payload.policies ?? [])
    .map(toInsurancePolicyTableRow)
    .filter((row) => matchesInsurancePolicyQuickFilter(row, quickFilter));
}

function getInsurancePolicyExportValue(
  row: InsurancePolicyTableRow,
  column: ColumnDef<InsurancePolicyTableRow>,
) {
  if (column.id === "obra") return row.obra;
  if (column.id === "endDate") return formatShortDate(row.endDate);
  if (column.id === "calculatedCancellationDate") return formatShortDate(row.calculatedCancellationDate);
  if (column.id === "cancellationRequestedAt") return formatShortDate(row.cancellationRequestedAt);
  if (column.id === "cancellationConfirmedAt") return formatShortDate(row.cancellationConfirmedAt);
  if (column.id === "isCancelled") return row.isCancelled ? "Si" : "No";
  if (column.id === "operationalStatus") return getPolicyOperationalStatus(row).label;
  return row[column.field] ?? "";
}

function sortInsurancePolicyRowsForExport(
  rows: InsurancePolicyTableRow[],
  columns: ColumnDef<InsurancePolicyTableRow>[],
  columnId: string | null | undefined,
  direction: "asc" | "desc",
) {
  if (!columnId) return rows;
  const column = columns.find((item) => item.id === columnId);
  if (!column) return rows;
  const comparator = column.sortFn ?? ((a: InsurancePolicyTableRow, b: InsurancePolicyTableRow) => {
    const valueA = getInsurancePolicyExportValue(a, column);
    const valueB = getInsurancePolicyExportValue(b, column);
    if (typeof valueA === "number" && typeof valueB === "number") return valueA - valueB;
    return String(valueA ?? "").localeCompare(String(valueB ?? ""), "es", {
      sensitivity: "base",
      numeric: true,
    });
  });
  const sorted = [...rows].sort(comparator);
  return direction === "asc" ? sorted : sorted.reverse();
}

const INSURANCE_POLICY_ACCORDION_EXPORT_COLUMNS = [
  "Nivel",
  "Grupo",
  "Polizas grupo",
  "Activas grupo",
  "Dadas de baja grupo",
  "Suma asegurada grupo",
  "Monto observado grupo",
  "Poliza",
  "Obra",
  "Seccion",
  "Vigencia",
  "Fecha finalizacion",
  "Suma asegurada",
  "Prima",
  "Premio",
  "Saldo observado",
  "Estado productor",
  "Lectura operativa",
  "Riesgo",
  "Objeto",
  "Baja calculada",
  "Dada de baja",
];

function buildInsurancePolicyAccordionExport(
  groups: InsurancePolicyGroupRow[],
  fileName: string,
): FormTableCsvExport {
  return {
    fileName,
    columns: INSURANCE_POLICY_ACCORDION_EXPORT_COLUMNS,
    rows: groups.flatMap((group) => [
      [
        "Acordeon",
        group.groupLabel,
        group.policyCount,
        group.activeCount,
        group.cancelledCount,
        group.totalInsuredAmount,
        group.currentPremium,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      ...group.policyRows.map((policy) => [
        "- item",
        group.groupLabel,
        "",
        "",
        "",
        "",
        "",
        policy.policyNumber,
        policy.obra,
        policy.section,
        policy.coveragePeriod,
        formatShortDate(policy.endDate),
        policy.insuredAmount ?? "",
        policy.premium ?? "",
        policy.prize ?? "",
        policy.balance ?? "",
        policy.status,
        getPolicyOperationalStatus(policy).label,
        policy.risk,
        policy.insuredObject,
        formatShortDate(policy.calculatedCancellationDate),
        policy.isCancelled ? "Si" : "No",
      ]),
    ]),
  };
}

function getFileExtension(name: string) {
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toUpperCase().slice(0, 6) : "FILE";
}

function getFileThumbnailMeta(file: CompanyFile) {
  const extension = getFileExtension(file.name);
  const mimeType = file.mimeType ?? "";
  const normalizedName = file.name.toLowerCase();
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(normalizedName)) {
    return { kind: "image" as const, label: extension, Icon: ImageIcon, className: "bg-cyan-50 text-cyan-700 border-cyan-100" };
  }
  if (mimeType === "application/pdf" || normalizedName.endsWith(".pdf")) {
    return { kind: "document" as const, label: "PDF", Icon: FileText, className: "bg-rose-50 text-rose-700 border-rose-100" };
  }
  if (/\.(xlsx?|csv)$/.test(normalizedName)) {
    return { kind: "file" as const, label: extension, Icon: FileSpreadsheet, className: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  }
  if (/\.(zip|rar|7z)$/.test(normalizedName)) {
    return { kind: "file" as const, label: extension, Icon: FileArchive, className: "bg-amber-50 text-amber-700 border-amber-100" };
  }
  return { kind: "file" as const, label: extension, Icon: File, className: "bg-stone-50 text-stone-700 border-stone-200" };
}

function CompanyFileThumbnail({ file }: { file: CompanyFile }) {
  const meta = getFileThumbnailMeta(file);
  const Icon = meta.Icon;
  const imageUrl =
    meta.kind === "image"
      ? `/api/company-files/access?path=${encodeURIComponent(file.path)}&download=1`
      : null;

  return (
    <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1 border", meta.className)}>
          <Icon className="size-5" />
          <span className="max-w-[42px] truncate text-[9px] font-semibold leading-none">{meta.label}</span>
        </div>
      )}
      <span className="absolute bottom-1 right-1 rounded bg-white/90 px-1 py-0.5 text-[8px] font-semibold text-stone-600 shadow-sm">
        {meta.kind === "document" ? "DOC" : meta.kind === "image" ? "IMG" : "FILE"}
      </span>
    </div>
  );
}

function CompanyFilesPanel({
  files,
  isLoading,
  isUploading,
  onPickFile,
  onDownload,
  onRefresh,
}: {
  files: CompanyFile[];
  isLoading: boolean;
  isUploading: boolean;
  onPickFile: () => void;
  onDownload: (file: CompanyFile) => void;
  onRefresh: () => void;
}) {
  return (
    <Framed>
      <Card className="overflow-hidden rounded-xl border-0 bg-transparent pt-0 shadow-none gap-0">
        <CardHeader className={cn(DS.cardHeader, "py-4 pt-5")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-stone-900">Archivos globales de la empresa</CardTitle>
              <CardDescription className="mt-0.5 text-xs text-stone-500">
                Documentos compartidos a nivel organizacion, separados de los archivos de cada obra
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onRefresh}>
                <RefreshCw className="size-4" />
                Actualizar
              </Button>
              <Button type="button" size="sm" className="gap-2 bg-stone-900 text-white hover:bg-stone-800" onClick={onPickFile} disabled={isUploading}>
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {isUploading ? "Subiendo..." : "Subir archivo"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Tamano</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="w-[96px] text-right">Accion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.path}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2">
                        <CompanyFileThumbnail file={file} />
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-stone-900">{file.name}</span>
                          <span className="block truncate text-xs text-stone-500">
                            {file.mimeType ?? getFileExtension(file.name)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-stone-600">{formatFileSize(file.size)}</TableCell>
                    <TableCell className="text-stone-600">{formatShortDate(file.updatedAt ?? file.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" className="h-8 gap-2" onClick={() => onDownload(file)}>
                        <Download className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-sm text-stone-500">
                      {isLoading ? "Cargando archivos..." : "Todavia no hay archivos globales cargados."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Framed>
  );
}

function GlobalInsurancePoliciesPanel({
  isImporting,
  onPickFile,
  onRefresh,
  obras,
}: {
  isImporting: boolean;
  onPickFile: () => void;
  onRefresh: () => void | Promise<void>;
  obras: Obra[];
}) {
  const queryClient = useQueryClient();
  const [groupBy, setGroupBy] = useState<InsurancePolicyGroupBy>("obra");
  const [statusFilter, setStatusFilter] = useState<InsurancePolicyStatusFilter>("all");
  const [quickFilter, setQuickFilter] = useState<InsurancePolicyQuickFilter>("none");
  const [movePolicyDialog, setMovePolicyDialog] = useState<{ policy: InsurancePolicyTableRow; targetObraId: string } | null>(null);
  const [movingPolicyId, setMovingPolicyId] = useState<string | null>(null);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);
  const policiesQuery = useQuery({
    queryKey: ["insurance-policies", "related", statusFilter, groupBy, quickFilter],
    enabled: groupBy !== "none",
    queryFn: async () => {
      const params = new URLSearchParams({
        all: "1",
        status: statusFilter,
        orderBy: getInsurancePolicyApiOrderBy(null, groupBy),
      });
      const response = await fetch(`/api/insurance-policies?${params.toString()}`);
      if (!response.ok) throw new Error("No se pudieron cargar las polizas");
      const payload = (await response.json()) as { policies: GlobalInsurancePolicy[] };
      return (payload.policies ?? [])
        .map(toInsurancePolicyTableRow)
        .filter((row) => matchesInsurancePolicyQuickFilter(row, quickFilter));
    },
  });
  const summaryQuery = useQuery({
    queryKey: ["insurance-policies", "summary"],
    queryFn: async () => {
      const response = await fetch("/api/insurance-policies?summary=1");
      if (!response.ok) throw new Error("No se pudo cargar el resumen de polizas");
      return (await response.json()) as {
        summary: InsurancePolicySummary;
        permissions?: { canDeleteAllPolicies?: boolean };
      };
    },
  });
  const refetchPolicySummary = summaryQuery.refetch;
  const canDeleteAllPolicies = summaryQuery.data?.permissions?.canDeleteAllPolicies === true;
  const policyFinancials = summaryQuery.data?.summary ?? {
    totalPolicies: 0,
    activePolicies: 0,
    currentExpense: 0,
    finishedWithoutCancellation: 0,
    finishedWithoutCancellationExpense: 0,
    observedActiveAmount: 0,
    observedBalance: 0,
    activeExpiredAmount: 0,
    cancelledWithBalance: 0,
    cancelledWithBalanceAmount: 0,
    activeWithoutEndDate: 0,
    creditSignal: 0,
    creditSignalAmount: 0,
    preventiveCancellationAlerts: 0,
    preventiveCancellationAlertAmount: 0,
    potentialOverbillingPolicies: 0,
    potentialOverbillingAmount: 0,
  };
  const quickFilterLabels: Record<InsurancePolicyQuickFilter, string> = {
    none: "Todas",
    observedBalance: "Saldo observado",
    cancelledWithBalance: "Bajas con saldo",
    recurringRisk: "Riesgo recurrente",
    dueSoonRisk: "Ojo: por vencer",
    withoutEndDate: "Sin fecha de fin",
    credits: "Creditos detectados",
  };
  const applyQuickFilter = useCallback((nextFilter: InsurancePolicyQuickFilter) => {
    setQuickFilter(nextFilter);
    setStatusFilter("all");
  }, []);
  const policyRows = policiesQuery.data ?? EMPTY_POLICY_ROWS;
  const fetchPolicyRows = useCallback(
    async ({ page, limit, filters, search, sort }: FetchRowsArgs<InsurancePolicyFilters>) => {
      const params = new URLSearchParams({
        page: quickFilter === "none" ? String(page) : "1",
        limit: quickFilter === "none" ? String(limit) : "100",
        status: statusFilter,
        orderBy: getInsurancePolicyApiOrderBy(sort?.columnId, "none"),
        orderDir: sort?.direction ?? "asc",
      });
      if (quickFilter !== "none") {
        params.set("all", "1");
      }
      if (search?.trim()) params.set("q", search.trim());
      if (filters.policies.trim()) params.set("policies", filters.policies.trim());
      if (filters.obra.trim()) params.set("obra", filters.obra.trim());
      if (filters.section.trim()) params.set("section", filters.section.trim());
      if (filters.endDateFrom.trim()) params.set("endDateFrom", filters.endDateFrom.trim());
      if (filters.endDateTo.trim()) params.set("endDateTo", filters.endDateTo.trim());
      if (filters.minInsuredAmount.trim()) params.set("minInsuredAmount", filters.minInsuredAmount.trim());
      if (filters.minPremium.trim()) params.set("minPremium", filters.minPremium.trim());

      const response = await fetch(`/api/insurance-policies?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("No se pudieron cargar las polizas");
      const payload = (await response.json()) as {
        policies: GlobalInsurancePolicy[];
        pagination?: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
      };
      const rows = (payload.policies ?? []).map(toInsurancePolicyTableRow);
      if (quickFilter === "none") {
        return {
          rows,
          pagination: payload.pagination,
        };
      }
      const filteredRows = rows
        .filter((row) => matchesInsurancePolicyQuickFilter(row, quickFilter))
        .filter((row) => matchesInsurancePolicyFilters(row, filters))
        .filter((row) => matchesInsurancePolicySearch(row, search ?? ""));
      const total = filteredRows.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const start = (page - 1) * limit;
      return {
        rows: filteredRows.slice(start, start + limit),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    },
    [quickFilter, statusFilter]
  );
  const groupedRows = useMemo(() => buildPolicyGroupRows(policyRows, groupBy), [groupBy, policyRows]);
  const handleRefresh = useCallback(async () => {
    await onRefresh();
    queryClient.invalidateQueries({ queryKey: ["insurance-policies"] });
    window.dispatchEvent(new CustomEvent("form-table:refresh", { detail: { tableId: `dashboard-insurance-related-${statusFilter}-${quickFilter}` } }));
  }, [onRefresh, queryClient, quickFilter, statusFilter]);
  const handleDeleteAllPolicies = useCallback(async () => {
    if (!window.confirm("Borrar todas las polizas del tenant actual? Esta accion no se puede deshacer.")) return;
    const response = await fetch("/api/insurance-policies", { method: "DELETE" });
    if (!response.ok) {
      toast.error(await getResponseErrorMessage(response, "No se pudieron borrar las polizas"));
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["insurance-policies"] }),
      policiesQuery.refetch(),
      summaryQuery.refetch(),
    ]);
    toast.success("Polizas borradas");
  }, [policiesQuery, queryClient, summaryQuery]);

  const handleDeletePolicy = useCallback(async (policy: InsurancePolicyTableRow) => {
    if (!window.confirm(`Borrar la poliza ${policy.policyNumber}? Esta accion no se puede deshacer.`)) return;
    setDeletingPolicyId(policy.id);
    try {
      const response = await fetch(`/api/insurance-policies/${policy.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, "No se pudo borrar la poliza"));
      }
      await handleRefresh();
      await refetchPolicySummary();
      toast.success("Poliza borrada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar la poliza");
    } finally {
      setDeletingPolicyId(null);
    }
  }, [handleRefresh, refetchPolicySummary]);

  const openMovePolicyDialog = useCallback((policy: InsurancePolicyTableRow) => {
    setMovePolicyDialog({ policy, targetObraId: policy.obraId ?? "" });
  }, []);

  const handleMovePolicy = useCallback(async () => {
    if (!movePolicyDialog || !movePolicyDialog.targetObraId) return;
    setMovingPolicyId(movePolicyDialog.policy.id);
    try {
      const response = await fetch(`/api/insurance-policies/${movePolicyDialog.policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obraId: movePolicyDialog.targetObraId }),
      });
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, "No se pudo mover la poliza"));
      }
      await handleRefresh();
      await refetchPolicySummary();
      setMovePolicyDialog(null);
      toast.success("Poliza movida a otra obra");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo mover la poliza");
    } finally {
      setMovingPolicyId(null);
    }
  }, [handleRefresh, movePolicyDialog, refetchPolicySummary]);

  const policyTableColumns = useMemo<ColumnDef<InsurancePolicyTableRow>[]>(() => [
    { id: "policyNumber", label: "Poliza", field: "policyNumber", editable: true, width: 150 },
    {
      id: "obra",
      label: "Obra",
      field: "obraId",
      editable: true,
      width: 360,
      sortFn: (a, b) => a.obra.localeCompare(b.obra, "es", { sensitivity: "base", numeric: true }),
      cellConfig: {
        renderReadOnly: ({ value, row }) => (
          <DashboardObraLinkCell
            row={row}
            selectedObra={obras.find((obra) => obra.id === String(value ?? ""))}
          />
        ),
        renderEditable: ({ value, setValue, handleBlur }) => (
          <DashboardObraSelectCell value={value} obras={obras} setValue={setValue} handleBlur={handleBlur} />
        ),
      },
    },
    { id: "section", label: "Seccion", field: "section", editable: true, width: 120 },
    { id: "coveragePeriod", label: "Vigencia", field: "coveragePeriod", editable: true, width: 180 },
    { id: "endDate", label: "Fecha finalizacion", field: "endDate", cellType: "date", editable: true, width: 150 },
    { id: "insuredAmount", label: "Suma asegurada", field: "insuredAmount", cellType: "currency", editable: true, width: 150 },
    { id: "currency", label: "Moneda", field: "currency", editable: true, width: 90 },
    { id: "premium", label: "Prima", field: "premium", cellType: "currency", editable: true, width: 120 },
    { id: "prize", label: "Premio", field: "prize", cellType: "currency", editable: true, width: 120 },
    { id: "balance", label: "Saldo observado", field: "balance", cellType: "currency", editable: true, width: 150 },
    { id: "status", label: "Estado productor", field: "status", editable: true, width: 140 },
    {
      id: "operationalStatus",
      label: "Lectura operativa",
      field: "operationalStatus",
      editable: false,
      width: 220,
      sortFn: (a, b) => getPolicyOperationalStatus(a).label.localeCompare(getPolicyOperationalStatus(b).label, "es", { sensitivity: "base" }),
      cellConfig: {
        renderReadOnly: ({ row }) => {
          const status = getPolicyOperationalStatus(row);
          return (
            <div className="flex min-w-0 flex-col gap-1">
              <Badge
                variant="outline"
                className={cn(
                  "w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  status.tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  status.tone === "amber" && "border-amber-200 bg-amber-50 text-amber-800",
                  status.tone === "red" && "border-orange-200 bg-orange-50 text-orange-800",
                  status.tone === "blue" && "border-blue-200 bg-blue-50 text-blue-700",
                )}
              >
                {status.label}
              </Badge>
              <span className="block truncate text-[11px] text-stone-500">{status.description}</span>
            </div>
          );
        },
      },
    },
    {
      id: "risk",
      label: "Riesgo",
      field: "risk",
      editable: true,
      width: 220,
      cellConfig: {
        clearActiveCellOnBlur: true,
        renderReadOnly: ({ value }) => (
          <span className="block truncate text-stone-900">{String(value ?? "") || "-"}</span>
        ),
      },
    },
    {
      id: "insuredObject",
      label: "Objeto",
      field: "insuredObject",
      editable: true,
      width: 260,
      cellConfig: { clearActiveCellOnBlur: true },
    },
    { id: "calculatedCancellationDate", label: "Baja calculada", field: "calculatedCancellationDate", cellType: "date", editable: false, width: 150 },
    { id: "cancellationRequestedAt", label: "Baja solicitada", field: "cancellationRequestedAt", cellType: "date", editable: true, width: 150 },
    { id: "cancellationConfirmedAt", label: "Baja confirmada", field: "cancellationConfirmedAt", cellType: "date", editable: true, width: 150 },
    {
      id: "cancellationNotes",
      label: "Gestion de baja",
      field: "cancellationNotes",
      editable: true,
      width: 220,
      cellConfig: { clearActiveCellOnBlur: true },
    },
    { id: "isCancelled", label: "Dada de baja", field: "isCancelled", cellType: "checkbox", editable: true, width: 120 },
    {
      id: "movePolicy",
      label: "Mover",
      field: "moveAction",
      editable: false,
      enableSort: false,
      width: 96,
      cellConfig: {
        renderReadOnly: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              openMovePolicyDialog(row);
            }}
          >
            <ArrowRight className="size-3.5" />
            Mover
          </Button>
        ),
      },
    },
    {
      id: "deletePolicy",
      label: "Eliminar",
      field: "deleteAction",
      editable: false,
      enableSort: false,
      width: 110,
      cellConfig: {
        renderReadOnly: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deletingPolicyId === row.id}
            className="h-8 gap-1.5 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={(event) => {
              event.stopPropagation();
              void handleDeletePolicy(row);
            }}
          >
            {deletingPolicyId === row.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Eliminar
          </Button>
        ),
      },
    },
  ], [deletingPolicyId, handleDeletePolicy, obras, openMovePolicyDialog]);

  const policyTableConfig = useMemo<FormTableConfig<InsurancePolicyTableRow, InsurancePolicyFilters>>(() => ({
    tableId: `dashboard-insurance-related-${statusFilter}-${quickFilter}`,
    columns: policyTableColumns,
    defaultRows: EMPTY_POLICY_ROWS,
    fetchRows: fetchPolicyRows,
    serverSideData: true,
    createFilters: createInsurancePolicyFilters,
    countActiveFilters: countInsurancePolicyFilters,
    applyFilters: matchesInsurancePolicyFilters,
    csvExport: {
      buildExport: async ({ filters, search, visibleColumns, sort }) => {
        const allRows = await fetchAllInsurancePolicyRowsForExport(statusFilter, "none", quickFilter);
        const filteredRows = allRows.filter((row) =>
          (!filters || matchesInsurancePolicyFilters(row, filters)) &&
          matchesInsurancePolicySearch(row, search)
        );
        const sortedExportRows = sortInsurancePolicyRowsForExport(
          filteredRows,
          policyTableColumns,
          sort.columnId,
          sort.direction,
        );
        return {
          fileName: `dashboard-insurance-related-${statusFilter}-${quickFilter}-all`,
          columns: visibleColumns.map((column) => column.label),
          rows: sortedExportRows.map((row) =>
            visibleColumns.map((column) => getInsurancePolicyExportValue(row, column))
          ),
        };
      },
    },
    renderFilters: ({ filters, onChange }) => (
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Polizas</span>
          <input
            value={filters.policies}
            onChange={(event) => onChange((current) => ({ ...current, policies: event.target.value }))}
            placeholder="1006726 / 0, 330260 / 14"
            className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Obra</span>
          <input
            value={filters.obra}
            onChange={(event) => onChange((current) => ({ ...current, obra: event.target.value }))}
            placeholder="Nombre o numero de obra"
            className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Seccion</span>
          <input
            value={filters.section}
            onChange={(event) => onChange((current) => ({ ...current, section: event.target.value }))}
            placeholder="Caucion, incendio..."
            className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Finalizacion desde</span>
            <input
              type="date"
              value={filters.endDateFrom}
              onChange={(event) => onChange((current) => ({ ...current, endDateFrom: event.target.value }))}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Finalizacion hasta</span>
            <input
              type="date"
              value={filters.endDateTo}
              onChange={(event) => onChange((current) => ({ ...current, endDateTo: event.target.value }))}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Suma asegurada minima</span>
            <input
              type="number"
              min={0}
              value={filters.minInsuredAmount}
              onChange={(event) => onChange((current) => ({ ...current, minInsuredAmount: event.target.value }))}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Prima minima</span>
            <input
              type="number"
              min={0}
              value={filters.minPremium}
              onChange={(event) => onChange((current) => ({ ...current, minPremium: event.target.value }))}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
            />
          </label>
        </div>
      </div>
    ),
    defaultPageSize: 50,
    pageSizeOptions: [25, 50, 100],
    enableColumnResizing: true,
    editMode: "active-cell",
    editOnHover: false,
    headerCellClassName: "bg-stone-100 text-[11px] font-semibold tracking-wide text-stone-600",
    showToolbar: true,
    showInlineSearch: true,
    searchPlaceholder: "Buscar poliza, obra, riesgo...",
    allowAddRows: false,
    allowDeleteRows: false,
    showActionsColumn: false,
    rowElementClassName: () => "h-[46px]",
    emptyStateMessage: "No hay polizas para mostrar.",
    rowColorInfo: (row) => ({
      tone: getPolicyOperationalStatus(row).tone,
      previewing: false,
    }),
    onSave: async ({ dirtyRows }) => {
      await Promise.all(dirtyRows.map(async (row) => {
        const response = await fetch(`/api/insurance-policies/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            policyNumber: row.policyNumber,
            obraId: row.obraId,
            section: row.section || null,
            coveragePeriod: row.coveragePeriod || null,
            endDate: row.endDate || null,
            insuredAmount: row.insuredAmount ?? null,
            currency: row.currency || null,
            premium: row.premium ?? null,
            prize: row.prize ?? null,
            balance: row.balance ?? null,
            status: row.status || null,
            risk: row.risk || null,
            insuredObject: row.insuredObject || null,
            cancellationRequestedAt: row.cancellationRequestedAt || null,
            cancellationConfirmedAt: row.cancellationConfirmedAt || null,
            cancellationNotes: row.cancellationNotes || null,
            isCancelled: row.isCancelled,
          }),
        });
        if (!response.ok) throw new Error(await getResponseErrorMessage(response, "No se pudo guardar una poliza"));
      }));
      await handleRefresh();
      await refetchPolicySummary();
    },
  }), [fetchPolicyRows, handleRefresh, policyTableColumns, quickFilter, refetchPolicySummary, statusFilter]);

  const groupTableColumns = useMemo<ColumnDef<InsurancePolicyGroupRow>[]>(() => [
    {
      id: "groupLabel",
      label: groupBy === "obra" ? "Obra" : groupBy === "endDate" ? "Fecha finalizacion" : "Fecha baja calculada",
      field: "groupLabel",
      editable: false,
      width: 360,
      cellConfig: {
        renderReadOnly: ({ row }) => groupBy === "obra" ? (
          <DashboardObraGroupLinkCell row={row} />
        ) : (
          <span className="block truncate font-semibold text-stone-900">{row.groupLabel}</span>
        ),
      },
      searchFn: (row, query) => {
        return row.searchText.includes(query.trim().toLowerCase());
      },
    },
    { id: "policyCount", label: "Polizas", field: "policyCount", editable: false, width: 110 },
    { id: "activeCount", label: "Activas", field: "activeCount", editable: false, width: 110 },
    { id: "cancelledCount", label: "Dadas de baja", field: "cancelledCount", editable: false, width: 130 },
    { id: "totalInsuredAmount", label: "Suma asegurada", field: "totalInsuredAmount", cellType: "currency", editable: false, width: 160 },
    { id: "currentPremium", label: "Monto observado", field: "currentPremium", cellType: "currency", editable: false, width: 160 },
  ], [groupBy]);

  const groupedTableConfig = useMemo<FormTableConfig<InsurancePolicyGroupRow, Record<string, never>>>(() => ({
    tableId: `dashboard-insurance-related-grouped-${groupBy}-${statusFilter}-${quickFilter}`,
    columns: groupTableColumns,
    defaultRows: groupedRows,
    disablePagination: true,
    enableColumnResizing: true,
    headerCellClassName: "bg-stone-100 text-[11px] font-semibold tracking-wide text-stone-600",
    showToolbar: true,
    showInlineSearch: true,
    searchPlaceholder: "Buscar obra o poliza...",
    allowAddRows: false,
    allowDeleteRows: false,
    showActionsColumn: true,
    actionsColumnPosition: "start",
    actionsColumnWidth: 36,
    actionsColumnLabel: null,
    emptyStateMessage: "No hay polizas relacionadas para mostrar.",
    accordionRow: {
      triggerLabel: "polizas",
      contentClassName: "p-0",
      renderTrigger: ({ isOpen, toggle }) => (
        <Button
          type="button"
          variant="defaultTertiary"
          size="icon-sm"
          aria-label={isOpen ? "Ocultar polizas" : "Ver polizas"}
          aria-expanded={isOpen}
          onClick={toggle}
          className="size-5 rounded-md"
        >
          {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </Button>
      ),
      renderContent: (row) => (
        <div className="mx-2 my-1.5 rounded-lg border border-stone-200 bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-stone-50">
              <TableRow>
                <TableHead>Poliza</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Seccion</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Finalizacion</TableHead>
                <TableHead>Suma asegurada</TableHead>
                <TableHead>Prima</TableHead>
                <TableHead>Premio</TableHead>
                <TableHead>Saldo observado</TableHead>
                <TableHead>Estado productor</TableHead>
                <TableHead>Lectura operativa</TableHead>
                <TableHead>Riesgo</TableHead>
                <TableHead>Objeto</TableHead>
                <TableHead>Baja calculada</TableHead>
                <TableHead>Baja solicitada</TableHead>
                <TableHead>Baja confirmada</TableHead>
                <TableHead>Dada de baja</TableHead>
                <TableHead>Mover</TableHead>
                <TableHead>Eliminar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.policyRows.map((policy) => (
                <TableRow
                  key={policy.id}
                  className={cn(
                    "text-xs",
                    getPolicyOperationalStatus(policy).tone === "green" && "bg-emerald-50 hover:bg-emerald-50",
                    getPolicyOperationalStatus(policy).tone === "amber" && "bg-amber-50 hover:bg-amber-50",
                    getPolicyOperationalStatus(policy).tone === "red" && "bg-orange-50 hover:bg-orange-50",
                    getPolicyOperationalStatus(policy).tone === "blue" && "bg-blue-50 hover:bg-blue-50",
                  )}
                >
                  <TableCell className="whitespace-nowrap px-3 py-2 font-medium">{policy.policyNumber}</TableCell>
                  <TableCell className="min-w-[280px] max-w-[360px]">
                    <DashboardObraLinkCell row={policy} />
                  </TableCell>
                  <TableCell className="px-3 py-2">{policy.section || "-"}</TableCell>
                  <TableCell className="px-3 py-2">{policy.coveragePeriod || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2">{formatShortDate(policy.endDate)}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 tabular-nums">{formatPolicyMoney(parsePolicyAmount(policy.insuredAmount))}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 tabular-nums">{formatPolicyMoney(parsePolicyAmount(policy.premium))}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 tabular-nums">{formatPolicyMoney(parsePolicyAmount(policy.prize))}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 tabular-nums">{formatPolicyMoney(parsePolicyAmount(policy.balance))}</TableCell>
                  <TableCell className="px-3 py-2">{policy.status || "-"}</TableCell>
                  <TableCell className="min-w-[220px] px-3 py-2">
                    {(() => {
                      const status = getPolicyOperationalStatus(policy);
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-stone-900">{status.label}</span>
                          <span className="text-[11px] text-stone-500">{status.description}</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate px-3 py-2">{policy.risk || "-"}</TableCell>
                  <TableCell className="max-w-[320px] truncate px-3 py-2">{policy.insuredObject || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2">{formatShortDate(policy.calculatedCancellationDate)}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2">{formatShortDate(policy.cancellationRequestedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2">{formatShortDate(policy.cancellationConfirmedAt)}</TableCell>
                  <TableCell className="px-3 py-2">{policy.isCancelled ? "Si" : "No"}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => openMovePolicyDialog(policy)}
                    >
                      <ArrowRight className="size-3.5" />
                      Mover
                    </Button>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingPolicyId === policy.id}
                      className="h-7 gap-1.5 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => void handleDeletePolicy(policy)}
                    >
                      {deletingPolicyId === policy.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ),
    },
    csvExport: {
      buildExport: async ({ search }) => {
        const allRows = await fetchAllInsurancePolicyRowsForExport(statusFilter, groupBy, quickFilter);
        const groups = buildPolicyGroupRows(allRows, groupBy).filter((row) =>
          matchesInsurancePolicyGroupSearch(row, search)
        );
        return buildInsurancePolicyAccordionExport(
          groups,
          `dashboard-insurance-related-grouped-${groupBy}-${statusFilter}-${quickFilter}-all`,
        );
      },
    },
  }), [deletingPolicyId, groupBy, groupTableColumns, groupedRows, handleDeletePolicy, openMovePolicyDialog, quickFilter, statusFilter]);

  return (
    <Card className="overflow-hidden rounded-xl border-0 bg-transparent pt-0 shadow-none gap-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm">
            {[
              ["all", "Todas"],
              ["active", "Activas"],
              ["dueSoon", "Por vencer"],
              ["expired", "Vencidas"],
              ["cancelled", "Dadas de baja"],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={statusFilter === value ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 rounded-md px-3 text-xs",
                  statusFilter === value
                    ? "bg-stone-900 text-white hover:bg-stone-800"
                    : "text-stone-600 hover:bg-stone-50"
                )}
                onClick={() => {
                  setStatusFilter(value as InsurancePolicyStatusFilter);
                  setQuickFilter("none");
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <select
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as InsurancePolicyGroupBy);
            }}
            className="h-8 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 shadow-sm"
          >
            <option value="none">Sin agrupar</option>
            <option value="obra">Agrupar por obra</option>
            <option value="endDate">Agrupar por finalizacion</option>
            <option value="calculatedDate">Agrupar por baja calculada</option>
          </select>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {canDeleteAllPolicies ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 rounded-lg border-red-200 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => void handleDeleteAllPolicies()}
              >
                <Trash2 className="size-4" />
                Borrar polizas
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-8 gap-2 rounded-lg text-xs" onClick={() => void handleRefresh()}>
              <RefreshCw className="size-4" />
              Actualizar
            </Button>
            <Button type="button" size="sm" className="h-8 gap-2 rounded-lg bg-stone-900 text-xs text-white hover:bg-stone-800" onClick={onPickFile} disabled={isImporting}>
              {isImporting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {isImporting ? "Leyendo..." : "Importar Excel"}
            </Button>
          </div>
        </div>
      </div>
      <CardContent className="space-y-2 py-2 px-0">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <PolicyMetricTooltip
            content={
              <span>
                Muestra el listado completo de polizas y quita el filtro de tarjeta activo.
              </span>
            }
          >
            <button
              type="button"
              aria-pressed={quickFilter === "none"}
              className={cn("rounded-lg border border-stone-200 bg-white p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-stone-300 hover:shadow-sm", quickFilter === "none" && "ring-2 ring-stone-200")}
              onClick={() => applyQuickFilter("none")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Total polizas</p>
                <ShieldCheck className="size-4 text-stone-400" />
              </div>
              <p className="mt-1.5 text-xl font-semibold leading-none text-stone-900">{policyFinancials.totalPolicies}</p>
              <p className="mt-1.5 text-[11px] text-stone-500">{policyFinancials.activePolicies} activas importadas</p>
            </button>
          </PolicyMetricTooltip>
          <PolicyMetricTooltip
            content={
              <span>
                Muestra polizas que llegaron con algun saldo en la importacion o cuenta corriente, ya sea deuda observada o credito.
              </span>
            }
          >
            <button
              type="button"
              aria-pressed={quickFilter === "observedBalance"}
              className={cn("rounded-lg border border-stone-200 bg-white p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-blue-200 hover:shadow-sm", quickFilter === "observedBalance" && "ring-2 ring-blue-200")}
              onClick={() => applyQuickFilter("observedBalance")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">Saldo observado</p>
                <Activity className="size-4 text-blue-600" />
              </div>
              <p className="mt-1.5 text-xl font-semibold leading-none text-blue-950">
                {formatPolicyMoney(policyFinancials.observedBalance ?? 0)}
              </p>
              <p className="mt-1.5 text-[11px] text-blue-700">Cuenta corriente/importacion; no es ahorro ni gasto indebido</p>
            </button>
          </PolicyMetricTooltip>
          <PolicyMetricTooltip
            content={
              <span>
                Muestra polizas que ya figuran dadas de baja, pero todavia conservan saldo positivo para validar.
              </span>
            }
          >
            <button
              type="button"
              aria-pressed={quickFilter === "cancelledWithBalance"}
              className={cn("rounded-lg border border-stone-200 bg-white p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-amber-200 hover:shadow-sm", quickFilter === "cancelledWithBalance" && "ring-2 ring-amber-200")}
              onClick={() => applyQuickFilter("cancelledWithBalance")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">Bajas con saldo</p>
                <CheckCircle2 className="size-4 text-amber-700" />
              </div>
              <p className="mt-1.5 text-xl font-semibold leading-none text-amber-950">
                {policyFinancials.cancelledWithBalance ?? 0}
              </p>
              <p className="mt-1.5 text-[11px] text-amber-800">{formatPolicyMoney(policyFinancials.cancelledWithBalanceAmount ?? 0)} a validar por trimestre/anulacion</p>
            </button>
          </PolicyMetricTooltip>
          <PolicyMetricTooltip
            content={
              <span>
                Muestra polizas vencidas que siguen activas, no parecen de pago unico y todavia no tienen una baja solicitada o confirmada.
              </span>
            }
          >
            <button
              type="button"
              aria-pressed={quickFilter === "recurringRisk"}
              className={cn("rounded-lg border border-stone-200 bg-white p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-orange-200 hover:shadow-sm", quickFilter === "recurringRisk" && "ring-2 ring-orange-200")}
              onClick={() => applyQuickFilter("recurringRisk")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-700">Riesgo recurrente</p>
                <AlertTriangle className="size-4 text-orange-600" />
              </div>
              <p className="mt-1.5 text-xl font-semibold leading-none text-orange-950">
                {policyFinancials.potentialOverbillingPolicies ?? 0}
              </p>
              <p className="mt-1.5 text-[11px] text-orange-700">{formatPolicyMoney(policyFinancials.potentialOverbillingAmount ?? 0)} vencidas activas no-oferta; pedir baja</p>
            </button>
          </PolicyMetricTooltip>
          <PolicyMetricTooltip
            content={
              <span>
                Muestra polizas proximas a vencer que podrian seguir facturando si no se gestiona la baja a tiempo.
              </span>
            }
          >
            <button
              type="button"
              aria-pressed={quickFilter === "dueSoonRisk"}
              className={cn("rounded-lg border border-stone-200 bg-white p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-red-200 hover:shadow-sm", quickFilter === "dueSoonRisk" && "ring-2 ring-red-200")}
              onClick={() => applyQuickFilter("dueSoonRisk")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700">Ojo: por vencer</p>
                <AlertTriangle className="size-4 text-red-600" />
              </div>
              <p className="mt-1.5 text-xl font-semibold leading-none text-red-950">
                {policyFinancials.preventiveCancellationAlerts ?? 0}
              </p>
              <p className="mt-1.5 text-[11px] text-red-700">Vencen en 15 dias; si se pasan pueden seguir facturando</p>
            </button>
          </PolicyMetricTooltip>
          <PolicyMetricTooltip
            content={
              <span>
                Muestra polizas activas sin fecha de finalizacion cargada; con ese dato faltante no se puede inferir vencimiento.
              </span>
            }
          >
            <button
              type="button"
              aria-pressed={quickFilter === "withoutEndDate"}
              className={cn("rounded-lg border border-stone-200 bg-white p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-stone-300 hover:shadow-sm", quickFilter === "withoutEndDate" && "ring-2 ring-stone-300")}
              onClick={() => applyQuickFilter("withoutEndDate")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">Sin fecha de fin</p>
                <FileText className="size-4 text-stone-500" />
              </div>
              <p className="mt-1.5 text-xl font-semibold leading-none text-stone-900">
                {policyFinancials.activeWithoutEndDate ?? 0}
              </p>
              <p className="mt-1.5 text-[11px] text-stone-600">No se puede saber si vencieron sin completar dato</p>
            </button>
          </PolicyMetricTooltip>
        </div>
        {quickFilter !== "none" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700">
            <span className="font-semibold">Tabla filtrada:</span>
            <span>{quickFilterLabels[quickFilter]}</span>
            {groupBy !== "none" ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                agrupada por {groupBy === "obra" ? "obra" : groupBy === "endDate" ? "finalizacion" : "baja calculada"}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-7 rounded-md px-2 text-xs text-stone-600 hover:bg-stone-100"
              onClick={() => applyQuickFilter("none")}
            >
              Ver todas
            </Button>
          </div>
        ) : null}
        <div className="max-w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] md:max-w-[calc(95vw-var(--sidebar-current-width))]">
          {groupBy !== "none" && policiesQuery.isLoading ? (
            <div className="p-10 text-center text-sm text-stone-500">Cargando polizas...</div>
          ) : groupBy === "none" ? (
            <FormTable
              key={`related-flat-${statusFilter}-${quickFilter}`}
              config={policyTableConfig}
              variant="embedded"
              innerClassName="max-h-[620px]"
            />
          ) : (
            <FormTable
              key={`related-grouped-${groupBy}-${statusFilter}-${quickFilter}`}
              config={groupedTableConfig}
              variant="embedded"
              innerClassName="max-h-[620px]"
            />
          )}
        </div>
        <Dialog open={Boolean(movePolicyDialog)} onOpenChange={(open) => {
          if (movingPolicyId) return;
          if (!open) setMovePolicyDialog(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mover poliza a otra obra</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                <p className="font-semibold text-stone-900">{movePolicyDialog?.policy.policyNumber ?? "Poliza"}</p>
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  Actual: {movePolicyDialog?.policy.obra || "Sin obra asignada"}
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Obra destino</span>
                <ObraDestinationCombobox
                  obras={obras}
                  value={movePolicyDialog?.targetObraId ?? ""}
                  onChange={(value) =>
                    setMovePolicyDialog((current) =>
                      current ? { ...current, targetObraId: value } : current,
                    )
                  }
                  excludedObraId={movePolicyDialog?.policy.obraId}
                />
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(movingPolicyId)}
                onClick={() => setMovePolicyDialog(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={
                  !movePolicyDialog?.targetObraId ||
                  movePolicyDialog.targetObraId === movePolicyDialog.policy.obraId ||
                  movingPolicyId === movePolicyDialog?.policy.id
                }
                onClick={() => void handleMovePolicy()}
              >
                {movingPolicyId === movePolicyDialog?.policy.id ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Mover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Fetch function for obras data with all analytics fields
async function fetchObrasData(): Promise<{ obras: Obra[]; isAuthenticated: boolean }> {
  const response = await fetch("/api/obras?orderBy=updated_at&orderDir=desc");

  // If unauthorized, user is not authenticated
  if (response.status === 401) {
    return { obras: [], isAuthenticated: false };
  }

  // If there's an error, return empty data but authenticated
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
    console.error("API Error:", errorData);
    return { obras: [], isAuthenticated: true };
  }

  const data = await response.json();
  // Map the response to ensure all fields have defaults
  const obras = (data.detalleObras || []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    n: o.n as number,
    designacionYUbicacion: o.designacionYUbicacion as string,
    porcentaje: (o.porcentaje as number) || 0,
    contratoMasAmpliaciones: (o.contratoMasAmpliaciones as number) || 0,
    certificadoALaFecha: (o.certificadoALaFecha as number) || 0,
    saldoACertificar: (o.saldoACertificar as number) || 0,
    entidadContratante: o.entidadContratante as string,
    plazoTotal: (o.plazoTotal as number) || 0,
    plazoTransc: (o.plazoTransc as number) || 0,
    segunContrato: (o.segunContrato as number) || 0,
    prorrogasAcordadas: (o.prorrogasAcordadas as number) || 0,
    updatedAt: (o.updatedAt as string) || null,
  }));
  return { obras, isAuthenticated: true };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeFieldKey(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parsePercent(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const stripped = raw.replace(/[%\s$]/g, "");
  const lastDot = stripped.lastIndexOf(".");
  const lastComma = stripped.lastIndexOf(",");
  let normalized = stripped;
  if (lastComma > lastDot) {
    normalized = stripped.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = stripped.replace(/,/g, "");
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const MONTH_INDEX: Record<string, number> = {
  ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3, may: 4, mayo: 4,
  jun: 5, junio: 5, jul: 6, julio: 6, ago: 7, agosto: 7, sep: 8, sept: 8, septiembre: 8,
  oct: 9, octubre: 9, nov: 10, noviembre: 10, dic: 11, diciembre: 11, jan: 0, apr: 3, aug: 7, dec: 11,
};

function parseMonthOrder(rawValue: unknown, fallback: number): { label: string; order: number } {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return { label: `Mes ${fallback + 1}`, order: fallback };
  const norm = normalizeText(raw).replace(/\./g, "");

  const dmy = norm.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    const month = Number.parseInt(dmy[2], 10) - 1;
    const yearRaw = Number.parseInt(dmy[3], 10);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return { label: raw, order: year * 12 + Math.max(0, Math.min(11, month)) };
  }

  const monYear = norm.match(/([a-z]{3,10})[-\s_/]*(\d{2,4})/);
  if (monYear) {
    const month = MONTH_INDEX[monYear[1]];
    if (month != null) {
      const yearRaw = Number.parseInt(monYear[2], 10);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      return { label: raw, order: year * 12 + month };
    }
  }

  const mesN = norm.match(/mes\s*(\d{1,3})/);
  if (mesN) {
    const n = Number.parseInt(mesN[1], 10);
    return { label: `Mes ${n}`, order: n };
  }

  return { label: raw, order: fallback };
}

function addMonths(periodKey: string, offset: number): string | null {
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const date = new Date(Date.UTC(year, month + offset, 1));
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodLabelFromOrder(order: number, fallbackLabel: string): string {
  if (order < 1000) return fallbackLabel;
  const year = Math.floor(order / 12);
  const month = order % 12;
  const date = new Date(Date.UTC(year, month, 1));
  if (Number.isNaN(date.getTime())) return fallbackLabel;
  return date.toLocaleDateString("es-AR", { month: "short", year: "numeric", timeZone: "UTC" });
}

function getRowFieldValueByCandidates(
  rowData: Record<string, unknown> | null | undefined,
  candidates: string[],
  tokenGroups: string[][] = []
): unknown {
  if (!rowData || typeof rowData !== "object") return null;
  for (const key of candidates) {
    if (key in rowData) return rowData[key];
  }
  const entries = Object.entries(rowData);
  const normalizedEntries = entries.map(([key, value]) => [normalizeFieldKey(key), value] as const);
  const normalizedCandidates = new Set(candidates.map((key) => normalizeFieldKey(key)));
  for (const [key, value] of normalizedEntries) {
    if (normalizedCandidates.has(key)) return value;
  }
  for (const [key, value] of normalizedEntries) {
    const tokens = key.split("_").filter(Boolean);
    for (const group of tokenGroups) {
      if (group.every((token) => tokens.some((entry) => entry.includes(token)))) return value;
    }
  }
  return null;
}

async function fetchDashboardTablaRowsAll(obraId: string, tablaId: string, maxPages = 20): Promise<DashboardTablaRow[]> {
  const allRows: DashboardTablaRow[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetch(`/api/obras/${obraId}/tablas/${tablaId}/rows?page=${page}&limit=200`);
    if (!response.ok) break;
    const payload = await response.json().catch(() => ({}));
    const rows = Array.isArray(payload?.rows) ? (payload.rows as DashboardTablaRow[]) : [];
    allRows.push(...rows);
    if (!payload?.pagination?.hasNextPage) break;
  }
  return allRows;
}

async function fetchDashboardRulesConfig(obraId: string): Promise<DashboardCurveRuleConfig | null> {
  const response = await fetch(`/api/obras/${obraId}/rules`);
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  if (!payload || typeof payload !== "object") return null;
  return (payload as { config?: DashboardCurveRuleConfig }).config ?? null;
}

function buildDashboardCurvePoints(
  curvaRows: DashboardTablaRow[],
  resumenRows: DashboardTablaRow[],
  obraLabel: string,
  options?: { curveStartPeriod?: string | null }
): DashboardCurvePoint[] {
  const byPeriod = new Map<string, DashboardCurvePoint>();
  const curveStartPeriod =
    typeof options?.curveStartPeriod === "string" && /^\d{4}-\d{2}$/.test(options.curveStartPeriod)
      ? options.curveStartPeriod
      : null;

  curvaRows.forEach((row, index) => {
    const rowData = row.data ?? null;
    const periodRaw = getRowFieldValueByCandidates(rowData, ["periodo", "periodo_key", "period", "mes"], [["periodo"], ["mes"]]);
    const avancePlan = parsePercent(
      getRowFieldValueByCandidates(
        rowData,
        ["avance_acumulado_pct", "avance_acum_pct", "avance_acumulado", "avance_pct"],
        [["avance", "acum"], ["acumulado"]]
      )
    );
    if (!periodRaw || avancePlan == null) return;
    const parsed = parseMonthOrder(periodRaw, index);
    const mesN = normalizeText(String(periodRaw)).match(/mes\s*(\d{1,3})/);
    const periodFromMesN =
      mesN && curveStartPeriod
        ? addMonths(curveStartPeriod, Number.parseInt(mesN[1], 10))
        : null;
    const key =
      periodFromMesN ??
      (parsed.order >= 1000
        ? `${Math.floor(parsed.order / 12)}-${String((parsed.order % 12) + 1).padStart(2, "0")}`
        : `plan-${index}-${normalizeText(parsed.label)}`);
    const keyOrder = periodFromMesN
      ? (() => {
        const [y, m] = periodFromMesN.split("-");
        return Number.parseInt(y, 10) * 12 + (Number.parseInt(m, 10) - 1);
      })()
      : parsed.order;
    const current = byPeriod.get(key);
    const next = current ?? {
      key,
      label: periodFromMesN ? periodLabelFromOrder(keyOrder, parsed.label) : periodLabelFromOrder(parsed.order, parsed.label),
      obra: obraLabel,
      planPct: null,
      realPct: null,
      sortOrder: keyOrder,
    };
    next.planPct = Math.max(0, Math.min(100, avancePlan));
    next.sortOrder = Math.min(next.sortOrder, keyOrder);
    byPeriod.set(key, next);
  });

  resumenRows.forEach((row, index) => {
    const rowData = row.data ?? null;
    const periodRaw =
      getRowFieldValueByCandidates(rowData, ["fecha_certificacion", "fecha", "issued_at", "date"], [["fecha", "cert"], ["fecha"]]) ??
      getRowFieldValueByCandidates(rowData, ["periodo", "periodo_key", "period", "mes"], [["periodo"], ["mes"]]);
    const avanceReal = parsePercent(
      getRowFieldValueByCandidates(
        rowData,
        ["avance_fisico_acumulado_pct", "avance_fisico_acum_pct", "avance_fisico_acumulado", "avance_acumulado_pct", "avance_acum_pct"],
        [["avance", "fisico", "acum"], ["avance", "acum"]]
      )
    );
    if (!periodRaw || avanceReal == null) return;
    const parsed = parseMonthOrder(periodRaw, index);
    const key = parsed.order >= 1000 ? `${Math.floor(parsed.order / 12)}-${String((parsed.order % 12) + 1).padStart(2, "0")}` : `real-${index}-${normalizeText(parsed.label)}`;
    const current = byPeriod.get(key);
    const next = current ?? {
      key,
      label: periodLabelFromOrder(parsed.order, parsed.label),
      obra: obraLabel,
      planPct: null,
      realPct: null,
      sortOrder: parsed.order,
    };
    next.realPct = Math.max(0, Math.min(100, avanceReal));
    next.sortOrder = Math.min(next.sortOrder, parsed.order);
    byPeriod.set(key, next);
  });

  return [...byPeriod.values()]
    .filter((p) => p.planPct != null || p.realPct != null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export default function Home() {
  const queryClient = useQueryClient();
  const { prefetchObra } = usePrefetchObra();
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newObra, setNewObra] = useState({
    designacionYUbicacion: "",
    entidadContratante: "",
    mesBasicoDeContrato: "",
    iniciacion: "",
  });
  const [newlyAddedObraId, setNewlyAddedObraId] = useState<string | null>(null);
  const [selectedPreviewObraId, setSelectedPreviewObraId] = useState<string | null>(null);
  const [previewCurveObraId, setPreviewCurveObraId] = useState<string | null>(null);
  const [isCompanyFileUploading, setIsCompanyFileUploading] = useState(false);
  const [insurancePreviewRows, setInsurancePreviewRows] = useState<InsurancePolicyPreviewRow[]>([]);
  const [isInsuranceImportOpen, setIsInsuranceImportOpen] = useState(false);
  const [isInsuranceImporting, setIsInsuranceImporting] = useState(false);
  const [dashboardTab, setDashboardTab] = useState("resumen");
  const companyFileInputRef = useRef<HTMLInputElement | null>(null);
  const insuranceFileInputRef = useRef<HTMLInputElement | null>(null);
  const previousObrasRef = useRef<string[]>([]);

  // Use React Query for data fetching with caching
  const { data, isLoading: loading } = useQuery({
    queryKey: ['obras-dashboard'],
    queryFn: fetchObrasData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const obras = data?.obras ?? EMPTY_OBRAS;
  const isAuthenticated = data?.isAuthenticated ?? false;
  const recentObras = useMemo(() => obras.slice(0, 6), [obras]);
  const companyFilesQuery = useQuery({
    queryKey: ["company-files"],
    enabled: isAuthenticated && dashboardTab === "archivos",
    queryFn: async () => {
      const response = await fetch("/api/company-files");
      if (!response.ok) throw new Error("No se pudieron cargar los archivos globales");
      return (await response.json()) as { files: CompanyFile[] };
    },
  });
  const selectedPreviewObra = useMemo(
    () => recentObras.find((obra) => obra.id === selectedPreviewObraId) ?? recentObras[0] ?? null,
    [recentObras, selectedPreviewObraId]
  );

  useEffect(() => {
    setPreviewCurveObraId(null);
    if (!selectedPreviewObra?.id) return;

    const timeoutId = window.setTimeout(() => {
      setPreviewCurveObraId(selectedPreviewObra.id);
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [selectedPreviewObra?.id]);

  // Calculate statistics from the cached data
  const stats = useMemo<DashboardStats | null>(() => {
    if (!data?.isAuthenticated) return null;
    const obrasData = data.obras;
    const total = obrasData.length;
    if (total === 0) {
      return {
        total: 0,
        inProgress: 0,
        completed: 0,
        avgProgress: 0,
        totalContractValue: 0,
        totalCertifiedValue: 0,
        totalPendingValue: 0,
        obrasAtRisk: 0,
        obrasOnTrack: 0,
        avgTimeProgress: 0,
        totalSurface: 0,
      };
    }
    const completed = obrasData.filter(o => o.porcentaje >= 100).length;
    const inProgress = total - completed;
    const avgProgress = obrasData.reduce((sum, o) => sum + o.porcentaje, 0) / total;
    const totalContractValue = obrasData.reduce((sum, o) => sum + (o.contratoMasAmpliaciones || 0), 0);
    const totalCertifiedValue = obrasData.reduce((sum, o) => sum + (o.certificadoALaFecha || 0), 0);
    const totalPendingValue = obrasData.reduce((sum, o) => sum + (o.saldoACertificar || 0), 0);

    // Calculate obras at risk (time progress > work progress by more than 15%)
    const activeObras = obrasData.filter(o => o.porcentaje < 100);
    const obrasAtRisk = activeObras.filter(o => {
      const timeProgress = o.plazoTotal > 0 ? (o.plazoTransc / o.plazoTotal) * 100 : 0;
      return timeProgress > o.porcentaje + 15;
    }).length;
    const obrasOnTrack = inProgress - obrasAtRisk;

    // Average time progress for active obras
    const avgTimeProgress = activeObras.length > 0
      ? activeObras.reduce((sum, o) => {
        const timeProgress = o.plazoTotal > 0 ? (o.plazoTransc / o.plazoTotal) * 100 : 0;
        return sum + timeProgress;
      }, 0) / activeObras.length
      : 0;

    return {
      total,
      inProgress,
      completed,
      avgProgress,
      totalContractValue,
      totalCertifiedValue,
      totalPendingValue,
      obrasAtRisk,
      obrasOnTrack,
      avgTimeProgress,
      totalSurface: 0,
    };
  }, [data]);

  // Get obras that need attention (behind schedule or low progress)
  const alertObras = useMemo(() => {
    if (!data?.obras) return [];
    return data.obras.filter(o => {
      if (o.porcentaje >= 100) return false;
      const timeProgress = o.plazoTotal > 0 ? (o.plazoTransc / o.plazoTotal) * 100 : 0;
      return timeProgress > o.porcentaje + 10; // More than 10% behind
    });
  }, [data]);

  // Chart data: Progress distribution
  const progressDistributionData = useMemo(() => {
    if (!data?.obras || data.obras.length === 0) return [];
    const ranges = [
      { name: '0-25%', min: 0, max: 25, fill: '#ef4444' },
      { name: '26-50%', min: 26, max: 50, fill: '#f59e0b' },
      { name: '51-75%', min: 51, max: 75, fill: '#3b82f6' },
      { name: '76-99%', min: 76, max: 99, fill: '#22c55e' },
      { name: '100%', min: 100, max: 100, fill: '#10b981' },
    ];
    return ranges.map(range => ({
      name: range.name,
      value: data.obras.filter(o =>
        range.max === 100
          ? o.porcentaje >= 100
          : o.porcentaje >= range.min && o.porcentaje <= range.max
      ).length,
      fill: range.fill,
    })).filter(d => d.value > 0);
  }, [data]);

  // Chart data: Top obras by contract value
  const topObrasByValueData = useMemo(() => {
    if (!data?.obras || data.obras.length === 0) return [];
    return [...data.obras]
      .sort((a, b) => b.contratoMasAmpliaciones - a.contratoMasAmpliaciones)
      .slice(0, 5)
      .map(o => ({
        name: o.designacionYUbicacion.length > 20
          ? o.designacionYUbicacion.substring(0, 20) + '...'
          : o.designacionYUbicacion,
        contrato: o.contratoMasAmpliaciones / 1000000, // In millions
        certificado: o.certificadoALaFecha / 1000000,
      }));
  }, [data]);

  // Pie chart data for status
  const statusPieData = useMemo(() => {
    if (!stats) return [];
    const data = [];
    if (stats.completed > 0) data.push({ name: 'Completadas', value: stats.completed, fill: '#22c55e' });
    if (stats.obrasOnTrack > 0) data.push({ name: 'En tiempo', value: stats.obrasOnTrack, fill: '#3b82f6' });
    if (stats.obrasAtRisk > 0) data.push({ name: 'En riesgo', value: stats.obrasAtRisk, fill: '#f59e0b' });
    return data;
  }, [stats]);

  const selectedPreviewCurveQuery = useQuery({
    queryKey: ["dashboard", "obra-preview-curve", previewCurveObraId ?? "none"],
    enabled: Boolean(previewCurveObraId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const obraId = previewCurveObraId!;
      const obraLabel =
        recentObras.find((obra) => obra.id === obraId)?.designacionYUbicacion ??
        selectedPreviewObra?.designacionYUbicacion ??
        "";
      const [tablasRes, rulesConfig] = await Promise.all([
        fetch(`/api/obras/${obraId}/tablas`),
        fetchDashboardRulesConfig(obraId),
      ]);
      if (!tablasRes.ok) {
        return { points: [] as DashboardCurvePoint[], hasCurvaRows: false, hasResumenRows: false };
      }
      const tablasPayload = await tablasRes.json().catch(() => ({}));
      const tablas = (Array.isArray(tablasPayload?.tablas) ? tablasPayload.tablas : []) as DashboardObraTabla[];

      let curvaPlanTabla: DashboardObraTabla | null = null;
      let pmcResumenTabla: DashboardObraTabla | null = null;
      for (const tabla of tablas) {
        const keySet = new Set((tabla.columns ?? []).map((c) => c.fieldKey).filter(Boolean));
        const normalizedName = normalizeText(tabla.name ?? "");
        const isCurvaByColumns =
          keySet.has("periodo") &&
          keySet.has("avance_mensual_pct") &&
          keySet.has("avance_acumulado_pct");
        const isResumenByColumns =
          keySet.has("avance_fisico_acumulado_pct") &&
          (keySet.has("periodo") || keySet.has("fecha_certificacion"));

        if ((isCurvaByColumns || normalizedName.includes("curva plan")) && !curvaPlanTabla) {
          curvaPlanTabla = tabla;
        }
        if ((isResumenByColumns || normalizedName.includes("pmc resumen")) && !pmcResumenTabla) {
          pmcResumenTabla = tabla;
        }
      }

      if (!curvaPlanTabla || !pmcResumenTabla) {
        return { points: [] as DashboardCurvePoint[], hasCurvaRows: false, hasResumenRows: false };
      }

      const [curvaRows, resumenRows] = await Promise.all([
        fetchDashboardTablaRowsAll(obraId, curvaPlanTabla.id),
        fetchDashboardTablaRowsAll(obraId, pmcResumenTabla.id),
      ]);

      const hasCurvaRows = curvaRows.length > 0;
      const hasResumenRows = resumenRows.length > 0;
      if (!hasCurvaRows || !hasResumenRows) {
        return { points: [] as DashboardCurvePoint[], hasCurvaRows, hasResumenRows };
      }

      return {
        points: buildDashboardCurvePoints(curvaRows, resumenRows, obraLabel, {
          curveStartPeriod: rulesConfig?.mappings?.curve?.plan?.startPeriod ?? null,
        }),
        hasCurvaRows,
        hasResumenRows,
      };
    },
  });

  // Track newly added obras for animation (avoid setState during render)
  useEffect(() => {
    const currentIds = obras.map((o) => o.id);
    if (previousObrasRef.current.length > 0) {
      const newObraId = currentIds.find((id) => !previousObrasRef.current.includes(id));
      if (newObraId && newlyAddedObraId !== newObraId) {
        setNewlyAddedObraId(newObraId);
        const timeoutId = window.setTimeout(() => setNewlyAddedObraId(null), 3000);
        previousObrasRef.current = currentIds;
        return () => window.clearTimeout(timeoutId);
      }
    }
    previousObrasRef.current = currentIds;
  }, [obras, newlyAddedObraId]);

  const handleCreateObra = async () => {
    if (!newObra.designacionYUbicacion.trim() || !newObra.entidadContratante.trim()) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    try {
      setIsCreating(true);

      // Get current obras to determine next N
      const response = await fetch("/api/obras");
      const data = await response.json();
      const currentObras = data.detalleObras || [];
      const maxN = currentObras.reduce((max: number, o: Obra) => Math.max(max, o.n), 0);

      // Create new obra
      const obraToCreate = {
        n: maxN + 1,
        designacionYUbicacion: newObra.designacionYUbicacion.trim(),
        entidadContratante: newObra.entidadContratante.trim(),
        mesBasicoDeContrato: newObra.mesBasicoDeContrato.trim() || "Sin especificar",
        iniciacion: newObra.iniciacion.trim() || "Sin especificar",
        supDeObraM2: 0,
        contratoMasAmpliaciones: 0,
        certificadoALaFecha: 0,
        saldoACertificar: 0,
        segunContrato: 0,
        prorrogasAcordadas: 0,
        plazoTotal: 0,
        plazoTransc: 0,
        porcentaje: 0,
      };

      const saveResponse = await fetch("/api/obras/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [obraToCreate],
        }),
      });

      if (!saveResponse.ok) throw new Error("Error al crear la obra");

      toast.success("Obra creada exitosamente");
      setDialogOpen(false);
      setNewObra({
        designacionYUbicacion: "",
        entidadContratante: "",
        mesBasicoDeContrato: "",
        iniciacion: "",
      });
      // Invalidate cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['obras-dashboard'] });
    } catch (error) {
      console.error("Error creating obra:", error);
      toast.error("Error al crear la obra");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCompanyFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setIsCompanyFileUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/company-files", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo subir el archivo");
      await queryClient.invalidateQueries({ queryKey: ["company-files"] });
      toast.success("Archivo global subido");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir el archivo");
    } finally {
      setIsCompanyFileUploading(false);
      if (companyFileInputRef.current) companyFileInputRef.current.value = "";
    }
  };

  const previewInsuranceImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setIsInsuranceImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/insurance-policies/import", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo leer el Excel");
      setInsurancePreviewRows(Array.isArray(payload.preview) ? payload.preview : []);
      setIsInsuranceImportOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el Excel");
    } finally {
      setIsInsuranceImporting(false);
      if (insuranceFileInputRef.current) insuranceFileInputRef.current.value = "";
    }
  };

  const confirmInsuranceImport = async () => {
    const validRows = insurancePreviewRows.filter((row) => row.policyNumber && row.errors.length === 0);
    const response = await fetch("/api/insurance-policies/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "No se pudo importar");
      return;
    }
    setIsInsuranceImportOpen(false);
    setInsurancePreviewRows([]);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["insurance-policies", "global"] }),
      queryClient.invalidateQueries({ queryKey: ["insurance-policies", "macro"] }),
    ]);
    toast.success(`${payload.imported ?? 0} polizas importadas`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Cargando?</p>
        </div>
      </div>
    );
  }

  // Show welcome page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className={cn("min-h-screen", DS.page)}>
        <div className="mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center md:text-left"
          >
            <Framed className="rounded-3xl" innerClassName="rounded-3xl">
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div className="space-y-5">
                  <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-1 text-stone-700 shadow-none">
                    <Sparkles className="size-3.5 text-stone-700" />
                    Bienvenido
                  </Badge>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                      Todo lo que necesitás para coordinar tus obras en un solo lugar.
                    </h1>
                    <p className="max-w-2xl text-sm text-stone-600 sm:text-base">
                      Simplificamos la carga de documentos, el seguimiento de certificados y la comunicacion entre equipos.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button asChild size="lg" className="gap-2 rounded-xl bg-stone-900 text-white hover:bg-stone-800">
                      <Link href="/excel" prefetch={false}>
                        Entrar al panel
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className={cn(DS.panel, "p-4 sm:p-5")}>
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Resumen del sistema
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        ["Documentos", "Carpetas, previews y OCR"],
                        ["Tablas", "Carga y edicion tipo Excel"],
                        ["Reportes", "Consolidacion y control"],
                      ].map(([title, subtitle]) => (
                        <div key={title} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                          <p className="text-sm font-medium text-stone-900">{title}</p>
                          <p className="text-xs text-stone-500">{subtitle}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Framed>
          </m.div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <m.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Framed className="h-full" innerClassName="h-full">
                  <div className="h-full space-y-3 p-5">
                    <div className="flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-stone-900">{title}</p>
                      <p className="text-sm text-stone-600">{description}</p>
                    </div>
                  </div>
                </Framed>
              </m.div>
            ))}
          </div>

          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-center md:text-left"
          >
            <Framed>
              <div className="p-5">
                <p className="text-base font-semibold text-stone-900">
                  Primera vez en la plataforma
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  Explora tus documentos en la pestana Documentos o consulta los certificados activos desde el panel principal.
                </p>
              </div>
            </Framed>
          </m.div>
        </div>
      </div>
    );
  }

  // Show dashboard for authenticated users
  return (
    <div className={cn("relative min-h-full overflow-hidden", DS.page)}>
      <div className="mx-auto w-full space-y-2 px-3 py-4 sm:px-6 sm:py-8 lg:px-8 lg:pt-6">
        {/* Header */}
        <m.div
          data-wizard-target="dashboard-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid gap-4 p-4 sm:p-2 lg:grid-cols-[1.1fr_auto] lg:items-start">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                Panel de Control
              </h1>
              <p className="text-sm text-stone-500">
                Resumen de {stats?.total || 0} obras cargadas
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-start">
              <div className="flex flex-wrap items-center gap-2">
                <DemoPageTour
                  flow={dashboardOverviewTour}
                  buttonClassName="rounded-2xl border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                />
                <DemoPageTour
                  flow={demoConclusionTour}
                  finishLabel="¡Listo!"
                />
                <DemoPageTour
                  flow={presentacionDashboardTour}
                  finishLabel="Ver la cartera de obras →"
                  nextHref="/excel?tour=demo-cartera"
                />
                <DemoPageTour
                  flow={presentacionCierreTour}
                  finishLabel="¡Listo!"
                />
                <div className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-cyan-50">
                    <Activity className="size-3.5 text-cyan-700" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs uppercase tracking-wide text-stone-600">Activas</span>
                    <span className="text-sm font-semibold text-stone-900 tabular-nums">{stats?.inProgress || 0}</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle2 className="size-3.5 text-emerald-700" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs uppercase tracking-wide text-stone-600">Completadas</span>
                    <span className="text-sm font-semibold text-stone-900 tabular-nums">{stats?.completed || 0}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </m.div>

        {/* Main Grid — 3 equal columns */}
        <input
          ref={companyFileInputRef}
          type="file"
          className="hidden"
          onChange={handleCompanyFileSelected}
        />
        <input
          ref={insuranceFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={previewInsuranceImport}
        />

        <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="min-w-0 space-y-2">
          <div className="min-w-0 overflow-x-auto">
            <TabsList className="h-auto min-w-max justify-start gap-1 rounded-xl border border-stone-200 bg-white p-1">
              <TabsTrigger value="resumen" className="h-9 gap-2 rounded-lg px-4 text-xs font-medium">
                <BarChart3 className="size-3.5" />
                Resumen
              </TabsTrigger>
              <TabsTrigger value="archivos" className="h-9 gap-2 rounded-lg px-4 text-xs font-medium">
                <FolderKanban className="size-3.5" />
                Archivos globales
              </TabsTrigger>
              <TabsTrigger value="polizas" className="h-9 gap-2 rounded-lg px-4 text-xs font-medium">
                <ShieldCheck className="size-3.5" />
                Polizas de seguro
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resumen" className="m-0">
            <div data-wizard-target="dashboard-stats" className="grid gap-6 lg:grid-cols-3">

              {/* Combined: Obras Recientes + Vista Previa */}
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="lg:col-span-2"
              >
                <Framed>
                  <Card className="overflow-hidden rounded-xl border-0 bg-transparent pt-0 shadow-none gap-0">
                    <CardHeader className={cn(DS.cardHeader, "py-4 pt-5 pb-3! border-none")}>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <CardTitle className="text-base font-semibold text-stone-900">Obras y Vista Previa</CardTitle>
                            <CardDescription className="mt-0.5 text-xs text-stone-500">
                              Selecciona una obra para ver su resumen operativo y curva de avance
                            </CardDescription>
                          </div>
                          <div className="text-xs text-stone-500">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" className="gap-2 bg-stone-900 text-white hover:bg-stone-800" onClick={() => setDialogOpen(true)}>
                                <Plus className="size-4" />
                                Nueva Obra
                              </Button>
                              <QuickFormDialog
                                open={dialogOpen}
                                onOpenChange={setDialogOpen}
                                title="Crear Nueva Obra"
                                description="Completa la informacion basica de la obra. Podras agregar mas detalles despues."
                                variant="dashboard"
                                fields={[
                                  {
                                    key: "designacionYUbicacion",
                                    label: "Designacion y Ubicacion",
                                    type: "text",
                                    required: true,
                                    placeholder: "Ej: Construccion de edificio - Av. Corrientes 1234",
                                  },
                                  {
                                    key: "entidadContratante",
                                    label: "Entidad Contratante",
                                    type: "text",
                                    required: true,
                                    placeholder: "Ej: Municipalidad de Buenos Aires",
                                  },
                                  {
                                    key: "mesBasicoDeContrato",
                                    label: "Mes Basico de Contrato",
                                    type: "text",
                                    placeholder: "Ej: Enero 2024",
                                  },
                                  {
                                    key: "iniciacion",
                                    label: "Fecha de Iniciacion",
                                    type: "text",
                                    placeholder: "Ej: Marzo 2024",
                                  },
                                ] as QuickFormField[]}
                                values={newObra}
                                onChange={(key: string, value: string) => setNewObra({ ...newObra, [key]: value })}
                                onSubmit={handleCreateObra}
                                isSubmitting={isCreating}
                                submitLabel={isCreating ? "Creando..." : "Crear Obra"}
                                cancelLabel="Cancelar"
                                renderFooter={({ onClose, onSubmit, isSubmitting }: { onClose: () => void; onSubmit: () => void; isSubmitting: boolean }) => (
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      onClick={onClose}
                                      disabled={isSubmitting}
                                      className="rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={onSubmit}
                                      disabled={isSubmitting}
                                      className="flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 bg-stone-800 text-white hover:bg-stone-700 active:bg-stone-900 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      {isCreating ? "Creando..." : "Crear Obra"}
                                    </button>
                                  </div>
                                )}
                              />
                              <Button asChild variant="outline" size="sm" className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50">
                                <Link href="/excel" prefetch={true}>
                                  Ver Todas
                                  <ArrowRight className="ml-1.5 size-3.5" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-0">
                      {obras.length === 0 ? (
                        <div className="rounded-xl border border-stone-200 bg-white px-6 py-16 text-center space-y-4">
                          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50/60">
                            <FolderKanban className="size-8 text-stone-400" />
                          </div>
                          <div className="space-y-2">
                            <p className="font-medium text-stone-700">No hay obras registradas</p>
                            <p className="max-w-sm mx-auto text-sm text-stone-500">
                              Crea tu primera obra para comenzar a gestionar tus proyectos. Si acabas de registrarte,{" "}
                              <Link href="/onboarding" className="text-stone-800 hover:underline">
                                configura tu organizacion
                              </Link>
                              {" "}primero.
                            </p>
                          </div>
                          <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2 bg-stone-900 text-white hover:bg-stone-800">
                            <Plus className="size-4" />
                            Crear Primera Obra
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                          <div
                            data-wizard-target="dashboard-recent-obras"
                            className="rounded-xl border border-stone-200 bg-white"
                          >
                            <div className="flex items-center justify-between border-b border-stone-200/70 px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-stone-900">Obras Recientes</p>
                                <p className="text-xs text-stone-500">Acceso rapido a tus proyectos</p>
                              </div>
                              <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium text-stone-600">
                                {recentObras.length} visibles
                              </span>
                            </div>
                            <div className="divide-y divide-stone-200/70">
                              <AnimatePresence mode="popLayout">
                                {recentObras.map((obra, index) => {
                                  const timeProgress = obra.plazoTotal > 0 ? (obra.plazoTransc / obra.plazoTotal) * 100 : 0;
                                  const isBehind = timeProgress > obra.porcentaje + 10;
                                  const isSelected = (selectedPreviewObra?.id ?? recentObras[0]?.id) === obra.id;
                                  return (
                                    <m.div
                                      key={obra.id}
                                      initial={newlyAddedObraId === obra.id ? { scale: 0.95, opacity: 0 } : { opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.95, opacity: 0 }}
                                      transition={{ duration: 0.2, delay: index * 0.03 }}
                                      className={`relative ${newlyAddedObraId === obra.id ? 'z-10' : ''}`}
                                    >
                                      {newlyAddedObraId === obra.id && (
                                        <m.div
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: [0, 1, 1, 0] }}
                                          transition={{ duration: 2, times: [0, 0.1, 0.8, 1] }}
                                          className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent pointer-events-none"
                                        />
                                      )}
                                      <div
                                        className={cn(
                                          "group relative flex items-center rounded-xl border transition-colors m-1",
                                          isSelected
                                            ? "border-orange-200 bg-orange-50/60 ring-1 ring-orange-200/80 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                                            : "border-transparent hover:bg-stone-50/60"
                                        )}
                                      >
                                        {isSelected && (
                                          <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-orange-500" />
                                        )}
                                        <button
                                          type="button"
                                          onPointerDown={() => setSelectedPreviewObraId(obra.id)}
                                          onClick={() => setSelectedPreviewObraId(obra.id)}
                                          className={cn(
                                            "flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer p-3",
                                            isSelected ? "pl-4" : ""
                                          )}
                                        >
                                          <div className={cn(
                                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 font-mono text-xs font-semibold text-stone-600 transition-colors group-hover:bg-stone-200",
                                            isSelected ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200" : ""
                                          )}>
                                            {obra.n}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <p className={cn("truncate text-sm font-medium", isSelected ? "text-stone-950" : "text-stone-900")}>
                                                {obra.designacionYUbicacion}
                                              </p>
                                              {obra.porcentaje >= 100 && (
                                                <Badge variant="secondary" className="h-5 shrink-0 rounded-full border border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 shadow-none">
                                                  Completada
                                                </Badge>
                                              )}
                                              {isBehind && obra.porcentaje < 100 && (
                                                <Badge variant="secondary" className="h-5 shrink-0 rounded-full border border-amber-200 bg-amber-50 text-[10px] text-amber-700 shadow-none">
                                                  Atrasada
                                                </Badge>
                                              )}
                                            </div>
                                            <p className={cn("truncate text-xs", isSelected ? "text-orange-700/80" : "text-stone-500")}>
                                              {obra.entidadContratante}
                                            </p>
                                          </div>
                                        </button>
                                        <Button
                                          asChild
                                          variant="ghost"
                                          size="sm"
                                          className={cn(
                                            "mr-1 h-8 px-2 hover:text-orange-700",
                                            isSelected ? "text-orange-700 hover:bg-orange-100/70" : "text-stone-600 hover:bg-stone-50"
                                          )}
                                        >
                                          <Link href={`/excel/${obra.id}`} onMouseEnter={() => prefetchObra(obra.id)}>
                                            <ArrowRight className="size-4" />
                                          </Link>
                                        </Button>
                                      </div>
                                    </m.div>
                                  );
                                })}
                              </AnimatePresence>
                            </div>
                          </div>

                          <div
                            data-wizard-target="dashboard-preview"
                            className="rounded-xl border border-stone-200 bg-white"
                          >
                            <div className="border-b border-stone-200/70 px-4 py-3">
                              <p className="text-sm font-semibold text-stone-900">Vista Previa</p>
                              <p className="mt-0.5 truncate text-xs text-stone-500">
                                {selectedPreviewObra ? selectedPreviewObra.designacionYUbicacion : "Selecciona una obra"}
                              </p>
                            </div>
                            <div className="p-4">
                              {selectedPreviewObra ? (() => {
                                const timeProgress = selectedPreviewObra.plazoTotal > 0
                                  ? (selectedPreviewObra.plazoTransc / selectedPreviewObra.plazoTotal) * 100
                                  : 0;
                                const scheduleProgress = Math.round(timeProgress);
                                const avancePct = Math.max(0, Math.min(100, Math.round(selectedPreviewObra.porcentaje || 0)));
                                const plazoPct = Math.max(0, Math.min(100, scheduleProgress));
                                const financialProgress = selectedPreviewObra.contratoMasAmpliaciones > 0
                                  ? Math.round((selectedPreviewObra.certificadoALaFecha / selectedPreviewObra.contratoMasAmpliaciones) * 100)
                                  : 0;
                                const saldoProgressPct = Math.max(0, Math.min(100, financialProgress));
                                const previewCurvePoints = selectedPreviewCurveQuery.data?.points ?? [];
                                const hasCurvaRows = selectedPreviewCurveQuery.data?.hasCurvaRows ?? false;
                                const hasResumenRows = selectedPreviewCurveQuery.data?.hasResumenRows ?? false;
                                const showCurveChart = hasCurvaRows && hasResumenRows && previewCurvePoints.length > 0;
                                return (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                      <div className="rounded-xl border border-stone-200 bg-white p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-[10px] uppercase tracking-wide text-stone-500">Avance</p>
                                          <span className="text-[11px] font-semibold tabular-nums text-stone-700">{avancePct}%</span>
                                        </div>
                                        <p className="mt-1 text-base font-semibold text-stone-900">{selectedPreviewObra.porcentaje.toFixed(0)}%</p>
                                        <div className="mt-2 h-2 w-full rounded-full bg-stone-100">
                                          <div
                                            className="h-2 rounded-full bg-cyan-600 transition-all"
                                            style={{ width: `${avancePct}%` }}
                                          />
                                        </div>
                                        <p className="mt-1 text-[10px] text-stone-500">0–100% físico</p>
                                      </div>

                                      <div className="rounded-xl border border-stone-200 bg-white p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-[10px] uppercase tracking-wide text-stone-500">Plazo</p>
                                          <span className="text-[11px] font-semibold tabular-nums text-stone-700">{plazoPct}%</span>
                                        </div>
                                        <p className="mt-1 text-base font-semibold text-stone-900">{scheduleProgress}%</p>
                                        <div className="mt-2 h-2 w-full rounded-full bg-stone-100">
                                          <div
                                            className="h-2 rounded-full bg-blue-600 transition-all"
                                            style={{ width: `${plazoPct}%` }}
                                          />
                                        </div>
                                        <p className="mt-1 text-[10px] text-stone-500">Tiempo transcurrido</p>
                                      </div>

                                      <div className="rounded-xl border border-stone-200 bg-white p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-[10px] uppercase tracking-wide text-stone-500">Saldo</p>
                                          <span className="text-[11px] font-semibold tabular-nums text-stone-700">{saldoProgressPct}%</span>
                                        </div>
                                        <p className="mt-1 truncate text-sm font-semibold text-stone-900">
                                          {formatCompactCurrency(selectedPreviewObra.saldoACertificar || 0)}
                                        </p>
                                        <div className="mt-2 h-2 w-full rounded-full bg-stone-100">
                                          <div
                                            className="h-2 rounded-full bg-emerald-600 transition-all"
                                            style={{ width: `${saldoProgressPct}%` }}
                                          />
                                        </div>
                                        <p className="mt-1 text-[10px] text-stone-500">Certificado / contrato</p>
                                      </div>
                                    </div>

                                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="text-[11px] uppercase tracking-wide text-stone-500">Curva de avance</p>
                                        {selectedPreviewCurveQuery.isFetching ? (
                                          <span className="text-[11px] text-stone-500">Cargando…</span>
                                        ) : null}
                                      </div>
                                      {showCurveChart ? (
                                        <div className="h-full w-full -mt-2">
                                          <AdvanceCurveChart points={previewCurvePoints} />
                                        </div>
                                      ) : (
                                        <div className="rounded border border-dashed border-stone-200 p-3 text-xs text-stone-500">
                                          {selectedPreviewCurveQuery.isFetching
                                            ? "Buscando tablas y datos de Curva Plan + PMC Resumen…"
                                            : "La obra seleccionada no tiene datos suficientes en Curva Plan y PMC Resumen para mostrar la curva."}
                                        </div>
                                      )}
                                    </div>

                                    <Button asChild size="sm" className="w-full bg-stone-900 text-white hover:bg-stone-800">
                                      <Link href={`/excel/${selectedPreviewObra.id}`}>
                                        Abrir panel de la obra
                                        <ArrowRight className="ml-1.5 size-3.5" />
                                      </Link>
                                    </Button>
                                  </div>
                                );
                              })() : (
                                <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
                                  <div className="size-12 rounded-xl bg-stone-100 flex items-center justify-center">
                                    <BarChart3 className="size-6 text-stone-400" />
                                  </div>
                                  <p className="text-sm text-stone-500 max-w-[180px]">
                                    Selecciona una obra de la lista para ver los detalles
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Framed>
              </m.div>

              {/* Column 3: Alerts + Distribution Chart */}
              <div className="space-y-4 lg:col-span-1">
                {alertObras.length > 0 && (
                  <m.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    <Framed className="border-amber-200/70 bg-amber-50/40">
                      <Card className="rounded-xl bg-white/90 pt-0 shadow-none gap-0">
                        <CardHeader className="pb-2 pt-5">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="size-4 text-amber-600" />
                            <CardTitle className="text-sm font-medium text-amber-800">Requieren Atencion</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-[260px] overflow-y-auto">
                          {alertObras.map((obra) => {
                            const timeProgress = obra.plazoTotal > 0 ? (obra.plazoTransc / obra.plazoTotal) * 100 : 0;
                            const delay = Math.round(timeProgress - obra.porcentaje);
                            return (
                              <Link
                                key={obra.id}
                                href={`/excel/${obra.id}`}
                                className="block rounded-xl border border-amber-100 bg-white/90 px-3 py-2.5 transition-colors hover:bg-stone-50"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium text-stone-900 truncate">{obra.designacionYUbicacion}</p>
                                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                    {delay}% atrasada
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <div className="mb-1 flex items-center justify-between text-[10px] text-stone-500">
                                    <span>Avance vs tiempo</span>
                                    <span className="tabular-nums">{obra.porcentaje}% / {timeProgress.toFixed(0)}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-amber-100">
                                    <div
                                      className="h-1.5 rounded-full bg-amber-500"
                                      style={{ width: `${Math.max(0, Math.min(100, timeProgress))}%` }}
                                    />
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </Framed>
                  </m.div>
                )}

                {obras.length > 0 && progressDistributionData.length > 0 && (
                  <m.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                  >
                    <Framed>
                      <Card className="rounded-2xl border-0 bg-transparent pt-0 shadow-none gap-2">
                        <CardHeader className={cn(DS.cardHeader, "pb-2 pt-5")}>
                          <CardTitle className="text-sm font-semibold text-stone-900">Distribucion de Avance</CardTitle>
                          <CardDescription className="text-xs text-stone-500">Obras por rango de progreso</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className={cn(DS.panel, "p-3")}>
                            <SimpleBarList data={progressDistributionData} labelSuffix=" obras" />
                          </div>
                        </CardContent>
                      </Card>
                    </Framed>
                  </m.div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="archivos" className="m-0">
            <CompanyFilesPanel
              files={companyFilesQuery.data?.files ?? []}
              isLoading={companyFilesQuery.isLoading}
              isUploading={isCompanyFileUploading}
              onPickFile={() => companyFileInputRef.current?.click()}
              onDownload={(file) => {
                window.open(`/api/company-files/access?path=${encodeURIComponent(file.path)}&download=1`, "_blank", "noopener,noreferrer");
              }}
              onRefresh={() => void companyFilesQuery.refetch()}
            />
          </TabsContent>

          <TabsContent value="polizas" className="m-0">
            <GlobalInsurancePoliciesPanel
              isImporting={isInsuranceImporting}
              onPickFile={() => insuranceFileInputRef.current?.click()}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["insurance-policies"] })}
              obras={obras}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={isInsuranceImportOpen} onOpenChange={setIsInsuranceImportOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Revisar importacion de polizas</DialogTitle>
            </DialogHeader>
            <div className="max-h-[520px] overflow-auto border border-stone-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead>Accion</TableHead>
                    <TableHead>Obra detectada</TableHead>
                    <TableHead>Poliza</TableHead>
                    <TableHead>Seccion</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insurancePreviewRows.map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.policyNumber ?? "sin-poliza"}`}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>
                        <span className={row.importAction === "update"
                          ? "inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700"
                          : "inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700"}
                        >
                          {row.importAction === "update" ? "Edita existente" : "Crea nueva"}
                        </span>
                      </TableCell>
                      <TableCell>{row.obraLabel || "-"}</TableCell>
                      <TableCell>{row.policyNumber || "-"}</TableCell>
                      <TableCell>{row.section || "-"}</TableCell>
                      <TableCell>{row.coveragePeriod || row.endDate || "-"}</TableCell>
                      <TableCell className={row.errors.length ? "text-red-600" : "text-stone-500"}>
                        {row.errors.length ? row.errors.join(" ") : "OK"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {insurancePreviewRows.some((row) => row.errors.length > 0) ? (
              <p className="text-xs text-stone-500">
                Las filas con errores se omiten. Si no hay obra detectada, la póliza se importa como No se encontró obra adecuada.
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInsuranceImportOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => void confirmInsuranceImport()}
                disabled={!insurancePreviewRows.some((row) => row.policyNumber && row.errors.length === 0)}
              >
                Confirmar importacion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
