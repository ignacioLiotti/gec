"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";
import { toast } from "sonner";
import {
  FolderPlus,
  TableProperties,
  Trash2,
  Pencil,
  Loader2,
  ScanLine,
  Plus,
  Folder,
  FolderInput,
  FileText,
  ChevronDown,
  ChevronUp,
  Hash,
  Type,
  Calendar,
  DollarSign,
  ToggleLeft,
  Table2,
  X,
  Zap,
  Sparkles,
  Code2,
  Copy,
  ClipboardPaste,
} from "lucide-react";

import {
  OcrTemplateConfigurator,
  type OcrTemplate,
} from "./_components/OcrTemplateConfigurator";
import { SampleAnalysisCard } from "./_components/SampleAnalysisCard";

import { Button, LightButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ensureTablaDataType,
  normalizeFieldKey,
  normalizeFolderName,
} from "@/lib/tablas";
import { cn } from "@/lib/utils";

const adminPageMaxWidthClass = "mx-auto w-full max-w-[1800px]";
const adminSurfaceClass =
  "rounded-lg border border-stroke-soft bg-surface shadow-card";
const adminCardClass =
  "rounded-lg border border-stroke-soft bg-card shadow-card";

type DataInputMethod = "ocr" | "manual" | "both";
type ExtractionRowMode = "single" | "multiple";

type OcrColumn = {
  id: string;
  columnId?: string;
  label: string;
  fieldKey: string;
  dataType: string;
  required: boolean;
  scope: "parent" | "item";
  description?: string;
  aliases?: string[];
  examples?: string[];
  excelKeywords?: string[];
};

type DefaultFolder = {
  id: string;
  name: string;
  path: string;
  position: number;
  // Data folder fields
  isOcr?: boolean; // Kept for backward compatibility, means it's a data folder
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
  columns?: Array<{
    id?: string;
    fieldKey: string;
    label: string;
    dataType: string;
    ocrScope?: string;
    required?: boolean;
    description?: string | null;
    aliases?: string[];
    examples?: string[];
    excelKeywords?: string[];
  }>;
  extractedTables?: ExtractedTableConfig[];
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
  columns: OcrColumn[];
};

type QuickAction = {
  id: string;
  name: string;
  description: string | null;
  folderPaths: string[];
  position: number;
};

type ImportedDefinitionField = {
  field_key?: string;
  label?: string;
  business_meaning?: string;
  required?: boolean;
  data_type?: string;
  scope?: string;
  aliases?: string[];
  multiword_variants?: string[];
  abbreviations?: string[];
  ocr_variants?: string[];
  example_values?: string[];
  extraction_hints?: string[];
  disambiguation_notes?: string[];
};

type ImportedDefinitionTableColumn = {
  field_key?: string;
  label?: string;
  business_meaning?: string;
  required?: boolean;
  data_type?: string;
  aliases?: string[];
  multiword_variants?: string[];
  abbreviations?: string[];
  ocr_variants?: string[];
  example_values?: string[];
  extraction_hints?: string[];
};

type ImportedDefinitionTableSection = {
  label?: string;
  description?: string;
  columns?: ImportedDefinitionTableColumn[];
};

type ImportedExcelHint = {
  field_key?: string;
  possible_headers?: string[];
  keyword_fragments?: string[];
  anchor_labels?: string[];
};

type ImportedDefinition = {
  document_family?: string;
  document_summary?: string;
  document_variants?: Array<{
    name?: string;
    description?: string;
    identifying_clues?: string[];
  }>;
  document_level_clues?: {
    title_aliases?: string[];
    header_keywords?: string[];
    footer_keywords_to_ignore?: string[];
  };
  fields?: ImportedDefinitionField[];
  table_sections?: ImportedDefinitionTableSection[];
  excel_mapping_hints?: ImportedExcelHint[];
  global_extraction_instructions?: string[];
  review_warnings?: string[];
};

type PortableDevFolderColumn = {
  label: string;
  fieldKey: string;
  dataType: string;
  required: boolean;
  scope: "parent" | "item";
  description?: string | null;
  aliases?: string[];
  examples?: string[];
  excelKeywords?: string[];
};

type PortableDevFolderTable = {
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
  columns: PortableDevFolderColumn[];
};

type PortableDevFolderConfig = {
  kind: "obra-defaults.dev-folder-config";
  version: 1;
  folderName: string;
  sourcePath?: string;
  copiedAt: string;
  extractedTables: PortableDevFolderTable[];
};

const CERTIFICADO_XLSX_DEFAULT_COLUMNS: Array<{
  label: string;
  fieldKey: string;
  dataType: string;
}> = [
  { label: "Período", fieldKey: "periodo", dataType: "text" },
  { label: "N° Certificado", fieldKey: "nro_certificado", dataType: "text" },
  {
    label: "Fecha Certificación",
    fieldKey: "fecha_certificacion",
    dataType: "text",
  },
  {
    label: "Monto Certificado",
    fieldKey: "monto_certificado",
    dataType: "currency",
  },
  {
    label: "Avance Físico Acum. %",
    fieldKey: "avance_fisico_acumulado_pct",
    dataType: "number",
  },
  {
    label: "Monto Acumulado",
    fieldKey: "monto_acumulado",
    dataType: "currency",
  },
];

const AUTO_XLSX_DEFAULT_COLUMNS: Array<{
  label: string;
  fieldKey: string;
  dataType: string;
}> = [
  { label: "Descripción", fieldKey: "descripcion", dataType: "text" },
  { label: "Cantidad", fieldKey: "cantidad", dataType: "number" },
  { label: "Monto", fieldKey: "monto", dataType: "currency" },
];

const buildSpreadsheetDefaultColumns = (
  template: "" | "auto" | "certificado",
): OcrColumn[] => {
  const source =
    template === "certificado"
      ? CERTIFICADO_XLSX_DEFAULT_COLUMNS
      : AUTO_XLSX_DEFAULT_COLUMNS;
  return source.map((col) => ({
    id: crypto.randomUUID(),
    label: col.label,
    fieldKey: col.fieldKey,
    dataType: col.dataType,
    required: false,
    scope: "item",
    description: "",
    aliases: [],
    examples: [],
    excelKeywords: [],
  }));
};

function sanitizeMaxRows(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function createEmptyExtractedTable(
  name = "Resumen",
): ExtractedTableConfig {
  return {
    id: crypto.randomUUID(),
    name,
    rowMode: "single",
    maxRows: 1,
    dataInputMethod: "both",
    spreadsheetTemplate: null,
    ocrTemplateId: null,
    ocrTemplateName: null,
    manualEntryEnabled: true,
    hasNestedData: false,
    documentTypes: [],
    extractionInstructions: "",
    columns: [],
  };
}

function createRecipeColumn(params: {
  label: string;
  fieldKey?: string;
  dataType?: string;
  description?: string;
}) {
  return {
    id: crypto.randomUUID(),
    label: params.label,
    fieldKey: params.fieldKey ?? normalizeFieldKey(params.label),
    dataType: ensureTablaDataType(params.dataType),
    required: false,
    scope: "item" as const,
    description: params.description ?? "",
    aliases: [],
    examples: [],
    excelKeywords: [],
  };
}

function buildCertificadoRecipeTables(): ExtractedTableConfig[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "resumen",
      rowMode: "single",
      maxRows: 1,
      dataInputMethod: "both",
      spreadsheetTemplate: "certificado",
      ocrTemplateId: null,
      ocrTemplateName: null,
      manualEntryEnabled: true,
      hasNestedData: false,
      documentTypes: ["certificado", "resumen de certificado"],
      extractionInstructions:
        "Extrae una sola fila por certificado. Si el documento tiene varias paginas o varios certificados, separa cada certificado y usa solo las paginas que correspondan a este resumen.",
      columns: [
        createRecipeColumn({
          label: "Nro certificado",
          fieldKey: "nro_certificado",
          description: "Identificador unico del certificado.",
        }),
        createRecipeColumn({
          label: "Fecha",
          fieldKey: "fecha",
          dataType: "date",
          description: "Fecha del certificado o de certificacion.",
        }),
        createRecipeColumn({
          label: "Monto total",
          fieldKey: "monto_total",
          dataType: "currency",
          description: "Monto total certificado en el documento.",
        }),
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "items",
      rowMode: "multiple",
      maxRows: null,
      dataInputMethod: "both",
      spreadsheetTemplate: "certificado",
      ocrTemplateId: null,
      ocrTemplateName: null,
      manualEntryEnabled: true,
      hasNestedData: false,
      documentTypes: ["certificado", "detalle de items"],
      extractionInstructions:
        "Extrae una fila por item del certificado. Si los items ocupan varias paginas, incluye solo esas paginas. Si el PDF trae varios certificados y esta tabla no aplica, permite que el usuario elija no cargar items.",
      columns: [
        createRecipeColumn({
          label: "Item numero",
          fieldKey: "item_numero",
          description: "Numero o codigo del item certificado.",
        }),
        createRecipeColumn({
          label: "Rubro",
          fieldKey: "rubro",
          description: "Descripcion corta del rubro o item.",
        }),
        createRecipeColumn({
          label: "Avance certificado previo",
          fieldKey: "avance_certificado_previo",
          dataType: "number",
        }),
        createRecipeColumn({
          label: "Avance certificado actual",
          fieldKey: "avance_certificado_actual",
          dataType: "number",
        }),
        createRecipeColumn({
          label: "Avance acumulado",
          fieldKey: "avance_acumulado",
          dataType: "number",
        }),
      ],
    },
  ];
}

function deriveDataInputMethod(params: {
  acceptsPdfImage: boolean;
  acceptsSpreadsheet: boolean;
  allowsManualEntry: boolean;
}): DataInputMethod {
  const { acceptsPdfImage, acceptsSpreadsheet, allowsManualEntry } = params;
  if (acceptsPdfImage && (acceptsSpreadsheet || allowsManualEntry)) {
    return "both";
  }
  if (acceptsPdfImage) {
    return "ocr";
  }
  return "manual";
}

function getEffectiveTableMaxRows(
  table: Pick<ExtractedTableConfig, "rowMode" | "maxRows">,
) {
  return table.rowMode === "single" ? 1 : sanitizeMaxRows(table.maxRows);
}

function canRunLlmExtraction(table: ExtractedTableConfig) {
  return table.dataInputMethod === "ocr" || table.dataInputMethod === "both";
}

function canRunSpreadsheetExtraction(table: ExtractedTableConfig) {
  return Boolean(table.spreadsheetTemplate);
}

function canRunManualEntry(table: ExtractedTableConfig) {
  return typeof table.manualEntryEnabled === "boolean"
    ? table.manualEntryEnabled
    : table.dataInputMethod !== "ocr";
}

function describeDevColumn(column: OcrColumn) {
  const details = [
    `field=${column.fieldKey || normalizeFieldKey(column.label || "campo")}`,
    `type=${column.dataType || "text"}`,
  ];
  if (column.required) details.push("required");
  if (column.scope) details.push(`scope=${column.scope}`);
  if (column.description?.trim()) details.push(column.description.trim());
  if (column.aliases && column.aliases.length > 0) {
    details.push(`aliases=${column.aliases.join(", ")}`);
  }
  if (column.examples && column.examples.length > 0) {
    details.push(`examples=${column.examples.join(", ")}`);
  }
  if (column.excelKeywords && column.excelKeywords.length > 0) {
    details.push(`keywords=${column.excelKeywords.join(", ")}`);
  }
  return `- ${column.label || column.fieldKey || "Campo"} (${details.join(" | ")})`;
}

function getPromptColumns(table: ExtractedTableConfig) {
  const parentColumns = table.columns.filter(
    (column) => column.scope === "parent",
  );
  const itemColumns = table.columns.filter(
    (column) => column.scope !== "parent",
  );
  return { parentColumns, itemColumns };
}

function buildDevJsonTemplate(table: ExtractedTableConfig) {
  const { parentColumns, itemColumns } = getPromptColumns(table);
  const topLevelLines = parentColumns.map(
    (column) => `  "${column.fieldKey || normalizeFieldKey(column.label)}": ""`,
  );
  if (itemColumns.length > 0) {
    topLevelLines.push(
      `  "items": [\n    {\n${itemColumns
        .map(
          (column) =>
            `      "${column.fieldKey || normalizeFieldKey(column.label)}": ""`,
        )
        .join(",\n")}\n    }\n  ]`,
    );
  }
  if (topLevelLines.length === 0) {
    topLevelLines.push('  "items": []');
  }
  return `{\n${topLevelLines.join(",\n")}\n}`;
}

function buildDevLlmPrompt(table: ExtractedTableConfig, folderPath: string) {
  const { parentColumns, itemColumns } = getPromptColumns(table);
  const docTypes = table.documentTypes ?? [];
  const docLabel = docTypes.length > 0 ? docTypes.join(" / ") : "documento";
  const lines = [
    `Analiza el ${docLabel} subido a ${folderPath} y devuelve JSON valido.`,
    `Dataset destino: ${table.name || "tabla_extraida"}.`,
    `Modo de filas: ${table.rowMode === "single" ? "una fila por documento" : "multiples filas"}.`,
  ];

  if (docTypes.length > 0) {
    lines.push(`Tipos esperados: ${docTypes.join(", ")}.`);
  }
  if (table.ocrTemplateName || table.ocrTemplateId) {
    lines.push(
      `Plantilla OCR: ${table.ocrTemplateName ?? table.ocrTemplateId}.`,
    );
  }
  if (parentColumns.length > 0) {
    lines.push("Campos nivel documento:");
    parentColumns.forEach((column) => lines.push(describeDevColumn(column)));
  }
  if (itemColumns.length > 0) {
    lines.push("Campos por item (items[]):");
    itemColumns.forEach((column) => lines.push(describeDevColumn(column)));
    lines.push(
      'Inclui "items" si ves filas claras; si no, devolve una lista vacia.',
    );
  } else {
    lines.push("Esta tabla no define items repetidos.");
  }
  lines.push("No inventes valores; deja campos vacios si no se pueden leer.");
  if (table.extractionInstructions?.trim()) {
    lines.push("Instrucciones adicionales:");
    lines.push(table.extractionInstructions.trim());
  }
  lines.push("JSON esperado:");
  lines.push(buildDevJsonTemplate(table));
  lines.push("Responde SOLO con JSON valido, sin explicaciones ni markdown.");
  return lines.join("\n");
}

function buildDevSpreadsheetScript(
  table: ExtractedTableConfig,
  folderPath: string,
) {
  const template = table.spreadsheetTemplate ?? "auto";
  const maxRows = getEffectiveTableMaxRows(table);
  const lines = [
    `when file.ext in ["csv", "xlsx", "xls"] and file.folder == "${folderPath}"`,
    `dataset "${table.name || "tabla_extraida"}"`,
    `extractor "${template}" {`,
    `  rowMode = "${table.rowMode}"`,
    `  maxRows = ${maxRows ?? "unlimited"}`,
    `  sheet = best_matching_sheet(file, columns)`,
    "  mapHeaders = {",
    ...table.columns.map((column) => {
      const hints = uniqueStrings([
        column.label,
        column.fieldKey,
        ...(column.aliases ?? []),
        ...(column.excelKeywords ?? []),
      ]);
      return `    ${column.fieldKey || normalizeFieldKey(column.label)} <- [${hints
        .map((hint) => `"${hint}"`)
        .join(", ")}]`;
    }),
    "  }",
    "  coerce = {",
    ...table.columns.map(
      (column) =>
        `    ${column.fieldKey || normalizeFieldKey(column.label)}: ${column.dataType || "text"}`,
    ),
    "  }",
    "  output rows with __docPath, extraction_id, lineage_row_key",
    "}",
  ];
  return lines.join("\n");
}

function buildPortableDevFolderConfig(params: {
  folderName: string;
  folderPath?: string;
  extractedTables: ExtractedTableConfig[];
}): PortableDevFolderConfig {
  return {
    kind: "obra-defaults.dev-folder-config",
    version: 1,
    folderName: params.folderName.trim() || "Carpeta de datos",
    sourcePath: params.folderPath,
    copiedAt: new Date().toISOString(),
    extractedTables: params.extractedTables.map((table) => ({
      name: table.name?.trim() || "Tabla extraida",
      rowMode: table.rowMode,
      maxRows: getEffectiveTableMaxRows(table),
      dataInputMethod: table.dataInputMethod,
      spreadsheetTemplate: table.spreadsheetTemplate ?? null,
      ocrTemplateId: table.ocrTemplateId ?? null,
      ocrTemplateName: table.ocrTemplateName ?? null,
      manualEntryEnabled: table.manualEntryEnabled,
      hasNestedData: table.hasNestedData,
      documentTypes: table.documentTypes ?? [],
      extractionInstructions: table.extractionInstructions ?? null,
      columns: table.columns.map((column) => ({
        label: column.label,
        fieldKey: column.fieldKey || normalizeFieldKey(column.label),
        dataType: column.dataType || "text",
        required: column.required,
        scope: column.scope,
        description: column.description ?? null,
        aliases: column.aliases ?? [],
        examples: column.examples ?? [],
        excelKeywords: column.excelKeywords ?? [],
      })),
    })),
  };
}

async function writeClipboardText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function isDataInputMethod(value: unknown): value is DataInputMethod {
  return value === "ocr" || value === "manual" || value === "both";
}

function readPortableSpreadsheetTemplate(
  value: unknown,
): "auto" | "certificado" | null {
  return value === "auto" || value === "certificado" ? value : null;
}

function findPortableOcrTemplate(
  rawTemplateId: unknown,
  rawTemplateName: unknown,
  ocrTemplates: OcrTemplate[],
) {
  const templateId =
    typeof rawTemplateId === "string" ? rawTemplateId.trim() : "";
  const templateName =
    typeof rawTemplateName === "string" ? rawTemplateName.trim() : "";
  if (templateId) {
    const byId = ocrTemplates.find((template) => template.id === templateId);
    if (byId) return byId;
  }
  if (templateName) {
    const normalizedName = templateName.toLowerCase();
    return (
      ocrTemplates.find(
        (template) => template.name.trim().toLowerCase() === normalizedName,
      ) ?? null
    );
  }
  return null;
}

function importPortableDevFolderConfig(
  rawJson: string,
  ocrTemplates: OcrTemplate[],
): { folderName: string; extractedTables: ExtractedTableConfig[] } | null {
  const parsed = JSON.parse(rawJson) as unknown;
  if (!isRecord(parsed) || parsed.kind !== "obra-defaults.dev-folder-config") {
    return null;
  }
  if (parsed.version !== 1) {
    throw new Error("La config dev usa una versión no soportada");
  }

  const rawTables = Array.isArray(parsed.extractedTables)
    ? parsed.extractedTables.filter((table): table is Record<string, unknown> =>
        isRecord(table),
      )
    : [];
  if (rawTables.length === 0) {
    throw new Error("La config dev no trae datasets para importar");
  }

  const folderName =
    typeof parsed.folderName === "string" && parsed.folderName.trim()
      ? parsed.folderName.trim()
      : "Carpeta de datos";

  const extractedTables = rawTables.map((table, tableIndex) => {
    const rawColumns = Array.isArray(table.columns)
      ? table.columns.filter((column): column is Record<string, unknown> =>
          isRecord(column),
        )
      : [];
    const columns = rawColumns.map((column, columnIndex): OcrColumn => {
      const label =
        typeof column.label === "string" && column.label.trim()
          ? column.label.trim()
          : typeof column.fieldKey === "string" && column.fieldKey.trim()
            ? column.fieldKey.trim()
            : `Campo ${columnIndex + 1}`;
      const fieldKey =
        typeof column.fieldKey === "string" && column.fieldKey.trim()
          ? normalizeFieldKey(column.fieldKey)
          : normalizeFieldKey(label);
      return {
        id: crypto.randomUUID(),
        label,
        fieldKey,
        dataType: ensureTablaDataType(
          typeof column.dataType === "string" ? column.dataType : "text",
        ),
        required: Boolean(column.required),
        scope: column.scope === "parent" ? "parent" : "item",
        description:
          typeof column.description === "string" ? column.description : "",
        aliases: readStringArray(column.aliases),
        examples: readStringArray(column.examples),
        excelKeywords: readStringArray(column.excelKeywords),
      };
    });

    if (columns.length === 0) {
      throw new Error(`El dataset ${tableIndex + 1} no trae columnas`);
    }

    const matchedTemplate = findPortableOcrTemplate(
      table.ocrTemplateId,
      table.ocrTemplateName,
      ocrTemplates,
    );
    const dataInputMethod = isDataInputMethod(table.dataInputMethod)
      ? table.dataInputMethod
      : "both";
    const rowMode: ExtractionRowMode =
      table.rowMode === "multiple" ? "multiple" : "single";
    const hasNestedData =
      typeof table.hasNestedData === "boolean"
        ? table.hasNestedData
        : columns.some((column) => column.scope === "parent") &&
          columns.some((column) => column.scope === "item");

    return {
      id: crypto.randomUUID(),
      name:
        typeof table.name === "string" && table.name.trim()
          ? table.name.trim()
          : tableIndex === 0
            ? folderName
            : `Tabla ${tableIndex + 1}`,
      rowMode,
      maxRows:
        rowMode === "multiple" ? sanitizeMaxRows(Number(table.maxRows)) : 1,
      dataInputMethod,
      spreadsheetTemplate: readPortableSpreadsheetTemplate(
        table.spreadsheetTemplate,
      ),
      ocrTemplateId: matchedTemplate?.id ?? null,
      ocrTemplateName:
        matchedTemplate?.name ??
        (typeof table.ocrTemplateName === "string"
          ? table.ocrTemplateName
          : null),
      manualEntryEnabled:
        typeof table.manualEntryEnabled === "boolean"
          ? table.manualEntryEnabled
          : dataInputMethod !== "ocr",
      hasNestedData,
      documentTypes: readStringArray(table.documentTypes),
      extractionInstructions:
        typeof table.extractionInstructions === "string"
          ? table.extractionInstructions
          : "",
      columns,
    };
  });

  return { folderName, extractedTables };
}

function ExtractionDevConfigView({
  folderPath,
  extractedTables,
}: {
  folderPath: string;
  extractedTables: ExtractedTableConfig[];
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-stroke bg-surface p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-recessed text-content-secondary">
              <Code2 className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content">Dev view</p>
              <p className="mt-1 break-all font-mono text-xs text-content-muted">
                {folderPath}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {extractedTables.length} datasets
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-md border border-stroke-soft bg-surface-recessed px-3 py-2">
            <p className="font-medium text-content">PDF / image</p>
            <p className="mt-1 text-content-muted">
              {extractedTables.some(canRunLlmExtraction) ? "LLM prompt" : "off"}
            </p>
          </div>
          <div className="rounded-md border border-stroke-soft bg-surface-recessed px-3 py-2">
            <p className="font-medium text-content">CSV / XLSX</p>
            <p className="mt-1 text-content-muted">
              {extractedTables.some(canRunSpreadsheetExtraction)
                ? "script"
                : "off"}
            </p>
          </div>
          <div className="rounded-md border border-stroke-soft bg-surface-recessed px-3 py-2">
            <p className="font-medium text-content">Manual</p>
            <p className="mt-1 text-content-muted">
              {extractedTables.some(canRunManualEntry) ? "enabled" : "off"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-left">
        {extractedTables.map((table, index) => {
          const llmEnabled = canRunLlmExtraction(table);
          const spreadsheetEnabled = canRunSpreadsheetExtraction(table);
          const manualEnabled = canRunManualEntry(table);
          const docTypeCondition =
            table.documentTypes && table.documentTypes.length > 0
              ? `documentType in [${table.documentTypes.map((type) => `"${type}"`).join(", ")}]`
              : "any document type";

          return (
            <div
              key={table.id}
              className="rounded-lg border border-stroke bg-surface"
            >
              <div className="flex flex-col gap-2 border-b border-stroke-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-content">
                    {table.name || `Dataset ${index + 1}`}
                  </p>
                  <p className="mt-1 text-xs text-content-muted">
                    {table.rowMode === "single"
                      ? "una fila"
                      : "multiples filas"}{" "}
                    - {table.columns.length} fields
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {llmEnabled ? <Badge variant="secondary">LLM</Badge> : null}
                  {spreadsheetEnabled ? (
                    <Badge variant="secondary">CSV/XLSX</Badge>
                  ) : null}
                  {manualEnabled ? (
                    <Badge variant="outline">manual</Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-content-muted">
                    Conditions
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="rounded-md border border-stroke-soft bg-surface-recessed p-3">
                      <p className="font-medium text-content">PDF / image</p>
                      <p className="mt-1 text-content-muted">
                        {llmEnabled
                          ? `ext in ["pdf", "png", "jpg", "jpeg", "webp", "tif", "tiff"] && ${docTypeCondition}`
                          : "disabled"}
                      </p>
                    </div>
                    <div className="rounded-md border border-stroke-soft bg-surface-recessed p-3">
                      <p className="font-medium text-content">CSV / XLSX</p>
                      <p className="mt-1 text-content-muted">
                        {spreadsheetEnabled
                          ? `ext in ["csv", "xlsx", "xls"] && extractor == "${table.spreadsheetTemplate}"`
                          : "disabled"}
                      </p>
                    </div>
                    <div className="rounded-md border border-stroke-soft bg-surface-recessed p-3">
                      <p className="font-medium text-content">Manual</p>
                      <p className="mt-1 text-content-muted">
                        {manualEnabled
                          ? "direct row entry allowed"
                          : "disabled"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {llmEnabled ? (
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-content-muted">
                        <FileText className="size-3.5" />
                        Prompt final LLM
                      </div>
                      <pre className="max-h-[320px] overflow-auto rounded-md border border-stroke-soft bg-surface-recessed p-3 text-left font-mono text-xs leading-5 text-content">
                        {buildDevLlmPrompt(table, folderPath)}
                      </pre>
                    </div>
                  ) : null}

                  {spreadsheetEnabled ? (
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-content-muted">
                        <Table2 className="size-3.5" />
                        Script CSV / XLSX
                      </div>
                      <pre className="max-h-[260px] overflow-auto rounded-md border border-stroke-soft bg-surface-recessed p-3 text-left font-mono text-xs leading-5 text-content">
                        {buildDevSpreadsheetScript(table, folderPath)}
                      </pre>
                    </div>
                  ) : null}

                  {!llmEnabled && !spreadsheetEnabled ? (
                    <div className="rounded-md border border-stroke-soft bg-surface-recessed p-3 text-sm text-content-muted">
                      Este dataset no tiene extractor de archivo activo; solo
                      queda disponible para carga manual.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCommaSeparatedList(values?: string[]): string {
  return Array.isArray(values) ? values.join(", ") : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [
    ...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)),
  ];
}

function mapImportedDataType(dataType: string | undefined): string {
  switch ((dataType ?? "").trim().toLowerCase()) {
    case "currency":
    case "money":
    case "moneda":
      return "currency";
    case "number":
    case "numeric":
    case "numero":
    case "decimal":
    case "percentage":
    case "percent":
      return "number";
    case "date":
    case "fecha":
    case "datetime":
      return "date";
    case "boolean":
    case "bool":
    case "si/no":
      return "boolean";
    default:
      return "text";
  }
}

function buildImportedColumnDescription(
  meaning?: string,
  hints?: string[],
  disambiguation?: string[],
  sectionDescription?: string,
): string {
  const parts: string[] = [];
  if (meaning) parts.push(meaning.trim());
  if (sectionDescription) parts.push(`Sección: ${sectionDescription.trim()}`);
  if (hints && hints.length > 0) parts.push(`Hints: ${hints.join("; ")}`);
  if (disambiguation && disambiguation.length > 0) {
    parts.push(`No confundir con: ${disambiguation.join("; ")}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function importDefinitionToFolderConfig(rawJson: string): {
  folderName: string;
  documentTypes: string[];
  extractionInstructions: string;
  columns: OcrColumn[];
  hasNestedData: boolean;
  suggestedDataInputMethod: DataInputMethod;
} {
  const parsed = JSON.parse(rawJson) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("El JSON debe ser un objeto");
  }

  const definition = parsed as ImportedDefinition;
  const documentFamily =
    typeof definition.document_family === "string" &&
    definition.document_family.trim().length > 0
      ? definition.document_family.trim()
      : "Extracción importada";

  const fields = Array.isArray(definition.fields)
    ? definition.fields.filter((field): field is ImportedDefinitionField =>
        isRecord(field),
      )
    : [];
  const tableSections = Array.isArray(definition.table_sections)
    ? definition.table_sections.filter(
        (section): section is ImportedDefinitionTableSection =>
          isRecord(section),
      )
    : [];

  if (fields.length === 0 && tableSections.length === 0) {
    throw new Error(
      "La definición no trae campos ni secciones de tabla importables",
    );
  }

  const excelHintsByField = new Map<string, ImportedExcelHint>();
  if (Array.isArray(definition.excel_mapping_hints)) {
    for (const rawHint of definition.excel_mapping_hints) {
      if (!isRecord(rawHint)) continue;
      const hint = rawHint as ImportedExcelHint;
      const fieldKey =
        typeof hint.field_key === "string" && hint.field_key.trim().length > 0
          ? hint.field_key.trim()
          : "";
      if (!fieldKey) continue;
      excelHintsByField.set(fieldKey, hint);
    }
  }

  const hasNestedData = tableSections.some(
    (section) => Array.isArray(section.columns) && section.columns.length > 0,
  );

  const parentColumns: OcrColumn[] = fields.map((field) => {
    const label =
      typeof field.label === "string" && field.label.trim().length > 0
        ? field.label.trim()
        : typeof field.field_key === "string" &&
            field.field_key.trim().length > 0
          ? field.field_key.trim()
          : "Campo";
    const fieldKey =
      typeof field.field_key === "string" && field.field_key.trim().length > 0
        ? normalizeFieldKey(field.field_key)
        : normalizeFieldKey(label);
    const hint = excelHintsByField.get(fieldKey);
    return {
      id: crypto.randomUUID(),
      label,
      fieldKey,
      dataType: mapImportedDataType(field.data_type),
      required: Boolean(field.required),
      scope: hasNestedData ? "parent" : "item",
      description: buildImportedColumnDescription(
        typeof field.business_meaning === "string"
          ? field.business_meaning
          : "",
        readStringArray(field.extraction_hints),
        readStringArray(field.disambiguation_notes),
      ),
      aliases: uniqueStrings([
        ...readStringArray(field.aliases),
        ...readStringArray(field.multiword_variants),
        ...readStringArray(field.abbreviations),
        ...readStringArray(field.ocr_variants),
      ]),
      examples: readStringArray(field.example_values),
      excelKeywords: uniqueStrings([
        ...readStringArray(hint?.possible_headers),
        ...readStringArray(hint?.keyword_fragments),
        ...readStringArray(hint?.anchor_labels),
      ]),
    };
  });

  const itemColumns: OcrColumn[] = hasNestedData
    ? tableSections.flatMap((section) => {
        const sectionColumns = Array.isArray(section.columns)
          ? section.columns
          : [];
        return sectionColumns
          .filter((column): column is ImportedDefinitionTableColumn =>
            isRecord(column),
          )
          .map((column) => {
            const label =
              typeof column.label === "string" && column.label.trim().length > 0
                ? column.label.trim()
                : typeof column.field_key === "string" &&
                    column.field_key.trim().length > 0
                  ? column.field_key.trim()
                  : "Campo item";
            const fieldKey =
              typeof column.field_key === "string" &&
              column.field_key.trim().length > 0
                ? normalizeFieldKey(column.field_key)
                : normalizeFieldKey(label);
            const hint = excelHintsByField.get(fieldKey);
            return {
              id: crypto.randomUUID(),
              label,
              fieldKey,
              dataType: mapImportedDataType(column.data_type),
              required: Boolean(column.required),
              scope: "item" as const,
              description: buildImportedColumnDescription(
                typeof column.business_meaning === "string"
                  ? column.business_meaning
                  : "",
                readStringArray(column.extraction_hints),
                [],
                typeof section.description === "string"
                  ? section.description
                  : undefined,
              ),
              aliases: uniqueStrings([
                ...readStringArray(column.aliases),
                ...readStringArray(column.multiword_variants),
                ...readStringArray(column.abbreviations),
                ...readStringArray(column.ocr_variants),
              ]),
              examples: readStringArray(column.example_values),
              excelKeywords: uniqueStrings([
                ...readStringArray(hint?.possible_headers),
                ...readStringArray(hint?.keyword_fragments),
                ...readStringArray(hint?.anchor_labels),
              ]),
            };
          });
      })
    : [];

  const columns = [...parentColumns, ...itemColumns];

  const variantNames = Array.isArray(definition.document_variants)
    ? definition.document_variants
        .filter((variant): variant is { name?: string } => isRecord(variant))
        .map((variant) =>
          typeof variant.name === "string" ? variant.name.trim() : "",
        )
        .filter(Boolean)
    : [];

  const documentTypes = uniqueStrings([documentFamily, ...variantNames]);

  const instructionsBlocks: string[] = [];
  if (
    typeof definition.document_summary === "string" &&
    definition.document_summary.trim()
  ) {
    instructionsBlocks.push(
      `Resumen del documento:\n${definition.document_summary.trim()}`,
    );
  }

  const titleAliases = readStringArray(
    definition.document_level_clues?.title_aliases,
  );
  const headerKeywords = readStringArray(
    definition.document_level_clues?.header_keywords,
  );
  const footerIgnore = readStringArray(
    definition.document_level_clues?.footer_keywords_to_ignore,
  );

  if (
    titleAliases.length > 0 ||
    headerKeywords.length > 0 ||
    footerIgnore.length > 0
  ) {
    const clueLines: string[] = [];
    if (titleAliases.length > 0)
      clueLines.push(`Títulos posibles: ${titleAliases.join(", ")}`);
    if (headerKeywords.length > 0)
      clueLines.push(`Keywords de encabezado: ${headerKeywords.join(", ")}`);
    if (footerIgnore.length > 0)
      clueLines.push(`Ignorar pie / ruido: ${footerIgnore.join(", ")}`);
    instructionsBlocks.push(clueLines.join("\n"));
  }

  const globalInstructions = readStringArray(
    definition.global_extraction_instructions,
  );
  if (globalInstructions.length > 0) {
    instructionsBlocks.push(
      `Instrucciones globales:\n- ${globalInstructions.join("\n- ")}`,
    );
  }

  const reviewWarnings = readStringArray(definition.review_warnings);
  if (reviewWarnings.length > 0) {
    instructionsBlocks.push(`Advertencias:\n- ${reviewWarnings.join("\n- ")}`);
  }

  if (tableSections.length > 0) {
    const sectionsSummary = tableSections
      .map((section) => {
        const label =
          typeof section.label === "string" && section.label.trim().length > 0
            ? section.label.trim()
            : "Sección";
        const description =
          typeof section.description === "string" &&
          section.description.trim().length > 0
            ? `: ${section.description.trim()}`
            : "";
        return `- ${label}${description}`;
      })
      .join("\n");
    if (sectionsSummary) {
      instructionsBlocks.push(
        `Secciones tabulares detectadas:\n${sectionsSummary}`,
      );
    }
  }

  return {
    folderName: documentFamily,
    documentTypes,
    extractionInstructions: instructionsBlocks.join("\n\n"),
    columns,
    hasNestedData,
    suggestedDataInputMethod: "both",
  };
}

function getDataInputMethodLabel(method?: DataInputMethod) {
  switch (method) {
    case "ocr":
      return "Solo OCR";
    case "manual":
      return "Solo manual";
    default:
      return "Manual + OCR";
  }
}

function mapFolderToExtractedTables(
  folder: DefaultFolder,
): ExtractedTableConfig[] {
  if (
    Array.isArray(folder.extractedTables) &&
    folder.extractedTables.length > 0
  ) {
    return folder.extractedTables.map((table, index) => ({
      ...table,
      id: table.id || `${folder.id}::${index}`,
      name:
        table.name?.trim() ||
        (index === 0 ? folder.name : `Tabla ${index + 1}`),
      rowMode: table.rowMode === "multiple" ? "multiple" : "single",
      maxRows:
        table.rowMode === "multiple" ? sanitizeMaxRows(table.maxRows) : 1,
      dataInputMethod:
        table.dataInputMethod ?? folder.dataInputMethod ?? "both",
      spreadsheetTemplate:
        table.spreadsheetTemplate ?? folder.spreadsheetTemplate ?? null,
      ocrTemplateId: table.ocrTemplateId ?? folder.ocrTemplateId ?? null,
      ocrTemplateName: table.ocrTemplateName ?? folder.ocrTemplateName ?? null,
      manualEntryEnabled:
        typeof table.manualEntryEnabled === "boolean"
          ? table.manualEntryEnabled
          : typeof folder.manualEntryEnabled === "boolean"
            ? folder.manualEntryEnabled
            : (table.dataInputMethod ?? folder.dataInputMethod ?? "both") !==
              "ocr",
      hasNestedData: Boolean(table.hasNestedData ?? folder.hasNestedData),
      documentTypes: table.documentTypes ?? [],
      extractionInstructions: table.extractionInstructions ?? "",
      columns: (table.columns ?? []).map((col) => ({
        ...col,
        id: col.id || crypto.randomUUID(),
      })),
    }));
  }

  return [
    {
      id: `${folder.id}::primary`,
      name: folder.name,
      rowMode: folder.extractionRowMode === "multiple" ? "multiple" : "single",
      maxRows:
        folder.extractionRowMode === "multiple"
          ? sanitizeMaxRows(folder.extractionMaxRows)
          : 1,
      dataInputMethod: folder.dataInputMethod ?? "both",
      spreadsheetTemplate: folder.spreadsheetTemplate ?? null,
      ocrTemplateId: folder.ocrTemplateId ?? null,
      ocrTemplateName: folder.ocrTemplateName ?? null,
      manualEntryEnabled:
        typeof folder.manualEntryEnabled === "boolean"
          ? folder.manualEntryEnabled
          : (folder.dataInputMethod ?? "both") !== "ocr",
      hasNestedData: Boolean(folder.hasNestedData),
      documentTypes: folder.documentTypes ?? [],
      extractionInstructions: folder.extractionInstructions ?? "",
      columns: (folder.columns ?? []).map((col) => ({
        id: col.id || `${folder.id}::${col.fieldKey}`,
        columnId: col.id,
        label: col.label,
        fieldKey: col.fieldKey,
        dataType: ensureTablaDataType(col.dataType),
        required: Boolean(col.required),
        scope: col.ocrScope === "parent" ? "parent" : "item",
        description: col.description ?? "",
        aliases: col.aliases ?? [],
        examples: col.examples ?? [],
        excelKeywords: col.excelKeywords ?? [],
      })),
    },
  ];
}

function getFolderParentPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.length > 1 ? segments.slice(0, -1).join("/") : "";
}

function isFolderDescendant(
  candidatePath: string,
  folderPath: string,
): boolean {
  return candidatePath.startsWith(`${folderPath}/`);
}

function buildFolderUpdatePayload(
  folder: DefaultFolder,
  parentPath: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: "folder",
    id: folder.id,
    name: folder.name,
    parentPath: parentPath || null,
  };

  if (!folder.isOcr) {
    return payload;
  }

  const extractedTables = mapFolderToExtractedTables(folder);
  const primaryTable =
    extractedTables[0] ?? createEmptyExtractedTable(folder.name);

  return {
    ...payload,
    isOcr: true,
    dataInputMethod:
      primaryTable.dataInputMethod ?? folder.dataInputMethod ?? "both",
    spreadsheetTemplate:
      primaryTable.spreadsheetTemplate ?? folder.spreadsheetTemplate ?? null,
    ocrTemplateId: primaryTable.ocrTemplateId ?? folder.ocrTemplateId ?? null,
    manualEntryEnabled:
      typeof primaryTable.manualEntryEnabled === "boolean"
        ? primaryTable.manualEntryEnabled
        : typeof folder.manualEntryEnabled === "boolean"
          ? folder.manualEntryEnabled
          : true,
    hasNestedData: Boolean(primaryTable.hasNestedData ?? folder.hasNestedData),
    documentTypes: primaryTable.documentTypes ?? folder.documentTypes ?? [],
    extractionInstructions:
      primaryTable.extractionInstructions ??
      folder.extractionInstructions ??
      null,
    extractionRowMode: primaryTable.rowMode,
    extractionMaxRows: getEffectiveTableMaxRows(primaryTable),
    extractedTables: extractedTables.map((table, tableIndex) => ({
      id: table.id,
      name: table.name?.trim() || `Tabla ${tableIndex + 1}`,
      rowMode: table.rowMode,
      maxRows: getEffectiveTableMaxRows(table),
      dataInputMethod: table.dataInputMethod,
      spreadsheetTemplate: table.spreadsheetTemplate ?? null,
      ocrTemplateId: table.ocrTemplateId ?? null,
      manualEntryEnabled:
        typeof table.manualEntryEnabled === "boolean"
          ? table.manualEntryEnabled
          : true,
      hasNestedData: Boolean(table.hasNestedData),
      documentTypes: table.documentTypes ?? [],
      extractionInstructions: table.extractionInstructions?.trim() || null,
      columns: table.columns.map((col, index) => ({
        id: col.columnId ?? col.id,
        label: col.label,
        fieldKey: col.fieldKey || normalizeFieldKey(col.label),
        dataType: col.dataType,
        required: col.required,
        position: index,
        ocrScope: table.hasNestedData ? col.scope : "item",
        description: col.description,
        aliases: col.aliases ?? [],
        examples: col.examples ?? [],
        excelKeywords: col.excelKeywords ?? [],
      })),
    })),
    columns: primaryTable.columns.map((col, index) => ({
      id: col.columnId ?? col.id,
      label: col.label,
      fieldKey: col.fieldKey || normalizeFieldKey(col.label),
      dataType: col.dataType,
      required: col.required,
      position: index,
      ocrScope: primaryTable.hasNestedData ? col.scope : "item",
      description: col.description,
      aliases: col.aliases ?? [],
      examples: col.examples ?? [],
      excelKeywords: col.excelKeywords ?? [],
    })),
  };
}

// Get icon for data type
function getDataTypeIcon(dataType: string) {
  switch (dataType) {
    case "number":
      return <Hash className="size-3" />;
    case "currency":
      return <DollarSign className="size-3" />;
    case "date":
      return <Calendar className="size-3" />;
    case "boolean":
      return <ToggleLeft className="size-3" />;
    default:
      return <Type className="size-3" />;
  }
}

// Folder Row Component
function FolderRow({
  folder,
  onDelete,
  onEdit,
  onMove,
  onViewDev,
  index,
}: {
  folder: DefaultFolder;
  onDelete: () => void;
  onEdit: () => void;
  onMove: () => void;
  onViewDev?: () => void;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isOcr = folder.isOcr;
  const hasColumns = folder.columns && folder.columns.length > 0;
  const extractedTables = mapFolderToExtractedTables(folder);

  const parentColumns =
    folder.columns?.filter((c) => c.ocrScope === "parent") ?? [];
  const itemColumns =
    folder.columns?.filter((c) => c.ocrScope !== "parent") ?? [];

  if (!isOcr) {
    // Simple folder row
    return (
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: index * 0.03 }}
        className={cn(
          adminCardClass,
          "group flex items-center gap-3 p-3 transition-colors hover:bg-surface-muted/70",
        )}
      >
        <div className="flex items-center justify-center size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Folder className="size-5 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{folder.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            /{folder.path}
          </p>
        </div>

        <LightButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMove}
          className="text-content-muted"
          aria-label="Mover carpeta"
        >
          <FolderInput className="h-4 w-4" />
        </LightButton>
        <LightButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="text-content-muted"
          aria-label="Editar carpeta"
        >
          <Pencil className="size-4" />
        </LightButton>
        <LightButton
          type="button"
          variant="destructive"
          size="icon"
          onClick={onDelete}
          aria-label="Eliminar carpeta"
        >
          <Trash2 className="size-4" />
        </LightButton>
      </m.div>
    );
  }

  // OCR folder with expandable details
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            adminCardClass,
            "overflow-hidden border-amber-200/80 dark:border-amber-800",
          )}
        >
          <CollapsibleTrigger asChild>
            <div className="group flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-surface-muted/70">
              <div className="flex items-center justify-center size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Table2 className="size-5 text-amber-600 dark:text-amber-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{folder.name}</p>
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    Extracción
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">/{folder.path}</span>
                  {hasColumns && ` · ${folder.columns!.length} campos`}
                  {folder.ocrTemplateName && ` · ${folder.ocrTemplateName}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onViewDev ? (
                  <LightButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDev();
                    }}
                    className="h-8 gap-1.5 px-2 text-xs"
                    aria-label="Ver detalles técnicos"
                  >
                    <Code2 className="size-3.5" />
                    Detalles
                  </LightButton>
                ) : null}
                <LightButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove();
                  }}
                  className="text-content-muted"
                  aria-label="Mover carpeta"
                >
                  <FolderInput className="h-4 w-4" />
                </LightButton>
                <LightButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="text-content-muted"
                  aria-label="Editar carpeta"
                >
                  <Pencil className="size-4" />
                </LightButton>
                <LightButton
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  aria-label="Eliminar carpeta"
                >
                  <Trash2 className="size-4" />
                </LightButton>
                {isOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-4 border-t border-stroke-soft bg-surface-recessed p-4">
              {folder.ocrTemplateName && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Plantilla de extracción
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <ScanLine className="size-4 text-purple-500" />
                    <span>{folder.ocrTemplateName}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {getDataInputMethodLabel(folder.dataInputMethod)}
                </Badge>
                {folder.spreadsheetTemplate && (
                  <Badge variant="outline" className="text-[10px]">
                    XLSX/CSV: {folder.spreadsheetTemplate}
                  </Badge>
                )}
              </div>

              {folder.documentTypes && folder.documentTypes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Documentos esperados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {folder.documentTypes.map((type) => (
                      <Badge
                        key={`${folder.id}-${type}`}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {extractedTables.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Tablas a extraer
                  </p>
                  <div className="space-y-2">
                    {extractedTables.map((table) => {
                      const sourceBadges = [
                        table.ocrTemplateId
                          ? `PDF / imagen: ${table.ocrTemplateName ?? "OCR configurado"}`
                          : null,
                        table.spreadsheetTemplate
                          ? `Excel / CSV: ${table.spreadsheetTemplate}`
                          : null,
                      ].filter(Boolean);
                      return (
                        <div
                          key={table.id}
                          className="rounded-md border border-stroke-soft bg-surface p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{table.name}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {table.rowMode === "single"
                                ? "1 fila"
                                : `${getEffectiveTableMaxRows(table) ?? "N"} filas`}
                            </Badge>
                          </div>
                          {table.documentTypes &&
                            table.documentTypes.length > 0 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Documentos: {table.documentTypes.join(", ")}
                              </p>
                            )}
                          {sourceBadges.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {sourceBadges.map((badge) => (
                                <Badge
                                  key={`${table.id}-${badge}`}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {badge}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {folder.extractionInstructions && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Guía de extracción
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {folder.extractionInstructions}
                  </p>
                </div>
              )}

              {folder.hasNestedData && (
                <div>
                  <Badge variant="outline" className="text-xs">
                    Datos anidados (Documento + Items)
                  </Badge>
                </div>
              )}

              {hasColumns && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Campos de datos
                  </p>

                  {parentColumns.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Nivel documento
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {parentColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 rounded-md border border-stroke-soft bg-surface p-2 text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono"
                            >
                              {col.dataType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {itemColumns.length > 0 && (
                    <div>
                      {parentColumns.length > 0 && (
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                          Nivel item
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {itemColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 rounded-md border border-stroke-soft bg-surface p-2 text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono"
                            >
                              {col.dataType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </m.div>
  );
}

// OCR Template Card Component with expandable details
function OcrTemplateCard({
  template,
  onEdit,
  onDelete,
  index,
}: {
  template: OcrTemplate;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const tableRegions = template.regions.filter((r) => r.type === "table");
  const parentColumns = template.columns.filter((c) => c.ocrScope === "parent");
  const itemColumns = template.columns.filter((c) => c.ocrScope !== "parent");

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.03 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className={cn(adminCardClass, "overflow-hidden")}>
          <CollapsibleTrigger asChild>
            <div className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-surface-muted/70">
              <div className="flex items-center justify-center size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <ScanLine className="size-5 text-purple-600 dark:text-purple-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">
                    {template.name}
                  </p>
                  {!template.is_active && (
                    <Badge variant="secondary" className="text-[10px]">
                      Inactiva
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {template.columns.length} campos · {template.regions.length}{" "}
                  regiones
                  {tableRegions.length > 0 &&
                    ` · ${tableRegions.length} tablas`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <LightButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Pencil className="size-4" />
                </LightButton>
                <LightButton
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="size-4" />
                </LightButton>
                {isOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-4 border-t border-stroke-soft bg-surface-recessed p-4">
              {template.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Descripción
                  </p>
                  <p className="text-sm">{template.description}</p>
                </div>
              )}

              {template.template_file_name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Archivo de plantilla
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="font-mono text-xs">
                      {template.template_file_name}
                    </span>
                  </div>
                </div>
              )}

              {template.regions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Regiones de extracción
                  </p>
                  <div className="space-y-2">
                    {template.regions.map((region) => (
                      <div
                        key={region.id}
                        className="flex items-start gap-2 rounded-md border border-stroke-soft bg-surface p-2 text-sm"
                      >
                        {region.type === "table" ? (
                          <TableProperties className="size-4 text-blue-500 mt-0.5" />
                        ) : (
                          <div className="size-4 rounded border-2 border-purple-500 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{region.label}</span>
                            <Badge
                              variant={
                                region.type === "table"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {region.type === "table" ? "Tabla" : "Campo"}
                            </Badge>
                          </div>
                          {region.type === "table" &&
                            region.tableColumns &&
                            region.tableColumns.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Columnas: {region.tableColumns.join(", ")}
                              </p>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {template.columns.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Campos de datos
                  </p>

                  {parentColumns.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Nivel documento
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {parentColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 rounded-md border border-stroke-soft bg-surface p-2 text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono"
                            >
                              {col.dataType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {itemColumns.length > 0 && (
                    <div>
                      {parentColumns.length > 0 && (
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                          Nivel item
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {itemColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 rounded-md border border-stroke-soft bg-surface p-2 text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono"
                            >
                              {col.dataType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </m.div>
  );
}

type DataTypeOption = {
  value: string;
  label: string;
};

const DATA_TYPE_OPTIONS: DataTypeOption[] = [
  { value: "text", label: "texto" },
  { value: "number", label: "numero" },
  { value: "currency", label: "moneda" },
  { value: "date", label: "fecha" },
  { value: "boolean", label: "si/no" },
];

export default function ObraDefaultsPage() {
  const [folders, setFolders] = useState<DefaultFolder[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("structure");

  // Folder dialog state
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderMode, setFolderMode] = useState<"normal" | "data">("normal");
  const [folderEditorStep, setFolderEditorStep] = useState(0);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentPath, setNewFolderParentPath] = useState("");
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const [movingFolder, setMovingFolder] = useState<DefaultFolder | null>(null);
  const [moveFolderParentPath, setMoveFolderParentPath] = useState("");
  const [isSubmittingMoveFolder, setIsSubmittingMoveFolder] = useState(false);
  const [devViewFolder, setDevViewFolder] = useState<DefaultFolder | null>(
    null,
  );
  const [deleteBlockedFolder, setDeleteBlockedFolder] =
    useState<DefaultFolder | null>(null);

  // Data folder state
  const [newFolderDataInputMethod, setNewFolderDataInputMethod] =
    useState<DataInputMethod>("both");
  const [newFolderSpreadsheetTemplate, setNewFolderSpreadsheetTemplate] =
    useState<"" | "auto" | "certificado">("");
  const [newFolderOcrTemplateId, setNewFolderOcrTemplateId] = useState("");
  const [newFolderAcceptsPdfImage, setNewFolderAcceptsPdfImage] =
    useState(false);
  const [newFolderAcceptsSpreadsheet, setNewFolderAcceptsSpreadsheet] =
    useState(false);
  const [newFolderAllowsManualEntry, setNewFolderAllowsManualEntry] =
    useState(true);
  const [newFolderHasNested, setNewFolderHasNested] = useState(false);
  const [newFolderDocumentTypesText, setNewFolderDocumentTypesText] =
    useState("");
  const [newFolderExtractionInstructions, setNewFolderExtractionInstructions] =
    useState("");
  const [newFolderColumns, setNewFolderColumns] = useState<OcrColumn[]>([]);
  const [newFolderExtractedTables, setNewFolderExtractedTables] = useState<
    ExtractedTableConfig[]
  >([createEmptyExtractedTable()]);
  const [activeExtractedTableId, setActiveExtractedTableId] = useState<
    string | null
  >(null);
  const [definitionImportText, setDefinitionImportText] = useState("");
  const [isDefinitionImportOpen, setIsDefinitionImportOpen] = useState(false);
  const [isDocumentReadingAdvancedOpen, setIsDocumentReadingAdvancedOpen] =
    useState(false);
  const [hasImportedDefinition, setHasImportedDefinition] = useState(false);

  // Quick actions state
  const [isAddQuickActionOpen, setIsAddQuickActionOpen] = useState(false);
  const [newQuickActionName, setNewQuickActionName] = useState("");
  const [newQuickActionDescription, setNewQuickActionDescription] =
    useState("");
  const [newQuickActionFolders, setNewQuickActionFolders] = useState<string[]>(
    [],
  );
  const [isSubmittingQuickAction, setIsSubmittingQuickAction] = useState(false);

  // OCR Templates state
  const [ocrTemplates, setOcrTemplates] = useState<OcrTemplate[]>([]);
  const [isOcrConfigOpen, setIsOcrConfigOpen] = useState(false);
  const [editingOcrTemplate, setEditingOcrTemplate] =
    useState<OcrTemplate | null>(null);

  const resetFolderForm = useCallback(() => {
    setEditingFolderId(null);
    setNewFolderName("");
    setNewFolderParentPath("");
    setFolderMode("normal");
    setFolderEditorStep(0);
    setNewFolderDataInputMethod("both");
    setNewFolderSpreadsheetTemplate("");
    setNewFolderOcrTemplateId("");
    setNewFolderAcceptsPdfImage(false);
    setNewFolderAcceptsSpreadsheet(false);
    setNewFolderAllowsManualEntry(true);
    setNewFolderHasNested(false);
    setNewFolderDocumentTypesText("");
    setNewFolderExtractionInstructions("");
    setNewFolderColumns([]);
    const initialTable = createEmptyExtractedTable();
    setNewFolderExtractedTables([initialTable]);
    setActiveExtractedTableId(initialTable.id);
    setDefinitionImportText("");
    setIsDefinitionImportOpen(false);
    setIsDocumentReadingAdvancedOpen(false);
    setHasImportedDefinition(false);
  }, []);

  const resetQuickActionForm = useCallback(() => {
    setNewQuickActionName("");
    setNewQuickActionDescription("");
    setNewQuickActionFolders([]);
  }, []);

  const fetchOcrTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/ocr-templates");
      if (!res.ok) throw new Error("Failed to load Plantilla OCRs");
      const data = await res.json();
      setOcrTemplates(data.templates ?? []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchDefaults = useCallback(async () => {
    try {
      const res = await fetch("/api/obra-defaults");
      if (!res.ok) throw new Error("Failed to load defaults");
      const data = await res.json();
      setFolders(data.folders ?? []);
      setQuickActions(data.quickActions ?? []);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando configuración");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchDefaults();
      void fetchOcrTemplates();
    });
  }, [fetchDefaults, fetchOcrTemplates]);

  useEffect(() => {
    if (!activeExtractedTableId && newFolderExtractedTables.length > 0) {
      const nextActiveTableId = newFolderExtractedTables[0].id;
      queueMicrotask(() => {
        setActiveExtractedTableId((current) => current ?? nextActiveTableId);
      });
    }
  }, [activeExtractedTableId, newFolderExtractedTables]);

  const loadEditorFromExtractedTable = useCallback(
    (table: ExtractedTableConfig) => {
      setNewFolderDataInputMethod(table.dataInputMethod ?? "both");
      setNewFolderSpreadsheetTemplate(table.spreadsheetTemplate ?? "");
      setNewFolderOcrTemplateId(table.ocrTemplateId ?? "");
      setNewFolderAcceptsPdfImage(
        table.dataInputMethod === "ocr" || table.dataInputMethod === "both",
      );
      setNewFolderAcceptsSpreadsheet(Boolean(table.spreadsheetTemplate));
      setNewFolderAllowsManualEntry(
        typeof table.manualEntryEnabled === "boolean"
          ? table.manualEntryEnabled
          : table.dataInputMethod !== "ocr",
      );
      setNewFolderHasNested(Boolean(table.hasNestedData));
      setNewFolderDocumentTypesText(
        joinCommaSeparatedList(table.documentTypes),
      );
      setNewFolderExtractionInstructions(table.extractionInstructions ?? "");
      setNewFolderColumns(
        (table.columns ?? []).map((col) => ({
          ...col,
          id: col.id || crypto.randomUUID(),
        })),
      );
    },
    [],
  );

  const syncActiveTableFromEditor = useCallback(() => {
    if (!activeExtractedTableId) return;
    const derivedDataInputMethod = deriveDataInputMethod({
      acceptsPdfImage: newFolderAcceptsPdfImage,
      acceptsSpreadsheet: newFolderAcceptsSpreadsheet,
      allowsManualEntry: newFolderAllowsManualEntry,
    });
    setNewFolderExtractedTables((prev) =>
      prev.map((table) =>
        table.id === activeExtractedTableId
          ? {
              ...table,
              dataInputMethod: derivedDataInputMethod,
              spreadsheetTemplate: newFolderAcceptsSpreadsheet
                ? newFolderSpreadsheetTemplate || null
                : null,
              ocrTemplateId: newFolderAcceptsPdfImage
                ? newFolderOcrTemplateId || null
                : null,
              ocrTemplateName: newFolderAcceptsPdfImage
                ? (ocrTemplates.find(
                    (template) => template.id === newFolderOcrTemplateId,
                  )?.name ?? null)
                : null,
              manualEntryEnabled: newFolderAllowsManualEntry,
              hasNestedData: newFolderAcceptsPdfImage
                ? newFolderHasNested
                : false,
              documentTypes: parseCommaSeparatedList(
                newFolderDocumentTypesText,
              ),
              extractionInstructions: newFolderExtractionInstructions.trim(),
              columns: newFolderColumns.map((column) => ({ ...column })),
            }
          : table,
      ),
    );
  }, [
    activeExtractedTableId,
    newFolderAcceptsPdfImage,
    newFolderAcceptsSpreadsheet,
    newFolderAllowsManualEntry,
    newFolderColumns,
    newFolderDocumentTypesText,
    newFolderExtractionInstructions,
    newFolderHasNested,
    newFolderOcrTemplateId,
    newFolderSpreadsheetTemplate,
    ocrTemplates,
  ]);

  const mapTemplateToOcrColumns = useCallback(
    (template: OcrTemplate): OcrColumn[] => {
      return template.columns.map((col) => ({
        id: crypto.randomUUID(),
        label: col.label,
        fieldKey: col.fieldKey || normalizeFieldKey(col.label),
        dataType: ensureTablaDataType(col.dataType),
        required: false,
        scope: (col.ocrScope === "parent" ? "parent" : "item") as
          | "parent"
          | "item",
        description: col.description,
        aliases: [],
        examples: [],
        excelKeywords: [],
      }));
    },
    [],
  );

  // When template is selected, populate columns from template
  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      setNewFolderOcrTemplateId(templateId);

      if (!templateId) {
        setNewFolderColumns([]);
        setNewFolderHasNested(false);
        return;
      }

      const template = ocrTemplates.find((t) => t.id === templateId);
      if (!template) return;

      const mappedColumns = mapTemplateToOcrColumns(template);

      setNewFolderColumns(mappedColumns);

      // Check if has nested data (both parent and item columns)
      const hasParent = mappedColumns.some((c) => c.scope === "parent");
      const hasItem = mappedColumns.some((c) => c.scope === "item");
      setNewFolderHasNested(hasParent && hasItem);
    },
    [mapTemplateToOcrColumns, ocrTemplates],
  );

  const handleSpreadsheetTemplateSelect = useCallback(
    (template: "auto" | "certificado") => {
      setNewFolderSpreadsheetTemplate(template);
      if (!newFolderAcceptsPdfImage && newFolderColumns.length === 0) {
        setNewFolderColumns(buildSpreadsheetDefaultColumns(template));
      }
    },
    [newFolderAcceptsPdfImage, newFolderColumns.length],
  );

  // Sync columns scope when hasNested changes
  useEffect(() => {
    if (!newFolderHasNested) {
      queueMicrotask(() => {
        setNewFolderColumns((prev) => {
          let changed = false;
          const next = prev.map((col) => {
            if (col.scope === "item") return col;
            changed = true;
            return { ...col, scope: "item" as const };
          });
          return changed ? next : prev;
        });
      });
    }
  }, [newFolderHasNested]);

  const handleDeleteOcrTemplate = async (id: string) => {
    try {
      const res = await fetch("/api/ocr-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Error deleting template");

      setOcrTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Plantilla eliminada");
    } catch (error) {
      console.error(error);
      toast.error("Error eliminando plantilla");
    }
  };

  const handleEditOcrTemplate = useCallback((template: OcrTemplate) => {
    setEditingOcrTemplate(template);
    setIsOcrConfigOpen(true);
  }, []);

  const handleTemplateSaved = useCallback(
    (template: OcrTemplate) => {
      setOcrTemplates((prev) => {
        const exists = prev.some((item) => item.id === template.id);
        return exists
          ? prev.map((item) => (item.id === template.id ? template : item))
          : [...prev, template];
      });
      setEditingOcrTemplate(template);

      if (newFolderOcrTemplateId === template.id) {
        const mappedColumns = mapTemplateToOcrColumns(template);
        setNewFolderColumns(mappedColumns);
        const hasParent = mappedColumns.some(
          (column) => column.scope === "parent",
        );
        const hasItem = mappedColumns.some((column) => column.scope === "item");
        setNewFolderHasNested(hasParent && hasItem);
      }
    },
    [mapTemplateToOcrColumns, newFolderOcrTemplateId],
  );

  const openCreateFolder = useCallback(
    (mode: "normal" | "data" = "normal") => {
      resetFolderForm();
      setFolderMode(mode);
      setFolderEditorStep(0);
      setIsAddFolderOpen(true);
    },
    [resetFolderForm],
  );

  const openCreateFolderFromDefinition = useCallback(() => {
    resetFolderForm();
    setFolderMode("data");
    setFolderEditorStep(1);
    setIsDefinitionImportOpen(true);
    setIsAddFolderOpen(true);
  }, [resetFolderForm]);

  const handleApplyFolderRecipe = useCallback(() => {
    const recipeTables = buildCertificadoRecipeTables();
    const firstTable = recipeTables[0];
    setFolderMode("data");
    setNewFolderName((current) => (current.trim() ? current : "Certificados"));
    setNewFolderExtractedTables(recipeTables);
    setActiveExtractedTableId(firstTable.id);
    loadEditorFromExtractedTable(firstTable);
    toast.success("Modelo de certificados aplicado");
  }, [loadEditorFromExtractedTable]);

  const handleEditFolder = useCallback(
    (folder: DefaultFolder) => {
      const parentPath = getFolderParentPath(folder.path);
      const extractedTables = mapFolderToExtractedTables(folder);
      const activeTable =
        extractedTables[0] ?? createEmptyExtractedTable(folder.name);
      setEditingFolderId(folder.id);
      setNewFolderName(folder.name);
      setNewFolderParentPath(parentPath);
      setFolderMode(folder.isOcr ? "data" : "normal");
      setNewFolderExtractedTables(extractedTables);
      setActiveExtractedTableId(activeTable.id);
      loadEditorFromExtractedTable(activeTable);
      setDefinitionImportText("");
      setIsDefinitionImportOpen(false);
      setHasImportedDefinition(false);
      setFolderEditorStep(0);
      setIsAddFolderOpen(true);
    },
    [loadEditorFromExtractedTable],
  );

  const handleOpenMoveFolder = useCallback((folder: DefaultFolder) => {
    setMovingFolder(folder);
    setMoveFolderParentPath(getFolderParentPath(folder.path));
  }, []);

  const handleSaveFolderMove = async () => {
    if (!movingFolder) return;

    const currentParentPath = getFolderParentPath(movingFolder.path);
    const nextParentPath = moveFolderParentPath.trim();
    if (nextParentPath === currentParentPath) {
      setMovingFolder(null);
      setMoveFolderParentPath("");
      return;
    }

    try {
      setIsSubmittingMoveFolder(true);
      const res = await fetch("/api/obra-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildFolderUpdatePayload(movingFolder, nextParentPath),
        ),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error moviendo carpeta");
      }

      const { folder } = await res.json();
      setFolders((prev) =>
        prev.map((item) => (item.id === folder.id ? folder : item)),
      );
      setMovingFolder(null);
      setMoveFolderParentPath("");
      toast.success("Carpeta movida");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Error moviendo carpeta",
      );
    } finally {
      setIsSubmittingMoveFolder(false);
    }
  };

  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) return;
    const derivedDataInputMethod = deriveDataInputMethod({
      acceptsPdfImage: newFolderAcceptsPdfImage,
      acceptsSpreadsheet: newFolderAcceptsSpreadsheet,
      allowsManualEntry: newFolderAllowsManualEntry,
    });

    const currentExtractedTables = newFolderExtractedTables.map(
      (table, index) => {
        if (table.id !== activeExtractedTableId) return table;
        return {
          ...table,
          name:
            table.name?.trim() ||
            (index === 0 ? newFolderName.trim() : `Tabla ${index + 1}`),
          dataInputMethod: derivedDataInputMethod,
          spreadsheetTemplate: newFolderAcceptsSpreadsheet
            ? newFolderSpreadsheetTemplate || null
            : null,
          ocrTemplateId: newFolderAcceptsPdfImage
            ? newFolderOcrTemplateId || null
            : null,
          ocrTemplateName: newFolderAcceptsPdfImage
            ? (ocrTemplates.find(
                (template) => template.id === newFolderOcrTemplateId,
              )?.name ?? null)
            : null,
          manualEntryEnabled: newFolderAllowsManualEntry,
          hasNestedData: newFolderAcceptsPdfImage ? newFolderHasNested : false,
          documentTypes: parseCommaSeparatedList(newFolderDocumentTypesText),
          extractionInstructions: newFolderExtractionInstructions.trim(),
          columns: newFolderColumns.map((column) => ({ ...column })),
        };
      },
    );

    const primaryTable =
      currentExtractedTables[0] ??
      createEmptyExtractedTable(newFolderName.trim());
    const effectiveDataInputMethod = primaryTable.dataInputMethod ?? "both";
    const effectiveSpreadsheetTemplate = primaryTable.spreadsheetTemplate ?? "";
    const effectiveOcrTemplateId = primaryTable.ocrTemplateId ?? "";
    const effectiveHasNested = Boolean(primaryTable.hasNestedData);
    const effectiveDocumentTypes = primaryTable.documentTypes ?? [];
    const effectiveExtractionInstructions =
      primaryTable.extractionInstructions ?? "";

    const needsOcrTemplate =
      effectiveDataInputMethod === "ocr" || effectiveDataInputMethod === "both";
    const hasAnyTemplateSelected = Boolean(
      (newFolderAcceptsPdfImage && effectiveOcrTemplateId) ||
      (newFolderAcceptsSpreadsheet && effectiveSpreadsheetTemplate),
    );
    const hasSpreadsheetTemplateOnly =
      Boolean(effectiveSpreadsheetTemplate) && !effectiveOcrTemplateId;
    let effectiveColumns = primaryTable.columns;

    if (
      folderMode === "data" &&
      effectiveColumns.length === 0 &&
      hasSpreadsheetTemplateOnly
    ) {
      effectiveColumns = buildSpreadsheetDefaultColumns(
        effectiveSpreadsheetTemplate,
      );
      setNewFolderColumns(effectiveColumns);
    }

    if (
      folderMode === "data" &&
      !newFolderAcceptsPdfImage &&
      !newFolderAcceptsSpreadsheet &&
      !newFolderAllowsManualEntry
    ) {
      toast.error("Activá al menos un tipo de entrada");
      return;
    }

    if (
      folderMode === "data" &&
      newFolderAcceptsSpreadsheet &&
      !effectiveSpreadsheetTemplate
    ) {
      toast.error("Seleccioná una plantilla XLSX / CSV");
      return;
    }

    if (folderMode === "data") {
      if (
        needsOcrTemplate &&
        !hasAnyTemplateSelected &&
        !hasImportedDefinition
      ) {
        toast.error("Seleccioná una plantilla OCR o una plantilla XLSX/CSV");
        return;
      }
      if (effectiveColumns.length === 0) {
        toast.error("Agregá al menos una columna");
        return;
      }
    }

    try {
      setIsSubmittingFolder(true);

      const payload: Record<string, unknown> = {
        type: "folder",
        ...(editingFolderId ? { id: editingFolderId } : {}),
        name: newFolderName.trim(),
        parentPath: newFolderParentPath || null,
      };

      if (folderMode === "data") {
        payload.isOcr = true; // Kept for backward compatibility
        payload.dataInputMethod = effectiveDataInputMethod;
        payload.spreadsheetTemplate = effectiveSpreadsheetTemplate || null;
        payload.ocrTemplateId = needsOcrTemplate
          ? effectiveOcrTemplateId
          : null;
        payload.manualEntryEnabled = newFolderAllowsManualEntry;
        payload.hasNestedData = needsOcrTemplate ? effectiveHasNested : false;
        payload.documentTypes = effectiveDocumentTypes;
        payload.extractionInstructions =
          effectiveExtractionInstructions.trim() || null;
        payload.extractionRowMode = primaryTable.rowMode;
        payload.extractionMaxRows = getEffectiveTableMaxRows(primaryTable);
        payload.extractedTables = currentExtractedTables.map(
          (table, tableIndex) => ({
            id: table.id,
            name: table.name?.trim() || `Tabla ${tableIndex + 1}`,
            rowMode: table.rowMode,
            maxRows: getEffectiveTableMaxRows(table),
            dataInputMethod: table.dataInputMethod,
            spreadsheetTemplate: table.spreadsheetTemplate || null,
            ocrTemplateId: table.ocrTemplateId || null,
            manualEntryEnabled:
              typeof table.manualEntryEnabled === "boolean"
                ? table.manualEntryEnabled
                : true,
            hasNestedData: Boolean(table.hasNestedData),
            documentTypes: table.documentTypes ?? [],
            extractionInstructions:
              table.extractionInstructions?.trim() || null,
            columns: table.columns.map((col, index) => ({
              id: col.columnId,
              label: col.label,
              fieldKey: col.fieldKey || normalizeFieldKey(col.label),
              dataType: col.dataType,
              required: col.required,
              position: index,
              ocrScope:
                table.hasNestedData &&
                (table.dataInputMethod === "ocr" ||
                  table.dataInputMethod === "both")
                  ? col.scope
                  : "item",
              description: col.description,
              aliases: col.aliases ?? [],
              examples: col.examples ?? [],
              excelKeywords: col.excelKeywords ?? [],
            })),
          }),
        );
        payload.columns = effectiveColumns.map((col, index) => ({
          id: col.columnId,
          label: col.label,
          fieldKey: col.fieldKey || normalizeFieldKey(col.label),
          dataType: col.dataType,
          required: col.required,
          position: index,
          ocrScope: effectiveHasNested && needsOcrTemplate ? col.scope : "item",
          description: col.description,
          aliases: col.aliases ?? [],
          examples: col.examples ?? [],
          excelKeywords: col.excelKeywords ?? [],
        }));
      }

      const res = await fetch("/api/obra-defaults", {
        method: editingFolderId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creating folder");
      }

      const { folder } = await res.json();
      if (editingFolderId) {
        setFolders((prev) =>
          prev.map((item) => (item.id === folder.id ? folder : item)),
        );
      } else {
        setFolders((prev) => [...prev, folder]);
      }
      resetFolderForm();
      setIsAddFolderOpen(false);
      toast.success(
        editingFolderId
          ? "Carpeta actualizada"
          : folderMode === "data"
            ? "Carpeta de datos agregada"
            : "Carpeta agregada",
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Error guardando carpeta",
      );
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const toggleQuickActionFolder = useCallback((path: string) => {
    setNewQuickActionFolders((prev) => {
      if (prev.includes(path)) {
        return prev.filter((item) => item !== path);
      }
      return [...prev, path];
    });
  }, []);

  const handleAddQuickAction = async () => {
    if (!newQuickActionName.trim()) {
      toast.error("Ingresá un nombre para la acción");
      return;
    }
    if (newQuickActionFolders.length === 0) {
      toast.error("Seleccioná al menos una carpeta");
      return;
    }

    try {
      setIsSubmittingQuickAction(true);
      const payload = {
        type: "quick-action",
        name: newQuickActionName.trim(),
        description: newQuickActionDescription.trim() || null,
        folderPaths: newQuickActionFolders,
      };

      const res = await fetch("/api/obra-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creando la acción");
      }

      const { quickAction } = await res.json();
      setQuickActions((prev) => [...prev, quickAction]);
      resetQuickActionForm();
      setIsAddQuickActionOpen(false);
      toast.success("Acción rápida creada");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Error creando la acción",
      );
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  const handleDeleteQuickAction = async (id: string) => {
    try {
      const res = await fetch("/api/obra-defaults", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quick-action", id }),
      });

      if (!res.ok) throw new Error("Error eliminando la acción");

      setQuickActions((prev) => prev.filter((action) => action.id !== id));
      toast.success("Acción rápida eliminada");
    } catch (error) {
      console.error(error);
      toast.error("Error eliminando la acción");
    }
  };

  const handleAddColumn = () => {
    setNewFolderColumns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        fieldKey: "",
        dataType: "text",
        required: false,
        scope: "item",
        aliases: [],
        examples: [],
        excelKeywords: [],
      },
    ]);
  };

  const applyImportedJsonText = useCallback(
    (rawText: string) => {
      if (!rawText.trim()) {
        toast.error("Pegá una definición JSON primero");
        return;
      }

      try {
        const portableConfig = importPortableDevFolderConfig(
          rawText,
          ocrTemplates,
        );
        if (portableConfig) {
          const firstTable = portableConfig.extractedTables[0];
          setFolderMode("data");
          setNewFolderName((prev) => prev.trim() || portableConfig.folderName);
          setNewFolderExtractedTables(portableConfig.extractedTables);
          setActiveExtractedTableId(firstTable.id);
          loadEditorFromExtractedTable(firstTable);
          setIsDefinitionImportOpen(false);
          setHasImportedDefinition(true);
          setDefinitionImportText("");
          toast.success(
            `Config dev importada: ${portableConfig.extractedTables.length} dataset(s)`,
          );
          return;
        }

        const imported = importDefinitionToFolderConfig(rawText);
        setFolderMode("data");
        setNewFolderName((prev) => prev.trim() || imported.folderName);
        setNewFolderDataInputMethod(imported.suggestedDataInputMethod);
        setNewFolderSpreadsheetTemplate("");
        setNewFolderOcrTemplateId("");
        setNewFolderAcceptsPdfImage(true);
        setNewFolderAcceptsSpreadsheet(false);
        setNewFolderAllowsManualEntry(
          imported.suggestedDataInputMethod !== "ocr",
        );
        setNewFolderHasNested(imported.hasNestedData);
        setNewFolderDocumentTypesText(imported.documentTypes.join(", "));
        setNewFolderExtractionInstructions(imported.extractionInstructions);
        setNewFolderColumns(imported.columns);
        const importedTableId = activeExtractedTableId ?? crypto.randomUUID();
        setNewFolderExtractedTables((prev) => {
          const importedTable: ExtractedTableConfig = {
            id: importedTableId,
            name: imported.folderName,
            rowMode: imported.hasNestedData ? "multiple" : "single",
            maxRows: imported.hasNestedData ? null : 1,
            dataInputMethod: imported.suggestedDataInputMethod,
            spreadsheetTemplate: null,
            ocrTemplateId: null,
            ocrTemplateName: null,
            manualEntryEnabled: true,
            hasNestedData: imported.hasNestedData,
            documentTypes: imported.documentTypes,
            extractionInstructions: imported.extractionInstructions,
            columns: imported.columns,
          };
          if (!activeExtractedTableId) {
            return [importedTable];
          }
          return prev.map((table) =>
            table.id === activeExtractedTableId ? importedTable : table,
          );
        });
        setActiveExtractedTableId(importedTableId);
        setIsDefinitionImportOpen(false);
        setHasImportedDefinition(true);
        toast.success(
          `Definición importada: ${imported.columns.length} campos precargados`,
        );
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo importar la definición",
        );
      }
    },
    [activeExtractedTableId, loadEditorFromExtractedTable, ocrTemplates],
  );

  const handleImportDefinitionJson = useCallback(() => {
    applyImportedJsonText(definitionImportText);
  }, [applyImportedJsonText, definitionImportText]);

  const handlePasteDefinitionFromClipboard = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      toast.error(
        "Este navegador no permite leer el clipboard automáticamente",
      );
      setIsDefinitionImportOpen(true);
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("El clipboard está vacío");
        return;
      }
      setDefinitionImportText(text);
      setIsDefinitionImportOpen(true);
      applyImportedJsonText(text);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo leer el clipboard");
      setIsDefinitionImportOpen(true);
    }
  }, [applyImportedJsonText]);

  const handleCopyDevFolderConfig = useCallback(
    async (folder: DefaultFolder) => {
      try {
        const folderPath = `/${folder.path.replace(/^\/+/, "")}`;
        const config = buildPortableDevFolderConfig({
          folderName: folder.name,
          folderPath,
          extractedTables: mapFolderToExtractedTables(folder),
        });
        await writeClipboardText(JSON.stringify(config, null, 2));
        toast.success("Config dev copiada");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo copiar la config dev");
      }
    },
    [],
  );

  const handleSelectExtractedTable = useCallback(
    (tableId: string) => {
      syncActiveTableFromEditor();
      const nextTable = newFolderExtractedTables.find(
        (table) => table.id === tableId,
      );
      if (!nextTable) return;
      setActiveExtractedTableId(nextTable.id);
      loadEditorFromExtractedTable(nextTable);
    },
    [
      loadEditorFromExtractedTable,
      newFolderExtractedTables,
      syncActiveTableFromEditor,
    ],
  );

  const handleAddExtractedTable = useCallback(() => {
    syncActiveTableFromEditor();
    const nextTable = createEmptyExtractedTable(
      `Tabla ${newFolderExtractedTables.length + 1}`,
    );
    setNewFolderExtractedTables((prev) => [...prev, nextTable]);
    setActiveExtractedTableId(nextTable.id);
    loadEditorFromExtractedTable(nextTable);
  }, [
    loadEditorFromExtractedTable,
    newFolderExtractedTables.length,
    syncActiveTableFromEditor,
  ]);

  const handleRemoveExtractedTable = useCallback(
    (tableId: string) => {
      const remaining = newFolderExtractedTables.filter(
        (table) => table.id !== tableId,
      );
      if (remaining.length === 0) {
        const fallbackTable = createEmptyExtractedTable();
        setNewFolderExtractedTables([fallbackTable]);
        setActiveExtractedTableId(fallbackTable.id);
        loadEditorFromExtractedTable(fallbackTable);
        return;
      }
      setNewFolderExtractedTables(remaining);
      setActiveExtractedTableId(remaining[0].id);
      loadEditorFromExtractedTable(remaining[0]);
    },
    [loadEditorFromExtractedTable, newFolderExtractedTables],
  );

  const handleExtractedTableMetaChange = useCallback(
    (tableId: string, field: "name" | "rowMode" | "maxRows", value: string) => {
      setNewFolderExtractedTables((prev) =>
        prev.map((table) => {
          if (table.id !== tableId) return table;
          if (field === "maxRows") {
            return { ...table, maxRows: sanitizeMaxRows(Number(value)) };
          }
          if (field === "rowMode") {
            return {
              ...table,
              rowMode: value === "multiple" ? "multiple" : "single",
              maxRows:
                value === "multiple" ? sanitizeMaxRows(table.maxRows) : 1,
            };
          }
          return { ...table, name: value };
        }),
      );
    },
    [],
  );

  const handleRemoveColumn = (id: string) => {
    setNewFolderColumns((prev) => prev.filter((col) => col.id !== id));
  };

  const handleColumnChange = (
    id: string,
    field: keyof OcrColumn,
    value: string | boolean,
  ) => {
    setNewFolderColumns((prev) =>
      prev.map((col) => {
        if (col.id !== id) return col;
        const updated = { ...col, [field]: value };
        // Auto-generate fieldKey from label if not manually set
        if (field === "label" && typeof value === "string") {
          updated.fieldKey = normalizeFieldKey(value);
        }
        return updated;
      }),
    );
  };

  const handleColumnListChange = (
    id: string,
    field: "aliases" | "examples" | "excelKeywords",
    value: string,
  ) => {
    const items = parseCommaSeparatedList(value);
    setNewFolderColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, [field]: items } : col)),
    );
  };

  const needsOcrTemplate = newFolderAcceptsPdfImage;
  const hasAnyTemplateSelected = Boolean(
    (newFolderAcceptsPdfImage && newFolderOcrTemplateId) ||
    (newFolderAcceptsSpreadsheet && newFolderSpreadsheetTemplate),
  );
  const extractedTableCount = newFolderExtractedTables.length;
  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (folderMode === "data" &&
      (newFolderColumns.length === 0 || extractedTableCount === 0)) ||
    (folderMode === "data" &&
      !newFolderAcceptsPdfImage &&
      !newFolderAcceptsSpreadsheet &&
      !newFolderAllowsManualEntry) ||
    (folderMode === "data" &&
      newFolderAcceptsPdfImage &&
      !newFolderOcrTemplateId &&
      !hasImportedDefinition) ||
    (folderMode === "data" &&
      newFolderAcceptsSpreadsheet &&
      !newFolderSpreadsheetTemplate);
  const isCreateQuickActionDisabled =
    !newQuickActionName.trim() || newQuickActionFolders.length === 0;

  const folderNameByPath = useMemo(() => {
    return new Map(folders.map((folder) => [folder.path, folder.name]));
  }, [folders]);
  const dataFolders = useMemo(
    () => folders.filter((folder) => folder.isOcr),
    [folders],
  );
  const extractionReadyCount = useMemo(
    () =>
      dataFolders.filter(
        (folder) =>
          Boolean(folder.ocrTemplateId || folder.spreadsheetTemplate) &&
          Boolean(folder.columns?.length),
      ).length,
    [dataFolders],
  );
  const devViewExtractedTables = useMemo(
    () => (devViewFolder ? mapFolderToExtractedTables(devViewFolder) : []),
    [devViewFolder],
  );
  const devViewFolderPath = devViewFolder
    ? `/${devViewFolder.path.replace(/^\/+/, "")}`
    : "/";
  const folderEditorStepMeta = useMemo(
    () =>
      folderMode === "data"
        ? [
            {
              label: "Carpeta",
              title: "Defini la carpeta",
              description:
                "Elegi el objetivo de esta carpeta y donde va a vivir dentro de la obra.",
            },
            {
              label: "Información",
              title: "Definí qué información necesitás",
              description: "Poné un nombre y elegí de dónde van a salir los datos.",
            },
            {
              label: "Datos",
              title: "Elegí qué datos querés ver",
              description:
                "Define las columnas finales que queres ver siempre en la tabla.",
            },
            {
              label: "Revisar",
              title: "Revisa antes de guardar",
              description:
                "Chequea el recorrido completo y confirma lo importante.",
            },
          ]
        : [
            {
              label: "Carpeta",
              title: "Defini la carpeta",
              description:
                "Ubica la carpeta y confirma el objetivo de organizacion.",
            },
            {
              label: "Revisar",
              title: "Revisa antes de guardar",
              description:
                "Confirma la ubicacion final y el tipo de carpeta que vas a crear.",
            },
          ],
    [folderMode],
  );
  const folderEditorStepsLegacy = useMemo(
    () =>
      folderMode === "data"
        ? ["Base", "Carga", "Campos", "Revisión"]
        : ["Base", "Revisión"],
    [folderMode],
  );
  void folderEditorStepsLegacy;
  const folderEditorSteps = useMemo(
    () => folderEditorStepMeta.map((step) => step.label),
    [folderEditorStepMeta],
  );
  const folderEditorLastStep = folderEditorSteps.length - 1;
  const isFolderReviewStep = folderEditorStep === folderEditorLastStep;
  const parentFolderOptions = useMemo(
    () =>
      folders.filter((folder) => {
        if (folder.id === editingFolderId) return false;
        const editingFolder = folders.find(
          (item) => item.id === editingFolderId,
        );
        if (!editingFolder) return true;
        return !isFolderDescendant(folder.path, editingFolder.path);
      }),
    [folders, editingFolderId],
  );
  const moveParentFolderOptions = useMemo(
    () =>
      folders.filter((folder) => {
        if (!movingFolder) return true;
        if (folder.id === movingFolder.id) return false;
        return !isFolderDescendant(folder.path, movingFolder.path);
      }),
    [folders, movingFolder],
  );
  const folderPathPreview = `/${newFolderParentPath ? `${newFolderParentPath}/` : ""}${normalizeFolderName(newFolderName || "carpeta")}`;
  const moveFolderPathPreview = movingFolder
    ? `/${moveFolderParentPath ? `${moveFolderParentPath}/` : ""}${normalizeFolderName(movingFolder.name)}`
    : "/";
  const activeExtractedTable = useMemo(
    () =>
      newFolderExtractedTables.find(
        (table) => table.id === activeExtractedTableId,
      ) ??
      newFolderExtractedTables[0] ??
      null,
    [activeExtractedTableId, newFolderExtractedTables],
  );
  const currentFolderStepMeta =
    folderEditorStepMeta[folderEditorStep] ?? folderEditorStepMeta[0];
  const folderProgressValue =
    ((folderEditorStep + 1) / folderEditorSteps.length) * 100;
  const currentWizardTitle =
    folderMode === "data"
      ? folderEditorStep === 0
        ? "¿Para qué vas a usar esta carpeta?"
        : folderEditorStep === 1
          ? "¿Qué información querés guardar?"
          : folderEditorStep === 2
            ? "¿Qué datos necesitás ver?"
            : "¿Está todo bien?"
      : folderEditorStep === 0
        ? "¿Para qué vas a usar esta carpeta?"
        : "¿Está todo bien?";
  const currentWizardDescription =
    folderMode === "data"
      ? folderEditorStep === 0
        ? "Elegí si solo vas a guardar archivos o si también querés ordenar información como fechas, montos o proveedores."
        : folderEditorStep === 1
          ? "Poné un nombre y elegí si la información sale de documentos, de una planilla o la completa una persona."
          : folderEditorStep === 2
            ? "Agregá los datos que necesitás, por ejemplo fecha, monto o proveedor."
            : "Confirmá la información. Vas a poder cambiarla más adelante."
      : folderEditorStep === 0
        ? "Elegí si solo vas a guardar archivos o si también querés ordenar información como fechas, montos o proveedores."
        : "Confirmá la información. Vas a poder cambiarla más adelante.";
  const isFolderBaseReady = Boolean(newFolderName.trim());
  const isFolderCaptureReady =
    folderMode !== "data" ||
    (extractedTableCount > 0 &&
      (!needsOcrTemplate || hasAnyTemplateSelected || hasImportedDefinition));
  const isFolderColumnsReady =
    folderMode !== "data" || newFolderColumns.length > 0;
  const canAdvanceFolderStep =
    folderEditorStep === 0
      ? isFolderBaseReady
      : folderMode === "data" && folderEditorStep === 1
        ? isFolderCaptureReady
        : folderMode === "data" && folderEditorStep === 2
          ? isFolderColumnsReady
          : true;
  const goToFolderEditorStep = useCallback(
    (nextStep: number) => {
      if (folderMode === "data") {
        syncActiveTableFromEditor();
      }
      setFolderEditorStep(
        Math.max(0, Math.min(nextStep, folderEditorLastStep)),
      );
    },
    [folderEditorLastStep, folderMode, syncActiveTableFromEditor],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-12">
        <Loader2 className="size-8 animate-spin text-content-muted" />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-screen w-full overflow-y-auto overflow-x-hidden bg-canvas px-3 py-4 text-content sm:px-4 md:max-w-[calc(100vw-var(--sidebar-current-width))] md:px-16 md:py-8">
      <div className={cn(adminPageMaxWidthClass, "space-y-4")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-content sm:text-4xl">
              Modelo de obras
            </h1>
            <p className="mt-1 text-sm text-content-muted sm:text-base">
              Elegí las carpetas y los datos que tendrá cada obra nueva.
            </p>
          </div>
          <LightButton
            asChild
            variant="secondary"
            size="lg"
            className="shrink-0"
          >
            <Link href="/admin/obra-defaults/reporting">
              Configurar reportes
            </Link>
          </LightButton>
        </div>

        <div
          className={cn(
            adminSurfaceClass,
            "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <FolderPlus className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Esta es la base de las obras nuevas
              </p>
              <p className="text-xs text-muted-foreground">
                Las obras existentes no cambian automáticamente.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-content">{folders.length}</span>{" "}
            carpetas
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-content">
              {extractionReadyCount}
            </span>{" "}
            con datos automáticos
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-content">
              {quickActions.length}
            </span>{" "}
            pasos guiados
          </p>
        </div>
      </div>

      <Tabs
        value={activeSection}
        onValueChange={setActiveSection}
        className={cn(adminPageMaxWidthClass, "mt-4 space-y-4")}
      >
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-surface-recessed p-1 sm:w-fit">
          <TabsTrigger value="structure" className="gap-2 whitespace-nowrap">
            <Folder className="size-4" />
            Carpetas
          </TabsTrigger>
          <TabsTrigger value="extraction" className="gap-2 whitespace-nowrap">
            <Table2 className="size-4" />
            Datos automáticos
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 whitespace-nowrap">
            <ScanLine className="size-4" />
            Lectura de documentos
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2 whitespace-nowrap">
            <Zap className="size-4" />
            Pasos guiados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure">
          <section
            className={cn(adminSurfaceClass, "mx-auto max-w-5xl p-4 sm:p-6")}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Carpetas de cada obra</h2>
                <p className="text-sm text-muted-foreground">
                  Todas las obras nuevas empiezan con esta organización.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <LightButton
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => openCreateFolder("data")}
                >
                  <Table2 className="mr-2 size-4" />
                    Carpeta con información
                </LightButton>
                <LightButton
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => openCreateFolder("normal")}
                >
                  <Plus className="mr-2 size-4" />
                    Carpeta de archivos
                </LightButton>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {folders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stroke-soft bg-surface-recessed p-8 text-center text-content-muted">
                  <FolderPlus className="size-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">Todavía no hay carpetas</p>
                  <p className="text-xs">
                    Agregá la primera para organizar las obras nuevas.
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {folders.map((folder, index) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      index={index}
                      onEdit={() => handleEditFolder(folder)}
                      onMove={() => handleOpenMoveFolder(folder)}
                      onViewDev={
                        folder.isOcr
                          ? () => setDevViewFolder(folder)
                          : undefined
                      }
                      onDelete={() => setDeleteBlockedFolder(folder)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="extraction">
          <section
            className={cn(adminSurfaceClass, "mx-auto max-w-5xl p-4 sm:p-6")}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Datos automáticos</h2>
                <p className="text-sm text-muted-foreground">
                  Elegí qué información obtiene el sistema de PDFs, imágenes o
                  planillas.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <LightButton
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={openCreateFolderFromDefinition}
                >
                  <ClipboardPaste className="mr-2 size-4" />
                  Importar configuración
                </LightButton>
                <LightButton
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => openCreateFolder("data")}
                  data-testid="open-data-folder-dialog"
                >
                  <Plus className="mr-2 size-4" />
                  Agregar datos
                </LightButton>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-stroke-soft bg-surface-recessed px-4 py-3 text-sm text-muted-foreground">
              Cada configuración define qué documentos se aceptan y qué columnas
              se completan.
            </div>

            <div className="mt-4 space-y-2">
              {dataFolders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stroke-soft bg-surface-recessed p-8 text-center text-content-muted">
                  <Table2 className="size-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">
                    Todavía no hay datos automáticos
                  </p>
                  <p className="text-xs">
                    Agregá una configuración para leer documentos o planillas.
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {dataFolders.map((folder, index) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      index={index}
                      onEdit={() => handleEditFolder(folder)}
                      onMove={() => handleOpenMoveFolder(folder)}
                      onViewDev={() => setDevViewFolder(folder)}
                      onDelete={() => setDeleteBlockedFolder(folder)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="templates">
          <section
            className={cn(adminSurfaceClass, "mx-auto max-w-5xl p-4 sm:p-6")}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Lectura de documentos</h2>
                <p className="text-sm text-muted-foreground">
                  Guardá reglas reutilizables para leer siempre el mismo
                  formato.
                </p>
              </div>
              <LightButton
                type="button"
                variant="primary"
                size="lg"
                onClick={() => {
                  setEditingOcrTemplate(null);
                  setIsOcrConfigOpen(true);
                }}
              >
                <Plus className="mr-2 size-4" />
                Nueva lectura
              </LightButton>
            </div>

            <div className="mt-5 space-y-3">
              {ocrTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stroke-soft bg-surface-recessed p-8 text-center text-content-muted">
                  <ScanLine className="size-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">
                    Todavía no hay reglas de lectura
                  </p>
                  <p className="text-xs">
                    Creá una para obtener datos de documentos con el mismo
                    formato.
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {ocrTemplates.map((template, index) => (
                    <OcrTemplateCard
                      key={template.id}
                      template={template}
                      index={index}
                      onEdit={() => handleEditOcrTemplate(template)}
                      onDelete={() => handleDeleteOcrTemplate(template.id)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="actions">
          <section
            className={cn(adminSurfaceClass, "mx-auto max-w-5xl p-4 sm:p-6")}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Pasos guiados</h2>
                <p className="text-sm text-muted-foreground">
                  Creá recorridos simples para las cargas que se repiten.
                </p>
              </div>
              <LightButton
                type="button"
                variant="primary"
                size="lg"
                onClick={() => setIsAddQuickActionOpen(true)}
              >
                <Plus className="mr-2 size-4" />
                Nuevo recorrido
              </LightButton>
            </div>

            <div className="mt-5 space-y-2">
              {quickActions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stroke-soft bg-surface-recessed p-8 text-center text-content-muted">
                  <Zap className="size-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">
                    Todavía no hay recorridos
                  </p>
                  <p className="text-xs">
                    Creá uno para acompañar al usuario paso a paso.
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {quickActions.map((action, index) => (
                    <m.div
                      key={action.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(adminCardClass, "group space-y-3 p-4")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {action.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {action.description ||
                              `${action.folderPaths.length} pasos`}
                          </p>
                        </div>
                        <LightButton
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteQuickAction(action.id)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </LightButton>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {action.folderPaths.map((path, pathIndex) => (
                          <Badge
                            key={`${action.id}-${path}`}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {pathIndex + 1}.{" "}
                            {folderNameByPath.get(path) ?? path}
                          </Badge>
                        ))}
                      </div>
                    </m.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(movingFolder)}
        onOpenChange={(open) => {
          if (!open && !isSubmittingMoveFolder) {
            setMovingFolder(null);
            setMoveFolderParentPath("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-5 w-5 text-orange-500" />
              Mover carpeta
            </DialogTitle>
            <DialogDescription>
              Cambiá solo la ubicación de la carpeta. La configuración de datos
              y extracción se conserva.
            </DialogDescription>
          </DialogHeader>

          {movingFolder ? (
            <div className="space-y-5 py-2">
              <div className="rounded-2xl border bg-muted/30 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Carpeta actual
                </p>
                <p className="mt-1 font-mono text-sm">/{movingFolder.path}</p>
              </div>

              <div className="space-y-2">
                <Label>Nuevo padre</Label>
                <Select
                  value={moveFolderParentPath || "__root__"}
                  onValueChange={(value) =>
                    setMoveFolderParentPath(value === "__root__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Raiz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">Raiz</SelectItem>
                    {moveParentFolderOptions.map((folder) => (
                      <SelectItem key={folder.id} value={folder.path}>
                        {folder.name} (/{folder.path})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl bg-muted/40 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Ruta final
                </p>
                <p className="mt-1 font-mono text-sm">
                  {moveFolderPathPreview}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <LightButton
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                setMovingFolder(null);
                setMoveFolderParentPath("");
              }}
              disabled={isSubmittingMoveFolder}
            >
              Cancelar
            </LightButton>
            <LightButton
              type="button"
              variant="primary"
              size="lg"
              onClick={() => void handleSaveFolderMove()}
              disabled={isSubmittingMoveFolder || !movingFolder}
            >
              {isSubmittingMoveFolder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderInput className="mr-2 h-4 w-4" />
              )}
              Mover carpeta
            </LightButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(devViewFolder)}
        onOpenChange={(open) => {
          if (!open) setDevViewFolder(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[92vw] max-w-[1000px] overflow-y-auto px-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="size-5 text-content-secondary" />
              Dev view de carpeta
            </DialogTitle>
            <DialogDescription>
              Configuracion final de extraccion para la carpeta ya creada.
            </DialogDescription>
          </DialogHeader>

          {devViewFolder ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyDevFolderConfig(devViewFolder)}
                >
                  <Copy className="mr-2 size-4" />
                  Copiar config
                </Button>
              </div>
              <div className="rounded-lg border border-stroke bg-surface p-3">
                <p className="text-sm font-semibold text-content">
                  {devViewFolder.name}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-content-muted">
                  {devViewFolderPath}
                </p>
              </div>
              <ExtractionDevConfigView
                folderPath={devViewFolderPath}
                extractedTables={devViewExtractedTables}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {false && (
        <div className="flex flex-col xl:flex-row gap-6">
          ){/* Folders Section */}
          <section className="space-y-4 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <FolderPlus className="size-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    Carpetas Predeterminadas
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Estas carpetas se crean automáticamente en cada nueva obra
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  resetFolderForm();
                  setIsAddFolderOpen(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="size-4 mr-2" />
                Nueva carpeta
              </Button>
            </div>

            <div className="space-y-2">
              {folders.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                  <FolderPlus className="size-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">
                    Sin carpetas configuradas
                  </p>
                  <p className="text-xs">
                    Agregá carpetas para organizar los documentos de tus obras
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {folders.map((folder, index) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      index={index}
                      onEdit={() => handleEditFolder(folder)}
                      onMove={() => handleOpenMoveFolder(folder)}
                      onDelete={() => setDeleteBlockedFolder(folder)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
          {/* Quick Actions Section */}
          <section className="space-y-4 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Zap className="size-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Acciones rápidas</h2>
                  <p className="text-sm text-muted-foreground">
                    Flujos de carga rápida con pasos por carpeta
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsAddQuickActionOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="size-4 mr-2" />
                Nueva acción
              </Button>
            </div>

            <div className="space-y-2">
              {quickActions.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                  <Zap className="size-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">
                    Sin acciones configuradas
                  </p>
                  <p className="text-xs">
                    Agregá acciones para acelerar cargas frecuentes
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {quickActions.map((action, index) => (
                    <m.div
                      key={action.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.03 }}
                      className="group rounded-lg border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {action.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {action.description ||
                              `${action.folderPaths.length} pasos`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteQuickAction(action.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {action.folderPaths.map((path, pathIndex) => (
                          <Badge
                            key={`${action.id}-${path}`}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {pathIndex + 1}.{" "}
                            {folderNameByPath.get(path) ?? path}
                          </Badge>
                        ))}
                      </div>
                    </m.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
          {/* Extraction Templates Section */}
          <section className="space-y-4 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <ScanLine className="size-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    Plantillas de Extracción
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Definen qué datos extraer de cada tipo de documento
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsOcrConfigOpen(true)}
                className="bg-purple-500 hover:bg-purple-600 text-white"
              >
                <Plus className="size-4 mr-2" />
                Nueva plantilla
              </Button>
            </div>

            <div className="space-y-3">
              {ocrTemplates.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                  <ScanLine className="size-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">
                    Sin plantillas configuradas
                  </p>
                  <p className="text-xs">
                    Creá una plantilla para empezar a extraer datos de tus
                    documentos
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {ocrTemplates.map((template, index) => (
                    <OcrTemplateCard
                      key={template.id}
                      template={template}
                      index={index}
                      onEdit={() => handleEditOcrTemplate(template)}
                      onDelete={() => handleDeleteOcrTemplate(template.id)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Quick Actions Dialog */}
      <Dialog
        open={isAddQuickActionOpen}
        onOpenChange={(open) => {
          setIsAddQuickActionOpen(open);
          if (!open) resetQuickActionForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4">
          <DialogHeader className="px-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg flex items-center justify-center bg-orange-100 dark:bg-orange-900/30">
                <Zap className="size-4 text-orange-600" />
              </div>
              Nueva acción rápida
            </DialogTitle>
            <DialogDescription>
              Creá un flujo con pasos por carpeta para cargas repetitivas.
            </DialogDescription>
          </DialogHeader>

          {false && (
            <div className="mx-auto max-w-3xl space-y-8 py-4">
              <div className="space-y-4 rounded-3xl border bg-background p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>
                        Paso {folderEditorStep + 1} de{" "}
                        {folderEditorSteps.length}
                      </span>
                      <Badge variant="outline" className="rounded-full">
                        {Math.round(folderProgressValue)}%
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">
                        {currentFolderStepMeta.label}
                      </h3>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {currentFolderStepMeta.description}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-[220px] space-y-3 lg:max-w-xs">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Ruta final
                      </p>
                      <p className="font-mono text-sm">{folderPathPreview}</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${folderProgressValue}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`grid gap-3 ${folderMode === "data" ? "md:grid-cols-4" : "md:grid-cols-2"}`}
              >
                {folderEditorStepMeta.map((step, index) => {
                  const isActive = index === folderEditorStep;
                  const isComplete = index < folderEditorStep;
                  return (
                    <button
                      key={step.label}
                      type="button"
                      onClick={() => {
                        if (index <= folderEditorStep) {
                          goToFolderEditorStep(index);
                        }
                      }}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-amber-500 bg-amber-50"
                          : isComplete
                            ? "border-border bg-background"
                            : "bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                            isActive
                              ? "bg-amber-500 text-white"
                              : isComplete
                                ? "bg-emerald-500 text-white"
                                : "bg-background text-muted-foreground"
                          }`}
                        >
                          {isComplete ? "OK" : index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{step.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {step.title}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {folderEditorStep === 0 && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setFolderMode("normal")}
                      disabled={Boolean(editingFolderId)}
                      className={`rounded-3xl border p-5 text-left transition ${
                        folderMode === "normal"
                          ? "border-amber-500 bg-amber-50 shadow-sm"
                          : "hover:border-amber-200 hover:bg-amber-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
                          <Folder className="size-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">
                            Carpeta normal
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Solo organiza archivos y deja una estructura clara.
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFolderMode("data")}
                      disabled={Boolean(editingFolderId)}
                      className={`rounded-3xl border p-5 text-left transition ${
                        folderMode === "data"
                          ? "border-amber-500 bg-amber-50 shadow-sm"
                          : "hover:border-amber-200 hover:bg-amber-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
                          <Table2 className="size-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">
                            Carpeta de datos
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Guarda archivos y crea una tabla lista para captura
                            o extraccion.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="rounded-3xl border bg-background p-6 space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Carpeta padre</Label>
                        <Select
                          value={newFolderParentPath || "__root__"}
                          onValueChange={(value) =>
                            setNewFolderParentPath(
                              value === "__root__" ? "" : value,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Raiz" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__root__">Raiz</SelectItem>
                            {parentFolderOptions.map((folder) => (
                              <SelectItem key={folder.id} value={folder.path}>
                                {folder.name} (/{folder.path})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre de la carpeta</Label>
                        <Input
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder={
                            folderMode === "data"
                              ? "Ej. Certificados"
                              : "Ej. Documentacion"
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Preview
                      </p>
                      <p className="font-mono text-sm">{folderPathPreview}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la acción</Label>
              <Input
                value={newQuickActionName}
                onChange={(e) => setNewQuickActionName(e.target.value)}
                placeholder="Ej. Carga mensual"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={newQuickActionDescription}
                onChange={(e) => setNewQuickActionDescription(e.target.value)}
                placeholder="Ej. Subir certificados y facturas"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div>
                <Label>Carpetas (orden de pasos)</Label>
                <p className="text-xs text-muted-foreground">
                  Seleccioná las carpetas en el orden deseado.
                </p>
              </div>

              {folders.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed text-center">
                  No hay carpetas configuradas. Creá una carpeta primero.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {folders.map((folder) => {
                    const orderIndex = newQuickActionFolders.indexOf(
                      folder.path,
                    );
                    const isSelected = orderIndex !== -1;

                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => toggleQuickActionFolder(folder.path)}
                        className={`w-full rounded-lg border p-3 flex items-center gap-3 text-left transition-colors ${isSelected ? "border-orange-500 bg-orange-50" : "hover:bg-accent/50"}`}
                      >
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                          {folder.isOcr ? (
                            <Table2 className="size-4" />
                          ) : (
                            <Folder className="size-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {folder.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            /{folder.path}
                          </p>
                        </div>
                        {isSelected ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Paso {orderIndex + 1}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden">
              <div className="grid gap-2 sm:grid-cols-4">
                {folderEditorSteps.map((step, index) => {
                  const isActive = index === folderEditorStep;
                  const isComplete = index < folderEditorStep;
                  return (
                    <div
                      key={step}
                      className={`rounded-xl border px-3 py-2 text-left ${
                        isActive
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                          : isComplete
                            ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
                            : "bg-muted/30"
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Paso {index + 1}
                      </p>
                      <p className="text-sm font-medium">{step}</p>
                    </div>
                  );
                })}
              </div>

              {folderEditorStep === 0 && (
                <div className="space-y-4">
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Carpeta normal:</strong> solo organiza archivos.
                      <br />
                      <strong>Carpeta de datos:</strong> crea una tabla asociada
                      para carga manual o extracción.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={folderMode === "normal" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFolderMode("normal")}
                      className="flex-1"
                      disabled={Boolean(editingFolderId)}
                    >
                      <Folder className="size-4 mr-2" />
                      Solo guardar archivos
                    </Button>
                    <Button
                      type="button"
                      variant={folderMode === "data" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFolderMode("data")}
                      className="flex-1"
                      disabled={Boolean(editingFolderId)}
                    >
                      <Table2 className="size-4 mr-2" />
                      Guardar archivos y capturar datos
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Carpeta padre (opcional)</Label>
                    <Select
                      value={newFolderParentPath || "__root__"}
                      onValueChange={(value) =>
                        setNewFolderParentPath(
                          value === "__root__" ? "" : value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Raíz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__root__">Raíz</SelectItem>
                        {parentFolderOptions.map((folder) => (
                          <SelectItem key={folder.id} value={folder.path}>
                            {folder.name} (/{folder.path})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Nombre de la carpeta</Label>
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder={
                        folderMode === "data"
                          ? "Ej. Certificados Extraídos"
                          : "Ej. Documentación"
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Ruta final: /
                      {newFolderParentPath ? `${newFolderParentPath}/` : ""}
                      {normalizeFolderName(newFolderName || "carpeta")}
                    </p>
                  </div>
                </div>
              )}

              {folderMode === "data" && folderEditorStep === 1 && (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label>Importar definicion JSON</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pega el resultado del LLM y precargamos documentos
                          esperados, instrucciones y columnas.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setIsDefinitionImportOpen((prev) => !prev)
                        }
                      >
                        {isDefinitionImportOpen ? "Ocultar" : "Pegar JSON"}
                      </Button>
                    </div>

                    {isDefinitionImportOpen && (
                      <div className="space-y-3">
                        <Textarea
                          value={definitionImportText}
                          onChange={(e) =>
                            setDefinitionImportText(e.target.value)
                          }
                          placeholder="Pegá acá el JSON completo de la definición de extracción"
                          className="min-h-[220px] font-mono text-xs"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Si hay secciones tabulares, se activan como datos
                            anidados.
                          </p>
                          <Button
                            type="button"
                            onClick={handleImportDefinitionJson}
                            className="bg-amber-500 hover:bg-amber-600"
                          >
                            <Sparkles className="size-4 mr-2" />
                            Importar definicion
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div>
                      <Label>Método de carga de datos</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Elegí si esta tabla recibe datos manuales, desde OCR o
                        desde ambos.
                      </p>
                    </div>
                    <RadioGroup
                      value={newFolderDataInputMethod}
                      onValueChange={(value) =>
                        setNewFolderDataInputMethod(value as DataInputMethod)
                      }
                      className="grid gap-3 sm:grid-cols-3"
                    >
                      <div className="flex items-center space-x-2 rounded-lg border bg-background px-3 py-2">
                        <RadioGroupItem
                          value="ocr"
                          id="defaults-method-ocr-step"
                        />
                        <Label
                          htmlFor="defaults-method-ocr-step"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Solo OCR
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border bg-background px-3 py-2">
                        <RadioGroupItem
                          value="manual"
                          id="defaults-method-manual-step"
                        />
                        <Label
                          htmlFor="defaults-method-manual-step"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Solo manual
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border bg-background px-3 py-2">
                        <RadioGroupItem
                          value="both"
                          id="defaults-method-both-step"
                        />
                        <Label
                          htmlFor="defaults-method-both-step"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Ambos
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {newFolderDataInputMethod !== "ocr" && (
                    <div className="space-y-2">
                      <Label>Plantilla de extracción XLSX/CSV</Label>
                      <Select
                        value={newFolderSpreadsheetTemplate || undefined}
                        onValueChange={(value) =>
                          setNewFolderSpreadsheetTemplate(
                            value as "auto" | "certificado",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar plantilla XLSX..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            Auto (detectar por columnas)
                          </SelectItem>
                          <SelectItem value="certificado">
                            Certificado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(newFolderDataInputMethod === "ocr" ||
                    newFolderDataInputMethod === "both") && (
                    <>
                      <div className="space-y-2">
                        <Label>Plantilla OCR</Label>
                        {ocrTemplates.length === 0 ? (
                          <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
                            No hay plantillas disponibles. Creá una primero.
                          </div>
                        ) : (
                          <Select
                            value={newFolderOcrTemplateId || undefined}
                            onValueChange={handleTemplateSelect}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar plantilla..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ocrTemplates.map((template) => (
                                <SelectItem
                                  key={template.id}
                                  value={template.id}
                                >
                                  {template.name} ({template.columns.length}{" "}
                                  campos)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">Datos anidados</p>
                          <p className="text-xs text-muted-foreground">
                            El documento tiene datos a nivel documento e items.
                          </p>
                        </div>
                        <Switch
                          checked={newFolderHasNested}
                          onCheckedChange={setNewFolderHasNested}
                          disabled={Boolean(newFolderOcrTemplateId)}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div>
                      <Label htmlFor="document-types-step">
                        Tipos de documento esperados
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Separados por coma. Ejemplo: certificado mensual,
                        certificado desacopio.
                      </p>
                    </div>
                    <Textarea
                      id="document-types-step"
                      value={newFolderDocumentTypesText}
                      onChange={(e) =>
                        setNewFolderDocumentTypesText(e.target.value)
                      }
                      placeholder="certificado mensual, certificado desacopio, curva de avance"
                      className="min-h-[72px]"
                    />
                    <div>
                      <Label htmlFor="extraction-instructions-step">
                        Instrucciones de extracción
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Explicale al sistema cómo interpretar estos documentos,
                        qué significan los campos y qué debe ignorar.
                      </p>
                    </div>
                    <Textarea
                      id="extraction-instructions-step"
                      value={newFolderExtractionInstructions}
                      onChange={(e) =>
                        setNewFolderExtractionInstructions(e.target.value)
                      }
                      placeholder="El expediente puede aparecer como Expte., Nro. Expte o EX-2025..."
                      className="min-h-[96px]"
                    />
                  </div>
                </div>
              )}

              {folderMode === "data" && folderEditorStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Columnas de la tabla</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Definí el resultado final que querés ver en todas las
                        obras.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddColumn}
                    >
                      <Plus className="size-4 mr-1" />
                      Agregar
                    </Button>
                  </div>

                  {newFolderColumns.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed text-center">
                      No hay columnas definidas. Agregá al menos una columna.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {newFolderColumns.map((col) => (
                        <div
                          key={col.id}
                          className="space-y-2 rounded-lg border bg-background p-2"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              value={col.label}
                              onChange={(e) =>
                                handleColumnChange(
                                  col.id,
                                  "label",
                                  e.target.value,
                                )
                              }
                              placeholder="Nombre columna"
                              className="flex-1 h-8 text-sm"
                            />
                            <Select
                              value={col.dataType}
                              onValueChange={(value) =>
                                handleColumnChange(col.id, "dataType", value)
                              }
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DATA_TYPE_OPTIONS.map((type) => (
                                  <SelectItem
                                    key={type.value}
                                    value={type.value}
                                  >
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={col.required}
                                onChange={(e) =>
                                  handleColumnChange(
                                    col.id,
                                    "required",
                                    e.target.checked,
                                  )
                                }
                                className="rounded border-stone-300"
                              />
                              Req.
                            </label>
                            {newFolderHasNested && needsOcrTemplate && (
                              <Select
                                value={col.scope}
                                onValueChange={(value) =>
                                  handleColumnChange(col.id, "scope", value)
                                }
                              >
                                <SelectTrigger className="w-24 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="parent">Doc</SelectItem>
                                  <SelectItem value="item">Item</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveColumn(col.id)}
                              className="size-8 text-destructive hover:text-destructive"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                          <Textarea
                            value={col.description ?? ""}
                            onChange={(e) =>
                              handleColumnChange(
                                col.id,
                                "description",
                                e.target.value,
                              )
                            }
                            placeholder="Qué significa este campo y cómo debería interpretarse"
                            className="min-h-[64px]"
                          />
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={joinCommaSeparatedList(col.aliases)}
                              onChange={(e) =>
                                handleColumnListChange(
                                  col.id,
                                  "aliases",
                                  e.target.value,
                                )
                              }
                              placeholder="Aliases / nombres alternativos"
                              className="h-8 text-sm"
                            />
                            <Input
                              value={joinCommaSeparatedList(col.examples)}
                              onChange={(e) =>
                                handleColumnListChange(
                                  col.id,
                                  "examples",
                                  e.target.value,
                                )
                              }
                              placeholder="Ejemplos de valores"
                              className="h-8 text-sm"
                            />
                            <Input
                              value={joinCommaSeparatedList(col.excelKeywords)}
                              onChange={(e) =>
                                handleColumnListChange(
                                  col.id,
                                  "excelKeywords",
                                  e.target.value,
                                )
                              }
                              placeholder="Encabezados / keywords Excel"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isFolderReviewStep && (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium">Resumen</p>
                      <p className="text-xs text-muted-foreground">
                        Revisá el impacto antes de guardar.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Tipo</p>
                        <p className="text-sm font-medium">
                          {folderMode === "data"
                            ? "Carpeta de datos"
                            : "Carpeta normal"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Ruta</p>
                        <p className="text-sm font-medium font-mono">
                          /
                          {newFolderParentPath ? `${newFolderParentPath}/` : ""}
                          {normalizeFolderName(newFolderName || "carpeta")}
                        </p>
                      </div>
                      {folderMode === "data" && (
                        <>
                          <div className="rounded-lg border bg-background p-3">
                            <p className="text-xs text-muted-foreground">
                              Carga
                            </p>
                            <p className="text-sm font-medium">
                              {getDataInputMethodLabel(
                                newFolderDataInputMethod,
                              )}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-background p-3">
                            <p className="text-xs text-muted-foreground">
                              Columnas
                            </p>
                            <p className="text-sm font-medium">
                              {newFolderColumns.length} definidas
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {folderMode === "data" && newFolderColumns.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Campos finales
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {newFolderColumns.map((col) => (
                            <Badge key={col.id} variant="secondary">
                              {col.label || col.fieldKey || "Sin nombre"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden">
              <div className="space-y-2">
                <Label>Nombre de la acción</Label>
                <Input
                  value={newQuickActionName}
                  onChange={(e) => setNewQuickActionName(e.target.value)}
                  placeholder="Ej. Carga mensual"
                />
              </div>

              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={newQuickActionDescription}
                  onChange={(e) => setNewQuickActionDescription(e.target.value)}
                  placeholder="Ej. Subir certificados y facturas"
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Carpetas (orden de pasos)</Label>
                  <p className="text-xs text-muted-foreground">
                    Seleccioná las carpetas en el orden deseado.
                  </p>
                </div>

                {folders.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed text-center">
                    No hay carpetas configuradas. Creá una carpeta primero.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {folders.map((folder) => {
                      const orderIndex = newQuickActionFolders.indexOf(
                        folder.path,
                      );
                      const isSelected = orderIndex !== -1;

                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => toggleQuickActionFolder(folder.path)}
                          className={`w-full rounded-lg border p-3 flex items-center gap-3 text-left transition-colors ${isSelected ? "border-orange-500 bg-orange-50" : "hover:bg-accent/50"}`}
                        >
                          <div className="flex size-9 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                            {folder.isOcr ? (
                              <Table2 className="size-4" />
                            ) : (
                              <Folder className="size-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {folder.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              /{folder.path}
                            </p>
                          </div>
                          {isSelected ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Paso {orderIndex + 1}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <LightButton
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                setIsAddQuickActionOpen(false);
                resetQuickActionForm();
              }}
            >
              Cancelar
            </LightButton>
            <LightButton
              type="button"
              variant="primary"
              size="lg"
              onClick={() => void handleAddQuickAction()}
              disabled={isSubmittingQuickAction || isCreateQuickActionDisabled}
            >
              {isSubmittingQuickAction ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Zap className="size-4 mr-2" />
              )}
              Crear acción
            </LightButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Folder Dialog */}
      <Dialog
        open={isAddFolderOpen}
        onOpenChange={(open) => {
          setIsAddFolderOpen(open);
          if (!open) resetFolderForm();
        }}
      >
        <DialogContent className="max-h-[92vh] w-[min(96vw,1100px)] max-w-none overflow-y-auto px-6 py-8">
          <DialogTitle className="sr-only">{currentWizardTitle}</DialogTitle>

          <div
            className={cn(
              "mx-auto w-full space-y-8 py-4 transition-[max-width] duration-300 ease-out",
              folderMode === "data" && folderEditorStep === 1
                ? "max-w-4xl"
                : "max-w-2xl",
            )}
          >
            <div className="space-y-6 text-center">
              {/* Step indicator */}
              <div className="flex items-start justify-center">
                {folderEditorStepMeta.map((step, index) => {
                  const isActive = index === folderEditorStep;
                  const isComplete = index < folderEditorStep;
                  const isClickable = index <= folderEditorStep;
                  const isLast = index === folderEditorStepMeta.length - 1;
                  return (
                    <div key={step.label} className="flex items-start">
                      <button
                        type="button"
                        onClick={() => {
                          if (isClickable) goToFolderEditorStep(index);
                        }}
                        disabled={!isClickable}
                        className="flex flex-col items-center gap-1.5 disabled:cursor-default"
                        aria-current={isActive ? "step" : undefined}
                        aria-label={`Paso ${index + 1}: ${step.label}`}
                      >
                        <div
                          className={[
                            "flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-all duration-200",
                            isComplete
                              ? "border-orange-500 bg-orange-500 text-white"
                              : isActive
                                ? "border-orange-500 bg-background text-orange-500 ring-4 ring-orange-500/10"
                                : "border-border bg-background text-muted-foreground",
                          ].join(" ")}
                        >
                          {isComplete ? (
                            <svg
                              className="size-3"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M2 6.5l2.5 2.5 5.5-5.5"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span
                          className={[
                            "text-[10px] font-medium tracking-[0.1em] uppercase transition-colors duration-200",
                            isActive
                              ? "text-orange-500"
                              : isComplete
                                ? "text-foreground/70"
                                : "text-muted-foreground/60",
                          ].join(" ")}
                        >
                          {step.label}
                        </span>
                      </button>

                      {!isLast && (
                        <div className="relative mx-2 mt-3 h-[2px] w-8 overflow-hidden rounded-full bg-border">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-[width] duration-300 ease-out"
                            style={{ width: isComplete ? "100%" : "0%" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <h3 className="text-3xl font-semibold tracking-tight text-balance">
                  {currentWizardTitle}
                </h3>
                <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
                  {currentWizardDescription}
                </p>
              </div>
            </div>

            {folderEditorStep === 0 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFolderMode("normal")}
                    disabled={Boolean(editingFolderId)}
                    className={`rounded-xl border p-5 text-left transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none ${
                      folderMode === "normal"
                        ? "border-orange-500 bg-background shadow-[0_0_0_3px_rgba(249,115,22,0.08)]"
                        : "border-border bg-background hover:border-orange-200 hover:bg-orange-50/20 dark:hover:border-orange-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Solo guardar archivos</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Para contratos, notas, anexos y documentos de
                          referencia.
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Ideal para documentación de consulta
                        </p>
                      </div>
                      <div
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
                          folderMode === "normal"
                            ? "border-orange-500"
                            : "border-stone-300"
                        }`}
                      >
                        {folderMode === "normal" ? (
                          <div className="size-2 rounded-full bg-orange-500" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderMode("data")}
                    disabled={Boolean(editingFolderId)}
                    className={`rounded-xl border p-5 text-left transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none ${
                      folderMode === "data"
                        ? "border-orange-500 bg-background shadow-[0_0_0_3px_rgba(249,115,22,0.08)]"
                        : "border-border bg-background hover:border-orange-200 hover:bg-orange-50/20 dark:hover:border-orange-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">
                          Guardar y ordenar información
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Para registrar fechas, montos, proveedores, ítems u otros datos importantes.
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Archivos e información en un mismo lugar
                        </p>
                      </div>
                      <div
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
                          folderMode === "data"
                            ? "border-orange-500"
                            : "border-stone-300"
                        }`}
                      >
                        {folderMode === "data" ? (
                          <div className="size-2 rounded-full bg-orange-500" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                        Carpeta padre
                      </Label>
                      <Select
                        value={newFolderParentPath || "__root__"}
                        onValueChange={(value) =>
                          setNewFolderParentPath(
                            value === "__root__" ? "" : value,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar carpeta..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__root__">Raiz</SelectItem>
                          {parentFolderOptions.map((folder) => (
                            <SelectItem key={folder.id} value={folder.path}>
                              {folder.name} (/{folder.path})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                        Nombre de carpeta{" "}
                        <span className="text-orange-500">*</span>
                      </Label>
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder={
                          folderMode === "data" ? "Certificados" : "Contratos"
                        }
                        data-testid="folder-name-input"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/40 px-5 py-4">
                    <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                      Ruta final
                    </p>
                    <p className="mt-2 font-mono text-lg">
                      {folderPathPreview}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {folderMode === "data" && folderEditorStep === 1 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-stroke-soft bg-surface p-5 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Table2 className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Ya podés empezar</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Subí un documento de ejemplo y armamos la configuración,
                        o cargala a mano más abajo.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <SampleAnalysisCard onApply={applyImportedJsonText} />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-lg bg-surface-recessed p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">¿Trabajás con certificados?</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Usá un modelo con el resumen y los ítems más comunes.
                      </p>
                    </div>
                    <LightButton
                      type="button"
                      variant="secondary"
                      size="lg"
                      className="shrink-0"
                      data-testid="folder-recipe-certificados"
                      onClick={handleApplyFolderRecipe}
                    >
                      Usar modelo
                    </LightButton>
                  </div>

                  <div className="mt-4 border-t border-stroke-soft pt-4">
                    <LightButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDefinitionImportOpen((prev) => !prev)}
                      aria-expanded={isDefinitionImportOpen}
                    >
                      <ClipboardPaste className="mr-2 size-4" />
                      {isDefinitionImportOpen
                        ? "Ocultar importación"
                        : "Importar una configuración existente"}
                      {isDefinitionImportOpen ? (
                        <ChevronUp className="ml-2 size-4" />
                      ) : (
                        <ChevronDown className="ml-2 size-4" />
                      )}
                    </LightButton>

                    {isDefinitionImportOpen ? (
                      <div className="mt-3 space-y-3 rounded-lg bg-surface-recessed p-4">
                        <p className="text-sm text-muted-foreground">
                          Pegá una configuración copiada de otra carpeta.
                        </p>
                        <Textarea
                          value={definitionImportText}
                          onChange={(event) =>
                            setDefinitionImportText(event.target.value)
                          }
                          placeholder="Pegá la configuración acá"
                          className="min-h-[120px] font-mono text-xs"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <LightButton
                            type="button"
                            variant="secondary"
                            size="lg"
                            onClick={() => void handlePasteDefinitionFromClipboard()}
                          >
                            <ClipboardPaste className="mr-2 size-4" />
                            Pegar desde el portapapeles
                          </LightButton>
                          <LightButton
                            type="button"
                            variant="primary"
                            size="lg"
                            onClick={handleImportDefinitionJson}
                          >
                            Importar configuración
                          </LightButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                      Información que se guardará
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Si necesitás un resumen y una lista de detalles, agregalos por separado.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {newFolderExtractedTables.map((table, index) => {
                        const isActive = table.id === activeExtractedTable?.id;
                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => handleSelectExtractedTable(table.id)}
                            data-testid={`extracted-table-tab-${index}`}
                            className={`rounded-full border px-4 py-1.5 text-sm transition ${
                              isActive
                                ? "border-orange-500 text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {table.name || `Grupo ${index + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleAddExtractedTable}
                    className="px-0 text-orange-500"
                    data-testid="add-extracted-table"
                  >
                    + Agregar otro grupo
                  </Button>
                </div>

                {activeExtractedTable ? (
                  <div className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="space-y-2">
                        <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                          ¿Cómo querés llamar a esta información?
                        </Label>
                        <Input
                          value={activeExtractedTable.name}
                          onChange={(e) =>
                            handleExtractedTableMetaChange(
                              activeExtractedTable.id,
                              "name",
                              e.target.value,
                            )
                          }
                          data-testid="active-dataset-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                          ¿Qué vas a guardar?
                        </Label>
                        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border">
                          <button
                            type="button"
                            onClick={() =>
                              handleExtractedTableMetaChange(
                                activeExtractedTable.id,
                                "rowMode",
                                "single",
                              )
                            }
                            data-testid="dataset-rowmode-single"
                            className={`px-4 py-3 text-sm font-medium ${activeExtractedTable.rowMode === "single" ? "bg-stone-900 text-white" : "bg-background"}`}
                          >
                            Un resumen
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleExtractedTableMetaChange(
                                activeExtractedTable.id,
                                "rowMode",
                                "multiple",
                              )
                            }
                            data-testid="dataset-rowmode-multiple"
                            className={`px-4 py-3 text-sm font-medium ${activeExtractedTable.rowMode === "multiple" ? "bg-stone-900 text-white" : "bg-background"}`}
                          >
                            Una lista
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                      {activeExtractedTable.rowMode === "single"
                        ? "Ejemplo: número, fecha y monto total de cada certificado."
                        : "Ejemplo: todos los ítems, materiales o tareas que aparecen en cada documento."}
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                        ¿De dónde sale esta información?
                      </p>

                      <div
                        className={`rounded-3xl border ${newFolderAcceptsPdfImage ? "border-orange-500" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-orange-50 text-orange-500">
                              <FileText className="size-4" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold">
                                  Leer documentos automáticamente
                                </p>
                                {ocrTemplates.length === 0 ? (
                                  <Badge variant="secondary">No disponible</Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Subí un PDF o una foto y el sistema completa la información.
                              </p>
                              {ocrTemplates.length === 0 ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Primero hay que preparar la lectura para esta organización.
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Switch
                            checked={newFolderAcceptsPdfImage}
                            disabled={ocrTemplates.length === 0}
                            aria-label="Leer documentos automáticamente"
                            onCheckedChange={(checked) => {
                              setNewFolderAcceptsPdfImage(checked);
                              if (
                                checked &&
                                !newFolderOcrTemplateId &&
                                ocrTemplates.length === 1
                              ) {
                                handleTemplateSelect(ocrTemplates[0].id);
                              }
                              if (!checked) {
                                setNewFolderOcrTemplateId("");
                                setNewFolderHasNested(false);
                                setIsDocumentReadingAdvancedOpen(false);
                              }
                            }}
                          />
                        </div>

                        {newFolderAcceptsPdfImage ? (
                          <div className="space-y-4 border-t px-5 py-4">
                            {ocrTemplates.length > 1 ? (
                              <div className="space-y-2">
                                <Label>¿Qué tipo de documento vas a subir?</Label>
                                <Select
                                  value={newFolderOcrTemplateId || undefined}
                                  onValueChange={handleTemplateSelect}
                                >
                                  <SelectTrigger data-testid="ocr-template-select">
                                    <SelectValue placeholder="Elegí el tipo de documento" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ocrTemplates.map((template) => (
                                      <SelectItem key={template.id} value={template.id}>
                                        {template.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : null}

                            <LightButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setIsDocumentReadingAdvancedOpen((current) => !current)
                              }
                              aria-expanded={isDocumentReadingAdvancedOpen}
                            >
                              {isDocumentReadingAdvancedOpen
                                ? "Ocultar opciones adicionales"
                                : "Agregar indicaciones para la lectura"}
                              {isDocumentReadingAdvancedOpen ? (
                                <ChevronUp className="ml-2 size-4" />
                              ) : (
                                <ChevronDown className="ml-2 size-4" />
                              )}
                            </LightButton>

                            {isDocumentReadingAdvancedOpen ? (
                              <div className="space-y-4 rounded-lg bg-surface-recessed p-4">
                                <div className="space-y-2">
                                  <Label>¿Qué documentos esperás recibir?</Label>
                                  <Textarea
                                    value={newFolderDocumentTypesText}
                                    onChange={(e) =>
                                      setNewFolderDocumentTypesText(e.target.value)
                                    }
                                    placeholder="Ejemplo: certificado mensual, hoja de medición"
                                    className="min-h-[60px] resize-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Indicaciones especiales</Label>
                                  <Textarea
                                    value={newFolderExtractionInstructions}
                                    onChange={(e) =>
                                      setNewFolderExtractionInstructions(e.target.value)
                                    }
                                    placeholder="Ejemplo: ignorar el pie de página o usar el monto final"
                                    className="min-h-[72px] resize-none"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-4 rounded-lg bg-surface px-4 py-3">
                                  <div>
                                    <p className="text-sm font-medium">
                                      El documento incluye una lista de detalles
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Por ejemplo, ítems de una factura o tareas de un certificado.
                                    </p>
                                  </div>
                                  <Switch
                                    checked={newFolderHasNested}
                                    onCheckedChange={setNewFolderHasNested}
                                    disabled={Boolean(newFolderOcrTemplateId)}
                                    aria-label="El documento incluye una lista de detalles"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div
                        className={`rounded-3xl border ${newFolderAcceptsSpreadsheet ? "border-orange-500" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Table2 className="size-4" />
                            </div>
                            <div>
                              <p className="text-base font-semibold">
                                Usar una planilla
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Subí un archivo de Excel o CSV y copiamos sus datos.
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={newFolderAcceptsSpreadsheet}
                            aria-label="Usar una planilla"
                            onCheckedChange={(checked) => {
                              setNewFolderAcceptsSpreadsheet(checked);
                              if (checked) {
                                handleSpreadsheetTemplateSelect(
                                  newFolderSpreadsheetTemplate || "auto",
                                );
                              } else {
                                setNewFolderSpreadsheetTemplate("");
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div
                        className={`rounded-3xl border ${newFolderAllowsManualEntry ? "border-orange-500" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Pencil className="size-4" />
                            </div>
                            <div>
                              <p className="text-base font-semibold">
                                Completar a mano
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Una persona escribe o corrige la información directamente.
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={newFolderAllowsManualEntry}
                            onCheckedChange={setNewFolderAllowsManualEntry}
                            aria-label="Completar a mano"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                ) : null}
              </div>
            )}

            {folderMode === "data" && folderEditorStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                      Datos que querés guardar
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleAddColumn}
                      className="px-0 text-orange-500"
                    >
                      + Agregar dato
                    </Button>
                  </div>

                  {newFolderColumns.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                      Agregá al menos un dato, por ejemplo fecha, monto o proveedor.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_140px_110px_auto] gap-3 px-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <span>Nombre</span>
                        <span>Formato</span>
                        <span>Obligatorio</span>
                        <span />
                      </div>
                      {newFolderColumns.map((col) => (
                        <div key={col.id} className="rounded-2xl border p-3">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_110px_auto]">
                            <Input
                              value={col.label}
                              onChange={(e) =>
                                handleColumnChange(
                                  col.id,
                                  "label",
                                  e.target.value,
                                )
                              }
                              placeholder="Ejemplo: monto total"
                            />
                            <Select
                              value={col.dataType}
                              onValueChange={(value) =>
                                handleColumnChange(col.id, "dataType", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DATA_TYPE_OPTIONS.map((type) => (
                                  <SelectItem
                                    key={type.value}
                                    value={type.value}
                                  >
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center">
                              <Switch
                                checked={col.required}
                                aria-label={`Marcar ${col.label || "dato"} como obligatorio`}
                                onCheckedChange={(checked) =>
                                  handleColumnChange(
                                    col.id,
                                    "required",
                                    checked,
                                  )
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveColumn(col.id)}
                              className="text-destructive hover:text-destructive"
                              aria-label={`Eliminar ${col.label || "dato"}`}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Después de guardar vas a poder ajustar estos datos cuando lo necesites.
                </p>
              </div>
            )}

            {isFolderReviewStep && (
              <div className="space-y-5">
                <div className="rounded-lg border border-stroke-soft bg-surface p-5 text-left shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Folder className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{newFolderName}</p>
                      <p className="text-sm text-muted-foreground">
                        Se creará en {folderPathPreview}
                      </p>
                    </div>
                  </div>

                  {folderMode === "data" ? (
                    <div className="mt-5 border-t border-stroke-soft pt-5">
                      <h4 className="font-semibold">Información que vas a guardar</h4>
                      <div className="mt-3 space-y-3">
                        {newFolderExtractedTables.map((table) => {
                          const sources = [
                            canRunLlmExtraction(table)
                              ? "Lectura de documentos"
                              : null,
                            canRunSpreadsheetExtraction(table)
                              ? "Planilla"
                              : null,
                            canRunManualEntry(table) ? "Carga manual" : null,
                          ].filter(Boolean) as string[];

                          return (
                            <div
                              key={table.id}
                              className="rounded-lg bg-surface-recessed p-4"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-medium">{table.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {table.rowMode === "single"
                                      ? "Un resumen por archivo"
                                      : "Una lista de detalles"}
                                    {` · ${table.columns.length} datos`}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {sources.map((source) => (
                                    <Badge key={`${table.id}-${source}`} variant="secondary">
                                      {source}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-5 border-t border-stroke-soft pt-5 text-sm text-muted-foreground">
                      Esta carpeta se usará solamente para guardar archivos.
                    </p>
                  )}
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Esto se aplicará a las obras nuevas y podrás cambiarlo más adelante.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t pt-5">
              {!canAdvanceFolderStep && !isFolderReviewStep && (
                <p className="text-center text-xs text-muted-foreground">
                  {folderEditorStep === 0 && !isFolderBaseReady
                    ? "Escribí un nombre de carpeta para continuar."
                    : folderMode === "data" &&
                        folderEditorStep === 1 &&
                        !isFolderCaptureReady
                      ? "Elegí al menos una forma de completar la información."
                      : folderMode === "data" &&
                          folderEditorStep === 2 &&
                          !isFolderColumnsReady
                        ? "Agregá al menos un dato antes de continuar."
                        : ""}
                </p>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1">
                  {folderEditorStep > 0 ? (
                    <LightButton
                      type="button"
                      variant="ghost"
                      size="lg"
                      onClick={() => goToFolderEditorStep(folderEditorStep - 1)}
                    >
                      ← Volver
                    </LightButton>
                  ) : null}
                  <LightButton
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="text-muted-foreground"
                    onClick={() => {
                      setIsAddFolderOpen(false);
                      resetFolderForm();
                    }}
                  >
                    Cancelar
                  </LightButton>
                </div>
                {!isFolderReviewStep ? (
                  <LightButton
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => goToFolderEditorStep(folderEditorStep + 1)}
                    disabled={!canAdvanceFolderStep}
                    data-testid="folder-wizard-continue"
                  >
                    Continuar
                  </LightButton>
                ) : (
                  <LightButton
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => void handleSaveFolder()}
                    disabled={isSubmittingFolder || isCreateFolderDisabled}
                    data-testid="folder-wizard-save"
                  >
                    {isSubmittingFolder ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    {editingFolderId
                      ? "Guardar cambios"
                      : "Crear carpeta"}
                  </LightButton>
                )}
              </div>
            </div>
          </div>

          <div className="hidden">
            <div className="space-y-4 py-4">
              {/* Explanation */}
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Carpeta normal:</strong> Solo organiza archivos.{" "}
                  <br />
                  <strong>Carpeta de datos:</strong> Tiene una tabla asociada
                  donde podés cargar datos manualmente o extraerlos de
                  documentos. La tabla queda disponible para usar en Macro
                  Tablas.
                </p>
              </div>

              {/* Folder Type Toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={folderMode === "normal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFolderMode("normal")}
                  className="flex-1"
                  disabled={Boolean(editingFolderId)}
                >
                  <Folder className="size-4 mr-2" />
                  Carpeta normal
                </Button>
                <Button
                  type="button"
                  variant={folderMode === "data" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFolderMode("data")}
                  className="flex-1"
                  disabled={Boolean(editingFolderId)}
                >
                  <Table2 className="size-4 mr-2" />
                  Carpeta de datos
                </Button>
              </div>

              {/* Folder Name */}
              <div className="space-y-2">
                <Label>Carpeta padre (opcional)</Label>
                <Select
                  value={newFolderParentPath || "__root__"}
                  onValueChange={(value) =>
                    setNewFolderParentPath(value === "__root__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Raíz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">Raíz</SelectItem>
                    {parentFolderOptions.map((folder) => (
                      <SelectItem key={folder.id} value={folder.path}>
                        {folder.name} (/{folder.path})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Folder Name */}
              <div className="space-y-2">
                <Label>Nombre de la carpeta</Label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={
                    folderMode === "data"
                      ? "Ej. Órdenes de Compra"
                      : "Ej. Documentos"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ruta final: /
                  {newFolderParentPath ? `${newFolderParentPath}/` : ""}
                  {normalizeFolderName(newFolderName || "carpeta")}
                </p>
              </div>

              {/* Data Folder Specific Fields */}
              {folderMode === "data" && (
                <>
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label>Importar definicion JSON</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pega el resultado del LLM y precargamos documentos
                          esperados, instrucciones y columnas.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setIsDefinitionImportOpen((prev) => !prev)
                        }
                      >
                        {isDefinitionImportOpen ? "Ocultar" : "Pegar JSON"}
                      </Button>
                    </div>

                    {isDefinitionImportOpen && (
                      <div className="space-y-3">
                        <Textarea
                          value={definitionImportText}
                          onChange={(e) =>
                            setDefinitionImportText(e.target.value)
                          }
                          placeholder="Pegá acá el JSON completo de la definición de extracción"
                          className="min-h-[220px] font-mono text-xs"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Si hay secciones tabulares, se activan como datos
                            anidados.
                          </p>
                          <Button
                            type="button"
                            onClick={handleImportDefinitionJson}
                            className="bg-amber-500 hover:bg-amber-600"
                          >
                            <Sparkles className="size-4 mr-2" />
                            Importar definicion
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Tablas extraidas dentro de esta carpeta</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cada tabla puede tener su propia cantidad de filas,
                          tipos de documento y origen de extraccion.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddExtractedTable}
                      >
                        <Plus className="size-4 mr-1" />
                        Agregar tabla
                      </Button>
                    </div>

                    <Accordion
                      type="single"
                      collapsible
                      value={activeExtractedTableId ?? undefined}
                      onValueChange={(value) => {
                        if (value) {
                          handleSelectExtractedTable(value);
                        }
                      }}
                      className="w-full"
                    >
                      {newFolderExtractedTables.map((table, index) => (
                        <AccordionItem
                          key={table.id}
                          value={table.id}
                          className="rounded-lg border bg-background px-3"
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex w-full items-center justify-between gap-3 pr-3 text-left">
                              <div>
                                <p className="text-sm font-medium">
                                  {table.name || `Tabla ${index + 1}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {table.rowMode === "single"
                                    ? "Extrae 1 fila"
                                    : `Extrae ${getEffectiveTableMaxRows(table) ?? "N"} filas`}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {table.ocrTemplateId && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    PDF / imagen
                                  </Badge>
                                )}
                                {table.spreadsheetTemplate && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    Excel / CSV
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pb-3">
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_120px_auto]">
                              <Input
                                value={table.name}
                                onChange={(e) =>
                                  handleExtractedTableMetaChange(
                                    table.id,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                placeholder="Ej. Certificados resumen"
                              />
                              <Select
                                value={table.rowMode}
                                onValueChange={(value) =>
                                  handleExtractedTableMetaChange(
                                    table.id,
                                    "rowMode",
                                    value,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">1 fila</SelectItem>
                                  <SelectItem value="multiple">
                                    Multiples filas
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={1}
                                value={
                                  table.rowMode === "single"
                                    ? "1"
                                    : String(table.maxRows ?? "")
                                }
                                disabled={table.rowMode === "single"}
                                onChange={(e) =>
                                  handleExtractedTableMetaChange(
                                    table.id,
                                    "maxRows",
                                    e.target.value,
                                  )
                                }
                                placeholder="N"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleRemoveExtractedTable(table.id)
                                }
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-lg border p-3">
                                <p className="text-sm font-medium">
                                  PDF e imagen
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {table.ocrTemplateName ??
                                    "Usa una plantilla OCR para este tipo de documento"}
                                </p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-sm font-medium">
                                  Excel y CSV
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {table.spreadsheetTemplate
                                    ? `Usa la extraccion ${table.spreadsheetTemplate}`
                                    : "Sin extractor de planillas configurado"}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Selecciona esta tabla para editar sus columnas,
                              documentos esperados y templates en los bloques
                              siguientes.
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>

                  {/* Data Input Method */}
                  <div className="space-y-3">
                    <Label>Método de carga de datos</Label>
                    <RadioGroup
                      value={newFolderDataInputMethod}
                      onValueChange={(value) =>
                        setNewFolderDataInputMethod(value as DataInputMethod)
                      }
                      className="grid grid-cols-3 gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ocr" id="defaults-method-ocr" />
                        <Label
                          htmlFor="defaults-method-ocr"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Solo OCR
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="manual"
                          id="defaults-method-manual"
                        />
                        <Label
                          htmlFor="defaults-method-manual"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Solo manual
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="both"
                          id="defaults-method-both"
                        />
                        <Label
                          htmlFor="defaults-method-both"
                          className="text-sm font-normal cursor-pointer"
                        >
                          Ambos
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      {newFolderDataInputMethod === "ocr" &&
                        "Los datos se extraerán automáticamente de documentos subidos."}
                      {newFolderDataInputMethod === "manual" &&
                        "Los datos se ingresarán manualmente en la tabla."}
                      {newFolderDataInputMethod === "both" &&
                        "Podés cargar datos manualmente o extraerlos de documentos."}
                    </p>
                  </div>

                  {/* Spreadsheet Template Selection - when manual input is allowed */}
                  {newFolderDataInputMethod !== "ocr" && (
                    <div className="space-y-2">
                      <Label>Plantilla de extracción XLSX/CSV</Label>
                      <Select
                        value={newFolderSpreadsheetTemplate || undefined}
                        onValueChange={(value) =>
                          setNewFolderSpreadsheetTemplate(
                            value as "auto" | "certificado",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar plantilla XLSX..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            Auto (detectar por columnas)
                          </SelectItem>
                          <SelectItem value="certificado">
                            Certificado (certexampleplayground)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Template Selection - Only when OCR is needed */}
                  {(newFolderDataInputMethod === "ocr" ||
                    newFolderDataInputMethod === "both") && (
                    <div className="space-y-2">
                      <Label>Plantilla de extracción</Label>
                      {ocrTemplates.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
                          No hay plantillas disponibles. Creá una primero.
                        </div>
                      ) : (
                        <Select
                          value={newFolderOcrTemplateId || undefined}
                          onValueChange={handleTemplateSelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar plantilla..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ocrTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                <span className="flex items-center gap-2">
                                  <ScanLine className="size-4 text-purple-500" />
                                  {template.name} ({template.columns.length}{" "}
                                  campos)
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div>
                      <Label htmlFor="document-types">
                        Tipos de documento esperados
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Separados por coma. Ejemplo: certificado mensual,
                        certificado desacopio, curva de avance.
                      </p>
                    </div>
                    <Textarea
                      id="document-types"
                      value={newFolderDocumentTypesText}
                      onChange={(e) =>
                        setNewFolderDocumentTypesText(e.target.value)
                      }
                      placeholder="certificado mensual, certificado desacopio, curva de avance"
                      className="min-h-[72px]"
                    />
                    <div>
                      <Label htmlFor="extraction-instructions">
                        Instrucciones de extraccion
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Explicale al sistema como interpretar estos documentos,
                        que significan los campos y que debe ignorar.
                      </p>
                    </div>
                    <Textarea
                      id="extraction-instructions"
                      value={newFolderExtractionInstructions}
                      onChange={(e) =>
                        setNewFolderExtractionInstructions(e.target.value)
                      }
                      placeholder="Estos documentos pueden venir con encabezados distintos. El expediente puede aparecer como Expte., Nro. Expte o EX-2025..."
                      className="min-h-[96px]"
                    />
                  </div>

                  {/* Nested Data Toggle - Only when OCR is needed */}
                  {(newFolderDataInputMethod === "ocr" ||
                    newFolderDataInputMethod === "both") && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">Datos anidados</p>
                        <p className="text-xs text-muted-foreground">
                          El documento tiene datos a nivel documento e items
                        </p>
                      </div>
                      <Switch
                        checked={newFolderHasNested}
                        onCheckedChange={setNewFolderHasNested}
                        disabled={Boolean(newFolderOcrTemplateId)}
                      />
                    </div>
                  )}

                  {/* Columns - Show for all data input methods */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Columnas de la tabla</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddColumn}
                      >
                        <Plus className="size-4 mr-1" />
                        Agregar
                      </Button>
                    </div>

                    {newFolderColumns.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed text-center">
                        No hay columnas definidas. Agregá al menos una columna.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {newFolderColumns.map((col) => (
                          <div
                            key={col.id}
                            className="space-y-2 rounded-lg border bg-background p-2"
                          >
                            <div className="flex items-center gap-2">
                              <Input
                                value={col.label}
                                onChange={(e) =>
                                  handleColumnChange(
                                    col.id,
                                    "label",
                                    e.target.value,
                                  )
                                }
                                placeholder="Nombre columna"
                                className="flex-1 h-8 text-sm"
                              />
                              <Select
                                value={col.dataType}
                                onValueChange={(value) =>
                                  handleColumnChange(col.id, "dataType", value)
                                }
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DATA_TYPE_OPTIONS.map((type) => (
                                    <SelectItem
                                      key={type.value}
                                      value={type.value}
                                    >
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={col.required}
                                  onChange={(e) =>
                                    handleColumnChange(
                                      col.id,
                                      "required",
                                      e.target.checked,
                                    )
                                  }
                                  className="rounded border-stone-300"
                                />
                                Req.
                              </label>
                              {newFolderHasNested &&
                                (newFolderDataInputMethod === "ocr" ||
                                  newFolderDataInputMethod === "both") && (
                                  <Select
                                    value={col.scope}
                                    onValueChange={(value) =>
                                      handleColumnChange(col.id, "scope", value)
                                    }
                                  >
                                    <SelectTrigger className="w-24 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="parent">
                                        Doc
                                      </SelectItem>
                                      <SelectItem value="item">Item</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveColumn(col.id)}
                                className="size-8 text-destructive hover:text-destructive"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                            <Textarea
                              value={col.description ?? ""}
                              onChange={(e) =>
                                handleColumnChange(
                                  col.id,
                                  "description",
                                  e.target.value,
                                )
                              }
                              placeholder="Que significa este campo y como deberia interpretarse"
                              className="min-h-[64px]"
                            />
                            <div className="grid gap-2 md:grid-cols-3">
                              <Input
                                value={joinCommaSeparatedList(col.aliases)}
                                onChange={(e) =>
                                  handleColumnListChange(
                                    col.id,
                                    "aliases",
                                    e.target.value,
                                  )
                                }
                                placeholder="Aliases / nombres alternativos"
                                className="h-8 text-sm"
                              />
                              <Input
                                value={joinCommaSeparatedList(col.examples)}
                                onChange={(e) =>
                                  handleColumnListChange(
                                    col.id,
                                    "examples",
                                    e.target.value,
                                  )
                                }
                                placeholder="Ejemplos de valores"
                                className="h-8 text-sm"
                              />
                              <Input
                                value={joinCommaSeparatedList(
                                  col.excelKeywords,
                                )}
                                onChange={(e) =>
                                  handleColumnListChange(
                                    col.id,
                                    "excelKeywords",
                                    e.target.value,
                                  )
                                }
                                placeholder="Encabezados / keywords Excel"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddFolderOpen(false);
                  resetFolderForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSaveFolder()}
                disabled={isSubmittingFolder || isCreateFolderDisabled}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isSubmittingFolder ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : folderMode === "data" ? (
                  <Table2 className="size-4 mr-2" />
                ) : (
                  <FolderPlus className="size-4 mr-2" />
                )}
                {editingFolderId
                  ? "Guardar cambios"
                  : folderMode === "data"
                    ? "Crear carpeta de datos"
                    : "Crear carpeta"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteBlockedFolder !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteBlockedFolder(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Esta carpeta no se puede eliminar todavía
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <span className="block">
                <strong className="text-content">
                  {deleteBlockedFolder?.name}
                </strong>{" "}
                puede estar vinculada a tablas, documentos y datos de obras
                existentes.
              </span>
              <span className="block rounded-md border border-warning/35 bg-warning/15 p-3 text-warning-foreground">
                Para proteger la información, la eliminación quedará disponible
                cuando incluya una vista previa del impacto y una confirmación
                auditable. No se realizó ningún cambio.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteBlockedFolder(null)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OCR Template Configurator */}
      <OcrTemplateConfigurator
        open={isOcrConfigOpen}
        onOpenChange={(open) => {
          setIsOcrConfigOpen(open);
          if (!open) {
            setEditingOcrTemplate(null);
          }
        }}
        onTemplateSaved={handleTemplateSaved}
        existingTemplate={editingOcrTemplate}
      />
    </div>
  );
}
