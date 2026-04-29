import { NextResponse } from "next/server";

import {
  evaluateObraDataFlowBuilder,
  getObraDataFlowBuilderConfig,
  getTenantDataFlowBuilderConfig,
  listObraDataFlowSources,
  mergeDataFlowBuilderConfigs,
  setObraDataFlowBuilderConfig,
} from "@/lib/data-flow-builder";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";

type RouteContext = { params: Promise<{ id: string }> };

async function fetchTenantDataFlowConfig(
  supabase: Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"],
  tenantId: string
) {
  const { data, error } = await supabase
    .from("tenant_data_flow_config")
    .select("config_json")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return getTenantDataFlowBuilderConfig(data?.config_json ?? null);
}

export async function GET(request: Request, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

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

    const { data: obra, error: obraError } = await supabase
      .from("obras")
      .select("id, custom_data, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, porcentaje")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obra) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const config = getObraDataFlowBuilderConfig(obra.custom_data);
    const inheritedConfig = await fetchTenantDataFlowConfig(supabase, tenantId);
    const effectiveConfig = mergeDataFlowBuilderConfigs(inheritedConfig, config);
    const sources = await listObraDataFlowSources({ supabase, tenantId, obraId });
    const includeEvaluated = new URL(request.url).searchParams.get("includeEvaluated") === "1";
    const evaluated = includeEvaluated
        ? await evaluateObraDataFlowBuilder({
          supabase,
          tenantId,
          obraId,
          config: effectiveConfig,
          obraValues: obra,
        })
      : null;

    return NextResponse.json({
      scope: "obra",
      config,
      inheritedConfig,
      effectiveConfig,
      sources,
      evaluated,
      generalTabSlots: [
        { id: "hero", label: "Hero superior" },
        { id: "financial", label: "KPIs financieros" },
      ],
    });
  } catch (error) {
    console.error("[data-flow-config:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const access = await resolveRequestAccessContext();
    const { supabase, tenantId, user, actorType } = access;

    if (actorType !== "user" || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const nextConfig = getObraDataFlowBuilderConfig({
      dataFlowBuilder:
        body && typeof body === "object" && "config" in body
          ? (body as { config?: unknown }).config
          : {},
    });

    const { data: obra, error: obraError } = await supabase
      .from("obras")
      .select("id, custom_data, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, porcentaje")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obra) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const inheritedConfig = await fetchTenantDataFlowConfig(supabase, tenantId);
    const effectiveConfig = mergeDataFlowBuilderConfigs(inheritedConfig, nextConfig);
    const customData = setObraDataFlowBuilderConfig(obra.custom_data, nextConfig);
    const { error: updateError } = await supabase
      .from("obras")
      .update({ custom_data: customData })
      .eq("id", obraId)
      .eq("tenant_id", tenantId);
    if (updateError) throw updateError;

    const sources = await listObraDataFlowSources({ supabase, tenantId, obraId });
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase,
      tenantId,
      obraId,
      config: effectiveConfig,
      obraValues: obra,
    });

    return NextResponse.json({
      scope: "obra",
      config: nextConfig,
      inheritedConfig,
      effectiveConfig,
      sources,
      evaluated,
    });
  } catch (error) {
    console.error("[data-flow-config:patch]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
