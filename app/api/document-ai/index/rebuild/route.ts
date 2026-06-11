import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";
import { rebuildDocumentAiIndex } from "@/lib/document-ai/index/build-document-ai-index";

export async function POST(request: NextRequest) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;
    if (!user && actorType !== "demo") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId || !user?.id) return NextResponse.json({ error: "No tenant" }, { status: 400 });
    const { data: allowed } = await supabase.rpc("has_permission", {
      tenant: tenantId,
      perm_key: "document-ai:admin",
    });
    if (!allowed && !access.isSuperAdmin && !["owner", "admin"].includes(access.membershipRole ?? "")) {
      return NextResponse.json({ error: "Sin permisos para reconstruir el indice." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { obraId?: string | null };
    const result = await rebuildDocumentAiIndex({
      supabase,
      tenantId,
      obraId: typeof body.obraId === "string" ? body.obraId : null,
      requestedBy: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[document-ai/index/rebuild]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error al reconstruir indice" }, { status: 500 });
  }
}
