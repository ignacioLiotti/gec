import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  DatabaseBackup,
  ExternalLink,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ActivityRow,
  AuditChange,
  AuditFieldChange,
  ObservedOperation,
  OperationsSnapshot,
  SourceStatus,
} from "@/lib/admin/operations/types";
import type { OperationsRecoveryStatus } from "@/lib/operations-recovery";

import styles from "./operations-console.module.css";

type Navigate = (changes: Record<string, string | null>) => void;

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

const sourceLabels: Record<SourceStatus["name"], string> = {
  tenants: "Tenants",
  memberships: "Membresías",
  profiles: "Perfiles",
  audit: "Auditoría",
  usage: "Medición de uso",
  ocr: "Extracciones",
};

const costLabels: Record<OperationsSnapshot["costs"][number]["kind"], string> =
  {
    ai_tokens: "Tokens de IA",
    storage_bytes: "Bytes almacenados",
    whatsapp_messages: "Mensajes de WhatsApp",
  };

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatMoney(value: number | null) {
  return value === null ? "Desconocido" : moneyFormatter.format(value);
}

function formatDuration(value: number | null) {
  if (value === null) return "Sin muestra";
  if (value < 1_000) return `${value} ms`;
  return `${(value / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} s`;
}

function tenantName(snapshot: OperationsSnapshot, tenantId: string) {
  return (
    snapshot.tenants.find((tenant) => tenant.id === tenantId)?.name ?? tenantId
  );
}

function sourceAvailable(
  snapshot: OperationsSnapshot,
  name: SourceStatus["name"],
  period: SourceStatus["period"],
) {
  return snapshot.sources.some(
    (source) =>
      source.name === name &&
      source.period === period &&
      source.status !== "unavailable",
  );
}

function statusBadge(status: ObservedOperation["status"]) {
  const config = {
    completed: {
      label: "Completada",
      variant: "success" as const,
      icon: <CheckCircle2 />,
    },
    failed: {
      label: "Fallida",
      variant: "destructive" as const,
      icon: <AlertTriangle />,
    },
    pending: {
      label: "Pendiente",
      variant: "warning" as const,
      icon: <Clock3 />,
    },
    processing: {
      label: "Procesando",
      variant: "info" as const,
      icon: <CircleDashed />,
    },
  }[status];
  return (
    <Badge leadingIcon={config.icon} variant={config.variant}>
      {config.label}
    </Badge>
  );
}

function sourceBadge(source: SourceStatus) {
  if (source.status === "unavailable")
    return <Badge variant="destructive">No disponible</Badge>;
  if (source.status === "partial" || source.truncated)
    return <Badge variant="warning">Cobertura parcial</Badge>;
  return <Badge variant="success">Disponible</Badge>;
}

function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statDetail}>{detail}</div>
    </div>
  );
}

export function CoverageNotice({ snapshot }: { snapshot: OperationsSnapshot }) {
  const incomplete = snapshot.sources.filter(
    (source) => source.status !== "available" || source.truncated,
  );
  return (
    <div className={styles.notice} role="note">
      <div>
        <strong>Muestra observada, no analítica completa</strong>
        <p className={styles.muted}>
          Cada métrica distingue cambios auditados de solicitudes OCR observadas.
          La muestra no representa todo el uso del producto.
        </p>
      </div>
      {snapshot.sources.length === 0 ? (
        <Badge variant="destructive">Sin cobertura informada</Badge>
      ) : incomplete.length > 0 ? (
        <Badge variant="warning">
          {incomplete.length} coberturas incompletas
        </Badge>
      ) : (
        <Badge variant="info">Fuentes consultadas disponibles</Badge>
      )}
    </div>
  );
}

export function SummaryView({
  snapshot,
  navigate,
}: {
  snapshot: OperationsSnapshot;
  navigate: Navigate;
}) {
  const tenantsAvailable = sourceAvailable(snapshot, "tenants", "inventory");
  const membershipsAvailable = sourceAvailable(
    snapshot,
    "memberships",
    "inventory",
  );
  const auditAvailable = sourceAvailable(snapshot, "audit", "current");
  const usageAvailable = sourceAvailable(snapshot, "usage", "current");
  const jobsAvailable =
    usageAvailable || sourceAvailable(snapshot, "ocr", "current");
  const activeActors = snapshot.tenants.reduce(
    (sum, tenant) => sum + tenant.activeActors,
    0,
  );
  const knownCost = snapshot.costs.reduce(
    (sum, cost) => sum + (cost.knownUsd ?? 0),
    0,
  );
  const hasKnownCost = snapshot.costs.some((cost) => cost.knownUsd !== null);
  const unpriced = snapshot.costs.reduce(
    (sum, cost) => sum + cost.unpricedEvents,
    0,
  );
  const comparable = snapshot.tenants.filter(
    (tenant) => tenant.hasFullWindow,
  ).length;
  return (
    <div className={styles.view}>
      <CoverageNotice snapshot={snapshot} />
      <div className={styles.stats}>
        <Stat
          label="Tenants visibles"
          value={tenantsAvailable ? snapshot.tenants.length : "Desconocido"}
          detail={
            tenantsAvailable
              ? `${comparable} con ventana completa`
              : "Inventario no disponible"
          }
        />
        <Stat
          label="Actores por tenant"
          value={auditAvailable ? activeActors : "Desconocido"}
          detail={
            auditAvailable
              ? "Suma por tenant; una cuenta puede repetirse"
              : "Auditoría no disponible"
          }
        />
        <Stat
          label="Trabajos observados"
          value={jobsAvailable ? snapshot.health.observedJobs : "Desconocido"}
          detail={
            jobsAvailable
              ? `${snapshot.health.failed} fallidos`
              : "Fuentes de trabajos no disponibles"
          }
        />
        <Stat
          label="Estimación registrada conocida"
          value={
            usageAvailable
              ? formatMoney(hasKnownCost ? knownCost : null)
              : "Desconocido"
          }
          detail={
            !usageAvailable
              ? "Medición de uso no disponible"
              : unpriced
                ? `${unpriced} eventos sin precio; subtotal parcial`
                : "No equivale a factura conciliada"
          }
        />
      </div>
      <DailyTrend snapshot={snapshot} />
      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle>Comparación por tenant</CardTitle>
          <CardDescription>
            La comparación anterior solo aparece cuando ambas ventanas tienen
            cobertura comparable.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {!tenantsAvailable ? (
            <EmptyState title="Inventario de tenants no disponible">
              La fuente no respondió. No hay base para mostrar cero tenants.
            </EmptyState>
          ) : snapshot.tenants.length === 0 ? (
            <EmptyState title="Sin tenants visibles">
              El alcance autorizado no devolvió tenants para esta lectura.
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Miembros</TableHead>
                  <TableHead>Actores</TableHead>
                  <TableHead>Cambios</TableHead>
                  <TableHead>Trabajos</TableHead>
                  <TableHead>Costo conocido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <button
                        className={styles.tableButton}
                        type="button"
                        onClick={() =>
                          navigate({ tenantId: tenant.id, view: "tenants" })
                        }
                      >
                        {tenant.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      {membershipsAvailable ? tenant.members : "Desconocido"}
                    </TableCell>
                    <TableCell>
                      {auditAvailable ? tenant.activeActors : "Desconocido"}
                    </TableCell>
                    <TableCell>
                      <span>
                        {auditAvailable ? tenant.auditChanges : "Desconocido"}
                      </span>
                      {tenant.hasFullWindow ? (
                        <span className={styles.muted}>
                          {" "}
                          · antes {tenant.previousAuditChanges}
                        </span>
                      ) : (
                        <span className={styles.muted}> · sin comparación</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {jobsAvailable ? tenant.observedJobs : "Desconocido"}
                      {jobsAvailable && tenant.failedJobs ? (
                        <Badge className="ml-2" variant="destructive">
                          {tenant.failedJobs} fallidos
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {usageAvailable
                        ? formatMoney(tenant.knownUsd)
                        : "Desconocido"}
                      {usageAvailable && tenant.unpricedEvents ? (
                        <div className={styles.muted}>
                          {tenant.unpricedEvents} sin precio
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DailyTrend({ snapshot }: { snapshot: OperationsSnapshot }) {
  const auditUnavailable = !sourceAvailable(snapshot, "audit", "current");
  const max = Math.max(1, ...snapshot.daily.map((day) => day.auditChanges));
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle>Cambios auditados por día UTC</CardTitle>
        <CardDescription>
          {snapshot.daily.length > 0 && !auditUnavailable ? (
            <span>
              {snapshot.daily[0].date} al{" "}
              {snapshot.daily[snapshot.daily.length - 1].date}
              {" · "}máximo{" "}
              {Math.max(...snapshot.daily.map((day) => day.auditChanges))}{" "}
              cambios/día.{" "}
            </span>
          ) : null}
          Días completos; cero significa que no hubo registros observados en la
          muestra.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.cardContent}>
        {auditUnavailable ? (
          <EmptyState title="Auditoría no disponible">
            La fuente no respondió. No hay base para dibujar una tendencia en
            cero.
          </EmptyState>
        ) : snapshot.daily.length === 0 ? (
          <EmptyState title="Sin serie diaria">
            La fuente disponible no devolvió días observados para esta ventana.
          </EmptyState>
        ) : (
          <div
            className={styles.trend}
            role="img"
            aria-label={`Cambios auditados diarios: ${snapshot.daily.map((day) => `${day.date}, ${day.auditChanges}`).join("; ")}`}
          >
            {snapshot.daily.map((day) => (
              <div
                key={day.date}
                className={styles.trendColumn}
                title={`${dayFormatter.format(new Date(`${day.date}T00:00:00Z`))}: ${day.auditChanges} cambios auditados`}
              >
                <span
                  style={
                    {
                      "--value": `${day.auditChanges === 0 ? 0 : Math.max(3, (day.auditChanges / max) * 100)}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TenantsView({
  snapshot,
  navigate,
}: {
  snapshot: OperationsSnapshot;
  navigate: Navigate;
}) {
  if (!sourceAvailable(snapshot, "tenants", "inventory")) {
    return (
      <EmptyState title="Inventario de tenants no disponible">
        La fuente no respondió. No hay base para mostrar una lista vacía ni
        conteos en cero.
      </EmptyState>
    );
  }
  const selected = snapshot.selection.tenantId
    ? snapshot.tenants.find(
        (tenant) => tenant.id === snapshot.selection.tenantId,
      )
    : null;
  const people = selected
    ? snapshot.people.filter((person) => person.tenantId === selected.id)
    : [];
  return (
    <div className={styles.view}>
      <div className={styles.grid2}>
        <Card className={styles.card}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle>Tenants en alcance</CardTitle>
            <CardDescription>
              Seleccioná un tenant para mantenerlo durante la investigación.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.cardContent}>
            <div className={styles.list}>
              {snapshot.tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  type="button"
                  className={`${styles.listButton} ${selected?.id === tenant.id ? styles.selected : ""}`}
                  onClick={() => navigate({ tenantId: tenant.id })}
                >
                  <strong>{tenant.name}</strong>
                  <span className={styles.buttonMeta}>
                    <Users size={14} /> {tenant.members} miembros ·{" "}
                    {tenant.activeActors} actores · {tenant.auditChanges}{" "}
                    cambios
                  </span>
                </button>
              ))}
            </div>
            {snapshot.tenants.length === 0 ? (
              <EmptyState title="Sin tenants">
                No hay inventario visible en el alcance autorizado.
              </EmptyState>
            ) : null}
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle>{selected?.name ?? "Detalle del tenant"}</CardTitle>
            <CardDescription>
              {selected
                ? "Personas observadas en la muestra de auditoría."
                : "Elegí un tenant para ver su muestra de personas."}
            </CardDescription>
            {selected ? (
              <CardAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ view: "usage" })}
                >
                  Ver uso <ArrowRight />
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {!selected ? (
              <EmptyState title="Sin tenant seleccionado">
                La vista de plataforma no mezcla personas entre tenants.
              </EmptyState>
            ) : people.length === 0 ? (
              <EmptyState title="Sin personas observadas">
                No se observaron actores con cambios auditados en esta ventana.
                Esto no prueba inactividad total.
              </EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Cambios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell>
                        <button
                          type="button"
                          className={styles.tableButton}
                          onClick={() =>
                            navigate({ view: "usage", actorId: person.id })
                          }
                        >
                          {person.name}
                        </button>
                      </TableCell>
                      <TableCell>{person.role ?? "Sin rol visible"}</TableCell>
                      <TableCell>{person.auditChanges}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function UsageView({
  snapshot,
  actorId,
  grain,
  navigate,
}: {
  snapshot: OperationsSnapshot;
  actorId: string | null;
  grain: "day" | "week" | "month";
  navigate: Navigate;
}) {
  const rows = snapshot.activity.filter(
    (row) => !actorId || row.actorId === actorId,
  );
  const selectedActor = actorId
    ? (snapshot.people.find((person) => person.id === actorId)?.name ??
      "Actor seleccionado")
    : null;
  const auditUnavailable = !sourceAvailable(snapshot, "audit", "current");
  const usageUnavailable = !sourceAvailable(snapshot, "usage", "current");
  return (
    <div className={styles.view}>
      <div className={styles.notice}>
        <div>
          <strong>
            {selectedActor
              ? `Muestra individual · ${selectedActor}`
              : "Actividad observada del alcance"}
          </strong>
          <p className={styles.muted}>
            La métrica de cada fila indica si cuenta solicitudes OCR iniciadas o
            mutaciones persistidas. Día, semana y mes solo reagrupan la misma
            evidencia UTC.
          </p>
        </div>
        <div className={styles.inlineMeta}>
          {actorId ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ actorId: null })}
            >
              Volver al tenant
            </Button>
          ) : null}
          <NativeSelect
            aria-label="Agrupar actividad"
            value={grain}
            onChange={(event) => navigate({ grain: event.target.value })}
          >
            <option value="day">Día UTC</option>
            <option value="week">Semana UTC</option>
            <option value="month">Mes UTC</option>
          </NativeSelect>
        </div>
      </div>
      {auditUnavailable && usageUnavailable ? (
        <EmptyState title="Fuentes de actividad no disponibles">
          Auditoría y medición de uso no respondieron. No hay base para mostrar
          cero actividad.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="Sin evidencia de actividad">
          No se observaron registros para esta selección en las fuentes
          disponibles. No se interpreta como cero uso del producto.
        </EmptyState>
      ) : (
        rows.map((row) => (
          <ActivityCard
            key={`${row.tenantId}:${row.actorId ?? "system"}:${row.feature}`}
            row={row}
            tenant={tenantName(snapshot, row.tenantId)}
            grain={grain}
            window={snapshot.window}
            navigate={navigate}
          />
        ))
      )}
    </div>
  );
}

function ActivityCard({
  row,
  tenant,
  grain,
  window,
  navigate,
}: {
  row: ActivityRow;
  tenant: string;
  grain: "day" | "week" | "month";
  window: OperationsSnapshot["window"];
  navigate: Navigate;
}) {
  const buckets = groupDays(
    fillCompletedDays(row.days, window.start, window.end),
    grain,
  );
  const max = Math.max(1, ...buckets.map((day) => day.count));
  const metricLabel =
    row.metric === "ocr_requests"
      ? "solicitudes OCR iniciadas observadas"
      : "cambios auditados";
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle>{row.feature}</CardTitle>
        <CardDescription>
          {tenant} · {row.actorName} · {metricLabel}
        </CardDescription>
        {row.actorId ? (
          <CardAction>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate({ actorId: row.actorId })}
            >
              Aislar actor
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={styles.cardContent}>
        <div className={styles.inlineMeta}>
          <strong>
            {row.current} {metricLabel}
          </strong>
          <span>· {row.activeDays} días activos</span>
          {row.comparable ? (
            <span>
              · ventana anterior: {row.previous} en {row.previousActiveDays}{" "}
              días
            </span>
          ) : (
            <Badge variant="warning">Sin comparación válida</Badge>
          )}
        </div>
        <div
          className={styles.heatmap}
          role="img"
          aria-label={`${row.current} ${metricLabel} en ${row.activeDays} días activos`}
        >
          {buckets.map((bucket) => (
            <div
              key={bucket.key}
              className={styles.heatCell}
              style={
                {
                  "--intensity": `${Math.round((bucket.count / max) * 36)}%`,
                } as React.CSSProperties
              }
              title={`${bucket.label}: ${bucket.count} registros observados${bucket.partial ? "; período parcial" : ""}`}
            >
              <strong>{bucket.count}</strong>
              <span>
                {bucket.label}
                {bucket.partial ? " · parcial" : ""}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function fillCompletedDays(
  days: ActivityRow["days"],
  start: string,
  end: string,
) {
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const completed: ActivityRow["days"] = [];
  for (
    let cursor = new Date(start);
    cursor < new Date(end);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    completed.push({ date, count: counts.get(date) ?? 0 });
  }
  return completed;
}

function groupDays(days: ActivityRow["days"], grain: "day" | "week" | "month") {
  const groups = new Map<
    string,
    { key: string; label: string; count: number; dates: string[] }
  >();
  for (const day of days) {
    const date = new Date(`${day.date}T00:00:00Z`);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key =
      grain === "day"
        ? day.date
        : grain === "week"
          ? monday.toISOString().slice(0, 10)
          : day.date.slice(0, 7);
    const label =
      grain === "day"
        ? dayFormatter.format(date)
        : grain === "week"
          ? `sem. ${dayFormatter.format(monday)}`
          : new Intl.DateTimeFormat("es-AR", {
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }).format(date);
    const current = groups.get(key) ?? { key, label, count: 0, dates: [] };
    current.count += day.count;
    current.dates.push(day.date);
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    partial:
      grain === "day"
        ? false
        : grain === "week"
          ? group.dates.length < 7
          : group.dates.length <
            new Date(
              Date.UTC(
                Number(group.key.slice(0, 4)),
                Number(group.key.slice(5, 7)),
                0,
              ),
            ).getUTCDate(),
  }));
}

export function CostsView({
  snapshot,
  navigate,
}: {
  snapshot: OperationsSnapshot;
  navigate: Navigate;
}) {
  const usageAvailable = sourceAvailable(snapshot, "usage", "current");
  const known = snapshot.costs.reduce(
    (sum, cost) => sum + (cost.knownUsd ?? 0),
    0,
  );
  const hasKnown = snapshot.costs.some((cost) => cost.knownUsd !== null);
  const unknown = snapshot.costs.reduce(
    (sum, cost) => sum + cost.unpricedEvents,
    0,
  );
  const operations = snapshot.operations.filter(
    (operation) => operation.knownUsd !== null || operation.unpricedEvents > 0,
  );
  const tenantCosts = snapshot.tenants.map((tenant) => {
    const rows = snapshot.costs.filter((cost) => cost.tenantId === tenant.id);
    return {
      tenant,
      known: rows.reduce((sum, cost) => sum + (cost.knownUsd ?? 0), 0),
      hasKnown: rows.some((cost) => cost.knownUsd !== null),
      unknown: rows.reduce((sum, cost) => sum + cost.unpricedEvents, 0),
    };
  });
  const maxTenantKnown = Math.max(
    1,
    ...tenantCosts.filter((item) => item.hasKnown).map((item) => item.known),
  );
  return (
    <div className={styles.view}>
      <div className={styles.notice}>
        <div>
          <strong>
            Ventana operativa hasta {formatDate(snapshot.window.liveEnd)} UTC
          </strong>
          <p className={styles.muted}>
            Incluye hoy como tramo parcial. Los importes son estimaciones
            registradas, no facturas conciliadas.
          </p>
        </div>
      </div>
      <div className={styles.stats}>
        <Stat
          label="Subtotal conocido"
          value={
            usageAvailable
              ? formatMoney(hasKnown ? known : null)
              : "Desconocido"
          }
          detail={
            usageAvailable
              ? "Excluye eventos sin precio"
              : "Medición de uso no disponible"
          }
        />
        <Stat
          label="Eventos sin precio"
          value={usageAvailable ? unknown : "Desconocido"}
          detail="Excluidos del subtotal monetario"
        />
        <Stat
          label="Eventos valorizados"
          value={
            usageAvailable
              ? snapshot.costs.reduce((sum, cost) => sum + cost.pricedEvents, 0)
              : "Desconocido"
          }
          detail="Base: estimación registrada"
        />
        <Stat
          label="Operaciones correlacionadas"
          value={operations.length}
          detail="Solo mediante identificadores almacenados"
        />
      </div>
      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle>Estimación conocida por tenant</CardTitle>
          <CardDescription>
            Comparación relativa de importes registrados. Los eventos sin precio
            quedan fuera de las barras.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {!usageAvailable ? (
            <EmptyState title="Medición de costos no disponible">
              La fuente no respondió. No hay base para dibujar importes en cero.
            </EmptyState>
          ) : (
            <div className={styles.costBars}>
              {tenantCosts.map((item) => (
                <div className={styles.costBarRow} key={item.tenant.id}>
                  <div>
                    <strong>{item.tenant.name}</strong>
                    <span>
                      {item.hasKnown
                        ? formatMoney(item.known)
                        : "Importe desconocido"}
                    </span>
                  </div>
                  {item.hasKnown ? (
                    <div
                      className={styles.costTrack}
                      aria-label={`${item.tenant.name}: ${formatMoney(item.known)} de estimación registrada conocida`}
                    >
                      <span
                        style={
                          {
                            "--value": `${(item.known / maxTenantKnown) * 100}%`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  ) : (
                    <span className={styles.muted}>Sin barra conocida</span>
                  )}
                  {item.unknown > 0 ? (
                    <Badge variant="warning">{item.unknown} sin precio</Badge>
                  ) : (
                    <Badge variant="neutral">Sin pendientes de precio</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className={styles.grid2}>
        <Card className={styles.card}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle>Servicios medidos</CardTitle>
            <CardDescription>
              La suma firmada de movimientos registrados puede incluir reserva y
              cierre; no equivale al consumo exacto de cuota.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {!usageAvailable ? (
              <EmptyState title="Medición de costos no disponible">
                La fuente no respondió. No hay base para mostrar importes en
                cero.
              </EmptyState>
            ) : snapshot.costs.length === 0 ? (
              <EmptyState title="Sin evidencia monetaria">
                No hay registros de costo para esta selección.
              </EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Suma de movimientos registrados</TableHead>
                    <TableHead>Conocido</TableHead>
                    <TableHead>Sin precio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.costs.map((cost) => (
                    <TableRow key={`${cost.tenantId}:${cost.kind}`}>
                      <TableCell>{costLabels[cost.kind]}</TableCell>
                      <TableCell>
                        {tenantName(snapshot, cost.tenantId)}
                      </TableCell>
                      <TableCell>
                        {numberFormatter.format(cost.netAmount)}
                      </TableCell>
                      <TableCell>{formatMoney(cost.knownUsd)}</TableCell>
                      <TableCell>{cost.unpricedEvents}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle>Operaciones con evidencia de costo</CardTitle>
            <CardDescription>
              La apertura conserva la correlación exacta disponible.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {operations.length === 0 ? (
              <EmptyState title="Sin correlaciones">
                No hay operaciones con importe o eventos sin precio en esta
                muestra.
              </EmptyState>
            ) : (
              <div className={styles.list}>
                {operations.map((operation) => (
                  <OperationButton
                    key={operation.id}
                    operation={operation}
                    snapshot={snapshot}
                    navigate={navigate}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TraceView({
  snapshot,
  auditId,
  query,
  actorId,
  action,
  navigate,
}: {
  snapshot: OperationsSnapshot;
  auditId: string | null;
  query: string;
  actorId: string | null;
  action: string | null;
  navigate: Navigate;
}) {
  const normalized = query.trim().toLocaleLowerCase("es");
  const filtered = snapshot.audit.filter(
    (change) =>
      (!actorId || change.actorId === actorId) &&
      (!action || change.action === action) &&
      (!normalized ||
        [change.id, change.rowId, change.table, change.extractionId].some(
          (value) => value?.toLocaleLowerCase("es").includes(normalized),
        )),
  );
  const selected =
    filtered.find((change) => change.id === auditId) ?? filtered[0] ?? null;
  const actors = Array.from(
    new Map(
      snapshot.audit
        .filter((change) => change.actorId)
        .map((change) => [change.actorId, change.actorName]),
    ).entries(),
  );
  const auditUnavailable = !sourceAvailable(snapshot, "audit", "current");
  return (
    <div className={styles.view}>
      <div className={styles.notice}>
        <div>
          <strong>
            Auditoría hasta {formatDate(snapshot.window.liveEnd)} UTC
          </strong>
          <p className={styles.muted}>
            Incluye hoy como tramo parcial. Los filtros operan sobre la muestra
            recibida.
          </p>
        </div>
      </div>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <form
            className={styles.controls}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              navigate({
                traceQ: String(form.get("traceQ") ?? ""),
                traceActor: String(form.get("traceActor") ?? ""),
                traceAction: String(form.get("traceAction") ?? ""),
                auditId: null,
              });
            }}
          >
            <div className={styles.field}>
              <label htmlFor="trace-query">Entidad, tabla o ID</label>
              <Input id="trace-query" name="traceQ" defaultValue={query} />
            </div>
            <div className={styles.field}>
              <label htmlFor="trace-actor">Actor</label>
              <NativeSelect
                id="trace-actor"
                name="traceActor"
                defaultValue={actorId ?? ""}
              >
                <option value="">Todos</option>
                {actors.map(([id, name]) => (
                  <option key={id} value={id ?? ""}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className={styles.field}>
              <label htmlFor="trace-action">Acción</label>
              <NativeSelect
                id="trace-action"
                name="traceAction"
                defaultValue={action ?? ""}
              >
                <option value="">Todas</option>
                <option value="INSERT">Creación</option>
                <option value="UPDATE">Edición</option>
                <option value="DELETE">Eliminación</option>
              </NativeSelect>
            </div>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className={styles.grid2}>
        <Card className={styles.card}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle>Cambios recientes</CardTitle>
            <CardDescription>
              {filtered.length} de {snapshot.audit.length} registros en la
              muestra. Campos sensibles permanecen ocultos.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {auditUnavailable ? (
              <EmptyState title="Auditoría no disponible">
                La fuente de auditoría no respondió. No se puede afirmar que no
                hubo cambios.
              </EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState title="Sin coincidencias">
                Ningún registro de la muestra coincide con los filtros actuales.
              </EmptyState>
            ) : (
              <div className={styles.list}>
                {filtered.map((change) => (
                  <button
                    key={change.id}
                    type="button"
                    className={`${styles.listButton} ${selected?.id === change.id ? styles.selected : ""}`}
                    onClick={() => navigate({ auditId: change.id })}
                  >
                    <strong>
                      {change.table} · {change.action}
                    </strong>
                    <span className={styles.buttonMeta}>
                      {formatDate(change.createdAt)} · {change.actorName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <AuditDetail
          change={selected}
          snapshot={snapshot}
          navigate={navigate}
        />
      </div>
    </div>
  );
}

function AuditDetail({
  change,
  snapshot,
  navigate,
}: {
  change: AuditChange | null;
  snapshot: OperationsSnapshot;
  navigate: Navigate;
}) {
  if (!change)
    return (
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <EmptyState title="Elegí un cambio">
            El detalle muestra solo diferencias permitidas por el servidor.
          </EmptyState>
        </CardContent>
      </Card>
    );
  const operation = change.extractionId
    ? snapshot.operations.find(
        (item) => item.extractionId === change.extractionId,
      )
    : null;
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle>
          {change.table} · {change.action}
        </CardTitle>
        <CardDescription>
          {tenantName(snapshot, change.tenantId)} ·{" "}
          {formatDate(change.createdAt)}
        </CardDescription>
        <CardAction>
          <Badge variant="info">{change.actorName}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.cardContent}>
        <dl className={styles.definitionList}>
          <div className={styles.definitionRow}>
            <dt>ID de auditoría</dt>
            <dd>{change.id}</dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Fila</dt>
            <dd>{change.rowId ?? "No disponible"}</dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Campos ocultos</dt>
            <dd>{change.hiddenFieldCount}</dd>
          </div>
        </dl>
        {change.fields.length === 0 ? (
          <EmptyState title="Sin diferencias visibles">
            El registro existe, pero no contiene campos permitidos para mostrar.
          </EmptyState>
        ) : (
          change.fields.map((field) => (
            <FieldDiff key={field.field} field={field} />
          ))
        )}
        {operation ? (
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => navigate({ operationId: operation.id })}
          >
            Abrir operación correlacionada <ExternalLink />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FieldDiff({ field }: { field: AuditFieldChange }) {
  const renderValue = (value: AuditFieldChange["before"]) =>
    field.redacted ? "[redactado]" : value === null ? "null" : String(value);
  return (
    <div className={styles.diff}>
      <div className={styles.diffBox}>
        <span>Antes · {field.field}</span>
        <code>{renderValue(field.before)}</code>
      </div>
      <div className={styles.diffBox}>
        <span>Después · {field.field}</span>
        <code>{renderValue(field.after)}</code>
      </div>
    </div>
  );
}

export function HealthView({
  snapshot,
  navigate,
}: {
  snapshot: OperationsSnapshot;
  navigate: Navigate;
}) {
  const jobsUnavailable =
    !sourceAvailable(snapshot, "usage", "current") &&
    !sourceAvailable(snapshot, "ocr", "current");
  return (
    <div className={styles.view}>
      <div className={styles.notice}>
        <div>
          <strong>
            Trabajos hasta {formatDate(snapshot.window.liveEnd)} UTC
          </strong>
          <p className={styles.muted}>
            Incluye hoy como tramo parcial. La duración usa solo operaciones con
            una muestra registrada. Un inicio sin cierre observado no confirma
            que la extracción siga ejecutándose.
          </p>
        </div>
      </div>
      <div className={styles.stats}>
        <Stat
          label="Completadas"
          value={jobsUnavailable ? "Desconocido" : snapshot.health.completed}
          detail={
            jobsUnavailable
              ? "Fuentes de trabajos no disponibles"
              : `de ${snapshot.health.observedJobs} trabajos observados`
          }
        />
        <Stat
          label="Fallidas"
          value={jobsUnavailable ? "Desconocido" : snapshot.health.failed}
          detail="Código seguro disponible en el detalle"
        />
        <Stat
          label="En curso"
          value={
            jobsUnavailable
              ? "Desconocido"
              : snapshot.health.processing + snapshot.health.pending
          }
          detail={
            jobsUnavailable
              ? "Fuentes de trabajos no disponibles"
              : `${snapshot.health.processing} procesando · ${snapshot.health.pending} pendientes`
          }
        />
        <Stat
          label="Duración mediana"
          value={
            jobsUnavailable
              ? "Desconocido"
              : formatDuration(snapshot.health.medianDurationMs)
          }
          detail={
            jobsUnavailable
              ? "Fuentes de trabajos no disponibles"
              : `${snapshot.health.durationSamples} muestras con duración`
          }
        />
      </div>
      <div className={styles.grid2}>
        <Card className={styles.card}>
          <CardHeader className={styles.cardHeader}>
            <CardTitle>Trabajos de extracción</CardTitle>
            <CardDescription>
              Estado, duración y filas observadas; los errores se reducen a
              códigos seguros.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.cardContent}>
            {jobsUnavailable ? (
              <EmptyState title="Extracciones no disponibles">
                Ni la medición por fases ni el estado OCR respondieron. No hay
                base para mostrar cero trabajos.
              </EmptyState>
            ) : snapshot.operations.length === 0 ? (
              <EmptyState title="Sin trabajos observados">
                No hay operaciones de extracción en esta ventana.
              </EmptyState>
            ) : (
              <div className={styles.list}>
                {snapshot.operations.map((operation) => (
                  <OperationButton
                    key={operation.id}
                    operation={operation}
                    snapshot={snapshot}
                    navigate={navigate}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <RecoveryContent backup={snapshot.backup} />
        </Card>
      </div>
      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardTitle>Fuentes y cobertura</CardTitle>
          <CardDescription>
            Disponibilidad de consulta no significa ingestión completa.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {snapshot.sources.length === 0 ? (
            <EmptyState title="Cobertura no disponible">
              El cargador no informó ninguna fuente. Los conteos derivados
              permanecen desconocidos.
            </EmptyState>
          ) : (
            <div className={styles.sourceGrid}>
              {snapshot.sources.map((source) => (
                <div
                  className={styles.sourceCard}
                  key={`${source.name}:${source.period}`}
                >
                  <div className={styles.sectionHead}>
                    <strong>
                      {sourceLabels[source.name]} · {source.period}
                    </strong>
                    {sourceBadge(source)}
                  </div>
                  <p>{source.coverage}</p>
                  <p>
                    {source.rows} filas
                    {source.truncated ? " · resultado truncado" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const recoveryComponentLabels = {
  database: "Base de datos",
  auth: "Auth",
  storage: "Storage",
  configuration: "Configuración",
} as const;

function RecoveryContent({ backup }: { backup: OperationsRecoveryStatus }) {
  if (backup.status === "unconfigured") {
    return (
      <>
        <CardHeader className={styles.cardHeader}>
          <CardTitle>Recuperación</CardTitle>
          <CardDescription>
            No se configuró una fuente local de evidencia.
          </CardDescription>
          <CardAction>
            <DatabaseBackup size={18} />
          </CardAction>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <EmptyState title="Evidencia no configurada">
            No se puede afirmar cobertura, integridad de artefactos ni
            restauración registrada.
          </EmptyState>
        </CardContent>
      </>
    );
  }
  if (backup.status === "unavailable") {
    return (
      <>
        <CardHeader className={styles.cardHeader}>
          <CardTitle>Recuperación</CardTitle>
          <CardDescription>
            La fuente configurada no pudo leerse o validarse.
          </CardDescription>
          <CardAction>
            <Badge variant="destructive">No disponible</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <EmptyState title="Evidencia no disponible">
            El estado es desconocido. No se interpreta como ausencia de fallas
            ni como recuperación comprobada.
          </EmptyState>
        </CardContent>
      </>
    );
  }
  const evidence = backup.evidence;
  const recoverySet = evidence.latestRecoverySet;
  return (
    <>
      <CardHeader className={styles.cardHeader}>
        <CardTitle>Recuperación</CardTitle>
        <CardDescription>
          Integridad de artefactos y atestación de restauración registrada; no
          observa una restauración en vivo.
        </CardDescription>
        <CardAction>
          <Badge variant={evidence.state === "partial" ? "warning" : "info"}>
            {evidence.state === "verified"
              ? "Evidencia completa registrada"
              : evidence.state === "partial"
                ? "Evidencia parcial"
                : "Sin configurar"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.cardContent}>
        <dl className={styles.definitionList}>
          <div className={styles.definitionRow}>
            <dt>Evaluada</dt>
            <dd>{formatDate(evidence.evaluatedAt)} UTC</dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Conjunto de captura</dt>
            <dd>
              {recoverySet
                ? `${recoverySet.runId} · ${formatDate(recoverySet.captureEndedAt)} UTC`
                : "Sin conjunto registrado"}
            </dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Integridad de artefactos</dt>
            <dd>
              {recoverySet
                ? recoverySet.artifactVerification === "passed"
                  ? "Aprobada"
                  : recoverySet.artifactVerification === "failed"
                    ? "Fallida"
                    : "No ejecutada"
                : "Sin evidencia"}
            </dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Atestación de restauración</dt>
            <dd>
              {evidence.restoreProof.status === "recorded"
                ? `Registrada${evidence.restoreProof.validatedAt ? ` · ${formatDate(evidence.restoreProof.validatedAt)} UTC` : ""}`
                : evidence.restoreProof.status === "invalid"
                  ? "Inválida"
                  : "Ausente"}
            </dd>
          </div>
        </dl>
        {recoverySet ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead>Evidencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(recoverySet.components).map(
                ([component, status]) => (
                  <TableRow key={component}>
                    <TableCell>
                      {
                        recoveryComponentLabels[
                          component as keyof typeof recoveryComponentLabels
                        ]
                      }
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          status === "verified"
                            ? "success"
                            : status === "declared"
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {status === "verified"
                          ? "Verificado"
                          : status === "declared"
                            ? "Declarado"
                            : "Faltante"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        ) : null}
        {evidence.issues.length ? (
          <div className="mt-3">
            <strong>Observaciones</strong>
            <ul className="mt-2 list-disc pl-5 text-sm text-content-muted">
              {evidence.issues.map((issue) => (
                <li key={`${issue.code}:${issue.component ?? "all"}`}>
                  {issue.code}
                  {issue.component ? ` · ${issue.component}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </>
  );
}

function OperationButton({
  operation,
  snapshot,
  navigate,
}: {
  operation: ObservedOperation;
  snapshot: OperationsSnapshot;
  navigate: Navigate;
}) {
  return (
    <button
      type="button"
      className={styles.operationButton}
      onClick={() => navigate({ operationId: operation.id })}
    >
      <span className={styles.sectionHead}>
        <strong>Extracción · {tenantName(snapshot, operation.tenantId)}</strong>
        {statusBadge(operation.status)}
      </span>
      <span className={styles.buttonMeta}>
        {formatDate(operation.observedAt)} · {operation.rowsExtracted ?? "?"}{" "}
        filas · {formatDuration(operation.durationMs)} ·{" "}
        {formatMoney(operation.knownUsd)}
        {operation.unpricedEvents
          ? ` + ${operation.unpricedEvents} sin precio`
          : ""}
      </span>
    </button>
  );
}

export function OperationDetail({
  operation,
  snapshot,
  close,
}: {
  operation: ObservedOperation;
  snapshot: OperationsSnapshot;
  close: () => void;
}) {
  const tables = operation.tablaIds.length
    ? operation.tablaIds
    : operation.tablaId
      ? [operation.tablaId]
      : [];
  return (
    <Card className={`${styles.card} ${styles.operationDetail}`}>
      <CardHeader className={styles.cardHeader}>
        <div className={styles.operationHeader}>
          <div>
            <CardTitle>Operación de extracción</CardTitle>
            <CardDescription>
              {tenantName(snapshot, operation.tenantId)} ·{" "}
              {formatDate(operation.observedAt)}
            </CardDescription>
          </div>
          <div className={styles.inlineMeta}>
            {operation.preview ? (
              <Badge variant="neutral">Vista previa</Badge>
            ) : null}
            {statusBadge(operation.status)}
            <Button size="sm" variant="ghost" onClick={close}>
              Cerrar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={styles.cardContent}>
        <dl className={styles.definitionList}>
          <div className={styles.definitionRow}>
            <dt>Operación observada</dt>
            <dd>{operation.id}</dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Extracción almacenada</dt>
            <dd>
              {operation.extractionId ?? "Sin identificador correlacionable"}
            </dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Base de observación</dt>
            <dd>
              {operation.basis === "ocr_phase"
                ? "Eventos de fase OCR"
                : "Estado actual del documento; historial no demostrado"}
            </dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Obra / tablas</dt>
            <dd>
              {operation.obraId} /{" "}
              {tables.length ? tables.join(", ") : "Sin tabla correlacionada"}
            </dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Resultado</dt>
            <dd>
              {operation.rowsExtracted ?? "Cantidad desconocida"} filas ·{" "}
              {formatDuration(operation.durationMs)}
              {operation.errorCode ? ` · ${operation.errorCode}` : ""}
            </dd>
          </div>
          <div className={styles.definitionRow}>
            <dt>Costo</dt>
            <dd>
              {formatMoney(operation.knownUsd)}
              {operation.unpricedEvents
                ? ` · ${operation.unpricedEvents} eventos sin precio`
                : ""}
            </dd>
          </div>
        </dl>
        <div className={styles.correlations}>
          <Correlation
            title="Identidad de origen"
            ids={operation.initiatorIds}
            emptyLabel="No registrada"
          />
          <Correlation title="Auditoría" ids={operation.auditIds} />
          <Correlation title="Uso" ids={operation.usageEventIds} />
          <Correlation
            title="Identidad observada o ejecutora"
            ids={operation.actorIds}
            emptyLabel="No registrada"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Correlation({
  title,
  ids,
  emptyLabel = "Sin correlación almacenada",
}: {
  title: string;
  ids: string[];
  emptyLabel?: string;
}) {
  return (
    <div>
      <span>{title} · IDs exactos</span>
      {ids.length ? (
        ids.map((id) => <code key={id}>{id}</code>)
      ) : (
        <code>{emptyLabel}</code>
      )}
    </div>
  );
}
