"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ReportTable, ReportTableColumn, RuleConfig } from "@/lib/reporting/types";
import { cn } from "@/lib/utils";

type StepId = "base" | "captura" | "packs" | "revision";

const STEPS: Array<{ id: StepId; label: string; title: string; description: string }> = [
  {
    id: "base",
    label: "Base",
    title: "Defini las fuentes",
    description: "Selecciona las tablas principales que alimentan las reglas y recomendaciones.",
  },
  {
    id: "captura",
    label: "Captura",
    title: "Mapea columnas",
    description: "Conecta cada pack con las columnas correctas para evitar lecturas ambiguas.",
  },
  {
    id: "packs",
    label: "Packs",
    title: "Ajusta umbrales",
    description: "Activa o desactiva packs y define sensibilidad para alertas y hallazgos.",
  },
  {
    id: "revision",
    label: "Revision",
    title: "Revisa antes de guardar",
    description: "Confirma la configuración final y guarda.",
  },
];

type RuleConfigHubProps = {
  config: RuleConfig;
  tables: ReportTable[];
  onChange: (next: RuleConfig) => void;
  onSave: () => void | Promise<void>;
  isSaving?: boolean;
  saveLabel?: string;
  onRun?: () => void | Promise<void>;
  isRunning?: boolean;
  runLabel?: string;
  sourceBadgeLabel?: string | null;
  sourceHint?: string | null;
  onResetOverride?: (() => void | Promise<void>) | null;
  isResettingOverride?: boolean;
};

function getTableColumns(tables: ReportTable[], tableId?: string): ReportTableColumn[] {
  if (!tableId) return [];
  return tables.find((table) => table.id === tableId)?.columns ?? [];
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTableName(tables: ReportTable[], tableId?: string): string {
  if (!tableId) return "Sin tabla";
  return tables.find((table) => table.id === tableId)?.name ?? "Tabla no encontrada";
}

function getColumnLabel(columns: ReportTableColumn[], key?: string): string {
  if (!key) return "Sin columna";
  return columns.find((column) => column.key === key)?.label ?? key;
}

function MappingPreview({
  title,
  affects,
  example,
  ready,
}: {
  title: string;
  affects: string[];
  example: string;
  ready: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        ready ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/60"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant="secondary" className={ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
          {ready ? "Listo" : "Incompleto"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{affects.join(" · ")}</p>
      <div className="mt-2 rounded-md border bg-white/80 p-2 font-mono text-[11px] leading-relaxed text-[#444]">
        {example}
      </div>
    </div>
  );
}

export function RuleConfigHub({
  config,
  tables,
  onChange,
  onSave,
  isSaving = false,
  saveLabel = "Guardar configuración",
  onRun,
  isRunning = false,
  runLabel = "Recompute now",
  sourceBadgeLabel = null,
  sourceHint = null,
  onResetOverride = null,
  isResettingOverride = false,
}: RuleConfigHubProps) {
  const [activeStep, setActiveStep] = useState<StepId>("base");

  const filteredTables = useMemo(
    () => tables.filter((table) => table.sourceType !== "default" || table.columns.length > 0),
    [tables]
  );

  const certTableId =
    config.mappings.recommendations?.certTableId ??
    config.mappings.monthlyMissingCert?.certTableId ??
    config.mappings.unpaidCerts?.certTableId ??
    config.mappings.inactivity?.certTableId ??
    "";

  const curvePlanTableId = config.mappings.curve?.planTableId ?? "";
  const curveResumenTableId =
    config.mappings.curve?.resumenTableId ??
    config.mappings.curve?.measurementTableId ??
    "";
  const stageTableId = config.mappings.stageStalled?.stageTableId ?? "";
  const measurementTableId =
    config.mappings.inactivity?.measurementTableId ?? curveResumenTableId;

  const certColumns = getTableColumns(filteredTables, certTableId || undefined);
  const curveResumenColumns = getTableColumns(filteredTables, curveResumenTableId || undefined);
  const stageColumns = getTableColumns(filteredTables, stageTableId || undefined);
  const measurementColumns = getTableColumns(filteredTables, measurementTableId || undefined);

  const currentStepIndex = STEPS.findIndex((step) => step.id === activeStep);

  const certDateColumnKey =
    config.mappings.recommendations?.dateOrPeriodColumnKey ??
    config.mappings.unpaidCerts?.issuedAtColumnKey ??
    "";
  const certAmountColumnKey = config.mappings.recommendations?.montoAcumuladoColumnKey ?? "";
  const unpaidPaidColumnKey = config.mappings.unpaidCerts?.paidBoolColumnKey ?? "";
  const unpaidAmountColumnKey = config.mappings.unpaidCerts?.amountColumnKey ?? "";
  const curveActualPctColumnKey = config.mappings.curve?.actualPctColumnKey ?? "";
  const inactivityDateColumnKey = config.mappings.inactivity?.measurementDateColumnKey ?? "";
  const stageLocationColumnKey = config.mappings.stageStalled?.locationColumnKey ?? "";
  const stageSinceColumnKey = config.mappings.stageStalled?.stageSinceColumnKey ?? "";

  const certTableName = getTableName(filteredTables, certTableId || undefined);
  const planTableName = getTableName(filteredTables, curvePlanTableId || undefined);
  const resumenTableName = getTableName(filteredTables, curveResumenTableId || undefined);
  const stageTableName = getTableName(filteredTables, stageTableId || undefined);

  const certDateColumnLabel = getColumnLabel(certColumns, certDateColumnKey);
  const certAmountColumnLabel = getColumnLabel(certColumns, certAmountColumnKey);
  const unpaidPaidColumnLabel = getColumnLabel(certColumns, unpaidPaidColumnKey);
  const unpaidAmountColumnLabel = getColumnLabel(certColumns, unpaidAmountColumnKey);
  const curveActualPctColumnLabel = getColumnLabel(curveResumenColumns, curveActualPctColumnKey);
  const inactivityDateColumnLabel = getColumnLabel(measurementColumns, inactivityDateColumnKey);
  const stageLocationColumnLabel = getColumnLabel(stageColumns, stageLocationColumnKey);
  const stageSinceColumnLabel = getColumnLabel(stageColumns, stageSinceColumnKey);

  const setSharedCertTable = (nextTableId: string) => {
    onChange({
      ...config,
      mappings: {
        ...config.mappings,
        recommendations: {
          ...(config.mappings.recommendations ?? {}),
          certTableId: nextTableId,
        },
        unpaidCerts: {
          ...(config.mappings.unpaidCerts ?? {}),
          certTableId: nextTableId,
        },
        inactivity: {
          ...(config.mappings.inactivity ?? {}),
          certTableId: nextTableId,
        },
        monthlyMissingCert: {
          ...(config.mappings.monthlyMissingCert ?? {}),
          certTableId: nextTableId,
        },
      },
    });
  };

  const setSharedCertDateColumn = (nextColumnKey: string) => {
    onChange({
      ...config,
      mappings: {
        ...config.mappings,
        recommendations: {
          ...(config.mappings.recommendations ?? {}),
          dateOrPeriodColumnKey: nextColumnKey,
        },
        unpaidCerts: {
          ...(config.mappings.unpaidCerts ?? {}),
          issuedAtColumnKey: nextColumnKey,
        },
        inactivity: {
          ...(config.mappings.inactivity ?? {}),
          certIssuedAtColumnKey: nextColumnKey,
        },
        monthlyMissingCert: {
          ...(config.mappings.monthlyMissingCert ?? {}),
          certIssuedAtColumnKey: nextColumnKey,
        },
      },
    });
  };

  const setCurveTable = (key: "planTableId" | "resumenTableId", value: string) => {
    const currentCurve = config.mappings.curve ?? {};
    const nextCurve = {
      ...currentCurve,
      [key]: value,
    };
    if (key === "resumenTableId") {
      nextCurve.measurementTableId = value;
    }
    onChange({
      ...config,
      mappings: {
        ...config.mappings,
        curve: nextCurve,
      },
    });
  };

  const setPackEnabled = (key: keyof RuleConfig["enabledPacks"], enabled: boolean) => {
    onChange({
      ...config,
      enabledPacks: {
        ...config.enabledPacks,
        [key]: enabled,
      },
    });
  };

  return (
    <Card className="border-[#e9e9e9] bg-[#f6f6f6] p-0 overflow-hidden">
      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {sourceBadgeLabel ? (
                <Badge variant="secondary" className="bg-white text-[#aa6a2a] border-[#f1cfaa]">
                  {sourceBadgeLabel}
                </Badge>
              ) : null}
              {sourceHint ? <p className="text-sm text-muted-foreground">{sourceHint}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {onResetOverride ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onResetOverride()}
                  disabled={isResettingOverride || isSaving}
                >
                  {isResettingOverride ? "Restableciendo..." : "Volver al default del tenant"}
                </Button>
              ) : null}
              {onRun ? (
                <Button type="button" variant="outline" onClick={() => void onRun()} disabled={isRunning}>
                  {isRunning ? "Recomputando..." : runLabel}
                </Button>
              ) : null}
              <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
                {isSaving ? "Guardando..." : saveLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
          {STEPS.map((step, index) => {
            const isActive = step.id === activeStep;
            const isCompleted = index < currentStepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className="group flex items-center gap-2 text-left"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                    isActive && "border-orange-500 bg-orange-50 text-orange-600",
                    isCompleted && "border-orange-300 bg-orange-100 text-orange-700",
                    !isActive && !isCompleted && "border-stone-300 bg-white text-stone-500"
                  )}
                >
                  {index + 1}
                </div>
                <div className="hidden md:block">
                  <p className={cn("text-[11px] uppercase tracking-wider", isActive ? "text-orange-600" : "text-stone-500")}>{step.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border bg-white p-5 md:p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-2xl font-semibold tracking-tight">{STEPS[currentStepIndex]?.title}</h3>
            <p className="text-sm text-muted-foreground">{STEPS[currentStepIndex]?.description}</p>
          </div>

          {activeStep === "base" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tabla de certificados (base compartida)</Label>
                <Select value={certTableId || "none"} onValueChange={(value) => setSharedCertTable(value === "none" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tabla" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {filteredTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tabla Curva Plan</Label>
                <Select value={curvePlanTableId || "none"} onValueChange={(value) => setCurveTable("planTableId", value === "none" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tabla" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {filteredTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tabla PMC Resumen / Medición</Label>
                <Select value={curveResumenTableId || "none"} onValueChange={(value) => setCurveTable("resumenTableId", value === "none" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tabla" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {filteredTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tabla de etapas</Label>
                <Select
                  value={stageTableId || "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        stageStalled: {
                          ...(config.mappings.stageStalled ?? {}),
                          stageTableId: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tabla" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {filteredTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                <MappingPreview
                  title="Preview: recomendaciones en General"
                  ready={Boolean(certTableId)}
                  affects={["Certificado a la fecha", "Saldo a certificar", "Porcentaje avance"]}
                  example={`Fuente: ${certTableName}\nUltimo monto acumulado -> recalculo automatico de campos derivados`}
                />
                <MappingPreview
                  title="Preview: hallazgos de curva y etapa"
                  ready={Boolean(curvePlanTableId && curveResumenTableId && stageTableId)}
                  affects={["Desvio de curva", "Etapa detenida"]}
                  example={`Plan: ${planTableName}\nReal: ${resumenTableName}\nEtapas: ${stageTableName}`}
                />
              </div>

            </div>
          ) : null}

          {activeStep === "captura" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fecha / período certificado</Label>
                <Select
                  value={
                    config.mappings.recommendations?.dateOrPeriodColumnKey ??
                    config.mappings.unpaidCerts?.issuedAtColumnKey ??
                    "none"
                  }
                  onValueChange={(value) => setSharedCertDateColumn(value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {certColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: recomendaciones de General + fecha base para impagos, inactividad y falta mensual.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Monto acumulado (recomendaciones General)</Label>
                <Select
                  value={config.mappings.recommendations?.montoAcumuladoColumnKey ?? "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        recommendations: {
                          ...(config.mappings.recommendations ?? {}),
                          montoAcumuladoColumnKey: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {certColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: certificado a la fecha, saldo a certificar y porcentaje sugerido.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Columna cobrado (pack impagos)</Label>
                <Select
                  value={config.mappings.unpaidCerts?.paidBoolColumnKey ?? "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        unpaidCerts: {
                          ...(config.mappings.unpaidCerts ?? {}),
                          paidBoolColumnKey: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {certColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: hallazgo de certificados vencidos sin cobro.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Columna monto (pack impagos)</Label>
                <Select
                  value={config.mappings.unpaidCerts?.amountColumnKey ?? "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        unpaidCerts: {
                          ...(config.mappings.unpaidCerts ?? {}),
                          amountColumnKey: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {certColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: monto reportado como impago en el hallazgo.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Columna avance real % (curva)</Label>
                <Select
                  value={config.mappings.curve?.actualPctColumnKey ?? "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        curve: {
                          ...(config.mappings.curve ?? {}),
                          actualPctColumnKey: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {curveResumenColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: comparacion de avance real vs avance planificado.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Fecha medición (pack inactividad)</Label>
                <Select
                  value={config.mappings.inactivity?.measurementDateColumnKey ?? "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        inactivity: {
                          ...(config.mappings.inactivity ?? {}),
                          measurementTableId: measurementTableId || undefined,
                          measurementDateColumnKey: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {measurementColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: deteccion de inactividad por falta de movimientos recientes.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Columna ubicación/etapa</Label>
                <Select
                  value={config.mappings.stageStalled?.locationColumnKey ?? "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        stageStalled: {
                          ...(config.mappings.stageStalled ?? {}),
                          locationColumnKey: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {stageColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: identificacion de la etapa objetivo (ej. Tesoreria).
                </p>
              </div>

              <div className="space-y-2">
                <Label>Columna fecha de etapa</Label>
                <Select
                  value={config.mappings.stageStalled?.stageSinceColumnKey ?? "none"}
                  onValueChange={(value) =>
                    onChange({
                      ...config,
                      mappings: {
                        ...config.mappings,
                        stageStalled: {
                          ...(config.mappings.stageStalled ?? {}),
                          stageSinceColumnKey: value === "none" ? "" : value,
                        },
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin definir</SelectItem>
                    {stageColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Afecta: calculo de tiempo acumulado en una misma etapa.
                </p>
              </div>

              <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
                <MappingPreview
                  title="Impacto: recomendaciones General"
                  ready={Boolean(certDateColumnKey && certAmountColumnKey)}
                  affects={["Actualiza sugerencias de avance y saldo"]}
                  example={`Periodo: ${certDateColumnLabel}\nMonto acumulado: ${certAmountColumnLabel}\nResultado: certificado a la fecha + saldo + porcentaje`}
                />
                <MappingPreview
                  title="Impacto: certificados impagos e inactividad"
                  ready={Boolean(certDateColumnKey && unpaidPaidColumnKey && inactivityDateColumnKey)}
                  affects={["cert.unpaid_overdue", "activity.inactive"]}
                  example={`Fecha cert: ${certDateColumnLabel}\nCobrado: ${unpaidPaidColumnLabel}\nMonto impago: ${unpaidAmountColumnLabel}\nFecha medicion: ${inactivityDateColumnLabel}`}
                />
                <MappingPreview
                  title="Impacto: curva y etapa detenida"
                  ready={Boolean(curveActualPctColumnKey && stageLocationColumnKey)}
                  affects={["curve.delta_bps", "stage.stalled"]}
                  example={`Avance real %: ${curveActualPctColumnLabel}\nEtapa/ubicacion: ${stageLocationColumnLabel}\nFecha etapa: ${stageSinceColumnLabel}`}
                />
              </div>
            </div>
          ) : null}

          {activeStep === "packs" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ["curve", "Curva"],
                  ["unpaidCerts", "Certificados impagos"],
                  ["monthlyMissingCert", "Falta mensual certificado"],
                  ["inactivity", "Inactividad"],
                  ["stageStalled", "Etapa detenida"],
                ] as Array<[keyof RuleConfig["enabledPacks"], string]>).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">Activar cálculo y hallazgos de este pack</p>
                    </div>
                    <Switch checked={config.enabledPacks[key]} onCheckedChange={(checked) => setPackEnabled(key, checked)} />
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Curva: desvío warning (puntos)</Label>
                  <Input
                    type="number"
                    value={config.thresholds.curve.warnBelow}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          curve: {
                            ...config.thresholds.curve,
                            warnBelow: safeNumber(event.target.value, config.thresholds.curve.warnBelow),
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Curva: desvío crítico (puntos)</Label>
                  <Input
                    type="number"
                    value={config.thresholds.curve.criticalBelow}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          curve: {
                            ...config.thresholds.curve,
                            criticalBelow: safeNumber(event.target.value, config.thresholds.curve.criticalBelow),
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Impagos: días</Label>
                  <Input
                    type="number"
                    value={config.mappings.unpaidCerts?.days ?? 90}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        mappings: {
                          ...config.mappings,
                          unpaidCerts: {
                            ...(config.mappings.unpaidCerts ?? {}),
                            days: safeNumber(event.target.value, 90),
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inactividad: días</Label>
                  <Input
                    type="number"
                    value={config.mappings.inactivity?.days ?? 90}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        mappings: {
                          ...config.mappings,
                          inactivity: {
                            ...(config.mappings.inactivity ?? {}),
                            days: safeNumber(event.target.value, 90),
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Etapa detenida: texto a buscar</Label>
                  <Input
                    value={config.mappings.stageStalled?.keyword ?? "Tesorería"}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        mappings: {
                          ...config.mappings,
                          stageStalled: {
                            ...(config.mappings.stageStalled ?? {}),
                            keyword: event.target.value,
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Etapa detenida: semanas</Label>
                  <Input
                    type="number"
                    value={config.mappings.stageStalled?.weeks ?? 2}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        mappings: {
                          ...config.mappings,
                          stageStalled: {
                            ...(config.mappings.stageStalled ?? {}),
                            weeks: safeNumber(event.target.value, 2),
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan lineal: meses</Label>
                  <Input
                    type="number"
                    value={config.mappings.curve?.plan?.months ?? 0}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        mappings: {
                          ...config.mappings,
                          curve: {
                            ...(config.mappings.curve ?? {}),
                            plan: {
                              mode: "linear",
                              months: safeNumber(event.target.value, 0),
                              startPeriod: config.mappings.curve?.plan?.startPeriod,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan lineal: período inicio</Label>
                  <Input
                    type="month"
                    value={config.mappings.curve?.plan?.startPeriod ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        mappings: {
                          ...config.mappings,
                          curve: {
                            ...(config.mappings.curve ?? {}),
                            plan: {
                              mode: "linear",
                              months: config.mappings.curve?.plan?.months ?? 0,
                              startPeriod: event.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <MappingPreview
                  title="Preview: sensibilidad de hallazgos"
                  ready
                  affects={["curve.behind_plan", "cert.unpaid_overdue", "activity.inactive"]}
                  example={`Curva warn/critical: ${config.thresholds.curve.warnBelow}/${config.thresholds.curve.criticalBelow}\nImpagos > ${config.mappings.unpaidCerts?.days ?? 90} dias\nInactividad > ${config.mappings.inactivity?.days ?? 90} dias`}
                />
                <MappingPreview
                  title="Preview: etapa detenida"
                  ready
                  affects={["stage.stalled"]}
                  example={`Keyword: ${config.mappings.stageStalled?.keyword ?? "Tesoreria"}\nSemanas: ${config.mappings.stageStalled?.weeks ?? 2}\nColumna etapa: ${stageLocationColumnLabel}`}
                />
              </div>
            </div>
          ) : null}

          {activeStep === "revision" ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border bg-[#fcfcfc] p-3">
                  <p className="text-sm font-medium">Tabla certificados</p>
                  <p className="text-sm text-muted-foreground">
                    {filteredTables.find((table) => table.id === certTableId)?.name ?? "Sin definir"}
                  </p>
                </div>
                <div className="rounded-lg border bg-[#fcfcfc] p-3">
                  <p className="text-sm font-medium">Curva</p>
                  <p className="text-sm text-muted-foreground">
                    {filteredTables.find((table) => table.id === curvePlanTableId)?.name ?? "Sin plan"}
                    {" · "}
                    {filteredTables.find((table) => table.id === curveResumenTableId)?.name ?? "Sin resumen"}
                  </p>
                </div>
              </div>
              <div>
                <Label>JSON final</Label>
                <Textarea value={JSON.stringify(config, null, 2)} readOnly className="min-h-[260px] font-mono text-xs" />
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStep(STEPS[Math.max(0, currentStepIndex - 1)].id)}
              disabled={currentStepIndex === 0}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-2">
              {currentStepIndex < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setActiveStep(STEPS[Math.min(STEPS.length - 1, currentStepIndex + 1)].id)}
                >
                  Continuar
                </Button>
              ) : (
                <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
                  {isSaving ? "Guardando..." : saveLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

