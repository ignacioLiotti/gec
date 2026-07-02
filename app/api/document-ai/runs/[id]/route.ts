import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { permissionSimulationHas } from "@/lib/permission-simulation";

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

    const { data, error } = await supabase
      .from("document_ai_runs")
      .select("*, document_ai_outputs(*), document_ai_sources(*)")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Run no encontrado." }, { status: 404 });
    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("[document-ai/run:get]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al cargar run" }, { status: 500 });
  }
}
