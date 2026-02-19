/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { ensureTablaDataType, normalizeFolderName, normalizeFolderPath } from "@/lib/tablas";

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

function humanizeFolderSegment(segment: string): string {
  if (!segment) return segment;
  return segment
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

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
    for (const tablaId of tablaIds) rowsByTabla.set(tablaId, []);
    if (tablaIds.length > 0) {
      const scanLimit = Math.min(
        100_000,
        Math.max(rowsLimit * tablaIds.length * 8, rowsLimit)
      );
      const { data: rows, error: rowsError } = await supabase
        .from("obra_tabla_rows")
        .select("id, tabla_id, data, source, created_at, updated_at")
        .in("tabla_id", tablaIds)
        .order("created_at", { ascending: false })
        .limit(scanLimit);
      if (rowsError) {
        console.error("[documents-tree:get] rows error:", rowsError);
      } else {
        for (const row of rows ?? []) {
          const tablaId = row.tabla_id as string;
          const bucket = rowsByTabla.get(tablaId);
          if (!bucket) continue;
          if (bucket.length >= rowsLimit) continue;
          bucket.push(row);
        }
      }
    }

    const ocrLinks = (tablas ?? [])
      .map((tabla) => {
        const settings = (tabla.settings as Record<string, unknown>) ?? {};
        const folderName = typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
        if (!folderName) return null;
        const folderLabel =
          typeof settings.ocrFolderLabel === "string" && settings.ocrFolderLabel.trim().length > 0
            ? settings.ocrFolderLabel.trim()
            : null;
        const dataInputMethod = normalizeDataInputMethod(settings.dataInputMethod);
        const tablaId = tabla.id as string;
        const rows = rowsByTabla.get(tablaId) ?? [];
        return {
          tablaId,
          tablaName: tabla.name as string,
          folderName,
          folderLabel,
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
      const normalizedPath = normalizeFolderPath(link.folderName);
      if (normalizedPath) {
        ocrFolderMap.set(normalizedPath, link);
      }
      const normalizedFlat = normalizeFolderName(link.folderName);
      if (normalizedFlat) {
        ocrFolderMap.set(normalizedFlat, link);
      }
    }

    const getNormalizedPath = (value: string) => normalizeFolderPath(value);
    const displayNameByPath = new Map<string, string>();
    for (const link of ocrLinks as any[]) {
      const normalizedPath = normalizeFolderPath(link.folderName ?? "");
      if (!normalizedPath) continue;
      const label =
        typeof link.folderLabel === "string" && link.folderLabel.trim().length > 0
          ? link.folderLabel.trim()
          : null;
      if (label) {
        displayNameByPath.set(normalizedPath, label);
      }
    }

    const root: any = {
      id: "root",
      name: "Documentos",
      type: "folder",
      children: [],
      storagePath: obraId,
    };

    const folderNodeByPath = new Map<string, any>();
    folderNodeByPath.set("", root);

    const buildFolderNode = (relativeFolderPath: string) => {
      const normalizedRelative = getNormalizedPath(relativeFolderPath);
      const linkedTabla =
        ocrFolderMap.get(normalizedRelative) ||
        ocrFolderMap.get(normalizeFolderName(relativeFolderPath));
      const fallbackSegmentName = relativeFolderPath.split("/").pop() ?? relativeFolderPath;
      const displayName =
        displayNameByPath.get(normalizedRelative) ?? humanizeFolderSegment(fallbackSegmentName);
      return {
        id: `folder-${normalizedRelative || "root"}`,
        name: displayName,
        type: "folder",
        children: [],
        storagePath: `${obraId}/${relativeFolderPath}`,
        relativePath: relativeFolderPath,
        ocrEnabled: Boolean(linkedTabla),
        ocrTablaId: linkedTabla?.tablaId,
        ocrTablaName: linkedTabla?.tablaName,
        ocrFolderName: linkedTabla?.folderName ?? normalizedRelative,
        ocrTablaColumns: linkedTabla?.columns,
        ocrTablaRows: linkedTabla?.rows,
        extractedData: linkedTabla?.orders,
        dataInputMethod: linkedTabla?.dataInputMethod,
      };
    };

    const ensureFolderPath = (relativeFolderPath: string) => {
      const normalizedRelative = getNormalizedPath(relativeFolderPath);
      if (!normalizedRelative) return root;
      if (folderNodeByPath.has(normalizedRelative)) {
        return folderNodeByPath.get(normalizedRelative);
      }
      const segments = normalizedRelative.split("/");
      const ownName = segments.pop()!;
      const parentPath = segments.join("/");
      const parentNode = ensureFolderPath(parentPath);
      const folderNode = buildFolderNode(normalizedRelative);
      folderNode.name =
        displayNameByPath.get(normalizedRelative) ?? humanizeFolderSegment(ownName);
      if (!parentNode.children.some((child: any) => child.id === folderNode.id)) {
        parentNode.children.push(folderNode);
      }
      folderNodeByPath.set(normalizedRelative, folderNode);
      return folderNode;
    };

    const docsByPath = new Map<string, any>();
    for (const link of ocrLinks as any[]) {
      for (const doc of link?.documents ?? []) {
        if (doc?.source_path) {
          docsByPath.set(doc.source_path, doc);
        }
      }
    }

    const uploadTrackingByPath = new Map<
      string,
      { uploadedBy: string | null; uploadedAt: string | null }
    >();
    const { data: trackedUploads, error: trackedUploadsError } = await supabase
      .from("obra_document_uploads")
      .select("storage_path, uploaded_by, uploaded_at")
      .eq("obra_id", obraId);
    if (trackedUploadsError) {
      console.error("[documents-tree:get] tracked uploads error:", trackedUploadsError);
    } else {
      for (const upload of trackedUploads ?? []) {
        const storagePath =
          typeof upload.storage_path === "string" ? upload.storage_path : null;
        if (!storagePath) continue;
        uploadTrackingByPath.set(storagePath, {
          uploadedBy:
            typeof upload.uploaded_by === "string" ? upload.uploaded_by : null,
          uploadedAt:
            typeof upload.uploaded_at === "string" ? upload.uploaded_at : null,
        });
      }
    }

    // Build full tree recursively by traversing each storage folder.
    const queue: string[] = [""];
    const seen = new Set<string>([""]);
    while (queue.length > 0) {
      const currentRelative = queue.shift() ?? "";
      const storagePrefix = currentRelative ? `${obraId}/${currentRelative}` : obraId;
      const parentNode = ensureFolderPath(currentRelative);
      const { data: folderContents, error: folderError } = await supabase.storage
        .from("obra-documents")
        .list(storagePrefix, {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });
      if (folderError) {
        continue;
      }

      for (const item of folderContents ?? []) {
        if (item.name === ".emptyFolderPlaceholder") continue;
        const isFolder = !item.metadata;
        if (isFolder) {
          const childRelative = currentRelative
            ? `${currentRelative}/${item.name.replace(/\/$/, "")}`
            : item.name.replace(/\/$/, "");
          const normalizedChild = getNormalizedPath(childRelative);
          ensureFolderPath(normalizedChild);
          if (!seen.has(normalizedChild)) {
            seen.add(normalizedChild);
            queue.push(normalizedChild);
          }
          continue;
        }
        const storagePath = currentRelative
          ? `${obraId}/${currentRelative}/${item.name}`
          : `${obraId}/${item.name}`;
        const docStatus = docsByPath.get(storagePath);
        const trackedUpload = uploadTrackingByPath.get(storagePath);
        const storageOwner =
          typeof (item as any)?.owner === "string"
            ? ((item as any).owner as string)
            : typeof (item as any)?.owner_id === "string"
              ? ((item as any).owner_id as string)
              : typeof (item as any)?.user_id === "string"
                ? ((item as any).user_id as string)
                : null;
        const storageCreatedAt =
          typeof (item as any)?.created_at === "string"
            ? ((item as any).created_at as string)
            : typeof (item as any)?.updated_at === "string"
              ? ((item as any).updated_at as string)
              : typeof (item as any)?.last_accessed_at === "string"
                ? ((item as any).last_accessed_at as string)
                : null;
        const fileItem: any = {
          id: `file-${storagePath}`,
          name: item.name,
          type: "file",
          storagePath,
          size: item.metadata?.size,
          mimetype: item.metadata?.mimetype,
          ocrDocumentStatus: docStatus
            ? docStatus.status
            : parentNode?.ocrEnabled
              ? "unprocessed"
              : undefined,
          ocrDocumentId: docStatus?.id,
          ocrDocumentError: docStatus?.error_message ?? null,
          ocrRowsExtracted: docStatus?.rows_extracted ?? null,
          uploadedAt: trackedUpload?.uploadedAt ?? storageCreatedAt,
          uploadedByUserId: trackedUpload?.uploadedBy ?? storageOwner,
          uploadedByLabel:
            (trackedUpload?.uploadedBy ?? storageOwner) &&
            currentUser?.id &&
            (trackedUpload?.uploadedBy ?? storageOwner) === currentUser.id
              ? "Vos"
              : trackedUpload?.uploadedBy ?? storageOwner,
        };
        parentNode.children?.push(fileItem);
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
