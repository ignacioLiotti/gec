"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DOCUMENT_TYPE_LABELS,
  type DocumentTemplateSummary,
  type FolderFieldSuggestion,
  normalizeDocumentType,
  normalizeTemplateSchema,
  renderDocumentHtml,
  type TemplateAutoPopulate,
  type TemplateField,
  type TemplateFieldType,
  type TemplateSelectMode,
} from "@/lib/document-generation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { normalizeFieldKey } from "@/lib/tablas";
import { cn } from "@/lib/utils";
import { DocumentGenerationNav } from "./document-nav";

type FolderConfig = {
  path: string;
  name: string;
  allowedDocumentTypes: string[];
  defaultDocumentType: string | null;
};

type TemplateConfigResponse = {
  templates: DocumentTemplateSummary[];
  folderConfigs: FolderConfig[];
  folderFieldSuggestions: Record<string, FolderFieldSuggestion[]>;
};

type Props = {
  workId: string;
  permissions?: DocumentGenerationPermissionMap | null;
};

type EditableTemplate = {
  id: string;
  name: string;
  description: string;
  documentType: string;
  targetFolderPath: string;
  status: string;
  contentHtml: string;
  fields: TemplateField[];
};

const FIELD_TYPE_OPTIONS: TemplateFieldType[] = [
  "text",
  "textarea",
  "number",
  "money",
  "table",
  "date",
  "select",
  "work_reference",
  "supplier_reference",
];

const FIELD_TYPE_LABELS: Record<TemplateFieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  number: "Numero",
  money: "Importe",
  table: "Tabla",
  date: "Fecha",
  select: "Lista",
  work_reference: "Obra",
  supplier_reference: "Proveedor",
};

const SELECT_MODE_OPTIONS: Array<{ value: TemplateSelectMode; label: string }> = [
  { value: "strict", label: "Lista estricta" },
  { value: "creatable", label: "Combo editable" },
];

const AUTO_POPULATE_OPTIONS: Array<{ value: TemplateAutoPopulate; label: string }> = [
  { value: "none", label: "Sin autocompletar" },
  { value: "selected_context_label", label: "Contexto seleccionado" },
  { value: "selected_context_id", label: "ID del contexto" },
  { value: "document_type", label: "Tipo documental" },
  { value: "next_sequence_number", label: "Siguiente numero de secuencia" },
  { value: "today", label: "Fecha actual" },
];

function createDefaultTableColumns(): TemplateField[] {
  return [
    { key: "cantidad", label: "Cantidad", type: "number", required: false, source: "extra" },
    { key: "unidad", label: "Unidad", type: "text", required: false, source: "extra" },
    { key: "detalle", label: "Detalle", type: "text", required: false, source: "extra" },
    { key: "precio_unitario", label: "Precio unitario", type: "money", required: false, source: "extra" },
  ];
}

function formatFieldsJson(fields: TemplateField[]) {
  return JSON.stringify(fields, null, 2);
}

function parseFieldsJson(value: string): TemplateField[] {
  const parsed = JSON.parse(value) as unknown;
  const fields = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { fields?: unknown }).fields)
      ? (parsed as { fields: unknown[] }).fields
      : null;

  if (!fields) {
    throw new Error('El JSON debe ser un array de campos o un objeto con "fields".');
  }

  return normalizeTemplateSchema({ fields }).fields;
}

function humanizeFieldKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferFieldType(key: string): TemplateFieldType {
  if (key.includes("fecha")) return "date";
  if (
    key.includes("precio") ||
    key.includes("importe") ||
    key.includes("subtotal") ||
    key.includes("total") ||
    key.includes("recargo") ||
    key.includes("bonificacion")
  ) {
    return "money";
  }
  if (key.includes("cantidad") || key.includes("porcentaje")) return "number";
  if (key.includes("observaciones")) return "textarea";
  if (key.includes("obra")) return "work_reference";
  if (key.includes("proveedor")) return "supplier_reference";
  return "text";
}

function createFieldFromKey(key: string, existing?: TemplateField): TemplateField {
  return {
    key,
    label: existing?.label ?? humanizeFieldKey(key),
    type: existing?.type && existing.type !== "table" ? existing.type : inferFieldType(key),
    required: existing?.required ?? false,
    source: existing?.source ?? "extra",
    description: existing?.description ?? "",
    defaultValue: existing?.defaultValue,
    options: existing?.options,
    selectMode: existing?.selectMode,
    autoPopulate: existing?.autoPopulate,
  };
}

function extractVariables(html: string) {
  return Array.from(html.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
}

function syncFieldsFromHtml(html: string, currentFields: TemplateField[]) {
  const byKey = new Map(currentFields.map((field) => [field.key, field]));
  const consumedColumnKeys = new Set<string>();
  const tableFields: TemplateField[] = [];
  let htmlWithoutTableBodies = html;

  for (const match of html.matchAll(/\{\{#\s*([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g)) {
    const tableKey = match[1];
    const tableBody = match[2];
    htmlWithoutTableBodies = htmlWithoutTableBodies.replace(match[0], "");
    const existingTable = byKey.get(tableKey);
    const existingColumns = new Map((existingTable?.columns ?? []).map((column) => [column.key, column]));
    const columnKeys = Array.from(new Set(extractVariables(tableBody)));
    columnKeys.forEach((key) => consumedColumnKeys.add(key));
    tableFields.push({
      key: tableKey,
      label: existingTable?.label ?? humanizeFieldKey(tableKey),
      type: "table",
      required: existingTable?.required ?? columnKeys.length > 0,
      source: existingTable?.source ?? "extra",
      description: existingTable?.description ?? "",
      columns: columnKeys.map((key) => createFieldFromKey(key, existingColumns.get(key) ?? byKey.get(key))),
    });
  }

  const standaloneKeys = Array.from(new Set(extractVariables(htmlWithoutTableBodies))).filter(
    (key) => !consumedColumnKeys.has(key),
  );
  const standaloneFields = standaloneKeys.map((key) => createFieldFromKey(key, byKey.get(key)));
  const customFields = currentFields.filter(
    (field) =>
      !standaloneKeys.includes(field.key) &&
      !consumedColumnKeys.has(field.key) &&
      !tableFields.some((table) => table.key === field.key) &&
      field.type !== "table",
  );

  return normalizeTemplateSchema({ fields: [...standaloneFields, ...tableFields, ...customFields] }).fields;
}

function cloneTemplate(template: DocumentTemplateSummary): EditableTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    documentType: template.documentType,
    targetFolderPath: template.targetFolderPath ?? "",
    status: template.status,
    contentHtml: template.contentHtml,
    fields: template.schema.fields.map((field) => ({
      ...field,
      options: field.options ? field.options.map((option) => ({ ...option })) : undefined,
      columns: field.columns
        ? field.columns.map((column) => ({
          ...column,
          options: column.options ? column.options.map((option) => ({ ...option })) : undefined,
        }))
        : undefined,
    })),
  };
}

function buildPreviewData(fields: TemplateField[]) {
  const data: Record<string, unknown> = {};
  const repeatableGroups = new Map<string, TemplateField[]>();

  for (const field of fields) {
    if (field.repeatableGroup) {
      repeatableGroups.set(field.repeatableGroup, [
        ...(repeatableGroups.get(field.repeatableGroup) ?? []),
        field,
      ]);
      continue;
    }
    data[field.key] = getPreviewFieldValue(field);
  }

  for (const [groupKey, groupFields] of repeatableGroups.entries()) {
    data[groupKey] = [0, 1].map((rowIndex) =>
      Object.fromEntries(
        groupFields.map((field) => [
          field.key,
          field.defaultValue ?? `${getPreviewFieldValue(field)}${rowIndex + 1}`,
        ]),
      ),
    );
  }

  return data;
}

function getPreviewFieldValue(field: TemplateField): unknown {
  if (field.type === "table") {
    return [0, 1].map((rowIndex) =>
      Object.fromEntries(
        (field.columns ?? []).map((column) => [
          column.key,
          column.defaultValue ?? `${getPreviewFieldValue(column)}${rowIndex + 1}`,
        ]),
      ),
    );
  }
  return field.defaultValue ??
    (field.type === "date"
      ? "2026-04-29"
      : field.type === "money"
        ? "120000"
        : field.type === "number"
          ? "10"
          : field.label);
}

function getRepeatableGroups(fields: TemplateField[]) {
  const groups = new Map<string, { label: string; fields: TemplateField[] }>();
  for (const field of fields) {
    if (!field.repeatableGroup) continue;
    const current = groups.get(field.repeatableGroup) ?? {
      label: field.repeatableGroupLabel || field.repeatableGroup,
      fields: [],
    };
    current.fields.push(field);
    groups.set(field.repeatableGroup, current);
  }
  return Array.from(groups.entries());
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceHtmlVariable(html: string, previousKey: string, nextKey: string) {
  if (!previousKey || !nextKey || previousKey === nextKey) return html;
  return html.replace(
    new RegExp(`\\{\\{\\s*${escapeRegExp(previousKey)}\\s*\\}\\}`, "g"),
    `{{${nextKey}}}`,
  );
}

function replaceHtmlRepeatableGroup(html: string, previousKey: string, nextKey: string) {
  if (!previousKey || !nextKey || previousKey === nextKey) return html;
  return html
    .replace(
      new RegExp(`\\{\\{#\\s*${escapeRegExp(previousKey)}\\s*\\}\\}`, "g"),
      `{{#${nextKey}}}`,
    )
    .replace(
      new RegExp(`\\{\\{\\/\\s*${escapeRegExp(previousKey)}\\s*\\}\\}`, "g"),
      `{{/${nextKey}}}`,
    );
}

function useDocumentTemplateConfig(workId: string) {
  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [folderConfigs, setFolderConfigs] = useState<FolderConfig[]>([]);
  const [folderFieldSuggestions, setFolderFieldSuggestions] = useState<Record<string, FolderFieldSuggestion[]>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draft, setDraft] = useState<EditableTemplate | null>(null);
  const [expandedField, setExpandedField] = useState<string>("");
  const [rightPanelMode, setRightPanelMode] = useState<"preview" | "html">("preview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (workId) query.set("workId", workId);
        const response = await fetch(`/api/document-generation/templates?${query.toString()}`);
        const payload = (await response.json()) as TemplateConfigResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar la configuracion");
        }
        if (cancelled) return;
        setTemplates(payload.templates);
        setFolderConfigs(payload.folderConfigs);
        setFolderFieldSuggestions(payload.folderFieldSuggestions ?? {});
        setSelectedTemplateId("");
        setDraft(null);
        setExpandedField("");
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "No se pudo cargar la configuracion");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const suggestedFields = useMemo(
    () => (draft?.targetFolderPath ? folderFieldSuggestions[draft.targetFolderPath] ?? [] : []),
    [draft?.targetFolderPath, folderFieldSuggestions],
  );

  const previewHtml = useMemo(() => {
    if (!draft) return "";
    return renderDocumentHtml(draft.contentHtml, buildPreviewData(draft.fields), {
      workName: "Obra de ejemplo",
      generatedAt: "29/04/2026",
    });
  }, [draft]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((entry) => entry.id === templateId) ?? null;
    setDraft(template ? cloneTemplate(template) : null);
    setExpandedField("");
  };

  const updateField = (index: number, patch: Partial<TemplateField>) => {
    setDraft((current) => {
      if (!current) return current;
      const previousField = current.fields[index];
      const nextField = previousField ? { ...previousField, ...patch } : null;
      let nextHtml = current.contentHtml;
      if (previousField && nextField && previousField.key !== nextField.key) {
        nextHtml = replaceHtmlVariable(nextHtml, previousField.key, nextField.key);
      }
      if (previousField?.repeatableGroup && nextField?.repeatableGroup && previousField.repeatableGroup !== nextField.repeatableGroup) {
        nextHtml = replaceHtmlRepeatableGroup(nextHtml, previousField.repeatableGroup, nextField.repeatableGroup);
      }
      return {
        ...current,
        contentHtml: nextHtml,
        fields: current.fields.map((field, fieldIndex) =>
          fieldIndex === index ? { ...field, ...patch } : field,
        ),
      };
    });
  };

  const updateSelectOption = (
    fieldIndex: number,
    optionIndex: number,
    patch: Partial<{ label: string; value: string }>,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) => {
          if (index !== fieldIndex) return field;
          const options = field.options ?? [];
          return {
            ...field,
            options: options.map((option, currentOptionIndex) =>
              currentOptionIndex === optionIndex ? { ...option, ...patch } : option,
            ),
          };
        }),
      };
    });
  };

  const addSelectOption = (fieldIndex: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) =>
          index === fieldIndex
            ? {
              ...field,
              options: [
                ...(field.options ?? []),
                { label: `Opcion ${(field.options?.length ?? 0) + 1}`, value: `opcion_${(field.options?.length ?? 0) + 1}` },
              ],
            }
            : field,
        ),
      };
    });
  };

  const removeSelectOption = (fieldIndex: number, optionIndex: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) =>
          index === fieldIndex
            ? { ...field, options: (field.options ?? []).filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex) }
            : field,
        ),
      };
    });
  };

  const updateTableColumn = (fieldIndex: number, columnIndex: number, patch: Partial<TemplateField>) => {
    setDraft((current) => {
      if (!current) return current;
      const table = current.fields[fieldIndex];
      const previousColumn = table?.columns?.[columnIndex];
      const nextColumn = previousColumn ? { ...previousColumn, ...patch } : null;
      let nextHtml = current.contentHtml;
      if (previousColumn && nextColumn && previousColumn.key !== nextColumn.key) {
        nextHtml = replaceHtmlVariable(nextHtml, previousColumn.key, nextColumn.key);
      }
      return {
        ...current,
        contentHtml: nextHtml,
        fields: current.fields.map((field, index) =>
          index === fieldIndex
            ? {
              ...field,
              columns: (field.columns ?? []).map((column, currentColumnIndex) =>
                currentColumnIndex === columnIndex ? { ...column, ...patch } : column,
              ),
            }
            : field,
        ),
      };
    });
  };

  const addTableColumn = (fieldIndex: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) =>
          index === fieldIndex
            ? {
              ...field,
              columns: [
                ...(field.columns ?? []),
                {
                  key: `columna_${(field.columns?.length ?? 0) + 1}`,
                  label: `Columna ${(field.columns?.length ?? 0) + 1}`,
                  type: "text",
                  required: false,
                  source: "extra",
                },
              ],
            }
            : field,
        ),
      };
    });
  };

  const updateTableColumnOption = (
    fieldIndex: number,
    columnIndex: number,
    optionIndex: number,
    patch: Partial<{ label: string; value: string }>,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) => {
          if (index !== fieldIndex) return field;
          return {
            ...field,
            columns: (field.columns ?? []).map((column, currentColumnIndex) => {
              if (currentColumnIndex !== columnIndex) return column;
              return {
                ...column,
                options: (column.options ?? []).map((option, currentOptionIndex) =>
                  currentOptionIndex === optionIndex ? { ...option, ...patch } : option,
                ),
              };
            }),
          };
        }),
      };
    });
  };

  const addTableColumnOption = (fieldIndex: number, columnIndex: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) => {
          if (index !== fieldIndex) return field;
          return {
            ...field,
            columns: (field.columns ?? []).map((column, currentColumnIndex) => {
              if (currentColumnIndex !== columnIndex) return column;
              const nextIndex = (column.options?.length ?? 0) + 1;
              return {
                ...column,
                options: [
                  ...(column.options ?? []),
                  { label: `Opcion ${nextIndex}`, value: `opcion_${nextIndex}` },
                ],
              };
            }),
          };
        }),
      };
    });
  };

  const removeTableColumnOption = (fieldIndex: number, columnIndex: number, optionIndex: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) =>
          index === fieldIndex
            ? {
              ...field,
              columns: (field.columns ?? []).map((column, currentColumnIndex) =>
                currentColumnIndex === columnIndex
                  ? {
                    ...column,
                    options: (column.options ?? []).filter(
                      (_, currentOptionIndex) => currentOptionIndex !== optionIndex,
                    ),
                  }
                  : column,
              ),
            }
            : field,
        ),
      };
    });
  };

  const removeTableColumn = (fieldIndex: number, columnIndex: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.map((field, index) =>
          index === fieldIndex
            ? { ...field, columns: (field.columns ?? []).filter((_, currentColumnIndex) => currentColumnIndex !== columnIndex) }
            : field,
        ),
      };
    });
  };

  const addExtraField = () => {
    setDraft((current) => {
      if (!current) return current;
      const nextKey = `extra_${current.fields.length + 1}`;
      return {
        ...current,
        fields: [
          ...current.fields,
          {
            key: nextKey,
            label: `Campo extra ${current.fields.length + 1}`,
            type: "text",
            required: false,
            source: "extra",
            description: "",
          },
        ],
      };
    });
    setExpandedField(`extra_${(draft?.fields.length ?? 0) + 1}`);
  };

  const addTableField = () => {
    setDraft((current) => {
      if (!current) return current;
      const nextIndex = current.fields.length + 1;
      const nextKey = `tabla_${nextIndex}`;
      return {
        ...current,
        fields: [
          ...current.fields,
          {
            key: nextKey,
            label: `Tabla ${nextIndex}`,
            type: "table",
            required: false,
            source: "extra",
            description: "",
            columns: createDefaultTableColumns(),
          },
        ],
      };
    });
    setExpandedField(`tabla_${(draft?.fields.length ?? 0) + 1}`);
  };

  const addSuggestedField = (field: FolderFieldSuggestion) => {
    setDraft((current) => {
      if (!current) return current;
      if (current.fields.some((entry) => entry.key === field.fieldKey)) return current;
      return {
        ...current,
        fields: [
          ...current.fields,
          {
            key: field.fieldKey,
            label: field.label,
            type: normalizeSuggestionType(field.dataType),
            required: field.required,
            source: "folder",
            description: field.description ?? "",
          },
        ],
      };
    });
    setExpandedField(field.fieldKey);
  };

  const removeField = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index),
      };
    });
  };

  const copyHtmlVariables = async () => {
    if (!draft) return;
    const standaloneVariables = draft.fields
      .filter((field) => !field.repeatableGroup && field.type !== "table")
      .map((field) => `{{${field.key}}}`);
    const tableVariables = draft.fields
      .filter((field) => field.type === "table")
      .map(
        (field) =>
          `{{#${field.key}}}\n${(field.columns ?? []).map((column) => `  {{${column.key}}}`).join("\n")}\n{{/${field.key}}}`,
      );
    const repeatableVariables = getRepeatableGroups(draft.fields).map(
      ([groupKey, group]) =>
        `{{#${groupKey}}}\n${group.fields.map((field) => `  {{${field.key}}}`).join("\n")}\n{{/${groupKey}}}`,
    );
    const variables = [...standaloneVariables, ...tableVariables, ...repeatableVariables].join("\n");
    if (!variables) {
      toast.error("Esta template no tiene campos para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(variables);
      toast.success("Variables copiadas al portapapeles.");
    } catch {
      toast.error("No se pudieron copiar las variables.");
    }
  };

  const handleSave = async (override?: { fields?: TemplateField[] }) => {
    if (!draft) return;
    const fieldsToSave = override?.fields ?? draft.fields;
    setSaving(true);
    try {
      const response = await fetch("/api/document-generation/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: draft.id,
          name: draft.name,
          description: draft.description,
          documentType: draft.documentType,
          targetFolderPath: draft.targetFolderPath || null,
          status: draft.status,
          contentHtml: draft.contentHtml,
          schema: { fields: fieldsToSave },
        }),
      });
      const payload = (await response.json()) as {
        template?: DocumentTemplateSummary | null;
        templates?: DocumentTemplateSummary[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo guardar la template");
      }
      const nextTemplates = payload.templates ?? templates;
      setTemplates(nextTemplates);
      const savedTemplate = payload.template ?? nextTemplates.find((entry) => entry.id === selectedTemplateId) ?? null;
      if (savedTemplate) {
        setSelectedTemplateId(savedTemplate.id);
        setDraft(cloneTemplate(savedTemplate));
      }
      toast.success("Template guardada para este tenant.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la template");
    } finally {
      setSaving(false);
    }
  };

  return {
    templates,
    loading,
    selectedTemplateId,
    handleTemplateSelect,
    draft,
    setDraft,
    selectedTemplate,
    folderConfigs,
    suggestedFields,
    expandedField,
    setExpandedField,
    rightPanelMode,
    setRightPanelMode,
    saving,
    previewHtml,
    updateField,
    updateSelectOption,
    addSelectOption,
    removeSelectOption,
    updateTableColumn,
    addTableColumn,
    updateTableColumnOption,
    addTableColumnOption,
    removeTableColumnOption,
    removeTableColumn,
    addExtraField,
    addTableField,
    addSuggestedField,
    removeField,
    copyHtmlVariables,
    handleSave,
  };
}

type TemplateConfigContextValue = ReturnType<typeof useDocumentTemplateConfig>;

const TemplateConfigContext = createContext<TemplateConfigContextValue | null>(null);

function useTemplateConfig() {
  const ctx = useContext(TemplateConfigContext);
  if (!ctx) {
    throw new Error("TemplateConfigProvider is required");
  }
  return ctx;
}

export function TemplateConfigProvider({ workId, children }: { workId: string; children: ReactNode }) {
  const value = useDocumentTemplateConfig(workId);
  return <TemplateConfigContext.Provider value={value}>{children}</TemplateConfigContext.Provider>;
}

export function TemplatePickerCard({
  permissions,
}: {
  permissions?: DocumentGenerationPermissionMap | null;
}) {
  const { templates, loading, selectedTemplateId, handleTemplateSelect } = useTemplateConfig();

  return (
    <Card className="overflow-hidden rounded-2xl border-stone-200/80 bg-white shadow-[var(--shadow-card)]">
      <CardHeader className="border-b border-stone-200/80">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
              Paso 1
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-2xl tracking-[-0.04em]">Elige un template</CardTitle>
              <DocumentGenerationNav permissions={permissions} />
            </div>
            <CardDescription className="mt-2 max-w-xl text-sm leading-6">
              Elige la plantilla base que vas a ajustar para este tenant. La idea es que la seleccion ya comunique alcance, version y destino.
            </CardDescription>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Catalogo visible
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">
              {templates.length}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando templates...
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateSelect(template.id)}
              className={`h-full rounded-xl border px-4 py-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.995] ${selectedTemplateId === template.id
                ? "border-[#fb923c] bg-[#fff7ed] shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-stone-950">{template.name}</p>
                    <Badge variant="outline" className="rounded-full border-stone-200 bg-white text-[10px] text-stone-600">
                      {DOCUMENT_TYPE_LABELS[template.documentType]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {template.description?.trim() || "Sin descripcion cargada para esta template."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1">
                      {template.targetFolderPath || "Sin carpeta fija"}
                    </span>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1">
                      {template.schema.fields.length} campos
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="rounded-full">
                    {template.tenantScoped ? "tenant" : "system"}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full">
                    v{template.version}
                  </Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TemplateConfigEditorPanel() {
  const {
    draft,
    setDraft,
    selectedTemplate,
    folderConfigs,
    suggestedFields,
    expandedField,
    setExpandedField,
    rightPanelMode,
    setRightPanelMode,
    saving,
    previewHtml,
    updateField,
    updateSelectOption,
    addSelectOption,
    removeSelectOption,
    updateTableColumn,
    addTableColumn,
    updateTableColumnOption,
    addTableColumnOption,
    removeTableColumnOption,
    removeTableColumn,
    addExtraField,
    addTableField,
    addSuggestedField,
    removeField,
    copyHtmlVariables,
    handleSave,
  } = useTemplateConfig();
  const [fieldsMode, setFieldsMode] = useState<"visual" | "json">("visual");
  const [fieldsJsonState, setFieldsJsonState] = useState({ templateId: "", value: "" });
  const [fieldsJsonError, setFieldsJsonError] = useState("");
  const fieldsJson =
    draft && fieldsJsonState.templateId === draft.id
      ? fieldsJsonState.value
      : draft
        ? formatFieldsJson(draft.fields)
        : "";
  const activeFieldsJsonError =
    draft && fieldsJsonState.templateId === draft.id ? fieldsJsonError : "";

  const showFieldsJson = () => {
    if (draft) {
      setFieldsJsonState({ templateId: draft.id, value: formatFieldsJson(draft.fields) });
      setFieldsJsonError("");
    }
    setFieldsMode("json");
  };

  const applyFieldsJson = () => {
    try {
      const fields = parseFieldsJson(fieldsJson);
      setDraft((current) => (current ? { ...current, fields } : current));
      if (draft) {
        setFieldsJsonState({ templateId: draft.id, value: formatFieldsJson(fields) });
      }
      setFieldsJsonError("");
      toast.success("Campos actualizados desde JSON.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON invalido.";
      setFieldsJsonError(message);
      toast.error(message);
    }
  };

  const syncFieldsWithHtml = () => {
    if (!draft) return;
    const fields = syncFieldsFromHtml(draft.contentHtml, draft.fields);
    setDraft((current) => (current ? { ...current, fields } : current));
    setFieldsJsonState({ templateId: draft.id, value: formatFieldsJson(fields) });
    setFieldsJsonError("");
    toast.success("Campos sincronizados desde el HTML.");
  };

  const saveConfiguration = async () => {
    if (fieldsMode !== "json") {
      await handleSave();
      return;
    }

    try {
      const fields = parseFieldsJson(fieldsJson);
      if (draft) {
        setDraft((current) => (current ? { ...current, fields } : current));
        setFieldsJsonState({ templateId: draft.id, value: formatFieldsJson(fields) });
      }
      setFieldsJsonError("");
      await handleSave({ fields });
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON invalido.";
      setFieldsJsonError(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border-stone-200/80 bg-white shadow-[var(--shadow-card)]">
        <CardContent className="space-y-6">
          {!draft || !selectedTemplate ? (
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm text-stone-500">
              Selecciona una template para editarla.
            </div>
          ) : (
            <>


              <div className="grid gap-6 xl:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={draft.name}
                        onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                        className="h-11 rounded-xl border-stone-200 bg-white shadow-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo documental</Label>
                      <Select
                        value={draft.documentType}
                        onValueChange={(value) =>
                          setDraft((current) =>
                            current && normalizeDocumentType(value)
                              ? { ...current, documentType: value }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Carpeta destino sugerida</Label>
                      <Select
                        value={draft.targetFolderPath || "__none__"}
                        onValueChange={(value) =>
                          setDraft((current) =>
                            current ? { ...current, targetFolderPath: value === "__none__" ? "" : value } : current,
                          )
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white shadow-none">
                          <SelectValue placeholder="Sin carpeta fija" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin carpeta fija</SelectItem>
                          {folderConfigs.map((folder) => (
                            <SelectItem key={folder.path} value={folder.path}>
                              {folder.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select
                        value={draft.status}
                        onValueChange={(value) => setDraft((current) => (current ? { ...current, status: value } : current))}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">draft</SelectItem>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="inactive">inactive</SelectItem>
                          <SelectItem value="archived">archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descripcion</Label>
                    <Textarea
                      rows={2}
                      value={draft.description}
                      onChange={(event) => setDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                      className="rounded-xl border-stone-200 bg-white shadow-none"
                    />
                  </div>


                  <Separator />

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">Campos del documento</p>
                        <p className="text-xs text-stone-500">
                          Define que datos se van a pedir al generar este documento.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="inline-flex rounded-md border border-stone-200 bg-white p-1">
                          <Button
                            type="button"
                            variant={fieldsMode === "visual" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setFieldsMode("visual")}
                            className="h-8 rounded-full"
                          >
                            Editor
                          </Button>
                          <Button
                            type="button"
                            variant={fieldsMode === "json" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={showFieldsJson}
                            className="h-8 rounded-full"
                          >
                            JSON
                          </Button>
                        </div>
                        <Button type="button" variant="outline" onClick={() => void copyHtmlVariables()}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar variables
                        </Button>
                        <Button type="button" variant="outline" onClick={syncFieldsWithHtml}>
                          Sincronizar desde HTML
                        </Button>
                        {fieldsMode === "visual" ? (
                          <>
                            <Button type="button" variant="outline" onClick={addExtraField}>
                              <Plus className="mr-2 h-4 w-4" />
                              Agregar dato
                            </Button>
                            <Button type="button" variant="outline" onClick={addTableField}>
                              <Plus className="mr-2 h-4 w-4" />
                              Agregar tabla
                            </Button>
                          </>
                        ) : (
                          <Button type="button" variant="outline" onClick={applyFieldsJson}>
                            Aplicar JSON
                          </Button>
                        )}
                      </div>
                    </div>

                    {fieldsMode === "json" ? (
                      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-stone-900">Configuracion JSON de campos</p>
                            <p className="text-xs text-stone-500">
                              Pega un array de campos o un objeto con {"{ \"fields\": [...] }"}. Soporta columnas en campos tipo tabla.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFieldsJsonState({ templateId: draft.id, value: formatFieldsJson(draft.fields) })}
                            className="rounded-md"
                          >
                            Restaurar
                          </Button>
                        </div>
                        <Textarea
                          value={fieldsJson}
                          onChange={(event) => {
                            setFieldsJsonState({ templateId: draft.id, value: event.target.value });
                            setFieldsJsonError("");
                          }}
                          rows={24}
                          spellCheck={false}
                          className="min-h-[520px] rounded-xl border-[#fb9b72] font-mono text-xs"
                        />
                        {activeFieldsJsonError ? <p className="text-xs text-red-600">{activeFieldsJsonError}</p> : null}
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                          Ejemplo tabla:
                          <pre className="mt-2 overflow-auto rounded-md bg-white p-3 text-[11px] text-stone-800">
                            {`[
  {
    "key": "items",
    "label": "Materiales",
    "type": "table",
    "required": true,
    "columns": [
      { "key": "cantidad", "label": "Cantidad", "type": "number", "required": true },
      { "key": "detalle", "label": "Detalle descriptivo", "type": "text", "required": true },
      { "key": "precio_unitario", "label": "Precio unitario", "type": "money" }
    ]
  }
]`}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <>
                        {suggestedFields.length > 0 ? (
                          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-stone-500" />
                                <p className="text-sm font-medium text-stone-900">Datos detectados en la carpeta</p>
                              </div>
                              <span className="text-xs text-stone-500">Click para agregarlos</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {suggestedFields.map((field) => (
                                <Button
                                  key={field.fieldKey}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => addSuggestedField(field)}
                                  disabled={draft.fields.some((entry) => entry.key === field.fieldKey)}
                                >
                                  {field.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                          <Accordion
                            type="single"
                            collapsible
                            value={expandedField}
                            onValueChange={setExpandedField}
                            className="divide-y divide-stone-200"
                          >
                            {draft.fields.map((field, index) => (
                              <AccordionItem
                                key={`${field.key}-${index}`}
                                value={field.key}
                                className="border-b-0"
                              >
                                <div className="px-4 py-4">
                                  <div className="grid gap-3 rounded-lg border border-stone-100 bg-stone-50/50 p-3 md:grid-cols-[minmax(0,1fr)_180px_150px_auto] md:items-end">
                                    <div className="min-w-0 md:col-span-4">
                                      <Label className="mb-1 block text-xs font-medium text-stone-600">Nombre del dato</Label>
                                      <Input
                                        value={field.label}
                                        onChange={(event) => {
                                          const nextLabel = event.target.value;
                                          updateField(index, {
                                            label: nextLabel,
                                          });
                                        }}
                                        className="h-11 rounded-lg border-stone-200 bg-white text-sm shadow-none"
                                      />
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="rounded-full text-[10px]">
                                          {field.source === "folder" ? "Detectado" : "Manual"}
                                        </Badge>
                                        {field.defaultValue ? (
                                          <span className="truncate text-xs text-stone-500">
                                            Valor inicial: {String(field.defaultValue)}
                                          </span>
                                        ) : null}
                                        {field.repeatableGroup ? (
                                          <span className="truncate text-xs text-stone-500">
                                            Tabla: {field.repeatableGroupLabel || field.repeatableGroup}
                                          </span>
                                        ) : null}
                                        {field.type === "table" ? (
                                          <span className="truncate text-xs text-stone-500">
                                            {field.columns?.length ?? 0} columnas
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div>
                                      <Label className="mb-1 block text-xs font-medium text-stone-600">Tipo de dato</Label>
                                      <Select
                                        value={field.type}
                                        onValueChange={(value) =>
                                          updateField(index, {
                                            type: value as TemplateFieldType,
                                            options:
                                              value === "select" && !field.options?.length
                                                ? [{ label: "Opcion 1", value: "opcion_1" }]
                                                : field.options,
                                            selectMode:
                                              value === "select"
                                                ? field.selectMode ?? "strict"
                                                : field.selectMode,
                                            columns:
                                              value === "table" && !field.columns?.length
                                                ? createDefaultTableColumns()
                                                : field.columns,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white shadow-none">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {FIELD_TYPE_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                              {FIELD_TYPE_LABELS[option]}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <Label className="text-xs font-medium text-stone-700">Obligatorio</Label>
                                        <Switch
                                          checked={field.required}
                                          onCheckedChange={(checked) => updateField(index, { required: checked })}
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-1 self-end lg:self-center">
                                      <AccordionTrigger className="h-10 rounded-lg border border-stone-200 px-3 py-0 hover:no-underline">
                                        <span className="text-xs font-medium text-stone-600">Mas opciones</span>
                                      </AccordionTrigger>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeField(index)}
                                        className="h-10 w-10 rounded-lg text-stone-500 hover:bg-stone-100"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                <AccordionContent className="px-4 pb-4 pt-0">
                                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                      {field.type !== "table" ? (
                                        <div className="space-y-2">
                                          <Label>Valor inicial</Label>
                                          <Input
                                            value={String(field.defaultValue ?? "")}
                                            onChange={(event) => updateField(index, { defaultValue: event.target.value })}
                                            className="h-10 rounded-lg border-stone-200 bg-white shadow-none"
                                            placeholder="Opcional"
                                          />
                                        </div>
                                      ) : null}
                                      <div className="space-y-2">
                                        <Label>Variable para el HTML</Label>
                                        <Input
                                          value={field.key}
                                          onChange={(event) =>
                                            updateField(index, { key: normalizeFieldKey(event.target.value || field.label) })
                                          }
                                          className={cn(
                                            "h-10 rounded-lg border-stone-200 bg-white shadow-none",
                                            field.source === "folder" && "bg-stone-100 text-stone-500",
                                          )}
                                          disabled={field.source === "folder"}
                                        />
                                        {field.source === "folder" ? (
                                          <p className="text-xs text-stone-500">
                                            Viene de la extraccion de la carpeta.
                                          </p>
                                        ) : (
                                          <p className="text-xs text-stone-500">
                                            Se usa como {"{{variable}}"} dentro del HTML.
                                          </p>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Ayuda interna</Label>
                                        <Input
                                          value={field.description ?? ""}
                                          onChange={(event) => updateField(index, { description: event.target.value })}
                                          className="h-10 rounded-lg border-stone-200 bg-white shadow-none"
                                          placeholder="Opcional"
                                        />
                                      </div>
                                      {field.type !== "table" ? (
                                        <div className="space-y-2 md:col-span-3">
                                          <Label>Autocompletar</Label>
                                          <Select
                                            value={field.autoPopulate ?? "none"}
                                            onValueChange={(value) =>
                                              updateField(index, {
                                                autoPopulate: value as TemplateAutoPopulate,
                                              })
                                            }
                                          >
                                            <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white shadow-none">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {AUTO_POPULATE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                  {option.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <p className="text-xs text-stone-500">
                                            Se aplica al crear o cambiar contexto; el usuario puede editar el valor.
                                          </p>
                                        </div>
                                      ) : null}
                                      {field.type === "select" ? (
                                        <div className="space-y-3 md:col-span-3 rounded-lg border border-stone-200 bg-white p-3">
                                          <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                            <div className="space-y-2">
                                              <Label>Modo de lista</Label>
                                              <Select
                                                value={field.selectMode ?? "strict"}
                                                onValueChange={(value) =>
                                                  updateField(index, {
                                                    selectMode: value as TemplateSelectMode,
                                                  })
                                                }
                                              >
                                                <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white shadow-none">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {SELECT_MODE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                      {option.label}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <p className="self-end pb-2 text-xs text-stone-500">
                                              Estricta obliga a elegir un valor existente. Combo editable permite escribir uno nuevo.
                                            </p>
                                          </div>
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <p className="text-sm font-medium text-stone-900">Valores de la lista</p>
                                              <p className="text-xs text-stone-500">Estos valores aparecen cuando el usuario completa el documento.</p>
                                            </div>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => addSelectOption(index)}
                                              className="rounded-md"
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              Agregar valor
                                            </Button>
                                          </div>
                                          <div className="space-y-2">
                                            {(field.options ?? []).map((option, optionIndex) => (
                                              <div key={`${field.key}-option-${optionIndex}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                                                <Input
                                                  value={option.label}
                                                  onChange={(event) =>
                                                    updateSelectOption(index, optionIndex, { label: event.target.value })
                                                  }
                                                  className="h-9 rounded-md border-stone-200"
                                                  placeholder="Texto visible"
                                                />
                                                <Input
                                                  value={option.value}
                                                  onChange={(event) =>
                                                    updateSelectOption(index, optionIndex, {
                                                      value: normalizeFieldKey(event.target.value || option.label),
                                                    })
                                                  }
                                                  className="h-9 rounded-md border-stone-200"
                                                  placeholder="valor_interno"
                                                />
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => removeSelectOption(index, optionIndex)}
                                                  className="h-9 w-9 rounded-md text-stone-500"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                      {field.type === "table" ? (
                                        <div className="space-y-3 md:col-span-3 rounded-lg border border-stone-200 bg-white p-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <p className="text-sm font-medium text-stone-900">Columnas de la tabla</p>
                                              <p className="text-xs text-stone-500">
                                                Cada columna se puede usar dentro de {"{{#"}{field.key}{"}}"}.
                                              </p>
                                            </div>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => addTableColumn(index)}
                                              className="rounded-md"
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              Agregar columna
                                            </Button>
                                          </div>
                                          <div className="space-y-3">
                                            {(field.columns ?? []).map((column, columnIndex) => (
                                              <div key={`${field.key}-column-${columnIndex}`} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_130px_auto] md:items-end">
                                                  <div className="space-y-1">
                                                    <Label>Nombre de columna</Label>
                                                    <Input
                                                      value={column.label}
                                                      onChange={(event) => updateTableColumn(index, columnIndex, { label: event.target.value })}
                                                      className="h-9 rounded-md border-stone-200 bg-white"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label>Tipo</Label>
                                                    <Select
                                                      value={column.type}
                                                      onValueChange={(value) =>
                                                        updateTableColumn(index, columnIndex, {
                                                          type: value as TemplateFieldType,
                                                          options:
                                                            value === "select" && !column.options?.length
                                                              ? [{ label: "Opcion 1", value: "opcion_1" }]
                                                              : column.options,
                                                          selectMode:
                                                            value === "select"
                                                              ? column.selectMode ?? "strict"
                                                              : column.selectMode,
                                                        })
                                                      }
                                                    >
                                                      <SelectTrigger className="h-9 rounded-md border-stone-200 bg-white">
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {FIELD_TYPE_OPTIONS.filter((option) => option !== "table").map((option) => (
                                                          <SelectItem key={option} value={option}>
                                                            {FIELD_TYPE_LABELS[option]}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                      <Label className="text-xs">Obligatorio</Label>
                                                      <Switch
                                                        checked={column.required}
                                                        onCheckedChange={(checked) => updateTableColumn(index, columnIndex, { required: checked })}
                                                      />
                                                    </div>
                                                  </div>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeTableColumn(index, columnIndex)}
                                                    className="h-9 w-9 rounded-md text-stone-500"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                  <div className="space-y-1">
                                                    <Label>Variable HTML</Label>
                                                    <Input
                                                      value={column.key}
                                                      onChange={(event) =>
                                                        updateTableColumn(index, columnIndex, {
                                                          key: normalizeFieldKey(event.target.value || column.label),
                                                        })
                                                      }
                                                      className="h-9 rounded-md border-stone-200 bg-white"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label>Valor inicial</Label>
                                                    <Input
                                                      value={String(column.defaultValue ?? "")}
                                                      onChange={(event) =>
                                                        updateTableColumn(index, columnIndex, { defaultValue: event.target.value })
                                                      }
                                                      className="h-9 rounded-md border-stone-200 bg-white"
                                                      placeholder="Opcional"
                                                    />
                                                  </div>
                                                </div>
                                                {column.type === "select" ? (
                                                  <div className="mt-3 rounded-md border border-stone-200 bg-white p-3">
                                                    <div className="mb-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                                                      <div className="space-y-1">
                                                        <Label>Modo de lista</Label>
                                                        <Select
                                                          value={column.selectMode ?? "strict"}
                                                          onValueChange={(value) =>
                                                            updateTableColumn(index, columnIndex, {
                                                              selectMode: value as TemplateSelectMode,
                                                            })
                                                          }
                                                        >
                                                          <SelectTrigger className="h-9 rounded-md border-stone-200 bg-white">
                                                            <SelectValue />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                            {SELECT_MODE_OPTIONS.map((option) => (
                                                              <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                              </SelectItem>
                                                            ))}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>
                                                      <p className="self-end pb-2 text-xs text-stone-500">
                                                        El combo editable acepta valores nuevos en esta columna.
                                                      </p>
                                                    </div>
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                      <div>
                                                        <p className="text-xs font-semibold text-stone-900">Valores de la lista</p>
                                                        <p className="text-xs text-stone-500">Opciones disponibles para esta columna.</p>
                                                      </div>
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addTableColumnOption(index, columnIndex)}
                                                        className="h-8 rounded-md"
                                                      >
                                                        <Plus className="mr-2 h-3.5 w-3.5" />
                                                        Agregar
                                                      </Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                      {(column.options ?? []).map((option, optionIndex) => (
                                                        <div
                                                          key={`${field.key}-column-${columnIndex}-option-${optionIndex}`}
                                                          className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                                                        >
                                                          <Input
                                                            value={option.label}
                                                            onChange={(event) =>
                                                              updateTableColumnOption(index, columnIndex, optionIndex, {
                                                                label: event.target.value,
                                                              })
                                                            }
                                                            className="h-8 rounded-md border-stone-200"
                                                            placeholder="Texto visible"
                                                          />
                                                          <Input
                                                            value={option.value}
                                                            onChange={(event) =>
                                                              updateTableColumnOption(index, columnIndex, optionIndex, {
                                                                value: normalizeFieldKey(event.target.value || option.label),
                                                              })
                                                            }
                                                            className="h-8 rounded-md border-stone-200"
                                                            placeholder="valor_interno"
                                                          />
                                                          <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeTableColumnOption(index, columnIndex, optionIndex)}
                                                            className="h-8 w-8 rounded-md text-stone-500"
                                                          >
                                                            <Trash2 className="h-4 w-4" />
                                                          </Button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                ) : null}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-2 md:col-span-3">
                                          <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
                                            <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                                              <div className="flex items-center justify-between gap-3">
                                                <Label className="text-xs font-medium text-stone-700">Repite en tabla</Label>
                                                <Switch
                                                  checked={Boolean(field.repeatableGroup)}
                                                  onCheckedChange={(checked) =>
                                                    updateField(index, {
                                                      repeatableGroup: checked ? "items" : null,
                                                      repeatableGroupLabel: checked ? "Items" : null,
                                                    })
                                                  }
                                                />
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Nombre de la tabla</Label>
                                              <Input
                                                value={field.repeatableGroupLabel ?? ""}
                                                onChange={(event) =>
                                                  updateField(index, {
                                                    repeatableGroupLabel: event.target.value,
                                                    repeatableGroup: normalizeFieldKey(
                                                      field.repeatableGroup || event.target.value || "items",
                                                    ),
                                                  })
                                                }
                                                className="h-10 rounded-lg border-stone-200 bg-white shadow-none"
                                                placeholder="Ej. Materiales"
                                                disabled={!field.repeatableGroup}
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Variable del bloque</Label>
                                              <Input
                                                value={field.repeatableGroup ?? ""}
                                                onChange={(event) =>
                                                  updateField(index, {
                                                    repeatableGroup: normalizeFieldKey(event.target.value || "items"),
                                                  })
                                                }
                                                className="h-10 rounded-lg border-stone-200 bg-white shadow-none"
                                                placeholder="items"
                                                disabled={!field.repeatableGroup}
                                              />
                                              <p className="text-xs text-stone-500">
                                                Usalo en HTML como {"{{#items}}"} ... {"{{/items}}"}.
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      </>
                    )}
                  </div>

                </div>

                <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{rightPanelMode === "preview" ? "Preview" : "HTML"}</Label>
                    <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1">
                      <Button
                        type="button"
                        variant={rightPanelMode === "preview" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setRightPanelMode("preview")}
                        className="h-8 rounded-full"
                      >
                        Preview
                      </Button>
                      <Button
                        type="button"
                        variant={rightPanelMode === "html" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setRightPanelMode("html")}
                        className="h-8 rounded-full"
                      >
                        HTML
                      </Button>
                    </div>
                  </div>
                  {rightPanelMode === "preview" ? (
                    <div className="overflow-hidden rounded-xl border border-stone-200 bg-[#eceae6] p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="max-h-[calc(100vh-252px)] min-h-[640px] overflow-auto rounded-xl border border-stone-300 bg-white p-4">
                        <div className="min-w-max" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-[var(--shadow-card)]">
                      <Textarea
                        rows={28}
                        value={draft.contentHtml}
                        onChange={(event) =>
                          setDraft((current) => (current ? { ...current, contentHtml: event.target.value } : current))
                        }
                        className="min-h-[640px] rounded-[22px] border-[#fb9b72] font-mono text-xs shadow-none"
                      />
                      <p className="text-xs text-stone-500">
                        Variables simples: `{"{{campo}}"}`. Tablas repetibles: `{"{{#items}}"}...{"{{/items}}"}`.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="max-w-2xl text-xs leading-5 text-stone-500">
                  {selectedTemplate.tenantScoped
                    ? "Estas editando la version propia del tenant."
                    : "Al guardar se crea o actualiza un override propio del tenant sobre la template sistema."}
                </p>
                <Button type="button" onClick={() => void saveConfiguration()} disabled={saving} className="rounded-full">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar configuracion
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TemplateConfigPanel({ workId, permissions }: Props) {
  return (
    <TemplateConfigProvider workId={workId}>
      <TemplateConfigSteps permissions={permissions} />
    </TemplateConfigProvider>
  );
}

function TemplateConfigSteps({
  permissions,
}: {
  permissions?: DocumentGenerationPermissionMap | null;
}) {
  const { selectedTemplateId, selectedTemplate, handleTemplateSelect } = useTemplateConfig();

  if (!selectedTemplateId || !selectedTemplate) {
    return <TemplatePickerCard permissions={permissions} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
            Paso 2
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
              {selectedTemplate.name}
            </h1>
            <DocumentGenerationNav permissions={permissions} />
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Configura metadata, campos y preview para este template.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-md"
          onClick={() => handleTemplateSelect("")}
        >
          Cambiar template
        </Button>
      </div>
      <TemplateConfigEditorPanel />
    </div>
  );
}

function normalizeSuggestionType(dataType: string): TemplateFieldType {
  switch (dataType) {
    case "number":
    case "date":
      return dataType;
    case "currency":
    case "money":
      return "money";
    default:
      return "text";
  }
}
