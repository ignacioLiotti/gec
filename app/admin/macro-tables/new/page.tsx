"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Layers,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Loader2,
  Database,
  Columns3,
  Plus,
  Trash2,
  Check,
  Building2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  FileStack,
  Sparkles,
  MoveHorizontal,
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

import type { MacroTableColumnType, MacroTableDataType } from "@/lib/macro-tables";

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

type DefaultTabla = {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  columnCount: number;
};

type MainTableColumnConfig = {
  id: string;
  kind: "base" | "formula" | "custom";
  label: string;
  enabled: boolean;
  formulaFormat?: "number" | "currency";
  cellType?: string;
};

type AvailableSourceColumn = {
  key: string;
  label: string;
  dataType: MacroTableDataType;
};

type ObraApiItem = {
  id: string;
  designacionYUbicacion: string;
};

type ObraTablaApiItem = {
  id: string;
  name: string;
  settings?: { defaultTablaId?: string | null } | null;
  columns?: ObraTablaColumn[];
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

const STEPS = [
  { id: "info", label: "Información", icon: Layers },
  { id: "sources", label: "Tablas fuente", icon: Database },
  { id: "columns", label: "Columnas", icon: Columns3 },
];

const DATA_TYPES: MacroTableDataType[] = ["text", "number", "currency", "boolean", "date"];

export default function NewMacroTablePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Basic info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Available data
  const [obras, setObras] = useState<Obra[]>([]);
  const [expandedObras, setExpandedObras] = useState<Set<string>>(new Set());
  const [obrasTableSourceColumns, setObrasTableSourceColumns] = useState<ObraTablaColumn[]>([]);

  // Templates
  const [templates, setTemplates] = useState<DefaultTabla[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateTableNames, setSelectedTemplateTableNames] = useState<string[]>([]);

  // Step 2: Selected sources
  const [selectedSources, setSelectedSources] = useState<SelectedSource[]>([]);

  // Step 3: Column configuration
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);

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

  const mapMainColumnTypeToMacroType = useCallback(
    (column: MainTableColumnConfig): MacroTableDataType => {
      if (column.formulaFormat === "currency") return "currency";
      if (column.formulaFormat === "number") return "number";
      if (column.cellType === "currency") return "currency";
      if (column.cellType === "number") return "number";
      if (column.cellType === "date") return "date";
      if (
        column.cellType === "boolean" ||
        column.cellType === "checkbox" ||
        column.cellType === "toggle"
      ) {
        return "boolean";
      }
      return "text";
    },
    []
  );

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

  // Fetch obras and their tables
  const fetchObrasWithTablas = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch all obras
      const obrasRes = await fetch("/api/obras");
      if (!obrasRes.ok) throw new Error("Failed to load obras");
      const obrasData = (await obrasRes.json()) as { detalleObras?: ObraApiItem[] };
      const obrasList = obrasData.detalleObras ?? [];

      // Fetch tablas for each obra
      const obrasWithTablas: Obra[] = await Promise.all(
        obrasList.map(async (obra) => {
          try {
            const tablasRes = await fetch(`/api/obras/${obra.id}/tablas`);
            if (!tablasRes.ok) return { ...obra, tablas: [] };
            const tablasData = (await tablasRes.json()) as { tablas?: ObraTablaApiItem[] };
            return {
              id: obra.id,
              designacionYUbicacion: obra.designacionYUbicacion,
              tablas: (tablasData.tablas ?? []).map((t) => ({
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

      // Filter to only obras that have tablas
      setObras(obrasWithTablas.filter((o) => o.tablas.length > 0));
    } catch (error) {
      console.error(error);
      toast.error("Error cargando obras y tablas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMainTableColumns = useCallback(async () => {
    try {
      const res = await fetch("/api/main-table-config", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as { columns?: MainTableColumnConfig[] };
      const rawColumns = Array.isArray(payload.columns) ? payload.columns : [];
      const mapped: ObraTablaColumn[] = rawColumns
        .filter((column) => column && column.enabled !== false && typeof column.id === "string")
        .map((column) => ({
          id: `obra-${column.id}`,
          fieldKey: `obra.${column.id}`,
          label: `Obra · ${column.label || column.id}`,
          dataType: mapMainColumnTypeToMacroType(column),
        }));
      setObrasTableSourceColumns(mapped);
    } catch (error) {
      console.error("Failed to load main table columns", error);
    }
  }, [mapMainColumnTypeToMacroType]);

  useEffect(() => {
    void fetchObrasWithTablas();
    void fetchTemplates();
    void fetchMainTableColumns();
  }, [fetchMainTableColumns, fetchObrasWithTablas, fetchTemplates]);

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

  const selectedTableSourceColumns = useMemo(() => {
    const byKey = new Map<string, AvailableSourceColumn>();

    for (const source of selectedSources) {
      for (const col of source.columns) {
        if (byKey.has(col.fieldKey)) continue;
        byKey.set(col.fieldKey, {
          key: col.fieldKey,
          label: col.label || col.fieldKey,
          dataType: (DATA_TYPES.includes(col.dataType as MacroTableDataType)
            ? col.dataType
            : "text") as MacroTableDataType,
        });
      }
    }

    return Array.from(byKey.values());
  }, [selectedSources]);

  const availableSourceColumns = useMemo(() => {
    const byKey = new Map<string, AvailableSourceColumn>();

    for (const sourceColumn of selectedTableSourceColumns) {
      byKey.set(sourceColumn.key, sourceColumn);
    }

    for (const obraColumn of obrasTableSourceColumns) {
      if (byKey.has(obraColumn.fieldKey)) continue;
      byKey.set(obraColumn.fieldKey, {
        key: obraColumn.fieldKey,
        label: obraColumn.label || obraColumn.fieldKey,
        dataType: (DATA_TYPES.includes(obraColumn.dataType as MacroTableDataType)
          ? obraColumn.dataType
          : "text") as MacroTableDataType,
      });
    }

    return Array.from(byKey.values());
  }, [obrasTableSourceColumns, selectedTableSourceColumns]);

  // Keep source columns in sync with selected source tables (prefill only table columns),
  // while preserving manually added source columns from other available origins (e.g. obra.*).
  useEffect(() => {
    if (currentStep !== 2) return;

    const fieldEntries = selectedTableSourceColumns.map((sourceColumn) => [
      sourceColumn.key,
      { label: sourceColumn.label, dataType: sourceColumn.dataType },
    ] as const);
    const availableOptionsByKey = new Map(availableSourceColumns.map((column) => [column.key, column]));

    setColumns((prev) => {
      if (selectedSources.length === 0) {
        const withoutSource = prev.filter((column) => column.columnType !== "source");
        return withoutSource.length === prev.length ? prev : withoutSource;
      }

      if (prev.length === 0) {
        const generated: ColumnConfig[] = [
          {
            id: crypto.randomUUID(),
            columnType: "computed",
            sourceFieldKey: null,
            label: "Obra",
            dataType: "text",
          },
        ];
        for (const [fieldKey, info] of fieldEntries) {
          generated.push({
            id: crypto.randomUUID(),
            columnType: "source",
            sourceFieldKey: fieldKey,
            label: info.label,
            dataType: info.dataType,
          });
        }
        return generated;
      }

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

      const syncedSourceByFieldKey = new Map(
        syncedSourceColumns.map((column) => [column.sourceFieldKey as string, column])
      );
      const consumedSourceKeys = new Set<string>();
      const next: ColumnConfig[] = [];

      for (const column of prev) {
        if (column.columnType !== "source") {
          next.push(column);
          continue;
        }
        if (typeof column.sourceFieldKey !== "string") {
          continue;
        }

        const syncedColumn = syncedSourceByFieldKey.get(column.sourceFieldKey);
        if (syncedColumn) {
          next.push(syncedColumn);
          consumedSourceKeys.add(column.sourceFieldKey);
          continue;
        }

        const availableOption = availableOptionsByKey.get(column.sourceFieldKey);
        if (availableOption) {
          next.push({ ...column, dataType: availableOption.dataType });
        }
      }

      for (const [fieldKey, syncedColumn] of syncedSourceByFieldKey) {
        if (!consumedSourceKeys.has(fieldKey)) {
          next.push(syncedColumn);
        }
      }

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
  }, [availableSourceColumns, currentStep, selectedSources.length, selectedTableSourceColumns]);

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

  // Remove column
  const removeColumn = (id: string) => {
    setColumns((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (selectedColumnId === id) {
        setSelectedColumnId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  // Update column
  const updateColumn = (id: string, updates: Partial<ColumnConfig>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleSelectColumn = (columnId: string) => {
    setSelectedColumnId(columnId);
  };

  const moveColumn = (columnId: string, direction: "up" | "down") => {
    setColumns((prev) => {
      const currentIndex = prev.findIndex((column) => column.id === columnId);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
  };

  const renderColumnOverlay = (column: ColumnConfig) => (
    <div
      className="rounded-xl border bg-background shadow-lg"
      style={{ width: getColumnWidth(column.id) }}
    >
      <div className="space-y-1 border-b border-border/60 px-4 py-3">
        <p className="font-semibold">{column.label.trim() || "Sin nombre"}</p>
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

  // Get all available field keys from selected source tables + obras main table
  const availableFieldKeys = availableSourceColumns.map((column) => column.key);
  const availableFieldOptionsByKey = useMemo(
    () => new Map(availableSourceColumns.map((column) => [column.key, column])),
    [availableSourceColumns]
  );

  // Validation
  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return name.trim().length > 0;
      case 1:
        return selectedSources.length > 0;
      case 2:
        return columns.length > 0 && columns.every((c) => c.label.trim());
      default:
        return false;
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!canProceedFromStep(2)) return;

    try {
      setIsSubmitting(true);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        sources: selectedSources.map((s) => ({ obraTablaId: s.tablaId })),
        columns: columns.map((c, index) => ({
          columnType: c.columnType,
          sourceFieldKey: c.sourceFieldKey,
          label: c.label.trim(),
          dataType: c.dataType,
          config:
            c.columnType === "computed"
              ? { compute: "obra_name" }
              : {},
        })),
      };

      const res = await fetch("/api/macro-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creating macro table");
      }

      const { macroTable } = await res.json();
      toast.success("Macro tabla creada exitosamente");
      router.push(`/macro?macroId=${macroTable.id}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error creando macro tabla");
    } finally {
      setIsSubmitting(false);
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
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/macro-tables")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva macro tabla</h1>
          <p className="text-muted-foreground">
            Combiná datos de múltiples tablas en una sola vista
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => {
                  if (index < currentStep) setCurrentStep(index);
                }}
                disabled={index > currentStep}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  isActive && "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
                  isCompleted && "text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/5",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    isActive && "bg-cyan-500 text-white",
                    isCompleted && "bg-cyan-500/20 text-cyan-600",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="font-medium hidden sm:inline">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-2",
                    index < currentStep ? "bg-cyan-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="border-cyan-500/20 max-w-full">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Basic Info */}
            {currentStep === 0 && (
              <motion.div
                key="step-info"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <CardTitle className="text-lg">Información básica</CardTitle>
                  <CardDescription>
                    Definí el nombre y descripción de la macro tabla
                  </CardDescription>
                </div>

                <div className="space-y-4">
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
                </div>
              </motion.div>
            )}

            {/* Step 2: Select Sources */}
            {currentStep === 1 && (
              <motion.div
                key="step-sources"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Seleccionar tablas fuente</CardTitle>
                    <CardDescription>
                      Elegí las tablas de las que querés agregar datos
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Database className="h-3 w-3" />
                    {selectedSources.length} seleccionadas
                  </Badge>
                </div>

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
                  Expandí una obra para elegir tablas individuales, o usá los botones &quot;Todas&quot; y &quot;Ninguna&quot; por obra.
                </p>

                {obras.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No hay tablas disponibles.</p>
                    <p className="text-sm mb-4">Creá tablas en tus obras primero.</p>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/admin/obra-defaults")}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Ir a Obras para crear tablas
                    </Button>
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

                {/* Selected sources summary */}
                {selectedSources.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Tablas seleccionadas:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSources.map((source) => (
                        <Badge
                          key={source.tablaId}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {source.obraName} → {source.tablaName}
                          <button
                            onClick={() =>
                              setSelectedSources((prev) =>
                                prev.filter((s) => s.tablaId !== source.tablaId)
                              )
                            }
                            className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Configure Columns */}
            {currentStep === 2 && (
              <motion.div
                key="step-columns"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Configurar columnas</CardTitle>
                    <CardDescription>
                      Visualizá la tabla y ajustá cada columna con más espacio y claridad
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addCustomColumn} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Columna personalizada
                  </Button>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                  <div className="rounded-2xl border bg-card/70 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold">Vista previa de la macro tabla</p>
                        <p className="text-xs text-muted-foreground">
                          Hacé click en una columna para editarla desde el panel lateral
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {columns.length} columnas
                      </Badge>
                    </div>

                    {columns.length === 0 ? (
                      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                        Seleccioná tablas fuente o agregá columnas personalizadas para comenzar.
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
                                <thead>
                                  <tr>
                                    {columns.map((col) => {
                                      const isSelected = col.id === selectedColumnId;
                                      return (
                                        <SortableItem key={col.id} value={col.id} asChild>
                                          <th
                                            scope="col"
                                            onClick={() => handleSelectColumn(col.id)}
                                            className={cn(
                                              "cursor-pointer border-b border-border/60 px-4 py-3 text-left font-semibold transition",
                                              isSelected
                                                ? "bg-orange-50 text-orange-900"
                                                : "text-muted-foreground hover:bg-muted/30",
                                              draggingColumnId === col.id && "opacity-0"
                                            )}
                                          >
                                            <div className="flex items-center gap-2">
                                              <SortableItemHandle
                                                aria-label="Reordenar columna"
                                                className="h-8 w-8 shrink-0 rounded-md border border-dashed border-border/70 text-muted-foreground"
                                              >
                                                <GripVertical className="h-4 w-4" />
                                              </SortableItemHandle>
                                              <div className="flex-1 space-y-1">
                                                <p className="truncate font-semibold leading-tight">
                                                  {col.label.trim() || "Sin nombre"}
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
                                                className="flex h-8 w-8 shrink-0 cursor-col-resize items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground hover:bg-muted/50"
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
                                            "cursor-pointer border-b border-border/40 px-4 py-3 font-medium transition",
                                            rowIndex === PREVIEW_ROW_INDICES.length - 1 && "border-b-0",
                                            isBlurredPreviewRow(rowIndex) && "opacity-60 blur-[0.5px]",
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
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Panel de columnas</p>
                        <p className="text-xs text-muted-foreground">
                          Ordená y editá cada columna desde acá
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={addCustomColumn} className="gap-1">
                        <Plus className="h-4 w-4" />
                        Nueva personalizada
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-[220px,1fr]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Orden
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
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveColumn(selectedColumn.id, "up")}
                                  aria-label="Mover columna arriba"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveColumn(selectedColumn.id, "down")}
                                  aria-label="Mover columna abajo"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
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
                                        {availableFieldOptionsByKey.get(key)?.label ?? key}
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
                                Las columnas calculadas se generan automáticamente y no son
                                editables por los usuarios finales.
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

                <p className="text-xs text-muted-foreground">
                  <span className="text-purple-500">● Personalizadas</span> son editables.{" "}
                  <span className="text-amber-500">● Calculadas</span> se generan automáticamente.{" "}
                  <span>● Fuente</span> provienen de las tablas seleccionadas (solo lectura).
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={() => setCurrentStep((prev) => prev + 1)}
            disabled={!canProceedFromStep(currentStep)}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            Siguiente
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceedFromStep(currentStep)}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Crear macro tabla
          </Button>
        )}
      </div>
    </div>
  );
}
