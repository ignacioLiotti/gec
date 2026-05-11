import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  applyTemplateAliasInputData,
  buildInitialInputData,
  normalizeDocumentType,
  normalizeFolderGenerationPath,
  normalizeTemplateSchema,
  validateTemplateInput,
} from "@/lib/document-generation";
import {
  assertWorkInTenant,
  formatWorkLabel,
  loadActorsByIds,
  loadDocumentGenerationPermissions,
  loadWorks,
  validateGenerationTarget,
} from "@/lib/document-generation-server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type DraftRequestBody = {
  id?: string;
  workId?: string;
  folderPath?: string;
  documentType?: string;
  templateId?: string;
  inputData?: Record<string, unknown>;
};

async function loadDraftRejectionContexts(tenantId: string, draftIds: string[]) {
  const ids = Array.from(new Set(draftIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, unknown>();

  const admin = createSupabaseAdminClient();
  const { data: rejectedDocuments, error: documentsError } = await admin
    .from("generated_documents")
    .select("id, source_draft_id")
    .eq("tenant_id", tenantId)
    .eq("status", "REJECTED")
    .in("source_draft_id", ids);
  if (documentsError) throw documentsError;

  const documentRows = (rejectedDocuments ?? []) as Array<Record<string, unknown>>;
  const draftIdByDocumentId = new Map(
    documentRows.map((row) => [String(row.id), String(row.source_draft_id ?? "")]),
  );
  const documentIds = Array.from(draftIdByDocumentId.keys());
  if (documentIds.length === 0) return new Map<string, unknown>();

  const { data: events, error: eventsError } = await admin
    .from("generated_document_events")
    .select("generated_document_id, payload, created_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("event_type", "GeneratedDocumentStatusChanged")
    .eq("to_status", "REJECTED")
    .in("generated_document_id", documentIds)
    .order("created_at", { ascending: false });
  if (eventsError) throw eventsError;

  const eventRows = (events ?? []) as Array<Record<string, unknown>>;
  const actorsById = await loadActorsByIds(eventRows.map((event) => String(event.created_by ?? "")));
  const rejectionByDraftId = new Map<string, unknown>();

  for (const event of eventRows) {
    const generatedDocumentId = String(event.generated_document_id ?? "");
    const draftId = draftIdByDocumentId.get(generatedDocumentId);
    if (!draftId || rejectionByDraftId.has(draftId)) continue;
    const payload =
      event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? (event.payload as Record<string, unknown>)
        : {};
    const rejectedBy = actorsById[String(event.created_by ?? "")] ?? null;
    rejectionByDraftId.set(draftId, {
      generatedDocumentId,
      comment: typeof payload.comment === "string" ? payload.comment : "",
      rejectedAt: String(event.created_at ?? ""),
      rejectedBy,
    });
  }

  return rejectionByDraftId;
}

export async function GET(request: NextRequest) {
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
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canCreate && !permissions.canViewAllDrafts) {
      return NextResponse.json({ error: "Sin permisos para ver borradores." }, { status: 403 });
    }

    const draftId = request.nextUrl.searchParams.get("id")?.trim();
    const workId = request.nextUrl.searchParams.get("workId")?.trim();
    const createdBy = request.nextUrl.searchParams.get("createdBy")?.trim();
    const from = request.nextUrl.searchParams.get("from")?.trim();
    const to = request.nextUrl.searchParams.get("to")?.trim();
    const statuses = (request.nextUrl.searchParams.get("status") ?? "")
      .split(",")
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean);

    let query = supabase
      .from("generated_document_drafts")
      .select(
        "id, obra_id, folder_path, document_type, template_id, template_version, status, input_data, validation_errors, created_by, created_at, updated_at, obras(n, designacion_y_ubicacion), document_generation_templates(name)",
      )
      .order("updated_at", { ascending: false });

    if (draftId) {
      query = query.eq("id", draftId);
    }
    if (workId) {
      query = query.eq("obra_id", workId);
    }
    if (permissions.canViewAllDrafts && createdBy) {
      query = query.eq("created_by", createdBy);
    } else if (!permissions.canViewAllDrafts) {
      query = query.eq("created_by", user.id);
    }
    if (statuses.length > 0) {
      query = query.in("status", statuses);
    }
    if (from) {
      query = query.gte("updated_at", `${from}T00:00:00.000Z`);
    }
    if (to) {
      query = query.lte("updated_at", `${to}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const actorsById = await loadActorsByIds(rows.map((row) => String(row.created_by ?? "")));
    const rejectionByDraftId = await loadDraftRejectionContexts(
      tenantId,
      rows.map((row) => String(row.id ?? "")),
    );
    const works = await loadWorks(accessContext);

    const drafts = rows.map((row) => {
      const obra = row.obras as { n: number | null; designacion_y_ubicacion: string | null } | null;
      const actor = actorsById[String(row.created_by ?? "")] ?? null;
      const validationErrors = Array.isArray(row.validation_errors) ? row.validation_errors : [];
      return {
        id: String(row.id),
        workId: String(row.obra_id),
        workLabel: obra ? formatWorkLabel(obra) : String(row.obra_id ?? ""),
        folderPath: String(row.folder_path ?? ""),
        documentType: String(row.document_type ?? ""),
        templateId: String(row.template_id ?? ""),
        templateName:
          ((row.document_generation_templates as { name?: string } | null)?.name as string | undefined) ?? null,
        status: String(row.status ?? "DRAFT"),
        inputData:
          row.input_data && typeof row.input_data === "object" && !Array.isArray(row.input_data)
            ? row.input_data
            : {},
        validationErrors,
        createdAt: String(row.created_at ?? ""),
        updatedAt: String(row.updated_at ?? ""),
        createdBy: actor,
        rejection: rejectionByDraftId.get(String(row.id)) ?? null,
        canEdit: permissions.canCreate && String(row.created_by ?? "") === user.id,
      };
    });

    if (draftId) {
      const draft = drafts[0] ?? null;
      if (!draft) {
        return NextResponse.json({ error: "Borrador no encontrado." }, { status: 404 });
      }
      return NextResponse.json({ draft, permissions });
    }

    const creators = permissions.canViewAllDrafts
      ? Object.values(actorsById)
          .sort((left, right) => left.label.localeCompare(right.label))
      : [];

    return NextResponse.json({
      drafts,
      works,
      creators,
      permissions,
    });
  } catch (error) {
    console.error("[document-generation/drafts:get]", error);
    const message = error instanceof Error ? error.message : "Error al cargar borradores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    };
    const permissions = await loadDocumentGenerationPermissions(accessContext);
    if (!permissions.canCreate) {
      return NextResponse.json({ error: "Sin permisos para crear o editar borradores." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as DraftRequestBody;
    const workId = typeof body.workId === "string" ? body.workId : "";
    const folderPath = normalizeFolderGenerationPath(body.folderPath);
    const documentType = normalizeDocumentType(body.documentType);
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const inputData =
      body.inputData && typeof body.inputData === "object" && !Array.isArray(body.inputData)
        ? body.inputData
        : {};

    if (!workId) {
      return NextResponse.json({ error: "No se puede generar un documento sin obra." }, { status: 400 });
    }
    if (!folderPath) {
      return NextResponse.json({ error: "No se puede generar un documento sin carpeta destino." }, { status: 400 });
    }
    if (!documentType) {
      return NextResponse.json({ error: "Falta el tipo documental." }, { status: 400 });
    }
    if (!templateId) {
      return NextResponse.json({ error: "No hay una plantilla activa para generar este tipo de documento." }, { status: 400 });
    }

    const work = await assertWorkInTenant(supabase, tenantId, workId);
    if (!work) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const targetValidation = await validateGenerationTarget(
      accessContext,
      { workId, folderPath, documentType },
    );
    if (!targetValidation.valid) {
      return NextResponse.json({ error: targetValidation.error }, { status: 400 });
    }

    const { data: template, error: templateError } = await supabase
      .from("document_generation_templates")
      .select("id, version, document_type, target_folder_path, schema")
      .eq("id", templateId)
      .eq("status", "active")
      .maybeSingle();
    if (templateError) throw templateError;
    if (!template) {
      return NextResponse.json({ error: "No hay una plantilla activa para generar este tipo de documento." }, { status: 400 });
    }

    const templateDocumentType = normalizeDocumentType(template.document_type);
    const templateFolderPath = normalizeFolderGenerationPath(template.target_folder_path);
    if (templateDocumentType !== documentType) {
      return NextResponse.json({ error: "La plantilla seleccionada no corresponde al tipo documental." }, { status: 400 });
    }
    if (templateFolderPath && templateFolderPath !== folderPath) {
      return NextResponse.json({ error: "La plantilla seleccionada no corresponde a la carpeta destino." }, { status: 400 });
    }

    const schema = normalizeTemplateSchema(template.schema);
    const hydratedInputData = applyTemplateAliasInputData(schema, buildInitialInputData(schema, inputData));
    const validationErrors = validateTemplateInput(schema, hydratedInputData);
    const status = validationErrors.length === 0 ? "READY_TO_GENERATE" : "DRAFT";

    const payload = {
      tenant_id: tenantId,
      obra_id: workId,
      folder_path: folderPath,
      document_type: documentType,
      template_id: template.id,
      template_version: Number(template.version) || 1,
      status,
      input_data: hydratedInputData,
      validation_errors: validationErrors,
      created_by: user.id,
    };

    const query = supabase.from("generated_document_drafts");
    if (typeof body.id === "string" && body.id.trim()) {
      const { data, error } = await query
        .update(payload)
        .eq("id", body.id.trim())
        .eq("created_by", user.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ draft: data });
    }

    const { data, error } = await query.insert(payload).select("*").maybeSingle();
    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error("[document-generation/drafts]", error);
    const message = error instanceof Error ? error.message : "Error al guardar borrador";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
