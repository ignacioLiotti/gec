import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";
import {
  coerceValueForType,
  ensureTablaDataType,
  MATERIALS_OCR_PROMPT,
  normalizeFolderPath,
  normalizeFieldKey,
} from "@/lib/tablas";
import { applyOcrExtractionRowPolicy } from "@/lib/ocr-row-policy";
import {
  fetchTenantPlan,
  type SubscriptionPlanLimits,
} from "@/lib/subscription-plans";
import { incrementTenantUsage, logTenantUsageEvent } from "@/lib/tenant-usage";
import { estimateUsdForTokens } from "@/lib/ai-pricing";

type RouteContext = { params: Promise<{ id: string }> };

type ColumnMeta = {
  id: string;
  label: string;
  fieldKey: string;
  dataType: ReturnType<typeof ensureTablaDataType>;
  required: boolean;
  config: Record<string, unknown>;
};

type TablaDef = {
  tablaId: string;
  tablaName: string;
  tenantId: string;
  settings: Record<string, unknown>;
  parentColumns: ColumnMeta[];
  itemColumns: ColumnMeta[];
  extractionSchema: z.ZodTypeAny;
  templateDescription: string | null;
};

type TemplatePromptContext = {
  description: string | null;
  columns: Array<{
    fieldKey: string;
    label: string;
    description?: string;
    aliases?: string[];
    examples?: string[];
    excelKeywords?: string[];
  }>;
};

const LEGACY_ORDER_PARENT_FIELD_KEYS = new Set([
  "nro",
  "nroorden",
  "fecha",
  "solicitante",
  "proveedor",
  "totalorden",
  "total_orden",
]);

const LEGACY_ORDER_ITEM_FIELD_KEYS = new Set([
  "cantidad",
  "unidad",
  "material",
  "detalle_descriptivo",
  "detalle descriptivo",
  "preciounitario",
  "precio_unitario",
  "preciototal",
  "precio_total",
]);

const DOCUMENTS_BUCKET = "obra-documents";
const OCR_MODEL = process.env.OCR_MODEL ?? "gemini-2.5-flash";
const GOOGLE_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
const MIN_OCR_TOKEN_RESERVE = 1_500;
const MAX_OCR_TOKEN_RESERVE = 8_000;
const DEFAULT_OCR_TOKEN_RESERVE = 2_000;
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms)
    ),
  ]);
}

function extractJsonFromText(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Respuesta vacía del modelo");
  }
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  throw new Error("No se encontró JSON en la respuesta del modelo");
}

function zodTypeForColumn(column: ColumnMeta) {
  switch (column.dataType) {
    case "number":
    case "currency":
      return z.union([z.number(), z.string()]);
    case "boolean":
      return z.union([z.boolean(), z.string(), z.number()]);
    default:
      return z.string();
  }
}

function buildExtractionSchema(
  parentColumns: ColumnMeta[],
  itemColumns: ColumnMeta[]
) {
  const parentShape: Record<string, z.ZodTypeAny> = {};
  for (const column of parentColumns) {
    const base = zodTypeForColumn(column);
    parentShape[column.fieldKey] = column.required ? base : base.optional();
  }
  const itemShape: Record<string, z.ZodTypeAny> = {};
  for (const column of itemColumns) {
    const base = zodTypeForColumn(column);
    itemShape[column.fieldKey] = column.required ? base : base.optional();
  }
  const parentSchema = z.object(parentShape).passthrough();
  const itemSchema = z.object(itemShape).passthrough();
  return parentSchema.extend({
    items: z.array(itemSchema).optional(),
  });
}

function buildEmptyExtraction(
  parentColumns: ColumnMeta[],
  itemColumns: ColumnMeta[]
) {
  const parent: Record<string, string> = {};
  for (const column of parentColumns) {
    parent[column.fieldKey] = "";
  }
  const item: Record<string, string> = {};
  for (const column of itemColumns) {
    item[column.fieldKey] = "";
  }
  return {
    ...parent,
    items: [item],
  };
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfiguredDocumentTypes(settings: Record<string, unknown> | null | undefined) {
  const configured = readStringList(settings?.extractionDocumentTypes);
  if (configured.length > 0) return configured;
  const direct = readStringList(settings?.documentTypes);
  if (direct.length > 0) return direct;
  const legacy = typeof settings?.ocrDocType === "string" ? settings.ocrDocType.trim() : "";
  return legacy ? [legacy] : [];
}

function getConfiguredExtractionInstructions(
  settings: Record<string, unknown> | null | undefined
) {
  const configured =
    typeof settings?.extractionInstructions === "string"
      ? settings.extractionInstructions.trim()
      : "";
  if (configured) return configured;
  const legacy =
    typeof settings?.ocrInstructions === "string"
      ? settings.ocrInstructions.trim()
      : "";
  return legacy || null;
}

function describeColumn(column: ColumnMeta) {
  const label = column.label || column.fieldKey;
  const description =
    typeof column.config?.ocrDescription === "string"
      ? (column.config.ocrDescription as string).trim()
      : "";
  const aliases = readStringList(column.config?.aliases);
  const examples = readStringList(column.config?.examples);
  const excelKeywords = readStringList(column.config?.excelKeywords);
  const details = [`campo "${column.fieldKey}"`, `tipo ${column.dataType}`];
  if (description) details.push(description);
  if (aliases.length > 0) details.push(`aliases: ${aliases.join(", ")}`);
  if (examples.length > 0) details.push(`ejemplos: ${examples.join(", ")}`);
  if (excelKeywords.length > 0) details.push(`keywords: ${excelKeywords.join(", ")}`);
  return `- ${label} (${details.join(" | ")})`;
}

function buildTableAutoInstructions({
  docTypes,
  customInstructions,
  parentColumns,
  itemColumns,
}: {
  docTypes?: string[];
  customInstructions?: string | null;
  parentColumns: ColumnMeta[];
  itemColumns: ColumnMeta[];
}) {
  const lines: string[] = [];
  const docLabel = docTypes && docTypes.length > 0 ? docTypes.join(" / ") : "documento";
  lines.push(`Analizá el ${docLabel} para esta tabla y devolvé JSON.`);
  if (docTypes && docTypes.length > 0) {
    lines.push(`Tipos de documento esperados: ${docTypes.join(", ")}.`);
  }
  if (parentColumns.length > 0) {
    lines.push("Campos de cabecera:");
    parentColumns.forEach((column) => {
      lines.push(describeColumn(column));
    });
  }
  if (itemColumns.length > 0) {
    lines.push("Campos por ítem (items[]):");
    itemColumns.forEach((column) => {
      lines.push(describeColumn(column));
    });
    lines.push('Incluí "items" si ves filas claras; si no, devolvé una lista vacía.');
  } else {
    lines.push("Esta tabla es de nivel documento: no repitas filas.");
  }
  lines.push("No inventes valores; deja campos vacíos si no se pueden leer.");
  if (customInstructions && customInstructions.trim().length > 0) {
    lines.push("Instrucciones adicionales:");
    lines.push(customInstructions.trim());
  }
  return lines.join("\n");
}

function buildMultiInstructions(tablas: TablaDef[]) {
  const lines: string[] = [];
  lines.push(
    "Analizá el documento y devolvé SOLO un JSON válido sin markdown."
  );
  lines.push(
    'Formato de salida obligatorio: {"tables":{"<tablaId>":{"...camposParent","items":[...]}}}'
  );
  lines.push(
    "Incluí todas las tablas listadas abajo, aunque algunos campos queden vacíos."
  );
  for (const tabla of tablas) {
    const settings = tabla.settings ?? {};
    const ocrProfile =
      typeof settings.ocrProfile === "string" ? settings.ocrProfile : null;
    const documentTypes = getConfiguredDocumentTypes(settings);
    const customInstructions = [
      tabla.templateDescription,
      getConfiguredExtractionInstructions(settings),
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n\n");
    const instructions =
      ocrProfile === "materials"
        ? [MATERIALS_OCR_PROMPT, customInstructions].filter(Boolean).join("\n\n")
        : buildTableAutoInstructions({
            docTypes: documentTypes,
            customInstructions: customInstructions || null,
            parentColumns: tabla.parentColumns,
            itemColumns: tabla.itemColumns,
          });
    lines.push(`\nTabla ${tabla.tablaName} (id: ${tabla.tablaId}):`);
    lines.push(instructions);
  }
  return lines.join("\n");
}

function sanitizeFileName(base: string) {
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function inferMimeType(fileNameOrPath: string | null | undefined) {
  const value = (fileNameOrPath ?? "").toLowerCase();
  if (value.endsWith(".pdf")) return "application/pdf";
  if (value.endsWith(".png")) return "image/png";
  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
  if (value.endsWith(".webp")) return "image/webp";
  if (value.endsWith(".gif")) return "image/gif";
  if (value.endsWith(".bmp")) return "image/bmp";
  if (value.endsWith(".tif") || value.endsWith(".tiff")) return "image/tiff";
  return "application/octet-stream";
}

function isOcrSupportedMime(mime: string) {
  return mime.startsWith("image/") || mime === "application/pdf";
}

function dataUrlToBuffer(imageDataUrl: string) {
  const match = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("imageDataUrl inválida");
  }
  const mime = match[1];
  const b64 = match[2];
  return { buffer: Buffer.from(b64, "base64"), mime };
}

function parseSelectedPages(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const normalized = Array.from(
      new Set(
        parsed
          .map((page) => (typeof page === "number" ? page : Number(page)))
          .filter((page) => Number.isInteger(page) && page > 0)
      )
    ).sort((left, right) => left - right);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function estimateBase64Size(dataUrl: string | null): number {
  if (!dataUrl) return 0;
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  return Math.floor((base64.length * 3) / 4);
}

function estimateOcrTokenUsage(baseBytes: number): number {
  if (!baseBytes) return DEFAULT_OCR_TOKEN_RESERVE;
  const approx = Math.round((baseBytes / 1024) * 40);
  return Math.min(MAX_OCR_TOKEN_RESERVE, Math.max(MIN_OCR_TOKEN_RESERVE, approx));
}

function extractTokenUsage(result: unknown): number {
  const usage =
    (result as any)?.response?.usage ??
    (result as any)?.usage ??
    (result as any)?.response?.body?.usage ??
    null;
  const candidate =
    usage?.totalTokens ??
    usage?.total_tokens ??
    usage?.total ??
    usage?.promptTokens ??
    null;
  const parsed =
    typeof candidate === "string"
      ? Number.parseInt(candidate, 10)
      : Number(candidate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function uploadSourceToStorage({
  supabase,
  obraId,
  folderName,
  file,
  imageDataUrl,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  obraId: string;
  folderName: string;
  file: File | null;
  imageDataUrl: string | null;
}) {
  if (!file && !imageDataUrl) return null;

  const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizedFolder = normalizeFolderPath(folderName);

  const uploadBuffer = async (
    buffer: Buffer,
    fileName: string,
    contentType: string
  ) => {
    const storagePath = `${obraId}/${normalizedFolder}/${fileName}`;
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: false });
    if (error) throw error;
    const size =
      typeof buffer.length === "number"
        ? buffer.length
        : ((buffer as any).byteLength ?? 0);
    return {
      bucket: DOCUMENTS_BUCKET,
      path: storagePath,
      fileName,
      uploadedBytes: size,
    };
  };

  if (file) {
    const originalName = file.name || "archivo";
    const extensionFromName = originalName.includes(".")
      ? (originalName.split(".").pop() ?? "")
      : "";
    const ext =
      extensionFromName.toLowerCase() || (file.type?.split("/")?.pop() ?? "bin");
    const safeBase = sanitizeFileName(originalName.replace(/\.[^/.]+$/, "")) || "archivo";
    const fileName = `${uniquePrefix}-${safeBase}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    return uploadBuffer(buffer, fileName, file.type || "application/octet-stream");
  }

  if (imageDataUrl) {
    const { buffer, mime } = dataUrlToBuffer(imageDataUrl);
    const ext = mime.split("/").pop() || "png";
    const fileName = `${uniquePrefix}-captura.${ext}`;
    return uploadBuffer(buffer, fileName, mime);
  }

  return null;
}

async function fetchTemplatePromptContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  settings: Record<string, unknown>,
) {
  const templateId =
    typeof settings.ocrTemplateId === "string" && settings.ocrTemplateId.trim().length > 0
      ? settings.ocrTemplateId.trim()
      : null;
  if (!templateId) return null;

  const { data, error } = await supabase
    .from("ocr_templates")
    .select("description, columns")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const rawColumns = Array.isArray((data as { columns?: unknown }).columns)
    ? ((data as { columns?: unknown }).columns as Array<Record<string, unknown>>)
    : [];

  return {
    description:
      typeof data.description === "string" && data.description.trim().length > 0
        ? data.description.trim()
        : null,
    columns: rawColumns.map((column, index) => ({
      fieldKey: normalizeFieldKey(
        typeof column.fieldKey === "string" && column.fieldKey.trim().length > 0
          ? column.fieldKey
          : typeof column.label === "string"
            ? column.label
            : `campo_${index + 1}`
      ),
      label:
        typeof column.label === "string" && column.label.trim().length > 0
          ? column.label.trim()
          : `Campo ${index + 1}`,
      description:
        typeof column.description === "string" && column.description.trim().length > 0
          ? column.description.trim()
          : undefined,
      aliases: readStringList(column.aliases),
      examples: readStringList(column.examples),
      excelKeywords: readStringList(column.excelKeywords),
    })),
  } satisfies TemplatePromptContext;
}

async function resolvePromptSettings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  settings: Record<string, unknown>,
) {
  const defaultTablaId =
    typeof settings.defaultTablaId === "string" && settings.defaultTablaId.trim().length > 0
      ? settings.defaultTablaId.trim()
      : null;
  if (!defaultTablaId) return settings;

  const { data, error } = await supabase
    .from("obra_default_tablas")
    .select("ocr_template_id, settings")
    .eq("id", defaultTablaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return settings;

  const defaultSettings = ((data.settings as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const merged = { ...defaultSettings, ...settings } as Record<string, unknown>;

  if (typeof data.ocr_template_id === "string" && data.ocr_template_id.trim().length > 0) {
    merged.ocrTemplateId = data.ocr_template_id;
  }
  if (Array.isArray(defaultSettings.extractedTables)) {
    merged.extractedTables = defaultSettings.extractedTables;
  }
  if (typeof defaultSettings.extractionInstructions === "string") {
    merged.extractionInstructions = defaultSettings.extractionInstructions;
  }
  if (Array.isArray(defaultSettings.documentTypes)) {
    merged.documentTypes = defaultSettings.documentTypes;
  }
  if (Array.isArray(defaultSettings.extractionDocumentTypes)) {
    merged.extractionDocumentTypes = defaultSettings.extractionDocumentTypes;
  }

  return merged;
}

function mergeColumnHints(
  columns: ColumnMeta[],
  templateContext: TemplatePromptContext | null,
) {
  if (!templateContext) return columns;

  const templateColumnsByFieldKey = new Map(
    templateContext.columns.map((column) => [column.fieldKey, column]),
  );
  const templateColumnsByLabel = new Map(
    templateContext.columns.map((column) => [normalizeFieldKey(column.label), column]),
  );

  return columns.map((column) => {
    const templateColumn =
      templateColumnsByFieldKey.get(column.fieldKey) ??
      templateColumnsByLabel.get(normalizeFieldKey(column.label));
    if (!templateColumn) return column;

    const config = { ...column.config };
    if (
      typeof config.ocrDescription !== "string" ||
      config.ocrDescription.trim().length === 0
    ) {
      config.ocrDescription = templateColumn.description ?? "";
    }
    if (!Array.isArray(config.aliases) || config.aliases.length === 0) {
      config.aliases = templateColumn.aliases ?? [];
    }
    if (!Array.isArray(config.examples) || config.examples.length === 0) {
      config.examples = templateColumn.examples ?? [];
    }
    if (!Array.isArray(config.excelKeywords) || config.excelKeywords.length === 0) {
      config.excelKeywords = templateColumn.excelKeywords ?? [];
    }

    return {
      ...column,
      config,
    };
  });
}

async function fetchTablaDef(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string,
  tablaId: string
): Promise<TablaDef | null> {
  const { data: tablaMeta, error: tablaError } = await supabase
    .from("obra_tablas")
    .select("id, obra_id, name, source_type, settings, obras!inner(tenant_id)")
    .eq("id", tablaId)
    .eq("obra_id", obraId)
    .maybeSingle();
  if (tablaError) throw tablaError;
  if (!tablaMeta) return null;
  if ((tablaMeta.source_type as string) !== "ocr") return null;
  const effectiveSettings = await resolvePromptSettings(
    supabase,
    ((tablaMeta.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>,
  );

  const { data: columns, error: columnsError } = await supabase
    .from("obra_tabla_columns")
    .select("id, tabla_id, field_key, label, data_type, required, position, config")
    .eq("tabla_id", tablaId)
    .order("position", { ascending: true });
  if (columnsError) throw columnsError;

  const templatePromptContext = await fetchTemplatePromptContext(
    supabase,
    effectiveSettings,
  );

  const mappedColumns: ColumnMeta[] = mergeColumnHints((columns ?? []).map((column) => ({
    id: column.id as string,
    label: column.label as string,
    fieldKey: column.field_key as string,
    dataType: ensureTablaDataType(column.data_type as string | undefined),
    required: Boolean(column.required),
    config: (column.config as Record<string, unknown>) ?? {},
  })), templatePromptContext);
  if (mappedColumns.length === 0) return null;

  const parentColumns = mappedColumns.filter((column) => {
    const scope = resolveColumnScope(column, tablaMeta.name as string, effectiveSettings);
    return scope === "parent";
  });
  const parentKeys = new Set(parentColumns.map((column) => column.fieldKey));
  const itemColumns = mappedColumns.filter((column) => !parentKeys.has(column.fieldKey));

  const tenantId =
    (tablaMeta as unknown as { obras?: { tenant_id?: string | null } })?.obras
      ?.tenant_id ?? null;
  if (!tenantId) return null;

  return {
    tablaId,
    tablaName: tablaMeta.name as string,
    tenantId,
    settings: effectiveSettings,
    parentColumns,
    itemColumns,
    extractionSchema: buildExtractionSchema(parentColumns, itemColumns),
    templateDescription: templatePromptContext?.description ?? null,
  };
}

function normalizeLooseKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildColumnCandidateKeys(column: ColumnMeta) {
  const candidates = [
    column.fieldKey,
    column.label,
    ...readStringList(column.config?.aliases),
  ];
  const normalizedFieldKey = normalizeLooseKey(column.fieldKey);
  if (normalizedFieldKey === "nro" || normalizedFieldKey === "nroorden") {
    candidates.push("nroOrden");
  }
  if (normalizedFieldKey === "totalorden" || normalizedFieldKey === "total_orden") {
    candidates.push("totalOrden");
  }
  if (normalizedFieldKey === "detalle_descriptivo") {
    candidates.push("material");
  }
  if (normalizedFieldKey === "preciounitario" || normalizedFieldKey === "precio_unitario") {
    candidates.push("precioUnitario");
  }
  if (normalizedFieldKey === "preciototal" || normalizedFieldKey === "precio_total") {
    candidates.push("precioTotal");
  }
  return new Set(candidates.map(normalizeLooseKey));
}

function isLegacyOrderTable(
  tablaName: string,
  settings: Record<string, unknown> | null | undefined,
) {
  const normalizedFolder = normalizeFolderPath(
    typeof settings?.ocrFolder === "string" ? settings.ocrFolder : "",
  );
  if (normalizedFolder === "ordenes-de-compra") return true;
  return normalizeLooseKey(tablaName).includes("ordenesdecompra");
}

function resolveColumnScope(
  column: ColumnMeta,
  tablaName: string,
  settings: Record<string, unknown> | null | undefined,
) {
  const configuredScope =
    typeof column.config?.ocrScope === "string" ? column.config.ocrScope : "";
  if (configuredScope === "parent" || configuredScope === "item") {
    return configuredScope;
  }
  if (!isLegacyOrderTable(tablaName, settings)) {
    return "item";
  }
  const normalizedFieldKey = normalizeLooseKey(column.fieldKey);
  if (LEGACY_ORDER_PARENT_FIELD_KEYS.has(normalizedFieldKey)) {
    return "parent";
  }
  if (LEGACY_ORDER_ITEM_FIELD_KEYS.has(normalizedFieldKey)) {
    return "item";
  }
  return "item";
}

function setCanonicalOrderAliases(
  target: Record<string, unknown>,
  fieldKey: string,
  value: unknown,
) {
  if (value == null) return;
  const normalizedFieldKey = normalizeLooseKey(fieldKey);
  if (normalizedFieldKey === "nro") {
    target.nroOrden = value;
    return;
  }
  if (normalizedFieldKey === "total_orden") {
    target.totalOrden = value;
    return;
  }
  if (normalizedFieldKey === "detalle_descriptivo") {
    target.material = value;
    return;
  }
  if (normalizedFieldKey === "precio_unitario") {
    target.precioUnitario = value;
    return;
  }
  if (normalizedFieldKey === "precio_total") {
    target.precioTotal = value;
  }
}

function isBlankExtractionValue(value: unknown) {
  return value == null || (typeof value === "string" && value.trim().length === 0);
}

function resolveRowValueWithTopLevelFallback(
  item: Record<string, unknown>,
  tableExtraction: Record<string, unknown>,
  fieldKey: string,
) {
  const itemValue = item[fieldKey];
  if (!isBlankExtractionValue(itemValue)) {
    return itemValue;
  }
  return tableExtraction[fieldKey] ?? null;
}

function remapObjectToFieldKeys(
  value: unknown,
  columns: ColumnMeta[],
) {
  const source =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const candidateMap = new Map<string, string>();
  for (const column of columns) {
    for (const candidate of buildColumnCandidateKeys(column)) {
      candidateMap.set(candidate, column.fieldKey);
    }
  }

  const remapped: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const targetKey = candidateMap.get(normalizeLooseKey(rawKey));
    if (targetKey) {
      remapped[targetKey] = rawValue;
      continue;
    }
    remapped[rawKey] = rawValue;
  }
  return remapped;
}

function normalizeTableExtraction(
  tableExtraction: unknown,
  def: TablaDef,
) {
  const source =
    typeof tableExtraction === "object" && tableExtraction !== null
      ? (tableExtraction as Record<string, unknown>)
      : {};
  const allColumns = [...def.parentColumns, ...def.itemColumns];
  const normalizedTopLevel = remapObjectToFieldKeys(source, allColumns);
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const normalizedItems = rawItems
    .map((item) => remapObjectToFieldKeys(item, def.itemColumns))
    .filter((item) => typeof item === "object" && item !== null);

  if (normalizedItems.length > 0) {
    normalizedTopLevel.items = normalizedItems;
    return normalizedTopLevel;
  }

  if (def.itemColumns.length > 0) {
    const inlineItem = remapObjectToFieldKeys(source, def.itemColumns);
    const hasInlineItemValue = def.itemColumns.some((column) => inlineItem[column.fieldKey] != null);
    if (hasInlineItemValue) {
      normalizedTopLevel.items = [inlineItem];
    }
  }

  return normalizedTopLevel;
}

function resolveTableExtraction(
  tablesExtraction: Record<string, unknown>,
  def: TablaDef,
  totalExpectedTables: number,
) {
  const exact = tablesExtraction[def.tablaId];
  if (exact && typeof exact === "object") {
    return exact;
  }

  const entries = Object.entries(tablesExtraction).filter(([, value]) => typeof value === "object" && value !== null);
  if (entries.length === 0) return {};

  const normalizedTablaId = normalizeLooseKey(def.tablaId);
  const normalizedTablaName = normalizeLooseKey(def.tablaName);
  for (const [key, value] of entries) {
    const normalizedKey = normalizeLooseKey(key);
    if (normalizedKey === normalizedTablaId || normalizedKey === normalizedTablaName) {
      return value as Record<string, unknown>;
    }
  }

  if (totalExpectedTables === 1 && entries.length === 1) {
    return entries[0][1] as Record<string, unknown>;
  }

  let bestMatch: Record<string, unknown> | null = null;
  let bestScore = 0;
  for (const [, value] of entries) {
    const remapped = remapObjectToFieldKeys(value, [...def.parentColumns, ...def.itemColumns]);
    const topLevelScore = [...def.parentColumns, ...def.itemColumns].reduce(
      (score, column) => score + (remapped[column.fieldKey] != null ? 1 : 0),
      0,
    );
    const items = Array.isArray((value as Record<string, unknown>).items)
      ? ((value as Record<string, unknown>).items as unknown[])
      : [];
    const itemScore = items.some((item) => {
      const normalizedItem = remapObjectToFieldKeys(item, def.itemColumns);
      return def.itemColumns.some((column) => normalizedItem[column.fieldKey] != null);
    }) ? 1 : 0;
    const score = topLevelScore + itemScore;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = value as Record<string, unknown>;
    }
  }

  return bestMatch ?? {};
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) {
    return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
  }
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  let resolvedTenantId: string | null = null;
  let resolvedPlanLimits: SubscriptionPlanLimits | null = null;
  let reservedTokens = 0;
  let reservationApplied = false;
  let tokensSettled = false;
  let rollbackReservation: ((ctx: string) => Promise<void>) | null = null;
  const startTime = Date.now();
  let storageInfoForError:
    | { bucket: string; path: string; fileName: string; uploadedBytes?: number }
    | null = null;
  let tablaDefs: TablaDef[] = [];
  let resolvedSupabase: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    resolvedSupabase = supabase as Awaited<ReturnType<typeof createClient>>;
    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }
    const { data: obraRow, error: obraError } = await supabase
      .from("obras")
      .select("id")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obraRow) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }
    const url = new URL(request.url);
    const skipStorage =
      url.searchParams.get("skipStorage") === "1" ||
      url.searchParams.get("skipStorage") === "true";

    const form = await request.formData();
    const rawTablaIds = form.get("tablaIds");
    const parsedTablaIds =
      typeof rawTablaIds === "string" ? JSON.parse(rawTablaIds) : [];
    const tablaIds = Array.isArray(parsedTablaIds)
      ? parsedTablaIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    if (tablaIds.length === 0) {
      return NextResponse.json({ error: "No se enviaron tablas para OCR." }, { status: 400 });
    }

    for (const tablaId of tablaIds) {
      const def = await fetchTablaDef(supabase, obraId, tablaId);
      if (!def) continue;
      tablaDefs.push(def);
    }
    if (tablaDefs.length === 0) {
      return NextResponse.json({ error: "No hay tablas OCR válidas para procesar." }, { status: 400 });
    }

    const processingTenantId = tablaDefs[0].tenantId;
    resolvedTenantId = processingTenantId;
    const plan = await fetchTenantPlan(supabase, processingTenantId);
    const planLimits = plan.limits;
    resolvedPlanLimits = planLimits;
    rollbackReservation = async (ctx: string) => {
      if (!reservationApplied || reservedTokens <= 0) return;
      await incrementTenantUsage(supabase, processingTenantId, { aiTokens: -reservedTokens }, planLimits);
      await logTenantUsageEvent(supabase, {
        tenantId: processingTenantId,
        kind: "ai_tokens",
        amount: -reservedTokens,
        context: ctx,
        metadata: { obraId, tablaIds, reservedTokens },
      });
      reservationApplied = false;
      reservedTokens = 0;
    };

    const imageDataUrl = form.get("imageDataUrl");
    const fileEntry = form.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    const existingBucket = form.get("existingBucket");
    const existingPath = form.get("existingPath");
    const existingFileName = form.get("existingFileName");
    const selectedPages = parseSelectedPages(form.get("selectedPages"));

    const folderNames = Array.from(
      new Set(
        tablaDefs
          .map((def) => (typeof def.settings.ocrFolder === "string" ? normalizeFolderPath(def.settings.ocrFolder) : ""))
          .filter(Boolean)
      )
    );
    if (folderNames.length !== 1) {
      return NextResponse.json(
        { error: "Las tablas seleccionadas deben pertenecer a la misma carpeta OCR." },
        { status: 400 }
      );
    }

    let storageInfo:
      | { bucket: string; path: string; fileName: string; uploadedBytes?: number }
      | null =
      typeof existingBucket === "string" &&
      existingBucket.length > 0 &&
      typeof existingPath === "string" &&
      existingPath.length > 0
        ? {
            bucket: existingBucket,
            path: existingPath,
            fileName:
              typeof existingFileName === "string" && existingFileName.trim().length > 0
                ? sanitizeFileName(existingFileName)
                : sanitizeFileName(existingPath.split("/").pop() ?? `ocr-${Date.now()}.png`),
          }
        : null;
    if (storageInfo) storageInfoForError = storageInfo;

    let fetchedDocumentBytes: Uint8Array | null = null;
    let fetchedDocumentMime: string | null = null;
    if (!file && typeof imageDataUrl !== "string" && storageInfo) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(storageInfo.bucket)
        .download(storageInfo.path);
      if (downloadError) {
        return NextResponse.json(
          { error: `No se pudo descargar el archivo: ${downloadError.message}` },
          { status: 400 }
        );
      }
      if (fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        const mimeFromBlob = typeof fileData.type === "string" ? fileData.type.trim() : "";
        const mime =
          mimeFromBlob && mimeFromBlob !== "application/octet-stream"
            ? mimeFromBlob
            : inferMimeType(storageInfo.fileName || storageInfo.path);
        if (!isOcrSupportedMime(mime)) {
          return NextResponse.json({ error: "El archivo existente no es compatible (PDF o imagen)." }, { status: 400 });
        }
        fetchedDocumentBytes = new Uint8Array(arrayBuffer);
        fetchedDocumentMime = mime;
      }
    }

    const effectiveImageDataUrl =
      typeof imageDataUrl === "string" ? imageDataUrl : null;
    if (!file && !effectiveImageDataUrl && !fetchedDocumentBytes) {
      return NextResponse.json({ error: "Se requiere un archivo, imageDataUrl o existingPath válido" }, { status: 400 });
    }

    const enforceAiLimit = typeof planLimits.aiTokens === "number" && planLimits.aiTokens > 0;
    const estimatedInputBytes =
      (typeof file?.size === "number" && file.size > 0
        ? file.size
        : estimateBase64Size(effectiveImageDataUrl)) ||
      fetchedDocumentBytes?.byteLength ||
      0;
    const tokenReservationTarget = enforceAiLimit
      ? estimateOcrTokenUsage(estimatedInputBytes)
      : 0;
    if (enforceAiLimit && tokenReservationTarget > 0) {
      try {
        await incrementTenantUsage(supabase, processingTenantId, { aiTokens: tokenReservationTarget }, planLimits);
        await logTenantUsageEvent(supabase, {
          tenantId: processingTenantId,
          kind: "ai_tokens",
          amount: tokenReservationTarget,
          context: "ocr_reservation_multi",
          metadata: { obraId, tablaIds },
        });
        reservedTokens = tokenReservationTarget;
        reservationApplied = true;
      } catch (reservationError) {
        const err = reservationError as Error & { code?: string };
        const status =
          err.code === "ai_limit_exceeded" ? 402 : err.code === "insufficient_privilege" ? 403 : 400;
        return NextResponse.json(
          { error: err.message || "Tu plan no tiene tokens de IA disponibles para procesar documentos." },
          { status }
        );
      }
    }

    const extractionShape: Record<string, z.ZodTypeAny> = {};
    tablaDefs.forEach((def) => {
      extractionShape[def.tablaId] = def.extractionSchema.optional();
    });
    const extractionSchema = z.object({
      tables: z.object(extractionShape).passthrough(),
    });
    const instructions = buildMultiInstructions(tablaDefs);

    const runGenerateTextFallback = async (imageBytes: Uint8Array, mimeType: string) => {
      const b64 = Buffer.from(imageBytes).toString("base64");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${OCR_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
      const callGeminiRaw = async (
        prompt: string,
        attempt: "primary" | "repair"
      ) => {
        console.log("[tablas:ocr-import-multi] AI prompt", {
          obraId,
          tablaIds,
          attempt,
          model: OCR_MODEL,
          mimeType,
          prompt,
        });
        const body = {
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: b64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        };
        const res = await withTimeout(
          fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
          OCR_TIMEOUT_MS,
          "OCR text generation (raw)"
        );
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.error?.message ?? `Gemini API error ${res.status}`);
        }
        const rawText = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        console.log("[tablas:ocr-import-multi] AI raw response", {
          obraId,
          tablaIds,
          attempt,
          model: OCR_MODEL,
          response: rawText,
        });
        return rawText;
      };

      const raw = await callGeminiRaw(
        `${instructions}\n\nResponde SOLO con JSON válido, sin explicaciones ni markdown.`
        ,
        "primary"
      );
      if (!raw.trim()) {
        throw new Error("El modelo devolvió una respuesta vacía.");
      }
      try {
        const jsonText = extractJsonFromText(raw);
        return extractionSchema.parse(JSON.parse(jsonText));
      } catch {
        const emptyTemplate = {
          tables: Object.fromEntries(
            tablaDefs.map((def) => [def.tablaId, buildEmptyExtraction(def.parentColumns, def.itemColumns)])
          ),
        };
        const repairRaw = await callGeminiRaw(
          `${instructions}\n\nDevolvé SOLO JSON válido siguiendo este template.\n\nTEMPLATE JSON:\n${JSON.stringify(emptyTemplate)}`
          ,
          "repair"
        );
        const jsonText = extractJsonFromText(repairRaw);
        return extractionSchema.parse(JSON.parse(jsonText));
      }
    };

    let extraction: Record<string, any> | null = null;
    let rawExtractionResult: unknown = null;
    if (effectiveImageDataUrl && effectiveImageDataUrl.startsWith("data:")) {
      const { buffer, mime } = dataUrlToBuffer(effectiveImageDataUrl);
      const parsed = await runGenerateTextFallback(new Uint8Array(buffer), mime);
      extraction = parsed as Record<string, any>;
      rawExtractionResult = parsed;
    } else if (file) {
      const mimeFromFile = typeof file.type === "string" ? file.type.trim() : "";
      const fileMime =
        mimeFromFile && mimeFromFile !== "application/octet-stream"
          ? mimeFromFile
          : inferMimeType(file.name);
      if (!isOcrSupportedMime(fileMime)) {
        return NextResponse.json({ error: "Tipo de archivo no soportado (PDF o imagen)" }, { status: 400 });
      }
      const parsed = await runGenerateTextFallback(
        new Uint8Array(Buffer.from(await file.arrayBuffer())),
        fileMime
      );
      extraction = parsed as Record<string, any>;
      rawExtractionResult = parsed;
    } else if (fetchedDocumentBytes && fetchedDocumentMime) {
      const parsed = await runGenerateTextFallback(fetchedDocumentBytes, fetchedDocumentMime);
      extraction = parsed as Record<string, any>;
      rawExtractionResult = parsed;
    }

    if (!extraction) {
      if (rollbackReservation && reservationApplied && !tokensSettled) {
        await rollbackReservation("ocr_extraction_failed_multi");
      }
      return NextResponse.json(
        { error: "No se pudieron extraer datos de la imagen." },
        { status: 422 }
      );
    }

    const actualTokenUsage = Math.max(
      reservationApplied ? reservedTokens : DEFAULT_OCR_TOKEN_RESERVE,
      extractTokenUsage(rawExtractionResult)
    );
    if (actualTokenUsage > 0) {
      try {
        await incrementTenantUsage(
          supabase,
          processingTenantId,
          { aiTokens: reservationApplied ? actualTokenUsage - reservedTokens : actualTokenUsage },
          planLimits
        );
        reservedTokens = actualTokenUsage;
        reservationApplied = true;
        tokensSettled = true;
      } catch (usageError) {
        if (rollbackReservation) await rollbackReservation("ocr_reservation_rollback_multi");
        const err = usageError as Error & { code?: string };
        const status =
          err.code === "ai_limit_exceeded" ? 402 : err.code === "insufficient_privilege" ? 403 : 400;
        return NextResponse.json(
          { error: err.message || "Tu organización superó el límite de tokens de IA disponible." },
          { status }
        );
      }
    } else if (reservationApplied) {
      if (rollbackReservation) await rollbackReservation("ocr_reservation_rollback_multi");
      tokensSettled = true;
    }

    const costUsd = actualTokenUsage > 0 ? estimateUsdForTokens(OCR_MODEL, actualTokenUsage) : null;
    await logTenantUsageEvent(supabase, {
      tenantId: processingTenantId,
      kind: "ai_tokens",
      amount: actualTokenUsage > 0 ? actualTokenUsage : reservedTokens,
      context: "ocr_import_multi",
      metadata: { obraId, tablaIds, model: OCR_MODEL, costUsd },
    });

    if (!skipStorage) {
      storageInfo = await uploadSourceToStorage({
        supabase,
        obraId,
        folderName: folderNames[0],
        file,
        imageDataUrl: effectiveImageDataUrl,
      });
      if (storageInfo) {
        storageInfoForError = storageInfo;
      }
    }

    const tablesExtraction = ((extraction as any).tables ?? {}) as Record<string, any>;
    const perTable: Array<{ tablaId: string; tablaName: string; inserted: number }> = [];
    const processingDuration = Date.now() - startTime;

    for (const def of tablaDefs) {
      const rawTableExtraction = resolveTableExtraction(
        tablesExtraction,
        def,
        tablaDefs.length,
      );
      const tableExtraction = normalizeTableExtraction(rawTableExtraction, def) as Record<string, any>;
      let items = Array.isArray(tableExtraction.items) ? tableExtraction.items : [];
      if (def.itemColumns.length === 0) {
        items = [{}];
      } else if (items.length === 0) {
        items = buildEmptyExtraction(def.parentColumns, def.itemColumns).items;
      }
      items = applyOcrExtractionRowPolicy(items as Record<string, unknown>[], def.settings, {
        hasItemColumns: def.itemColumns.length > 0,
      });

      const baseMeta: Record<string, unknown> = {};
      for (const column of def.parentColumns) {
        if (tableExtraction[column.fieldKey] == null) continue;
        baseMeta[column.fieldKey] = coerceValueForType(
          column.dataType,
          tableExtraction[column.fieldKey]
        );
      }
      if (storageInfo) {
        baseMeta.__docBucket = storageInfo.bucket;
        baseMeta.__docPath = storageInfo.path;
        baseMeta.__docFileName = storageInfo.fileName;
      }
      if (selectedPages) {
        baseMeta.__docSelectedPages = selectedPages;
      }

      if (storageInfo?.path) {
        await supabase
          .from("obra_tabla_rows")
          .delete()
          .eq("tabla_id", def.tablaId)
          .contains("data", { __docPath: storageInfo.path });
      }

      const rowsPayload = items.map((item: Record<string, unknown>) => {
        const data: Record<string, unknown> = { ...baseMeta };
        for (const column of def.itemColumns) {
          const resolvedValue = resolveRowValueWithTopLevelFallback(
            item,
            tableExtraction,
            column.fieldKey,
          );
          data[column.fieldKey] = coerceValueForType(
            column.dataType,
            resolvedValue
          );
          setCanonicalOrderAliases(data, column.fieldKey, data[column.fieldKey]);
        }
        for (const [fieldKey, fieldValue] of Object.entries(baseMeta)) {
          setCanonicalOrderAliases(data, fieldKey, fieldValue);
        }
        return {
          tabla_id: def.tablaId,
          data,
          source: "ocr",
        };
      });
      if (rowsPayload.length > 0) {
        const { error: insertError } = await supabase.from("obra_tabla_rows").insert(rowsPayload);
        if (insertError) throw insertError;
      }

      if (storageInfo) {
        await supabase.from("ocr_document_processing").upsert(
          {
            tabla_id: def.tablaId,
            obra_id: obraId,
            source_bucket: storageInfo.bucket,
            source_path: storageInfo.path,
            source_file_name: storageInfo.fileName,
            status: "completed",
            rows_extracted: rowsPayload.length,
            processed_at: new Date().toISOString(),
            processing_duration_ms: processingDuration,
          },
          { onConflict: "tabla_id,source_path" }
        );
      }
      perTable.push({ tablaId: def.tablaId, tablaName: def.tablaName, inserted: rowsPayload.length });
    }

    return NextResponse.json({
      ok: true,
      inserted: perTable.reduce((acc, t) => acc + t.inserted, 0),
      perTable,
      file: storageInfo ? { bucket: storageInfo.bucket, path: storageInfo.path } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    if (
      rollbackReservation &&
      reservationApplied &&
      !tokensSettled &&
      reservedTokens > 0 &&
      resolvedTenantId &&
      resolvedPlanLimits
    ) {
      await rollbackReservation("ocr_reservation_rollback_multi");
    }

    if (storageInfoForError && tablaDefs.length > 0 && resolvedSupabase) {
      for (const def of tablaDefs) {
        await resolvedSupabase.from("ocr_document_processing").upsert(
          {
            tabla_id: def.tablaId,
            obra_id: obraId,
            source_bucket: storageInfoForError.bucket,
            source_path: storageInfoForError.path,
            source_file_name: storageInfoForError.fileName,
            status: "failed",
            error_message: message,
            processed_at: new Date().toISOString(),
          },
          { onConflict: "tabla_id,source_path" }
        );
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
