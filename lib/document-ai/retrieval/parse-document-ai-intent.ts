import {
  DOCUMENT_AI_OUTPUT_TYPES,
  type DocumentAiIntent,
  type DocumentAiOutputType,
} from "@/lib/document-ai/schemas/types";

const DOCUMENT_TYPE_ALIASES: Array<{ match: RegExp; value: string }> = [
  { match: /certificad/i, value: "certificado_avance" },
  { match: /orden(?:es)?\s+de\s+compra|oc\b/i, value: "orden_compra" },
  { match: /factur/i, value: "factura" },
  { match: /remit/i, value: "remito" },
  { match: /contrat/i, value: "contrato" },
  { match: /acta/i, value: "acta_medicion" },
  { match: /presupuest/i, value: "presupuesto" },
  { match: /redetermin/i, value: "redeterminacion" },
];

function normalizeOutputType(value: unknown): DocumentAiOutputType {
  if (typeof value === "string" && DOCUMENT_AI_OUTPUT_TYPES.includes(value as DocumentAiOutputType)) {
    return value as DocumentAiOutputType;
  }
  return "summary";
}

function inferOutput(prompt: string, requested?: unknown): DocumentAiOutputType {
  const explicit = normalizeOutputType(requested);
  if (explicit !== "summary") return explicit;
  if (/power\s*point|pptx|presentaci[oó]n|slides?/i.test(prompt)) return "pptx";
  if (/\bpdf\b|informe/i.test(prompt)) return "pdf";
  if (/\bdocx\b|word|documento/i.test(prompt)) return "docx";
  if (/\bxlsx\b|excel|planilla/i.test(prompt)) return "xlsx";
  if (/dashboard|tablero/i.test(prompt)) return "dashboard";
  if (/graf/i.test(prompt)) return "chart";
  return explicit;
}

function inferDocumentTypes(prompt: string) {
  const types = DOCUMENT_TYPE_ALIASES.filter((entry) => entry.match.test(prompt)).map((entry) => entry.value);
  return Array.from(new Set(types));
}

function inferDateRange(prompt: string) {
  const yearMatch = prompt.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return {
      dateFrom: `${yearMatch[1]}-01-01`,
      dateTo: `${yearMatch[1]}-12-31`,
    };
  }
  const isoMatches = Array.from(prompt.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)).map((match) => match[1]);
  if (isoMatches.length >= 2) {
    return { dateFrom: isoMatches[0], dateTo: isoMatches[1] };
  }
  return { dateFrom: null, dateTo: null };
}

function inferMetrics(prompt: string) {
  const metrics = new Set<string>();
  if (/monto|importe|pesos|\$/i.test(prompt)) metrics.add("monto_certificado");
  if (/gasto|gast[eóo]|compra|orden(?:es)?\s+de\s+compra|costo/i.test(prompt)) metrics.add("gasto_total");
  if (/ingreso|factur|certificad/i.test(prompt)) metrics.add("ingreso_certificado");
  if (/acumul/i.test(prompt)) metrics.add("monto_acumulado");
  if (/avance|fisic/i.test(prompt)) metrics.add("avance_fisico_acumulado");
  if (/cantidad|volumen/i.test(prompt)) metrics.add("cantidad");
  if (metrics.size === 0) metrics.add("count");
  return Array.from(metrics);
}

function mergeUnique(left: string[], right: string[]) {
  return Array.from(new Set([...left, ...right].filter(Boolean)));
}

export async function parseDocumentAiIntent(input: {
  prompt: string;
  outputType?: string | null;
  obraId?: string | null;
  folderPath?: string | null;
}): Promise<DocumentAiIntent> {
  const prompt = input.prompt.trim();
  const llmIntent = await tryParseIntentWithLlm(prompt, input);
  if (llmIntent) return llmIntent;
  const output = inferOutput(prompt, input.outputType);
  const dateRange = inferDateRange(prompt);
  const documentTypes = inferDocumentTypes(prompt);
  const metrics = inferMetrics(prompt);
  const lower = prompt.toLowerCase();
  return {
    output,
    documentTypes,
    filters: {
      obraId: input.obraId ?? null,
      folderPath: input.folderPath ?? null,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      proveedor: null,
      estado: null,
    },
    analysisGoal: prompt || "Analizar documentos de obra",
    metrics,
    groupBy:
      /mes|mensual|evoluci|por mes/i.test(lower)
        ? "month"
        : /proveedor/i.test(lower)
          ? "supplier"
          : /tipo/i.test(lower)
            ? "document_type"
            : "none",
    chartType:
      /torta|pie/i.test(lower)
        ? "pie"
        : /barra|doble barra/i.test(lower)
          ? "bar"
          : /tabla/i.test(lower)
            ? "table"
            : "line",
    wantsContinuity: /siguiente|crear|armar|generar.*certificado\s+\d+|certificado\s+\d+/i.test(prompt),
  };
}

async function tryParseIntentWithLlm(
  prompt: string,
  input: { outputType?: string | null; obraId?: string | null; folderPath?: string | null },
): Promise<DocumentAiIntent | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey || prompt.length === 0) return null;
  try {
    const model = process.env.DOCUMENT_AI_GEMINI_INTENT_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
        systemInstruction: {
          parts: [
            {
              text:
                "Return strict JSON for DocumentAiIntent. Use output one of summary,dashboard,chart,pdf,pptx,docx,xlsx. Use documentTypes like certificado_avance, factura, orden_compra. Do not include prose.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  prompt,
                  requestedOutput: input.outputType ?? null,
                  obraId: input.obraId ?? null,
                  folderPath: input.folderPath ?? null,
                }),
              },
            ],
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DocumentAiIntent>;
    const heuristicTypes = inferDocumentTypes(prompt);
    const heuristicMetrics = inferMetrics(prompt);
    const lower = prompt.toLowerCase();
    return {
      output: normalizeOutputType(parsed.output ?? input.outputType),
      documentTypes: mergeUnique(
        Array.isArray(parsed.documentTypes)
          ? parsed.documentTypes.filter((item): item is string => typeof item === "string")
          : [],
        heuristicTypes,
      ),
      filters: {
        obraId: input.obraId ?? parsed.filters?.obraId ?? null,
        folderPath: input.folderPath ?? parsed.filters?.folderPath ?? null,
        dateFrom: parsed.filters?.dateFrom ?? null,
        dateTo: parsed.filters?.dateTo ?? null,
        proveedor: parsed.filters?.proveedor ?? null,
        estado: parsed.filters?.estado ?? null,
      },
      analysisGoal: typeof parsed.analysisGoal === "string" ? parsed.analysisGoal : prompt,
      metrics: mergeUnique(
        Array.isArray(parsed.metrics) ? parsed.metrics.filter((item): item is string => typeof item === "string") : [],
        heuristicMetrics,
      ),
      groupBy:
        parsed.groupBy === "month" || parsed.groupBy === "supplier" || parsed.groupBy === "document_type" || parsed.groupBy === "category"
          ? parsed.groupBy
          : /mes|mensual|evoluci|por mes/i.test(lower)
            ? "month"
          : "none",
      chartType:
        parsed.chartType === "bar" || parsed.chartType === "pie" || parsed.chartType === "table"
          ? parsed.chartType
          : /barra|doble barra/i.test(lower)
            ? "bar"
          : "line",
      wantsContinuity: Boolean(parsed.wantsContinuity),
    };
  } catch {
    return null;
  }
}
