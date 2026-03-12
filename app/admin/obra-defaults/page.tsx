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

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ensureTablaDataType, normalizeFieldKey, normalizeFolderName } from "@/lib/tablas";

type DataInputMethod = 'ocr' | 'manual' | 'both';

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
  hasNestedData?: boolean;
  documentTypes?: string[];
  extractionInstructions?: string | null;
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

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCommaSeparatedList(values?: string[]): string {
  return Array.isArray(values) ? values.join(", ") : "";
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
  const [newFolderHasNested, setNewFolderHasNested] = useState(false);
  const [newFolderDocumentTypesText, setNewFolderDocumentTypesText] = useState("");
  const [newFolderExtractionInstructions, setNewFolderExtractionInstructions] = useState("");
  const [newFolderColumns, setNewFolderColumns] = useState<OcrColumn[]>([]);

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
    setNewFolderHasNested(false);
    setNewFolderDocumentTypesText("");
    setNewFolderExtractionInstructions("");
    setNewFolderColumns([]);
  }, []);

  const resetQuickActionForm = useCallback(() => {
    setNewQuickActionName("");
    setNewQuickActionDescription("");
    setNewQuickActionFolders([]);
  }, []);

  const fetchOcrTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/ocr-templates");
      if (!res.ok) throw new Error("Failed to load OCR templates");
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

  const handleEditFolder = useCallback((folder: DefaultFolder) => {
    const pathSegments = folder.path.split("/").filter(Boolean);
    const parentPath = pathSegments.length > 1 ? pathSegments.slice(0, -1).join("/") : "";
    setEditingFolderId(folder.id);
    setNewFolderName(folder.name);
    setNewFolderParentPath(parentPath);
    setFolderMode(folder.isOcr ? "data" : "normal");
    setNewFolderDataInputMethod(folder.dataInputMethod ?? "both");
    setNewFolderSpreadsheetTemplate(folder.spreadsheetTemplate ?? "");
    setNewFolderOcrTemplateId(folder.ocrTemplateId ?? "");
    setNewFolderHasNested(Boolean(folder.hasNestedData));
    setNewFolderDocumentTypesText(joinCommaSeparatedList(folder.documentTypes));
    setNewFolderExtractionInstructions(folder.extractionInstructions ?? "");
    setNewFolderColumns(
      (folder.columns ?? []).map((col) => ({
        id: crypto.randomUUID(),
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
    );
    setFolderEditorStep(0);
    setIsAddFolderOpen(true);
  }, []);

  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) return;

    const needsOcrTemplate = newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both';
    const hasAnyTemplateSelected = Boolean(newFolderOcrTemplateId || newFolderSpreadsheetTemplate);
    const hasSpreadsheetTemplateOnly = Boolean(newFolderSpreadsheetTemplate) && !newFolderOcrTemplateId;
    let effectiveColumns = newFolderColumns;

    if (folderMode === "data" && effectiveColumns.length === 0 && hasSpreadsheetTemplateOnly) {
      effectiveColumns = buildSpreadsheetDefaultColumns(newFolderSpreadsheetTemplate);
      setNewFolderColumns(effectiveColumns);
    }

    if (folderMode === "data") {
      if (needsOcrTemplate && !hasAnyTemplateSelected) {
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
        const documentTypes = parseCommaSeparatedList(newFolderDocumentTypesText);
        payload.isOcr = true; // Kept for backward compatibility
        payload.dataInputMethod = newFolderDataInputMethod;
        payload.spreadsheetTemplate = newFolderSpreadsheetTemplate || null;
        payload.ocrTemplateId = needsOcrTemplate ? newFolderOcrTemplateId : null;
        payload.hasNestedData = needsOcrTemplate ? newFolderHasNested : false;
        payload.documentTypes = documentTypes;
        payload.extractionInstructions = newFolderExtractionInstructions.trim() || null;
        payload.columns = effectiveColumns.map((col, index) => ({
          id: col.columnId,
          label: col.label,
          fieldKey: col.fieldKey || normalizeFieldKey(col.label),
          dataType: col.dataType,
          required: col.required,
          position: index,
          ocrScope: newFolderHasNested && needsOcrTemplate ? col.scope : "item",
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

  const needsOcrTemplate = newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both';
  const hasAnyTemplateSelected = Boolean(newFolderOcrTemplateId || newFolderSpreadsheetTemplate);
  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (folderMode === "data" && newFolderColumns.length === 0 && !hasAnyTemplateSelected) ||
    (folderMode === "data" && needsOcrTemplate && !hasAnyTemplateSelected);
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
  const folderEditorSteps = useMemo(
    () =>
      folderMode === "data"
        ? ["Base", "Carga", "Campos", "RevisiÃ³n"]
        : ["Base", "RevisiÃ³n"],
    [folderMode]
  );
  const folderEditorLastStep = folderEditorSteps.length - 1;
  const isFolderReviewStep = folderEditorStep === folderEditorLastStep;
  const parentFolderOptions = useMemo(
    () => folders.filter((folder) => folder.id !== editingFolderId),
    [folders, editingFolderId]
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
                <Button
                  onClick={() => openCreateFolder("data")}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva carpeta de datos
                </Button>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4">
          <DialogHeader className="px-0">
            <DialogTitle className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${folderMode === "data"
                ? "bg-amber-100 dark:bg-amber-900/30"
                : "bg-amber-100 dark:bg-amber-900/30"
                }`}>
                {folderMode === "data" ? (
                  <Table2 className="h-4 w-4 text-amber-600" />
                ) : (
                  <FolderPlus className="h-4 w-4 text-amber-600" />
                )}
              </div>
              {editingFolderId
                ? folderMode === "data"
                  ? "Editar carpeta de datos"
                  : "Editar carpeta"
                : folderMode === "data"
                  ? "Nueva carpeta de datos"
                  : "Nueva carpeta"}
            </DialogTitle>
            <DialogDescription>
              {folderMode === "data"
                ? "Esta carpeta tendrá una tabla de datos asociada que podés llenar manualmente o con extracción de documentos."
                : "Esta carpeta se creará automáticamente en cada nueva obra."}
            </DialogDescription>
          </DialogHeader>

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
