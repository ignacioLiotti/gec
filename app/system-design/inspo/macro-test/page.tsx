import type { ReactNode } from "react";
import { ArrowUpDown, ChevronDown, FileText, Layers, Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MacroTab = {
  id: string;
  label: string;
  active?: boolean;
};

type StatusType = "adjudicada" | "en-proceso" | "evaluacion" | "desierta";

type Row = {
  obra: string;
  licitacion: string;
  entidad: string;
  monto: string;
  estado: StatusType;
  fecha: string;
};

const tabs: MacroTab[] = [
  { id: "licitaciones", label: "Licitaciones 2024", active: true },
  { id: "certificados", label: "Certificados MOySP" },
  { id: "avance", label: "Avance INVICO" },
];

const rows: Row[] = [
  { obra: "Hospital San Antonio — Pabellón Norte", licitacion: "LIC-2024-001", entidad: "MOySP", monto: "$ 48.200.000", estado: "adjudicada", fecha: "12/03/2024" },
  { obra: "Centro Interpretación Cultural — Salta", licitacion: "LIC-2024-002", entidad: "MOySP", monto: "$ 12.750.000", estado: "en-proceso", fecha: "28/03/2024" },
  { obra: "Construcción 15 Viviendas — Sector B", licitacion: "LIC-2024-003", entidad: "IN.VI.CO", monto: "$ 31.600.000", estado: "adjudicada", fecha: "15/04/2024" },
  { obra: "Museo Histórico Yaví — Restauración", licitacion: "LIC-2024-004", entidad: "MOySP", monto: "$ 8.900.000", estado: "evaluacion", fecha: "02/05/2024" },
  { obra: "Acondicionamiento Ministerio Seguridad", licitacion: "LIC-2024-005", entidad: "Min. de Seguridad", monto: "$ 22.100.000", estado: "adjudicada", fecha: "19/05/2024" },
  { obra: "Construcción JIN N° 12 — Jujuy", licitacion: "LIC-2024-006", entidad: "Min. de Educación", monto: "$ 15.330.000", estado: "en-proceso", fecha: "07/06/2024" },
  { obra: "Construcción 20 Viviendas — Sector Norte", licitacion: "LIC-2024-007", entidad: "IN.VI.CO", monto: "$ 39.800.000", estado: "desierta", fecha: "24/06/2024" },
];

const statusConfig: Record<StatusType, { label: string; dot: string; text: string }> = {
  adjudicada: {
    label: "Adjudicada",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  "en-proceso": {
    label: "En proceso",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  evaluacion: {
    label: "Evaluación",
    dot: "bg-violet-500",
    text: "text-violet-700",
  },
  desierta: {
    label: "Desierta",
    dot: "bg-red-400",
    text: "text-red-600",
  },
};

function ColHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 border-r border-[#f0f0f0] px-3.5 py-2.5 last:border-r-0",
        className,
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
        {children}
      </span>
      <ArrowUpDown className="h-3 w-3 shrink-0 text-[#ddd]" />
    </div>
  );
}

export default function MacroTestPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] px-12 py-10">
      <div className="flex flex-col">

        {/* Page header */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a]">Macro tablas</h1>
          <Button className="gap-2 rounded-lg bg-[#f97316] text-white hover:bg-[#ea6c0a]">
            <Plus className="h-4 w-4" />
            Nueva macro tabla
          </Button>
        </div>

        {/* Tab bar + panel */}
        <div className="flex flex-col">
          {/* Tabs */}
          <div className="flex items-end gap-1 pl-0">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  "relative flex cursor-pointer items-center gap-2 rounded-t-xl border px-5 py-2.5 transition",
                  tab.active
                    ? "z-10 translate-y-[1px] border-b-white border-[#e8e8e8] bg-white"
                    : "border-[#e8e8e8] bg-[#efefef] text-[#999] hover:bg-[#f5f5f5]",
                )}
              >
                <Layers
                  className={cn("h-3.5 w-3.5", tab.active ? "text-[#f97316]" : "text-[#bbb]")}
                />
                <span
                  className={cn(
                    "max-w-[160px] truncate text-[13px] font-medium",
                    tab.active ? "text-[#1a1a1a]" : "text-[#999]",
                  )}
                >
                  {tab.label}
                </span>
              </div>
            ))}
          </div>

          {/* Panel */}
          <div className="flex flex-col overflow-hidden rounded-b-xl rounded-tr-xl border border-[#e8e8e8] bg-white">

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative w-[260px]">
                  <svg
                    className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#bbb]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <Input
                    placeholder="Buscar en macro tabla..."
                    className="h-9 rounded-lg border-[#e8e8e8] pl-9 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg border-[#e8e8e8] bg-white text-[#555]"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  Columnas
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-[#999] hover:text-[#555]">
                  <FileText className="h-3.5 w-3.5" />
                  Reportes
                </Button>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-[#999] hover:text-[#555]">
                  <Settings className="h-3.5 w-3.5" />
                  Configurar
                </Button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 border-b border-[#f0f0f0] px-4 py-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md bg-[#f0f0f0] px-3 py-1.5 text-[12px] font-medium text-[#1a1a1a]"
              >
                Todas las filas
                <span className="rounded-full bg-[#e0e0e0] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#555]">
                  247
                </span>
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-[12px] text-[#999] hover:bg-[#f5f5f5]"
              >
                Editadas
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-[12px] text-[#999] hover:bg-[#f5f5f5]"
              >
                Sin datos
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="flex min-w-[900px] items-stretch bg-white">
                {/* Checkbox */}
                <div className="flex w-11 shrink-0 items-center justify-center border-b border-r border-[#f0f0f0] py-2.5">
                  <div className="h-3.5 w-3.5 rounded-sm border-[1.5px] border-[#ddd] bg-white" />
                </div>
                <div className="flex flex-1 border-b border-[#f0f0f0]">
                  <ColHead className="w-[260px] shrink-0">Obra</ColHead>
                  <ColHead className="w-[150px] shrink-0">N° Licitación</ColHead>
                  <ColHead className="w-[180px] shrink-0">Entidad</ColHead>
                  <ColHead className="w-[170px] shrink-0">Monto Contrato</ColHead>
                  <ColHead className="w-[130px] shrink-0">Estado</ColHead>
                  <ColHead className="flex-1">Fecha Apertura</ColHead>
                </div>
              </div>

              {/* Rows */}
              {rows.map((row, i) => {
                const status = statusConfig[row.estado];
                return (
                  <div
                    key={row.licitacion}
                    className={cn(
                      "flex min-w-[900px] items-stretch border-b border-[#f0f0f0] transition hover:bg-[#fffaf5]",
                      i % 2 === 1 ? "bg-[#fafafa]" : "bg-white",
                    )}
                  >
                    {/* Checkbox */}
                    <div className="flex w-11 shrink-0 items-center justify-center border-r border-[#f0f0f0]">
                      <div className="h-3.5 w-3.5 rounded-sm border-[1.5px] border-[#ddd] bg-white" />
                    </div>
                    {/* Cells */}
                    <div className="flex flex-1">
                      <div className="w-[260px] shrink-0 border-r border-[#f0f0f0] px-3.5 py-2.5">
                        <p className="truncate text-[13px] text-[#1a1a1a]">{row.obra}</p>
                      </div>
                      <div className="w-[150px] shrink-0 border-r border-[#f0f0f0] px-3.5 py-2.5">
                        <p className="text-[13px] tabular-nums text-[#555]">{row.licitacion}</p>
                      </div>
                      <div className="w-[180px] shrink-0 border-r border-[#f0f0f0] px-3.5 py-2.5">
                        <p className="truncate text-[13px] text-[#555]">{row.entidad}</p>
                      </div>
                      <div className="w-[170px] shrink-0 border-r border-[#f0f0f0] px-3.5 py-2.5">
                        <p className="text-[13px] tabular-nums text-[#1a1a1a] font-medium">{row.monto}</p>
                      </div>
                      <div className="w-[130px] shrink-0 border-r border-[#f0f0f0] px-3.5 py-2.5">
                        <span className={cn("flex items-center gap-1.5 text-[12px] font-medium", status.text)}>
                          <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
                          {status.label}
                        </span>
                      </div>
                      <div className="flex-1 px-3.5 py-2.5">
                        <p className="text-[13px] tabular-nums text-[#999]">{row.fecha}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between border-t border-[#f0f0f0] bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[#999]">Filas por página</span>
                <div className="flex items-center gap-1.5 rounded-lg border border-[#e8e8e8] bg-white px-3 py-1.5">
                  <span className="text-[13px] tabular-nums text-[#1a1a1a]">10</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#bbb]" />
                </div>
                <p className="text-[13px] text-[#999]">
                  Mostrando{" "}
                  <span className="font-semibold text-[#1a1a1a]">10</span>
                  {" "}de{" "}
                  <span className="font-semibold text-[#1a1a1a]">247</span>
                  {" "}filas
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-[#e8e8e8] bg-white text-[#999]"
                >
                  &lt; Anterior
                </Button>
                <span className="text-[13px] text-[#999]">Página 1 de 25</span>
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-[#1a1a1a] text-white hover:bg-[#333]"
                >
                  Siguiente &gt;
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
