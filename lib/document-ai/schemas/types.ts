export const DOCUMENT_AI_OUTPUT_TYPES = [
  "summary",
  "dashboard",
  "chart",
  "pdf",
  "pptx",
  "docx",
  "xlsx",
] as const;

export type DocumentAiOutputType = (typeof DOCUMENT_AI_OUTPUT_TYPES)[number];

export type DocumentAiDateRange = {
  dateFrom: string | null;
  dateTo: string | null;
};

export type DocumentAiIntent = {
  output: DocumentAiOutputType;
  documentTypes: string[];
  filters: {
    obraId?: string | null;
    folderPath?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    proveedor?: string | null;
    estado?: string | null;
  };
  analysisGoal: string;
  metrics: string[];
  groupBy: "month" | "supplier" | "document_type" | "category" | "none";
  chartType: "bar" | "line" | "pie" | "table";
  wantsContinuity: boolean;
};

export type DocumentAiSourceRef = {
  kind: "index" | "obra_tabla_row" | "generated_document";
  tenantId: string;
  obraId: string | null;
  documentId?: string | null;
  tableId?: string | null;
  rowId?: string | null;
  fieldKey?: string | null;
  documentType?: string | null;
  documentPath?: string | null;
  documentFileName?: string | null;
  lineageRowKey?: string | null;
  extractionId?: string | null;
  confidence?: number | null;
};

export type DocumentAiRow = {
  id: string;
  tenantId: string;
  obraId: string | null;
  tableId: string | null;
  tableName: string | null;
  documentType: string | null;
  data: Record<string, unknown>;
  createdAt: string | null;
  source: DocumentAiSourceRef;
};

export type DocumentAiChunk = {
  id: string;
  tenantId: string;
  obraId: string | null;
  documentType: string | null;
  content: string;
  structuredData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  similarity: number;
  source: DocumentAiSourceRef;
};

export type RetrievedDocumentAiContext = {
  intent: DocumentAiIntent;
  rows: DocumentAiRow[];
  chunks: DocumentAiChunk[];
  sources: DocumentAiSourceRef[];
  warnings: string[];
};

export type NormalizedCertificadoAvance = {
  obraId: string | null;
  numeroCertificado: number | null;
  periodo: string | null;
  fechaCertificacion: string | null;
  montoCertificado: number | null;
  montoAcumulado: number | null;
  avanceFisicoAcumulado: number | null;
  contratista: string | null;
  source: DocumentAiSourceRef;
  confidence: number;
};

export type DocumentSeriesState = {
  documentType: "certificado_avance";
  sequence: Array<{
    number: number | null;
    date: string | null;
    period: string | null;
    amount: number | null;
    accumulatedAmount: number | null;
    source: DocumentAiSourceRef;
  }>;
  latest: {
    number: number | null;
    date: string | null;
    period: string | null;
    accumulatedAmount: number | null;
  } | null;
  nextDraft: {
    number: number | null;
    previousAccumulatedAmount: number | null;
    currentAmount: null;
    newAccumulatedAmount: null;
  } | null;
  warnings: string[];
};

export type DocumentAiConflict = {
  field: string;
  candidates: Array<{
    value: unknown;
    source: DocumentAiSourceRef;
    confidence: number;
  }>;
  recommendedValue: unknown;
  reason: string;
  requiresReview: boolean;
};

export type ChartDefinition = {
  type: "line" | "bar" | "pie" | "table";
  title: string;
  xKey: string;
  yKeys: string[];
  data: Array<Record<string, unknown>>;
};

export type TableDefinition = {
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
};

export type ReportSection = {
  title: string;
  narrative: string;
  evidence: DocumentAiSourceRef[];
};

export type ReportComposition = {
  title: string;
  executiveSummary: string;
  sections: ReportSection[];
  charts: ChartDefinition[];
  tables: TableDefinition[];
  sources: DocumentAiSourceRef[];
  conflicts: DocumentAiConflict[];
  warnings: string[];
  metadata: {
    generatedAt: string;
    output: DocumentAiOutputType;
    documentTypes: string[];
    rowCount: number;
    chunkCount: number;
  };
};
