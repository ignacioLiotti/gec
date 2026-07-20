"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ScanLine,
  Upload,
} from "lucide-react";

import { LightButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  buildImportedDefinitionFromAnalysis,
  type SampleAnalysis,
  type SampleAnswers,
} from "@/lib/obra-defaults/sample-analysis";

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".xlsx",
  ".xls",
  ".csv",
];

const DATA_TYPE_LABELS: Record<string, string> = {
  text: "texto",
  number: "número",
  currency: "moneda",
  date: "fecha",
  boolean: "sí/no",
};

const FORMAT_LABELS: Record<SampleAnalysis["document"]["format"], string> = {
  pdf_texto: "PDF",
  escaneo: "Escaneo",
  foto: "Foto",
  planilla: "Planilla",
};

const ANALYZING_STEPS = [
  "Leyendo el documento",
  "Identificando el tipo",
  "Buscando campos y listas",
];

const EASE = [0.23, 1, 0.32, 1] as const;

type Status = "idle" | "analyzing" | "review" | "applied";

type TableSelection = {
  enabled: boolean;
  columnFieldKeys: Set<string>;
};

type AppliedSummary = {
  fieldCount: number;
  tables: Array<{ label: string; columnCount: number }>;
};

type SampleAnalysisCardProps = {
  onApply: (definitionJson: string) => void;
};

function hasAcceptedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function FileTypeIcon({
  fileName,
  className,
}: {
  fileName: string;
  className?: string;
}) {
  const lower = fileName.toLowerCase();
  if (/\.(png|jpe?g|webp)$/.test(lower)) {
    return <ImageIcon className={className} />;
  }
  if (/\.(xlsx?|csv)$/.test(lower)) {
    return <FileSpreadsheet className={className} />;
  }
  return <FileText className={className} />;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-stroke-soft bg-surface">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors duration-150 active:scale-[0.98]",
              isActive
                ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                : "text-content-muted hover:text-content",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SampleAnalysisCard({ onApply }: SampleAnalysisCardProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<SampleAnalysis | null>(null);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<Set<string>>(
    new Set(),
  );
  const [tableSelections, setTableSelections] = useState<
    Map<string, TableSelection>
  >(new Map());
  const [answers, setAnswers] = useState<SampleAnswers>({});
  const [appliedSummary, setAppliedSummary] = useState<AppliedSummary | null>(
    null,
  );
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const fadeProps = useMemo(
    () => ({
      initial: {
        opacity: 0,
        y: reduceMotion ? 0 : 6,
        filter: "blur(2px)",
      },
      animate: { opacity: 1, y: 0, filter: "blur(0px)" },
      transition: { duration: 0.22, ease: EASE },
    }),
    [reduceMotion],
  );

  useEffect(() => {
    if (status !== "analyzing") {
      setAnalyzeStep(0);
      return;
    }
    const interval = setInterval(() => {
      setAnalyzeStep((current) =>
        Math.min(current + 1, ANALYZING_STEPS.length - 1),
      );
    }, 1700);
    return () => clearInterval(interval);
  }, [status]);

  const resetToIdle = useCallback(() => {
    setStatus("idle");
    setFileName("");
    setAnalysis(null);
    setSelectedFieldKeys(new Set());
    setTableSelections(new Map());
    setAnswers({});
    setAppliedSummary(null);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!hasAcceptedExtension(file.name)) {
      toast.error("Subí un PDF, una imagen o una planilla (Excel/CSV).");
      return;
    }
    setStatus("analyzing");
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/obra-defaults/analyze-sample", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "No se pudo analizar el documento.",
        );
      }
      const result = payload.analysis as SampleAnalysis;
      setAnalysis(result);
      setSelectedFieldKeys(
        new Set(result.fields.map((field) => field.fieldKey)),
      );
      setTableSelections(
        new Map(
          result.tables.map((table) => [
            table.label,
            {
              enabled: true,
              columnFieldKeys: new Set(
                table.columns.map((column) => column.fieldKey),
              ),
            },
          ]),
        ),
      );
      const isSpreadsheet = result.document.format === "planilla";
      setAnswers({
        arrival:
          result.document.format === "foto" ||
          result.document.format === "escaneo"
            ? "fotos"
            : "digital",
        layout: isSpreadsheet
          ? undefined
          : result.document.layoutHint === "formulario_fijo"
            ? "fijo"
            : "variable",
        sheets:
          isSpreadsheet && result.document.sheets.length > 1
            ? "fija"
            : undefined,
      });
      setStatus("review");
    } catch (error) {
      console.error("[sample-analysis] error", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo analizar el documento.",
      );
      setStatus("idle");
    }
  }, []);

  const selectedCount = useMemo(() => {
    let count = selectedFieldKeys.size;
    for (const selection of tableSelections.values()) {
      if (selection.enabled) count += selection.columnFieldKeys.size;
    }
    return count;
  }, [selectedFieldKeys, tableSelections]);

  const handleApply = useCallback(() => {
    if (!analysis) return;
    if (selectedCount === 0) {
      toast.error("Elegí al menos un dato para guardar.");
      return;
    }
    const selectedTables = Array.from(tableSelections.entries())
      .filter(([, selection]) => selection.enabled)
      .map(([label, selection]) => ({
        label,
        columnFieldKeys: Array.from(selection.columnFieldKeys),
      }));
    const definition = buildImportedDefinitionFromAnalysis(analysis, {
      selectedFieldKeys: Array.from(selectedFieldKeys),
      selectedTables,
      answers,
    });
    onApply(JSON.stringify(definition));
    setAppliedSummary({
      fieldCount: selectedFieldKeys.size,
      tables: selectedTables
        .filter((table) => table.columnFieldKeys.length > 0)
        .map((table) => ({
          label: table.label,
          columnCount: table.columnFieldKeys.length,
        })),
    });
    setStatus("applied");
  }, [
    analysis,
    answers,
    onApply,
    selectedCount,
    selectedFieldKeys,
    tableSelections,
  ]);

  const toggleField = useCallback((fieldKey: string) => {
    setSelectedFieldKeys((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  }, []);

  const toggleTable = useCallback((label: string) => {
    setTableSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(label);
      if (!current) return prev;
      next.set(label, { ...current, enabled: !current.enabled });
      return next;
    });
  }, []);

  const toggleTableColumn = useCallback((label: string, fieldKey: string) => {
    setTableSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(label);
      if (!current) return prev;
      const columnFieldKeys = new Set(current.columnFieldKeys);
      if (columnFieldKeys.has(fieldKey)) columnFieldKeys.delete(fieldKey);
      else columnFieldKeys.add(fieldKey);
      next.set(label, { ...current, columnFieldKeys });
      return next;
    });
  }, []);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const listStagger = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.03 },
    },
  };
  const listItem = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 4 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: EASE },
    },
  };

  return (
    <>
      {status === "idle" ? (
        <m.div key="idle" {...fadeProps}>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <div
            onClick={openPicker}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              "flex cursor-pointer flex-col gap-3 rounded-2xl border border-dashed p-4 transition-colors duration-150 sm:flex-row sm:items-center",
              isDragOver
                ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/25"
                : "border-stroke bg-surface-recessed hover:border-stroke-strong",
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-950/40 dark:text-orange-400">
              <Upload className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content">
                Empezá con un documento de ejemplo
              </p>
              <p className="mt-0.5 text-sm text-content-muted">
                Subí uno de los que van a esta carpeta y armamos la
                configuración por vos. PDF, foto o Excel/CSV, hasta 15 MB.
              </p>
            </div>
            <LightButton
              type="button"
              variant="secondary"
              size="lg"
              className="shrink-0 self-start sm:self-center"
              data-testid="sample-analysis-upload"
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
            >
              Elegir archivo
            </LightButton>
          </div>
        </m.div>
      ) : status === "analyzing" ? (
        <m.div
          key="analyzing"
          {...fadeProps}
          className="rounded-2xl border border-stroke-soft bg-surface p-4"
        >
          <div className="flex items-center gap-2.5">
            <FileTypeIcon
              fileName={fileName}
              className="size-4 shrink-0 text-content-muted"
            />
            <p className="truncate text-sm font-medium text-content">
              {fileName}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {ANALYZING_STEPS.map((step, index) => {
              const state =
                index < analyzeStep
                  ? "done"
                  : index === analyzeStep
                    ? "active"
                    : "todo";
              return (
                <div key={step} className="flex items-center gap-2">
                  {state === "done" ? (
                    <Check className="size-3.5 shrink-0 text-success" />
                  ) : state === "active" ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-orange-500" />
                  ) : (
                    <span className="flex size-3.5 shrink-0 items-center justify-center">
                      <span className="size-1 rounded-full bg-stroke-strong" />
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-sm transition-colors duration-150",
                      state === "active"
                        ? "font-medium text-content"
                        : state === "done"
                          ? "text-content-muted"
                          : "text-content-muted/60",
                    )}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </m.div>
      ) : status === "review" && analysis ? (
        <m.div
          key="review"
          {...fadeProps}
          className="space-y-4 rounded-2xl border border-stroke-soft bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500 dark:bg-orange-950/40 dark:text-orange-400">
                <ScanLine className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-content-muted">
                  Detectamos
                </p>
                <h4 className="text-base font-semibold text-content first-letter:uppercase">
                  {analysis.document.family}
                </h4>
                {analysis.document.summary ? (
                  <p className="mt-0.5 text-sm text-content-muted">
                    {analysis.document.summary}
                  </p>
                ) : null}
                <p className="mt-1 truncate text-xs text-content-muted">
                  {fileName} · {FORMAT_LABELS[analysis.document.format]}
                  {analysis.document.format === "planilla"
                    ? analysis.document.sheets.length > 0
                      ? ` · ${analysis.document.sheets.length} hoja${analysis.document.sheets.length === 1 ? "" : "s"}`
                      : ""
                    : ` · ${analysis.document.pageCount} página${analysis.document.pageCount === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
            <LightButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetToIdle}
            >
              <RefreshCw className="mr-2 size-4" />
              Usar otro ejemplo
            </LightButton>
          </div>

          {analysis.warnings.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
              <div className="space-y-0.5 text-xs text-warning-foreground">
                {analysis.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          {analysis.fields.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-content-muted">
                Datos del documento
              </p>
              <m.div
                variants={listStagger}
                initial="hidden"
                animate="show"
                className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {analysis.fields.map((field) => {
                  const isSelected = selectedFieldKeys.has(field.fieldKey);
                  return (
                    <m.label
                      key={field.fieldKey}
                      variants={listItem}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 transition-colors duration-150",
                        isSelected
                          ? "border-stroke-soft bg-surface hover:border-stroke"
                          : "border-transparent bg-surface-recessed opacity-55 hover:opacity-80",
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleField(field.fieldKey)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs text-content-muted">
                          <span className="truncate">{field.label}</span>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0">
                            {DATA_TYPE_LABELS[field.dataType] ?? field.dataType}
                          </span>
                          {field.confidence === "baja" ? (
                            <Badge variant="warning" size="xs">
                              Revisar
                            </Badge>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-sm",
                            field.sampleValue
                              ? "font-medium text-content"
                              : "italic text-content-muted",
                          )}
                        >
                          {field.sampleValue ?? "No se leyó en el ejemplo"}
                        </p>
                      </div>
                    </m.label>
                  );
                })}
              </m.div>
            </div>
          ) : null}

          {analysis.tables.map((table) => {
            const selection = tableSelections.get(table.label);
            if (!selection) return null;
            return (
              <div
                key={table.label}
                className="overflow-hidden rounded-xl border border-stroke-soft"
              >
                <label
                  className={cn(
                    "flex cursor-pointer flex-wrap items-center gap-2.5 px-3 py-2.5 transition-colors duration-150",
                    !selection.enabled && "bg-surface-recessed opacity-70",
                  )}
                >
                  <Checkbox
                    checked={selection.enabled}
                    onCheckedChange={() => toggleTable(table.label)}
                  />
                  <span className="text-sm font-medium text-content">
                    {table.label}
                  </span>
                  <Badge variant="neutral" size="xs">
                    lista
                  </Badge>
                  {table.totalRowsSeen > 0 ? (
                    <span className="text-xs text-content-muted">
                      {table.totalRowsSeen} filas en tu ejemplo
                    </span>
                  ) : null}
                </label>
                {selection.enabled ? (
                  <div className="border-t border-stroke-soft">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            {table.columns.map((column) => {
                              const isOn = selection.columnFieldKeys.has(
                                column.fieldKey,
                              );
                              return (
                                <th key={column.fieldKey} className="p-0">
                                  <button
                                    type="button"
                                    aria-pressed={isOn}
                                    title={
                                      isOn
                                        ? "Sacar esta columna"
                                        : "Incluir esta columna"
                                    }
                                    onClick={() =>
                                      toggleTableColumn(
                                        table.label,
                                        column.fieldKey,
                                      )
                                    }
                                    className={cn(
                                      "w-full whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide transition-colors duration-150 active:scale-[0.99]",
                                      isOn
                                        ? "text-content hover:text-orange-600"
                                        : "text-content-muted/50 line-through hover:text-content-muted",
                                    )}
                                  >
                                    {column.label}
                                  </button>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {table.sampleRows.slice(0, 3).map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className="border-t border-stroke-soft"
                            >
                              {table.columns.map((column) => {
                                const isOn = selection.columnFieldKeys.has(
                                  column.fieldKey,
                                );
                                return (
                                  <td
                                    key={column.fieldKey}
                                    className={cn(
                                      "max-w-[160px] truncate px-2.5 py-1.5 transition-colors duration-150",
                                      isOn
                                        ? "text-content"
                                        : "text-content-muted/40",
                                    )}
                                  >
                                    {row[column.fieldKey] ?? "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="border-t border-stroke-soft bg-surface-recessed px-3 py-1.5 text-[11px] text-content-muted">
                      Tocá un título para incluir o sacar esa columna.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}

          {(() => {
            const isSpreadsheet = analysis.document.format === "planilla";
            const showArrival =
              !isSpreadsheet &&
              analysis.document.format !== "foto" &&
              analysis.document.format !== "escaneo";
            const showLayout = !isSpreadsheet;
            const showSheets =
              isSpreadsheet && analysis.document.sheets.length > 1;
            if (!showArrival && !showLayout && !showSheets) return null;
            return (
              <div className="space-y-2.5 rounded-xl bg-surface-recessed p-3.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-content-muted">
                  Para leerlos mejor
                </p>
                {showArrival ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                    <p className="text-sm text-content">
                      ¿Cómo van a llegar estos documentos?
                    </p>
                    <Segmented
                      value={answers.arrival}
                      onChange={(arrival) =>
                        setAnswers((prev) => ({ ...prev, arrival }))
                      }
                      options={[
                        { value: "digital", label: "Siempre digitales" },
                        { value: "fotos", label: "A veces fotos" },
                      ]}
                    />
                  </div>
                ) : null}
                {showLayout ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                    <p className="text-sm text-content">
                      ¿El formato es siempre igual a este ejemplo?
                    </p>
                    <Segmented
                      value={answers.layout}
                      onChange={(layout) =>
                        setAnswers((prev) => ({ ...prev, layout }))
                      }
                      options={[
                        { value: "fijo", label: "Siempre igual" },
                        { value: "variable", label: "Varía" },
                      ]}
                    />
                  </div>
                ) : null}
                {showSheets ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                    <p className="text-sm text-content">
                      ¿La información está siempre en la misma hoja?
                    </p>
                    <Segmented
                      value={answers.sheets}
                      onChange={(sheets) =>
                        setAnswers((prev) => ({ ...prev, sheets }))
                      }
                      options={[
                        { value: "fija", label: "Misma hoja" },
                        { value: "buscar", label: "Puede cambiar" },
                      ]}
                    />
                  </div>
                ) : null}
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke-soft pt-3">
            <p className="text-sm text-content-muted">
              <span className="font-medium text-content">{selectedCount}</span>{" "}
              dato{selectedCount === 1 ? "" : "s"} para guardar
            </p>
            <LightButton
              type="button"
              variant="primary"
              size="lg"
              onClick={handleApply}
              data-testid="sample-analysis-apply"
            >
              Usar esta configuración
            </LightButton>
          </div>
        </m.div>
      ) : status === "applied" && appliedSummary ? (
        <m.div
          key="applied"
          {...fadeProps}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke-soft bg-surface px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <Check className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content">
                Configuración lista
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="neutral" size="xs" className="max-w-[220px]">
                  <span className="truncate">{fileName}</span>
                </Badge>
                {appliedSummary.fieldCount > 0 ? (
                  <Badge variant="secondary" size="xs">
                    {appliedSummary.fieldCount} dato
                    {appliedSummary.fieldCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
                {appliedSummary.tables.map((table) => (
                  <Badge key={table.label} variant="secondary" size="xs">
                    {table.label}: {table.columnCount} columna
                    {table.columnCount === 1 ? "" : "s"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <LightButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToIdle}
          >
            <RefreshCw className="mr-2 size-4" />
            Usar otro ejemplo
          </LightButton>
        </m.div>
      ) : null}
    </>
  );
}
