import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asRecord } from "@/lib/document-ai/normalization/shared";
import { createDocumentAiEmbedding } from "./embeddings";

function hashContent(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function rebuildDocumentAiIndex(params: {
  supabase: SupabaseClient;
  tenantId: string;
  obraId?: string | null;
  requestedBy?: string | null;
}) {
  const { data: run, error: runError } = await params.supabase
    .from("document_ai_index_runs")
    .insert({
      tenant_id: params.tenantId,
      obra_id: params.obraId ?? null,
      requested_by: params.requestedBy ?? null,
      status: "running",
    })
    .select("id")
    .maybeSingle();
  if (runError) throw runError;
  const runId = String(run?.id ?? "");

  try {
    let tableQuery = params.supabase
      .from("obra_tablas")
      .select("id, obra_id, name, settings, obras!inner(tenant_id)")
      .eq("obras.tenant_id", params.tenantId);
    if (params.obraId) tableQuery = tableQuery.eq("obra_id", params.obraId);
    const { data: tablas, error: tablasError } = await tableQuery;
    if (tablasError) throw tablasError;

    const tablaIds = ((tablas ?? []) as Array<Record<string, unknown>>).map((tabla) => String(tabla.id));
    const tablaById = new Map(((tablas ?? []) as Array<Record<string, unknown>>).map((tabla) => [String(tabla.id), tabla]));
    if (tablaIds.length === 0) {
      await params.supabase
        .from("document_ai_index_runs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", runId);
      return { runId, rowsIndexed: 0 };
    }

    const { data: rows, error: rowsError } = await params.supabase
      .from("obra_tabla_rows")
      .select("id, tabla_id, data, lineage_row_key, extraction_id, created_at")
      .in("tabla_id", tablaIds)
      .limit(1000);
    if (rowsError) throw rowsError;

    const payload = await Promise.all(((rows ?? []) as Array<Record<string, unknown>>).map(async (row) => {
      const table = tablaById.get(String(row.tabla_id));
      const data = asRecord(row.data);
      const content = Object.entries(data)
        .filter(([key]) => !key.startsWith("__"))
        .map(([key, value]) => `${key}: ${String(value ?? "")}`)
        .join("\n");
      const settings = asRecord(table?.settings);
      const documentType =
        typeof settings.documentType === "string"
          ? settings.documentType
          : Array.isArray(settings.documentTypes) && typeof settings.documentTypes[0] === "string"
            ? settings.documentTypes[0]
            : null;
      return {
        tenant_id: params.tenantId,
        obra_id: table?.obra_id ?? null,
        source_kind: "row",
        source_table: "obra_tabla_rows",
        source_id: row.id,
        document_type: documentType,
        content,
        structured_data: data,
        metadata: {
          tableName: table?.name ?? null,
          createdAt: row.created_at ?? null,
        },
        source_ref: {
          kind: "obra_tabla_row",
          tenantId: params.tenantId,
          obraId: table?.obra_id ?? null,
          tableId: row.tabla_id ?? null,
          rowId: row.id ?? null,
          documentType,
          documentPath: data.__docPath ?? null,
          documentFileName: data.__docFileName ?? null,
          lineageRowKey: row.lineage_row_key ?? null,
          extractionId: row.extraction_id ?? null,
        },
        content_hash: hashContent(content),
        embedding: await createDocumentAiEmbedding(content),
      };
    }));
    const indexRows = payload.filter((entry) => entry.content.trim().length > 0);

    if (indexRows.length > 0) {
      const [{ error: upsertError }, { error: tableRowsError }] = await Promise.all([
        params.supabase
        .from("document_ai_index")
        .upsert(indexRows, { onConflict: "tenant_id,source_kind,source_table,source_id,content_hash" }),
        params.supabase
          .from("document_ai_table_rows")
          .upsert(
            indexRows.map((entry) => ({
              tenant_id: entry.tenant_id,
              obra_id: entry.obra_id,
              source_table: entry.source_table,
              source_row_id: entry.source_id,
              document_type: entry.document_type,
              structured_data: entry.structured_data,
              source_ref: entry.source_ref,
              embedding: entry.embedding,
            })),
            { onConflict: "tenant_id,source_table,source_row_id" },
          ),
      ]);
      if (upsertError) throw upsertError;
      if (tableRowsError) throw tableRowsError;
    }

    await params.supabase
      .from("document_ai_index_runs")
      .update({
        status: "completed",
        rows_indexed: indexRows.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return { runId, rowsIndexed: indexRows.length };
  } catch (error) {
    await params.supabase
      .from("document_ai_index_runs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw error;
  }
}
