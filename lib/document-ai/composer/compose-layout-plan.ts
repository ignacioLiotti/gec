import type { ChartDefinition, ReportComposition, ReportSection, TableDefinition } from "@/lib/document-ai/schemas/types";

export type ReportLayoutTemplate =
  | "financial_reconciliation"
  | "executive_summary"
  | "chart_report"
  | "audit_report";

export type ReportLayoutBlock =
  | { type: "hero"; title: string; subtitle: string; meta: string }
  | { type: "warning_strip"; warnings: string[] }
  | { type: "narrative"; title: string; body: string; tone?: "default" | "muted" }
  | { type: "kpi_grid"; table: TableDefinition }
  | { type: "chart"; chart: ChartDefinition; eyebrow?: string }
  | { type: "comparison_table"; table: TableDefinition; title?: string; limit?: number }
  | { type: "monthly_narrative"; table: TableDefinition }
  | { type: "monthly_cards"; table: TableDefinition }
  | { type: "category_matrix"; table: TableDefinition }
  | { type: "category_highlights"; table: TableDefinition }
  | { type: "orders_without_date"; table: TableDefinition }
  | { type: "quality_notes"; table: TableDefinition }
  | { type: "section"; section: ReportSection }
  | { type: "appendix_table"; table: TableDefinition; limit?: number };

export type ReportLayoutPlan = {
  template: ReportLayoutTemplate;
  blocks: ReportLayoutBlock[];
};

function findTable(composition: ReportComposition, title: string) {
  return composition.tables.find((table) => table.title === title) ?? null;
}

function hasMetric(composition: ReportComposition, metric: string) {
  return composition.charts.some((chart) => chart.yKeys.includes(metric));
}

function pushIf<T>(items: T[], value: T | null | undefined) {
  if (value) items.push(value);
}

function buildFinancialReconciliationPlan(composition: ReportComposition): ReportLayoutPlan {
  const summaryTable = findTable(composition, "Resumen ejecutivo de conciliacion");
  const monthlyTable = findTable(composition, "Tabla mensual conciliada");
  const categoriesByMonth = findTable(composition, "Gastos por categoria y mes");
  const categoryTotals = findTable(composition, "Totales por categoria - OC fechadas");
  const ordersWithDate = findTable(composition, "Ordenes consolidadas con fecha");
  const ordersWithoutDate = findTable(composition, "Ordenes sin fecha");
  const qualityTable = findTable(composition, "Control de calidad de datos");
  const certificateTable = findTable(composition, "Detalle de certificados");
  const evidenceTable = findTable(composition, "Fuentes recuperadas");
  const blocks: ReportLayoutBlock[] = [
    {
      type: "hero",
      title: composition.title,
      subtitle: composition.executiveSummary,
      meta: `${composition.metadata.generatedAt} - ${composition.metadata.output}`,
    },
  ];

  if (composition.warnings.length) {
    blocks.push({ type: "warning_strip", warnings: composition.warnings });
  }
  pushIf(blocks, summaryTable ? { type: "kpi_grid", table: summaryTable } : null);
  for (const chart of composition.charts) {
    blocks.push({ type: "chart", chart, eyebrow: "Evolucion mensual" });
  }
  pushIf(
    blocks,
    monthlyTable
      ? {
          type: "comparison_table",
          table: monthlyTable,
          title: "1. Evolucion mensual de ingresos certificados, gastos y resultado",
        }
      : null,
  );
  pushIf(blocks, monthlyTable ? { type: "monthly_narrative", table: monthlyTable } : null);
  pushIf(
    blocks,
    certificateTable
      ? {
          type: "comparison_table",
          table: certificateTable,
          title: "2. Evolucion del monto certificado, acumulado y avance fisico",
          limit: 16,
        }
      : null,
  );
  if (certificateTable) {
    blocks.push({
      type: "narrative",
      title: "Lectura de certificados",
      body:
        "La serie de certificados permite comparar monto mensual, monto acumulado y avance fisico declarado. Si existen saltos de numeracion, el reporte los mantiene visibles para revisar certificados faltantes o no recuperados.",
      tone: "muted",
    });
  }
  pushIf(
    blocks,
    categoriesByMonth
      ? {
          type: "category_matrix",
          table: categoriesByMonth,
        }
      : null,
  );
  pushIf(blocks, categoryTotals ? { type: "category_highlights", table: categoryTotals } : null);
  pushIf(
    blocks,
    ordersWithDate
      ? {
          type: "comparison_table",
          table: ordersWithDate,
          title: "4. Ordenes de compra consolidadas con fecha",
          limit: 30,
        }
      : null,
  );
  pushIf(blocks, ordersWithoutDate ? { type: "orders_without_date", table: ordersWithoutDate } : null);
  pushIf(blocks, qualityTable ? { type: "quality_notes", table: qualityTable } : null);
  if (evidenceTable) {
    blocks.push({ type: "appendix_table", table: evidenceTable, limit: 25 });
  }

  return { template: "financial_reconciliation", blocks };
}

function buildDefaultPlan(composition: ReportComposition): ReportLayoutPlan {
  const blocks: ReportLayoutBlock[] = [
    {
      type: "hero",
      title: composition.title,
      subtitle: composition.executiveSummary,
      meta: `${composition.metadata.generatedAt} - ${composition.metadata.output}`,
    },
  ];
  if (composition.warnings.length) {
    blocks.push({ type: "warning_strip", warnings: composition.warnings });
  }
  for (const section of composition.sections) {
    blocks.push({ type: "section", section });
  }
  for (const chart of composition.charts) {
    blocks.push({ type: "chart", chart });
  }
  for (const table of composition.tables) {
    blocks.push({ type: "appendix_table", table, limit: 80 });
  }
  const template: ReportLayoutTemplate = composition.charts.length || hasMetric(composition, "count")
    ? "chart_report"
    : composition.sources.length > 15
      ? "audit_report"
      : "executive_summary";
  return { template, blocks };
}

export function composeReportLayoutPlan(composition: ReportComposition): ReportLayoutPlan {
  if (findTable(composition, "Resumen ejecutivo de conciliacion")) {
    return buildFinancialReconciliationPlan(composition);
  }
  return buildDefaultPlan(composition);
}
