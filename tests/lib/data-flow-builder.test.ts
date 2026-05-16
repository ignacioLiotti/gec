import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildObraResultWritebackPlan,
  buildObraResultWritebackPatch,
  evaluateObraDataFlowBuilder,
  getTenantDataFlowBuilderConfig,
  DEFAULT_OBRA_FIELD_SOURCES,
  listObraFieldSourcesFromCustomData,
  resolveObraFieldValue,
} from "@/lib/data-flow-builder";

function createEvaluationSupabaseMock(rows: Array<{ id: string; tabla_id: string; data: Record<string, unknown>; created_at: string | null }>) {
  const pmcTableId = "pmc-table";
  const obraTables = [
    {
      id: pmcTableId,
      name: "PMC Resumen",
      settings: {
        spreadsheetPresetKey: "pmc_resumen",
      },
    },
  ];

  return {
    from(tableName: string) {
      const state = { tableName, inValues: [] as string[] };
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        in(_column: string, values: string[]) {
          state.inValues = values;
          return builder;
        },
        then(resolve: (value: unknown) => void) {
          if (state.tableName === "obra_tablas") {
            resolve({ data: obraTables, error: null });
            return Promise.resolve();
          }
          if (state.tableName === "obra_tabla_rows") {
            resolve({
              data: rows.filter((row) => state.inValues.includes(row.tabla_id)),
              error: null,
            });
            return Promise.resolve();
          }
          if (state.tableName === "macro_table_sources") {
            resolve({ data: [], error: null });
            return Promise.resolve();
          }
          resolve({ data: [], error: null });
          return Promise.resolve();
        },
      };
      return builder;
    },
  };
}

describe("data-flow builder obra fields", () => {
  it("lists base obra fields plus configured and stored custom fields", () => {
    const sources = listObraFieldSourcesFromCustomData(
      {
        inspectorResponsable: "Ana",
        dataFlowBuilder: { version: 1 },
        customWithoutConfig: 12,
      },
      [
        {
          id: "custom:inspectorResponsable",
          label: "Inspector responsable",
          dataType: "text",
          source: "custom",
        },
      ]
    );

    expect(sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "n",
        "contrato_mas_ampliaciones",
        "porcentaje",
        "custom:inspectorResponsable",
        "custom:customWithoutConfig",
      ])
    );
    expect(sources.some((source) => source.id === "custom:dataFlowBuilder")).toBe(false);
    expect(sources.filter((source) => source.id === "custom:inspectorResponsable")).toHaveLength(1);
  });

  it("resolves base fields from the obra row and custom fields from custom_data", () => {
    const obraValues = {
      contrato_mas_ampliaciones: 1200,
      custom_data: {
        presupuestoExtra: 300,
      },
    };

    expect(resolveObraFieldValue(obraValues, "contrato_mas_ampliaciones")).toBe(1200);
    expect(resolveObraFieldValue(obraValues, "custom:presupuestoExtra")).toBe(300);
  });

  it("keeps the original default calculation fields available", () => {
    expect(DEFAULT_OBRA_FIELD_SOURCES.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "contrato_mas_ampliaciones",
        "certificado_a_la_fecha",
        "saldo_a_certificar",
        "porcentaje",
      ])
    );
  });

  it("migrates stored legacy default KPI definitions to the official certificate data-flow", () => {
    const config = getTenantDataFlowBuilderConfig({
      dataFlowBuilder: {
        version: 1,
        calculations: [
          {
            id: "default_certified",
            label: "Certificado legacy",
            mode: "formula",
            description: "",
            expression: "certificado",
            inputs: [
              {
                id: "legacy-input",
                alias: "certificado",
                sourceType: "obra_field",
                sourceId: "certificado_a_la_fecha",
                fieldKey: null,
                aggregation: null,
              },
            ],
          },
        ],
        results: [
          {
            id: "default_result_certified",
            label: "Certificado legacy",
            description: "",
            calculationId: "default_certified",
            targetObraFieldId: null,
            writebackMode: "none",
            format: "currency",
            decimals: 0,
            generalTabSlot: "financial",
            generalTabOrder: 3,
          },
        ],
        generalTabLayout: [],
      },
    });

    expect(config.calculations.find((calculation) => calculation.id === "default_certified")).toMatchObject({
      mode: "aggregate",
      sourceId: "preset:pmc_resumen",
      fieldKey: "monto_acumulado",
      aggregation: "latest",
      sortFieldKey: "fecha_certificacion",
    });
    expect(config.results.find((result) => result.id === "default_result_certified")).toMatchObject({
      targetObraFieldId: "certificado_a_la_fecha",
      writebackMode: "suggest",
    });
  });

  it("preserves explicit tenant overrides for default KPI ids", () => {
    const config = getTenantDataFlowBuilderConfig({
      dataFlowBuilder: {
        version: 1,
        calculations: [
          {
            id: "default_certified",
            label: "Certificado a la fecha",
            mode: "aggregate",
            description: "Override explicito",
            sourceType: "table",
            sourceId: "table-real",
            fieldKey: "periodo",
            aggregation: "latest",
            sortFieldKey: "fecha_certificacion",
          },
        ],
        results: [
          {
            id: "default_result_certified",
            label: "Certificado",
            description: "Override explicito",
            calculationId: "default_certified",
            targetObraFieldId: "certificado_a_la_fecha",
            writebackMode: "suggest",
            format: "currency",
            decimals: 0,
            generalTabSlot: "financial",
            generalTabOrder: 3,
          },
        ],
        generalTabLayout: [],
      },
    });

    expect(config.calculations.find((calculation) => calculation.id === "default_certified")).toMatchObject({
      mode: "aggregate",
      sourceId: "table-real",
      fieldKey: "periodo",
      aggregation: "latest",
      sortFieldKey: "fecha_certificacion",
    });
  });

  it("allows local config to delete inherited builder calculations and results", () => {
    const config = getTenantDataFlowBuilderConfig({
      dataFlowBuilder: {
        version: 1,
        calculations: [
          {
            id: "default_progress",
            label: "Porcentaje de avance",
            mode: "formula",
            description: "",
            deleted: true,
            expression: "",
            inputs: [],
          },
        ],
        results: [
          {
            id: "default_result_progress",
            label: "Avance",
            description: "",
            deleted: true,
            calculationId: "default_progress",
            targetObraFieldId: "porcentaje",
            writebackMode: "suggest",
            format: "percent",
            decimals: 0,
            generalTabSlot: "hero",
            generalTabOrder: 1,
          },
        ],
        generalTabLayout: [],
      },
    });

    expect(config.calculations.some((calculation) => calculation.id === "default_progress")).toBe(false);
    expect(config.results.some((result) => result.id === "default_result_progress")).toBe(false);
  });

  it("builds writeback patches for base and custom obra fields", () => {
    const config = {
      version: 1 as const,
      calculations: [],
      results: [
        {
          id: "base-result",
          label: "Avance recalculado",
          description: "",
          calculationId: "calc-1",
          targetObraFieldId: "porcentaje",
          writebackMode: "auto" as const,
          format: "percent" as const,
          decimals: 0,
          generalTabSlot: "hero" as const,
          generalTabOrder: 1,
        },
        {
          id: "custom-result",
          label: "Presupuesto result",
          description: "",
          calculationId: "calc-2",
          targetObraFieldId: "custom:presupuesto",
          writebackMode: "auto" as const,
          format: "currency" as const,
          decimals: 0,
          generalTabSlot: "financial" as const,
          generalTabOrder: 2,
        },
      ],
      generalTabLayout: [],
    };
    const obraValues = {
      porcentaje: 10,
      custom_data: {
        dataFlowBuilder: { version: 1 },
        presupuesto: 100,
      },
    };
    const plan = buildObraResultWritebackPlan({
      config,
      obraValues,
      evaluated: {
        calculations: [],
        results: [
          {
            id: "base-result",
            label: "Avance recalculado",
            status: "ok",
            value: 70,
            formattedValue: "70%",
            description: "",
            calculationId: "calc-1",
            targetObraFieldId: "porcentaje",
            writebackMode: "auto",
            writebackStatus: "ready",
            writebackBlockReason: null,
            generalTabSlot: "hero",
            generalTabOrder: 1,
            format: "percent",
          },
          {
            id: "custom-result",
            label: "Presupuesto result",
            status: "ok",
            value: 1300,
            formattedValue: "$ 1.300",
            description: "",
            calculationId: "calc-2",
            targetObraFieldId: "custom:presupuesto",
            writebackMode: "auto",
            writebackStatus: "ready",
            writebackBlockReason: null,
            generalTabSlot: "financial",
            generalTabOrder: 2,
            format: "currency",
          },
        ],
      },
    });
    const writeback = buildObraResultWritebackPatch({
      plan,
      customData: obraValues.custom_data,
    });

    expect(writeback.obraPatch).toEqual({ porcentaje: 70 });
    expect(writeback.customData).toMatchObject({
      dataFlowBuilder: { version: 1 },
      presupuesto: 1300,
    });
    expect(writeback.writtenFields).toEqual(["porcentaje", "custom:presupuesto"]);
  });

  it("blocks writeback when a result depends on the same obra field", () => {
    const config = {
      version: 1 as const,
      calculations: [
        {
          id: "calc-self",
          label: "Contrato total",
          mode: "formula" as const,
          description: "",
          expression: "contrato + ampliaciones",
          inputs: [
            {
              id: "input-1",
              alias: "contrato",
              sourceType: "obra_field" as const,
              sourceId: "contrato_mas_ampliaciones",
              fieldKey: null,
              aggregation: null,
            },
          ],
        },
      ],
      results: [
        {
          id: "result-self",
          label: "Contrato result",
          description: "",
          calculationId: "calc-self",
          targetObraFieldId: "contrato_mas_ampliaciones",
          writebackMode: "auto" as const,
          format: "currency" as const,
          decimals: 0,
          generalTabSlot: "financial" as const,
          generalTabOrder: 1,
        },
      ],
      generalTabLayout: [],
    };

    const plan = buildObraResultWritebackPlan({
      config,
      obraValues: { contrato_mas_ampliaciones: 100 },
      evaluated: {
        calculations: [
          {
            id: "calc-self",
            label: "Contrato total",
            status: "ok",
            value: 200,
            formattedValue: "200",
            formulaSummary: ["contrato + ampliaciones"],
            inputs: ["obra_field:contrato_mas_ampliaciones"],
            errorMessage: null,
          },
        ],
        results: [
          {
            id: "result-self",
            label: "Contrato result",
            status: "ok",
            value: 200,
            formattedValue: "$ 200",
            description: "",
            calculationId: "calc-self",
            targetObraFieldId: "contrato_mas_ampliaciones",
            writebackMode: "auto",
            writebackStatus: "ready",
            writebackBlockReason: null,
            generalTabSlot: "financial",
            generalTabOrder: 1,
            format: "currency",
          },
        ],
      },
    });

    expect(plan.actions).toHaveLength(0);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]?.blockReason).toContain("mismo campo");
  });

  it("resolves latest certificate by fecha_certificacion and ignores null accumulated amounts", async () => {
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([
        {
          id: "row-1",
          tabla_id: "pmc-table",
          created_at: "2026-04-01T00:00:00.000Z",
          data: { fecha_certificacion: "31/03/2026", monto_acumulado: null },
        },
        {
          id: "row-2",
          tabla_id: "pmc-table",
          created_at: "2026-02-01T00:00:00.000Z",
          data: { fecha_certificacion: "28/02/2026", monto_acumulado: 200 },
        },
        {
          id: "row-3",
          tabla_id: "pmc-table",
          created_at: "2026-01-01T00:00:00.000Z",
          data: { fecha_certificacion: "31/03/2026", monto_acumulado: 300 },
        },
      ]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      config: getTenantDataFlowBuilderConfig(null),
      obraValues: { contrato_mas_ampliaciones: 1000 },
    });

    expect(evaluated.calculations.find((calculation) => calculation.id === "default_certified")?.value).toBe(300);
  });

  it("uses periodo MM/YYYY before falling back to created_at for latest certificates", async () => {
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([
        {
          id: "row-1",
          tabla_id: "pmc-table",
          created_at: "2026-05-01T00:00:00.000Z",
          data: { periodo: "01/2026", monto_acumulado: 100 },
        },
        {
          id: "row-2",
          tabla_id: "pmc-table",
          created_at: "2026-01-01T00:00:00.000Z",
          data: { periodo: "03/2026", monto_acumulado: 300 },
        },
      ]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      config: getTenantDataFlowBuilderConfig(null),
      obraValues: { contrato_mas_ampliaciones: 1000 },
    });

    expect(evaluated.calculations.find((calculation) => calculation.id === "default_certified")?.value).toBe(300);
  });

  it("falls back to created_at when business date fields are absent", async () => {
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([
        {
          id: "row-1",
          tabla_id: "pmc-table",
          created_at: "2026-01-01T00:00:00.000Z",
          data: { monto_acumulado: 100 },
        },
        {
          id: "row-2",
          tabla_id: "pmc-table",
          created_at: "2026-03-01T00:00:00.000Z",
          data: { monto_acumulado: 300 },
        },
      ]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      config: getTenantDataFlowBuilderConfig(null),
      obraValues: { contrato_mas_ampliaciones: 1000 },
    });

    expect(evaluated.calculations.find((calculation) => calculation.id === "default_certified")?.value).toBe(300);
  });

  it("calculates official certificate suggestions for obra 80 values without duplicating current field dependencies", async () => {
    const config = getTenantDataFlowBuilderConfig(null);
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([
        {
          id: "row-8",
          tabla_id: "pmc-table",
          created_at: "2026-04-02T00:00:00.000Z",
          data: {
            periodo: "03/2026",
            fecha_certificacion: "31/03/2026",
            monto_acumulado: 127_546_532.65,
          },
        },
      ]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "80",
      config,
      obraValues: {
        contrato_mas_ampliaciones: 173_892_254.4,
        certificado_a_la_fecha: 118_716_242.08,
        saldo_a_certificar: 55_176_012.32,
        porcentaje: 68.27,
      },
    });
    const plan = buildObraResultWritebackPlan({
      config,
      evaluated,
      obraValues: {
        contrato_mas_ampliaciones: 173_892_254.4,
        certificado_a_la_fecha: 118_716_242.08,
        saldo_a_certificar: 55_176_012.32,
        porcentaje: 68.27,
      },
    });

    expect(evaluated.calculations.find((calculation) => calculation.id === "default_certified")?.value).toBe(127_546_532.65);
    expect(evaluated.calculations.find((calculation) => calculation.id === "default_balance")?.value).toBeCloseTo(46_345_721.75, 2);
    expect(evaluated.calculations.find((calculation) => calculation.id === "default_progress")?.value).toBeCloseTo(73.35, 2);
    expect(plan.actions.map((action) => action.targetObraFieldId).sort()).toEqual([
      "certificado_a_la_fecha",
      "porcentaje",
      "saldo_a_certificar",
    ]);
    expect(plan.actions.every((action) => action.mode === "suggest")).toBe(true);
  });

  it("blocks percentage suggestion when contract is invalid", async () => {
    const config = getTenantDataFlowBuilderConfig(null);
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([
        {
          id: "row-1",
          tabla_id: "pmc-table",
          created_at: "2026-01-01T00:00:00.000Z",
          data: { periodo: "01/2026", monto_acumulado: 300 },
        },
      ]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      config,
      obraValues: {
        contrato_mas_ampliaciones: 0,
        certificado_a_la_fecha: 0,
        saldo_a_certificar: 0,
        porcentaje: 0,
      },
    });

    expect(evaluated.results.find((result) => result.targetObraFieldId === "porcentaje")?.status).toBe("incomplete");
    expect(evaluated.results.find((result) => result.targetObraFieldId === "porcentaje")?.writebackStatus).toBe("blocked");
  });

  it("evaluates text template results from obra fields and can suggest text writeback", async () => {
    const config = getTenantDataFlowBuilderConfig({
      dataFlowBuilder: {
        version: 1,
        calculations: [
          {
            id: "calc_entidad_boquita",
            label: "Entidad + Boquita",
            mode: "text_template",
            description: "Concatena entidad contratante con un texto fijo.",
            template: "{entidad} Boquita",
            inputs: [
              {
                id: "input_entidad",
                alias: "entidad",
                sourceType: "obra_field",
                sourceId: "entidad_contratante",
                fieldKey: null,
                aggregation: null,
              },
            ],
          },
        ],
        results: [
          {
            id: "result_entidad_boquita",
            label: "Entidad + Boquita",
            description: "",
            calculationId: "calc_entidad_boquita",
            targetObraFieldId: "designacion_y_ubicacion",
            writebackMode: "suggest",
            format: "text",
            decimals: 0,
            generalTabSlot: "financial",
            generalTabOrder: 10,
          },
        ],
        generalTabLayout: [],
      },
    });
    const obraValues = {
      entidad_contratante: "IN.VI.CO",
      designacion_y_ubicacion: "Original",
    };
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      config,
      obraValues,
    });
    const plan = buildObraResultWritebackPlan({ config, evaluated, obraValues });

    expect(evaluated.calculations.find((calculation) => calculation.id === "calc_entidad_boquita")?.value).toBe("IN.VI.CO Boquita");
    expect(evaluated.results.find((result) => result.id === "result_entidad_boquita")?.formattedValue).toBe("IN.VI.CO Boquita");
    expect(plan.actions).toMatchObject([
      {
        targetObraFieldId: "designacion_y_ubicacion",
        value: "IN.VI.CO Boquita",
        mode: "suggest",
      },
    ]);
  });

  it("allows suggested text writeback to the same field used by its template", async () => {
    const config = getTenantDataFlowBuilderConfig({
      dataFlowBuilder: {
        version: 1,
        calculations: [
          {
            id: "calc_entidad_boquita",
            label: "Entidad + Boquita",
            mode: "text_template",
            description: "",
            template: "{entidad} Boquita",
            inputs: [
              {
                id: "input_entidad",
                alias: "entidad",
                sourceType: "obra_field",
                sourceId: "entidad_contratante",
                fieldKey: null,
                aggregation: null,
              },
            ],
          },
        ],
        results: [
          {
            id: "result_entidad_boquita",
            label: "Entidad + Boquita",
            description: "",
            calculationId: "calc_entidad_boquita",
            targetObraFieldId: "entidad_contratante",
            writebackMode: "suggest",
            format: "text",
            decimals: 0,
            generalTabSlot: "financial",
            generalTabOrder: 10,
          },
        ],
        generalTabLayout: [],
      },
    });
    const obraValues = { entidad_contratante: "IN.VI.CO" };
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      config,
      obraValues,
    });
    const plan = buildObraResultWritebackPlan({ config, evaluated, obraValues });

    expect(plan.actions).toMatchObject([
      {
        targetObraFieldId: "entidad_contratante",
        value: "IN.VI.CO Boquita",
        mode: "suggest",
      },
    ]);
    expect(plan.blocked).toHaveLength(0);
  });

  it("formats text template results as text even if the result was left as number", async () => {
    const config = getTenantDataFlowBuilderConfig({
      dataFlowBuilder: {
        version: 1,
        calculations: [
          {
            id: "calc_entidad_boquita",
            label: "Entidad + Boquita",
            mode: "text_template",
            description: "",
            template: "{entidad} Boquita",
            inputs: [
              {
                id: "input_entidad",
                alias: "entidad",
                sourceType: "obra_field",
                sourceId: "entidad_contratante",
                fieldKey: null,
                aggregation: null,
              },
            ],
          },
        ],
        results: [
          {
            id: "result_entidad_boquita",
            label: "Entidad + Boquita",
            description: "",
            calculationId: "calc_entidad_boquita",
            targetObraFieldId: "entidad_contratante",
            writebackMode: "suggest",
            format: "number",
            decimals: 0,
            generalTabSlot: "financial",
            generalTabOrder: 10,
          },
        ],
        generalTabLayout: [],
      },
    });
    const obraValues = { entidad_contratante: "IN.VI.CO" };
    const evaluated = await evaluateObraDataFlowBuilder({
      supabase: createEvaluationSupabaseMock([]) as unknown as SupabaseClient,
      tenantId: "tenant-1",
      obraId: "obra-1",
      config,
      obraValues,
    });
    const result = evaluated.results.find((candidate) => candidate.id === "result_entidad_boquita");
    const plan = buildObraResultWritebackPlan({ config, evaluated, obraValues });

    expect(result?.formattedValue).toBe("IN.VI.CO Boquita");
    expect(result?.format).toBe("text");
    expect(plan.actions).toHaveLength(1);
  });
});
