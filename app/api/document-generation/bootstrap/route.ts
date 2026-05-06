import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { normalizeDocumentType, normalizeFolderGenerationPath } from "@/lib/document-generation";
import {
  assertWorkInTenant,
  loadDocumentGenerationPermissions,
  loadFolderGenerationConfigs,
  loadTemplates,
  loadWorks,
  resolveGenerationContext,
} from "@/lib/document-generation-server";

export async function GET(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const accessContext = {
      supabase,
      tenantId,
      userId: user?.id ?? null,
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canCreate) {
      return NextResponse.json({ error: "Sin permisos para crear documentos." }, { status: 403 });
    }

    const workId = request.nextUrl.searchParams.get("workId");
    const folderPath = normalizeFolderGenerationPath(request.nextUrl.searchParams.get("folderPath"));
    const documentType = normalizeDocumentType(request.nextUrl.searchParams.get("documentType"));

    const [works, templates] = await Promise.all([
      loadWorks(accessContext),
      loadTemplates(accessContext),
    ]);

    let workSummary: { id: string; n: number | null; designacion_y_ubicacion: string | null } | null = null;
    if (workId) {
      workSummary = await assertWorkInTenant(supabase, tenantId, workId);
      if (!workSummary) {
        return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
      }
    }

    const folderConfigs = await loadFolderGenerationConfigs(accessContext, workId);
    const context = resolveGenerationContext({
      documentType,
      folderPath,
      folderConfigs,
      templates,
    });

    return NextResponse.json({
      works,
      folderConfigs,
      templates: context.filteredTemplates,
      context: {
        workId: workId ?? null,
        workLabel: workSummary
          ? [workSummary.n != null ? String(workSummary.n) : "", workSummary.designacion_y_ubicacion ?? ""]
              .filter(Boolean)
              .join(" ")
              .trim()
          : null,
        folderPath: context.resolvedFolderPath || null,
        folderCandidates: context.folderCandidates,
        allowedDocumentTypes: context.allowedDocumentTypes,
        documentType: context.resolvedDocumentType,
        selectedTemplate: context.selectedTemplate,
        initialInputData: context.initialInputData,
      },
    });
  } catch (error) {
    console.error("[document-generation/bootstrap]", error);
    const message = error instanceof Error ? error.message : "Error al cargar la configuracion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
