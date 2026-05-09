"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ExternalLink,
  FolderOpen,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  ScanSearch,
  Table2,
  TriangleAlert,
  Waypoints,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveMacroSourceTablas,
  type MacroSourceTablaRecord,
} from "@/lib/macro-table-source-selection";
import { normalizeFieldKey, normalizeFolderName } from "@/lib/tablas";
import { cn } from "@/lib/utils";

type DataInputMethod = "ocr" | "manual" | "both";
type ExtractionRowMode = "single" | "multiple";
type FlowStatus = "configurada" | "incompleta" | "con_conflictos";
type PublishStatus = "not_supported";
type ViewMode = "system" | "folder";

type OcrColumn = {
  id?: string;
  fieldKey: string;
  label: string;
  dataType: string;
  required?: boolean;
  ocrScope?: string;
  description?: string | null;
  aliases?: string[];
  examples?: string[];
  excelKeywords?: string[];
};

type ExtractedTableConfig = {
  id: string;
  name: string;
  rowMode: ExtractionRowMode;
  maxRows: number | null;
  dataInputMethod: DataInputMethod;
  spreadsheetTemplate?: "auto" | "certificado" | null;
  ocrTemplateId?: string | null;
  ocrTemplateName?: string | null;
  manualEntryEnabled?: boolean;
  hasNestedData?: boolean;
  documentTypes?: string[];
  extractionInstructions?: string | null;
  columns?: OcrColumn[];
};

type DefaultFolder = {
  id: string;
  name: string;
  path: string;
  position: number;
  isOcr?: boolean;
  dataInputMethod?: DataInputMethod;
  spreadsheetTemplate?: "auto" | "certificado" | null;
  ocrTemplateId?: string | null;
  ocrTemplateName?: string | null;
  manualEntryEnabled?: boolean;
  hasNestedData?: boolean;
  documentTypes?: string[];
  extractionInstructions?: string | null;
  extractionRowMode?: ExtractionRowMode;
  extractionMaxRows?: number | null;
  columns?: OcrColumn[];
  extractedTables?: ExtractedTableConfig[];
};

type OcrTemplate = {
  id: string;
  name: string;
  description?: string | null;
};

type MacroTable = {
  id: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
  sourceCount?: number;
  columns?: Array<{
    id: string;
    label: string;
    sourceFieldKey: string | null;
    columnType: string;
    dataType: string;
  }>;
};

type FolderConnection = {
  tableId: string;
  macroTables: MacroTable[];
};

type Selection =
  | { kind: "folder"; folderId: string }
  | { kind: "table"; folderId: string; tableId: string }
  | { kind: "field"; folderId: string; tableId: string; fieldKey: string }
  | { kind: "macro"; folderId: string; macroId: string }
  | { kind: "output"; folderId: string };

type NodeKey =
  | `folder:${string}`
  | `field:${string}:${string}`
  | `table:${string}`
  | `macro:${string}`
  | `output:${string}`;

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyList(values: string[] | undefined | null) {
  return (values ?? []).join(", ");
}

function cloneFolder<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getParentPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

function getFolderPathPreview(folder: DefaultFolder) {
  const parent = getParentPath(folder.path);
  const name = normalizeFolderName(folder.name);
  return parent ? `${parent}/${name}` : name;
}

function getFolderTables(folder: DefaultFolder) {
  return folder.isOcr ? folder.extractedTables ?? [] : [];
}

function getFolderStatus(folder: DefaultFolder): FlowStatus {
  if (!folder.isOcr) return "configurada";
  const tables = getFolderTables(folder);
  if (tables.length === 0) return "incompleta";
  const hasEmptySchema = tables.some((table) => (table.columns?.length ?? 0) === 0);
  const hasMissingContract = tables.some((table) => {
    const method = table.dataInputMethod ?? folder.dataInputMethod ?? "both";
    if (method === "manual") return false;
    const hasSource = Boolean(
      table.ocrTemplateId ||
        table.spreadsheetTemplate ||
        folder.ocrTemplateId ||
        folder.spreadsheetTemplate,
    );
    return !hasSource;
  });
  if (hasEmptySchema || hasMissingContract) return "con_conflictos";
  const hasWeakMetadata = tables.some((table) =>
    (table.columns ?? []).some(
      (column) => !column.description || column.description.trim().length === 0,
    ),
  );
  return hasWeakMetadata ? "incompleta" : "configurada";
}

function statusTone(status: FlowStatus) {
  switch (status) {
    case "configurada":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "incompleta":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "con_conflictos":
      return "border-red-200 bg-red-50 text-red-700";
  }
}

function publishTone(_status: PublishStatus) {
  return "border-stone-200 bg-stone-100 text-stone-700";
}

function dataInputMethodLabel(value: DataInputMethod | undefined) {
  if (value === "ocr") return "OCR";
  if (value === "manual") return "Manual";
  return "Mixto";
}

function buildFolderConnections(folder: DefaultFolder, macroTables: MacroTable[]) {
  const tables = getFolderTables(folder);
  const candidates: MacroSourceTablaRecord[] = tables.map((table) => ({
    id: table.id,
    name: table.name,
    defaultTablaId: table.id,
  }));

  return tables.map((table) => {
    const connected = macroTables.filter((macroTable) => {
      const resolved = resolveMacroSourceTablas({
        settings: macroTable.settings ?? {},
        explicitSourceTablas: [],
        candidateTablas: candidates,
      });
      return resolved.some((candidate) => candidate.id === table.id);
    });
    return {
      tableId: table.id,
      macroTables: connected,
    } satisfies FolderConnection;
  });
}

function updateTableInFolder(
  folder: DefaultFolder,
  tableId: string,
  updater: (table: ExtractedTableConfig) => ExtractedTableConfig,
) {
  return {
    ...folder,
    extractedTables: getFolderTables(folder).map((table) =>
      table.id === tableId ? updater(table) : table,
    ),
  };
}

function updateFieldInFolder(
  folder: DefaultFolder,
  tableId: string,
  fieldKey: string,
  updater: (field: OcrColumn) => OcrColumn,
) {
  return updateTableInFolder(folder, tableId, (table) => ({
    ...table,
    columns: (table.columns ?? []).map((field) =>
      field.fieldKey === fieldKey ? updater(field) : field,
    ),
  }));
}

function buildSavePayload(folder: DefaultFolder) {
  const primaryTable = getFolderTables(folder)[0] ?? null;
  const isOcr = folder.isOcr === true;
  return {
    type: "folder",
    id: folder.id,
    name: folder.name.trim(),
    parentPath: getParentPath(folder.path) || null,
    isOcr,
    dataInputMethod: folder.dataInputMethod ?? primaryTable?.dataInputMethod ?? "both",
    spreadsheetTemplate: folder.spreadsheetTemplate ?? primaryTable?.spreadsheetTemplate ?? null,
    ocrTemplateId: folder.ocrTemplateId ?? primaryTable?.ocrTemplateId ?? null,
    manualEntryEnabled:
      typeof folder.manualEntryEnabled === "boolean"
        ? folder.manualEntryEnabled
        : typeof primaryTable?.manualEntryEnabled === "boolean"
          ? primaryTable.manualEntryEnabled
          : true,
    hasNestedData:
      typeof folder.hasNestedData === "boolean"
        ? folder.hasNestedData
        : Boolean(primaryTable?.hasNestedData),
    documentTypes: folder.documentTypes ?? primaryTable?.documentTypes ?? [],
    extractionInstructions:
      folder.extractionInstructions ?? primaryTable?.extractionInstructions ?? null,
    extractionRowMode: folder.extractionRowMode ?? primaryTable?.rowMode ?? "single",
    extractionMaxRows: folder.extractionMaxRows ?? primaryTable?.maxRows ?? 1,
    extractedTables: getFolderTables(folder).map((table, tableIndex) => ({
      id: table.id,
      name: table.name?.trim() || `Tabla ${tableIndex + 1}`,
      rowMode: table.rowMode,
      maxRows: table.rowMode === "multiple" ? table.maxRows ?? 25 : 1,
      dataInputMethod: table.dataInputMethod,
      spreadsheetTemplate: table.spreadsheetTemplate ?? null,
      ocrTemplateId: table.ocrTemplateId ?? null,
      manualEntryEnabled:
        typeof table.manualEntryEnabled === "boolean" ? table.manualEntryEnabled : true,
      hasNestedData: Boolean(table.hasNestedData),
      documentTypes: table.documentTypes ?? [],
      extractionInstructions: table.extractionInstructions ?? null,
      columns: (table.columns ?? []).map((column, columnIndex) => ({
        id: column.id,
        label: column.label,
        fieldKey: normalizeFieldKey(column.fieldKey || column.label),
        dataType: column.dataType,
        required: Boolean(column.required),
        position: columnIndex,
        ocrScope: column.ocrScope,
        description: column.description ?? null,
        aliases: column.aliases ?? [],
        examples: column.examples ?? [],
        excelKeywords: column.excelKeywords ?? [],
      })),
    })),
    columns: (primaryTable?.columns ?? folder.columns ?? []).map((column, columnIndex) => ({
      id: column.id,
      label: column.label,
      fieldKey: normalizeFieldKey(column.fieldKey || column.label),
      dataType: column.dataType,
      required: Boolean(column.required),
      position: columnIndex,
      ocrScope: column.ocrScope,
      description: column.description ?? null,
      aliases: column.aliases ?? [],
      examples: column.examples ?? [],
      excelKeywords: column.excelKeywords ?? [],
    })),
  };
}

function selectionKey(selection: Selection): NodeKey {
  switch (selection.kind) {
    case "folder":
      return `folder:${selection.folderId}`;
    case "table":
      return `table:${selection.tableId}`;
    case "field":
      return `field:${selection.tableId}:${selection.fieldKey}`;
    case "macro":
      return `macro:${selection.macroId}`;
    case "output":
      return `output:${selection.folderId}`;
  }
}

function selectionTitle(selection: Selection, folder: DefaultFolder | null, tableName?: string | null) {
  switch (selection.kind) {
    case "folder":
      return folder?.name ?? "Carpeta";
    case "table":
      return tableName ?? "Tabla";
    case "field":
      return selection.fieldKey;
    case "macro":
      return "Macrotabla";
    case "output":
      return "Consumo / vista final";
  }
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
      <p className="mt-1 text-xs text-stone-500">{detail}</p>
    </div>
  );
}

function FlowChip({
  folder,
  active,
  onClick,
}: {
  folder: DefaultFolder;
  active: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const tables = getFolderTables(folder);
  const status = getFolderStatus(folder);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-[240px] rounded-[26px] border p-4 text-left shadow-sm transition",
        active
          ? "border-[#d78233] bg-[#fff1e2] shadow-[0_16px_40px_rgba(201,107,20,0.16)]"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-950">{folder.name}</p>
          <p className="mt-1 truncate text-xs text-stone-500">/{folder.path}</p>
        </div>
        <Badge className={cn("border text-[10px]", statusTone(status))}>{status.replace("_", " ")}</Badge>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Tablas / campos</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
            {tables.length} / {tables.reduce((total, table) => total + (table.columns?.length ?? 0), 0)}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-[#9c5511]">
          Ver flujo
          <ArrowRight className="size-3.5" />
        </div>
      </div>
    </button>
  );
}

function LayerNodeCard({
  title,
  subtitle,
  selected,
  dimmed,
  onClick,
  register,
  badges,
  children,
}: {
  title: string;
  subtitle?: string | null;
  selected: boolean;
  dimmed: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  register: (element: HTMLButtonElement | null) => void;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <button
      ref={register}
      type="button"
      onClick={onClick}
      className={cn(
        "w-[300px] rounded-[24px] border bg-white p-4 text-left shadow-sm transition",
        selected ? "border-[#d78233] ring-2 ring-[#f6c18b]/70" : "border-stone-200 hover:border-stone-300 hover:shadow-md",
        dimmed ? "opacity-35" : "opacity-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-950">{title}</p>
          {subtitle ? <p className="mt-1 text-xs text-stone-500">{subtitle}</p> : null}
        </div>
        {badges ? <div className="flex flex-wrap justify-end gap-1.5">{badges}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </button>
  );
}

function FloatingInspector({
  anchor,
  selection,
  folder,
  selectedTable,
  selectedField,
  selectedMacro,
  ocrTemplates,
  hasChanges,
  isSaving,
  onClose,
  onSave,
  setDraftFolder,
}: {
  anchor: HTMLElement | null;
  selection: Selection | null;
  folder: DefaultFolder | null;
  selectedTable: ExtractedTableConfig | null;
  selectedField: OcrColumn | null;
  selectedMacro: MacroTable | null;
  ocrTemplates: OcrTemplate[];
  hasChanges: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => Promise<void> | void;
  setDraftFolder: React.Dispatch<React.SetStateAction<DefaultFolder | null>>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useEffect(() => {
    if (!anchor || !selection) return;
    const compute = () => {
      const rect = anchor.getBoundingClientRect();
      const width = ref.current?.offsetWidth ?? 380;
      const height = ref.current?.offsetHeight ?? 520;
      const margin = 16;
      let left = rect.right + 16;
      if (left + width > window.innerWidth - margin) {
        left = rect.left - width - 16;
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
  }, [anchor, selection]);

  if (!anchor || !selection || !folder) return null;

  const inspectorTitle =
    selection.kind === "folder"
      ? folder.name
      : selection.kind === "table"
        ? selectedTable?.name ?? "Tabla"
        : selection.kind === "field"
          ? selectedField?.label ?? selection.fieldKey
          : selection.kind === "macro"
            ? selectedMacro?.name ?? "Macrotabla"
            : "Consumo / vista final";

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-[380px] rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(28,25,23,0.18)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="flex items-start gap-3 border-b border-stone-100 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              {selection.kind === "folder"
                ? "Carpeta"
                : selection.kind === "table"
                  ? "Tabla destino"
                  : selection.kind === "field"
                    ? "Campo extraido"
                    : selection.kind === "macro"
                      ? "Macrotabla"
                      : "Consumo final"}
            </p>
            <Badge className="border border-stone-200 bg-stone-100 text-[10px] text-stone-700">
              {selection.kind === "macro" || selection.kind === "output" ? "read-only" : "editable"}
            </Badge>
          </div>
          <p className="mt-1 text-base font-semibold text-stone-950">{inspectorTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="size-4" />
        </button>
      </div>

      <ScrollArea className="max-h-[70vh]">
        <div className="space-y-4 p-4">
          {selection.kind === "folder" ? (
            <>
              <InspectorSection title="Contrato base de la carpeta">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nombre de la carpeta</Label>
                    <Input
                      value={folder.name}
                      onChange={(event) =>
                        setDraftFolder((current) => (current ? { ...current, name: event.target.value } : current))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Path proyectado</Label>
                    <Input value={getFolderPathPreview(folder)} readOnly />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Estado</Label>
                      <Badge className={cn("border text-[10px]", statusTone(getFolderStatus(folder)))}>
                        {getFolderStatus(folder).replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label>Publicacion</Label>
                      <Badge className={cn("border text-[10px]", publishTone("not_supported"))}>no soportado</Badge>
                    </div>
                  </div>
                </div>
              </InspectorSection>

              {folder.isOcr ? (
                <>
                  <InspectorSection title="Extraccion">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Modo de entrada</Label>
                        <Select
                          value={folder.dataInputMethod ?? "both"}
                          onValueChange={(value: DataInputMethod) =>
                            setDraftFolder((current) => (current ? { ...current, dataInputMethod: value } : current))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ocr">OCR</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="both">Mixto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Template OCR</Label>
                        <Select
                          value={folder.ocrTemplateId ?? "__none__"}
                          onValueChange={(value) =>
                            setDraftFolder((current) =>
                              current
                                ? {
                                    ...current,
                                    ocrTemplateId: value === "__none__" ? null : value,
                                    ocrTemplateName:
                                      value === "__none__"
                                        ? null
                                        : ocrTemplates.find((template) => template.id === value)?.name ?? null,
                                  }
                                : current,
                            )
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Sin template OCR" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin template OCR</SelectItem>
                            {ocrTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Modo spreadsheet</Label>
                        <Select
                          value={folder.spreadsheetTemplate ?? "__none__"}
                          onValueChange={(value) =>
                            setDraftFolder((current) =>
                              current
                                ? {
                                    ...current,
                                    spreadsheetTemplate: value === "__none__" ? null : (value as "auto" | "certificado"),
                                  }
                                : current,
                            )
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Sin template spreadsheet" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin template spreadsheet</SelectItem>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="certificado">Certificado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </InspectorSection>

                  <InspectorSection title="Tipos e instrucciones">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Tipos de documento</Label>
                        <Input
                          value={stringifyList(folder.documentTypes)}
                          onChange={(event) =>
                            setDraftFolder((current) =>
                              current ? { ...current, documentTypes: parseList(event.target.value) } : current,
                            )
                          }
                          placeholder="facturas, remitos, certificados"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Instrucciones de extraccion</Label>
                        <Textarea
                          className="min-h-[140px]"
                          value={folder.extractionInstructions ?? ""}
                          onChange={(event) =>
                            setDraftFolder((current) =>
                              current ? { ...current, extractionInstructions: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </div>
                  </InspectorSection>

                  <InspectorSection title="Flags operativas">
                    <div className="grid gap-3">
                      <ToggleCard
                        title="Entrada manual"
                        description="Permite carga complementaria sobre la carpeta."
                        checked={Boolean(folder.manualEntryEnabled)}
                        onCheckedChange={(checked) =>
                          setDraftFolder((current) => (current ? { ...current, manualEntryEnabled: checked } : current))
                        }
                      />
                      <ToggleCard
                        title="Datos anidados"
                        description="Activa parent/item cuando el contrato lo requiere."
                        checked={Boolean(folder.hasNestedData)}
                        onCheckedChange={(checked) =>
                          setDraftFolder((current) => (current ? { ...current, hasNestedData: checked } : current))
                        }
                      />
                    </div>
                  </InspectorSection>
                </>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                  Carpeta simple. En este slice no materializa tablas ni campos.
                </div>
              )}
            </>
          ) : null}

          {selection.kind === "table" && selectedTable ? (
            <>
              <InspectorSection title="Configuracion de tabla">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nombre</Label>
                    <Input
                      value={selectedTable.name}
                      onChange={(event) =>
                        setDraftFolder((current) =>
                          current
                            ? updateTableInFolder(current, selectedTable.id, (table) => ({ ...table, name: event.target.value }))
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Modo de filas</Label>
                      <Select
                        value={selectedTable.rowMode}
                        onValueChange={(value: ExtractionRowMode) =>
                          setDraftFolder((current) =>
                            current
                              ? updateTableInFolder(current, selectedTable.id, (table) => ({
                                  ...table,
                                  rowMode: value,
                                  maxRows: value === "multiple" ? table.maxRows ?? 25 : 1,
                                }))
                              : current,
                          )
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">single</SelectItem>
                          <SelectItem value="multiple">multiple</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Max rows</Label>
                      <Input
                        type="number"
                        value={selectedTable.maxRows ?? 1}
                        disabled={selectedTable.rowMode !== "multiple"}
                        onChange={(event) =>
                          setDraftFolder((current) =>
                            current
                              ? updateTableInFolder(current, selectedTable.id, (table) => ({
                                  ...table,
                                  maxRows: Number.parseInt(event.target.value || "1", 10),
                                }))
                              : current,
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Modo de entrada</Label>
                    <Select
                      value={selectedTable.dataInputMethod}
                      onValueChange={(value: DataInputMethod) =>
                        setDraftFolder((current) =>
                          current
                            ? updateTableInFolder(current, selectedTable.id, (table) => ({ ...table, dataInputMethod: value }))
                            : current,
                        )
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ocr">OCR</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="both">Mixto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Instrucciones</Label>
                    <Textarea
                      className="min-h-[120px]"
                      value={selectedTable.extractionInstructions ?? ""}
                      onChange={(event) =>
                        setDraftFolder((current) =>
                          current
                            ? updateTableInFolder(current, selectedTable.id, (table) => ({
                                ...table,
                                extractionInstructions: event.target.value,
                              }))
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              </InspectorSection>
            </>
          ) : null}

          {selection.kind === "field" && selectedTable && selectedField ? (
            <>
              <InspectorSection title="Prompt de campo">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nombre visible</Label>
                    <Input
                      value={selectedField.label}
                      onChange={(event) =>
                        setDraftFolder((current) =>
                          current
                            ? updateFieldInFolder(current, selectedTable.id, selectedField.fieldKey, (field) => ({
                                ...field,
                                label: event.target.value,
                              }))
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Nombre interno</Label>
                    <Input
                      value={selectedField.fieldKey}
                      onChange={(event) =>
                        setDraftFolder((current) =>
                          current
                            ? updateFieldInFolder(current, selectedTable.id, selectedField.fieldKey, (field) => ({
                                ...field,
                                fieldKey: normalizeFieldKey(event.target.value),
                              }))
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Descripcion / prompt</Label>
                    <Textarea
                      className="min-h-[140px]"
                      value={selectedField.description ?? ""}
                      onChange={(event) =>
                        setDraftFolder((current) =>
                          current
                            ? updateFieldInFolder(current, selectedTable.id, selectedField.fieldKey, (field) => ({
                                ...field,
                                description: event.target.value,
                              }))
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              </InspectorSection>
            </>
          ) : null}

          {selection.kind === "macro" && selectedMacro ? (
            <>
              <InspectorSection title="Downstream real">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <SummaryMini label="Sources" value={selectedMacro.sourceCount ?? 0} />
                    <SummaryMini label="Columnas" value={selectedMacro.columns?.length ?? 0} />
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                    Read-only en este slice. La relacion se resuelve desde la seleccion de fuentes de la macrotabla y el contrato default del tenant.
                  </div>
                </div>
              </InspectorSection>
            </>
          ) : null}

          {selection.kind === "output" ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Reportes / vistas / consumo final siguen planned en este slice. Esta capa queda visible como mapa, pero no se edita todavia.
            </div>
          ) : null}

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-stone-500">
              {hasChanges ? "Hay cambios pendientes sobre el contrato del tenant." : "Sin cambios pendientes."}
            </div>
            <Button onClick={() => void onSave()} disabled={!hasChanges || isSaving} className="gap-1.5">
              <Save className={cn("size-4", isSaving && "animate-spin")} />
              Guardar
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{title}</p>
      {children}
    </div>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <div>
        <p className="text-sm font-medium text-stone-800">{title}</p>
        <p className="text-[11px] text-stone-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SummaryMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-stone-950">{value}</p>
    </div>
  );
}

export default function AdminDocumentFlowsPage() {
  const [folders, setFolders] = useState<DefaultFolder[]>([]);
  const [macroTables, setMacroTables] = useState<MacroTable[]>([]);
  const [ocrTemplates, setOcrTemplates] = useState<OcrTemplate[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draftFolder, setDraftFolder] = useState<DefaultFolder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("folder");
  const [inspectorAnchor, setInspectorAnchor] = useState<HTMLElement | null>(null);

  const nodeRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [defaultsRes, macroRes, templatesRes] = await Promise.all([
          fetch("/api/obra-defaults", { cache: "no-store" }),
          fetch("/api/macro-tables", { cache: "no-store" }),
          fetch("/api/ocr-templates", { cache: "no-store" }),
        ]);

        const defaultsJson = (await defaultsRes.json().catch(() => ({}))) as { folders?: DefaultFolder[]; error?: string };
        const macroJson = (await macroRes.json().catch(() => ({}))) as { macroTables?: MacroTable[]; error?: string };
        const templatesJson = (await templatesRes.json().catch(() => ({}))) as { templates?: OcrTemplate[]; error?: string };

        if (!defaultsRes.ok) throw new Error(defaultsJson.error || "No se pudo cargar la configuracion documental");
        if (!macroRes.ok) throw new Error(macroJson.error || "No se pudieron cargar las macrotablas");
        if (!templatesRes.ok) throw new Error(templatesJson.error || "No se pudieron cargar las plantillas OCR");

        if (cancelled) return;
        const nextFolders = defaultsJson.folders ?? [];
        setFolders(nextFolders);
        setMacroTables(macroJson.macroTables ?? []);
        setOcrTemplates(templatesJson.templates ?? []);
        setSelectedFolderId((current) => {
          if (current && nextFolders.some((folder) => folder.id === current)) return current;
          return nextFolders[0]?.id ?? null;
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el editor global");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  useEffect(() => {
    if (!selectedFolderId) {
      setDraftFolder(null);
      setSelection(null);
      return;
    }
    const selected = folders.find((folder) => folder.id === selectedFolderId) ?? null;
    setDraftFolder(selected ? cloneFolder(selected) : null);
    setSelection(selected ? { kind: "folder", folderId: selected.id } : null);
  }, [folders, selectedFolderId]);

  const selectedFolder = draftFolder;
  const selectedTables = useMemo(() => (selectedFolder ? getFolderTables(selectedFolder) : []), [selectedFolder]);
  const folderConnections = useMemo(
    () => (selectedFolder ? buildFolderConnections(selectedFolder, macroTables) : []),
    [macroTables, selectedFolder],
  );
  const folderMacroTables = useMemo(() => {
    const unique = new Map<string, MacroTable>();
    for (const connection of folderConnections) {
      for (const macroTable of connection.macroTables) unique.set(macroTable.id, macroTable);
    }
    return [...unique.values()];
  }, [folderConnections]);

  const selectedTable =
    selection?.kind === "table" || selection?.kind === "field"
      ? selectedTables.find((table) => table.id === selection.tableId) ?? null
      : null;
  const selectedField =
    selection?.kind === "field"
      ? selectedTable?.columns?.find((field) => field.fieldKey === selection.fieldKey) ?? null
      : null;
  const selectedMacro =
    selection?.kind === "macro"
      ? folderMacroTables.find((macroTable) => macroTable.id === selection.macroId) ?? null
      : null;

  const hasChanges = useMemo(() => {
    const source = folders.find((folder) => folder.id === selectedFolderId) ?? null;
    if (!source || !draftFolder) return false;
    return JSON.stringify(source) !== JSON.stringify(draftFolder);
  }, [draftFolder, folders, selectedFolderId]);

  const relatedTableIds = useMemo(() => {
    if (!selection || !selectedFolder) return new Set<string>();
    if (selection.kind === "folder" || selection.kind === "output") {
      return new Set(selectedTables.map((table) => table.id));
    }
    if (selection.kind === "table" || selection.kind === "field") {
      return new Set([selection.tableId]);
    }
    if (selection.kind === "macro") {
      const connection = folderConnections.find((item) =>
        item.macroTables.some((macroTable) => macroTable.id === selection.macroId),
      );
      return new Set(connection ? [connection.tableId] : []);
    }
    return new Set<string>();
  }, [folderConnections, selectedFolder, selectedTables, selection]);

  const relatedMacroIds = useMemo(() => {
    if (!selection || !selectedFolder) return new Set<string>();
    if (selection.kind === "folder" || selection.kind === "output") {
      return new Set(folderMacroTables.map((macroTable) => macroTable.id));
    }
    if (selection.kind === "table" || selection.kind === "field") {
      return new Set(
        (folderConnections.find((item) => item.tableId === selection.tableId)?.macroTables ?? []).map((macro) => macro.id),
      );
    }
    if (selection.kind === "macro") {
      return new Set([selection.macroId]);
    }
    return new Set<string>();
  }, [folderConnections, folderMacroTables, selectedFolder, selection]);

  async function handleSave() {
    if (!draftFolder) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/obra-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(draftFolder)),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; folder?: DefaultFolder };
      if (!response.ok) throw new Error(json.error || "No se pudo guardar la configuracion documental");
      if (!json.folder) throw new Error("La API no devolvio la carpeta actualizada");
      setFolders((current) =>
        current.map((folder) => (folder.id === json.folder?.id ? json.folder : folder)),
      );
      toast.success("Flujo documental actualizado.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setIsSaving(false);
    }
  }

  function registerNode(key: NodeKey, element: HTMLElement | null) {
    if (!element) {
      nodeRefs.current.delete(key);
      return;
    }
    nodeRefs.current.set(key, element);
  }

  function openSelection(next: Selection, anchor: HTMLElement) {
    setSelection(next);
    setInspectorAnchor(anchor);
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[34px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(28,25,23,0.08)]">
          <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#fffdf9_0%,#f9f6ef_100%)] px-6 py-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                  <span>Administracion</span>
                  <ArrowRight className="size-3.5" />
                  <span>Tenant</span>
                  <ArrowRight className="size-3.5" />
                  <span className="font-medium text-stone-700">Document Flow 2</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Document Flow 2</h1>
                    <Badge className="border border-[#f6c18b] bg-[#fff1e2] text-[#9c5511]">comparacion handoff</Badge>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                    Version comparativa, conectada al mismo backend real del tenant, para medir uno a uno que tan cerca queda la implementacion respecto al proyecto de prueba exportado desde Claude Design.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-2xl border border-stone-200 bg-stone-50 p-1">
                  <Button
                    variant={viewMode === "system" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => setViewMode("system")}
                  >
                    Ver todo el sistema
                  </Button>
                  <Button
                    variant={viewMode === "folder" ? "default" : "ghost"}
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => setViewMode("folder")}
                  >
                    Ver por carpeta
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReloadNonce((value) => value + 1)}
                  disabled={isLoading || isSaving}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                  Recargar
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={!draftFolder || !hasChanges || isSaving}
                  className="gap-1.5"
                >
                  <Save className={cn("size-4", isSaving && "animate-spin")} />
                  Guardar cambios
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/document-flows">
                    Ver version actual
                    <ExternalLink className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/obra-defaults">
                    Editor avanzado
                    <ExternalLink className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-stone-200 bg-[#fbfaf6] px-6 py-5 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Carpetas" value={folders.length} detail="Contratos documentales base del tenant." />
            <SummaryCard
              label="Extraccion"
              value={folders.filter((folder) => folder.isOcr).length}
              detail="Carpetas que ya materializan tablas."
            />
            <SummaryCard
              label="Tablas"
              value={folders.reduce((total, folder) => total + getFolderTables(folder).length, 0)}
              detail="Tablas destino declaradas en defaults."
            />
            <SummaryCard
              label="Campos"
              value={folders.reduce(
                (total, folder) =>
                  total + getFolderTables(folder).reduce((tableTotal, table) => tableTotal + (table.columns?.length ?? 0), 0),
                0,
              )}
              detail="Campos y prompts editables."
            />
            <SummaryCard label="Macros" value={macroTables.length} detail="Macrotablas downstream disponibles." />
          </div>

          <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-stone-200 bg-[#faf8f3] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">Carpetas configuradas</p>
                    <p className="text-xs text-stone-500">Usalas como entry point del flujo documental del tenant.</p>
                  </div>
                  <Badge className="border border-stone-200 bg-white text-stone-700">
                    {viewMode === "system" ? "Sin foco" : "Foco en carpeta"}
                  </Badge>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {folders.map((folder) => (
                    <FlowChip
                      key={folder.id}
                      folder={folder}
                      active={selectedFolderId === folder.id}
                      onClick={(event) => {
                        setSelectedFolderId(folder.id);
                        setViewMode("folder");
                        openSelection({ kind: "folder", folderId: folder.id }, event.currentTarget);
                      }}
                    />
                  ))}
                </div>
              </div>

              {error ? (
                <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="rounded-[30px] border border-stone-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">Canvas de configuracion</p>
                    <p className="text-xs text-stone-500">
                      La carpeta ya no oculta logica. El flujo muestra campos, tablas, macrotablas y el consumo final reservado.
                    </p>
                  </div>
                  {selectedFolder ? (
                    <div className="rounded-full border border-[#f6c18b] bg-[#fff4e8] px-4 py-2 text-xs font-medium text-[#9c5511]">
                      {viewMode === "folder" ? `Editando · ${selectedFolder.name}` : `Sistema · ${selectedFolder.name}`}
                    </div>
                  ) : null}
                </div>

                {isLoading && !selectedFolder ? (
                  <div className="rounded-[26px] border border-stone-200 bg-[#faf8f3] px-6 py-14 text-center text-sm text-stone-500">
                    <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
                    Cargando flujos documentales...
                  </div>
                ) : selectedFolder ? (
                  <div className="overflow-x-auto rounded-[28px] border border-stone-200 bg-[#faf8f3] p-6">
                    <div className="flex min-w-[1280px] items-start gap-12">
                      <div className="w-[320px] shrink-0 space-y-4">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="size-3.5 text-stone-500" />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Campos extraidos</p>
                        </div>
                        {selectedTables.length > 0 ? (
                          selectedTables.flatMap((table) =>
                            (table.columns ?? []).map((field) => {
                              const isSelected =
                                selection?.kind === "field" &&
                                selection.tableId === table.id &&
                                selection.fieldKey === field.fieldKey;
                              const isRelated =
                                viewMode === "system" ||
                                (selection?.kind === "folder" || selection?.kind === "output") ||
                                (selection?.kind === "field" && selection.tableId === table.id && selection.fieldKey === field.fieldKey) ||
                                ((selection?.kind === "table" || selection?.kind === "field") && selection.tableId === table.id) ||
                                (selection?.kind === "macro" && relatedTableIds.has(table.id));

                              return (
                                <LayerNodeCard
                                  key={`field:${table.id}:${field.fieldKey}`}
                                  title={field.label}
                                  subtitle={field.description ?? `${table.name} · ${field.fieldKey}`}
                                  selected={isSelected}
                                  dimmed={!isRelated}
                                  onClick={(event) =>
                                    openSelection(
                                      { kind: "field", folderId: selectedFolder.id, tableId: table.id, fieldKey: field.fieldKey },
                                      event.currentTarget,
                                    )
                                  }
                                  register={(element) => registerNode(`field:${table.id}:${field.fieldKey}`, element)}
                                  badges={
                                    <>
                                      <Badge className="border border-stone-200 bg-white text-[10px] text-stone-700">{field.dataType}</Badge>
                                      {field.required ? (
                                        <Badge className="border border-amber-200 bg-amber-50 text-[10px] text-amber-800">requerido</Badge>
                                      ) : null}
                                    </>
                                  }
                                />
                              );
                            }),
                          )
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
                            Esta carpeta no define extraccion de campos.
                          </div>
                        )}
                      </div>

                      <div className="w-[320px] shrink-0 space-y-4">
                        <div className="flex items-center gap-2">
                          <Table2 className="size-3.5 text-stone-500" />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Tablas destino</p>
                        </div>
                        {selectedTables.length > 0 ? (
                          selectedTables.map((table) => {
                            const macros = folderConnections.find((item) => item.tableId === table.id)?.macroTables ?? [];
                            const isSelected = selection?.kind === "table" && selection.tableId === table.id;
                            const isRelated =
                              viewMode === "system" ||
                              selection?.kind === "folder" ||
                              selection?.kind === "output" ||
                              ((selection?.kind === "table" || selection?.kind === "field") && selection.tableId === table.id) ||
                              (selection?.kind === "macro" && relatedTableIds.has(table.id));
                            return (
                              <LayerNodeCard
                                key={table.id}
                                title={table.name}
                                subtitle={`${table.rowMode === "multiple" ? "multiples filas" : "fila unica"} · ${dataInputMethodLabel(table.dataInputMethod)}`}
                                selected={isSelected}
                                dimmed={!isRelated}
                                onClick={(event) =>
                                  openSelection({ kind: "table", folderId: selectedFolder.id, tableId: table.id }, event.currentTarget)
                                }
                                register={(element) => registerNode(`table:${table.id}`, element)}
                                badges={
                                  <>
                                    <Badge className="border border-stone-200 bg-white text-[10px] text-stone-700">
                                      {(table.columns ?? []).length} campos
                                    </Badge>
                                    {table.rowMode === "multiple" ? (
                                      <Badge className="border border-sky-200 bg-sky-50 text-[10px] text-sky-700">fan-out</Badge>
                                    ) : null}
                                  </>
                                }
                              >
                                <div className="flex items-center gap-2 text-xs text-stone-500">
                                  <span>{macros.length} macro(s) conectadas</span>
                                </div>
                              </LayerNodeCard>
                            );
                          })
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
                            Sin tablas materializadas para esta carpeta.
                          </div>
                        )}
                      </div>

                      <div className="w-[320px] shrink-0 space-y-4">
                        <div className="flex items-center gap-2">
                          <Layers className="size-3.5 text-stone-500" />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Macrotablas</p>
                        </div>
                        {folderMacroTables.length > 0 ? (
                          folderMacroTables.map((macroTable) => {
                            const isSelected = selection?.kind === "macro" && selection.macroId === macroTable.id;
                            const isRelated =
                              viewMode === "system" ||
                              selection?.kind === "folder" ||
                              selection?.kind === "output" ||
                              relatedMacroIds.has(macroTable.id);
                            return (
                              <LayerNodeCard
                                key={macroTable.id}
                                title={macroTable.name}
                                subtitle={macroTable.description ?? "Sin descripcion"}
                                selected={isSelected}
                                dimmed={!isRelated}
                                onClick={(event) =>
                                  openSelection({ kind: "macro", folderId: selectedFolder.id, macroId: macroTable.id }, event.currentTarget)
                                }
                                register={(element) => registerNode(`macro:${macroTable.id}`, element)}
                                badges={
                                  <Badge className="border border-stone-200 bg-white text-[10px] text-stone-700">
                                    {macroTable.columns?.length ?? 0} columnas
                                  </Badge>
                                }
                              />
                            );
                          })
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
                            Esta carpeta todavia no alimenta macrotablas.
                          </div>
                        )}
                      </div>

                      <div className="w-[280px] shrink-0 space-y-4">
                        <div className="flex items-center gap-2">
                          <Waypoints className="size-3.5 text-stone-500" />
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Consumo final</p>
                        </div>
                        <LayerNodeCard
                          title="Reportes / vistas / consumo"
                          subtitle="Capa reservada para slices posteriores"
                          selected={selection?.kind === "output"}
                          dimmed={false}
                          onClick={(event) =>
                            openSelection({ kind: "output", folderId: selectedFolder.id }, event.currentTarget)
                          }
                          register={(element) => registerNode(`output:${selectedFolder.id}`, element)}
                          badges={<Badge className="border border-blue-200 bg-blue-50 text-[10px] text-blue-700">planned</Badge>}
                        >
                          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                            Esta carpeta ya llega hasta macrotablas. El consumo final se habilita despues.
                          </div>
                        </LayerNodeCard>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-stone-200 bg-[#faf8f3] px-6 py-14 text-center text-sm text-stone-500">
                    Selecciona una carpeta para ver su flujo.
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-stone-950">Comparacion del corte</p>
                <p className="mt-1 text-xs text-stone-500">
                  Misma base de datos, mismo guardado y mismo contrato. La diferencia aca es el layout mucho mas literal al handoff.
                </p>
                <div className="mt-4 grid gap-3">
                  <SliceStatus label="Carpetas" value="implemented" tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
                  <SliceStatus label="Campos y prompts" value="implemented" tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
                  <SliceStatus label="Tablas destino" value="implemented" tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
                  <SliceStatus label="Macrotablas downstream" value="partial" tone="border-amber-200 bg-amber-50 text-amber-800" />
                  <SliceStatus label="Consumo final" value="planned" tone="border-blue-200 bg-blue-50 text-blue-700" />
                </div>
              </div>

              {hasChanges ? (
                <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Cambios sin publicar</p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        Hay cambios locales sobre el contrato documental del tenant. Guardalos desde arriba o desde el inspector.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      </div>

      <FloatingInspector
        anchor={inspectorAnchor}
        selection={selection}
        folder={selectedFolder}
        selectedTable={selectedTable}
        selectedField={selectedField}
        selectedMacro={selectedMacro}
        ocrTemplates={ocrTemplates}
        hasChanges={hasChanges}
        isSaving={isSaving}
        onClose={() => setInspectorAnchor(null)}
        onSave={handleSave}
        setDraftFolder={setDraftFolder}
      />
    </div>
  );
}

function SliceStatus({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-900">{label}</p>
        <Badge className={cn("border text-[10px]", tone)}>{value}</Badge>
      </div>
    </div>
  );
}
