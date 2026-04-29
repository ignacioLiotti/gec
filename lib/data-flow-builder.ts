import type { SupabaseClient } from "@supabase/supabase-js";

import { toNumericValue as parseNumericValue } from "@/lib/tablas";

export type DataFlowBuilderSourceType = "table" | "macro_table";
export type DataFlowBuilderCalculationMode = "aggregate" | "formula";
export type DataFlowBuilderFormulaInputSourceType = "calculation" | DataFlowBuilderSourceType | "obra_field";
export type DataFlowBuilderAggregation =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "latest"
  | "count_rows"
  | "count_non_empty";
export type DataFlowBuilderResultFormat = "number" | "currency" | "percent";
export type DataFlowBuilderGeneralTabSlot = "hero" | "financial";
export type DataFlowBuilderNodeStatus = "ok" | "incomplete" | "error";
export type DataFlowBuilderGeneralTabLayoutBlockType =
  | "progress"
  | "curve"
  | "general_info"
  | "financial"
  | "configured_fields"
  | "certificates"
  | "custom_result";
export type DataFlowBuilderGeneralTabLayoutWidth = "one_third" | "half" | "two_thirds" | "full";

export type DataFlowBuilderSourceColumn = {
  key: string;
  label: string;
  dataType: string;
};

export type DataFlowBuilderTableSource = {
  id: string;
  name: string;
  columns: DataFlowBuilderSourceColumn[];
};

export type DataFlowBuilderMacroSource = {
  id: string;
  name: string;
  columns: DataFlowBuilderSourceColumn[];
};

export type DataFlowBuilderSources = {
  tables: DataFlowBuilderTableSource[];
  macroTables: DataFlowBuilderMacroSource[];
  obraFields: DataFlowBuilderObraFieldSource[];
};

export type DataFlowBuilderObraFieldSource = {
  id: string;
  label: string;
  dataType: string;
};

export type DataFlowBuilderFormulaInput = {
  id: string;
  alias: string;
  sourceType: DataFlowBuilderFormulaInputSourceType;
  sourceId: string;
  fieldKey: string | null;
  aggregation: DataFlowBuilderAggregation | null;
};

export type DataFlowBuilderAggregateCalculation = {
  id: string;
  label: string;
  mode: "aggregate";
  description: string;
  sourceType: DataFlowBuilderSourceType;
  sourceId: string;
  fieldKey: string | null;
  aggregation: DataFlowBuilderAggregation;
};

export type DataFlowBuilderFormulaCalculation = {
  id: string;
  label: string;
  mode: "formula";
  description: string;
  expression: string;
  inputs: DataFlowBuilderFormulaInput[];
};

export type DataFlowBuilderCalculation =
  | DataFlowBuilderAggregateCalculation
  | DataFlowBuilderFormulaCalculation;

export type DataFlowBuilderResult = {
  id: string;
  label: string;
  description: string;
  calculationId: string | null;
  format: DataFlowBuilderResultFormat;
  decimals: number;
  generalTabSlot: DataFlowBuilderGeneralTabSlot;
  generalTabOrder: number;
};

export type DataFlowBuilderGeneralTabLayoutBlock = {
  id: string;
  type: DataFlowBuilderGeneralTabLayoutBlockType;
  label: string;
  enabled: boolean;
  order: number;
  width: DataFlowBuilderGeneralTabLayoutWidth;
  gridX?: number;
  gridY?: number;
  gridH?: number;
  resultId: string | null;
  fieldIds: string[];
};

export type DataFlowBuilderConfig = {
  version: 1;
  calculations: DataFlowBuilderCalculation[];
  results: DataFlowBuilderResult[];
  generalTabLayout: DataFlowBuilderGeneralTabLayoutBlock[];
};

export type EvaluatedDataFlowCalculation = {
  id: string;
  label: string;
  status: DataFlowBuilderNodeStatus;
  value: number | null;
  formattedValue: string;
  formulaSummary: string[];
  inputs: string[];
  errorMessage: string | null;
};

export type EvaluatedDataFlowResult = {
  id: string;
  label: string;
  status: DataFlowBuilderNodeStatus;
  value: number | null;
  formattedValue: string;
  description: string;
  calculationId: string | null;
  generalTabSlot: DataFlowBuilderGeneralTabSlot;
  generalTabOrder: number;
  format: DataFlowBuilderResultFormat;
};

export type EvaluatedDataFlowBuilder = {
  calculations: EvaluatedDataFlowCalculation[];
  results: EvaluatedDataFlowResult[];
};

type BuilderEvaluationContext = {
  supabase: SupabaseClient;
  obraId: string;
  tenantId: string;
  config: DataFlowBuilderConfig;
  obraValues?: Record<string, unknown>;
};

type BuilderRowRecord = {
  id: string;
  tabla_id: string;
  created_at: string | null;
  data: Record<string, unknown> | null;
};

const BUILDER_AGGREGATIONS = new Set<DataFlowBuilderAggregation>([
  "sum",
  "avg",
  "min",
  "max",
  "latest",
  "count_rows",
  "count_non_empty",
]);

export const BUILDER_DEFAULT_CALCULATION_IDS = {
  contract: "default_contract",
  certified: "default_certified",
  balance: "default_balance",
  progress: "default_progress",
} as const;

export const BUILDER_DEFAULT_RESULT_IDS = {
  progress: "default_result_progress",
  contract: "default_result_contract",
  certified: "default_result_certified",
  balance: "default_result_balance",
} as const;

export const DEFAULT_OBRA_FIELD_SOURCES: DataFlowBuilderObraFieldSource[] = [
  { id: "contrato_mas_ampliaciones", label: "Contrato + ampliaciones", dataType: "currency" },
  { id: "certificado_a_la_fecha", label: "Certificado a la fecha", dataType: "currency" },
  { id: "saldo_a_certificar", label: "Saldo a certificar", dataType: "currency" },
  { id: "porcentaje", label: "Porcentaje de avance", dataType: "percent" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampDecimals(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(6, Math.round(parsed)));
}

function normalizeAlias(value: unknown, fallback: string) {
  const raw = asString(value, fallback).trim();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizeFormulaInput(value: unknown, index: number): DataFlowBuilderFormulaInput | null {
  const record = asRecord(value);
  const legacyCalculationId = asString(record.calculationId).trim();
  const rawSourceType = asString(record.sourceType).trim();
  const sourceType: DataFlowBuilderFormulaInputSourceType =
    rawSourceType === "table" ||
    rawSourceType === "macro_table" ||
    rawSourceType === "calculation" ||
    rawSourceType === "obra_field"
      ? rawSourceType
      : legacyCalculationId
        ? "calculation"
        : "calculation";
  const sourceId = asString(record.sourceId).trim() || legacyCalculationId;
  if (!sourceId) return null;
  const aggregation = BUILDER_AGGREGATIONS.has(record.aggregation as DataFlowBuilderAggregation)
    ? (record.aggregation as DataFlowBuilderAggregation)
    : "sum";
  return {
    id: asString(record.id).trim() || `input-${index + 1}`,
    alias: normalizeAlias(record.alias, `input_${index + 1}`),
    sourceType,
    sourceId,
    fieldKey:
      sourceType === "calculation" || sourceType === "obra_field"
        ? null
        : asString(record.fieldKey).trim() || null,
    aggregation:
      sourceType === "calculation" || sourceType === "obra_field" ? null : aggregation,
  };
}

function normalizeCalculation(value: unknown, index: number): DataFlowBuilderCalculation | null {
  const record = asRecord(value);
  const mode = asString(record.mode) === "formula" ? "formula" : "aggregate";
  const id = asString(record.id).trim() || `calc_${index + 1}`;
  const label = asString(record.label).trim() || `Calculo ${index + 1}`;
  const description = asString(record.description).trim();

  if (mode === "formula") {
    const inputs = Array.isArray(record.inputs)
      ? record.inputs
          .map((input, inputIndex) => normalizeFormulaInput(input, inputIndex))
          .filter((input): input is DataFlowBuilderFormulaInput => Boolean(input))
      : [];

    return {
      id,
      label,
      mode,
      description,
      expression: asString(record.expression).trim(),
      inputs,
    };
  }

  const sourceType = asString(record.sourceType) === "macro_table" ? "macro_table" : "table";
  const aggregation = BUILDER_AGGREGATIONS.has(record.aggregation as DataFlowBuilderAggregation)
    ? (record.aggregation as DataFlowBuilderAggregation)
    : "sum";

  return {
    id,
    label,
    mode,
    description,
    sourceType,
    sourceId: asString(record.sourceId).trim(),
    fieldKey: asString(record.fieldKey).trim() || null,
    aggregation,
  };
}

function normalizeResult(value: unknown, index: number): DataFlowBuilderResult | null {
  const record = asRecord(value);
  const id = asString(record.id).trim() || `result_${index + 1}`;
  const label = asString(record.label).trim() || `Resultado ${index + 1}`;
  const format = new Set<DataFlowBuilderResultFormat>(["number", "currency", "percent"]).has(
    record.format as DataFlowBuilderResultFormat
  )
    ? (record.format as DataFlowBuilderResultFormat)
    : "number";
  const generalTabSlot =
    asString(record.generalTabSlot) === "financial" ? "financial" : "hero";

  return {
    id,
    label,
    description: asString(record.description).trim(),
    calculationId: asString(record.calculationId).trim() || null,
    format,
    decimals: clampDecimals(record.decimals),
    generalTabSlot,
    generalTabOrder: asNumber(record.generalTabOrder, index + 1),
  };
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeLayoutBlock(value: unknown, index: number): DataFlowBuilderGeneralTabLayoutBlock | null {
  const record = asRecord(value);
  const rawType = asString(record.type).trim();
  const type: DataFlowBuilderGeneralTabLayoutBlockType =
    rawType === "progress" ||
    rawType === "curve" ||
    rawType === "general_info" ||
    rawType === "financial" ||
    rawType === "configured_fields" ||
    rawType === "certificates" ||
    rawType === "custom_result"
      ? rawType
      : "custom_result";
  const rawWidth = asString(record.width).trim();
  const width: DataFlowBuilderGeneralTabLayoutWidth =
    rawWidth === "one_third" ||
    rawWidth === "half" ||
    rawWidth === "two_thirds" ||
    rawWidth === "full"
      ? rawWidth
      : type === "progress"
        ? "one_third"
        : type === "curve"
          ? "two_thirds"
          : type === "configured_fields"
            ? "full"
            : "half";
  const defaultGridHeight =
    type === "progress" || type === "curve" || type === "general_info" || type === "financial"
      ? 5
      : 4;
  return {
    id: asString(record.id).trim() || `layout_${index + 1}`,
    type,
    label: asString(record.label).trim() || `Bloque ${index + 1}`,
    enabled: record.enabled !== false,
    order: asNumber(record.order, index + 1),
    width,
    gridX: Math.max(0, Math.min(11, asNumber(record.gridX, 0))),
    gridY: Math.max(0, asNumber(record.gridY, index)),
    gridH: Math.max(2, Math.min(12, asNumber(record.gridH, defaultGridHeight))),
    resultId: asString(record.resultId).trim() || null,
    fieldIds: normalizeStringList(record.fieldIds),
  };
}

function buildDefaultDataFlowBuilderCalculations(): DataFlowBuilderCalculation[] {
  return [
    {
      id: BUILDER_DEFAULT_CALCULATION_IDS.contract,
      label: "Contrato + ampliaciones",
      mode: "formula",
      description: "Base financiera tomada desde el campo principal de la obra.",
      expression: "contrato",
      inputs: [
        {
          id: "default-input-contract",
          alias: "contrato",
          sourceType: "obra_field",
          sourceId: "contrato_mas_ampliaciones",
          fieldKey: null,
          aggregation: null,
        },
      ],
    },
    {
      id: BUILDER_DEFAULT_CALCULATION_IDS.certified,
      label: "Certificado a la fecha",
      mode: "formula",
      description: "Monto certificado acumulado actualmente guardado en la obra.",
      expression: "certificado",
      inputs: [
        {
          id: "default-input-certified",
          alias: "certificado",
          sourceType: "obra_field",
          sourceId: "certificado_a_la_fecha",
          fieldKey: null,
          aggregation: null,
        },
      ],
    },
    {
      id: BUILDER_DEFAULT_CALCULATION_IDS.balance,
      label: "Saldo a certificar",
      mode: "formula",
      description: "Diferencia entre contrato y certificado acumulado.",
      expression: "contrato - certificado",
      inputs: [
        {
          id: "default-input-balance-contract",
          alias: "contrato",
          sourceType: "calculation",
          sourceId: BUILDER_DEFAULT_CALCULATION_IDS.contract,
          fieldKey: null,
          aggregation: null,
        },
        {
          id: "default-input-balance-certified",
          alias: "certificado",
          sourceType: "calculation",
          sourceId: BUILDER_DEFAULT_CALCULATION_IDS.certified,
          fieldKey: null,
          aggregation: null,
        },
      ],
    },
    {
      id: BUILDER_DEFAULT_CALCULATION_IDS.progress,
      label: "Porcentaje de avance",
      mode: "formula",
      description: "Relacion porcentual entre certificado acumulado y contrato.",
      expression: "certificado / contrato * 100",
      inputs: [
        {
          id: "default-input-progress-contract",
          alias: "contrato",
          sourceType: "calculation",
          sourceId: BUILDER_DEFAULT_CALCULATION_IDS.contract,
          fieldKey: null,
          aggregation: null,
        },
        {
          id: "default-input-progress-certified",
          alias: "certificado",
          sourceType: "calculation",
          sourceId: BUILDER_DEFAULT_CALCULATION_IDS.certified,
          fieldKey: null,
          aggregation: null,
        },
      ],
    },
  ];
}

function buildDefaultDataFlowBuilderResults(): DataFlowBuilderResult[] {
  return [
    {
      id: BUILDER_DEFAULT_RESULT_IDS.progress,
      label: "Avance",
      description: "Porcentaje de avance guardado en General y contrastado con Curva Plan + PMC Resumen.",
      calculationId: BUILDER_DEFAULT_CALCULATION_IDS.progress,
      format: "percent",
      decimals: 0,
      generalTabSlot: "hero",
      generalTabOrder: 1,
    },
    {
      id: BUILDER_DEFAULT_RESULT_IDS.contract,
      label: "Contrato",
      description: "Contrato + ampliaciones guardado en la obra.",
      calculationId: BUILDER_DEFAULT_CALCULATION_IDS.contract,
      format: "currency",
      decimals: 0,
      generalTabSlot: "financial",
      generalTabOrder: 2,
    },
    {
      id: BUILDER_DEFAULT_RESULT_IDS.certified,
      label: "Certificado",
      description: "Certificado a la fecha guardado en General.",
      calculationId: BUILDER_DEFAULT_CALCULATION_IDS.certified,
      format: "currency",
      decimals: 0,
      generalTabSlot: "financial",
      generalTabOrder: 3,
    },
    {
      id: BUILDER_DEFAULT_RESULT_IDS.balance,
      label: "Saldo a certificar",
      description: "Saldo a certificar guardado en General.",
      calculationId: BUILDER_DEFAULT_CALCULATION_IDS.balance,
      format: "currency",
      decimals: 0,
      generalTabSlot: "financial",
      generalTabOrder: 4,
    },
  ];
}

function buildDefaultGeneralTabLayout(): DataFlowBuilderGeneralTabLayoutBlock[] {
  return [
    {
      id: "layout_progress",
      type: "progress",
      label: "Avance",
      enabled: true,
      order: 1,
      width: "one_third",
      gridX: 0,
      gridY: 0,
      gridH: 5,
      resultId: BUILDER_DEFAULT_RESULT_IDS.progress,
      fieldIds: ["findings"],
    },
    {
      id: "layout_curve",
      type: "curve",
      label: "Curva de avance",
      enabled: true,
      order: 2,
      width: "two_thirds",
      gridX: 4,
      gridY: 0,
      gridH: 5,
      resultId: null,
      fieldIds: [],
    },
    {
      id: "layout_general_info",
      type: "general_info",
      label: "Informacion General",
      enabled: true,
      order: 3,
      width: "half",
      gridX: 0,
      gridY: 5,
      gridH: 5,
      resultId: null,
      fieldIds: [
        "designacionYUbicacion",
        "entidadContratante",
        "mesBasicoDeContrato",
        "iniciacion",
        "n",
        "supDeObraM2",
      ],
    },
    {
      id: "layout_financial",
      type: "financial",
      label: "Datos Financieros",
      enabled: true,
      order: 4,
      width: "half",
      gridX: 6,
      gridY: 5,
      gridH: 5,
      resultId: null,
      fieldIds: [
        BUILDER_DEFAULT_RESULT_IDS.contract,
        BUILDER_DEFAULT_RESULT_IDS.certified,
        BUILDER_DEFAULT_RESULT_IDS.balance,
        "segunContrato",
        "prorrogasAcordadas",
        "plazoTotal",
        "plazoTransc",
      ],
    },
    {
      id: "layout_configured_fields",
      type: "configured_fields",
      label: "Campos Configurados",
      enabled: true,
      order: 5,
      width: "full",
      gridX: 0,
      gridY: 10,
      gridH: 4,
      resultId: null,
      fieldIds: ["*"],
    },
    {
      id: "layout_certificates",
      type: "certificates",
      label: "Certificados",
      enabled: true,
      order: 6,
      width: "half",
      gridX: 0,
      gridY: 14,
      gridH: 4,
      resultId: null,
      fieldIds: [],
    },
  ];
}

export function mergeDataFlowBuilderConfigs(
  ...configs: DataFlowBuilderConfig[]
): DataFlowBuilderConfig {
  const calculationsById = new Map<string, DataFlowBuilderCalculation>();
  const resultsById = new Map<string, DataFlowBuilderResult>();
  const layoutById = new Map<string, DataFlowBuilderGeneralTabLayoutBlock>();

  for (const config of configs) {
    for (const calculation of config.calculations) {
      calculationsById.set(calculation.id, calculation);
    }
    for (const result of config.results) {
      resultsById.set(result.id, result);
    }
    for (const block of config.generalTabLayout) {
      layoutById.set(block.id, block);
    }
  }

  return {
    version: 1,
    calculations: [...calculationsById.values()],
    results: [...resultsById.values()],
    generalTabLayout: [...layoutById.values()].sort((left, right) => left.order - right.order),
  };
}

function getRawDataFlowBuilderConfig(rawValue: unknown): DataFlowBuilderConfig {
  const raw = asRecord(rawValue);
  const calculations = Array.isArray(raw.calculations)
    ? raw.calculations
        .map((calculation, index) => normalizeCalculation(calculation, index))
        .filter((calculation): calculation is DataFlowBuilderCalculation => Boolean(calculation))
    : [];
  const results = Array.isArray(raw.results)
    ? raw.results
        .map((result, index) => normalizeResult(result, index))
        .filter((result): result is DataFlowBuilderResult => Boolean(result))
    : [];
  const generalTabLayout = Array.isArray(raw.generalTabLayout)
    ? raw.generalTabLayout
        .map((block, index) => normalizeLayoutBlock(block, index))
        .filter((block): block is DataFlowBuilderGeneralTabLayoutBlock => Boolean(block))
    : [];

  return {
    version: 1,
    calculations,
    results,
    generalTabLayout,
  };
}

export function getObraDataFlowBuilderConfig(customData: unknown): DataFlowBuilderConfig {
  const root = asRecord(customData);
  return getRawDataFlowBuilderConfig(root.dataFlowBuilder);
}

export function getTenantDataFlowBuilderConfig(settings: unknown): DataFlowBuilderConfig {
  const root = asRecord(settings);
  const rawConfig = getRawDataFlowBuilderConfig(root.dataFlowBuilder);
  return mergeDataFlowBuilderConfigs(
    {
      version: 1,
      calculations: buildDefaultDataFlowBuilderCalculations(),
      results: buildDefaultDataFlowBuilderResults(),
      generalTabLayout: buildDefaultGeneralTabLayout(),
    },
    rawConfig
  );
}

export function setObraDataFlowBuilderConfig(
  customData: unknown,
  config: DataFlowBuilderConfig
): Record<string, unknown> {
  const root = asRecord(customData);
  return {
    ...root,
    dataFlowBuilder: {
      version: 1,
      calculations: config.calculations,
      results: config.results,
      generalTabLayout: config.generalTabLayout,
    },
  };
}

export function setTenantDataFlowBuilderConfig(
  settings: unknown,
  config: DataFlowBuilderConfig
): Record<string, unknown> {
  const root = asRecord(settings);
  return {
    ...root,
    dataFlowBuilder: {
      version: 1,
      calculations: config.calculations,
      results: config.results,
      generalTabLayout: config.generalTabLayout,
    },
  };
}

export async function listTenantDataFlowSources({
  supabase,
  tenantId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
}): Promise<DataFlowBuilderSources> {
  const { data: defaultTables, error: defaultTablesError } = await supabase
    .from("obra_default_tablas")
    .select("id, name, position")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });
  if (defaultTablesError) throw defaultTablesError;

  const defaultTableIds = (defaultTables ?? []).map((table) => table.id as string);
  const defaultColumnsByTableId = new Map<string, DataFlowBuilderSourceColumn[]>();
  if (defaultTableIds.length > 0) {
    const { data: defaultColumns, error: defaultColumnsError } = await supabase
      .from("obra_default_tabla_columns")
      .select("default_tabla_id, field_key, label, data_type, position")
      .in("default_tabla_id", defaultTableIds)
      .order("position", { ascending: true });
    if (defaultColumnsError) throw defaultColumnsError;

    for (const column of defaultColumns ?? []) {
      const tableId = column.default_tabla_id as string;
      if (!defaultColumnsByTableId.has(tableId)) defaultColumnsByTableId.set(tableId, []);
      defaultColumnsByTableId.get(tableId)?.push({
        key: column.field_key as string,
        label: (column.label as string) ?? (column.field_key as string),
        dataType: typeof column.data_type === "string" ? column.data_type : "text",
      });
    }
  }

  const tables: DataFlowBuilderTableSource[] = (defaultTables ?? []).map((table) => ({
    id: table.id as string,
    name: table.name as string,
    columns: defaultColumnsByTableId.get(table.id as string) ?? [],
  }));

  const { data: macroTablesRaw, error: macroTablesError } = await supabase
    .from("macro_tables")
    .select("id, name, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (macroTablesError) throw macroTablesError;

  const macroTableIds = (macroTablesRaw ?? []).map((table) => table.id as string);
  const macroColumnsById = new Map<string, DataFlowBuilderSourceColumn[]>();
  if (macroTableIds.length > 0) {
    const { data: macroColumns, error: macroColumnsError } = await supabase
      .from("macro_table_columns")
      .select("macro_table_id, source_field_key, label, data_type, position")
      .in("macro_table_id", macroTableIds)
      .order("position", { ascending: true });
    if (macroColumnsError) throw macroColumnsError;

    for (const column of macroColumns ?? []) {
      const macroId = column.macro_table_id as string;
      if (!macroColumnsById.has(macroId)) macroColumnsById.set(macroId, []);
      const sourceFieldKey =
        typeof column.source_field_key === "string" ? (column.source_field_key as string).trim() : "";
      if (!sourceFieldKey) continue;
      macroColumnsById.get(macroId)?.push({
        key: sourceFieldKey,
        label: (column.label as string) ?? sourceFieldKey,
        dataType: typeof column.data_type === "string" ? column.data_type : "text",
      });
    }
  }

  const macroTables: DataFlowBuilderMacroSource[] = (macroTablesRaw ?? []).map((table) => ({
    id: table.id as string,
    name: table.name as string,
    columns: macroColumnsById.get(table.id as string) ?? [],
  }));

  return {
    tables,
    macroTables,
    obraFields: DEFAULT_OBRA_FIELD_SOURCES,
  };
}

function toNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/[%$€£\s]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceBuilderNumericValue(value: unknown): number | null {
  return toNumericValue(value) ?? parseNumericValue(value);
}

function formatBuilderValue(
  value: number | null,
  format: DataFlowBuilderResultFormat,
  decimals: number
) {
  if (value == null || !Number.isFinite(value)) return "-";
  if (format === "currency") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  if (format === "percent") {
    return `${new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)}%`;
  }
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function aggregateRows(
  rows: BuilderRowRecord[],
  fieldKey: string | null,
  aggregation: DataFlowBuilderAggregation
): { value: number | null; errorMessage: string | null } {
  if (aggregation === "count_rows") {
    return { value: rows.length, errorMessage: null };
  }

  if (!fieldKey) {
    return { value: null, errorMessage: "Falta la columna para resolver este agregado." };
  }

  if (aggregation === "latest") {
    const latestValue = [...rows]
      .sort((left, right) => {
        const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
        const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
        return rightTime - leftTime;
      })
      .map((row) => coerceBuilderNumericValue(asRecord(row.data)[fieldKey]))
      .find((value) => value != null);
    return { value: latestValue ?? null, errorMessage: latestValue == null ? "No hay valores numericos para la columna elegida." : null };
  }

  const values = rows
    .map((row) => asRecord(row.data)[fieldKey])
    .filter((value) => value != null && String(value).trim().length > 0);

  if (aggregation === "count_non_empty") {
    return { value: values.length, errorMessage: null };
  }

  const numericValues = values
    .map((value) => coerceBuilderNumericValue(value))
    .filter((value): value is number => value != null);

  if (numericValues.length === 0) {
    return { value: null, errorMessage: "No hay valores numericos para la columna elegida." };
  }

  if (aggregation === "sum") {
    return { value: numericValues.reduce((total, current) => total + current, 0), errorMessage: null };
  }
  if (aggregation === "avg") {
    return {
      value: numericValues.reduce((total, current) => total + current, 0) / numericValues.length,
      errorMessage: null,
    };
  }
  if (aggregation === "min") {
    return { value: Math.min(...numericValues), errorMessage: null };
  }
  if (aggregation === "max") {
    return { value: Math.max(...numericValues), errorMessage: null };
  }

  return { value: null, errorMessage: "Agregacion no soportada." };
}

function describeBuilderSourceValue(
  sourceType: DataFlowBuilderFormulaInputSourceType,
  sourceId: string,
  fieldKey: string | null,
  aggregation: DataFlowBuilderAggregation | null
) {
  if (sourceType === "calculation") {
    return `calculation:${sourceId}`;
  }
  if (sourceType === "obra_field") {
    return `obra_field:${sourceId}`;
  }
  return `${aggregation ?? "sum"}(${sourceType}:${sourceId}${fieldKey ? `.${fieldKey}` : ""})`;
}

function evaluateExpression(
  expression: string,
  variables: Record<string, number>
): { value: number | null; errorMessage: string | null } {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { value: null, errorMessage: "La expresion esta vacia." };
  }

  if (!/^[0-9a-zA-Z_+\-*/().,\s%]+$/.test(trimmed)) {
    return { value: null, errorMessage: "La expresion contiene caracteres no permitidos." };
  }

  try {
    const aliases = Object.keys(variables);
    const fn = new Function(...aliases, `return (${trimmed});`);
    const result = fn(...aliases.map((alias) => variables[alias]));
    const parsed = coerceBuilderNumericValue(result);
    return parsed == null
      ? { value: null, errorMessage: "La expresion no devolvio un numero valido." }
      : { value: parsed, errorMessage: null };
  } catch (error) {
    return {
      value: null,
      errorMessage: error instanceof Error ? error.message : "No se pudo evaluar la expresion.",
    };
  }
}

export async function listObraDataFlowSources({
  supabase,
  tenantId,
  obraId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  obraId: string;
}): Promise<DataFlowBuilderSources> {
  const { data: tablas, error: tablasError } = await supabase
    .from("obra_tablas")
    .select("id, name, created_at")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: true });

  if (tablasError) throw tablasError;

  const tableIds = (tablas ?? []).map((table) => table.id as string);
  const columnsByTableId = new Map<string, DataFlowBuilderSourceColumn[]>();
  if (tableIds.length > 0) {
    const { data: columns, error: columnsError } = await supabase
      .from("obra_tabla_columns")
      .select("tabla_id, field_key, label, data_type, position")
      .in("tabla_id", tableIds)
      .order("position", { ascending: true });
    if (columnsError) throw columnsError;

    for (const column of columns ?? []) {
      const tableId = column.tabla_id as string;
      if (!columnsByTableId.has(tableId)) columnsByTableId.set(tableId, []);
      columnsByTableId.get(tableId)?.push({
        key: column.field_key as string,
        label: (column.label as string) ?? (column.field_key as string),
        dataType: typeof column.data_type === "string" ? column.data_type : "text",
      });
    }
  }

  const tables: DataFlowBuilderTableSource[] = (tablas ?? []).map((table) => ({
    id: table.id as string,
    name: table.name as string,
    columns: columnsByTableId.get(table.id as string) ?? [],
  }));

  const { data: macroSources, error: macroSourcesError } = tableIds.length
    ? await supabase
        .from("macro_table_sources")
        .select(`
          macro_table_id,
          obra_tabla_id,
          macro_tables!inner(id, tenant_id, name)
        `)
        .in("obra_tabla_id", tableIds)
    : { data: [], error: null };

  if (macroSourcesError) throw macroSourcesError;

  const macroTableIds = [...new Set((macroSources ?? []).map((source) => source.macro_table_id as string))];
  const macroNameById = new Map<string, string>();
  for (const source of macroSources ?? []) {
    const macro = Array.isArray(source.macro_tables) ? source.macro_tables[0] : source.macro_tables;
    if (!macro) continue;
    if (macro.tenant_id !== tenantId) continue;
    macroNameById.set(macro.id as string, macro.name as string);
  }

  const macroColumnsById = new Map<string, DataFlowBuilderSourceColumn[]>();
  if (macroTableIds.length > 0) {
    const { data: macroColumns, error: macroColumnsError } = await supabase
      .from("macro_table_columns")
      .select("macro_table_id, source_field_key, label, data_type, position")
      .in("macro_table_id", macroTableIds)
      .order("position", { ascending: true });
    if (macroColumnsError) throw macroColumnsError;

    for (const column of macroColumns ?? []) {
      const sourceFieldKey =
        typeof column.source_field_key === "string" ? (column.source_field_key as string).trim() : "";
      if (!sourceFieldKey) continue;
      const macroId = column.macro_table_id as string;
      if (!macroColumnsById.has(macroId)) macroColumnsById.set(macroId, []);
      macroColumnsById.get(macroId)?.push({
        key: sourceFieldKey,
        label: (column.label as string) ?? sourceFieldKey,
        dataType: typeof column.data_type === "string" ? column.data_type : "text",
      });
    }
  }

  const macroTables: DataFlowBuilderMacroSource[] = macroTableIds
    .filter((macroId) => macroNameById.has(macroId))
    .map((macroId) => ({
      id: macroId,
      name: macroNameById.get(macroId) ?? macroId,
      columns: macroColumnsById.get(macroId) ?? [],
    }));

  return { tables, macroTables, obraFields: DEFAULT_OBRA_FIELD_SOURCES };
}

export async function evaluateObraDataFlowBuilder({
  supabase,
  obraId,
  tenantId,
  config,
  obraValues,
}: BuilderEvaluationContext): Promise<EvaluatedDataFlowBuilder> {
  const { data: obraTables, error: obraTablesError } = await supabase
    .from("obra_tablas")
    .select("id, settings")
    .eq("obra_id", obraId);
  if (obraTablesError) throw obraTablesError;

  const defaultTableToObraTableId = new Map<string, string>();
  for (const table of obraTables ?? []) {
    const settings = asRecord(table.settings);
    const defaultTableId = asString(settings.defaultTablaId).trim();
    if (defaultTableId && !defaultTableToObraTableId.has(defaultTableId)) {
      defaultTableToObraTableId.set(defaultTableId, table.id as string);
    }
  }

  function resolveTableSourceId(sourceId: string) {
    return defaultTableToObraTableId.get(sourceId) ?? sourceId;
  }

  const tableIds = new Set<string>();
  const macroIds = new Set<string>();
  function collectSourceId(sourceType: DataFlowBuilderSourceType, sourceId: string) {
    if (!sourceId) return;
    if (sourceType === "table") {
      tableIds.add(resolveTableSourceId(sourceId));
      return;
    }
    macroIds.add(sourceId);
  }

  for (const calculation of config.calculations) {
    if (calculation.mode === "aggregate") {
      collectSourceId(calculation.sourceType, calculation.sourceId);
      continue;
    }
    for (const input of calculation.inputs) {
      if (input.sourceType === "calculation" || input.sourceType === "obra_field") continue;
      collectSourceId(input.sourceType, input.sourceId);
    }
  }

  const rowsByTableId = new Map<string, BuilderRowRecord[]>();
  const allTableIds = [...tableIds];

  if (allTableIds.length > 0) {
    const { data: rows, error: rowsError } = await supabase
      .from("obra_tabla_rows")
      .select("id, tabla_id, data, created_at")
      .in("tabla_id", allTableIds);
    if (rowsError) throw rowsError;
    for (const row of rows ?? []) {
      const tableId = row.tabla_id as string;
      if (!rowsByTableId.has(tableId)) rowsByTableId.set(tableId, []);
      rowsByTableId.get(tableId)?.push({
        id: row.id as string,
        tabla_id: tableId,
        created_at: (row.created_at as string | null) ?? null,
        data:
          row.data && typeof row.data === "object" && !Array.isArray(row.data)
            ? (row.data as Record<string, unknown>)
            : {},
      });
    }
  }

  const macroTableToSourceIds = new Map<string, string[]>();
  if (macroIds.size > 0) {
    const { data: macroSources, error: macroSourcesError } = await supabase
      .from("macro_table_sources")
      .select(`
        macro_table_id,
        obra_tabla_id,
        obra_tablas!inner(id, obra_id, obras!inner(tenant_id))
      `)
      .in("macro_table_id", [...macroIds]);
    if (macroSourcesError) throw macroSourcesError;

    for (const source of macroSources ?? []) {
      const tabla = Array.isArray(source.obra_tablas) ? source.obra_tablas[0] : source.obra_tablas;
      const obraRef = tabla && typeof tabla === "object" ? (tabla as { obra_id?: unknown; obras?: unknown }) : {};
      const obraNested = Array.isArray(obraRef.obras) ? obraRef.obras[0] : obraRef.obras;
      const tenantRef =
        obraNested && typeof obraNested === "object" ? (obraNested as { tenant_id?: unknown }) : {};
      if (obraRef.obra_id !== obraId || tenantRef.tenant_id !== tenantId) continue;

      const macroId = source.macro_table_id as string;
      if (!macroTableToSourceIds.has(macroId)) macroTableToSourceIds.set(macroId, []);
      macroTableToSourceIds.get(macroId)?.push(source.obra_tabla_id as string);
      if (!rowsByTableId.has(source.obra_tabla_id as string)) {
        tableIds.add(source.obra_tabla_id as string);
      }
    }
  }

  const missingTableRows = [...tableIds].filter((tableId) => !rowsByTableId.has(tableId));
  if (missingTableRows.length > 0) {
    const { data: rows, error: rowsError } = await supabase
      .from("obra_tabla_rows")
      .select("id, tabla_id, data, created_at")
      .in("tabla_id", missingTableRows);
    if (rowsError) throw rowsError;
    for (const row of rows ?? []) {
      const tableId = row.tabla_id as string;
      if (!rowsByTableId.has(tableId)) rowsByTableId.set(tableId, []);
      rowsByTableId.get(tableId)?.push({
        id: row.id as string,
        tabla_id: tableId,
        created_at: (row.created_at as string | null) ?? null,
        data:
          row.data && typeof row.data === "object" && !Array.isArray(row.data)
            ? (row.data as Record<string, unknown>)
            : {},
      });
    }
  }

  const calculationsById = new Map(config.calculations.map((calculation) => [calculation.id, calculation]));
  const cache = new Map<string, EvaluatedDataFlowCalculation>();

  function getRowsForSource(sourceType: DataFlowBuilderSourceType, sourceId: string) {
    if (sourceType === "table") {
      return rowsByTableId.get(resolveTableSourceId(sourceId)) ?? [];
    }
    return (macroTableToSourceIds.get(sourceId) ?? []).flatMap((tableId) => rowsByTableId.get(tableId) ?? []);
  }

  function evaluateCalculation(id: string, stack: string[] = []): EvaluatedDataFlowCalculation {
    if (cache.has(id)) return cache.get(id)!;
    const calculation = calculationsById.get(id);
    if (!calculation) {
      const missing = {
        id,
        label: id,
        status: "error" as const,
        value: null,
        formattedValue: "-",
        formulaSummary: ["Calculo inexistente."],
        inputs: [],
        errorMessage: "Calculo inexistente.",
      };
      cache.set(id, missing);
      return missing;
    }

    if (stack.includes(id)) {
      const cyclic = {
        id,
        label: calculation.label,
        status: "error" as const,
        value: null,
        formattedValue: "-",
        formulaSummary: ["Se detecto un ciclo entre calculos custom."],
        inputs: stack,
        errorMessage: "Ciclo de dependencias.",
      };
      cache.set(id, cyclic);
      return cyclic;
    }

    if (calculation.mode === "aggregate") {
      const sourceRows = getRowsForSource(calculation.sourceType, calculation.sourceId);
      const aggregated = aggregateRows(sourceRows, calculation.fieldKey, calculation.aggregation);
      const result: EvaluatedDataFlowCalculation = {
        id: calculation.id,
        label: calculation.label,
        status: aggregated.value != null ? "ok" : aggregated.errorMessage ? "incomplete" : "error",
        value: aggregated.value,
        formattedValue: formatBuilderValue(aggregated.value, "number", 2),
        formulaSummary: [
          `${calculation.aggregation}(${calculation.sourceType}:${calculation.sourceId}${calculation.fieldKey ? `.${calculation.fieldKey}` : ""})`,
        ],
        inputs: [calculation.sourceId],
        errorMessage: aggregated.errorMessage,
      };
      cache.set(id, result);
      return result;
    }

    const variables: Record<string, number> = {};
    const inputIds: string[] = [];
    const resolvedInputSummary: string[] = [];
    for (const input of calculation.inputs) {
      inputIds.push(input.sourceId);
      const inputLabel = describeBuilderSourceValue(
        input.sourceType,
        input.sourceId,
        input.fieldKey,
        input.aggregation
      );

      if (input.sourceType === "calculation") {
        const inputEvaluation = evaluateCalculation(input.sourceId, [...stack, id]);
        if (inputEvaluation.value == null) {
          const missingInput: EvaluatedDataFlowCalculation = {
            id: calculation.id,
            label: calculation.label,
            status: "incomplete",
            value: null,
            formattedValue: "-",
            formulaSummary: [
              calculation.expression || "Formula vacia.",
              `Input faltante: ${input.alias} -> ${inputLabel}`,
            ],
            inputs: inputIds,
            errorMessage: `No se pudo resolver ${input.alias}.`,
          };
          cache.set(id, missingInput);
          return missingInput;
        }
        variables[input.alias] = inputEvaluation.value;
        resolvedInputSummary.push(`${input.alias} = ${inputLabel}`);
        continue;
      }

      if (input.sourceType === "obra_field") {
        const obraValue = coerceBuilderNumericValue(asRecord(obraValues)[input.sourceId]);
        if (obraValue == null) {
          const missingInput: EvaluatedDataFlowCalculation = {
            id: calculation.id,
            label: calculation.label,
            status: "incomplete",
            value: null,
            formattedValue: "-",
            formulaSummary: [
              calculation.expression || "Formula vacia.",
              `Input faltante: ${input.alias} -> ${inputLabel}`,
            ],
            inputs: inputIds,
            errorMessage: `No se pudo resolver ${input.alias}.`,
          };
          cache.set(id, missingInput);
          return missingInput;
        }
        variables[input.alias] = obraValue;
        resolvedInputSummary.push(`${input.alias} = ${inputLabel}`);
        continue;
      }

      const aggregated = aggregateRows(
        getRowsForSource(input.sourceType, input.sourceId),
        input.fieldKey,
        input.aggregation ?? "sum"
      );
      if (aggregated.value == null) {
        const missingInput: EvaluatedDataFlowCalculation = {
          id: calculation.id,
          label: calculation.label,
          status: "incomplete",
          value: null,
          formattedValue: "-",
          formulaSummary: [
            calculation.expression || "Formula vacia.",
            `Input faltante: ${input.alias} -> ${inputLabel}`,
          ],
          inputs: inputIds,
          errorMessage: `No se pudo resolver ${input.alias}.`,
        };
        cache.set(id, missingInput);
        return missingInput;
      }
      variables[input.alias] = aggregated.value;
      resolvedInputSummary.push(`${input.alias} = ${inputLabel}`);
    }

    const evaluated = evaluateExpression(calculation.expression, variables);
    const result: EvaluatedDataFlowCalculation = {
      id: calculation.id,
      label: calculation.label,
      status: evaluated.value != null ? "ok" : evaluated.errorMessage ? "incomplete" : "error",
      value: evaluated.value,
      formattedValue: formatBuilderValue(evaluated.value, "number", 2),
      formulaSummary: [
        calculation.expression || "Formula vacia.",
        ...resolvedInputSummary,
      ],
      inputs: inputIds,
      errorMessage: evaluated.errorMessage,
    };
    cache.set(id, result);
    return result;
  }

  const calculations = config.calculations.map((calculation) => evaluateCalculation(calculation.id));
  const calculationValueById = new Map(calculations.map((calculation) => [calculation.id, calculation]));
  const results = config.results
    .map((result) => {
      const evaluatedCalculation =
        result.calculationId != null ? calculationValueById.get(result.calculationId) ?? null : null;
      return {
        id: result.id,
        label: result.label,
        status:
          evaluatedCalculation?.status ??
          (result.calculationId ? "error" : "incomplete"),
        value: evaluatedCalculation?.value ?? null,
        formattedValue: formatBuilderValue(
          evaluatedCalculation?.value ?? null,
          result.format,
          result.decimals
        ),
        description: result.description,
        calculationId: result.calculationId,
        generalTabSlot: result.generalTabSlot,
        generalTabOrder: result.generalTabOrder,
        format: result.format,
      } satisfies EvaluatedDataFlowResult;
    })
    .sort((left, right) => {
      const slotWeight = (slot: DataFlowBuilderGeneralTabSlot) => (slot === "hero" ? 0 : 1000);
      return (
        slotWeight(left.generalTabSlot) +
        left.generalTabOrder -
        (slotWeight(right.generalTabSlot) + right.generalTabOrder)
      );
    });

  return { calculations, results };
}
