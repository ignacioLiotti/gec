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

import { ensureTablaDataType, normalizeFieldKey } from "@/lib/tablas";

type DataInputMethod = 'ocr' | 'manual' | 'both';

type OcrColumn = {
  id: string;
  label: string;
  fieldKey: string;
  dataType: string;
  required: boolean;
  scope: "parent" | "item";
  description?: string;
};

type DefaultFolder = {
  id: string;
  name: string;
  path: string;
  position: number;
  // Data folder fields
  isOcr?: boolean; // Kept for backward compatibility, means it's a data folder
  dataInputMethod?: DataInputMethod;
  ocrTemplateId?: string | null;
  ocrTemplateName?: string | null;
  hasNestedData?: boolean;
  columns?: Array<{
    fieldKey: string;
    label: string;
    dataType: string;
    ocrScope?: string;
    required?: boolean;
    description?: string | null;
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

  // Folder dialog state
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderMode, setFolderMode] = useState<"normal" | "data">("normal");
  const [newFolderName, setNewFolderName] = useState("");
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  // Data folder state
  const [newFolderDataInputMethod, setNewFolderDataInputMethod] = useState<DataInputMethod>("both");
  const [newFolderOcrTemplateId, setNewFolderOcrTemplateId] = useState("");
  const [newFolderHasNested, setNewFolderHasNested] = useState(false);
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
    setFolderMode("normal");
    setNewFolderDataInputMethod("both");
    setNewFolderOcrTemplateId("");
    setNewFolderHasNested(false);
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

  const handleEditFolder = useCallback((folder: DefaultFolder) => {
    setEditingFolderId(folder.id);
    setNewFolderName(folder.name);
    setFolderMode(folder.isOcr ? "data" : "normal");
    setNewFolderDataInputMethod(folder.dataInputMethod ?? "both");
    setNewFolderOcrTemplateId(folder.ocrTemplateId ?? "");
    setNewFolderHasNested(Boolean(folder.hasNestedData));
    setNewFolderColumns(
      (folder.columns ?? []).map((col) => ({
        id: crypto.randomUUID(),
        label: col.label,
        fieldKey: col.fieldKey,
        dataType: ensureTablaDataType(col.dataType),
        required: Boolean(col.required),
        scope: col.ocrScope === "parent" ? "parent" : "item",
        description: col.description ?? "",
      })),
    );
    setIsAddFolderOpen(true);
  }, []);

  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) return;

    const needsOcrTemplate = newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both';

    if (folderMode === "data") {
      if (needsOcrTemplate && !newFolderOcrTemplateId) {
        toast.error("Seleccioná una plantilla de extracción");
        return;
      }
      if (newFolderColumns.length === 0) {
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
      };

      if (folderMode === "data") {
        payload.isOcr = true; // Kept for backward compatibility
        payload.dataInputMethod = newFolderDataInputMethod;
        payload.ocrTemplateId = needsOcrTemplate ? newFolderOcrTemplateId : null;
        payload.hasNestedData = needsOcrTemplate ? newFolderHasNested : false;
        payload.columns = newFolderColumns.map((col, index) => ({
          label: col.label,
          fieldKey: col.fieldKey || normalizeFieldKey(col.label),
          dataType: col.dataType,
          required: col.required,
          position: index,
          ocrScope: newFolderHasNested && needsOcrTemplate ? col.scope : "item",
          description: col.description,
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

  const needsOcrTemplate = newFolderDataInputMethod === 'ocr' || newFolderDataInputMethod === 'both';
  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (folderMode === "data" && newFolderColumns.length === 0) ||
    (folderMode === "data" && needsOcrTemplate && !newFolderOcrTemplateId);
  const isCreateQuickActionDisabled =
    !newQuickActionName.trim() || newQuickActionFolders.length === 0;

  const folderNameByPath = useMemo(() => {
    return new Map(folders.map((folder) => [folder.path, folder.name]));
  }, [folders]);

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

      <div className="flex flex-col xl:flex-row gap-6">

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
      </div>

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
              <Label>Nombre de la carpeta</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={folderMode === "data" ? "Ej. Órdenes de Compra" : "Ej. Documentos"}
              />
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
                          className="flex items-center gap-2 p-2 rounded-lg border bg-background"
                        >
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
