"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  FolderPlus, 
  TableProperties, 
  Trash2, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  Link2,
  FileText,
  Settings2,
  ScanLine,
  Eye,
} from "lucide-react";

import { OcrTemplateConfigurator } from "./_components/OcrTemplateConfigurator";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";

import { TABLA_DATA_TYPES, type TablaColumnDataType } from "@/lib/tablas";

type DefaultFolder = {
  id: string;
  name: string;
  path: string;
  position: number;
};

type DefaultTablaColumn = {
  id?: string;
  field_key?: string;
  label: string;
  data_type: TablaColumnDataType;
  position: number;
  required: boolean;
  config: Record<string, unknown>;
};

type DefaultTabla = {
  id: string;
  name: string;
  description: string | null;
  source_type: "manual" | "csv" | "ocr";
  linked_folder_path: string | null;
  settings: Record<string, unknown>;
  position: number;
  columns: DefaultTablaColumn[];
};

export default function ObraDefaultsPage() {
  const [folders, setFolders] = useState<DefaultFolder[]>([]);
  const [tablas, setTablas] = useState<DefaultTabla[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [isAddTablaOpen, setIsAddTablaOpen] = useState(false);
  
  const [newFolderName, setNewFolderName] = useState("");
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  
  // Tabla form state
  const [newTablaName, setNewTablaName] = useState("");
  const [newTablaDescription, setNewTablaDescription] = useState("");
  const [newTablaSourceType, setNewTablaSourceType] = useState<"manual" | "ocr">("manual");
  const [newTablaLinkedFolder, setNewTablaLinkedFolder] = useState("");
  const [newTablaOcrDocType, setNewTablaOcrDocType] = useState("");
  const [newTablaOcrInstructions, setNewTablaOcrInstructions] = useState("");
  const [newTablaHasNestedData, setNewTablaHasNestedData] = useState(false);
  const [newTablaColumns, setNewTablaColumns] = useState<Array<{
    label: string;
    dataType: TablaColumnDataType;
    required: boolean;
    ocrScope?: "parent" | "item";
    fieldKey?: string;
  }>>([{ label: "", dataType: "text", required: false, fieldKey: "columna_1" }]);
  const [isSubmittingTabla, setIsSubmittingTabla] = useState(false);

  const [expandedTablaId, setExpandedTablaId] = useState<string | null>(null);

  // OCR Templates state
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

  const [ocrTemplates, setOcrTemplates] = useState<OcrTemplate[]>([]);
  const [isOcrConfigOpen, setIsOcrConfigOpen] = useState(false);
  const [newTablaOcrTemplateId, setNewTablaOcrTemplateId] = useState<string>("");

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
      setTablas(data.tablas ?? []);
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
    if (newTablaSourceType !== "ocr" && newTablaOcrTemplateId) {
      setNewTablaOcrTemplateId("");
    }
  }, [newTablaOcrTemplateId, newTablaSourceType]);

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
    
    try {
      setIsSubmittingFolder(true);
      const res = await fetch("/api/obra-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "folder", name: newFolderName.trim() }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creating folder");
      }
      
      const { folder } = await res.json();
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      setIsAddFolderOpen(false);
      toast.success("Carpeta agregada");
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

  const resetTablaForm = () => {
    setNewTablaName("");
    setNewTablaDescription("");
    setNewTablaSourceType("manual");
    setNewTablaLinkedFolder("");
    setNewTablaOcrDocType("");
    setNewTablaOcrInstructions("");
    setNewTablaHasNestedData(false);
    setNewTablaOcrTemplateId("");
    setNewTablaColumns([{ label: "", dataType: "text", required: false, fieldKey: "columna_1" }]);
  };

  const handleAddTabla = async () => {
    if (!newTablaName.trim()) return;
    
    const validColumns = newTablaColumns.filter((col) => col.label.trim());
    if (validColumns.length === 0) {
      toast.error("Necesitás al menos una columna");
      return;
    }
    
    try {
      setIsSubmittingTabla(true);
      const columnsPayload = validColumns.map((col, index) => ({
        label: col.label.trim() || `Columna ${index + 1}`,
        fieldKey: (col as any).fieldKey || (col as any).field_key || col.label || `col_${index + 1}`,
        dataType: col.dataType,
        required: Boolean(col.required),
        ocrScope: col.ocrScope,
        position: index,
      }));

      const res = await fetch("/api/obra-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "tabla",
          name: newTablaName.trim(),
          description: newTablaDescription.trim() || null,
          sourceType: newTablaSourceType,
          linkedFolderPath: newTablaSourceType === "ocr" ? newTablaLinkedFolder : null,
          ocrDocType: newTablaSourceType === "ocr" ? newTablaOcrDocType : null,
          ocrInstructions: newTablaSourceType === "ocr" ? newTablaOcrInstructions : null,
          hasNestedData: newTablaSourceType === "ocr" ? newTablaHasNestedData : false,
          ocrTemplateId: newTablaSourceType === "ocr" ? newTablaOcrTemplateId || null : null,
          columns: columnsPayload,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creating tabla");
      }
      
      const { tabla } = await res.json();
      setTablas((prev) => [...prev, tabla]);
      resetTablaForm();
      setIsAddTablaOpen(false);
      toast.success("Tabla agregada");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error agregando tabla");
    } finally {
      setIsSubmittingTabla(false);
    }
  };

  const handleDeleteTabla = async (id: string) => {
    try {
      const res = await fetch("/api/obra-defaults", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tabla", id }),
      });
      
      if (!res.ok) throw new Error("Error deleting tabla");
      
      setTablas((prev) => prev.filter((tabla) => tabla.id !== id));
      toast.success("Tabla eliminada");
    } catch (error) {
      console.error(error);
      toast.error("Error eliminando tabla");
    }
  };

  const handleAddColumn = () => {
    setNewTablaColumns((prev) => [
      ...prev,
      { label: "", dataType: "text", required: false, fieldKey: `columna_${prev.length + 1}` },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    setNewTablaColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleColumnChange = (
    index: number,
    field: "label" | "dataType" | "required" | "ocrScope",
    value: any
  ) => {
    setNewTablaColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, [field]: value } : col))
    );
  };

  const handleTemplateSelect = useCallback((templateId: string | null) => {
    const normalizedId = templateId ?? "";
    setNewTablaOcrTemplateId(normalizedId);
    if (!templateId) {
      setNewTablaHasNestedData(false);
      setNewTablaColumns([{ label: "", dataType: "text", required: false, fieldKey: "columna_1" }]);
      return;
    }
    const template = ocrTemplates.find((tpl) => tpl.id === templateId);
    if (!template) return;

    const mappedColumns = template.columns.map((col, index) => {
      const normalizedType = TABLA_DATA_TYPES.includes(col.dataType as TablaColumnDataType)
        ? (col.dataType as TablaColumnDataType)
        : "text";
      return {
        label: col.label,
        dataType: normalizedType,
        required: false,
        ocrScope: col.ocrScope === "parent" ? "parent" : "item",
        fieldKey: col.fieldKey || `col_${index + 1}`,
      };
    });

    setNewTablaColumns(
      mappedColumns.length > 0
        ? mappedColumns
        : [{ label: "", dataType: "text", required: false, fieldKey: "columna_1" }]
    );

    const hasParent = mappedColumns.some((col) => col.ocrScope === "parent");
    const hasItem = mappedColumns.some((col) => col.ocrScope !== "parent");
    setNewTablaHasNestedData(hasParent && hasItem);
    setNewTablaOcrDocType((prev) => prev || template.name || prev);
    setNewTablaName((prev) => prev || template.name || prev);
    if (newTablaSourceType !== "ocr") {
      setNewTablaSourceType("ocr");
    }
  }, [newTablaSourceType, ocrTemplates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
          Configuración de Obras
        </h1>
        <p className="text-muted-foreground mt-2">
          Definí las carpetas y tablas que se crearán automáticamente en cada nueva obra.
        </p>
      </div>

      {/* Folders Section */}
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FolderPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle>Carpetas por defecto</CardTitle>
                <CardDescription>
                  Estructura de carpetas inicial para documentos
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddFolderOpen(true)}
              className="border-amber-500/30 hover:bg-amber-500/10"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Agregar carpeta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {folders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No hay carpetas configuradas.</p>
              <p className="text-sm">Las obras nuevas no tendrán carpetas predefinidas.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <AnimatePresence>
                {folders.map((folder, index) => (
                  <motion.div
                    key={folder.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex items-center justify-between p-3 rounded-lg bg-background/60 border border-border/50 hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-amber-500/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium">{folder.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{folder.path}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OCR Templates Section */}
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-50/50 to-fuchsia-50/30 dark:from-purple-950/20 dark:to-fuchsia-950/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ScanLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>Plantillas OCR</CardTitle>
                <CardDescription>
                  Define regiones de extracción para procesar documentos automáticamente
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOcrConfigOpen(true)}
              className="border-purple-500/30 hover:bg-purple-500/10"
            >
              <ScanLine className="h-4 w-4 mr-2" />
              Nueva plantilla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ocrTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ScanLine className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No hay plantillas OCR configuradas.</p>
              <p className="text-sm">Creá plantillas para extraer datos de documentos automáticamente.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence>
                {ocrTemplates.map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group p-4 rounded-lg bg-background/60 border border-border/50 hover:border-purple-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <ScanLine className="h-4 w-4 text-purple-500 shrink-0" />
                          <p className="font-medium truncate">{template.name}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {template.regions.slice(0, 3).map((region, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs"
                            >
                              {region.type === "table" ? "📊" : "📝"} {region.label}
                            </Badge>
                          ))}
                          {template.regions.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.regions.length - 3} más
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {template.columns.length} campos • {template.regions.filter(r => r.type === "table").length} tablas
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          title="Ver plantilla"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteOcrTemplate(template.id)}
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tablas Section */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TableProperties className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Tablas por defecto</CardTitle>
                <CardDescription>
                  Tablas de datos predefinidas con sus columnas
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddTablaOpen(true)}
              className="border-blue-500/30 hover:bg-blue-500/10"
            >
              <TableProperties className="h-4 w-4 mr-2" />
              Agregar tabla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tablas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TableProperties className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No hay tablas configuradas.</p>
              <p className="text-sm">Las obras nuevas no tendrán tablas predefinidas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {tablas.map((tabla, index) => (
                  <motion.div
                    key={tabla.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-lg bg-background/60 border border-border/50 hover:border-blue-500/30 transition-colors overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() =>
                        setExpandedTablaId(expandedTablaId === tabla.id ? null : tabla.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-blue-500/10 flex items-center justify-center">
                          <TableProperties className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{tabla.name}</p>
                            <Badge
                              variant="outline"
                              className={
                                tabla.source_type === "ocr"
                                  ? "border-purple-500/50 text-purple-600 dark:text-purple-400"
                                  : "border-gray-500/50"
                              }
                            >
                              {tabla.source_type === "ocr" ? "OCR" : "Manual"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{tabla.columns.length} columnas</span>
                            {tabla.linked_folder_path && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Link2 className="h-3 w-3" />
                                  {tabla.linked_folder_path}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTabla(tabla.id);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {expandedTablaId === tabla.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {expandedTablaId === tabla.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-border/50"
                        >
                          <div className="p-3 space-y-2">
                            {tabla.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {tabla.description}
                              </p>
                            )}
                            <div className="grid gap-1">
                              {tabla.columns.map((col) => (
                                <div
                                  key={col.id || col.field_key}
                                  className="flex items-center justify-between py-1 px-2 rounded bg-muted/30 text-sm"
                                >
                                  <span className="font-medium">{col.label}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {col.data_type}
                                    </Badge>
                                    {col.required && (
                                      <Badge variant="destructive" className="text-xs">
                                        requerido
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Folder Dialog */}
      <Dialog open={isAddFolderOpen} onOpenChange={setIsAddFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-amber-500" />
              Nueva carpeta por defecto
            </DialogTitle>
            <DialogDescription>
              Esta carpeta se creará automáticamente en cada nueva obra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la carpeta</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ej. Órdenes de Compra"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddFolderOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleAddFolder()}
              disabled={isSubmittingFolder || !newFolderName.trim()}
            >
              {isSubmittingFolder ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tabla Dialog */}
      <Dialog
        open={isAddTablaOpen}
        onOpenChange={(open) => {
          setIsAddTablaOpen(open);
          if (!open) resetTablaForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-blue-500" />
              Nueva tabla por defecto
            </DialogTitle>
            <DialogDescription>
              Esta tabla se creará automáticamente en cada nueva obra.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={newTablaName}
                  onChange={(e) => setNewTablaName(e.target.value)}
                  placeholder="Ej. Materiales"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={newTablaSourceType}
                  onValueChange={(value) =>
                    setNewTablaSourceType(value as "manual" | "ocr")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="ocr">OCR (extracción automática)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={newTablaDescription}
                onChange={(e) => setNewTablaDescription(e.target.value)}
                placeholder="Contexto u objetivo de esta tabla"
                rows={2}
              />
            </div>

            {/* OCR Settings */}
            {newTablaSourceType === "ocr" && (
              <div className="space-y-4 p-4 rounded-lg border border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Settings2 className="h-4 w-4" />
                  <span className="font-medium">Configuración OCR</span>
                </div>

                <div className="space-y-2">
                  <Label>Carpeta vinculada</Label>
                  <Select
                    value={newTablaLinkedFolder}
                    onValueChange={setNewTablaLinkedFolder}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar carpeta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.path}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Los documentos subidos a esta carpeta se procesarán automáticamente
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Plantilla OCR</Label>
                  <Select
                    value={newTablaOcrTemplateId || "none"}
                    onValueChange={(value) =>
                      handleTemplateSelect(value === "none" ? null : value)
                    }
                    disabled={ocrTemplates.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar plantilla..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin plantilla (configuración manual)</SelectItem>
                      {ocrTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.columns.length} campos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {ocrTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hay plantillas disponibles todavía. Creá una en la sección superior.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Las columnas se pueden autocompletar usando una plantilla existente.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo de documento</Label>
                  <Input
                    value={newTablaOcrDocType}
                    onChange={(e) => setNewTablaOcrDocType(e.target.value)}
                    placeholder="Ej. Orden de compra"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Instrucciones adicionales (opcional)</Label>
                  <Textarea
                    value={newTablaOcrInstructions}
                    onChange={(e) => setNewTablaOcrInstructions(e.target.value)}
                    placeholder="Instrucciones específicas para la extracción..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Datos anidados</p>
                    <p className="text-xs text-muted-foreground">
                      El documento contiene listas de items
                    </p>
                  </div>
                  <Switch
                    checked={newTablaHasNestedData}
                    onCheckedChange={setNewTablaHasNestedData}
                  />
                </div>
              </div>
            )}

            <Separator />

            {/* Columns */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Columnas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddColumn}
                >
                  Agregar columna
                </Button>
              </div>

              <div className="space-y-2">
                {newTablaColumns.map((col, index) => (
                  <div
                    key={index}
                    className="grid gap-2 p-3 rounded-lg bg-muted/30 border border-border/50"
                    style={{
                      gridTemplateColumns:
                        newTablaSourceType === "ocr" && newTablaHasNestedData
                          ? "1fr 120px 100px 80px 40px"
                          : "1fr 120px 80px 40px",
                    }}
                  >
                    <Input
                      value={col.label}
                      onChange={(e) =>
                        handleColumnChange(index, "label", e.target.value)
                      }
                      placeholder="Nombre de columna"
                    />
                    <Select
                      value={col.dataType}
                      onValueChange={(value) =>
                        handleColumnChange(index, "dataType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLA_DATA_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newTablaSourceType === "ocr" && newTablaHasNestedData && (
                      <Select
                        value={col.ocrScope ?? "item"}
                        onValueChange={(value) =>
                          handleColumnChange(index, "ocrScope", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parent">Documento</SelectItem>
                          <SelectItem value="item">Item</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <div className="flex items-center justify-center">
                      <Switch
                        checked={col.required}
                        onCheckedChange={(value) =>
                          handleColumnChange(index, "required", value)
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveColumn(index)}
                      disabled={newTablaColumns.length <= 1}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {newTablaSourceType === "ocr" && newTablaHasNestedData
                  ? "Columnas: Nombre | Tipo | Scope | Requerido | Eliminar"
                  : "Columnas: Nombre | Tipo | Requerido | Eliminar"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddTablaOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleAddTabla()}
              disabled={
                isSubmittingTabla ||
                !newTablaName.trim() ||
                !newTablaColumns.some((col) => col.label.trim())
              }
            >
              {isSubmittingTabla ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TableProperties className="h-4 w-4" />
              )}
              Agregar tabla
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

