import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId || !user?.id) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const { data: output, error } = await supabase
      .from("document_ai_outputs")
      .select("storage_bucket, storage_path, file_name, mime_type, document_ai_runs!inner(tenant_id)")
      .eq("run_id", id)
      .eq("document_ai_runs.tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!output?.storage_bucket || !output.storage_path) {
      return NextResponse.json({ error: "Output no encontrado." }, { status: 404 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error: downloadError } = await admin.storage
      .from(String(output.storage_bucket))
      .download(String(output.storage_path));
    if (downloadError) throw downloadError;
    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Content-Type": String(output.mime_type ?? "application/octet-stream"),
        "Content-Disposition": `attachment; filename="${String(output.file_name ?? "document-ai-output")}"`,
      },
    });
  } catch (error) {
    console.error("[document-ai/download]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al descargar output" }, { status: 500 });
  }
}
