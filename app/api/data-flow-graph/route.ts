import { NextResponse } from "next/server";

import {
  DEFAULT_OBRA_FIELD_SOURCES,
  getTenantDataFlowBuilderConfig,
} from "@/lib/data-flow-builder";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";

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

function isConfiguredCalculation(
  calculation: ReturnType<typeof getTenantDataFlowBuilderConfig>["calculations"][number]
): boolean {
  if (calculation.mode === "aggregate") {
    return Boolean(calculation.sourceId && (calculation.aggregation === "count_rows" || calculation.fieldKey));
  }
  return Boolean(calculation.expression.trim() && calculation.inputs.length > 0);
}

export async function GET() {
  try {
    const access = await resolveRequestAccessContext();
    const { supabase, tenantId, user, actorType } = access;

    if (!user && actorType !== "demo") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (actorType === "demo" && !hasDemoCapability(access.demoSession, "excel")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from("tenant_data_flow_config")
      .select("config_json")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw error;

    const config = getTenantDataFlowBuilderConfig(row?.config_json ?? null);
    const nodes: DataFlowNode[] = [];
    const edges: DataFlowEdge[] = [];
    const obraFieldSourceById = new Map(DEFAULT_OBRA_FIELD_SOURCES.map((field) => [field.id, field]));

    const { data: defaultTables, error: defaultTablesError } = await supabase
      .from("obra_default_tablas")
      .select("id, name, description, source_type, linked_folder_path, settings, position")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true });
    if (defaultTablesError) throw defaultTablesError;

    const defaultTableIds = (defaultTables ?? []).map((table) => table.id as string);
    const defaultColumnsByTableId = new Map<string, Array<{ fieldKey: string; label: string; dataType: string }>>();
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
          fieldKey: column.field_key as string,
          label: (column.label as string) ?? (column.field_key as string),
          dataType: typeof column.data_type === "string" ? column.data_type : "text",
        });
      }
    }

    const defaultTableNameById = new Map<string, string>();
    for (const table of defaultTables ?? []) {
      const tableId = table.id as string;
      defaultTableNameById.set(tableId, table.name as string);
      const linkedFolderPath =
        typeof table.linked_folder_path === "string" && table.linked_folder_path.trim().length > 0
          ? table.linked_folder_path.trim()
          : null;
      nodes.push({
        id: `table:${tableId}`,
        type: "table",
        label: table.name as string,
        status: "ok",
        supportStatus: "implemented",
        data: {
          tableId,
          defaultTableId: tableId,
          description: (table.description as string | null) ?? null,
          sourceType: table.source_type as string,
          rowCount: 0,
          columnCount: defaultColumnsByTableId.get(tableId)?.length ?? 0,
          columns: defaultColumnsByTableId.get(tableId) ?? [],
          sourceFolders: linkedFolderPath ? [linkedFolderPath] : [],
          sourceFolderLabels: linkedFolderPath ? [linkedFolderPath] : [],
          abstractTemplate: true,
          source: "obra_default_tablas",
        },
      });
    }

    const { data: macroTables, error: macroTablesError } = await supabase
      .from("macro_tables")
      .select("id, name, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (macroTablesError) throw macroTablesError;

    const macroTableIds = (macroTables ?? []).map((table) => table.id as string);
    const macroColumnCountById = new Map<string, number>();
    if (macroTableIds.length > 0) {
      const { data: macroColumns, error: macroColumnsError } = await supabase
        .from("macro_table_columns")
        .select("macro_table_id")
        .in("macro_table_id", macroTableIds);
      if (macroColumnsError) throw macroColumnsError;
      for (const column of macroColumns ?? []) {
        const macroId = column.macro_table_id as string;
        macroColumnCountById.set(macroId, (macroColumnCountById.get(macroId) ?? 0) + 1);
      }
    }

    const macroTableNameById = new Map<string, string>();
    for (const table of macroTables ?? []) {
      const macroId = table.id as string;
      macroTableNameById.set(macroId, table.name as string);
      nodes.push({
        id: `macro:${macroId}`,
        type: "macro_table",
        label: table.name as string,
        status: "ok",
        supportStatus: "implemented",
        data: {
          macroTableId: macroId,
          sourceCount: 0,
          columnCount: macroColumnCountById.get(macroId) ?? 0,
          source: "macro_tables",
          abstractTemplate: true,
        },
      });
    }

    function hasNode(nodeId: string) {
      return nodes.some((node) => node.id === nodeId);
    }

    function ensureObraFieldNode(fieldKey: string) {
      const nodeId = `obra_field:${fieldKey}`;
      if (nodes.some((node) => node.id === nodeId)) return nodeId;
      const source = obraFieldSourceById.get(fieldKey);
      nodes.push({
        id: nodeId,
        type: "obra_field",
        label: source?.label ?? fieldKey,
        status: "ok",
        supportStatus: "implemented",
        data: {
          fieldKey,
          dataType: source?.dataType ?? "number",
          value: null,
          valueFormatted: null,
          hideFieldValue: true,
          source: "obra",
          editorManaged: true,
        },
      });
      return nodeId;
    }

    function resolveBuilderInputNode(input: {
      sourceType: "calculation" | "table" | "macro_table" | "obra_field";
      sourceId: string;
    }) {
      if (input.sourceType === "calculation") return `calc:custom:${input.sourceId}`;
      if (input.sourceType === "obra_field") return ensureObraFieldNode(input.sourceId);
      if (input.sourceType === "table") return `table:${input.sourceId}`;
      return `macro:${input.sourceId}`;
    }

    for (const calculation of config.calculations) {
      const calculationNodeId = `calc:custom:${calculation.id}`;
      const status: NodeStatus = isConfiguredCalculation(calculation) ? "ok" : "incomplete";
      nodes.push({
        id: calculationNodeId,
        type: "calculation",
        label: calculation.label,
        status,
        supportStatus: "implemented",
        data: {
          calculationId: calculation.id,
          calculationType: calculation.mode === "aggregate" ? "aggregation" : "derivation",
          inputTableIds:
            calculation.mode === "aggregate" && calculation.sourceType === "table"
              ? [calculation.sourceId]
              : calculation.mode === "formula"
                ? calculation.inputs
                    .filter((input) => input.sourceType === "table")
                    .map((input) => input.sourceId)
                : [],
          inputTableLabels:
            calculation.mode === "aggregate" && calculation.sourceType === "table"
              ? [defaultTableNameById.get(calculation.sourceId) ?? calculation.sourceId]
              : calculation.mode === "formula"
                ? calculation.inputs
                    .filter((input) => input.sourceType === "table")
                    .map((input) => defaultTableNameById.get(input.sourceId) ?? input.sourceId)
                : [],
          inputColumnKeys:
            calculation.mode === "formula"
              ? calculation.inputs.map((input) =>
                  input.sourceType === "calculation" || input.sourceType === "obra_field"
                    ? input.alias
                    : input.fieldKey
                      ? `${input.alias}:${input.fieldKey}`
                      : input.alias
                )
              : calculation.fieldKey
                ? [calculation.fieldKey]
                : [],
          outputSignalKeys: [`tenant.${calculation.id}`],
          outputFindingKeys: [],
          signalCount: status === "ok" ? 1 : 0,
          openFindingCount: 0,
          frequency: "General / tenant",
          source: "tenant_data_flow_builder",
          hasObraOverride: false,
          requiredConfigured: true,
          formulaSummary:
            calculation.mode === "formula"
              ? [
                  calculation.expression || "Formula vacia.",
                  ...calculation.inputs.map((input) =>
                    input.sourceType === "calculation"
                      ? `${input.alias} = calculation:${input.sourceId}`
                      : input.sourceType === "obra_field"
                        ? `${input.alias} = obra_field:${input.sourceId}`
                        : `${input.alias} = ${input.aggregation ?? "sum"}(${input.sourceType}:${input.sourceId}${input.fieldKey ? `.${input.fieldKey}` : ""})`
                  ),
                ]
              : [
                  `${calculation.aggregation}(${calculation.sourceType}:${calculation.sourceId}${calculation.fieldKey ? `.${calculation.fieldKey}` : ""})`,
                ],
          editorManaged: true,
          mode: calculation.mode,
          value: null,
          valueFormatted: null,
          hideCalculationValue: true,
          inputNodeIds:
            calculation.mode === "aggregate"
              ? [calculation.sourceType === "table" ? `table:${calculation.sourceId}` : `macro:${calculation.sourceId}`]
              : calculation.inputs.map((input) => resolveBuilderInputNode(input)),
          description: calculation.description,
          errorMessage: null,
        },
      });

      if (calculation.mode === "aggregate") {
        const sourceNodeId = calculation.sourceType === "table" ? `table:${calculation.sourceId}` : `macro:${calculation.sourceId}`;
        if (hasNode(sourceNodeId)) {
          edges.push({
            id: `edge:${sourceNodeId}:${calculationNodeId}`,
            source: sourceNodeId,
            target: calculationNodeId,
            type: calculation.sourceType === "table" ? "table_to_calculation" : "macro_table_to_calculation",
            status,
            supportStatus: "implemented",
            data: {
              sourceNodeId,
              calculationId: calculation.id,
              source: "tenant_data_flow_builder",
              editorManaged: true,
            },
          });
        }
      } else {
        for (const input of calculation.inputs) {
          const sourceNodeId = resolveBuilderInputNode(input);
          if (!hasNode(sourceNodeId)) continue;
          edges.push({
            id: `edge:${sourceNodeId}:${calculationNodeId}`,
            source: sourceNodeId,
            target: calculationNodeId,
            type:
              input.sourceType === "calculation"
                ? "calculation_to_calculation"
                : input.sourceType === "obra_field"
                  ? "obra_field_to_calculation"
                  : input.sourceType === "table"
                    ? "table_to_calculation"
                    : "macro_table_to_calculation",
            status,
            supportStatus: "implemented",
            data: {
              calculationId: calculation.id,
              inputSourceId: input.sourceId,
              alias: input.alias,
              source: "tenant_data_flow_builder",
              editorManaged: true,
            },
          });
        }
      }
    }

    for (const result of config.results) {
      const resultNodeId = `view:custom:${result.id}`;
      nodes.push({
        id: resultNodeId,
        type: "view",
        label: result.label,
        status: result.calculationId ? "ok" : "incomplete",
        supportStatus: "implemented",
        data: {
          viewId: `tenant-${result.id}`,
          route: "/excel/data-flow",
          location:
            result.generalTabSlot === "hero"
            ? "General Tab - Hero general"
            : "General Tab - KPI financiero general",
          displayedMetrics: [result.label],
          consumedCalculationIds: result.calculationId ? [`calc:custom:${result.calculationId}`] : [],
          consumedMacroTableIds: [],
          projectedReason:
            "Resultado general definido desde el data-flow del tenant y heredado por todas las obras.",
          resultValue: null,
          hideResultValue: true,
          resultDetail: result.description || "Resultado general de General Tab.",
          resultOrder: (result.generalTabSlot === "hero" ? 200 : 400) + result.generalTabOrder,
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
          status: "ok",
          supportStatus: "implemented",
          data: {
            calculationId: result.calculationId,
            viewId: `tenant-${result.id}`,
            projectionMode: "tenant_builder",
            editorManaged: true,
          },
        });
      }
    }

    return NextResponse.json({
      obra: {
        id: "tenant",
        label: "Todas las obras",
      },
      summary: {
        tables: nodes.filter((node) => node.type === "table").length,
        macroTables: nodes.filter((node) => node.type === "macro_table").length,
        calculations: nodes.filter((node) => node.type === "calculation").length,
        views: nodes.filter((node) => node.type === "view").length,
        edges: edges.length,
      },
      coverage: {
        mode: "tenant",
        items: [
          {
            id: "tenant_data_flow",
            label: "Data-flow general",
            status: "implemented" satisfies SupportStatus,
            detail: "Estos calculos y resultados viven a nivel tenant y se heredan en las obras.",
          },
          {
            id: "obra_fields",
            label: "Campos de obra",
            status: "implemented" satisfies SupportStatus,
            detail: "Los inputs generales pueden usar campos comunes de obra y otros calculos generales.",
          },
          {
            id: "default_tables",
            label: "Tablas generales por obra",
            status: "implemented" satisfies SupportStatus,
            detail: "Las tablas default del tenant aparecen como fuentes abstractas del data-flow general.",
          },
        ],
      },
      diagnostics: {
        reportingProjectionErrors: [],
      },
      nodes,
      edges,
    });
  } catch (error) {
    console.error("[tenant-data-flow-graph:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
