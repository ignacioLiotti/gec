import { NextResponse } from "next/server";

import { recomputeObraDataFlowWritebacks } from "@/lib/data-flow-recompute";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";

type RouteContext = { params: Promise<{ id: string }> };

async function hasDataFlowPermission(
  access: Awaited<ReturnType<typeof resolveRequestAccessContext>>,
  permissionKey: "data-flow:read" | "data-flow:edit" | "data-flow:auto-write"
) {
  if (access.actorType !== "user" || !access.user || !access.tenantId) return false;
  const { data, error } = await access.supabase.rpc("has_permission", {
    tenant: access.tenantId,
    perm_key: permissionKey,
  });
  if (error) throw error;
  return data === true;
}

export async function POST(request: Request, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });

  try {
    const access = await resolveRequestAccessContext();
    const { supabase, tenantId, user, actorType } = access;
    if (!user && actorType !== "demo") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
    if (actorType === "user" && !(await hasDataFlowPermission(access, "data-flow:edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const trigger =
      body && typeof body === "object" && (body as { trigger?: unknown }).trigger === "source_change"
        ? "source_change"
        : "manual_recompute";

    const allowAutoWrite =
      actorType !== "user" || (await hasDataFlowPermission(access, "data-flow:auto-write"));
    const result = await recomputeObraDataFlowWritebacks({
      supabase,
      tenantId,
      obraId,
      actorUserId: user?.id ?? null,
      trigger,
      allowAutoWrite,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[data-flow-recompute:post]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
