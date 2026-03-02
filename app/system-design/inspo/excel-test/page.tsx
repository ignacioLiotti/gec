import type { ComponentType, ReactNode } from "react";
import {
  ArrowUpDown,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Filter,
  LayoutGrid,
  Search,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Row = {
  no: number;
  obra: string;
  area: string;
  entidad: string;
  mes: string;
  inicio: string;
  contrato: string;
  certificado: string;
  saldo: string;
  segunContrato: number;
};

const statusTabs = [
  { label: "Todas", count: 56, active: true },
  { label: "En proceso", count: 14 },
  { label: "Completadas", count: 42 },
];

const rows: Row[] = [
  { no: 1, obra: "NUEVA- SECTOR 1- SE...", area: "0", entidad: "S.U.E.P", mes: "16/6/2025", inicio: "17/1/2025", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 10 },
  { no: 2, obra: "CENTRO INTERPRETAC...", area: "495", entidad: "MOySP", mes: "19/12/2025", inicio: "25/6/2020", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 8 },
  { no: 3, obra: "MUSEO HISTORICO YA...", area: "659.21", entidad: "MOySP", mes: "19/11/2025", inicio: "24/7/2020", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 9 },
  { no: 4, obra: "HOSPITAL SAN ANTO...", area: "1630", entidad: "MOySP", mes: "20/7/2025", inicio: "8/3/2021", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 13 },
  { no: 5, obra: "CONSTRUCCION DE 15...", area: "956.55", entidad: "IN.VI.CO", mes: "16/12/2025", inicio: "1/7/2020", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 16 },
  { no: 6, obra: "CONSTRUCCION DE 20...", area: "1275.4", entidad: "IN.VI.CO", mes: "20/9/2025", inicio: "1/2/2021", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 8 },
  { no: 7, obra: "CONSTRUCCION DE 20...", area: "1217.1", entidad: "IN.VI.CO", mes: "21/5/2025", inicio: "23/2/2022", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 8 },
  { no: 8, obra: "ACONDICIONAMIENT...", area: "1500", entidad: "Ministerio de Seguric", mes: "21/2/2025", inicio: "30/6/2021", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 6 },
  { no: 9, obra: "PROYECTO DE OBRA J...", area: "165.2", entidad: "MOySP", mes: "20/7/2025", inicio: "17/9/2021", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 4 },
  { no: 10, obra: "CONSTRUCCION JIN N...", area: "545", entidad: "Ministerio de Educac", mes: "21/10/2025", inicio: "25/2/2022", contrato: "$ 0,00", certificado: "$ 0,00", saldo: "$ 0,00", segunContrato: 6 },
];

function ToolButton({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-2 rounded-lg border-[#e8e8e8] bg-white px-3.5 text-[#555] hover:bg-[#fafafa]"
    >
      <Icon className="size-4 text-[#999]" />
      <span>{label}</span>
    </Button>
  );
}

function SortableHead({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableHead
      className={cn(
        "h-10 border-r border-[#f0f0f0] bg-white px-3.5 text-[11px] font-semibold uppercase tracking-wide text-[#aaa] last:border-r-0 whitespace-normal",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="leading-tight">{children}</span>
        <ArrowUpDown className="size-3 shrink-0 text-[#555]" />
      </div>
    </TableHead>
  );
}

export default function ExcelTestPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] px-10 py-8">
      <div className="relative z-10">
        <header className="flex flex-col gap-4 pb-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] sm:text-4xl">
                Panel de obras
              </h1>
              <p className="mt-1 text-sm text-[#999]">
                Filtrá, buscá y actualizá tus obras desde una vista unificada.
              </p>
            </div>

            {/* Status tabs */}
            <div className="flex flex-col gap-1 xl:flex-row xl:items-center xl:justify-between p-1 rounded-lg  bg-[radial-gradient(100%_50%_at_50%_0,_#fff3_0,_#fff0_100%),var(--background-50,_#fafafa80)] shadow-[0_0_0_1px_#28255a14,0_1px_0_0_#fff9_inset,0_0_0_1px_#ffffff4d_inset,0_0_10px_0_#4f38921a_inset,0_162px_65px_0_#0b090c03]">

              {statusTabs.map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  className={cn(
                    "inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:px-5",
                    tab.active
                      ? "bg-white text-[#1a1a1a] shadow-sm"
                      : "text-[#999] hover:text-[#555]",
                  )}
                >
                  <span className="truncate">{tab.label}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-5 rounded-full border px-1.5 text-[11px] shadow-none",
                      tab.active
                        ? "border-[#e8e8e8] bg-[#f5f5f5] text-[#555]"
                        : "border-[#e8e8e8] bg-white text-[#999]",
                    )}
                  >
                    {tab.count}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between p-2 rounded-xl  bg-[radial-gradient(100%_50%_at_50%_0,_#fff3_0,_#fff0_100%),var(--background-50,_#fafafa80)] shadow-[0_0_0_1px_#28255a14,0_1px_0_0_#fff9_inset,0_0_0_1px_#ffffff4d_inset,0_0_10px_0_#4f38921a_inset,0_162px_65px_0_#0b090c03]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-[300px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#bbb]" />
                <Input
                  type="search"
                  placeholder="Buscar en columnas de obras"
                  className="h-9 rounded-lg border-[#e8e8e8] pl-9 text-sm bg-white bg-[radial-gradient(100%_50%_at_50%_0%,#fff_0%,#fff0_100%),var(--background-85,#fafafad9)] shadow-[0_0_0_1px_#00000012,0_1px_0_0_#fff_inset,0_8px_3px_0_#0b090c03,0_5px_3px_0_#0b090c08,0_2px_2px_0_#0b090c0d,0_1px_1px_0_#0b090c0f,0_-1px_0_0_#0000001f_inset] hover:bg-accent text-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <ToolButton icon={Filter} label="Filtros" />
                <ToolButton icon={LayoutGrid} label="Columnas" />
                <ToolButton icon={Download} label="Exportar tabla" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ToolButton icon={Upload} label="Importar CSV" />
              <ToolButton icon={FileSpreadsheet} label="Generar Reporte" />
            </div>
          </div>
        </header>

        <div className="overflow-hidden bg-card shadow-card rounded-xl p-1.5">
          <div className="max-w-full">
            <div className="min-w-[1520px] rounded-lg overflow-hidden shadow-card">
              <Table className="w-full border-collapse">
                <TableHeader className="">
                  <TableRow className="hover:bg-background-dark [&_th:last-child]:border-r-0">
                    <SortableHead className="w-[56px] text-center bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">N°</SortableHead>
                    <SortableHead className="w-[330px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Designación y Ubicación</SortableHead>
                    <SortableHead className="w-[130px] bg-back-darker/80 border-[#09090b1f]  font-bold text-primary/90">Sup. de Obra (m²)</SortableHead>
                    <SortableHead className="w-[210px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Entidad Contratante</SortableHead>
                    <SortableHead className="w-[170px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Mes Básico de Contrato</SortableHead>
                    <SortableHead className="w-[150px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Iniciación</SortableHead>
                    <SortableHead className="w-[210px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Contrato + Ampliaciones</SortableHead>
                    <SortableHead className="w-[210px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Certificado a la Fecha</SortableHead>
                    <SortableHead className="w-[190px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Saldo a Certificar</SortableHead>
                    <SortableHead className="w-[160px] bg-back-darker/80 border-[#09090b1f] font-bold text-primary/90">Según Contrato</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child_td]:border-b-0">
                  {rows.map((row, i) => (
                    <TableRow
                      key={row.no}
                      className={cn(
                        "border-[#f0f0f0] transition-colors hover:bg-[#fffaf5] group/row",
                        i % 2 === 1 ? "bg-[#fafafa]" : "bg-white",
                      )}
                    >
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5 text-center text-sm font-medium tabular-nums text-[#bbb]">
                        {row.no}
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5 font-medium text-[#1a1a1a]">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex size-4 items-center justify-center rounded shadow-card text-[10px] text-bold text-primary/80 group-hover/row:text-white group-hover/row:bg-orange-primary/80">
                            <ArrowUpRight className="size-3  " />
                          </span>
                          <span className="truncate">{row.obra}</span>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5 tabular-nums text-[#555]">
                        {row.area}
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5 text-[#555]">
                        {row.entidad}
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="tabular-nums text-[#555]">{row.mes}</span>
                          <span className="text-[#ddd]">▦</span>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="tabular-nums text-[#555]">{row.inicio}</span>
                          <span className="text-[#ddd]">▦</span>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5 tabular-nums text-[#555]">
                        {row.contrato}
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5 tabular-nums text-[#555]">
                        {row.certificado}
                      </TableCell>
                      <TableCell className="border-r border-[#f0f0f0] px-3.5 py-2.5 tabular-nums text-[#555]">
                        {row.saldo}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 tabular-nums text-[#555]">
                        {row.segunContrato}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <footer className="border-t border-[#f0f0f0] bg-white py-2 px-1 pt-2 mt-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#999]">Filas por página</span>
                  <Select defaultValue="10">
                    <SelectTrigger className="h-9 w-[80px] rounded-lg border-[#e8e8e8] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-[#999]">
                  Mostrando{" "}
                  <span className="font-semibold text-[#1a1a1a]">10</span> de{" "}
                  <span className="font-semibold text-[#1a1a1a]">56</span> filas
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-center">
                <Button
                  variant="outline"
                  className="h-9 rounded-lg border-[#e8e8e8] bg-white px-4 text-[#555]"
                >
                  Agregar fila vacía
                </Button>
                <Button disabled className="h-9 rounded-lg px-4 opacity-30">
                  Guardar cambios
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg border-[#e8e8e8] bg-white px-3.5 text-[#999]"
                >
                  &lt; Anterior
                </Button>
                <span className="text-sm text-[#999]">Página 1 de 6</span>
                <Button size="sm" className="h-9 rounded-lg bg-[#1a1a1a] px-3.5 text-white hover:bg-[#333]">
                  Siguiente &gt;
                </Button>
              </div>
            </div>
          </footer>
        </div>

      </div>
    </div>
  );
}
