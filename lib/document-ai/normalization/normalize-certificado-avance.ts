import type { DocumentAiRow, NormalizedCertificadoAvance } from "@/lib/document-ai/schemas/types";
import { getByAliases, parseDate, parseNumber, periodFromDate } from "./shared";

export function normalizeCertificadoAvance(row: DocumentAiRow): NormalizedCertificadoAvance {
  const data = row.data;
  const fechaCertificacion = parseDate(
    getByAliases(data, ["fecha_certificacion", "fecha certificacion", "fecha", "fecha_certificado", "fecha_de_certificacion"]),
  );
  const periodo =
    String(getByAliases(data, ["periodo", "mes", "mes_certificado"]) ?? "").trim() ||
    periodFromDate(fechaCertificacion);
  return {
    obraId: row.obraId,
    numeroCertificado: parseNumber(
      getByAliases(data, ["numero_certificado", "nro_certificado", "certificado", "numero", "nro"]),
    ),
    periodo: periodo || null,
    fechaCertificacion,
    montoCertificado: parseNumber(
      getByAliases(data, ["monto_certificado", "importe_certificado", "monto", "importe", "total"]),
    ),
    montoAcumulado: parseNumber(
      getByAliases(data, ["monto_acumulado", "acumulado", "importe_acumulado", "total_acumulado"]),
    ),
    avanceFisicoAcumulado: parseNumber(
      getByAliases(data, [
        "avance_fisico_acumulado",
        "avance fisico acumulado",
        "avance_fisico_acum",
        "avance fisico acum",
        "avance_fisico",
        "porcentaje_avance",
        "avance",
      ]),
    ),
    contratista:
      String(getByAliases(data, ["contratista", "proveedor", "empresa", "supplier"]) ?? "").trim() || null,
    source: row.source,
    confidence: row.source.confidence ?? 0.75,
  };
}

export function looksLikeCertificadoAvance(row: DocumentAiRow) {
  if (row.documentType === "certificado_avance" || row.documentType === "CERTIFICATE") return true;
  const keys = Object.keys(row.data).join(" ");
  return /certificad|avance|monto_certificado|monto_acumulado|avance_fisico/i.test(keys);
}
