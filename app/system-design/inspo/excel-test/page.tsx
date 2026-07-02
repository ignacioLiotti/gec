"use client"

import type { ComponentType, CSSProperties, ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  Clock3,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderClock,
  FolderOpen,
  Hash,
  Landmark,
  LayoutGrid,
  LineChart,
  MapPin,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Ruler,
  Save,
  Search,
  ShieldCheck,
  StickyNote,
  Table2,
  Trash2,
  TriangleAlert,
  Upload,
  Workflow
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotchTail } from "@/components/ui/notch-tail"
import FolderFront from "@/components/ui/FolderFront"
import { cn } from "@/lib/utils"

type IconComponent = ComponentType<{ className?: string }>
type DocKind = "folder" | "pdf" | "sheet" | "image"
type DocStatus = "" | "completed" | "processing" | "failed" | "unprocessed"

const obras = [
  [
    1,
    "NUEVA - SECTOR 1 - SECTOR II - 4 ETAPA",
    "1.280",
    "S.U.E.P.",
    "16/06/2025",
    "17/01/2025",
    "$ 482.450.000",
    "$ 216.822.000",
    "$ 265.628.000",
    48
  ],
  [
    2,
    "CENTRO INTERPRETACION IBERA",
    "495",
    "MOySP",
    "19/12/2025",
    "25/06/2020",
    "$ 291.180.000",
    "$ 188.900.000",
    "$ 102.280.000",
    67
  ],
  [
    3,
    "MUSEO HISTORICO YAPEYU",
    "659",
    "MOySP",
    "19/11/2025",
    "24/07/2020",
    "$ 356.900.000",
    "$ 99.730.000",
    "$ 257.170.000",
    29
  ],
  [
    4,
    "HOSPITAL SAN ANTONIO - AMPLIACION",
    "1.630",
    "Salud",
    "20/07/2025",
    "08/03/2021",
    "$ 624.000.000",
    "$ 492.960.000",
    "$ 131.040.000",
    79
  ],
  [
    5,
    "CONSTRUCCION DE 15 VIVIENDAS",
    "956",
    "IN.VI.CO.",
    "16/12/2025",
    "01/07/2020",
    "$ 338.100.000",
    "$ 162.288.000",
    "$ 175.812.000",
    48
  ],
  [
    6,
    "ACONDICIONAMIENTO COMISARIA CENTRAL",
    "1.500",
    "Seguridad",
    "21/02/2025",
    "30/06/2021",
    "$ 172.450.000",
    "$ 143.133.500",
    "$ 29.316.500",
    83
  ]
] as const

const policies = [
  ["301-44892", "Caucion", "18/08/2026", "52d", "active"],
  ["301-44893", "Responsabilidad", "09/07/2026", "12d", "dueSoon"],
  ["301-44894", "Accidentes", "14/06/2026", "13d tarde", "expired"],
  ["301-44895", "Caucion", "02/10/2026", "97d", "cancelled"]
] as const

const docs = [
  ["Certificados", "folder", ""],
  ["Documentacion", "folder", ""],
  ["Ordenes de compra", "folder", "completed"],
  ["Poliza 301-44892.pdf", "pdf", "completed"],
  ["Certificado 09.pdf", "pdf", "processing"],
  ["PMC Resumen.xlsx", "sheet", "completed"],
  ["Acta medicion.jpg", "image", "failed"],
  ["Curva plan.xlsx", "sheet", "unprocessed"]
] as const satisfies ReadonlyArray<readonly [string, DocKind, DocStatus]>

const nav = [
  ["landing", "Excel landing"],
  ["general", "General tab"],
  ["polizas", "Polizas tab"],
  ["documents", "Documents New"]
] as const


function Section({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-8">
      <div>
        <h2 className="text-xl font-semibold tracking-normal text-stone-950">{title}</h2>
        <p className="max-w-4xl text-sm text-stone-500">{note}</p>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-[#e4dfd4] bg-[#f6f2eb]/75 p-2 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="overflow-hidden rounded-[24px] border border-[#f3eee7] bg-[#fafafa]">{children}</div>
      </div>
    </section>
  )
}

function Tool({ icon: Icon, label }: { icon: IconComponent; label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg bg-white px-3.5 text-[#5a5248]">
      <Icon className="size-4" />
      {label}
    </Button>
  )
}

function Notched({ side = "left", children }: { side?: "left" | "right"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-2 rounded-xl border border-[#09090b1f] bg-card p-2 pb-0",
        side === "left"
          ? "overflow-x-auto xl:-ml-[1px] xl:overflow-visible xl:rounded-r-none xl:rounded-b-none xl:border-r-0 xl:border-b-0"
          : "flex-wrap xl:-mr-[1px] xl:justify-end xl:rounded-l-none xl:rounded-b-none xl:border-l-0 xl:border-b-0 xl:pb-0"
      )}
      style={{ "--notch-bg": "white", "--notch-stroke": "rgb(231 229 228)" } as CSSProperties}
    >
      {side === "right" ? <NotchTail side="left" className="mb-[1px] h-[45px] !hidden xl:!block" /> : null}
      {children}
      {side === "left" ? <NotchTail side="right" className="z-100 mb-[1px] h-[45px] !hidden xl:!block" /> : null}
    </div>
  )
}

function ObrasTable() {
  const heads = [
    "N",
    "Designacion y ubicacion",
    "Sup.",
    "Entidad",
    "Mes basico",
    "Inicio",
    "Contrato + ampliaciones",
    "Certificado",
    "Saldo",
    "Avance"
  ]

  return (
    <div className="max-w-full overflow-hidden rounded-lg shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1480px] border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b">
              {heads.map((head) => (
                <th
                  key={head}
                  className="h-10 border-r border-[#09090b1f] bg-white px-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-primary/90 last:border-r-0"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {obras.map((row, index) => (
              <tr
                key={row[0]}
                className={cn(
                  "group/row border-b border-[#f0f0f0] hover:bg-[#fffaf5]",
                  index % 2 ? "bg-[#fafafa]" : "bg-white"
                )}
              >
                <td className="border-r border-[#f0f0f0] px-3.5 py-2.5 text-center font-medium tabular-nums text-[#bbb]">
                  {row[0]}
                </td>
                <td className="border-r border-[#f0f0f0] px-3.5 py-2.5 font-medium text-[#1a1a1a]">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex size-4 items-center justify-center rounded text-primary/80 shadow-md group-hover/row:bg-orange-primary/80 group-hover/row:text-white">
                      <ArrowUpRight className="size-3" />
                    </span>
                    {row[1]}
                  </span>
                </td>
                {row.slice(2, 9).map((cell) => (
                  <td key={String(cell)} className="border-r border-[#f0f0f0] px-3.5 py-2.5 tabular-nums text-[#555]">
                    {cell}
                  </td>
                ))}
                <td className="px-3.5 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-8 text-right text-xs font-semibold text-[#555]">{row[9]}%</span>
                    <span className="h-2 w-16 overflow-hidden rounded-full bg-[#f3eee7]">
                      <span className="block h-full rounded-full bg-orange-primary" style={{ width: `${row[9]}%` }} />
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExcelLanding() {
  return (
    <div className="relative min-h-[730px] overflow-hidden bg-[#f9f9f9] px-3 py-4 sm:px-4 md:py-8 md:pl-8">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-[#1a1a1a] sm:text-4xl">Tus Obras</h1>
            <p className="mt-1 text-sm text-[#999]">Filtra, busca y actualiza tus obras desde una vista unificada.</p>
          </div>
          <div className="flex h-11 min-w-max gap-1 rounded-lg p-1 shadow-[0_0_0_1px_#28255a14,0_1px_0_0_#fff9_inset,0_0_0_1px_#ffffff4d_inset]">
            <button className="rounded-lg bg-white px-4 text-sm font-medium shadow-sm">
              Todas <Badge className="ml-2">56</Badge>
            </button>
            <button className="rounded-lg px-4 text-sm font-medium text-[#999]">
              En proceso <Badge className="ml-2">14</Badge>
            </button>
            <button className="rounded-lg px-4 text-sm font-medium text-[#999]">
              Completadas <Badge className="ml-2">42</Badge>
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Notched>
            <div className="relative w-[300px] max-w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#bbb]" />
              <Input placeholder="Buscar en columnas de obras" className="h-9 rounded-lg bg-white pl-9" />
            </div>
            <Tool icon={Filter} label="Filtros" />
            <Tool icon={LayoutGrid} label="Columnas" />
            <Tool icon={Download} label="Exportar tabla" />
          </Notched>

          <Notched side="right">
            <Tool icon={Upload} label="Importar CSV" />
            <Tool icon={FileText} label="Generar Reporte" />
            <Tool icon={Trash2} label="Papelera obras" />
          </Notched>
        </div>

        <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-2 pt-3 shadow-md sm:p-2.5 sm:pt-3.5 xl:rounded-t-none">
          <ObrasTable />
          <div className="h-px bg-border" />
          <div className="flex flex-col gap-4 bg-white px-1 py-2 xl:flex-row xl:items-center xl:justify-between">
            <p className="text-sm text-[#999]">
              Mostrando <b className="text-[#1a1a1a]">6</b> de <b className="text-[#1a1a1a]">56</b> filas
            </p>
            <div className="flex gap-2">
              <Button variant="outline">Agregar fila vacia</Button>
              <Button disabled className="opacity-30">
                Guardar cambios
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Anterior
              </Button>
              <span className="text-sm text-[#999]">Pagina 1 de 6</span>
              <Button size="sm" className="bg-[#1a1a1a] text-white hover:bg-[#333]">
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


function DetailTabs({ active }: { active: "general" | "polizas" | "documentos-new" }) {
  const tabs = [
    ["general", "General", Building2],
    ["polizas", "Polizas", ShieldCheck],
    ["flujo", "Flujo", Workflow],
    ["documentos", "Documentos Legacy", FolderOpen],
    ["documentos-new", "Documentos New", FolderClock]
  ] as const

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tabs.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[13px] font-medium",
            value === active ? "bg-[#1a1a1a] text-white" : "text-[#999] hover:bg-[#f5f5f5] hover:text-[#555]"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function ObraChrome({
  active,
  actions,
  children
}: {
  active: "general" | "polizas" | "documentos-new"
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative min-h-[730px] bg-[#fafafa] px-4 pt-2">
      <div className="mb-3 flex flex-col gap-3 pb-3 pt-2 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums text-orange-primary">#1</span>
            <h1 className="truncate text-2xl font-semibold tracking-normal text-[#1a1a1a]">
              NUEVA - SECTOR 1 - SECTOR II - 4 ETAPA
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#999]">S.U.E.P. - Corrientes - Inicio 17/01/2025</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RotateCcw className="size-4" />
            Recuperar
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="size-4" />
            Borrar obra
          </Button>
        </div>
      </div>
      <span className="mb-3 -mt-3 flex h-[3px] w-full border-b-[1.5px] border-white bg-[#e4e6ea]" />
      <div className="space-y-4">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <DetailTabs active={active} />
          <div className="flex flex-wrap justify-end gap-2">{actions}</div>
        </div>
        {children}
      </div>
    </div>
  )
}

function ShellCard({
  title,
  icon: Icon,
  children,
  className
}: {
  title: string
  icon: IconComponent
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl bg-white shadow-md", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-orange-primary/10 text-orange-primary">
            <Icon className="size-4" />
          </span>
          <h3 className="text-[18px] font-semibold text-[#1a1a1a]">{title}</h3>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function MiniField({ icon: Icon, label, value, hot = false }: { icon: IconComponent; label: string; value: string; hot?: boolean }) {
  return (
    <div className={cn("flex-1 rounded-lg border border-[#f0f0f0] p-3", hot && "border-[#f7b26a] bg-[#fff7ed]")}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[#aaa]">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-[13px] font-medium text-[#1a1a1a]">{value}</div>
    </div>
  )
}

function GeneralView() {
  return (
    <ObraChrome
      active="general"
      actions={
        <>
          <div className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 p-1">
            <Button size="sm" className="h-8">
              <Eye className="size-4" />
              Vista previa
            </Button>
            <Button variant="secondary" size="sm" className="h-8">
              <Pencil className="size-4" />
              Edicion
            </Button>
          </div>
          <Button variant="secondary">
            <StickyNote className="size-4" />
            Memoria
          </Button>
        </>
      }
    >
      <div className="space-y-5 pt-4">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ShellCard title="Avance" icon={Percent} className="h-full border-[#f7b26a] bg-[#fffaf5]">
              <div className="flex flex-col items-center gap-4">
                <div className="grid size-44 place-items-center rounded-full border-[28px] border-orange-primary/80 text-center">
                  <div>
                    <div className="text-3xl font-bold">48%</div>
                    <div className="text-xs text-muted-foreground">Completado</div>
                  </div>
                </div>
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700">
                  <div className="flex gap-2">
                    <AlertTriangle className="size-4" />
                    <div>
                      <p className="text-sm font-semibold">Certificado mensual pendiente</p>
                      <p className="text-xs">No se detecto certificado para el periodo actual.</p>
                    </div>
                  </div>
                </div>
              </div>
            </ShellCard>
          </div>
          <div className="lg:col-span-8">
            <ShellCard title="Curva de avance" icon={LineChart}>
              <div className="relative h-[274px] rounded-lg border border-[#ededed] bg-[#fcfcfc] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Curva Plan vs PMC Resumen</p>
                <div className="absolute inset-x-6 bottom-8 top-14 rounded-lg border bg-white bg-[linear-gradient(to_right,rgba(240,240,240,.7)_1px,transparent_1px),linear-gradient(to_bottom,rgba(240,240,240,.7)_1px,transparent_1px)] bg-[size:48px_38px]" />
                <svg className="absolute inset-x-8 bottom-12 top-20 h-[150px] w-[calc(100%-4rem)]" preserveAspectRatio="none">
                  <polyline
                    points="0,130 110,112 220,92 330,64 440,42 560,20"
                    fill="none"
                    stroke="#ff5800"
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                  <polyline
                    points="0,140 110,125 220,112 330,92 440,74 560,62"
                    fill="none"
                    stroke="#1f1a17"
                    strokeDasharray="8 7"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                </svg>
              </div>
            </ShellCard>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <ShellCard title="Datos Financieros" icon={BadgeDollarSign}>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {[
                  ["Contrato + ampliaciones", "$ 482.450.000"],
                  ["Certificado", "$ 216.822.000"],
                  ["Saldo", "$ 265.628.000"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#f7b26a] bg-[#fffaf5] px-3 py-2">
                    <p className="text-[11px] uppercase text-[#aaa]">{label}</p>
                    <p className="text-lg font-semibold text-[#1a1a1a]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-3">
                <MiniField icon={FileText} label="Segun contrato" value="10 meses" />
                <MiniField icon={Calendar} label="Plazo de obra" value="5 / 12 meses" hot />
              </div>
            </ShellCard>
          </div>
          <div className="lg:col-span-6">
            <ShellCard title="Informacion General" icon={Landmark}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MiniField icon={MapPin} label="Designacion" value="NUEVA - SECTOR 1" />
                <MiniField icon={Building2} label="Entidad" value="S.U.E.P." />
                <MiniField icon={Calendar} label="Mes basico" value="16/06/2025" />
                <MiniField icon={Hash} label="N de obra" value="#1" />
                <MiniField icon={Ruler} label="Superficie" value="1.280 m2" />
              </div>
            </ShellCard>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex flex-col items-end gap-3 rounded-xl border border-[#f7b26a] bg-[#fffaf5]/95 p-4 backdrop-blur">
          <p className="text-sm font-semibold text-orange-primary">
            <AlertTriangle className="mr-2 inline size-5" />
            Tenes cambios sin guardar
          </p>
          <div className="flex gap-3">
            <Button variant="outline">Descartar cambios</Button>
            <Button>
              <Save className="size-4" />
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </ObraChrome>
  )
}

function policyTone(status: string) {
  if (status === "expired") return "border-orange-300 bg-orange-50 text-orange-700"
  if (status === "dueSoon") return "border-amber-200 bg-amber-50 text-amber-700"
  if (status === "cancelled") return "border-sky-200 bg-sky-50 text-sky-800"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function PolizasView() {
  const selected = policies[1]

  return (
    <ObraChrome active="polizas">
      <div className="relative grid min-h-[560px] gap-2 overflow-hidden lg:grid-cols-[minmax(340px,31%)_minmax(0,1fr)]">
        <aside>
          <div className="space-y-3 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <Input placeholder="Buscar poliza" className="h-10 rounded-lg border-stone-200 bg-white pl-9 text-sm shadow-sm" />
            </div>
            <div className="flex flex-wrap gap-1">
              {["Todas", "Activas", "Por vencer", "Vencidas"].map((filter, index) => (
                <button
                  key={filter}
                  className={cn("h-7 rounded-lg px-2.5 text-[11px] font-bold", index ? "text-stone-600 hover:bg-white" : "bg-stone-900 text-white")}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="m-4 max-h-[420px] overflow-y-auto bg-stone-50 shadow-md">
            {policies.map((policy) => (
              <button
                key={policy[0]}
                className={cn(
                  "flex min-h-[72px] w-full items-center gap-3 px-5 py-3 text-left hover:bg-stone-100",
                  policy[0] === selected[0] && "border-l-4 border-amber-300 bg-amber-50/55 shadow-md"
                )}
              >
                <span className={cn("flex size-8 items-center justify-center rounded-full border-2", policyTone(policy[4]))}>
                  {policy[4] === "expired" ? <TriangleAlert className="size-3.5" /> : <Clock3 className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="text-[15px] text-stone-900">{policy[0]}</b>
                  <span className="ml-1 rounded-md border bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-600">
                    {policy[1]}
                  </span>
                </span>
                <span className="text-right text-[11px] font-semibold text-stone-500">
                  {policy[2]}
                  <br />
                  <b className="text-amber-700">{policy[3]}</b>
                </span>
              </button>
            ))}
          </div>
          <div className="m-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
              Agregar poliza <span className="normal-case text-stone-400">- carga manual</span>
            </p>
            <Input placeholder="Numero de poliza" className="mb-2 h-9" />
            <div className="mb-2 grid grid-cols-[1fr_96px] gap-2">
              <Input type="date" className="h-9" />
              <div className="flex items-center justify-center rounded-md border bg-stone-50 text-[10px] uppercase text-stone-500">
                Sin regla
              </div>
            </div>
            <Button className="h-9 w-full gap-2 bg-orange-500 text-white hover:bg-orange-600">
              <Plus className="size-4" />
              Agregar poliza
            </Button>
          </div>
        </aside>

        <section className="m-0.5 min-w-0 overflow-hidden rounded-xl bg-white shadow-md">
          <div className="flex items-start justify-between gap-6 border-b border-stone-200 bg-gradient-to-b from-amber-50 to-white px-6 py-5">
            <div className="flex gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700">
                <Clock3 className="size-[18px]" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">{selected[1]} - Poliza - Excel</p>
                <h2 className="mt-1 text-2xl font-black tracking-normal text-stone-900">N {selected[0]}</h2>
                <p className="mt-4 max-w-4xl text-[11px] font-semibold uppercase text-stone-500">
                  Garantia de ejecucion de contrato, ampliaciones y responsabilidades.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <ArrowRight className="size-4" />
                Mover
              </Button>
              <Button variant="outline" className="border-red-200 text-red-700">
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            </div>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border bg-white p-4">
              <div className="relative h-5 overflow-hidden rounded-sm bg-stone-100">
                <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0,transparent_8px,rgba(120,113,108,0.14)_8px,rgba(120,113,108,0.14)_14px)]" />
                <span className="relative block h-full w-[82%] bg-amber-500" />
              </div>
              <p className="mt-2 text-[10px] font-bold text-stone-500">Transcurrido 82% del periodo de cobertura</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {["Monto asegurado", "Fecha de finalizacion", "Responsables", "Fecha calculada baja", "Premio / prima", "Saldo / estado"].map(
                (label, index) => (
                  <div
                    key={label}
                    className={cn(
                      "min-h-[86px] rounded-xl border p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                      index === 3 ? "border-orange-200 bg-orange-50/45" : "border-stone-200 bg-white"
                    )}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">{label}</p>
                    <p className="mt-2.5 text-xl font-black tracking-normal text-stone-900">
                      {index === 1 ? selected[2] : index === 2 ? "Maria Torres" : index === 3 ? "18/09/2026" : "$ 120.000.000"}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </div>
    </ObraChrome>
  )
}

function DocBadge({ status }: { status: DocStatus }) {
  if (!status) return null

  const statusMap: Record<Exclude<DocStatus, "">, [string, string, IconComponent]> = {
    completed: ["Procesado", "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_8px_18px_rgba(16,185,129,0.14)]", Check],
    processing: ["Procesando", "border-sky-300 bg-sky-50 text-sky-800 shadow-[0_8px_18px_rgba(14,165,233,0.14)]", RefreshCw],
    failed: ["Error", "border-rose-300 bg-rose-50 text-rose-800 shadow-[0_8px_18px_rgba(244,63,94,0.14)]", AlertTriangle],
    unprocessed: ["Pendiente", "border-amber-300 bg-amber-50 text-amber-800 shadow-[0_8px_18px_rgba(245,158,11,0.14)]", Clock3]
  }
  const [label, className, Icon] = statusMap[status]

  return (
    <span
      aria-label={label}
      className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] backdrop-blur-sm", className)}
    >
      <Icon className={cn("size-3.5 shrink-0", status === "processing" && "animate-spin")} />
    </span>
  )
}

function DocTile({ item }: { item: (typeof docs)[number] }) {
  if (item[1] === "folder") {
    const isOcrEnabled = item[0] === "Ordenes de compra" || Boolean(item[2])
    const hasContent = item[0] !== "Documentacion"

    return (
      <div className="group flex h-[105px] shrink-0 flex-col items-center justify-end gap-2">
        <button
          type="button"
          className={cn(
            "relative mb-1 ml-1 flex h-[85px] w-[120px] flex-col items-start gap-2 rounded-lg border p-3 pb-1 transition-colors",
            isOcrEnabled ? "bg-linear-to-b from-amber-500 to-amber-700" : "bg-linear-to-b from-stone-500 to-stone-700"
          )}
          title={item[0]}
        >
          <div className="flex h-full w-full flex-col items-center justify-end">
            {hasContent ? (
              <span className="absolute -top-2 left-1/2 h-[80px] w-[100px] -translate-x-1/2 border bg-linear-to-b from-stone-100 to-stone-200 transition-all duration-200 ease-in-out group-hover:-top-4" />
            ) : null}
            <FolderFront
              firstStopColor={isOcrEnabled ? "#fe9a00" : "#79716b"}
              secondStopColor={isOcrEnabled ? "#fb8634" : "#57534d"}
              className="absolute -bottom-1 -left-3 h-[80px] w-[140px] origin-[50%_100%] transition-transform duration-300 group-hover:transform-[perspective(800px)_rotateX(-30deg)]"
            />
            {isOcrEnabled ? <Table2 className="absolute top-5 z-10 size-5 text-white/90" /> : null}
            <span className="z-10 w-full truncate text-center text-sm text-white">{item[0]}</span>
          </div>
        </button>
      </div>
    )
  }

  const Icon = item[1] === "sheet" ? FileSpreadsheet : item[1] === "image" ? FileText : File

  return (
    <button className="group relative flex h-[145px] w-[120px] flex-col items-start gap-2 rounded-none border bg-stone-100 p-3 text-left transition-colors" title={item[0]}>
      <span className="absolute right-0 top-0 z-10 border-8 border-stone-300 bg-stone-100" />
      <span className="absolute right-[-1px] top-[-1px] z-10 border-8 border-b-transparent border-l-transparent border-white bg-stone-200" />
      <div className="absolute inset-0 top-0 flex items-center justify-center">
        <Icon className={cn("size-8", item[1] === "pdf" ? "text-red-500" : item[1] === "image" ? "text-amber-600" : "text-stone-500")} />
      </div>
      <div className="absolute right-2 top-2 z-20">
        <DocBadge status={item[2]} />
      </div>
      <div className="relative z-20 mt-auto w-full bg-stone-200/60 px-1 py-1 backdrop-blur-sm">
        <p className="truncate text-center text-sm text-stone-700">{item[0]}</p>
      </div>
    </button>
  )
}

function DocumentsView() {
  return (
    <ObraChrome
      active="documentos-new"
      actions={
        <>
          <Button variant="secondary" size="sm">
            <RotateCcw className="size-4" />
            Recuperar
          </Button>
          <Button variant="secondary" size="sm">
            <Trash2 className="size-4" />
            Papelera
          </Button>
        </>
      }
    >
      <div className="relative space-y-4">
        <section className="min-h-[640px] overflow-hidden">
          <div className="-mb-1">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div
                className="relative z-10 flex h-full items-center gap-3 overflow-visible rounded-tl-xl border border-b-0 border-[#d9d9d9] bg-white px-4 py-3"
                style={{ "--notch-bg": "white", "--notch-stroke": "#d9d9d9" } as CSSProperties}
              >
                <NotchTail side="right" className="mb-[4px] h-[55px]" />
                <Button variant="defaultSecondary" size="icon-sm">
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <h2 className="truncate text-xl font-semibold text-stone-950">Ordenes de compra</h2>
                    <span className="text-sm font-medium text-stone-500">(4 archivos - 1 carpeta)</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="ml-1 gap-1.5">
                  <Download className="size-3.5" />
                  Descargar todos
                </Button>
              </div>
              <div
                className="relative z-10 flex h-full flex-wrap items-center gap-2 overflow-visible rounded-tl-none rounded-tr-xl border border-b-0 border-l-0 border-[#d9d9d9] bg-white px-4 pb-0 pl-1 pt-3"
                style={{ "--notch-bg": "white", "--notch-stroke": "#d9d9d9" } as CSSProperties}
              >
                <NotchTail side="left" className="mb-[4px] h-[48px]" />
                <div className="inline-flex items-center rounded-md border border-[#d9d9d9] bg-stone-50 p-0.5">
                  <Button size="sm" className="h-8 gap-1.5 px-3">
                    <File className="size-3.5" />
                    Archivos
                  </Button>
                  <Button variant="secondary" size="sm" className="h-8 gap-1.5 px-3">
                    <Table2 className="size-3.5" />
                    Tabla
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="relative min-h-[560px] rounded-b-lg border border-[#d9d9d9] bg-white p-4 pt-4 transition-colors">
            <div className="space-y-5">
              <div className="border-b border-[#d9d9d9] pb-3">
                <div className="flex items-start gap-4 overflow-x-auto px-2 pb-1">
                  {docs.filter((doc) => doc[1] === "folder").map((doc) => (
                    <DocTile key={doc[0]} item={doc} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 rounded-lg sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-10">
                {docs.filter((doc) => doc[1] !== "folder").map((doc) => (
                  <DocTile key={doc[0]} item={doc} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </ObraChrome>
  )
}

export default function ExcelCloneLabPage() {
  return (
    <main className="-m-4 min-h-[calc(100dvh-4rem)] bg-stone-100 px-4 py-8 sm:px-6 lg:-m-6 lg:px-10">
        <div className="mx-auto max-w-[1800px] space-y-10">
          <header className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  <FileSpreadsheet className="size-3.5" />
                  Fake data clone lab
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal text-stone-950">Excel product screens</h1>
                <p className="mt-1 max-w-4xl text-sm text-stone-500">
                  Static replicas for testing design-system tokens against the Excel route and obra detail tabs.
                </p>
              </div>
              <nav className="flex flex-wrap gap-2">
                {nav.map(([href, label]) => (
                  <a
                    key={href}
                    href={`#${href}`}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm hover:bg-stone-50"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </header>

          <Section id="landing" title="Excel landing table" note="Replica of app/excel/page.tsx after the route resolves to the desktop table client.">
            <ExcelLanding />
          </Section>
          <Section id="general" title="Obra detail - General tab" note="General tab preview state with ShellCard, KPI tiles, chart, warnings, and sticky save bar.">
            <GeneralView />
          </Section>
          <Section id="polizas" title="Obra detail - Polizas tab" note="Policy split pane, detail fields, and manual add card in the closed base state.">
            <PolizasView />
          </Section>
          <Section id="documents" title="Obra detail - Documents New tab" note="OCR folder header and document grid in the closed base state.">
            <DocumentsView />
          </Section>
        </div>
    </main>
  )
}
