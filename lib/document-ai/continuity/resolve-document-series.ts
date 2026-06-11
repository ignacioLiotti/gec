import type {
  DocumentAiRow,
  DocumentSeriesState,
  NormalizedCertificadoAvance,
} from "@/lib/document-ai/schemas/types";
import {
  looksLikeCertificadoAvance,
  normalizeCertificadoAvance,
} from "@/lib/document-ai/normalization/normalize-certificado-avance";

function compareCertificados(left: NormalizedCertificadoAvance, right: NormalizedCertificadoAvance) {
  const leftNumber = left.numeroCertificado ?? -1;
  const rightNumber = right.numeroCertificado ?? -1;
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return String(left.fechaCertificacion ?? left.periodo ?? "").localeCompare(
    String(right.fechaCertificacion ?? right.periodo ?? ""),
  );
}

export function resolveDocumentSeries(rows: DocumentAiRow[]): DocumentSeriesState | null {
  const certificados = rows
    .filter(looksLikeCertificadoAvance)
    .map(normalizeCertificadoAvance)
    .filter(
      (certificado) =>
        certificado.numeroCertificado != null ||
        certificado.fechaCertificacion != null ||
        certificado.montoCertificado != null,
    )
    .sort(compareCertificados);

  if (certificados.length === 0) return null;

  const warnings: string[] = [];
  const latest = certificados[certificados.length - 1];
  const previousAccumulatedAmount =
    latest.montoAcumulado ??
    certificados.reduce((total, certificado) => total + (certificado.montoCertificado ?? 0), 0);

  if (latest.montoAcumulado == null) {
    warnings.push("El acumulado anterior fue calculado sumando montos certificados porque no habia acumulado explicito.");
  }

  return {
    documentType: "certificado_avance",
    sequence: certificados.map((certificado) => ({
      number: certificado.numeroCertificado,
      date: certificado.fechaCertificacion,
      period: certificado.periodo,
      amount: certificado.montoCertificado,
      accumulatedAmount: certificado.montoAcumulado,
      source: certificado.source,
    })),
    latest: {
      number: latest.numeroCertificado,
      date: latest.fechaCertificacion,
      period: latest.periodo,
      accumulatedAmount: previousAccumulatedAmount,
    },
    nextDraft: {
      number: latest.numeroCertificado != null ? latest.numeroCertificado + 1 : null,
      previousAccumulatedAmount,
      currentAmount: null,
      newAccumulatedAmount: null,
    },
    warnings,
  };
}
