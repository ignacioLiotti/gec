import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { renderDocumentHtml } from "@/lib/document-generation";
import {
  canEditGeneratedDocument,
  formatWorkLabel,
  insertGeneratedDocumentEvent,
  loadActorsByIds,
  loadDocumentGenerationPermissions,
} from "@/lib/document-generation-server";

const ALLOWED_STATUSES = new Set(["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"]);

type RouteContext = { params: Promise<{ id: string }> };

function readSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: "Estado no permitido" }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabase
      .from("generated_documents")
      .select("id, status")
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

    await insertGeneratedDocumentEvent(
      accessContext,
      id,
      "GeneratedDocumentStatusChanged",
      { status: nextStatus },
      String(current.status ?? ""),
      nextStatus,
    );

    return NextResponse.json({ generatedDocument: data });
  } catch (error) {
    console.error("[document-generation/generated-status]", error);
    const message = error instanceof Error ? error.message : "Error al actualizar estado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
