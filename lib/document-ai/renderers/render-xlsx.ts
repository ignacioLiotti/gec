import type { ReportComposition } from "@/lib/document-ai/schemas/types";

export async function renderReportXlsx(composition: ReportComposition) {
  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();

  const summaryRows = [
    ["Titulo", composition.title],
    ["Resumen", composition.executiveSummary],
    ["Generado", composition.metadata.generatedAt],
    ["Warnings", composition.warnings.join(" | ")],
  ];
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(summaryRows), "Resumen");

  for (const [index, table] of composition.tables.entries()) {
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(table.rows),
      table.title.slice(0, 24) || `Tabla ${index + 1}`,
    );
  }

  for (const [index, chart] of composition.charts.entries()) {
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(chart.data),
      chart.title.slice(0, 24) || `Grafico ${index + 1}`,
    );
  }

  const bytes = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(bytes);
}
