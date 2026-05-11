import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  applyTemplateAutoInputData,
  normalizeDocumentType,
  normalizeFolderGenerationPath,
} from "@/lib/document-generation";
import {
  assertWorkInTenant,
  loadDocumentGenerationPermissions,
  loadFolderGenerationConfigs,
  loadTenantUserOptions,
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

    const [works, templates, tenantUserOptions] = await Promise.all([
      loadWorks(accessContext),
      loadTemplates(accessContext),
      loadTenantUserOptions(accessContext),
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
    const resolvedDocumentType = context.resolvedDocumentType;
    const existingSequenceCount =
      workId && resolvedDocumentType
        ? await countExistingDocuments({
            supabase: access.supabase,
            tenantId,
            workId,
            documentType: resolvedDocumentType,
            folderPath: context.resolvedFolderPath,
          })
        : 0;
    const workLabel = workSummary
      ? [workSummary.n != null ? String(workSummary.n) : "", workSummary.designacion_y_ubicacion ?? ""]
          .filter(Boolean)
          .join(" ")
          .trim()
      : null;
    const initialInputData = applyTemplateAutoInputData(
      context.selectedTemplate?.schema ?? { fields: [] },
      context.initialInputData,
      {
        selectedContextId: workId ?? null,
        selectedContextLabel: workLabel,
        documentType: resolvedDocumentType,
        existingSequenceCount,
      },
    );

    return NextResponse.json({
      works,
      folderConfigs,
      templates: context.filteredTemplates,
      dynamicOptions: {
        tenantUsers: tenantUserOptions,
      },
      context: {
        workId: workId ?? null,
        workLabel,
        folderPath: context.resolvedFolderPath || null,
        folderCandidates: context.folderCandidates,
        allowedDocumentTypes: context.allowedDocumentTypes,
        documentType: context.resolvedDocumentType,
        selectedTemplate: context.selectedTemplate,
        existingSequenceCount,
        initialInputData,
      },
    });
  } catch (error) {
    console.error("[document-generation/bootstrap]", error);
    const message = error instanceof Error ? error.message : "Error al cargar la configuracion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function countExistingDocuments({
  supabase,
  tenantId,
  workId,
  documentType,
  folderPath,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  workId: string;
  documentType: string;
  folderPath?: string | null;
}) {
  let query = supabase
    .from("generated_documents")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("obra_id", workId)
    .eq("document_type", documentType);
  if (folderPath) {
    query = query.eq("folder_path", folderPath);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
