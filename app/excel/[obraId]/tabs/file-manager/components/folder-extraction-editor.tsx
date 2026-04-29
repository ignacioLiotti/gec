"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  FolderOpen,
  GitBranchPlus,
  RefreshCw,
  Save,
  ScanSearch,
  ShieldAlert,
  Table2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SupportStatus = "implemented" | "partial" | "planned" | "not_supported";
type DataInputMethod = "ocr" | "manual" | "both";
type NodeType =
  | "folder_source"
  | "document_classifier"
  | "extraction_strategy"
  | "table_mapper"
  | "lineage_policy"
  | "conflict_handler"
  | "downstream_consumers";

type ExtractionPipelineNode = {
  id: string;
  type: NodeType;
  label: string;
  status: string;
  supportStatus: SupportStatus;
  data: Record<string, unknown>;
};

type ExtractionPipelineEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
};

type ExtractionPipelinePayload = {
  folder: {
    path: string;
    label: string;
  };
  config: {
    dataInputMethod: DataInputMethod;
    documentTypes: string[];
    extractionInstructions: string;
    ocrTemplateId: string | null;
    spreadsheetTemplate: "auto" | "certificado" | null;
    defaultTablaId: string | null;
    manualEntryEnabled: boolean;
    hasNestedData: boolean;
    sharedSettingsUniform: boolean;
    targetTablaIds: string[];
  };
  tables: Array<{
    id: string;
    name: string;
    rowCount: number;
    isDefault: boolean;
    status: "ready" | "partial" | "conflict";
    editable: boolean;
    editabilityReason: string;
    mappedColumns: Array<{
      id: string;
      fieldKey: string;
      label: string;
      dataType: string;
      required: boolean;
      position: number;
    }>;
    unmappedColumns: Array<{
      fieldKey: string;
      label: string;
      dataType: string;
      required: boolean;
    }>;
    extraColumns: Array<{
      id: string;
      fieldKey: string;
      label: string;
      dataType: string;
      required: boolean;
      position: number;
    }>;
    consumers: Array<{
      id: string;
      name: string;
    }>;
    mappingConflicts: Array<{
      code: string;
      message: string;
    }>;
  }>;
  templates: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  macroTables: Array<{
    id: string;
    name: string;
  }>;
  lineage: {
    totalRows: number;
    stableRows: number;
    legacyRows: number;
    rematerializedRows: number;
    rowsWithExtraction: number;
  };
  conflicts: {
    ocrConflicts: number;
    downstreamConflicts: number;
    stableOverrides: number;
    legacyOverrides: number;
  };
  stats: {
    linkedTables: number;
    documents: number;
    macroTables: number;
  };
  graph: {
    nodes: ExtractionPipelineNode[];
    edges: ExtractionPipelineEdge[];
  };
};

type DraftState = {
  dataInputMethod: DataInputMethod;
  documentTypesText: string;
  extractionInstructions: string;
  ocrTemplateId: string | null;
  spreadsheetTemplate: "auto" | "certificado";
  defaultTablaId: string | null;
  manualEntryEnabled: boolean;
  hasNestedData: boolean;
};

type FolderExtractionEditorProps = {
  obraId: string;
  folderPath: string | null;
  refreshKey?: number;
  onSaved?: () => void | Promise<void>;
};

function supportTone(status: SupportStatus) {
  switch (status) {
    case "implemented":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "planned":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "not_supported":
      return "border-stone-200 bg-stone-100 text-stone-700";
  }
}

function metricPill(label: string, value: string | number, tone = "stone") {
  const toneClassName =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-700"
          : tone === "sky"
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : "border-stone-200 bg-stone-50 text-stone-700";
  return (
    <div className={cn("rounded-md border px-2.5 py-2", toneClassName)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function nodeStatusTone(status: string) {
  if (status === "conflict") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "implemented" || status === "configured" || status === "connected" || status === "single_target" || status === "stable_identity" || status === "flag_conflict") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "mixed" || status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "fan_out") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-stone-200 bg-stone-100 text-stone-700";
}

function capabilityMeta(type: NodeType) {
  switch (type) {
    case "document_classifier":
    case "extraction_strategy":
      return {
        mode: "editable" as const,
        reason: "Editable en este slice y persistido sobre las tablas vinculadas del folder.",
      };
    case "table_mapper":
      return {
        mode: "partial" as const,
        reason: "Solo se puede editar la tabla primaria. El mapping por columna todavia es read-only desde este editor.",
      };
    default:
      return {
        mode: "read-only" as const,
        reason: "Visible para observabilidad y contexto, sin persistencia editable en este slice.",
      };
  }
}

function capabilityTone(mode: "editable" | "partial" | "read-only") {
  if (mode === "editable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (mode === "partial") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-stone-200 bg-stone-100 text-stone-700";
}

function tableStateTone(status: "ready" | "partial" | "conflict") {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

function renderColumnList(
  columns: Array<{ fieldKey: string; label: string }>,
  emptyLabel: string,
  tone: "emerald" | "amber" | "stone" = "stone",
) {
  if (columns.length === 0) {
    return <p className="text-[11px] text-stone-500">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {columns.slice(0, 6).map((column) => (
        <Badge
          key={`${column.fieldKey}:${column.label}`}
          variant="outline"
          className={cn(
            "max-w-full text-[10px]",
            tone === "emerald"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : tone === "amber"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-stone-200 bg-white text-stone-700",
          )}
        >
          {column.label}
        </Badge>
      ))}
      {columns.length > 6 ? (
        <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-700">
          +{columns.length - 6}
        </Badge>
      ) : null}
    </div>
  );
}

function parseDocumentTypes(text: string) {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createDraft(payload: ExtractionPipelinePayload): DraftState {
  return {
    dataInputMethod: payload.config.dataInputMethod,
    documentTypesText: payload.config.documentTypes.join(", "),
    extractionInstructions: payload.config.extractionInstructions,
    ocrTemplateId: payload.config.ocrTemplateId,
    spreadsheetTemplate: payload.config.spreadsheetTemplate ?? "auto",
    defaultTablaId: payload.config.defaultTablaId,
    manualEntryEnabled: payload.config.manualEntryEnabled,
    hasNestedData: payload.config.hasNestedData,
  };
}

function nodeIcon(type: NodeType) {
  switch (type) {
    case "folder_source":
      return FolderOpen;
    case "document_classifier":
      return ScanSearch;
    case "extraction_strategy":
      return Workflow;
    case "table_mapper":
      return Table2;
    case "lineage_policy":
      return GitBranchPlus;
    case "conflict_handler":
      return ShieldAlert;
    case "downstream_consumers":
      return Table2;
  }
}

export function FolderExtractionEditor({
  obraId,
  folderPath,
  refreshKey = 0,
  onSaved,
}: FolderExtractionEditorProps) {
  const [payload, setPayload] = useState<ExtractionPipelinePayload | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!obraId || !folderPath) {
      setPayload(null);
      setDraft(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ folderPath: folderPath ?? "" });
        const response = await fetch(
          `/api/obras/${obraId}/folders/extraction-pipeline?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const json = (await response.json().catch(() => ({}))) as ExtractionPipelinePayload | { error?: string };
        if (!response.ok) {
          throw new Error(("error" in json && json.error) || "No se pudo cargar el editor de extraccion");
        }
        if (!cancelled) {
          const nextPayload = json as ExtractionPipelinePayload;
          setPayload(nextPayload);
          setDraft(createDraft(nextPayload));
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        if (!cancelled) {
          setPayload(null);
          setDraft(null);
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el editor de extraccion");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [folderPath, obraId, refreshKey, reloadNonce]);

  const hasChanges = useMemo(() => {
    if (!payload || !draft) return false;
    return JSON.stringify(createDraft(payload)) !== JSON.stringify(draft);
  }, [draft, payload]);

  const sortedNodes = useMemo(() => payload?.graph.nodes ?? [], [payload?.graph.nodes]);

  async function handleSave() {
    if (!obraId || !folderPath || !draft) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/obras/${obraId}/folders/extraction-pipeline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderPath,
          dataInputMethod: draft.dataInputMethod,
          documentTypes: parseDocumentTypes(draft.documentTypesText),
          extractionInstructions: draft.extractionInstructions,
          ocrTemplateId: draft.ocrTemplateId,
          spreadsheetTemplate: draft.spreadsheetTemplate,
          defaultTablaId: draft.defaultTablaId,
          manualEntryEnabled: draft.manualEntryEnabled,
          hasNestedData: draft.hasNestedData,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "No se pudo guardar el pipeline de extraccion");
      }
      toast.success("Pipeline de carpeta actualizado.");
      if (onSaved) {
        await onSaved();
      }
      setReloadNonce((value) => value + 1);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "No se pudo guardar el pipeline de extraccion");
    } finally {
      setIsSaving(false);
    }
  }

  if (!folderPath) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-[#f7f6f2] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-stone-800">
            <Workflow className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Editor de Extraccion</h3>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Editor de nodos para definir como se interpreta esta carpeta. Este slice edita solo controles ya soportados por el backend actual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadNonce((value) => value + 1)}
            disabled={isLoading || isSaving}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Recargar
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={!draft || !hasChanges || isSaving}
            className="gap-1.5"
          >
            <Save className={cn("h-3.5 w-3.5", isSaving && "animate-spin")} />
            Guardar pipeline
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {payload ? (
        <>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Carpeta</p>
              <p className="mt-2 text-sm font-medium text-stone-800">{payload.folder.label}</p>
              <p className="mt-1 truncate text-xs text-stone-500">{payload.folder.path}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Tablas vinculadas</p>
              <p className="mt-2 text-2xl font-semibold text-stone-900">{payload.stats.linkedTables}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Documentos trazados</p>
              <p className="mt-2 text-2xl font-semibold text-stone-900">{payload.stats.documents}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Macrotablas conectadas</p>
              <p className="mt-2 text-2xl font-semibold text-stone-900">{payload.stats.macroTables}</p>
            </div>
          </div>

          {!payload.config.sharedSettingsUniform ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Esta carpeta tiene configuracion mixta entre tablas vinculadas. Este editor guarda una configuracion compartida y la aplica a todas las tablas del folder en este slice.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_36px_1fr_36px_1fr_36px_1fr_36px_1fr_36px_1fr_36px_1fr]">
            {sortedNodes.map((node, index) => {
              const Icon = nodeIcon(node.type);
              const capability = capabilityMeta(node.type);
              return (
                <div key={node.id} className={cn(index < sortedNodes.length - 1 ? "xl:contents" : undefined)}>
                  <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-stone-500" />
                          <p className="truncate text-sm font-medium text-stone-800">{node.label}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={cn("text-[10px]", nodeStatusTone(node.status))}>
                          {node.status}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px]", capabilityTone(capability.mode))}>
                          {capability.mode}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px]", supportTone(node.supportStatus))}>
                          {node.supportStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3 text-xs text-stone-600">
                      <div className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2 text-[11px] text-stone-600">
                        {capability.reason}
                      </div>
                      {node.type === "folder_source" ? (
                        <>
                          <p>path: {String(node.data.folderPath ?? "-")}</p>
                          <p>docs trazados: {String(node.data.documentCount ?? 0)}</p>
                        </>
                      ) : null}

                      {node.type === "document_classifier" && draft ? (
                        <>
                          <div className="space-y-1.5">
                            <Label htmlFor="document-types-text" className="text-xs text-stone-700">
                              Tipos de documento
                            </Label>
                            <Input
                              id="document-types-text"
                              value={draft.documentTypesText}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current ? { ...current, documentTypesText: event.target.value } : current,
                                )
                              }
                              placeholder="ej. certificado, factura, orden de compra"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="extraction-instructions" className="text-xs text-stone-700">
                              Instrucciones de extraccion
                            </Label>
                            <Textarea
                              id="extraction-instructions"
                              value={draft.extractionInstructions}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current ? { ...current, extractionInstructions: event.target.value } : current,
                                )
                              }
                              className="min-h-[90px]"
                              placeholder="Indicaciones adicionales para OCR/extraccion."
                            />
                          </div>
                        </>
                      ) : null}

                      {node.type === "extraction_strategy" && draft ? (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-700">Modo de entrada</Label>
                            <Select
                              value={draft.dataInputMethod}
                              onValueChange={(value: DataInputMethod) =>
                                setDraft((current) => (current ? { ...current, dataInputMethod: value } : current))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ocr">OCR</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="both">Mixto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-700">Template OCR</Label>
                            <Select
                              value={draft.ocrTemplateId ?? "__none__"}
                              onValueChange={(value) =>
                                setDraft((current) =>
                                  current
                                    ? { ...current, ocrTemplateId: value === "__none__" ? null : value }
                                    : current,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sin template" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin template</SelectItem>
                                {payload.templates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-700">Modo spreadsheet</Label>
                            <Select
                              value={draft.spreadsheetTemplate}
                              onValueChange={(value: "auto" | "certificado") =>
                                setDraft((current) =>
                                  current ? { ...current, spreadsheetTemplate: value } : current,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">auto</SelectItem>
                                <SelectItem value="certificado">certificado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2">
                            <div>
                              <p className="text-xs font-medium text-stone-800">Entrada manual</p>
                              <p className="text-[11px] text-stone-500">Habilita carga manual sobre la carpeta.</p>
                            </div>
                            <Switch
                              checked={draft.manualEntryEnabled}
                              onCheckedChange={(checked) =>
                                setDraft((current) =>
                                  current ? { ...current, manualEntryEnabled: checked } : current,
                                )
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2">
                            <div>
                              <p className="text-xs font-medium text-stone-800">Datos anidados</p>
                              <p className="text-[11px] text-stone-500">Usa parent/item cuando el template lo requiere.</p>
                            </div>
                            <Switch
                              checked={draft.hasNestedData}
                              onCheckedChange={(checked) =>
                                setDraft((current) =>
                                  current ? { ...current, hasNestedData: checked } : current,
                                )
                              }
                            />
                          </div>
                        </>
                      ) : null}

                      {node.type === "table_mapper" && draft ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {metricPill("tablas destino", payload.tables.length, payload.tables.length > 1 ? "sky" : "emerald")}
                            {metricPill(
                              "modo",
                              payload.tables.length > 1 ? "fan-out" : "single-target",
                              payload.tables.length > 1 ? "sky" : "emerald",
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-700">Tabla primaria</Label>
                            <Select
                              value={draft.defaultTablaId ?? "__none__"}
                              onValueChange={(value) =>
                                setDraft((current) =>
                                  current
                                    ? { ...current, defaultTablaId: value === "__none__" ? null : value }
                                    : current,
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sin tabla primaria" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin tabla primaria</SelectItem>
                                {payload.tables.map((table) => (
                                  <SelectItem key={table.id} value={table.id}>
                                    {table.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] text-sky-800">
                            Impacto downstream: cambiar la tabla primaria actualiza el target principal compartido para templates/defaults del folder. No remapea filas historicas ni deduplica materializaciones existentes.
                          </div>
                          <div className="space-y-1.5">
                            {payload.tables.map((table) => (
                              <div key={table.id} className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-stone-800">{table.name}</p>
                                    <p className="mt-1 text-[11px] text-stone-500">
                                      {draft.defaultTablaId === table.id
                                        ? "Tabla primaria del folder para defaults/template compartido."
                                        : "Tabla secundaria dentro del fan-out actual."}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {draft.defaultTablaId === table.id ? (
                                      <Badge variant="outline" className="text-[10px] border-sky-200 bg-sky-50 text-sky-700">
                                        primaria
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-700">
                                        secundaria
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className={cn("text-[10px]", tableStateTone(table.status))}>
                                      {table.status}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-700">
                                      {table.rowCount} filas
                                    </Badge>
                                  </div>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {metricPill("mapeadas", table.mappedColumns.length, table.mappedColumns.length > 0 ? "emerald" : "stone")}
                                  {metricPill(
                                    "sin mapear",
                                    table.unmappedColumns.length,
                                    table.unmappedColumns.length > 0 ? "amber" : "emerald",
                                  )}
                                  {metricPill(
                                    "consumers",
                                    table.consumers.length,
                                    table.consumers.length > 0 ? "sky" : "stone",
                                  )}
                                  {metricPill(
                                    "conflicts",
                                    table.mappingConflicts.length,
                                    table.mappingConflicts.length > 0 ? "red" : "emerald",
                                  )}
                                </div>

                                <div className="mt-2 rounded-md border border-stone-200 bg-white px-2 py-2">
                                  <p className="text-[11px] font-medium text-stone-700">Columnas mapeadas</p>
                                  <div className="mt-1">
                                    {renderColumnList(
                                      table.mappedColumns.map((column) => ({
                                        fieldKey: column.fieldKey,
                                        label: column.label,
                                      })),
                                      "No hay columnas alineadas con el contrato fuente actual.",
                                      "emerald",
                                    )}
                                  </div>
                                </div>

                                <div className="mt-2 rounded-md border border-stone-200 bg-white px-2 py-2">
                                  <p className="text-[11px] font-medium text-stone-700">Columnas sin mapear</p>
                                  <div className="mt-1">
                                    {renderColumnList(
                                      table.unmappedColumns.map((column) => ({
                                        fieldKey: column.fieldKey,
                                        label: column.label,
                                      })),
                                      "Sin gaps detectados contra el template actual.",
                                      "amber",
                                    )}
                                  </div>
                                </div>

                                {table.extraColumns.length > 0 ? (
                                  <div className="mt-2 rounded-md border border-stone-200 bg-white px-2 py-2">
                                    <p className="text-[11px] font-medium text-stone-700">Columnas extra en destino</p>
                                    <div className="mt-1">
                                      {renderColumnList(
                                        table.extraColumns.map((column) => ({
                                          fieldKey: column.fieldKey,
                                          label: column.label,
                                        })),
                                        "Sin columnas extra.",
                                      )}
                                    </div>
                                  </div>
                                ) : null}

                                <div className="mt-2 rounded-md border border-stone-200 bg-white px-2 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-medium text-stone-700">Consumers downstream</p>
                                    <Badge variant="outline" className="text-[10px] border-stone-200 bg-stone-50 text-stone-700">
                                      {table.consumers.length > 0 ? "connected" : "none"}
                                    </Badge>
                                  </div>
                                  <div className="mt-1">
                                    {table.consumers.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {table.consumers.map((consumer) => (
                                          <Badge key={consumer.id} variant="outline" className="text-[10px] border-sky-200 bg-sky-50 text-sky-700">
                                            {consumer.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-stone-500">
                                        Esta tabla todavia no tiene consumers downstream visibles.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-2 rounded-md border border-stone-200 bg-white px-2 py-2">
                                  <p className="text-[11px] font-medium text-stone-700">Conflictos de mapping</p>
                                  <div className="mt-1 space-y-1">
                                    {table.mappingConflicts.length > 0 ? (
                                      table.mappingConflicts.map((conflict) => (
                                        <div key={conflict.code} className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                                          <p className="font-medium">{conflict.code}</p>
                                          <p className="mt-0.5">{conflict.message}</p>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-[11px] text-stone-500">No hay conflictos de mapping detectados para esta tabla.</p>
                                    )}
                                  </div>
                                </div>

                                <div className={cn(
                                  "mt-2 rounded-md border px-2.5 py-2 text-[11px]",
                                  table.editable ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-stone-200 bg-stone-100 text-stone-700",
                                )}>
                                  {table.editable ? "Editable" : "Read-only"}: {table.editabilityReason}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {node.type === "lineage_policy" ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {metricPill("rows totales", payload.lineage.totalRows)}
                            {metricPill("con extraction", payload.lineage.rowsWithExtraction, "sky")}
                            {metricPill("estables", payload.lineage.stableRows, "emerald")}
                            {metricPill("legacy", payload.lineage.legacyRows, "amber")}
                            {metricPill("rematerializadas", payload.lineage.rematerializedRows, "sky")}
                          </div>
                          <div className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2">
                            <p className="text-xs font-medium text-stone-800">Contrato activo</p>
                            <p className="mt-1 text-[11px] text-stone-600">
                              Identidad estable por <code>lineage_row_key</code>, corrida por <code>extraction_id</code> y continuidad por <code>materialization_version</code>.
                            </p>
                          </div>
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                            Nodo read-only en este slice. La politica de lineage ya esta implementada en backend y todavia no es configurable por carpeta.
                          </div>
                        </>
                      ) : null}

                      {node.type === "conflict_handler" ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {metricPill("ocr conflicts", payload.conflicts.ocrConflicts, payload.conflicts.ocrConflicts > 0 ? "red" : "emerald")}
                            {metricPill("downstream conflicts", payload.conflicts.downstreamConflicts, payload.conflicts.downstreamConflicts > 0 ? "red" : "emerald")}
                            {metricPill("overrides estables", payload.conflicts.stableOverrides, "emerald")}
                            {metricPill("fallback legacy", payload.conflicts.legacyOverrides, "amber")}
                          </div>
                          <div className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2">
                            <p className="text-xs font-medium text-stone-800">Codigos semanticos</p>
                            <p className="mt-1 text-[11px] text-stone-600">OCR: <code>LINEAGE_RECONCILIATION_CONFLICT</code></p>
                            <p className="mt-1 text-[11px] text-stone-600">Downstream: <code>LINEAGE_OVERRIDE_REATTACH_CONFLICT</code></p>
                          </div>
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                            No se resuelven ambiguedades en silencio. Este nodo es observabilidad por ahora; la resolucion manual todavia no esta implementada.
                          </div>
                        </>
                      ) : null}

                      {node.type === "downstream_consumers" ? (
                        payload.macroTables.length > 0 ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {metricPill("macro tablas", payload.macroTables.length, "emerald")}
                              {metricPill(
                                "estado downstream",
                                payload.conflicts.downstreamConflicts > 0 ? "conflicts" : "connected",
                                payload.conflicts.downstreamConflicts > 0 ? "red" : "emerald",
                              )}
                            </div>
                            <div className="space-y-1.5">
                            {payload.macroTables.map((macroTable) => (
                              <div key={macroTable.id} className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium text-stone-800">{macroTable.name}</p>
                                  <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                                    consumer real
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            </div>
                            <div className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-2 text-[11px] text-stone-600">
                              Estos consumers usan el output actual del folder. Reimportar o reprocesar esta carpeta puede impactar overrides y filas agregadas en estas macros.
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed border-stone-200 bg-stone-50 px-2.5 py-3 text-[11px] text-stone-500">
                            Sin macrotablas conectadas para este folder. El output existe, pero hoy no tiene consumers downstream visibles.
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>

                  {index < sortedNodes.length - 1 ? (
                    <div className="hidden items-center justify-center xl:flex">
                      <ArrowRight className="h-4 w-4 text-stone-300" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Cargando editor de extraccion...</span>
        </div>
      ) : null}
    </div>
  );
}
