"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getSpreadsheetSectionDescription } from "@/lib/spreadsheet-preview-summary";

import type { SpreadsheetPreviewTable } from "./spreadsheet-preview-types";

type SpreadsheetExtractionCardProps = {
  table: SpreadsheetPreviewTable;
  excluded: boolean;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onAdjust: () => void;
  onToggleIncluded: () => void;
  onManualValueChange: (dbColumn: string, value: string) => Promise<void> | void;
};

function isFilled(value: unknown) {
  return value != null && String(value).trim().length > 0;
}

function stringifyValue(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function getLabelForColumn(table: SpreadsheetPreviewTable, column: string) {
  return table.mappings?.find((mapping) => mapping.dbColumn === column)?.label ?? column;
}

function getManualValueForColumn(table: SpreadsheetPreviewTable, column: string) {
  return table.mappings?.find((mapping) => mapping.dbColumn === column)?.manualValue ?? "";
}

function getDetectedValueForColumn(table: SpreadsheetPreviewTable, column: string) {
  const row = table.sampleRows?.[0] ?? table.previewRows?.[0] ?? null;
  return stringifyValue(row?.[column] ?? "");
}

function getCommittedValueForColumn(table: SpreadsheetPreviewTable, column: string) {
  const manualValue = getManualValueForColumn(table, column);
  return manualValue.trim().length > 0 ? manualValue : getDetectedValueForColumn(table, column);
}

function buildExpandedColumns(table: SpreadsheetPreviewTable) {
  const previewRows = table.previewRows ?? [];
  const firstRow = previewRows[0] ?? {};
  const fromMappings = (table.mappings ?? [])
    .filter((mapping) => previewRows.some((row) => isFilled(row[mapping.dbColumn])))
    .map((mapping) => mapping.dbColumn);
  if (fromMappings.length > 0) return fromMappings;

  return Object.keys(firstRow).filter((key) => !key.startsWith("__doc"));
}

function canExpandTablePreview(table: SpreadsheetPreviewTable) {
  if (table.sectionType === "pmc_resumen") return false;
  const expandedColumns = buildExpandedColumns(table);
  const sampleColumns = table.sampleColumns ?? [];
  const sampleRows = table.sampleRows ?? [];
  const previewRows = table.previewRows ?? [];
  return expandedColumns.length > sampleColumns.length || previewRows.length > sampleRows.length;
}

function renderSummaryGrid(
  table: SpreadsheetPreviewTable,
  draftValues: Record<string, string>,
  setDraftValues: Dispatch<SetStateAction<Record<string, string>>>,
  onManualValueChange: (dbColumn: string, value: string) => Promise<void> | void,
  disabled: boolean
) {
  const row = table.sampleRows?.[0] ?? table.previewRows?.[0] ?? null;
  const columns = table.sampleColumns ?? [];
  if (!row || columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
        No encontramos datos para mostrar en esta seccion.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {columns.map((column) => {
        const committedValue = getCommittedValueForColumn(table, column);
        const currentValue = draftValues[column] ?? committedValue;
        const isInvalid = table.keyFieldCoverage?.[column] === false;
        const hasManualValue = getManualValueForColumn(table, column).trim().length > 0;

        return (
          <div
            key={column}
            className={cn(
              "rounded-xl border bg-white/80 px-3 py-2 shadow-sm transition-colors",
              isInvalid ? "border-rose-300 bg-rose-50/80" : "border-border"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {getLabelForColumn(table, column)}
              </p>
              {hasManualValue ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  Manual
                </span>
              ) : null}
            </div>
            <input
              type="text"
              value={currentValue}
              disabled={disabled}
              className={cn(
                "mt-2 w-full rounded-md border bg-transparent px-2 py-1.5 text-sm font-medium text-foreground outline-none transition-colors",
                isInvalid
                  ? "border-rose-300 focus:border-rose-400"
                  : "border-transparent focus:border-border"
              )}
              onChange={(event) =>
                setDraftValues((current) => ({ ...current, [column]: event.target.value }))
              }
              onBlur={() => {
                if (currentValue === committedValue) return;
                void onManualValueChange(column, currentValue);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
            {isInvalid ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-rose-700">
                <AlertCircle className="size-3.5" />
                Revisa este campo o cargalo manualmente.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {hasManualValue ? "Se usara el valor manual." : "Valor detectado automaticamente."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderTabularPreview(table: SpreadsheetPreviewTable, expanded: boolean) {
  const rows = expanded ? (table.previewRows ?? []).slice(0, 10) : table.sampleRows ?? [];
  const columns = expanded ? buildExpandedColumns(table) : table.sampleColumns ?? [];

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
        No encontramos datos para mostrar en esta seccion.
      </div>
    );
  }

  const hiddenColumns = Math.max(0, buildExpandedColumns(table).length - (table.sampleColumns?.length ?? columns.length));

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <Table className="text-xs">
        <TableHeader className="bg-muted/40">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column} className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {getLabelForColumn(table, column)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${table.tablaId}-${index}`}>
              {columns.map((column) => (
                <TableCell key={`${table.tablaId}-${index}-${column}`} className="px-3 py-2 font-mono text-[11px] text-foreground/85">
                  {String(row[column] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!expanded && hiddenColumns > 0 ? (
        <div className="border-t bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          +{hiddenColumns} columnas mas
        </div>
      ) : null}
    </div>
  );
}

export function SpreadsheetExtractionCard({
  table,
  excluded,
  expanded,
  onExpandedChange,
  onAdjust,
  onToggleIncluded,
  onManualValueChange,
}: SpreadsheetExtractionCardProps) {
  const sectionDescription = getSpreadsheetSectionDescription(table.sectionType ?? "generic");
  const sourceLabel = table.sourceLabel ?? (table.sheetName ? `Hoja de origen: ${table.sheetName}` : "Hoja de origen no detectada");
  const warningText = table.statusReason ?? table.warnings?.[0] ?? null;
  const canExpand = canExpandTablePreview(table);

  const [draftValues, setDraftValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (table.sampleColumns ?? []).map((column) => [column, getCommittedValueForColumn(table, column)])
    )
  );

  const content = table.sectionType === "pmc_resumen"
    ? renderSummaryGrid(table, draftValues, setDraftValues, onManualValueChange, excluded)
    : renderTabularPreview(table, expanded);

  const infoText = useMemo(() => {
    if (excluded) return "Fuera de esta importacion";
    if (table.status === "empty") return "Sin datos para importar.";
    return null;
  }, [excluded, table.status]);

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden rounded-2xl border border-border/70 bg-white py-0 shadow-sm transition-colors",
        excluded && "border-amber-400 bg-amber-50/20 ring-2 ring-amber-200"
      )}
    >
      <CardHeader className={cn("border-b bg-muted/20 px-5 py-4", excluded && "border-amber-200 bg-amber-50/80")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{sectionDescription}</CardTitle>
              </div>
              {excluded ? (
                <Badge variant="outline" className="border-amber-400 bg-amber-100 font-medium text-amber-900">
                  No se importara
                </Badge>
              ) : null}
              <Badge variant="outline" className="max-w-full border-border bg-white text-muted-foreground">
                {sourceLabel}
              </Badge>
            </div>
            {infoText ? (
              <CardDescription className={cn("mt-2 text-sm text-muted-foreground", excluded && "font-medium text-amber-900")}>
                {infoText}
              </CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 py-4">
        {excluded ? (
          <div className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-amber-950 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-800" />
              <div>
                <p className="text-sm font-semibold">Esta seccion no se va a importar.</p>
                <p className="mt-1 text-sm text-amber-900">
                  Queda afuera solo para esta carga. Puedes volver a incluirla antes de confirmar.
                </p>
              </div>
            </div>
          </div>
        ) : warningText ? (
          <div className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            table.status === "review"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : table.status === "empty"
                ? "border-stone-200 bg-stone-50 text-stone-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          )}>
            {warningText}
          </div>
        ) : null}

        <Collapsible open={canExpand ? expanded : false} onOpenChange={canExpand ? onExpandedChange : undefined}>
          <div className={cn("space-y-3 transition-opacity", excluded && "opacity-55 saturate-50")}>{content}</div>

          <CardFooter className="justify-between border-t px-0 pt-4">
            <div>
              {canExpand ? (
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={(table.previewRows?.length ?? 0) === 0}>
                    {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    {expanded ? "Ver menos" : "Ver mas"}
                  </Button>
                </CollapsibleTrigger>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onToggleIncluded}>
                {excluded ? "Volver a incluir" : "No importar"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={onAdjust}>
                <Settings2 className="size-4" />
                Ajustar
              </Button>
            </div>
          </CardFooter>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
