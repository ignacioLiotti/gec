import { describe, expect, it } from "vitest";

import {
  buildMacroSourceSelectionSettings,
  extractMacroTemplateBaseName,
  resolveMacroSourceTablas,
} from "@/lib/macro-table-source-selection";

describe("macro table source selection", () => {
  it("extracts the base table name from obra-specific labels", () => {
    expect(extractMacroTemplateBaseName("Certificados · Mano de obra")).toBe("Mano de obra");
    expect(extractMacroTemplateBaseName("Obra Norte - Materiales")).toBe("Materiales");
  });

  it("infers template mode for legacy macrotables built from one default tabla", () => {
    const settings = buildMacroSourceSelectionSettings(
      {},
      [
        { id: "t1", name: "Obra 1 · Certificado A", defaultTablaId: "template-1" },
        { id: "t2", name: "Obra 2 · Certificado A", defaultTablaId: "template-1" },
      ]
    );

    expect(settings.sourceMode).toBe("template");
    expect(settings.sourceTemplateId).toBe("template-1");
    expect(settings.sourceTemplateTableNames).toEqual(["Certificado A"]);
  });

  it("keeps manual mode when sources come from different templates", () => {
    const settings = buildMacroSourceSelectionSettings(
      {},
      [
        { id: "t1", name: "Obra 1 · Certificado A", defaultTablaId: "template-1" },
        { id: "t2", name: "Obra 2 · Materiales", defaultTablaId: "template-2" },
      ]
    );

    expect(settings.sourceMode).toBe("manual");
    expect(settings.sourceTemplateId).toBeNull();
  });

  it("adds future obra tablas when template mode is active", () => {
    const explicitSourceTablas = [
      { id: "t1", name: "Obra 1 · Certificado A", defaultTablaId: "template-1" },
    ];
    const candidateTablas = [
      { id: "t1", name: "Obra 1 · Certificado A", defaultTablaId: "template-1" },
      { id: "t2", name: "Obra 2 · Certificado A", defaultTablaId: "template-1" },
      { id: "t3", name: "Obra 2 · Materiales", defaultTablaId: "template-2" },
    ];

    const resolved = resolveMacroSourceTablas({
      settings: {
        sourceMode: "template",
        sourceTemplateId: "template-1",
        sourceTemplateTableNames: ["Certificado A"],
      },
      explicitSourceTablas,
      candidateTablas,
    });

    expect(resolved.map((tabla) => tabla.id)).toEqual(["t1", "t2"]);
  });
});
