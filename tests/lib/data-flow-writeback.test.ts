import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { persistDataFlowWritebackRun } from "@/lib/data-flow-writeback";

function createWritebackSupabaseMock(existingSuggestions: Array<Record<string, unknown>>) {
  const insertedSuggestions: Array<Record<string, unknown>> = [];

  return {
    insertedSuggestions,
    supabase: {
      from(tableName: string) {
        const builder = {
          insert(rows: unknown) {
            if (tableName === "obra_data_flow_suggestions") {
              insertedSuggestions.push(...(Array.isArray(rows) ? rows : [rows]) as Array<Record<string, unknown>>);
            }
            return builder;
          },
          select() {
            return builder;
          },
          single() {
            return Promise.resolve({ data: { id: "run-1" }, error: null });
          },
          eq() {
            return builder;
          },
          then(resolve: (value: unknown) => void) {
            if (tableName === "obra_data_flow_suggestions") {
              resolve({ data: existingSuggestions, error: null });
              return Promise.resolve();
            }
            resolve({ data: [], error: null });
            return Promise.resolve();
          },
        };
        return builder;
      },
    },
  };
}

describe("data-flow writeback", () => {
  it("does not insert duplicate pending suggestions for the same result, field and value", async () => {
    const mock = createWritebackSupabaseMock([
      {
        result_id: "default_result_certified",
        field_id: "certificado_a_la_fecha",
        suggested_value: 127_546_532.65,
      },
    ]);

    await persistDataFlowWritebackRun({
      supabase: mock.supabase as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      actorUserId: "user-1",
      trigger: "manual_recompute",
      appliedFields: [],
      plan: {
        blocked: [],
        actions: [
          {
            resultId: "default_result_certified",
            resultLabel: "Certificado",
            calculationId: "default_certified",
            targetObraFieldId: "certificado_a_la_fecha",
            mode: "suggest",
            value: 127_546_532.65,
            formattedValue: "$ 127.546.532,65",
            previousValue: 118_716_242.08,
            status: "ready",
            blockReason: null,
            formulaSummary: ["latest(table:preset:pmc_resumen.monto_acumulado)"],
          },
        ],
      },
    });

    expect(mock.insertedSuggestions).toHaveLength(0);
  });
});
