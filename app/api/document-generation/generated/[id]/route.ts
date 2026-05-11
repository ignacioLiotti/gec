import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { renderDocumentHtml } from "@/lib/document-generation";
import {
  canEditGeneratedDocument,
  formatWorkLabel,
  loadActorsByIds,
  loadDocumentGenerationPermissions,
} from "@/lib/document-generation-server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const ALLOWED_STATUSES = new Set(["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"]);

type RouteContext = { params: Promise<{ id: string }> };

function readSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function reopenPurchaseOrderDraft(params: {
  generatedDocument: {
    id: string;
    tenant_id: string;
    obra_id: string;
    folder_path: string;
    document_type: string;
    template_id: string;
    template_version: number;
    source_draft_id: string | null;
    input_data: Record<string, unknown>;
    generated_by: string;
  };
}) {
  if (params.generatedDocument.document_type !== "PURCHASE_ORDER") return null;

  const admin = createSupabaseAdminClient();
  const draftPayload = {
    tenant_id: params.generatedDocument.tenant_id,
    obra_id: params.generatedDocument.obra_id,
    folder_path: params.generatedDocument.folder_path,
    document_type: params.generatedDocument.document_type,
    template_id: params.generatedDocument.template_id,
    template_version: params.generatedDocument.template_version,
    status: "DRAFT",
    input_data: params.generatedDocument.input_data,
    validation_errors: [],
    created_by: params.generatedDocument.generated_by,
  };

  if (params.generatedDocument.source_draft_id) {
    const { data, error } = await admin
      .from("generated_document_drafts")
      .update({
        status: "DRAFT",
        input_data: params.generatedDocument.input_data,
        validation_errors: [],
      })
      .eq("id", params.generatedDocument.source_draft_id)
      .eq("tenant_id", params.generatedDocument.tenant_id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return String(data.id);
  }

  const { data: draft, error: draftError } = await admin
    .from("generated_document_drafts")
    .insert(draftPayload)
    .select("id")
    .maybeSingle();
  if (draftError) throw draftError;

  const draftId = String(draft?.id ?? "");
  if (!draftId) return null;

  const { error: linkError } = await admin
    .from("generated_documents")
    .update({ source_draft_id: draftId })
    .eq("id", params.generatedDocument.id)
    .eq("tenant_id", params.generatedDocument.tenant_id);
  if (linkError) throw linkError;

  return draftId;
}

async function insertReviewEvent(params: {
  generatedDocumentId: string;
  tenantId: string;
  userId: string;
  eventType: string;
  payload: Record<string, unknown>;
  fromStatus?: string | null;
  toStatus?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("generated_document_events").insert({
    generated_document_id: params.generatedDocumentId,
    tenant_id: params.tenantId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    payload: params.payload,
    created_by: params.userId,
  });
  if (error) throw error;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
    if (!permissions.canReview && !permissions.canCreate) {
      return NextResponse.json({ error: "Sin permisos para ver documentos generados." }, { status: 403 });
    }

    const { data: document, error } = await supabase
      .from("generated_documents")
      .select(
        "id, obra_id, folder_path, document_type, template_id, template_version, source_draft_id, storage_bucket, storage_path, file_name, status, input_data, generated_by, generated_at, updated_at, obras(n, designacion_y_ubicacion), document_generation_templates(name, content_html), generated_document_events(id, event_type, from_status, to_status, payload, created_by, created_at)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!document) {
      return NextResponse.json({ error: "Documento generado no encontrado" }, { status: 404 });
    }
    const canEdit = canEditGeneratedDocument({
      canCreate: permissions.canCreate,
      userId: user.id,
      generatedBy: typeof document.generated_by === "string" ? document.generated_by : null,
      status: typeof document.status === "string" ? document.status : null,
    });
    if (!permissions.canReview && !canEdit) {
      return NextResponse.json({ error: "Sin permisos para ver este documento generado." }, { status: 403 });
    }

    const actorIds = [
      String(document.generated_by ?? ""),
      ...(((document.generated_document_events as Array<{ created_by?: string | null }> | null) ?? []).map(
        (event) => String(event.created_by ?? ""),
      )),
    ];
    const actorsById = await loadActorsByIds(actorIds);

    const obra = readSingleRelation(document.obras) as
      | { n: number | null; designacion_y_ubicacion: string | null }
      | null;
    const template = readSingleRelation(document.document_generation_templates) as
      | { name?: string | null; content_html?: string | null }
      | null;
    const inputData =
      document.input_data && typeof document.input_data === "object" && !Array.isArray(document.input_data)
        ? (document.input_data as Record<string, unknown>)
        : {};
    const previewHtml = template?.content_html
      ? renderDocumentHtml(template.content_html, inputData, {
          workName: obra ? formatWorkLabel(obra) : "",
          generatedAt: String(document.generated_at ?? ""),
        })
      : "";

    return NextResponse.json({
      document: {
        id: String(document.id),
        workId: String(document.obra_id),
        workLabel: obra ? formatWorkLabel(obra) : String(document.obra_id ?? ""),
        folderPath: String(document.folder_path ?? ""),
        documentType: String(document.document_type ?? ""),
        templateId: String(document.template_id ?? ""),
        templateName: template?.name ?? null,
        sourceDraftId: document.source_draft_id ? String(document.source_draft_id) : null,
        storagePath: String(document.storage_path ?? ""),
        fileName: String(document.file_name ?? ""),
        status: String(document.status ?? ""),
        inputData,
        generatedAt: String(document.generated_at ?? ""),
        updatedAt: String(document.updated_at ?? ""),
        createdBy: actorsById[String(document.generated_by ?? "")] ?? null,
        previewHtml,
        canEdit,
      },
      events: (((document.generated_document_events as Array<Record<string, unknown>> | null) ?? [])).map((event) => ({
        id: String(event.id ?? ""),
        eventType: String(event.event_type ?? ""),
        fromStatus: event.from_status ? String(event.from_status) : null,
        toStatus: event.to_status ? String(event.to_status) : null,
        payload:
          event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
            ? event.payload
            : {},
        createdAt: String(event.created_at ?? ""),
        createdBy: actorsById[String(event.created_by ?? "")] ?? null,
      })),
    });
  } catch (error) {
    console.error("[document-generation/generated:get]", error);
    const message = error instanceof Error ? error.message : "Error al cargar documento generado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
    if (!permissions.canReview) {
      return NextResponse.json({ error: "Sin permisos para revisar documentos." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const nextStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: "Estado no permitido" }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabase
      .from("generated_documents")
      .select(
        "id, tenant_id, obra_id, folder_path, document_type, template_id, template_version, source_draft_id, input_data, generated_by, status",
      )
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return NextResponse.json({ error: "Documento generado no encontrado" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("generated_documents")
      .update({ status: nextStatus })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;

    const reopenedDraftId =
      nextStatus === "REJECTED"
        ? await reopenPurchaseOrderDraft({
            generatedDocument: {
              id: String(current.id),
              tenant_id: String(current.tenant_id),
              obra_id: String(current.obra_id),
              folder_path: String(current.folder_path ?? ""),
              document_type: String(current.document_type ?? ""),
              template_id: String(current.template_id ?? ""),
              template_version: Number(current.template_version) || 1,
              source_draft_id:
                typeof current.source_draft_id === "string"
                  ? current.source_draft_id
                  : null,
              input_data:
                current.input_data && typeof current.input_data === "object" && !Array.isArray(current.input_data)
                  ? (current.input_data as Record<string, unknown>)
                  : {},
              generated_by: String(current.generated_by),
            },
          })
        : null;

    await insertReviewEvent({
      generatedDocumentId: id,
      tenantId,
      userId: user.id,
      eventType: "GeneratedDocumentStatusChanged",
      payload: { status: nextStatus, comment, reopenedDraftId },
      fromStatus: String(current.status ?? ""),
      toStatus: nextStatus,
    });

    return NextResponse.json({ generatedDocument: data });
  } catch (error) {
    console.error("[document-generation/generated-status]", error);
    const message = error instanceof Error ? error.message : "Error al actualizar estado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
