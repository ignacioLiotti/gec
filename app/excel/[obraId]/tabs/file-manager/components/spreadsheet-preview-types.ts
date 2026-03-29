import type {
  SpreadsheetPreviewSectionType,
  SpreadsheetPreviewStatus,
  SpreadsheetPreviewSummary,
} from "@/lib/spreadsheet-preview-summary";

export type SpreadsheetPreviewMapping = {
  dbColumn: string;
  label: string;
  excelHeader: string | null;
  confidence: number;
  manualValue?: string;
};

export type SpreadsheetPreviewSheet = {
  name: string;
  headers: string[];
  rowCount: number;
};

export type SpreadsheetPreviewTable = {
  tablaId: string;
  tablaName: string;
  inserted: number;
  sheetName: string | null;
  mappings?: SpreadsheetPreviewMapping[];
  previewRows?: Record<string, unknown>[];
  availableSheets?: SpreadsheetPreviewSheet[];
  extractionMode?: "pmc_resumen" | "curva_plan";
  fixedCellRefs?: Record<string, string>;
  sectionType?: SpreadsheetPreviewSectionType;
  status?: SpreadsheetPreviewStatus;
  statusReason?: string | null;
  includedByDefault?: boolean;
  sampleColumns?: string[];
  sampleRows?: Record<string, unknown>[];
  keyFieldCoverage?: Record<string, boolean>;
  sourceLabel?: string;
  warnings?: string[];
};

export type SpreadsheetPreviewPayload = {
  perTable: SpreadsheetPreviewTable[];
  summary?: SpreadsheetPreviewSummary;
  sheetAssignments: Record<string, string | null>;
  columnMappings: Record<string, Record<string, string | null>>;
  manualValues: Record<string, Record<string, string>>;
  existingBucket?: string;
  existingPath?: string;
  existingFileName?: string;
  tablaIds: string[];
};
