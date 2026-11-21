import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  PreviewActions,
  PreviewCurvePoint,
  PreviewObra,
} from "./contracts";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="gp-heading">
      <div>
        {eyebrow && <p className="gp-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="gp-description">{description}</p>}
      </div>
      {actions && <div className="gp-heading-actions">{actions}</div>}
    </header>
  );
}
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`gp-panel ${className}`}>
      {(title || actions) && (
        <header className="gp-panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
export function Status({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral" | "info";
  children: ReactNode;
}) {
  return (
    <span className="gp-status" data-tone={tone}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="gp-empty">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function ObraHeader({
  obra,
  view,
  actions,
}: {
  obra: PreviewObra;
  view: "general" | "documents";
  actions: PreviewActions;
}) {
  return (
    <div className="gp-obra-header">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => actions.onNavigate({ view: "obras" })}
      >
        <ArrowLeft />
        Todas las obras
      </Button>
      <PageHeading
        eyebrow={`Obra N° ${obra.number}`}
        title={obra.name}
        description={obra.entity}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              actions.onNavigate({ view: "generation", obraId: obra.id })
            }
          >
            Generar documento
            <ArrowUpRight />
          </Button>
        }
      />
      <nav className="gp-detail-tabs" aria-label="Pestañas de obra">
        {[
          "General",
          "Pólizas",
          "Flujo",
          "Documentos Legacy",
          "Documentos New",
        ].map((label) => {
          const target =
            label === "General"
              ? "general"
              : label === "Documentos New"
                ? "documents"
                : null;
          return (
            <button
              key={label}
              type="button"
              disabled={!target}
              aria-current={target === view ? "page" : undefined}
              title={!target ? "Fuera de esta comparación" : undefined}
              onClick={() =>
                target && actions.onNavigate({ view: target, obraId: obra.id })
              }
            >
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
export function Curve({ points }: { points: PreviewCurvePoint[] }) {
  if (!points.length)
    return (
      <EmptyState
        title="Curva de avance sin datos"
        description="No se detectaron tablas Curva Plan + PMC Resumen con datos suficientes."
      />
    );
  const x = (index: number) =>
      46 + (index * 570) / Math.max(1, points.length - 1),
    y = (value: number) => 196 - value * 1.65;
  const plan = points.map((p, i) => `${x(i)},${y(p.plan)}`).join(" ");
  const realSegments: string[][] = [[]];
  points.forEach((p, i) => {
    if (p.real === null) {
      if (realSegments.at(-1)?.length) realSegments.push([]);
    } else realSegments.at(-1)?.push(`${x(i)},${y(p.real)}`);
  });
  return (
    <figure className="gp-curve">
      <svg
        viewBox="0 0 650 234"
        role="img"
        aria-label="Curva de avance planificado y real por período"
      >
        <title>Avance planificado y real</title>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line
              x1="46"
              x2="620"
              y1={y(v)}
              y2={y(v)}
              stroke="var(--gp-line)"
            />
            <text x="32" y={y(v) + 4} textAnchor="end">
              {v}%
            </text>
          </g>
        ))}
        <polyline
          points={plan}
          fill="none"
          stroke="var(--gp-strong)"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        {realSegments
          .filter((s) => s.length)
          .map((s, i) => (
            <polyline
              key={i}
              points={s.join(" ")}
              fill="none"
              stroke="var(--gp-accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          ))}
        {points.map((p, i) => (
          <g key={p.period}>
            <text x={x(i)} y="222" textAnchor="middle">
              {p.period}
            </text>
            {p.real !== null && (
              <circle cx={x(i)} cy={y(p.real)} r="3" fill="var(--gp-accent)">
                <title>
                  {p.period}: plan {p.plan}%, real {p.real}%
                </title>
              </circle>
            )}
          </g>
        ))}
      </svg>
      <figcaption>
        <span>
          <i className="gp-plan-line" />
          Planificado
        </span>
        <span>
          <i className="gp-real-line" />
          Real
        </span>
        <span>Curva Plan + PMC Resumen</span>
      </figcaption>
    </figure>
  );
}
