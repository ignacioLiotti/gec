import type { SupabaseClient } from "@supabase/supabase-js";

import { toNumericValue as parseNumericValue } from "@/lib/tablas";

export type DataFlowBuilderSourceType = "table" | "macro_table";
export type DataFlowBuilderCalculationMode = "aggregate" | "formula" | "text_template";
export type DataFlowBuilderFormulaInputSourceType = "calculation" | DataFlowBuilderSourceType | "obra_field";
export type DataFlowBuilderAggregation =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "latest"
  | "count_rows"
  | "count_non_empty";
export type DataFlowBuilderResultFormat = "number" | "currency" | "percent" | "text";
export type DataFlowBuilderWritebackMode = "none" | "suggest" | "auto";
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
export type DataFlowBuilderValue = number | string | null;

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
  source: "base" | "custom";
};

export type DataFlowBuilderFormulaInput = {
  id: string;
  alias: string;
  sourceType: DataFlowBuilderFormulaInputSourceType;
  sourceId: string;
  fieldKey: string | null;
  aggregation: DataFlowBuilderAggregation | null;
  sortFieldKey?: string | null;
};

export type DataFlowBuilderAggregateCalculation = {
  id: string;
  label: string;
  mode: "aggregate";
  description: string;
  deleted?: boolean;
  sourceType: DataFlowBuilderSourceType;
  sourceId: string;
  fieldKey: string | null;
  aggregation: DataFlowBuilderAggregation;
  sortFieldKey?: string | null;
};

export type DataFlowBuilderFormulaCalculation = {
  id: string;
  label: string;
  mode: "formula";
  description: string;
  deleted?: boolean;
  expression: string;
  inputs: DataFlowBuilderFormulaInput[];
};

export type DataFlowBuilderTextTemplateCalculation = {
  id: string;
  label: string;
  mode: "text_template";
  description: string;
  deleted?: boolean;
  template: string;
  inputs: DataFlowBuilderFormulaInput[];
};

export type DataFlowBuilderCalculation =
  | DataFlowBuilderAggregateCalculation
  | DataFlowBuilderFormulaCalculation
  | DataFlowBuilderTextTemplateCalculation;

export type DataFlowBuilderResult = {
  id: string;
  label: string;
  description: string;
  deleted?: boolean;
  calculationId: string | null;
  targetObraFieldId: string | null;
  writebackMode: DataFlowBuilderWritebackMode;
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
  value: DataFlowBuilderValue;
  formattedValue: string;
  formulaSummary: string[];
  inputs: string[];
  errorMessage: string | null;
};

export type EvaluatedDataFlowResult = {
  id: string;
  label: string;
  status: DataFlowBuilderNodeStatus;
  value: DataFlowBuilderValue;
  formattedValue: string;
  description: string;
  calculationId: string | null;
  targetObraFieldId: string | null;
  writebackMode: DataFlowBuilderWritebackMode;
  writebackStatus: "none" | "ready" | "blocked";
  writebackBlockReason: string | null;
  generalTabSlot: DataFlowBuilderGeneralTabSlot;
  generalTabOrder: number;
  format: DataFlowBuilderResultFormat;
};

export type EvaluatedDataFlowBuilder = {
  calculations: EvaluatedDataFlowCalculation[];
  results: EvaluatedDataFlowResult[];
};

export type DataFlowBuilderWritebackAction = {
  resultId: string;
  resultLabel: string;
  calculationId: string | null;
  targetObraFieldId: string;
  mode: Exclude<DataFlowBuilderWritebackMode, "none">;
  value: Exclude<DataFlowBuilderValue, null>;
  formattedValue: string;
  previousValue: unknown;
  status: "ready" | "blocked";
  blockReason: string | null;
  formulaSummary: string[];
};

export type DataFlowBuilderWritebackPlan = {
  actions: DataFlowBuilderWritebackAction[];
  blocked: DataFlowBuilderWritebackAction[];
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

export const CUSTOM_OBRA_FIELD_SOURCE_PREFIX = "custom:";
export const BUILDER_PRESET_TABLE_SOURCE_PREFIX = "preset:";
export const BUILDER_PRESET_TABLE_SOURCE_IDS = {
  pmcResumen: `${BUILDER_PRESET_TABLE_SOURCE_PREFIX}pmc_resumen`,
} as const;

export const DEFAULT_OBRA_FIELD_SOURCES: DataFlowBuilderObraFieldSource[] = [
  { id: "n", label: "N de obra", dataType: "number", source: "base" },
  { id: "designacion_y_ubicacion", label: "Designacion y ubicacion", dataType: "text", source: "base" },
  { id: "sup_de_obra_m2", label: "Superficie de obra m2", dataType: "number", source: "base" },
  { id: "entidad_contratante", label: "Entidad contratante", dataType: "text", source: "base" },
  { id: "mes_basico_de_contrato", label: "Mes basico de contrato", dataType: "date", source: "base" },
  { id: "iniciacion", label: "Iniciacion", dataType: "date", source: "base" },
  { id: "contrato_mas_ampliaciones", label: "Contrato + ampliaciones", dataType: "currency", source: "base" },
  { id: "certificado_a_la_fecha", label: "Certificado a la fecha", dataType: "currency", source: "base" },
  { id: "saldo_a_certificar", label: "Saldo a certificar", dataType: "currency", source: "base" },
  { id: "segun_contrato", label: "Segun contrato", dataType: "number", source: "base" },
  { id: "prorrogas_acordadas", label: "Prorrogas acordadas", dataType: "number", source: "base" },
  { id: "plazo_total", label: "Plazo total", dataType: "number", source: "base" },
  { id: "plazo_transc", label: "Plazo transcurrido", dataType: "number", source: "base" },
  { id: "porcentaje", label: "Porcentaje de avance", dataType: "percent", source: "base" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeLooseIdentifier(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanizeBuilderFieldKey(value: string) {
  return value
    .replace(/^custom:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeBuilderDataType(value: unknown): string {
  const raw = asString(value).trim();
  if (
    raw === "number" ||
    raw === "currency" ||
    raw === "percent" ||
    raw === "date" ||
    raw === "boolean" ||
    raw === "select" ||
    raw === "text"
  ) {
    return raw;
  }
  if (raw === "checkbox" || raw === "toggle") return "boolean";
  return "text";
}

function customObraFieldSourceId(columnId: string) {
  return `${CUSTOM_OBRA_FIELD_SOURCE_PREFIX}${columnId}`;
}

function sanitizeMainTableColumnSources(raw: unknown): DataFlowBuilderObraFieldSource[] {
  if (!Array.isArray(raw)) return [];
  const sources: DataFlowBuilderObraFieldSource[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const record = asRecord(item);
    const id = asString(record.id).trim();
    if (!id || seen.has(id) || record.kind !== "custom" || record.enabled === false) continue;
    seen.add(id);
    sources.push({
      id: customObraFieldSourceId(id),
      label: asString(record.label).trim() || humanizeBuilderFieldKey(id),
      dataType: normalizeBuilderDataType(record.cellType),
      source: "custom",
    });
  }
  return sources;
}

export function listObraFieldSourcesFromCustomData(
  customData: unknown,
  configuredSources: DataFlowBuilderObraFieldSource[] = []
) {
  const sources = [...DEFAULT_OBRA_FIELD_SOURCES, ...configuredSources];
  const seen = new Set(sources.map((source) => source.id));
  const root = asRecord(customData);
  for (const key of Object.keys(root)) {
    if (key === "dataFlowBuilder") continue;
    const sourceId = customObraFieldSourceId(key);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    sources.push({
      id: sourceId,
      label: humanizeBuilderFieldKey(key),
      dataType: "text",
      source: "custom",
    });
  }
  return sources;
}

export async function listObraFieldSources({
  supabase,
  tenantId,
  customData,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  customData?: unknown;
}): Promise<DataFlowBuilderObraFieldSource[]> {
  const { data, error } = await supabase
    .from("tenant_main_table_configs")
    .select("columns")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    if (error.code !== "42P01" && error.code !== "42703") throw error;
    return listObraFieldSourcesFromCustomData(customData);
  }

  return listObraFieldSourcesFromCustomData(
    customData,
    sanitizeMainTableColumnSources((data as { columns?: unknown } | null)?.columns)
  );
}

export function resolveObraFieldValue(obraValues: unknown, sourceId: string): unknown {
  const root = asRecord(obraValues);
  if (sourceId.startsWith(CUSTOM_OBRA_FIELD_SOURCE_PREFIX)) {
    const customKey = sourceId.slice(CUSTOM_OBRA_FIELD_SOURCE_PREFIX.length);
    return asRecord(root.custom_data)[customKey];
  }
  return root[sourceId];
}

function isSameBuilderValue(left: unknown, right: unknown) {
  const leftNumber = coerceBuilderNumericValue(left);
  const rightNumber = coerceBuilderNumericValue(right);
  if (leftNumber != null && rightNumber != null) return Math.abs(leftNumber - rightNumber) < 0.000001;
  return left === right;
}

function getCalculationObraFieldDependencies(
  config: DataFlowBuilderConfig,
  calculationId: string | null,
  stack: string[] = []
): Set<string> {
  if (!calculationId || stack.includes(calculationId)) return new Set();
  const calculation = config.calculations.find((candidate) => candidate.id === calculationId);
  if (!calculation) return new Set();
  if (calculation.mode === "aggregate") return new Set();

  const dependencies = new Set<string>();
  for (const input of calculation.inputs) {
    if (input.sourceType === "obra_field") {
      dependencies.add(input.sourceId);
      continue;
    }
    if (input.sourceType === "calculation") {
      for (const dependency of getCalculationObraFieldDependencies(config, input.sourceId, [...stack, calculationId])) {
        dependencies.add(dependency);
      }
    }
  }
  return dependencies;
}

export function buildObraResultWritebackPlan({
  config,
  evaluated,
  obraValues,
}: {
  config: DataFlowBuilderConfig;
  evaluated: EvaluatedDataFlowBuilder;
  obraValues: unknown;
}): DataFlowBuilderWritebackPlan {
  const baseFieldIds = new Set(
    DEFAULT_OBRA_FIELD_SOURCES
      .filter((source) => source.source === "base")
      .map((source) => source.id)
  );
  const evaluatedCalculationById = new Map(evaluated.calculations.map((calculation) => [calculation.id, calculation]));
  const configuredCalculationById = new Map(config.calculations.map((calculation) => [calculation.id, calculation]));
  const actions: DataFlowBuilderWritebackAction[] = [];
  const blocked: DataFlowBuilderWritebackAction[] = [];

  for (const result of evaluated.results) {
    const targetFieldId = result.targetObraFieldId?.trim();
    if (!targetFieldId || result.writebackMode === "none" || result.value == null) continue;

    const currentValue = resolveObraFieldValue(obraValues, targetFieldId);
    const targetIsCustom = targetFieldId.startsWith(CUSTOM_OBRA_FIELD_SOURCE_PREFIX);
    const targetIsBase = baseFieldIds.has(targetFieldId);
    const calculation = result.calculationId ? evaluatedCalculationById.get(result.calculationId) ?? null : null;
    const configuredCalculation = result.calculationId ? configuredCalculationById.get(result.calculationId) ?? null : null;
    const dependencies = getCalculationObraFieldDependencies(config, result.calculationId);
    const canSuggestTextFromSameField =
      result.writebackMode === "suggest" &&
      (result.format === "text" || typeof result.value === "string" || configuredCalculation?.mode === "text_template");
    let blockReason: string | null = null;

    if (!targetIsBase && !targetIsCustom) {
      blockReason = "El campo destino no existe como campo de obra permitido.";
    } else if (targetFieldId === `${CUSTOM_OBRA_FIELD_SOURCE_PREFIX}dataFlowBuilder`) {
      blockReason = "El campo interno dataFlowBuilder no puede ser sobrescrito.";
    } else if (result.status !== "ok") {
      blockReason = "El resultado no esta OK.";
    } else if (dependencies.has(targetFieldId) && !canSuggestTextFromSameField) {
      blockReason = "El resultado depende del mismo campo que intenta sobrescribir.";
    } else if (isSameBuilderValue(currentValue, result.value)) {
      blockReason = "El valor calculado es igual al valor actual.";
    }

    const action: DataFlowBuilderWritebackAction = {
      resultId: result.id,
      resultLabel: result.label,
      calculationId: result.calculationId,
      targetObraFieldId: targetFieldId,
      mode: result.writebackMode,
      value: result.value,
      formattedValue: result.formattedValue,
      previousValue: currentValue ?? null,
      status: blockReason ? "blocked" : "ready",
      blockReason,
      formulaSummary: calculation?.formulaSummary ?? [],
    };

    if (blockReason) blocked.push(action);
    else actions.push(action);
  }

  return { actions, blocked };
}

export function buildObraResultWritebackPatch({
  plan,
  customData,
}: {
  plan: DataFlowBuilderWritebackPlan;
  customData: unknown;
}) {
  const obraPatch: Record<string, unknown> = {};
  const nextCustomData = { ...asRecord(customData) };
  const writtenFields: string[] = [];

  for (const action of plan.actions.filter((candidate) => candidate.mode === "auto")) {
    const targetFieldId = action.targetObraFieldId;
    if (targetFieldId.startsWith(CUSTOM_OBRA_FIELD_SOURCE_PREFIX)) {
      const customKey = targetFieldId.slice(CUSTOM_OBRA_FIELD_SOURCE_PREFIX.length);
      nextCustomData[customKey] = action.value;
      writtenFields.push(targetFieldId);
      continue;
    }

    obraPatch[targetFieldId] = action.value;
    writtenFields.push(targetFieldId);
  }

  return { obraPatch, customData: nextCustomData, writtenFields };
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
    sortFieldKey:
      sourceType === "calculation" || sourceType === "obra_field"
        ? null
        : asString(record.sortFieldKey).trim() || null,
  };
}

function normalizeCalculation(value: unknown, index: number): DataFlowBuilderCalculation | null {
  const record = asRecord(value);
  const rawMode = asString(record.mode);
  const mode: DataFlowBuilderCalculationMode =
    rawMode === "formula" || rawMode === "text_template" ? rawMode : "aggregate";
  const id = asString(record.id).trim() || `calc_${index + 1}`;
  const label = asString(record.label).trim() || `Calculo ${index + 1}`;
  const description = asString(record.description).trim();

  if (mode === "formula" || mode === "text_template") {
    const inputs = Array.isArray(record.inputs)
      ? record.inputs
          .map((input, inputIndex) => normalizeFormulaInput(input, inputIndex))
          .filter((input): input is DataFlowBuilderFormulaInput => Boolean(input))
      : [];

    const common = {
      id,
      label,
      mode,
      description,
      deleted: record.deleted === true,
      inputs,
    };
    return mode === "formula"
      ? {
          ...common,
          mode,
          expression: asString(record.expression).trim(),
        }
      : {
          ...common,
          mode,
          template: asString(record.template).trim(),
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
    deleted: record.deleted === true,
    sourceType,
    sourceId: asString(record.sourceId).trim(),
    fieldKey: asString(record.fieldKey).trim() || null,
    aggregation,
    sortFieldKey: asString(record.sortFieldKey).trim() || null,
  };
}

function normalizeResult(value: unknown, index: number): DataFlowBuilderResult | null {
  const record = asRecord(value);
  const id = asString(record.id).trim() || `result_${index + 1}`;
  const label = asString(record.label).trim() || `Resultado ${index + 1}`;
  const format = new Set<DataFlowBuilderResultFormat>(["number", "currency", "percent", "text"]).has(
    record.format as DataFlowBuilderResultFormat
  )
    ? (record.format as DataFlowBuilderResultFormat)
    : "number";
  const generalTabSlot =
    asString(record.generalTabSlot) === "financial" ? "financial" : "hero";
  const rawWritebackMode = asString(record.writebackMode).trim();
  const writebackMode: DataFlowBuilderWritebackMode =
    rawWritebackMode === "suggest" || rawWritebackMode === "auto" ? rawWritebackMode : "none";

  return {
    id,
    label,
    description: asString(record.description).trim(),
    deleted: record.deleted === true,
    calculationId: asString(record.calculationId).trim() || null,
    targetObraFieldId: asString(record.targetObraFieldId).trim() || null,
    writebackMode,
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
      mode: "aggregate",
      description: "Ultimo monto acumulado valido de PMC Resumen ordenado por fecha de certificacion.",
      sourceType: "table",
      sourceId: BUILDER_PRESET_TABLE_SOURCE_IDS.pmcResumen,
      fieldKey: "monto_acumulado",
      aggregation: "latest",
      sortFieldKey: "fecha_certificacion",
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
      targetObraFieldId: "porcentaje",
      writebackMode: "suggest",
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
      targetObraFieldId: null,
      writebackMode: "none",
      format: "currency",
      decimals: 0,
      generalTabSlot: "financial",
      generalTabOrder: 2,
    },
    {
      id: BUILDER_DEFAULT_RESULT_IDS.certified,
      label: "Certificado",
      description: "Certificado a la fecha recomendado desde PMC Resumen.",
      calculationId: BUILDER_DEFAULT_CALCULATION_IDS.certified,
      targetObraFieldId: "certificado_a_la_fecha",
      writebackMode: "suggest",
      format: "currency",
      decimals: 0,
      generalTabSlot: "financial",
      generalTabOrder: 3,
    },
    {
      id: BUILDER_DEFAULT_RESULT_IDS.balance,
      label: "Saldo a certificar",
      description: "Saldo a certificar recomendado desde contrato menos certificado acumulado.",
      calculationId: BUILDER_DEFAULT_CALCULATION_IDS.balance,
      targetObraFieldId: "saldo_a_certificar",
      writebackMode: "suggest",
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
      if (calculation.deleted) {
        calculationsById.delete(calculation.id);
        continue;
      }
      calculationsById.set(calculation.id, calculation);
    }
    for (const result of config.results) {
      if (result.deleted) {
        resultsById.delete(result.id);
        continue;
      }
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

function enforceOfficialCertificateKpis(config: DataFlowBuilderConfig): DataFlowBuilderConfig {
  const officialCalculations = new Map(
    buildDefaultDataFlowBuilderCalculations()
      .filter((calculation) =>
        calculation.id === BUILDER_DEFAULT_CALCULATION_IDS.contract ||
        calculation.id === BUILDER_DEFAULT_CALCULATION_IDS.certified ||
        calculation.id === BUILDER_DEFAULT_CALCULATION_IDS.balance ||
        calculation.id === BUILDER_DEFAULT_CALCULATION_IDS.progress
      )
      .map((calculation) => [calculation.id, calculation])
  );
  const officialResults = new Map(
    buildDefaultDataFlowBuilderResults()
      .filter((result) =>
        result.id === BUILDER_DEFAULT_RESULT_IDS.certified ||
        result.id === BUILDER_DEFAULT_RESULT_IDS.balance ||
        result.id === BUILDER_DEFAULT_RESULT_IDS.progress
      )
      .map((result) => [result.id, result])
  );

  return {
    ...config,
    calculations: config.calculations.map((calculation) =>
      shouldMigrateLegacyDefaultCalculation(calculation)
        ? officialCalculations.get(calculation.id) ?? calculation
        : calculation
    ),
    results: config.results.map((result) =>
      shouldMigrateLegacyDefaultResult(result)
        ? officialResults.get(result.id) ?? result
        : result
    ),
  };
}

function shouldMigrateLegacyDefaultCalculation(calculation: DataFlowBuilderCalculation) {
  if (
    calculation.id === BUILDER_DEFAULT_CALCULATION_IDS.certified &&
    calculation.mode === "formula" &&
    calculation.inputs.some((input) => input.sourceType === "obra_field" && input.sourceId === "certificado_a_la_fecha")
  ) {
    return true;
  }
  if (
    calculation.id === BUILDER_DEFAULT_CALCULATION_IDS.balance &&
    calculation.mode === "formula" &&
    calculation.inputs.some((input) => input.sourceType === "obra_field" && input.sourceId === "saldo_a_certificar")
  ) {
    return true;
  }
  if (
    calculation.id === BUILDER_DEFAULT_CALCULATION_IDS.progress &&
    calculation.mode === "formula" &&
    calculation.inputs.some((input) => input.sourceType === "obra_field" && input.sourceId === "porcentaje")
  ) {
    return true;
  }
  return false;
}

function shouldMigrateLegacyDefaultResult(result: DataFlowBuilderResult) {
  if (
    result.id === BUILDER_DEFAULT_RESULT_IDS.certified &&
    (result.targetObraFieldId !== "certificado_a_la_fecha" || result.writebackMode === "none")
  ) {
    return true;
  }
  if (
    result.id === BUILDER_DEFAULT_RESULT_IDS.balance &&
    (result.targetObraFieldId !== "saldo_a_certificar" || result.writebackMode === "none")
  ) {
    return true;
  }
  if (
    result.id === BUILDER_DEFAULT_RESULT_IDS.progress &&
    (result.targetObraFieldId !== "porcentaje" || result.writebackMode === "none")
  ) {
    return true;
  }
  return false;
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
  return enforceOfficialCertificateKpis(mergeDataFlowBuilderConfigs(
    {
      version: 1,
      calculations: buildDefaultDataFlowBuilderCalculations(),
      results: buildDefaultDataFlowBuilderResults(),
      generalTabLayout: buildDefaultGeneralTabLayout(),
    },
    rawConfig
  ));
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
    obraFields: await listObraFieldSources({ supabase, tenantId }),
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
  value: DataFlowBuilderValue,
  format: DataFlowBuilderResultFormat,
  decimals: number
) {
  if (value == null) return "-";
  if (format === "text") return String(value);
  const numericValue = coerceBuilderNumericValue(value);
  if (numericValue == null || !Number.isFinite(numericValue)) return "-";
  if (format === "currency") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numericValue);
  }
  if (format === "percent") {
    return `${new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numericValue)}%`;
  }
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numericValue);
}

function parseBuilderDateOrder(value: unknown): number | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = asString(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (iso) {
    const year = Number.parseInt(iso[1] ?? "", 10);
    const month = Number.parseInt(iso[2] ?? "", 10);
    const day = Number.parseInt(iso[3] ?? "1", 10);
    const time = Date.UTC(year, month - 1, day);
    return Number.isFinite(time) ? time : null;
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const day = Number.parseInt(slash[1] ?? "", 10);
    const month = Number.parseInt(slash[2] ?? "", 10);
    const rawYear = Number.parseInt(slash[3] ?? "", 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const time = Date.UTC(year, month - 1, day);
    return Number.isFinite(time) ? time : null;
  }

  const monthYear = raw.match(/^(\d{1,2})[/-](\d{2,4})$/);
  if (monthYear) {
    const month = Number.parseInt(monthYear[1] ?? "", 10);
    const rawYear = Number.parseInt(monthYear[2] ?? "", 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const time = Date.UTC(year, month - 1, 1);
    return Number.isFinite(time) ? time : null;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLatestRowSortOrder(row: BuilderRowRecord, sortFieldKey: string | null | undefined) {
  const data = asRecord(row.data);
  const candidates = [
    sortFieldKey,
    sortFieldKey === "fecha_certificacion" ? "periodo" : null,
    sortFieldKey !== "periodo" ? "periodo" : null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of [...new Set(candidates)]) {
    const parsed = parseBuilderDateOrder(data[candidate]);
    if (parsed != null) return parsed;
  }

  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN;
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function aggregateRows(
  rows: BuilderRowRecord[],
  fieldKey: string | null,
  aggregation: DataFlowBuilderAggregation,
  sortFieldKey?: string | null
): { value: number | null; errorMessage: string | null } {
  if (aggregation === "count_rows") {
    return { value: rows.length, errorMessage: null };
  }

  if (!fieldKey) {
    return { value: null, errorMessage: "Falta la columna para resolver este agregado." };
  }

  if (aggregation === "latest") {
    const latestValue = rows
      .map((row) => ({
        value: coerceBuilderNumericValue(asRecord(row.data)[fieldKey]),
        sortOrder: getLatestRowSortOrder(row, sortFieldKey),
      }))
      .filter((row): row is { value: number; sortOrder: number } => row.value != null)
      .sort((left, right) => right.sortOrder - left.sortOrder)[0]?.value;
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

function getTextTemplateAliases(template: string) {
  return [...template.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((match) => match[1]);
}

function renderTextTemplate(
  template: string,
  variables: Record<string, DataFlowBuilderValue>
): { value: string | null; errorMessage: string | null } {
  const trimmed = template.trim();
  if (!trimmed) {
    return { value: null, errorMessage: "La plantilla de texto esta vacia." };
  }

  const missingAliases = getTextTemplateAliases(trimmed).filter((alias) => variables[alias] == null);
  if (missingAliases.length > 0) {
    return { value: null, errorMessage: `Faltan valores para: ${missingAliases.join(", ")}.` };
  }

  return {
    value: trimmed.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_token, alias: string) =>
      String(variables[alias] ?? "")
    ),
    errorMessage: null,
  };
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

  const { data: obra, error: obraError } = await supabase
    .from("obras")
    .select("custom_data")
    .eq("id", obraId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (obraError) throw obraError;

  return {
    tables,
    macroTables,
    obraFields: await listObraFieldSources({
      supabase,
      tenantId,
      customData: (obra as { custom_data?: unknown } | null)?.custom_data,
    }),
  };
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
    .select("id, name, settings")
    .eq("obra_id", obraId);
  if (obraTablesError) throw obraTablesError;

  const defaultTableToObraTableId = new Map<string, string>();
  const presetTableToObraTableId = new Map<string, string>();
  for (const table of obraTables ?? []) {
    const settings = asRecord(table.settings);
    const defaultTableId = asString(settings.defaultTablaId).trim();
    if (defaultTableId && !defaultTableToObraTableId.has(defaultTableId)) {
      defaultTableToObraTableId.set(defaultTableId, table.id as string);
    }
    const presetKey = asString(settings.spreadsheetPresetKey).trim();
    if (presetKey && !presetTableToObraTableId.has(presetKey)) {
      presetTableToObraTableId.set(presetKey, table.id as string);
    }
    const normalizedName = normalizeLooseIdentifier(asString(table.name));
    if (
      (normalizedName.includes("pmc_resumen") || normalizedName.includes("certificados_extraidos_pmc_resumen")) &&
      !presetTableToObraTableId.has("pmc_resumen")
    ) {
      presetTableToObraTableId.set("pmc_resumen", table.id as string);
    }
  }

  function resolveTableSourceId(sourceId: string) {
    if (sourceId.startsWith(BUILDER_PRESET_TABLE_SOURCE_PREFIX)) {
      return presetTableToObraTableId.get(sourceId.slice(BUILDER_PRESET_TABLE_SOURCE_PREFIX.length)) ?? sourceId;
    }
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
      const aggregated = aggregateRows(
        sourceRows,
        calculation.fieldKey,
        calculation.aggregation,
        calculation.sortFieldKey
      );
      const result: EvaluatedDataFlowCalculation = {
        id: calculation.id,
        label: calculation.label,
        status: aggregated.value != null ? "ok" : aggregated.errorMessage ? "incomplete" : "error",
        value: aggregated.value,
        formattedValue: formatBuilderValue(aggregated.value, "number", 2),
        formulaSummary: [
          `${calculation.aggregation}(${calculation.sourceType}:${calculation.sourceId}${calculation.fieldKey ? `.${calculation.fieldKey}` : ""})`,
          ...(calculation.aggregation === "latest" && calculation.sortFieldKey
            ? [`Orden: ${calculation.sortFieldKey}`]
            : []),
        ],
        inputs: [calculation.sourceId],
        errorMessage: aggregated.errorMessage,
      };
      cache.set(id, result);
      return result;
    }

    const numericVariables: Record<string, number> = {};
    const textVariables: Record<string, DataFlowBuilderValue> = {};
    const inputIds: string[] = [];
    const resolvedInputSummary: string[] = [];
    const calculationKey = calculation.id;
    const calculationLabel = calculation.label;
    const calculationMode = calculation.mode;
    const calculationExpression =
      calculationMode === "formula" ? calculation.expression : calculation.template;

    function missingInputResult(inputAlias: string, inputLabel: string): EvaluatedDataFlowCalculation {
      return {
        id: calculationKey,
        label: calculationLabel,
        status: "incomplete",
        value: null,
        formattedValue: "-",
        formulaSummary: [
          calculationExpression || (calculationMode === "formula" ? "Formula vacia." : "Plantilla vacia."),
          `Input faltante: ${inputAlias} -> ${inputLabel}`,
        ],
        inputs: inputIds,
        errorMessage: `No se pudo resolver ${inputAlias}.`,
      };
    }

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
          const missingInput = missingInputResult(input.alias, inputLabel);
          cache.set(id, missingInput);
          return missingInput;
        }
        textVariables[input.alias] = inputEvaluation.value;
        const numericValue = coerceBuilderNumericValue(inputEvaluation.value);
        if (calculation.mode === "formula" && numericValue == null) {
          const missingInput = missingInputResult(input.alias, inputLabel);
          cache.set(id, missingInput);
          return missingInput;
        }
        if (numericValue != null) numericVariables[input.alias] = numericValue;
        resolvedInputSummary.push(`${input.alias} = ${inputLabel}`);
        continue;
      }

      if (input.sourceType === "obra_field") {
        const rawObraValue = resolveObraFieldValue(obraValues, input.sourceId);
        const textValue =
          rawObraValue == null || String(rawObraValue).trim().length === 0 ? null : String(rawObraValue);
        const numericValue = coerceBuilderNumericValue(rawObraValue);
        const resolvedValue = calculation.mode === "formula" ? numericValue : textValue;
        if (resolvedValue == null) {
          const missingInput = missingInputResult(input.alias, inputLabel);
          cache.set(id, missingInput);
          return missingInput;
        }
        textVariables[input.alias] = resolvedValue;
        if (numericValue != null) numericVariables[input.alias] = numericValue;
        resolvedInputSummary.push(`${input.alias} = ${inputLabel}`);
        continue;
      }

      const aggregated = aggregateRows(
        getRowsForSource(input.sourceType, input.sourceId),
        input.fieldKey,
        input.aggregation ?? "sum",
        input.sortFieldKey
      );
      if (aggregated.value == null) {
        const missingInput = missingInputResult(input.alias, inputLabel);
        cache.set(id, missingInput);
        return missingInput;
      }
      numericVariables[input.alias] = aggregated.value;
      textVariables[input.alias] = aggregated.value;
      resolvedInputSummary.push(`${input.alias} = ${inputLabel}`);
    }

    if (calculation.mode === "text_template") {
      const evaluated = renderTextTemplate(calculation.template, textVariables);
      const result: EvaluatedDataFlowCalculation = {
        id: calculation.id,
        label: calculation.label,
        status: evaluated.value != null ? "ok" : evaluated.errorMessage ? "incomplete" : "error",
        value: evaluated.value,
        formattedValue: formatBuilderValue(evaluated.value, "text", 0),
        formulaSummary: [
          calculation.template || "Plantilla vacia.",
          ...resolvedInputSummary,
        ],
        inputs: inputIds,
        errorMessage: evaluated.errorMessage,
      };
      cache.set(id, result);
      return result;
    }

    const evaluated = evaluateExpression(calculation.expression, numericVariables);
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
      const resultFormat =
        typeof evaluatedCalculation?.value === "string" ? "text" : result.format;
      return {
        id: result.id,
        label: result.label,
        status:
          evaluatedCalculation?.status ??
          (result.calculationId ? "error" : "incomplete"),
        value: evaluatedCalculation?.value ?? null,
        formattedValue: formatBuilderValue(
          evaluatedCalculation?.value ?? null,
          resultFormat,
          result.decimals
        ),
        description: result.description,
        calculationId: result.calculationId,
        targetObraFieldId: result.targetObraFieldId,
        writebackMode: result.writebackMode,
        writebackStatus:
          result.writebackMode === "none" || !result.targetObraFieldId
            ? "none"
            : evaluatedCalculation?.status === "ok"
              ? "ready"
              : "blocked",
        writebackBlockReason:
          result.writebackMode !== "none" && result.targetObraFieldId && evaluatedCalculation?.status !== "ok"
            ? "El calculo asociado no esta OK."
            : null,
        generalTabSlot: result.generalTabSlot,
        generalTabOrder: result.generalTabOrder,
        format: resultFormat,
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
