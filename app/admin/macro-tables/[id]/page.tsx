"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Layers,
  ArrowLeft,
  Save,
  Loader2,
  Database,
  Columns3,
  Plus,
  Trash2,
  Building2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Eye,
  FileStack,
  Sparkles,
  MoveHorizontal,
  PanelLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/components/ui/sortable";
import {
  PREVIEW_ROW_INDICES,
  getColumnPreviewValue,
  isBlurredPreviewRow,
} from "../column-preview";
import { useColumnResize } from "../use-column-resize";

import type { MacroTableColumnType, MacroTableDataType, MacroTable, MacroTableColumn, MacroTableSource } from "@/lib/macro-tables";

type DefaultTabla = {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  columnCount: number;
};

const normalizeTemplateName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const extractBaseTableName = (name: string) => {
  const normalized = name.trim();
  const separators = [" · ", " - ", " — ", " – ", "|", "/"];
  for (const separator of separators) {
    const idx = normalized.lastIndexOf(separator);
    if (idx > -1 && idx + separator.length < normalized.length) {
      return normalized.slice(idx + separator.length).trim();
    }
  }
  return normalized;
};

const matchesTemplateName = (tableName: string, templateName: string) => {
  const tableNorm = normalizeTemplateName(tableName);
  const tableBaseNorm = normalizeTemplateName(extractBaseTableName(tableName));
  const templateNorm = normalizeTemplateName(templateName);
  return (
    tableNorm === templateNorm ||
    tableBaseNorm === templateNorm ||
    tableNorm.endsWith(` ${templateNorm}`) ||
    tableNorm.endsWith(`· ${templateNorm}`)
  );
};

const matchesTemplate = (
  tabla: Pick<ObraTabla, "name" | "defaultTablaId">,
  template: Pick<DefaultTabla, "id" | "name">,
) => {
  if (tabla.defaultTablaId && tabla.defaultTablaId === template.id) return true;
  return matchesTemplateName(tabla.name, template.name);
};

type ObraTablaColumn = {
  id: string;
  fieldKey: string;
  label: string;
  dataType: string;
};

type ObraTabla = {
  id: string;
  obraId: string;
  name: string;
  defaultTablaId?: string | null;
  columns: ObraTablaColumn[];
};

type Obra = {
  id: string;
  designacionYUbicacion: string;
  tablas: ObraTabla[];
};

type SelectedSource = {
  obraId: string;
  obraName: string;
  tablaId: string;
  tablaName: string;
  columns: ObraTablaColumn[];
};

type ColumnConfig = {
  id: string;
  columnType: MacroTableColumnType;
  sourceFieldKey: string | null;
  label: string;
  dataType: MacroTableDataType;
};

const DATA_TYPES: MacroTableDataType[] = ["text", "number", "currency", "boolean", "date"];

type MacroTableWithDetails = MacroTable & {
  sources: (MacroTableSource & {
    obraTabla?: {
      id: string;
      name: string;
      obraId: string;
      obraName: string;
    };
  })[];
  columns: MacroTableColumn[];
};

export default function EditMacroTablePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Basic info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Available data
  const [obras, setObras] = useState<Obra[]>([]);
  const [expandedObras, setExpandedObras] = useState<Set<string>>(new Set());

  // Templates
  const [templates, setTemplates] = useState<DefaultTabla[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateTableNames, setSelectedTemplateTableNames] = useState<string[]>([]);

  // Selected sources
  const [selectedSources, setSelectedSources] = useState<SelectedSource[]>([]);

  // Column configuration
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);

  // Sidebar configuration
  type RoleOption = { id: string; key: string; name: string };
  const [sidebarRoles, setSidebarRoles] = useState<RoleOption[]>([]);
  const [selectedSidebarRoleIds, setSelectedSidebarRoleIds] = useState<Set<string>>(new Set());
  const [isSavingSidebar, setIsSavingSidebar] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);

  const columnIds = columns.map((col) => col.id);
  const { getColumnWidth, startResize } = useColumnResize(columnIds);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);

  useEffect(() => {
    if (columns.length === 0) {
      if (selectedColumnId !== null) {
        setSelectedColumnId(null);
      }
      return;
    }

    if (!selectedColumnId || !columns.some((c) => c.id === selectedColumnId)) {
      setSelectedColumnId(columns[0].id);
    }
  }, [columns, selectedColumnId]);

  const selectedColumn = selectedColumnId
    ? columns.find((c) => c.id === selectedColumnId) ?? null
    : null;

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/macro-tables/templates");
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (error) {
      console.error("Failed to load templates", error);
    }
  }, []);

  // Fetch sidebar configuration
  const fetchSidebarConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/macro-tables/${id}/sidebar`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to load sidebar config:", res.status, errorData);
        return;
      }
      const data = await res.json();
      console.log("Sidebar config loaded:", data);
      setSidebarRoles(data.roles ?? []);
      setTenantName(typeof data.tenantName === "string" ? data.tenantName : null);
      const assignedRoleIds = new Set<string>(
        (data.assignments ?? []).map((a: { role_id: string }) => a.role_id)
      );
      setSelectedSidebarRoleIds(assignedRoleIds);
    } catch (error) {
      console.error("Failed to load sidebar config", error);
    }
  }, [id]);

  // Save sidebar configuration
  const handleSaveSidebar = async () => {
    try {
      setIsSavingSidebar(true);
      const res = await fetch(`/api/macro-tables/${id}/sidebar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: Array.from(selectedSidebarRoleIds) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error saving sidebar config");
      }
      toast.success("Configuración de sidebar guardada");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error guardando configuración");
    } finally {
      setIsSavingSidebar(false);
    }
  };

  // Toggle sidebar role selection
  const toggleSidebarRole = (roleId: string) => {
    setSelectedSidebarRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  // Fetch macro table data
  const fetchMacroTable = useCallback(async () => {
    try {
      const res = await fetch(`/api/macro-tables/${id}`);
      if (!res.ok) throw new Error("Failed to load macro table");
      const data = await res.json();
      const macroTable: MacroTableWithDetails = data.macroTable;

      setName(macroTable.name);
      setDescription(macroTable.description ?? "");

      // Map sources
      const sources: SelectedSource[] = macroTable.sources.map((s) => ({
        obraId: s.obraTabla?.obraId ?? "",
        obraName: s.obraTabla?.obraName ?? "",
        tablaId: s.obraTablaId,
        tablaName: s.obraTabla?.name ?? "",
        columns: [], // Will be populated from obras fetch
      }));
      setSelectedSources(sources);

      // Map columns
      const cols: ColumnConfig[] = macroTable.columns.map((c) => ({
        id: c.id,
        columnType: c.columnType,
        sourceFieldKey: c.sourceFieldKey,
        label: c.label,
        dataType: c.dataType,
      }));
      setColumns(cols);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando macro tabla");
      router.push("/admin/macro-tables");
    }
  }, [id, router]);

  // Fetch obras and their tables
  const fetchObrasWithTablas = useCallback(async () => {
    try {
      const obrasRes = await fetch("/api/obras");
      if (!obrasRes.ok) throw new Error("Failed to load obras");
      const obrasData = await obrasRes.json();
      const obrasList = obrasData.detalleObras ?? [];

      const obrasWithTablas: Obra[] = await Promise.all(
        obrasList.map(async (obra: any) => {
          try {
            const tablasRes = await fetch(`/api/obras/${obra.id}/tablas`);
            if (!tablasRes.ok) return { ...obra, tablas: [] };
            const tablasData = await tablasRes.json();
            return {
              id: obra.id,
              designacionYUbicacion: obra.designacionYUbicacion,
              tablas: (tablasData.tablas ?? []).map((t: any) => ({
                id: t.id,
                obraId: obra.id,
                name: t.name,
                defaultTablaId:
                  typeof t?.settings?.defaultTablaId === "string" ? t.settings.defaultTablaId : null,
                columns: t.columns ?? [],
              })),
            };
          } catch {
            return { id: obra.id, designacionYUbicacion: obra.designacionYUbicacion, tablas: [] };
          }
        })
      );

      setObras(obrasWithTablas.filter((o) => o.tablas.length > 0));

      // Update selected sources with column data
      setSelectedSources((prev) =>
        prev.map((source) => {
          const obra = obrasWithTablas.find((o) => o.id === source.obraId);
          const tabla = obra?.tablas.find((t) => t.id === source.tablaId);
          return {
            ...source,
            obraName: obra?.designacionYUbicacion ?? source.obraName,
            tablaName: tabla?.name ?? source.tablaName,
            columns: tabla?.columns ?? [],
          };
        })
      );
    } catch (error) {
      console.error(error);
      toast.error("Error cargando obras y tablas");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchMacroTable();
      await fetchObrasWithTablas();
      await fetchTemplates();
      await fetchSidebarConfig();
      setIsLoading(false);
    };
    void load();
  }, [fetchMacroTable, fetchObrasWithTablas, fetchTemplates, fetchSidebarConfig]);

  // Toggle obra expansion
  const toggleObraExpansion = (obraId: string) => {
    setExpandedObras((prev) => {
      const next = new Set(prev);
      if (next.has(obraId)) {
        next.delete(obraId);
      } else {
        next.add(obraId);
      }
      return next;
    });
  };

  // Toggle table selection
  const toggleTableSelection = (obra: Obra, tabla: ObraTabla) => {
    const isSelected = selectedSources.some((s) => s.tablaId === tabla.id);

    if (isSelected) {
      setSelectedSources((prev) => prev.filter((s) => s.tablaId !== tabla.id));
    } else {
      setSelectedSources((prev) => [
        ...prev,
        {
          obraId: obra.id,
          obraName: obra.designacionYUbicacion,
          tablaId: tabla.id,
          tablaName: tabla.name,
          columns: tabla.columns,
        },
      ]);
    }
    // Clear template selection when manually selecting
    setSelectedTemplateId(null);
    setSelectedTemplateTableNames([]);
  };

  const selectAllTablesInObra = (obra: Obra) => {
    const currentIds = new Set(selectedSources.map((source) => source.tablaId));
    const additions: SelectedSource[] = obra.tablas
      .filter((tabla) => !currentIds.has(tabla.id))
      .map((tabla) => ({
        obraId: obra.id,
        obraName: obra.designacionYUbicacion,
        tablaId: tabla.id,
        tablaName: tabla.name,
        columns: tabla.columns,
      }));
    if (additions.length === 0) return;
    setSelectedSources((prev) => [...prev, ...additions]);
    setSelectedTemplateId(null);
    setSelectedTemplateTableNames([]);
  };

  const clearTablesInObra = (obraId: string) => {
    setSelectedSources((prev) => prev.filter((source) => source.obraId !== obraId));
    setSelectedTemplateId(null);
    setSelectedTemplateTableNames([]);
  };

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );

  const selectedTemplateTableOptions = useMemo(() => {
    if (!selectedTemplate) return [] as string[];
    const options = new Set<string>();
    for (const obra of obras) {
      for (const tabla of obra.tablas) {
        if (matchesTemplate(tabla, selectedTemplate)) {
          options.add(extractBaseTableName(tabla.name));
        }
      }
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b, "es"));
  }, [obras, selectedTemplate]);

  const applyTemplateSelection = useCallback(
    (templateId: string | null, onlyTableNames: string[] = []) => {
      setSelectedTemplateId(templateId);
      setSelectedTemplateTableNames(onlyTableNames);
      if (!templateId) return;

      const template = templates.find((t) => t.id === templateId);
      if (!template) return;

      const matchingTables: SelectedSource[] = [];
      for (const obra of obras) {
        for (const tabla of obra.tablas) {
          if (!matchesTemplate(tabla, template)) continue;
          const baseName = extractBaseTableName(tabla.name);
          if (onlyTableNames.length > 0 && !onlyTableNames.includes(baseName)) continue;
          matchingTables.push({
            obraId: obra.id,
            obraName: obra.designacionYUbicacion,
            tablaId: tabla.id,
            tablaName: tabla.name,
            columns: tabla.columns,
          });
        }
      }

      if (matchingTables.length === 0) {
        toast.info(
          onlyTableNames.length === 0
            ? `No se encontraron tablas con el nombre "${template.name}"`
            : `No se encontraron tablas para la selección en la plantilla "${template.name}"`
        );
        return;
      }

      setSelectedSources(matchingTables);
      toast.success(`${matchingTables.length} tablas seleccionadas automáticamente`);
    },
    [obras, templates]
  );

  // Select all tables matching a template name
  const selectByTemplate = (templateId: string | null) => {
    if (!templateId) {
      setSelectedTemplateId(null);
      setSelectedTemplateTableNames([]);
      return;
    }
    applyTemplateSelection(templateId, []);
  };

  // Count tables matching each template
  const getTemplateMatchCount = (template: DefaultTabla): number => {
    let count = 0;
    for (const obra of obras) {
      for (const tabla of obra.tablas) {
        if (matchesTemplate(tabla, template)) {
          count++;
        }
      }
    }
    return count;
  };

  // Keep source columns in sync with selected sources.
  useEffect(() => {
    const fieldKeyMap = new Map<string, { label: string; dataType: MacroTableDataType }>();
    for (const source of selectedSources) {
      for (const col of source.columns) {
        if (fieldKeyMap.has(col.fieldKey)) continue;
        fieldKeyMap.set(col.fieldKey, {
          label: col.label,
          dataType: (DATA_TYPES.includes(col.dataType as MacroTableDataType)
            ? col.dataType
            : "text") as MacroTableDataType,
        });
      }
    }
    const fieldEntries = Array.from(fieldKeyMap.entries());

    setColumns((prev) => {
      if (selectedSources.length === 0) {
        const withoutSource = prev.filter((column) => column.columnType !== "source");
        return withoutSource.length === prev.length ? prev : withoutSource;
      }

      const nonSourceColumns = prev.filter((column) => column.columnType !== "source");
      const sourceByFieldKey = new Map(
        prev
          .filter((column): column is ColumnConfig & { sourceFieldKey: string } =>
            column.columnType === "source" && typeof column.sourceFieldKey === "string"
          )
          .map((column) => [column.sourceFieldKey, column])
      );

      const syncedSourceColumns: ColumnConfig[] = fieldEntries.map(([fieldKey, info]) => {
        const existing = sourceByFieldKey.get(fieldKey);
        if (existing) {
          return { ...existing, dataType: info.dataType };
        }
        return {
          id: crypto.randomUUID(),
          columnType: "source",
          sourceFieldKey: fieldKey,
          label: info.label,
          dataType: info.dataType,
        };
      });

      const next = [...nonSourceColumns, ...syncedSourceColumns];
      const same =
        next.length === prev.length &&
        next.every((column, index) => {
          const prevColumn = prev[index];
          return (
            prevColumn &&
            prevColumn.id === column.id &&
            prevColumn.columnType === column.columnType &&
            prevColumn.sourceFieldKey === column.sourceFieldKey &&
            prevColumn.label === column.label &&
            prevColumn.dataType === column.dataType
          );
        });
      return same ? prev : next;
    });
  }, [selectedSources]);

  // Add custom column
  const addCustomColumn = () => {
    const newColumn: ColumnConfig = {
      id: crypto.randomUUID(),
      columnType: "custom",
      sourceFieldKey: null,
      label: "",
      dataType: "text",
    };

    setColumns((prev) => [...prev, newColumn]);
    setSelectedColumnId(newColumn.id);
  };

  // Add source column
  const addSourceColumn = () => {
    const newColumn: ColumnConfig = {
      id: crypto.randomUUID(),
      columnType: "source",
      sourceFieldKey: availableFieldKeys[0] ?? null,
      label: "",
      dataType: "text",
    };

    setColumns((prev) => [...prev, newColumn]);
    setSelectedColumnId(newColumn.id);
  };

  // Remove column
  const removeColumn = (colId: string) => {
    setColumns((prev) => {
      const next = prev.filter((c) => c.id !== colId);
      if (selectedColumnId === colId) {
        setSelectedColumnId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  // Update column
  const updateColumn = (colId: string, updates: Partial<ColumnConfig>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, ...updates } : c))
    );
  };

  const handleSelectColumn = (columnId: string) => {
    setSelectedColumnId(columnId);
  };

  const renderColumnOverlay = (column: ColumnConfig) => (
    <div
      className="rounded-none border bg-background shadow-lg"
      style={{ width: getColumnWidth(column.id) }}
    >
      <div className="space-y-1 border-b border-border/60 px-4 py-3">
        <p className="font-semibold">{column.label || "Sin nombre"}</p>
        <Badge
          variant={
            column.columnType === "custom"
              ? "default"
              : column.columnType === "computed"
                ? "secondary"
                : "outline"
          }
          className={cn(
            "text-[10px]",
            column.columnType === "custom" && "bg-purple-500",
            column.columnType === "computed" && "bg-amber-500/80"
          )}
        >
          {column.columnType === "custom"
            ? "Personalizada"
            : column.columnType === "computed"
              ? "Calculada"
              : "Fuente"}
        </Badge>
      </div>
      <div className="grid grid-rows-[repeat(3,minmax(0,1fr))]">
        {PREVIEW_ROW_INDICES.map((rowIndex) => (
          <div
            key={`${column.id}-overlay-${rowIndex}`}
            className={cn(
              "border-t border-border/60 px-4 py-3 text-sm font-medium",
              rowIndex === 0 && "border-t-0",
              isBlurredPreviewRow(rowIndex) && "opacity-60 blur-[0.5px]"
            )}
          >
            {getColumnPreviewValue(column.columnType, column.dataType, rowIndex)}
          </div>
        ))}
      </div>
    </div>
  );

  // Get all available field keys from selected sources
  const availableFieldKeys = Array.from(
    new Set(selectedSources.flatMap((s) => s.columns.map((c) => c.fieldKey)))
  );

  // Save
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (selectedSources.length === 0) {
      toast.error("Seleccioná al menos una tabla fuente");
      return;
    }

    if (columns.length === 0 || !columns.every((c) => c.label.trim())) {
      toast.error("Todas las columnas deben tener nombre");
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        sources: selectedSources.map((s) => ({ obraTablaId: s.tablaId })),
        columns: columns.map((c) => ({
          columnType: c.columnType,
          sourceFieldKey: c.sourceFieldKey,
          label: c.label.trim(),
          dataType: c.dataType,
          config: c.columnType === "computed" ? { compute: "obra_name" } : {},
        })),
      };

      const res = await fetch(`/api/macro-tables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error saving macro table");
      }

      toast.success("Macro tabla guardada");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error guardando macro tabla");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/macro-tables")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Editar macro tabla</h1>
            <p className="text-muted-foreground">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/macro?macroId=${id}`)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Ver datos
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info" className="gap-2">
            <Layers className="h-4 w-4" />
            Información
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-2">
            <Database className="h-4 w-4" />
            Tablas fuente
          </TabsTrigger>
          <TabsTrigger value="columns" className="gap-2">
            <Columns3 className="h-4 w-4" />
            Columnas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="space-y-6">
            <Card className="border-cyan-500/20">
              <CardHeader>
                <CardTitle className="text-lg">Información básica</CardTitle>
                <CardDescription>
                  Nombre y descripción de la macro tabla
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Resumen de materiales"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe el propósito de esta macro tabla..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-500/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PanelLeft className="h-5 w-5 text-purple-500" />
                  <div>
                    <CardTitle className="text-lg">Visibilidad en Sidebar</CardTitle>
                    <CardDescription>
                      Seleccioná qué roles pueden ver esta tabla en el menú lateral
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {sidebarRoles.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    {`No hay roles configurados para la organización ${tenantName ?? "actual"}.`}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sidebarRoles.map((role) => {
                      const isSelected = selectedSidebarRoleIds.has(role.id);
                      return (
                        <label
                          key={role.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            isSelected
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSidebarRole(role.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{role.name}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {selectedSidebarRoleIds.size === 0
                      ? "Esta tabla no aparecerá en el sidebar de ningún rol"
                      : `Visible para ${selectedSidebarRoleIds.size} ${selectedSidebarRoleIds.size === 1 ? "rol" : "roles"}`}
                  </p>
                  <Button
                    onClick={handleSaveSidebar}
                    disabled={isSavingSidebar}
                    size="sm"
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {isSavingSidebar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar visibilidad
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources">
          <Card className="border-cyan-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Tablas fuente</CardTitle>
                  <CardDescription>
                    Tablas de las que se agregan datos
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Database className="h-3 w-3" />
                  {selectedSources.length} seleccionadas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Quick Select */}
              {templates.length > 0 && (
                <div className="p-4 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-800 dark:text-amber-300">
                      Selección rápida por plantilla
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Seleccioná una plantilla para agregar automáticamente todas las tablas
                    que coincidan en todas las obras.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => {
                      const matchCount = getTemplateMatchCount(template);
                      const isSelected = selectedTemplateId === template.id;

                      return (
                        <Button
                          key={template.id}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => selectByTemplate(isSelected ? null : template.id)}
                          className={cn(
                            "gap-2",
                            isSelected && "bg-amber-500 hover:bg-amber-600",
                            !isSelected && "border-amber-500/30 hover:bg-amber-500/10"
                          )}
                          disabled={matchCount === 0}
                        >
                          <FileStack className="h-3.5 w-3.5" />
                          {template.name}
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className={cn(
                              "text-xs ml-1",
                              matchCount === 0 && "opacity-50"
                            )}
                          >
                            {matchCount} {matchCount === 1 ? "tabla" : "tablas"}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>
                  {selectedTemplate && selectedTemplateTableOptions.length > 1 && (
                    <div className="mt-3 space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Dentro de {selectedTemplate.name}, elegí tablas:
                      </Label>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedTemplateTableNames.length === 0}
                            onCheckedChange={(checked) => {
                              if (!checked) return;
                              applyTemplateSelection(selectedTemplate.id, []);
                            }}
                          />
                          <span>Todas</span>
                        </label>
                        {selectedTemplateTableOptions.map((tableName) => {
                          const allSelected = selectedTemplateTableNames.length === 0;
                          const isChecked = allSelected || selectedTemplateTableNames.includes(tableName);
                          return (
                            <label key={tableName} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const checkedBool = Boolean(checked);
                                  if (allSelected) {
                                    if (checkedBool) return;
                                    applyTemplateSelection(
                                      selectedTemplate.id,
                                      selectedTemplateTableOptions.filter((name) => name !== tableName)
                                    );
                                    return;
                                  }
                                  const current = selectedTemplateTableNames;
                                  if (checkedBool) {
                                    if (current.includes(tableName)) return;
                                    applyTemplateSelection(selectedTemplate.id, [...current, tableName]);
                                    return;
                                  }
                                  if (!current.includes(tableName)) return;
                                  if (current.length === 1) return;
                                  applyTemplateSelection(
                                    selectedTemplate.id,
                                    current.filter((name) => name !== tableName)
                                  );
                                }}
                              />
                              <span>{tableName}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />
              <p className="text-xs text-muted-foreground">
                Expandí una obra para elegir tablas individuales, o usá los botones "Todas" y "Ninguna" por obra.
              </p>

              {obras.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No hay tablas disponibles.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                  {obras.map((obra) => {
                    const isExpanded = expandedObras.has(obra.id);
                    const selectedCount = selectedSources.filter(
                      (s) => s.obraId === obra.id
                    ).length;

                    return (
                      <div
                        key={obra.id}
                        className="rounded-lg border border-border/50 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleObraExpansion(obra.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{obra.designacionYUbicacion}</span>
                            <Badge variant="outline" className="text-xs">
                              {obra.tablas.length} tablas
                            </Badge>
                            {selectedCount > 0 && (
                              <Badge className="text-xs bg-cyan-500">
                                {selectedCount} seleccionadas
                              </Badge>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        <div className="px-3 pb-2 -mt-1 flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              selectAllTablesInObra(obra);
                            }}
                          >
                            Todas
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              clearTablesInObra(obra.id);
                            }}
                          >
                            Ninguna
                          </Button>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-border/50"
                            >
                              <div className="p-2 space-y-1">
                                {obra.tablas.map((tabla) => {
                                  const isSelected = selectedSources.some(
                                    (s) => s.tablaId === tabla.id
                                  );

                                  return (
                                    <label
                                      key={tabla.id}
                                      className={cn(
                                        "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                                        isSelected
                                          ? "bg-cyan-500/10"
                                          : "hover:bg-muted/50"
                                      )}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() =>
                                          toggleTableSelection(obra, tabla)
                                        }
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{tabla.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {tabla.columns.length} columnas
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="columns">
          <Card className="border-cyan-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Columnas</CardTitle>
                  <CardDescription>
                    Configurá las columnas de la macro tabla
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={addSourceColumn} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Columna fuente
                  </Button>
                  <Button variant="outline" size="sm" onClick={addCustomColumn} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Columna personalizada
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
                <div className="rounded-2xl border bg-card/70 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold">Vista previa ampliada</p>
                      <p className="text-xs text-muted-foreground">
                        Click en una columna para editarla en el panel lateral
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {columns.length} columnas
                    </Badge>
                  </div>

                  {columns.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                      Todavía no hay columnas configuradas para esta macro tabla.
                    </div>
                  ) : (
                    <div className="overflow-auto px-2 py-4">
                      <Sortable
                        value={columns}
                        onValueChange={setColumns}
                        getItemValue={(col) => col.id}
                        orientation="horizontal"
                        onDragStart={(event) => {
                          const id = event.active?.id;
                          if (typeof id === "string") setDraggingColumnId(id);
                        }}
                        onDragCancel={() => setDraggingColumnId(null)}
                        onDragEnd={() => setDraggingColumnId(null)}
                      >
                        <div className="inline-block min-w-full align-middle">
                          <table className="w-full table-fixed border-collapse text-sm">
                            <colgroup>
                              {columns.map((col) => (
                                <col
                                  key={`${col.id}-width`}
                                  style={{ width: `${getColumnWidth(col.id)}px` }}
                                />
                              ))}
                            </colgroup>
                            <SortableContent withoutSlot>
                              <thead >
                                <tr>
                                  {columns.map((col) => {
                                    const isSelected = col.id === selectedColumnId;
                                    return (
                                      <SortableItem key={col.id} value={col.id} asChild>
                                        <th
                                          scope="col"
                                          onClick={() => handleSelectColumn(col.id)}
                                          className={cn(
                                            "cursor-pointer border-b-2 border-r-2 border-muted px-6 py-3 text-left font-semibold transition relative",
                                            isSelected
                                              ? "bg-orange-50 text-orange-900"
                                              : "text-muted-foreground hover:bg-muted/30",
                                            draggingColumnId === col.id && "opacity-0"
                                          )}
                                        >
                                          <div className="flex items-center gap-2">
                                            <SortableItemHandle
                                              aria-label="Reordenar columna"
                                              className="absolute left-0 top-0 h-full w-6 shrink-0 rounded-none border border-dashed border-border/70 text-muted-foreground"
                                            >
                                              <GripVertical className="h-4 w-4" />
                                            </SortableItemHandle>
                                            <div className="flex-1 space-y-1">
                                              <p className="truncate font-semibold leading-tight">
                                                {col.label || "Sin nombre"}
                                              </p>
                                              <Badge
                                                variant={
                                                  col.columnType === "custom"
                                                    ? "default"
                                                    : col.columnType === "computed"
                                                      ? "secondary"
                                                      : "outline"
                                                }
                                                className={cn(
                                                  "text-[10px]",
                                                  col.columnType === "custom" && "bg-purple-500",
                                                  col.columnType === "computed" && "bg-amber-500/80"
                                                )}
                                              >
                                                {col.columnType === "custom"
                                                  ? "Personalizada"
                                                  : col.columnType === "computed"
                                                    ? "Calculada"
                                                    : "Fuente"}
                                              </Badge>
                                            </div>
                                            <button
                                              type="button"
                                              aria-label="Ajustar ancho de columna"
                                              className="absolute right-0 top-0 h-full w-4 shrink-0 cursor-col-resize rounded-none hover:bg-muted/50"
                                              onPointerDown={(event) => startResize(col.id, event)}
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              <MoveHorizontal className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </th>
                                      </SortableItem>
                                    );
                                  })}
                                </tr>
                              </thead>
                            </SortableContent>
                            <SortableOverlay>
                              {({ value }) => {
                                const overlayColumn = columns.find((c) => c.id === value);
                                return overlayColumn ? renderColumnOverlay(overlayColumn) : null;
                              }}
                            </SortableOverlay>
                            <tbody>
                              {PREVIEW_ROW_INDICES.map((rowIndex) => (
                                <tr key={`preview-row-${rowIndex}`}>
                                  {columns.map((col) => {
                                    const isSelected = col.id === selectedColumnId;
                                    return (
                                      <td
                                        key={`${col.id}-preview-${rowIndex}`}
                                        onClick={() => handleSelectColumn(col.id)}
                                        className={cn(
                                          "cursor-pointer border-b-2 border-r-2 border-muted px-4 py-3 font-medium transition",
                                          rowIndex === PREVIEW_ROW_INDICES.length - 1 && "border-b-0",
                                          isBlurredPreviewRow(rowIndex) && "opacity-60 blur-[1.5px]",
                                          isSelected
                                            ? "bg-orange-50 text-orange-900"
                                            : "text-foreground hover:bg-muted/30",
                                          draggingColumnId === col.id && "opacity-0"
                                        )}
                                      >
                                        {getColumnPreviewValue(col.columnType, col.dataType, rowIndex)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Sortable>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Panel de columnas</p>
                      <p className="text-xs text-muted-foreground">
                        Configurá cada columna
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-[220px,1fr]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Columnas
                      </p>
                      <div className="mt-3 space-y-2">
                        {columns.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                            Aún no hay columnas configuradas.
                          </div>
                        ) : (
                          columns.map((col) => {
                            const isSelected = col.id === selectedColumnId;
                            return (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => handleSelectColumn(col.id)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
                                  isSelected
                                    ? "border-orange-400 bg-orange-50 text-orange-900 shadow-sm"
                                    : "border-border/70 bg-background hover:border-primary/30"
                                )}
                              >
                                <div>
                                  <p className="font-medium">{col.label || "Sin nombre"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {col.columnType === "custom"
                                      ? "Personalizada"
                                      : col.columnType === "computed"
                                        ? "Calculada"
                                        : "Fuente"}
                                  </p>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                      {selectedColumn ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <Badge
                              variant={
                                selectedColumn.columnType === "custom"
                                  ? "default"
                                  : selectedColumn.columnType === "computed"
                                    ? "secondary"
                                    : "outline"
                              }
                              className={cn(
                                selectedColumn.columnType === "custom" && "bg-purple-500",
                                selectedColumn.columnType === "computed" && "bg-amber-500/80"
                              )}
                            >
                              {selectedColumn.columnType === "custom"
                                ? "Columna personalizada"
                                : selectedColumn.columnType === "computed"
                                  ? "Columna calculada"
                                  : "Columna fuente"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => removeColumn(selectedColumn.id)}
                              aria-label="Eliminar columna seleccionada"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <Label>Nombre de la columna</Label>
                            <Input
                              value={selectedColumn.label}
                              onChange={(e) =>
                                updateColumn(selectedColumn.id, { label: e.target.value })
                              }
                              placeholder="Ej: Proveedor asignado"
                            />
                          </div>

                          {selectedColumn.columnType === "source" && (
                            <div className="space-y-2">
                              <Label>Campo de origen</Label>
                              <Select
                                value={selectedColumn.sourceFieldKey ?? ""}
                                onValueChange={(value) =>
                                  updateColumn(selectedColumn.id, { sourceFieldKey: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccioná un campo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableFieldKeys.map((key) => (
                                    <SelectItem key={key} value={key}>
                                      {key}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Tipo de dato</Label>
                            <Select
                              value={selectedColumn.dataType}
                              onValueChange={(value) =>
                                updateColumn(selectedColumn.id, {
                                  dataType: value as MacroTableDataType,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Tipo de dato" />
                              </SelectTrigger>
                              <SelectContent>
                                {DATA_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedColumn.columnType === "computed" && (
                            <p className="text-xs text-amber-600">
                              Las columnas calculadas se generan automáticamente y no pueden editarse
                              manualmente.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Seleccioná una columna para ver sus detalles.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                <span className="text-purple-500">● Personalizadas</span> son editables.{" "}
                <span className="text-amber-500">● Calculadas</span> se generan automáticamente.{" "}
                <span>● Fuente</span> provienen de las tablas seleccionadas (solo lectura).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
