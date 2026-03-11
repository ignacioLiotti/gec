import { describe, expect, it } from "vitest";

import {
  buildSpreadsheetPreviewInsight,
  buildSpreadsheetPreviewSummary,
  resolveSpreadsheetSectionType,
} from "@/lib/spreadsheet-preview-summary";

describe("spreadsheet preview summary helpers", () => {
  it("detects section types from known field keys", () => {
    expect(
      resolveSpreadsheetSectionType({
        fieldKeys: ["periodo", "monto_certificado", "avance_fisico_acumulado_pct"],
      })
    ).toBe("pmc_resumen");

    expect(
      resolveSpreadsheetSectionType({
        fieldKeys: ["item_code", "descripcion", "monto_rubro"],
      })
    ).toBe("pmc_items");
  });

  it("marks pmc resumen as review when key values are missing", () => {
    const insight = buildSpreadsheetPreviewInsight({
      sectionType: "pmc_resumen",
      inserted: 1,
      sheetName: "CSV",
      previewRows: [
        {
          periodo: "",
          fecha_certificacion: "",
          monto_certificado: null,
          avance_fisico_acumulado_pct: "25",
        },
      ],
    });

    expect(insight.status).toBe("review");
    expect(insight.warnings).toContain("No encontramos el monto certificado.");
  });

  it("flags an invalid certificate number and exposes the origin label", () => {
    const insight = buildSpreadsheetPreviewInsight({
      sectionType: "pmc_resumen",
      inserted: 1,
      sheetName: "CERTIF 1",
      previewRows: [
        {
          periodo: "Mayo 2025",
          nro_certificado: "$-",
          fecha_certificacion: "30/05/2025",
          monto_certificado: "176857675.01",
          avance_fisico_acumulado_pct: "32.409713",
          monto_acumulado: "14738139.58",
        },
      ],
    });

    expect(insight.status).toBe("review");
    expect(insight.keyFieldCoverage.nro_certificado).toBe(false);
    expect(insight.sourceLabel).toBe("Hoja de origen: CERTIF 1");
  });

  it("marks pmc items as ready when key columns are populated", () => {
    const insight = buildSpreadsheetPreviewInsight({
      sectionType: "pmc_items",
      inserted: 3,
      sheetName: "CSV",
      previewRows: [
        { item_code: "1", descripcion: "Hormigon", monto_rubro: "100", avance_acumulado_pct: "10" },
        { item_code: "2", descripcion: "Acero", monto_rubro: "200", avance_acumulado_pct: "20" },
        { item_code: "3", descripcion: "Pintura", monto_rubro: "300", avance_acumulado_pct: "30" },
      ],
    });

    expect(insight.status).toBe("ready");
    expect(insight.sampleRows).toHaveLength(3);
  });

  it("builds a top-level summary from section statuses", () => {
    const summary = buildSpreadsheetPreviewSummary([
      { status: "ready", inserted: 1, includedByDefault: true },
      { status: "review", inserted: 10, includedByDefault: true },
      { status: "empty", inserted: 0, includedByDefault: false },
    ]);

    expect(summary.readySections).toBe(1);
    expect(summary.reviewSections).toBe(1);
    expect(summary.emptySections).toBe(1);
    expect(summary.totalRows).toBe(11);
    expect(summary.canImportAll).toBe(true);
  });
});
