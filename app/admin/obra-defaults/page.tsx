"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";

import { OcrTemplateConfigurator } from "./_components/OcrTemplateConfigurator";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

import { ensureTablaDataType, normalizeFieldKey, normalizeFolderName } from "@/lib/tablas";

type DataInputMethod = 'ocr' | 'manual' | 'both';
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

type OcrTemplate = {
  id: string;
  name: string;
  description: string | null;
  template_file_name: string | null;
  regions: Array<{
    id: string;
    label: string;
    type: "single" | "table";
    tableColumns?: string[];
  }>;
  columns: Array<{ fieldKey: string; label: string; dataType: string; ocrScope?: string; description?: string }>;
  is_active: boolean;
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
  document_variants?: Array<{ name?: string; description?: string; identifying_clues?: string[] }>;
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

const CERTIFICADO_XLSX_DEFAULT_COLUMNS: Array<{
  label: string;
  fieldKey: string;
  dataType: string;
}> = [
    { label: "Período", fieldKey: "periodo", dataType: "text" },
    { label: "N° Certificado", fieldKey: "nro_certificado", dataType: "text" },
    { label: "Fecha Certificación", fieldKey: "fecha_certificacion", dataType: "text" },
    { label: "Monto Certificado", fieldKey: "monto_certificado", dataType: "currency" },
    { label: "Avance Físico Acum. %", fieldKey: "avance_fisico_acumulado_pct", dataType: "number" },
    { label: "Monto Acumulado", fieldKey: "monto_acumulado", dataType: "currency" },
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

function createEmptyExtractedTable(name = "Nueva tabla extraida"): ExtractedTableConfig {
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

function getAcceptedInputLabels(params: {
  acceptsPdfImage: boolean;
  acceptsSpreadsheet: boolean;
  allowsManualEntry: boolean;
}) {
  const labels: string[] = [];
  if (params.acceptsPdfImage) labels.push("PDF / image");
  if (params.acceptsSpreadsheet) labels.push("XLSX / CSV");
  if (params.allowsManualEntry) labels.push("Carga manual");
  return labels;
}

function getEffectiveTableMaxRows(table: Pick<ExtractedTableConfig, "rowMode" | "maxRows">) {
  return table.rowMode === "single" ? 1 : sanitizeMaxRows(table.maxRows);
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
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
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

function importDefinitionToFolderConfig(
  rawJson: string,
): {
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
    typeof definition.document_family === "string" && definition.document_family.trim().length > 0
      ? definition.document_family.trim()
      : "Extracción importada";

  const fields = Array.isArray(definition.fields)
    ? definition.fields.filter((field): field is ImportedDefinitionField => isRecord(field))
    : [];
  const tableSections = Array.isArray(definition.table_sections)
    ? definition.table_sections.filter((section): section is ImportedDefinitionTableSection => isRecord(section))
    : [];

  if (fields.length === 0 && tableSections.length === 0) {
    throw new Error("La definición no trae campos ni secciones de tabla importables");
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
        : typeof field.field_key === "string" && field.field_key.trim().length > 0
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
        typeof field.business_meaning === "string" ? field.business_meaning : "",
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
      const sectionColumns = Array.isArray(section.columns) ? section.columns : [];
      return sectionColumns
        .filter((column): column is ImportedDefinitionTableColumn => isRecord(column))
        .map((column) => {
          const label =
            typeof column.label === "string" && column.label.trim().length > 0
              ? column.label.trim()
              : typeof column.field_key === "string" && column.field_key.trim().length > 0
                ? column.field_key.trim()
                : "Campo item";
          const fieldKey =
            typeof column.field_key === "string" && column.field_key.trim().length > 0
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
              typeof column.business_meaning === "string" ? column.business_meaning : "",
              readStringArray(column.extraction_hints),
              [],
              typeof section.description === "string" ? section.description : undefined,
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
      .map((variant) => (typeof variant.name === "string" ? variant.name.trim() : ""))
      .filter(Boolean)
    : [];

  const documentTypes = uniqueStrings([documentFamily, ...variantNames]);

  const instructionsBlocks: string[] = [];
  if (typeof definition.document_summary === "string" && definition.document_summary.trim()) {
    instructionsBlocks.push(`Resumen del documento:\n${definition.document_summary.trim()}`);
  }

  const titleAliases = readStringArray(definition.document_level_clues?.title_aliases);
  const headerKeywords = readStringArray(definition.document_level_clues?.header_keywords);
  const footerIgnore = readStringArray(definition.document_level_clues?.footer_keywords_to_ignore);

  if (titleAliases.length > 0 || headerKeywords.length > 0 || footerIgnore.length > 0) {
    const clueLines: string[] = [];
    if (titleAliases.length > 0) clueLines.push(`Títulos posibles: ${titleAliases.join(", ")}`);
    if (headerKeywords.length > 0) clueLines.push(`Keywords de encabezado: ${headerKeywords.join(", ")}`);
    if (footerIgnore.length > 0) clueLines.push(`Ignorar pie / ruido: ${footerIgnore.join(", ")}`);
    instructionsBlocks.push(clueLines.join("\n"));
  }

  const globalInstructions = readStringArray(definition.global_extraction_instructions);
  if (globalInstructions.length > 0) {
    instructionsBlocks.push(`Instrucciones globales:\n- ${globalInstructions.join("\n- ")}`);
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
          typeof section.description === "string" && section.description.trim().length > 0
            ? `: ${section.description.trim()}`
            : "";
        return `- ${label}${description}`;
      })
      .join("\n");
    if (sectionsSummary) {
      instructionsBlocks.push(`Secciones tabulares detectadas:\n${sectionsSummary}`);
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

function mapFolderToExtractedTables(folder: DefaultFolder): ExtractedTableConfig[] {
  if (Array.isArray(folder.extractedTables) && folder.extractedTables.length > 0) {
    return folder.extractedTables.map((table, index) => ({
      ...table,
      id: table.id || `${folder.id}::${index}`,
      name: table.name?.trim() || (index === 0 ? folder.name : `Tabla ${index + 1}`),
      rowMode: table.rowMode === "multiple" ? "multiple" : "single",
      maxRows:
        table.rowMode === "multiple"
          ? sanitizeMaxRows(table.maxRows)
          : 1,
      dataInputMethod: table.dataInputMethod ?? folder.dataInputMethod ?? "both",
      spreadsheetTemplate: table.spreadsheetTemplate ?? folder.spreadsheetTemplate ?? null,
      ocrTemplateId: table.ocrTemplateId ?? folder.ocrTemplateId ?? null,
      ocrTemplateName: table.ocrTemplateName ?? folder.ocrTemplateName ?? null,
      manualEntryEnabled:
        typeof table.manualEntryEnabled === "boolean"
          ? table.manualEntryEnabled
          : typeof folder.manualEntryEnabled === "boolean"
            ? folder.manualEntryEnabled
            : (table.dataInputMethod ?? folder.dataInputMethod ?? "both") !== "ocr",
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

// Get icon for data type
function getDataTypeIcon(dataType: string) {
  switch (dataType) {
    case "number":
      return <Hash className="h-3 w-3" />;
    case "currency":
      return <DollarSign className="h-3 w-3" />;
    case "date":
      return <Calendar className="h-3 w-3" />;
    case "boolean":
      return <ToggleLeft className="h-3 w-3" />;
    default:
      return <Type className="h-3 w-3" />;
  }
}

// Folder Row Component
function FolderRow({
  folder,
  onDelete,
  onEdit,
  index,
}: {
  folder: DefaultFolder;
  onDelete: () => void;
  onEdit: () => void;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isOcr = folder.isOcr;
  const hasColumns = folder.columns && folder.columns.length > 0;
  const extractedTables = mapFolderToExtractedTables(folder);

  const parentColumns = folder.columns?.filter(c => c.ocrScope === "parent") ?? [];
  const itemColumns = folder.columns?.filter(c => c.ocrScope !== "parent") ?? [];

  if (!isOcr) {
    // Simple folder row
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ delay: index * 0.03 }}
        className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Folder className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{folder.name}</p>
          <p className="text-xs text-muted-foreground font-mono">/{folder.path}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  // OCR folder with expandable details
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.03 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-lg border bg-card overflow-hidden border-amber-200 dark:border-amber-800">
          <CollapsibleTrigger asChild>
            <div className="group flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Table2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t p-4 space-y-4 bg-muted/30">
              {folder.ocrTemplateName && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Plantilla de extracción</p>
                  <div className="flex items-center gap-2 text-sm">
                    <ScanLine className="h-4 w-4 text-purple-500" />
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
                  <p className="text-xs font-medium text-muted-foreground mb-2">Documentos esperados</p>
                  <div className="flex flex-wrap gap-2">
                    {folder.documentTypes.map((type) => (
                      <Badge key={`${folder.id}-${type}`} variant="secondary" className="text-[10px]">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {extractedTables.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tablas a extraer</p>
                  <div className="space-y-2">
                    {extractedTables.map((table) => {
                      const sourceBadges = [
                        table.ocrTemplateId ? `PDF / imagen: ${table.ocrTemplateName ?? "OCR configurado"}` : null,
                        table.spreadsheetTemplate ? `Excel / CSV: ${table.spreadsheetTemplate}` : null,
                      ].filter(Boolean);
                      return (
                        <div key={table.id} className="rounded-lg border bg-background p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{table.name}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {table.rowMode === "single"
                                ? "1 fila"
                                : `${getEffectiveTableMaxRows(table) ?? "N"} filas`}
                            </Badge>
                          </div>
                          {table.documentTypes && table.documentTypes.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Documentos: {table.documentTypes.join(", ")}
                            </p>
                          )}
                          {sourceBadges.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {sourceBadges.map((badge) => (
                                <Badge key={`${table.id}-${badge}`} variant="secondary" className="text-[10px]">
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
                  <p className="text-xs font-medium text-muted-foreground mb-1">GuÃ­a de extracciÃ³n</p>
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
                  <p className="text-xs font-medium text-muted-foreground mb-2">Campos de datos</p>

                  {parentColumns.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Nivel documento</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {parentColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 p-2 rounded bg-background border text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">
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
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Nivel item</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {itemColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 p-2 rounded bg-background border text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">
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
    </motion.div>
  );
}

// OCR Template Card Component with expandable details
function OcrTemplateCard({
  template,
  onDelete,
  index,
}: {
  template: OcrTemplate;
  onDelete: () => void;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const tableRegions = template.regions.filter(r => r.type === "table");
  const parentColumns = template.columns.filter(c => c.ocrScope === "parent");
  const itemColumns = template.columns.filter(c => c.ocrScope !== "parent");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.03 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-lg border bg-card overflow-hidden">
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <ScanLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{template.name}</p>
                  {!template.is_active && (
                    <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {template.columns.length} campos · {template.regions.length} regiones
                  {tableRegions.length > 0 && ` · ${tableRegions.length} tablas`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t p-4 space-y-4 bg-muted/30">
              {template.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm">{template.description}</p>
                </div>
              )}

              {template.template_file_name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Archivo de plantilla</p>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs">{template.template_file_name}</span>
                  </div>
                </div>
              )}

              {template.regions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Regiones de extracción</p>
                  <div className="space-y-2">
                    {template.regions.map((region) => (
                      <div
                        key={region.id}
                        className="flex items-start gap-2 p-2 rounded bg-background border text-sm"
                      >
                        {region.type === "table" ? (
                          <TableProperties className="h-4 w-4 text-blue-500 mt-0.5" />
                        ) : (
                          <div className="h-4 w-4 rounded border-2 border-purple-500 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{region.label}</span>
                            <Badge variant={region.type === "table" ? "default" : "secondary"} className="text-[10px]">
                              {region.type === "table" ? "Tabla" : "Campo"}
                            </Badge>
                          </div>
                          {region.type === "table" && region.tableColumns && region.tableColumns.length > 0 && (
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
                  <p className="text-xs font-medium text-muted-foreground mb-2">Campos de datos</p>

                  {parentColumns.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Nivel documento</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {parentColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 p-2 rounded bg-background border text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">
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
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Nivel item</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {itemColumns.map((col) => (
                          <div
                            key={col.fieldKey}
                            className="flex items-center gap-2 p-2 rounded bg-background border text-xs"
                          >
                            {getDataTypeIcon(col.dataType)}
                            <span className="flex-1 truncate">{col.label}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">
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
    </motion.div>
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

  // Data folder state
  const [newFolderDataInputMethod, setNewFolderDataInputMethod] = useState<DataInputMethod>("both");
  const [newFolderSpreadsheetTemplate, setNewFolderSpreadsheetTemplate] = useState<"" | "auto" | "certificado">("");
  const [newFolderOcrTemplateId, setNewFolderOcrTemplateId] = useState("");
  const [newFolderAcceptsPdfImage, setNewFolderAcceptsPdfImage] = useState(true);
  const [newFolderAcceptsSpreadsheet, setNewFolderAcceptsSpreadsheet] = useState(true);
  const [newFolderAllowsManualEntry, setNewFolderAllowsManualEntry] = useState(true);
  const [newFolderHasNested, setNewFolderHasNested] = useState(false);
  const [newFolderDocumentTypesText, setNewFolderDocumentTypesText] = useState("");
  const [newFolderExtractionInstructions, setNewFolderExtractionInstructions] = useState("");
  const [newFolderColumns, setNewFolderColumns] = useState<OcrColumn[]>([]);
  const [newFolderExtractedTables, setNewFolderExtractedTables] = useState<ExtractedTableConfig[]>([
    createEmptyExtractedTable(),
  ]);
  const [activeExtractedTableId, setActiveExtractedTableId] = useState<string | null>(null);
  const [definitionImportText, setDefinitionImportText] = useState("");
  const [isDefinitionImportOpen, setIsDefinitionImportOpen] = useState(false);
  const [hasImportedDefinition, setHasImportedDefinition] = useState(false);

  // Quick actions state
  const [isAddQuickActionOpen, setIsAddQuickActionOpen] = useState(false);
  const [newQuickActionName, setNewQuickActionName] = useState("");
  const [newQuickActionDescription, setNewQuickActionDescription] = useState("");
  const [newQuickActionFolders, setNewQuickActionFolders] = useState<string[]>([]);
  const [isSubmittingQuickAction, setIsSubmittingQuickAction] = useState(false);

  // OCR Templates state
  const [ocrTemplates, setOcrTemplates] = useState<OcrTemplate[]>([]);
  const [isOcrConfigOpen, setIsOcrConfigOpen] = useState(false);

  const resetFolderForm = useCallback(() => {
    setEditingFolderId(null);
    setNewFolderName("");
    setNewFolderParentPath("");
    setFolderMode("normal");
    setFolderEditorStep(0);
    setNewFolderDataInputMethod("both");
    setNewFolderSpreadsheetTemplate("");
    setNewFolderOcrTemplateId("");
    setNewFolderAcceptsPdfImage(true);
    setNewFolderAcceptsSpreadsheet(true);
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
      setIsLoading(true);
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
    void fetchDefaults();
    void fetchOcrTemplates();
  }, [fetchDefaults, fetchOcrTemplates]);

  useEffect(() => {
    if (!activeExtractedTableId && newFolderExtractedTables.length > 0) {
      setActiveExtractedTableId(newFolderExtractedTables[0].id);
    }
  }, [activeExtractedTableId, newFolderExtractedTables]);

  const loadEditorFromExtractedTable = useCallback((table: ExtractedTableConfig) => {
    setNewFolderDataInputMethod(table.dataInputMethod ?? "both");
    setNewFolderSpreadsheetTemplate(table.spreadsheetTemplate ?? "");
    setNewFolderOcrTemplateId(table.ocrTemplateId ?? "");
    setNewFolderAcceptsPdfImage(table.dataInputMethod === "ocr" || table.dataInputMethod === "both");
    setNewFolderAcceptsSpreadsheet(Boolean(table.spreadsheetTemplate));
    setNewFolderAllowsManualEntry(
      typeof table.manualEntryEnabled === "boolean"
        ? table.manualEntryEnabled
        : table.dataInputMethod !== "ocr",
    );
    setNewFolderHasNested(Boolean(table.hasNestedData));
    setNewFolderDocumentTypesText(joinCommaSeparatedList(table.documentTypes));
    setNewFolderExtractionInstructions(table.extractionInstructions ?? "");
    setNewFolderColumns(
      (table.columns ?? []).map((col) => ({
        ...col,
        id: col.id || crypto.randomUUID(),
      })),
    );
  }, []);

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
            spreadsheetTemplate: newFolderAcceptsSpreadsheet ? newFolderSpreadsheetTemplate || null : null,
            ocrTemplateId: newFolderAcceptsPdfImage ? newFolderOcrTemplateId || null : null,
            ocrTemplateName:
              newFolderAcceptsPdfImage
                ? ocrTemplates.find((template) => template.id === newFolderOcrTemplateId)?.name ?? null
                : null,
            manualEntryEnabled: newFolderAllowsManualEntry,
            hasNestedData: newFolderAcceptsPdfImage ? newFolderHasNested : false,
            documentTypes: parseCommaSeparatedList(newFolderDocumentTypesText),
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

  // When template is selected, populate columns from template
  const handleTemplateSelect = useCallback((templateId: string) => {
    setNewFolderOcrTemplateId(templateId);

    if (!templateId) {
      setNewFolderColumns([]);
      setNewFolderHasNested(false);
      return;
    }

    const template = ocrTemplates.find(t => t.id === templateId);
    if (!template) return;

    const mappedColumns: OcrColumn[] = template.columns.map((col) => ({
      id: crypto.randomUUID(),
      label: col.label,
      fieldKey: col.fieldKey || normalizeFieldKey(col.label),
      dataType: ensureTablaDataType(col.dataType),
      required: false,
      scope: (col.ocrScope === "parent" ? "parent" : "item") as "parent" | "item",
      description: col.description,
      aliases: [],
      examples: [],
      excelKeywords: [],
    }));

    setNewFolderColumns(mappedColumns);

    // Check if has nested data (both parent and item columns)
    const hasParent = mappedColumns.some(c => c.scope === "parent");
    const hasItem = mappedColumns.some(c => c.scope === "item");
    setNewFolderHasNested(hasParent && hasItem);
  }, [ocrTemplates]);

  const handleSpreadsheetTemplateSelect = useCallback((template: "auto" | "certificado") => {
    setNewFolderSpreadsheetTemplate(template);
    if (!newFolderAcceptsPdfImage && newFolderColumns.length === 0) {
      setNewFolderColumns(buildSpreadsheetDefaultColumns(template));
    }
  }, [newFolderAcceptsPdfImage, newFolderColumns.length]);

  // Sync columns scope when hasNested changes
  useEffect(() => {
    if (!newFolderHasNested) {
      setNewFolderColumns(prev => prev.map(col => ({ ...col, scope: "item" as const })));
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

  const handleTemplateCreated = (template: OcrTemplate) => {
    setOcrTemplates((prev) => [...prev, template]);
  };

  const openCreateFolder = useCallback((mode: "normal" | "data" = "normal") => {
    resetFolderForm();
    setFolderMode(mode);
    setFolderEditorStep(0);
    setIsAddFolderOpen(true);
  }, [resetFolderForm]);

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
  }, [loadEditorFromExtractedTable]);

  const handleEditFolder = useCallback((folder: DefaultFolder) => {
    const pathSegments = folder.path.split("/").filter(Boolean);
    const parentPath = pathSegments.length > 1 ? pathSegments.slice(0, -1).join("/") : "";
    const extractedTables = mapFolderToExtractedTables(folder);
    const activeTable = extractedTables[0] ?? createEmptyExtractedTable(folder.name);
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
  }, [loadEditorFromExtractedTable]);

  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) return;
    const derivedDataInputMethod = deriveDataInputMethod({
      acceptsPdfImage: newFolderAcceptsPdfImage,
      acceptsSpreadsheet: newFolderAcceptsSpreadsheet,
      allowsManualEntry: newFolderAllowsManualEntry,
    });

    const currentExtractedTables = newFolderExtractedTables.map((table, index) => {
      if (table.id !== activeExtractedTableId) return table;
      return {
        ...table,
        name: table.name?.trim() || (index === 0 ? newFolderName.trim() : `Tabla ${index + 1}`),
        dataInputMethod: derivedDataInputMethod,
        spreadsheetTemplate: newFolderAcceptsSpreadsheet ? newFolderSpreadsheetTemplate || null : null,
        ocrTemplateId: newFolderAcceptsPdfImage ? newFolderOcrTemplateId || null : null,
        ocrTemplateName:
          newFolderAcceptsPdfImage
            ? ocrTemplates.find((template) => template.id === newFolderOcrTemplateId)?.name ?? null
            : null,
        manualEntryEnabled: newFolderAllowsManualEntry,
        hasNestedData: newFolderAcceptsPdfImage ? newFolderHasNested : false,
        documentTypes: parseCommaSeparatedList(newFolderDocumentTypesText),
        extractionInstructions: newFolderExtractionInstructions.trim(),
        columns: newFolderColumns.map((column) => ({ ...column })),
      };
    });

    const primaryTable =
      currentExtractedTables[0] ?? createEmptyExtractedTable(newFolderName.trim());
    const effectiveDataInputMethod = primaryTable.dataInputMethod ?? "both";
    const effectiveSpreadsheetTemplate = primaryTable.spreadsheetTemplate ?? "";
    const effectiveOcrTemplateId = primaryTable.ocrTemplateId ?? "";
    const effectiveHasNested = Boolean(primaryTable.hasNestedData);
    const effectiveDocumentTypes = primaryTable.documentTypes ?? [];
    const effectiveExtractionInstructions = primaryTable.extractionInstructions ?? "";

    const needsOcrTemplate = effectiveDataInputMethod === 'ocr' || effectiveDataInputMethod === 'both';
    const hasAnyTemplateSelected = Boolean(
      (newFolderAcceptsPdfImage && effectiveOcrTemplateId) ||
      (newFolderAcceptsSpreadsheet && effectiveSpreadsheetTemplate),
    );
    const hasSpreadsheetTemplateOnly = Boolean(effectiveSpreadsheetTemplate) && !effectiveOcrTemplateId;
    let effectiveColumns = primaryTable.columns;

    if (folderMode === "data" && effectiveColumns.length === 0 && hasSpreadsheetTemplateOnly) {
      effectiveColumns = buildSpreadsheetDefaultColumns(effectiveSpreadsheetTemplate);
      setNewFolderColumns(effectiveColumns);
    }

    if (folderMode === "data" && !newFolderAcceptsPdfImage && !newFolderAcceptsSpreadsheet && !newFolderAllowsManualEntry) {
      toast.error("ActivÃ¡ al menos un tipo de entrada");
      return;
    }

    if (folderMode === "data" && newFolderAcceptsSpreadsheet && !effectiveSpreadsheetTemplate) {
      toast.error("SeleccionÃ¡ una plantilla XLSX / CSV");
      return;
    }

    if (folderMode === "data") {
      if (needsOcrTemplate && !hasAnyTemplateSelected && !hasImportedDefinition) {
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
        payload.ocrTemplateId = needsOcrTemplate ? effectiveOcrTemplateId : null;
        payload.manualEntryEnabled = newFolderAllowsManualEntry;
        payload.hasNestedData = needsOcrTemplate ? effectiveHasNested : false;
        payload.documentTypes = effectiveDocumentTypes;
        payload.extractionInstructions = effectiveExtractionInstructions.trim() || null;
        payload.extractionRowMode = primaryTable.rowMode;
        payload.extractionMaxRows = getEffectiveTableMaxRows(primaryTable);
        payload.extractedTables = currentExtractedTables.map((table, tableIndex) => ({
          id: table.id,
          name: table.name?.trim() || `Tabla ${tableIndex + 1}`,
          rowMode: table.rowMode,
          maxRows: getEffectiveTableMaxRows(table),
          dataInputMethod: table.dataInputMethod,
          spreadsheetTemplate: table.spreadsheetTemplate || null,
          ocrTemplateId: table.ocrTemplateId || null,
          manualEntryEnabled:
            typeof table.manualEntryEnabled === "boolean" ? table.manualEntryEnabled : true,
          hasNestedData: Boolean(table.hasNestedData),
          documentTypes: table.documentTypes ?? [],
          extractionInstructions: table.extractionInstructions?.trim() || null,
          columns: table.columns.map((col, index) => ({
            id: col.columnId,
            label: col.label,
            fieldKey: col.fieldKey || normalizeFieldKey(col.label),
            dataType: col.dataType,
            required: col.required,
            position: index,
            ocrScope: table.hasNestedData && (table.dataInputMethod === "ocr" || table.dataInputMethod === "both")
              ? col.scope
              : "item",
            description: col.description,
            aliases: col.aliases ?? [],
            examples: col.examples ?? [],
            excelKeywords: col.excelKeywords ?? [],
          })),
        }));
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
        setFolders((prev) => prev.map((item) => (item.id === folder.id ? folder : item)));
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
      toast.error(error instanceof Error ? error.message : "Error guardando carpeta");
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      const res = await fetch("/api/obra-defaults", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "folder", id }),
      });

      if (!res.ok) throw new Error("Error deleting folder");

      setFolders((prev) => prev.filter((folder) => folder.id !== id));
      toast.success("Carpeta eliminada");
    } catch (error) {
      console.error(error);
      toast.error("Error eliminando carpeta");
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
      toast.error(error instanceof Error ? error.message : "Error creando la acción");
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
    setNewFolderColumns(prev => [
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

  const handleImportDefinitionJson = useCallback(() => {
    if (!definitionImportText.trim()) {
      toast.error("Pegá una definición JSON primero");
      return;
    }

    try {
      const imported = importDefinitionToFolderConfig(definitionImportText);
      setFolderMode("data");
      setNewFolderName((prev) => prev.trim() || imported.folderName);
      setNewFolderDataInputMethod(imported.suggestedDataInputMethod);
      setNewFolderSpreadsheetTemplate("");
      setNewFolderOcrTemplateId("");
      setNewFolderAcceptsPdfImage(true);
      setNewFolderAcceptsSpreadsheet(false);
      setNewFolderAllowsManualEntry(imported.suggestedDataInputMethod !== "ocr");
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
        return prev.map((table) => (table.id === activeExtractedTableId ? importedTable : table));
      });
      setActiveExtractedTableId(importedTableId);
      setIsDefinitionImportOpen(false);
      setHasImportedDefinition(true);
      toast.success(`Definición importada: ${imported.columns.length} campos precargados`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo importar la definición");
    }
  }, [activeExtractedTableId, definitionImportText]);

  const handleSelectExtractedTable = useCallback((tableId: string) => {
    syncActiveTableFromEditor();
    const nextTable = newFolderExtractedTables.find((table) => table.id === tableId);
    if (!nextTable) return;
    setActiveExtractedTableId(nextTable.id);
    loadEditorFromExtractedTable(nextTable);
  }, [loadEditorFromExtractedTable, newFolderExtractedTables, syncActiveTableFromEditor]);

  const handleAddExtractedTable = useCallback(() => {
    syncActiveTableFromEditor();
    const nextTable = createEmptyExtractedTable(`Tabla ${newFolderExtractedTables.length + 1}`);
    setNewFolderExtractedTables((prev) => [...prev, nextTable]);
    setActiveExtractedTableId(nextTable.id);
    loadEditorFromExtractedTable(nextTable);
  }, [loadEditorFromExtractedTable, newFolderExtractedTables.length, syncActiveTableFromEditor]);

  const handleRemoveExtractedTable = useCallback((tableId: string) => {
    const remaining = newFolderExtractedTables.filter((table) => table.id !== tableId);
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
  }, [loadEditorFromExtractedTable, newFolderExtractedTables]);

  const handleExtractedTableMetaChange = useCallback((
    tableId: string,
    field: "name" | "rowMode" | "maxRows",
    value: string,
  ) => {
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
            maxRows: value === "multiple" ? sanitizeMaxRows(table.maxRows) : 1,
          };
        }
        return { ...table, name: value };
      }),
    );
  }, []);

  const handleRemoveColumn = (id: string) => {
    setNewFolderColumns(prev => prev.filter(col => col.id !== id));
  };

  const handleColumnChange = (id: string, field: keyof OcrColumn, value: string | boolean) => {
    setNewFolderColumns(prev => prev.map(col => {
      if (col.id !== id) return col;
      const updated = { ...col, [field]: value };
      // Auto-generate fieldKey from label if not manually set
      if (field === "label" && typeof value === "string") {
        updated.fieldKey = normalizeFieldKey(value);
      }
      return updated;
    }));
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

  const acceptedInputDataMethod = deriveDataInputMethod({
    acceptsPdfImage: newFolderAcceptsPdfImage,
    acceptsSpreadsheet: newFolderAcceptsSpreadsheet,
    allowsManualEntry: newFolderAllowsManualEntry,
  });
  const needsOcrTemplate = newFolderAcceptsPdfImage;
  const hasAnyTemplateSelected = Boolean(
    (newFolderAcceptsPdfImage && newFolderOcrTemplateId) ||
    (newFolderAcceptsSpreadsheet && newFolderSpreadsheetTemplate),
  );
  const acceptedInputLabels = getAcceptedInputLabels({
    acceptsPdfImage: newFolderAcceptsPdfImage,
    acceptsSpreadsheet: newFolderAcceptsSpreadsheet,
    allowsManualEntry: newFolderAllowsManualEntry,
  });
  const extractedTableCount = newFolderExtractedTables.length;
  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (folderMode === "data" && (newFolderColumns.length === 0 || extractedTableCount === 0)) ||
    (folderMode === "data" &&
      (!newFolderAcceptsPdfImage && !newFolderAcceptsSpreadsheet && !newFolderAllowsManualEntry)) ||
    (folderMode === "data" && newFolderAcceptsPdfImage && !newFolderOcrTemplateId && !hasImportedDefinition) ||
    (folderMode === "data" && newFolderAcceptsSpreadsheet && !newFolderSpreadsheetTemplate);
  const isCreateQuickActionDisabled =
    !newQuickActionName.trim() || newQuickActionFolders.length === 0;

  const folderNameByPath = useMemo(() => {
    return new Map(folders.map((folder) => [folder.path, folder.name]));
  }, [folders]);
  const normalFolders = useMemo(
    () => folders.filter((folder) => !folder.isOcr),
    [folders]
  );
  const dataFolders = useMemo(
    () => folders.filter((folder) => folder.isOcr),
    [folders]
  );
  const extractionReadyCount = useMemo(
    () =>
      dataFolders.filter(
        (folder) =>
          Boolean(folder.ocrTemplateId || folder.spreadsheetTemplate) &&
          Boolean(folder.columns?.length)
      ).length,
    [dataFolders]
  );
  const folderEditorStepMeta = useMemo(
    () =>
      folderMode === "data"
        ? [
          {
            label: "Base",
            title: "Defini la carpeta",
            description: "Elegi el objetivo de esta carpeta y donde va a vivir dentro de la obra.",
          },
          {
            label: "Captura",
            title: "Explica que entra",
            description: "Define las fuentes, los documentos esperados y la logica de captura.",
          },
          {
            label: "Campos",
            title: "Diseña el resultado",
            description: "Define las columnas finales que queres ver siempre en la tabla.",
          },
          {
            label: "Revision",
            title: "Revisa antes de guardar",
            description: "Chequea el recorrido completo y confirma lo importante.",
          },
        ]
        : [
          {
            label: "Base",
            title: "Defini la carpeta",
            description: "Ubica la carpeta y confirma el objetivo de organizacion.",
          },
          {
            label: "Revision",
            title: "Revisa antes de guardar",
            description: "Confirma la ubicacion final y el tipo de carpeta que vas a crear.",
          },
        ],
    [folderMode]
  );
  const folderEditorStepsLegacy = useMemo(
    () =>
      folderMode === "data"
        ? ["Base", "Carga", "Campos", "RevisiÃ³n"]
        : ["Base", "RevisiÃ³n"],
    [folderMode]
  );
  void folderEditorStepsLegacy;
  const folderEditorSteps = useMemo(
    () => folderEditorStepMeta.map((step) => step.label),
    [folderEditorStepMeta]
  );
  const folderEditorLastStep = folderEditorSteps.length - 1;
  const isFolderReviewStep = folderEditorStep === folderEditorLastStep;
  const parentFolderOptions = useMemo(
    () => folders.filter((folder) => folder.id !== editingFolderId),
    [folders, editingFolderId]
  );
  const folderPathPreview = `/${newFolderParentPath ? `${newFolderParentPath}/` : ""}${normalizeFolderName(newFolderName || "carpeta")}`;
  const activeExtractedTable = useMemo(
    () =>
      newFolderExtractedTables.find((table) => table.id === activeExtractedTableId) ??
      newFolderExtractedTables[0] ??
      null,
    [activeExtractedTableId, newFolderExtractedTables]
  );
  const selectedOcrTemplate = useMemo(
    () => ocrTemplates.find((template) => template.id === newFolderOcrTemplateId) ?? null,
    [newFolderOcrTemplateId, ocrTemplates]
  );
  const currentFolderStepMeta =
    folderEditorStepMeta[folderEditorStep] ?? folderEditorStepMeta[0];
  const folderProgressValue = ((folderEditorStep + 1) / folderEditorSteps.length) * 100;
  const currentWizardTitle =
    folderMode === "data"
      ? folderEditorStep === 0
        ? "¿Qué tipo de carpeta es esta?"
        : folderEditorStep === 1
          ? "¿Qué puede llegar a esta carpeta?"
          : folderEditorStep === 2
            ? "¿Cómo debe quedar la tabla?"
            : "Revisión antes de guardar"
      : folderEditorStep === 0
        ? "¿Qué tipo de carpeta es esta?"
        : "Revisión antes de guardar";
  const currentWizardDescription =
    folderMode === "data"
      ? folderEditorStep === 0
        ? "Elegí si esta carpeta solo guarda archivos o también genera una tabla de datos reutilizable."
        : folderEditorStep === 1
          ? "Definí qué tipos de entrada acepta esta carpeta y qué debe pasar con cada uno."
          : folderEditorStep === 2
            ? "Estos campos definen la estructura reutilizable para todos los proyectos."
            : "Revisá el resultado antes de que forme parte de la configuración base del proyecto."
      : folderEditorStep === 0
        ? "Elegí si esta carpeta solo guarda archivos o también genera una tabla de datos reutilizable."
        : "Revisá el resultado antes de que forme parte de la configuración base del proyecto.";
  const isFolderBaseReady = Boolean(newFolderName.trim());
  const isFolderCaptureReady =
    folderMode !== "data" ||
    (extractedTableCount > 0 && (!needsOcrTemplate || hasAnyTemplateSelected || hasImportedDefinition));
  const isFolderColumnsReady = folderMode !== "data" || newFolderColumns.length > 0;
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
      setFolderEditorStep(Math.max(0, Math.min(nextStep, folderEditorLastStep)));
    },
    [folderEditorLastStep, folderMode, syncActiveTableFromEditor]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Configuración de Obras
        </h1>
        <p className="text-muted-foreground mt-1">
          Definí la estructura predeterminada para cada nueva obra
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Estructura base</p>
              <p className="mt-1 text-2xl font-semibold">{folders.length}</p>
              <p className="text-xs text-muted-foreground">
                {normalFolders.length} carpetas normales y {dataFolders.length} carpetas de datos
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <FolderPlus className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Extracción lista</p>
              <p className="mt-1 text-2xl font-semibold">{extractionReadyCount}</p>
              <p className="text-xs text-muted-foreground">
                carpetas con esquema y captura lista para OCR o planillas
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Plantillas OCR</p>
              <p className="mt-1 text-2xl font-semibold">{ocrTemplates.length}</p>
              <p className="text-xs text-muted-foreground">
                regiones y campos reutilizables para lectura visual
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <ScanLine className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Flujos guiados</p>
              <p className="mt-1 text-2xl font-semibold">{quickActions.length}</p>
              <p className="text-xs text-muted-foreground">
                secuencias de carga para procesos repetitivos
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Centro de configuración</h2>
              <p className="text-sm text-muted-foreground">
                Organizá esta pantalla por intención: estructura, extracción, plantillas y flujos.
              </p>
            </div>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1 lg:w-auto">
              <TabsTrigger value="structure" className="gap-2">
                <Folder className="h-4 w-4" />
                Estructura
              </TabsTrigger>
              <TabsTrigger value="extraction" className="gap-2">
                <Table2 className="h-4 w-4" />
                Extracción
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <ScanLine className="h-4 w-4" />
                Plantillas
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <Zap className="h-4 w-4" />
                Flujos guiados
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="structure" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Estructura de documentos</h3>
                  <p className="text-sm text-muted-foreground">
                    Estas carpetas se crean automáticamente en cada nueva obra.
                  </p>
                </div>
                <Button
                  onClick={() => openCreateFolder("normal")}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva carpeta
                </Button>
              </div>

              <div className="space-y-2">
                {folders.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                    <FolderPlus className="h-12 w-12 mx-auto opacity-20 mb-2" />
                    <p className="text-sm font-medium">Sin estructura configurada</p>
                    <p className="text-xs">Agregá carpetas para definir el esqueleto base de cada obra.</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {folders.map((folder, index) => (
                      <FolderRow
                        key={folder.id}
                        folder={folder}
                        index={index}
                        onEdit={() => handleEditFolder(folder)}
                        onDelete={() => handleDeleteFolder(folder.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border bg-muted/20 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Modelos de carpeta</h3>
                  <p className="text-sm text-muted-foreground">
                    Elegí si la carpeta solo organiza archivos o si además crea una tabla que luego puede poblarse.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border bg-background p-3">
                    <p className="text-sm font-medium">Carpeta normal</p>
                    <p className="text-xs text-muted-foreground">
                      Solo guarda documentos. Ideal para documentación, oferta, pliego o anexos.
                    </p>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <p className="text-sm font-medium">Carpeta de datos</p>
                    <p className="text-xs text-muted-foreground">
                      Crea una tabla asociada para datos manuales o extraídos desde OCR y planillas.
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => openCreateFolder("data")} className="w-full">
                  <Table2 className="h-4 w-4 mr-2" />
                  Crear carpeta de datos
                </Button>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="extraction" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Tablas por defecto y extracción</h3>
                  <p className="text-sm text-muted-foreground">
                    Definí los campos, qué documentos pueden llegar y cómo deben interpretarse.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => openCreateFolder("data")}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                    data-testid="open-data-folder-dialog"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva carpeta de datos
                  </Button>
                  <Button
                    variant="outline"
                    onClick={openCreateFolderFromDefinition}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Importar JSON
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {dataFolders.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                    <Table2 className="h-12 w-12 mx-auto opacity-20 mb-2" />
                    <p className="text-sm font-medium">Sin configuración de extracción</p>
                    <p className="text-xs">Creá una carpeta de datos para empezar a definir tablas por defecto.</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {dataFolders.map((folder, index) => (
                      <FolderRow
                        key={folder.id}
                        folder={folder}
                        index={index}
                        onEdit={() => handleEditFolder(folder)}
                        onDelete={() => handleDeleteFolder(folder.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border bg-muted/20 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Flujo recomendado</h3>
                  <p className="text-sm text-muted-foreground">
                    Pensalo como authoring de extracción, no solo como una lista de columnas.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border bg-background p-3">
                    <p className="text-sm font-medium">1. Definí qué llega a esta carpeta</p>
                    <p className="text-xs text-muted-foreground">Tipos de documento, variantes y si entra por OCR, planilla o manual.</p>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <p className="text-sm font-medium">2. Enseñá el significado de cada campo</p>
                    <p className="text-xs text-muted-foreground">Descripción, aliases, ejemplos de valores y posibles encabezados Excel.</p>
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <p className="text-sm font-medium">3. Definí el resultado esperado</p>
                    <p className="text-xs text-muted-foreground">Las columnas finales son el contrato común para obras nuevas y existentes.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Plantillas de extracción</h3>
              <p className="text-sm text-muted-foreground">
                Definen qué datos extraer de cada tipo de documento visual.
              </p>
            </div>
            <Button
              onClick={() => setIsOcrConfigOpen(true)}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva plantilla
            </Button>
          </div>

          <div className="space-y-3">
            {ocrTemplates.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                <ScanLine className="h-12 w-12 mx-auto opacity-20 mb-2" />
                <p className="text-sm font-medium">Sin plantillas configuradas</p>
                <p className="text-xs">Creá una plantilla para empezar a extraer datos de tus documentos.</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {ocrTemplates.map((template, index) => (
                  <OcrTemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    onDelete={() => handleDeleteOcrTemplate(template.id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Flujos guiados</h3>
              <p className="text-sm text-muted-foreground">
                Flujos de carga rápida con pasos por carpeta para tareas frecuentes.
              </p>
            </div>
            <Button
              onClick={() => setIsAddQuickActionOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva acción
            </Button>
          </div>

          <div className="space-y-2">
            {quickActions.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto opacity-20 mb-2" />
                <p className="text-sm font-medium">Sin flujos configurados</p>
                <p className="text-xs">Agregá acciones para acelerar cargas frecuentes.</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className="group rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{action.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.description || `${action.folderPaths.length} pasos`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteQuickAction(action.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {action.folderPaths.map((path, pathIndex) => (
                        <Badge key={`${action.id}-${path}`} variant="secondary" className="text-[10px]">
                          {pathIndex + 1}. {folderNameByPath.get(path) ?? path}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {false && (<div className="flex flex-col xl:flex-row gap-6">)

        {/* Folders Section */}
        <section className="space-y-4 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <FolderPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Carpetas Predeterminadas</h2>
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
              <Plus className="h-4 w-4 mr-2" />
              Nueva carpeta
            </Button>
          </div>

          <div className="space-y-2">
            {folders.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                <FolderPlus className="h-12 w-12 mx-auto opacity-20 mb-2" />
                <p className="text-sm font-medium">Sin carpetas configuradas</p>
                <p className="text-xs">Agregá carpetas para organizar los documentos de tus obras</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {folders.map((folder, index) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    index={index}
                    onEdit={() => handleEditFolder(folder)}
                    onDelete={() => handleDeleteFolder(folder.id)}
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
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
              <Plus className="h-4 w-4 mr-2" />
              Nueva acción
            </Button>
          </div>

          <div className="space-y-2">
            {quickActions.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto opacity-20 mb-2" />
                <p className="text-sm font-medium">Sin acciones configuradas</p>
                <p className="text-xs">Agregá acciones para acelerar cargas frecuentes</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className="group rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{action.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.description || `${action.folderPaths.length} pasos`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteQuickAction(action.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {action.folderPaths.map((path, pathIndex) => (
                        <Badge key={`${action.id}-${path}`} variant="secondary" className="text-[10px]">
                          {pathIndex + 1}. {folderNameByPath.get(path) ?? path}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Extraction Templates Section */}
        <section className="space-y-4 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <ScanLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Plantillas de Extracción</h2>
                <p className="text-sm text-muted-foreground">
                  Definen qué datos extraer de cada tipo de documento
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsOcrConfigOpen(true)}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva plantilla
            </Button>
          </div>

          <div className="space-y-3">
            {ocrTemplates.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
                <ScanLine className="h-12 w-12 mx-auto opacity-20 mb-2" />
                <p className="text-sm font-medium">Sin plantillas configuradas</p>
                <p className="text-xs">Creá una plantilla para empezar a extraer datos de tus documentos</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {ocrTemplates.map((template, index) => (
                  <OcrTemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    onDelete={() => handleDeleteOcrTemplate(template.id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>)}

      {/* Quick Actions Dialog */}
      <Dialog open={isAddQuickActionOpen} onOpenChange={(open) => {
        setIsAddQuickActionOpen(open);
        if (!open) resetQuickActionForm();
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4">
          <DialogHeader className="px-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-orange-100 dark:bg-orange-900/30">
                <Zap className="h-4 w-4 text-orange-600" />
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
                      <span>Paso {folderEditorStep + 1} de {folderEditorSteps.length}</span>
                      <Badge variant="outline" className="rounded-full">
                        {Math.round(folderProgressValue)}%
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">{currentFolderStepMeta.label}</h3>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {currentFolderStepMeta.description}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-[220px] space-y-3 lg:max-w-xs">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ruta final</p>
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

              <div className={`grid gap-3 ${folderMode === "data" ? "md:grid-cols-4" : "md:grid-cols-2"}`}>
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
                      className={`rounded-2xl border px-4 py-4 text-left transition ${isActive
                        ? "border-amber-500 bg-amber-50"
                        : isComplete
                          ? "border-border bg-background"
                          : "bg-muted/20"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${isActive
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
                          <p className="text-xs text-muted-foreground">{step.title}</p>
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
                      className={`rounded-3xl border p-5 text-left transition ${folderMode === "normal"
                        ? "border-amber-500 bg-amber-50 shadow-sm"
                        : "hover:border-amber-200 hover:bg-amber-50/50"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">Carpeta normal</p>
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
                      className={`rounded-3xl border p-5 text-left transition ${folderMode === "data"
                        ? "border-amber-500 bg-amber-50 shadow-sm"
                        : "hover:border-amber-200 hover:bg-amber-50/50"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
                          <Table2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">Carpeta de datos</p>
                          <p className="text-sm text-muted-foreground">
                            Guarda archivos y crea una tabla lista para captura o extraccion.
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
                          onValueChange={(value) => setNewFolderParentPath(value === "__root__" ? "" : value)}
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
                          placeholder={folderMode === "data" ? "Ej. Certificados" : "Ej. Documentacion"}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
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
                    const orderIndex = newQuickActionFolders.indexOf(folder.path);
                    const isSelected = orderIndex !== -1;

                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => toggleQuickActionFolder(folder.path)}
                        className={`w-full rounded-lg border p-3 flex items-center gap-3 text-left transition-colors ${isSelected ? "border-orange-500 bg-orange-50" : "hover:bg-accent/50"}`}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                          {folder.isOcr ? <Table2 className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">/{folder.path}</p>
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
                      className={`rounded-xl border px-3 py-2 text-left ${isActive
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
                      <strong>Carpeta de datos:</strong> crea una tabla asociada para carga manual o extracción.
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
                      <Folder className="h-4 w-4 mr-2" />
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
                      <Table2 className="h-4 w-4 mr-2" />
                      Guardar archivos y capturar datos
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Carpeta padre (opcional)</Label>
                    <Select
                      value={newFolderParentPath || "__root__"}
                      onValueChange={(value) => setNewFolderParentPath(value === "__root__" ? "" : value)}
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
                      placeholder={folderMode === "data" ? "Ej. Certificados Extraídos" : "Ej. Documentación"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ruta final: /{newFolderParentPath ? `${newFolderParentPath}/` : ""}{normalizeFolderName(newFolderName || "carpeta")}
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
                          Pega el resultado del LLM y precargamos documentos esperados,
                          instrucciones y columnas.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDefinitionImportOpen((prev) => !prev)}
                      >
                        {isDefinitionImportOpen ? "Ocultar" : "Pegar JSON"}
                      </Button>
                    </div>

                    {isDefinitionImportOpen && (
                      <div className="space-y-3">
                        <Textarea
                          value={definitionImportText}
                          onChange={(e) => setDefinitionImportText(e.target.value)}
                          placeholder="Pegá acá el JSON completo de la definición de extracción"
                          className="min-h-[220px] font-mono text-xs"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Si hay secciones tabulares, se activan como datos anidados.
                          </p>
                          <Button
                            type="button"
                            onClick={handleImportDefinitionJson}
                            className="bg-amber-500 hover:bg-amber-600"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
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
                        Elegí si esta tabla recibe datos manuales, desde OCR o desde ambos.
                      </p>
                    </div>
                    <RadioGroup
                      value={newFolderDataInputMethod}
                      onValueChange={(value) => setNewFolderDataInputMethod(value as DataInputMethod)}
                      className="grid gap-3 sm:grid-cols-3"
                    >
                      <div className="flex items-center space-x-2 rounded-lg border bg-background px-3 py-2">
                        <RadioGroupItem value="ocr" id="defaults-method-ocr-step" />
                        <Label htmlFor="defaults-method-ocr-step" className="text-sm font-normal cursor-pointer">Solo OCR</Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border bg-background px-3 py-2">
                        <RadioGroupItem value="manual" id="defaults-method-manual-step" />
                        <Label htmlFor="defaults-method-manual-step" className="text-sm font-normal cursor-pointer">Solo manual</Label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border bg-background px-3 py-2">
                        <RadioGroupItem value="both" id="defaults-method-both-step" />
                        <Label htmlFor="defaults-method-both-step" className="text-sm font-normal cursor-pointer">Ambos</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {newFolderDataInputMethod !== "ocr" && (
                    <div className="space-y-2">
                      <Label>Plantilla de extracción XLSX/CSV</Label>
                      <Select
                        value={newFolderSpreadsheetTemplate || undefined}
                        onValueChange={(value) => setNewFolderSpreadsheetTemplate(value as "auto" | "certificado")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar plantilla XLSX..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (detectar por columnas)</SelectItem>
                          <SelectItem value="certificado">Certificado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(newFolderDataInputMethod === "ocr" || newFolderDataInputMethod === "both") && (
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
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name} ({template.columns.length} campos)
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
                      <Label htmlFor="document-types-step">Tipos de documento esperados</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Separados por coma. Ejemplo: certificado mensual, certificado desacopio.
                      </p>
                    </div>
                    <Textarea
                      id="document-types-step"
                      value={newFolderDocumentTypesText}
                      onChange={(e) => setNewFolderDocumentTypesText(e.target.value)}
                      placeholder="certificado mensual, certificado desacopio, curva de avance"
                      className="min-h-[72px]"
                    />
                    <div>
                      <Label htmlFor="extraction-instructions-step">Instrucciones de extracción</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Explicale al sistema cómo interpretar estos documentos, qué significan los campos y qué debe ignorar.
                      </p>
                    </div>
                    <Textarea
                      id="extraction-instructions-step"
                      value={newFolderExtractionInstructions}
                      onChange={(e) => setNewFolderExtractionInstructions(e.target.value)}
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
                        Definí el resultado final que querés ver en todas las obras.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddColumn}>
                      <Plus className="h-4 w-4 mr-1" />
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
                        <div key={col.id} className="space-y-2 rounded-lg border bg-background p-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={col.label}
                              onChange={(e) => handleColumnChange(col.id, "label", e.target.value)}
                              placeholder="Nombre columna"
                              className="flex-1 h-8 text-sm"
                            />
                            <Select
                              value={col.dataType}
                              onValueChange={(value) => handleColumnChange(col.id, "dataType", value)}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DATA_TYPE_OPTIONS.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={col.required}
                                onChange={(e) => handleColumnChange(col.id, "required", e.target.checked)}
                                className="rounded border-stone-300"
                              />
                              Req.
                            </label>
                            {newFolderHasNested && needsOcrTemplate && (
                              <Select
                                value={col.scope}
                                onValueChange={(value) => handleColumnChange(col.id, "scope", value)}
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
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Textarea
                            value={col.description ?? ""}
                            onChange={(e) => handleColumnChange(col.id, "description", e.target.value)}
                            placeholder="Qué significa este campo y cómo debería interpretarse"
                            className="min-h-[64px]"
                          />
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={joinCommaSeparatedList(col.aliases)}
                              onChange={(e) => handleColumnListChange(col.id, "aliases", e.target.value)}
                              placeholder="Aliases / nombres alternativos"
                              className="h-8 text-sm"
                            />
                            <Input
                              value={joinCommaSeparatedList(col.examples)}
                              onChange={(e) => handleColumnListChange(col.id, "examples", e.target.value)}
                              placeholder="Ejemplos de valores"
                              className="h-8 text-sm"
                            />
                            <Input
                              value={joinCommaSeparatedList(col.excelKeywords)}
                              onChange={(e) => handleColumnListChange(col.id, "excelKeywords", e.target.value)}
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
                          {folderMode === "data" ? "Carpeta de datos" : "Carpeta normal"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Ruta</p>
                        <p className="text-sm font-medium font-mono">
                          /{newFolderParentPath ? `${newFolderParentPath}/` : ""}{normalizeFolderName(newFolderName || "carpeta")}
                        </p>
                      </div>
                      {folderMode === "data" && (
                        <>
                          <div className="rounded-lg border bg-background p-3">
                            <p className="text-xs text-muted-foreground">Carga</p>
                            <p className="text-sm font-medium">{getDataInputMethodLabel(newFolderDataInputMethod)}</p>
                          </div>
                          <div className="rounded-lg border bg-background p-3">
                            <p className="text-xs text-muted-foreground">Columnas</p>
                            <p className="text-sm font-medium">{newFolderColumns.length} definidas</p>
                          </div>
                        </>
                      )}
                    </div>

                    {folderMode === "data" && newFolderColumns.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Campos finales</p>
                        <div className="flex flex-wrap gap-2">
                          {newFolderColumns.map((col) => (
                            <Badge key={col.id} variant="secondary">{col.label || col.fieldKey || "Sin nombre"}</Badge>
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
                      const orderIndex = newQuickActionFolders.indexOf(folder.path);
                      const isSelected = orderIndex !== -1;

                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => toggleQuickActionFolder(folder.path)}
                          className={`w-full rounded-lg border p-3 flex items-center gap-3 text-left transition-colors ${isSelected ? "border-orange-500 bg-orange-50" : "hover:bg-accent/50"}`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                            {folder.isOcr ? <Table2 className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{folder.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">/{folder.path}</p>
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
            <Button variant="outline" onClick={() => {
              setIsAddQuickActionOpen(false);
              resetQuickActionForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleAddQuickAction()}
              disabled={isSubmittingQuickAction || isCreateQuickActionDisabled}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSubmittingQuickAction ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Crear acción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Folder Dialog */}
      <Dialog open={isAddFolderOpen} onOpenChange={(open) => {
        setIsAddFolderOpen(open);
        if (!open) resetFolderForm();
      }}>
        <DialogContent className="aspect-[1.618/1] max-w-[80vw] max-h-[95vh] overflow-y-auto px-4 py-8">
          <DialogTitle className="sr-only">{currentWizardTitle}</DialogTitle>

          <div className="mx-auto max-w-xl space-y-8 py-4">
            <div className="space-y-5 text-center">
              <div className="flex items-center justify-center gap-2">
                {folderEditorSteps.map((step, index) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      if (index <= folderEditorStep) {
                        goToFolderEditorStep(index);
                      }
                    }}
                    className={`h-1 w-6 rounded-full transition ${index === folderEditorStep ? "bg-orange-500" : "bg-stone-300"
                      }`}
                    aria-label={`Step ${index + 1}`}
                  />
                ))}
                <span className="ml-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  Step {folderEditorStep + 1} of {folderEditorSteps.length}
                </span>
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
                    className={`rounded-xl border p-5 text-left transition ${folderMode === "normal"
                      ? "border-orange-500 bg-background"
                      : "border-border bg-background"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Carpeta normal</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Para contratos, notas, anexos y documentos de referencia.
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Solo guarda archivos
                        </p>
                      </div>
                      <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${folderMode === "normal" ? "border-orange-500" : "border-stone-300"
                        }`}>
                        {folderMode === "normal" ? <div className="h-2 w-2 rounded-full bg-orange-500" /> : null}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderMode("data")}
                    disabled={Boolean(editingFolderId)}
                    className={`rounded-xl border p-5 text-left transition ${folderMode === "data"
                      ? "border-orange-500 bg-background"
                      : "border-border bg-background"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Carpeta de datos</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Para cuando los documentos subidos deben generar una tabla estructurada.
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Guarda archivos y captura datos
                        </p>
                      </div>
                      <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${folderMode === "data" ? "border-orange-500" : "border-stone-300"
                        }`}>
                        {folderMode === "data" ? <div className="h-2 w-2 rounded-full bg-orange-500" /> : null}
                      </div>
                    </div>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Carpeta padre</Label>
                      <Select
                        value={newFolderParentPath || "__root__"}
                        onValueChange={(value) => setNewFolderParentPath(value === "__root__" ? "" : value)}
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
                        Nombre de carpeta <span className="text-orange-500">*</span>
                      </Label>
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder={folderMode === "data" ? "Certificados" : "Contratos"}
                        data-testid="folder-name-input"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/40 px-5 py-4">
                    <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Ruta final</p>
                    <p className="mt-2 font-mono text-lg">{folderPathPreview}</p>
                  </div>
                </div>
              </div>
            )}

            {folderMode === "data" && folderEditorStep === 1 && (
              <div className="space-y-6">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <div className="rounded-3xl border bg-muted/20 p-5">
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Receta de carpeta</p>
                    <h4 className="mt-2 text-lg font-semibold">Define los datasets que salen de esta carpeta</h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Ejemplo: carpeta <span className="font-medium text-foreground">certificados</span>,
                      dataset <span className="font-medium text-foreground">resumen</span> con una fila por certificado
                      y dataset <span className="font-medium text-foreground">items</span> con N filas por certificado.
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Para PDF o imagen define que paginas y que datos corresponden a cada dataset.
                      Para XLSX / CSV elegi el script de planilla que debe correr.
                    </p>
                  </div>
                  <div className="rounded-3xl border bg-background p-5">
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Arranque rapido</p>
                    <h4 className="mt-2 text-base font-semibold">Preset Certificados</h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Crea dos datasets editables: <span className="font-medium text-foreground">resumen</span> e <span className="font-medium text-foreground">items</span>.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      data-testid="folder-recipe-certificados"
                      onClick={handleApplyFolderRecipe}
                    >
                      Aplicar receta certificados
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Datasets a generar</p>
                    <p className="text-sm text-muted-foreground">
                      Cada dataset puede tener su propia cantidad de filas, columnas y formatos de entrada.
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
                            className={`rounded-full border px-4 py-1.5 text-sm transition ${isActive ? "border-orange-500 text-foreground" : "text-muted-foreground"
                              }`}
                          >
                            {table.name || `Tabla ${index + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button type="button" variant="link" onClick={handleAddExtractedTable} className="px-0 text-orange-500" data-testid="add-extracted-table">
                    + Agregar dataset
                  </Button>
                </div>

                {activeExtractedTable ? (
                  <div className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="space-y-2">
                        <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Nombre del dataset</Label>
                        <Input
                          value={activeExtractedTable.name}
                          onChange={(e) => handleExtractedTableMetaChange(activeExtractedTable.id, "name", e.target.value)}
                          data-testid="active-dataset-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Forma del dataset</Label>
                        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border">
                          <button
                            type="button"
                            onClick={() => handleExtractedTableMetaChange(activeExtractedTable.id, "rowMode", "single")}
                            data-testid="dataset-rowmode-single"
                            className={`px-4 py-3 text-sm font-medium ${activeExtractedTable.rowMode === "single" ? "bg-stone-900 text-white" : "bg-background"}`}
                          >
                            Una fila por documento
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExtractedTableMetaChange(activeExtractedTable.id, "rowMode", "multiple")}
                            data-testid="dataset-rowmode-multiple"
                            className={`px-4 py-3 text-sm font-medium ${activeExtractedTable.rowMode === "multiple" ? "bg-stone-900 text-white" : "bg-background"}`}
                          >
                            Múltiples filas
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                      {activeExtractedTable.rowMode === "single"
                        ? "Usa este dataset para resumenes: una fila por certificado, factura o documento."
                        : "Usa este dataset para detalles repetidos: items, rubros, hitos o renglones tabulares."}
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Entradas aceptadas</p>

                      <div className={`rounded-3xl border ${newFolderAcceptsPdfImage ? "border-orange-500" : "border-border"}`}>
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-orange-50 text-orange-500">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-base font-semibold">PDF / image</p>
                              <p className="text-sm text-muted-foreground">
                                Archivos escaneados o documentos visuales → datos estructurados
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={newFolderAcceptsPdfImage}
                            onCheckedChange={(checked) => {
                              setNewFolderAcceptsPdfImage(checked);
                              if (!checked) {
                                setNewFolderOcrTemplateId("");
                                setNewFolderHasNested(false);
                              }
                            }}
                          />
                        </div>

                        {newFolderAcceptsPdfImage ? (
                          <div className="space-y-4 border-t px-5 py-4">
                            <div className="space-y-2">
                              <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Plantilla OCR</Label>
                              <Select
                                value={newFolderOcrTemplateId || undefined}
                                onValueChange={handleTemplateSelect}
                              >
                                <SelectTrigger data-testid="ocr-template-select">
                                  <SelectValue placeholder="Seleccionar plantilla..." />
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
                            <div className="space-y-2">
                              <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Tipos de documentos esperados</Label>
                              <Textarea
                                value={newFolderDocumentTypesText}
                                onChange={(e) => setNewFolderDocumentTypesText(e.target.value)}
                                placeholder="Certificado mensual, hoja de medición"
                                className="min-h-[60px] resize-none"
                              />
                              <p className="text-xs text-muted-foreground">
                                Ayudá al extractor a reconocer qué tipo de documento está leyendo.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Notas de extracción</Label>
                              <Textarea
                                value={newFolderExtractionInstructions}
                                onChange={(e) => setNewFolderExtractionInstructions(e.target.value)}
                                placeholder="Explicá variantes de nombres, texto a ignorar y cómo interpretar los campos…"
                                className="min-h-[72px] resize-none"
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                              <div>
                                <p className="text-sm font-medium">El documento tiene datos de cabecera e ítems repetidos</p>
                                <p className="text-xs text-muted-foreground">
                                  Activá extracción anidada para certificados o facturas con ítems.
                                </p>
                              </div>
                              <Switch
                                checked={newFolderHasNested}
                                onCheckedChange={setNewFolderHasNested}
                                disabled={Boolean(newFolderOcrTemplateId)}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className={`rounded-3xl border ${newFolderAcceptsSpreadsheet ? "border-orange-500" : "border-border"}`}>
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Table2 className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-base font-semibold">XLSX / CSV</p>
                              <p className="text-sm text-muted-foreground">
                                Planillas subidas mapeadas a esta tabla
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={newFolderAcceptsSpreadsheet}
                            onCheckedChange={(checked) => {
                              setNewFolderAcceptsSpreadsheet(checked);
                              if (!checked) {
                                setNewFolderSpreadsheetTemplate("");
                              }
                            }}
                          />
                        </div>

                        {newFolderAcceptsSpreadsheet ? (
                          <div className="space-y-4 border-t px-5 py-4">
                            <div className="space-y-2">
                              <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Plantilla de planilla</Label>
                              <Select
                                value={newFolderSpreadsheetTemplate || undefined}
                                onValueChange={(value) => handleSpreadsheetTemplateSelect(value as "auto" | "certificado")}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar plantilla..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">Auto</SelectItem>
                                  <SelectItem value="certificado">Certificado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className={`rounded-3xl border ${newFolderAllowsManualEntry ? "border-orange-500" : "border-border"}`}>
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Pencil className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-base font-semibold">Carga manual</p>
                              <p className="text-sm text-muted-foreground">
                                Los usuarios agregan o editan filas directamente, sin subir archivos
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={newFolderAllowsManualEntry}
                            onCheckedChange={setNewFolderAllowsManualEntry}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
                          Importar definición de extracción
                        </Label>
                        <span className="text-xs text-muted-foreground">Optional</span>
                      </div>
                      <Textarea
                        value={definitionImportText}
                        onChange={(e) => setDefinitionImportText(e.target.value)}
                        placeholder="Pegá el JSON de definición para precargar..."
                        className="min-h-[92px]"
                      />
                      {definitionImportText.trim() ? (
                        <Button type="button" variant="outline" onClick={handleImportDefinitionJson}>
                          Importar definición
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {folderMode === "data" && folderEditorStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Fields</p>
                    <Button type="button" variant="link" onClick={handleAddColumn} className="px-0 text-orange-500">
                      + Agregar campo
                    </Button>
                  </div>

                  {newFolderColumns.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                      Agrega al menos una columna para poder guardar la carpeta de datos.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_140px_110px_auto] gap-3 px-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <span>Nombre del campo</span>
                        <span>Tipo</span>
                        <span>Requerido</span>
                        <span />
                      </div>
                      {newFolderColumns.map((col) => (
                        <div key={col.id} className="rounded-2xl border p-3">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_110px_auto]">
                            <Input
                              value={col.label}
                              onChange={(e) => handleColumnChange(col.id, "label", e.target.value)}
                              placeholder="Nombre del campo"
                            />
                            <Select
                              value={col.dataType}
                              onValueChange={(value) => handleColumnChange(col.id, "dataType", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DATA_TYPE_OPTIONS.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center">
                              <Switch
                                checked={col.required}
                                onCheckedChange={(checked) => handleColumnChange(col.id, "required", checked)}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveColumn(col.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Aliases, ejemplos y columnas de planilla estarán disponibles después de guardar.
                </p>
              </div>
            )}

            {isFolderReviewStep && (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-3xl border bg-background">
                  <div className="grid grid-cols-[180px_1fr] border-b px-5 py-4 text-sm">
                    <span className="uppercase tracking-[0.16em] text-muted-foreground">Tipo de carpeta</span>
                    <span className="font-medium">{folderMode === "data" ? "Carpeta de datos" : "Carpeta normal"}</span>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] border-b px-5 py-4 text-sm">
                    <span className="uppercase tracking-[0.16em] text-muted-foreground">Path</span>
                    <span className="font-mono">{folderPathPreview}</span>
                  </div>
                  {folderMode === "data" ? (
                    <>
                      <div className="grid grid-cols-[180px_1fr] border-b px-5 py-4 text-sm">
                        <span className="uppercase tracking-[0.16em] text-muted-foreground">Entradas aceptadas</span>
                        <span className="font-medium">{acceptedInputLabels.join(", ")}</span>
                      </div>
                      <div className="grid grid-cols-[180px_1fr] border-b px-5 py-4 text-sm">
                        <span className="uppercase tracking-[0.16em] text-muted-foreground">Datasets</span>
                        <span className="font-medium">{newFolderExtractedTables.length} datasets</span>
                      </div>
                      <div className="grid grid-cols-[180px_1fr] border-b px-5 py-4 text-sm">
                        <span className="uppercase tracking-[0.16em] text-muted-foreground">Fields</span>
                        <div className="space-y-2">
                          <p className="font-medium">{newFolderColumns.length} campos</p>
                          <p className="text-muted-foreground">{newFolderColumns.map((column) => column.label).join(" · ")}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-[180px_1fr] px-5 py-4 text-sm">
                        <span className="uppercase tracking-[0.16em] text-muted-foreground">Detalle por dataset</span>
                        <div className="space-y-3">
                          {newFolderExtractedTables.map((table, index) => (
                            <div key={table.id} className="flex items-center justify-between gap-3">
                              <span className="font-medium">{table.name || `Tabla ${index + 1}`}</span>
                              <Badge variant="outline">
                                {table.rowMode === "single" ? "una fila" : "múltiples filas"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 pt-4">
              <p className="text-sm leading-7 text-muted-foreground">
                {folderEditorStep === 0 && !isFolderBaseReady
                  ? "Escribí un nombre de carpeta para continuar."
                  : folderMode === "data" && folderEditorStep === 1 && !isFolderCaptureReady
                    ? "Activá al menos una entrada y completá la configuración requerida."
                    : folderMode === "data" && folderEditorStep === 2 && !isFolderColumnsReady
                      ? "Agregá al menos un campo antes de continuar."
                      : ""}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6">
                {folderEditorStep > 0 ? (
                  <Button variant="ghost" onClick={() => goToFolderEditorStep(folderEditorStep - 1)}>
                    Volver
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsAddFolderOpen(false);
                    resetFolderForm();
                  }}
                >
                  Cancelar
                </Button>
                {!isFolderReviewStep ? (
                  <Button
                    onClick={() => goToFolderEditorStep(folderEditorStep + 1)}
                    disabled={!canAdvanceFolderStep}
                    className="bg-orange-500 px-8 hover:bg-orange-600"
                    data-testid="folder-wizard-continue"
                  >
                    Continuar
                  </Button>
                ) : (
                  <Button
                    onClick={() => void handleSaveFolder()}
                    disabled={isSubmittingFolder || isCreateFolderDisabled}
                    className="bg-orange-500 px-8 hover:bg-orange-600"
                    data-testid="folder-wizard-save"
                  >
                    {isSubmittingFolder ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {editingFolderId ? "Guardar cambios" : folderMode === "data" ? "Crear carpeta de datos" : "Crear carpeta"}
                  </Button>
                )}
              </div>
            </div>

          </div>

          <div className="hidden">
            <div className="space-y-4 py-4">
              {/* Explanation */}
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Carpeta normal:</strong> Solo organiza archivos. <br />
                  <strong>Carpeta de datos:</strong> Tiene una tabla asociada donde podés cargar datos manualmente o extraerlos de documentos. La tabla queda disponible para usar en Macro Tablas.
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
                  <Folder className="h-4 w-4 mr-2" />
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
                  <Table2 className="h-4 w-4 mr-2" />
                  Carpeta de datos
                </Button>
              </div>

              {/* Folder Name */}
              <div className="space-y-2">
                <Label>Carpeta padre (opcional)</Label>
                <Select
                  value={newFolderParentPath || "__root__"}
                  onValueChange={(value) => setNewFolderParentPath(value === "__root__" ? "" : value)}
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
                  placeholder={folderMode === "data" ? "Ej. Órdenes de Compra" : "Ej. Documentos"}
                />
                <p className="text-xs text-muted-foreground">
                  Ruta final: /{newFolderParentPath ? `${newFolderParentPath}/` : ""}{normalizeFolderName(newFolderName || "carpeta")}
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
                          Pega el resultado del LLM y precargamos documentos esperados,
                          instrucciones y columnas.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDefinitionImportOpen((prev) => !prev)}
                      >
                        {isDefinitionImportOpen ? "Ocultar" : "Pegar JSON"}
                      </Button>
                    </div>

                    {isDefinitionImportOpen && (
                      <div className="space-y-3">
                        <Textarea
                          value={definitionImportText}
                          onChange={(e) => setDefinitionImportText(e.target.value)}
                          placeholder="Pegá acá el JSON completo de la definición de extracción"
                          className="min-h-[220px] font-mono text-xs"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Si hay secciones tabulares, se activan como datos anidados.
                          </p>
                          <Button
                            type="button"
                            onClick={handleImportDefinitionJson}
                            className="bg-amber-500 hover:bg-amber-600"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
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
                          Cada tabla puede tener su propia cantidad de filas, tipos de documento y origen de extraccion.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddExtractedTable}>
                        <Plus className="h-4 w-4 mr-1" />
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
                        <AccordionItem key={table.id} value={table.id} className="rounded-lg border bg-background px-3">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex w-full items-center justify-between gap-3 pr-3 text-left">
                              <div>
                                <p className="text-sm font-medium">{table.name || `Tabla ${index + 1}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {table.rowMode === "single"
                                    ? "Extrae 1 fila"
                                    : `Extrae ${getEffectiveTableMaxRows(table) ?? "N"} filas`}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {table.ocrTemplateId && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    PDF / imagen
                                  </Badge>
                                )}
                                {table.spreadsheetTemplate && (
                                  <Badge variant="secondary" className="text-[10px]">
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
                                onChange={(e) => handleExtractedTableMetaChange(table.id, "name", e.target.value)}
                                placeholder="Ej. Certificados resumen"
                              />
                              <Select
                                value={table.rowMode}
                                onValueChange={(value) => handleExtractedTableMetaChange(table.id, "rowMode", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">1 fila</SelectItem>
                                  <SelectItem value="multiple">Multiples filas</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={1}
                                value={table.rowMode === "single" ? "1" : String(table.maxRows ?? "")}
                                disabled={table.rowMode === "single"}
                                onChange={(e) => handleExtractedTableMetaChange(table.id, "maxRows", e.target.value)}
                                placeholder="N"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveExtractedTable(table.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-lg border p-3">
                                <p className="text-sm font-medium">PDF e imagen</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {table.ocrTemplateName ?? "Usa una plantilla OCR para este tipo de documento"}
                                </p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-sm font-medium">Excel y CSV</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {table.spreadsheetTemplate
                                    ? `Usa la extraccion ${table.spreadsheetTemplate}`
                                    : "Sin extractor de planillas configurado"}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Selecciona esta tabla para editar sus columnas, documentos esperados y templates en los bloques siguientes.
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
                      onValueChange={(value) => setNewFolderDataInputMethod(value as DataInputMethod)}
                      className="grid grid-cols-3 gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ocr" id="defaults-method-ocr" />
                        <Label htmlFor="defaults-method-ocr" className="text-sm font-normal cursor-pointer">Solo OCR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="defaults-method-manual" />
                        <Label htmlFor="defaults-method-manual" className="text-sm font-normal cursor-pointer">Solo manual</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="both" id="defaults-method-both" />
                        <Label htmlFor="defaults-method-both" className="text-sm font-normal cursor-pointer">Ambos</Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      {newFolderDataInputMethod === 'ocr' && 'Los datos se extraerán automáticamente de documentos subidos.'}
                      {newFolderDataInputMethod === 'manual' && 'Los datos se ingresarán manualmente en la tabla.'}
                      {newFolderDataInputMethod === 'both' && 'Podés cargar datos manualmente o extraerlos de documentos.'}
                    </p>
                  </div>

                  {/* Spreadsheet Template Selection - when manual input is allowed */}
                  {newFolderDataInputMethod !== 'ocr' && (
                    <div className="space-y-2">
                      <Label>Plantilla de extracción XLSX/CSV</Label>
                      <Select
                        value={newFolderSpreadsheetTemplate || undefined}
                        onValueChange={(value) => setNewFolderSpreadsheetTemplate(value as "auto" | "certificado")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar plantilla XLSX..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (detectar por columnas)</SelectItem>
                          <SelectItem value="certificado">Certificado (certexampleplayground)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Template Selection - Only when OCR is needed */}
                  {(newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both') && (
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
                                  <ScanLine className="h-4 w-4 text-purple-500" />
                                  {template.name} ({template.columns.length} campos)
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
                      <Label htmlFor="document-types">Tipos de documento esperados</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Separados por coma. Ejemplo: certificado mensual, certificado desacopio, curva de avance.
                      </p>
                    </div>
                    <Textarea
                      id="document-types"
                      value={newFolderDocumentTypesText}
                      onChange={(e) => setNewFolderDocumentTypesText(e.target.value)}
                      placeholder="certificado mensual, certificado desacopio, curva de avance"
                      className="min-h-[72px]"
                    />
                    <div>
                      <Label htmlFor="extraction-instructions">Instrucciones de extraccion</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Explicale al sistema como interpretar estos documentos, que significan los campos y que debe ignorar.
                      </p>
                    </div>
                    <Textarea
                      id="extraction-instructions"
                      value={newFolderExtractionInstructions}
                      onChange={(e) => setNewFolderExtractionInstructions(e.target.value)}
                      placeholder="Estos documentos pueden venir con encabezados distintos. El expediente puede aparecer como Expte., Nro. Expte o EX-2025..."
                      className="min-h-[96px]"
                    />
                  </div>

                  {/* Nested Data Toggle - Only when OCR is needed */}
                  {(newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both') && (
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
                        <Plus className="h-4 w-4 mr-1" />
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
                                onChange={(e) => handleColumnChange(col.id, "label", e.target.value)}
                                placeholder="Nombre columna"
                                className="flex-1 h-8 text-sm"
                              />
                              <Select
                                value={col.dataType}
                                onValueChange={(value) => handleColumnChange(col.id, "dataType", value)}
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DATA_TYPE_OPTIONS.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={col.required}
                                  onChange={(e) => handleColumnChange(col.id, "required", e.target.checked)}
                                  className="rounded border-stone-300"
                                />
                                Req.
                              </label>
                              {newFolderHasNested && (newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both') && (
                                <Select
                                  value={col.scope}
                                  onValueChange={(value) => handleColumnChange(col.id, "scope", value)}
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
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <Textarea
                              value={col.description ?? ""}
                              onChange={(e) => handleColumnChange(col.id, "description", e.target.value)}
                              placeholder="Que significa este campo y como deberia interpretarse"
                              className="min-h-[64px]"
                            />
                            <div className="grid gap-2 md:grid-cols-3">
                              <Input
                                value={joinCommaSeparatedList(col.aliases)}
                                onChange={(e) => handleColumnListChange(col.id, "aliases", e.target.value)}
                                placeholder="Aliases / nombres alternativos"
                                className="h-8 text-sm"
                              />
                              <Input
                                value={joinCommaSeparatedList(col.examples)}
                                onChange={(e) => handleColumnListChange(col.id, "examples", e.target.value)}
                                placeholder="Ejemplos de valores"
                                className="h-8 text-sm"
                              />
                              <Input
                                value={joinCommaSeparatedList(col.excelKeywords)}
                                onChange={(e) => handleColumnListChange(col.id, "excelKeywords", e.target.value)}
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
              <Button variant="outline" onClick={() => {
                setIsAddFolderOpen(false);
                resetFolderForm();
              }}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSaveFolder()}
                disabled={isSubmittingFolder || isCreateFolderDisabled}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isSubmittingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : folderMode === "data" ? (
                  <Table2 className="h-4 w-4 mr-2" />
                ) : (
                  <FolderPlus className="h-4 w-4 mr-2" />
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

      {/* OCR Template Configurator */}
      <OcrTemplateConfigurator
        open={isOcrConfigOpen}
        onOpenChange={setIsOcrConfigOpen}
        onTemplateCreated={handleTemplateCreated}
      />
    </div >
  );
}
