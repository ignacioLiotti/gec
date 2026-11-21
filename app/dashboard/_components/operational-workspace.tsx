"use client";

import { Bell, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import styles from "./operational-workspace.module.css";

type Detail = {
  title: string;
  description: string;
  row: string;
  value: string;
  percentage: number;
  tone: "dark" | "orange" | "danger" | "muted";
};

type MetricKind = "progress" | "elapsed" | "delay" | "balance";

export type OperationalWorkspaceData = {
  company: string;
  updatedAt: string;
  unreadNotifications: number;
  expiredPolicies: number;
  flaggedAmount: string;
  lateWorks: number;
  activeWorks: number;
  policySummary?: string;
  projectTotals?: {
    progress: string;
    elapsed: string;
    balance: string;
  };
  errors?: string[];
  links?: {
    policies?: string;
    works?: string;
    reviews?: string;
    notifications?: string;
  };
  kpis: Array<{
    id: string;
    label: string;
    value: string;
    note: string;
    tone?: "default" | "warning" | "danger";
    detail: Detail;
  }>;
  policyMonths: Array<{
    label: string;
    count: number;
    risk: number;
    balance: string;
  }>;
  signals: Array<{
    value: string;
    label: string;
    note: string;
    tone: "danger" | "warning" | "neutral";
  }>;
  projects: Array<{
    id: number | string;
    name: string;
    title: string;
    entity: string;
    updated: string;
    progress: number;
    elapsed: number;
    balance: string;
    balanceShare: number;
    contract: string;
    certified: string;
    timeframe: string;
    href?: string;
  }>;
  notifications: Array<{
    title: string;
    detail: string;
    when: string;
    href?: string;
  }>;
  reviews: Array<{
    name: string;
    work: number | string;
    status: "Generado" | "En revisión";
    when: string;
    file: string;
    href?: string;
  }>;
};

function DetailPopover({
  detail,
  align = "left",
}: {
  detail: Detail;
  align?: "left" | "right";
}) {
  return (
    <PopoverContent
      aria-label={detail.title}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      side="bottom"
      align={align === "right" ? "end" : "start"}
      sideOffset={8}
      collisionPadding={16}
      className="w-72 p-4"
    >
      <div className={styles.detailPopover}>
        <span className={styles.popoverIcon} data-tone={detail.tone}>
          <span />
        </span>
        <strong>{detail.title}</strong>
        <p>{detail.description}</p>
        <div className={styles.popoverMetric}>
          <span className={styles.popoverTrack}>
            <span
              data-tone={detail.tone}
              style={{
                width: `${Math.min(Math.max(detail.percentage, 0), 100)}%`,
              }}
            />
          </span>
          <div>
            <span>{detail.row}</span>
            <strong>{detail.value}</strong>
          </div>
        </div>
      </div>
    </PopoverContent>
  );
}

function MetricCell({
  project,
  kind,
  active,
  onActiveChange,
}: {
  project: OperationalWorkspaceData["projects"][number];
  kind: MetricKind;
  active: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const delay = Math.max(0, project.elapsed - project.progress);
  const formattedDelay = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(delay);
  const formattedProgress = project.progress.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
  });
  const formattedElapsed = project.elapsed.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
  });
  const late = delay >= 10;
  const metric = {
    progress: {
      value: `${formattedProgress}%`,
      percentage: project.progress,
      tone: "dark" as const,
      detail: {
        title: "Avance físico",
        description:
          "Progreso de obra medido y certificado sobre el total contratado.",
        row: "% de obra ejecutada",
        value: `${formattedProgress}%`,
        percentage: project.progress,
        tone: "dark" as const,
      },
    },
    elapsed: {
      value: `${formattedElapsed}%`,
      percentage: Math.min(project.elapsed, 100),
      tone: late ? ("danger" as const) : ("muted" as const),
      detail: {
        title: "Plazo transcurrido",
        description: `${project.timeframe} contractuales consumidos${project.elapsed > 100 ? ". La obra corre fuera de su plazo." : "."}`,
        row: "% del plazo consumido",
        value: `${formattedElapsed}%`,
        percentage: Math.min(project.elapsed, 100),
        tone: late ? ("danger" as const) : ("muted" as const),
      },
    },
    delay: {
      value: delay > 0 ? `+${formattedDelay} pp` : "al día",
      percentage: Math.min(delay * 2.5, 100),
      tone: late
        ? ("danger" as const)
        : delay > 0
          ? ("orange" as const)
          : ("muted" as const),
      detail: {
        title: "Desvío",
        description:
          delay > 0
            ? `El plazo consumido supera el avance físico en ${formattedDelay} puntos. Umbral de atraso: 10 pp.`
            : "El avance acompaña el plazo. Sin señales de atraso.",
        row: "puntos de desvío",
        value: `${formattedDelay} pp`,
        percentage: Math.min(delay * 2.5, 100),
        tone: late
          ? ("danger" as const)
          : delay > 0
            ? ("orange" as const)
            : ("muted" as const),
      },
    },
    balance: {
      value: project.balance,
      percentage: project.balanceShare,
      tone: "orange" as const,
      detail: {
        title: "Saldo a certificar",
        description: "Ingreso futuro pendiente de certificación en esta obra.",
        row: "% del saldo total activo",
        value: `${project.balanceShare.toLocaleString("es-AR")}%`,
        percentage: project.balanceShare,
        tone: "orange" as const,
      },
    },
  }[kind];

  return (
    <Popover open={active} onOpenChange={onActiveChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={styles.metricCell}
          data-active={active}
          data-tone={metric.tone}
          onMouseEnter={() => onActiveChange(true)}
          onMouseLeave={(event) => {
            if (!event.currentTarget.matches(":focus")) onActiveChange(false);
          }}
          onFocus={() => onActiveChange(true)}
          onBlur={() => onActiveChange(false)}
          onClick={(event) => {
            event.preventDefault();
            onActiveChange(true);
          }}
          aria-label={`${metric.detail.title}: ${metric.value}`}
        >
          <strong>{metric.value}</strong>
          <span className={styles.progressTrack}>
            <span
              data-tone={metric.tone}
              style={{ width: `${metric.percentage}%` }}
            />
          </span>
        </button>
      </PopoverTrigger>
      <DetailPopover detail={metric.detail} align="right" />
    </Popover>
  );
}

function DocumentCard({
  review,
}: {
  review: OperationalWorkspaceData["reviews"][number];
}) {
  const content = (
    <>
      <span className={styles.documentPreview} aria-hidden="true">
        <FileText size={22} strokeWidth={1.5} />
      </span>
      <span className={styles.reviewMeta}>
        <span>
          <strong>{review.name}</strong>
          <small>
            Obra {review.work} · {review.when}
          </small>
        </span>
        <span className={styles.reviewStatus} data-status={review.status}>
          {review.status}
        </span>
      </span>
    </>
  );
  return review.href ? (
    <Link href={review.href} className={styles.reviewCard} title={review.file}>
      {content}
    </Link>
  ) : (
    <button type="button" className={styles.reviewCard} title={review.file}>
      {content}
    </button>
  );
}

export function OperationalWorkspace({
  data,
  embedded = false,
}: {
  data: OperationalWorkspaceData;
  embedded?: boolean;
}) {
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const selectedMonth =
    activeMonth === null ? null : data.policyMonths[activeMonth];
  const maxPolicyMonthCount = Math.max(
    1,
    ...data.policyMonths.map((month) => month.count),
  );

  return (
    <main className={styles.canvas} data-embedded={embedded ? "true" : "false"}>
      <section
        className={styles.workspace}
        aria-label="Panel de administración de obras"
      >
        <header className={styles.header}>
          <div className={styles.metaRow}>
            <p>
              <span className={styles.workspaceMark} aria-hidden="true" />
              Operaciones{" "}
              <span className={styles.companyName}>/ {data.company}</span>
            </p>
            <div className={styles.headerActions}>
              {data.links?.notifications ? (
                <Link
                  href={data.links.notifications}
                  className={styles.notificationPill}
                >
                  <Bell aria-hidden="true" size={13} />
                  {data.unreadNotifications} sin leer
                </Link>
              ) : (
                <span className={styles.notificationPill}>
                  <Bell aria-hidden="true" size={13} />
                  {data.unreadNotifications} sin leer
                </span>
              )}
              <span className={styles.datePill}>{data.updatedAt}</span>
            </div>
          </div>
          <h1>
            <strong>{data.expiredPolicies} pólizas vencidas</strong> siguen
            activas con{" "}
            <strong className={styles.accent}>{data.flaggedAmount}</strong>{" "}
            comprometidos, y{" "}
            <strong>
              {data.lateWorks} de {data.activeWorks} obras
            </strong>{" "}
            corren detrás del plazo.
          </h1>
        </header>

        {data.errors?.length ? (
          <div className={styles.errorBanner} role="status">
            <strong>No se pudo cargar una parte del panel.</strong>
            <span>{data.errors.join(" · ")}</span>
          </div>
        ) : null}

        <div className={styles.kpiGrid}>
          {data.kpis.map((kpi) => {
            const active = activeKpi === kpi.id;
            return (
              <Popover
                key={kpi.id}
                open={active}
                onOpenChange={(open) =>
                  setActiveKpi((current) =>
                    open ? kpi.id : current === kpi.id ? null : current,
                  )
                }
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={styles.kpi}
                    data-active={active}
                    onMouseEnter={() => setActiveKpi(kpi.id)}
                    onMouseLeave={(event) => {
                      if (!event.currentTarget.matches(":focus"))
                        setActiveKpi(null);
                    }}
                    onFocus={() => setActiveKpi(kpi.id)}
                    onBlur={() =>
                      setActiveKpi((current) =>
                        current === kpi.id ? null : current,
                      )
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      setActiveKpi(kpi.id);
                    }}
                  >
                    <span className={styles.kpiLabel}>{kpi.label}</span>
                    <strong data-tone={kpi.tone ?? "default"}>
                      {kpi.value}
                    </strong>
                    <span className={styles.kpiNote}>{kpi.note}</span>
                  </button>
                </PopoverTrigger>
                <DetailPopover detail={kpi.detail} />
              </Popover>
            );
          })}
        </div>

        <section
          className={styles.policyPanel}
          aria-label="Vencimientos de pólizas"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Vencimientos de pólizas · próximos 12 meses</h2>
              <p>
                {data.policySummary ??
                  "Seguimiento de vencimientos y saldos comprometidos."}
              </p>
            </div>
            {data.links?.policies ? (
              <Link href={data.links.policies}>Panel de pólizas →</Link>
            ) : (
              <button type="button">Panel de pólizas →</button>
            )}
          </div>
          <p className={styles.scrollHint}>
            Deslizá el gráfico para ver los 12 meses.
          </p>
          <div className={styles.chartViewport}>
            <div className={styles.monthChart}>
              {data.policyMonths.map((month, index) => (
                <button
                  type="button"
                  key={month.label}
                  className={styles.month}
                  data-active={activeMonth === index}
                  aria-pressed={activeMonth === index}
                  onMouseEnter={() => setActiveMonth(index)}
                  onFocus={() => setActiveMonth(index)}
                  onClick={() => setActiveMonth(index)}
                >
                  <strong>{month.count}</strong>
                  <span
                    className={styles.barStack}
                    style={{
                      height: `${(month.count / maxPolicyMonthCount) * 176}px`,
                    }}
                  >
                    <span
                      className={styles.safeBar}
                      style={{ flex: Math.max(0, month.count - month.risk) }}
                    />
                    <span
                      className={styles.riskBar}
                      style={{ flex: Math.max(0, month.risk) }}
                    />
                  </span>
                  <span>{month.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.monthDetail}>
            <span role="status">
              {selectedMonth
                ? `${selectedMonth.label} · ${selectedMonth.count} pólizas vencen, ${selectedMonth.risk} con señales de riesgo · saldo comprometido ${selectedMonth.balance}`
                : "Elegí un mes para ver las pólizas y el saldo comprometido."}
            </span>
            <span>
              <i data-tone="risk" />
              con señales de riesgo
            </span>
            <span>
              <i />
              sin señales
            </span>
          </div>
          <div className={styles.signalGrid}>
            {data.signals.map((signal) => (
              <div
                key={signal.label}
                className={styles.signal}
                data-tone={signal.tone}
              >
                <span className={styles.signalDot} />
                <div>
                  <strong>{signal.value}</strong>
                  <p>{signal.label}</p>
                  <small>{signal.note}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.primaryColumn}>
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Obras activas · avance contra plazo</h2>
                  <p>
                    Pasá el cursor por una celda para entender la métrica.{" "}
                    <strong>{data.lateWorks} obras</strong> consumen plazo más
                    rápido de lo que avanzan.
                  </p>
                </div>
                {data.links?.works ? (
                  <Link href={data.links.works}>Ver todas las obras →</Link>
                ) : (
                  <button type="button">Ver todas las obras →</button>
                )}
              </div>
              <p className={styles.scrollHint}>
                Deslizá la tabla para comparar avance, plazo y saldo.
              </p>
              <div
                className={styles.projectTable}
                role="table"
                aria-label="Obras activas"
              >
                <div className={styles.projectHeader} role="row">
                  <span>Obra</span>
                  <span>Avance</span>
                  <span>Plazo</span>
                  <span>Desvío</span>
                  <span>Saldo</span>
                </div>
                {data.projects.map((project) => {
                  const delay = Math.max(0, project.elapsed - project.progress);
                  const late = delay >= 10;
                  return (
                    <div
                      className={styles.projectRow}
                      role="row"
                      key={project.id}
                    >
                      {project.href ? (
                        <Link
                          href={project.href}
                          className={styles.projectIdentity}
                          title={project.title}
                        >
                          <span className={styles.projectTile} data-late={late}>
                            {project.id}
                          </span>
                          <div>
                            <strong>{project.name}</strong>
                            <small>
                              {project.entity} · actualizada {project.updated}
                            </small>
                          </div>
                        </Link>
                      ) : (
                        <div
                          className={styles.projectIdentity}
                          title={project.title}
                        >
                          <span className={styles.projectTile} data-late={late}>
                            {project.id}
                          </span>
                          <div>
                            <strong>{project.name}</strong>
                            <small>
                              {project.entity} · actualizada {project.updated}
                            </small>
                          </div>
                        </div>
                      )}
                      {(
                        ["progress", "elapsed", "delay", "balance"] as const
                      ).map((kind) => {
                        const metricId = `${project.id}-${kind}`;
                        return (
                          <MetricCell
                            key={kind}
                            project={project}
                            kind={kind}
                            active={activeMetric === metricId}
                            onActiveChange={(active) =>
                              setActiveMetric((current) =>
                                active
                                  ? metricId
                                  : current === metricId
                                    ? null
                                    : current,
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  );
                })}
                <div className={styles.projectTotal}>
                  <span>
                    Σ&nbsp;&nbsp;Total de {data.activeWorks} obras activas
                  </span>
                  <strong>{data.projectTotals?.progress ?? "—"}</strong>
                  <strong>{data.projectTotals?.elapsed ?? "—"}</strong>
                  <strong>{data.lateWorks} atrasadas</strong>
                  <strong>{data.projectTotals?.balance ?? "—"}</strong>
                </div>
              </div>
            </section>
          </div>

          <aside className={styles.aside}>
            <section className={styles.panel}>
              <div className={styles.asideTitle}>
                <h2>Notificaciones</h2>
                <span>{data.unreadNotifications}</span>
              </div>
              <div className={styles.notificationList}>
                {data.notifications.map((notification) =>
                  notification.href ? (
                    <Link
                      href={notification.href}
                      key={`${notification.title}-${notification.when}`}
                    >
                      <strong>{notification.title}</strong>
                      <p>{notification.detail}</p>
                      <small>{notification.when}</small>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      key={`${notification.title}-${notification.when}`}
                    >
                      <strong>{notification.title}</strong>
                      <p>{notification.detail}</p>
                      <small>{notification.when}</small>
                    </button>
                  ),
                )}
              </div>
            </section>
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <h2>En revisión · {data.reviews.length}</h2>
                {data.links?.reviews ? (
                  <Link href={data.links.reviews}>Cola completa →</Link>
                ) : (
                  <button type="button">Cola completa →</button>
                )}
              </div>
              <div className={styles.reviewGrid}>
                {data.reviews.map((review) => (
                  <DocumentCard
                    key={`${review.file}-${review.work}`}
                    review={review}
                  />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
