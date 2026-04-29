import { NextResponse } from "next/server";

import {
  getTenantDataFlowBuilderConfig,
  listTenantDataFlowSources,
  setTenantDataFlowBuilderConfig,
} from "@/lib/data-flow-builder";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";

function canWriteTenantDataFlow(access: Awaited<ReturnType<typeof resolveRequestAccessContext>>) {
  return (
    access.actorType === "user" &&
    Boolean(access.user) &&
    (access.isSuperAdmin || access.membershipRole === "owner" || access.membershipRole === "admin")
  );
}

export async function GET() {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, tenantId, user, actorType } = access;

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from("tenant_data_flow_config")
      .select("config_json, updated_at, updated_by")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw error;

    const config = getTenantDataFlowBuilderConfig(row?.config_json ?? null);
    const sources = await listTenantDataFlowSources({ supabase, tenantId });

    return NextResponse.json({
      scope: "tenant",
      config,
      sources,
      evaluated: null,
      canWrite: canWriteTenantDataFlow(access),
      updatedAt: row?.updated_at ?? null,
      generalTabSlots: [
        { id: "hero", label: "Hero superior" },
        { id: "financial", label: "KPIs financieros" },
      ],
    });
  } catch (error) {
    console.error("[tenant-data-flow-config:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, tenantId, user } = access;

    if (!canWriteTenantDataFlow(access) || !user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const nextConfig = getTenantDataFlowBuilderConfig({
      dataFlowBuilder:
        body && typeof body === "object" && "config" in body
          ? (body as { config?: unknown }).config
          : {},
    });

    const { data: existing, error: existingError } = await supabase
      .from("tenant_data_flow_config")
      .select("config_json")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (existingError) throw existingError;

    const configJson = setTenantDataFlowBuilderConfig(existing?.config_json ?? null, nextConfig);
    const { data: saved, error: saveError } = await supabase
      .from("tenant_data_flow_config")
      .upsert(
        {
          tenant_id: tenantId,
          config_json: configJson,
          updated_by: user.id,
        },
        { onConflict: "tenant_id" }
      )
      .select("config_json, updated_at, updated_by")
      .single();
    if (saveError) throw saveError;

    const sources = await listTenantDataFlowSources({ supabase, tenantId });

    return NextResponse.json({
      scope: "tenant",
      config: getTenantDataFlowBuilderConfig(saved.config_json),
      sources,
      evaluated: null,
      canWrite: true,
      updatedAt: saved.updated_at ?? null,
      generalTabSlots: [
        { id: "hero", label: "Hero superior" },
        { id: "financial", label: "KPIs financieros" },
      ],
    });
  } catch (error) {
    console.error("[tenant-data-flow-config:patch]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
