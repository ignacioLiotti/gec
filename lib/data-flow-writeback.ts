import type { SupabaseClient } from "@supabase/supabase-js";

import type { DataFlowBuilderWritebackPlan } from "@/lib/data-flow-builder";

export type DataFlowWritebackTrigger =
  | "config_save"
  | "manual_recompute"
  | "source_change"
  | "suggestion_accept";

function isMissingTableError(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ((error as { code?: unknown }).code === "42P01" || (error as { code?: unknown }).code === "42703")
  );
}

function missingWritebackMigrationError() {
  return new Error("Falta aplicar la migracion 0100_data_flow_writeback_runs.sql para sugerencias/auditoria de data-flow.");
}

function normalizeComparableSuggestionValue(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return value;
}

function isSameSuggestionValue(left: unknown, right: unknown) {
  const leftValue = normalizeComparableSuggestionValue(left);
  const rightValue = normalizeComparableSuggestionValue(right);
  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return Math.abs(leftValue - rightValue) < 0.000001;
  }
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

export async function persistDataFlowWritebackRun({
  supabase,
  tenantId,
  obraId,
  actorUserId,
  trigger,
  plan,
  appliedFields,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  obraId: string;
  actorUserId: string | null;
  trigger: DataFlowWritebackTrigger;
  plan: DataFlowBuilderWritebackPlan;
  appliedFields: string[];
}) {
  const { data: run, error: runError } = await supabase
    .from("obra_data_flow_runs")
    .insert({
      tenant_id: tenantId,
      obra_id: obraId,
      trigger,
      status: plan.blocked.length > 0 ? "completed_with_blocks" : "completed",
      triggered_by: actorUserId,
      summary: {
        ready: plan.actions.length,
        blocked: plan.blocked.length,
        appliedFields,
      },
    })
    .select("id")
    .single();

  if (runError) {
    if (isMissingTableError(runError)) throw missingWritebackMigrationError();
    throw runError;
  }

  const runId = (run as { id: string }).id;
  const suggestionRows = plan.actions
    .filter((action) => action.mode === "suggest")
    .map((action) => ({
      tenant_id: tenantId,
      obra_id: obraId,
      run_id: runId,
      result_id: action.resultId,
      result_label: action.resultLabel,
      calculation_id: action.calculationId,
      field_id: action.targetObraFieldId,
      old_value: action.previousValue,
      suggested_value: action.value,
      formatted_value: action.formattedValue,
      formula_summary: action.formulaSummary,
      status: "pending",
    }));

  if (suggestionRows.length > 0) {
    const { data: pendingSuggestions, error: pendingError } = await supabase
      .from("obra_data_flow_suggestions")
      .select("result_id, field_id, suggested_value")
      .eq("tenant_id", tenantId)
      .eq("obra_id", obraId)
      .eq("status", "pending");

    if (pendingError) {
      if (isMissingTableError(pendingError)) throw missingWritebackMigrationError();
      throw pendingError;
    }

    const newSuggestionRows = suggestionRows.filter((row) => {
      return !(pendingSuggestions ?? []).some((pending) => {
        return (
          pending.result_id === row.result_id &&
          pending.field_id === row.field_id &&
          isSameSuggestionValue(pending.suggested_value, row.suggested_value)
        );
      });
    });

    if (newSuggestionRows.length > 0) {
      const { error } = await supabase.from("obra_data_flow_suggestions").insert(newSuggestionRows);
      if (error) {
        if (isMissingTableError(error)) throw missingWritebackMigrationError();
        throw error;
      }
    }
  }

  const auditRows = [
    ...plan.actions
      .filter((action) => action.mode === "auto" && appliedFields.includes(action.targetObraFieldId))
      .map((action) => ({
        tenant_id: tenantId,
        obra_id: obraId,
        run_id: runId,
        result_id: action.resultId,
        result_label: action.resultLabel,
        field_id: action.targetObraFieldId,
        old_value: action.previousValue,
        new_value: action.value,
        mode: "auto",
        status: "applied",
        reason: null,
        formula_summary: action.formulaSummary,
      })),
    ...plan.blocked.map((action) => ({
      tenant_id: tenantId,
      obra_id: obraId,
      run_id: runId,
      result_id: action.resultId,
      result_label: action.resultLabel,
      field_id: action.targetObraFieldId,
      old_value: action.previousValue,
      new_value: action.value,
      mode: action.mode,
      status: "blocked",
      reason: action.blockReason,
      formula_summary: action.formulaSummary,
    })),
  ];

  if (auditRows.length > 0) {
    const { error } = await supabase.from("obra_data_flow_writeback_audit").insert(auditRows);
    if (error) {
      if (isMissingTableError(error)) throw missingWritebackMigrationError();
      throw error;
    }
  }

  return runId;
}
