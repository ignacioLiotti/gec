import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Obra = {
  n: number;
  name: string;
  entity: string;
  status: "atrasada" | "completada" | null;
  avance: number;
  plazo: number;
  saldo: number;
  saldoLabel: string;
};

type AlertObra = {
  name: string;
  avance: number;
  tiempo: number;
  delay: number;
};

type DistributionEntry = {
  label: string;
  value: number;
  fill: string;
};

const obras: Obra[] = [
  { n: 1, name: "HOSPITAL SAN ANTONIO — Pabellón Norte", entity: "MOySP", status: "atrasada", avance: 68, plazo: 82, saldo: 45, saldoLabel: "$4.2M" },
  { n: 2, name: "CONSTRUCCIÓN DE 15 VIVIENDAS — Sector B", entity: "IN.VI.CO", status: "completada", avance: 100, plazo: 100, saldo: 100, saldoLabel: "$0" },
  { n: 3, name: "MUSEO HISTÓRICO YAVÍ — Restauración", entity: "MOySP", status: null, avance: 54, plazo: 58, saldo: 48, saldoLabel: "$3.1M" },
  { n: 4, name: "CENTRO INTERPRETACIÓN CULTURAL — Salta", entity: "MOySP", status: "atrasada", avance: 44, plazo: 65, saldo: 38, saldoLabel: "$5.7M" },
  { n: 5, name: "ACONDICIONAMIENTO MINISTERIO SEGURIDAD", entity: "Min. de Seguridad", status: null, avance: 71, plazo: 74, saldo: 62, saldoLabel: "$1.8M" },
  { n: 6, name: "CONSTRUCCIÓN JIN N° 12 — Jujuy", entity: "Min. de Educación", status: null, avance: 38, plazo: 42, saldo: 30, saldoLabel: "$7.2M" },
];

const alertObras: AlertObra[] = [
  { name: "HOSPITAL SAN ANTONIO", avance: 68, tiempo: 82, delay: 14 },
  { name: "CENTRO INTERPRETACIÓN CULTURAL", avance: 44, tiempo: 65, delay: 21 },
  { name: "NUEVA SEDE SECTOR 1", avance: 51, tiempo: 62, delay: 11 },
];

const distribution: DistributionEntry[] = [
  { label: "0–25%", value: 8, fill: "#ef4444" },
  { label: "26–50%", value: 12, fill: "#f97316" },
  { label: "51–75%", value: 19, fill: "#3b82f6" },
  { label: "76–99%", value: 14, fill: "#22c55e" },
  { label: "100%", value: 42, fill: "#10b981" },
];

const SELECTED_OBRA = obras[0];
const MAX_BAR = 42;

function StatusDot({ status }: { status: Obra["status"] }) {
  if (!status) return null;
  if (status === "completada")
    return (
      <span className="shrink-0 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[10px] font-medium text-[#16a34a]">
        Completada
      </span>
    );
  return (
    <span className="shrink-0 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[10px] font-medium text-[#ea580c]">
      Atrasada
    </span>
  );
}

function StatPanel({
  icon: Icon,
  label,
  value,
  barColor,
  pct,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  barColor: string;
  pct: number;
  sub: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center border-r border-[#f0f0f0] px-5 py-4 text-center last:border-r-0">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#e8e8e8] bg-[#fafafa]">
        {Icon}
      </div>
      <p className="mb-3 text-[12px] text-[#aaa]">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight text-[#1a1a1a]">{value}</p>
      <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#f0f0f0]">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <p className="mt-1.5 text-[10px] text-[#bbb]">{sub}</p>
    </div>
  );
}

function AdvanceCurve() {
  return (
    <div className="flex flex-1 flex-col px-4 pb-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#bbb]">Curva de Avance</p>
      <svg width="100%" height="120" viewBox="0 0 400 120" preserveAspectRatio="none" className="w-full">
        <defs>
          <linearGradient id="planG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="realG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[24, 48, 72, 96].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#f5f5f5" strokeWidth="1" />
        ))}
        <path d="M0,116 C55,102 95,80 155,57 C205,38 270,18 345,5 L400,2 L400,120 L0,120 Z" fill="url(#planG)" />
        <path d="M0,116 C55,102 95,80 155,57 C205,38 270,18 345,5 L400,2" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="5,3" />
        <path d="M0,116 C48,110 86,97 134,78 C173,62 212,49 260,38 L270,36 L270,120 L0,120 Z" fill="url(#realG)" />
        <path d="M0,116 C48,110 86,97 134,78 C173,62 212,49 260,38 L270,36" fill="none" stroke="#f97316" strokeWidth="2" />
        <circle cx="270" cy="36" r="4" fill="#f97316" stroke="white" strokeWidth="2" />
        {(["100%", "75%", "50%", "25%"] as const).map((l, i) => (
          <text key={l} x="3" y={20 + i * 24} fontFamily="Inter" fontSize="9" fill="#ccc">{l}</text>
        ))}
      </svg>
      <div className="flex gap-4 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="h-px w-4 border-t-2 border-dashed border-blue-400" />
          <span className="text-[10px] text-[#bbb]">Plan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded-full bg-orange-500" />
          <span className="text-[10px] text-[#bbb]">Real</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardHomePage() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] px-10 py-8">
      <div className="flex flex-col gap-5">

        {/* Header */}
        <header className="flex items-center justify-between rounded-xl border border-[#e8e8e8] bg-white px-6 py-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a]">
              Panel de Control
            </h1>
            <p className="mt-0.5 text-sm text-[#999]">Resumen de 56 obras cargadas</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stat chips */}
            <div className="flex items-center gap-2 rounded-full border border-[#e8e8e8] bg-white px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-cyan-500" />
              <span className="text-[11px] uppercase tracking-wide text-[#999]">Activas</span>
              <span className="text-sm font-semibold tabular-nums text-[#1a1a1a]">14</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#e8e8e8] bg-white px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] uppercase tracking-wide text-[#999]">Completadas</span>
              <span className="text-sm font-semibold tabular-nums text-[#1a1a1a]">42</span>
            </div>
            <Button className="gap-2 rounded-lg bg-[#1a1a1a] text-white hover:bg-[#333]">
              <Plus className="h-4 w-4" />
              Nueva Obra
            </Button>
            <Button variant="outline" className="gap-1.5 rounded-lg border-[#e8e8e8] bg-white text-[#555]">
              Ver Todas <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-5">

          {/* Left 2 cols */}
          <div className="col-span-2 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
            {/* Card header */}
            <div className="border-b border-[#f0f0f0] px-5 py-4">
              <p className="text-sm font-semibold text-[#1a1a1a]">Obras y Vista Previa</p>
              <p className="mt-0.5 text-xs text-[#bbb]">Seleccioná una obra para ver su resumen operativo</p>
            </div>
            {/* Inner split */}
            <div className="grid grid-cols-[1fr_1.1fr]">
              {/* Obras list */}
              <div className="border-r border-[#f0f0f0]">
                <div className="flex items-center justify-between border-b border-[#f5f5f5] px-4 py-3">
                  <p className="text-[13px] font-semibold text-[#1a1a1a]">Obras Recientes</p>
                  <span className="rounded-full border border-[#e8e8e8] bg-[#fafafa] px-2.5 py-0.5 text-[10px] font-medium text-[#aaa]">
                    6 visibles
                  </span>
                </div>
                <div className="p-2">
                  {obras.map((obra) => {
                    const isSelected = obra.n === SELECTED_OBRA.n;
                    return (
                      <div
                        key={obra.n}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-xl border p-2.5 transition",
                          isSelected
                            ? "border-[#fed7aa] bg-[#fff7ed]"
                            : "border-transparent hover:bg-[#fafafa]",
                        )}
                      >
                        {isSelected && (
                          <div className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-orange-500" />
                        )}
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold",
                            isSelected
                              ? "bg-[#ffedd5] text-orange-700"
                              : "bg-[#f5f5f5] text-[#aaa]",
                          )}
                        >
                          {obra.n}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={cn("truncate text-[13px] font-medium", isSelected ? "text-[#1a1a1a]" : "text-[#333]")}>
                              {obra.name}
                            </p>
                            <StatusDot status={obra.status} />
                          </div>
                          <p className={cn("truncate text-[11px]", isSelected ? "text-orange-600" : "text-[#bbb]")}>
                            {obra.entity}
                          </p>
                        </div>
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", isSelected ? "text-orange-500" : "text-[#ccc] group-hover:text-[#999]")}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vista Previa */}
              <div className="flex flex-col">
                <div className="border-b border-[#f5f5f5] px-4 py-3">
                  <p className="text-[13px] font-semibold text-[#1a1a1a]">Vista Previa</p>
                  <p className="truncate text-[11px] text-[#bbb]">{SELECTED_OBRA.name}</p>
                </div>
                {/* Stats row */}
                <div className="flex border-b border-[#f0f0f0]">
                  <StatPanel
                    icon={<BarChart3 className="h-4 w-4 text-[#bbb]" />}
                    label="Avance físico"
                    value={`${SELECTED_OBRA.avance}%`}
                    barColor="#0891b2"
                    pct={SELECTED_OBRA.avance}
                    sub="0–100% físico"
                  />
                  <StatPanel
                    icon={<Clock className="h-4 w-4 text-[#bbb]" />}
                    label="Plazo"
                    value={`${SELECTED_OBRA.plazo}%`}
                    barColor="#2563eb"
                    pct={SELECTED_OBRA.plazo}
                    sub="Tiempo transcurrido"
                  />
                  <StatPanel
                    icon={<CheckCircle2 className="h-4 w-4 text-[#bbb]" />}
                    label="Certificado"
                    value={SELECTED_OBRA.saldoLabel}
                    barColor="#059669"
                    pct={SELECTED_OBRA.saldo}
                    sub="Sobre contrato"
                  />
                </div>
                {/* Curve */}
                <AdvanceCurve />
                {/* CTA */}
                <div className="border-t border-[#f0f0f0] p-4">
                  <Button className="w-full gap-2 rounded-lg bg-[#1a1a1a] text-white hover:bg-[#333]">
                    Abrir panel de la obra <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="flex flex-col gap-4">
            {/* Alerts */}
            <div className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
              <div className="flex items-center gap-2 border-b border-[#f0f0f0] px-4 py-3.5">
                <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
                <p className="text-[13px] font-semibold text-[#1a1a1a]">Requieren Atención</p>
              </div>
              <div className="flex flex-col divide-y divide-[#f5f5f5]">
                {alertObras.map((a) => (
                  <div key={a.name} className="px-4 py-3 transition hover:bg-[#fafafa]">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="truncate text-[12px] font-medium text-[#1a1a1a]">{a.name}</p>
                      <span className="shrink-0 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[10px] font-medium text-[#ea580c]">
                        {a.delay}% atrás
                      </span>
                    </div>
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[#bbb]">
                      <span>Avance / Tiempo</span>
                      <span className="tabular-nums">{a.avance}% / {a.tiempo}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-[#f5f5f5]">
                      <div className="h-1 rounded-full bg-[#f97316]" style={{ width: `${a.tiempo}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribution */}
            <div className="flex-1 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
              <div className="border-b border-[#f0f0f0] px-4 py-3.5">
                <p className="text-[13px] font-semibold text-[#1a1a1a]">
                  <span className="text-[#f97316]">56</span> obras por avance
                </p>
                <p className="mt-0.5 text-[11px] text-[#bbb]">Distribución por rango de progreso</p>
              </div>
              <div className="flex flex-col divide-y divide-[#f5f5f5]">
                {distribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-10 shrink-0 text-[11px] font-medium tabular-nums text-[#aaa]">{d.label}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-[#f5f5f5]" style={{ height: "8px" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round((d.value / MAX_BAR) * 100)}%`, backgroundColor: d.fill }}
                      />
                    </div>
                    <span className="w-12 text-right text-[11px] tabular-nums text-[#aaa]">{d.value} obras</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
