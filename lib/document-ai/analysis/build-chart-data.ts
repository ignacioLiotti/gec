import type { ChartDefinition, DocumentAiIntent, DocumentAiRow } from "@/lib/document-ai/schemas/types";
import {
  looksLikeCertificadoAvance,
  normalizeCertificadoAvance,
} from "@/lib/document-ai/normalization/normalize-certificado-avance";
import { parseNumber } from "@/lib/document-ai/normalization/shared";

function sum(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function buildChartData(rows: DocumentAiRow[], intent: DocumentAiIntent): ChartDefinition[] {
  if (rows.length === 0) return [];

  const certificados = rows.filter(looksLikeCertificadoAvance).map(normalizeCertificadoAvance);
  if (certificados.length === 0) return [];
  const buckets = new Map<string, Array<(typeof certificados)[number]>>();

  for (const certificado of certificados) {
    const key =
      intent.groupBy === "month"
        ? certificado.periodo ?? certificado.fechaCertificacion?.slice(0, 7) ?? "Sin periodo"
        : intent.groupBy === "supplier"
          ? certificado.contratista ?? "Sin proveedor"
          : certificado.periodo ?? certificado.fechaCertificacion?.slice(0, 7) ?? "Sin grupo";
    buckets.set(key, [...(buckets.get(key) ?? []), certificado]);
  }

  const data = Array.from(buckets.entries())
    .map(([periodo, group]) => ({
      periodo,
      monto_certificado: sum(group.map((entry) => entry.montoCertificado)),
      monto_acumulado: group[group.length - 1]?.montoAcumulado ?? sum(group.map((entry) => entry.montoCertificado)),
      avance_fisico_acumulado:
        group[group.length - 1]?.avanceFisicoAcumulado ??
        parseNumber(group[group.length - 1]?.avanceFisicoAcumulado),
      cantidad_documentos: group.length,
    }))
    .sort((left, right) => String(left.periodo).localeCompare(String(right.periodo)));

  return [
    {
      type: intent.chartType === "pie" || intent.chartType === "bar" ? intent.chartType : "line",
      title: "Evolucion documental",
      xKey: "periodo",
      yKeys: intent.metrics.filter((metric) => metric !== "count").length
        ? intent.metrics.filter((metric) => metric !== "count")
        : ["cantidad_documentos"],
      data,
    },
  ];
}
