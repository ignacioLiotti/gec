import type { SampleAnalysis } from "@/lib/obra-defaults/sample-analysis";
export type CertificateRow = {
  id: string;
  concept: string;
  period: string;
  amount: number;
  accumulated: number;
  progress: number;
  source: string;
};
export const certificateRows: CertificateRow[] = [
  {
    id: "certificate-01",
    concept: "Estructura",
    period: "2026-05-01",
    amount: 18000000,
    accumulated: 18000000,
    progress: 18,
    source: "Certificado 01",
  },
  {
    id: "certificate-02",
    concept: "Estructura",
    period: "2026-06-01",
    amount: 24000000,
    accumulated: 42000000,
    progress: 42,
    source: "Certificado 02",
  },
  {
    id: "certificate-03",
    concept: "Terminaciones",
    period: "2026-07-01",
    amount: 26000000,
    accumulated: 68000000,
    progress: 68,
    source: "Certificado 03",
  },
];
const key = "sintesis-guide:certificates";
export function readCertificates(): CertificateRow[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : structuredClone(certificateRows);
  } catch {
    return structuredClone(certificateRows);
  }
}
export function saveCertificates(rows: CertificateRow[]) {
  sessionStorage.setItem(key, JSON.stringify(rows));
}
export function prepareReviewExample() {
  const rows = structuredClone(certificateRows);
  rows[0].amount = 17000000;
  saveCertificates(rows);
}
export function isCertificateCorrected(rows: CertificateRow[]) {
  return rows.some(
    (row) => row.id === "certificate-01" && row.amount === 18000000,
  );
}
export const sampleAnalysis: SampleAnalysis = {
  document: {
    family: "Certificados de avance",
    summary:
      "Certificado mensual de Torre Madero. Identifica el período y los trabajos certificados.",
    format: "pdf_texto",
    legibility: "alta",
    pageCount: 1,
    sheets: [],
    layoutHint: "formulario_fijo",
  },
  fields: [
    {
      fieldKey: "obra",
      label: "Obra",
      dataType: "text",
      sampleValue: "Torre Madero",
      confidence: "alta",
      meaning: "Proyecto al que corresponde el certificado.",
      aliases: ["Proyecto"],
    },
    {
      fieldKey: "numero",
      label: "Número de certificado",
      dataType: "number",
      sampleValue: "3",
      confidence: "alta",
      meaning: "Número correlativo del certificado.",
      aliases: ["Certificado N°"],
    },
  ],
  tables: [
    {
      label: "Avance certificado",
      description: "Período, importe mensual y avance acumulado.",
      totalRowsSeen: 3,
      columns: [
        {
          fieldKey: "periodo",
          label: "Período",
          dataType: "date",
          sampleValue: "2026-07-01",
          confidence: "alta",
          meaning: "Mes certificado",
          aliases: [],
        },
        {
          fieldKey: "importe",
          label: "Importe",
          dataType: "currency",
          sampleValue: "26000000",
          confidence: "alta",
          meaning: "Importe del mes en ARS",
          aliases: ["Monto"],
        },
        {
          fieldKey: "avance",
          label: "Avance",
          dataType: "number",
          sampleValue: "68",
          confidence: "media",
          meaning: "Porcentaje acumulado",
          aliases: ["Avance físico"],
        },
      ],
      sampleRows: [
        { periodo: "2026-05-01", importe: "18000000", avance: "18" },
        { periodo: "2026-06-01", importe: "24000000", avance: "42" },
        { periodo: "2026-07-01", importe: "26000000", avance: "68" },
      ],
    },
  ],
  suggestedInstructions: [
    "Los importes están expresados en pesos argentinos.",
    "Distinguir importe mensual de importe acumulado.",
  ],
  warnings: [
    "El avance físico y el avance financiero pueden diferir. Confirmar cuál se quiere guardar.",
  ],
};
