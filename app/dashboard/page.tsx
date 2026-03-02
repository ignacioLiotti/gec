'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FolderKanban,
  Plus,
  ShieldCheck,
  Sparkles,
  Activity,
  AlertTriangle,
  Check
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuickFormDialog, type QuickFormField } from "@/components/forms/quick-form-dialog";
import { toast } from "sonner";
import { usePrefetchObra } from "@/lib/use-prefetch-obra";
import { AdvanceCurveChart } from "../excel/[obraId]/tabs/general-tab";
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
    <div className="relative h-[120px] w-[120px] mx-auto">
      <div
        className="h-full w-full rounded-full"
        style={{ backgroundImage: `conic-gradient(${segments.join(", ")})` }}
      />
      <div className="absolute inset-0 m-auto h-[70px] w-[70px] rounded-full bg-card" />
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
  const previousObrasRef = useRef<string[]>([]);

  // Use React Query for data fetching with caching
  const { data, isLoading: loading } = useQuery({
    queryKey: ['obras-dashboard'],
    queryFn: fetchObrasData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const obras = data?.obras ?? [];
  const isAuthenticated = data?.isAuthenticated ?? false;
  const recentObras = useMemo(() => obras.slice(0, 6), [obras]);
  const selectedPreviewObra = useMemo(
    () => recentObras.find((obra) => obra.id === selectedPreviewObraId) ?? recentObras[0] ?? null,
    [recentObras, selectedPreviewObraId]
  );

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
    queryKey: ["dashboard", "obra-preview-curve", selectedPreviewObra?.id ?? "none"],
    enabled: Boolean(selectedPreviewObra?.id),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const obraId = selectedPreviewObra!.id;
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
        points: buildDashboardCurvePoints(curvaRows, resumenRows, selectedPreviewObra!.designacionYUbicacion, {
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

      const saveResponse = await fetch("/api/obras", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detalleObras: [...currentObras, obraToCreate],
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
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Show welcome page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className={cn("min-h-screen", DS.page)}>
        <div className="mx-auto flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center md:text-left"
          >
            <Framed className="rounded-3xl" innerClassName="rounded-3xl">
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div className="space-y-5">
                  <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-1 text-stone-700 shadow-none">
                    <Sparkles className="h-3.5 w-3.5 text-stone-700" />
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
                      <Link href="/excel">
                        Entrar al panel
                        <ArrowRight className="h-4 w-4" />
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
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Framed className="h-full" innerClassName="h-full">
                  <div className="h-full space-y-3 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-stone-900">{title}</p>
                      <p className="text-sm text-stone-600">{description}</p>
                    </div>
                  </div>
                </Framed>
              </motion.div>
            ))}
          </div>

          <motion.div
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
          </motion.div>
        </div>
      </div>
    );
  }

  // Show dashboard for authenticated users
  return (
    <div className={cn("min-h-screen", DS.page)}>
      <div className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-2 lg:pt-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid gap-4 p-4 sm:p-2 lg:grid-cols-[1.1fr_auto] lg:items-start">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900">
                Panel de Control
              </h1>
              <p className="text-sm text-stone-500">
                Resumen de {stats?.total || 0} obras cargadas
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-start">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-50">
                    <Activity className="h-3.5 w-3.5 text-cyan-700" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs uppercase tracking-wide text-stone-600">Activas</span>
                    <span className="text-sm font-semibold text-stone-900 tabular-nums">{stats?.inProgress || 0}</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs uppercase tracking-wide text-stone-600">Completadas</span>
                    <span className="text-sm font-semibold text-stone-900 tabular-nums">{stats?.completed || 0}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>

        {/* Main Grid — 3 equal columns */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Combined: Obras Recientes + Vista Previa */}
          <motion.div
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
                            <Plus className="h-4 w-4" />
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
                            <Link href="/excel">
                              Ver Todas
                              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50/60">
                        <FolderKanban className="h-8 w-8 text-stone-400" />
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
                        <Plus className="h-4 w-4" />
                        Crear Primera Obra
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <div className="rounded-xl border border-stone-200 bg-white">
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
                                <motion.div
                                  key={obra.id}
                                  initial={newlyAddedObraId === obra.id ? { scale: 0.95, opacity: 0 } : { opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.95, opacity: 0 }}
                                  transition={{ duration: 0.2, delay: index * 0.03 }}
                                  className={`relative ${newlyAddedObraId === obra.id ? 'z-10' : ''}`}
                                >
                                  {newlyAddedObraId === obra.id && (
                                    <motion.div
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
                                        <ArrowRight className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-white">
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
                                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </div>
                            );
                          })() : (
                            <div className="flex flex-col items-center justify-center py-14 text-center space-y-3">
                              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center">
                                <BarChart3 className="h-6 w-6 text-stone-400" />
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
          </motion.div>

          {/* Column 3: Alerts + Distribution Chart */}
          <div className="space-y-4 lg:col-span-1">
            {alertObras.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <Framed className="border-amber-200/70 bg-amber-50/40">
                  <Card className="rounded-xl bg-white/90 pt-0 shadow-none gap-0">
                    <CardHeader className="pb-2 pt-5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
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
              </motion.div>
            )}

            {obras.length > 0 && progressDistributionData.length > 0 && (
              <motion.div
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
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
