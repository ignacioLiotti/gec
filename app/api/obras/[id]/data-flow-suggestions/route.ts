import { NextResponse } from "next/server";

import {
  CUSTOM_OBRA_FIELD_SOURCE_PREFIX,
  DEFAULT_OBRA_FIELD_SOURCES,
} from "@/lib/data-flow-builder";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";

type RouteContext = { params: Promise<{ id: string }> };

async function hasDataFlowPermission(
  access: Awaited<ReturnType<typeof resolveRequestAccessContext>>,
  permissionKey: "data-flow:read" | "data-flow:edit" | "data-flow:apply-suggestion"
) {
  if (access.actorType !== "user" || !access.user || !access.tenantId) return false;
  const { data, error } = await access.supabase.rpc("has_permission", {
    tenant: access.tenantId,
    perm_key: permissionKey,
  });
  if (error) throw error;
  return data === true;
}

export async function GET(_request: Request, context: RouteContext) {
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
    if (actorType === "user" && !(await hasDataFlowPermission(access, "data-flow:read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("obra_data_flow_suggestions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ suggestions: data ?? [] });
  } catch (error) {
    console.error("[data-flow-suggestions:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });

  try {
    const access = await resolveRequestAccessContext();
    const { supabase, tenantId, user, actorType } = access;
    if (actorType !== "user" || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
    const canApply =
      (await hasDataFlowPermission(access, "data-flow:apply-suggestion")) ||
      (await hasDataFlowPermission(access, "data-flow:edit"));
    if (!canApply) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const suggestionId =
      body && typeof body === "object" && typeof (body as { suggestionId?: unknown }).suggestionId === "string"
        ? (body as { suggestionId: string }).suggestionId
        : "";
    const decision =
      body && typeof body === "object" && (body as { decision?: unknown }).decision === "reject"
        ? "rejected"
        : "accepted";
    if (!suggestionId) return NextResponse.json({ error: "Sugerencia requerida" }, { status: 400 });

    const { data: suggestion, error: suggestionError } = await supabase
      .from("obra_data_flow_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .eq("tenant_id", tenantId)
      .eq("obra_id", obraId)
      .eq("status", "pending")
      .maybeSingle();
    if (suggestionError) throw suggestionError;
    if (!suggestion) return NextResponse.json({ error: "Sugerencia no encontrada" }, { status: 404 });

    const fieldId = String((suggestion as { field_id: unknown }).field_id ?? "");
    const suggestedValue = (suggestion as { suggested_value: unknown }).suggested_value;
    const baseFieldIds = new Set(DEFAULT_OBRA_FIELD_SOURCES.map((source) => source.id));

    if (decision === "accepted") {
      if (fieldId.startsWith(CUSTOM_OBRA_FIELD_SOURCE_PREFIX)) {
        const customKey = fieldId.slice(CUSTOM_OBRA_FIELD_SOURCE_PREFIX.length);
        if (!customKey || customKey === "dataFlowBuilder") {
          return NextResponse.json({ error: "Campo destino invalido" }, { status: 400 });
        }
        const { data: obra, error: obraError } = await supabase
          .from("obras")
          .select("custom_data")
          .eq("id", obraId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .maybeSingle();
        if (obraError) throw obraError;
        if (!obra) return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
        const currentCustomData =
          obra.custom_data && typeof obra.custom_data === "object" && !Array.isArray(obra.custom_data)
            ? (obra.custom_data as Record<string, unknown>)
            : {};
        const { error: updateError } = await supabase
          .from("obras")
          .update({ custom_data: { ...currentCustomData, [customKey]: suggestedValue } })
          .eq("id", obraId)
          .eq("tenant_id", tenantId);
        if (updateError) throw updateError;
      } else {
        if (!baseFieldIds.has(fieldId)) {
          return NextResponse.json({ error: "Campo destino invalido" }, { status: 400 });
        }
        const { error: updateError } = await supabase
          .from("obras")
          .update({ [fieldId]: suggestedValue })
          .eq("id", obraId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);
        if (updateError) throw updateError;
      }
    }

    const { data: updated, error: updateSuggestionError } = await supabase
      .from("obra_data_flow_suggestions")
      .update({
        status: decision,
        applied_by: decision === "accepted" ? user.id : null,
        applied_at: decision === "accepted" ? new Date().toISOString() : null,
        rejected_by: decision === "rejected" ? user.id : null,
        rejected_at: decision === "rejected" ? new Date().toISOString() : null,
      })
      .eq("id", suggestionId)
      .eq("tenant_id", tenantId)
      .eq("obra_id", obraId)
      .select("*")
      .single();
    if (updateSuggestionError) throw updateSuggestionError;

    return NextResponse.json({ suggestion: updated });
  } catch (error) {
    console.error("[data-flow-suggestions:patch]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
