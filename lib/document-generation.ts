import {
  coerceValueForType,
  evaluateTablaFormula,
  normalizeFolderPath,
  type TablaColumnDataType,
} from "@/lib/tablas";

export const DOCUMENT_TYPES = [
  "PURCHASE_ORDER",
  "INVOICE",
  "CERTIFICATE",
  "DELIVERY_NOTE",
  "QUOTE_REQUEST",
  "ACT",
  "CUSTOM",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const GENERATED_DOCUMENT_STATUSES = [
  "DRAFT",
  "READY_TO_GENERATE",
  "GENERATED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

export type GeneratedDocumentStatus = (typeof GENERATED_DOCUMENT_STATUSES)[number];

export type TemplateFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "money"
  | "table"
  | "work_reference"
  | "supplier_reference";

export type TemplateFieldSource = "folder" | "extra";

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  source?: TemplateFieldSource;
  description?: string | null;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  repeatableGroup?: string | null;
  repeatableGroupLabel?: string | null;
  columns?: TemplateField[];
};

export type TemplateSchema = {
  fields: TemplateField[];
};

export type ValidationError = {
  key: string;
  message: string;
};

export type DocumentTemplateSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  documentType: DocumentType;
  targetFolderPath: string | null;
  version: number;
  status: string;
  isSystem: boolean;
  tenantScoped: boolean;
  schema: TemplateSchema;
  contentHtml: string;
};

export type FolderFieldSuggestion = {
  fieldKey: string;
  label: string;
  dataType: string;
  required: boolean;
  description: string | null;
};

export type FolderGenerationConfig = {
  path: string;
  name: string;
  allowedDocumentTypes: DocumentType[];
  defaultDocumentType: DocumentType | null;
};

export type ExtractionTableColumn = {
  fieldKey: string;
  dataType: TablaColumnDataType;
  config?: Record<string, unknown> | null;
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PURCHASE_ORDER: "Orden de compra",
  INVOICE: "Factura interna",
  CERTIFICATE: "Certificado",
  DELIVERY_NOTE: "Remito",
  QUOTE_REQUEST: "Solicitud de cotizacion",
  ACT: "Acta",
  CUSTOM: "Documento custom",
};

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && DOCUMENT_TYPES.includes(value as DocumentType);
}

export function normalizeDocumentType(value: unknown): DocumentType | null {
  return isDocumentType(value) ? value : null;
}

export function normalizeTemplateSchema(value: unknown): TemplateSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { fields: [] };
  }
  const rawFields = Array.isArray((value as { fields?: unknown }).fields)
    ? ((value as { fields?: unknown[] }).fields ?? [])
    : [];

  const fields = rawFields
    .filter((field): field is Record<string, unknown> => Boolean(field) && typeof field === "object" && !Array.isArray(field))
    .map((field, index) => normalizeTemplateField(field, `field_${index + 1}`));

  return { fields };
}

function normalizeTemplateField(field: Record<string, unknown>, fallbackKey: string): TemplateField {
  const key = typeof field.key === "string" && field.key.trim() ? field.key.trim() : fallbackKey;
  const label = typeof field.label === "string" && field.label.trim() ? field.label.trim() : key;
  const type = normalizeFieldType(field.type);
  const repeatableGroup =
    typeof field.repeatableGroup === "string" && field.repeatableGroup.trim().length > 0
      ? normalizeTemplateVariableKey(field.repeatableGroup)
      : null;
  return {
    key,
    label,
    type,
    required: Boolean(field.required),
    source: normalizeFieldSource(field.source),
    description:
      typeof field.description === "string" && field.description.trim().length > 0
        ? field.description.trim()
        : null,
    defaultValue: field.defaultValue,
    options: Array.isArray(field.options)
      ? field.options
          .filter(
            (option): option is Record<string, unknown> =>
              Boolean(option) && typeof option === "object" && !Array.isArray(option),
          )
          .map((option) => ({
            label:
              typeof option.label === "string" && option.label.trim()
                ? option.label.trim()
                : String(option.value ?? ""),
            value: String(option.value ?? ""),
          }))
      : undefined,
    repeatableGroup,
    repeatableGroupLabel:
      typeof field.repeatableGroupLabel === "string" && field.repeatableGroupLabel.trim().length > 0
        ? field.repeatableGroupLabel.trim()
        : repeatableGroup,
    columns:
      type === "table" && Array.isArray(field.columns)
        ? field.columns
            .filter((column): column is Record<string, unknown> => Boolean(column) && typeof column === "object" && !Array.isArray(column))
            .map((column, index) => normalizeTemplateField(column, `column_${index + 1}`))
        : undefined,
  };
}

function normalizeFieldType(value: unknown): TemplateFieldType {
  switch (value) {
    case "number":
    case "date":
    case "select":
    case "textarea":
    case "money":
    case "table":
    case "work_reference":
    case "supplier_reference":
      return value;
    default:
      return "text";
  }
}

function normalizeFieldSource(value: unknown): TemplateFieldSource | undefined {
  if (value === "folder" || value === "extra") return value;
  return undefined;
}

function normalizeTemplateVariableKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function normalizeFolderGenerationPath(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeFolderPath(value);
}

export function validateTemplateInput(
  schema: TemplateSchema,
  inputData: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const repeatableGroups = new Map<string, TemplateField[]>();

  for (const field of schema.fields) {
    if (field.type === "table") {
      errors.push(...validateTableField(field, inputData[field.key]));
      continue;
    }
    if (!field.repeatableGroup) {
      errors.push(...validateFieldValue(field, inputData[field.key], field.key));
      continue;
    }
    repeatableGroups.set(field.repeatableGroup, [
      ...(repeatableGroups.get(field.repeatableGroup) ?? []),
      field,
    ]);
  }

  for (const [groupKey, fields] of repeatableGroups.entries()) {
    const rows = Array.isArray(inputData[groupKey]) ? inputData[groupKey] : [];
    const requiredFields = fields.filter((field) => field.required);
    if (requiredFields.length > 0 && rows.length === 0) {
      errors.push({
        key: groupKey,
        message: `${fields[0].repeatableGroupLabel ?? groupKey} requiere al menos una fila.`,
      });
    }

    rows.forEach((row, rowIndex) => {
      const rowData =
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : {};
      for (const field of fields) {
        errors.push(
          ...validateFieldValue(field, rowData[field.key], `${groupKey}.${rowIndex}.${field.key}`),
        );
      }
    });
  }

  return errors;
}

function validateTableField(field: TemplateField, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const rows = Array.isArray(value) ? value : [];
  const columns = field.columns ?? [];
  if (field.required && rows.length === 0) {
    errors.push({ key: field.key, message: `${field.label} requiere al menos una fila.` });
  }
  rows.forEach((row, rowIndex) => {
    const rowData =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : {};
    for (const column of columns) {
      errors.push(
        ...validateFieldValue(column, rowData[column.key], `${field.key}.${rowIndex}.${column.key}`),
      );
    }
  });
  return errors;
}

function validateFieldValue(field: TemplateField, value: unknown, errorKey: string): ValidationError[] {
  const normalizedValue =
    typeof value === "string" ? value.trim() : value == null ? "" : value;
  if (!field.required) return [];
  if (field.type === "number" || field.type === "money") {
    if (normalizedValue === "" || normalizedValue == null) {
      return [{ key: errorKey, message: `${field.label} es obligatorio.` }];
    }
    const parsed = Number(normalizedValue);
    if (!Number.isFinite(parsed)) {
      return [{ key: errorKey, message: `${field.label} debe ser numerico.` }];
    }
    return [];
  }
  if (typeof normalizedValue === "string" && normalizedValue.length === 0) {
    return [{ key: errorKey, message: `${field.label} es obligatorio.` }];
  }
  if (normalizedValue == null || normalizedValue === "") {
    return [{ key: errorKey, message: `${field.label} es obligatorio.` }];
  }
  return [];
}

export function buildInitialInputData(schema: TemplateSchema, current: Record<string, unknown> = {}) {
  const next: Record<string, unknown> = { ...current };
  const repeatableGroups = new Map<string, TemplateField[]>();
  for (const field of schema.fields) {
    if (field.type === "table") {
      if (!Array.isArray(next[field.key])) {
        const columns = field.columns ?? [];
        const row = Object.fromEntries(
          columns
            .filter((column) => column.defaultValue !== undefined)
            .map((column) => [column.key, column.defaultValue]),
        );
        next[field.key] = [row];
      }
      continue;
    }
    if (field.repeatableGroup) {
      repeatableGroups.set(field.repeatableGroup, [
        ...(repeatableGroups.get(field.repeatableGroup) ?? []),
        field,
      ]);
      continue;
    }
    if (!(field.key in next) && field.defaultValue !== undefined) {
      next[field.key] = field.defaultValue;
    }
  }
  for (const [groupKey, fields] of repeatableGroups.entries()) {
    if (Array.isArray(next[groupKey])) continue;
    const row = Object.fromEntries(
      fields
        .filter((field) => field.defaultValue !== undefined)
        .map((field) => [field.key, field.defaultValue]),
    );
    next[groupKey] = [row];
  }
  return next;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderDocumentHtml(
  templateHtml: string,
  inputData: Record<string, unknown>,
  extraData: Record<string, unknown> = {},
): string {
  const scope = {
    ...Object.fromEntries(
      Object.entries(inputData).map(([key, value]) => [key, formatTemplateValue(value)]),
    ),
    ...Object.fromEntries(
      Object.entries(extraData).map(([key, value]) => [key, formatTemplateValue(value)]),
    ),
  };

  const renderedRepeatables = templateHtml.replace(
    /\{\{#\s*([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
    (_, groupKey: string, block: string) => {
      const rows = Array.isArray(inputData[groupKey]) ? inputData[groupKey] : [];
      return rows
        .map((row) => {
          const rowScope =
            row && typeof row === "object" && !Array.isArray(row)
              ? Object.fromEntries(
                  Object.entries(row).map(([key, value]) => [key, formatTemplateValue(value)]),
                )
              : {};
          return block.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_rowMatch: string, token: string) => {
            return escapeHtml(rowScope[token] ?? scope[token] ?? "");
          });
        })
        .join("");
    },
  );

  return renderedRepeatables.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token: string) => {
    return escapeHtml(scope[token] ?? "");
  });
}

function formatTemplateValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map((entry) => formatTemplateValue(entry)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function sanitizeGeneratedFileName(base: string) {
  const normalized = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || `documento-${Date.now()}.pdf`;
}

export function withNumericSuffix(fileName: string, attempt: number) {
  if (attempt <= 1) return fileName;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return `${fileName} (${attempt})`;
  return `${fileName.slice(0, dotIndex)} (${attempt})${fileName.slice(dotIndex)}`;
}

export function buildDocumentGenerationExtractionRows(params: {
  schema: TemplateSchema;
  inputData: Record<string, unknown>;
  columns: ExtractionTableColumn[];
  documentMeta: {
    bucket: string;
    path: string;
    fileName: string;
  };
}) {
  const { schema, inputData, columns, documentMeta } = params;
  if (columns.length === 0) return [] as Array<Record<string, unknown>>;

  const targetFieldKeys = new Set(columns.map((column) => column.fieldKey));
  const candidateRows = collectCandidateRows(schema, inputData).sort(
    (left, right) => getCandidateOverlap(right.rows, targetFieldKeys) - getCandidateOverlap(left.rows, targetFieldKeys),
  );
  const bestCandidate = candidateRows[0];
  const hasScopedColumns = columns.some((column) => {
    const scope = column.config?.ocrScope;
    return scope === "parent" || scope === "item";
  });
  const shouldUseCandidateRows =
    Boolean(bestCandidate) &&
    bestCandidate.rows.length > 0 &&
    (hasScopedColumns || getCandidateOverlap(bestCandidate.rows, targetFieldKeys) > 0);

  const rowSources = shouldUseCandidateRows ? bestCandidate?.rows ?? [] : [null];

  return rowSources.map((rowSource) => {
    const normalized = buildExtractionRow(columns, inputData, rowSource);
    normalized.__docBucket = documentMeta.bucket;
    normalized.__docPath = documentMeta.path;
    normalized.__docFileName = documentMeta.fileName;
    return applyFormulaColumns(normalized, columns);
  });
}

function collectCandidateRows(schema: TemplateSchema, inputData: Record<string, unknown>) {
  const candidates: Array<{ key: string; rows: Array<Record<string, unknown>> }> = [];
  const repeatableGroups = new Set<string>();

  for (const field of schema.fields) {
    if (field.type === "table") {
      const rows = normalizeRowArray(inputData[field.key]);
      if (rows.length > 0) {
        candidates.push({ key: field.key, rows });
      }
      continue;
    }
    if (field.repeatableGroup && !repeatableGroups.has(field.repeatableGroup)) {
      repeatableGroups.add(field.repeatableGroup);
      const rows = normalizeRowArray(inputData[field.repeatableGroup]);
      if (rows.length > 0) {
        candidates.push({ key: field.repeatableGroup, rows });
      }
    }
  }

  return candidates;
}

function normalizeRowArray(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<Record<string, unknown>>;
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({ ...row }));
}

function getCandidateOverlap(rows: Array<Record<string, unknown>>, targetFieldKeys: Set<string>) {
  return rows.reduce((best, row) => {
    const overlap = Object.keys(row).filter((key) => targetFieldKeys.has(key)).length;
    return Math.max(best, overlap);
  }, 0);
}

function buildExtractionRow(
  columns: ExtractionTableColumn[],
  inputData: Record<string, unknown>,
  rowSource: Record<string, unknown> | null,
) {
  const rowData: Record<string, unknown> = {};

  for (const column of columns) {
    const value =
      rowSource && Object.prototype.hasOwnProperty.call(rowSource, column.fieldKey)
        ? rowSource[column.fieldKey]
        : inputData[column.fieldKey];
    rowData[column.fieldKey] = coerceValueForType(column.dataType, value);
  }

  return rowData;
}

function applyFormulaColumns(
  rowData: Record<string, unknown>,
  columns: ExtractionTableColumn[],
) {
  const nextRow = { ...rowData };
  for (const column of columns) {
    const formula =
      column.config && typeof column.config.formula === "string"
        ? column.config.formula.trim()
        : "";
    if (!formula) continue;
    const computed = evaluateTablaFormula(formula, nextRow);
    nextRow[column.fieldKey] = coerceValueForType(column.dataType, computed);
  }
  return nextRow;
}
