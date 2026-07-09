import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  applyTemplateAliasInputData,
  applyTemplateFormulaInputData,
  buildInitialInputData,
  normalizeDocumentType,
  normalizeFolderGenerationPath,
  normalizeTemplateSchema,
} from "@/lib/document-generation";
import {
  assertWorkInTenant,
  buildDocumentAiInputFromExtractionContext,
  loadDocumentGenerationPermissions,
  validateGenerationTarget,
} from "@/lib/document-generation-server";

type AssistRequestBody = {
  workId?: string;
  folderPath?: string;
  documentType?: string;
  templateId?: string;
  inputData?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId || !user?.id) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const accessContext = {
      supabase,
      tenantId,
      userId: user.id,
      permissionSimulation: access.permissionSimulation,
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canCreate) {
      return NextResponse.json({ error: "No tienes permisos para crear documentos." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as AssistRequestBody;
    const workId = typeof body.workId === "string" ? body.workId : "";
    const folderPath = normalizeFolderGenerationPath(body.folderPath);
    const documentType = normalizeDocumentType(body.documentType);
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const inputData =
      body.inputData && typeof body.inputData === "object" && !Array.isArray(body.inputData)
        ? body.inputData
        : {};

    if (!workId || !folderPath || !documentType || !templateId) {
      return NextResponse.json(
        { error: "Completa obra, carpeta, tipo documental y plantilla antes de usar el contexto inteligente." },
        { status: 400 },
      );
    }

    const work = await assertWorkInTenant(supabase, tenantId, workId);
    if (!work) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const targetValidation = await validateGenerationTarget(accessContext, {
      workId,
      folderPath,
      documentType,
    });
    if (!targetValidation.valid) {
      return NextResponse.json({ error: targetValidation.error }, { status: 400 });
    }

    const { data: template, error: templateError } = await supabase
      .from("document_generation_templates")
      .select("id, document_type, target_folder_path, schema")
      .eq("id", templateId)
      .eq("status", "active")
      .maybeSingle();
    if (templateError) throw templateError;
    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
    }
    if (normalizeDocumentType(template.document_type) !== documentType) {
      return NextResponse.json({ error: "La plantilla no corresponde al tipo documental." }, { status: 400 });
    }
    const templateFolderPath = normalizeFolderGenerationPath(template.target_folder_path);
    if (templateFolderPath && templateFolderPath !== folderPath) {
      return NextResponse.json({ error: "La plantilla no corresponde a la carpeta destino." }, { status: 400 });
    }

    const schema = normalizeTemplateSchema(template.schema);
    const currentInputData = applyTemplateFormulaInputData(
      schema,
      applyTemplateAliasInputData(schema, buildInitialInputData(schema, inputData)),
    );
    const result = await buildDocumentAiInputFromExtractionContext({
      access: accessContext,
      workId,
      folderPath,
      documentType,
      schema,
      currentInputData,
    });

    return NextResponse.json({
      inputData: applyTemplateFormulaInputData(schema, result.inputData),
      context: result.context,
      appliedFieldCount: result.appliedFieldCount,
    });
  } catch (error) {
    console.error("[document-generation/assist]", error);
    const message = error instanceof Error ? error.message : "Error al completar con contexto inteligente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
