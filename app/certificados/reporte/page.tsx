'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Printer, ChevronLeft, Filter, Settings } from "lucide-react";
import { toast } from "sonner";
import ReportTable from "../report";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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

function ReportePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<CertRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<FiltersState>(() => {
    const entesParam = searchParams.getAll("ente");
    return {
      montoMin: searchParams.get("montoMin") || "",
      montoMax: searchParams.get("montoMax") || "",
      entes: entesParam,
      facturado: (searchParams.get("facturado") as any) || "all",
      cobrado: (searchParams.get("cobrado") as any) || "all",
      conceptoContains: searchParams.get("conceptoContains") || "",
      fechaFacturacionMin: searchParams.get("fechaFacturacionMin") || "",
      fechaFacturacionMax: searchParams.get("fechaFacturacionMax") || "",
      fechaPagoMin: searchParams.get("fechaPagoMin") || "",
      fechaPagoMax: searchParams.get("fechaPagoMax") || "",
      vencimientoMin: searchParams.get("vencimientoMin") || "",
      vencimientoMax: searchParams.get("vencimientoMax") || "",
    };
  });

  // Report Settings
  const [reportCompanyName, setReportCompanyName] = useState("Nombre de la empresa");
  const [reportDescription, setReportDescription] = useState("Reporte de certificados");
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('es-AR'));
  const [reportViewMode, setReportViewMode] = useState<"full" | "by-obra" | "by-ente">("full");
  const [reportHiddenCols, setReportHiddenCols] = useState<number[]>([]);
  const [reportSortBy, setReportSortBy] = useState<number>(0);
  const [reportSortDir, setReportSortDir] = useState<"asc" | "desc">("asc");
  const [reportAggregations, setReportAggregations] = useState<Record<number, "none" | "sum" | "count" | "count-checked" | "average">>({});

  // Fetch Data
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      // Use existing filters
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

      // Set limit high for report
      params.set("limit", "10000");

      const res = await fetch(`/api/certificados?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudieron cargar los certificados");
      const data = await res.json();
      setRows(Array.isArray(data.certificados) ? data.certificados : []);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar datos para el reporte");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, []); // Run once on mount, then manual refresh via "Aplicar"

  // Update URL when filters change (optional, but good for sharing)
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
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

    router.replace(`/certificados/reporte?${params.toString()}`);
    refresh();
  }, [filters, router, refresh]);

  // Extract all unique entes for filter (from loaded rows mostly, or maybe initial load?)
  // Issue: if we filter by ente, we only see that ente. We might want to fetch all entes distinct from DB.
  // For now, derive from rows like previous page.
  const allEntes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.ente?.trim()) set.add(r.ente.trim()) });
    return Array.from(set).sort();
  }, [rows]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden w-full">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .report-container { overflow: visible !important; height: auto !important; }
        }
      `}</style>

      {/* Main Content - Report Preview */}
      <div className="w-full flex justify-center items-center pt-4 bg-[repeating-linear-gradient(-60deg,transparent_0%,transparent_10px,var(--border)_10px,var(--border)_11px,transparent_12px)] bg-repeat relative">
        <div className="flex  justify-center items-start gap-4 mb-6 no-print absolute top-0 left-0 w-full p-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="ml-auto">
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 report-container overflow-auto relative max-w-[210mm] max-h-[297mm] h-full overflow-y-auto  ">
          <div className="p-6 print:p-0">
            <div className="space-y-6 max-w-[1200px] mx-auto print:max-w-none print:mx-0">
              {/* Report Header Inputs */}
              <div className="space-y-3 border-b pb-4 print:border-none">
                <input
                  type="text"
                  value={reportCompanyName}
                  onChange={(e) => setReportCompanyName(e.target.value)}
                  className="text-2xl font-bold w-full border-none outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 bg-transparent"
                  placeholder="Nombre de la empresa"
                />
                <input
                  type="text"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  className="text-lg text-muted-foreground w-full border-none outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 bg-transparent"
                  placeholder="Descripción del reporte"
                />
                <input
                  type="text"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="text-sm text-muted-foreground w-full border-none outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 bg-transparent"
                  placeholder="Fecha"
                />
              </div>

              {/* Report Tables */}
              <div className="space-y-8">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <>
                    {reportViewMode === "full" && (
                      <ReportTable
                        title="Todos los certificados"
                        data={rows}
                        hiddenCols={reportHiddenCols}
                        sortBy={reportSortBy}
                        sortDir={reportSortDir}
                        onSort={(idx) => {
                          if (reportSortBy === idx) setReportSortDir(prev => prev === "asc" ? "desc" : "asc");
                          else { setReportSortBy(idx); setReportSortDir("asc"); }
                        }}
                        aggregations={reportAggregations}
                        allColumns={ALL_COLUMNS}
                        isPrint={false} // Handle styling via CSS media query instead of prop if possible, but keeping prop for compatibility
                      />
                    )}

                    {reportViewMode === "by-obra" && Object.entries(rows.reduce((acc, row) => {
                      if (!acc[row.obraName]) acc[row.obraName] = [];
                      acc[row.obraName].push(row);
                      return acc;
                    }, {} as Record<string, CertRow[]>)).map(([obraName, data]) => (
                      <div key={obraName} className="break-inside-avoid">
                        <ReportTable
                          title={obraName}
                          data={data}
                          hiddenCols={reportHiddenCols}
                          sortBy={reportSortBy}
                          sortDir={reportSortDir}
                          onSort={() => { }} // Sorting controlled globally or per table? usually global
                          aggregations={reportAggregations}
                          allColumns={ALL_COLUMNS}
                          isPrint={false}
                        />
                      </div>
                    ))}

                    {reportViewMode === "by-ente" && Object.entries(rows.reduce((acc, row) => {
                      if (!acc[row.ente]) acc[row.ente] = [];
                      acc[row.ente].push(row);
                      return acc;
                    }, {} as Record<string, CertRow[]>)).map(([ente, data]) => (
                      <div key={ente} className="break-inside-avoid">
                        <ReportTable
                          title={ente}
                          data={data}
                          hiddenCols={reportHiddenCols}
                          sortBy={reportSortBy}
                          sortDir={reportSortDir}
                          onSort={() => { }}
                          aggregations={reportAggregations}
                          allColumns={ALL_COLUMNS}
                          isPrint={false}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Filters & Settings */}
      <div className="w-80 border-l bg-muted/30 flex flex-col no-print">
        <Tabs defaultValue="settings" className="flex-1 flex flex-col">
          <div className="p-4 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Configuración
              </TabsTrigger>
              <TabsTrigger value="filters" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </TabsTrigger>
            </TabsList>
          </div>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="flex-1 p-0 m-0 overflow-hidden">
            <ScrollArea className="h-full max-h-[calc(100vh-10rem)]">
              <div className="p-4 space-y-6">
                {/* View Mode */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Modo de Vista</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant={reportViewMode === "full" ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setReportViewMode("full")}
                    >
                      Vista Completa
                    </Button>
                    <Button
                      variant={reportViewMode === "by-obra" ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setReportViewMode("by-obra")}
                    >
                      Agrupado por Obra
                    </Button>
                    <Button
                      variant={reportViewMode === "by-ente" ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setReportViewMode("by-ente")}
                    >
                      Agrupado por Ente
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Columns */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Columnas Visibles</h3>
                  <div className="space-y-2">
                    {ALL_COLUMNS.map((col) => {
                      const isVisible = !reportHiddenCols.includes(col.index);
                      return (
                        <div key={col.index} className="flex items-center space-x-2">
                          <Checkbox
                            id={`col-${col.index}`}
                            checked={isVisible}
                            onCheckedChange={(checked) => {
                              setReportHiddenCols((prev) => {
                                const set = new Set(prev);
                                if (!checked) set.add(col.index); else set.delete(col.index);
                                return Array.from(set).sort((a, b) => a - b);
                              });
                            }}
                          />
                          <Label htmlFor={`col-${col.index}`} className="text-sm font-normal cursor-pointer">
                            {col.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Aggregations */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Totales</h3>
                  <div className="space-y-3">
                    {ALL_COLUMNS.map((col) => {
                      if (reportHiddenCols.includes(col.index)) return null;
                      // Only show sensible columns for aggregation (numeric mostly)
                      // But user might want counts for others.

                      return (
                        <div key={col.index} className="space-y-1">
                          <Label className="text-xs">{col.label}</Label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                            value={reportAggregations[col.index] || "none"}
                            onChange={(e) => {
                              setReportAggregations((prev) => ({
                                ...prev,
                                [col.index]: e.target.value as any,
                              }));
                            }}
                          >
                            <option value="none">Sin total</option>
                            <option value="sum">Suma</option>
                            <option value="count">Contar</option>
                            <option value="count-checked">Contar marcados</option>
                            <option value="average">Promedio</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* FILTERS TAB */}
          <TabsContent value="filters" className="flex-1 p-0 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <div className="space-y-3">
                  <Label>Búsqueda</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Concepto contiene</Label>
                    <Input
                      placeholder="Texto..."
                      value={filters.conceptoContains}
                      onChange={(e) => setFilters(f => ({ ...f, conceptoContains: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Monto</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.montoMin}
                      onChange={(e) => setFilters(f => ({ ...f, montoMin: e.target.value }))}
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.montoMax}
                      onChange={(e) => setFilters(f => ({ ...f, montoMax: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Estado</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Facturado</Label>
                    <div className="flex gap-2">
                      {["all", "si", "no"].map((opt) => (
                        <Button
                          key={opt}
                          variant={filters.facturado === opt ? "default" : "outline"}
                          size="sm"
                          className="flex-1 capitalize"
                          onClick={() => setFilters(f => ({ ...f, facturado: opt as any }))}
                        >
                          {opt === "all" ? "Todos" : opt}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Cobrado</Label>
                    <div className="flex gap-2">
                      {["all", "si", "no"].map((opt) => (
                        <Button
                          key={opt}
                          variant={filters.cobrado === opt ? "default" : "outline"}
                          size="sm"
                          className="flex-1 capitalize"
                          onClick={() => setFilters(f => ({ ...f, cobrado: opt as any }))}
                        >
                          {opt === "all" ? "Todos" : opt}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Fechas</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Facturación</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={filters.fechaFacturacionMin} onChange={(e) => setFilters(f => ({ ...f, fechaFacturacionMin: e.target.value }))} />
                      <Input type="date" value={filters.fechaFacturacionMax} onChange={(e) => setFilters(f => ({ ...f, fechaFacturacionMax: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Pago</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={filters.fechaPagoMin} onChange={(e) => setFilters(f => ({ ...f, fechaPagoMin: e.target.value }))} />
                      <Input type="date" value={filters.fechaPagoMax} onChange={(e) => setFilters(f => ({ ...f, fechaPagoMax: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button className="w-full" onClick={updateUrl}>Aplicar Filtros</Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ReportePageContent />
    </Suspense>
  );
}

