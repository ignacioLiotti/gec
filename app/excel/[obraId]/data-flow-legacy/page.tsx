"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Database,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  GitBranch,
  Layers,
  Loader2,
  Monitor,
  RefreshCcw,
  Route,
  TriangleAlert,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SupportStatus = "implemented" | "partial" | "planned" | "not_supported";
type NodeStatus = "ok" | "incomplete" | "error" | "processing";
type GraphMode = "simplified" | "complete";
type CanvasMode = "system" | "result";

type DataFlowNode = {
  id: string;
  type: "table" | "macro_table" | "calculation" | "view";
  label: string;
  status: NodeStatus;
  supportStatus: SupportStatus;
  data: Record<string, unknown>;
};

type DataFlowEdge = {
  id: string;
  source: string;
  target: string;
  type:
    | "table_to_macro_table"
    | "table_to_calculation"
    | "calculation_to_view"
    | "macro_table_to_view";
  status: "ok" | "incomplete";
  supportStatus: SupportStatus;
  data: Record<string, unknown>;
};

type CoverageItem = {
  id: string;
  label: string;
  status: SupportStatus;
  detail: string;
};

type DataFlowPayload = {
  obra: { id: string; label: string };
  summary: { tables: number; macroTables: number; calculations: number; views: number; edges: number };
  coverage: { mode: string; items: CoverageItem[] };
  diagnostics?: { reportingProjectionErrors?: string[] };
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
};

type TableRowRecord = {
  id: string;
  data: Record<string, unknown>;
  lineage_row_key: string | null;
  extraction_id: string | null;
  materialization_version: number | null;
  created_at: string | null;
};

type TableDocumentRecord = {
  id: string;
  source_bucket: string | null;
  source_path: string | null;
  source_file_name: string | null;
  status: string | null;
  error_message: string | null;
  error_code: string | null;
  rows_extracted: number | null;
  processed_at: string | null;
  created_at: string | null;
};

type LayoutRect = { left: number; top: number; width: number; height: number };

type HoverState = {
  nodeId: string;
  x: number;
  y: number;
};

type SelectedDocument = {
  tableLabel: string;
  document: TableDocumentRecord;
};

function nodeStatusLabel(status: NodeStatus) {
  switch (status) {
    case "ok":
      return "OK";
    case "processing":
      return "Procesando";
    case "error":
      return "Con errores";
    case "incomplete":
    default:
      return "Incompleto";
  }
}

function supportLabel(status: SupportStatus) {
  switch (status) {
    case "implemented":
      return "implemented";
    case "partial":
      return "partial";
    case "planned":
      return "planned";
    case "not_supported":
    default:
      return "not_supported";
  }
}

function statusTone(status: NodeStatus) {
  switch (status) {
    case "ok":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "processing":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "incomplete":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function supportTone(status: SupportStatus) {
  switch (status) {
    case "implemented":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "planned":
      return "border-stone-200 bg-stone-100 text-stone-700";
    case "not_supported":
    default:
      return "border-stone-200 bg-stone-50 text-stone-500";
  }
}

function nodeTypeMeta(type: DataFlowNode["type"]) {
  switch (type) {
    case "table":
      return {
        icon: Database,
        label: "Tabla",
        tone: "bg-stone-900 text-white",
        dot: "bg-stone-900",
      };
    case "macro_table":
      return {
        icon: Layers,
        label: "Macrotabla",
        tone: "bg-[#f08c32] text-white",
        dot: "bg-[#f08c32]",
      };
    case "calculation":
      return {
        icon: GitBranch,
        label: "Calculo projected",
        tone: "bg-[#2a6f97] text-white",
        dot: "bg-[#2a6f97]",
      };
    case "view":
      return {
        icon: Monitor,
        label: "Resultado / vista",
        tone: "bg-[#c96b14] text-white",
        dot: "bg-[#c96b14]",
      };
    default:
      return {
        icon: Route,
        label: type,
        tone: "bg-stone-700 text-white",
        dot: "bg-stone-700",
      };
  }
}

function formatNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("es-AR") : "0";
}

function formatStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeValue(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

function buildVisibleSet({
  mode,
  focusViewId,
  nodes,
  edges,
}: {
  mode: CanvasMode;
  focusViewId: string | null;
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
}) {
  const visible = new Set<string>();
  if (mode === "system" || !focusViewId) {
    for (const node of nodes) visible.add(node.id);
    return visible;
  }

  const reverse = new Map<string, Set<string>>();
  for (const edge of edges) {
    const current = reverse.get(edge.target) ?? new Set<string>();
    current.add(edge.source);
    reverse.set(edge.target, current);
  }

  const queue = [focusViewId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visible.has(current)) continue;
    visible.add(current);
    for (const next of reverse.get(current) ?? []) {
      if (!visible.has(next)) queue.push(next);
    }
  }
  return visible;
}

function buildConnectedSet(selectedNodeId: string | null, edges: DataFlowEdge[]) {
  if (!selectedNodeId) return new Set<string>();

  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = adjacency.get(edge.source) ?? new Set<string>();
    from.add(edge.target);
    adjacency.set(edge.source, from);
    const to = adjacency.get(edge.target) ?? new Set<string>();
    to.add(edge.source);
    adjacency.set(edge.target, to);
  }

  const visited = new Set<string>();
  const queue = [selectedNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-stone-200 bg-white/80 px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-1 text-xs text-stone-500">{detail}</p>
    </div>
  );
}

function CoverageBadge({ item }: { item: CoverageItem }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-900">{item.label}</p>
        <Badge className={cn("border text-[10px]", supportTone(item.status))}>{supportLabel(item.status)}</Badge>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-stone-500">{item.detail}</p>
    </div>
  );
}

function ResultChip({
  node,
  active,
  onClick,
  onHover,
  onLeave,
}: {
  node: DataFlowNode;
  active: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onHover: (event: MouseEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
}) {
  const upstreamCount =
    formatStringList(node.data.consumedCalculationIds).length +
    formatStringList(node.data.consumedMacroTableIds).length;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "group min-w-[240px] rounded-[26px] border px-4 py-4 text-left shadow-sm transition",
        active
          ? "border-[#d78233] bg-[#fff1e2] shadow-[0_16px_40px_rgba(201,107,20,0.16)]"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-950">{node.label}</p>
          <p className="mt-1 text-xs text-stone-500">{String(node.data.location ?? "Vista final de la obra")}</p>
        </div>
        <Badge className={cn("border text-[10px]", statusTone(node.status))}>{nodeStatusLabel(node.status)}</Badge>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Fuentes visibles</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">{upstreamCount}</p>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-[#9c5511]">
          Ver flujo
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

function HoverPreview({
  node,
  hover,
}: {
  node: DataFlowNode | null;
  hover: HoverState | null;
}) {
  if (!node || !hover) return null;
  const meta = nodeTypeMeta(node.type);
  const Icon = meta.icon;

  const primary =
    node.type === "table"
      ? `${formatNumber(node.data.rowCount)} filas`
      : node.type === "macro_table"
        ? `${formatNumber(node.data.sourceCount)} fuentes`
        : node.type === "calculation"
          ? `${formatStringList(node.data.inputTableIds).length} inputs`
          : `${formatStringList(node.data.displayedMetrics).length} metricas`;

  return (
    <div
      className="pointer-events-none fixed z-[90] max-w-[280px] rounded-2xl border border-stone-700 bg-stone-950/95 px-3 py-3 text-white shadow-2xl"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffb275]">
        <Icon className="h-3 w-3" />
        {meta.label}
      </div>
      <p className="mt-2 text-sm font-semibold">{node.label}</p>
      <p className="mt-1 text-xs text-stone-300">{primary}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Click para inspeccionar</p>
    </div>
  );
}

function CanvasNodeCard({
  node,
  selected,
  dimmed,
  highlighted,
  onClick,
  onHover,
  onLeave,
  register,
}: {
  node: DataFlowNode;
  selected: boolean;
  dimmed: boolean;
  highlighted: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onHover: (event: MouseEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
  register: (element: HTMLButtonElement | null) => void;
}) {
  const meta = nodeTypeMeta(node.type);
  const Icon = meta.icon;

  const primaryMetric =
    node.type === "table"
      ? { label: "Filas", value: formatNumber(node.data.rowCount) }
      : node.type === "macro_table"
        ? { label: "Fuentes", value: formatNumber(node.data.sourceCount) }
        : { label: "Inputs", value: String(formatStringList(node.data.inputTableIds).length) };

  const secondaryMetric =
    node.type === "table"
      ? { label: "Columnas", value: formatNumber(node.data.columnCount) }
      : node.type === "macro_table"
        ? { label: "Columnas", value: formatNumber(node.data.columnCount) }
        : { label: "Hallazgos", value: formatNumber(node.data.openFindingCount) };

  return (
    <button
      ref={register}
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "group relative w-[300px] rounded-[26px] border bg-white px-4 py-4 text-left shadow-sm transition",
        selected
          ? "border-[#d78233] ring-2 ring-[#f6c18b]/70"
          : highlighted
            ? "border-stone-300 shadow-md"
            : "border-stone-200",
        dimmed ? "opacity-35" : "opacity-100",
        "hover:border-stone-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", meta.tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-950">{node.label}</p>
            <p className="text-xs text-stone-500">{meta.label}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge className={cn("border text-[10px]", statusTone(node.status))}>{nodeStatusLabel(node.status)}</Badge>
          <Badge className={cn("border text-[10px]", supportTone(node.supportStatus))}>{supportLabel(node.supportStatus)}</Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{primaryMetric.label}</p>
          <p className="mt-1 text-lg font-semibold text-stone-950">{primaryMetric.value}</p>
        </div>
        <div className="rounded-2xl bg-stone-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{secondaryMetric.label}</p>
          <p className="mt-1 text-lg font-semibold text-stone-950">{secondaryMetric.value}</p>
        </div>
      </div>

      {node.type === "table" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {formatStringList(node.data.sourceFolderLabels).length > 0 ? (
            formatStringList(node.data.sourceFolderLabels).slice(0, 3).map((label) => (
              <span
                key={label}
                className="rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-600"
              >
                {label}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-medium text-stone-500">
              Sin carpeta declarada
            </span>
          )}
        </div>
      ) : null}
    </button>
  );
}

function FlowEdges({
  edges,
  positions,
  activeEdgeIds,
  dimmed,
}: {
  edges: DataFlowEdge[];
  positions: Map<string, LayoutRect>;
  activeEdgeIds: Set<string>;
  dimmed: boolean;
}) {
  const paths = edges
    .map((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) return null;
      const startX = source.left + source.width;
      const startY = source.top + source.height / 2;
      const endX = target.left;
      const endY = target.top + target.height / 2;
      const curve = Math.max(80, Math.abs(endX - startX) * 0.45);
      return {
        id: edge.id,
        path: `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`,
      };
    })
    .filter((value): value is { id: string; path: string } => Boolean(value));

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 overflow-visible">
      <defs>
        <marker id="data-flow-arrow" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#b0a597" />
        </marker>
        <marker id="data-flow-arrow-active" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#d78233" />
        </marker>
      </defs>
      {paths.map((item) => {
        const active = activeEdgeIds.has(item.id);
        return (
          <path
            key={item.id}
            d={item.path}
            fill="none"
            stroke={active ? "#d78233" : "#cfc7bd"}
            strokeWidth={active ? 2.5 : 1.5}
            strokeOpacity={dimmed && !active ? 0.24 : 1}
            markerEnd={active ? "url(#data-flow-arrow-active)" : "url(#data-flow-arrow)"}
          />
        );
      })}
    </svg>
  );
}

function FloatingInspector({
  obraId,
  node,
  anchor,
  nodeById,
  onClose,
  onNavigate,
  onOpenTable,
}: {
  obraId: string;
  node: DataFlowNode | null;
  anchor: HTMLElement | null;
  nodeById: Map<string, DataFlowNode>;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  onOpenTable: (tableId: string) => void;
}) {
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!anchor || !node) return;

    const compute = () => {
      const rect = anchor.getBoundingClientRect();
      const width = ref.current?.offsetWidth ?? 360;
      const height = ref.current?.offsetHeight ?? 420;
      const margin = 16;
      let left = rect.right + 14;
      if (left + width > window.innerWidth - margin) {
        left = rect.left - width - 14;
      }
      left = Math.max(margin, Math.min(window.innerWidth - width - margin, left));

      let top = rect.top + rect.height / 2 - height / 2;
      top = Math.max(margin, Math.min(window.innerHeight - height - margin, top));
      setPosition({ left, top });
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [anchor, node]);

  if (!node || !anchor) return null;

  const meta = nodeTypeMeta(node.type);
  const Icon = meta.icon;

  const upstream = node.type === "view"
    ? [
        ...formatStringList(node.data.consumedCalculationIds),
        ...formatStringList(node.data.consumedMacroTableIds).map((id) => `macro:${id}`),
      ]
    : node.type === "macro_table"
      ? formatStringList(node.data.sourceTableIds).map((id) => `table:${id}`)
      : node.type === "calculation"
        ? formatStringList(node.data.inputTableIds).map((id) => `table:${id}`)
        : [];

  const viewActions =
    node.type === "view" ? (
      <Button variant="outline" size="sm" asChild>
        <Link href={String(node.data.route ?? "#")}>
          Abrir vista
          <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </Link>
      </Button>
    ) : null;

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-[360px] rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(28,25,23,0.18)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", meta.tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">{meta.label}</p>
            <Badge className={cn("border text-[10px]", supportTone(node.supportStatus))}>{supportLabel(node.supportStatus)}</Badge>
          </div>
          <p className="mt-1 text-base font-semibold text-stone-950">{node.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="max-h-[70vh]">
        <div className="space-y-4 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={cn("border text-[10px]", statusTone(node.status))}>{nodeStatusLabel(node.status)}</Badge>
            {node.type === "view" ? (
              <Badge className="border border-[#f6c18b] bg-[#fff1e2] text-[#9c5511]">Resultado</Badge>
            ) : null}
          </div>

          {node.type === "table" ? (
            <>
              <InspectorMetricGrid
                items={[
                  { label: "Filas", value: formatNumber(node.data.rowCount) },
                  { label: "Columnas", value: formatNumber(node.data.columnCount) },
                ]}
              />
              <InspectorSection title="Origen documental">
                <div className="flex flex-wrap gap-2">
                  {formatStringList(node.data.sourceFolderLabels).length > 0 ? (
                    formatStringList(node.data.sourceFolderLabels).map((label) => (
                      <Badge key={label} className="border border-stone-200 bg-stone-100 text-stone-700">
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-stone-500">Sin carpeta OCR declarada.</p>
                  )}
                </div>
              </InspectorSection>
              <InspectorSection title="Columnas detectadas">
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(node.data.columns) && node.data.columns.length > 0 ? (
                    (node.data.columns as Array<{ fieldKey: string; label: string }>).slice(0, 12).map((column) => (
                      <Badge key={`${column.fieldKey}:${column.label}`} className="border border-stone-200 bg-white text-stone-700">
                        {column.label}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-stone-500">No hay columnas cargadas.</p>
                  )}
                </div>
              </InspectorSection>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenTable(String(node.data.tableId ?? ""))}>
                  Ver filas y documentos
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/excel/${obraId}?tab=documentos`}>
                    Ir a Documentos
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </>
          ) : null}

          {node.type === "macro_table" ? (
            <>
              <InspectorMetricGrid
                items={[
                  { label: "Fuentes", value: formatNumber(node.data.sourceCount) },
                  { label: "Columnas", value: formatNumber(node.data.columnCount) },
                ]}
              />
              <InspectorSection title="Tablas fuente">
                <div className="flex flex-wrap gap-2">
                  {formatStringList(node.data.sourceTableIds).map((tableId) => {
                    const sourceNode = nodeById.get(`table:${tableId}`);
                    return (
                      <button
                        key={tableId}
                        type="button"
                        className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-700 transition hover:border-[#d78233] hover:bg-[#fff4e9]"
                        onClick={() => onNavigate(`table:${tableId}`)}
                      >
                        {sourceNode?.label ?? tableId}
                      </button>
                    );
                  })}
                </div>
              </InspectorSection>
              <InspectorSection title="Configuracion">
                <pre className="overflow-auto rounded-2xl bg-stone-50 p-3 text-[11px] leading-5 text-stone-600">
                  {JSON.stringify(node.data.settings ?? {}, null, 2)}
                </pre>
              </InspectorSection>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/macro?macroId=${encodeURIComponent(String(node.data.macroTableId ?? ""))}`}>
                    Ir a macrotabla
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </>
          ) : null}

          {node.type === "calculation" ? (
            <>
              <InspectorMetricGrid
                items={[
                  { label: "Inputs", value: String(formatStringList(node.data.inputTableIds).length) },
                  { label: "Hallazgos", value: formatNumber(node.data.openFindingCount) },
                ]}
              />
              <InspectorSection title="Tipo y frecuencia">
                <p className="text-sm text-stone-700">
                  {String(node.data.calculationType ?? "-")} · {String(node.data.frequency ?? "-")}
                </p>
              </InspectorSection>
              <InspectorSection title="Columnas usadas">
                <div className="flex flex-wrap gap-2">
                  {formatStringList(node.data.inputColumnKeys).length > 0 ? (
                    formatStringList(node.data.inputColumnKeys).map((columnKey) => (
                      <Badge key={columnKey} className="border border-stone-200 bg-white text-stone-700">
                        {columnKey}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-stone-500">No hay columnas configuradas.</p>
                  )}
                </div>
              </InspectorSection>
              <InspectorSection title="Inputs">
                <div className="flex flex-wrap gap-2">
                  {formatStringList(node.data.inputTableIds).map((tableId) => {
                    const sourceNode = nodeById.get(`table:${tableId}`);
                    return (
                      <button
                        key={tableId}
                        type="button"
                        className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-700 transition hover:border-[#d78233] hover:bg-[#fff4e9]"
                        onClick={() => onNavigate(`table:${tableId}`)}
                      >
                        {sourceNode?.label ?? tableId}
                      </button>
                    );
                  })}
                </div>
              </InspectorSection>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                {Boolean(node.data.requiredConfigured)
                  ? "La configuracion minima existe y este calculo puede proyectarse con inputs reales."
                  : "Todavia faltan inputs o columnas para considerarlo completamente cableado."}
              </div>
            </>
          ) : null}

          {node.type === "view" ? (
            <>
              <InspectorSection title="Ubicacion">
                <p className="text-sm text-stone-700">{String(node.data.location ?? "-")}</p>
              </InspectorSection>
              <InspectorSection title="Metricas visibles">
                <div className="flex flex-wrap gap-2">
                  {formatStringList(node.data.displayedMetrics).map((metric) => (
                    <Badge key={metric} className="border border-stone-200 bg-white text-stone-700">
                      {metric}
                    </Badge>
                  ))}
                </div>
              </InspectorSection>
              <InspectorSection title="Dependencias upstream">
                <div className="flex flex-wrap gap-2">
                  {upstream.map((id) => {
                    const upstreamNode = nodeById.get(id);
                    if (!upstreamNode) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-700 transition hover:border-[#d78233] hover:bg-[#fff4e9]"
                        onClick={() => onNavigate(id)}
                      >
                        {upstreamNode.label}
                      </button>
                    );
                  })}
                </div>
              </InspectorSection>
              <div className="rounded-2xl border border-[#f6c18b] bg-[#fff7ef] p-3 text-sm text-[#9c5511]">
                {String(node.data.projectedReason ?? "Vista projected a partir de consumers reales.")}
              </div>
              <div className="flex flex-wrap gap-2">{viewActions}</div>
            </>
          ) : null}

          {upstream.length > 0 && node.type !== "view" ? (
            <InspectorSection title="Navegacion relacionada">
              <div className="flex flex-wrap gap-2">
                {upstream.map((id) => {
                  const relatedNode = nodeById.get(id);
                  if (!relatedNode) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-700 transition hover:border-[#d78233] hover:bg-[#fff4e9]"
                      onClick={() => onNavigate(id)}
                    >
                      {relatedNode.label}
                    </button>
                  );
                })}
              </div>
            </InspectorSection>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{title}</p>
      {children}
    </div>
  );
}

function InspectorMetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-stone-50 px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{item.label}</p>
          <p className="mt-1 text-lg font-semibold text-stone-950">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function TableDrilldown({
  obraId,
  tableNode,
  open,
  onOpenChange,
  onSelectDocument,
}: {
  obraId: string;
  tableNode: DataFlowNode | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSelectDocument: (payload: SelectedDocument) => void;
}) {
  const [rows, setRows] = useState<TableRowRecord[]>([]);
  const [documents, setDocuments] = useState<TableDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !tableNode) return;
    let cancelled = false;
    const tableId = String(tableNode.data.tableId ?? "");

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [rowsResponse, docsResponse] = await Promise.all([
          fetch(`/api/obras/${obraId}/tablas/${tableId}/rows?page=1&limit=25`, { cache: "no-store" }),
          fetch(`/api/obras/${obraId}/tablas/${tableId}/documents`, { cache: "no-store" }),
        ]);

        const rowsPayload = await rowsResponse.json().catch(() => ({}));
        const docsPayload = await docsResponse.json().catch(() => ({}));

        if (!rowsResponse.ok) {
          throw new Error(typeof rowsPayload?.error === "string" ? rowsPayload.error : "No se pudieron leer las filas.");
        }
        if (!docsResponse.ok) {
          throw new Error(typeof docsPayload?.error === "string" ? docsPayload.error : "No se pudieron leer los documentos.");
        }

        if (cancelled) return;
        setRows(Array.isArray(rowsPayload.rows) ? (rowsPayload.rows as TableRowRecord[]) : []);
        setDocuments(Array.isArray(docsPayload.documents) ? (docsPayload.documents as TableDocumentRecord[]) : []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error cargando el detalle de la tabla.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [obraId, open, tableNode]);

  const rowColumns = useMemo(() => {
    if (!tableNode) return [] as Array<{ key: string; label: string }>;
    if (Array.isArray(tableNode.data.columns) && tableNode.data.columns.length > 0) {
      return (tableNode.data.columns as Array<{ fieldKey: string; label: string }>).map((column) => ({
        key: column.fieldKey,
        label: column.label,
      }));
    }
    const keys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.data ?? {})) {
        if (!key.startsWith("__")) keys.add(key);
      }
    }
    return [...keys].slice(0, 8).map((key) => ({ key, label: key }));
  }, [rows, tableNode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(920px,96vw)] border-l border-stone-200 bg-[#faf8f3] p-0 sm:max-w-none">
        <SheetHeader className="border-b border-stone-200 bg-white px-6 py-5">
          <SheetTitle className="text-xl font-semibold text-stone-950">
            {tableNode?.label ?? "Detalle de tabla"}
          </SheetTitle>
          <SheetDescription>
            Filas y documentos reales vinculados a esta tabla dentro de la obra.
          </SheetDescription>
        </SheetHeader>

        <div className="grid h-full grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="min-w-0 border-r border-stone-200 bg-[#faf8f3]">
            <ScrollArea className="h-[calc(100vh-88px)] px-6 py-6">
              {loading ? (
                <div className="rounded-3xl border border-stone-200 bg-white px-6 py-10 text-center text-sm text-stone-500 shadow-sm">
                  <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                  Cargando detalle de tabla...
                </div>
              ) : error ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 shadow-sm">
                  {error}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-3 md:grid-cols-4">
                    <SummaryCard label="Filas visibles" value={String(rows.length)} detail="Primeras filas cargadas para drilldown." />
                    <SummaryCard label="Documentos" value={String(documents.length)} detail="Procesamientos OCR vinculados a la tabla." />
                    <SummaryCard
                      label="Lineage"
                      value={String(rows.filter((row) => Boolean(row.lineage_row_key)).length)}
                      detail="Filas con identidad estable disponible."
                    />
                    <SummaryCard
                      label="Versiones"
                      value={String(rows.reduce((max, row) => Math.max(max, row.materialization_version ?? 0), 0))}
                      detail="Mayor materialization_version observado."
                    />
                  </div>

                  <div className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">Filas reales</p>
                        <p className="text-xs text-stone-500">Preview del dataset actual de la tabla.</p>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {rowColumns.map((column) => (
                            <TableHead key={column.key}>{column.label}</TableHead>
                          ))}
                          <TableHead>Version</TableHead>
                          <TableHead>Lineage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length > 0 ? (
                          rows.map((row) => (
                            <TableRow key={row.id}>
                              {rowColumns.map((column) => (
                                <TableCell key={`${row.id}:${column.key}`}>{summarizeValue(row.data?.[column.key])}</TableCell>
                              ))}
                              <TableCell>{row.materialization_version ?? "-"}</TableCell>
                              <TableCell className="max-w-[180px] truncate">{row.lineage_row_key ?? "-"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={rowColumns.length + 2} className="py-8 text-center text-stone-500">
                              No hay filas visibles para esta tabla.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="min-w-0 bg-white">
            <ScrollArea className="h-[calc(100vh-88px)] px-6 py-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-stone-950">Documentos vinculados</p>
                  <p className="mt-1 text-xs text-stone-500">Cada documento abre su preview desde storage si el blob sigue disponible.</p>
                </div>
                {documents.length > 0 ? (
                  documents.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => onSelectDocument({ tableLabel: tableNode?.label ?? "Tabla", document })}
                      className="w-full rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-left transition hover:border-stone-300 hover:bg-stone-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-950">
                            {document.source_file_name ?? document.source_path ?? document.id}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">{document.source_path ?? "Sin path"}</p>
                        </div>
                        <Badge className="border border-stone-200 bg-white text-stone-700">
                          {document.status ?? "sin estado"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-500">
                        <span>{formatDateLabel(document.processed_at ?? document.created_at)}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-stone-700">
                          <Eye className="h-3.5 w-3.5" />
                          Abrir
                        </span>
                      </div>
                      {document.error_code ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {document.error_code}
                        </div>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-500">
                    Sin documentos listados para esta tabla.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DocumentPreview({
  obraId,
  selected,
  onOpenChange,
}: {
  obraId: string;
  selected: SelectedDocument | null;
  onOpenChange: (next: boolean) => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sourcePath = selected?.document.source_path ?? null;
    if (!sourcePath) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    const resolvedSourcePath: string = sourcePath;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/obras/${obraId}/documents/access?path=${encodeURIComponent(resolvedSourcePath)}`,
          { cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof payload?.error === "string" ? payload.error : "No se pudo abrir el documento.");
        }
        if (!cancelled) {
          setSignedUrl(typeof payload?.signedUrl === "string" ? payload.signedUrl : null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo abrir el documento.");
          setSignedUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [obraId, selected]);

  const path = selected?.document.source_path ?? "";
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(extension);
  const isPdf = extension === "pdf";

  return (
    <Dialog open={Boolean(selected)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1040px,96vw)] overflow-hidden rounded-[28px] border-stone-200 bg-white p-0" showCloseButton={false}>
        <DialogHeader className="border-b border-stone-200 px-6 py-5">
          <DialogTitle className="text-xl font-semibold text-stone-950">
            {selected?.document.source_file_name ?? selected?.document.source_path ?? "Documento"}
          </DialogTitle>
          <DialogDescription>
            {selected ? `${selected.tableLabel} · ${selected.document.source_path ?? "Sin path"}` : "Preview de documento"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="min-h-[70vh] bg-stone-100 p-5">
            <div className="flex h-full min-h-[60vh] items-center justify-center rounded-[24px] border border-stone-200 bg-white shadow-sm">
              {loading ? (
                <div className="text-center text-sm text-stone-500">
                  <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                  Generando acceso al documento...
                </div>
              ) : error ? (
                <div className="max-w-md rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-center text-sm text-red-700">
                  {error}
                </div>
              ) : signedUrl ? (
                isImage ? (
                  <img src={signedUrl} alt={selected?.document.source_file_name ?? "Documento"} className="max-h-[64vh] max-w-full object-contain" />
                ) : isPdf ? (
                  <iframe title={selected?.document.source_file_name ?? "Documento"} src={signedUrl} className="h-[64vh] w-full rounded-[20px]" />
                ) : (
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-stone-400" />
                    <p className="mt-4 text-sm text-stone-600">El archivo no tiene preview embebido en este corte.</p>
                    <Button className="mt-4" asChild>
                      <a href={signedUrl} target="_blank" rel="noreferrer">
                        Abrir documento
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-sm text-stone-500">No hay preview disponible.</div>
              )}
            </div>
          </div>

          <div className="border-l border-stone-200 bg-[#faf8f3] px-5 py-5">
            <div className="space-y-4">
              <InspectorSection title="Metadata">
                <div className="space-y-2 text-sm text-stone-700">
                  <p><span className="font-medium text-stone-900">Estado:</span> {selected?.document.status ?? "-"}</p>
                  <p><span className="font-medium text-stone-900">Filas extraidas:</span> {selected?.document.rows_extracted ?? "-"}</p>
                  <p><span className="font-medium text-stone-900">Procesado:</span> {formatDateLabel(selected?.document.processed_at ?? selected?.document.created_at)}</p>
                </div>
              </InspectorSection>
              {selected?.document.error_code ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  <p className="font-semibold">{selected.document.error_code}</p>
                  {selected.document.error_message ? <p className="mt-1">{selected.document.error_message}</p> : null}
                </div>
              ) : null}
              {signedUrl ? (
                <Button variant="outline" asChild>
                  <a href={`${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=1`} target="_blank" rel="noreferrer">
                    Abrir en nueva ventana
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ObraDataFlowPage() {
  const params = useParams<{ obraId: string }>();
  const obraId = typeof params?.obraId === "string" ? params.obraId : "";

  const [payload, setPayload] = useState<DataFlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [graphMode, setGraphMode] = useState<GraphMode>("simplified");
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("system");
  const [focusViewId, setFocusViewId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorAnchor, setInspectorAnchor] = useState<HTMLElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [drilldownTableId, setDrilldownTableId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [positions, setPositions] = useState<Map<string, LayoutRect>>(new Map());

  useEffect(() => {
    if (!obraId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/obras/${obraId}/data-flow-graph`, { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof result?.error === "string" ? result.error : "No se pudo cargar el flujo de datos.");
        }
        if (cancelled) return;
        const typed = result as DataFlowPayload;
        setPayload(typed);

        const firstView = typed.nodes.find((node) => node.type === "view")?.id ?? null;
        setFocusViewId((current) => current && typed.nodes.some((node) => node.id === current) ? current : firstView);
        setSelectedNodeId((current) => current && typed.nodes.some((node) => node.id === current) ? current : firstView ?? typed.nodes[0]?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error cargando el flujo de datos.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [obraId, refreshToken]);

  const allNodes = payload?.nodes ?? [];
  const allEdges = payload?.edges ?? [];
  const viewNodes = useMemo(() => allNodes.filter((node) => node.type === "view"), [allNodes]);

  const visibleTypes = useMemo(
    () =>
      graphMode === "simplified"
        ? (["table", "macro_table", "view"] as DataFlowNode["type"][])
        : (["table", "macro_table", "calculation", "view"] as DataFlowNode["type"][]),
    [graphMode]
  );

  const visibleNodeIds = useMemo(
    () => buildVisibleSet({ mode: canvasMode, focusViewId, nodes: allNodes, edges: allEdges }),
    [allEdges, allNodes, canvasMode, focusViewId]
  );

  const filteredNodes = useMemo(
    () => allNodes.filter((node) => visibleNodeIds.has(node.id) && visibleTypes.includes(node.type)),
    [allNodes, visibleNodeIds, visibleTypes]
  );
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);

  const filteredEdges = useMemo(
    () => allEdges.filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)),
    [allEdges, filteredNodeIds]
  );

  const nodeById = useMemo(() => new Map(filteredNodes.map((node) => [node.id, node])), [filteredNodes]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? allNodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const hoverNode = hover ? nodeById.get(hover.nodeId) ?? allNodes.find((node) => node.id === hover.nodeId) ?? null : null;

  useEffect(() => {
    if (!selectedNodeId) return;
    const exists = allNodes.some((node) => node.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(focusViewId ?? filteredNodes[0]?.id ?? null);
      setInspectorAnchor(null);
    }
  }, [allNodes, filteredNodes, focusViewId, selectedNodeId]);

  const connectedNodeIds = useMemo(
    () =>
      canvasMode === "result" && selectedNodeId === focusViewId
        ? new Set(filteredNodes.map((node) => node.id))
        : buildConnectedSet(selectedNodeId, filteredEdges),
    [canvasMode, filteredEdges, filteredNodes, focusViewId, selectedNodeId]
  );

  const activeEdgeIds = useMemo(
    () =>
      new Set(
        filteredEdges
          .filter((edge) => connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target))
          .map((edge) => edge.id)
      ),
    [connectedNodeIds, filteredEdges]
  );

  const canvasNodes = useMemo(
    () => filteredNodes.filter((node) => node.type !== "view"),
    [filteredNodes]
  );

  const tableNodes = useMemo(
    () => canvasNodes.filter((node) => node.type === "table"),
    [canvasNodes]
  );
  const transformNodes = useMemo(
    () => canvasNodes.filter((node) => node.type === "calculation" || node.type === "macro_table"),
    [canvasNodes]
  );

  const canvasEdges = useMemo(
    () => filteredEdges.filter((edge) => edge.type === "table_to_macro_table" || edge.type === "table_to_calculation"),
    [filteredEdges]
  );

  useEffect(() => {
    const measure = () => {
      const container = canvasRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next = new Map<string, LayoutRect>();
      for (const [id, element] of nodeRefs.current.entries()) {
        if (!container.contains(element)) continue;
        const rect = element.getBoundingClientRect();
        next.set(id, {
          left: rect.left - containerRect.left + container.scrollLeft,
          top: rect.top - containerRect.top + container.scrollTop,
          width: rect.width,
          height: rect.height,
        });
      }
      setPositions(next);
    };

    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    const container = canvasRef.current;
    container?.addEventListener("scroll", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      container?.removeEventListener("scroll", measure);
    };
  }, [canvasEdges, canvasNodes, graphMode, canvasMode, refreshToken, selectedNodeId]);

  const diagnostics = payload?.diagnostics?.reportingProjectionErrors ?? [];

  const tableDrilldownNode =
    drilldownTableId && filteredNodeIds.has(drilldownTableId)
      ? nodeById.get(drilldownTableId) ?? null
      : drilldownTableId
        ? allNodes.find((node) => node.id === drilldownTableId) ?? null
        : null;

  function registerNode(id: string, element: HTMLElement | null) {
    if (!element) {
      nodeRefs.current.delete(id);
      return;
    }
    nodeRefs.current.set(id, element);
  }

  function handleResultClick(node: DataFlowNode, event: MouseEvent<HTMLButtonElement>) {
    setFocusViewId(node.id);
    setCanvasMode("result");
    setSelectedNodeId(node.id);
    setInspectorAnchor(event.currentTarget);
  }

  function handleNodeClick(node: DataFlowNode, event: MouseEvent<HTMLButtonElement>) {
    setSelectedNodeId(node.id);
    setInspectorAnchor(event.currentTarget);
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[34px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(28,25,23,0.08)]">
          <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#fffdf9_0%,#f9f6ef_100%)] px-6 py-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                  <span>Obras</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>{payload?.obra.label ?? "Cargando obra"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="font-medium text-stone-700">Trazabilidad</span>
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
                    Trazabilidad de resultados
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                    Segui como las tablas reales de la obra alimentan calculos projected, macrotablas y vistas finales. El grafo usa datos reales donde existen y marca explicitamente lo projected.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-2xl border border-stone-200 bg-stone-50 p-1">
                  <Button
                    variant={canvasMode === "system" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => setCanvasMode("system")}
                  >
                    Ver todo el sistema
                  </Button>
                  <Button
                    variant={canvasMode === "result" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => {
                      setCanvasMode("result");
                      if (!focusViewId && viewNodes[0]) setFocusViewId(viewNodes[0].id);
                    }}
                  >
                    Ver por resultado
                  </Button>
                </div>
                <div className="inline-flex rounded-2xl border border-stone-200 bg-stone-50 p-1">
                  <Button
                    variant={graphMode === "simplified" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => setGraphMode("simplified")}
                  >
                    Simplificado
                  </Button>
                  <Button
                    variant={graphMode === "complete" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => setGraphMode("complete")}
                  >
                    Completo
                  </Button>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/excel/${obraId}`}>Volver a la obra</Link>
                </Button>
                <Button variant="outline" onClick={() => setRefreshToken((current) => current + 1)} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  Actualizar
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-stone-200 bg-[#fbfaf6] px-6 py-5 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Tablas" value={String(payload?.summary.tables ?? 0)} detail="Datasets base disponibles en la obra." />
            <SummaryCard label="Macrotablas" value={String(payload?.summary.macroTables ?? 0)} detail="Consolidaciones reales conectadas." />
            <SummaryCard label="Calculos" value={String(payload?.summary.calculations ?? 0)} detail="Projection layer del motor de reporting." />
            <SummaryCard label="Vistas" value={String(payload?.summary.views ?? 0)} detail="Resultados o pantallas consumidoras visibles." />
            <SummaryCard label="Edges" value={String(payload?.summary.edges ?? 0)} detail="Relaciones activas expuestas en el grafo." />
          </div>

          <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-stone-200 bg-[#faf8f3] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">Resultados y vistas finales</p>
                    <p className="text-xs text-stone-500">Usalos como entrada para enfocar el flujo hacia atras.</p>
                  </div>
                  <Badge className="border border-stone-200 bg-white text-stone-700">
                    {canvasMode === "system" ? "Sin foco" : "Trazando resultado"}
                  </Badge>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {viewNodes.length > 0 ? (
                    viewNodes.map((node) => (
                      <ResultChip
                        key={node.id}
                        node={node}
                        active={focusViewId === node.id && canvasMode === "result"}
                        onClick={(event) => handleResultClick(node, event)}
                        onHover={(event) => setHover({ nodeId: node.id, x: event.clientX, y: event.clientY })}
                        onLeave={() => setHover((current) => (current?.nodeId === node.id ? null : current))}
                      />
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-5 py-6 text-sm text-stone-500">
                      No hay vistas projected disponibles en este corte.
                    </div>
                  )}
                </div>
              </div>

              {diagnostics.length > 0 ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">La capa projected se degrado en esta carga.</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {diagnostics.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[30px] border border-stone-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">Canvas de trazabilidad</p>
                    <p className="text-xs text-stone-500">
                      {graphMode === "simplified"
                        ? "Modo simplificado: tablas y macrotablas reales."
                        : "Modo completo: suma calculos projected junto con las agregaciones reales."}
                    </p>
                  </div>
                  {canvasMode === "result" && focusViewId ? (
                    <div className="rounded-full border border-[#f6c18b] bg-[#fff4e8] px-4 py-2 text-xs font-medium text-[#9c5511]">
                      Trazando · {viewNodes.find((node) => node.id === focusViewId)?.label ?? "Resultado"}
                    </div>
                  ) : (
                    <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-600">
                      Sin foco. Explora el sistema completo.
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="rounded-[26px] border border-stone-200 bg-[#faf8f3] px-6 py-14 text-center text-sm text-stone-500">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                    Cargando trazabilidad...
                  </div>
                ) : error ? (
                  <div className="rounded-[26px] border border-red-200 bg-red-50 px-6 py-6 text-sm text-red-700">
                    {error}
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-[28px] border border-stone-200 bg-[#faf8f3]">
                    <div ref={canvasRef} className="relative overflow-x-auto px-6 py-6">
                      <div className="relative flex min-w-[920px] items-start gap-16">
                        <div className="z-10 w-[320px] shrink-0">
                          <div className="mb-4 flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-stone-900" />
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Tablas</p>
                          </div>
                          <div className="space-y-4">
                            {tableNodes.length > 0 ? (
                              tableNodes.map((node) => (
                                <CanvasNodeCard
                                  key={node.id}
                                  node={node}
                                  selected={selectedNodeId === node.id}
                                  highlighted={connectedNodeIds.has(node.id)}
                                  dimmed={Boolean(selectedNodeId) && connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id)}
                                  onClick={(event) => handleNodeClick(node, event)}
                                  onHover={(event) => setHover({ nodeId: node.id, x: event.clientX, y: event.clientY })}
                                  onLeave={() => setHover((current) => (current?.nodeId === node.id ? null : current))}
                                  register={(element) => registerNode(node.id, element)}
                                />
                              ))
                            ) : (
                              <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
                                No hay tablas visibles en este foco.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="z-10 w-[320px] shrink-0">
                          <div className="mb-4 flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-[#f08c32]" />
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                              {graphMode === "complete" ? "Transformaciones y agregaciones" : "Agregaciones"}
                            </p>
                          </div>
                          <div className="space-y-4">
                            {transformNodes.length > 0 ? (
                              transformNodes.map((node) => (
                                <CanvasNodeCard
                                  key={node.id}
                                  node={node}
                                  selected={selectedNodeId === node.id}
                                  highlighted={connectedNodeIds.has(node.id)}
                                  dimmed={Boolean(selectedNodeId) && connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id)}
                                  onClick={(event) => handleNodeClick(node, event)}
                                  onHover={(event) => setHover({ nodeId: node.id, x: event.clientX, y: event.clientY })}
                                  onLeave={() => setHover((current) => (current?.nodeId === node.id ? null : current))}
                                  register={(element) => registerNode(node.id, element)}
                                />
                              ))
                            ) : (
                              <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
                                No hay transformaciones visibles en este foco.
                              </div>
                            )}
                          </div>
                        </div>

                        <FlowEdges
                          edges={canvasEdges}
                          positions={positions}
                          activeEdgeIds={activeEdgeIds}
                          dimmed={Boolean(selectedNodeId)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-stone-950">Cobertura del corte</p>
                <p className="mt-1 text-xs text-stone-500">
                  Lo real y lo projected se mantienen separados para que el mapa siga honesto.
                </p>
                <div className="mt-4 space-y-3">
                  {payload?.coverage.items.map((item) => (
                    <CoverageBadge key={item.id} item={item} />
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-stone-950">Inspector rapido</p>
                <p className="mt-1 text-xs text-stone-500">
                  Click en un nodo o resultado para abrir el inspector flotante junto al punto elegido.
                </p>
                <Separator className="my-4" />
                {selectedNode ? (
                  <div className="space-y-3 text-sm text-stone-600">
                    <div>
                      <p className="font-medium text-stone-950">{selectedNode.label}</p>
                      <p className="text-xs text-stone-500">{nodeTypeMeta(selectedNode.type).label}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("border text-[10px]", statusTone(selectedNode.status))}>{nodeStatusLabel(selectedNode.status)}</Badge>
                      <Badge className={cn("border text-[10px]", supportTone(selectedNode.supportStatus))}>{supportLabel(selectedNode.supportStatus)}</Badge>
                    </div>
                    <p>
                      Flujo resaltado:{" "}
                      <span className="font-medium text-stone-900">{Math.max(0, connectedNodeIds.size - 1)} nodo(s)</span>
                    </p>
                    <p className="text-xs text-stone-500">
                      El detalle completo se abre como popover anclado al nodo seleccionado.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">Selecciona un nodo o una vista para inspeccionar su trazabilidad.</p>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>

      <HoverPreview node={hoverNode} hover={hover} />

      <FloatingInspector
        obraId={obraId}
        node={selectedNode}
        anchor={inspectorAnchor}
        nodeById={nodeById}
        onClose={() => setInspectorAnchor(null)}
        onNavigate={(nodeId) => {
          setSelectedNodeId(nodeId);
          const nextAnchor = nodeRefs.current.get(nodeId) ?? null;
          setInspectorAnchor(nextAnchor);
          if (nodeId.startsWith("view:")) {
            setFocusViewId(nodeId);
          }
        }}
        onOpenTable={(tableId) => setDrilldownTableId(`table:${tableId}`)}
      />

      <TableDrilldown
        obraId={obraId}
        tableNode={tableDrilldownNode}
        open={Boolean(drilldownTableId)}
        onOpenChange={(next) => {
          if (!next) setDrilldownTableId(null);
        }}
        onSelectDocument={setSelectedDocument}
      />

      <DocumentPreview
        obraId={obraId}
        selected={selectedDocument}
        onOpenChange={(next) => {
          if (!next) setSelectedDocument(null);
        }}
      />
    </div>
  );
}
