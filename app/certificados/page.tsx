'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ColGroup, ColumnResizer, balanceTableColumns } from "@/components/ui/column-resizer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { FileSpreadsheet, X, Columns3, Eye, EyeOff, Pin, FileText, MoveHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Papa from "papaparse";
import { toast } from "sonner";
import { CheckedState } from "@radix-ui/react-checkbox";

type CertRow = {
  id: string;
  obraId: string;
  obraName: string;
  ente: string;
  n_exp: string;
  n_certificado: number;
  monto: number;
  mes: string;
  estado: string;
  facturado: boolean;
  fecha_facturacion: string | null;
  nro_factura: string | null;
  concepto: string | null;
  cobrado: boolean;
  observaciones: string | null;
  vencimiento: string | null;
  fecha_pago: string | null;
};

// InBodyStates component (inline for simplicity)
function InBodyStates({
  isLoading,
  tableError,
  colspan,
  empty,
  onRetry,
  emptyText,
}: {
  isLoading: boolean;
  tableError: string | null;
  colspan: number;
  empty: boolean;
  onRetry: () => void;
  emptyText: string;
}) {
  if (isLoading && empty) {
    return (
      <tr>
        <td colSpan={colspan} className="px-4 py-16 text-center border-t border-border">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Cargando datos...</p>
          </div>
        </td>
      </tr>
    );
  }

  if (tableError) {
    return (
      <tr>
        <td colSpan={colspan} className="px-4 py-16 text-center border-t border-border">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-destructive">Error: {tableError}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
          </div>
        </td>
      </tr>
    );
  }

  if (empty) {
    return (
      <tr>
        <td colSpan={colspan} className="px-4 py-16 text-center border-t border-border">
          <p className="text-sm text-orange-primary/80">{emptyText}</p>
        </td>
      </tr>
    );
  }

  return null;
}

// Custom Input component (inline for simplicity)
const CustomInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "w-full text-sm bg-transparent border-none outline-none px-0 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:ring-primary",
          className,
        )}
        {...props}
      />
    );
  }
);
CustomInput.displayName = "CustomInput";

const FIELD_BY_INDEX = [
  "obraName", "ente", "facturado", "fecha_facturacion", "nro_factura",
  "monto", "concepto", "cobrado", "n_exp", "observaciones", "vencimiento", "fecha_pago"
];

const COLUMN_TO_DB: Record<number, string> = {
  0: "obra",
  1: "ente",
  2: "facturado",
  3: "fecha_facturacion",
  4: "nro_factura",
  5: "monto",
  6: "concepto",
  7: "cobrado",
  8: "n_exp",
  9: "observaciones",
  10: "vencimiento",
  11: "fecha_pago",
};

type FiltersState = {
  montoMin: string;
  montoMax: string;
  entes: string[];
  facturado: "all" | "si" | "no";
  cobrado: "all" | "si" | "no";
  conceptoContains: string;
  fechaFacturacionMin: string;
  fechaFacturacionMax: string;
  fechaPagoMin: string;
  fechaPagoMax: string;
  vencimientoMin: string;
  vencimientoMax: string;
};

export default function CertificadosPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CertRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderBy, setOrderBy] = useState<string>("obra");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const tableId = "certificados-table";

  // Filtros avanzados
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>({
    montoMin: "",
    montoMax: "",
    entes: [],
    facturado: "all",
    cobrado: "all",
    conceptoContains: "",
    fechaFacturacionMin: "",
    fechaFacturacionMax: "",
    fechaPagoMin: "",
    fechaPagoMax: "",
    vencimientoMin: "",
    vencimientoMax: "",
  });

  const [hiddenCols, setHiddenCols] = useState<number[]>([]);
  const [pinnedColumns, setPinnedColumns] = useState<number[]>([0]);
  const hasLoadedRef = useRef(false);

  const isHidden = useCallback((i: number) => hiddenCols.includes(i), [hiddenCols]);
  const isPinned = useCallback((colIndex: number) => pinnedColumns.includes(colIndex), [pinnedColumns]);

  // Extract all unique entes for filter
  const allEntes = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.ente?.trim()) set.add(row.ente.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const applyFiltersToParams = useCallback((params: URLSearchParams) => {
    if (filters.montoMin.trim()) params.set("montoMin", filters.montoMin.trim());
    if (filters.montoMax.trim()) params.set("montoMax", filters.montoMax.trim());
    filters.entes.forEach((e) => { if (e.trim()) params.append("ente", e); });
    if (filters.facturado !== "all") params.set("facturado", filters.facturado);
    if (filters.cobrado !== "all") params.set("cobrado", filters.cobrado);
    if (filters.conceptoContains.trim()) params.set("conceptoContains", filters.conceptoContains.trim());
    if (filters.fechaFacturacionMin.trim()) params.set("fechaFacturacionMin", filters.fechaFacturacionMin.trim());
    if (filters.fechaFacturacionMax.trim()) params.set("fechaFacturacionMax", filters.fechaFacturacionMax.trim());
    if (filters.fechaPagoMin.trim()) params.set("fechaPagoMin", filters.fechaPagoMin.trim());
    if (filters.fechaPagoMax.trim()) params.set("fechaPagoMax", filters.fechaPagoMax.trim());
    if (filters.vencimientoMin.trim()) params.set("vencimientoMin", filters.vencimientoMin.trim());
    if (filters.vencimientoMax.trim()) params.set("vencimientoMax", filters.vencimientoMax.trim());
  }, [filters]);

  const togglePinColumn = useCallback((colIndex: number) => {
    setPinnedColumns((prev) => {
      if (prev.includes(colIndex)) {
        return prev.filter((c) => c !== colIndex);
      } else {
        return [...prev, colIndex].sort((a, b) => a - b);
      }
    });
  }, []);

  const handleBalanceColumns = useCallback(() => {
    balanceTableColumns(tableId, { hiddenCols });
    toast.success("Columnas balanceadas");
  }, [hiddenCols, tableId]);

  // CSV Import
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);


  const showTableOverlay = isRefreshing || (isLoading && rows.length > 0);

  // Calculate sticky column offsets
  const [columnOffsets, setColumnOffsets] = useState<Record<number, number>>({});

  React.useEffect(() => {
    const table = document.querySelector(`table[data-table-id="${tableId}"]`);
    if (!table) return;

    const calculateOffsets = () => {
      const cols = table.querySelectorAll<HTMLTableColElement>("colgroup col");
      const offsets: Record<number, number> = {};
      let accumulator = 0;

      pinnedColumns.forEach((colIndex) => {
        if (!isHidden(colIndex)) {
          offsets[colIndex] = accumulator;
          const col = cols[colIndex];
          if (col) {
            const width = col.offsetWidth || parseInt(col.style.width) || 150;
            accumulator += width;
          }
        }
      });

      setColumnOffsets(offsets);
    };

    calculateOffsets();
    const observer = new MutationObserver(calculateOffsets);
    const colGroup = table.querySelector("colgroup");
    if (colGroup) {
      observer.observe(colGroup, { attributes: true, childList: true, subtree: true });
    }

    window.addEventListener("resize", calculateOffsets);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", calculateOffsets);
    };
  }, [tableId, pinnedColumns, isHidden]);

  const getStickyProps = React.useCallback((colIndex: number, baseClass: string = "") => {
    const pinned = isPinned(colIndex);
    const offset = columnOffsets[colIndex];

    return {
      className: cn(
        baseClass,
        pinned && offset !== undefined ? "sticky z-20 outline outline-border" : ""
      ),
      style: {
        left: pinned && offset !== undefined ? `${offset}px` : undefined,
        display: isHidden(colIndex) ? "none" : undefined,
      },
    };
  }, [isPinned, columnOffsets, isHidden]);

  const setSortByColumn = useCallback((index: number) => {
    const col = COLUMN_TO_DB[index];
    if (!col) return;
    if (orderBy === col) {
      setOrderDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(col);
      setOrderDir("asc");
    }
  }, [orderBy]);

  const refresh = useCallback(async () => {
    try {
      if (hasLoadedRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setTableError(null);
      const params = new URLSearchParams();
      params.set("orderBy", orderBy);
      params.set("orderDir", orderDir);
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (query.trim()) params.set("q", query.trim());
      applyFiltersToParams(params);
      const res = await fetch(`/api/certificados?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudieron cargar los certificados");
      const data = await res.json();
      setRows(Array.isArray(data.certificados) ? data.certificados : []);
      const pag = data.pagination || { page: 1, totalPages: 1, total: 0 };
      setPage(pag.page || 1);
      setTotalPages(pag.totalPages || 1);
      setTotal(pag.total || 0);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "No se pudieron cargar los certificados";
      setTableError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [orderBy, orderDir, page, limit, query, applyFiltersToParams]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateRow = useCallback(async (id: string, patch: Partial<CertRow>) => {
    try {
      const payload: Record<string, unknown> = {};
      if ("facturado" in patch) payload.facturado = patch.facturado;
      if ("fecha_facturacion" in patch) payload.fecha_facturacion = patch.fecha_facturacion || null;
      if ("nro_factura" in patch) payload.nro_factura = patch.nro_factura ?? null;
      if ("concepto" in patch) payload.concepto = patch.concepto ?? null;
      if ("cobrado" in patch) payload.cobrado = patch.cobrado;
      if ("observaciones" in patch) payload.observaciones = patch.observaciones ?? null;
      if ("vencimiento" in patch) payload.vencimiento = patch.vencimiento || null;
      if ("fecha_pago" in patch) payload.fecha_pago = patch.fecha_pago || null;

      const res = await fetch(`/api/certificados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "No se pudo actualizar");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado al portapapeles");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo copiar");
    }
  }, []);

  const rowToCsv = useCallback((row: CertRow) => {
    const values = [
      row.obraName,
      row.ente,
      row.facturado ? "Si" : "No",
      row.fecha_facturacion || "",
      row.nro_factura || "",
      row.monto,
      row.concepto || "",
      row.cobrado ? "Si" : "No",
      row.n_exp,
      row.observaciones || "",
      row.vencimiento || "",
      row.fecha_pago || "",
    ];
    return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";");
  }, []);

  const highlightText = useCallback((text: string, q: string) => {
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  }, []);

  const duplicateRow = useCallback((index: number) => {
    const row = rows[index];
    if (!row) return;
    const copy = { ...row, id: `temp-${Date.now()}` };
    const arr = rows.slice();
    arr.splice(index + 1, 0, copy);
    setRows(arr);
    toast.success("Fila duplicada (temporal, no guardada)");
  }, [rows]);

  const deleteRow = useCallback((index: number) => {
    if (rows.length <= 1) {
      toast.error("No se puede eliminar la última fila");
      return;
    }
    const arr = rows.filter((_, i) => i !== index);
    setRows(arr);
    toast.success("Fila eliminada (temporal, no guardada)");
  }, [rows]);

  const ALL_COLUMNS: { index: number; label: string }[] = [
    { index: 0, label: "Obra" },
    { index: 1, label: "Ente" },
    { index: 2, label: "Facturado" },
    { index: 3, label: "Fecha facturación" },
    { index: 4, label: "N° factura" },
    { index: 5, label: "Monto" },
    { index: 6, label: "Concepto" },
    { index: 7, label: "Cobrado" },
    { index: 8, label: "N° expediente" },
    { index: 9, label: "Observaciones" },
    { index: 10, label: "Vencimiento" },
    { index: 11, label: "Fecha pago" },
  ];

  // CSV Import handlers
  const handleCsvFiles = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("windows-1252").decode(buffer);
      } catch {
        text = new TextDecoder().decode(buffer);
      }
      const parsed = Papa.parse<string[]>(text, { delimiter: ";", skipEmptyLines: true });
      const rowsNorm = (parsed.data || [])
        .map((r) => (r || []).map((c) => (c ?? "").trim()))
        .filter((r) => r.some((c) => c.length > 0));
      if (rowsNorm.length === 0) throw new Error("CSV vacío");
      const dataRows = rowsNorm[0].join(";").toLowerCase().includes("obra") ? rowsNorm.slice(1) : rowsNorm;
      const imported: CertRow[] = dataRows.map((r, i) => {
        const get = (idx: number) => (r[idx] ?? "").trim();
        return {
          id: `import-${i}`,
          obraId: "",
          obraName: get(0),
          ente: get(1),
          facturado: /true|1|si|sí|x/i.test(get(2)),
          fecha_facturacion: get(3) || null,
          nro_factura: get(4) || null,
          monto: Number(get(5).replace(/\./g, "").replace(",", ".")) || 0,
          concepto: get(6) || null,
          cobrado: /true|1|si|sí|x/i.test(get(7)),
          n_exp: get(8),
          observaciones: get(9) || null,
          vencimiento: get(10) || null,
          fecha_pago: get(11) || null,
          n_certificado: 0,
          mes: "",
          estado: "",
        };
      });
      setRows(imported);
      setShowCsvImport(false);
      setIsDraggingCsv(false);
      setCsvImportError(null);
      toast.success(`Se importaron ${imported.length} filas (modo vista)`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "No se pudo importar el CSV";
      setCsvImportError(msg);
      toast.error(msg);
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }, []);

  const handleCsvInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void handleCsvFiles(e.target.files);
  }, [handleCsvFiles]);

  const handleCsvDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingCsv(false);
    setCsvImportError(null);
    void handleCsvFiles(event.dataTransfer.files);
  }, [handleCsvFiles]);

  const handleCsvDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDraggingCsv) setIsDraggingCsv(true);
  }, [isDraggingCsv]);

  const handleCsvDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingCsv(false);
  }, []);

  const goToReport = useCallback(() => {
    const params = new URLSearchParams();
    applyFiltersToParams(params);
    router.push(`/certificados/reporte?${params.toString()}`);
  }, [applyFiltersToParams, router]);

  return (
    <div className="w-full mx-auto p-4 pt-0">
      {/* <div>
        <p className="text-muted-foreground pb-2">Gestión de certificados</p>
        <h1 className="text-4xl font-bold mb-2">Certificados por obra</h1>
      </div> */}

      {showCsvImport && (
        <div
          className={cn(
            "mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            isDraggingCsv ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/40",
          )}
          onDragEnter={handleCsvDragOver}
          onDragOver={handleCsvDragOver}
          onDragLeave={handleCsvDragLeave}
          onDrop={handleCsvDrop}
          onClick={() => csvInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); csvInputRef.current?.click(); } }}
        >
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvInputChange} />
          <p className="text-sm font-medium">Arrastrá y soltá un archivo CSV o hacé clic para seleccionarlo.</p>
          <p className="mt-1 text-xs text-muted-foreground">Formato esperado: obra;ente;facturado;fecha_facturacion;nro_factura;monto;concepto;cobrado;n_exp;observaciones;vencimiento;fecha_pago</p>
          {csvImportError && <p className="mt-3 text-sm text-red-500">{csvImportError}</p>}
        </div>
      )}

      <div className="flex justify-between items-center py-2">
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar en todas las columnas..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-[240px]" />
        </div>
        <div className="flex gap-2 items-center">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                Filtros
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:w-[30vw] sm:max-w-[90vw] my-auto max-h-[96vh] overflow-y-auto px-6 py-7">
              <SheetHeader className="space-y-2 p-0">
                <SheetTitle className="text-xl">Filtros avanzados</SheetTitle>
                <p className="text-sm text-muted-foreground">Refiná los resultados aplicando múltiples criterios</p>
              </SheetHeader>
              <div className="mt-6 space-y-6 max-h-[90vh] overflow-y-auto">
                {/* Monto */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-semibold">Monto</div>
                  <div className="flex items-center gap-2">
                    <Input type="number" placeholder="Mínimo" value={filters.montoMin} onChange={(e) => setFilters((f) => ({ ...f, montoMin: e.target.value }))} className="text-sm" />
                    <span className="text-muted-foreground">a</span>
                    <Input type="number" placeholder="Máximo" value={filters.montoMax} onChange={(e) => setFilters((f) => ({ ...f, montoMax: e.target.value }))} className="text-sm" />
                  </div>
                </div>

                {/* Entes */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-semibold">Ente</div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-auto pr-1">
                    {allEntes.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No hay entes disponibles</p>
                    ) : (
                      allEntes.map((ent) => {
                        const active = filters.entes.includes(ent);
                        return (
                          <button
                            key={ent}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, entes: active ? f.entes.filter((e) => e !== ent) : [...f.entes, ent] }))}
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all",
                              active
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-background text-foreground hover:bg-muted border-border'
                            )}
                          >
                            {ent}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Estados */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-semibold">Estados</div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Facturado</div>
                      <div className="flex gap-2">
                        {[
                          { value: "all" as const, label: "Todos" },
                          { value: "si" as const, label: "Sí" },
                          { value: "no" as const, label: "No" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, facturado: option.value }))}
                            className={cn(
                              "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-all",
                              filters.facturado === option.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted border-border'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Cobrado</div>
                      <div className="flex gap-2">
                        {[
                          { value: "all" as const, label: "Todos" },
                          { value: "si" as const, label: "Sí" },
                          { value: "no" as const, label: "No" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, cobrado: option.value }))}
                            className={cn(
                              "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-all",
                              filters.cobrado === option.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted border-border'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fechas */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-semibold">Fechas</div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Fecha facturación</div>
                      <div className="flex items-center gap-2">
                        <Input type="date" value={filters.fechaFacturacionMin} onChange={(e) => setFilters((f) => ({ ...f, fechaFacturacionMin: e.target.value }))} className="text-sm" />
                        <span className="text-muted-foreground">a</span>
                        <Input type="date" value={filters.fechaFacturacionMax} onChange={(e) => setFilters((f) => ({ ...f, fechaFacturacionMax: e.target.value }))} className="text-sm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Vencimiento</div>
                      <div className="flex items-center gap-2">
                        <Input type="date" value={filters.vencimientoMin} onChange={(e) => setFilters((f) => ({ ...f, vencimientoMin: e.target.value }))} className="text-sm" />
                        <span className="text-muted-foreground">a</span>
                        <Input type="date" value={filters.vencimientoMax} onChange={(e) => setFilters((f) => ({ ...f, vencimientoMax: e.target.value }))} className="text-sm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Fecha pago</div>
                      <div className="flex items-center gap-2">
                        <Input type="date" value={filters.fechaPagoMin} onChange={(e) => setFilters((f) => ({ ...f, fechaPagoMin: e.target.value }))} className="text-sm" />
                        <span className="text-muted-foreground">a</span>
                        <Input type="date" value={filters.fechaPagoMax} onChange={(e) => setFilters((f) => ({ ...f, fechaPagoMax: e.target.value }))} className="text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Concepto */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-semibold">Concepto</div>
                  <Input placeholder="Contiene texto..." value={filters.conceptoContains} onChange={(e) => setFilters((f) => ({ ...f, conceptoContains: e.target.value }))} className="text-sm" />
                </div>
              </div>
              <SheetFooter className="mt-6 gap-2">
                <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => {
                  setFilters({
                    montoMin: "",
                    montoMax: "",
                    entes: [],
                    facturado: "all",
                    cobrado: "all",
                    conceptoContains: "",
                    fechaFacturacionMin: "",
                    fechaFacturacionMax: "",
                    fechaPagoMin: "",
                    fechaPagoMax: "",
                    vencimientoMin: "",
                    vencimientoMax: "",
                  });
                }}>
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
                <Button type="button" className="flex-1 gap-2" onClick={() => { setFiltersOpen(false); setPage(1); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Aplicar
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Button variant="outline" size="sm" onClick={() => {
            setShowCsvImport((prev) => {
              const next = !prev;
              if (next) { setCsvImportError(null); } else { setIsDraggingCsv(false); }
              return next;
            });
          }}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                Configuración
              </div>
              <DropdownMenuItem onClick={handleBalanceColumns} className="gap-2">
                <MoveHorizontal className="h-4 w-4" />
                Balancear columnas
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                Acciones rápidas
              </div>
              <DropdownMenuItem onClick={() => setHiddenCols([])} className="gap-2">
                <Eye className="h-4 w-4" />
                Mostrar todo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHiddenCols(ALL_COLUMNS.map(c => c.index))} className="gap-2">
                <EyeOff className="h-4 w-4" />
                Ocultar todo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                Visibilidad y fijado de columnas
              </div>
              <div className="">
                {ALL_COLUMNS.map((col) => {
                  const isVisible = !hiddenCols.includes(col.index);
                  const isPinnedCol = pinnedColumns.includes(col.index);
                  return (
                    <div key={col.index} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => {
                          setHiddenCols((prev) => {
                            const set = new Set(prev);
                            if (!e.target.checked) set.add(col.index); else set.delete(col.index);
                            return Array.from(set).sort((a, b) => a - b);
                          });
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <button
                        onClick={() => togglePinColumn(col.index)}
                        className={`p-1 rounded hover:bg-accent-foreground/10 ${isPinnedCol ? 'text-primary' : 'text-muted-foreground'}`}
                        title={isPinnedCol ? "Desfijar columna" : "Fijar columna"}
                      >
                        <Pin className={`h-3 w-3 ${isPinnedCol ? 'fill-current' : ''}`} />
                      </button>
                      <span className="flex-1 text-sm">{col.label}</span>
                    </div>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="gap-2" onClick={goToReport}>
            <FileText className="h-4 w-4" />
            Generar reporte
          </Button>
        </div>
      </div>

      <div className="relative border border-border rounded-none overflow-x-scroll w-full max-w-[calc(98vw-var(--sidebar-current-width))] transition-all duration-300 h-[70vh] 
        bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_10px,var(--border)_10px,var(--border)_11px,transparent_12px)] bg-repeat">
        <AnimatePresence>
          {showTableOverlay && (
            <motion.div
              key="certificados-table-loader"
              className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-primary">Sincronizando tabla...</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className=" max-h-[70vh] ">
          <table className="text-sm table-fixed w-full " data-table-id={tableId}>
            <ColGroup tableId={tableId} columns={12} mode="fixed" />
            <thead className="bg-muted/50 sticky top-0 z-30">
              <tr className="border-b">
                <th {...getStickyProps(0, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(0)}>OBRA{orderBy === COLUMN_TO_DB[0] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[0]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[0]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(0)}>
                        {isPinned(0) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={0} mode="fixed" />
                </th>
                <th {...getStickyProps(1, "relative px-4 py-3 text-left text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(1)}>ENTE{orderBy === COLUMN_TO_DB[1] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[1]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[1]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(1)}>
                        {isPinned(1) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={1} mode="fixed" />
                </th>
                <th {...getStickyProps(2, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(2)}>FACTURADO{orderBy === COLUMN_TO_DB[2] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[2]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[2]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(2)}>
                        {isPinned(2) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={2} mode="fixed" />
                </th>
                <th {...getStickyProps(3, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(3)}>FECHA FACTURACIÓN{orderBy === COLUMN_TO_DB[3] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[3]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[3]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(3)}>
                        {isPinned(3) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={3} mode="fixed" />
                </th>
                <th {...getStickyProps(4, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(4)}>N° FACTURA{orderBy === COLUMN_TO_DB[4] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[4]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[4]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(4)}>
                        {isPinned(4) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={4} mode="fixed" />
                </th>
                <th {...getStickyProps(5, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(5)}>MONTO{orderBy === COLUMN_TO_DB[5] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[5]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[5]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(5)}>
                        {isPinned(5) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={5} mode="fixed" />
                </th>
                <th {...getStickyProps(6, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(6)}>CONCEPTO{orderBy === COLUMN_TO_DB[6] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[6]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[6]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(6)}>
                        {isPinned(6) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={6} mode="fixed" />
                </th>
                <th {...getStickyProps(7, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(7)}>COBRADO{orderBy === COLUMN_TO_DB[7] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[7]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[7]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(7)}>
                        {isPinned(7) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={7} mode="fixed" />
                </th>
                <th {...getStickyProps(8, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(8)}>N° EXPEDIENTE{orderBy === COLUMN_TO_DB[8] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[8]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[8]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(8)}>
                        {isPinned(8) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={8} mode="fixed" />
                </th>
                <th {...getStickyProps(9, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(9)}>OBSERVACIONES{orderBy === COLUMN_TO_DB[9] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[9]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[9]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(9)}>
                        {isPinned(9) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={9} mode="fixed" />
                </th>
                <th {...getStickyProps(10, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(10)}>VENCIMIENTO{orderBy === COLUMN_TO_DB[10] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[10]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[10]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(10)}>
                        {isPinned(10) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={10} mode="fixed" />
                </th>
                <th {...getStickyProps(11, "relative px-4 py-3 text-center text-xs font-semibold uppercase outline outline-border whitespace-normal break-words align-center bg-sidebar")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button type="button" className="hover:underline" onClick={() => setSortByColumn(11)}>FECHA PAGO{orderBy === COLUMN_TO_DB[11] ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[11]); setOrderDir("asc"); }}>Orden ascendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy(COLUMN_TO_DB[11]); setOrderDir("desc"); }}>Orden descendente</ContextMenuItem>
                      <ContextMenuItem onClick={() => { setOrderBy("obra"); setOrderDir("asc"); }}>Quitar orden</ContextMenuItem>
                      <ContextMenuItem onClick={() => togglePinColumn(11)}>
                        {isPinned(11) ? "Desfijar columna" : "Fijar columna"}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  <ColumnResizer tableId={tableId} colIndex={11} mode="fixed" />
                </th>
              </tr>
            </thead>
            <tbody>
              {(isLoading || tableError || rows.length === 0) ? (
                <InBodyStates
                  isLoading={isLoading}
                  tableError={tableError}
                  colspan={12}
                  empty={rows.length === 0}
                  onRetry={refresh}
                  emptyText="No hay certificados disponibles"
                />
              ) : (
                rows.map((row, visualIndex) => (
                  <React.Fragment key={row.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <tr className={cn(
                          "transition-colors duration-150 hover:bg-muted/50",
                          visualIndex % 2 === 0 ? "bg-background" : "bg-card/40"
                        )}>
                          <td {...getStickyProps(0, "px-2 pl-4 py-2 outline outline-border border-border relative bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="min-h-[28px]">
                                  {row.obraId ? (
                                    <Link href={`/excel/${row.obraId}`} className="cursor-pointer text-muted-foreground font-semibold" dangerouslySetInnerHTML={{ __html: highlightText(row.obraName, query) }} />
                                  ) : (
                                    <span dangerouslySetInnerHTML={{ __html: highlightText(row.obraName, query) }} />
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.obraName)}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.obraName);
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(1, "outline outline-border border-border p-0 align-center px-2 py-2 bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="min-h-[28px] text-muted-foreground font-semibold" dangerouslySetInnerHTML={{ __html: highlightText(row.ente, query) }} />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.ente)}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.ente);
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(2, "outline outline-border border-border p-0 relative table-cell bg-background text-center")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <Checkbox checked={!!row.facturado} onCheckedChange={(checked: CheckedState) => updateRow(row.id, { facturado: checked === "indeterminate" ? false : checked })} className="h-8 w-8 bg-background border border-ring rounded-sm" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.facturado ? "Si" : "No")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { facturado: false })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.facturado ? "Si" : "No");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(3, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <CustomInput type="date" value={row.fecha_facturacion ?? ''} onChange={(e) => updateRow(row.id, { fecha_facturacion: e.target.value || null })} className="w-full text-sm border absolute inset-0 focus:ring-0 focus:outline-none px-8" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.fecha_facturacion ?? "")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { fecha_facturacion: null })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.fecha_facturacion ?? "");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(4, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <CustomInput type="text" value={row.nro_factura ?? ''} onChange={(e) => updateRow(row.id, { nro_factura: e.target.value || null })} className="w-full text-sm border  h-full absolute inset-0 focus:ring-0 focus:outline-none" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.nro_factura ?? "")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { nro_factura: null })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.nro_factura ?? "");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(5, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="absolute inset-0 px-2 py-2 flex items-center justify-end text-right font-mono text-muted-foreground font-semibold" dangerouslySetInnerHTML={{ __html: highlightText(`$ ${Number(row.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, query) }} />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(String(row.monto))}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => String(r.monto));
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(6, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <CustomInput type="text" value={row.concepto ?? ''} onChange={(e) => updateRow(row.id, { concepto: e.target.value || null })} className="w-full text-sm border absolute inset-0 focus:ring-0 focus:outline-none" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.concepto ?? "")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { concepto: null })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.concepto ?? "");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(7, "outline outline-border border-border p-0 relative table-cell bg-background text-center")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <Checkbox checked={!!row.cobrado} onCheckedChange={(checked: CheckedState) => updateRow(row.id, { cobrado: checked === "indeterminate" ? false : checked })} className="h-8 w-8 bg-background border border-ring rounded-sm" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.cobrado ? "Si" : "No")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { cobrado: false })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.cobrado ? "Si" : "No");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(8, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="min-h-[28px] px-2 py-2 text-muted-foreground font-semibold" dangerouslySetInnerHTML={{ __html: highlightText(row.n_exp, query) }} />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.n_exp)}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.n_exp);
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(9, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <CustomInput type="text" value={row.observaciones ?? ''} onChange={(e) => updateRow(row.id, { observaciones: e.target.value || null })} className="w-full text-sm border absolute inset-0 focus:ring-0 focus:outline-none" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.observaciones ?? "")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { observaciones: null })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.observaciones ?? "");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(10, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <CustomInput type="date" value={row.vencimiento ?? ''} onChange={(e) => updateRow(row.id, { vencimiento: e.target.value || null })} className="w-full text-sm border absolute inset-0 focus:ring-0 focus:outline-none px-8" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.vencimiento ?? "")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { vencimiento: null })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.vencimiento ?? "");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                          <td {...getStickyProps(11, "outline outline-border border-border p-0 relative table-cell bg-background")}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <CustomInput type="date" value={row.fecha_pago ?? ''} onChange={(e) => updateRow(row.id, { fecha_pago: e.target.value || null })} className="w-full text-sm border absolute inset-0 focus:ring-0 focus:outline-none px-8" />
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-52">
                                <ContextMenuItem onClick={() => void copyToClipboard(row.fecha_pago ?? "")}>Copiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => updateRow(row.id, { fecha_pago: null })}>Limpiar valor</ContextMenuItem>
                                <ContextMenuItem onClick={() => {
                                  const colValues = rows.map((r) => r.fecha_pago ?? "");
                                  void copyToClipboard(colValues.join("\n"));
                                }}>Copiar columna</ContextMenuItem>
                                <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </td>
                        </tr>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => void copyToClipboard(rowToCsv(row))}>Copiar fila (CSV)</ContextMenuItem>
                        <ContextMenuItem onClick={() => duplicateRow(visualIndex)}>Duplicar fila</ContextMenuItem>
                        <ContextMenuItem onClick={() => deleteRow(visualIndex)}>Eliminar fila</ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span>Filas por página</span>
          <select className="border rounded-md px-2 py-1 bg-background" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground">{total} resultados</div>
        <div className="flex items-center gap-2 text-sm">
          <span>Página {page} de {totalPages}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</Button>
        </div>
      </div>

    </div>
  );
}

