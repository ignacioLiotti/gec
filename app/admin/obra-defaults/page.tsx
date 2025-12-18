"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  FolderPlus,
  TableProperties,
  Trash2,
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
} from "lucide-react";

import { OcrTemplateConfigurator } from "./_components/OcrTemplateConfigurator";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { normalizeFieldKey } from "@/lib/tablas";

type OcrColumn = {
  id: string;
  label: string;
  fieldKey: string;
  dataType: string;
  required: boolean;
  scope: "parent" | "item";
};

type DefaultFolder = {
  id: string;
  name: string;
  path: string;
  position: number;
  // OCR folder fields
  isOcr?: boolean;
  ocrTemplateId?: string | null;
  ocrTemplateName?: string | null;
  hasNestedData?: boolean;
  columns?: Array<{
    fieldKey: string;
    label: string;
    dataType: string;
    ocrScope?: string;
  }>;
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
  columns: Array<{ fieldKey: string; label: string; dataType: string; ocrScope?: string }>;
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
  index,
}: {
  folder: DefaultFolder;
  onDelete: () => void;
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
                    OCR
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
                  <p className="text-xs font-medium text-muted-foreground mb-1">Plantilla OCR</p>
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

const DATA_TYPES = ["text", "number", "currency", "date", "boolean"] as const;

export default function ObraDefaultsPage() {
  const [folders, setFolders] = useState<DefaultFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Folder dialog state
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [folderMode, setFolderMode] = useState<"normal" | "ocr">("normal");
  const [newFolderName, setNewFolderName] = useState("");
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  // OCR folder state
  const [newFolderOcrTemplateId, setNewFolderOcrTemplateId] = useState("");
  const [newFolderHasNested, setNewFolderHasNested] = useState(false);
  const [newFolderColumns, setNewFolderColumns] = useState<OcrColumn[]>([]);

  // OCR Templates state
  const [ocrTemplates, setOcrTemplates] = useState<OcrTemplate[]>([]);
  const [isOcrConfigOpen, setIsOcrConfigOpen] = useState(false);

  const resetFolderForm = useCallback(() => {
    setNewFolderName("");
    setFolderMode("normal");
    setNewFolderOcrTemplateId("");
    setNewFolderHasNested(false);
    setNewFolderColumns([]);
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

    const mappedColumns: OcrColumn[] = template.columns.map((col, index) => ({
      id: crypto.randomUUID(),
      label: col.label,
      fieldKey: col.fieldKey || normalizeFieldKey(col.label),
      dataType: DATA_TYPES.includes(col.dataType as typeof DATA_TYPES[number]) ? col.dataType : "text",
      required: false,
      scope: (col.ocrScope === "parent" ? "parent" : "item") as "parent" | "item",
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

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;

    if (folderMode === "ocr") {
      if (!newFolderOcrTemplateId) {
        toast.error("Seleccioná una plantilla OCR");
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
        name: newFolderName.trim(),
      };

      if (folderMode === "ocr") {
        payload.isOcr = true;
        payload.ocrTemplateId = newFolderOcrTemplateId;
        payload.hasNestedData = newFolderHasNested;
        payload.columns = newFolderColumns.map((col, index) => ({
          label: col.label,
          fieldKey: col.fieldKey || normalizeFieldKey(col.label),
          dataType: col.dataType,
          required: col.required,
          position: index,
          ocrScope: newFolderHasNested ? col.scope : "item",
        }));
      }

      const res = await fetch("/api/obra-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creating folder");
      }

      const { folder } = await res.json();
      setFolders((prev) => [...prev, folder]);
      resetFolderForm();
      setIsAddFolderOpen(false);
      toast.success(folderMode === "ocr" ? "Carpeta OCR agregada" : "Carpeta agregada");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error agregando carpeta");
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

  const isCreateFolderDisabled =
    !newFolderName.trim() ||
    (folderMode === "ocr" && (!newFolderOcrTemplateId || newFolderColumns.length === 0));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Configuración de Obras
        </h1>
        <p className="text-muted-foreground mt-1">
          Definí la estructura predeterminada para cada nueva obra
        </p>
      </div>

      {/* Folders Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FolderPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Carpetas</h2>
              <p className="text-sm text-muted-foreground">
                Estructura de archivos que se crea en cada nueva obra
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsAddFolderOpen(true)}
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
              <p className="text-xs">Las carpetas se crearán automáticamente en cada nueva obra</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {folders.map((folder, index) => (
                <FolderRow
                  key={folder.id}
                  folder={folder}
                  index={index}
                  onDelete={() => handleDeleteFolder(folder.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* OCR Templates Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <ScanLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Plantillas OCR</h2>
              <p className="text-sm text-muted-foreground">
                Configuración de extracción automática de datos
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
              <p className="text-xs">Las plantillas definen cómo extraer datos de documentos</p>
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

      {/* Add Folder Dialog */}
      <Dialog open={isAddFolderOpen} onOpenChange={(open) => {
        setIsAddFolderOpen(open);
        if (!open) resetFolderForm();
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                folderMode === "ocr"
                  ? "bg-amber-100 dark:bg-amber-900/30"
                  : "bg-amber-100 dark:bg-amber-900/30"
              }`}>
                {folderMode === "ocr" ? (
                  <Table2 className="h-4 w-4 text-amber-600" />
                ) : (
                  <FolderPlus className="h-4 w-4 text-amber-600" />
                )}
              </div>
              {folderMode === "ocr" ? "Nueva carpeta OCR" : "Nueva carpeta"}
            </DialogTitle>
            <DialogDescription>
              {folderMode === "ocr"
                ? "Esta carpeta se vinculará a una tabla OCR para extraer datos automáticamente."
                : "Esta carpeta se creará automáticamente en cada nueva obra."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Folder Type Toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={folderMode === "normal" ? "default" : "outline"}
                size="sm"
                onClick={() => setFolderMode("normal")}
                className="flex-1"
              >
                <Folder className="h-4 w-4 mr-2" />
                Carpeta normal
              </Button>
              <Button
                type="button"
                variant={folderMode === "ocr" ? "default" : "outline"}
                size="sm"
                onClick={() => setFolderMode("ocr")}
                className="flex-1"
              >
                <Table2 className="h-4 w-4 mr-2" />
                Carpeta OCR
              </Button>
            </div>

            {/* Folder Name */}
            <div className="space-y-2">
              <Label>Nombre de la carpeta</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={folderMode === "ocr" ? "Ej. Órdenes de Compra" : "Ej. Documentos"}
              />
            </div>

            {/* OCR Specific Fields */}
            {folderMode === "ocr" && (
              <>
                {/* Template Selection */}
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

                {/* Nested Data Toggle */}
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

                {/* Columns */}
                {newFolderColumns.length > 0 && (
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
                              {DATA_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {newFolderHasNested && (
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

                    <p className="text-[10px] text-muted-foreground">
                      {newFolderHasNested
                        ? "Nombre | Tipo | Scope (Doc/Item) | Eliminar"
                        : "Nombre | Tipo | Eliminar"}
                    </p>
                  </div>
                )}

                {newFolderOcrTemplateId && newFolderColumns.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddColumn}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar columna
                  </Button>
                )}
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
              onClick={() => void handleAddFolder()}
              disabled={isSubmittingFolder || isCreateFolderDisabled}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isSubmittingFolder ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : folderMode === "ocr" ? (
                <Table2 className="h-4 w-4" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              {folderMode === "ocr" ? "Crear carpeta OCR" : "Crear carpeta"}
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
    </div>
  );
}
