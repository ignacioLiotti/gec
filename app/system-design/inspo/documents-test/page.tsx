import type { ComponentType } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Folder,
  FolderOpen,
  LayoutPanelLeft,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TopTab = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
};

type FolderNode = {
  name: string;
  count: number;
  open?: boolean;
  active?: boolean;
  mixed?: boolean;
};

const topTabs: TopTab[] = [
  { label: "General", icon: LayoutPanelLeft },
  { label: "Flujo", icon: Database },
  { label: "Documentos", icon: Folder, active: true },
];

const sidebarFolders: FolderNode[] = [
  { name: "Documentos", count: 0, open: true },
  { name: "Certificados", count: 1 },
  { name: "Documentacion", count: 0 },
  { name: "Oferta", count: 0 },
  { name: "Ordenes De ...", count: 1, active: true, mixed: true },
  { name: "Pliego", count: 0 },
  { name: "Polizas", count: 0 },
  { name: "Reg Construct C...", count: 0 },
];

const folderCards = [
  "Certificados",
  "Documentacion",
  "Oferta",
  "Ordenes De C...",
  "Pliego",
  "Polizas",
  "Reg Construct ...",
];

function TopNavButton({ label, icon: Icon, active }: TopTab) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition",
        active
          ? "border-stone-300 bg-white text-stone-900 shadow-sm"
          : "border-transparent bg-stone-100/70 text-stone-500 hover:border-stone-200 hover:bg-white"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function FolderTile({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "group relative h-20 w-[122px] shrink-0 rounded-lg border text-left transition",
        active
          ? "border-orange-300/80 bg-gradient-to-b from-orange-400 to-orange-500 text-white shadow-[0_4px_14px_rgba(249,115,22,0.25)]"
          : "border-stone-400/20 bg-gradient-to-b from-stone-500 to-stone-600 text-white hover:from-stone-500 hover:to-stone-700"
      )}
    >
      <div
        className={cn(
          "absolute left-3 top-0 h-4 w-12 -translate-y-1 rounded-t-md border border-b-0",
          active
            ? "border-orange-200/80 bg-orange-100"
            : "border-stone-300/70 bg-stone-100"
        )}
      />
      <div className="absolute inset-x-0 top-2 h-5 rounded-t-md bg-white/8" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="truncate text-sm font-semibold">{name}</p>
      </div>
    </button>
  );
}

export default function DocumentsTestPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(251,146,60,0.08),transparent_35%),radial-gradient(circle_at_100%_10%,rgba(120,113,108,0.07),transparent_42%),#f5f5f4] p-3 sm:p-5">
      <div className="mx-auto max-w-[1700px] space-y-4">
        <header className="flex flex-col gap-3 rounded-lg border border-stone-200/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
              <LayoutPanelLeft className="size-4" />
              <span>Inicio</span>
              <ChevronRight className="size-3.5" />
              <span>Excel</span>
              <ChevronRight className="size-3.5" />
              <span className="font-medium text-stone-700">Detalle</span>
              <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">
                NUEVA- SECTOR 1- SECTOR II- 4° ETAPA-H...
              </span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5">
              <span className="size-5 rounded-full bg-orange-500" />
              <span className="text-sm text-stone-800">ignacioliotti@gmail.com</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {topTabs.map((tab) => (
              <TopNavButton key={tab.label} {...tab} />
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-[640px] flex-col rounded-lg border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <Input
                  type="search"
                  placeholder="Buscar..."
                  className="h-9 rounded-md pl-9 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-stone-200/80 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  Carpetas
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-md border-stone-200 bg-white px-2.5 text-xs"
                  >
                    <Plus className="size-3.5" />
                    Crear
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                {sidebarFolders.map((folder, i) => {
                  const isRoot = i === 0;
                  return (
                    <div
                      key={folder.name}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                        folder.active ? "bg-orange-50 text-orange-700" : "text-stone-700 hover:bg-stone-50",
                        isRoot && "bg-stone-50"
                      )}
                    >
                      <span className="text-stone-400">
                        {isRoot ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </span>
                      <span className="text-stone-500">
                        {folder.open || folder.active ? (
                          <FolderOpen className={cn("size-4", folder.active && "text-orange-500")} />
                        ) : (
                          <Folder className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                      {folder.mixed ? (
                        <span className="text-purple-500">◈</span>
                      ) : null}
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-600">
                        {folder.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto border-t border-stone-200/80 p-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                Leyenda
              </p>
              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm border border-orange-300 bg-orange-100" />
                  Extracción de datos
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm border border-blue-300 bg-blue-100" />
                  Entrada manual
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-sm border border-purple-300 bg-purple-100" />
                  Mixta (extracción + manual)
                </div>
              </div>
            </div>
          </aside>

          <main className="rounded-lg border border-stone-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="flex flex-col gap-4 border-b border-stone-200/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-8 place-items-center rounded-md bg-stone-100 text-stone-600">
                  <Folder className="size-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold tracking-tight text-stone-900">
                    Todos los documentos
                  </h2>
                  <p className="text-sm text-stone-500">(0 archivos)</p>
                </div>
              </div>

              <Button
                variant="outline"
                className="h-9 rounded-md border-stone-300 bg-white px-4 text-stone-800"
              >
                <Upload className="size-4" />
                Subir archivos
              </Button>
            </div>

            <div className="border-b border-stone-200/80 px-5 py-4">
              <div className="flex gap-4 overflow-x-auto pb-1">
                {folderCards.map((name) => (
                  <FolderTile
                    key={name}
                    name={name}
                    active={name.startsWith("Ordenes")}
                  />
                ))}
              </div>
            </div>

            <div className="grid min-h-[500px] place-items-center p-8">
              <div className="text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-stone-400">
                  <Folder className="size-7" />
                </div>
                <p className="mt-4 text-lg font-medium text-stone-600">
                  No hay archivos en esta carpeta.
                </p>
                <p className="mt-1 text-sm text-stone-500">Subí archivos para comenzar.</p>
                <div className="mt-4">
                  <Badge variant="outline" className="rounded-md px-2 py-1 text-xs">
                    Carpeta vacía
                  </Badge>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
