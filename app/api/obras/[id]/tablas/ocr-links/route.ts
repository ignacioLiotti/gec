import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ensureTablaDataType } from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };

type DataInputMethod = "ocr" | "manual" | "both";

function normalizeDataInputMethod(value: unknown): DataInputMethod {
  if (value === "ocr" || value === "manual" || value === "both") return value;
  return "both";
}

function mapColumn(record: any) {
  return {
    id: record.id as string,
    tablaId: record.tabla_id as string,
    fieldKey: record.field_key as string,
    label: record.label as string,
    dataType: ensureTablaDataType(record.data_type as string | undefined),
    required: Boolean(record.required),
    position: record.position ?? 0,
    config: record.config ?? {},
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit"));
    const rowsLimit = Math.min(500, Math.max(1, Number.isFinite(limitParam) ? limitParam : 500));

    const supabase = await createClient();
    const { data: tablas, error: tablasError } = await supabase
      .from("obra_tablas")
      .select("id, obra_id, name, source_type, settings, created_at")
      .eq("obra_id", obraId)
      .eq("source_type", "ocr")
      .order("created_at", { ascending: true });
    if (tablasError) throw tablasError;

    const tablaIds = (tablas ?? []).map((t) => t.id as string);
    if (tablaIds.length === 0) {
      return NextResponse.json({ links: [] });
    }

    const { data: columns, error: columnsError } = await supabase
      .from("obra_tabla_columns")
      .select("id, tabla_id, field_key, label, data_type, position, required, config")
      .in("tabla_id", tablaIds)
      .order("position", { ascending: true });
    if (columnsError) throw columnsError;

    const columnsByTabla = new Map<string, ReturnType<typeof mapColumn>[]>();
    for (const column of columns ?? []) {
      const mapped = mapColumn(column);
      if (!columnsByTabla.has(mapped.tablaId)) {
        columnsByTabla.set(mapped.tablaId, []);
      }
      columnsByTabla.get(mapped.tablaId)?.push(mapped);
    }

    const { data: documents, error: documentsError } = await supabase
      .from("ocr_document_processing")
      .select(
        "id, tabla_id, source_bucket, source_path, source_file_name, status, error_message, rows_extracted, processed_at, processing_duration_ms, retry_count, created_at"
      )
      .eq("obra_id", obraId)
      .in("tabla_id", tablaIds)
      .order("created_at", { ascending: false });
    if (documentsError) throw documentsError;

    const documentsByTabla = new Map<string, any[]>();
    for (const doc of documents ?? []) {
      const tablaId = doc.tabla_id as string;
      if (!documentsByTabla.has(tablaId)) {
        documentsByTabla.set(tablaId, []);
      }
      documentsByTabla.get(tablaId)?.push(doc);
    }

    const rowsByTabla = new Map<string, any[]>();
    for (const tablaId of tablaIds) rowsByTabla.set(tablaId, []);
    const scanLimit = Math.min(100_000, Math.max(rowsLimit * tablaIds.length * 8, rowsLimit));
    const { data: rows, error: rowsError } = await supabase
      .from("obra_tabla_rows")
      .select("id, tabla_id, data, source, created_at, updated_at")
      .in("tabla_id", tablaIds)
      .order("created_at", { ascending: false })
      .limit(scanLimit);
    if (rowsError) {
      console.error("[ocr-links:get] rows error:", rowsError);
    } else {
      for (const row of rows ?? []) {
        const tablaId = row.tabla_id as string;
        const bucket = rowsByTabla.get(tablaId);
        if (!bucket) continue;
        if (bucket.length >= rowsLimit) continue;
        bucket.push(row);
      }
    }

    const links = (tablas ?? [])
      .map((tabla) => {
        const settings = (tabla.settings as Record<string, unknown>) ?? {};
        const folderName = typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
        if (!folderName) return null;
        const dataInputMethod = normalizeDataInputMethod(settings.dataInputMethod);
        const tablaId = tabla.id as string;
        return {
          tablaId,
          tablaName: tabla.name as string,
          folderName,
          columns: columnsByTabla.get(tablaId) ?? [],
          rows: rowsByTabla.get(tablaId) ?? [],
          orders: [],
          documents: documentsByTabla.get(tablaId) ?? [],
          dataInputMethod,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ links });
  } catch (error) {
    console.error("[ocr-links:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
