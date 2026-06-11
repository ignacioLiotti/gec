import { describe, expect, it } from "vitest";

import { composeReportLayoutPlan } from "@/lib/document-ai/composer/compose-layout-plan";
import { composeReportFromContext } from "@/lib/document-ai/composer/compose-report";
import { resolveDocumentSeries } from "@/lib/document-ai/continuity/resolve-document-series";
import { normalizeOrdenCompra } from "@/lib/document-ai/normalization/normalize-orden-compra";
import { parseDocumentAiIntent } from "@/lib/document-ai/retrieval/parse-document-ai-intent";
import { renderReportDocx } from "@/lib/document-ai/renderers/render-docx";
import { renderReportPptx } from "@/lib/document-ai/renderers/render-pptx";
import type { DocumentAiRow, RetrievedDocumentAiContext } from "@/lib/document-ai/schemas/types";

function source(rowId: string, documentType = "certificado_avance") {
  return {
    kind: "obra_tabla_row" as const,
    tenantId: "tenant-1",
    obraId: "obra-1",
    tableId: "tabla-1",
    rowId,
    documentType,
    documentFileName: `${rowId}.pdf`,
    confidence: 0.8,
  };
}

const rows: DocumentAiRow[] = [
  {
    id: "row-1",
    tenantId: "tenant-1",
    obraId: "obra-1",
    tableId: "tabla-1",
    tableName: "Certificados",
    documentType: "certificado_avance",
    createdAt: "2025-01-01T00:00:00.000Z",
    data: { numero_certificado: 1, fecha: "01/01/2025", monto_certificado: 100 },
    source: source("row-1"),
  },
  {
    id: "row-2",
    tenantId: "tenant-1",
    obraId: "obra-1",
    tableId: "tabla-1",
    tableName: "Certificados",
    documentType: "certificado_avance",
    createdAt: "2025-02-01T00:00:00.000Z",
    data: { numero_certificado: 2, fecha: "01/02/2025", monto_certificado: 70 },
    source: source("row-2"),
  },
];

describe("document-ai engine", () => {
  it("parses natural requests into auditable intent", async () => {
    const intent = await parseDocumentAiIntent({
      prompt: "Buscá certificados de avance de 2025 y armame un PowerPoint con evolución mensual",
      outputType: null,
      obraId: "obra-1",
    });

    expect(intent).toMatchObject({
      output: "pptx",
      documentTypes: ["certificado_avance"],
      filters: { obraId: "obra-1", dateFrom: "2025-01-01", dateTo: "2025-12-31" },
      groupBy: "month",
      chartType: "line",
    });
  });

  it("keeps certificate and purchase-order intent for financial PDF requests", async () => {
    const intent = await parseDocumentAiIntent({
      prompt:
        "Buscá certificados de avance y ordenes de compra y armame un pdf con costos por mes, categorias de gastos y doble barra ingresos y gastos mensuales",
      outputType: "pdf",
      obraId: "obra-1",
    });

    expect(intent.output).toBe("pdf");
    expect(intent.documentTypes).toEqual(expect.arrayContaining(["certificado_avance", "orden_compra"]));
    expect(intent.metrics).toEqual(expect.arrayContaining(["gasto_total", "ingreso_certificado"]));
    expect(intent.groupBy).toBe("month");
    expect(intent.chartType).toBe("bar");
  });

  it("resolves the next certificate draft from previous certificates", () => {
    const series = resolveDocumentSeries(rows);

    expect(series?.latest).toMatchObject({
      number: 2,
      accumulatedAmount: 170,
    });
    expect(series?.nextDraft).toMatchObject({
      number: 3,
      previousAccumulatedAmount: 170,
      currentAmount: null,
      newAccumulatedAmount: null,
    });
  });

  it("composes reports with charts, sources, continuity and conflicts", async () => {
    const intent = await parseDocumentAiIntent({
      prompt: "Buscá certificados de avance de 2025 y explicá evolución mensual de monto acumulado",
      outputType: "summary",
      obraId: "obra-1",
    });
    const context: RetrievedDocumentAiContext = {
      intent,
      rows,
      chunks: [],
      sources: rows.map((row) => row.source),
      warnings: [],
    };

    const composition = composeReportFromContext(context);

    expect(composition.executiveSummary).toContain("2 filas");
    expect(composition.charts[0].data).toHaveLength(2);
    expect(composition.sections.some((section) => section.title === "Continuidad documental")).toBe(true);
    expect(await renderReportPptx(composition)).toBeInstanceOf(Uint8Array);
    expect(await renderReportDocx(composition)).toBeInstanceOf(Uint8Array);
  });

  it("composes monthly income vs expense reports from certificates and purchase orders", async () => {
    const intent = await parseDocumentAiIntent({
      prompt:
        "Buscá certificados de avance y ordenes de compra y armame un pdf explicando gastos por mes y doble barra ingresos y gastos mensuales",
      outputType: "pdf",
      obraId: "obra-1",
    });
    const purchaseRows: DocumentAiRow[] = [
      {
        id: "oc-1",
        tenantId: "tenant-1",
        obraId: "obra-1",
        tableId: "tabla-2",
        tableName: "Ordenes de Compra",
        documentType: "orden_compra",
        createdAt: "2025-01-15T00:00:00.000Z",
        data: { nroOrden: 10, fecha: "15/01/2025", categoria: "Hierros", total: 40 },
        source: source("oc-1", "orden_compra"),
      },
      {
        id: "oc-2",
        tenantId: "tenant-1",
        obraId: "obra-1",
        tableId: "tabla-2",
        tableName: "Ordenes de Compra",
        documentType: "orden_compra",
        createdAt: "2025-02-15T00:00:00.000Z",
        data: { nroOrden: 11, fecha: "15/02/2025", categoria: "Sanitarios", total: 30 },
        source: source("oc-2", "orden_compra"),
      },
    ];
    const context: RetrievedDocumentAiContext = {
      intent,
      rows: [...rows, ...purchaseRows],
      chunks: [],
      sources: [...rows, ...purchaseRows].map((row) => row.source),
      warnings: [],
    };

    const composition = composeReportFromContext(context);

    expect(composition.charts[0]).toMatchObject({
      type: "bar",
      title: "Ingresos certificados vs gastos mensuales",
      yKeys: ["ingreso_certificado", "gasto_total"],
    });
    expect(composition.tables.some((table) => table.title === "Tabla mensual conciliada")).toBe(true);
    expect(composition.tables.some((table) => table.title === "Gastos por categoria y mes")).toBe(true);
    expect(composition.tables.some((table) => table.title === "Ordenes consolidadas con fecha")).toBe(true);
  });

  it("keeps purchase orders without dates outside monthly spending", async () => {
    const intent = await parseDocumentAiIntent({
      prompt: "Conciliá certificados contra ordenes de compra por mes",
      outputType: "pdf",
      obraId: "obra-1",
    });
    const context: RetrievedDocumentAiContext = {
      intent,
      rows: [
        ...rows,
        {
          id: "oc-no-date",
          tenantId: "tenant-1",
          obraId: "obra-1",
          tableId: "tabla-2",
          tableName: "Ordenes de Compra",
          documentType: "orden_compra",
          createdAt: "2026-04-21T00:00:00.000Z",
          data: { nroOrden: 99, proveedor: "Proveedor", "Total Orden": 500, "detalle descriptivo": "ARENA" },
          source: source("oc-no-date", "orden_compra"),
        },
      ],
      chunks: [],
      sources: rows.map((row) => row.source),
      warnings: [],
    };

    const composition = composeReportFromContext(context);
    const monthly = composition.tables.find((table) => table.title === "Tabla mensual conciliada");

    expect(monthly?.rows.some((row) => row.periodo === "abr-26")).toBe(false);
    expect(composition.tables.some((table) => table.title === "Ordenes sin fecha")).toBe(true);
    expect(composition.warnings.some((warning) => warning.includes("fuera del grafico mensual"))).toBe(true);
  });

  it("enriches purchase-order dates from auxiliary rows with the same order number", async () => {
    const intent = await parseDocumentAiIntent({
      prompt: "Conciliá certificados contra ordenes de compra por mes",
      outputType: "pdf",
      obraId: "obra-1",
    });
    const context: RetrievedDocumentAiContext = {
      intent,
      rows: [
        ...rows,
        {
          id: "oc-total",
          tenantId: "tenant-1",
          obraId: "obra-1",
          tableId: "tabla-2",
          tableName: "Ordenes de Compra",
          documentType: "orden_compra",
          createdAt: "2026-04-21T00:00:00.000Z",
          data: { nroOrden: 38815, proveedor: "Proveedor", "Total Orden": 500, "detalle descriptivo": "HIERRO" },
          source: source("oc-total", "orden_compra"),
        },
        {
          id: "oc-date",
          tenantId: "tenant-1",
          obraId: "obra-1",
          tableId: "tabla-3",
          tableName: "Fechas OC",
          documentType: null,
          createdAt: "2026-04-21T00:00:00.000Z",
          data: { nroOrden: 38815, fecha: "15/06/2025" },
          source: source("oc-date", "orden_compra"),
        },
      ],
      chunks: [],
      sources: rows.map((row) => row.source),
      warnings: [],
    };

    const composition = composeReportFromContext(context);
    const monthly = composition.tables.find((table) => table.title === "Tabla mensual conciliada");

    expect(monthly?.rows.some((row) => row.periodo === "jun-25" && row.gasto_total === "$500,00")).toBe(true);
    expect(composition.tables.some((table) => table.title === "Ordenes sin fecha")).toBe(false);
  });

  it("reads OCR purchase-order CSV headers with Fecha and Total Orden", async () => {
    const intent = await parseDocumentAiIntent({
      prompt: "Conciliá certificados contra ordenes de compra por mes",
      outputType: "pdf",
      obraId: "obra-1",
    });
    const csvOrderRow: DocumentAiRow = {
      id: "oc-csv",
      tenantId: "tenant-1",
      obraId: "obra-1",
      tableId: "tabla-2",
      tableName: "Ordenes de Compra",
      documentType: "orden_compra",
      createdAt: "2026-05-28T18:51:01.644932+00:00",
      data: {
        "Documento origen": "oc-38830-caiman.pdf",
        Nro: "39830",
        Proveedor: "FERRETERIA DEL CENTRO (SANTA ROSA)",
        Cantidad: "60",
        Unidad: "BARRAS",
        "detalle descriptivo": "HIERRO DEL 6",
        "Precio Unitario": "4888",
        "Precio total": "293280",
        "Total Orden": "1849935",
        Fecha: "2025-07-14T00:00:00.000Z",
      },
      source: source("oc-csv", "orden_compra"),
    };
    expect(normalizeOrdenCompra(csvOrderRow)).toMatchObject({
      numeroOrden: "39830",
      fechaOrden: "2025-07-14",
      periodo: "2025-07",
      totalOrden: 1849935,
    });
    const context: RetrievedDocumentAiContext = {
      intent,
      rows: [
        ...rows,
        csvOrderRow,
      ],
      chunks: [],
      sources: rows.map((row) => row.source),
      warnings: [],
    };

    const composition = composeReportFromContext(context);
    const monthly = composition.tables.find((table) => table.title === "Tabla mensual conciliada");

    expect(monthly?.rows.some((row) => row.periodo === "jul-25" && row.gasto_total === "$1.849.935,00")).toBe(true);
    expect(composition.tables.some((table) => table.title === "Ordenes consolidadas con fecha")).toBe(true);
    expect(composition.tables.some((table) => table.title === "Ordenes sin fecha")).toBe(false);
  });

  it("plans financial reports as visual blocks instead of a flat table dump", async () => {
    const intent = await parseDocumentAiIntent({
      prompt: "Armame un pdf visual de certificados contra ordenes de compra por mes y categorias",
      outputType: "pdf",
      obraId: "obra-1",
    });
    const context: RetrievedDocumentAiContext = {
      intent,
      rows: [
        ...rows,
        {
          id: "oc-visual",
          tenantId: "tenant-1",
          obraId: "obra-1",
          tableId: "tabla-2",
          tableName: "Ordenes de Compra",
          documentType: "orden_compra",
          createdAt: "2026-05-28T18:51:01.644932+00:00",
          data: {
            Nro: "39830",
            Proveedor: "FERRETERIA DEL CENTRO",
            "detalle descriptivo": "HIERRO DEL 6",
            "Precio total": "293280",
            "Total Orden": "1849935",
            Fecha: "2025-07-14T00:00:00.000Z",
          },
          source: source("oc-visual", "orden_compra"),
        },
      ],
      chunks: [],
      sources: rows.map((row) => row.source),
      warnings: [],
    };

    const plan = composeReportLayoutPlan(composeReportFromContext(context));

    expect(plan.template).toBe("financial_reconciliation");
    expect(plan.blocks.map((block) => block.type)).toEqual(
      expect.arrayContaining(["hero", "kpi_grid", "chart", "monthly_narrative", "category_matrix"]),
    );
  });
});
