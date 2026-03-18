"use client";

import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ClipboardPaste, Loader2, Table2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { OcrTablaColumn } from "../types";

type AddRowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: OcrTablaColumn[];
  tablaId: string;
  obraId: string;
  onRowAdded: () => void;
};

type ParsedBulkResult = {
  rows: Record<string, unknown>[];
  usesHeader: boolean;
  skippedEmptyRows: number;
  skippedInvalidRows: number;
};

const normalizeHeaderToken = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const isEmptyCell = (value: unknown) => String(value ?? "").trim() === "";

const parseBooleanValue = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "si" || normalized === "sí";
};

const parseLocalizedNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s+/g, "").replace(/\$/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");

  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = compact.replaceAll(thousandsSeparator, "");
    if (decimalSeparator === ",") {
      normalized = normalized.replace(",", ".");
    }
  } else if (lastComma >= 0) {
    normalized =
      compact.indexOf(",") === lastComma && compact.length - lastComma - 1 <= 2
        ? compact.replace(",", ".")
        : compact.replaceAll(",", "");
  } else if (lastDot >= 0) {
    normalized =
      compact.indexOf(".") === lastDot && compact.length - lastDot - 1 <= 2
        ? compact
        : compact.replaceAll(".", "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const PERIOD_CELL_PATTERN = /^(?:[a-z]{3}|[a-z]{3,4})[-/.]?\d{2,4}$/i;

const PERIOD_MONTH_MAP: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  set: "09",
  oct: "10",
  nov: "11",
  dic: "12",
  jan: "01",
  apr: "04",
  aug: "08",
  dec: "12",
};

const periodToCertificationDate = (periodo: string) => {
  const trimmed = periodo.trim();
  if (!trimmed) return "";

  const normalized = trimmed
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const match = normalized.match(/^([a-z]{3,4})[-/.](\d{2,4})$/);
  if (!match) return "";

  const month = PERIOD_MONTH_MAP[match[1]];
  if (!month) return "";

  const rawYear = match[2];
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear.padStart(4, "20");
  return `01/${month}/${year}`;
};

function parseCertificadoSheetRows(
  rows: string[][],
  columns: OcrTablaColumn[]
): ParsedBulkResult | null {
  const fieldKeys = new Set(columns.map((column) => column.fieldKey));
  const canMapResumen =
    fieldKeys.has("periodo") &&
    fieldKeys.has("nro_certificado") &&
    fieldKeys.has("monto_certificado");

  if (!canMapResumen) return null;

  const markerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeaderToken(String(cell ?? "")) === "certificadosdeobra")
  );

  if (markerIndex < 0) return null;

  const dataRows = rows.slice(markerIndex + 1);
  if (dataRows.length === 0) return null;

  let skippedEmptyRows = 0;
  let skippedInvalidRows = 0;
  let accumulatedAmount = 0;
  const mappedRows: Record<string, unknown>[] = [];

  for (const row of dataRows) {
    if (row.every((cell) => isEmptyCell(cell))) {
      skippedEmptyRows += 1;
      continue;
    }

    const recordType = String(row[1] ?? "").trim().toLowerCase();
    if (!recordType.includes("certificado")) {
      skippedInvalidRows += 1;
      continue;
    }

    const certificado = String(row[2] ?? "").trim();
    const periodIndex = row.findIndex((cell) => PERIOD_CELL_PATTERN.test(String(cell ?? "").trim()));
    const periodo = periodIndex >= 0 ? String(row[periodIndex] ?? "").trim() : "";

    let montoCertificado: number | null = null;
    const amountSearchEnd = periodIndex >= 0 ? periodIndex : row.length;
    for (let index = 3; index < amountSearchEnd; index += 1) {
      const rawCandidate = String(row[index] ?? "").trim();
      if (!rawCandidate || rawCandidate === "$") continue;
      const candidate = parseLocalizedNumber(rawCandidate);
      if (candidate != null) {
        montoCertificado = candidate;
        break;
      }
    }

    if (!certificado || montoCertificado == null) {
      skippedInvalidRows += 1;
      continue;
    }

    accumulatedAmount = Number((accumulatedAmount + montoCertificado).toFixed(2));

    const expediente = String(row[0] ?? "").trim();
    const isPlaceholderRow =
      !periodo && !expediente && (montoCertificado === 0 || Object.is(montoCertificado, -0));
    if (isPlaceholderRow) {
      skippedInvalidRows += 1;
      accumulatedAmount -= montoCertificado;
      continue;
    }

    const cobradoIndex = periodIndex >= 0 ? periodIndex + 1 : -1;
    const cobrado =
      cobradoIndex >= 0 ? parseBooleanValue(String(row[cobradoIndex] ?? "")) : false;

    const mapped: Record<string, unknown> = {
      periodo,
      nro_certificado: certificado,
      fecha_certificacion: periodToCertificationDate(periodo),
      monto_certificado: montoCertificado,
      avance_fisico_acumulado_pct: "",
      monto_acumulado: accumulatedAmount,
      n_expediente: expediente,
      cobrado,
    };

    const missesRequired = columns.some(
      (column) => column.required && isEmptyCell(mapped[column.fieldKey])
    );
    if (missesRequired) {
      skippedInvalidRows += 1;
      continue;
    }

    mappedRows.push(mapped);
  }

  if (mappedRows.length === 0) {
    return null;
  }

  return {
    rows: mappedRows,
    usesHeader: false,
    skippedEmptyRows,
    skippedInvalidRows,
  };
}

function parseBulkRowsFromText(
  text: string,
  columns: OcrTablaColumn[]
): ParsedBulkResult {
  const parsed = Papa.parse<string[]>(text, {
    delimiter: "",
    skipEmptyLines: "greedy",
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message || "No se pudo leer el CSV");
  }

  const rows = (parsed.data as string[][]).filter((row) =>
    row.some((cell) => !isEmptyCell(cell))
  );

  if (rows.length === 0) {
    throw new Error("Pega un CSV o TSV con al menos una fila");
  }

  const certificadoRows = parseCertificadoSheetRows(rows, columns);
  if (certificadoRows) {
    return certificadoRows;
  }

  const headerLookup = new Map<string, OcrTablaColumn>();
  columns.forEach((column) => {
    headerLookup.set(normalizeHeaderToken(column.label), column);
    headerLookup.set(normalizeHeaderToken(column.fieldKey), column);
  });

  const firstRow = rows[0] ?? [];
  const headerMatches = firstRow.reduce((count, cell) => {
    return headerLookup.has(normalizeHeaderToken(String(cell ?? ""))) ? count + 1 : count;
  }, 0);

  const usesHeader = headerMatches > 0;
  const dataRows = usesHeader ? rows.slice(1) : rows;
  const columnIndexByFieldKey = new Map<string, number>();

  if (usesHeader) {
    firstRow.forEach((cell, index) => {
      const column = headerLookup.get(normalizeHeaderToken(String(cell ?? "")));
      if (column) {
        columnIndexByFieldKey.set(column.fieldKey, index);
      }
    });
  }

  let skippedEmptyRows = 0;
  let skippedInvalidRows = 0;
  const mappedRows: Record<string, unknown>[] = [];

  dataRows.forEach((row) => {
    if (row.every((cell) => isEmptyCell(cell))) {
      skippedEmptyRows += 1;
      return;
    }

    const mapped: Record<string, unknown> = {};

    columns.forEach((column, columnIndex) => {
      const sourceIndex = usesHeader
        ? columnIndexByFieldKey.get(column.fieldKey) ?? -1
        : columnIndex;
      const rawValue = sourceIndex >= 0 ? String(row[sourceIndex] ?? "").trim() : "";

      switch (column.dataType) {
        case "boolean":
          mapped[column.fieldKey] = parseBooleanValue(rawValue);
          break;
        default:
          mapped[column.fieldKey] = rawValue;
          break;
      }
    });

    const hasContent = columns.some((column) => !isEmptyCell(mapped[column.fieldKey]));
    if (!hasContent) {
      skippedEmptyRows += 1;
      return;
    }

    const missesRequired = columns.some(
      (column) => column.required && isEmptyCell(mapped[column.fieldKey])
    );
    if (missesRequired) {
      skippedInvalidRows += 1;
      return;
    }

    mappedRows.push(mapped);
  });

  if (mappedRows.length === 0) {
    throw new Error("No se detectaron filas validas para agregar");
  }

  return {
    rows: mappedRows,
    usesHeader,
    skippedEmptyRows,
    skippedInvalidRows,
  };
}

export function AddRowDialog({
  open,
  onOpenChange,
  columns,
  tablaId,
  obraId,
  onRowAdded,
}: AddRowDialogProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [csvText, setCsvText] = useState("");
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const initialData: Record<string, unknown> = {};
    columns.forEach((column) => {
      switch (column.dataType) {
        case "boolean":
          initialData[column.fieldKey] = false;
          break;
        default:
          initialData[column.fieldKey] = "";
          break;
      }
    });

    setFormData(initialData);
    setCsvText("");
    setIsPasteMode(false);
  }, [columns, open]);

  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const csvPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    try {
      return parseBulkRowsFromText(csvText, columns);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "No se pudo leer el texto pegado",
      };
    }
  }, [columns, csvText]);

  const submitRows = useCallback(
    async (dirtyRows: Record<string, unknown>[]) => {
      const payload = dirtyRows.map((row) => ({
        id: crypto.randomUUID(),
        source: "manual",
        ...row,
      }));

      const response = await fetch(`/api/obras/${obraId}/tablas/${tablaId}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirtyRows: payload }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "No se pudo agregar la fila");
      }
    },
    [obraId, tablaId]
  );

  const handleSubmit = useCallback(async () => {
    if (csvText.trim()) {
      let parsedRows: ParsedBulkResult;
      try {
        parsedRows = parseBulkRowsFromText(csvText, columns);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo leer el CSV");
        return;
      }

      setIsSubmitting(true);
      try {
        await submitRows(parsedRows.rows);
        toast.success(`Se agregaron ${parsedRows.rows.length} filas`);
        if (parsedRows.skippedInvalidRows > 0) {
          toast.message(
            `Se omitieron ${parsedRows.skippedInvalidRows} filas sin los campos requeridos`
          );
        }
        if (parsedRows.skippedEmptyRows > 0) {
          toast.message(`Se omitieron ${parsedRows.skippedEmptyRows} filas vacias`);
        }
        onRowAdded();
        onOpenChange(false);
      } catch (error) {
        console.error("Error adding rows:", error);
        toast.error(error instanceof Error ? error.message : "Error agregando filas");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    for (const column of columns) {
      if (!column.required) continue;
      const value = formData[column.fieldKey];
      if (value === "" || value === null || value === undefined) {
        toast.error(`El campo "${column.label}" es requerido`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const rowData: Record<string, unknown> = {};
      columns.forEach((column) => {
        const value = formData[column.fieldKey];
        switch (column.dataType) {
          case "number":
          case "currency":
            rowData[column.fieldKey] = value === "" ? null : Number(value);
            break;
          case "boolean":
            rowData[column.fieldKey] = Boolean(value);
            break;
          default:
            rowData[column.fieldKey] = value;
            break;
        }
      });

      await submitRows([rowData]);
      toast.success("Fila agregada exitosamente");
      onRowAdded();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding row:", error);
      toast.error(error instanceof Error ? error.message : "Error agregando fila");
    } finally {
      setIsSubmitting(false);
    }
  }, [columns, csvText, formData, onOpenChange, onRowAdded, submitRows]);

  const renderField = (column: OcrTablaColumn) => {
    const value = formData[column.fieldKey];

    switch (column.dataType) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Switch
              id={column.fieldKey}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(column.fieldKey, checked)}
            />
            <Label htmlFor={column.fieldKey} className="cursor-pointer text-sm">
              {value ? "Si" : "No"}
            </Label>
          </div>
        );
      case "number":
      case "currency":
        return (
          <Input
            id={column.fieldKey}
            type="number"
            step={column.dataType === "currency" ? "0.01" : "any"}
            value={String(value ?? "")}
            onChange={(event) => handleFieldChange(column.fieldKey, event.target.value)}
            placeholder={column.dataType === "currency" ? "0.00" : "0"}
            className={cn(
              "w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900",
              "placeholder:text-stone-400",
              "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
              "transition-all duration-200"
            )}
          />
        );
      case "date":
        return (
          <Input
            id={column.fieldKey}
            type="date"
            value={String(value ?? "")}
            onChange={(event) => handleFieldChange(column.fieldKey, event.target.value)}
            className={cn(
              "w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900",
              "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
              "transition-all duration-200"
            )}
          />
        );
      default:
        return (
          <Input
            id={column.fieldKey}
            type="text"
            value={String(value ?? "")}
            onChange={(event) => handleFieldChange(column.fieldKey, event.target.value)}
            placeholder={`Ingresa ${column.label.toLowerCase()}`}
            className={cn(
              "w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900",
              "placeholder:text-stone-400",
              "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
              "transition-all duration-200"
            )}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-full max-w-2xl rounded-none border-none bg-transparent p-0 shadow-none"
        )}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="relative flex min-h-[800px]">
            <div
              className={cn(
                "relative ml-4 flex flex-1 flex-col justify-start overflow-hidden rounded-none pl-4",
                "border border-stone-200 bg-white",
                "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]"
              )}
            >
              <div className="absolute bottom-0 left-3 top-[-3rem] z-10 flex flex-col justify-around py-8">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-5 w-5 rounded-full border border-stone-300 bg-stone-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]"
                  />
                ))}
              </div>
              <div className="absolute bottom-0 left-11 top-0 h-full w-px bg-stone-200" />

              <DialogClose className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600">
                <X className="h-4 w-4" />
              </DialogClose>

              <div className="px-12 pb-5 pt-6">
                <div className="relative flex flex-col items-start justify-start">
                  <DialogTitle className="text-2xl font-semibold text-stone-900">
                    Agregar fila
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-stone-500">
                    Completa los campos para agregar una nueva fila o pega un CSV para cargar varias.
                  </DialogDescription>

                  <div className="absolute bottom-[-0.75rem] left-0 mt-5 ml-[-4rem] h-px w-[130%] bg-stone-200" />

                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      Nueva fila
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setIsPasteMode((prev) => !prev)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                        isPasteMode
                          ? "border-amber-300 bg-amber-50 text-amber-900"
                          : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      Pegar CSV
                    </button>
                  </div>
                </div>
              </div>

              <div className="mx-12 max-h-[calc(90vh-250px)] overflow-y-auto bg-sidebar/50 px-5 pb-6 pt-4">
                <div className="space-y-5">
                  {isPasteMode ? (
                    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
                      <div className="space-y-1">
                        <Label className="block text-xs font-medium uppercase tracking-wider text-stone-500">
                          Pegar CSV o TSV
                        </Label>
                        <p className="text-xs text-stone-500">
                          Si pegas una hoja de certificado como la de INVICO, se extraen solo las filas reales del certificado.
                        </p>
                      </div>
                      <Textarea
                        value={csvText}
                        onChange={(event) => setCsvText(event.target.value)}
                        placeholder={columns.map((column) => column.label).join(", ")}
                        className="min-h-40 resize-y bg-white"
                      />
                      {csvPreview && "error" in csvPreview ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {csvPreview.error}
                        </div>
                      ) : csvPreview ? (
                        <div className="space-y-3">
                          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                            Se detectaron {csvPreview.rows.length} filas validas.
                            {csvPreview.usesHeader
                              ? " Se uso la primera fila como encabezado."
                              : " Se aplico extraccion automatica por formato o por orden de columnas."}
                            {csvPreview.skippedInvalidRows > 0
                              ? ` ${csvPreview.skippedInvalidRows} filas se omitiran por formato no valido o faltantes requeridos.`
                              : ""}
                            {csvPreview.skippedEmptyRows > 0
                              ? ` ${csvPreview.skippedEmptyRows} filas vacias se omitiran.`
                              : ""}
                          </div>
                          <div className="overflow-hidden rounded-lg border border-stone-200">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-stone-50 text-stone-500">
                                  <tr>
                                    {columns.map((column) => (
                                      <th
                                        key={column.id}
                                        className="px-3 py-2 text-left font-medium"
                                      >
                                        {column.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {csvPreview.rows.slice(0, 5).map((row, index) => (
                                    <tr
                                      key={`preview-${index}`}
                                      className="border-t border-stone-100"
                                    >
                                      {columns.map((column) => (
                                        <td key={column.id} className="px-3 py-2 text-stone-700">
                                          {String(row[column.fieldKey] ?? "") || "-"}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {columns.map((column) => (
                    <div key={column.id}>
                      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-500">
                        {column.label}
                        {column.required ? <span className="ml-1 text-red-500">*</span> : null}
                      </Label>
                      {renderField(column)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto max-h-16 border-t border-stone-100 bg-sidebar px-8 py-5">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
                      "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                    )}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all duration-200",
                      "bg-stone-800 text-white hover:bg-stone-700 active:bg-stone-900",
                      isSubmitting ? "cursor-not-allowed opacity-60" : null
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Table2 className="h-4 w-4" />
                        {csvText.trim() ? "Agregar filas" : "Agregar fila"}
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
