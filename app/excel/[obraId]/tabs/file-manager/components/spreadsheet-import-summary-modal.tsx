"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { buildSpreadsheetPreviewSummary, getSpreadsheetSectionSortOrder } from "@/lib/spreadsheet-preview-summary";

import { SpreadsheetExtractionCard } from "./spreadsheet-extraction-card";
import type { SpreadsheetPreviewPayload } from "./spreadsheet-preview-types";

type SpreadsheetImportSummaryModalProps = {
  payload: SpreadsheetPreviewPayload | null;
  excludedTablaIds: string[];
  isLoading: boolean;
  isApplying: boolean;
  allowAdjust?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  onAdjust: (tablaId: string) => void;
  onToggleTablaIncluded: (tablaId: string) => void;
  onManualValueChange: (tablaId: string, dbColumn: string, value: string) => Promise<void> | void;
};

function getOverallStatus(summary: ReturnType<typeof buildSpreadsheetPreviewSummary>) {
  if (summary.totalRows === 0) {
    return {
      label: "No se detectaron datos utiles",
      className: "border-stone-300 bg-stone-100 text-stone-700",
      icon: AlertCircle,
    };
  }
  if (summary.reviewSections > 0) {
    return {
      label: "Revision recomendada",
      className: "border-amber-300 bg-amber-50 text-amber-700",
      icon: AlertCircle,
    };
  }
  return {
    label: "Listo para importar",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  };
}

export function SpreadsheetImportSummaryModal({
  payload,
  excludedTablaIds,
  isLoading,
  isApplying,
  allowAdjust = true,
  onCancel,
  onConfirm,
  onAdjust,
  onToggleTablaIncluded,
  onManualValueChange,
}: SpreadsheetImportSummaryModalProps) {
  const [expandedTableIds, setExpandedTableIds] = useState<Record<string, boolean>>({});

  const includedTables = useMemo(
    () => (payload?.perTable ?? []).filter((table) => !excludedTablaIds.includes(table.tablaId)),
    [excludedTablaIds, payload]
  );

  const summary = useMemo(
    () => buildSpreadsheetPreviewSummary(includedTables),
    [includedTables]
  );

  const sortedTables = useMemo(() => {
    return [...(payload?.perTable ?? [])].sort((left, right) => {
      const byType =
        getSpreadsheetSectionSortOrder(left.sectionType ?? "generic") -
        getSpreadsheetSectionSortOrder(right.sectionType ?? "generic");
      if (byType !== 0) return byType;
      return left.tablaName.localeCompare(right.tablaName);
    });
  }, [payload]);

  const status = getOverallStatus(summary);
  const StatusIcon = status.icon;
  const primaryLabel =
    excludedTablaIds.length > 0
      ? "Importar seleccionadas"
      : summary.reviewSections > 0
        ? "Importar secciones listas"
        : "Importar todo";
  const fileExtension = payload?.existingFileName?.split(".").pop()?.toUpperCase() ?? "ARCHIVO";

  return (
    <>
      <div className="flex shrink-0 flex-col border-b">
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Revisa la importacion</DialogTitle>
              <Badge variant="outline" className={status.className}>
                <StatusIcon className="size-3.5" />
                {status.label}
              </Badge>
            </div>
            <DialogDescription className="mt-1.5 max-w-3xl">
              Detectamos automaticamente los datos del archivo. Si todo se ve bien, importa en un clic.
            </DialogDescription>
          </div>
          {payload ? (
            <Badge variant="outline" className="max-w-72 truncate border-border bg-white text-muted-foreground">
              <FileSpreadsheet className="size-3.5" />
              {payload.existingFileName} · {fileExtension}
            </Badge>
          ) : null}
        </div>

      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/10 px-5 py-5">
        {isLoading && !payload ? (
          <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Detectando datos del archivo...
          </div>
        ) : (
          <div className="space-y-4">
            {sortedTables.map((table) => (
              <SpreadsheetExtractionCard
                key={`${table.tablaId}-${JSON.stringify(table.sampleRows?.[0] ?? null)}-${JSON.stringify((table.mappings ?? []).map((mapping) => [mapping.dbColumn, mapping.manualValue ?? ""]))}`}
                table={table}
                excluded={excludedTablaIds.includes(table.tablaId)}
                expanded={Boolean(expandedTableIds[table.tablaId])}
                allowAdjust={allowAdjust}
                onExpandedChange={(open) =>
                  setExpandedTableIds((current) => ({ ...current, [table.tablaId]: open }))
                }
                onAdjust={() => onAdjust(table.tablaId)}
                onToggleIncluded={() => onToggleTablaIncluded(table.tablaId)}
                onManualValueChange={(dbColumn, value) => onManualValueChange(table.tablaId, dbColumn, value)}
              />
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onCancel} disabled={isApplying}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={isLoading || isApplying || !summary.canImportAll}>
          {isApplying ? "Importando..." : primaryLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
