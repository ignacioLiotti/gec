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

async function canWriteTenantDataFlow(access: Awaited<ReturnType<typeof resolveRequestAccessContext>>) {
  return hasDataFlowPermission(access, "data-flow:tenant-edit");
}

async function hasDataFlowPermission(
  access: Awaited<ReturnType<typeof resolveRequestAccessContext>>,
  permissionKey: "data-flow:read" | "data-flow:edit" | "data-flow:tenant-edit"
) {
  if (access.actorType !== "user" || !access.user || !access.tenantId) return false;
  const { data, error } = await access.supabase.rpc("has_permission", {
    tenant: access.tenantId,
    perm_key: permissionKey,
  });
  if (error) throw error;
  return data === true;
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
    if (actorType === "user" && !(await hasDataFlowPermission(access, "data-flow:read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      canWrite: await canWriteTenantDataFlow(access),
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

    if (!(await canWriteTenantDataFlow(access)) || !user) {
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
