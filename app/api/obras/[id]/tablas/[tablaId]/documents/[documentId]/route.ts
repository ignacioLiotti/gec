import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type RouteContext = {
  params: Promise<{ id: string; tablaId: string; documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id: obraId, tablaId, documentId } = await context.params;

  if (!obraId || !tablaId || !documentId) {
    return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: document, error: documentError } = await supabase
      .from("ocr_document_processing")
      .select(
        "id, obra_id, tabla_id, source_bucket, source_path, source_file_name, status, error_message, rows_extracted, processed_at, processing_duration_ms, retry_count, created_at"
      )
      .eq("id", documentId)
      .eq("tabla_id", tablaId)
      .eq("obra_id", obraId)
      .maybeSingle();

    if (documentError) throw documentError;
    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const { data: tablaMeta, error: tablaError } = await supabase
      .from("obra_tablas")
      .select("settings")
      .eq("id", tablaId)
      .eq("obra_id", obraId)
      .maybeSingle();

    if (tablaError) throw tablaError;

    const settings = (tablaMeta?.settings as Record<string, unknown>) ?? {};
    const templateId =
      typeof settings?.ocrTemplateId === "string" && settings.ocrTemplateId.length > 0
        ? (settings.ocrTemplateId as string)
        : null;

    let template: Record<string, unknown> | null = null;
    if (templateId) {
      const { data: templateData, error: templateError } = await supabase
        .from("ocr_templates")
        .select("id, name, description, regions, template_width, template_height")
        .eq("id", templateId)
        .maybeSingle();

      if (templateError) throw templateError;
      if (templateData) {
        template = {
          id: templateData.id,
          name: templateData.name,
          description: templateData.description,
          regions: (templateData.regions as Record<string, unknown>[]) ?? [],
          templateWidth: templateData.template_width,
          templateHeight: templateData.template_height,
        };
      }
    }

    const { data: columnsData, error: columnsError } = await supabase
      .from("obra_tabla_columns")
      .select("id, field_key, label, data_type, position, required, config")
      .eq("tabla_id", tablaId)
      .order("position", { ascending: true });

    if (columnsError) throw columnsError;

    let rowsData: Array<{ id: string; data: Record<string, unknown>; created_at: string }> = [];
    if (document.source_path) {
      const { data: rows, error: rowsError } = await supabase
        .from("obra_tabla_rows")
        .select("id, data, created_at")
        .eq("tabla_id", tablaId)
        .contains("data", { __docPath: document.source_path });

      if (rowsError) throw rowsError;
      rowsData = (rows ?? []) as Array<{ id: string; data: Record<string, unknown>; created_at: string }>;
    }

    let signedUrl: string | null = null;
    if (document.source_bucket && document.source_path) {
      const { data: signed } = await supabase.storage
        .from(document.source_bucket)
        .createSignedUrl(document.source_path, 60 * 60);
      signedUrl = signed?.signedUrl ?? null;
    }

    return NextResponse.json({
      document,
      signedUrl,
      template,
      rows: rowsData,
      columns: columnsData ?? [],
    });
  } catch (error) {
    console.error("[tabla-documents:detail]", error);
    const message = error instanceof Error ? error.message : "Error cargando documento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
