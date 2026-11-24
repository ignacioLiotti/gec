import { afterEach, describe, expect, it, vi } from "vitest";

import {
  compactSpecForModel,
  restoreCompactedOptions,
  runTemplateAssistant,
} from "@/lib/document-template-assistant";
import { compileTemplateSpec, EXAMPLE_TEMPLATE_SPEC, validateTemplateSpec, type TemplateSpec } from "@/lib/document-template-spec";

const longList = Array.from({ length: 120 }, (_, index) => `Material ${index + 1}`);

function specWithLongList(): TemplateSpec {
  return {
    version: 1,
    name: "OC",
    documentType: "OC",
    sections: [
      { kind: "header" },
      { kind: "table", key: "items", title: "Ítems", columns: [{ key: "detalle", label: "Detalle", type: "select", options: longList }] },
    ],
  };
}

function modelReply(body: unknown, tokens = 100) {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(body) }] }],
      usage: { input_tokens: tokens, output_tokens: tokens, total_tokens: tokens * 2 },
    }),
    { status: 200 },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("template assistant", () => {
  it("sends long option lists as a marker and restores them afterwards", () => {
    const { spec, stash } = compactSpecForModel(specWithLongList());
    const table = spec.sections[1];
    if (table.kind !== "table") throw new Error("fixture");
    expect(table.columns[0].options?.[0]).toBe("__KEEP_OPTIONS__:120");
    expect(table.columns[0].options).toHaveLength(6);

    const restored = restoreCompactedOptions(structuredClone(spec), stash);
    const restoredTable = restored.sections[1];
    if (restoredTable.kind !== "table") throw new Error("fixture");
    expect(restoredTable.columns[0].options).toEqual(longList);
  });

  it("feeds validation errors back to the model until the spec is valid", async () => {
    const broken = structuredClone(EXAMPLE_TEMPLATE_SPEC) as TemplateSpec;
    const table = broken.sections[2];
    if (table.kind !== "table") throw new Error("fixture");
    table.columns[4] = { ...table.columns[4], formula: "[cantidad] * [precio]" };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelReply({ reply: "Listo", changes: ["+ Total"], spec: broken }))
      .mockResolvedValueOnce(modelReply({ reply: "Agregué **Total**.", changes: ["+ Total"], spec: EXAMPLE_TEMPLATE_SPEC }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runTemplateAssistant({
      apiKey: "test",
      spec: EXAMPLE_TEMPLATE_SPEC,
      messages: [{ role: "user", content: "Agregá el total" }],
      catalog: [
        { key: "usuarios", label: "Usuarios", group: "app", description: "", display: "nombre", requiresWork: false, attributes: [{ key: "nombre", label: "Nombre" }, { key: "email", label: "Email" }] },
        { key: "documento:PURCHASE_ORDER", label: "OC", group: "documento", description: "", display: "label", requiresWork: true, attributes: [{ key: "label", label: "Documento" }, { key: "proveedor", label: "Proveedor" }, { key: "items", label: "Ítems", type: "rows", columns: [{ key: "descripcion", label: "Descripción" }, { key: "cantidad", label: "Cantidad" }, { key: "precio_unitario", label: "Precio" }] }] },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
    expect(result.reply).toBe("Agregué **Total**.");
    expect(result.usage.totalTokens).toBe(400);
    const retryInput = JSON.parse(fetchMock.mock.calls[1][1].body).input;
    expect(JSON.stringify(retryInput.at(-1))).toContain("sections[2].columns[4].formula");
  });

  it("returns no spec when the model asks a question", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelReply({ reply: "¿Qué columnas querés sumar?", changes: [], spec: null })));
    const result = await runTemplateAssistant({ apiKey: "test", spec: specWithLongList(), messages: [{ role: "user", content: "Sumá" }], catalog: [] });
    expect(result).toMatchObject({ ok: true, spec: null, reply: "¿Qué columnas querés sumar?" });
  });
});

describe("spec style and width", () => {
  it("validates the accent color and the width option", () => {
    const spec = { ...structuredClone(EXAMPLE_TEMPLATE_SPEC), style: { accent: "blue" } } as TemplateSpec;
    expect(validateTemplateSpec(spec).errors.map((issue) => issue.path)).toContain("style.accent");
    const fields = spec.sections[1];
    if (fields.kind !== "fields") throw new Error("fixture");
    fields.fields[0] = { ...fields.fields[0], width: "half" as "full" };
    expect(validateTemplateSpec(spec).errors.map((issue) => issue.path)).toContain("sections[1].fields[0].width");
  });

  it("prints the accent and full-width fields in the layout", () => {
    const spec = structuredClone(EXAMPLE_TEMPLATE_SPEC) as TemplateSpec;
    spec.style = { accent: "#2563eb" };
    const fields = spec.sections[1];
    if (fields.kind !== "fields") throw new Error("fixture");
    fields.fields[0] = { ...fields.fields[0], width: "full" };
    const html = compileTemplateSpec(spec).contentHtml;
    expect(html).toContain('class="dg-doc" style="--dg-accent:#2563eb"');
    expect(html).toMatch(/class="dg-line full" data-k="f:[a-z_]+"/);
    expect(compileTemplateSpec(EXAMPLE_TEMPLATE_SPEC).contentHtml).toContain('<div class="dg-doc">');
  });

  it("pairs half sections into rows and stacks a leftover under the left cell", () => {
    const spec: TemplateSpec = {
      version: 1,
      name: "OC",
      documentType: "OC",
      sections: [
        { kind: "header", issuer: "GEC SA\nCruz del Sud 2800" },
        { kind: "fields", title: "Entrega", width: "half", fields: [{ key: "retira", label: "Retira", type: "text" }] },
        { kind: "totals", width: "half", fields: [{ key: "total", label: "Total", type: "number", emphasis: true }] },
        { kind: "signatures", width: "half", labels: ["Conformidad"] },
      ],
    };
    const html = compileTemplateSpec(spec).contentHtml;
    expect(html).toContain('<span class="dg-brand-name">GEC SA</span>');
    expect(html.match(/class="dg-row"/g)).toHaveLength(1);
    const left = html.slice(html.indexOf('<div class="dg-cell">'), html.lastIndexOf('<div class="dg-cell">'));
    expect(left).toContain('data-k="fields:Entrega"');
    expect(left).toContain('data-k="signatures"');
    expect(html).toContain('class="dg-trow em"');
  });
});
