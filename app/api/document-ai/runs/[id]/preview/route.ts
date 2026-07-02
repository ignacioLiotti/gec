import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { permissionSimulationHas } from "@/lib/permission-simulation";
import { renderReportHtml } from "@/lib/document-ai/renderers/render-html";
import type { ReportComposition } from "@/lib/document-ai/schemas/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId || !user?.id) return NextResponse.json({ error: "No tenant" }, { status: 400 });

    const { data: realAllowed } = access.permissionSimulation
      ? { data: false }
      : await supabase.rpc("has_permission", {
          tenant: tenantId,
          perm_key: "document-ai:run",
        });
    const allowed = access.permissionSimulation
      ? permissionSimulationHas(access.permissionSimulation, "document-ai:run")
      : realAllowed;
    if (!allowed && !access.isSuperAdmin && !["owner", "admin"].includes(access.membershipRole ?? "")) {
      return NextResponse.json({ error: "Sin permisos para Document AI." }, { status: 403 });
    }

    const { data: run, error } = await supabase
      .from("document_ai_runs")
      .select("id, tenant_id, result, status")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!run) return NextResponse.json({ error: "Run no encontrado." }, { status: 404 });

    const composition = run.result as ReportComposition | null;
    if (!composition?.title) {
      return new NextResponse(
        "<!doctype html><meta charset=\"utf-8\"><body style=\"font-family:Arial;padding:32px\">La previsualizacion todavia no esta disponible.</body>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    return new NextResponse(renderReportHtml(composition), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[document-ai/preview]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al previsualizar output" }, { status: 500 });
  }
}
