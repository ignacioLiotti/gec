'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ColGroup, ColumnResizer } from "@/components/ui/column-resizer";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Upload } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

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

export default function CertificadosPage() {
  const [rows, setRows] = useState<CertRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderBy, setOrderBy] = useState<string>("obra");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [hiddenCols, setHiddenCols] = useState<number[]>([]);
  const isHidden = useCallback((i: number) => hiddenCols.includes(i), [hiddenCols]);

  // Import widgets
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const setSortByColumn = useCallback((index: number) => {
    const map: Record<number, string> = {
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
    const col = map[index];
    if (!col) return;
    setOrderBy(col);
    setOrderDir((prev) => (orderBy === col ? (prev === "asc" ? "desc" : "asc") : "asc"));
  }, [orderBy]);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("orderBy", orderBy);
      params.set("orderDir", orderDir);
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/certificados?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudieron cargar los certificados");
      const data = await res.json();
      setRows(Array.isArray(data.certificados) ? data.certificados : []);
      const pag = data.pagination || { page: 1, totalPages: 1, total: 0 };
      setPage(pag.page || 1);
      setTotalPages(pag.totalPages || 1);
      setTotal(pag.total || 0);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los certificados");
    } finally {
      setIsLoading(false);
    }
  }, [orderBy, orderDir, page, limit, query]);

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

  // CSV/JSON import
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
      // Expect header: obra;ente;facturado;fecha_facturacion;nro_factura;monto;concepto;cobrado;n_exp;observaciones;vencimiento;fecha_pago
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

  return (
    <div className="w-full mx-auto p-6">
      <div>
        <p className="text-muted-foreground pb-2">Gestión de certificados</p>
        <h1 className="text-4xl font-bold mb-2">Certificados por obra</h1>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando certificados...</p>}

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

      <div className="flex justify-between items-center mt-6">
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar en todas las columnas..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-[240px]" />
        </div>
        <div className="flex gap-2 items-center">
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
              <Button variant="outline" size="sm">Columnas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onClick={() => setHiddenCols([])}>Mostrar todo</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHiddenCols(ALL_COLUMNS.map(c => c.index))}>Ocultar todo</DropdownMenuItem>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map((col) => {
                const checked = !hiddenCols.includes(col.index);
                return (
                  <DropdownMenuCheckboxItem
                    key={col.index}
                    checked={checked}
                    onCheckedChange={(next: boolean | 'indeterminate') => {
                      setHiddenCols((prev) => {
                        const set = new Set(prev);
                        if (next === false) set.add(col.index); else set.delete(col.index);
                        return Array.from(set).sort((a, b) => a - b);
                      });
                    }}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-x-auto mb-4 w-full max-h-[70vh] overflow-y-auto mt-4">
        <table className="text-sm table-fixed" data-table-id="certificados-table">
          <ColGroup tableId="certificados-table" columns={12} />
          <thead className="bg-gray-100">
            <tr className="bg-card">
              <th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-r border-gray-300 whitespace-normal" style={{ display: isHidden(0) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(0)}>OBRA{orderBy === "obra" ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                <ColumnResizer tableId="certificados-table" colIndex={0} />
              </th>
              <th className="relative px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(1) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(1)}>ENTE{orderBy === "ente" ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                <ColumnResizer tableId="certificados-table" colIndex={1} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(2) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(2)}>FACTURADO</button>
                <ColumnResizer tableId="certificados-table" colIndex={2} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(3) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(3)}>FECHA FACTURACIÓN</button>
                <ColumnResizer tableId="certificados-table" colIndex={3} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(4) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(4)}>N° FACTURA</button>
                <ColumnResizer tableId="certificados-table" colIndex={4} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(5) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(5)}>MONTO{orderBy === "monto" ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                <ColumnResizer tableId="certificados-table" colIndex={5} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(6) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(6)}>CONCEPTO</button>
                <ColumnResizer tableId="certificados-table" colIndex={6} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(7) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(7)}>COBRADO</button>
                <ColumnResizer tableId="certificados-table" colIndex={7} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(8) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(8)}>N° EXPEDIENTE{orderBy === "n_exp" ? (orderDir === "asc" ? " ▲" : " ▼") : ""}</button>
                <ColumnResizer tableId="certificados-table" colIndex={8} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(9) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(9)}>OBSERVACIONES</button>
                <ColumnResizer tableId="certificados-table" colIndex={9} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-x border-gray-300 whitespace-normal" style={{ display: isHidden(10) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(10)}>VENCIMIENTO</button>
                <ColumnResizer tableId="certificados-table" colIndex={10} />
              </th>
              <th className="relative px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase border-gray-300 whitespace-normal" style={{ display: isHidden(11) ? "none" : undefined }}>
                <button type="button" className="hover:underline" onClick={() => setSortByColumn(11)}>FECHA PAGO</button>
                <ColumnResizer tableId="certificados-table" colIndex={11} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-sm text-muted-foreground">No hay certificados</td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? "bg-background" : "bg-card/40"}>
                  <td className="px-2 pl-4 py-2 border-t border-r border-gray-200" style={{ display: isHidden(0) ? "none" : undefined }}>
                    {row.obraId ? (
                      <Link href={`/excel/${row.obraId}`} className="underline underline-offset-2">{row.obraName}</Link>
                    ) : (
                      row.obraName
                    )}
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200" style={{ display: isHidden(1) ? "none" : undefined }}>{row.ente}</td>
                  <td className="px-2 py-2 border-t border-r border-gray-200 text-center" style={{ display: isHidden(2) ? "none" : undefined }}>
                    <input type="checkbox" checked={!!row.facturado} onChange={(e) => updateRow(row.id, { facturado: e.target.checked })} className="h-4 w-4" />
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200" style={{ display: isHidden(3) ? "none" : undefined }}>
                    <Input type="date" value={row.fecha_facturacion ?? ''} onChange={(e) => updateRow(row.id, { fecha_facturacion: e.target.value || null })} />
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200" style={{ display: isHidden(4) ? "none" : undefined }}>
                    <Input type="text" value={row.nro_factura ?? ''} onChange={(e) => updateRow(row.id, { nro_factura: e.target.value || null })} />
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200 text-right font-mono" style={{ display: isHidden(5) ? "none" : undefined }}>
                    $ {Number(row.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200" style={{ display: isHidden(6) ? "none" : undefined }}>
                    <Input type="text" value={row.concepto ?? ''} onChange={(e) => updateRow(row.id, { concepto: e.target.value || null })} />
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200 text-center" style={{ display: isHidden(7) ? "none" : undefined }}>
                    <input type="checkbox" checked={!!row.cobrado} onChange={(e) => updateRow(row.id, { cobrado: e.target.checked })} className="h-4 w-4" />
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200" style={{ display: isHidden(8) ? "none" : undefined }}>{row.n_exp}</td>
                  <td className="px-2 py-2 border-t border-r border-gray-200" style={{ display: isHidden(9) ? "none" : undefined }}>
                    <Input type="text" value={row.observaciones ?? ''} onChange={(e) => updateRow(row.id, { observaciones: e.target.value || null })} />
                  </td>
                  <td className="px-2 py-2 border-t border-r border-gray-200" style={{ display: isHidden(10) ? "none" : undefined }}>
                    <Input type="date" value={row.vencimiento ?? ''} onChange={(e) => updateRow(row.id, { vencimiento: e.target.value || null })} />
                  </td>
                  <td className="px-2 py-2 border-t border-gray-200" style={{ display: isHidden(11) ? "none" : undefined }}>
                    <Input type="date" value={row.fecha_pago ?? ''} onChange={(e) => updateRow(row.id, { fecha_pago: e.target.value || null })} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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










