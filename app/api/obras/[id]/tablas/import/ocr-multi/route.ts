import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import {
  coerceValueForType,
  ensureTablaDataType,
  MATERIALS_OCR_PROMPT,
  normalizeFolderPath,
} from "@/lib/tablas";
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
};

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

function buildTableAutoInstructions({
  docType,
  parentColumns,
  itemColumns,
}: {
  docType?: string | null;
  parentColumns: ColumnMeta[];
  itemColumns: ColumnMeta[];
}) {
  const lines: string[] = [];
  const docLabel = docType && docType.length > 0 ? docType : "documento";
  lines.push(`Analizá el ${docLabel} para esta tabla y devolvé JSON.`);
  if (parentColumns.length > 0) {
    lines.push("Campos de cabecera:");
    parentColumns.forEach((column) => {
      const label = column.label || column.fieldKey;
      const description =
        typeof column.config?.ocrDescription === "string"
          ? (column.config.ocrDescription as string)
          : "";
      lines.push(
        `- ${label} (campo "${column.fieldKey}", tipo ${column.dataType})${description ? ` - ${description}` : ""}`
      );
    });
  }
  if (itemColumns.length > 0) {
    lines.push("Campos por ítem (items[]):");
    itemColumns.forEach((column) => {
      const label = column.label || column.fieldKey;
      const description =
        typeof column.config?.ocrDescription === "string"
          ? (column.config.ocrDescription as string)
          : "";
      lines.push(
        `- ${label} (campo "${column.fieldKey}", tipo ${column.dataType})${description ? ` - ${description}` : ""}`
      );
    });
    lines.push('Incluí "items" si ves filas claras; si no, devolvé una lista vacía.');
  } else {
    lines.push("Esta tabla es de nivel documento: no repitas filas.");
  }
  lines.push("No inventes valores; deja campos vacíos si no se pueden leer.");
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
    const docType =
      typeof settings.ocrDocType === "string" ? settings.ocrDocType : null;
    const customInstructions =
      typeof settings.ocrInstructions === "string" &&
      settings.ocrInstructions.trim().length > 0
        ? settings.ocrInstructions.trim()
        : null;
    const instructions =
      customInstructions ??
      (ocrProfile === "materials"
        ? MATERIALS_OCR_PROMPT
        : buildTableAutoInstructions({
            docType,
            parentColumns: tabla.parentColumns,
            itemColumns: tabla.itemColumns,
          }));
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

  const { data: columns, error: columnsError } = await supabase
    .from("obra_tabla_columns")
    .select("id, tabla_id, field_key, label, data_type, required, position, config")
    .eq("tabla_id", tablaId)
    .order("position", { ascending: true });
  if (columnsError) throw columnsError;

  const mappedColumns: ColumnMeta[] = (columns ?? []).map((column) => ({
    id: column.id as string,
    label: column.label as string,
    fieldKey: column.field_key as string,
    dataType: ensureTablaDataType(column.data_type as string | undefined),
    required: Boolean(column.required),
    config: (column.config as Record<string, unknown>) ?? {},
  }));
  if (mappedColumns.length === 0) return null;

  const parentColumns = mappedColumns.filter((column) => {
    const scope = (column.config?.ocrScope as string) || "item";
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
    settings: ((tablaMeta.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>,
    parentColumns,
    itemColumns,
    extractionSchema: buildExtractionSchema(parentColumns, itemColumns),
  };
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

  try {
    const supabase = await createClient();
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

    const tenantId = tablaDefs[0].tenantId;
    resolvedTenantId = tenantId;
    const plan = await fetchTenantPlan(supabase, tenantId);
    const planLimits = plan.limits;
    resolvedPlanLimits = planLimits;
    rollbackReservation = async (ctx: string) => {
      if (!reservationApplied || reservedTokens <= 0) return;
      await incrementTenantUsage(supabase, tenantId, { aiTokens: -reservedTokens }, planLimits);
      await logTenantUsageEvent(supabase, {
        tenantId,
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
        await incrementTenantUsage(supabase, tenantId, { aiTokens: tokenReservationTarget }, planLimits);
        await logTenantUsageEvent(supabase, {
          tenantId,
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
      const callGeminiRaw = async (prompt: string) => {
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
        return (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      };

      const raw = await callGeminiRaw(
        `${instructions}\n\nResponde SOLO con JSON válido, sin explicaciones ni markdown.`
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
          tenantId,
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
      tenantId,
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
      const tableExtraction = (tablesExtraction[def.tablaId] ?? {}) as Record<string, any>;
      let items = Array.isArray(tableExtraction.items) ? tableExtraction.items : [];
      if (def.itemColumns.length === 0) {
        items = [{}];
      } else if (items.length === 0) {
        items = buildEmptyExtraction(def.parentColumns, def.itemColumns).items;
      }

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
          data[column.fieldKey] = coerceValueForType(
            column.dataType,
            item[column.fieldKey] ?? null
          );
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

    if (storageInfoForError && tablaDefs.length > 0) {
      const supabase = await createClient();
      for (const def of tablaDefs) {
        await supabase.from("ocr_document_processing").upsert(
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
