import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import {
  canEditGeneratedDocument,
  formatWorkLabel,
  loadActorsByIds,
  loadDocumentGenerationPermissions,
  loadWorks,
} from "@/lib/document-generation-server";

function mapStatusBucket(statuses: string[]) {
  const expanded = new Set<string>();
  for (const status of statuses) {
    switch (status) {
      case "PENDING":
        expanded.add("GENERATED");
        expanded.add("UNDER_REVIEW");
        break;
      case "APPROVED":
      case "REJECTED":
      case "CANCELLED":
      case "GENERATED":
      case "UNDER_REVIEW":
        expanded.add(status);
        break;
      default:
        break;
    }
  }
  return Array.from(expanded);
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
    if (!permissions.canReview && !permissions.canCreate && !permissions.canViewAllDrafts) {
      return NextResponse.json({ error: "Sin permisos para ver documentos generados." }, { status: 403 });
    }

    const workId = request.nextUrl.searchParams.get("workId")?.trim();
    const createdBy = request.nextUrl.searchParams.get("createdBy")?.trim();
    const documentType = request.nextUrl.searchParams.get("documentType")?.trim();
    const from = request.nextUrl.searchParams.get("from")?.trim();
    const to = request.nextUrl.searchParams.get("to")?.trim();
    const statusFilter = mapStatusBucket(
      (request.nextUrl.searchParams.get("status") ?? "")
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean),
    );

    let query = supabase
      .from("generated_documents")
      .select(
        "id, obra_id, folder_path, document_type, template_id, template_version, source_draft_id, file_name, status, input_data, generated_by, generated_at, updated_at, obras(n, designacion_y_ubicacion), document_generation_templates(name)",
      )
      .order("generated_at", { ascending: false });

    if (workId) query = query.eq("obra_id", workId);
    if (createdBy) query = query.eq("generated_by", createdBy);
    if (documentType) query = query.eq("document_type", documentType);
    if (statusFilter.length > 0) query = query.in("status", statusFilter);
    if (!permissions.canReview && !permissions.canViewAllDrafts) query = query.eq("generated_by", user.id);
    if (from) query = query.gte("generated_at", `${from}T00:00:00.000Z`);
    if (to) query = query.lte("generated_at", `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const actorsById = await loadActorsByIds(rows.map((row) => String(row.generated_by ?? "")));
    const works = await loadWorks(accessContext);

    const documents = rows.map((row) => {
      const obra = row.obras as { n: number | null; designacion_y_ubicacion: string | null } | null;
      const actor = actorsById[String(row.generated_by ?? "")] ?? null;
      return {
        id: String(row.id),
        workId: String(row.obra_id),
        workLabel: obra ? formatWorkLabel(obra) : String(row.obra_id ?? ""),
        folderPath: String(row.folder_path ?? ""),
        documentType: String(row.document_type ?? ""),
        templateId: String(row.template_id ?? ""),
        templateName:
          ((row.document_generation_templates as { name?: string } | null)?.name as string | undefined) ?? null,
        sourceDraftId: row.source_draft_id ? String(row.source_draft_id) : null,
        fileName: String(row.file_name ?? ""),
        status: String(row.status ?? ""),
        inputData:
          row.input_data && typeof row.input_data === "object" && !Array.isArray(row.input_data)
            ? row.input_data
            : {},
        generatedAt: String(row.generated_at ?? ""),
        updatedAt: String(row.updated_at ?? ""),
        createdBy: actor,
        canEdit: canEditGeneratedDocument({
          canCreate: permissions.canCreate,
          userId: user.id,
          generatedBy: typeof row.generated_by === "string" ? row.generated_by : null,
          status: typeof row.status === "string" ? row.status : null,
        }),
      };
    });

    const creators = Object.values(actorsById).sort((left, right) => left.label.localeCompare(right.label));
    const counts = {
      pending: documents.filter((document) => ["GENERATED", "UNDER_REVIEW"].includes(document.status)).length,
      approved: documents.filter((document) => document.status === "APPROVED").length,
      rejected: documents.filter((document) => document.status === "REJECTED").length,
    };

    return NextResponse.json({
      documents,
      works,
      creators,
      counts,
      permissions,
    });
  } catch (error) {
    console.error("[document-generation/generated:list]", error);
    const message = error instanceof Error ? error.message : "Error al cargar documentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
