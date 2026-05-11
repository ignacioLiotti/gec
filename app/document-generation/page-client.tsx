"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderOpen,
  Info,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import {
  DOCUMENT_TYPE_LABELS,
  applyTemplateAliasInputData,
  applyTemplateAutoInputData,
  buildInitialInputData,
  type DocumentTemplateSummary,
  type DocumentType,
  normalizeDocumentType,
  escapeHtml,
  renderDocumentHtml,
  type TemplateField,
  type TemplateSchema,
  type TemplateSelectOption,
  renderTemplateFileNamePattern,
  validateTemplateInput,
  type ValidationError,
} from "@/lib/document-generation";
import { Button } from "@/components/ui/button";
import { DocumentApprovedSeal } from "@/components/document-approved-seal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocumentGenerationPermissionMap } from "@/lib/document-generation-server";
import { cn } from "@/lib/utils";
import { DocumentGenerationNav } from "./document-nav";

type WorkOption = {
  id: string;
  label: string;
};

type FolderConfig = {
  path: string;
  name: string;
  allowedDocumentTypes: DocumentType[];
  defaultDocumentType: DocumentType | null;
};

type BootstrapResponse = {
  works: WorkOption[];
  folderConfigs: FolderConfig[];
  templates: DocumentTemplateSummary[];
  dynamicOptions?: {
    tenantUsers?: TemplateSelectOption[];
  };
  context: {
    workId: string | null;
    workLabel: string | null;
    existingSequenceCount: number;
    existingDocumentCount?: number;
    folderPath: string | null;
    folderCandidates: FolderConfig[];
    allowedDocumentTypes: DocumentType[];
    documentType: DocumentType | null;
    selectedTemplate: DocumentTemplateSummary | null;
    initialInputData: Record<string, unknown>;
  };
};

type DraftResponse = {
  draft: {
    id: string;
    status: string;
    validation_errors: ValidationError[];
    input_data: Record<string, unknown>;
  };
};

type DraftDetailResponse = {
  draft: {
    id: string;
    workId: string;
    workLabel: string;
    folderPath: string;
    documentType: string;
    templateId: string;
    templateName: string | null;
    status: string;
    inputData: Record<string, unknown>;
    validationErrors: ValidationError[];
    rejection: DraftRejection | null;
    canEdit: boolean;
  };
};

type DraftRejection = {
  generatedDocumentId: string;
  comment: string;
  rejectedAt: string;
  rejectedBy: { id: string; fullName: string | null; email: string | null; label: string } | null;
};

type GeneratedDetailResponse = {
  document: {
    id: string;
    workId: string;
    workLabel: string;
    folderPath: string;
    documentType: string;
    templateId: string;
    templateName: string | null;
    sourceDraftId: string | null;
    storagePath: string;
    fileName: string;
    status: string;
    inputData: Record<string, unknown>;
    generatedAt: string;
    updatedAt: string;
    canEdit: boolean;
    previewHtml: string;
  };
};

type GeneratedDocumentResponse = {
  generatedDocument: {
    id: string;
    status: string;
    file_name: string;
    storage_path?: string;
  };
  relativeFolderPath: string;
  relativeFilePath: string;
  previewHtml: string;
};

const DOCUMENT_FILE_NAME_INPUT_KEY = "__documentFileName";

type RepeatableGroupDescriptor = {
  key: string;
  label: string;
  fields: TemplateField[];
};

type ValidationIssue = {
  kind: "error" | "warn";
  message: string;
};

function getRepeatableGroups(fields: TemplateField[]): RepeatableGroupDescriptor[] {
  const groups = new Map<string, { label: string; fields: TemplateField[] }>();

  for (const field of fields) {
    if (field.type === "table") {
      groups.set(field.key, {
        label: field.label,
        fields: field.columns ?? [],
      });
      continue;
    }

    if (!field.repeatableGroup) continue;
    const current = groups.get(field.repeatableGroup) ?? {
      label: field.repeatableGroupLabel || field.repeatableGroup,
      fields: [],
    };
    current.fields.push(field);
    groups.set(field.repeatableGroup, current);
  }

  return Array.from(groups.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    fields: value.fields,
  }));
}

function createRepeatableRow(fields: TemplateField[]) {
  return Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? ""]));
}

function readRepeatableRows(inputData: Record<string, unknown>, groupKey: string) {
  const rows = inputData[groupKey];
  return Array.isArray(rows) ? rows : [];
}

function rowHasValues(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  return Object.values(row).some((value) => String(value ?? "").trim().length > 0);
}

function countFilledRows(rows: unknown[]) {
  return rows.filter((row) => rowHasValues(row)).length;
}

function humanizeStatus(status: string) {
  if (status === "REJECTED") return "Rechazado";
  if (status === "APPROVED") return "Aprobado";
  if (status === "UNDER_REVIEW") return "En revision";
  if (status === "GENERATED") return "Pendiente";
  return status.toLowerCase().replace(/_/g, " ");
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getDocumentCode(inputData: Record<string, unknown>) {
  const candidateKeys = ["numero", "document_number", "nro", "folio", "codigo"];
  for (const key of candidateKeys) {
    const value = inputData[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Sin numero";
}

function readDocumentFileName(inputData: Record<string, unknown>) {
  const value = inputData[DOCUMENT_FILE_NAME_INPUT_KEY];
  return typeof value === "string" ? value : "";
}

function withDocumentFileName(inputData: Record<string, unknown>, fileName: string) {
  const trimmed = fileName.trim();
  if (!trimmed) {
    const next = { ...inputData };
    delete next[DOCUMENT_FILE_NAME_INPUT_KEY];
    return next;
  }
  return {
    ...inputData,
    [DOCUMENT_FILE_NAME_INPUT_KEY]: trimmed,
  };
}

function getTemplateFieldSpan(field: TemplateField) {
  if (field.type === "textarea") return "md:col-span-3";
  if (field.type === "select") return "md:col-span-2";
  return "";
}

function collectTemplateTokens(templateHtml: string) {
  return new Set(
    Array.from(templateHtml.matchAll(/\{\{(?![#/])\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1]),
  );
}

function mergeSelectOptions(...sources: Array<TemplateSelectOption[] | undefined>) {
  const byValue = new Map<string, TemplateSelectOption>();
  for (const source of sources) {
    for (const option of source ?? []) {
      const value = String(option.value ?? "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (!byValue.has(key)) {
        byValue.set(key, {
          label: option.label || value,
          value,
          unit: option.unit ?? null,
        });
      }
    }
  }
  return Array.from(byValue.values());
}

function resolveTemplateSchemaOptions(
  schema: TemplateSchema,
  dynamicOptions: { tenantUsers?: TemplateSelectOption[] },
): TemplateSchema {
  const resolveField = (field: TemplateField): TemplateField => {
    const dynamicSourceOptions =
      field.type === "select" && field.optionSource === "tenant_users"
        ? dynamicOptions.tenantUsers
        : undefined;
    return {
      ...field,
      options: field.type === "select" ? mergeSelectOptions(dynamicSourceOptions, field.options) : field.options,
      columns: field.columns?.map(resolveField),
    };
  };
  return { fields: schema.fields.map(resolveField) };
}

function findSelectOption(field: TemplateField, value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return (
    (field.options ?? []).find(
      (option) =>
        option.value.trim().toLowerCase() === normalized ||
        option.label.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

type TemplateOptionAddition = {
  fieldKey: string;
  tableKey?: string;
  option: TemplateSelectOption;
};

function collectCreatableOptionAdditions(
  schema: TemplateSchema,
  inputData: Record<string, unknown>,
): TemplateOptionAddition[] {
  const additions: TemplateOptionAddition[] = [];
  const addIfMissing = (
    field: TemplateField,
    value: unknown,
    unitValue?: unknown,
    tableKey?: string,
  ) => {
    if (field.type !== "select" || field.selectMode !== "creatable") return;
    const rawValue = String(value ?? "").trim();
    if (!rawValue) return;
    const exists = (field.options ?? []).some(
      (option) =>
        option.value.trim().toLowerCase() === rawValue.toLowerCase() ||
        option.label.trim().toLowerCase() === rawValue.toLowerCase(),
    );
    if (exists) return;
    additions.push({
      fieldKey: field.key,
      tableKey,
      option: {
        label: rawValue,
        value: rawValue,
        unit:
          field.optionUnitTargetKey && unitValue != null && String(unitValue).trim()
            ? String(unitValue).trim()
            : null,
      },
    });
  };

  for (const field of schema.fields) {
    if (field.type === "table") {
      const rows = readRepeatableRows(inputData, field.key);
      for (const column of field.columns ?? []) {
        for (const row of rows) {
          const rowData =
            row && typeof row === "object" && !Array.isArray(row)
              ? (row as Record<string, unknown>)
              : {};
          addIfMissing(column, rowData[column.key], column.optionUnitTargetKey ? rowData[column.optionUnitTargetKey] : undefined, field.key);
        }
      }
      continue;
    }
    if (field.repeatableGroup) {
      const rows = readRepeatableRows(inputData, field.repeatableGroup);
      for (const row of rows) {
        const rowData =
          row && typeof row === "object" && !Array.isArray(row)
            ? (row as Record<string, unknown>)
            : {};
        addIfMissing(field, rowData[field.key], field.optionUnitTargetKey ? rowData[field.optionUnitTargetKey] : undefined);
      }
      continue;
    }
    addIfMissing(field, inputData[field.key]);
  }

  const seen = new Set<string>();
  return additions.filter((addition) => {
    const key = `${addition.tableKey ?? ""}:${addition.fieldKey}:${addition.option.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTokenAlias(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getFieldAliasCandidates(field: TemplateField) {
  const key = normalizeTokenAlias(field.key);
  const label = normalizeTokenAlias(field.label);
  const aliases = new Set([key, label]);

  if (key.includes("order") || key.includes("orden") || key.includes("numero") || label.includes("orden")) {
    aliases.add("nro");
    aliases.add("numero");
    aliases.add("numeroorden");
    aliases.add("nroorden");
    aliases.add("pedido");
  }
  if (key.includes("date") || key.includes("fecha") || label.includes("fecha")) {
    aliases.add("fecha");
    aliases.add("fechaorden");
    aliases.add("fechaentrega");
  }
  if (key.includes("supplier") || key.includes("proveedor") || label.includes("proveedor")) {
    aliases.add("proveedor");
  }
  if (key.includes("requester") || key.includes("solicit") || label.includes("solicit")) {
    aliases.add("solicitante");
    aliases.add("empresasolicita");
  }
  if (key.includes("detail") || key.includes("detalle") || label.includes("detalle")) {
    aliases.add("detalle");
  }
  if (key.includes("total") || label.includes("total") || label.includes("importe")) {
    aliases.add("total");
    aliases.add("totalorden");
    aliases.add("preciototal");
  }

  return aliases;
}

function buildTemplateFieldBindings(templateHtml: string, fields: TemplateField[]) {
  const tokens = Array.from(collectTemplateTokens(templateHtml));
  const bindings = new Map<string, TemplateField>();
  const bindableFields = fields.flatMap((field) =>
    field.type === "table" ? [field, ...(field.columns ?? [])] : [field],
  );

  for (const token of tokens) {
    const normalizedToken = normalizeTokenAlias(token);
    const exactField = bindableFields.find((field) => field.key === token);
    if (exactField) {
      bindings.set(token, exactField);
      continue;
    }

    const aliasField = bindableFields.find((field) => getFieldAliasCandidates(field).has(normalizedToken));
    if (aliasField) {
      bindings.set(token, aliasField);
    }
  }

  return bindings;
}

function getFieldCoverageKeys(field: TemplateField) {
  const key = normalizeTokenAlias(field.key);
  const label = normalizeTokenAlias(field.label);
  const coverage = new Set([field.key, key, label]);

  if (["nro", "numero", "numeroorden", "nroorden", "ordernumber"].includes(key) || label.includes("numeroorden")) {
    coverage.add("concept:order_number");
  }
  if (["fechaorden", "issuedate"].includes(key) || label === "fecha" || label.includes("fechaorden")) {
    coverage.add("concept:issue_date");
  }
  if (["empresasolicita", "requester", "solicitante"].includes(key) || label.includes("solicitante")) {
    coverage.add("concept:requester");
  }
  if (["proveedor", "supplier"].includes(key) || label.includes("proveedor")) {
    coverage.add("concept:supplier");
  }
  if (["totalorden", "total"].includes(key) || label === "total" || label.includes("totalorden")) {
    coverage.add("concept:total");
  }
  if (["detalle", "detail"].includes(key) || label === "detalle") {
    coverage.add("concept:detail");
  }

  return coverage;
}

function collectRenderedFieldKeys(templateHtml: string, fields: TemplateField[]) {
  const tokens = collectTemplateTokens(templateHtml);
  const bindings = buildTemplateFieldBindings(templateHtml, fields);
  const rendered = new Set<string>();
  const renderedCoverage = new Set<string>();
  const bindableFields = fields.flatMap((field) =>
    field.type === "table" ? [field, ...(field.columns ?? [])] : [field],
  );
  const repeatableGroups = getRepeatableGroups(fields);
  const repeatableFieldKeys = new Set(repeatableGroups.flatMap((group) => group.fields.map((field) => field.key)));
  const markRendered = (field: TemplateField) => {
    rendered.add(field.key);
    for (const coverageKey of getFieldCoverageKeys(field)) {
      renderedCoverage.add(coverageKey);
    }
  };

  for (const field of fields) {
    if (field.type === "table") {
      if (tokens.has(field.key)) markRendered(field);
      for (const column of field.columns ?? []) {
        if (tokens.has(column.key)) markRendered(column);
      }
      continue;
    }

    if (tokens.has(field.key)) markRendered(field);
  }

  for (const key of repeatableFieldKeys) {
    if (tokens.has(key)) rendered.add(key);
  }
  for (const field of bindings.values()) {
    markRendered(field);
  }

  for (const field of bindableFields) {
    const isCovered = Array.from(getFieldCoverageKeys(field)).some((coverageKey) =>
      renderedCoverage.has(coverageKey),
    );
    if (isCovered) {
      rendered.add(field.key);
    }
  }

  return rendered;
}

function buildInvalidInlineFieldKeys(validationErrors: ValidationError[], fields: TemplateField[]) {
  const invalidKeys = new Set(validationErrors.map((error) => error.key));
  const bindableFields = fields.flatMap((field) =>
    field.type === "table" ? [field, ...(field.columns ?? [])] : [field],
  );
  const fieldByKey = new Map(bindableFields.map((field) => [field.key, field]));

  for (const error of validationErrors) {
    const parts = error.key.split(".");
    const fieldKey = parts[parts.length - 1] ?? error.key;
    const errorField = fieldByKey.get(fieldKey);
    if (!errorField) continue;

    const errorCoverage = getFieldCoverageKeys(errorField);
    for (const field of bindableFields) {
      const sharesCoverage = Array.from(getFieldCoverageKeys(field)).some((coverageKey) =>
        errorCoverage.has(coverageKey),
      );
      if (!sharesCoverage) continue;

      invalidKeys.add(field.key);
      if (parts.length >= 3) {
        invalidKeys.add(`${parts[0]}.${parts[1]}.${field.key}`);
      }
    }
  }

  return invalidKeys;
}

function renderInlineFieldControl(
  field: TemplateField,
  value: unknown,
  invalidKeys: Set<string>,
  errorKey: string,
  scope?: { groupKey?: string; rowIndex?: number; token?: string },
) {
  const hasValue = String(value ?? "").trim().length > 0;
  const isInvalid =
    invalidKeys.has(errorKey) ||
    Boolean(scope?.groupKey && field.required && invalidKeys.has(scope.groupKey));
  const className = cn(
    "inline-doc-field",
    field.type === "select" && "inline-doc-select",
    hasValue && "inline-doc-field-filled",
    isInvalid && "inline-doc-field-invalid",
  );
  const dataAttrs = [
    `data-inline-field="${escapeHtml(field.key)}"`,
    scope?.token && scope.token !== field.key ? `data-inline-token="${escapeHtml(scope.token)}"` : "",
    scope?.groupKey ? `data-inline-group="${escapeHtml(scope.groupKey)}"` : "",
    typeof scope?.rowIndex === "number" ? `data-inline-row="${scope.rowIndex}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const required = field.required ? "required" : "";
  const label = escapeHtml(field.label);
  const currentValue = escapeHtml(value ?? "");

  if (field.type === "select" && field.selectMode === "creatable") {
    const listId = [
      "inline-doc-options",
      field.key,
      scope?.groupKey,
      typeof scope?.rowIndex === "number" ? String(scope.rowIndex) : "",
      scope?.token,
    ]
      .filter(Boolean)
      .join("-");
    const options = (field.options ?? [])
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
    return `<span class="inline-doc-combobox"><input class="${escapeHtml(className)}" ${dataAttrs} ${required} aria-label="${label}" list="${escapeHtml(listId)}" type="text" value="${currentValue}" placeholder="${label}" /><span class="inline-doc-combobox-arrow" aria-hidden="true">⌄</span><datalist id="${escapeHtml(listId)}">${options}</datalist></span>`;
  }

  if (field.type === "select" && field.options?.length) {
    const options = [
      `<option value="">${label}</option>`,
      ...field.options.map((option) => {
        const selected = String(value ?? "") === option.value ? "selected" : "";
        return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
      }),
    ].join("");
    return `<select class="${escapeHtml(className)}" ${dataAttrs} ${required} aria-label="${label}">${options}</select>`;
  }

  if (field.type === "textarea") {
    return `<textarea class="${escapeHtml(className)} inline-doc-textarea" ${dataAttrs} ${required} aria-label="${label}" rows="1" placeholder="${label}">${currentValue}</textarea>`;
  }

  const inputType = field.type === "date" ? "date" : field.type === "number" || field.type === "money" ? "number" : "text";
  return `<input class="${escapeHtml(className)}" ${dataAttrs} ${required} aria-label="${label}" type="${inputType}" value="${currentValue}" />`;
}

function renderEditableDocumentHtml(
  templateHtml: string,
  fields: TemplateField[],
  inputData: Record<string, unknown>,
  extraData: Record<string, unknown>,
  invalidKeys: Set<string>,
) {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const fieldBindings = buildTemplateFieldBindings(templateHtml, fields);
  const repeatableGroupsByKey = new Map(getRepeatableGroups(fields).map((group) => [group.key, group]));
  const extraScope = Object.fromEntries(
    Object.entries(extraData).map(([key, value]) => [key, escapeHtml(value)]),
  );

  const renderedRepeatables = templateHtml.replace(
    /\{\{#\s*([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
    (_, groupKey: string, block: string) => {
      const group = repeatableGroupsByKey.get(groupKey);
      if (!group) return "";
      const rows = readRepeatableRows(inputData, groupKey);
      const safeRows = rows.length > 0 ? rows : [createRepeatableRow(group.fields)];
      return safeRows
        .map((row, rowIndex) => {
          const rowData =
            row && typeof row === "object" && !Array.isArray(row)
              ? (row as Record<string, unknown>)
              : {};
          return block.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_rowMatch: string, token: string) => {
            const field = group.fields.find((entry) => entry.key === token) ?? fieldByKey.get(token) ?? fieldBindings.get(token);
            if (field) {
              return renderInlineFieldControl(
                field,
                rowData[field.key] ?? rowData[token] ?? inputData[field.key] ?? inputData[token],
                invalidKeys,
                `${groupKey}.${rowIndex}.${field.key}`,
                { groupKey, rowIndex, token },
              );
            }
            return extraScope[token] ?? escapeHtml(inputData[token] ?? "");
          });
        })
        .join("");
    },
  );

  return renderedRepeatables.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token: string) => {
    const field = fieldByKey.get(token) ?? fieldBindings.get(token);
    if (field) {
      return renderInlineFieldControl(
        field,
        inputData[field.key] ?? inputData[token],
        invalidKeys,
        field.key,
        { token },
      );
    }
    return extraScope[token] ?? escapeHtml(inputData[token] ?? "");
  });
}

function buildValidationIssues(args: {
  workId: string;
  folderPath: string;
  documentType: DocumentType | "";
  templateId: string;
  validationErrors: ValidationError[];
  repeatableGroups: RepeatableGroupDescriptor[];
  inputData: Record<string, unknown>;
}) {
  const { workId, folderPath, documentType, templateId, validationErrors, repeatableGroups, inputData } = args;
  const issues: ValidationIssue[] = [];

  if (!workId) issues.push({ kind: "error", message: "Falta seleccionar la obra." });
  if (!documentType) issues.push({ kind: "error", message: "Falta seleccionar el tipo documental." });
  if (!folderPath) issues.push({ kind: "error", message: "Falta seleccionar la carpeta destino." });
  if (!templateId) issues.push({ kind: "error", message: "Falta seleccionar la plantilla." });

  for (const error of validationErrors) {
    issues.push({ kind: "error", message: error.message });
  }

  for (const group of repeatableGroups) {
    const filledRows = countFilledRows(readRepeatableRows(inputData, group.key));
    if (filledRows === 0) {
      issues.push({
        kind: "warn",
        message: `${group.label}: aun no hay filas cargadas.`,
      });
    }
  }

  return issues;
}

function iconForContextField(kind: "work" | "type" | "folder" | "template") {
  switch (kind) {
    case "work":
      return <Building2 className="h-3.5 w-3.5" />;
    case "type":
      return <FileText className="h-3.5 w-3.5" />;
    case "folder":
      return <FolderOpen className="h-3.5 w-3.5" />;
    case "template":
      return <LayoutTemplate className="h-3.5 w-3.5" />;
  }
}

function controlBaseClass(error?: boolean) {
  return cn(
    "h-11 w-full rounded-md border bg-white px-3 text-sm text-stone-900 outline-none transition",
    "placeholder:text-stone-400 focus:border-[#ff5800] focus:ring-4 focus:ring-[#ff5800]/10",
    error ? "border-red-200" : "border-stone-200",
  );
}

function RepeatableRowMenu({
  onDuplicate,
  onRemove,
}: {
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Cerrar menu"
          />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[144px] overflow-hidden rounded-md border border-stone-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 transition hover:bg-stone-50"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-700 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PreviewToolButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SectionCard({
  eyebrow,
  title,
  hint,
  children,
  rightSlot,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafaf9_100%)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{eyebrow}</p> : null}
            <h2 className="text-[14px] font-semibold text-stone-950">{title}</h2>
            {hint ? <p className="mt-1 text-[13px] leading-6 text-stone-500">{hint}</p> : null}
          </div>
          {rightSlot}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function RejectionNotice({ rejection }: { rejection: DraftRejection | null }) {
  if (!rejection) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
        Documento rechazado
      </p>
      <p className="mt-2 text-sm leading-6 text-red-950">
        {rejection.comment || "Sin comentario."}
      </p>
      <p className="mt-2 text-xs text-red-800/80">
        {rejection.rejectedBy?.label ?? "Usuario"} · {formatDate(rejection.rejectedAt)}
      </p>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="flex items-center gap-1 text-[12px] font-semibold text-stone-800">
        {label}
        {required ? <span className="text-[#ff5800]">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[11px] text-red-700">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
  icon,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
          {icon}
        </span>
      ) : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(
          controlBaseClass(error),
          "appearance-none pr-10 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500",
          icon ? "pl-9" : "pl-3",
        )}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  icon,
  mono,
  error,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  mono?: boolean;
  error?: boolean;
  type?: "text" | "number" | "date";
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
          {icon}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(controlBaseClass(error), icon ? "pl-9" : "pl-3", mono && "font-mono")}
      />
    </div>
  );
}

function CreatableCombobox({
  fieldKey,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: boolean;
}) {
  const listId = `document-field-options-${fieldKey}`;
  return (
    <div className="relative">
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(controlBaseClass(error), "pl-3 pr-10")}
      />
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}

function TextAreaInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-md border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none transition",
        "placeholder:text-stone-400 focus:border-[#ff5800] focus:ring-4 focus:ring-[#ff5800]/10",
      )}
    />
  );
}

export function DocumentGenerationPageClient({
  permissions,
}: {
  permissions: DocumentGenerationPermissionMap;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialWorkId = searchParams.get("workId") ?? "";
  const initialFolderPath = searchParams.get("folder") ?? searchParams.get("folderPath") ?? "";
  const initialDocumentType = normalizeDocumentType(searchParams.get("documentType"));
  const initialDraftId = searchParams.get("draftId") ?? "";
  const initialGeneratedId = searchParams.get("generatedId") ?? "";

  const [workId, setWorkId] = useState(initialWorkId);
  const [folderPath, setFolderPath] = useState(initialFolderPath);
  const [documentType, setDocumentType] = useState<DocumentType | "">(initialDocumentType ?? "");
  const [templateId, setTemplateId] = useState("");
  const [works, setWorks] = useState<WorkOption[]>([]);
  const [workLabel, setWorkLabel] = useState<string | null>(null);
  const [existingSequenceCount, setExistingSequenceCount] = useState(0);
  const [folderConfigs, setFolderConfigs] = useState<FolderConfig[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [dynamicOptions, setDynamicOptions] = useState<{ tenantUsers?: TemplateSelectOption[] }>({});
  const [inputData, setInputData] = useState<Record<string, unknown>>({});
  const [documentFileName, setDocumentFileName] = useState("");
  const [draftRejection, setDraftRejection] = useState<DraftRejection | null>(null);
  const [draftId, setDraftId] = useState<string>(initialDraftId);
  const [editingGeneratedId, setEditingGeneratedId] = useState<string>(initialGeneratedId);
  const [editingGeneratedStatus, setEditingGeneratedStatus] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocumentResponse | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(112);
  const [showValidationReview, setShowValidationReview] = useState(false);
  const [validationPulseId, setValidationPulseId] = useState(0);
  const [editorMode, setEditorMode] = useState<"inline" | "form">("inline");
  const bootstrapRequestIdRef = useRef(0);

  const loadBootstrap = useCallback(
    async (
      params?: { workId?: string; folderPath?: string; documentType?: string; templateId?: string },
      options?: { templateId?: string; inputData?: Record<string, unknown>; replaceInputData?: boolean },
    ) => {
      const requestId = bootstrapRequestIdRef.current + 1;
      bootstrapRequestIdRef.current = requestId;
      setLoading(true);
      try {
        const requestedWorkId = params?.workId ?? "";
        const requestedFolderPath = params?.folderPath ?? "";
        const requestedDocumentType = normalizeDocumentType(params?.documentType) ?? "";
        const requestedTemplateId = options?.templateId ?? params?.templateId ?? "";
        const query = new URLSearchParams();
        if (requestedWorkId) query.set("workId", requestedWorkId);
        if (requestedFolderPath) query.set("folderPath", requestedFolderPath);
        if (requestedDocumentType) query.set("documentType", requestedDocumentType);

        const response = await fetch(`/api/document-generation/bootstrap?${query.toString()}`);
        const payload = (await response.json()) as BootstrapResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "No se pudo cargar la configuracion");
        }
        if (requestId !== bootstrapRequestIdRef.current) return;

        const nextTemplates = payload.templates;
        const nextExistingSequenceCount =
          payload.context.existingSequenceCount ?? payload.context.existingDocumentCount ?? 0;
        const nextDocumentType = requestedDocumentType || payload.context.documentType || "";
        const nextFolderPath = requestedFolderPath || payload.context.folderPath || "";
        const requestedTemplateExists =
          requestedTemplateId && nextTemplates.some((template) => template.id === requestedTemplateId);
        const nextTemplateId = requestedTemplateExists
          ? requestedTemplateId
          : payload.context.selectedTemplate?.id ?? "";
        const nextTemplate = nextTemplates.find((template) => template.id === nextTemplateId) ?? null;
        const nextInitialInputData =
          nextTemplate && nextTemplate.id !== payload.context.selectedTemplate?.id
            ? applyTemplateAutoInputData(nextTemplate.schema, buildInitialInputData(nextTemplate.schema), {
              selectedContextId: requestedWorkId || null,
              selectedContextLabel: payload.context.workLabel,
              documentType: nextDocumentType || null,
              existingSequenceCount: nextExistingSequenceCount,
            })
            : payload.context.initialInputData;

        setWorks(payload.works);
        setWorkLabel(payload.context.workLabel);
        setExistingSequenceCount(nextExistingSequenceCount);
        setFolderConfigs(payload.folderConfigs);
        setTemplates(nextTemplates);
        setDynamicOptions(payload.dynamicOptions ?? {});
        setFolderPath(nextFolderPath);
        setDocumentType(nextDocumentType);
        setTemplateId(nextTemplateId);
        setInputData((current) =>
          options?.replaceInputData
            ? { ...nextInitialInputData, ...(options.inputData ?? {}) }
            : { ...nextInitialInputData, ...current },
        );
      } catch (error) {
        if (requestId === bootstrapRequestIdRef.current) {
          toast.error(error instanceof Error ? error.message : "Error al cargar datos");
        }
      } finally {
        if (requestId === bootstrapRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (initialDraftId) {
        setLoading(true);
        try {
          const response = await fetch(`/api/document-generation/drafts?id=${encodeURIComponent(initialDraftId)}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as DraftDetailResponse & { error?: string };
          if (!response.ok) {
            throw new Error(payload.error || "No se pudo cargar el borrador");
          }
          if (cancelled) return;
          if (!payload.draft.canEdit) {
            toast.error("No tienes permisos para editar este borrador.");
            router.replace("/document-generation/drafts", { scroll: false });
            return;
          }

          setWorkId(payload.draft.workId);
          setFolderPath(payload.draft.folderPath);
          setDocumentType(normalizeDocumentType(payload.draft.documentType) ?? "");
          setDraftId(payload.draft.id);
          setEditingGeneratedId("");
          setEditingGeneratedStatus("");
          setDraftStatus(payload.draft.status);
          setValidationErrors(payload.draft.validationErrors ?? []);
          setDraftRejection(payload.draft.rejection ?? null);
          setGeneratedDocument(null);
          setDocumentFileName(readDocumentFileName(payload.draft.inputData));
          await loadBootstrap(
            {
              workId: payload.draft.workId,
              folderPath: payload.draft.folderPath,
              documentType: payload.draft.documentType,
            },
            {
              templateId: payload.draft.templateId,
              inputData: payload.draft.inputData,
              replaceInputData: true,
            },
          );
        } catch (error) {
          if (!cancelled) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar el borrador");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      if (initialGeneratedId) {
        setLoading(true);
        try {
          const response = await fetch(`/api/document-generation/generated/${encodeURIComponent(initialGeneratedId)}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as GeneratedDetailResponse & { error?: string };
          if (!response.ok) {
            throw new Error(payload.error || "No se pudo cargar el documento");
          }
          if (cancelled) return;
          if (!payload.document.canEdit) {
            toast.error("Solo puedes editar documentos tuyos que aun no fueron aprobados.");
            router.replace("/document-generation", { scroll: false });
            return;
          }

          setWorkId(payload.document.workId);
          setFolderPath(payload.document.folderPath);
          setDocumentType(normalizeDocumentType(payload.document.documentType) ?? "");
          setDraftId("");
          setDraftStatus("");
          setDraftRejection(null);
          setEditingGeneratedId(payload.document.id);
          setEditingGeneratedStatus(payload.document.status);
          setValidationErrors([]);
          setGeneratedDocument(null);
          setDocumentFileName(payload.document.fileName || readDocumentFileName(payload.document.inputData));
          await loadBootstrap(
            {
              workId: payload.document.workId,
              folderPath: payload.document.folderPath,
              documentType: payload.document.documentType,
            },
            {
              templateId: payload.document.templateId,
              inputData: payload.document.inputData,
              replaceInputData: true,
            },
          );
        } catch (error) {
          if (!cancelled) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar el documento");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      setDraftId("");
      setEditingGeneratedId("");
      setEditingGeneratedStatus("");
      setDraftStatus("");
      setDraftRejection(null);
      setGeneratedDocument(null);
      setValidationErrors([]);
      setDocumentFileName("");
      await loadBootstrap({
        workId: initialWorkId,
        folderPath: initialFolderPath,
        documentType: initialDocumentType ?? undefined,
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialDocumentType, initialDraftId, initialFolderPath, initialGeneratedId, initialWorkId, loadBootstrap, router]);

  useEffect(() => {
    const query = new URLSearchParams();
    if (workId) query.set("workId", workId);
    if (folderPath) query.set("folder", folderPath);
    if (documentType) query.set("documentType", documentType);
    if (draftId) query.set("draftId", draftId);
    if (editingGeneratedId) query.set("generatedId", editingGeneratedId);
    const next = query.toString();
    router.replace(`/document-generation${next ? `?${next}` : ""}`, { scroll: false });
  }, [documentType, draftId, editingGeneratedId, folderPath, router, workId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  );

  const selectedTemplateSchema = useMemo(
    () => (selectedTemplate ? resolveTemplateSchemaOptions(selectedTemplate.schema, dynamicOptions) : null),
    [dynamicOptions, selectedTemplate],
  );

  const visibleFolderOptions = useMemo(() => {
    if (!documentType) return folderConfigs;
    return folderConfigs.filter(
      (config) =>
        config.allowedDocumentTypes.length === 0 ||
        config.allowedDocumentTypes.includes(documentType),
    );
  }, [documentType, folderConfigs]);

  const documentTypeOptions = useMemo(() => {
    const sourceFolders = folderPath
      ? folderConfigs.filter((config) => config.path === folderPath)
      : folderConfigs;
    const folderTypes = sourceFolders.flatMap((config) => config.allowedDocumentTypes);
    const templateTypes = templates.map((template) => template.documentType);
    const values = Array.from(new Set(folderTypes.length > 0 ? folderTypes : templateTypes));
    if (values.length === 0 && documentType) values.push(documentType);
    return values.map((value) => ({
      value,
      label: DOCUMENT_TYPE_LABELS[value] ?? value,
    }));
  }, [documentType, folderConfigs, folderPath, templates]);

  const standaloneFields = useMemo(
    () => selectedTemplateSchema?.fields.filter((field) => !field.repeatableGroup && field.type !== "table") ?? [],
    [selectedTemplateSchema],
  );

  const repeatableGroups = useMemo(
    () => getRepeatableGroups(selectedTemplateSchema?.fields ?? []),
    [selectedTemplateSchema],
  );
  const deferredInputData = useDeferredValue(inputData);

  const previewHtml = useMemo(() => {
    if (!selectedTemplate) return "";
    const workLabel = works.find((work) => work.id === workId)?.label ?? "";
    return renderDocumentHtml(selectedTemplate.contentHtml, deferredInputData, {
      workName: workLabel,
      generatedAt: new Date().toLocaleDateString("es-AR"),
    });
  }, [deferredInputData, selectedTemplate, workId, works]);

  const validationErrorsByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const error of validationErrors) {
      map.set(error.key, error.message);
    }
    return map;
  }, [validationErrors]);
  const invalidInlineFieldKeys = useMemo(
    () => buildInvalidInlineFieldKeys(validationErrors, selectedTemplateSchema?.fields ?? []),
    [selectedTemplateSchema, validationErrors],
  );

  const editableDocumentHtml = useMemo(() => {
    if (!selectedTemplate) return "";
    const currentWorkLabel = works.find((work) => work.id === workId)?.label ?? "";
    return renderEditableDocumentHtml(
      selectedTemplate.contentHtml,
      selectedTemplateSchema?.fields ?? [],
      inputData,
      {
        workName: currentWorkLabel,
        generatedAt: new Date().toLocaleDateString("es-AR"),
      },
      invalidInlineFieldKeys,
    );
  }, [inputData, invalidInlineFieldKeys, selectedTemplate, selectedTemplateSchema, workId, works]);

  const templateTokens = useMemo(
    () => collectRenderedFieldKeys(selectedTemplate?.contentHtml ?? "", selectedTemplateSchema?.fields ?? []),
    [selectedTemplate, selectedTemplateSchema],
  );

  const pendingFieldCount = useMemo(() => {
    if (!selectedTemplateSchema) return 0;
    return validateTemplateInput(
      selectedTemplateSchema,
      applyTemplateAliasInputData(selectedTemplateSchema, deferredInputData),
    ).length;
  }, [deferredInputData, selectedTemplateSchema]);

  const draftStatusLabel = draftStatus ? humanizeStatus(draftStatus) : "sin guardar";
  const documentCode = getDocumentCode(deferredInputData);
  const suggestedDocumentFileName = useMemo(() => {
    if (!selectedTemplate || !selectedTemplateSchema) return "";
    const currentWorkLabel = works.find((work) => work.id === workId)?.label ?? workLabel ?? "";
    return renderTemplateFileNamePattern(selectedTemplateSchema.fileNamePattern, deferredInputData, {
      templateName: selectedTemplate.name,
      documentType,
      workName: currentWorkLabel,
      folderPath,
      documentNumberFieldKey: selectedTemplateSchema.documentNumberFieldKey,
    });
  }, [deferredInputData, documentType, folderPath, selectedTemplate, selectedTemplateSchema, workId, workLabel, works]);
  const isEditingGeneratedDocument = Boolean(editingGeneratedId);
  const validationIssues = useMemo(
    () =>
      buildValidationIssues({
        workId,
        folderPath,
        documentType,
        templateId,
        validationErrors,
        repeatableGroups,
        inputData: selectedTemplateSchema
          ? applyTemplateAliasInputData(selectedTemplateSchema, deferredInputData)
          : deferredInputData,
      }),
    [deferredInputData, documentType, folderPath, repeatableGroups, selectedTemplateSchema, templateId, validationErrors, workId],
  );

  const handleWorkChange = async (value: string) => {
    setWorkId(value);
    setDraftId("");
    setDraftStatus("");
    setDraftRejection(null);
    setGeneratedDocument(null);
    setValidationErrors([]);
    setDocumentFileName("");
    await loadBootstrap({ workId: value, folderPath, documentType: documentType || undefined, templateId });
  };

  const handleDocumentTypeChange = async (value: string) => {
    const nextType = normalizeDocumentType(value) ?? "";
    const currentFolder = folderConfigs.find((config) => config.path === folderPath) ?? null;
    const nextFolderPath =
      nextType &&
        currentFolder &&
        currentFolder.allowedDocumentTypes.length > 0 &&
        !currentFolder.allowedDocumentTypes.includes(nextType)
        ? ""
        : folderPath;
    setDocumentType(nextType);
    setFolderPath(nextFolderPath);
    setTemplateId("");
    setDraftId("");
    setDraftStatus("");
    setDraftRejection(null);
    setGeneratedDocument(null);
    setValidationErrors([]);
    setDocumentFileName("");
    await loadBootstrap({ workId, folderPath: nextFolderPath, documentType: nextType || undefined });
  };

  const handleFolderChange = async (value: string) => {
    const nextFolder = folderConfigs.find((config) => config.path === value) ?? null;
    const nextDocumentType =
      !value || !nextFolder
        ? documentType
        : documentType &&
          (nextFolder.allowedDocumentTypes.length === 0 ||
            nextFolder.allowedDocumentTypes.includes(documentType))
          ? documentType
          : nextFolder.defaultDocumentType ?? "";
    setFolderPath(value);
    setDocumentType(nextDocumentType);
    setTemplateId("");
    setDraftId("");
    setDraftStatus("");
    setDraftRejection(null);
    setGeneratedDocument(null);
    setValidationErrors([]);
    setDocumentFileName("");
    await loadBootstrap({ workId, folderPath: value, documentType: nextDocumentType || undefined });
  };

  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    setValidationErrors([]);
    setDocumentFileName("");
    setDraftRejection(null);
    const nextTemplate = templates.find((template) => template.id === value) ?? null;
    if (!nextTemplate) return;
    const nextFolderPath =
      nextTemplate.targetFolderPath && folderConfigs.some((config) => config.path === nextTemplate.targetFolderPath)
        ? nextTemplate.targetFolderPath
        : folderPath;
    setDocumentType(nextTemplate.documentType);
    setFolderPath(nextFolderPath);
    setInputData(
      applyTemplateAutoInputData(nextTemplate.schema, buildInitialInputData(nextTemplate.schema, inputData), {
        selectedContextId: workId,
        selectedContextLabel: workLabel,
        documentType: nextTemplate.documentType,
        existingSequenceCount,
      }),
    );
  };

  const handleFieldChange = (field: TemplateField, value: string) => {
    setInputData((current) => ({
      ...current,
      [field.key]: value,
    }));
    setValidationErrors((current) => current.filter((error) => error.key !== field.key));
  };

  const handleInlineFieldChange = (field: TemplateField, value: string, token?: string) => {
    setInputData((current) => ({
      ...current,
      [field.key]: value,
      ...(token && token !== field.key ? { [token]: value } : {}),
    }));
    setValidationErrors((current) => current.filter((error) => error.key !== field.key));
  };

  const handleRepeatableFieldChange = (
    groupKey: string,
    rowIndex: number,
    field: TemplateField,
    value: string,
    token?: string,
  ) => {
    setInputData((current) => {
      const rows = readRepeatableRows(current, groupKey).slice();
      while (rows.length <= rowIndex) {
        rows.push({});
      }
      const selectedOption = findSelectOption(field, value);
      const unitTargetKey = field.optionUnitTargetKey ?? null;
      return {
        ...current,
        [groupKey]: rows.map((row, index) => {
          const rowData =
            row && typeof row === "object" && !Array.isArray(row)
              ? (row as Record<string, unknown>)
              : {};
          const unitPatch =
            index === rowIndex && unitTargetKey && selectedOption?.unit
              ? { [unitTargetKey]: selectedOption.unit }
              : {};
          return index === rowIndex
            ? {
              ...rowData,
              [field.key]: value,
              ...(token && token !== field.key ? { [token]: value } : {}),
              ...unitPatch,
            }
            : rowData;
        }),
      };
    });
    setValidationErrors((current) =>
      current.filter((error) => error.key !== `${groupKey}.${rowIndex}.${field.key}` && error.key !== groupKey),
    );
  };

  const handleInlineDocumentCommit = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      )
    ) return;
    const fieldKey = target.dataset.inlineField;
    if (!fieldKey) return;
    const token = target.dataset.inlineToken;
    const groupKey = target.dataset.inlineGroup;
    const rowIndex = Number(target.dataset.inlineRow ?? "");
    const field = selectedTemplateSchema?.fields.find((entry) => entry.key === fieldKey);
    const groupField = groupKey
      ? repeatableGroups.find((group) => group.key === groupKey)?.fields.find((entry) => entry.key === fieldKey)
      : null;
    const targetField = groupField ?? field;
    if (!targetField) return;
    if (groupKey && Number.isInteger(rowIndex)) {
      handleRepeatableFieldChange(groupKey, rowIndex, targetField, target.value, token);
      return;
    }
    handleInlineFieldChange(targetField, target.value, token);
  };

  const addRepeatableRow = (groupKey: string, fields: TemplateField[]) => {
    setInputData((current) => ({
      ...current,
      [groupKey]: [...readRepeatableRows(current, groupKey), createRepeatableRow(fields)],
    }));
  };

  const duplicateRepeatableRow = (groupKey: string, rowIndex: number) => {
    setInputData((current) => {
      const rows = readRepeatableRows(current, groupKey);
      const next = rows.slice();
      const source = rows[rowIndex];
      next.splice(rowIndex + 1, 0, source);
      return {
        ...current,
        [groupKey]: next,
      };
    });
  };

  const removeRepeatableRow = (groupKey: string, rowIndex: number) => {
    setInputData((current) => ({
      ...current,
      [groupKey]: readRepeatableRows(current, groupKey).filter((_, index) => index !== rowIndex),
    }));
  };

  const handleSaveDraft = async () => {
    if (editingGeneratedId) {
      toast.error("Los documentos emitidos se actualizan directo al guardar cambios.");
      return;
    }
    if (!workId || !folderPath || !documentType || !templateId) {
      toast.error("Completa obra, carpeta, tipo documental y plantilla.");
      return;
    }

    setSavingDraft(true);
    try {
      const finalDocumentFileName = documentFileName.trim() || suggestedDocumentFileName;
      const aliasedInputData = selectedTemplateSchema
        ? applyTemplateAliasInputData(selectedTemplateSchema, inputData)
        : inputData;
      const draftInputData = withDocumentFileName(aliasedInputData, finalDocumentFileName);
      const response = await fetch("/api/document-generation/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId || undefined,
          workId,
          folderPath,
          documentType,
          templateId,
          inputData: draftInputData,
        }),
      });
      const payload = (await response.json()) as DraftResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo guardar el borrador");
      }

      setDraftId(payload.draft.id);
      setDraftStatus(payload.draft.status);
      setValidationErrors(payload.draft.validation_errors ?? []);
      setInputData(payload.draft.input_data ?? draftInputData);
      setDocumentFileName(readDocumentFileName(payload.draft.input_data ?? draftInputData));
      await persistCreatableOptions((payload.draft.input_data ?? draftInputData) as Record<string, unknown>);
      toast.success("Borrador guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el borrador");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleGenerate = async () => {
    const aliasedInputData = selectedTemplateSchema
      ? applyTemplateAliasInputData(selectedTemplateSchema, inputData)
      : inputData;
    const clientValidationErrors = selectedTemplateSchema
      ? validateTemplateInput(selectedTemplateSchema, aliasedInputData)
      : [];
    setValidationErrors(clientValidationErrors);

    if (!workId || !folderPath || !documentType || !templateId || clientValidationErrors.length > 0) {
      setShowValidationReview(true);
      setValidationPulseId((current) => current + 1);
      toast.error("Completa los campos pendientes antes de generar.");
      return;
    }

    setGenerating(true);
    try {
      const finalDocumentFileName = documentFileName.trim() || suggestedDocumentFileName;
      const generationInputData = withDocumentFileName(aliasedInputData, finalDocumentFileName);
      const response = await fetch("/api/document-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draftId || undefined,
          generatedDocumentId: editingGeneratedId || undefined,
          workId,
          folderPath,
          documentType,
          templateId,
          inputData: generationInputData,
          fileName: finalDocumentFileName || undefined,
        }),
      });
      const payload = (await response.json()) as GeneratedDocumentResponse & {
        error?: string;
        validationErrors?: ValidationError[];
      };
      if (!response.ok) {
        setValidationErrors(payload.validationErrors ?? []);
        setShowValidationReview(true);
        setValidationPulseId((current) => current + 1);
        throw new Error(payload.error || "No se pudo generar el documento");
      }

      setGeneratedDocument(payload);
      if (editingGeneratedId) {
        setEditingGeneratedStatus(payload.generatedDocument.status);
      }
      setValidationErrors([]);
      setShowValidationReview(false);
      setDocumentFileName(payload.generatedDocument.file_name);
      setInputData(generationInputData);
      await persistCreatableOptions(generationInputData);
      toast.success(editingGeneratedId ? "Documento actualizado." : "Documento generado y guardado en la carpeta.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el documento");
    } finally {
      setGenerating(false);
    }
  };

  const openInWork = () => {
    if (!generatedDocument || !workId) return;
    const query = new URLSearchParams({
      tab: "documentos",
      folder: generatedDocument.relativeFolderPath,
      file: generatedDocument.relativeFilePath,
    });
    router.push(`/excel/${workId}?${query.toString()}`);
  };

  const downloadGeneratedDocument = () => {
    if (!generatedDocument || !workId) return;
    const storagePath =
      generatedDocument.generatedDocument.storage_path || `${workId}/${generatedDocument.relativeFilePath}`;
    const query = new URLSearchParams({
      path: storagePath,
      download: "1",
    });
    const anchor = document.createElement("a");
    anchor.href = `/api/obras/${encodeURIComponent(workId)}/documents/access?${query.toString()}`;
    anchor.download = generatedDocument.generatedDocument.file_name || "documento.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const persistCreatableOptions = async (data: Record<string, unknown>) => {
    if (!selectedTemplate || !selectedTemplateSchema) return;
    const additions = collectCreatableOptionAdditions(selectedTemplateSchema, data);
    if (additions.length === 0) return;
    try {
      const response = await fetch("/api/document-generation/templates/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          additions,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { templateId?: string; added?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudieron guardar las opciones nuevas.");
      }
      if (payload.added && payload.templateId) {
        await loadBootstrap(
          { workId, folderPath, documentType: documentType || undefined, templateId: payload.templateId },
          { templateId: payload.templateId, inputData: data, replaceInputData: true },
        );
      }
    } catch (error) {
      console.error("[document-generation] failed to persist creatable options", error);
      toast.error("El documento se guardo, pero no pude recordar las opciones nuevas.");
    }
  };

  const renderFieldControl = (
    field: TemplateField,
    value: unknown,
    onChange: (nextValue: string) => void,
  ) => {
    if (field.type === "textarea") {
      return (
        <TextAreaInput
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={`Completar ${field.label.toLowerCase()}`}
        />
      );
    }

    if (field.type === "select") {
      const options = (field.options ?? []).map((option) => ({
        value: option.value,
        label: option.label,
      }));
      if (field.selectMode === "creatable") {
        return (
          <CreatableCombobox
            fieldKey={field.key}
            value={String(value ?? "")}
            onChange={onChange}
            placeholder={`Seleccionar o crear ${field.label.toLowerCase()}`}
            options={options}
          />
        );
      }
      return (
        <NativeSelect
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={`Seleccionar ${field.label.toLowerCase()}`}
          options={options}
        />
      );
    }

    return (
      <TextInput
        value={String(value ?? "")}
        onChange={onChange}
        placeholder={`Completar ${field.label.toLowerCase()}`}
        mono={field.type === "money" || field.type === "number"}
        type={field.type === "date" ? "date" : field.type === "number" || field.type === "money" ? "number" : "text"}
        icon={field.type === "date" ? <CalendarDays className="h-3.5 w-3.5" /> : undefined}
      />
    );
  };

  return (
    <div className="w-full ">
      <div className="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <DocumentGenerationNav permissions={permissions} className="w-full sm:w-auto" />
              <div className="inline-flex rounded-md border border-stone-200 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setEditorMode("inline")}
                  className={cn(
                    "h-8 rounded px-3 text-sm font-medium transition",
                    editorMode === "inline"
                      ? "bg-stone-950 text-white shadow-sm"
                      : "text-stone-600 hover:bg-white",
                  )}
                >
                  Documento
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("form")}
                  className={cn(
                    "h-8 rounded px-3 text-sm font-medium transition",
                    editorMode === "form"
                      ? "bg-stone-950 text-white shadow-sm"
                      : "text-stone-600 hover:bg-white",
                  )}
                >
                  Formulario
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSaveDraft}
              disabled={savingDraft || loading || Boolean(editingGeneratedId)}
              className="h-9 rounded-md px-4 text-stone-700"
              hidden={Boolean(editingGeneratedId)}
            >
              {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar borrador
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewDialogOpen(true)}
              className="h-9 rounded-md border-stone-200 bg-white px-4"
            >
              <Eye className="mr-2 h-4 w-4" />
              Vista previa completa
            </Button>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generating || loading || !selectedTemplate}
              className="h-9 rounded-md bg-[linear-gradient(180deg,#201E25_0%,#323137_100%)] px-4 text-white shadow-[0_2px_4px_rgba(0,0,0,0.10),0_0_0_1px_#0D0D0D]"
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="mr-2 h-4 w-4" />
              )}
              {editingGeneratedId ? "Guardar cambios" : "Generar documento"}
            </Button>
          </div>
        </div>
      </div>

      {editorMode === "inline" ? (
        <div className="bg-[#e9e7e1] px-3 pt-4 sm:px-6">
          <div className="mx-auto grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] xl:sticky xl:top-24 xl:self-start">
              <div className="grid gap-3">
                <FormField label="Obra" required>
                  <NativeSelect
                    value={workId}
                    onChange={(value) => void handleWorkChange(value)}
                    icon={iconForContextField("work")}
                    options={works.map((work) => ({ value: work.id, label: work.label }))}
                    placeholder="Seleccionar obra"
                    disabled={isEditingGeneratedDocument}
                  />
                </FormField>
                <FormField label="Tipo documental" required>
                  <NativeSelect
                    value={documentType}
                    onChange={(value) => void handleDocumentTypeChange(value)}
                    icon={iconForContextField("type")}
                    options={documentTypeOptions}
                    placeholder="Seleccionar tipo"
                    disabled={isEditingGeneratedDocument}
                  />
                </FormField>
                <FormField label="Carpeta destino" required>
                  <NativeSelect
                    value={folderPath}
                    onChange={(value) => void handleFolderChange(value)}
                    icon={iconForContextField("folder")}
                    options={visibleFolderOptions.map((folder) => ({
                      value: folder.path,
                      label: `${folder.path} - ${folder.name}`,
                    }))}
                    placeholder="Seleccionar carpeta"
                    disabled={isEditingGeneratedDocument}
                  />
                </FormField>
                <FormField label="Plantilla" required>
                  <NativeSelect
                    value={templateId}
                    onChange={handleTemplateChange}
                    icon={iconForContextField("template")}
                    options={templates.map((template) => ({
                      value: template.id,
                      label: template.name,
                    }))}
                    placeholder="Seleccionar plantilla"
                  />
                </FormField>
                <FormField
                  label="Nombre del documento"
                  hint="Opcional. Se usara como nombre final del PDF."
                >
                  <TextInput
                    value={documentFileName}
                    onChange={setDocumentFileName}
                    placeholder={suggestedDocumentFileName || "Ej. orden-compra-11.pdf"}
                  />
                </FormField>
              </div>
              <div className="mt-4">
                <RejectionNotice rejection={draftRejection} />
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] xl:col-start-2 xl:row-span-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                    Editor del documento
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight text-stone-950">
                      {selectedTemplate?.name ?? "Selecciona una plantilla"}
                    </h1>
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-medium text-[#b54708]">
                      {pendingFieldCount} pendientes
                    </span>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-600">
                      borrador {draftStatusLabel}
                    </span>
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-1 font-mono text-[11px] text-stone-500">
                      {documentCode}
                    </span>
                    {editingGeneratedId ? (
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium capitalize text-stone-600">
                        {humanizeStatus(editingGeneratedStatus)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PreviewToolButton
                    onClick={() => setPreviewZoom((current) => Math.max(50, current - 8))}
                    disabled={!selectedTemplate}
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </PreviewToolButton>
                  <span className="min-w-[38px] text-center font-mono text-xs text-stone-600">
                    {previewZoom}%
                  </span>
                  <PreviewToolButton
                    onClick={() => setPreviewZoom((current) => Math.min(140, current + 8))}
                    disabled={!selectedTemplate}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </PreviewToolButton>
                </div>
              </div>

              <div className="relative max-h-[calc(100vh-200px)] overflow-auto bg-[#d8d4c6] px-2 py-5 sm:px-5">
                {selectedTemplate ? (
                  <>
                    <div className="mx-auto w-fit pb-6">
                      <div
                        className="origin-top rounded-sm bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_50px_-18px_rgba(0,0,0,0.28)]"
                        style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: "top center" }}
                      >
                        <div
                          key={`document-editor-${validationPulseId}`}
                          className="report-paper inline-document-editor bg-white"
                          onBlur={handleInlineDocumentCommit}
                          onChange={handleInlineDocumentCommit}
                          dangerouslySetInnerHTML={{ __html: editableDocumentHtml }}
                        />
                      </div>
                    </div>
                    {repeatableGroups.length > 0 ? (
                      <div className="pointer-events-none absolute right-5 top-[48%] z-20 hidden -translate-y-1/2 flex-col gap-2 xl:flex">
                        {repeatableGroups.map((group) => (
                          <Button
                            key={group.key}
                            type="button"
                            variant="outline"
                            className="pointer-events-auto h-10 rounded-md border-stone-300 bg-white px-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                            onClick={() => addRepeatableRow(group.key, group.fields)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar {group.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="grid min-h-[560px] place-items-center rounded-xl border border-dashed border-stone-300 bg-white px-6 text-center">
                    <div>
                      <FileText className="mx-auto h-8 w-8 text-stone-400" />
                      <p className="mt-3 text-sm font-medium text-stone-800">
                        Elige una plantilla para escribir directo sobre el documento.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {standaloneFields.some((field) => !templateTokens.has(field.key)) ? (
              <div className="xl:col-start-2">
                <SectionCard title="Campos adicionales">
                  <div className="grid gap-4 md:grid-cols-3">
                    {standaloneFields
                      .filter((field) => !templateTokens.has(field.key))
                      .map((field) => {
                        const value = inputData[field.key];
                        const error = validationErrorsByKey.get(field.key);
                        return (
                          <FormField
                            key={field.key}
                            label={field.label}
                            required={field.required}
                            hint={field.description || undefined}
                            error={error}
                            className={getTemplateFieldSpan(field)}
                          >
                            {renderFieldControl(field, value, (nextValue) => handleFieldChange(field, nextValue))}
                          </FormField>
                        );
                      })}
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {showValidationReview && validationIssues.length > 0 ? (
              <div className="xl:col-start-2">
                <SectionCard title="Revision incompleta">
                  {validationIssues.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <Check className="h-4 w-4 text-emerald-700" />
                      <p className="text-sm font-medium text-emerald-800">
                        Todo lo obligatorio esta completo. Ya puedes generar el documento.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                      {validationIssues.map((issue, index) => (
                        <div
                          key={`${issue.kind}-${issue.message}-${index}`}
                          className="flex items-center gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-700 first:border-t-0"
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              issue.kind === "error" ? "bg-red-500" : "bg-amber-500",
                            )}
                          />
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            ) : null}

            {generatedDocument ? (
              <div className="xl:col-start-2">
                <SectionCard
                  eyebrow="Documento generado"
                  title={generatedDocument.generatedDocument.file_name}
                  hint={`Guardado en ${generatedDocument.relativeFolderPath}.`}
                  rightSlot={
                    generatedDocument.generatedDocument.status === "APPROVED" ? (
                      <DocumentApprovedSeal status={generatedDocument.generatedDocument.status} />
                    ) : (
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium capitalize text-stone-700">
                        {humanizeStatus(generatedDocument.generatedDocument.status)}
                      </span>
                    )
                  }
                >
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={openInWork} className="rounded-md">
                      Ver en la obra
                    </Button>
                    <Button asChild type="button" variant="outline" className="rounded-md">
                      <Link
                        href={`/excel/${workId}?tab=documentos&folder=${encodeURIComponent(generatedDocument.relativeFolderPath)}&file=${encodeURIComponent(generatedDocument.relativeFilePath)}`}
                      >
                        Abrir documento
                      </Link>
                    </Button>
                    <Button type="button" variant="outline" onClick={downloadGeneratedDocument} className="rounded-md">
                      <Download className="mr-2 h-4 w-4" />
                      Descargar
                    </Button>
                    <Button asChild type="button" variant="outline" className="rounded-md">
                      <Link href="/document-generation/review">Ir a revision</Link>
                    </Button>
                  </div>
                </SectionCard>
              </div>
            ) : null}
          </div>
        </div>
      ) : (

        <div className="grid min-h-[calc(100vh-162px)] grid-cols-1 xl:grid-cols-[minmax(480px,1fr)_minmax(0,0.5fr)]">
          <div className="overflow-y-auto border-r ">
            <div className="px-4 pb-5 sm:px-6">
              <div className="mx-auto flex flex-col gap-4 mt-4">
                <SectionCard
                  title="Contexto del documento"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Obra" required>
                      <NativeSelect
                        value={workId}
                        onChange={(value) => void handleWorkChange(value)}
                        icon={iconForContextField("work")}
                        options={works.map((work) => ({ value: work.id, label: work.label }))}
                        placeholder="Seleccionar obra"
                        disabled={isEditingGeneratedDocument}
                      />
                    </FormField>

                    <FormField label="Tipo documental" required>
                      <NativeSelect
                        value={documentType}
                        onChange={(value) => void handleDocumentTypeChange(value)}
                        icon={iconForContextField("type")}
                        options={documentTypeOptions}
                        placeholder="Seleccionar tipo"
                        disabled={isEditingGeneratedDocument}
                      />
                    </FormField>

                    <FormField label="Carpeta destino" required>
                      <NativeSelect
                        value={folderPath}
                        onChange={(value) => void handleFolderChange(value)}
                        icon={iconForContextField("folder")}
                        options={visibleFolderOptions.map((folder) => ({
                          value: folder.path,
                          label: `${folder.path} · ${folder.name}`,
                        }))}
                        placeholder="Seleccionar carpeta"
                        disabled={isEditingGeneratedDocument}
                      />
                    </FormField>

                    <FormField
                      label="Plantilla"
                      required
                      hint="La plantilla define los campos del paso siguiente."
                    >
                      <NativeSelect
                        value={templateId}
                        onChange={handleTemplateChange}
                        icon={iconForContextField("template")}
                        options={templates.map((template) => ({
                          value: template.id,
                          label: template.name,
                        }))}
                        placeholder="Seleccionar plantilla"
                      />
                    </FormField>

                    <FormField
                      label="Nombre del documento"
                      hint="Opcional. Se usara como nombre final del PDF."
                    >
                      <TextInput
                        value={documentFileName}
                        onChange={setDocumentFileName}
                        placeholder={suggestedDocumentFileName || "Ej. orden-compra-11.pdf"}
                      />
                    </FormField>
                  </div>
                  <div className="mt-4">
                    <RejectionNotice rejection={draftRejection} />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Datos del documento"
                  rightSlot={
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-medium text-[#d65a07]">
                        {pendingFieldCount} pendientes
                      </span>
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-600">
                        borrador {draftStatusLabel}
                      </span>
                    </div>
                  }
                >
                  {selectedTemplate ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      {standaloneFields.map((field) => {
                        const value = inputData[field.key];
                        const error = validationErrorsByKey.get(field.key);
                        return (
                          <FormField
                            key={field.key}
                            label={field.label}
                            required={field.required}
                            hint={field.description || undefined}
                            error={error}
                            className={getTemplateFieldSpan(field)}
                          >
                            {renderFieldControl(field, value, (nextValue) => handleFieldChange(field, nextValue))}
                          </FormField>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                      Selecciona una plantilla para mostrar los campos del documento.
                    </div>
                  )}
                </SectionCard>

                {repeatableGroups.map((group) => {
                  const rows = readRepeatableRows(inputData, group.key);
                  const safeRows = rows.length > 0 ? rows : [createRepeatableRow(group.fields)];
                  const filledRows = countFilledRows(rows);

                  return (
                    <SectionCard
                      key={group.key}
                      title={group.label}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => addRepeatableRow(group.key, group.fields)}
                          className="inline-flex h-8 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Agregar fila
                        </button>
                      }
                    >
                      <div className="space-y-4">
                        <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-600">
                          {filledRows} fila{filledRows === 1 ? "" : "s"} con datos
                        </div>

                        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white overflow-x-scroll">
                          <div
                            className="grid items-center bg-[#f1f3f6] text-[10px] font-bold uppercase tracking-[0.12em] text-[#5b616b]"
                            style={{
                              gridTemplateColumns: `40px repeat(${Math.max(group.fields.length, 1)}, minmax(120px, 1fr)) 40px`,
                            }}
                          >
                            <div className="px-3 py-2 text-center">#</div>
                            {group.fields.map((field) => (
                              <div key={`${group.key}-head-${field.key}`} className="px-3 py-2">
                                {field.label}
                              </div>
                            ))}
                            <div className="px-3 py-2 text-center" />
                          </div>

                          {safeRows.map((row, rowIndex) => {
                            const rowData =
                              row && typeof row === "object" && !Array.isArray(row)
                                ? (row as Record<string, unknown>)
                                : {};
                            return (
                              <div
                                key={`${group.key}-${rowIndex}`}
                                className="grid items-start border-t border-stone-200 bg-white"
                                style={{
                                  gridTemplateColumns: `40px repeat(${Math.max(group.fields.length, 1)}, minmax(120px, 1fr)) 40px`,
                                }}
                              >
                                <div className="px-3 py-4 text-center font-mono text-xs text-stone-400">
                                  {String(rowIndex + 1).padStart(2, "0")}
                                </div>
                                {group.fields.map((field) => (
                                  <div key={`${group.key}-${rowIndex}-${field.key}`} className="px-2 py-2">
                                    {renderFieldControl(field, rowData[field.key], (nextValue) =>
                                      handleRepeatableFieldChange(group.key, rowIndex, field, nextValue),
                                    )}
                                  </div>
                                ))}
                                <div className="px-2 py-3">
                                  <RepeatableRowMenu
                                    onDuplicate={() => duplicateRepeatableRow(group.key, rowIndex)}
                                    onRemove={() => removeRepeatableRow(group.key, rowIndex)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </SectionCard>
                  );
                })}

                <SectionCard
                  title="Revision"
                >
                  {validationIssues.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <Check className="h-4 w-4 text-emerald-700" />
                      <p className="text-sm font-medium text-emerald-800">
                        Todo lo obligatorio esta completo. Ya puedes generar el documento.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3">
                        <Info className="h-4 w-4 text-stone-600" />
                        <p className="text-sm font-medium text-stone-900">Revisa antes de generar</p>
                        <span className="ml-auto font-mono text-xs text-stone-500">
                          {validationIssues.length} pendiente{validationIssues.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div>
                        {validationIssues.map((issue, index) => (
                          <div
                            key={`${issue.kind}-${issue.message}-${index}`}
                            className="flex items-center gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-700 first:border-t-0"
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                issue.kind === "error" ? "bg-red-500" : "bg-amber-500",
                              )}
                            />
                            {issue.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>

                {generatedDocument ? (
                  <SectionCard
                    eyebrow="Documento generado"
                    title={generatedDocument.generatedDocument.file_name}
                    hint={`Guardado en ${generatedDocument.relativeFolderPath}.`}
                    rightSlot={
                      generatedDocument.generatedDocument.status === "APPROVED" ? (
                        <DocumentApprovedSeal status={generatedDocument.generatedDocument.status} />
                      ) : (
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium capitalize text-stone-700">
                          {humanizeStatus(generatedDocument.generatedDocument.status)}
                        </span>
                      )
                    }
                  >
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={openInWork} className="rounded-md">
                        Ver en la obra
                      </Button>
                      <Button asChild type="button" variant="outline" className="rounded-md">
                        <Link
                          href={`/excel/${workId}?tab=documentos&folder=${encodeURIComponent(generatedDocument.relativeFolderPath)}&file=${encodeURIComponent(generatedDocument.relativeFilePath)}`}
                        >
                          Abrir documento
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={downloadGeneratedDocument}
                        className="rounded-md"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </Button>
                      <Button asChild type="button" variant="outline" className="rounded-md">
                        <Link href="/document-generation/review">
                          Ir a revision
                        </Link>
                      </Button>
                    </div>
                  </SectionCard>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="sticky top-0 flex max-h-[100vh] min-h-[640px] flex-col overflow-hidden bg-[#e9e7e1]">
            <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                  Vista previa
                </p>
                <span className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 font-mono text-[11px] text-stone-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ff5800]" />
                  en vivo
                </span>
              </div>

              <div className="flex items-center gap-2">
                <PreviewToolButton
                  onClick={() => setPreviewZoom((current) => Math.max(50, current - 8))}
                  disabled={!selectedTemplate}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </PreviewToolButton>
                <span className="min-w-[38px] text-center font-mono text-xs text-stone-600">
                  {previewZoom}%
                </span>
                <PreviewToolButton
                  onClick={() => setPreviewZoom((current) => Math.min(140, current + 8))}
                  disabled={!selectedTemplate}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </PreviewToolButton>
                <div className="mx-1 h-5 w-px bg-stone-200" />
                <PreviewToolButton onClick={() => setPreviewDialogOpen(true)} disabled={!selectedTemplate}>
                  <Eye className="h-3.5 w-3.5" />
                </PreviewToolButton>
              </div>
            </div>

            <div className="report-preview-container flex-1 overflow-auto px-6 py-6">
              {selectedTemplate ? (
                <div className="relative max-h-full">
                  <DocumentApprovedSeal
                    status={generatedDocument?.generatedDocument.status ?? null}
                    size="sm"
                    className="absolute left-5 top-5 z-20 w-full"
                  />
                  <div className="report-paper report-paper-fit-preview bg-white ">
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} className="" />
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[560px] place-items-center rounded-xl border border-dashed border-stone-300 bg-white px-6 text-center">
                  <div>
                    <p className="text-sm font-medium text-stone-800">
                      La vista previa aparece aca.
                    </p>
                    <p className="mt-2 text-sm text-stone-500">
                      Elige obra, tipo documental y plantilla para renderizar el documento.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-stone-200 px-6 py-5">
            <DialogTitle>Vista previa completa</DialogTitle>
            <DialogDescription>
              Documento renderizado con los datos cargados hasta ahora.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(92vh-96px)] overflow-auto bg-[#f4f3ee] p-6">
            {selectedTemplate ? (
              <div className="mx-auto w-fit rounded-xl border border-stone-300 bg-[#e9e7e1] p-8 shadow-[0_4px_12px_rgba(31,35,40,0.06)]">
                <div className="relative report-paper bg-white">
                  <DocumentApprovedSeal
                    status={generatedDocument?.generatedDocument.status ?? null}
                    size="md"
                    className="absolute left-5 top-5 z-20"
                  />
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            ) : (
              <div className="grid min-h-[420px] place-items-center rounded-[24px] border border-dashed border-stone-300 bg-white px-6 text-center text-sm text-stone-500">
                Selecciona una plantilla para renderizar el documento.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
