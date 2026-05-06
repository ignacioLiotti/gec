import { describe, expect, it } from "vitest";

import {
  buildObraResultWritebackPlan,
  buildObraResultWritebackPatch,
  DEFAULT_OBRA_FIELD_SOURCES,
  listObraFieldSourcesFromCustomData,
  resolveObraFieldValue,
} from "@/lib/data-flow-builder";

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
});
