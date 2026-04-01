"use client";

import { useState } from "react";
import { Crosshair, Eye, EyeOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { SpreadsheetGridPreview } from "./spreadsheet-grid-preview";
import type { SpreadsheetPreviewPayload, SpreadsheetPreviewTable } from "./spreadsheet-preview-types";

type SpreadsheetAdjustmentDrawerProps = {
  open: boolean;
  table: SpreadsheetPreviewTable | null;
  payload: SpreadsheetPreviewPayload | null;
  isLoading: boolean;
  isApplying: boolean;
  onOpenChange: (open: boolean) => void;
  onSheetChange: (tablaId: string, sheetName: string | null) => Promise<void> | void;
  onMappingChange: (tablaId: string, dbColumn: string, excelHeader: string | null) => Promise<void> | void;
};

export function SpreadsheetAdjustmentDrawer({
  open,
  table,
  payload,
  isLoading,
  isApplying,
  onOpenChange,
  onSheetChange,
  onMappingChange,
}: SpreadsheetAdjustmentDrawerProps) {
  const [isMappingVisible, setIsMappingVisible] = useState(false);
  const [activeMappingDbColumn, setActiveMappingDbColumn] = useState<string | null>(null);

  const availableSheets = table?.availableSheets ?? [];
  const selectedSheet = table?.sheetName ?? "";
  const previewRows = table?.previewRows ?? [];
  const mappings = table?.mappings ?? [];
  const headersForSheet = availableSheets.find((sheet) => sheet.name === selectedSheet)?.headers ?? [];
  const headerToColMap: Record<string, number> = Object.fromEntries(
    headersForSheet.map((header, index) => [header, index])
  );
  const expectedRowCount = previewRows.length || table?.inserted || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[92vw] border-l p-0 sm:max-w-[min(1080px,92vw)]">
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-4 pr-10">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>Ajustar extraccion</SheetTitle>
                  {table?.status ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full",
                        table.status === "ready"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : table.status === "review"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-stone-300 bg-stone-100 text-stone-700"
                      )}
                    >
                      {table.status === "ready" ? "Listo" : table.status === "review" ? "Revisar" : "Sin datos"}
                    </Badge>
                  ) : null}
                </div>
                <SheetDescription className="mt-1">
                  {table?.tablaName ?? "Seccion"}. Cambia hoja o columnas solo si la vista previa no se ve correcta.
                </SheetDescription>
                <p className="mt-2 text-xs text-muted-foreground">
                  Los cambios actualizan esta vista previa automaticamente.
                </p>
              </div>
              {table?.sourceLabel ? (
                <Badge variant="outline" className="max-w-56 truncate border-border bg-white text-muted-foreground">
                  {table.sourceLabel}
                </Badge>
              ) : null}
            </div>
          </SheetHeader>

          {table ? (
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="min-h-0 border-r bg-muted/10">
                <div className="border-b border-emerald-200 bg-emerald-50/60 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Hoja origen
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    Elegi que filas de Excel mostrar
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Esta planilla te ayuda a confirmar de donde salen los datos.
                  </p>
                  <Label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Hoja de Excel
                  </Label>
                  <Select
                    value={selectedSheet || "__none__"}
                    onValueChange={(value) => void onSheetChange(table.tablaId, value === "__none__" ? null : value)}
                    disabled={isLoading || isApplying}
                  >
                    <SelectTrigger className="mt-1.5 h-9 w-full border-emerald-300 bg-background">
                      <SelectValue placeholder="Seleccionar hoja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin hoja</SelectItem>
                      {availableSheets
                        .filter((sheet) => sheet.name.trim().length > 0)
                        .map((sheet) => (
                          <SelectItem key={sheet.name} value={sheet.name}>
                            {sheet.name} ({sheet.rowCount})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-h-0 h-[calc(100vh-16rem)] overflow-hidden">
                  {payload?.existingBucket && payload?.existingPath ? (
                    <SpreadsheetGridPreview
                      bucket={payload.existingBucket}
                      storagePath={payload.existingPath}
                      selectedSheetName={table.sheetName}
                      mappedExcelHeaders={mappings.map((mapping) => mapping.excelHeader).filter(Boolean) as string[]}
                      activeMappingLabel={
                        activeMappingDbColumn
                          ? (mappings.find((mapping) => mapping.dbColumn === activeMappingDbColumn)?.label ?? activeMappingDbColumn)
                          : null
                      }
                      onColumnSelect={(header) => {
                        if (!activeMappingDbColumn) return;
                        void onMappingChange(table.tablaId, activeMappingDbColumn, header);
                        setActiveMappingDbColumn(null);
                      }}
                      headerToColMap={headerToColMap}
                      expectedRowCount={expectedRowCount}
                      extractionMode={table.extractionMode}
                      fixedCellRefs={table.fixedCellRefs}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                      Sin archivo disponible para previsualizar
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 overflow-auto px-4 py-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                          Resultado extraido
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Asi quedaran las filas antes de importar.
                        </p>
                      </div>
                      {previewRows.length > 0 ? (
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-700">
                          {previewRows.length} {previewRows.length === 1 ? "fila" : "filas"}
                        </span>
                      ) : null}
                    </div>
                    <div className="max-h-[38vh] overflow-auto rounded-md border border-orange-200 shadow-sm">
                      {previewRows.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          Sin filas detectadas con la configuracion actual.
                        </div>
                      ) : (() => {
                        const previewColumns =
                          mappings.length > 0
                            ? mappings.filter((mapping) =>
                                previewRows.some((row) => row[mapping.dbColumn] != null && String(row[mapping.dbColumn]).trim() !== "")
                              )
                            : Object.keys(previewRows[0] ?? {})
                                .filter((key) => !key.startsWith("__doc"))
                                .map((key) => ({ dbColumn: key, label: key }));
                        return (
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 border-b border-orange-200 bg-orange-50">
                              <tr>
                                {previewColumns.map((column) => (
                                  <th
                                    key={`head-${column.dbColumn}`}
                                    className="whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-wide text-orange-900"
                                  >
                                    {column.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.slice(0, 40).map((row, index) => (
                                <tr
                                  key={`row-${index}-${String(row.id ?? row.__docPath ?? index)}`}
                                  className={cn(
                                    "border-b border-border/50 last:border-0",
                                    index % 2 === 0 ? "bg-white" : "bg-orange-50/30"
                                  )}
                                >
                                  {previewColumns.map((column) => (
                                    <td
                                      key={`cell-${index}-${column.dbColumn}`}
                                      className="whitespace-nowrap px-2.5 py-1.5 align-top font-mono text-[11px] text-foreground/90"
                                    >
                                      {String(row[column.dbColumn] ?? "")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-2">
                    <div>
                      <p className="text-xs font-semibold">Mapeo avanzado</p>
                      <p className="text-[11px] text-muted-foreground">
                        Abrilo solo si necesitas ajustar columnas manualmente.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMappingVisible((current) => !current)}
                    >
                      {isMappingVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      <span className="ml-1">{isMappingVisible ? "Ocultar" : "Mostrar"}</span>
                    </Button>
                  </div>

                  {isMappingVisible ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Mapeo de columnas
                      </p>
                      <div className="space-y-1">
                        {mappings.map((mapping) => (
                          <div
                            key={`${table.tablaId}-${mapping.dbColumn}`}
                            className={cn(
                              "grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded border border-transparent px-1 py-1 -mx-1 transition-colors",
                              activeMappingDbColumn === mapping.dbColumn && "border-blue-100 bg-blue-50"
                            )}
                          >
                            <div className="min-w-0 text-xs">
                              <p className="truncate font-medium">{mapping.label}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{mapping.dbColumn}</p>
                            </div>
                            <Select
                              value={mapping.excelHeader ?? "__none__"}
                              onValueChange={(value) =>
                                void onMappingChange(
                                  table.tablaId,
                                  mapping.dbColumn,
                                  value === "__none__" ? null : value
                                )
                              }
                              disabled={isLoading || isApplying}
                            >
                              <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="Sin mapear" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin mapear</SelectItem>
                                {headersForSheet.filter((header) => header.trim().length > 0).map((header) => (
                                  <SelectItem key={`${table.tablaId}-${mapping.dbColumn}-${header}`} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <button
                              type="button"
                              title={
                                activeMappingDbColumn === mapping.dbColumn
                                  ? "Cancelar seleccion"
                                  : "Seleccionar columna desde la hoja Excel"
                              }
                              className={cn(
                                "flex items-center justify-center rounded p-1 transition-colors",
                                activeMappingDbColumn === mapping.dbColumn
                                  ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                              onClick={() =>
                                setActiveMappingDbColumn((current) =>
                                  current === mapping.dbColumn ? null : mapping.dbColumn
                                )
                              }
                              disabled={isLoading || isApplying}
                            >
                              <Crosshair className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
              Selecciona una seccion para ajustarla.
            </div>
          )}

          <SheetFooter className="border-t bg-white px-5 py-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
