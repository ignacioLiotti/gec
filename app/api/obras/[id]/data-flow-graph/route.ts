import { NextResponse } from "next/server";

import {
  BUILDER_DEFAULT_CALCULATION_IDS,
  DEFAULT_OBRA_FIELD_SOURCES,
  evaluateObraDataFlowBuilder,
  getObraDataFlowBuilderConfig,
} from "@/lib/data-flow-builder";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";
import {
  getRuleConfigResolution,
  getSignalsSnapshot,
  listFindings,
} from "@/lib/reporting";
import type { RuleConfig } from "@/lib/reporting/types";

type RouteContext = { params: Promise<{ id: string }> };

type SupportStatus = "implemented" | "partial" | "planned" | "not_supported";
type NodeStatus = "ok" | "incomplete" | "error" | "processing";

type DataFlowNode = {
  id: string;
  type: "table" | "macro_table" | "obra_field" | "calculation" | "view";
  label: string;
  status: NodeStatus;
  supportStatus: SupportStatus;
  data: Record<string, unknown>;
};

type DataFlowEdge = {
  id: string;
  source: string;
  target: string;
  type:
    | "table_to_macro_table"
    | "obra_field_to_calculation"
    | "table_to_calculation"
    | "macro_table_to_calculation"
    | "calculation_to_calculation"
    | "calculation_to_view"
    | "macro_table_to_view";
  status: "ok" | "incomplete";
  supportStatus: SupportStatus;
  data: Record<string, unknown>;
};

type CalculationProjection = {
  id: string;
  label: string;
  calculationType: "aggregation" | "join" | "derivation" | "continuity";
  inputTableIds: string[];
  inputColumnKeys: string[];
  outputSignalKeys: string[];
  outputFindingKeys: string[];
  frequency: string;
  requiredConfigured: boolean;
  formulaSummary?: string[];
};

function normalizeSettings(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return { ...(value as Record<string, unknown>) };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isCertificadoContableMacro(name: string) {
  const normalized = normalizeText(name)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return (
    normalized === "certificado contable" ||
    normalized === "certificados contable" ||
    (normalized.includes("certificado") && normalized.includes("contable"))
  );
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCurrency(value: unknown) {
  const amount = toFiniteNumber(value) ?? 0;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: unknown) {
  const amount = toFiniteNumber(value) ?? 0;
  return `${Math.round(amount)}%`;
}

function formatPlainNumber(value: unknown) {
  const amount = toFiniteNumber(value) ?? 0;
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(amount);
}

function shortSignalLabel(signalKey: string) {
  if (signalKey.endsWith(".actual_pct")) return "Real";
  if (signalKey.endsWith(".plan_pct")) return "Plan";
  if (signalKey.endsWith(".delta_pct")) return "Delta";
  if (signalKey.endsWith("_amount")) return "Monto";
  if (signalKey.endsWith("_count")) return "Cant.";
  if (signalKey.endsWith("_days")) return "Dias";
  if (signalKey.endsWith("_at")) return "Fecha";
  return signalKey.split(".").at(-1)?.replaceAll("_", " ") ?? signalKey;
}

function formatSignalValue(signal: {
  signal_key: string;
  value_num: number | null;
  value_bool: boolean | null;
  value_json: unknown;
}) {
  if (signal.value_num != null) {
    if (signal.signal_key.includes("amount")) return formatCurrency(signal.value_num);
    if (signal.signal_key.includes("pct")) return formatPercent(signal.value_num);
    if (signal.signal_key.includes("days")) return `${Math.round(signal.value_num)} dias`;
    return formatPlainNumber(signal.value_num);
  }
  if (signal.value_bool != null) return signal.value_bool ? "Si" : "No";
  if (typeof signal.value_json === "string" && signal.value_json.trim().length > 0) return signal.value_json;
  if (signal.value_json != null) return "Ver detalle";
  return null;
}

function formatProjectedCalculationValue(
  outputSignalKeys: string[],
  signalByKey: Map<string, { signal_key: string; value_num: number | null; value_bool: boolean | null; value_json: unknown }>
) {
  const values = outputSignalKeys
    .map((key) => {
      const signal = signalByKey.get(key);
      if (!signal) return null;
      const value = formatSignalValue(signal);
      return value ? `${shortSignalLabel(key)} ${value}` : null;
    })
    .filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.slice(0, 2).join(" · ") : "-";
}

function isCostLikeMacro(name: string) {
  const normalized = normalizeText(name).replace(/[^a-z0-9]+/g, " ").trim();
  return normalized.includes("costo") || normalized.includes("contrato") || normalized.includes("presupuesto");
}

function buildCalculationProjections(config: RuleConfig): CalculationProjection[] {
  const projections: CalculationProjection[] = [];

  if (config.enabledPacks.curve) {
    const curve = config.mappings.curve;
    projections.push({
      id: "curve",
      label: "Curva y desvio vs plan",
      calculationType: "aggregation",
      inputTableIds: uniqueStrings([curve?.planTableId, curve?.resumenTableId, curve?.measurementTableId]),
      inputColumnKeys: uniqueStrings([curve?.actualPctColumnKey]),
      outputSignalKeys: ["progress.actual_pct", "progress.plan_pct", "progress.delta_pct"],
      outputFindingKeys: ["curve.delta_warn", "curve.delta_critical"],
      frequency: "Manual / al recalcular señales",
      formulaSummary: [
        "Curva Plan aporta el avance acumulado planificado por periodo.",
        "PMC Resumen aporta el avance real acumulado por certificado o periodo.",
        "buildCurvePoints() alinea ambos por mes y calcula planPct, realPct y deltaPct.",
      ],
      requiredConfigured: Boolean(
        curve?.planTableId &&
          (curve?.resumenTableId ?? curve?.measurementTableId) &&
          curve?.actualPctColumnKey &&
          curve?.plan?.startPeriod
      ),
    });
  }

  if (config.enabledPacks.unpaidCerts) {
    const unpaid = config.mappings.unpaidCerts;
    projections.push({
      id: "unpaid-certs",
      label: "Certificados impagos",
      calculationType: "derivation",
      inputTableIds: uniqueStrings([unpaid?.certTableId]),
      inputColumnKeys: uniqueStrings([unpaid?.issuedAtColumnKey, unpaid?.paidBoolColumnKey, unpaid?.amountColumnKey]),
      outputSignalKeys: [
        "cert.unpaid_over_days_count",
        "cert.unpaid_over_days_amount",
        "cert.oldest_unpaid_days",
      ],
      outputFindingKeys: ["cert.unpaid_over_days"],
      frequency: "Manual / al recalcular hallazgos",
      requiredConfigured: Boolean(unpaid?.certTableId && unpaid?.issuedAtColumnKey && unpaid?.paidBoolColumnKey),
    });
  }

  if (config.enabledPacks.inactivity) {
    const inactivity = config.mappings.inactivity;
    projections.push({
      id: "inactivity",
      label: "Inactividad de obra",
      calculationType: "derivation",
      inputTableIds: uniqueStrings([inactivity?.measurementTableId, inactivity?.certTableId]),
      inputColumnKeys: uniqueStrings([inactivity?.measurementDateColumnKey, inactivity?.certIssuedAtColumnKey]),
      outputSignalKeys: [
        "activity.last_measurement_at",
        "activity.last_certificate_at",
        "activity.last_activity_at",
        "activity.inactive_days",
      ],
      outputFindingKeys: ["activity.inactive"],
      frequency: "Manual / al recalcular hallazgos",
      requiredConfigured: Boolean(
        (inactivity?.measurementTableId && inactivity?.measurementDateColumnKey) ||
          (inactivity?.certTableId && inactivity?.certIssuedAtColumnKey)
      ),
    });
  }

  if (config.enabledPacks.monthlyMissingCert) {
    const monthly = config.mappings.monthlyMissingCert;
    projections.push({
      id: "monthly-missing-cert",
      label: "Continuidad mensual de certificados",
      calculationType: "continuity",
      inputTableIds: uniqueStrings([monthly?.certTableId]),
      inputColumnKeys: uniqueStrings([monthly?.certIssuedAtColumnKey]),
      outputSignalKeys: [
        "cert.current_month_count",
        "cert.historical_months_count",
        "cert.missing_current_month",
      ],
      outputFindingKeys: ["cert.missing_current_month"],
      frequency: "Manual / al recalcular hallazgos",
      requiredConfigured: Boolean(monthly?.certTableId && monthly?.certIssuedAtColumnKey),
    });
  }

  if (config.enabledPacks.stageStalled) {
    const stage = config.mappings.stageStalled;
    projections.push({
      id: "stage-stalled",
      label: "Etapa detenida",
      calculationType: "join",
      inputTableIds: uniqueStrings([stage?.stageTableId]),
      inputColumnKeys: uniqueStrings([stage?.locationColumnKey, stage?.stageSinceColumnKey]),
      outputSignalKeys: ["stage.stalled_count", "stage.stalled_oldest_days"],
      outputFindingKeys: ["stage.stalled"],
      frequency: "Manual / al recalcular hallazgos",
      requiredConfigured: Boolean(stage?.stageTableId && stage?.locationColumnKey),
    });
  }

  return projections;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: obraId } = await context.params;
  if (!obraId) {
    return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
  }

  try {
    const access = await resolveRequestAccessContext();
    const { supabase, user, tenantId, actorType } = access;

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const { data: obra, error: obraError } = await supabase
      .from("obras")
      .select("id, designacion_y_ubicacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, porcentaje, custom_data")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obra) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const { data: tablas, error: tablasError } = await supabase
      .from("obra_tablas")
      .select("id, name, source_type, settings, created_at")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: true });
    if (tablasError) throw tablasError;

    const tableIds = (tablas ?? []).map((table) => table.id as string);

    const columnsByTableId = new Map<string, Array<{ fieldKey: string; label: string; dataType: string }>>();
    if (tableIds.length > 0) {
      const { data: columns, error: columnsError } = await supabase
        .from("obra_tabla_columns")
        .select("tabla_id, field_key, label, data_type, position")
        .in("tabla_id", tableIds)
        .order("position", { ascending: true });
      if (columnsError) throw columnsError;
      for (const column of columns ?? []) {
        const tableId = column.tabla_id as string;
        if (!columnsByTableId.has(tableId)) {
          columnsByTableId.set(tableId, []);
        }
        columnsByTableId.get(tableId)?.push({
          fieldKey: column.field_key as string,
          label: column.label as string,
          dataType: typeof column.data_type === "string" ? column.data_type : "text",
        });
      }
    }

    const rowCountByTableId = new Map<string, number>();
    if (tableIds.length > 0) {
      const { data: rowCounts, error: rowCountsError } = await supabase
        .from("obra_tabla_rows")
        .select("tabla_id")
        .in("tabla_id", tableIds);
      if (!rowCountsError) {
        for (const row of rowCounts ?? []) {
          const tableId = row.tabla_id as string;
          rowCountByTableId.set(tableId, (rowCountByTableId.get(tableId) ?? 0) + 1);
        }
      }
    }

    const processingByTableId = new Map<string, { processing: number; failed: number; completed: number }>();
    if (tableIds.length > 0) {
      const { data: processingRows, error: processingError } = await supabase
        .from("ocr_document_processing")
        .select("tabla_id, status")
        .eq("obra_id", obraId)
        .in("tabla_id", tableIds);
      if (!processingError) {
        for (const row of processingRows ?? []) {
          const tableId = row.tabla_id as string;
          const current = processingByTableId.get(tableId) ?? { processing: 0, failed: 0, completed: 0 };
          if (row.status === "failed") current.failed += 1;
          else if (row.status === "completed") current.completed += 1;
          else current.processing += 1;
          processingByTableId.set(tableId, current);
        }
      }
    }

    const { data: macroSources, error: macroSourcesError } = tableIds.length
      ? await supabase
          .from("macro_table_sources")
          .select(`
            macro_table_id,
            obra_tabla_id,
            position,
            macro_tables!inner(id, tenant_id, name, description, settings, created_at, updated_at)
          `)
          .in("obra_tabla_id", tableIds)
      : { data: [], error: null };
    if (macroSourcesError) throw macroSourcesError;

    const macroTableIds = new Set<string>();
    const macroSourceTableIdsByMacroId = new Map<string, Set<string>>();
    const macroTableMetaById = new Map<
      string,
      { id: string; name: string; description: string | null; settings: Record<string, unknown> }
    >();

    for (const source of macroSources ?? []) {
      const macroTable = Array.isArray(source.macro_tables) ? source.macro_tables[0] : source.macro_tables;
      if (!macroTable) continue;
      const macroId = macroTable.id as string;
      macroTableIds.add(macroId);
      macroTableMetaById.set(macroId, {
        id: macroId,
        name: macroTable.name as string,
        description: (macroTable.description as string | null) ?? null,
        settings: normalizeSettings(macroTable.settings),
      });
      const current = macroSourceTableIdsByMacroId.get(macroId) ?? new Set<string>();
      current.add(source.obra_tabla_id as string);
      macroSourceTableIdsByMacroId.set(macroId, current);
    }

    const macroColumnCountById = new Map<string, number>();
    if (macroTableIds.size > 0) {
      const { data: macroColumns, error: macroColumnsError } = await supabase
        .from("macro_table_columns")
        .select("macro_table_id")
        .in("macro_table_id", [...macroTableIds]);
      if (!macroColumnsError) {
        for (const column of macroColumns ?? []) {
          const macroId = column.macro_table_id as string;
          macroColumnCountById.set(macroId, (macroColumnCountById.get(macroId) ?? 0) + 1);
        }
      }
    }

    const [ruleResolutionResult, signalsResult, findingsResult] = await Promise.allSettled([
      getRuleConfigResolution(obraId),
      getSignalsSnapshot(obraId),
      listFindings(obraId),
    ]);

    const reportingProjectionErrors: string[] = [];

    const ruleResolution =
      ruleResolutionResult.status === "fulfilled"
        ? ruleResolutionResult.value
        : (() => {
            reportingProjectionErrors.push("No se pudo resolver la configuracion de reporting de la obra.");
            return null;
          })();

    const signals =
      signalsResult.status === "fulfilled"
        ? signalsResult.value
        : (() => {
            reportingProjectionErrors.push("No se pudieron leer las señales actuales.");
            return [];
          })();

    const findings =
      findingsResult.status === "fulfilled"
        ? findingsResult.value
        : (() => {
            reportingProjectionErrors.push("No se pudieron leer los hallazgos actuales.");
            return [];
          })();

    const nodes: DataFlowNode[] = [];
    const edges: DataFlowEdge[] = [];
    const tableNameById = new Map<string, string>();
    const macroNameById = new Map<string, string>();
    const obraRecord = obra as Record<string, unknown>;
    const obraFieldSourceById = new Map(DEFAULT_OBRA_FIELD_SOURCES.map((field) => [field.id, field]));

    function formatObraFieldValue(fieldKey: string) {
      const source = obraFieldSourceById.get(fieldKey);
      const value = obraRecord[fieldKey];
      if (value == null || (typeof value === "string" && value.trim().length === 0)) return "-";
      if (source?.dataType === "currency") return formatCurrency(value);
      if (source?.dataType === "percent") return formatPercent(value);
      return String(value);
    }

    function ensureObraFieldNode(fieldKey: string) {
      const nodeId = `obra_field:${fieldKey}`;
      if (nodes.some((node) => node.id === nodeId)) return nodeId;
      const source = obraFieldSourceById.get(fieldKey);
      const value = obraRecord[fieldKey];
      const hasValue = value != null && !(typeof value === "string" && value.trim().length === 0);
      nodes.push({
        id: nodeId,
        type: "obra_field",
        label: source?.label ?? fieldKey,
        status: hasValue ? "ok" : "incomplete",
        supportStatus: "implemented",
        data: {
          fieldKey,
          dataType: source?.dataType ?? "number",
          value: value ?? null,
          valueFormatted: formatObraFieldValue(fieldKey),
          source: "obra",
          editorManaged: true,
        },
      });
      return nodeId;
    }

    for (const table of tablas ?? []) {
      const tableId = table.id as string;
      tableNameById.set(tableId, table.name as string);
      const settings = normalizeSettings(table.settings);
      const rowCount = rowCountByTableId.get(tableId) ?? 0;
      const columns = columnsByTableId.get(tableId) ?? [];
      const processing = processingByTableId.get(tableId) ?? { processing: 0, failed: 0, completed: 0 };
      const sourceFolders = [typeof settings.ocrFolder === "string" ? settings.ocrFolder : null].filter(
        (value): value is string => Boolean(value)
      );

      const status: NodeStatus =
        processing.processing > 0
          ? "processing"
          : columns.length === 0
            ? "error"
            : processing.failed > 0
              ? "error"
              : rowCount === 0
                ? "incomplete"
                : "ok";

      nodes.push({
        id: `table:${tableId}`,
        type: "table",
        label: table.name as string,
        status,
        supportStatus: "implemented",
        data: {
          tableId,
          sourceType: table.source_type as string,
          rowCount,
          columnCount: columns.length,
          columns,
          sourceFolders,
          sourceFolderLabels: [
            typeof settings.ocrFolderLabel === "string" ? settings.ocrFolderLabel : null,
          ].filter((value): value is string => Boolean(value)),
          processing,
        },
      });
    }

    for (const [macroId, meta] of macroTableMetaById.entries()) {
      macroNameById.set(macroId, meta.name);
      const sourceIds = [...(macroSourceTableIdsByMacroId.get(macroId) ?? new Set<string>())];
      nodes.push({
        id: `macro:${macroId}`,
        type: "macro_table",
        label: meta.name,
        status: sourceIds.length === 0 ? "incomplete" : "ok",
        supportStatus: "implemented",
        data: {
          macroTableId: macroId,
          description: meta.description,
          sourceCount: sourceIds.length,
          sourceTableIds: sourceIds,
          sourceTableLabels: sourceIds.map((sourceId) => tableNameById.get(sourceId) ?? sourceId),
          columnCount: macroColumnCountById.get(macroId) ?? 0,
          settings: meta.settings,
        },
      });

      for (const sourceTableId of sourceIds) {
        edges.push({
          id: `edge:table:${sourceTableId}:macro:${macroId}`,
          source: `table:${sourceTableId}`,
          target: `macro:${macroId}`,
          type: "table_to_macro_table",
          status: "ok",
          supportStatus: "implemented",
          data: {
            sourceTableId,
            macroTableId: macroId,
          },
        });
      }
    }

    const openFindingsByRule = new Map<string, number>();
    for (const finding of findings) {
      if (finding.status !== "open") continue;
      openFindingsByRule.set(finding.rule_key, (openFindingsByRule.get(finding.rule_key) ?? 0) + 1);
    }
    const signalKeysPresent = new Set(signals.map((signal) => signal.signal_key));
    const signalByKey = new Map(signals.map((signal) => [signal.signal_key, signal]));

    const calculationProjections = ruleResolution ? buildCalculationProjections(ruleResolution.config) : [];
    for (const calculation of calculationProjections) {
      const signalCount = calculation.outputSignalKeys.filter((key) => signalKeysPresent.has(key)).length;
      const findingCount = calculation.outputFindingKeys.reduce(
        (total, key) => total + (openFindingsByRule.get(key) ?? 0),
        0
      );
      const inputTableLabels = calculation.inputTableIds.map((id) => tableNameById.get(id) ?? id);
      const status: NodeStatus = calculation.requiredConfigured
        ? signalCount > 0 || findingCount > 0
          ? "ok"
          : "incomplete"
        : "incomplete";

      nodes.push({
        id: `calc:${calculation.id}`,
        type: "calculation",
        label: calculation.label,
        status,
        supportStatus: "partial",
        data: {
          calculationId: calculation.id,
          calculationType: calculation.calculationType,
          inputTableIds: calculation.inputTableIds,
          inputTableLabels,
          inputColumnKeys: calculation.inputColumnKeys,
          outputSignalKeys: calculation.outputSignalKeys,
          outputFindingKeys: calculation.outputFindingKeys,
          signalCount,
          openFindingCount: findingCount,
          frequency: calculation.frequency,
          source: ruleResolution?.source ?? "system_default",
          hasObraOverride: ruleResolution?.hasObraOverride ?? false,
          requiredConfigured: calculation.requiredConfigured,
          formulaSummary: calculation.formulaSummary ?? [],
          valueFormatted: formatProjectedCalculationValue(calculation.outputSignalKeys, signalByKey),
        },
      });

      for (const inputTableId of calculation.inputTableIds) {
        edges.push({
          id: `edge:table:${inputTableId}:calc:${calculation.id}`,
          source: `table:${inputTableId}`,
          target: `calc:${calculation.id}`,
          type: "table_to_calculation",
          status: calculation.requiredConfigured ? "ok" : "incomplete",
          supportStatus: "partial",
          data: {
            sourceTableId: inputTableId,
            calculationId: calculation.id,
            source: ruleResolution?.source ?? "system_default",
          },
        });
      }
    }

    const certContableMacro = [...macroNameById.entries()].find(([, name]) => isCertificadoContableMacro(name)) ?? null;
    const costMacro = [...macroNameById.entries()].find(([, name]) => isCostLikeMacro(name)) ?? null;
    const builderConfig = getObraDataFlowBuilderConfig(obra.custom_data);
    let evaluatedBuilder:
      | Awaited<ReturnType<typeof evaluateObraDataFlowBuilder>>
      | null = null;
    try {
      evaluatedBuilder = await evaluateObraDataFlowBuilder({
        supabase,
        tenantId,
        obraId,
        config: builderConfig,
        obraValues: obra,
      });
    } catch (error) {
      console.error("[data-flow-graph:builder-eval]", error);
    }
    const builderCalculationValueById = new Map(
      (evaluatedBuilder?.calculations ?? []).map((calculation) => [calculation.id, calculation])
    );
    const defaultCalculationNodeIds = {
      progress: `calc:custom:${BUILDER_DEFAULT_CALCULATION_IDS.progress}`,
      contract: `calc:custom:${BUILDER_DEFAULT_CALCULATION_IDS.contract}`,
      certified: `calc:custom:${BUILDER_DEFAULT_CALCULATION_IDS.certified}`,
      balance: `calc:custom:${BUILDER_DEFAULT_CALCULATION_IDS.balance}`,
    };

    const curveCalculationNodeId =
      calculationProjections.find((calculation) => calculation.id === "curve") != null
        ? "calc:curve"
        : null;

    const defaultProgressCalculation = builderCalculationValueById.get(BUILDER_DEFAULT_CALCULATION_IDS.progress) ?? null;
    const defaultContractCalculation = builderCalculationValueById.get(BUILDER_DEFAULT_CALCULATION_IDS.contract) ?? null;
    const defaultCertifiedCalculation = builderCalculationValueById.get(BUILDER_DEFAULT_CALCULATION_IDS.certified) ?? null;
    const defaultBalanceCalculation = builderCalculationValueById.get(BUILDER_DEFAULT_CALCULATION_IDS.balance) ?? null;

    const resultMetricViews = [
      {
        id: "view:metric-progress",
        label: "Avance",
        resultValue:
          defaultProgressCalculation?.value != null
            ? formatPercent(defaultProgressCalculation.value)
            : formatPercent(obra.porcentaje),
        resultDetail: "Porcentaje de avance guardado en General y contrastado con Curva Plan + PMC Resumen.",
        status:
          defaultProgressCalculation?.status ??
          (toFiniteNumber(obra.porcentaje) != null ? "ok" : "incomplete"),
        consumedCalculationIds: uniqueStrings([
          defaultProgressCalculation ? defaultCalculationNodeIds.progress : null,
          curveCalculationNodeId,
        ]),
        consumedMacroTableIds: [] as string[],
        displayedMetrics: ["Porcentaje de avance", "Curva de avance", "PMC Resumen", "Alertas"],
        resultOrder: 1,
      },
      {
        id: "view:metric-contract",
        label: "Contrato",
        resultValue:
          defaultContractCalculation?.value != null
            ? formatCurrency(defaultContractCalculation.value)
            : formatCurrency(obra.contrato_mas_ampliaciones),
        resultDetail: "Contrato + ampliaciones guardado en la obra.",
        status:
          defaultContractCalculation?.status ??
          (toFiniteNumber(obra.contrato_mas_ampliaciones) != null ? "ok" : "incomplete"),
        consumedCalculationIds: defaultContractCalculation ? [defaultCalculationNodeIds.contract] : [],
        consumedMacroTableIds: costMacro ? [costMacro[0]] : [],
        displayedMetrics: ["Contrato + ampliaciones"],
        resultOrder: 2,
      },
      {
        id: "view:metric-certificado",
        label: "Certificado",
        resultValue:
          defaultCertifiedCalculation?.value != null
            ? formatCurrency(defaultCertifiedCalculation.value)
            : formatCurrency(obra.certificado_a_la_fecha),
        resultDetail: "Certificado a la fecha guardado en General.",
        status:
          defaultCertifiedCalculation?.status ??
          (toFiniteNumber(obra.certificado_a_la_fecha) != null ? "ok" : "incomplete"),
        consumedCalculationIds: defaultCertifiedCalculation ? [defaultCalculationNodeIds.certified] : [],
        consumedMacroTableIds: certContableMacro ? [certContableMacro[0]] : [],
        displayedMetrics: ["Certificado a la fecha"],
        resultOrder: 3,
      },
      {
        id: "view:metric-saldo",
        label: "Saldo a certificar",
        resultValue:
          defaultBalanceCalculation?.value != null
            ? formatCurrency(defaultBalanceCalculation.value)
            : formatCurrency(obra.saldo_a_certificar),
        resultDetail: "Saldo a certificar guardado en General.",
        status:
          defaultBalanceCalculation?.status ??
          (toFiniteNumber(obra.saldo_a_certificar) != null ? "ok" : "incomplete"),
        consumedCalculationIds: defaultBalanceCalculation ? [defaultCalculationNodeIds.balance] : [],
        consumedMacroTableIds: certContableMacro ? [certContableMacro[0]] : [],
        displayedMetrics: ["Saldo a certificar"],
        resultOrder: 4,
      },
    ] as const;

    for (const metricView of resultMetricViews) {
      nodes.push({
        id: metricView.id,
        type: "view",
        label: metricView.label,
        status: metricView.status,
        supportStatus: "partial",
        data: {
          viewId: metricView.id.replace("view:", ""),
          route: `/excel/${obraId}?tab=general`,
          location: "General Tab · KPI financiero",
          displayedMetrics: metricView.displayedMetrics,
          consumedCalculationIds: metricView.consumedCalculationIds,
          consumedMacroTableIds: metricView.consumedMacroTableIds,
          projectedReason:
            "El valor mostrado sale del General Tab y su trazabilidad mezcla datos guardados en obra, certificados y reporting.",
          resultValue: metricView.resultValue,
          resultDetail: metricView.resultDetail,
          resultOrder: metricView.resultOrder,
        },
      });
    }

    const generalViewCalculationIds = calculationProjections.map((calculation) => `calc:${calculation.id}`);
    const reportViewCalculationIds = calculationProjections.map((calculation) => `calc:${calculation.id}`);

    nodes.push(
      {
        id: "view:general-tab",
        type: "view",
        label: "General Tab",
        status:
          generalViewCalculationIds.length > 0 || certContableMacro
            ? "ok"
            : "incomplete",
        supportStatus: "partial",
        data: {
          viewId: "general-tab",
          route: `/excel/${obraId}?tab=general`,
          location: "Pestana General de la obra",
          displayedMetrics: ["Hallazgos", "Curva de avance", "Campos principales"],
          consumedCalculationIds: generalViewCalculationIds,
          consumedMacroTableIds: certContableMacro ? [certContableMacro[0]] : [],
          hiddenInResultsBar: true,
          projectedReason:
            "La vista es real, pero su dependencia fina se proyecta desde la carga de General Tab y reporting.",
        },
      },
      {
        id: "view:report-hub",
        type: "view",
        label: "Reporte de obra",
        status: reportViewCalculationIds.length > 0 ? "ok" : "incomplete",
        supportStatus: "partial",
        data: {
          viewId: "report-hub",
          route: `/excel/${obraId}/report`,
          location: "Hub de reglas / reporte de obra",
          displayedMetrics: ["Senales", "Hallazgos", "Configuracion de reglas"],
          consumedCalculationIds: reportViewCalculationIds,
          consumedMacroTableIds: [],
          hiddenInResultsBar: true,
          projectedReason:
            "La vista es real y consume reporting, pero la dependencia se modela como proyeccion en este corte.",
        },
      }
    );

    for (const metricView of resultMetricViews) {
      for (const calculationId of metricView.consumedCalculationIds) {
        edges.push({
          id: `edge:${calculationId}:${metricView.id}`,
          source: calculationId,
          target: metricView.id,
          type: "calculation_to_view",
          status: "ok",
          supportStatus: "partial",
          data: {
            calculationId: calculationId.replace("calc:", ""),
            viewId: metricView.id.replace("view:", ""),
            projectionMode: "projected",
          },
        });
      }

      for (const macroTableId of metricView.consumedMacroTableIds) {
        edges.push({
          id: `edge:macro:${macroTableId}:${metricView.id}`,
          source: `macro:${macroTableId}`,
          target: metricView.id,
          type: "macro_table_to_view",
          status: "ok",
          supportStatus: "partial",
          data: {
            macroTableId,
            viewId: metricView.id.replace("view:", ""),
            projectionMode: "projected",
          },
        });
      }
    }

    for (const calculation of calculationProjections) {
      edges.push(
        {
          id: `edge:calc:${calculation.id}:view:general-tab`,
          source: `calc:${calculation.id}`,
          target: "view:general-tab",
          type: "calculation_to_view",
          status: calculation.requiredConfigured ? "ok" : "incomplete",
          supportStatus: "partial",
          data: {
            calculationId: calculation.id,
            viewId: "general-tab",
            projectionMode: "projected",
          },
        },
        {
          id: `edge:calc:${calculation.id}:view:report-hub`,
          source: `calc:${calculation.id}`,
          target: "view:report-hub",
          type: "calculation_to_view",
          status: calculation.requiredConfigured ? "ok" : "incomplete",
          supportStatus: "partial",
          data: {
            calculationId: calculation.id,
            viewId: "report-hub",
            projectionMode: "projected",
          },
        }
      );
    }

    if (certContableMacro) {
      edges.push({
        id: `edge:macro:${certContableMacro[0]}:view:general-tab`,
        source: `macro:${certContableMacro[0]}`,
        target: "view:general-tab",
        type: "macro_table_to_view",
        status: "ok",
        supportStatus: "partial",
        data: {
          macroTableId: certContableMacro[0],
          viewId: "general-tab",
          projectionMode: "projected",
          reason: "General Tab consume la macro certificado contable para cobrado por certificado.",
        },
      });
    }

    if (builderConfig.calculations.length > 0 || builderConfig.results.length > 0) {
      try {
        const evaluatedCalculationById = new Map(
          (evaluatedBuilder?.calculations ?? []).map((calculation) => [calculation.id, calculation])
        );
        const calculatedResultById = new Map(
          (evaluatedBuilder?.results ?? []).map((result) => [result.id, result])
        );
        const resolveBuilderInputNodeId = (input: {
          sourceType: "calculation" | "table" | "macro_table" | "obra_field";
          sourceId: string;
        }) =>
          input.sourceType === "calculation"
            ? `calc:custom:${input.sourceId}`
            : input.sourceType === "obra_field"
              ? ensureObraFieldNode(input.sourceId)
            : input.sourceType === "table"
              ? `table:${input.sourceId}`
              : `macro:${input.sourceId}`;

        for (const calculation of builderConfig.calculations) {
          const evaluated = evaluatedCalculationById.get(calculation.id);
          const calculationNodeId = `calc:custom:${calculation.id}`;
          const formulaSummary = evaluated?.formulaSummary ?? [];
          const inputNodeIds =
            calculation.mode === "aggregate"
              ? [calculation.sourceType === "table" ? `table:${calculation.sourceId}` : `macro:${calculation.sourceId}`]
              : calculation.inputs
                  .map((input) => resolveBuilderInputNodeId(input))
                  .filter((input): input is string => Boolean(input));

          nodes.push({
            id: calculationNodeId,
            type: "calculation",
            label: calculation.label,
            status: evaluated?.status ?? "incomplete",
            supportStatus: "implemented",
            data: {
              calculationId: calculation.id,
              calculationType: calculation.mode === "aggregate" ? "aggregation" : "derivation",
              inputTableIds:
                calculation.mode === "aggregate"
                  ? calculation.sourceType === "table"
                    ? [calculation.sourceId]
                    : []
                  : calculation.inputs
                      .filter((input) => input.sourceType === "table")
                      .map((input) => input.sourceId),
              inputTableLabels:
                calculation.mode === "aggregate"
                  ? calculation.sourceType === "table"
                    ? [tableNameById.get(calculation.sourceId) ?? calculation.sourceId]
                    : []
                  : calculation.inputs
                      .filter((input) => input.sourceType === "table")
                      .map((input) => tableNameById.get(input.sourceId) ?? input.sourceId),
              inputColumnKeys:
                calculation.mode === "aggregate"
                  ? calculation.fieldKey
                    ? [calculation.fieldKey]
                    : []
                  : calculation.inputs.map((input) =>
                      input.sourceType === "calculation" || input.sourceType === "obra_field"
                        ? input.alias
                        : input.fieldKey
                          ? `${input.alias}:${input.fieldKey}`
                          : input.alias
                    ),
              outputSignalKeys: [`custom.${calculation.id}`],
              outputFindingKeys: [],
              signalCount: evaluated?.value != null ? 1 : 0,
              openFindingCount: 0,
              frequency: "Manual / editor de data-flow",
              source: "data_flow_builder",
              hasObraOverride: true,
              requiredConfigured: true,
              formulaSummary,
              editorManaged: true,
              mode: calculation.mode,
              value: evaluated?.value ?? null,
              valueFormatted: evaluated?.formattedValue ?? "-",
              inputNodeIds,
              description: calculation.description,
              errorMessage: evaluated?.errorMessage ?? null,
            },
          });

          if (calculation.mode === "aggregate") {
            const sourceNodeId =
              calculation.sourceType === "table"
                ? `table:${calculation.sourceId}`
                : `macro:${calculation.sourceId}`;
            if (nodes.some((node) => node.id === sourceNodeId)) {
              edges.push({
                id: `edge:${sourceNodeId}:${calculationNodeId}`,
                source: sourceNodeId,
                target: calculationNodeId,
                type:
                  calculation.sourceType === "table"
                    ? "table_to_calculation"
                    : "macro_table_to_calculation",
                status: evaluated?.status === "ok" ? "ok" : "incomplete",
                supportStatus: "implemented",
                data: {
                  sourceNodeId,
                  calculationId: calculation.id,
                  source: "data_flow_builder",
                  editorManaged: true,
                },
              });
            }
          } else {
            for (const input of calculation.inputs) {
              const dependencyNodeId = resolveBuilderInputNodeId(input);
              if (!dependencyNodeId || !nodes.some((node) => node.id === dependencyNodeId)) continue;
              edges.push({
                id: `edge:${dependencyNodeId}:${calculationNodeId}`,
                source: dependencyNodeId,
                target: calculationNodeId,
                type:
                  input.sourceType === "calculation"
                    ? "calculation_to_calculation"
                    : input.sourceType === "obra_field"
                      ? "obra_field_to_calculation"
                    : input.sourceType === "table"
                      ? "table_to_calculation"
                      : "macro_table_to_calculation",
                status: evaluated?.status === "ok" ? "ok" : "incomplete",
                supportStatus: "implemented",
                data: {
                  sourceNodeId: dependencyNodeId,
                  calculationId: calculation.id,
                  alias: input.alias,
                  inputSourceType: input.sourceType,
                  inputSourceId: input.sourceId,
                  fieldKey: input.fieldKey ?? null,
                  aggregation: input.aggregation ?? null,
                  source: "data_flow_builder",
                  editorManaged: true,
                },
              });
            }
          }
        }

        for (const result of builderConfig.results) {
          const evaluated = calculatedResultById.get(result.id);
          const resultNodeId = `view:custom:${result.id}`;
          const slotBase = result.generalTabSlot === "hero" ? 200 : 400;
          nodes.push({
            id: resultNodeId,
            type: "view",
            label: result.label,
            status: evaluated?.status ?? "incomplete",
            supportStatus: "implemented",
            data: {
              viewId: `custom-${result.id}`,
              route: `/excel/${obraId}?tab=general`,
              location:
                result.generalTabSlot === "hero"
                  ? "General Tab · Hero custom"
                  : "General Tab · KPI financiero custom",
              displayedMetrics: [result.label],
              consumedCalculationIds: result.calculationId ? [`calc:custom:${result.calculationId}`] : [],
              consumedMacroTableIds: [],
              projectedReason:
                "Resultado custom definido desde el editor de data-flow y renderizado en General.",
              resultValue: evaluated?.formattedValue ?? "-",
              resultDetail: result.description || "Resultado custom de General.",
              resultOrder: slotBase + result.generalTabOrder,
              generalTabSlot: result.generalTabSlot,
              generalTabOrder: result.generalTabOrder,
              editorManaged: true,
              format: result.format,
            },
          });

          if (result.calculationId) {
            edges.push({
              id: `edge:calc:custom:${result.calculationId}:${resultNodeId}`,
              source: `calc:custom:${result.calculationId}`,
              target: resultNodeId,
              type: "calculation_to_view",
              status: evaluated?.status === "ok" ? "ok" : "incomplete",
              supportStatus: "implemented",
              data: {
                calculationId: result.calculationId,
                viewId: `custom-${result.id}`,
                projectionMode: "custom_builder",
                editorManaged: true,
              },
            });
          }
        }
      } catch (builderError) {
        reportingProjectionErrors.push(
          builderError instanceof Error
            ? `No se pudieron resolver los nodos custom de data-flow: ${builderError.message}`
            : "No se pudieron resolver los nodos custom de data-flow."
        );
      }
    }

    return NextResponse.json({
      obra: {
        id: obraId,
        label:
          (typeof obra.designacion_y_ubicacion === "string" && obra.designacion_y_ubicacion.trim()) ||
          obraId,
      },
      summary: {
        tables: nodes.filter((node) => node.type === "table").length,
        macroTables: nodes.filter((node) => node.type === "macro_table").length,
        calculations: nodes.filter((node) => node.type === "calculation").length,
        views: nodes.filter((node) => node.type === "view").length,
        edges: edges.length,
      },
      coverage: {
        mode: "simplified",
        items: [
          {
            id: "tables",
            label: "Tablas de obra",
            status: "implemented" satisfies SupportStatus,
            detail: "Las tablas y sus metadatos salen de obra_tablas, columnas y filas reales.",
          },
          {
            id: "macro_tables",
            label: "Macrotablas",
            status: "implemented" satisfies SupportStatus,
            detail: "Las macrotablas y sus relaciones salen de macro_table_sources reales.",
          },
          {
            id: "calculations",
            label: "Calculos",
            status: (reportingProjectionErrors.length === 0 ? "partial" : "planned") satisfies SupportStatus,
            detail:
              reportingProjectionErrors.length === 0
                ? "Se combinan reporting, reglas, hallazgos reales y data-flow persistido a nivel tenant/obra."
                : "La capa projected de calculos no pudo resolverse en esta carga. El grafo base sigue usando solo datos reales.",
          },
          {
            id: "views",
            label: "Vistas finales",
            status: (reportingProjectionErrors.length === 0 ? "partial" : "planned") satisfies SupportStatus,
            detail:
              reportingProjectionErrors.length === 0
                ? "General Tab y Reporte de obra se proyectan desde consumers reales ya existentes."
                : "Las vistas projected quedan desactivadas temporalmente si falla la resolucion de reporting.",
          },
        ],
      },
      diagnostics: {
        reportingProjectionErrors,
      },
      nodes,
      edges,
    });
  } catch (error) {
    console.error("[data-flow-graph:get]", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : (() => {
              try {
                return JSON.stringify(error);
              } catch {
                return "Error desconocido";
              }
            })();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
