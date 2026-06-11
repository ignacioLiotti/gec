import type { DocumentAiConflict, DocumentAiRow } from "@/lib/document-ai/schemas/types";
import { getByAliases } from "@/lib/document-ai/normalization/shared";

const FIELD_ALIASES: Record<string, string[]> = {
  monto_certificado: ["monto_certificado", "importe_certificado", "monto", "importe", "total"],
  monto_acumulado: ["monto_acumulado", "acumulado", "importe_acumulado", "total_acumulado"],
  fecha_certificacion: ["fecha_certificacion", "fecha", "fecha_certificado"],
  numero_certificado: ["numero_certificado", "nro_certificado", "certificado", "numero", "nro"],
};

function normalizeConflictValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function detectDocumentAiConflicts(rows: DocumentAiRow[], fields = Object.keys(FIELD_ALIASES)) {
  const conflicts: DocumentAiConflict[] = [];
  for (const field of fields) {
    const candidates = rows
      .map((row) => ({
        value: getByAliases(row.data, FIELD_ALIASES[field] ?? [field]),
        source: row.source,
        confidence: row.source.confidence ?? 0.75,
      }))
      .filter((candidate) => candidate.value != null && String(candidate.value).trim() !== "");
    const unique = new Map(candidates.map((candidate) => [normalizeConflictValue(candidate.value), candidate]));
    if (unique.size <= 1) continue;
    const sorted = Array.from(unique.values()).sort((left, right) => right.confidence - left.confidence);
    conflicts.push({
      field,
      candidates: sorted,
      recommendedValue: sorted[0]?.value ?? null,
      reason: "Mayor confianza de fuente recuperada",
      requiresReview: true,
    });
  }
  return conflicts;
}
