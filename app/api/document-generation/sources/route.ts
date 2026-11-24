import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { loadDocumentGenerationPermissions } from "@/lib/document-generation-server";
import { loadReferenceRecords, loadReferenceSourceCatalog } from "@/lib/document-reference-sources";

/**
 * GET                                   -> { sources } reference source catalog
 * GET ?records=usuarios,tabla:x&workId= -> { records } records per source
 */
export async function GET(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
    const accessContext = {
      supabase: access.supabase,
      tenantId,
      userId: user?.id ?? null,
      permissionSimulation: access.permissionSimulation,
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canCreate && !permissions.canManageTemplates) {
      return NextResponse.json({ error: "Sin permisos para generar documentos." }, { status: 403 });
    }

    const requested = request.nextUrl.searchParams.get("records");
    if (requested == null) {
      return NextResponse.json({ sources: await loadReferenceSourceCatalog(accessContext) });
    }
    const sources = requested.split(",").map((source) => source.trim()).filter(Boolean).slice(0, 20);
    const records = await loadReferenceRecords(accessContext, {
      sources,
      workId: request.nextUrl.searchParams.get("workId"),
    });
    return NextResponse.json({ records });
  } catch (error) {
    if (error instanceof Error && error.message === "Obra no encontrada") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[document-generation/sources]", error);
    return NextResponse.json({ error: "No se pudieron cargar los datos vinculados." }, { status: 500 });
  }
}
