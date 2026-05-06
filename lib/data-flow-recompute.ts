import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildObraResultWritebackPatch,
  buildObraResultWritebackPlan,
  evaluateObraDataFlowBuilder,
  getObraDataFlowBuilderConfig,
  getTenantDataFlowBuilderConfig,
  mergeDataFlowBuilderConfigs,
} from "@/lib/data-flow-builder";
import {
  persistDataFlowWritebackRun,
  type DataFlowWritebackTrigger,
} from "@/lib/data-flow-writeback";

export type DataFlowRecomputeResult = {
  evaluated: Awaited<ReturnType<typeof evaluateObraDataFlowBuilder>>;
  writebackPlan: ReturnType<typeof buildObraResultWritebackPlan>;
  writeback: string[];
};

export async function recomputeObraDataFlowWritebacks({
  supabase,
  tenantId,
  obraId,
  actorUserId,
  trigger,
  allowAutoWrite = true,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  obraId: string;
  actorUserId: string | null;
  trigger: DataFlowWritebackTrigger;
  allowAutoWrite?: boolean;
}): Promise<DataFlowRecomputeResult> {
  const [{ data: obra, error: obraError }, { data: tenantConfigRow, error: tenantConfigError }] = await Promise.all([
    supabase
      .from("obras")
      .select("*")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("tenant_data_flow_config")
      .select("config_json")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  if (obraError) throw obraError;
  if (tenantConfigError) throw tenantConfigError;
  if (!obra) throw new Error("Obra no encontrada para recomputar data-flow.");

  const config = mergeDataFlowBuilderConfigs(
    getTenantDataFlowBuilderConfig(tenantConfigRow?.config_json ?? null),
    getObraDataFlowBuilderConfig(obra.custom_data)
  );
  const evaluated = await evaluateObraDataFlowBuilder({ supabase, tenantId, obraId, config, obraValues: obra });
  const writebackPlan = buildObraResultWritebackPlan({ config, evaluated, obraValues: obra });
  if (!allowAutoWrite) {
    const autoActions = writebackPlan.actions.filter((action) => action.mode === "auto");
    writebackPlan.actions = writebackPlan.actions.filter((action) => action.mode !== "auto");
    writebackPlan.blocked = [
      ...writebackPlan.blocked,
      ...autoActions.map((action) => ({
        ...action,
        status: "blocked" as const,
        blockReason: "El usuario no tiene permiso data-flow:auto-write.",
      })),
    ];
  }
  const writebackPatch = buildObraResultWritebackPatch({ plan: writebackPlan, customData: obra.custom_data });

  if (Object.keys(writebackPatch.obraPatch).length > 0 || writebackPatch.writtenFields.length > 0) {
    const { error: updateError } = await supabase
      .from("obras")
      .update({ ...writebackPatch.obraPatch, custom_data: writebackPatch.customData })
      .eq("id", obraId)
      .eq("tenant_id", tenantId);
    if (updateError) throw updateError;
  }

  await persistDataFlowWritebackRun({
    supabase,
    tenantId,
    obraId,
    actorUserId,
    trigger,
    plan: writebackPlan,
    appliedFields: writebackPatch.writtenFields,
  });

  return { evaluated, writebackPlan, writeback: writebackPatch.writtenFields };
}

export async function tryRecomputeObraDataFlowWritebacks(
  args: Parameters<typeof recomputeObraDataFlowWritebacks>[0]
): Promise<{ ok: true; result: DataFlowRecomputeResult } | { ok: false; error: string }> {
  try {
    return { ok: true, result: await recomputeObraDataFlowWritebacks(args) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido recomputando data-flow.";
    console.warn("[data-flow-recompute] skipped", message);
    return { ok: false, error: message };
  }
}

export async function canAutoWriteDataFlow({
  supabase,
  tenantId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
}) {
  const { data, error } = await supabase.rpc("has_permission", {
    tenant: tenantId,
    perm_key: "data-flow:auto-write",
  });
  if (error) {
    console.warn("[data-flow-recompute] failed to check auto-write permission", error);
    return false;
  }
  return data === true;
}
