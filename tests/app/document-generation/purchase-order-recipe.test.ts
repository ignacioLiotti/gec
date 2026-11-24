import { describe, expect, it } from "vitest";
import {
  applyPurchaseOrderSettings,
  exportPurchaseOrderSettings,
  updatePurchaseOrderLogo,
} from "@/app/document-generation/purchase-order-recipe";
import { applyTemplateFormulaInputData, buildInitialInputData, type TemplateField } from "@/lib/document-generation";

const fields: TemplateField[] = [
  { key: "retira", label: "Retira", type: "text", required: false, source: "extra" },
  { key: "subtotal", label: "Subtotal", type: "money", required: false, source: "extra" },
  { key: "recargo_porcentaje", label: "Recargo", type: "number", required: false, source: "extra" },
  { key: "recargo", label: "Importe del recargo", type: "money", required: false, source: "extra" },
  { key: "total_orden", label: "Total", type: "money", required: false, source: "extra" },
  { key: "bonificacion_porcentaje", label: "Bonificación", type: "number", required: false, source: "extra" },
  { key: "bonificacion", label: "Importe de la bonificación", type: "money", required: false, source: "extra" },
  { key: "total_a_pagar", label: "Total a pagar", type: "money", required: false, source: "extra" },
  {
    key: "items", label: "Ítems", type: "table", required: true, source: "extra",
    columns: [
      { key: "cantidad", label: "Cantidad", type: "number", required: true, source: "extra" },
      { key: "precio_unitario", label: "Precio unitario", type: "money", required: true, source: "extra" },
    ],
  },
];
const template = { fields, contentHtml: "<body><p>Orden</p></body>" };

describe("purchase order recipe", () => {
  it("applies validated adjustments to the real field schema and preserves unrelated fields", () => {
    const config = exportPurchaseOrderSettings(template);
    const adjusted = applyPurchaseOrderSettings(template, {
      ...config,
      recargoPredeterminadoPct: 0,
      camposObligatorios: { retira: true },
    });
    const schema = { fields: adjusted };
    const data = applyTemplateFormulaInputData(schema, buildInitialInputData(schema, { items: [{ cantidad: 2, precio_unitario: 50 }] }));
    expect(adjusted[0]?.required).toBe(true);
    expect(adjusted.at(-1)).toEqual(fields.at(-1));
    expect(data.recargo_porcentaje).toBe(0);
    expect(data.total_orden).toBe(100);
    expect(fields[0]?.required).toBe(false);
  });

  it("rejects references to missing fields and unsafe values before applying the change", () => {
    expect(() => applyPurchaseOrderSettings(template, { version: 1, camposObligatorios: { error: true } })).toThrow();
    expect(() => applyPurchaseOrderSettings(template, { version: 1, recargoPredeterminadoPct: -5 })).toThrow();
    expect(() => updatePurchaseOrderLogo(template.contentHtml, "https://example.org/logo")).toThrow();
  });

  it("replaces and removes the additional logo without changing the original layout", () => {
    const updated = updatePurchaseOrderLogo(template.contentHtml, "data:image/png;base64,QQ==");
    const replaced = updatePurchaseOrderLogo(updated, "data:image/png;base64,Qg==");
    expect(replaced).not.toContain("QQ==");
    expect(replaced).toContain("Qg==");
    expect(updatePurchaseOrderLogo(replaced, null)).toBe(template.contentHtml);
  });
});
