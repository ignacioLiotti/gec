"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  HeartPulse,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OperationsSnapshot } from "@/lib/admin/operations/types";

import styles from "./operations-console.module.css";
import {
  CostsView,
  HealthView,
  OperationDetail,
  SummaryView,
  TenantsView,
  TraceView,
  UsageView,
} from "./operations-views";

const views = [
  "summary",
  "tenants",
  "usage",
  "costs",
  "trace",
  "health",
] as const;
type View = (typeof views)[number];

const viewLabels: Record<View, string> = {
  summary: "Resumen",
  tenants: "Tenants",
  usage: "Uso",
  costs: "Costos",
  trace: "Trazabilidad",
  health: "Salud y backups",
};

const viewIcons: Record<View, React.ReactNode> = {
  summary: <Gauge size={14} />,
  tenants: <Building2 size={14} />,
  usage: <Activity size={14} />,
  costs: <CircleDollarSign size={14} />,
  trace: <ClipboardList size={14} />,
  health: <HeartPulse size={14} />,
};

function isView(value: string | null): value is View {
  return value !== null && views.some((view) => view === value);
}

export function OperationsClient({
  snapshot,
  synthetic = false,
}: {
  snapshot: OperationsSnapshot;
  synthetic?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const requestedView = searchParams.get("view");
  const view: View = isView(requestedView) ? requestedView : "summary";
  const actorId = searchParams.get("actorId");
  const auditId = searchParams.get("auditId");
  const operationId = searchParams.get("operationId");
  const requestedGrain = searchParams.get("grain");
  const grain: "day" | "week" | "month" =
    requestedGrain === "week" || requestedGrain === "month"
      ? requestedGrain
      : "day";
  const traceQuery = searchParams.get("traceQ") ?? "";
  const traceActor = searchParams.get("traceActor");
  const traceAction = searchParams.get("traceAction");
  const selectedOperation =
    snapshot.operations.find((operation) => operation.id === operationId) ??
    null;

  const navigate = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() =>
      router.push(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  };

  const selectedTenant = snapshot.selection.tenantId ?? "all";
  const generated = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(snapshot.generatedAt));
  const completeThrough = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(snapshot.window.end));

  return (
    <section
      className={styles.console}
      aria-labelledby="operations-title"
      aria-busy={isPending}
    >
      <header className={styles.header}>
        <div>
          <div className={styles.inlineMeta}>
            {synthetic ? (
              <Badge variant="warning">Datos sintéticos</Badge>
            ) : null}
            <Badge variant="neutral">Lectura de operador</Badge>
          </div>
          <h1 className={styles.title} id="operations-title">
            Operaciones de plataforma
          </h1>
          <p className={styles.subtitle}>
            Tenants, cambios auditados, costos registrados, extracciones y
            cobertura técnica en una sola investigación.
          </p>
          <p className={styles.subtitle}>
            Actividad: {snapshot.selection.days} días completos UTC hasta{" "}
            {completeThrough}. Operaciones, costos y auditoría: hasta{" "}
            {generated} UTC; hoy es parcial.
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.field}>
            <label htmlFor="operations-tenant">Tenant</label>
            <NativeSelect
              id="operations-tenant"
              value={selectedTenant}
              onChange={(event) =>
                navigate({
                  tenantId: event.target.value,
                  actorId: null,
                  auditId: null,
                  operationId: null,
                })
              }
            >
              <option value="all">Todos los tenants</option>
              {snapshot.tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className={styles.field}>
            <label htmlFor="operations-days">Período</label>
            <NativeSelect
              id="operations-days"
              value={snapshot.selection.days}
              onChange={(event) =>
                navigate({
                  days: event.target.value,
                  auditId: null,
                  operationId: null,
                })
              }
            >
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
            </NativeSelect>
          </div>
        </div>
      </header>

      <Tabs value={view} onValueChange={(value) => navigate({ view: value })}>
        <TabsList
          className={styles.tabsList}
          aria-label="Vistas de operaciones"
        >
          {views.map((item) => (
            <TabsTrigger key={item} value={item}>
              {viewIcons[item]}
              {viewLabels[item]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="summary">
          <SummaryView snapshot={snapshot} navigate={navigate} />
        </TabsContent>
        <TabsContent value="tenants">
          <TenantsView snapshot={snapshot} navigate={navigate} />
        </TabsContent>
        <TabsContent value="usage">
          <UsageView
            snapshot={snapshot}
            actorId={actorId}
            grain={grain}
            navigate={navigate}
          />
        </TabsContent>
        <TabsContent value="costs">
          <CostsView snapshot={snapshot} navigate={navigate} />
        </TabsContent>
        <TabsContent value="trace">
          <TraceView
            snapshot={snapshot}
            auditId={auditId}
            query={traceQuery}
            actorId={traceActor}
            action={traceAction}
            navigate={navigate}
          />
        </TabsContent>
        <TabsContent value="health">
          <HealthView snapshot={snapshot} navigate={navigate} />
        </TabsContent>
      </Tabs>

      {selectedOperation ? (
        <div className="mt-4">
          <OperationDetail
            operation={selectedOperation}
            snapshot={snapshot}
            close={() => navigate({ operationId: null })}
          />
        </div>
      ) : operationId ? (
        <div className={`${styles.empty} mt-4`}>
          <strong>Operación fuera de la muestra actual</strong>
          <p>
            El identificador no existe dentro del tenant y período cargados.
          </p>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {isPending
          ? "Actualizando la consola"
          : `${viewLabels[view]}. Datos actualizados.`}
      </p>
    </section>
  );
}
