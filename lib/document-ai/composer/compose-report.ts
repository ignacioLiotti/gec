import { buildChartData } from "@/lib/document-ai/analysis/build-chart-data";
import { buildFinancialAnalysis } from "@/lib/document-ai/analysis/build-financial-analysis";
import { detectDocumentAiConflicts } from "@/lib/document-ai/analysis/detect-conflicts";
import { resolveDocumentSeries } from "@/lib/document-ai/continuity/resolve-document-series";
import type {
  ReportComposition,
  RetrievedDocumentAiContext,
  TableDefinition,
} from "@/lib/document-ai/schemas/types";

function formatNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value)}`;
}

function buildFinancialSummaryTable(financialAnalysis: ReturnType<typeof buildFinancialAnalysis>): TableDefinition | null {
  if (!financialAnalysis.monthlyTable) return null;
  return {
    title: "Resumen ejecutivo de conciliacion",
    columns: [
      { key: "indicador", label: "Indicador" },
      { key: "valor", label: "Valor" },
    ],
    rows: [
      { indicador: "Total certificado en certificados disponibles", valor: formatMoney(financialAnalysis.totals.totalCertified) },
      { indicador: "Total OC con fecha imputable por mes", valor: formatMoney(financialAnalysis.totals.totalOrdersWithDate) },
      { indicador: "Total OC sin fecha - no imputado al grafico mensual", valor: formatMoney(financialAnalysis.totals.totalOrdersWithoutDate) },
      { indicador: "Total OC general, contando cada Nro una sola vez", valor: formatMoney(financialAnalysis.totals.totalOrders) },
      {
        indicador: "Resultado contra OC fechadas",
        valor: formatMoney(financialAnalysis.totals.totalCertified - financialAnalysis.totals.totalOrdersWithDate),
      },
      {
        indicador: "Resultado contra todas las OC",
        valor: formatMoney(financialAnalysis.totals.totalCertified - financialAnalysis.totals.totalOrders),
      },
    ],
  };
}

function buildEvidenceTable(context: RetrievedDocumentAiContext): TableDefinition {
  return {
    title: "Fuentes recuperadas",
    columns: [
      { key: "tipo", label: "Tipo" },
      { key: "tabla", label: "Tabla" },
      { key: "documento", label: "Documento" },
      { key: "fecha", label: "Fecha" },
      { key: "datos", label: "Datos" },
    ],
    rows: context.rows.slice(0, 80).map((row) => ({
      tipo: row.documentType ?? "sin tipo",
      tabla: row.tableName ?? row.tableId ?? "",
      documento: row.source.documentFileName ?? row.source.documentPath ?? "",
      fecha: row.createdAt ?? "",
      datos: Object.entries(row.data)
        .filter(([key]) => !key.startsWith("__"))
        .slice(0, 6)
        .map(([key, value]) => `${key}: ${formatNumber(value)}`)
        .join("; "),
    })),
  };
}

export function composeReportFromContext(context: RetrievedDocumentAiContext): ReportComposition {
  const series = resolveDocumentSeries(context.rows);
  const conflicts = detectDocumentAiConflicts(context.rows);
  const financialAnalysis = buildFinancialAnalysis(context.rows);
  const baseCharts = buildChartData(context.rows, context.intent);
  const charts = financialAnalysis.monthlyChart ? [financialAnalysis.monthlyChart] : baseCharts;
  const warnings = [...context.warnings, ...(series?.warnings ?? []), ...financialAnalysis.warnings];
  const evidenceSources = context.sources;
  const includesFinancialRequest = context.intent.metrics.some((metric) =>
    ["gasto_total", "ingreso_certificado"].includes(metric),
  );
  const title =
    financialAnalysis.monthlyTable
      ? "Conciliacion mensual - Certificados vs ordenes de compra"
      : context.intent.output === "pptx"
      ? "Presentacion Document AI"
      : context.intent.output === "pdf"
        ? "Informe Document AI"
        : "Analisis Document AI";

  const executiveSummaryParts = [
    `Se recuperaron ${context.rows.length} filas extraidas y ${context.chunks.length} fragmentos indexados.`,
    context.intent.documentTypes.length
      ? `Tipos documentales: ${context.intent.documentTypes.join(", ")}.`
      : "No se limito a un tipo documental especifico.",
    financialAnalysis.monthlyTable
      ? `Se preparo una conciliacion mensual. Total certificado: ${formatMoney(financialAnalysis.totals.totalCertified)}. Total OC fechadas: ${formatMoney(financialAnalysis.totals.totalOrdersWithDate)}. Total OC sin fecha: ${formatMoney(financialAnalysis.totals.totalOrdersWithoutDate)}.`
      : "",
    series?.latest
      ? `Ultimo certificado detectado: ${series.latest.number ?? "s/n"} con acumulado ${formatNumber(series.latest.accumulatedAmount)}.`
      : "",
    conflicts.length ? `Hay ${conflicts.length} conflicto(s) que requieren revision.` : "",
  ].filter(Boolean);

  return {
    title,
    executiveSummary: executiveSummaryParts.join(" "),
    sections: [
      {
        title: "Pedido",
        narrative: context.intent.analysisGoal,
        evidence: [],
      },
      {
        title: "Hallazgos",
        narrative:
          financialAnalysis.monthlyTable
            ? `El analisis separa certificados como ingresos administrativos y ordenes de compra como gastos. Se detectaron ${financialAnalysis.totals.uniqueOrderCount} ordenes unicas; ${financialAnalysis.totals.uniqueOrdersWithDate} tienen fecha imputable y ${financialAnalysis.totals.uniqueOrdersWithoutDate} quedan separadas para control. Las ordenes duplicadas por variantes de documento se cuentan una sola vez por Nro.`
            : context.rows.length > 0
            ? "El analisis se construyo sobre datos estructurados extraidos de la obra. Los graficos y tablas usan calculos deterministas sobre esas filas."
            : "No se encontraron datos estructurados suficientes para completar el analisis.",
        evidence: evidenceSources.slice(0, 10),
      },
      ...(includesFinancialRequest && !financialAnalysis.monthlyTable
        ? [
            {
              title: "Analisis financiero",
              narrative:
                "El pedido requiere ingresos, gastos y categorias mensuales, pero no se encontraron certificados u ordenes de compra normalizables con importes. El reporte queda incompleto hasta que esas fuentes esten indexadas con campos de fecha e importe.",
              evidence: [],
            },
          ]
        : []),
      ...(financialAnalysis.monthlyTable
        ? [
            {
              title: "Analisis financiero mensual",
              narrative:
                "Ingresos certificados corresponde al monto certificado del mes. Gastos OC corresponde a Total Orden por fecha de la orden, deduplicando por Nro. Las categorias se calculan desde las lineas OCR y se prorratean para coincidir con el total oficial de cada orden.",
              evidence: evidenceSources.slice(0, 20),
            },
          ]
        : []),
      ...(series
        ? [
            {
              title: "Continuidad documental",
              narrative: series.nextDraft
                ? `La serie sugiere el siguiente certificado ${series.nextDraft.number ?? "sin numero"} con acumulado anterior ${formatNumber(series.nextDraft.previousAccumulatedAmount)}. El monto actual queda pendiente de revision o medicion.`
                : "Se detecto serie documental, pero no se pudo construir un borrador siguiente.",
              evidence: series.sequence.map((item) => item.source),
            },
          ]
        : []),
    ],
    charts,
    tables: [
      ...(buildFinancialSummaryTable(financialAnalysis) ? [buildFinancialSummaryTable(financialAnalysis)!] : []),
      ...(financialAnalysis.monthlyTable ? [financialAnalysis.monthlyTable] : []),
      ...(financialAnalysis.categoryTable ? [financialAnalysis.categoryTable] : []),
      ...(financialAnalysis.ordersWithDateTable ? [financialAnalysis.ordersWithDateTable] : []),
      ...(financialAnalysis.ordersWithoutDateTable ? [financialAnalysis.ordersWithoutDateTable] : []),
      ...(financialAnalysis.certificateDetailTable ? [financialAnalysis.certificateDetailTable] : []),
      ...(financialAnalysis.dataQualityTable ? [financialAnalysis.dataQualityTable] : []),
      ...(financialAnalysis.categoryTotalsTable ? [financialAnalysis.categoryTotalsTable] : []),
      buildEvidenceTable(context),
    ],
    sources: evidenceSources,
    conflicts,
    warnings,
    metadata: {
      generatedAt: new Date().toISOString(),
      output: context.intent.output,
      documentTypes: context.intent.documentTypes,
      rowCount: context.rows.length,
      chunkCount: context.chunks.length,
    },
  };
}
