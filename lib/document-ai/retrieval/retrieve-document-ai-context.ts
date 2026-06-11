import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DocumentAiChunk,
  DocumentAiIntent,
  DocumentAiRow,
  RetrievedDocumentAiContext,
} from "@/lib/document-ai/schemas/types";
import { asRecord, normalizeKey } from "@/lib/document-ai/normalization/shared";
import { createDocumentAiEmbedding } from "@/lib/document-ai/index/embeddings";

function readSettings(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function inferDocumentTypeFromText(value: unknown) {
  const text = normalizeKey(String(value ?? ""));
  if (/certificad|avance/.test(text)) return "certificado_avance";
  if (/orden.*compra|ordenes.*compra|oc/.test(text)) return "orden_compra";
  if (/factur/.test(text)) return "factura";
  if (/remit/.test(text)) return "remito";
  if (/contrat/.test(text)) return "contrato";
  if (/presupuest/.test(text)) return "presupuesto";
  return null;
}

function readDocumentType(settings: Record<string, unknown>, data: Record<string, unknown>, tableName: unknown) {
  const explicit = data.__documentType ?? settings.documentType ?? settings.extractionDocumentType;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const documentTypes = settings.documentTypes ?? settings.extractionDocumentTypes;
  if (Array.isArray(documentTypes) && typeof documentTypes[0] === "string") return documentTypes[0];
  return inferDocumentTypeFromText(tableName) ?? inferDocumentTypeFromText(data.__docFileName) ?? inferDocumentTypeFromText(data.__docPath);
}

function matchesIntent(row: DocumentAiRow, intent: DocumentAiIntent) {
  if (intent.documentTypes.length === 0) return true;
  const type = normalizeKey(row.documentType ?? "");
  if (!type) return true;
  return intent.documentTypes.some((wanted) => {
    const normalizedWanted = normalizeKey(wanted);
    return type.includes(normalizedWanted) || normalizedWanted.includes(type);
  });
}

function scoreRow(row: DocumentAiRow, intent: DocumentAiIntent) {
  const text = JSON.stringify(row.data).toLowerCase();
  const goalTokens = intent.analysisGoal
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length > 3);
  const tokenScore = goalTokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
  const metricScore = intent.metrics.reduce((score, metric) => score + (text.includes(metric) ? 2 : 0), 0);
  return tokenScore + metricScore;
}

export async function retrieveDocumentAiContext(params: {
  supabase: SupabaseClient;
  tenantId: string;
  intent: DocumentAiIntent;
  limit?: number;
}): Promise<RetrievedDocumentAiContext> {
  const warnings: string[] = [];
  let tablaQuery = params.supabase
    .from("obra_tablas")
    .select("id, obra_id, name, source_type, settings, obras!inner(tenant_id)")
    .eq("obras.tenant_id", params.tenantId);
  if (params.intent.filters.obraId) {
    tablaQuery = tablaQuery.eq("obra_id", params.intent.filters.obraId);
  }

  const { data: tablas, error: tablasError } = await tablaQuery;
  if (tablasError) throw tablasError;

  const tableRows = ((tablas ?? []) as Array<Record<string, unknown>>).filter((tabla) => {
    if (!params.intent.filters.folderPath) return true;
    const settings = readSettings(tabla.settings);
    return normalizeKey(String(settings.ocrFolder ?? "")) === normalizeKey(params.intent.filters.folderPath);
  });
  const tableIds = tableRows.map((tabla) => String(tabla.id)).filter(Boolean);
  const tableById = new Map(tableRows.map((tabla) => [String(tabla.id), tabla]));

  let rows: DocumentAiRow[] = [];
  if (tableIds.length > 0) {
    // PostgREST encodes `.in(...)` in the URL; a tenant-wide search can carry
    // hundreds of tabla ids and exceed the URI limit, so query in batches.
    const rowLimit = params.limit ?? 400;
    const batchSize = 40;
    const batches: string[][] = [];
    for (let index = 0; index < tableIds.length; index += batchSize) {
      batches.push(tableIds.slice(index, index + batchSize));
    }
    const batchResults = await Promise.all(
      batches.map((batch) =>
        params.supabase
          .from("obra_tabla_rows")
          .select("id, tabla_id, data, lineage_row_key, extraction_id, created_at")
          .in("tabla_id", batch)
          .order("created_at", { ascending: false })
          .limit(rowLimit),
      ),
    );
    const rawRows: Array<Record<string, unknown>> = [];
    for (const result of batchResults) {
      if (result.error) throw result.error;
      rawRows.push(...((result.data ?? []) as Array<Record<string, unknown>>));
    }
    rawRows.sort((left, right) =>
      String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
    );
    rawRows.length = Math.min(rawRows.length, rowLimit);

    rows = rawRows
      .map((row) => {
        const table = tableById.get(String(row.tabla_id));
        const data = asRecord(row.data);
        const settings = readSettings(table?.settings);
        const sourcePath = typeof data.__docPath === "string" ? data.__docPath : null;
        const documentType = readDocumentType(settings, data, table?.name);
        return {
          id: String(row.id),
          tenantId: params.tenantId,
          obraId: table?.obra_id ? String(table.obra_id) : null,
          tableId: row.tabla_id ? String(row.tabla_id) : null,
          tableName: typeof table?.name === "string" ? table.name : null,
          documentType,
          data,
          createdAt: typeof row.created_at === "string" ? row.created_at : null,
          source: {
            kind: "obra_tabla_row",
            tenantId: params.tenantId,
            obraId: table?.obra_id ? String(table.obra_id) : null,
            tableId: row.tabla_id ? String(row.tabla_id) : null,
            rowId: String(row.id),
            documentType,
            documentPath: sourcePath,
            documentFileName: typeof data.__docFileName === "string" ? data.__docFileName : null,
            lineageRowKey: typeof row.lineage_row_key === "string" ? row.lineage_row_key : null,
            extractionId: typeof row.extraction_id === "string" ? row.extraction_id : null,
            confidence: 0.75 + Math.min(0.2, scoreRow({ data } as DocumentAiRow, params.intent) / 20),
          },
        } satisfies DocumentAiRow;
      })
      .filter((row) => matchesIntent(row, params.intent))
      .sort((left, right) => scoreRow(right, params.intent) - scoreRow(left, params.intent));
  }

  const chunks: DocumentAiChunk[] = [];
  const queryEmbedding = await createDocumentAiEmbedding(params.intent.analysisGoal);
  const semanticRows =
    queryEmbedding != null
      ? await params.supabase.rpc("match_document_ai_index", {
          query_embedding: queryEmbedding,
          match_tenant_id: params.tenantId,
          match_obra_id: params.intent.filters.obraId ?? null,
          match_document_type:
            params.intent.documentTypes.length === 1 ? params.intent.documentTypes[0] : null,
          match_count: params.limit ?? 40,
        })
      : null;
  if (semanticRows?.error) {
    warnings.push("La busqueda semantica fallo; se uso busqueda estructurada.");
  }

  let indexedRows = semanticRows && !semanticRows.error ? semanticRows.data : null;
  let indexError = semanticRows?.error ?? null;
  if (!indexedRows) {
    let indexQuery = params.supabase
      .from("document_ai_index")
      .select("id, tenant_id, obra_id, document_type, content, structured_data, metadata, source_ref")
      .eq("tenant_id", params.tenantId)
      .limit(params.limit ?? 120);
    if (params.intent.filters.obraId) {
      indexQuery = indexQuery.eq("obra_id", params.intent.filters.obraId);
    }
    if (params.intent.documentTypes.length === 1) {
      indexQuery = indexQuery.eq("document_type", params.intent.documentTypes[0]);
    }
    const indexResult = await indexQuery;
    indexedRows = indexResult.data;
    indexError = indexResult.error;
  }
  if (!indexError) {
    for (const item of (indexedRows ?? []) as Array<Record<string, unknown>>) {
      chunks.push({
        id: String(item.id),
        tenantId: String(item.tenant_id),
        obraId: item.obra_id ? String(item.obra_id) : null,
        documentType: typeof item.document_type === "string" ? item.document_type : null,
        content: String(item.content ?? ""),
        structuredData: asRecord(item.structured_data),
        metadata: asRecord(item.metadata),
        similarity: typeof item.similarity === "number" ? item.similarity : 0,
        source: {
          kind: "index",
          tenantId: String(item.tenant_id),
          obraId: item.obra_id ? String(item.obra_id) : null,
          documentType: typeof item.document_type === "string" ? item.document_type : null,
          ...asRecord(item.source_ref),
        },
      });
    }
  } else {
    warnings.push("El indice Document AI no esta disponible; se usaron filas extraidas directas.");
  }

  if (rows.length === 0 && chunks.length === 0) {
    warnings.push("No se encontraron fuentes compatibles para el pedido.");
  }

  return {
    intent: params.intent,
    rows,
    chunks,
    sources: [...rows.map((row) => row.source), ...chunks.map((chunk) => chunk.source)],
    warnings,
  };
}
