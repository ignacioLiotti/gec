import { describe, expect, it } from "vitest";

import {
  createBlankSpec,
  createSection,
  diffSpecs,
  insertSection,
  isBlankSpec,
  renameFieldKey,
  selectionFromIssuePath,
} from "@/app/document-generation/builder/spec-editing";
import { EXAMPLE_TEMPLATE_SPEC, validateTemplateSpec, type TemplateSpec } from "@/lib/document-template-spec";

function example(): TemplateSpec {
  return structuredClone(EXAMPLE_TEMPLATE_SPEC);
}

describe("template builder spec editing", () => {
  it("renames a column inside row formulas and table aggregates", () => {
    const tableIndex = example().sections.findIndex((section) => section.kind === "table");
    const spec = renameFieldKey(example(), tableIndex, 4, "importe");
    const table = spec.sections[tableIndex];
    const totals = spec.sections.find((section) => section.kind === "totals");
    if (table.kind !== "table" || totals?.kind !== "totals") throw new Error("fixture");
    expect(table.columns[4].key).toBe("importe");
    expect(totals.fields[0].formula).toBe("SUMA(items.importe)");
    expect(validateTemplateSpec(spec).errors).toEqual([]);
  });

  it("renames a document field in formulas, lookups and copy targets", () => {
    const base = example();
    const fieldsIndex = base.sections.findIndex((section) => section.kind === "fields");
    const fields = base.sections[fieldsIndex];
    if (fields.kind !== "fields") throw new Error("fixture");
    const responsable = fields.fields.findIndex((field) => field.key === "responsable");
    const proveedor = fields.fields.findIndex((field) => field.key === "proveedor");

    let spec = renameFieldKey(base, fieldsIndex, responsable, "recibio");
    spec = renameFieldKey(spec, fieldsIndex, proveedor, "proveedor_nombre");
    const renamed = spec.sections[fieldsIndex];
    if (renamed.kind !== "fields") throw new Error("fixture");
    expect(renamed.fields.find((field) => field.key === "responsable_email")?.lookup?.from).toBe("recibio");
    expect(renamed.fields[0].reference?.copy?.[0]).toEqual({ from: "proveedor", to: "proveedor_nombre" });
    expect(validateTemplateSpec(spec).errors).toEqual([]);
  });

  it("keeps signatures last and the header first when inserting blocks", () => {
    let spec = createBlankSpec();
    spec = insertSection(spec, createSection("table", spec), null);
    spec = insertSection(spec, createSection("totals", spec), null);
    spec = insertSection(spec, { kind: "header", title: "Otro" }, 2);
    expect(spec.sections.map((section) => section.kind)).toEqual(["header", "header", "fields", "table", "totals", "signatures"]);
    const totals = spec.sections[4];
    expect(totals.kind === "totals" && totals.fields[0].formula).toBe("SUMA(items.precio_total)");
  });

  it("maps validation paths to builder selections", () => {
    expect(selectionFromIssuePath("sections[2].columns[4].formula")).toEqual({ section: 2, field: 4 });
    expect(selectionFromIssuePath("sections[0].fields(default)[1].key")).toEqual({ section: 0, field: 1 });
    expect(selectionFromIssuePath("sections[3].labels")).toEqual({ section: 3 });
    expect(selectionFromIssuePath("name")).toBeNull();
  });
});

describe("assistant diffs", () => {
  it("reports added fields in order and changed ones, keeping section identity when sections shift", () => {
    const before: TemplateSpec = {
      version: 1,
      name: "F",
      documentType: "F",
      sections: [
        { kind: "header" },
        { kind: "fields", title: "Proveedor", fields: [{ key: "proveedor", label: "Proveedor", type: "text" }, { key: "cuit", label: "CUIT", type: "text" }] },
      ],
    };
    const after: TemplateSpec = {
      ...before,
      sections: [
        { kind: "header" },
        { kind: "fields", title: "Orden", fields: [{ key: "orden", label: "Orden", type: "text" }] },
        { kind: "fields", title: "Proveedor", fields: [{ key: "proveedor", label: "Proveedor", type: "text", width: "full" }, { key: "cuit", label: "CUIT", type: "text" }] },
      ],
    };
    const diff = diffSpecs(before, after);
    expect(diff.added).toEqual(["s:fields:Orden", "f:orden"]);
    expect([...diff.changed]).toEqual(["f:proveedor"]);
  });

  it("treats a spec with only header and signatures as blank", () => {
    expect(isBlankSpec(createBlankSpec())).toBe(true);
  });
});
