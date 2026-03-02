import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  BadgeDollarSign,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Folder,
  Hash,
  Landmark,
  LineChart,
  Pencil,
  Percent,
  Plus,
  Ruler,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";

type TopTab = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
};

type ModeTab = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
};

const topTabs: TopTab[] = [
  { label: "General", icon: Building2, active: true },
  { label: "Flujo", icon: Workflow },
  { label: "Documentos", icon: Folder },
];

const modeTabs: ModeTab[] = [
  { label: "Vista previa", icon: Eye, active: true },
  { label: "Edición", icon: Pencil },
  { label: "Memoria", icon: FileText },
];

type ObraTimelineRow = {
  id: string;
  name: string;
  startMonth: Date;
  endMonthExclusive: Date;
  durationMonths: number;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ShellCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-[#e8e8e8] bg-white",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#fafafa]">
            <Icon className="size-3.5 text-[#999]" />
          </div>
          <h2 className="text-[13px] font-semibold text-[#1a1a1a]">{title}</h2>
        </div>
        {action}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

function KpiItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#aaa]">{label}</p>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-[#1a1a1a] sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function MiniField({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#f0f0f0] p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[#aaa]">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-[13px] font-medium leading-snug text-[#1a1a1a]">{value}</div>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function monthDiff(start: Date, endExclusive: Date) {
  return (
    (endExclusive.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (endExclusive.getUTCMonth() - start.getUTCMonth())
  );
}

function parseObraStart(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function loadObrasTimeline(): Promise<{
  rows: ObraTimelineRow[];
  months: Date[];
  currentMonthIndex: number | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { rows: [], months: [], currentMonthIndex: null };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const { tenantId } = await resolveTenantMembership(
    (memberships ?? []) as { tenant_id: string | null; role: string | null }[],
  );

  if (!tenantId) return { rows: [], months: [], currentMonthIndex: null };

  const { data: obras } = await supabase
    .from("obras")
    .select("id, designacion_y_ubicacion, iniciacion, plazo_total")
    .eq("tenant_id", tenantId)
    .order("iniciacion", { ascending: true });

  const rows = (obras ?? [])
    .map((obra) => {
      const startDate = parseObraStart(obra.iniciacion);
      const duration = Math.max(1, Number(obra.plazo_total) || 0);
      if (!startDate) return null;
      const startMonth = startOfMonth(startDate);
      const endMonthExclusive = addMonths(startMonth, duration);
      return {
        id: obra.id as string,
        name: (obra.designacion_y_ubicacion as string) || "Obra",
        startMonth,
        endMonthExclusive,
        durationMonths: duration,
      } satisfies ObraTimelineRow;
    })
    .filter((row): row is ObraTimelineRow => Boolean(row))
    .sort((a, b) => a.startMonth.getTime() - b.startMonth.getTime());

  if (rows.length === 0) return { rows, months: [], currentMonthIndex: null };

  const minStart = rows.reduce(
    (min, row) => (row.startMonth < min ? row.startMonth : min),
    rows[0].startMonth,
  );
  const maxEndExclusive = rows.reduce(
    (max, row) => (row.endMonthExclusive > max ? row.endMonthExclusive : max),
    rows[0].endMonthExclusive,
  );

  const totalMonths = Math.max(1, monthDiff(minStart, maxEndExclusive));
  const months = Array.from({ length: totalMonths }, (_, i) => addMonths(minStart, i));
  const nowMonth = startOfMonth(new Date());
  const currentMonthIndex = monthDiff(minStart, nowMonth);

  return {
    rows,
    months,
    currentMonthIndex:
      currentMonthIndex >= 0 && currentMonthIndex < months.length ? currentMonthIndex : null,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardTestPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const timeline = await loadObrasTimeline();

  const timelineYears = Array.from(
    new Set(timeline.months.map((month) => month.getUTCFullYear())),
  ).sort((a, b) => a - b);

  const requestedYearRaw = resolvedSearchParams?.year;
  const requestedYearText = Array.isArray(requestedYearRaw) ? requestedYearRaw[0] : requestedYearRaw;
  const isAllYearsMode = requestedYearText === "all";
  const requestedYear = Array.isArray(requestedYearRaw)
    ? Number(requestedYearRaw[0])
    : Number(requestedYearRaw);
  const currentUtcYear = new Date().getUTCFullYear();
  const selectedYear = timelineYears.includes(requestedYear)
    ? requestedYear
    : timelineYears.includes(currentUtcYear)
      ? currentUtcYear
      : (timelineYears[0] ?? currentUtcYear);
  const selectedYearIndex = timelineYears.indexOf(selectedYear);
  const prevYear = selectedYearIndex > 0 ? timelineYears[selectedYearIndex - 1] : null;
  const nextYear =
    selectedYearIndex >= 0 && selectedYearIndex < timelineYears.length - 1
      ? timelineYears[selectedYearIndex + 1]
      : null;

  const visibleMonths = isAllYearsMode
    ? timeline.months
    : timeline.months.filter((month) => month.getUTCFullYear() === selectedYear);
  const visibleStart = visibleMonths[0] ?? null;
  const visibleEndExclusive = visibleStart ? addMonths(visibleStart, visibleMonths.length) : null;
  const visibleCurrentMonthIndex =
    visibleMonths.length > 0
      ? visibleMonths.findIndex(
          (m) =>
            m.getUTCFullYear() === new Date().getUTCFullYear() &&
            m.getUTCMonth() === new Date().getUTCMonth(),
        )
      : -1;

  return (
    <div className="min-h-screen bg-[#f5f5f5] px-10 py-8">
      <div className="flex flex-col gap-5">

        {/* Top bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-[#e8e8e8] bg-white px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
          {/* Tab nav */}
          <div className="flex items-center gap-1">
            {topTabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition",
                  tab.active
                    ? "bg-[#1a1a1a] text-white"
                    : "text-[#999] hover:bg-[#f5f5f5] hover:text-[#555]",
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Segment control */}
          <div className="inline-flex items-center rounded-xl border border-[#e8e8e8] bg-[#f5f5f5] p-1">
            {modeTabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-medium transition",
                  tab.active
                    ? "bg-white text-[#1a1a1a] shadow-sm"
                    : "text-[#999] hover:text-[#555]",
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-10">

            {/* Row 1: Progress + Curve */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <ShellCard
                title="Avance"
                icon={Percent}
                className="lg:col-span-4"
                action={
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#f97316]">
                    Progreso
                  </span>
                }
              >
                <div className="flex h-full flex-col items-center justify-start gap-4">
                  <div
                    className="grid size-44 place-items-center rounded-full"
                    style={{
                      background: "conic-gradient(#f97316 0 360deg, #f0f0f0 360deg)",
                    }}
                  >
                    <div className="grid size-28 place-items-center rounded-full bg-white text-center">
                      <div>
                        <div className="text-4xl font-semibold tracking-tight text-[#1a1a1a]">
                          100%
                        </div>
                        <div className="text-[11px] text-[#aaa]">Completado</div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full rounded-lg border border-[#f0f0f0] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">
                      Alertas detectadas
                    </p>
                    <p className="mt-1.5 text-[13px] text-[#999]">
                      No hay alertas abiertas para esta obra.
                    </p>
                  </div>
                </div>
              </ShellCard>

              <ShellCard
                title="Curva de avance"
                icon={LineChart}
                className="lg:col-span-8"
                bodyClassName="h-[274px] p-4"
              >
                <div className="flex h-full flex-col rounded-lg border border-dashed border-[#e8e8e8] p-4">
                  <div className="rounded-lg border border-[#f0f0f0] px-4 py-3 text-[13px] text-[#bbb]">
                    No se detectaron tablas Curva Plan + PMC Resumen con datos suficientes.
                  </div>
                  <div className="mt-4 flex-1 rounded-lg bg-[linear-gradient(to_right,rgba(240,240,240,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(240,240,240,0.6)_1px,transparent_1px)] bg-[size:24px_24px]" />
                </div>
              </ShellCard>
            </div>

            {/* Row 2: Info General + Datos Financieros */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <ShellCard
                title="Información General"
                icon={Landmark}
                className="lg:col-span-6"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MiniField
                    icon={Building2}
                    label="Designación y ubicación"
                    value="NUEVA- SECTOR 1- SECTOR II- 4° ETAPA- HOSPITAL SUSSINI-"
                  />
                  <MiniField icon={Landmark} label="Entidad contratante" value="S.U.E.P" />
                  <MiniField icon={Calendar} label="Mes básico" value="16/06/2025" />
                  <MiniField icon={Calendar} label="Iniciación" value="17/01/2025" />
                  <MiniField icon={Hash} label="N° de obra" value="#1" />
                  <MiniField icon={Ruler} label="Superficie" value="0 m²" />
                </div>
              </ShellCard>

              <ShellCard
                title="Datos Financieros"
                icon={BadgeDollarSign}
                className="lg:col-span-6"
              >
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <KpiItem label="Contrato + ampliaciones" value="$ 0" />
                    <KpiItem label="Certificado a la fecha" value="$ 0" />
                    <KpiItem label="Saldo a certificar" value="$ 0" />
                  </div>
                  <div className="h-px bg-[#f0f0f0]" />
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      ["Según contrato", "10 meses"],
                      ["Prórrogas", "17 meses"],
                      ["Plazo total", "27 meses"],
                      ["Transcurrido", "19 meses"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[11px] font-medium text-[#aaa]">{label}</p>
                        <p className="mt-1 text-[13px] font-semibold text-[#1a1a1a]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </ShellCard>
            </div>

            {/* Timeline */}
            <ShellCard
              title="Timeline de obras"
              icon={Clock3}
              action={
                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] text-[#bbb] sm:inline">
                    {timeline.rows.length} obra{timeline.rows.length === 1 ? "" : "s"}
                  </span>
                  <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#e8e8e8] bg-white p-0.5">
                    <Link
                      href="/system-design/inspo/dashboard-test"
                      className={cn(
                        "inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium transition",
                        !isAllYearsMode
                          ? "bg-[#f5f5f5] text-[#1a1a1a]"
                          : "text-[#bbb] hover:bg-[#fafafa]",
                      )}
                    >
                      Año
                    </Link>
                    <Link
                      href="/system-design/inspo/dashboard-test?year=all"
                      className={cn(
                        "inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium transition",
                        isAllYearsMode
                          ? "bg-[#f5f5f5] text-[#1a1a1a]"
                          : "text-[#bbb] hover:bg-[#fafafa]",
                      )}
                    >
                      Todos
                    </Link>
                    <span className="mx-0.5 h-4 w-px bg-[#e8e8e8]" />
                    {!isAllYearsMode && prevYear ? (
                      <Link
                        href={`/system-design/inspo/dashboard-test?year=${prevYear}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-[#999] hover:bg-[#fafafa]"
                      >
                        <ChevronLeft className="size-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex size-7 items-center justify-center rounded-md text-[#ddd]">
                        <ChevronLeft className="size-4" />
                      </span>
                    )}
                    <span className="min-w-20 text-center text-[11px] font-semibold text-[#1a1a1a]">
                      {isAllYearsMode
                        ? `${timelineYears[0] ?? selectedYear}–${timelineYears[timelineYears.length - 1] ?? selectedYear}`
                        : selectedYear}
                    </span>
                    {!isAllYearsMode && nextYear ? (
                      <Link
                        href={`/system-design/inspo/dashboard-test?year=${nextYear}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-[#999] hover:bg-[#fafafa]"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex size-7 items-center justify-center rounded-md text-[#ddd]">
                        <ChevronRight className="size-4" />
                      </span>
                    )}
                  </div>
                </div>
              }
            >
              {timeline.rows.length === 0 ||
              timeline.months.length === 0 ||
              visibleMonths.length === 0 ||
              !visibleStart ||
              !visibleEndExclusive ? (
                <div className="rounded-lg border border-dashed border-[#e8e8e8] p-4 text-[13px] text-[#bbb]">
                  No hay obras con fecha de iniciación y plazo total suficientes para armar la
                  timeline.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#e8e8e8]">
                  <div className="max-w-full overflow-x-auto">
                    <div
                      style={{
                        minWidth: `${Math.max(980, 280 + visibleMonths.length * 44)}px`,
                      }}
                    >
                      {/* Month header */}
                      <div
                        className="grid border-b border-[#f0f0f0] bg-white"
                        style={{
                          gridTemplateColumns: `280px repeat(${visibleMonths.length}, minmax(44px, 1fr))`,
                        }}
                      >
                        <div className="sticky left-0 z-10 border-r border-[#f0f0f0] bg-white px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
                          Obra
                        </div>
                        {visibleMonths.map((month, idx) => (
                          <div
                            key={`${month.toISOString()}-${idx}`}
                            className={cn(
                              "border-r border-[#f0f0f0] px-1 py-2.5 text-center text-[11px] font-medium last:border-r-0",
                              visibleCurrentMonthIndex === idx
                                ? "bg-orange-50 text-[#f97316]"
                                : "text-[#bbb]",
                            )}
                          >
                            {formatMonthLabel(month)}
                          </div>
                        ))}
                      </div>

                      {/* Rows */}
                      <div className={cn(isAllYearsMode ? "" : "max-h-[320px] overflow-y-auto")}>
                        {timeline.rows
                          .map((row, rowIndex) => {
                            const overlapStart =
                              row.startMonth > visibleStart ? row.startMonth : visibleStart;
                            const overlapEnd =
                              row.endMonthExclusive < visibleEndExclusive
                                ? row.endMonthExclusive
                                : visibleEndExclusive;
                            const overlapSpan = monthDiff(overlapStart, overlapEnd);
                            if (overlapSpan <= 0) return null;
                            const offset = monthDiff(visibleStart, overlapStart);
                            const span = Math.max(1, overlapSpan);
                            const clippedLeft = row.startMonth < visibleStart;
                            const clippedRight = row.endMonthExclusive > visibleEndExclusive;
                            return (
                              <div
                                key={row.id}
                                className="grid border-b border-[#f0f0f0] last:border-b-0"
                                style={{ gridTemplateColumns: "280px minmax(0,1fr)" }}
                              >
                                <div className="sticky left-0 z-10 flex items-center border-r border-[#f0f0f0] bg-white px-3.5 py-2.5">
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium text-[#1a1a1a]">
                                      {row.name}
                                    </p>
                                    <p className="text-[11px] text-[#bbb]">
                                      {row.durationMonths} mes{row.durationMonths === 1 ? "" : "es"}
                                    </p>
                                  </div>
                                </div>

                                <div
                                  className="relative grid"
                                  style={{
                                    gridTemplateColumns: `repeat(${visibleMonths.length}, minmax(44px, 1fr))`,
                                  }}
                                >
                                  {visibleMonths.map((month, idx) => (
                                    <div
                                      key={`${row.id}-${month.toISOString()}`}
                                      className={cn(
                                        "h-11 border-r border-[#f0f0f0] last:border-r-0",
                                        rowIndex % 2 === 0 ? "bg-white" : "bg-[#fafafa]",
                                        visibleCurrentMonthIndex === idx && "bg-orange-50/40",
                                      )}
                                    />
                                  ))}
                                  <div
                                    className="pointer-events-none absolute top-1/2 h-5 -translate-y-1/2 rounded-lg bg-[#f97316]"
                                    style={{
                                      left: `calc(${offset} * (100% / ${visibleMonths.length}) + 4px)`,
                                      width: `calc(${span} * (100% / ${visibleMonths.length}) - 8px)`,
                                    }}
                                  >
                                    {clippedLeft && (
                                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/90">
                                        &lt;
                                      </span>
                                    )}
                                    {clippedRight && (
                                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/90">
                                        &gt;
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                          .filter(Boolean)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ShellCard>
          </div>

          {/* Sidebar */}
          <ShellCard
            title="Acciones rápidas"
            icon={Zap}
            className="xl:col-span-2"
            bodyClassName="flex min-h-[220px] flex-col gap-3"
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-lg border-[#e8e8e8] bg-white px-3 text-xs text-[#555]"
              >
                Crear
              </Button>
            }
          >
            <div className="rounded-lg border border-dashed border-[#e8e8e8] p-4 text-[13px] text-[#bbb]">
              No hay acciones rápidas todavía. Creá una desde el botón "Crear".
            </div>
            <Button
              variant="outline"
              className="h-9 w-full justify-start gap-2 rounded-xl border-dashed border-[#e8e8e8] bg-white text-[13px] text-[#555]"
            >
              <Plus className="size-4" />
              Nueva acción
            </Button>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}
