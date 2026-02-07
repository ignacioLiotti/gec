import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { ensureTablaDataType, normalizeFolderName } from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };

type DataInputMethod = "ocr" | "manual" | "both";

type OcrColumn = {
  id: string;
  tablaId: string;
  fieldKey: string;
  label: string;
  dataType: string;
  required: boolean;
  position?: number;
  config?: Record<string, unknown>;
};

function normalizeDataInputMethod(value: unknown): DataInputMethod {
  if (value === "ocr" || value === "manual" || value === "both") return value;
  return "both";
}

function mapColumn(record: any): OcrColumn {
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

function mapTablaRowsToOrders(rows: any[], tablaId: string) {
  const groups = new Map<string, any>();
  rows.forEach((row: any) => {
    const data = (row?.data as Record<string, unknown>) ?? {};
    const fallbackId = randomUUID();
    const rawKey = typeof (data as any).nroOrden === "string" && (data as any).nroOrden.trim().length > 0
      ? (data as any).nroOrden.trim()
      : String(row?.id ?? fallbackId);
    if (!groups.has(rawKey)) {
      const docBucketValue = data && typeof (data as any).__docBucket === "string" ? (data as any).__docBucket : undefined;
      const docPathValue = data && typeof (data as any).__docPath === "string" ? (data as any).__docPath : undefined;
      groups.set(rawKey, {
        id: `${tablaId}-${rawKey}`,
        nroOrden: typeof (data as any).nroOrden === "string" && (data as any).nroOrden.trim().length > 0 ? (data as any).nroOrden.trim() : "Sin número",
        solicitante: typeof (data as any).solicitante === "string" ? (data as any).solicitante : "",
        gestor: typeof (data as any).gestor === "string" ? (data as any).gestor : "",
        proveedor: typeof (data as any).proveedor === "string" ? (data as any).proveedor : "",
        items: [],
        docBucket: docBucketValue || (docPathValue ? "obra-documents" : undefined),
        docPath: docPathValue,
      });
    }
    const order = groups.get(rawKey)!;
    order.items.push({
      id: String(row?.id ?? `${rawKey}-${order.items.length}`),
      cantidad: Number((data as any).cantidad ?? 0) || 0,
      unidad: typeof (data as any).unidad === "string" ? (data as any).unidad : "",
      material: typeof (data as any).material === "string" ? (data as any).material : "",
      precioUnitario: Number((data as any).precioUnitario ?? 0) || 0,
    });
  });
  return Array.from(groups.values());
}

export async function GET(request: Request, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    const limitParam = rawLimit ? Number(rawLimit) : Number.NaN;
    const rowsLimit = Math.min(500, Math.max(1, Number.isFinite(limitParam) ? limitParam : 500));

    const supabase = await createClient();

    // Ensure obra exists (RLS will enforce tenant access)
    const { data: obraRow, error: obraError } = await supabase
      .from("obras")
      .select("id")
      .eq("id", obraId)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obraRow) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    // Fetch OCR tablas + columns + documents + rows (single batched approach)
    const { data: tablas, error: tablasError } = await supabase
      .from("obra_tablas")
      .select("id, obra_id, name, source_type, settings, created_at")
      .eq("obra_id", obraId)
      .eq("source_type", "ocr")
      .order("created_at", { ascending: true });
    if (tablasError) throw tablasError;

    const tablaIds = (tablas ?? []).map((t) => t.id as string);

    const columnsByTabla = new Map<string, OcrColumn[]>();
    if (tablaIds.length > 0) {
      const { data: columns, error: columnsError } = await supabase
        .from("obra_tabla_columns")
        .select("id, tabla_id, field_key, label, data_type, position, required, config")
        .in("tabla_id", tablaIds)
        .order("position", { ascending: true });
      if (columnsError) throw columnsError;
      for (const column of columns ?? []) {
        const mapped = mapColumn(column);
        if (!columnsByTabla.has(mapped.tablaId)) {
          columnsByTabla.set(mapped.tablaId, []);
        }
        columnsByTabla.get(mapped.tablaId)?.push(mapped);
      }
    }

    const documentsByTabla = new Map<string, any[]>();
    if (tablaIds.length > 0) {
      const { data: documents, error: documentsError } = await supabase
        .from("ocr_document_processing")
        .select(
          "id, tabla_id, source_bucket, source_path, source_file_name, status, error_message, rows_extracted, processed_at, processing_duration_ms, retry_count, created_at"
        )
        .eq("obra_id", obraId)
        .in("tabla_id", tablaIds)
        .order("created_at", { ascending: false });
      if (documentsError) throw documentsError;
      for (const doc of documents ?? []) {
        const tablaId = doc.tabla_id as string;
        if (!documentsByTabla.has(tablaId)) documentsByTabla.set(tablaId, []);
        documentsByTabla.get(tablaId)?.push(doc);
      }
    }

    const rowsByTabla = new Map<string, any[]>();
    await Promise.all(
      tablaIds.map(async (tablaId) => {
        const { data: rows, error: rowsError } = await supabase
          .from("obra_tabla_rows")
          .select("id, tabla_id, data, source, created_at, updated_at")
          .eq("tabla_id", tablaId)
          .order("created_at", { ascending: false })
          .limit(rowsLimit);
        if (rowsError) {
          console.error("[documents-tree:get] rows error:", rowsError);
          rowsByTabla.set(tablaId, []);
          return;
        }
        rowsByTabla.set(tablaId, rows ?? []);
      })
    );

    const ocrLinks = (tablas ?? [])
      .map((tabla) => {
        const settings = (tabla.settings as Record<string, unknown>) ?? {};
        const folderName = typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
        if (!folderName) return null;
        const dataInputMethod = normalizeDataInputMethod(settings.dataInputMethod);
        const tablaId = tabla.id as string;
        const rows = rowsByTabla.get(tablaId) ?? [];
        return {
          tablaId,
          tablaName: tabla.name as string,
          folderName,
          columns: columnsByTabla.get(tablaId) ?? [],
          rows,
          orders: mapTablaRowsToOrders(rows, tablaId),
          documents: documentsByTabla.get(tablaId) ?? [],
          dataInputMethod,
        };
      })
      .filter(Boolean);

    const ocrFolderMap = new Map<string, any>();
    for (const link of ocrLinks as any[]) {
      ocrFolderMap.set(link.folderName, link);
      ocrFolderMap.set(normalizeFolderName(link.folderName), link);
    }

    // Build file tree from storage
    const { data: rootItems, error: rootError } = await supabase.storage
      .from("obra-documents")
      .list(obraId, { limit: 1000 });
    if (rootError) throw rootError;

    const root: any = {
      id: "root",
      name: "Documentos",
      type: "folder",
      children: [],
    };

    const folderMap = new Map<string, any>();
    folderMap.set("root", root);
    const foldersToLoad: string[] = [];

    for (const item of rootItems ?? []) {
      if (item.name === ".emptyFolderPlaceholder") continue;
      const isFolder = !item.metadata;
      if (!isFolder) continue;
      const folderName = item.name.replace(/\/$/, "");
      const normalizedFolderName = normalizeFolderName(folderName);
      foldersToLoad.push(folderName);
      const linkedTabla =
        ocrFolderMap.get(folderName) || ocrFolderMap.get(normalizedFolderName);

      const folderId = `folder-${folderName}`;
      const folder: any = {
        id: folderId,
        name: folderName,
        type: "folder",
        children: [],
        ocrEnabled: Boolean(linkedTabla),
        ocrTablaId: linkedTabla?.tablaId,
        ocrTablaName: linkedTabla?.tablaName,
        ocrFolderName: linkedTabla?.folderName ?? normalizedFolderName,
        ocrTablaColumns: linkedTabla?.columns,
        ocrTablaRows: linkedTabla?.rows,
        extractedData: linkedTabla?.orders,
        dataInputMethod: linkedTabla?.dataInputMethod,
      };
      folderMap.set(folderId, folder);
      root.children.push(folder);
    }

    for (const folderName of foldersToLoad) {
      const normalizedFolderName = normalizeFolderName(folderName);
      const folder = folderMap.get(`folder-${folderName}`);
      if (!folder) continue;
      const { data: folderContents, error: folderError } = await supabase.storage
        .from("obra-documents")
        .list(`${obraId}/${folderName}`, {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });
      if (folderError) continue;
      if (folderContents) {
        const folderLink =
          ocrFolderMap.get(folderName) || ocrFolderMap.get(normalizedFolderName);
        const docsByPath = new Map<string, any>();
        (folderLink?.documents ?? []).forEach((doc: any) => {
          if (doc?.source_path) {
            docsByPath.set(doc.source_path, doc);
          }
        });
        for (const file of folderContents) {
          const storagePath = `${obraId}/${folderName}/${file.name}`;
          const docStatus = docsByPath.get(storagePath);
          const fileItem: any = {
            id: `file-${folderName}-${file.name}`,
            name: file.name,
            type: "file",
            storagePath,
            size: file.metadata?.size,
            mimetype: file.metadata?.mimetype,
            ocrDocumentStatus: docStatus ? docStatus.status : folder?.ocrEnabled ? "unprocessed" : undefined,
            ocrDocumentId: docStatus?.id,
            ocrDocumentError: docStatus?.error_message ?? null,
            ocrRowsExtracted: docStatus?.rows_extracted ?? null,
          };
          folder.children?.push(fileItem);
        }
      }
    }

    return NextResponse.json({
      tree: root,
      links: ocrLinks ?? [],
    });
  } catch (error) {
    console.error("[documents-tree:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
