import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { persistDataFlowWritebackRun } from "@/lib/data-flow-writeback";

type PersistRunInput = Parameters<typeof persistDataFlowWritebackRun>[0];
type StoredRow = Record<string, unknown>;

function isStoredRow(value: unknown): value is StoredRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStoredRows(value: unknown): StoredRow[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter(isStoredRow).map((row) => ({ ...row }));
}

function createWritebackSupabaseFake(seedSuggestions: StoredRow[] = []) {
  const runs: StoredRow[] = [];
  const suggestions = seedSuggestions.map((row) => ({ ...row }));

  return {
    runs,
    suggestions,
    supabase: {
      from(tableName: string) {
        const filters = new Map<string, unknown>();
        let operation: "read" | "insert" = "read";
        let insertedRunId: string | null = null;

        const builder = {
          insert(value: unknown) {
            operation = "insert";
            const rows = toStoredRows(value);
            if (tableName === "obra_data_flow_runs") {
              insertedRunId = `run-${runs.length + 1}`;
              runs.push(...rows.map((row) => ({ ...row, id: insertedRunId })));
            }
            if (tableName === "obra_data_flow_suggestions") {
              suggestions.push(...rows);
            }
            return builder;
          },
          select() {
            return builder;
          },
          single() {
            return Promise.resolve({
              data: insertedRunId ? { id: insertedRunId } : null,
              error: null,
            });
          },
          eq(column: string, value: unknown) {
            filters.set(column, value);
            return builder;
          },
          then(resolve: (value: { data: StoredRow[] | null; error: null }) => void) {
            if (tableName === "obra_data_flow_suggestions" && operation === "read") {
              const matchingSuggestions = suggestions.filter((row) =>
                [...filters].every(([column, value]) => row[column] === value),
              );
              resolve({ data: matchingSuggestions, error: null });
              return Promise.resolve();
            }
            resolve({ data: null, error: null });
            return Promise.resolve();
          },
        };

        return builder;
      },
    },
  };
}

function suggestionPlan(value: number): PersistRunInput["plan"] {
  return {
    blocked: [],
    actions: [
      {
        resultId: "default_result_certified",
        resultLabel: "Certificado",
        calculationId: "default_certified",
        targetObraFieldId: "certificado_a_la_fecha",
        mode: "suggest",
        value,
        formattedValue: `$ ${value}`,
        previousValue: 118_716_242.08,
        status: "ready",
        blockReason: null,
        formulaSummary: ["latest(table:preset:pmc_resumen.monto_acumulado)"],
      },
    ],
  };
}

async function persistSuggestion(
  fake: ReturnType<typeof createWritebackSupabaseFake>,
  {
    tenantId = "tenant-1",
    obraId,
    value,
  }: {
    tenantId?: string;
    obraId: string;
    value: number;
  },
) {
  return persistDataFlowWritebackRun({
    supabase: fake.supabase as unknown as SupabaseClient,
    tenantId,
    obraId,
    actorUserId: "user-1",
    trigger: "manual_recompute",
    appliedFields: [],
    plan: suggestionPlan(value),
  });
}

describe("data-flow writeback", () => {
  it("persists a new pending suggestion with its completed run", async () => {
    const fake = createWritebackSupabaseFake();

    await expect(
      persistSuggestion(fake, { obraId: "obra-1", value: 127_546_532.65 }),
    ).resolves.toBe("run-1");

    expect(fake.runs).toEqual([
      expect.objectContaining({
        id: "run-1",
        tenant_id: "tenant-1",
        obra_id: "obra-1",
        status: "completed",
        summary: { ready: 1, blocked: 0, appliedFields: [] },
      }),
    ]);
    expect(fake.suggestions).toEqual([
      expect.objectContaining({
        tenant_id: "tenant-1",
        obra_id: "obra-1",
        run_id: "run-1",
        result_id: "default_result_certified",
        field_id: "certificado_a_la_fecha",
        suggested_value: 127_546_532.65,
        status: "pending",
      }),
    ]);
  });

  it("deduplicates only an identical pending suggestion in the same work", async () => {
    const fake = createWritebackSupabaseFake();

    await persistSuggestion(fake, { obraId: "obra-1", value: 100 });
    await persistSuggestion(fake, { obraId: "obra-1", value: 100 });
    expect(fake.suggestions).toHaveLength(1);

    await persistSuggestion(fake, { obraId: "obra-1", value: 125 });
    await persistSuggestion(fake, { obraId: "obra-2", value: 100 });
    await persistSuggestion(fake, { tenantId: "tenant-2", obraId: "obra-1", value: 100 });
    expect(fake.suggestions).toEqual([
      expect.objectContaining({ obra_id: "obra-1", run_id: "run-1", suggested_value: 100 }),
      expect.objectContaining({ obra_id: "obra-1", run_id: "run-3", suggested_value: 125 }),
      expect.objectContaining({ obra_id: "obra-2", run_id: "run-4", suggested_value: 100 }),
      expect.objectContaining({
        tenant_id: "tenant-2",
        obra_id: "obra-1",
        run_id: "run-5",
        suggested_value: 100,
      }),
    ]);

    fake.suggestions[0].status = "accepted";
    await persistSuggestion(fake, { obraId: "obra-1", value: 100 });

    expect(fake.runs).toHaveLength(6);
    expect(fake.suggestions).toHaveLength(5);
    expect(fake.suggestions[4]).toEqual(
      expect.objectContaining({
        obra_id: "obra-1",
        run_id: "run-6",
        suggested_value: 100,
        status: "pending",
      }),
    );
  });
});
