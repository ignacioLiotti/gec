"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign as BadgeDollarSignIcon,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Landmark as LandmarkIcon,
  Layers,
  LineChart as LineChartIcon,
  Pencil,
  Loader2,
  Percent as PercentIcon,
  Plus,
  RefreshCcw,
  SlidersHorizontal,
  Sigma,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { GridLayout, type Layout as ReactGridLayoutItems } from "react-grid-layout";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  type Connection,
  type Edge as ReactFlowEdge,
  type EdgeProps,
  type Node as ReactFlowNode,
  type NodeProps,
} from "@xyflow/react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SupportStatus = "implemented" | "partial" | "planned" | "not_supported";
type NodeStatus = "ok" | "incomplete" | "error" | "processing";
type CanvasMode = "system" | "result";

type DataFlowNode = {
  id: string;
  type: "table" | "macro_table" | "obra_field" | "calculation" | "view" | "document";
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
  | "obra_field_to_calculation"
  | "table_to_calculation"
  | "macro_table_to_calculation"
  | "calculation_to_calculation"
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

type SelectedDocument = {
  tableLabel: string;
  document: TableDocumentRecord;
};

type HoverState = {
  nodeId: string;
  x: number;
  y: number;
};

type LayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type DisplayEdge = {
  id: string;
  from: string;
  to: string;
  original: DataFlowEdge | null;
};

type LayerKey = "document" | "table" | "macro_table" | "obra_field" | "calculation" | "view";
type CanvasDirection = "vertical" | "horizontal" | "radial";
type ResultVisualStyle = "card" | "node";
type EdgeVisualStyle = "curve" | "straight" | "dashed" | "dotted";
type ActiveResultColor = "orange" | "stone";
type CalculationNodeVariant = "pill" | "stacked" | "io" | "formula";
type DataFlowEditorTarget = {
  type: "result" | "calculation" | "layout";
  id?: string;
};
type DataFlowEditorAccordionType = "layout" | "result" | "calculation";

type DataFlowFlowNodeData = {
  node: DataFlowNode;
  dimmed: boolean;
  highlighted: boolean;
  flowDirection: CanvasDirection;
  calculationNodeVariant: CalculationNodeVariant;
  calculationInputLabels: string[];
  register: (id: string, element: HTMLButtonElement | null) => void;
  onHover: (nodeId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onLeave: (nodeId: string) => void;
};

type DataFlowFlowNode = ReactFlowNode<DataFlowFlowNodeData, "dataFlow">;
type DataFlowFlowEdgeData = {
  visualStyle: EdgeVisualStyle;
  direction: CanvasDirection;
};

type GraphTweaks = {
  showCalculations: boolean;
  showDocuments: boolean;
};

export type BuilderSourceColumn = {
  key: string;
  label: string;
  dataType: string;
};

export type BuilderSourceType = "table" | "macro_table";
export type BuilderAggregation = "sum" | "avg" | "min" | "max" | "latest" | "count_rows" | "count_non_empty";
export type BuilderFormulaInputSourceType = "calculation" | BuilderSourceType | "obra_field";

export type BuilderObraFieldSource = {
  id: string;
  label: string;
  dataType: string;
};

export type BuilderTableSource = {
  id: string;
  name: string;
  columns: BuilderSourceColumn[];
};

export type BuilderMacroSource = {
  id: string;
  name: string;
  columns: BuilderSourceColumn[];
};

export type BuilderFormulaInput = {
  id: string;
  alias: string;
  sourceType: BuilderFormulaInputSourceType;
  sourceId: string;
  fieldKey: string | null;
  aggregation: BuilderAggregation | null;
};

export type BuilderCalculation =
  | {
    id: string;
    label: string;
    mode: "aggregate";
    description: string;
    sourceType: BuilderSourceType;
    sourceId: string;
    fieldKey: string | null;
    aggregation: BuilderAggregation;
  }
  | {
    id: string;
    label: string;
    mode: "formula";
    description: string;
    expression: string;
    inputs: BuilderFormulaInput[];
  };

export type BuilderResult = {
  id: string;
  label: string;
  description: string;
  calculationId: string | null;
  targetObraFieldId: string | null;
  writebackMode: "none" | "suggest" | "auto";
  format: "number" | "currency" | "percent";
  decimals: number;
  generalTabSlot: "hero" | "financial";
  generalTabOrder: number;
};

export type BuilderGeneralTabLayoutBlockType =
  | "progress"
  | "curve"
  | "general_info"
  | "financial"
  | "configured_fields"
  | "certificates"
  | "custom_result";
export type BuilderGeneralTabLayoutWidth = "one_third" | "half" | "two_thirds" | "full";

export type BuilderGeneralTabLayoutBlock = {
  id: string;
  type: BuilderGeneralTabLayoutBlockType;
  label: string;
  enabled: boolean;
  order: number;
  width: BuilderGeneralTabLayoutWidth;
  gridX?: number;
  gridY?: number;
  gridH?: number;
  resultId: string | null;
  fieldIds: string[];
};

export type BuilderConfig = {
  version: 1;
  calculations: BuilderCalculation[];
  results: BuilderResult[];
  generalTabLayout: BuilderGeneralTabLayoutBlock[];
};

export type EvaluatedBuilderCalculation = {
  id: string;
  label: string;
  status: "ok" | "incomplete" | "error";
  value: number | null;
  formattedValue: string;
  formulaSummary: string[];
  inputs: string[];
  errorMessage: string | null;
};

export type EvaluatedBuilderResult = {
  id: string;
  label: string;
  status: "ok" | "incomplete" | "error";
  value: number | null;
  formattedValue: string;
  description: string;
  calculationId: string | null;
  targetObraFieldId: string | null;
  writebackMode: "none" | "suggest" | "auto";
  writebackStatus: "none" | "ready" | "blocked";
  writebackBlockReason: string | null;
  generalTabSlot: "hero" | "financial";
  generalTabOrder: number;
  format: "number" | "currency" | "percent";
};

export type DataFlowConfigPayload = {
  scope?: "obra" | "tenant";
  config: BuilderConfig;
  inheritedConfig?: BuilderConfig | null;
  effectiveConfig?: BuilderConfig | null;
  sources: {
    tables: BuilderTableSource[];
    macroTables: BuilderMacroSource[];
    obraFields: BuilderObraFieldSource[];
  };
  evaluated?: {
    calculations: EvaluatedBuilderCalculation[];
    results: EvaluatedBuilderResult[];
  } | null;
  generalTabSlots?: Array<{ id: "hero" | "financial"; label: string }>;
  canWrite?: boolean;
  writeback?: string[];
  writebackPlan?: DataFlowWritebackPlan;
  updatedAt?: string | null;
};

type DataFlowWritebackAction = {
  resultId: string;
  resultLabel: string;
  calculationId: string | null;
  targetObraFieldId: string;
  mode: "suggest" | "auto";
  value: number;
  formattedValue: string;
  previousValue: unknown;
  status: "ready" | "blocked";
  blockReason: string | null;
  formulaSummary: string[];
};

type DataFlowWritebackPlan = {
  actions: DataFlowWritebackAction[];
  blocked: DataFlowWritebackAction[];
};

type DataFlowSuggestion = {
  id: string;
  field_id: string;
  result_label: string;
  old_value: unknown;
  suggested_value: unknown;
  formatted_value: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

const BUILDER_DEFAULT_CALCULATION_IDS = new Set([
  "default_contract",
  "default_certified",
  "default_balance",
  "default_progress",
]);

const BUILDER_DEFAULT_RESULT_IDS = new Set([
  "default_result_progress",
  "default_result_contract",
  "default_result_certified",
  "default_result_balance",
]);

const BUILDER_DEFAULT_LAYOUT_IDS = new Set([
  "layout_progress",
  "layout_curve",
  "layout_general_info",
  "layout_financial",
  "layout_configured_fields",
  "layout_certificates",
]);

const GENERAL_LAYOUT_GRID_COLS = 12;
const GENERAL_LAYOUT_ROW_HEIGHT = 58;
const GENERAL_LAYOUT_GRID_GAP = 20;

function layoutWidthToGridColumns(width: BuilderGeneralTabLayoutWidth) {
  switch (width) {
    case "one_third":
      return 4;
    case "half":
      return 6;
    case "two_thirds":
      return 8;
    case "full":
      return 12;
    default:
      return 6;
  }
}

function gridColumnsToLayoutWidth(columns: number): BuilderGeneralTabLayoutWidth {
  if (columns <= 4) return "one_third";
  if (columns <= 6) return "half";
  if (columns <= 9) return "two_thirds";
  return "full";
}

function defaultLayoutGridHeight(type: BuilderGeneralTabLayoutBlockType) {
  if (type === "progress" || type === "curve" || type === "general_info" || type === "financial") return 5;
  if (type === "configured_fields" || type === "certificates") return 4;
  return 3;
}

function getLayoutBlockIcon(type: BuilderGeneralTabLayoutBlockType) {
  if (type === "progress") return PercentIcon;
  if (type === "curve") return LineChartIcon;
  if (type === "general_info") return LandmarkIcon;
  if (type === "financial" || type === "custom_result") return BadgeDollarSignIcon;
  if (type === "configured_fields") return FileText;
  return Database;
}

export const PAGE_THEME = `
:root {
  --df-orange: #ff5800;
  --df-orange-soft: #fff1e8;
  --df-orange-border: #f6c8aa;
  --df-bg: #f8f8f6;
  --df-panel: #ffffff;
  --df-panel-soft: #fafaf8;
  --df-stone-50: #fafaf9;
  --df-stone-100: #f5f5f4;
  --df-stone-200: #e7e5e4;
  --df-stone-300: #d6d3d1;
  --df-stone-400: #a8a29e;
  --df-stone-500: #78716c;
  --df-stone-600: #57534e;
  --df-stone-700: #44403c;
  --df-stone-800: #292524;
  --df-stone-900: #1c1917;
}

@keyframes data-flow-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes data-flow-pop-in {
  from { opacity: 0; transform: scale(.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes data-flow-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.df-layout-grid .react-grid-placeholder {
  background: var(--df-orange) !important;
  border-radius: 12px;
  opacity: .12 !important;
}

.df-layout-grid .react-grid-item.react-draggable-dragging,
.df-layout-grid .react-grid-item.resizing {
  z-index: 20;
}

.df-layout-grid .react-resizable-handle::after {
  border-color: var(--df-orange) !important;
}
`;

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

function formatNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("es-AR") : "0";
}

function formatStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function humanizeFieldKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function getNodeColumnLabel(node: DataFlowNode | null | undefined, fieldKey: string | null | undefined) {
  if (!node || !fieldKey) return fieldKey ? humanizeFieldKey(fieldKey) : "sin columna";
  const columns = Array.isArray(node.data.columns)
    ? node.data.columns.filter(
      (column): column is { fieldKey?: unknown; label?: unknown } =>
        Boolean(column) && typeof column === "object"
    )
    : [];
  const match = columns.find((column) => column.fieldKey === fieldKey);
  if (typeof match?.label === "string" && match.label.trim().length > 0) return match.label;
  return humanizeFieldKey(fieldKey);
}

function formatBuilderAggregationLabel(aggregation: string, sourceLabel: string, fieldLabel?: string | null) {
  switch (aggregation) {
    case "sum":
      return `la suma de ${fieldLabel ?? "los valores"} en ${sourceLabel}`;
    case "avg":
      return `el promedio de ${fieldLabel ?? "los valores"} en ${sourceLabel}`;
    case "min":
      return `el minimo de ${fieldLabel ?? "los valores"} en ${sourceLabel}`;
    case "max":
      return `el maximo de ${fieldLabel ?? "los valores"} en ${sourceLabel}`;
    case "latest":
      return `el ultimo valor de ${fieldLabel ?? "los valores"} en ${sourceLabel}`;
    case "count_rows":
      return `la cantidad de filas de ${sourceLabel}`;
    case "count_non_empty":
      return `la cantidad de valores no vacios de ${fieldLabel ?? "la columna"} en ${sourceLabel}`;
    default:
      return `${aggregation} en ${sourceLabel}`;
  }
}

function describeBuilderReference(
  reference: string,
  upstreamNodes: DataFlowNode[]
) {
  const upstreamById = new Map(upstreamNodes.map((upstream) => [upstream.id, upstream]));
  const obraFieldLabels = new Map<string, string>([
    ["contrato_mas_ampliaciones", "el campo Contrato + ampliaciones de la obra"],
    ["certificado_a_la_fecha", "el campo Certificado a la fecha de la obra"],
    ["saldo_a_certificar", "el campo Saldo a certificar de la obra"],
    ["porcentaje", "el campo Porcentaje de avance de la obra"],
  ]);

  if (reference.startsWith("calculation:")) {
    const calculationId = reference.slice("calculation:".length);
    return upstreamById.get(`calc:custom:${calculationId}`)?.label ?? "otro calculo custom";
  }

  if (reference.startsWith("obra_field:")) {
    const fieldKey = reference.slice("obra_field:".length);
    return obraFieldLabels.get(fieldKey) ?? `el campo ${humanizeFieldKey(fieldKey)} de la obra`;
  }

  const aggregateMatch = reference.match(
    /^(sum|avg|min|max|latest|count_rows|count_non_empty)\((table|macro_table):([^.)]+)(?:\.([^)]+))?\)$/
  );
  if (!aggregateMatch) return reference;

  const [, aggregation, sourceType, sourceId, fieldKey] = aggregateMatch;
  const sourceNodeId = sourceType === "table" ? `table:${sourceId}` : `macro:${sourceId}`;
  const sourceNode = upstreamById.get(sourceNodeId) ?? null;
  const sourceLabel = sourceNode?.label ?? (sourceType === "table" ? "la tabla" : "la macrotabla");
  const fieldLabel = fieldKey ? getNodeColumnLabel(sourceNode, fieldKey) : null;
  return formatBuilderAggregationLabel(aggregation, sourceLabel, fieldLabel);
}

function buildCustomCalculationInspectorCopy(node: DataFlowNode, upstreamNodes: DataFlowNode[]) {
  const mode = typeof node.data.mode === "string" ? node.data.mode : null;
  const rawFormulaSummary = formatStringList(node.data.formulaSummary);
  const expression = rawFormulaSummary[0]?.trim() ?? "";
  const variableLines = rawFormulaSummary.slice(1);
  const variableDescriptions = variableLines
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex < 0) return null;
      const alias = line.slice(0, separatorIndex).trim();
      const reference = line.slice(separatorIndex + 1).trim();
      if (!alias || !reference) return null;
      return {
        alias,
        description: describeBuilderReference(reference, upstreamNodes),
      };
    })
    .filter((item): item is { alias: string; description: string } => Boolean(item));

  const humanizedExpression = (() => {
    if (mode === "aggregate" && expression) {
      return capitalize(describeBuilderReference(expression, upstreamNodes));
    }
    if (!expression) return "No hay una formula declarada.";

    const directVariable = variableDescriptions.find((item) => item.alias === expression);
    if (directVariable) {
      return `Toma directamente ${directVariable.description}.`;
    }

    let readableExpression = expression;
    for (const variable of [...variableDescriptions].sort((left, right) => right.alias.length - left.alias.length)) {
      readableExpression = readableExpression.replaceAll(variable.alias, variable.description);
    }
    return `Calcula ${readableExpression}.`;
  })();

  return {
    resolution:
      mode === "aggregate"
        ? "Este calculo se definio manualmente en el editor de data-flow y agrega datos de una tabla o macrotabla."
        : "Este calculo se definio manualmente en el editor de data-flow y combina inputs configurados para esta obra.",
    humanizedExpression,
    variableDescriptions,
  };
}

function supportLabel(status: SupportStatus) {
  switch (status) {
    case "implemented":
      return "Implementado";
    case "partial":
      return "Parcial";
    case "planned":
      return "Projected";
    case "not_supported":
    default:
      return "No soportado";
  }
}

function statusLabel(status: NodeStatus) {
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

function mapDemoStatus(status: NodeStatus) {
  switch (status) {
    case "ok":
      return { label: "ok", color: "#10b981", text: "OK" };
    case "processing":
      return { label: "processing", color: "#2563eb", text: "Procesando" };
    case "error":
      return { label: "error", color: "#b91c1c", text: "Error" };
    case "incomplete":
    default:
      return { label: "incomplete", color: "#b45309", text: "Incompleto" };
  }
}

function nodeMeta(type: DataFlowNode["type"]) {
  switch (type) {
    case "view":
      return { label: "Resultado", icon: Target, color: "var(--df-orange)" };
    case "calculation":
      return { label: "Calculo", icon: Sigma, color: "#7c3aed" };
    case "obra_field":
      return { label: "Campo de obra", icon: FileText, color: "#0f766e" };
    case "macro_table":
      return { label: "Macrotabla", icon: Layers, color: "#0891b2" };
    case "document":
      return { label: "Documento", icon: FolderOpen, color: "#a16207" };
    case "table":
    default:
      return { label: "Tabla", icon: Database, color: "var(--df-stone-800)" };
  }
}

function getCalculationModeLabel(node: DataFlowNode) {
  const mode = typeof node.data.mode === "string" ? node.data.mode : null;
  if (mode === "aggregate") return "Agregado";
  if (mode === "formula") return "Formula";
  const type = typeof node.data.calculationType === "string" ? node.data.calculationType : "";
  if (type === "aggregation") return "Agregado";
  if (type === "continuity") return "Continuidad";
  if (type === "join") return "Join";
  if (type === "derivation") return "Derivacion";
  return supportLabel(node.supportStatus);
}

function getCalculationFormulaLines(node: DataFlowNode) {
  return formatStringList(node.data.formulaSummary).filter((line) => line.trim().length > 0);
}

function getCalculationOperatorLabel(node: DataFlowNode) {
  const firstLine = getCalculationFormulaLines(node)[0] ?? "";
  const aggregate = firstLine.match(/^([a-z_]+)\(/i)?.[1];
  if (aggregate) {
    const labels: Record<string, string> = {
      sum: "SUM",
      avg: "AVG",
      min: "MIN",
      max: "MAX",
      latest: "ULT",
      count_rows: "COUNT",
      count_non_empty: "COUNT",
    };
    return labels[aggregate] ?? aggregate.toUpperCase();
  }
  return typeof node.data.mode === "string" && node.data.mode === "formula" ? "ƒ" : "Σ";
}

function getCalculationInputLabels(
  node: DataFlowNode,
  nodeById: Map<string, DataFlowNode>
) {
  const inputNodeIds = formatStringList(node.data.inputNodeIds);
  const byNode = inputNodeIds
    .map((id) => nodeById.get(id)?.label)
    .filter((label): label is string => typeof label === "string" && label.trim().length > 0);
  if (byNode.length > 0) return [...new Set(byNode)].slice(0, 4);

  const byTables = formatStringList(node.data.inputTableLabels);
  if (byTables.length > 0) return byTables.slice(0, 4);

  return formatStringList(node.data.inputColumnKeys).slice(0, 4);
}

function getNodeSize(node: DataFlowNode, calculationVariant: CalculationNodeVariant = "pill"): LayoutRect {
  if (node.type === "view") {
    return { x: 0, y: 0, w: 180, h: 74 };
  }
  if (node.type === "calculation") {
    if (calculationVariant === "stacked") return { x: 0, y: 0, w: 238, h: 124 };
    if (calculationVariant === "io") return { x: 0, y: 0, w: 260, h: 118 };
    if (calculationVariant === "formula") return { x: 0, y: 0, w: 254, h: 132 };
    return { x: 0, y: 0, w: 190, h: 86 };
  }
  if (node.type === "obra_field") {
    return { x: 0, y: 0, w: 170, h: 70 };
  }
  if (node.type === "macro_table") {
    return { x: 0, y: 0, w: 180, h: 80 };
  }
  if (node.type === "document") {
    return { x: 0, y: 0, w: 168, h: 74 };
  }
  return { x: 0, y: 0, w: 170, h: 80 };
}

function getLayerKey(node: DataFlowNode): LayerKey {
  if (node.type === "view") return "view";
  if (node.type === "document") return "document";
  if (node.type === "obra_field") return "obra_field";
  return node.type;
}

function getBaseRank(node: DataFlowNode) {
  switch (node.type) {
    case "document":
      return 0;
    case "table":
      return 1;
    case "macro_table":
      return 2;
    case "obra_field":
      return 2;
    case "calculation":
      return 3;
    case "view":
    default:
      return 4;
  }
}

function getLayerSortValue(layerKey: LayerKey) {
  switch (layerKey) {
    case "document":
      return 0;
    case "table":
      return 1;
    case "macro_table":
      return 2;
    case "obra_field":
      return 3;
    case "calculation":
      return 4;
    case "view":
    default:
      return 5;
  }
}

function buildDisplayEdges(edges: DataFlowEdge[]) {
  return edges.map((edge) => ({
    id: edge.id,
    from: edge.source,
    to: edge.target,
    original: edge,
  }));
}

function dedupeDisplayEdges(edges: DisplayEdge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}->${edge.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSyntheticDocumentGraph(nodes: DataFlowNode[]) {
  const documentNodes: DataFlowNode[] = [];
  const documentEdges: DisplayEdge[] = [];

  for (const node of nodes) {
    if (node.type !== "table") continue;

    const labels = [...new Set([
      ...formatStringList(node.data.sourceFolderLabels),
      ...formatStringList(node.data.sourceFolders),
    ])];

    labels.forEach((label, index) => {
      const documentId = `document:${node.id}:${index}`;
      documentNodes.push({
        id: documentId,
        type: "document",
        label,
        status: node.status === "error" ? "error" : node.status === "processing" ? "processing" : "ok",
        supportStatus: "implemented",
        data: {
          synthetic: true,
          tableId: node.data.tableId,
          tableLabel: node.label,
          folderLabel: label,
          folderPath: formatStringList(node.data.sourceFolders)[index] ?? null,
          documentCount: 1,
        },
      });
      documentEdges.push({
        id: `edge:${node.id}:${documentId}`,
        from: documentId,
        to: node.id,
        original: null,
      });
    });
  }

  return { documentNodes, documentEdges };
}

function buildDisplayGraph(
  nodes: DataFlowNode[],
  edges: DataFlowEdge[],
  tweaks: GraphTweaks
) {
  const allViews = nodes.filter((node) => node.type === "view");
  const resultNodes = [...allViews]
    .filter((node) => node.data.hiddenInResultsBar !== true)
    .sort((left, right) => {
      const leftOrder = typeof left.data.resultOrder === "number" ? left.data.resultOrder : Number.MAX_SAFE_INTEGER;
      const rightOrder = typeof right.data.resultOrder === "number" ? right.data.resultOrder : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });

  let displayNodes = [...nodes];
  let displayEdges: DisplayEdge[] = buildDisplayEdges(edges);

  if (!tweaks.showCalculations) {
    const hiddenCalculationIds = new Set(
      nodes.filter((node) => node.type === "calculation").map((node) => node.id)
    );
    const bridgedEdges: DisplayEdge[] = [];

    for (const calculationId of hiddenCalculationIds) {
      const providers = displayEdges.filter((edge) => edge.to === calculationId);
      const consumers = displayEdges.filter((edge) => edge.from === calculationId);

      for (const provider of providers) {
        for (const consumer of consumers) {
          if (provider.from === consumer.to) continue;
          bridgedEdges.push({
            id: `bridge:${provider.from}:${consumer.to}:${calculationId}`,
            from: provider.from,
            to: consumer.to,
            original: null,
          });
        }
      }
    }

    displayNodes = displayNodes.filter((node) => !hiddenCalculationIds.has(node.id));
    displayEdges = dedupeDisplayEdges([
      ...displayEdges.filter(
        (edge) => !hiddenCalculationIds.has(edge.from) && !hiddenCalculationIds.has(edge.to)
      ),
      ...bridgedEdges,
    ]);
  }

  if (tweaks.showDocuments) {
    const { documentNodes, documentEdges } = buildSyntheticDocumentGraph(nodes);
    displayNodes = [...displayNodes, ...documentNodes];
    displayEdges = dedupeDisplayEdges([...displayEdges, ...documentEdges]);
  }

  return {
    nodes: displayNodes,
    edges: displayEdges,
    allViews,
    resultNodes,
  };
}

function buildVisibleSet({
  mode,
  focusViewId,
  nodes,
  displayEdges,
}: {
  mode: CanvasMode;
  focusViewId: string | null;
  nodes: DataFlowNode[];
  displayEdges: DisplayEdge[];
}) {
  const visible = new Set<string>();
  if (mode === "system" || !focusViewId) {
    for (const node of nodes) visible.add(node.id);
    return visible;
  }

  const upstreamById = new Map<string, string[]>();
  for (const edge of displayEdges) {
    const current = upstreamById.get(edge.to) ?? [];
    current.push(edge.from);
    upstreamById.set(edge.to, current);
  }

  const queue = [focusViewId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visible.has(current)) continue;
    visible.add(current);
    for (const next of upstreamById.get(current) ?? []) {
      if (!visible.has(next)) queue.push(next);
    }
  }
  return visible;
}

function buildConnectedSet(selectedNodeId: string | null, edges: DisplayEdge[]) {
  if (!selectedNodeId) return new Set<string>();

  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = adjacency.get(edge.from) ?? new Set<string>();
    from.add(edge.to);
    adjacency.set(edge.from, from);

    const to = adjacency.get(edge.to) ?? new Set<string>();
    to.add(edge.from);
    adjacency.set(edge.to, to);
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

function getActiveColorTokens(color: ActiveResultColor) {
  return color === "stone"
    ? {
      solid: "var(--df-stone-900)",
      soft: "var(--df-stone-100)",
      border: "var(--df-stone-300)",
      text: "var(--df-stone-700)",
      shadow: "rgba(28,25,23,.22)",
    }
    : {
      solid: "var(--df-orange)",
      soft: "var(--df-orange-soft)",
      border: "var(--df-orange-border)",
      text: "#9a4c08",
      shadow: "rgba(255,88,0,.22)",
    };
}

function edgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  style: EdgeVisualStyle,
  direction: CanvasDirection
) {
  if (style === "straight" || style === "dashed" || style === "dotted") {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  if (direction === "horizontal") {
    const dx = (to.x - from.x) / 2;
    return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
  }

  if (direction === "radial") {
    const dx = (to.x - from.x) * 0.45;
    const dy = (to.y - from.y) * 0.45;
    return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y + dy}, ${to.x - dx} ${to.y - dy}, ${to.x} ${to.y}`;
  }

  const dy = (to.y - from.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`;
}

function chipValue(node: DataFlowNode) {
  if (typeof node.data.resultValue === "string" && node.data.resultValue.trim().length > 0) {
    return node.data.resultValue;
  }
  const calcCount = formatStringList(node.data.consumedCalculationIds).length;
  const macroCount = formatStringList(node.data.consumedMacroTableIds).length;
  return String(calcCount + macroCount);
}

function isGenericTenantPlaceholder(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "general" || normalized === "campo general";
}

function shortDetail(node: DataFlowNode) {
  if (node.type === "table") {
    return `${formatNumber(node.data.rowCount)} filas · ${formatNumber(node.data.columnCount)} cols`;
  }
  if (node.type === "macro_table") {
    return `${formatNumber(node.data.sourceCount)} fuentes · ${formatNumber(node.data.columnCount)} cols`;
  }
  if (node.type === "calculation") {
    return `${formatStringList(node.data.inputTableIds).length} inputs · ${formatNumber(node.data.openFindingCount)} hallazgos`;
  }
  if (node.type === "obra_field") {
    return String(node.data.valueFormatted ?? node.data.fieldKey ?? "Campo de obra");
  }
  return formatStringList(node.data.displayedMetrics).join(" · ");
}

function calculationValueText(node: DataFlowNode) {
  if (node.data.hideCalculationValue === true) return null;
  if (typeof node.data.valueFormatted === "string" && node.data.valueFormatted.trim().length > 0) {
    return isGenericTenantPlaceholder(node.data.valueFormatted) ? null : node.data.valueFormatted;
  }
  if (typeof node.data.value === "number" && Number.isFinite(node.data.value)) {
    return formatNumber(node.data.value);
  }
  if (typeof node.data.value === "string" && node.data.value.trim().length > 0) {
    return isGenericTenantPlaceholder(node.data.value) ? null : node.data.value;
  }
  return "Sin valor";
}

function cleanTenantPlaceholderCopy(value: string) {
  return value
    .replace(/\s+guardado en General y\s+/gi, " ")
    .replace(/\s+guardado en General\.?/gi, ".")
    .replace(/\s+en General\.?/gi, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function resultSubtitle(node: DataFlowNode) {
  if (typeof node.data.resultDetail === "string" && node.data.resultDetail.trim().length > 0) {
    return node.data.hideResultValue === true
      ? cleanTenantPlaceholderCopy(node.data.resultDetail)
      : node.data.resultDetail;
  }
  if (node.type === "document") {
    return String(node.data.folderPath ?? node.data.folderLabel ?? "Carpeta fuente");
  }
  return String(node.data.location ?? shortDetail(node));
}

function ResultChip({
  node,
  active,
  visualStyle,
  activeColor,
  buttonRef,
  onClick,
  onHover,
  onLeave,
}: {
  node: DataFlowNode;
  active: boolean;
  visualStyle: ResultVisualStyle;
  activeColor: ActiveResultColor;
  buttonRef: (element: HTMLButtonElement | null) => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onHover: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
}) {
  const meta = nodeMeta(node.type);
  const Icon = meta.icon;
  const status = mapDemoStatus(node.status);
  const value = chipValue(node);
  const showValue = node.data.hideResultValue !== true && !isGenericTenantPlaceholder(value);
  const activeTokens = getActiveColorTokens(activeColor);

  if (visualStyle === "node") {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseMove={onHover}
        onMouseLeave={onLeave}
        style={{
          flex: "0 0 auto",
          minWidth: 176,
          height: 44,
          padding: "0 12px",
          background: active ? activeTokens.solid : "#fff",
          color: active ? "#fff" : "var(--df-stone-900)",
          border: `1.5px solid ${active ? "transparent" : "var(--df-stone-200)"}`,
          borderRadius: 999,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          boxShadow: active ? `0 10px 28px ${activeTokens.shadow}` : "0 1px 0 rgba(0,0,0,.03)",
          transition: "transform .15s, box-shadow .15s, background .15s, border-color .15s",
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: active ? "rgba(255,255,255,.18)" : activeTokens.soft,
            color: active ? "#fff" : activeTokens.text,
            flexShrink: 0,
          }}
        >
          <Icon size={13} />
        </span>
        <span style={{ minWidth: 0, display: "grid", gap: 1, textAlign: "left" }}>
          <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {node.label}
          </span>
          <span style={{ fontSize: 12, color: active ? "rgba(255,255,255,.76)" : "var(--df-stone-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {showValue ? `${value} - ${status.text}` : status.text}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onLeave}
      style={{
        flex: "1 1 0",
        minWidth: 180,
        padding: "10px 14px",
        background: active ? activeTokens.solid : "#fff",
        color: active ? "#fff" : "var(--df-stone-900)",
        border: `1.5px solid ${active ? "transparent" : "var(--df-stone-200)"}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        boxShadow: active ? `0 10px 28px ${activeTokens.shadow}` : "0 1px 0 rgba(0,0,0,.03)",
        transition: "transform .15s, box-shadow .15s, background .15s, border-color .15s",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".15em",
          textTransform: "uppercase",
          color: active ? "rgba(255,255,255,.78)" : meta.color,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Icon size={12} />
        {node.label}
      </div>
      {showValue ? (
        <div
          style={{
            fontSize: typeof value === "string" && value.length > 12 ? 18 : 24,
            fontWeight: 800,
            letterSpacing: "-.03em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
      ) : null}
      <div
        style={{
          fontSize: 12,
          color: active ? "rgba(255,255,255,.74)" : "var(--df-stone-500)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {resultSubtitle(node)}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 2,
          fontSize: 12,
          color: active ? "rgba(255,255,255,.72)" : "var(--df-stone-400)",
        }}
      >
        <span>{status.text}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          Ver trazabilidad
          <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}

function SectionTag({ color, icon: Icon, label, count }: { color: string; icon: typeof Database; label: string; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".15em",
        textTransform: "uppercase",
        color,
      }}
    >
      <Icon size={12} />
      {label}
      <span
        style={{
          fontSize: 12,
          color: "var(--df-stone-500)",
          background: "#fff",
          border: "1px solid var(--df-stone-200)",
          borderRadius: 999,
          padding: "1px 6px",
          letterSpacing: 0,
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function CanvasNode({
  node,
  position,
  dimmed,
  highlighted,
  selected,
  flowMode = false,
  calculationVariant = "pill",
  calculationInputLabels = [],
  register,
  onClick,
  onHover,
  onLeave,
}: {
  node: DataFlowNode;
  position: LayoutRect;
  dimmed: boolean;
  highlighted: boolean;
  selected: boolean;
  flowMode?: boolean;
  calculationVariant?: CalculationNodeVariant;
  calculationInputLabels?: string[];
  register: (element: HTMLButtonElement | null) => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onHover: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
}) {
  const meta = nodeMeta(node.type);
  const status = mapDemoStatus(node.status);
  const baseStyle: CSSProperties = {
    position: flowMode ? "relative" : "absolute",
    left: flowMode ? undefined : position.x - position.w / 2,
    top: flowMode ? undefined : position.y - position.h / 2,
    width: position.w,
    height: position.h,
    opacity: dimmed ? 0.28 : 1,
    cursor: "pointer",
    transition: "opacity .2s, transform .2s, box-shadow .2s, border-color .2s",
    transform: highlighted || selected ? "translateY(-2px)" : "none",
    fontFamily: "inherit",
  };

  if (node.type === "calculation") {
    const pillBorder = selected ? meta.color : status.label === "error" ? "#ca8a04" : meta.color;
    const pillBg = status.label === "error" ? "#fef3c7" : "#f5f3ff";
    const valueText = calculationValueText(node);
    const modeLabel = getCalculationModeLabel(node);
    const operatorLabel = getCalculationOperatorLabel(node);
    const formulaLines = getCalculationFormulaLines(node);
    const inputs = calculationInputLabels.length > 0 ? calculationInputLabels : ["Sin inputs"];

    if (calculationVariant === "stacked") {
      return (
        <button
          ref={register}
          type="button"
          onClick={onClick}
          onMouseEnter={onHover}
          onMouseMove={onHover}
          onMouseLeave={onLeave}
          style={{
            ...baseStyle,
            background: "#fff",
            border: `1.5px solid ${selected ? "#7c3aed" : "#ded7ff"}`,
            borderRadius: 14,
            padding: 12,
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            gap: 9,
            boxShadow: selected ? "0 14px 34px rgba(124,58,237,.18)" : highlighted ? "0 8px 20px rgba(0,0,0,.07)" : "0 1px 0 rgba(0,0,0,.03)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "#f5f3ff",
                color: "#6d28d9",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Sigma size={14} />
            </span>
            <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--df-stone-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {node.label}
              </span>
              <span style={{ display: "block", marginTop: 1, fontSize: 12, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 800 }}>
                {modeLabel}
              </span>
            </span>
            <span style={{ borderRadius: 999, background: "#f5f3ff", color: "#5b21b6", padding: "3px 7px", fontSize: 12, fontWeight: 900 }}>
              {operatorLabel}
            </span>
          </span>
          <span style={{ display: "grid", alignContent: "center", textAlign: "left", minWidth: 0 }}>
            <span style={{ fontSize: 12, color: "var(--df-stone-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>
              Resultado
            </span>
            <span style={{ marginTop: 2, fontSize: valueText && valueText.length > 14 ? 15 : 18, fontWeight: 900, lineHeight: 1.05, color: "#4c1d95", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {valueText ?? "-"}
            </span>
          </span>
          <span style={{ display: "flex", gap: 5, overflow: "hidden" }}>
            {inputs.slice(0, 3).map((label) => (
              <span key={label} style={{ minWidth: 0, maxWidth: 82, borderRadius: 999, background: "#fafaf9", border: "1px solid #e7e5e4", padding: "3px 7px", fontSize: 12, color: "var(--df-stone-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </span>
            ))}
          </span>
        </button>
      );
    }

    if (calculationVariant === "io") {
      return (
        <button
          ref={register}
          type="button"
          onClick={onClick}
          onMouseEnter={onHover}
          onMouseMove={onHover}
          onMouseLeave={onLeave}
          style={{
            ...baseStyle,
            background: "#fff",
            border: `1.5px solid ${selected ? "#7c3aed" : "var(--df-stone-200)"}`,
            borderRadius: 16,
            padding: 10,
            display: "grid",
            gridTemplateColumns: "1fr 54px 1fr",
            gap: 8,
            alignItems: "stretch",
            boxShadow: selected ? "0 14px 34px rgba(124,58,237,.16)" : highlighted ? "0 8px 20px rgba(0,0,0,.07)" : "0 1px 0 rgba(0,0,0,.03)",
          }}
        >
          <span style={{ display: "grid", alignContent: "center", gap: 5, minWidth: 0, textAlign: "left" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#7c3aed", letterSpacing: ".14em" }}>IN</span>
            {inputs.slice(0, 3).map((label) => (
              <span key={label} style={{ minWidth: 0, borderRadius: 7, background: "#fafaf9", border: "1px solid #e7e5e4", padding: "3px 6px", fontSize: 12, color: "var(--df-stone-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </span>
            ))}
          </span>
          <span style={{ display: "grid", placeItems: "center" }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, background: "#7c3aed", color: "#fff", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 900, boxShadow: "0 10px 22px rgba(124,58,237,.24)" }}>
              {operatorLabel}
            </span>
          </span>
          <span style={{ display: "grid", alignContent: "center", minWidth: 0, textAlign: "left" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#7c3aed", letterSpacing: ".14em" }}>OUT</span>
            <span style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "var(--df-stone-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {node.label}
            </span>
            <span style={{ marginTop: 2, fontSize: valueText && valueText.length > 14 ? 12 : 15, fontWeight: 900, color: "#4c1d95", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {valueText ?? "-"}
            </span>
          </span>
        </button>
      );
    }

    if (calculationVariant === "formula") {
      const firstLine = formulaLines[0] ?? "Formula sin configurar";
      return (
        <button
          ref={register}
          type="button"
          onClick={onClick}
          onMouseEnter={onHover}
          onMouseMove={onHover}
          onMouseLeave={onLeave}
          style={{
            ...baseStyle,
            background: "#1c1917",
            border: `1.5px solid ${selected ? "#a78bfa" : "#44403c"}`,
            borderRadius: 14,
            padding: 12,
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            gap: 8,
            color: "#fff",
            boxShadow: selected ? "0 14px 34px rgba(28,25,23,.25)" : highlighted ? "0 8px 20px rgba(0,0,0,.12)" : "0 1px 0 rgba(0,0,0,.03)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(167,139,250,.18)", color: "#c4b5fd", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sigma size={13} />
            </span>
            <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {node.label}
              </span>
              <span style={{ display: "block", marginTop: 1, fontSize: 12, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 800 }}>
                {modeLabel}
              </span>
            </span>
          </span>
          <span style={{ minWidth: 0, borderRadius: 9, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", padding: "7px 8px", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 12, lineHeight: 1.35, color: "#e7e5e4", overflow: "hidden", textAlign: "left" }}>
            {firstLine}
          </span>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.56)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {inputs.slice(0, 2).join(" + ")}
            </span>
            <span style={{ fontSize: valueText && valueText.length > 14 ? 11 : 13, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {valueText ?? "-"}
            </span>
          </span>
        </button>
      );
    }

    return (
      <button
        ref={register}
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseMove={onHover}
        onMouseLeave={onLeave}
        style={{
          ...baseStyle,
          background: pillBg,
          border: `1.5px dashed ${pillBorder}`,
          borderRadius: 999,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: selected ? "0 8px 20px rgba(124,58,237,.14)" : highlighted ? "0 4px 12px rgba(0,0,0,.06)" : "none",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#ddd6fe",
            color: "#5b21b6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Sigma size={14} />
        </span>
        <span style={{ minWidth: 0, textAlign: "left" }}>
          <span
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--df-stone-900)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node.label}
          </span>
          {valueText ? (
            <span
              style={{
                display: "block",
                marginTop: 3,
                fontSize: valueText.length > 16 ? 11 : 12,
                lineHeight: 1.05,
                fontWeight: 800,
                color: "#4c1d95",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {valueText}
            </span>
          ) : null}
          <span
            style={{
              display: "block",
              marginTop: 2,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              fontWeight: 700,
              color: "#5b21b6",
            }}
          >
            {String(node.data.calculationType ?? supportLabel(node.supportStatus))}
          </span>
          {calculationInputLabels.length > 0 ? (
            <span
              style={{
                display: "block",
                marginTop: 3,
                fontSize: 12,
                color: "var(--df-stone-500)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              IN: {calculationInputLabels.slice(0, 2).join(" + ")}
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  if (node.type === "view") {
    const value = chipValue(node);
    const showValue = node.data.hideResultValue !== true && !isGenericTenantPlaceholder(value);
    return (
      <button
        ref={register}
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseMove={onHover}
        onMouseLeave={onLeave}
        style={{
          ...baseStyle,
          background: "var(--df-orange)",
          border: "1px solid transparent",
          borderRadius: 12,
          padding: "9px 12px",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          color: "#fff",
          boxShadow: selected ? "0 12px 28px rgba(255,88,0,.22)" : highlighted ? "0 8px 20px rgba(255,88,0,.16)" : "0 1px 0 rgba(0,0,0,.03)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.78)",
          }}
        >
          <Target size={11} />
          Resultado
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.label}
        </span>
        {showValue ? (
          <span
            style={{
              marginTop: "auto",
              fontSize: 12,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </span>
        ) : null}
      </button>
    );
  }

  if (node.type === "obra_field") {
    const valueText =
      typeof node.data.valueFormatted === "string" && !isGenericTenantPlaceholder(node.data.valueFormatted)
        ? node.data.valueFormatted
        : null;
    return (
      <button
        ref={register}
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseMove={onHover}
        onMouseLeave={onLeave}
        style={{
          ...baseStyle,
          background: "#f0fdfa",
          border: `1.5px solid ${selected ? "#0f766e" : "#99f6e4"}`,
          borderRadius: 10,
          padding: "9px 11px",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          boxShadow: selected ? "0 8px 18px rgba(15,118,110,.14)" : highlighted ? "0 6px 14px rgba(15,118,110,.10)" : "0 1px 0 rgba(0,0,0,.03)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#0f766e",
          }}
        >
          <FileText size={11} />
          Campo de obra
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--df-stone-900)",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.label}
        </span>
        {valueText ? (
          <span
            style={{
              marginTop: "auto",
              fontSize: 12,
              color: "#0f766e",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            {valueText}
          </span>
        ) : null}
      </button>
    );
  }

  if (node.type === "macro_table") {
    return (
      <button
        ref={register}
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseMove={onHover}
        onMouseLeave={onLeave}
        style={{
          ...baseStyle,
          background: "#fff",
          border: `1.5px solid ${selected ? "#0e7490" : "#0891b2"}`,
          borderRadius: 10,
          padding: 10,
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          boxShadow: selected ? "0 8px 22px rgba(8,145,178,.16)" : highlighted ? "0 8px 20px rgba(8,145,178,.12)" : "0 1px 0 rgba(0,0,0,.03)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#0891b2",
          }}
        >
          <Layers size={11} />
          Macrotabla
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--df-stone-900)",
            lineHeight: 1.2,
          }}
        >
          {node.label}
        </span>
        <span
          style={{
            display: "flex",
            gap: 10,
            marginTop: "auto",
            fontSize: 12,
            color: "var(--df-stone-500)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>
            <strong style={{ color: "var(--df-stone-800)" }}>{formatNumber(node.data.sourceCount)}</strong> fuentes
          </span>
          <span>
            <strong style={{ color: "var(--df-stone-800)" }}>{formatNumber(node.data.columnCount)}</strong> cols
          </span>
        </span>
      </button>
    );
  }

  if (node.type === "document") {
    return (
      <button
        ref={register}
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseMove={onHover}
        onMouseLeave={onLeave}
        style={{
          ...baseStyle,
          background: "#fff",
          border: `1px dashed ${selected ? "#d97706" : "#d6d3d1"}`,
          borderRadius: 10,
          padding: 10,
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          boxShadow: selected ? "0 8px 18px rgba(217,119,6,.12)" : highlighted ? "0 6px 14px rgba(0,0,0,.06)" : "none",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#a16207",
          }}
        >
          <FolderOpen size={11} />
          Documentos
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--df-stone-900)",
            lineHeight: 1.25,
          }}
        >
          {node.label}
        </span>
        <span
          style={{
            marginTop: "auto",
            fontSize: 12,
            color: "var(--df-stone-500)",
          }}
        >
          Carpeta fuente
        </span>
      </button>
    );
  }

  const tone = status.color;
  const abstractTemplate = node.data.abstractTemplate === true;
  const rowCount = formatNumber(node.data.rowCount);
  const columnCount = formatNumber(node.data.columnCount);
  const processing = node.data.processing as { processing?: number; failed?: number; completed?: number } | undefined;
  const footerMessage =
    abstractTemplate
      ? "Template general"
      : node.status === "processing"
        ? `${processing?.processing ?? 0} documento(s) en proceso`
        : node.status === "error"
          ? `${processing?.failed ?? 0} documento(s) con error`
          : node.status === "incomplete"
            ? rowCount === "0"
              ? "Sin filas cargadas"
              : "Carga parcial"
            : null;

  return (
    <button
      ref={register}
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onLeave}
      style={{
        ...baseStyle,
        background: "#fff",
        border: `1px solid ${selected ? "var(--df-stone-500)" : "var(--df-stone-200)"}`,
        borderRadius: 8,
        padding: "8px 10px",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        boxShadow: selected ? "0 8px 18px rgba(28,25,23,.12)" : highlighted ? "0 6px 14px rgba(0,0,0,.08)" : "0 1px 0 rgba(0,0,0,.03)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--df-stone-700)", display: "inline-flex" }}>
          <Database size={11} />
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--df-stone-900)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.label}
        </span>
        <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: tone }} />
      </span>
      <span
        style={{
          display: "flex",
          gap: 10,
          fontSize: 12,
          color: "var(--df-stone-500)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {abstractTemplate ? (
          <span>
            <strong style={{ color: "var(--df-stone-800)" }}>General</strong>
          </span>
        ) : (
          <span>
            <strong style={{ color: "var(--df-stone-800)" }}>{rowCount}</strong> filas
          </span>
        )}
        <span>
          <strong style={{ color: "var(--df-stone-800)" }}>{columnCount}</strong> cols
        </span>
      </span>
      {footerMessage ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: tone,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            marginTop: "auto",
          }}
        >
          {footerMessage}
        </span>
      ) : null}
    </button>
  );
}

function DataFlowReactNode({ data, selected }: NodeProps<DataFlowFlowNode>) {
  const size = getNodeSize(data.node, data.calculationNodeVariant);
  const sourcePosition = data.flowDirection === "horizontal" ? Position.Right : Position.Bottom;
  const targetPosition = data.flowDirection === "horizontal" ? Position.Left : Position.Top;
  const handleBase: CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: "50%",
    border: "2px solid #fff",
    background: nodeMeta(data.node.type).color,
    boxShadow: "0 1px 4px rgba(28,25,23,.18)",
    opacity: data.node.type === "view" ? 0.72 : 0.95,
  };

  return (
    <div style={{ width: size.w, height: size.h, position: "relative" }}>
      <Handle
        type="target"
        position={targetPosition}
        style={handleBase}
      />
      <CanvasNode
        node={data.node}
        position={{ x: size.w / 2, y: size.h / 2, w: size.w, h: size.h }}
        dimmed={data.dimmed}
        highlighted={data.highlighted}
        selected={selected}
        calculationVariant={data.calculationNodeVariant}
        calculationInputLabels={data.calculationInputLabels}
        flowMode
        register={(element) => data.register(data.node.id, element)}
        onClick={() => undefined}
        onHover={(event) => data.onHover(data.node.id, event)}
        onLeave={() => data.onLeave(data.node.id)}
      />
      <Handle
        type="source"
        position={sourcePosition}
        style={handleBase}
      />
    </div>
  );
}

function DataFlowReactEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps<ReactFlowEdge<DataFlowFlowEdgeData>>) {
  const visualStyle = data?.visualStyle ?? "curve";
  const direction = data?.direction ?? "horizontal";
  const path = edgePath(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    visualStyle,
    direction
  );

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeDasharray:
          visualStyle === "dashed" ? "7 6" : visualStyle === "dotted" ? "1 6" : undefined,
        strokeLinecap: visualStyle === "dotted" ? "round" : "butt",
      }}
    />
  );
}

const DATA_FLOW_NODE_TYPES = { dataFlow: DataFlowReactNode };
const DATA_FLOW_EDGE_TYPES = { dataFlow: DataFlowReactEdge };

function HoverPreview({
  node,
  hover,
}: {
  node: DataFlowNode | null;
  hover: HoverState | null;
}) {
  if (!node || !hover) return null;
  const meta = nodeMeta(node.type);
  const Icon = meta.icon;
  const primary = resultSubtitle(node);

  return (
    <div
      style={{
        position: "fixed",
        left: hover.x + 14,
        top: hover.y + 14,
        pointerEvents: "none",
        background: "rgba(28,25,23,.94)",
        color: "#fff",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 12,
        lineHeight: 1.45,
        maxWidth: 260,
        zIndex: 100,
        boxShadow: "0 8px 30px rgba(0,0,0,.25)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".15em",
          textTransform: "uppercase",
          color: meta.color,
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 3,
        }}
      >
        <Icon size={10} />
        {meta.label}
      </div>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{node.label}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.72)" }}>{primary}</div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,.5)",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          fontWeight: 600,
        }}
      >
        Click para abrir
      </div>
    </div>
  );
}

function TweaksPopover({
  layoutDirection,
  resultVisualStyle,
  calculationNodeVariant,
  edgeVisualStyle,
  activeColor,
  showCalculations,
  showDocuments,
  onLayoutDirectionChange,
  onResultVisualStyleChange,
  onCalculationNodeVariantChange,
  onEdgeVisualStyleChange,
  onActiveColorChange,
  onToggleCalculations,
  onToggleDocuments,
  onClose,
}: {
  layoutDirection: CanvasDirection;
  resultVisualStyle: ResultVisualStyle;
  calculationNodeVariant: CalculationNodeVariant;
  edgeVisualStyle: EdgeVisualStyle;
  activeColor: ActiveResultColor;
  showCalculations: boolean;
  showDocuments: boolean;
  onLayoutDirectionChange: (value: CanvasDirection) => void;
  onResultVisualStyleChange: (value: ResultVisualStyle) => void;
  onCalculationNodeVariantChange: (value: CalculationNodeVariant) => void;
  onEdgeVisualStyleChange: (value: EdgeVisualStyle) => void;
  onActiveColorChange: (value: ActiveResultColor) => void;
  onToggleCalculations: () => void;
  onToggleDocuments: () => void;
  onClose: () => void;
}) {
  const visibilityItems = [
    {
      id: "calc",
      label: "Mostrar calculos",
      checked: showCalculations,
      onToggle: onToggleCalculations,
    },
    {
      id: "docs",
      label: "Mostrar documentos",
      checked: showDocuments,
      onToggle: onToggleDocuments,
    },
  ];
  const layoutOptions = [
    { value: "vertical", label: "Vertical" },
    { value: "horizontal", label: "Horizontal" },
    { value: "radial", label: "Radial" },
  ] satisfies Array<{ value: CanvasDirection; label: string }>;
  const resultOptions = [
    { value: "card", label: "KPI card" },
    { value: "node", label: "Nodo" },
  ] satisfies Array<{ value: ResultVisualStyle; label: string }>;
  const calculationOptions = [
    { value: "pill", label: "Pill" },
    { value: "stacked", label: "Stack" },
    { value: "io", label: "I/O" },
    { value: "formula", label: "Formula" },
  ] satisfies Array<{ value: CalculationNodeVariant; label: string }>;
  const edgeOptions = [
    { value: "curve", label: "Curva" },
    { value: "straight", label: "Recta" },
    { value: "dashed", label: "Dashed" },
    { value: "dotted", label: "Dotted" },
  ] satisfies Array<{ value: EdgeVisualStyle; label: string }>;
  const colorOptions = [
    { value: "orange", label: "Orange" },
    { value: "stone", label: "Stone" },
  ] satisfies Array<{ value: ActiveResultColor; label: string }>;

  function sectionLabel(label: string) {
    return (
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--df-stone-400)",
        }}
      >
        {label}
      </div>
    );
  }

  function segment<T extends string>({
    value,
    options,
    onChange,
  }: {
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (next: T) => void;
  }) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
          gap: 2,
          borderRadius: 8,
          padding: 2,
          background: "var(--df-stone-100)",
          border: "1px solid var(--df-stone-200)",
        }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                height: 24,
                borderRadius: 6,
                border: "none",
                background: active ? "#fff" : "transparent",
                color: active ? "var(--df-stone-900)" : "var(--df-stone-600)",
                boxShadow: active ? "0 1px 0 rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" : "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                fontFamily: "inherit",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 264,
        borderRadius: 12,
        border: "1px solid var(--df-stone-200)",
        background: "#fff",
        boxShadow: "0 16px 40px rgba(28,25,23,.14)",
        padding: 8,
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 0 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-900)" }}>
          Tweaks
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tweaks"
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "var(--df-stone-400)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gap: 7 }}>
          {sectionLabel("Layout del canvas")}
          <div style={{ fontSize: 12, color: "var(--df-stone-700)" }}>Direccion</div>
          {segment({ value: layoutDirection, options: layoutOptions, onChange: onLayoutDirectionChange })}
        </div>

        <div style={{ display: "grid", gap: 7 }}>
          {sectionLabel("Forma del resultado")}
          <div style={{ fontSize: 12, color: "var(--df-stone-700)" }}>Estilo</div>
          {segment({ value: resultVisualStyle, options: resultOptions, onChange: onResultVisualStyleChange })}
        </div>

        <div style={{ display: "grid", gap: 7 }}>
          {sectionLabel("Diseno de calculos")}
          <div style={{ fontSize: 12, color: "var(--df-stone-700)" }}>Nodo</div>
          {segment({ value: calculationNodeVariant, options: calculationOptions, onChange: onCalculationNodeVariantChange })}
        </div>

        <div style={{ display: "grid", gap: 9 }}>
          {sectionLabel("Capas visibles")}
          {visibilityItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onToggle}
              style={{
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                color: "var(--df-stone-700)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              <span>{item.label}</span>
              <span
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 999,
                  background: item.checked ? "#22c55e" : "var(--df-stone-300)",
                  position: "relative",
                  flexShrink: 0,
                  transition: "background .16s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: item.checked ? 16 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,.18)",
                    transition: "left .16s ease",
                  }}
                />
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 7 }}>
          {sectionLabel("Estilo de conexiones")}
          <div style={{ fontSize: 12, color: "var(--df-stone-700)" }}>Trazo</div>
          {segment({ value: edgeVisualStyle, options: edgeOptions, onChange: onEdgeVisualStyleChange })}
        </div>

        <div style={{ display: "grid", gap: 7 }}>
          {sectionLabel("Color del resultado activo")}
          <div style={{ fontSize: 12, color: "var(--df-stone-700)" }}>Acento</div>
          {segment({ value: activeColor, options: colorOptions, onChange: onActiveColorChange })}
        </div>
      </div>
    </div>
  );
}

function makeClientId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function EditorField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--df-stone-500)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function editorInputStyle(): CSSProperties {
  return {
    width: "100%",
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--df-stone-200)",
    background: "#fff",
    padding: "0 10px",
    fontSize: 12,
    color: "var(--df-stone-900)",
    fontFamily: "inherit",
  };
}

function editorTextareaStyle(): CSSProperties {
  return {
    width: "100%",
    minHeight: 74,
    borderRadius: 8,
    border: "1px solid var(--df-stone-200)",
    background: "#fff",
    padding: "10px",
    fontSize: 12,
    color: "var(--df-stone-900)",
    fontFamily: "inherit",
    resize: "vertical",
  };
}

function editorAccordionKey(type: DataFlowEditorAccordionType, id: string) {
  return `${type}:${id}`;
}

export function DataFlowEditorDrawer({
  open,
  config,
  payload,
  saving,
  error,
  editTarget,
  onClose,
  onConfigChange,
  onSave,
}: {
  open: boolean;
  config: BuilderConfig;
  payload: DataFlowConfigPayload | null;
  saving: boolean;
  error: string | null;
  editTarget: DataFlowEditorTarget | null;
  onClose: () => void;
  onConfigChange: (config: BuilderConfig) => void;
  onSave: () => void;
}) {
  const [tab, setTab] = useState<"layout" | "results" | "calculations">("layout");
  const [expandedEditorItem, setExpandedEditorItem] = useState<string | null>(null);
  const isTenantScope = payload?.scope === "tenant";
  const evaluatedResultsById = useMemo(
    () => new Map((payload?.evaluated?.results ?? []).map((result) => [result.id, result])),
    [payload]
  );
  const evaluatedCalculationsById = useMemo(
    () => new Map((payload?.evaluated?.calculations ?? []).map((calculation) => [calculation.id, calculation])),
    [payload]
  );

  const sourceOptions = useMemo(
    () => ({
      table: payload?.sources.tables ?? [],
      macro_table: payload?.sources.macroTables ?? [],
    }),
    [payload]
  );
  const obraFieldOptions = payload?.sources.obraFields ?? [];
  const selectableCalculations = useMemo(() => {
    const byId = new Map<string, BuilderCalculation>();
    for (const calculation of payload?.inheritedConfig?.calculations ?? []) {
      byId.set(calculation.id, calculation);
    }
    for (const calculation of config.calculations) {
      byId.set(calculation.id, calculation);
    }
    return [...byId.values()];
  }, [config.calculations, payload?.inheritedConfig?.calculations]);
  const selectableResults = useMemo(() => {
    const byId = new Map<string, BuilderResult>();
    for (const result of payload?.inheritedConfig?.results ?? []) {
      byId.set(result.id, result);
    }
    for (const result of config.results) {
      byId.set(result.id, result);
    }
    return [...byId.values()].sort((left, right) => left.generalTabOrder - right.generalTabOrder);
  }, [config.results, payload?.inheritedConfig?.results]);
  const inheritedCalculations = useMemo(() => {
    const localIds = new Set(config.calculations.map((calculation) => calculation.id));
    return (payload?.inheritedConfig?.calculations ?? []).filter(
      (calculation) => !localIds.has(calculation.id)
    );
  }, [config.calculations, payload?.inheritedConfig?.calculations]);
  const inheritedResults = useMemo(() => {
    const localIds = new Set(config.results.map((result) => result.id));
    return (payload?.inheritedConfig?.results ?? []).filter((result) => !localIds.has(result.id));
  }, [config.results, payload?.inheritedConfig?.results]);
  const inheritedLayoutBlocks = useMemo(() => {
    const localIds = new Set(config.generalTabLayout.map((block) => block.id));
    return (payload?.inheritedConfig?.generalTabLayout ?? []).filter((block) => !localIds.has(block.id));
  }, [config.generalTabLayout, payload?.inheritedConfig?.generalTabLayout]);
  const canUseTableSources = sourceOptions.table.length > 0 || sourceOptions.macro_table.length > 0;

  const toggleExpandedEditorItem = (type: DataFlowEditorAccordionType, id: string) => {
    const key = editorAccordionKey(type, id);
    setExpandedEditorItem((current) => (current === key ? null : key));
  };

  useEffect(() => {
    if (!open || !editTarget) return;
    const nextTab =
      editTarget.type === "result"
        ? "results"
        : editTarget.type === "calculation"
          ? "calculations"
          : "layout";
    const timeoutId = window.setTimeout(() => {
      setTab(nextTab);
      if (editTarget.id) {
        setExpandedEditorItem(editorAccordionKey(editTarget.type, editTarget.id));
      }
      if (!editTarget.id) return;
      window.requestAnimationFrame(() => {
        const selector = `[data-editor-target="${editTarget.type}:${editTarget.id}"]`;
        const target = document.querySelector(selector);
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [editTarget, open]);

  const closeEditor = () => {
    setExpandedEditorItem(null);
    onClose();
  };

  const builderAggregationOptions = useMemo(
    () =>
      [
        { value: "sum", label: "Suma" },
        { value: "avg", label: "Promedio" },
        { value: "min", label: "Minimo" },
        { value: "max", label: "Maximo" },
        { value: "latest", label: "Ultimo valor" },
        { value: "count_rows", label: "Cantidad de filas" },
        { value: "count_non_empty", label: "Cantidad no vacia" },
      ] satisfies Array<{ value: BuilderAggregation; label: string }>,
    []
  );
  const layoutWidthOptions = useMemo(
    () =>
      [
        { value: "one_third", label: "1/3" },
        { value: "half", label: "1/2" },
        { value: "two_thirds", label: "2/3" },
        { value: "full", label: "Ancho completo" },
      ] satisfies Array<{ value: BuilderGeneralTabLayoutWidth; label: string }>,
    []
  );
  const layoutTypeOptions = useMemo(
    () =>
      [
        { value: "progress", label: "Avance" },
        { value: "curve", label: "Curva de avance" },
        { value: "general_info", label: "Informacion General" },
        { value: "financial", label: "Datos Financieros" },
        { value: "configured_fields", label: "Campos Configurados" },
        { value: "certificates", label: "Certificados" },
        { value: "custom_result", label: "Resultado custom" },
      ] satisfies Array<{ value: BuilderGeneralTabLayoutBlockType; label: string }>,
    []
  );
  const staticGeneralInfoFieldOptions = useMemo(
    () =>
      [
        { id: "designacionYUbicacion", label: "Designacion y ubicacion" },
        { id: "entidadContratante", label: "Entidad contratante" },
        { id: "mesBasicoDeContrato", label: "Mes basico" },
        { id: "iniciacion", label: "Iniciacion" },
        { id: "n", label: "N de obra" },
        { id: "supDeObraM2", label: "Superficie" },
      ],
    []
  );
  const financialFieldOptions = useMemo(
    () => [
      ...selectableResults.map((result) => ({ id: result.id, label: result.label })),
      { id: "segunContrato", label: "Segun contrato" },
      { id: "prorrogasAcordadas", label: "Prorrogas" },
      { id: "plazoTotal", label: "Plazo total" },
      { id: "plazoTransc", label: "Plazo transcurrido" },
    ],
    [selectableResults]
  );

  if (!open) return null;

  function getLayoutFieldOptions(block: BuilderGeneralTabLayoutBlock) {
    if (block.type === "progress") {
      return [{ id: "findings", label: "Alertas detectadas" }];
    }
    if (block.type === "general_info") return staticGeneralInfoFieldOptions;
    if (block.type === "financial") return financialFieldOptions;
    if (block.type === "configured_fields") {
      return [{ id: "*", label: "Todos los campos configurados" }];
    }
    return [];
  }

  function createFormulaInput(
    calculationIdToExclude: string,
    sourceType: BuilderFormulaInputSourceType = "calculation"
  ): BuilderFormulaInput {
    const firstCalculation = selectableCalculations.find((candidate) => candidate.id !== calculationIdToExclude);
    if (sourceType === "calculation") {
      if (firstCalculation) {
        return {
          id: makeClientId("input"),
          alias: "input_1",
          sourceType,
          sourceId: firstCalculation.id,
          fieldKey: null,
          aggregation: null,
        };
      }
      sourceType = obraFieldOptions[0]
        ? "obra_field"
        : sourceOptions.table[0]
          ? "table"
          : "macro_table";
    }

    if (sourceType === "obra_field") {
      const defaultField = obraFieldOptions[0];
      return {
        id: makeClientId("input"),
        alias: "input_1",
        sourceType,
        sourceId: defaultField?.id ?? "",
        fieldKey: null,
        aggregation: null,
      };
    }

    const resolvedSourceType: BuilderSourceType = sourceType === "macro_table" ? "macro_table" : "table";
    const sourceList = sourceOptions[resolvedSourceType];
    const defaultSource = sourceList[0];
    return {
      id: makeClientId("input"),
      alias: "input_1",
      sourceType: resolvedSourceType,
      sourceId: defaultSource?.id ?? "",
      fieldKey: defaultSource?.columns[0]?.key ?? null,
      aggregation: "sum",
    };
  }

  function getFormulaInputSource(input: BuilderFormulaInput) {
    if (input.sourceType === "calculation" || input.sourceType === "obra_field") return null;
    return sourceOptions[input.sourceType].find((source) => source.id === input.sourceId) ?? null;
  }

  function updateCalculation(id: string, updater: (calculation: BuilderCalculation) => BuilderCalculation) {
    onConfigChange({
      ...config,
      calculations: config.calculations.map((calculation) =>
        calculation.id === id ? updater(calculation) : calculation
      ),
    });
  }

  function updateResult(id: string, updater: (result: BuilderResult) => BuilderResult) {
    onConfigChange({
      ...config,
      results: config.results.map((result) => (result.id === id ? updater(result) : result)),
    });
  }

  function updateLayoutBlock(
    id: string,
    updater: (block: BuilderGeneralTabLayoutBlock) => BuilderGeneralTabLayoutBlock
  ) {
    onConfigChange({
      ...config,
      generalTabLayout: config.generalTabLayout.map((block) =>
        block.id === id ? updater(block) : block
      ),
    });
  }

  function moveLayoutBlock(id: string, direction: -1 | 1) {
    const ordered = config.generalTabLayout.slice().sort((left, right) => left.order - right.order);
    const index = ordered.findIndex((block) => block.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const nextOrdered = ordered.slice();
    [nextOrdered[index], nextOrdered[nextIndex]] = [nextOrdered[nextIndex], nextOrdered[index]];
    const orderById = new Map(nextOrdered.map((block, orderIndex) => [block.id, orderIndex + 1]));
    onConfigChange({
      ...config,
      generalTabLayout: config.generalTabLayout.map((block) => ({
        ...block,
        order: orderById.get(block.id) ?? block.order,
      })),
    });
  }

  function toggleLayoutField(block: BuilderGeneralTabLayoutBlock, fieldId: string) {
    const optionIds = getLayoutFieldOptions(block).map((option) => option.id);
    const selected = new Set(
      block.fieldIds.length === 0
        ? optionIds
        : block.fieldIds.includes("__none")
          ? []
          : block.fieldIds
    );

    if (fieldId === "*") {
      const nextFieldIds = selected.has("*") ? ["__none"] : ["*"];
      updateLayoutBlock(block.id, (current) => ({ ...current, fieldIds: nextFieldIds }));
      return;
    }

    selected.delete("*");
    if (selected.has(fieldId)) {
      selected.delete(fieldId);
    } else {
      selected.add(fieldId);
    }

    updateLayoutBlock(block.id, (current) => ({
      ...current,
      fieldIds: selected.size > 0 ? [...selected] : ["__none"],
    }));
  }

  function removeCalculation(id: string) {
    onConfigChange({
      ...config,
      calculations: config.calculations
        .filter((calculation) => calculation.id !== id)
        .map((calculation) =>
          calculation.mode === "formula"
            ? {
              ...calculation,
              inputs: calculation.inputs.map((input) =>
                input.sourceType === "calculation" && input.sourceId === id
                  ? { ...input, sourceId: "" }
                  : input
              ),
            }
            : calculation
        ),
      results: config.results.map((result) =>
        result.calculationId === id ? { ...result, calculationId: null } : result
      ),
    });
  }

  function removeResult(id: string) {
    onConfigChange({
      ...config,
      results: config.results.filter((result) => result.id !== id),
    });
  }

  function removeLayoutBlock(id: string) {
    if (BUILDER_DEFAULT_LAYOUT_IDS.has(id)) {
      updateLayoutBlock(id, (current) => ({ ...current, enabled: false }));
      return;
    }
    onConfigChange({
      ...config,
      generalTabLayout: config.generalTabLayout.filter((block) => block.id !== id),
    });
  }

  function overrideCalculation(calculation: BuilderCalculation) {
    if (config.calculations.some((candidate) => candidate.id === calculation.id)) return;
    onConfigChange({
      ...config,
      calculations: [...config.calculations, calculation],
    });
  }

  function overrideResult(result: BuilderResult) {
    if (config.results.some((candidate) => candidate.id === result.id)) return;
    onConfigChange({
      ...config,
      results: [...config.results, result],
    });
  }

  function overrideLayoutBlock(block: BuilderGeneralTabLayoutBlock) {
    if (config.generalTabLayout.some((candidate) => candidate.id === block.id)) return;
    onConfigChange({
      ...config,
      generalTabLayout: [...config.generalTabLayout, block],
    });
  }

  function addAggregateCalculation() {
    if (!canUseTableSources) return;
    const defaultSource = sourceOptions.table[0] ?? sourceOptions.macro_table[0];
    const defaultSourceType: BuilderSourceType = sourceOptions.table[0] ? "table" : "macro_table";
    onConfigChange({
      ...config,
      calculations: [
        ...config.calculations,
        {
          id: makeClientId("calc"),
          label: "Nuevo calculo",
          mode: "aggregate",
          description: "",
          sourceType: defaultSourceType,
          sourceId: defaultSource?.id ?? "",
          fieldKey: defaultSource?.columns[0]?.key ?? null,
          aggregation: "sum",
        },
      ],
    });
  }

  function addFormulaCalculation() {
    onConfigChange({
      ...config,
      calculations: [
        ...config.calculations,
        {
          id: makeClientId("calc"),
          label: "Formula custom",
          mode: "formula",
          description: "",
          expression: "",
          inputs: [],
        },
      ],
    });
  }

  function addResult() {
    onConfigChange({
      ...config,
      results: [
        ...config.results,
        {
          id: makeClientId("result"),
          label: "Nuevo resultado",
          description: "",
          calculationId: selectableCalculations[0]?.id ?? null,
          targetObraFieldId: null,
          writebackMode: "none",
          format: "number",
          decimals: 0,
          generalTabSlot: "hero",
          generalTabOrder: config.results.length + 1,
        },
      ],
    });
  }

  function addLayoutBlock() {
    onConfigChange({
      ...config,
      generalTabLayout: [
        ...config.generalTabLayout,
        {
          id: makeClientId("layout"),
          type: "custom_result",
          label: "Nuevo bloque",
          enabled: true,
          order: config.generalTabLayout.length + 1,
          width: "half",
          resultId: selectableCalculations[0] ? config.results[0]?.id ?? null : null,
          fieldIds: [],
        },
      ],
    });
  }

  return (
    <aside
      style={{
        flex: "0 0 clamp(420px, 34vw, 560px)",
        width: "clamp(420px, 34vw, 560px)",
        alignSelf: "stretch",
        background: "#fff",
        borderLeft: "1px solid var(--df-stone-200)",
        boxShadow: "-1px 0 0 rgba(28,25,23,.03)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 101px)",
        minHeight: "calc(100vh - 101px)",
        overflow: "hidden",
        position: "sticky",
        top: 0,
      }}
    >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--df-stone-200)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--df-orange-soft)",
              color: "var(--df-orange)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--df-stone-900)" }}>Editor de data-flow</div>
            <div style={{ marginTop: 2, fontSize: 12, color: "var(--df-stone-500)" }}>
              {isTenantScope
                ? "Defini calculos base del tenant usando campos de obra y otros calculos generales."
                : "Crea resultados para General, defini calculos y conectalos a tablas, macrotablas o calculos heredados."}
            </div>
          </div>
          <button
            type="button"
            onClick={closeEditor}
            style={{
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: "var(--df-stone-500)",
              display: "inline-flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: "10px 18px",
            borderBottom: "1px solid var(--df-stone-100)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setTab("layout")}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: tab === "layout" ? "var(--df-orange)" : "var(--df-stone-100)",
              color: tab === "layout" ? "#fff" : "var(--df-stone-700)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Layout
          </button>
          <button
            type="button"
            onClick={() => setTab("results")}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: tab === "results" ? "var(--df-orange)" : "var(--df-stone-100)",
              color: tab === "results" ? "#fff" : "var(--df-stone-700)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            General Tab
          </button>
          <button
            type="button"
            onClick={() => setTab("calculations")}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: tab === "calculations" ? "var(--df-orange)" : "var(--df-stone-100)",
              color: tab === "calculations" ? "#fff" : "var(--df-stone-700)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Calculos
          </button>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {tab === "layout" ? (
              <button
                type="button"
                onClick={addLayoutBlock}
                style={{
                  ...editorInputStyle(),
                  width: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Bloque
              </button>
            ) : tab === "results" ? (
              <button
                type="button"
                onClick={addResult}
                style={{
                  ...editorInputStyle(),
                  width: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Resultado
              </button>
            ) : (
              <>
                {canUseTableSources ? (
                  <button
                    type="button"
                    onClick={addAggregateCalculation}
                    style={{
                      ...editorInputStyle(),
                      width: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />
                    Agregado
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={addFormulaCalculation}
                  style={{
                    ...editorInputStyle(),
                    width: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  Formula
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {error ? (
            <div
              style={{
                borderRadius: 10,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                padding: "12px 14px",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          ) : null}

          {tab === "layout" && inheritedLayoutBlocks.length > 0 ? (
            <section
              style={{
                borderRadius: 14,
                border: "1px solid var(--df-stone-200)",
                background: "var(--df-stone-50)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Target size={14} color="var(--df-orange)" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-900)" }}>
                  Layout heredado del tenant
                </div>
              </div>
              {inheritedLayoutBlocks
                .slice()
                .sort((left, right) => left.order - right.order)
                .map((block) => (
                  <div
                    key={block.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      borderRadius: 10,
                      border: "1px solid var(--df-stone-200)",
                      background: "#fff",
                      padding: "9px 10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-900)" }}>
                        {block.label}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 12, color: "var(--df-stone-500)" }}>
                        Orden {block.order} - {layoutWidthOptions.find((option) => option.value === block.width)?.label ?? block.width}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => overrideLayoutBlock(block)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--df-orange)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Sobrescribir
                    </button>
                  </div>
                ))}
            </section>
          ) : null}

          {tab === "layout" ? (
            config.generalTabLayout.length > 0 ? (
              config.generalTabLayout
                .slice()
                .sort((left, right) => left.order - right.order)
                .map((block, blockIndex, orderedBlocks) => {
                  const itemKey = editorAccordionKey("layout", block.id);
                  const isExpanded = expandedEditorItem === itemKey;
                  return (
                    <section
                      key={block.id}
                      data-editor-target={`layout:${block.id}`}
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${isExpanded ? "var(--df-orange-border)" : "var(--df-stone-200)"}`,
                        background: block.enabled ? "#fff" : "var(--df-stone-50)",
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: isExpanded ? 12 : 0,
                        opacity: block.enabled ? 1 : 0.65,
                      }}
                    >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => toggleExpandedEditorItem("layout", block.id)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            background: "var(--df-orange-soft)",
                            color: "var(--df-orange)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Target size={15} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--df-stone-900)" }}>
                            {block.label}
                          </div>
                          <div style={{ marginTop: 2, fontSize: 12, color: "var(--df-stone-500)" }}>
                            Orden {block.order} - {layoutWidthOptions.find((option) => option.value === block.width)?.label ?? block.width}
                          </div>
                        </div>
                        <ChevronDown
                          size={15}
                          style={{
                            color: "var(--df-stone-400)",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform .16s ease",
                            flexShrink: 0,
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label="Subir bloque"
                        disabled={blockIndex === 0}
                        onClick={() => moveLayoutBlock(block.id, -1)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          border: "1px solid var(--df-stone-200)",
                          background: "#fff",
                          color: blockIndex === 0 ? "var(--df-stone-300)" : "var(--df-stone-700)",
                          cursor: blockIndex === 0 ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Bajar bloque"
                        disabled={blockIndex === orderedBlocks.length - 1}
                        onClick={() => moveLayoutBlock(block.id, 1)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          border: "1px solid var(--df-stone-200)",
                          background: "#fff",
                          color: blockIndex === orderedBlocks.length - 1 ? "var(--df-stone-300)" : "var(--df-stone-700)",
                          cursor: blockIndex === orderedBlocks.length - 1 ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateLayoutBlock(block.id, (current) => ({
                            ...current,
                            enabled: !current.enabled,
                          }))
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          color: block.enabled ? "var(--df-orange)" : "var(--df-stone-500)",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {block.enabled ? "Visible" : "Oculto"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLayoutBlock(block.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#b91c1c",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Quitar
                      </button>
                    </div>

                    {isExpanded ? (
                      <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                      <EditorField label="Titulo">
                        <input
                          value={block.label}
                          onChange={(event) =>
                            updateLayoutBlock(block.id, (current) => ({ ...current, label: event.target.value }))
                          }
                          style={editorInputStyle()}
                        />
                      </EditorField>
                      <EditorField label="Tipo">
                        <select
                          value={block.type}
                          onChange={(event) =>
                            updateLayoutBlock(block.id, (current) => ({
                              ...current,
                              type: event.target.value as BuilderGeneralTabLayoutBlockType,
                            }))
                          }
                          style={editorInputStyle()}
                        >
                          {layoutTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </EditorField>
                      <EditorField label="Ancho">
                        <select
                          value={block.width}
                          onChange={(event) =>
                            updateLayoutBlock(block.id, (current) => ({
                              ...current,
                              width: event.target.value as BuilderGeneralTabLayoutWidth,
                            }))
                          }
                          style={editorInputStyle()}
                        >
                          {layoutWidthOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </EditorField>
                      <EditorField label="Orden">
                        <input
                          type="number"
                          value={block.order}
                          onChange={(event) =>
                            updateLayoutBlock(block.id, (current) => ({
                              ...current,
                              order: Number(event.target.value || 0),
                            }))
                          }
                          style={editorInputStyle()}
                        />
                      </EditorField>
                    </div>

                    {block.type === "custom_result" ? (
                      <EditorField label="Resultado">
                        <select
                          value={block.resultId ?? ""}
                          onChange={(event) =>
                            updateLayoutBlock(block.id, (current) => ({
                              ...current,
                              resultId: event.target.value || null,
                            }))
                          }
                          style={editorInputStyle()}
                        >
                          <option value="">Sin resultado</option>
                          {selectableResults.map((result) => (
                            <option key={result.id} value={result.id}>
                              {result.label}
                            </option>
                          ))}
                        </select>
                      </EditorField>
                    ) : null}

                    {(() => {
                      const fieldOptions = getLayoutFieldOptions(block);
                      const selectedFieldIds = new Set(
                        block.fieldIds.length === 0
                          ? fieldOptions.map((option) => option.id)
                          : block.fieldIds.includes("__none")
                            ? []
                            : block.fieldIds
                      );
                      if (fieldOptions.length === 0) {
                        return (
                          <EditorField label="Campos internos">
                            <div
                              style={{
                                borderRadius: 8,
                                border: "1px dashed var(--df-stone-200)",
                                padding: "10px 12px",
                                fontSize: 12,
                                color: "var(--df-stone-500)",
                              }}
                            >
                              Este tipo de bloque no tiene campos internos para configurar.
                            </div>
                          </EditorField>
                        );
                      }
                      return (
                        <EditorField label="Campos internos">
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: 8,
                            }}
                          >
                            {fieldOptions.map((option) => (
                              <label
                                key={option.id}
                                style={{
                                  borderRadius: 8,
                                  border: "1px solid var(--df-stone-200)",
                                  padding: "8px 10px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  cursor: "pointer",
                                  fontSize: 12,
                                  color: "var(--df-stone-700)",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFieldIds.has("*") || selectedFieldIds.has(option.id)}
                                  onChange={() => toggleLayoutField(block, option.id)}
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </EditorField>
                      );
                    })()}
                      </>
                    ) : null}
                  </section>
                  );
                })
            ) : (
              <div style={{ fontSize: 12, color: "var(--df-stone-500)" }}>
                Todavia no hay bloques de layout. Agrega uno para empezar a ordenar General Tab.
              </div>
            )
          ) : null}

          {tab === "calculations" && inheritedCalculations.length > 0 ? (
            <section
              style={{
                borderRadius: 14,
                border: "1px solid var(--df-stone-200)",
                background: "var(--df-stone-50)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={14} color="var(--df-orange)" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-900)" }}>
                  Calculos heredados del tenant
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {inheritedCalculations.map((calculation) => (
                  <div
                    key={calculation.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      borderRadius: 10,
                      border: "1px solid var(--df-stone-200)",
                      background: "#fff",
                      padding: "9px 10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-900)" }}>
                        {calculation.label}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 12, color: "var(--df-stone-500)" }}>
                        {calculation.mode === "formula" ? "Formula general" : "Agregado general"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => overrideCalculation(calculation)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--df-orange)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Sobrescribir
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "results" && inheritedResults.length > 0 ? (
            <section
              style={{
                borderRadius: 14,
                border: "1px solid var(--df-stone-200)",
                background: "var(--df-stone-50)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Target size={14} color="var(--df-orange)" />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-900)" }}>
                  Layout heredado del tenant
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {inheritedResults
                  .slice()
                  .sort((left, right) => left.generalTabOrder - right.generalTabOrder)
                  .map((result) => (
                    <div
                      key={result.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        borderRadius: 10,
                        border: "1px solid var(--df-stone-200)",
                        background: "#fff",
                        padding: "9px 10px",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-900)" }}>
                          {result.label}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--df-stone-500)" }}>
                          {result.generalTabSlot === "hero" ? "Hero superior" : "KPIs financieros"} - orden {result.generalTabOrder}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => overrideResult(result)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--df-orange)",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Sobrescribir
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {tab === "results" ? (
            config.results.length > 0 ? (
              config.results
                .slice()
                .sort((left, right) => left.generalTabOrder - right.generalTabOrder)
                .map((result) => {
                  const evaluated = evaluatedResultsById.get(result.id);
                  const isDefaultResult = BUILDER_DEFAULT_RESULT_IDS.has(result.id);
                  const itemKey = editorAccordionKey("result", result.id);
                  const isExpanded = expandedEditorItem === itemKey;
                  return (
                    <section
                      key={result.id}
                      data-editor-target={`result:${result.id}`}
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${isExpanded ? "var(--df-orange-border)" : "var(--df-stone-200)"}`,
                        background: "#fff",
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: isExpanded ? 12 : 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => toggleExpandedEditorItem("result", result.id)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 10,
                              background: "var(--df-orange-soft)",
                              color: "var(--df-orange)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Target size={15} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--df-stone-900)" }}>{result.label}</div>
                            <div style={{ marginTop: 2, fontSize: 12, color: "var(--df-stone-500)" }}>
                              Preview: {evaluated?.formattedValue ?? "-"}
                            </div>
                          </div>
                          <ChevronDown
                            size={15}
                            style={{
                              color: "var(--df-stone-400)",
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform .16s ease",
                              flexShrink: 0,
                            }}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeResult(result.id)}
                          disabled={isDefaultResult}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: isDefaultResult ? "var(--df-stone-300)" : "#b91c1c",
                            cursor: isDefaultResult ? "not-allowed" : "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {isDefaultResult ? "Base" : "Eliminar"}
                        </button>
                      </div>

                      {isExpanded ? (
                        <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                        <EditorField label="Label">
                          <input
                            value={result.label}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({ ...current, label: event.target.value }))
                            }
                            style={editorInputStyle()}
                          />
                        </EditorField>
                        <EditorField label="Calculo">
                          <select
                            value={result.calculationId ?? ""}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({
                                ...current,
                                calculationId: event.target.value || null,
                              }))
                            }
                            style={editorInputStyle()}
                          >
                            <option value="">Sin calculo</option>
                            {selectableCalculations.map((calculation) => (
                              <option key={calculation.id} value={calculation.id}>
                                {calculation.label}
                              </option>
                            ))}
                          </select>
                        </EditorField>
                        <EditorField label="Sobrescribe campo">
                          <select
                            value={result.targetObraFieldId ?? ""}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({
                                ...current,
                                targetObraFieldId: event.target.value || null,
                              }))
                            }
                            style={editorInputStyle()}
                          >
                            <option value="">No sobrescribir</option>
                            {obraFieldOptions.map((field) => (
                              <option key={field.id} value={field.id}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </EditorField>
                        <EditorField label="Modo writeback">
                          <select
                            value={result.writebackMode ?? "none"}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({
                                ...current,
                                writebackMode: event.target.value as BuilderResult["writebackMode"],
                              }))
                            }
                            style={editorInputStyle()}
                          >
                            <option value="none">Solo mostrar</option>
                            <option value="suggest">Sugerir cambio</option>
                            <option value="auto">Escribir automatico</option>
                          </select>
                        </EditorField>
                        <EditorField label="Formato">
                          <select
                            value={result.format}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({
                                ...current,
                                format: event.target.value as BuilderResult["format"],
                              }))
                            }
                            style={editorInputStyle()}
                          >
                            <option value="number">Numero</option>
                            <option value="currency">Moneda</option>
                            <option value="percent">Porcentaje</option>
                          </select>
                        </EditorField>
                        <EditorField label="Posicion en General">
                          <select
                            value={result.generalTabSlot}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({
                                ...current,
                                generalTabSlot: event.target.value as BuilderResult["generalTabSlot"],
                              }))
                            }
                            style={editorInputStyle()}
                          >
                            <option value="hero">Hero superior</option>
                            <option value="financial">KPIs financieros</option>
                          </select>
                        </EditorField>
                        <EditorField label="Orden">
                          <input
                            type="number"
                            value={result.generalTabOrder}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({
                                ...current,
                                generalTabOrder: Number(event.target.value || 0),
                              }))
                            }
                            style={editorInputStyle()}
                          />
                        </EditorField>
                        <EditorField label="Decimales">
                          <input
                            type="number"
                            value={result.decimals}
                            onChange={(event) =>
                              updateResult(result.id, (current) => ({
                                ...current,
                                decimals: Number(event.target.value || 0),
                              }))
                            }
                            style={editorInputStyle()}
                          />
                        </EditorField>
                      </div>

                      <EditorField label="Descripcion">
                        <textarea
                          value={result.description}
                          onChange={(event) =>
                            updateResult(result.id, (current) => ({ ...current, description: event.target.value }))
                          }
                          style={editorTextareaStyle()}
                        />
                      </EditorField>
                        </>
                      ) : null}
                    </section>
                  );
                })
            ) : (
              <div style={{ fontSize: 12, color: "var(--df-stone-500)" }}>
                Todavia no hay resultados custom. Creá uno y conectalo a un cálculo.
              </div>
            )
          ) : tab === "calculations" && config.calculations.length > 0 ? (
            config.calculations.map((calculation) => {
              const evaluated = evaluatedCalculationsById.get(calculation.id);
              const aggregateCalculation = calculation.mode === "aggregate" ? calculation : null;
              const formulaCalculation = calculation.mode === "formula" ? calculation : null;
              const isDefaultCalculation = BUILDER_DEFAULT_CALCULATION_IDS.has(calculation.id);
              const aggregateSourceOptions = aggregateCalculation
                ? sourceOptions[aggregateCalculation.sourceType]
                : [];
              const selectedSource = aggregateCalculation
                ? aggregateSourceOptions.find((source) => source.id === aggregateCalculation.sourceId) ?? null
                : null;
              const availableFormulaCalculations = selectableCalculations.filter(
                (candidate) => candidate.id !== calculation.id
              );
              const itemKey = editorAccordionKey("calculation", calculation.id);
              const isExpanded = expandedEditorItem === itemKey;
              return (
                <section
                  key={calculation.id}
                  data-editor-target={`calculation:${calculation.id}`}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${isExpanded ? "#ddd6fe" : "var(--df-stone-200)"}`,
                    background: "#fff",
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: isExpanded ? 12 : 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => toggleExpandedEditorItem("calculation", calculation.id)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 999,
                          background: "#f5f3ff",
                          color: "#7c3aed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Sigma size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--df-stone-900)" }}>
                          {calculation.label}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--df-stone-500)" }}>
                          {calculation.mode === "formula" ? "Formula" : "Agregado"} - Preview: {evaluated?.formattedValue ?? "-"}
                        </div>
                      </div>
                      <ChevronDown
                        size={15}
                        style={{
                          color: "var(--df-stone-400)",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform .16s ease",
                          flexShrink: 0,
                        }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCalculation(calculation.id)}
                      disabled={isDefaultCalculation}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: isDefaultCalculation ? "var(--df-stone-300)" : "#b91c1c",
                        cursor: isDefaultCalculation ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {isDefaultCalculation ? "Base" : "Eliminar"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                    <EditorField label="Label">
                      <input
                        value={calculation.label}
                        onChange={(event) =>
                          updateCalculation(calculation.id, (current) => ({ ...current, label: event.target.value }))
                        }
                        style={editorInputStyle()}
                      />
                    </EditorField>
                    <EditorField label="Modo">
                      <select
                        value={calculation.mode}
                        onChange={(event) =>
                          updateCalculation(calculation.id, (current) => {
                            if (event.target.value === current.mode) return current;
                            if (event.target.value === "formula") {
                              return {
                                id: current.id,
                                label: current.label,
                                mode: "formula",
                                description: current.description,
                                expression: "",
                                inputs: [],
                              };
                            }
                            const defaultSource = sourceOptions.table[0] ?? sourceOptions.macro_table[0];
                            const defaultSourceType: BuilderSourceType = sourceOptions.table[0] ? "table" : "macro_table";
                            return {
                              id: current.id,
                              label: current.label,
                              mode: "aggregate",
                              description: current.description,
                              sourceType: defaultSourceType,
                              sourceId: defaultSource?.id ?? "",
                              fieldKey: defaultSource?.columns[0]?.key ?? null,
                              aggregation: "sum",
                            };
                          })
                        }
                        style={editorInputStyle()}
                      >
                        {canUseTableSources || calculation.mode === "aggregate" ? (
                          <option value="aggregate">Agregado</option>
                        ) : null}
                        <option value="formula">Formula</option>
                      </select>
                    </EditorField>
                  </div>

                  <EditorField label="Descripcion">
                    <textarea
                      value={calculation.description}
                      onChange={(event) =>
                        updateCalculation(calculation.id, (current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      style={editorTextareaStyle()}
                    />
                  </EditorField>

                  {calculation.mode === "aggregate" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                      <EditorField label="Fuente">
                        <select
                          value={aggregateCalculation?.sourceType ?? "table"}
                          onChange={(event) =>
                            updateCalculation(calculation.id, (current) => {
                              if (current.mode !== "aggregate") return current;
                              const nextSourceType = event.target.value as Extract<
                                BuilderCalculation,
                                { mode: "aggregate" }
                              >["sourceType"];
                              const nextSource = sourceOptions[nextSourceType][0];
                              return {
                                ...current,
                                sourceType: nextSourceType,
                                sourceId: nextSource?.id ?? "",
                                fieldKey: nextSource?.columns[0]?.key ?? null,
                              };
                            })
                          }
                          style={editorInputStyle()}
                        >
                          <option value="table">Tabla</option>
                          <option value="macro_table">Macrotabla</option>
                        </select>
                      </EditorField>
                      <EditorField label="Nodo origen">
                        <select
                          value={aggregateCalculation?.sourceId ?? ""}
                          onChange={(event) =>
                            updateCalculation(calculation.id, (current) => {
                              if (current.mode !== "aggregate") return current;
                              const nextSource = sourceOptions[current.sourceType].find(
                                (source) => source.id === event.target.value
                              );
                              return {
                                ...current,
                                sourceId: event.target.value,
                                fieldKey: nextSource?.columns[0]?.key ?? null,
                              };
                            })
                          }
                          style={editorInputStyle()}
                        >
                          <option value="">Sin seleccionar</option>
                          {aggregateSourceOptions.map((source) => (
                            <option key={source.id} value={source.id}>
                              {source.name}
                            </option>
                          ))}
                        </select>
                      </EditorField>
                      <EditorField label="Agregacion">
                        <select
                          value={aggregateCalculation?.aggregation ?? "sum"}
                          onChange={(event) =>
                            updateCalculation(calculation.id, (current) =>
                              current.mode === "aggregate"
                                ? {
                                  ...current,
                                  aggregation: event.target.value as Extract<
                                    BuilderCalculation,
                                    { mode: "aggregate" }
                                  >["aggregation"],
                                }
                                : current
                            )
                          }
                          style={editorInputStyle()}
                        >
                          <option value="sum">Suma</option>
                          <option value="avg">Promedio</option>
                          <option value="min">Minimo</option>
                          <option value="max">Maximo</option>
                          <option value="latest">Ultimo valor</option>
                          <option value="count_rows">Cantidad de filas</option>
                          <option value="count_non_empty">Cantidad no vacia</option>
                        </select>
                      </EditorField>
                      <EditorField label="Columna">
                        <select
                          value={aggregateCalculation?.fieldKey ?? ""}
                          onChange={(event) =>
                            updateCalculation(calculation.id, (current) =>
                              current.mode === "aggregate"
                                ? { ...current, fieldKey: event.target.value || null }
                                : current
                            )
                          }
                          disabled={aggregateCalculation?.aggregation === "count_rows"}
                          style={editorInputStyle()}
                        >
                          <option value="">Sin columna</option>
                          {(selectedSource?.columns ?? []).map((column) => (
                            <option key={column.key} value={column.key}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </EditorField>
                    </div>
                  ) : (
                    <>
                      <EditorField label="Expresion">
                        <textarea
                          value={calculation.expression}
                          onChange={(event) =>
                            updateCalculation(calculation.id, (current) =>
                              current.mode === "formula"
                                ? { ...current, expression: event.target.value }
                                : current
                            )
                          }
                          placeholder="ej: certificado_total / contrato_total * 100"
                          style={editorTextareaStyle()}
                        />
                      </EditorField>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: ".12em",
                            textTransform: "uppercase",
                            color: "var(--df-stone-500)",
                          }}
                        >
                          Inputs de formula
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateCalculation(calculation.id, (current) =>
                              current.mode === "formula"
                                ? {
                                  ...current,
                                  inputs: [
                                    ...current.inputs,
                                    {
                                      ...createFormulaInput(current.id),
                                      alias: `input_${current.inputs.length + 1}`,
                                    },
                                  ],
                                }
                                : current
                            )
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--df-orange)",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          + input
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {formulaCalculation && formulaCalculation.inputs.length > 0 ? (
                          formulaCalculation.inputs.map((input) => {
                            const selectedInputSource = getFormulaInputSource(input);
                            const inputSourceOptions: Array<BuilderTableSource | BuilderMacroSource> =
                              input.sourceType === "calculation" || input.sourceType === "obra_field"
                                ? []
                                : sourceOptions[input.sourceType];
                            const inputSourceType: BuilderSourceType =
                              input.sourceType === "macro_table" ? "macro_table" : "table";

                            return (
                              <div
                                key={input.id}
                                style={{
                                  borderRadius: 10,
                                  border: "1px solid var(--df-stone-200)",
                                  background: "var(--df-stone-50)",
                                  padding: 10,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--df-stone-700)" }}>
                                    Variable `{input.alias || "sin_alias"}`
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCalculation(calculation.id, (current) =>
                                        current.mode === "formula"
                                          ? {
                                            ...current,
                                            inputs: current.inputs.filter(
                                              (candidate) => candidate.id !== input.id
                                            ),
                                          }
                                          : current
                                      )
                                    }
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "#b91c1c",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Quitar
                                  </button>
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                                    gap: 8,
                                  }}
                                >
                                  <EditorField label="Alias">
                                    <input
                                      value={input.alias}
                                      onChange={(event) =>
                                        updateCalculation(calculation.id, (current) =>
                                          current.mode === "formula"
                                            ? {
                                              ...current,
                                              inputs: current.inputs.map((candidate) =>
                                                candidate.id === input.id
                                                  ? { ...candidate, alias: event.target.value }
                                                  : candidate
                                              ),
                                            }
                                            : current
                                        )
                                      }
                                      style={editorInputStyle()}
                                    />
                                  </EditorField>

                                  <EditorField label="Tipo de input">
                                    <select
                                      value={input.sourceType}
                                      onChange={(event) =>
                                        updateCalculation(calculation.id, (current) => {
                                          if (current.mode !== "formula") return current;
                                          const nextType = event.target.value as BuilderFormulaInputSourceType;
                                          return {
                                            ...current,
                                            inputs: current.inputs.map((candidate) =>
                                              candidate.id === input.id
                                                ? {
                                                  ...createFormulaInput(current.id, nextType),
                                                  id: candidate.id,
                                                  alias: candidate.alias,
                                                }
                                                : candidate
                                            ),
                                          };
                                        })
                                      }
                                      style={editorInputStyle()}
                                    >
                                      <option value="calculation">Otro calculo</option>
                                      <option value="obra_field">Campo de obra</option>
                                      {sourceOptions.table.length > 0 ? (
                                        <option value="table">Columna de tabla</option>
                                      ) : null}
                                      {sourceOptions.macro_table.length > 0 ? (
                                        <option value="macro_table">Columna de macrotabla</option>
                                      ) : null}
                                    </select>
                                  </EditorField>

                                  {input.sourceType === "calculation" ? (
                                    <EditorField label="Calculo origen">
                                      <select
                                        value={input.sourceId}
                                        onChange={(event) =>
                                          updateCalculation(calculation.id, (current) =>
                                            current.mode === "formula"
                                              ? {
                                                ...current,
                                                inputs: current.inputs.map((candidate) =>
                                                  candidate.id === input.id
                                                    ? { ...candidate, sourceId: event.target.value }
                                                    : candidate
                                                ),
                                              }
                                              : current
                                          )
                                        }
                                        style={editorInputStyle()}
                                      >
                                        <option value="">Sin calculo</option>
                                        {availableFormulaCalculations.map((candidate) => (
                                          <option key={candidate.id} value={candidate.id}>
                                            {candidate.label}
                                          </option>
                                        ))}
                                      </select>
                                    </EditorField>
                                  ) : input.sourceType === "obra_field" ? (
                                    <EditorField label="Campo de obra">
                                      <select
                                        value={input.sourceId}
                                        onChange={(event) =>
                                          updateCalculation(calculation.id, (current) =>
                                            current.mode === "formula"
                                              ? {
                                                ...current,
                                                inputs: current.inputs.map((candidate) =>
                                                  candidate.id === input.id
                                                    ? { ...candidate, sourceId: event.target.value }
                                                    : candidate
                                                ),
                                              }
                                              : current
                                          )
                                        }
                                        style={editorInputStyle()}
                                      >
                                        <option value="">Sin campo</option>
                                        {obraFieldOptions.map((field) => (
                                          <option key={field.id} value={field.id}>
                                            {field.label}
                                          </option>
                                        ))}
                                      </select>
                                    </EditorField>
                                  ) : (
                                    <>
                                      <EditorField label="Origen">
                                        <select
                                          value={input.sourceId}
                                          onChange={(event) =>
                                            updateCalculation(calculation.id, (current) => {
                                              if (current.mode !== "formula") return current;
                                              const nextSource =
                                                sourceOptions[inputSourceType].find(
                                                  (source: BuilderTableSource | BuilderMacroSource) =>
                                                    source.id === event.target.value
                                                ) ?? null;
                                              return {
                                                ...current,
                                                inputs: current.inputs.map((candidate) =>
                                                  candidate.id === input.id
                                                    ? {
                                                      ...candidate,
                                                      sourceId: event.target.value,
                                                      fieldKey: nextSource?.columns[0]?.key ?? null,
                                                    }
                                                    : candidate
                                                ),
                                              };
                                            })
                                          }
                                          style={editorInputStyle()}
                                        >
                                          <option value="">Sin seleccionar</option>
                                          {inputSourceOptions.map((source) => (
                                            <option key={source.id} value={source.id}>
                                              {source.name}
                                            </option>
                                          ))}
                                        </select>
                                      </EditorField>

                                      <EditorField label="Agregacion">
                                        <select
                                          value={input.aggregation ?? "sum"}
                                          onChange={(event) =>
                                            updateCalculation(calculation.id, (current) =>
                                              current.mode === "formula"
                                                ? {
                                                  ...current,
                                                  inputs: current.inputs.map((candidate) =>
                                                    candidate.id === input.id
                                                      ? {
                                                        ...candidate,
                                                        aggregation: event.target.value as BuilderAggregation,
                                                      }
                                                      : candidate
                                                  ),
                                                }
                                                : current
                                            )
                                          }
                                          style={editorInputStyle()}
                                        >
                                          {builderAggregationOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </EditorField>

                                      <EditorField label="Columna">
                                        <select
                                          value={input.fieldKey ?? ""}
                                          onChange={(event) =>
                                            updateCalculation(calculation.id, (current) =>
                                              current.mode === "formula"
                                                ? {
                                                  ...current,
                                                  inputs: current.inputs.map((candidate) =>
                                                    candidate.id === input.id
                                                      ? {
                                                        ...candidate,
                                                        fieldKey: event.target.value || null,
                                                      }
                                                      : candidate
                                                  ),
                                                }
                                                : current
                                            )
                                          }
                                          disabled={input.aggregation === "count_rows"}
                                          style={editorInputStyle()}
                                        >
                                          <option value="">Sin columna</option>
                                          {(selectedInputSource?.columns ?? []).map((column) => (
                                            <option key={column.key} value={column.key}>
                                              {column.label}
                                            </option>
                                          ))}
                                        </select>
                                      </EditorField>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ fontSize: 12, color: "var(--df-stone-500)" }}>
                            Agregá cálculos upstream para usarlos dentro de la expresión.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {evaluated?.formulaSummary?.length ? (
                    <div
                      style={{
                        borderRadius: 10,
                        background: "var(--df-stone-50)",
                        border: "1px solid var(--df-stone-200)",
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: ".12em",
                          textTransform: "uppercase",
                          color: "var(--df-stone-500)",
                        }}
                      >
                        Formula resuelta
                      </div>
                      {evaluated.formulaSummary.map((item) => (
                        <div key={item} style={{ fontSize: 12, color: "var(--df-stone-700)" }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : null}
                    </>
                  ) : null}
                </section>
              );
            })
          ) : tab === "calculations" ? (
            <div style={{ fontSize: 12, color: "var(--df-stone-500)" }}>
              Todavia no hay cálculos custom. Creá uno agregado o de formula.
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: 18,
            borderTop: "1px solid var(--df-stone-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--df-stone-500)" }}>
            {isTenantScope
              ? "Guarda para aplicar estos calculos base a todas las obras del tenant."
              : "Guarda para recomputar el grafo y reflejarlo en General."}
          </div>
          <button
            type="button"
            onClick={() => onSave()}
            disabled={saving}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 10,
              border: "none",
              background: "var(--df-orange)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={14} /> : <Check size={14} />}
            Guardar editor
          </button>
        </div>
    </aside>
  );
}

function UpstreamRow({
  node,
  onClick,
}: {
  node: DataFlowNode;
  onClick: () => void;
}) {
  const meta = nodeMeta(node.type);
  const Icon = meta.icon;
  const status = mapDemoStatus(node.status);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: "8px 10px",
        border: "1px solid var(--df-stone-200)",
        borderRadius: 8,
        background: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        textAlign: "left",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color }} />
      <Icon size={13} color={meta.color} />
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--df-stone-900)" }}>{node.label}</span>
      <span
        style={{
          fontSize: 12,
          color: "var(--df-stone-400)",
          textTransform: "uppercase",
          letterSpacing: ".1em",
          fontWeight: 600,
        }}
      >
        {meta.label}
      </span>
      <span style={{ marginLeft: "auto", color: "var(--df-stone-300)" }}>
        <ChevronRight size={12} />
      </span>
    </button>
  );
}

function InspectorPopover({
  node,
  anchor,
  upstreamNodes,
  onClose,
  onNavigate,
  onOpenTable,
  onOpenEditor,
}: {
  node: DataFlowNode | null;
  anchor: HTMLElement | null;
  upstreamNodes: DataFlowNode[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  onOpenTable: (tableNode: DataFlowNode) => void;
  onOpenEditor: (node: DataFlowNode) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, side: "right" as "right" | "left" });

  useEffect(() => {
    if (!node || !anchor || !ref.current) return;
    const compute = () => {
      const a = anchor.getBoundingClientRect();
      const popW = 340;
      const popH = ref.current?.offsetHeight ?? 320;
      const margin = 14;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = a.right + margin;
      let side: "right" | "left" = "right";
      if (left + popW > vw - 16) {
        const leftAlt = a.left - popW - margin;
        if (leftAlt >= 16) {
          left = leftAlt;
          side = "left";
        } else {
          left = Math.max(16, vw - popW - 16);
          side = "right";
        }
      }
      let top = a.top + a.height / 2 - popH / 2;
      top = Math.max(16, Math.min(vh - popH - 16, top));
      setPosition({ left, top, side });
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
  const meta = nodeMeta(node.type);
  const Icon = meta.icon;
  const status = mapDemoStatus(node.status);
  const isCustomCalculation = node.type === "calculation" && node.data.editorManaged === true;
  const customCalculationCopy =
    isCustomCalculation ? buildCustomCalculationInspectorCopy(node, upstreamNodes) : null;
  const metrics =
    node.type === "table"
      ? [
        { label: "Filas", value: formatNumber(node.data.rowCount) },
        { label: "Columnas", value: formatNumber(node.data.columnCount) },
        { label: "Procesados", value: formatNumber((node.data.processing as { completed?: number } | undefined)?.completed) },
      ]
      : node.type === "macro_table"
        ? [
          { label: "Fuentes", value: formatNumber(node.data.sourceCount) },
          { label: "Columnas", value: formatNumber(node.data.columnCount) },
        ]
        : node.type === "calculation"
          ? isCustomCalculation
            ? [
              { label: "Estado", value: statusLabel(node.status) },
              { label: "Inputs", value: String(upstreamNodes.length) },
              ...(typeof node.data.valueFormatted === "string"
                ? [{ label: "Valor", value: node.data.valueFormatted }]
                : []),
            ]
            : [
              { label: "Inputs", value: String(formatStringList(node.data.inputTableIds).length) },
              { label: "Senales", value: String(formatStringList(node.data.outputSignalKeys).length) },
              { label: "Hallazgos", value: formatNumber(node.data.openFindingCount) },
            ]
          : node.type === "document"
            ? [
              { label: "Origen", value: "OCR" },
              { label: "Tabla", value: String(node.data.tableLabel ?? "-") },
            ]
            : [
              {
                label: typeof node.data.resultValue === "string" ? "Valor" : "Dependencias",
                value: typeof node.data.resultValue === "string" ? node.data.resultValue : String(chipValue(node)),
              },
              { label: "Metricas", value: String(formatStringList(node.data.displayedMetrics).length) },
            ];

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: 340,
        background: "#fff",
        borderRadius: 12,
        border: "1px solid var(--df-stone-200)",
        boxShadow: "0 10px 30px rgba(28,25,23,.18)",
        zIndex: 60,
        animation: "data-flow-pop-in .18s ease-out",
      }}
    >
      <div
        style={{
          position: "absolute",
          [position.side === "right" ? "left" : "right"]: -6,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
          width: 12,
          height: 12,
          background: "#fff",
          borderLeft: position.side === "right" ? "1px solid var(--df-stone-200)" : "none",
          borderBottom: position.side === "right" ? "1px solid var(--df-stone-200)" : "none",
          borderRight: position.side === "left" ? "1px solid var(--df-stone-200)" : "none",
          borderTop: position.side === "left" ? "1px solid var(--df-stone-200)" : "none",
        }}
      />

      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--df-stone-100)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: meta.color,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: meta.color,
            }}
          >
            {meta.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--df-stone-900)", marginTop: 2, lineHeight: 1.25 }}>
            {node.label}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenEditor(node)}
          style={{
            height: 28,
            padding: "0 9px",
            borderRadius: 6,
            border: "1px solid var(--df-stone-200)",
            background: "#fff",
            color: "var(--df-stone-700)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <Pencil size={12} />
          Editar
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--df-stone-400)",
            padding: 4,
            display: "inline-flex",
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              padding: "4px 10px",
              background: "var(--df-panel-soft)",
              color: "var(--df-stone-700)",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color }} />
            {statusLabel(node.status)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginTop: 10 }}>
            {metrics.map((item) => (
              <div key={item.label} style={{ borderRadius: 10, background: "var(--df-stone-50)", padding: "10px 12px" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".15em", color: "var(--df-stone-400)", fontWeight: 700 }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: "var(--df-stone-900)" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {node.type === "view" ? (
          <>
            <InspectorSection title="Vista real">
              <p style={{ margin: 0, fontSize: 12, color: "var(--df-stone-700)", lineHeight: 1.5 }}>
                {String(node.data.projectedReason ?? "La vista existe en producto y este mapa la conecta con sus dependencias actuales.")}
              </p>
              {typeof node.data.resultDetail === "string" ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    background: "var(--df-orange-soft)",
                    border: "1px solid var(--df-orange-border)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#9a4c08",
                  }}
                >
                  {node.data.resultDetail}
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  background: "var(--df-stone-50)",
                  border: "1px solid var(--df-stone-200)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--df-stone-700)",
                }}
              >
                {String(node.data.location ?? "Sin ubicacion declarada")}
              </div>
              {typeof node.data.route === "string" ? (
                <Link
                  href={node.data.route}
                  prefetch={false}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 10,
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "linear-gradient(180deg,#201E25,#323137)",
                    color: "#fafafa",
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Abrir vista
                  <ExternalLink size={13} />
                </Link>
              ) : null}
            </InspectorSection>
            <InspectorSection title="Trazabilidad upstream">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {upstreamNodes.length > 0 ? upstreamNodes.map((upstream) => (
                  <UpstreamRow key={upstream.id} node={upstream} onClick={() => onNavigate(upstream.id)} />
                )) : <div style={{ fontSize: 12, color: "var(--df-stone-500)" }}>Sin dependencias visibles.</div>}
              </div>
            </InspectorSection>
          </>
        ) : null}

        {node.type === "calculation" ? (
          <>
            {typeof node.data.description === "string" && node.data.description.trim().length > 0 ? (
              <InspectorSection title="Que representa">
                <p style={{ margin: 0, fontSize: 12, color: "var(--df-stone-700)", lineHeight: 1.5 }}>
                  {node.data.description}
                </p>
              </InspectorSection>
            ) : null}
            {isCustomCalculation && customCalculationCopy ? (
              <>
                {customCalculationCopy.variableDescriptions.length > 0 ? (
                  <InspectorSection title="Variables">
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {customCalculationCopy.variableDescriptions.map((item) => (
                        <div
                          key={`${item.alias}:${item.description}`}
                          style={{
                            borderRadius: 8,
                            border: "1px solid var(--df-stone-200)",
                            background: "var(--df-stone-50)",
                            padding: "8px 10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: ".12em",
                              color: "var(--df-stone-400)",
                              fontWeight: 700,
                            }}
                          >
                            {item.alias}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--df-stone-700)", lineHeight: 1.45 }}>
                            {capitalize(item.description)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </InspectorSection>
                ) : null}
              </>
            ) : formatStringList(node.data.formulaSummary).length > 0 ? (
              <InspectorSection title="Formula">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {formatStringList(node.data.formulaSummary).map((formula) => (
                    <div
                      key={formula}
                      style={{
                        borderRadius: 8,
                        border: "1px solid var(--df-stone-200)",
                        background: "var(--df-stone-50)",
                        padding: "8px 10px",
                        fontSize: 12,
                        color: "var(--df-stone-700)",
                        lineHeight: 1.45,
                      }}
                    >
                      {formula}
                    </div>
                  ))}
                </div>
              </InspectorSection>
            ) : null}
            <InspectorSection title="Inputs">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {upstreamNodes.length > 0 ? upstreamNodes.map((upstream) => (
                  <UpstreamRow key={upstream.id} node={upstream} onClick={() => onNavigate(upstream.id)} />
                )) : <div style={{ fontSize: 12, color: "var(--df-stone-500)" }}>Sin inputs declarados.</div>}
              </div>
            </InspectorSection>
          </>
        ) : null}

        {node.type === "macro_table" ? (
          <>
            <InspectorSection title="Consolidacion">
              <p style={{ margin: 0, fontSize: 12, color: "var(--df-stone-700)", lineHeight: 1.5 }}>
                {String(node.data.description ?? "Consolida tablas reales de la obra para alimentar capas superiores.")}
              </p>
            </InspectorSection>
            <InspectorSection title="Tablas fuente">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {upstreamNodes.map((upstream) => (
                  <UpstreamRow key={upstream.id} node={upstream} onClick={() => onNavigate(upstream.id)} />
                ))}
              </div>
            </InspectorSection>
          </>
        ) : null}

        {node.type === "table" ? (
          <>
            <InspectorSection title="Origen documental">
              <div
                style={{
                  padding: "8px 10px",
                  background: "var(--df-stone-50)",
                  border: "1px solid var(--df-stone-200)",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--df-stone-700)",
                }}
              >
                <FolderOpen size={14} />
                <span>{formatStringList(node.data.sourceFolderLabels).join(", ") || "Sin carpeta declarada"}</span>
              </div>
            </InspectorSection>
            <button
              type="button"
              onClick={() => onOpenTable(node)}
              style={{
                background: "linear-gradient(180deg,#201E25,#323137)",
                color: "#fafafa",
                border: "none",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              Ver filas y documentos
              <ChevronRight size={13} />
            </button>
          </>
        ) : null}

        {node.type === "document" ? (
          <>
            <InspectorSection title="Carpeta origen">
              <div
                style={{
                  padding: "8px 10px",
                  background: "var(--df-stone-50)",
                  border: "1px solid var(--df-stone-200)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--df-stone-700)",
                }}
              >
                {String(node.data.folderPath ?? node.data.folderLabel ?? "Sin carpeta declarada")}
              </div>
            </InspectorSection>
            {typeof node.data.tableLabel === "string" ? (
              <InspectorSection title="Tabla consumidora">
                <div
                  style={{
                    padding: "8px 10px",
                    background: "var(--df-stone-50)",
                    border: "1px solid var(--df-stone-200)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--df-stone-700)",
                  }}
                >
                  {String(node.data.tableLabel)}
                </div>
              </InspectorSection>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".15em",
          textTransform: "uppercase",
          color: "var(--df-stone-400)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function TableDrawer({
  obraId,
  tableNode,
  open,
  onClose,
  onOpenDocument,
}: {
  obraId: string;
  tableNode: DataFlowNode | null;
  open: boolean;
  onClose: () => void;
  onOpenDocument: (payload: SelectedDocument) => void;
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
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la tabla.");
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

  if (!open || !tableNode) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(28,25,23,.32)",
          zIndex: 70,
          animation: "data-flow-fade-in .2s ease-out",
        }}
      />
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: 920,
          maxWidth: "96vw",
          background: "#fff",
          zIndex: 71,
          boxShadow: "-20px 0 50px rgba(0,0,0,.18)",
          display: "flex",
          flexDirection: "column",
          animation: "data-flow-slide-in .26s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--df-stone-200)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--df-stone-900)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Database size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                color: "var(--df-stone-400)",
              }}
            >
              Tabla
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--df-stone-900)" }}>{tableNode.label}</div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              fontSize: 12,
              color: "var(--df-stone-500)",
              fontVariantNumeric: "tabular-nums",
              marginRight: 8,
            }}
          >
            <span>
              <strong style={{ color: "var(--df-stone-800)" }}>{formatNumber(tableNode.data.rowCount)}</strong> filas
            </span>
            <span>
              <strong style={{ color: "var(--df-stone-800)" }}>{formatNumber(tableNode.data.columnCount)}</strong> cols
            </span>
            <span>
              <strong style={{ color: "var(--df-stone-800)" }}>{documents.length}</strong> docs
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--df-stone-500)",
              padding: 6,
              display: "inline-flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 20,
            display: "grid",
            gridTemplateColumns: "minmax(0,1.4fr) 320px",
            gap: 20,
            background: "var(--df-panel-soft)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {loading ? (
              <div
                style={{
                  border: "1px solid var(--df-stone-200)",
                  borderRadius: 12,
                  background: "#fff",
                  padding: "32px 24px",
                  textAlign: "center",
                  color: "var(--df-stone-500)",
                  fontSize: 14,
                }}
              >
                <Loader2 size={18} style={{ margin: "0 auto 10px", animation: "spin 1s linear infinite" }} />
                Cargando detalle de tabla&hellip;
              </div>
            ) : error ? (
              <div
                style={{
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  background: "#fef2f2",
                  padding: "16px 18px",
                  color: "#991b1b",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid var(--df-stone-200)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--df-stone-200)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--df-stone-400)" }}>
                    Filas reales
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--df-stone-500)" }}>Preview del dataset actual.</div>
                </div>

                <div style={{ overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {rowColumns.map((column) => (
                          <th
                            key={column.key}
                            style={{
                              textAlign: "left",
                              padding: "9px 12px",
                              fontWeight: 700,
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: ".12em",
                              color: "#5b616b",
                              background: "#f1f3f6",
                              borderBottom: "2px solid #c7cbd3",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {column.label}
                          </th>
                        ))}
                        <th
                          style={{
                            textAlign: "left",
                            padding: "9px 12px",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                            letterSpacing: ".12em",
                            color: "#5b616b",
                            background: "#f1f3f6",
                            borderBottom: "2px solid #c7cbd3",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Version
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length > 0 ? (
                        rows.map((row, index) => (
                          <tr key={row.id} style={{ background: index % 2 ? "#fafaf9" : "#fff" }}>
                            {rowColumns.map((column) => (
                              <td
                                key={`${row.id}:${column.key}`}
                                style={{
                                  padding: "8px 12px",
                                  borderBottom: "1px solid #e1e4ea",
                                  color: "#1f2328",
                                  whiteSpace: "nowrap",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {summarizeValue(row.data?.[column.key])}
                              </td>
                            ))}
                            <td
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #e1e4ea",
                                color: "#1f2328",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.materialization_version ?? "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={rowColumns.length + 1}
                            style={{
                              padding: "28px 12px",
                              textAlign: "center",
                              color: "var(--df-stone-500)",
                            }}
                          >
                            No hay filas visibles para esta tabla.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                border: "1px solid var(--df-stone-200)",
                borderRadius: 12,
                background: "#fff",
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--df-stone-400)" }}>
                Documentos
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--df-stone-500)" }}>Procesamientos OCR vinculados a la tabla.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {documents.length > 0 ? (
                  documents.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => onOpenDocument({ tableLabel: tableNode.label, document })}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--df-stone-200)",
                        borderRadius: 8,
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 40,
                          borderRadius: 4,
                          background: "#f5f5f4",
                          color: "var(--df-stone-700)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          border: "1px solid var(--df-stone-300)",
                        }}
                      >
                        <FileText size={14} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: "var(--df-stone-900)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {document.source_file_name ?? document.source_path ?? document.id}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "var(--df-stone-500)",
                            marginTop: 2,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatDateLabel(document.processed_at ?? document.created_at)}
                        </span>
                      </span>
                      <span style={{ color: "var(--df-stone-400)" }}>
                        <Eye size={14} />
                      </span>
                    </button>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: "var(--df-stone-500)", padding: "12px 0" }}>
                    Sin documentos listados para esta tabla.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DocumentPreviewModal({
  obraId,
  selected,
  onClose,
}: {
  obraId: string;
  selected: SelectedDocument | null;
  onClose: () => void;
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

    const resolvedSourcePath = sourcePath;
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

  if (!selected) return null;

  const path = selected.document.source_path ?? "";
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(extension);
  const isPdf = extension === "pdf";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,25,23,.55)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        animation: "data-flow-fade-in .2s ease-out",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 980,
          maxWidth: "100%",
          maxHeight: "100%",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 30px 80px rgba(0,0,0,.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "data-flow-pop-in .22s ease-out",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--df-stone-200)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fafaf9",
          }}
        >
          <div
            style={{
              width: 28,
              height: 36,
              borderRadius: 3,
              background: "#f5f5f4",
              color: "var(--df-stone-700)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--df-stone-300)",
            }}
          >
            <FileText size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--df-stone-900)" }}>
              {selected.document.source_file_name ?? selected.document.source_path ?? "Documento"}
            </div>
            <div style={{ fontSize: 12, color: "var(--df-stone-500)", fontVariantNumeric: "tabular-nums" }}>
              {selected.tableLabel} · {selected.document.source_path ?? "Sin path"}
            </div>
          </div>
          {signedUrl ? (
            <a
              href={`${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=1`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: "#fff",
                border: "1px solid var(--df-stone-200)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--df-stone-700)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                textDecoration: "none",
              }}
            >
              <Download size={12} />
              Descargar
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--df-stone-500)",
              padding: 4,
              display: "inline-flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", minHeight: "70vh" }}>
          <div
            style={{
              padding: 24,
              background: "var(--df-stone-100)",
              overflow: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                minHeight: 520,
                borderRadius: 16,
                border: "1px solid var(--df-stone-200)",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {loading ? (
                <div style={{ textAlign: "center", fontSize: 13, color: "var(--df-stone-500)" }}>
                  <Loader2 size={18} style={{ margin: "0 auto 10px" }} />
                  Generando acceso al documento&hellip;
                </div>
              ) : error ? (
                <div
                  style={{
                    maxWidth: 420,
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    padding: "16px 18px",
                    color: "#991b1b",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              ) : signedUrl ? (
                isImage ? (
                  <img
                    src={signedUrl}
                    alt={selected.document.source_file_name ?? "Documento"}
                    style={{ maxWidth: "100%", maxHeight: "68vh", objectFit: "contain" }}
                  />
                ) : isPdf ? (
                  <iframe title={selected.document.source_file_name ?? "Documento"} src={signedUrl} style={{ width: "100%", height: "68vh", border: 0 }} />
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <FileText size={48} color="var(--df-stone-400)" />
                    <p style={{ marginTop: 12, fontSize: 13, color: "var(--df-stone-600)" }}>El archivo no tiene preview embebido.</p>
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "linear-gradient(180deg,#201E25,#323137)",
                        color: "#fafafa",
                        textDecoration: "none",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Abrir documento
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )
              ) : (
                <div style={{ fontSize: 13, color: "var(--df-stone-500)" }}>No hay preview disponible.</div>
              )}
            </div>
          </div>

          <div style={{ borderLeft: "1px solid var(--df-stone-200)", padding: 20, background: "#fff" }}>
            <InspectorSection title="Metadata">
              <div style={{ display: "grid", gap: 8, fontSize: 12, color: "var(--df-stone-700)" }}>
                <div><strong style={{ color: "var(--df-stone-900)" }}>Estado:</strong> {selected.document.status ?? "-"}</div>
                <div><strong style={{ color: "var(--df-stone-900)" }}>Filas extraidas:</strong> {selected.document.rows_extracted ?? "-"}</div>
                <div><strong style={{ color: "var(--df-stone-900)" }}>Procesado:</strong> {formatDateLabel(selected.document.processed_at ?? selected.document.created_at)}</div>
              </div>
            </InspectorSection>

            {selected.document.error_code ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 12,
                  border: "1px solid #fde68a",
                  background: "#fffbeb",
                  padding: "12px 14px",
                  color: "#92400e",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700 }}>{selected.document.error_code}</div>
                {selected.document.error_message ? <div style={{ marginTop: 6 }}>{selected.document.error_message}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildLayoutGridItems(blocks: BuilderGeneralTabLayoutBlock[]): ReactGridLayoutItems {
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  return blocks
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((block, index) => {
      const w = layoutWidthToGridColumns(block.width);
      const h = block.gridH ?? defaultLayoutGridHeight(block.type);
      const hasStoredPosition =
        typeof block.gridX === "number" &&
        Number.isFinite(block.gridX) &&
        typeof block.gridY === "number" &&
        Number.isFinite(block.gridY);

      if (!hasStoredPosition && cursorX + w > GENERAL_LAYOUT_GRID_COLS) {
        cursorX = 0;
        cursorY += Math.max(rowHeight, 1);
        rowHeight = 0;
      }

      const x = hasStoredPosition ? Math.max(0, Math.min(GENERAL_LAYOUT_GRID_COLS - w, block.gridX ?? 0)) : cursorX;
      const y = hasStoredPosition ? Math.max(0, block.gridY ?? index) : cursorY;
      if (!hasStoredPosition) {
        cursorX += w;
        rowHeight = Math.max(rowHeight, h);
      }

      return {
        i: block.id,
        x,
        y,
        w,
        h,
        minW: 3,
        minH: 2,
        maxW: GENERAL_LAYOUT_GRID_COLS,
      };
    });
}

function DataFlowLayoutWorkspace({
  config,
  payload,
  saving,
  error,
  onConfigChange,
  onSave,
  onOpenAdvancedEditor,
}: {
  config: BuilderConfig;
  payload: DataFlowConfigPayload | null;
  saving: boolean;
  error: string | null;
  onConfigChange: (config: BuilderConfig) => void;
  onSave: () => void;
  onOpenAdvancedEditor: () => void;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(1160);
  const canWrite = payload?.canWrite !== false;
  const editableBlocks =
    config.generalTabLayout.length > 0
      ? config.generalTabLayout
      : payload?.effectiveConfig?.generalTabLayout ??
      payload?.inheritedConfig?.generalTabLayout ??
      [];
  const orderedBlocks = editableBlocks.slice().sort((left, right) => left.order - right.order);
  const gridItems = useMemo(() => buildLayoutGridItems(orderedBlocks), [orderedBlocks]);
  const evaluatedResultById = useMemo(
    () => new Map((payload?.evaluated?.results ?? []).map((result) => [result.id, result])),
    [payload?.evaluated?.results]
  );
  const resultOptions = useMemo(() => {
    const byId = new Map<string, BuilderResult>();
    for (const result of payload?.inheritedConfig?.results ?? []) byId.set(result.id, result);
    for (const result of config.results) byId.set(result.id, result);
    return [...byId.values()].sort((left, right) => left.generalTabOrder - right.generalTabOrder);
  }, [config.results, payload?.inheritedConfig?.results]);

  useEffect(() => {
    const element = gridRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 1160;
      setGridWidth(Math.max(760, width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function applyGridLayout(nextLayout: ReactGridLayoutItems) {
    if (!canWrite) return;
    const itemById = new Map(nextLayout.map((item) => [item.i, item]));
    const orderedIds = nextLayout
      .slice()
      .sort((left, right) => left.y - right.y || left.x - right.x)
      .map((item) => item.i);
    const orderById = new Map(orderedIds.map((id, index) => [id, index + 1]));
    const nextBlocks = editableBlocks.map((block) => {
      const item = itemById.get(block.id);
      if (!item) return block;
      return {
        ...block,
        order: orderById.get(block.id) ?? block.order,
        width: gridColumnsToLayoutWidth(item.w),
        gridX: Math.max(0, item.x),
        gridY: Math.max(0, item.y),
        gridH: Math.max(2, item.h),
      };
    });
    onConfigChange({ ...config, generalTabLayout: nextBlocks });
  }

  function addResultBlock() {
    if (!canWrite) return;
    const usedResultIds = new Set(editableBlocks.map((block) => block.resultId).filter(Boolean));
    const firstResult = resultOptions.find((result) => !usedResultIds.has(result.id)) ?? resultOptions[0];
    const maxY = Math.max(0, ...gridItems.map((item) => item.y + item.h));
    onConfigChange({
      ...config,
      generalTabLayout: [
        ...editableBlocks,
        {
          id: `layout_${Date.now().toString(36)}`,
          type: "custom_result",
          label: firstResult?.label ?? "Nuevo resultado",
          enabled: true,
          order: editableBlocks.length + 1,
          width: "half",
          gridX: 0,
          gridY: maxY,
          gridH: 3,
          resultId: firstResult?.id ?? null,
          fieldIds: [],
        },
      ],
    });
  }

  function getBlockTypeLabel(type: BuilderGeneralTabLayoutBlockType) {
    if (type === "progress") return "Avance";
    if (type === "curve") return "Curva";
    if (type === "general_info") return "Informacion";
    if (type === "financial") return "Finanzas";
    if (type === "configured_fields") return "Campos";
    if (type === "certificates") return "Certificados";
    return "Resultado";
  }

  function renderBlockBody(block: BuilderGeneralTabLayoutBlock) {
    if (block.type === "progress") {
      const progress = evaluatedResultById.get("default_result_progress")?.formattedValue ?? "63%";
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
            <div
              style={{
                width: 86,
                height: 86,
                borderRadius: "50%",
                border: "16px solid #e7e5e4",
                borderTopColor: "var(--df-orange)",
                borderRightColor: "var(--df-orange)",
                display: "grid",
                placeItems: "center",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {progress}
            </div>
          </div>
          <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 8, padding: 10, color: "#92400e", fontSize: 12 }}>
            Alertas detectadas
          </div>
        </div>
      );
    }
    if (block.type === "curve") {
      return (
        <div style={{ height: "100%", minHeight: 150, border: "1px solid var(--df-stone-200)", borderRadius: 8, padding: 14, display: "flex", alignItems: "end", gap: 10 }}>
          {[28, 44, 38, 62, 58, 74, 69].map((height, index) => (
            <span key={index} style={{ flex: 1, height: `${height}%`, borderRadius: 999, background: index % 2 ? "var(--df-orange)" : "#0ea5e9", opacity: 0.82 }} />
          ))}
        </div>
      );
    }
    if (block.type === "financial") {
      const ids = block.fieldIds.length > 0 && !block.fieldIds.includes("__none")
        ? block.fieldIds
        : ["default_result_contract", "default_result_certified", "default_result_balance"];
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {ids.slice(0, 6).map((id) => {
            const result = evaluatedResultById.get(id);
            return (
              <div key={id} style={{ border: "1px solid var(--df-stone-200)", borderRadius: 8, padding: 10, minWidth: 0 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", color: "var(--df-stone-400)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {result?.label ?? humanizeFieldKey(id)}
                </div>
                <div style={{ marginTop: 5, fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {result?.formattedValue ?? "$ 0"}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (block.type === "custom_result") {
      const result = block.resultId ? evaluatedResultById.get(block.resultId) : null;
      return (
        <div style={{ border: "1px solid var(--df-stone-200)", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{result?.formattedValue ?? "Sin resultado"}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--df-stone-500)" }}>{result?.label ?? "Selecciona un resultado"}</div>
        </div>
      );
    }
    if (block.type === "general_info") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {["Designacion", "Entidad", "Inicio", "N de obra"].map((label) => (
            <div key={label} style={{ border: "1px solid var(--df-stone-200)", borderRadius: 8, padding: 9, fontSize: 12 }}>
              <div style={{ color: "var(--df-stone-400)" }}>{label}</div>
              <div style={{ marginTop: 4, fontWeight: 700 }}>Campo</div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ border: "1px dashed var(--df-stone-200)", borderRadius: 8, padding: 14, fontSize: 12, color: "var(--df-stone-500)" }}>
        {block.type === "configured_fields" ? "Campos configurados" : "Tabla de certificados"}
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--df-stone-200)",
        borderRadius: 14,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--df-stone-200)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--df-stone-900)" }}>Editor visual del layout General</div>
          <div style={{ marginTop: 3, fontSize: 12, color: "var(--df-stone-500)" }}>
            Arrastra bloques para moverlos. Usa el borde inferior derecho para cambiar ancho y alto.
          </div>
        </div>
        {error ? <span style={{ fontSize: 12, color: "#b91c1c" }}>{error}</span> : null}
        <button
          type="button"
          onClick={addResultBlock}
          disabled={!canWrite || resultOptions.length === 0}
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--df-stone-200)",
            background: "#fff",
            color: "var(--df-stone-700)",
            fontSize: 12,
            fontWeight: 600,
            cursor: canWrite ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={13} />
          Agregar resultado
        </button>
        <button
          type="button"
          onClick={onOpenAdvancedEditor}
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--df-stone-200)",
            background: "#fff",
            color: "var(--df-stone-700)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Editor avanzado
        </button>
        <button
          type="button"
          onClick={() => onSave()}
          disabled={!canWrite || saving}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 8,
            border: "1px solid transparent",
            background: "var(--df-orange)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: canWrite && !saving ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {saving ? <Loader2 size={13} /> : <Check size={13} />}
          Guardar layout
        </button>
      </div>

      <div ref={gridRef} style={{ padding: 14, background: "var(--df-panel-soft)" }}>
        {orderedBlocks.length > 0 && gridWidth > 0 ? (
          <GridLayout
            className="df-layout-grid"
            width={gridWidth}
            layout={gridItems}
            gridConfig={{
              cols: GENERAL_LAYOUT_GRID_COLS,
              rowHeight: GENERAL_LAYOUT_ROW_HEIGHT,
              margin: [GENERAL_LAYOUT_GRID_GAP, GENERAL_LAYOUT_GRID_GAP],
              containerPadding: [0, 0],
              maxRows: 80,
            }}
            dragConfig={{
              enabled: canWrite,
              handle: ".df-layout-drag-handle",
              cancel: "button, input, select, textarea, a",
              bounded: true,
              threshold: 3,
            }}
            resizeConfig={{
              enabled: canWrite,
              handles: ["se", "e", "s"],
            }}
            onDragStop={(layout) => applyGridLayout(layout)}
            onResizeStop={(layout) => applyGridLayout(layout)}
            autoSize
          >
            {orderedBlocks.map((block) => {
              const Icon = getLayoutBlockIcon(block.type);
              return (
                <div key={block.id}>
                  <section
                    style={{
                      height: "100%",
                      minHeight: 0,
                      borderRadius: 12,
                      border: "1px solid var(--df-stone-200)",
                      background: block.enabled ? "#fff" : "var(--df-stone-100)",
                      boxShadow: "0 1px 0 rgba(0,0,0,.03)",
                      overflow: "hidden",
                      opacity: block.enabled ? 1 : 0.58,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <header
                      className="df-layout-drag-handle"
                      style={{
                        minHeight: 46,
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--df-stone-100)",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        cursor: canWrite ? "grab" : "default",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "var(--df-orange-soft)",
                          color: "var(--df-orange)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={14} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--df-stone-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {block.label}
                        </div>
                        <div style={{ marginTop: 1, fontSize: 12, color: "var(--df-stone-500)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>
                          {getBlockTypeLabel(block.type)}
                        </div>
                      </div>
                    </header>
                    <div style={{ padding: 12, flex: 1, overflow: "hidden" }}>{renderBlockBody(block)}</div>
                  </section>
                </div>
              );
            })}
          </GridLayout>
        ) : (
          <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "var(--df-stone-500)" }}>
            Todavia no hay bloques de layout. Abri el editor avanzado para agregar el primero.
          </div>
        )}
      </div>
    </div>
  );
}

export function DataFlowPageClient({
  scope,
  graphEndpoint,
  configEndpoint,
  backHref,
  backLabel,
  breadcrumbRoot = "Obras",
}: {
  scope: "obra" | "tenant";
  graphEndpoint: string;
  configEndpoint: string;
  backHref: string;
  backLabel: string;
  breadcrumbRoot?: string;
}) {
  const [payload, setPayload] = useState<DataFlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState<"trace" | "layout">("trace");
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("system");
  const [focusViewId, setFocusViewId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorAnchor, setInspectorAnchor] = useState<HTMLElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [openedTableNode, setOpenedTableNode] = useState<DataFlowNode | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [showTweaks, setShowTweaks] = useState(false);
  const [showCalculations, setShowCalculations] = useState(true);
  const [showDocuments, setShowDocuments] = useState(true);
  const [layoutDirection, setLayoutDirection] = useState<CanvasDirection>("horizontal");
  const [resultVisualStyle, setResultVisualStyle] = useState<ResultVisualStyle>("card");
  const [calculationNodeVariant, setCalculationNodeVariant] = useState<CalculationNodeVariant>("stacked");
  const [edgeVisualStyle, setEdgeVisualStyle] = useState<EdgeVisualStyle>("curve");
  const [activeResultColor, setActiveResultColor] = useState<ActiveResultColor>("orange");
  const [quickInputSelection, setQuickInputSelection] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<DataFlowEditorTarget | null>(null);
  const [configPayload, setConfigPayload] = useState<DataFlowConfigPayload | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [writebackPlan, setWritebackPlan] = useState<DataFlowWritebackPlan | null>(null);
  const [suggestions, setSuggestions] = useState<DataFlowSuggestion[]>([]);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const obraId = scope === "obra" && payload?.obra.id ? payload.obra.id : "";

  const canvasOuterRef = useRef<HTMLDivElement | null>(null);
  const tweaksRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const resultRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(graphEndpoint, { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof result?.error === "string" ? result.error : "No se pudo cargar el flujo de datos.");
        }
        if (cancelled) return;
        const typed = result as DataFlowPayload;
        setPayload(typed);

        const firstView =
          typed.nodes.find((node) => node.type === "view" && node.data.hiddenInResultsBar !== true)?.id ??
          typed.nodes.find((node) => node.type === "view")?.id ??
          null;
        setFocusViewId((current) => (current && typed.nodes.some((node) => node.id === current) ? current : firstView));
        setSelectedNodeId((current) =>
          current && typed.nodes.some((node) => node.id === current)
            ? current
            : firstView ?? typed.nodes[0]?.id ?? null
        );
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
  }, [graphEndpoint, refreshToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setConfigError(null);
      try {
        const response = await fetch(configEndpoint, {
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof result?.error === "string"
              ? result.error
              : "No se pudo cargar el editor de data-flow."
          );
        }
        if (!cancelled) {
          const typed = result as DataFlowConfigPayload;
          setConfigPayload(typed);
          setWritebackPlan(typed.writebackPlan ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setConfigError(
            loadError instanceof Error ? loadError.message : "No se pudo cargar el editor."
          );
        }
      }
    }

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [configEndpoint, refreshToken]);

  useEffect(() => {
    if (scope !== "obra" || !obraId) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;

    async function loadSuggestions() {
      setSuggestionsError(null);
      try {
        const response = await fetch(`/api/obras/${obraId}/data-flow-suggestions`, { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof result?.error === "string" ? result.error : "No se pudieron cargar sugerencias.");
        }
        if (!cancelled) {
          setSuggestions((result?.suggestions ?? []) as DataFlowSuggestion[]);
        }
      } catch (suggestionError) {
        if (!cancelled) {
          setSuggestionsError(
            suggestionError instanceof Error ? suggestionError.message : "No se pudieron cargar sugerencias."
          );
        }
      }
    }

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [scope, obraId, refreshToken]);

  useEffect(() => {
    const element = canvasOuterRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 1200;
      setCanvasWidth(Math.max(920, nextWidth));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!showTweaks) return;
    function handlePointerDown(event: MouseEvent) {
      if (tweaksRef.current && event.target instanceof Node && !tweaksRef.current.contains(event.target)) {
        setShowTweaks(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showTweaks]);

  const allNodes = useMemo(() => payload?.nodes ?? [], [payload]);
  const allEdges = useMemo(() => payload?.edges ?? [], [payload]);
  const displayGraph = useMemo(
    () =>
      buildDisplayGraph(allNodes, allEdges, {
        showCalculations,
        showDocuments,
      }),
    [allEdges, allNodes, showCalculations, showDocuments]
  );
  const displayNodes = useMemo(() => displayGraph.nodes, [displayGraph]);
  const viewNodes = useMemo(() => displayGraph.allViews, [displayGraph]);
  const resultNodes = useMemo(() => displayGraph.resultNodes, [displayGraph]);
  const displayEdges = useMemo(() => displayGraph.edges, [displayGraph]);
  const visibleNodeIds = useMemo(
    () => buildVisibleSet({ mode: canvasMode, focusViewId, nodes: displayNodes, displayEdges }),
    [canvasMode, displayEdges, displayNodes, focusViewId]
  );

  const graphNodes = useMemo(
    () =>
      displayNodes.filter(
        (node) =>
          visibleNodeIds.has(node.id) &&
          (node.type !== "view" || node.data.hiddenInResultsBar !== true || node.id === focusViewId)
      ),
    [displayNodes, focusViewId, visibleNodeIds]
  );
  const graphNodeIds = useMemo(() => new Set(graphNodes.map((node) => node.id)), [graphNodes]);
  const filteredDisplayEdges = useMemo(
    () => displayEdges.filter((edge) => graphNodeIds.has(edge.from) && graphNodeIds.has(edge.to)),
    [displayEdges, graphNodeIds]
  );

  const nodeById = useMemo(() => new Map(displayNodes.map((node) => [node.id, node])), [displayNodes]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const hoverNode = hover ? nodeById.get(hover.nodeId) ?? null : null;
  const connectedNodeIds = useMemo(() => buildConnectedSet(selectedNodeId, filteredDisplayEdges), [filteredDisplayEdges, selectedNodeId]);
  const activeEdgeIds = useMemo(
    () =>
      new Set(
        filteredDisplayEdges
          .filter((edge) => connectedNodeIds.has(edge.from) && connectedNodeIds.has(edge.to))
          .map((edge) => edge.id)
      ),
    [connectedNodeIds, filteredDisplayEdges]
  );
  const activeTokens = getActiveColorTokens(activeResultColor);
  const canWriteDataFlow = configPayload?.canWrite !== false;
  const obraFieldLabelById = useMemo(
    () => new Map((configPayload?.sources.obraFields ?? []).map((field) => [field.id, field.label])),
    [configPayload?.sources.obraFields]
  );
  const pendingSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.status === "pending"),
    [suggestions]
  );
  const sourceTableNodeById = useMemo(() => {
    const map = new Map<string, DataFlowNode>();
    for (const node of allNodes) {
      if (node.type !== "table") continue;
      const tableId = typeof node.data.tableId === "string" ? node.data.tableId : node.id.replace(/^table:/, "");
      map.set(tableId, node);
      if (typeof node.data.defaultTableId === "string") map.set(node.data.defaultTableId, node);
    }
    return map;
  }, [allNodes]);
  const effectiveBuilderCalculations = useMemo(() => {
    const byId = new Map<string, BuilderCalculation>();
    for (const calculation of configPayload?.inheritedConfig?.calculations ?? []) byId.set(calculation.id, calculation);
    for (const calculation of configPayload?.effectiveConfig?.calculations ?? []) byId.set(calculation.id, calculation);
    for (const calculation of configPayload?.config.calculations ?? []) byId.set(calculation.id, calculation);
    return [...byId.values()];
  }, [configPayload]);
  const quickInputOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; group: string }> = [];
    for (const table of configPayload?.sources.tables ?? []) {
      const graphNode = sourceTableNodeById.get(table.id);
      const folderLabel = [...formatStringList(graphNode?.data.sourceFolderLabels), ...formatStringList(graphNode?.data.sourceFolders)][0];
      options.push({
        value: `table:${table.id}`,
        label: folderLabel ? `${folderLabel} -> ${table.name}` : table.name,
        group: "Carpetas / tablas",
      });
    }
    for (const macro of configPayload?.sources.macroTables ?? []) {
      options.push({ value: `macro_table:${macro.id}`, label: macro.name, group: "Macrotablas" });
    }
    for (const field of configPayload?.sources.obraFields ?? []) {
      options.push({ value: `obra_field:${field.id}`, label: field.label, group: "Campos de obra" });
    }
    for (const calculation of effectiveBuilderCalculations) {
      options.push({ value: `calculation:${calculation.id}`, label: calculation.label, group: "Calculos" });
    }
    return options;
  }, [configPayload?.sources.macroTables, configPayload?.sources.obraFields, configPayload?.sources.tables, effectiveBuilderCalculations, sourceTableNodeById]);

  useEffect(() => {
    if (quickInputSelection && quickInputOptions.some((option) => option.value === quickInputSelection)) return;
    setQuickInputSelection(quickInputOptions[0]?.value ?? "");
  }, [quickInputOptions, quickInputSelection]);

  const layers = useMemo(() => {
    const groups = new Map<LayerKey, DataFlowNode[]>();
    groups.set("document", graphNodes.filter((node) => node.type === "document"));
    groups.set("table", graphNodes.filter((node) => node.type === "table"));
    groups.set("macro_table", graphNodes.filter((node) => node.type === "macro_table"));
    groups.set("obra_field", graphNodes.filter((node) => node.type === "obra_field"));
    groups.set("calculation", graphNodes.filter((node) => node.type === "calculation"));
    groups.set("view", graphNodes.filter((node) => node.type === "view"));
    return groups;
  }, [graphNodes]);

  const layout = useMemo(() => {
    const nodeByRankId = new Map(graphNodes.map((node) => [node.id, node]));
    const upstreamByTarget = new Map<string, DisplayEdge[]>();
    const edgeOrderById = new Map<string, number>();
    filteredDisplayEdges.forEach((edge, index) => {
      edgeOrderById.set(edge.id, index);
      const upstream = upstreamByTarget.get(edge.to) ?? [];
      upstream.push(edge);
      upstreamByTarget.set(edge.to, upstream);
    });

    const usingFocusedDependencyLayout =
      canvasMode === "result" && Boolean(focusViewId) && Boolean(focusViewId && nodeByRankId.has(focusViewId));
    const rankByNodeId = new Map<string, number>();
    const laneByNodeId = new Map<string, number>();
    let laneCount = 0;

    if (usingFocusedDependencyLayout && focusViewId) {
      const depthByNodeId = new Map<string, number>([[focusViewId, 0]]);
      const queue = [focusViewId];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        const currentDepth = depthByNodeId.get(current) ?? 0;
        for (const edge of upstreamByTarget.get(current) ?? []) {
          if (!nodeByRankId.has(edge.from)) continue;
          const nextDepth = currentDepth + 1;
          const existingDepth = depthByNodeId.get(edge.from);
          if (existingDepth == null || nextDepth > existingDepth) {
            depthByNodeId.set(edge.from, nextDepth);
            queue.push(edge.from);
          }
        }
      }

      const maxDepth = Math.max(0, ...depthByNodeId.values());
      for (const node of graphNodes) {
        const depth = depthByNodeId.get(node.id);
        rankByNodeId.set(node.id, depth == null ? getBaseRank(node) : maxDepth - depth);
      }

      const spanByNodeId = new Map<string, { min: number; max: number; center: number }>();
      const allocating = new Set<string>();

      function sortUpstreamEdges(nodeId: string) {
        return [...(upstreamByTarget.get(nodeId) ?? [])]
          .filter((edge) => nodeByRankId.has(edge.from))
          .sort((left, right) => {
            const leftNode = nodeByRankId.get(left.from);
            const rightNode = nodeByRankId.get(right.from);
            if (leftNode && rightNode) {
              const layerDelta = getLayerSortValue(getLayerKey(leftNode)) - getLayerSortValue(getLayerKey(rightNode));
              if (layerDelta !== 0) return layerDelta;
            }
            return (edgeOrderById.get(left.id) ?? 0) - (edgeOrderById.get(right.id) ?? 0);
          });
      }

      function allocateLane(nodeId: string): { min: number; max: number; center: number } {
        const existing = spanByNodeId.get(nodeId);
        if (existing) return existing;
        if (allocating.has(nodeId)) {
          const fallbackLane = laneByNodeId.get(nodeId) ?? laneCount++;
          const fallback = { min: fallbackLane, max: fallbackLane, center: fallbackLane };
          laneByNodeId.set(nodeId, fallbackLane);
          spanByNodeId.set(nodeId, fallback);
          return fallback;
        }

        allocating.add(nodeId);
        const upstream = sortUpstreamEdges(nodeId);
        if (upstream.length === 0) {
          const lane = laneByNodeId.get(nodeId) ?? laneCount++;
          const span = { min: lane, max: lane, center: lane };
          laneByNodeId.set(nodeId, lane);
          spanByNodeId.set(nodeId, span);
          allocating.delete(nodeId);
          return span;
        }

        const upstreamSpans = upstream.map((edge) => allocateLane(edge.from));
        const min = Math.min(...upstreamSpans.map((span) => span.min));
        const max = Math.max(...upstreamSpans.map((span) => span.max));
        const center =
          upstreamSpans.reduce((total, span) => total + span.center, 0) /
          Math.max(1, upstreamSpans.length);
        const span = { min, max, center };
        laneByNodeId.set(nodeId, center);
        spanByNodeId.set(nodeId, span);
        allocating.delete(nodeId);
        return span;
      }

      allocateLane(focusViewId);
      for (const node of graphNodes) {
        if (!laneByNodeId.has(node.id)) {
          allocateLane(node.id);
        }
      }
    } else {
      for (const node of graphNodes) {
        rankByNodeId.set(node.id, getBaseRank(node));
      }

      for (let iteration = 0; iteration < graphNodes.length; iteration += 1) {
        let changed = false;
        for (const edge of filteredDisplayEdges) {
          if (!nodeByRankId.has(edge.from) || !nodeByRankId.has(edge.to)) continue;
          const fromRank = rankByNodeId.get(edge.from) ?? 0;
          const toRank = rankByNodeId.get(edge.to) ?? 0;
          if (toRank <= fromRank) {
            rankByNodeId.set(edge.to, fromRank + 1);
            changed = true;
          }
        }
        if (!changed) break;
      }
    }

    const rankGroups = new Map<number, DataFlowNode[]>();
    for (const node of graphNodes) {
      const rank = rankByNodeId.get(node.id) ?? getBaseRank(node);
      const group = rankGroups.get(rank) ?? [];
      group.push(node);
      rankGroups.set(rank, group);
    }
    const orderedRanks = [...rankGroups.keys()].sort((left, right) => left - right);
    const maxCount = Math.max(1, ...orderedRanks.map((rank) => rankGroups.get(rank)?.length ?? 0));
    const laneValues = [...new Set([...laneByNodeId.values()])].sort((left, right) => left - right);
    const minLane = laneValues.length > 0 ? Math.min(...laneValues) : 0;
    const maxLane = laneValues.length > 0 ? Math.max(...laneValues) : 0;
    const laneExtent = Math.max(1, maxLane - minLane);
    const positions = new Map<string, LayoutRect>();
    const layerYByKey = new Map<LayerKey, number>();
    const layerLabelByKey = new Map<LayerKey, { x: number; y: number }>();
    const orderedLayers = [...layers.entries()]
      .filter(([, nodes]) => nodes.length > 0)
      .map(([key]) => key)
      .sort((left, right) => getLayerSortValue(left) - getLayerSortValue(right));

    if (graphNodes.length === 0) {
      return {
        width: Math.max(canvasWidth - 40, 720),
        height: 560,
        positions,
        orderedLayers,
        layerYByKey,
        layerLabelByKey,
      };
    }

    if (layoutDirection === "horizontal") {
      if (usingFocusedDependencyLayout && laneValues.length > 0) {
        const width = Math.max(canvasWidth - 40, orderedRanks.length * 260 + 160);
        const height = Math.max(560, Math.ceil(maxLane - minLane + 1) * 150 + 180);
        const spreadX = Math.max(width - 240, 1);
        const rankIndexByValue = new Map(orderedRanks.map((rank, index) => [rank, index]));

        graphNodes.forEach((node) => {
          const rank = rankByNodeId.get(node.id) ?? getBaseRank(node);
          const rankIndex = rankIndexByValue.get(rank) ?? 0;
          const lane = laneByNodeId.get(node.id) ?? 0;
          const base = getNodeSize(node, calculationNodeVariant);
          const x = orderedRanks.length === 1 ? width / 2 : 120 + (spreadX * rankIndex) / Math.max(1, orderedRanks.length - 1);
          const y = laneValues.length === 1 ? height / 2 : 110 + ((height - 220) * (lane - minLane)) / laneExtent;
          positions.set(node.id, { x, y, w: base.w, h: base.h });
        });

        for (const layerKey of orderedLayers) {
          const rects = (layers.get(layerKey) ?? []).map((node) => positions.get(node.id)).filter((rect): rect is LayoutRect => Boolean(rect));
          const minX = Math.min(...rects.map((rect) => rect.x - rect.w / 2));
          const minY = Math.min(...rects.map((rect) => rect.y - rect.h / 2));
          layerYByKey.set(layerKey, minY);
          layerLabelByKey.set(layerKey, { x: Math.max(24, minX), y: Math.max(18, minY - 42) });
        }

        return { width, height, positions, orderedLayers, layerYByKey, layerLabelByKey };
      }

      const width = Math.max(canvasWidth - 40, orderedRanks.length * 260 + 160);
      const height = Math.max(560, maxCount * 148 + 160);
      const spreadX = Math.max(width - 240, 1);

      orderedRanks.forEach((rank, rankIndex) => {
        const nodes = [...(rankGroups.get(rank) ?? [])].sort(
          (left, right) => getLayerSortValue(getLayerKey(left)) - getLayerSortValue(getLayerKey(right)) || left.label.localeCompare(right.label)
        );
        const x = orderedRanks.length === 1 ? width / 2 : 120 + (spreadX * rankIndex) / Math.max(1, orderedRanks.length - 1);
        const spreadY = Math.max(height - 190, 1);
        nodes.forEach((node, index) => {
          const base = getNodeSize(node, calculationNodeVariant);
          const y = nodes.length === 1 ? height / 2 : 112 + (spreadY * index) / Math.max(1, nodes.length - 1);
          positions.set(node.id, { x, y, w: base.w, h: base.h });
        });
      });

      for (const layerKey of orderedLayers) {
        const rects = (layers.get(layerKey) ?? []).map((node) => positions.get(node.id)).filter((rect): rect is LayoutRect => Boolean(rect));
        const minX = Math.min(...rects.map((rect) => rect.x - rect.w / 2));
        const minY = Math.min(...rects.map((rect) => rect.y - rect.h / 2));
        layerYByKey.set(layerKey, minY);
        layerLabelByKey.set(layerKey, { x: Math.max(24, minX), y: Math.max(18, minY - 42) });
      }

      return { width, height, positions, orderedLayers, layerYByKey, layerLabelByKey };
    }

    if (layoutDirection === "radial") {
      const radialNodes = [...graphNodes].sort(
        (left, right) =>
          (usingFocusedDependencyLayout
            ? (laneByNodeId.get(left.id) ?? 0) - (laneByNodeId.get(right.id) ?? 0)
            : (rankByNodeId.get(left.id) ?? 0) - (rankByNodeId.get(right.id) ?? 0)) ||
          (rankByNodeId.get(left.id) ?? 0) - (rankByNodeId.get(right.id) ?? 0) ||
          getLayerSortValue(getLayerKey(left)) - getLayerSortValue(getLayerKey(right)) ||
          left.label.localeCompare(right.label)
      );
      const radius = Math.max(210, Math.ceil(radialNodes.length / 2) * 44);
      const width = Math.max(canvasWidth - 40, radius * 2 + 280);
      const height = Math.max(560, radius * 2 + 220);
      const center = { x: width / 2, y: height / 2 + 16 };

      radialNodes.forEach((node, index) => {
        const base = getNodeSize(node, calculationNodeVariant);
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, radialNodes.length);
        positions.set(node.id, {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
          w: base.w,
          h: base.h,
        });
      });

      orderedLayers.forEach((layerKey, layerIndex) => {
        const rects = (layers.get(layerKey) ?? []).map((node) => positions.get(node.id)).filter((rect): rect is LayoutRect => Boolean(rect));
        const minY = rects.length > 0 ? Math.min(...rects.map((rect) => rect.y - rect.h / 2)) : 86;
        layerYByKey.set(layerKey, minY);
        layerLabelByKey.set(layerKey, { x: 24 + layerIndex * 150, y: 20 });
      });

      return { width, height, positions, orderedLayers, layerYByKey, layerLabelByKey };
    }

    if (usingFocusedDependencyLayout && laneValues.length > 0) {
      const width = Math.max(canvasWidth - 40, Math.ceil(maxLane - minLane + 1) * 230 + 160);
      const height = 140 + orderedRanks.length * 180;
      const spreadY = Math.max(height - 180, 1);
      const rankIndexByValue = new Map(orderedRanks.map((rank, index) => [rank, index]));

      graphNodes.forEach((node) => {
        const rank = rankByNodeId.get(node.id) ?? getBaseRank(node);
        const rankIndex = rankIndexByValue.get(rank) ?? 0;
        const lane = laneByNodeId.get(node.id) ?? 0;
        const base = getNodeSize(node, calculationNodeVariant);
        const x = laneValues.length === 1 ? width / 2 : 80 + ((width - 160) * (lane - minLane)) / laneExtent;
        const y = orderedRanks.length === 1 ? height / 2 : 90 + (spreadY * rankIndex) / Math.max(1, orderedRanks.length - 1);
        positions.set(node.id, { x, y, w: base.w, h: base.h });
      });

      for (const layerKey of orderedLayers) {
        const rects = (layers.get(layerKey) ?? []).map((node) => positions.get(node.id)).filter((rect): rect is LayoutRect => Boolean(rect));
        const minY = Math.min(...rects.map((rect) => rect.y - rect.h / 2));
        layerYByKey.set(layerKey, minY);
        layerLabelByKey.set(layerKey, { x: 24, y: Math.max(18, minY - 42) });
      }

      return { width, height, positions, orderedLayers, layerYByKey, layerLabelByKey };
    }

    const width = Math.max(canvasWidth - 40, maxCount * 220 + 120);
    const height = 140 + orderedRanks.length * 180;

    orderedRanks.forEach((rank, rankIndex) => {
      const nodes = [...(rankGroups.get(rank) ?? [])].sort(
        (left, right) => getLayerSortValue(getLayerKey(left)) - getLayerSortValue(getLayerKey(right)) || left.label.localeCompare(right.label)
      );
      const y = 90 + rankIndex * 180;
      const spread = Math.max(width - 120, 1);
      nodes.forEach((node, index) => {
        const base = getNodeSize(node, calculationNodeVariant);
        const x = nodes.length === 1 ? width / 2 : 60 + (spread * index) / Math.max(1, nodes.length - 1);
        positions.set(node.id, { x, y, w: base.w, h: base.h });
      });
    });

    for (const layerKey of orderedLayers) {
      const rects = (layers.get(layerKey) ?? []).map((node) => positions.get(node.id)).filter((rect): rect is LayoutRect => Boolean(rect));
      const minY = Math.min(...rects.map((rect) => rect.y - rect.h / 2));
      layerYByKey.set(layerKey, minY);
      layerLabelByKey.set(layerKey, { x: 24, y: Math.max(18, minY - 42) });
    }

    return { width, height, positions, orderedLayers, layerYByKey, layerLabelByKey };
  }, [calculationNodeVariant, canvasMode, canvasWidth, filteredDisplayEdges, focusViewId, graphNodes, layers, layoutDirection]);

  const flowNodes = useMemo<DataFlowFlowNode[]>(
    () =>
      graphNodes.flatMap((node) => {
        const position = layout.positions.get(node.id);
        if (!position) return [];
        const dimmed = Boolean(selectedNodeId) && connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id);
        const highlighted = connectedNodeIds.has(node.id);
        const size = getNodeSize(node, calculationNodeVariant);
        return [
          {
            id: node.id,
            type: "dataFlow",
            position: { x: position.x - size.w / 2, y: position.y - size.h / 2 },
            data: {
              node,
              dimmed,
              highlighted,
              flowDirection: layoutDirection,
              calculationNodeVariant,
              calculationInputLabels: getCalculationInputLabels(node, nodeById),
              register: registerNodeRef,
              onHover: (nodeId, event) => setHover({ nodeId, x: event.clientX, y: event.clientY }),
              onLeave: (nodeId) =>
                setHover((current) => (current?.nodeId === nodeId ? null : current)),
            },
            selected: selectedNodeId === node.id,
            sourcePosition: layoutDirection === "horizontal" ? Position.Right : Position.Bottom,
            targetPosition: layoutDirection === "horizontal" ? Position.Left : Position.Top,
            draggable: false,
          } satisfies DataFlowFlowNode,
        ];
      }),
    [calculationNodeVariant, connectedNodeIds, graphNodes, layout.positions, layoutDirection, nodeById, selectedNodeId]
  );

  const flowEdges = useMemo<Array<ReactFlowEdge<DataFlowFlowEdgeData>>>(
    () =>
      filteredDisplayEdges.map((edge) => {
        const active = activeEdgeIds.has(edge.id);
        const dimmed = Boolean(selectedNodeId) && !active;
        return {
          id: edge.id,
          type: "dataFlow",
          source: edge.from,
          target: edge.to,
          data: {
            visualStyle: edgeVisualStyle,
            direction: layoutDirection,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: active ? activeTokens.solid : "#a8a29e",
          },
          style: {
            stroke: active ? activeTokens.solid : "#d6d3d1",
            strokeWidth: active ? 1.8 : 1.2,
            opacity: dimmed ? 0.25 : 1,
          },
        };
      }),
    [activeEdgeIds, activeTokens.solid, edgeVisualStyle, filteredDisplayEdges, layoutDirection, selectedNodeId]
  );

  const upstreamNodes = useMemo(() => {
    if (!selectedNode) return [];
    const upstreamIds = filteredDisplayEdges.filter((edge) => edge.to === selectedNode.id).map((edge) => edge.from);
    return upstreamIds.map((id) => nodeById.get(id)).filter((node): node is DataFlowNode => Boolean(node));
  }, [filteredDisplayEdges, nodeById, selectedNode]);

  const diagnostics = payload?.diagnostics?.reportingProjectionErrors ?? [];
  const canvasViewportHeight = Math.max(560, Math.min(820, layout.height));

  useEffect(() => {
    if (!focusViewId || !viewNodes.some((node) => node.id === focusViewId)) {
      setFocusViewId(resultNodes[0]?.id ?? viewNodes[0]?.id ?? null);
    }
  }, [focusViewId, resultNodes, viewNodes]);

  useEffect(() => {
    if (selectedNodeId && !nodeById.has(selectedNodeId)) {
      setSelectedNodeId(focusViewId ?? resultNodes[0]?.id ?? graphNodes[0]?.id ?? null);
      setInspectorAnchor(null);
      setOpenedTableNode(null);
    }
  }, [focusViewId, graphNodes, nodeById, resultNodes, selectedNodeId]);

  function registerNodeRef(id: string, element: HTMLButtonElement | null) {
    if (!element) {
      nodeRefs.current.delete(id);
      return;
    }
    nodeRefs.current.set(id, element);
  }

  function registerResultRef(id: string, element: HTMLButtonElement | null) {
    if (!element) {
      resultRefs.current.delete(id);
      return;
    }
    resultRefs.current.set(id, element);
  }

  function findAnchor(id: string) {
    return resultRefs.current.get(id) ?? nodeRefs.current.get(id) ?? null;
  }

  function navigateInspector(nodeId: string) {
    const node = nodeById.get(nodeId);
    if (!node) return;
    if (node.type === "view") {
      setCanvasMode("result");
      setFocusViewId(nodeId);
    }
    setSelectedNodeId(nodeId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setInspectorAnchor(findAnchor(nodeId));
      });
    });
  }

  function handleResultClick(node: DataFlowNode) {
    setCanvasMode("result");
    setFocusViewId(node.id);
    setSelectedNodeId(node.id);
    setInspectorAnchor(null);
    setHover(null);
  }

  function handleCanvasNodeClick(node: DataFlowNode, anchor: HTMLElement | null) {
    if (node.type === "view") {
      setCanvasMode("result");
      setFocusViewId(node.id);
    }
    setSelectedNodeId(node.id);
    setInspectorAnchor(anchor ?? findAnchor(node.id));
    setHover(null);
  }

  const handleFlowNodeClick = (event: ReactMouseEvent, flowNode: DataFlowFlowNode) => {
    const anchor =
      event.target instanceof Element
        ? (event.target.closest(".react-flow__node") as HTMLElement | null)
        : null;
    handleCanvasNodeClick(flowNode.data.node, anchor);
  };

  function getEditorTargetForNode(node: DataFlowNode): DataFlowEditorTarget | null {
    if (node.type === "calculation") {
      const calculationId =
        typeof node.data.calculationId === "string"
          ? node.data.calculationId
          : node.id.startsWith("calc:custom:")
            ? node.id.slice("calc:custom:".length)
            : null;
      return calculationId ? { type: "calculation", id: calculationId } : { type: "calculation" };
    }
    if (node.type === "view") {
      const resultId = node.id.startsWith("view:custom:")
        ? node.id.slice("view:custom:".length)
        : null;
      return resultId ? { type: "result", id: resultId } : { type: "result" };
    }
    return { type: "layout" };
  }

  function handleOpenEditorForNode(node: DataFlowNode) {
    setEditorTarget(getEditorTargetForNode(node));
    setEditorOpen(true);
  }

  function applyLocalBuilderConfig(nextConfig: BuilderConfig) {
    setConfigPayload((current) =>
      current
        ? { ...current, config: nextConfig }
        : {
          scope,
          config: nextConfig,
          sources: { tables: [], macroTables: [], obraFields: [] },
          evaluated: null,
        }
    );
  }

  function getCalculationIdFromNode(node: DataFlowNode | null | undefined) {
    if (!node || node.type !== "calculation") return null;
    if (typeof node.data.calculationId === "string" && node.data.calculationId.trim()) {
      return node.data.calculationId.trim();
    }
    return node.id.startsWith("calc:custom:") ? node.id.slice("calc:custom:".length) : null;
  }

  function getResultIdFromNode(node: DataFlowNode | null | undefined) {
    if (!node || node.type !== "view") return null;
    return node.id.startsWith("view:custom:") ? node.id.slice("view:custom:".length) : null;
  }

  function getEffectiveCalculation(id: string) {
    return effectiveBuilderCalculations.find((calculation) => calculation.id === id) ?? null;
  }

  function getEffectiveResult(id: string, baseConfig: BuilderConfig) {
    return (
      baseConfig.results.find((result) => result.id === id) ??
      configPayload?.effectiveConfig?.results.find((result) => result.id === id) ??
      configPayload?.inheritedConfig?.results.find((result) => result.id === id) ??
      null
    );
  }

  function ensureLocalCalculation(baseConfig: BuilderConfig, calculationId: string) {
    if (baseConfig.calculations.some((calculation) => calculation.id === calculationId)) return baseConfig;
    const inherited = getEffectiveCalculation(calculationId);
    if (!inherited) return baseConfig;
    return { ...baseConfig, calculations: [...baseConfig.calculations, { ...inherited }] };
  }

  function ensureLocalResult(baseConfig: BuilderConfig, resultId: string) {
    if (baseConfig.results.some((result) => result.id === resultId)) return baseConfig;
    const inherited = getEffectiveResult(resultId, baseConfig);
    if (!inherited) return baseConfig;
    return { ...baseConfig, results: [...baseConfig.results, { ...inherited }] };
  }

  function makeUniqueAlias(label: string, existingAliases: string[]) {
    const base =
      label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase() || "input";
    let alias = base;
    let index = 2;
    while (existingAliases.includes(alias)) {
      alias = `${base}_${index}`;
      index += 1;
    }
    return alias;
  }

  function findBuilderSource(sourceType: BuilderSourceType, sourceId: string) {
    const sources = sourceType === "table" ? configPayload?.sources.tables : configPayload?.sources.macroTables;
    return sources?.find((source) => source.id === sourceId) ?? null;
  }

  function resolveBuilderSourceFromNode(node: DataFlowNode | null | undefined):
    | {
      sourceType: BuilderFormulaInputSourceType;
      sourceId: string;
      label: string;
      fieldKey: string | null;
      aggregation: BuilderAggregation | null;
    }
    | null {
    if (!node) return null;
    if (node.type === "document" || node.type === "table") {
      const tableId =
        typeof node.data.tableId === "string"
          ? node.data.tableId
          : typeof node.data.defaultTableId === "string"
            ? node.data.defaultTableId
            : node.id.replace(/^table:/, "").replace(/^document:table:/, "").split(":")[0] ?? "";
      if (!tableId) return null;
      const source = findBuilderSource("table", tableId);
      return {
        sourceType: "table",
        sourceId: tableId,
        label: node.type === "document" ? String(node.data.folderLabel ?? node.label) : node.label,
        fieldKey: source?.columns[0]?.key ?? null,
        aggregation: "sum",
      };
    }
    if (node.type === "macro_table") {
      const macroId = typeof node.data.macroTableId === "string" ? node.data.macroTableId : node.id.replace(/^macro:/, "");
      if (!macroId) return null;
      const source = findBuilderSource("macro_table", macroId);
      return {
        sourceType: "macro_table",
        sourceId: macroId,
        label: node.label,
        fieldKey: source?.columns[0]?.key ?? null,
        aggregation: "sum",
      };
    }
    if (node.type === "obra_field") {
      const fieldKey = typeof node.data.fieldKey === "string" ? node.data.fieldKey : node.id.replace(/^obra_field:/, "");
      return fieldKey
        ? { sourceType: "obra_field", sourceId: fieldKey, label: node.label, fieldKey: null, aggregation: null }
        : null;
    }
    if (node.type === "calculation") {
      const calculationId = getCalculationIdFromNode(node);
      return calculationId
        ? { sourceType: "calculation", sourceId: calculationId, label: node.label, fieldKey: null, aggregation: null }
        : null;
    }
    return null;
  }

  function addFormulaInputToCalculation(
    calculation: BuilderCalculation,
    source: NonNullable<ReturnType<typeof resolveBuilderSourceFromNode>>
  ): BuilderCalculation {
    const existingInputs =
      calculation.mode === "formula"
        ? calculation.inputs
        : calculation.mode === "aggregate"
          ? [
            {
              id: makeClientId("input"),
              alias: makeUniqueAlias(calculation.label, []),
              sourceType: calculation.sourceType,
              sourceId: calculation.sourceId,
              fieldKey: calculation.fieldKey,
              aggregation: calculation.aggregation,
            } satisfies BuilderFormulaInput,
          ]
          : [];
    const alreadyConnected = existingInputs.some(
      (input) => input.sourceType === source.sourceType && input.sourceId === source.sourceId
    );
    if (alreadyConnected) return calculation.mode === "formula" ? calculation : { ...calculation, mode: "formula", expression: existingInputs[0]?.alias ?? "", inputs: existingInputs };
    const alias = makeUniqueAlias(source.label, existingInputs.map((input) => input.alias));
    const nextInput: BuilderFormulaInput = {
      id: makeClientId("input"),
      alias,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      fieldKey: source.fieldKey,
      aggregation: source.aggregation,
    };
    const previousExpression = calculation.mode === "formula" ? calculation.expression.trim() : existingInputs[0]?.alias ?? "";
    const nextExpression = previousExpression
      ? previousExpression.includes(alias)
        ? previousExpression
        : `${previousExpression} + ${alias}`
      : alias;
    return {
      id: calculation.id,
      label: calculation.label,
      mode: "formula",
      description: calculation.description,
      expression: nextExpression,
      inputs: [...existingInputs, nextInput],
    };
  }

  async function applyAndSaveBuilderConfig(updater: (baseConfig: BuilderConfig) => BuilderConfig) {
    if (!configPayload || !canWriteDataFlow) {
      setConfigError("No tenes permisos o todavia no cargo la configuracion de data-flow.");
      return;
    }
    const nextConfig = updater(configPayload.config);
    applyLocalBuilderConfig(nextConfig);
    await handleSaveBuilderConfig(nextConfig);
  }

  async function handleSaveBuilderConfig(configOverride?: BuilderConfig) {
    const configToSave = configOverride ?? configPayload?.config;
    if (!configToSave) return;
    setConfigSaving(true);
    setConfigError(null);
    try {
      const response = await fetch(configEndpoint.split("?")[0] ?? configEndpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: configToSave,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "No se pudo guardar el editor de data-flow."
        );
      }
      const typed = result as DataFlowConfigPayload;
      setConfigPayload(typed);
      setWritebackPlan(typed.writebackPlan ?? null);
      setRefreshToken((current) => current + 1);
    } catch (saveError) {
      setConfigError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar el editor."
      );
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleSuggestionDecision(suggestionId: string, decision: "accept" | "reject") {
    if (!obraId) return;
    setConfigError(null);
    try {
      const response = await fetch(`/api/obras/${obraId}/data-flow-suggestions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, decision }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof result?.error === "string" ? result.error : "No se pudo actualizar la sugerencia.");
      }
      setRefreshToken((current) => current + 1);
    } catch (decisionError) {
      setConfigError(decisionError instanceof Error ? decisionError.message : "No se pudo actualizar la sugerencia.");
    }
  }

  async function handleAddInputCalculationFromPalette() {
    const selected = quickInputSelection || quickInputOptions[0]?.value;
    if (!selected) return;
    const [rawType, ...idParts] = selected.split(":");
    const sourceId = idParts.join(":");
    const option = quickInputOptions.find((candidate) => candidate.value === selected);
    const label = option?.label ?? "Input";
    await applyAndSaveBuilderConfig((baseConfig) => {
      if (rawType === "table" || rawType === "macro_table") {
        const sourceType = rawType as BuilderSourceType;
        const source = findBuilderSource(sourceType, sourceId);
        const id = makeClientId("calc");
        return {
          ...baseConfig,
          calculations: [
            ...baseConfig.calculations,
            {
              id,
              label: `Input - ${label}`,
              mode: "aggregate",
              description: "Nodo input creado desde el canvas.",
              sourceType,
              sourceId,
              fieldKey: source?.columns[0]?.key ?? null,
              aggregation: "sum",
            },
          ],
        };
      }

      const sourceNode: DataFlowNode =
        rawType === "obra_field"
          ? {
            id: `obra_field:${sourceId}`,
            type: "obra_field",
            label,
            status: "ok",
            supportStatus: "implemented",
            data: { fieldKey: sourceId },
          }
          : {
            id: `calc:custom:${sourceId}`,
            type: "calculation",
            label,
            status: "ok",
            supportStatus: "implemented",
            data: { calculationId: sourceId },
          };
      const source = resolveBuilderSourceFromNode(sourceNode);
      if (!source) return baseConfig;
      const alias = makeUniqueAlias(label, []);
      return {
        ...baseConfig,
        calculations: [
          ...baseConfig.calculations,
          {
            id: makeClientId("calc"),
            label: `Input - ${label}`,
            mode: "formula",
            description: "Nodo input creado desde el canvas.",
            expression: alias,
            inputs: [
              {
                id: makeClientId("input"),
                alias,
                sourceType: source.sourceType,
                sourceId: source.sourceId,
                fieldKey: source.fieldKey,
                aggregation: source.aggregation,
              },
            ],
          },
        ],
      };
    });
  }

  async function handleAddFormulaNode() {
    await applyAndSaveBuilderConfig((baseConfig) => ({
      ...baseConfig,
      calculations: [
        ...baseConfig.calculations,
        {
          id: makeClientId("calc"),
          label: "Formula nueva",
          mode: "formula",
          description: "Conecta inputs desde el canvas para completar esta formula.",
          expression: "",
          inputs: [],
        },
      ],
    }));
  }

  async function handleAddResultNode() {
    await applyAndSaveBuilderConfig((baseConfig) => {
      const calculationId = effectiveBuilderCalculations[0]?.id ?? baseConfig.calculations[0]?.id ?? null;
      return {
        ...baseConfig,
        results: [
          ...baseConfig.results,
          {
            id: makeClientId("result"),
            label: "Resultado nuevo",
            description: "Resultado creado desde el canvas.",
            calculationId,
            targetObraFieldId: null,
            writebackMode: "none",
            format: "number",
            decimals: 0,
            generalTabSlot: "hero",
            generalTabOrder: baseConfig.results.length + 1,
          },
        ],
      };
    });
  }

  async function handleFlowConnect(connection: Connection) {
    const sourceNode = connection.source ? nodeById.get(connection.source) : null;
    const targetNode = connection.target ? nodeById.get(connection.target) : null;
    const source = resolveBuilderSourceFromNode(sourceNode);
    if (!sourceNode || !targetNode || !source) {
      setConfigError("No se pudo resolver la conexion seleccionada.");
      return;
    }

    if (targetNode.type === "view") {
      const resultId = getResultIdFromNode(targetNode);
      if (!resultId || source.sourceType !== "calculation") {
        setConfigError("Los resultados solo pueden conectarse desde un calculo del builder.");
        return;
      }
      await applyAndSaveBuilderConfig((baseConfig) => {
        const withResult = ensureLocalResult(baseConfig, resultId);
        return {
          ...withResult,
          results: withResult.results.map((result) =>
            result.id === resultId ? { ...result, calculationId: source.sourceId } : result
          ),
        };
      });
      return;
    }

    if (targetNode.type !== "calculation") {
      setConfigError("Conecta inputs hacia un calculo, o calculos hacia un resultado.");
      return;
    }

    const targetCalculationId = getCalculationIdFromNode(targetNode);
    if (!targetCalculationId) {
      setConfigError("Solo se pueden editar calculos del builder desde el canvas.");
      return;
    }
    if (source.sourceType === "calculation" && source.sourceId === targetCalculationId) {
      setConfigError("Un calculo no puede conectarse a si mismo.");
      return;
    }

    await applyAndSaveBuilderConfig((baseConfig) => {
      const withCalculation = ensureLocalCalculation(baseConfig, targetCalculationId);
      return {
        ...withCalculation,
        calculations: withCalculation.calculations.map((calculation) => {
          if (calculation.id !== targetCalculationId) return calculation;
          if (
            calculation.mode === "aggregate" &&
            (source.sourceType === "table" || source.sourceType === "macro_table")
          ) {
            return {
              ...calculation,
              sourceType: source.sourceType,
              sourceId: source.sourceId,
              fieldKey: source.fieldKey,
              aggregation: source.aggregation ?? "sum",
            };
          }
          return addFormulaInputToCalculation(calculation, source);
        }),
      };
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--df-bg)", color: "var(--df-stone-900)" }}>
      <style jsx global>{PAGE_THEME}</style>

      <div
        style={{
          overflow: "hidden",
          width: "100%",
          padding: 24,
        }}
      >
        <div
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid var(--df-stone-200)",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--df-stone-500)",
                flexWrap: "wrap",
              }}
            >
              <span>{breadcrumbRoot}</span>
              <ChevronRight size={11} />
              <span style={{ color: "var(--df-stone-700)" }}>{payload?.obra.label ?? "Cargando obra"}</span>
              <ChevronRight size={11} />
              <span style={{ color: "var(--df-stone-900)", fontWeight: 500 }}>Trazabilidad</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--df-stone-900)",
                  letterSpacing: "-.01em",
                  margin: 0,
                }}
              >
                Trazabilidad de resultados
              </h1>
              <span style={{ fontSize: 12, color: "var(--df-stone-500)" }}>
                {canvasMode === "result" && focusViewId
                  ? `Foco en ${viewNodes.find((node) => node.id === focusViewId)?.label ?? "resultado"}`
                  : "Sistema completo"}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              background: "var(--df-stone-100)",
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setWorkspaceTab("trace")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: workspaceTab === "trace" ? "#fff" : "transparent",
                color: workspaceTab === "trace" ? "var(--df-stone-900)" : "var(--df-stone-600)",
                fontSize: 12,
                fontWeight: workspaceTab === "trace" ? 600 : 500,
                boxShadow: workspaceTab === "trace" ? "0 1px 0 rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" : "none",
              }}
            >
              Trazabilidad
            </button>
            <button
              type="button"
              onClick={() => {
                setWorkspaceTab("layout");
                setInspectorAnchor(null);
                setHover(null);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: workspaceTab === "layout" ? "#fff" : "transparent",
                color: workspaceTab === "layout" ? "var(--df-stone-900)" : "var(--df-stone-600)",
                fontSize: 12,
                fontWeight: workspaceTab === "layout" ? 600 : 500,
                boxShadow: workspaceTab === "layout" ? "0 1px 0 rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" : "none",
              }}
            >
              Layout
            </button>
          </div>

          {workspaceTab === "trace" ? (
            <div
              style={{
                display: "inline-flex",
                background: "var(--df-stone-100)",
                borderRadius: 8,
                padding: 3,
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCanvasMode("system");
                  setFocusViewId((current) => current ?? resultNodes[0]?.id ?? viewNodes[0]?.id ?? null);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: canvasMode === "system" ? "#fff" : "transparent",
                  color: canvasMode === "system" ? "var(--df-stone-900)" : "var(--df-stone-600)",
                  fontSize: 12,
                  fontWeight: canvasMode === "system" ? 600 : 500,
                  boxShadow: canvasMode === "system" ? "0 1px 0 rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" : "none",
                }}
              >
                Ver todo el sistema
              </button>
              <button
                type="button"
                onClick={() => {
                  setCanvasMode("result");
                  if (!focusViewId && (resultNodes[0] ?? viewNodes[0])) {
                    setFocusViewId((resultNodes[0] ?? viewNodes[0])?.id ?? null);
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: canvasMode === "result" ? "#fff" : "transparent",
                  color: canvasMode === "result" ? "var(--df-stone-900)" : "var(--df-stone-600)",
                  fontSize: 12,
                  fontWeight: canvasMode === "result" ? 600 : 500,
                  boxShadow: canvasMode === "result" ? "0 1px 0 rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)" : "none",
                }}
              >
                Ver por resultado
              </button>
            </div>
          ) : null}

          <div ref={tweaksRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setEditorTarget(null);
                setEditorOpen(true);
              }}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 6,
                border: "1px solid var(--df-stone-200)",
                background: editorOpen ? "var(--df-orange-soft)" : "#fff",
                color: editorOpen ? "#9a4c08" : "var(--df-stone-700)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Pencil size={13} />
              Editor
            </button>
            <button
              type="button"
              onClick={() => setShowTweaks((current) => !current)}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 6,
                border: `1px solid ${showTweaks ? "var(--df-orange-border)" : "var(--df-stone-200)"}`,
                background: showTweaks ? "var(--df-orange-soft)" : "#fff",
                color: showTweaks ? "#9a4c08" : "var(--df-stone-700)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <SlidersHorizontal size={13} />
              Tweaks
            </button>
            {showTweaks ? (
              <TweaksPopover
                layoutDirection={layoutDirection}
                resultVisualStyle={resultVisualStyle}
                calculationNodeVariant={calculationNodeVariant}
                edgeVisualStyle={edgeVisualStyle}
                activeColor={activeResultColor}
                showCalculations={showCalculations}
                showDocuments={showDocuments}
                onLayoutDirectionChange={setLayoutDirection}
                onResultVisualStyleChange={setResultVisualStyle}
                onCalculationNodeVariantChange={setCalculationNodeVariant}
                onEdgeVisualStyleChange={setEdgeVisualStyle}
                onActiveColorChange={setActiveResultColor}
                onToggleCalculations={() => setShowCalculations((current) => !current)}
                onToggleDocuments={() => setShowDocuments((current) => !current)}
                onClose={() => setShowTweaks(false)}
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setRefreshToken((current) => current + 1)}
            disabled={loading}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 6,
              border: "1px solid var(--df-stone-200)",
              background: "#fff",
              color: "var(--df-stone-700)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loading ? <Loader2 size={13} /> : <RefreshCcw size={13} />}
            Actualizar
          </button>

          <Link
            href={backHref}
            prefetch={false}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 6,
              border: "1px solid var(--df-stone-200)",
              background: "#fff",
              color: "var(--df-stone-700)",
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={13} />
            {backLabel}
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
          {workspaceTab === "layout" ? (
            <DataFlowLayoutWorkspace
              config={
                configPayload?.config ?? {
                  version: 1,
                  calculations: [],
                  results: [],
                  generalTabLayout: [],
                }
              }
              payload={configPayload}
              saving={configSaving}
              error={configError}
              onConfigChange={(config) =>
                setConfigPayload((current) =>
                  current
                    ? { ...current, config }
                    : {
                      config,
                      sources: { tables: [], macroTables: [], obraFields: [] },
                      evaluated: null,
                    }
                )
              }
              onSave={handleSaveBuilderConfig}
              onOpenAdvancedEditor={() => {
                setEditorTarget({ type: "layout" });
                setEditorOpen(true);
              }}
            />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 8,
                  padding: "8px 10px",
                  background: "#fff",
                  border: "1px solid var(--df-stone-200)",
                  borderRadius: 12,
                  boxShadow: "0 1px 0 rgba(0,0,0,.03)",
                  overflowX: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    paddingRight: 10,
                    borderRight: "1px solid var(--df-stone-100)",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: ".15em",
                      textTransform: "uppercase",
                      color: "var(--df-orange)",
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                    }}
                  >
                    Resultados
                  </span>
                </div>
                {resultNodes.length > 0 ? (
                  resultNodes.map((node) => (
                    <ResultChip
                      key={node.id}
                      node={node}
                      active={focusViewId === node.id && canvasMode === "result"}
                      visualStyle={resultVisualStyle}
                      activeColor={activeResultColor}
                      buttonRef={(element) => registerResultRef(node.id, element)}
                      onClick={() => handleResultClick(node)}
                      onHover={() => undefined}
                      onLeave={() => undefined}
                    />
                  ))
                ) : (
                  <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--df-stone-500)" }}>No hay KPIs trazables disponibles.</div>
                )}
              </div>

              {writebackPlan || pendingSuggestions.length > 0 || suggestionsError ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--df-orange-border)",
                    background: "#fff7ed",
                    color: "var(--df-stone-800)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Target size={15} style={{ color: "var(--df-orange)" }} />
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--df-stone-900)" }}>
                      Writeback de data-flow
                    </div>
                  </div>

                  {writebackPlan?.actions.map((action) => (
                    <div key={`${action.resultId}:${action.targetObraFieldId}:ready`} style={{ fontSize: 12, lineHeight: 1.5 }}>
                      {action.mode === "auto" ? "Escritura aplicada" : "Sugerencia creada"}:{" "}
                      <strong>{action.resultLabel}</strong>{" -> "}
                      {obraFieldLabelById.get(action.targetObraFieldId) ?? action.targetObraFieldId} ={" "}
                      <strong>{action.formattedValue}</strong>
                    </div>
                  ))}

                  {writebackPlan?.blocked.map((action) => (
                    <div
                      key={`${action.resultId}:${action.targetObraFieldId}:blocked`}
                      style={{ fontSize: 12, lineHeight: 1.5, color: "#b91c1c" }}
                    >
                      Bloqueado: <strong>{action.resultLabel}</strong>{" -> "}
                      {obraFieldLabelById.get(action.targetObraFieldId) ?? action.targetObraFieldId}.{" "}
                      {action.blockReason ?? "No se pudo aplicar."}
                    </div>
                  ))}

                  {pendingSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        paddingTop: 8,
                        borderTop: "1px solid rgba(249,115,22,.18)",
                      }}
                    >
                      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                        Pendiente: <strong>{suggestion.result_label}</strong> sugiere{" "}
                        {obraFieldLabelById.get(suggestion.field_id) ?? suggestion.field_id} ={" "}
                        <strong>{suggestion.formatted_value ?? String(suggestion.suggested_value ?? "-")}</strong>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => void handleSuggestionDecision(suggestion.id, "accept")}
                          style={{
                            border: "1px solid var(--df-orange)",
                            background: "var(--df-orange)",
                            color: "#fff",
                            borderRadius: 6,
                            padding: "6px 9px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSuggestionDecision(suggestion.id, "reject")}
                          style={{
                            border: "1px solid var(--df-stone-200)",
                            background: "#fff",
                            color: "var(--df-stone-700)",
                            borderRadius: 6,
                            padding: "6px 9px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}

                  {suggestionsError ? (
                    <div style={{ fontSize: 12, color: "#b91c1c" }}>{suggestionsError}</div>
                  ) : null}
                </div>
              ) : null}

              {diagnostics.length > 0 ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #fde68a",
                    background: "#fffbeb",
                    color: "#92400e",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <TriangleAlert size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>La capa projected se degrado en esta carga.</div>
                    {diagnostics.join(" ")}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 560,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--df-stone-200)",
                  background: "var(--df-panel-soft)",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--df-stone-200)",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--df-stone-900)" }}>Canvas de trazabilidad</div>
                    <div style={{ marginTop: 3, fontSize: 12, color: "var(--df-stone-500)" }}>
                      {canvasMode === "result"
                        ? "Click en nodos para abrir el inspector y seguir dependencias reales."
                        : "Vista completa del sistema con tablas, macrotablas y calculos projected."}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      value={quickInputSelection}
                      onChange={(event) => setQuickInputSelection(event.target.value)}
                      disabled={!canWriteDataFlow || configSaving || quickInputOptions.length === 0}
                      style={{
                        height: 32,
                        minWidth: 230,
                        borderRadius: 8,
                        border: "1px solid var(--df-stone-200)",
                        background: "#fff",
                        color: "var(--df-stone-700)",
                        fontSize: 12,
                        padding: "0 9px",
                        outline: "none",
                      }}
                    >
                      {["Carpetas / tablas", "Macrotablas", "Campos de obra", "Calculos"].map((group) => {
                        const options = quickInputOptions.filter((option) => option.group === group);
                        if (options.length === 0) return null;
                        return (
                          <optgroup key={group} label={group}>
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        void handleAddInputCalculationFromPalette();
                      }}
                      disabled={!canWriteDataFlow || configSaving || quickInputOptions.length === 0}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: "1px solid var(--df-stone-200)",
                        background: "#fff",
                        color: "var(--df-stone-700)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: canWriteDataFlow && !configSaving ? "pointer" : "not-allowed",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Plus size={12} />
                      Input
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleAddFormulaNode();
                      }}
                      disabled={!canWriteDataFlow || configSaving}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd6fe",
                        background: "#f5f3ff",
                        color: "#5b21b6",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: canWriteDataFlow && !configSaving ? "pointer" : "not-allowed",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Sigma size={12} />
                      Calculo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleAddResultNode();
                      }}
                      disabled={!canWriteDataFlow || configSaving}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        borderRadius: 8,
                        border: "1px solid var(--df-orange-border)",
                        background: "var(--df-orange-soft)",
                        color: "#9a4c08",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: canWriteDataFlow && !configSaving ? "pointer" : "not-allowed",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Target size={12} />
                      Resultado
                    </button>
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 999,
                      padding: "6px 12px",
                      background: canvasMode === "result" ? activeTokens.soft : "#fff",
                      border: `1px solid ${canvasMode === "result" ? activeTokens.border : "var(--df-stone-200)"}`,
                      color: canvasMode === "result" ? activeTokens.text : "var(--df-stone-600)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Target size={13} />
                    {canvasMode === "result"
                      ? `Trazando ${viewNodes.find((node) => node.id === focusViewId)?.label ?? "resultado"}`
                      : "Sin foco"}
                  </div>
                </div>

                {loading ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--df-stone-500)", fontSize: 13 }}>
                    <div style={{ textAlign: "center" }}>
                      <Loader2 size={20} style={{ margin: "0 auto 10px" }} />
                      Cargando trazabilidad&hellip;
                    </div>
                  </div>
                ) : error ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                    <div
                      style={{
                        border: "1px solid #fecaca",
                        borderRadius: 12,
                        background: "#fef2f2",
                        padding: "16px 18px",
                        color: "#991b1b",
                        fontSize: 13,
                      }}
                    >
                      {error}
                    </div>
                  </div>
                ) : (
                  <div
                    ref={canvasOuterRef}
                    style={{
                      flex: 1,
                      height: canvasViewportHeight,
                      minHeight: 560,
                      position: "relative",
                      background: "var(--df-panel-soft)",
                    }}
                  >
                    <ReactFlow
                      key={`${layoutDirection}:${canvasMode}:${focusViewId ?? "all"}:${flowNodes.length}:${flowEdges.length}`}
                      nodes={flowNodes}
                      edges={flowEdges}
                      nodeTypes={DATA_FLOW_NODE_TYPES}
                      edgeTypes={DATA_FLOW_EDGE_TYPES}
                      onNodeClick={handleFlowNodeClick}
                      onConnect={(connection) => {
                        void handleFlowConnect(connection);
                      }}
                      onPaneClick={() => {
                        setSelectedNodeId(null);
                        setInspectorAnchor(null);
                      }}
                      fitView
                      fitViewOptions={{ padding: 0.24 }}
                      minZoom={0.35}
                      maxZoom={1.6}
                      nodesDraggable={false}
                      nodesConnectable={canWriteDataFlow}
                      elementsSelectable
                      panOnScroll
                      selectionOnDrag
                      proOptions={{ hideAttribution: true }}
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                      className="absolute! w-full h-full"
                    >
                      <Background color="rgba(28,25,23,.12)" gap={22} size={1} />
                      <Panel position="top-left">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            padding: "6px 8px",
                            borderRadius: 10,
                            background: "rgba(255,255,255,.92)",
                            border: "1px solid var(--df-stone-200)",
                            boxShadow: "0 1px 0 rgba(0,0,0,.03)",
                          }}
                        >
                          {layout.orderedLayers.map((layerKey) => {
                            const config =
                              layerKey === "calculation"
                                ? { color: "#7c3aed", icon: Sigma, label: "Calculo" }
                                : layerKey === "view"
                                  ? { color: "var(--df-orange)", icon: Target, label: "Resultado" }
                                  : layerKey === "macro_table"
                                    ? { color: "#0891b2", icon: Layers, label: "Macrotabla" }
                                    : layerKey === "obra_field"
                                      ? { color: "#0f766e", icon: FileText, label: "Campo de obra" }
                                      : layerKey === "document"
                                        ? { color: "#a16207", icon: FolderOpen, label: "Documentos" }
                                        : { color: "var(--df-stone-800)", icon: Database, label: "Tabla" };

                            return (
                              <SectionTag
                                key={layerKey}
                                color={config.color}
                                icon={config.icon}
                                label={config.label}
                                count={layers.get(layerKey)?.length ?? 0}
                              />
                            );
                          })}
                        </div>
                      </Panel>
                      <Controls position="bottom-left" showInteractive={false} />
                      <MiniMap
                        position="bottom-right"
                        pannable
                        zoomable
                        nodeStrokeWidth={2}
                        nodeColor={(node) => {
                          const data = node.data as Partial<DataFlowFlowNodeData> | undefined;
                          return data?.node ? nodeMeta(data.node.type).color : "#d6d3d1";
                        }}
                        style={{
                          width: 130,
                          height: 90,
                          borderRadius: 10,
                          border: "1px solid var(--df-stone-200)",
                          overflow: "hidden",
                        }}
                      />
                    </ReactFlow>

                    {canvasMode === "result" && focusViewId ? (
                      <div
                        style={{
                          position: "absolute",
                          top: 14,
                          left: "50%",
                          transform: "translateX(-50%)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 14px",
                          background: activeTokens.solid,
                          color: "#fff",
                          borderRadius: 999,
                          boxShadow: `0 6px 20px ${activeTokens.shadow}`,
                          fontSize: 12,
                          fontWeight: 600,
                          zIndex: 5,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", opacity: 0.85 }}>
                          Trazando
                        </span>
                        <span>{viewNodes.find((node) => node.id === focusViewId)?.label ?? "Resultado"}</span>
                      </div>
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          top: 14,
                          right: 14,
                          background: "rgba(255,255,255,.94)",
                          border: "1px solid var(--df-stone-200)",
                          borderRadius: 10,
                          padding: "8px 12px",
                          fontSize: 12,
                          color: "var(--df-stone-600)",
                          boxShadow: "0 1px 0 rgba(0,0,0,.03)",
                          maxWidth: 240,
                          zIndex: 5,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: ".15em",
                            textTransform: "uppercase",
                            color: "var(--df-orange)",
                            marginBottom: 3,
                          }}
                        >
                          Vista completa
                        </div>
                        Click en un <strong>resultado</strong> para ver de donde sale ese flujo.
                      </div>
                    )}
                  </div>
                )}

                <InspectorPopover
                  node={selectedNode}
                  anchor={inspectorAnchor}
                  upstreamNodes={upstreamNodes}
                  onClose={() => setInspectorAnchor(null)}
                  onNavigate={navigateInspector}
                  onOpenTable={(tableNode) => setOpenedTableNode(tableNode)}
                  onOpenEditor={handleOpenEditorForNode}
                />
              </div>
            </>
          )}
          </div>

          <DataFlowEditorDrawer
            open={editorOpen}
            config={
              configPayload?.config ?? {
                version: 1,
                calculations: [],
                results: [],
                generalTabLayout: [],
              }
            }
            payload={configPayload}
            saving={configSaving}
            error={configError}
            editTarget={editorTarget}
            onClose={() => setEditorOpen(false)}
            onConfigChange={(config) =>
              setConfigPayload((current) =>
                current
                  ? { ...current, config }
                  : {
                    config,
                    sources: { tables: [], macroTables: [], obraFields: [] },
                    evaluated: null,
                  }
              )
            }
            onSave={handleSaveBuilderConfig}
          />
        </div>
      </div>

      <HoverPreview node={hoverNode} hover={hover} />

      {scope === "obra" && obraId ? (
        <>
          <TableDrawer
            obraId={obraId}
            tableNode={openedTableNode}
            open={Boolean(openedTableNode)}
            onClose={() => setOpenedTableNode(null)}
            onOpenDocument={setSelectedDocument}
          />

          <DocumentPreviewModal obraId={obraId} selected={selectedDocument} onClose={() => setSelectedDocument(null)} />
        </>
      ) : null}

    </div>
  );
}

export default function ObraDataFlowPageClient() {
  const params = useParams<{ obraId: string }>();
  const obraId = typeof params?.obraId === "string" ? params.obraId : "";

  return (
    <DataFlowPageClient
      scope="obra"
      graphEndpoint={`/api/obras/${obraId}/data-flow-graph`}
      configEndpoint={`/api/obras/${obraId}/data-flow-config?includeEvaluated=1`}
      backHref={`/excel/${obraId}`}
      backLabel="Volver a la obra"
      breadcrumbRoot="Obras"
    />
  );
}
