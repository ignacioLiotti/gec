import { NextResponse } from "next/server";

import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";
import { normalizeFieldKey, normalizeFolderName, normalizeFolderPath } from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };

type DataInputMethod = "ocr" | "manual" | "both";
type SupportStatus = "implemented" | "partial" | "planned" | "not_supported";

type FolderNodeType =
  | "folder_source"
  | "document_classifier"
  | "extraction_strategy"
  | "table_mapper"
  | "lineage_policy"
  | "conflict_handler"
  | "downstream_consumers";

type FolderGraphNode = {
  id: string;
  type: FolderNodeType;
  label: string;
  status: string;
  supportStatus: SupportStatus;
  data: Record<string, unknown>;
};

type FolderGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
};

type TableRecord = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  rowCount: number;
  status: "ready" | "partial" | "conflict";
  editable: boolean;
  editabilityReason: string;
  mappedColumns: TableColumnRecord[];
  unmappedColumns: TemplateColumnRecord[];
  extraColumns: TableColumnRecord[];
  consumers: Array<{ id: string; name: string }>;
  mappingConflicts: Array<{ code: string; message: string }>;
};

type TableColumnRecord = {
  id: string;
  fieldKey: string;
  label: string;
  dataType: string;
  required: boolean;
  position: number;
};

type TemplateColumnRecord = {
  fieldKey: string;
  label: string;
  dataType: string;
  required: boolean;
};

type LineageSummary = {
  totalRows: number;
  stableRows: number;
  legacyRows: number;
  rematerializedRows: number;
  rowsWithExtraction: number;
};

type ConflictSummary = {
  ocrConflicts: number;
  downstreamConflicts: number;
  stableOverrides: number;
  legacyOverrides: number;
};

function normalizeDataInputMethod(value: unknown): DataInputMethod {
  if (value === "ocr" || value === "manual" || value === "both") return value;
  return "both";
}

function normalizeSpreadsheetTemplate(value: unknown): "auto" | "certificado" | null {
  if (value === "auto" || value === "certificado") return value;
  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readSettings(record: unknown): Record<string, unknown> {
  if (record && typeof record === "object" && !Array.isArray(record)) {
    return { ...(record as Record<string, unknown>) };
  }
  return {};
}

function sameJsonValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function resolveUniformValue<T>(values: T[]): { value: T | null; isUniform: boolean } {
  if (values.length === 0) return { value: null, isUniform: true };
  const [first, ...rest] = values;
  const isUniform = rest.every((value) => sameJsonValue(value, first));
  return {
    value: (first ?? null) as T | null,
    isUniform,
  };
}

function pushNode(nodes: FolderGraphNode[], seen: Set<string>, node: FolderGraphNode) {
  if (seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

function pushEdge(edges: FolderGraphEdge[], seen: Set<string>, edge: FolderGraphEdge) {
  if (seen.has(edge.id)) return;
  seen.add(edge.id);
  edges.push(edge);
}

function buildGraph(args: {
  folderPath: string;
  folderLabel: string;
  documentCount: number;
  tables: Array<{
    id: string;
    name: string;
    rowCount: number;
    isDefault: boolean;
    status: "ready" | "partial" | "conflict";
    editable: boolean;
    editabilityReason: string;
    mappedColumns: TableColumnRecord[];
    unmappedColumns: TemplateColumnRecord[];
    extraColumns: TableColumnRecord[];
    consumers: Array<{ id: string; name: string }>;
    mappingConflicts: Array<{ code: string; message: string }>;
  }>;
  macroTables: Array<{ id: string; name: string }>;
  lineage: LineageSummary;
  conflicts: ConflictSummary;
  config: {
    dataInputMethod: DataInputMethod;
    documentTypes: string[];
    extractionInstructions: string;
    ocrTemplateId: string | null;
    spreadsheetTemplate: "auto" | "certificado" | null;
    defaultTablaId: string | null;
    manualEntryEnabled: boolean;
    hasNestedData: boolean;
    sharedSettingsUniform: boolean;
  };
}) {
  const nodes: FolderGraphNode[] = [];
  const edges: FolderGraphEdge[] = [];
  const seenNodes = new Set<string>();
  const seenEdges = new Set<string>();

  pushNode(nodes, seenNodes, {
    id: `folder:${args.folderPath}`,
    type: "folder_source",
    label: args.folderLabel,
    status: "implemented",
    supportStatus: "implemented",
    data: {
      folderPath: args.folderPath,
      documentCount: args.documentCount,
      linkedTables: args.tables.length,
    },
  });

  pushNode(nodes, seenNodes, {
    id: "node:document-classifier",
    type: "document_classifier",
    label: "Clasificador documental",
    status:
      args.config.documentTypes.length > 0 || args.config.extractionInstructions.length > 0
        ? "configured"
        : "baseline",
    supportStatus: "implemented",
    data: {
      documentTypes: args.config.documentTypes,
      extractionInstructions: args.config.extractionInstructions,
    },
  });

  pushNode(nodes, seenNodes, {
    id: "node:extraction-strategy",
    type: "extraction_strategy",
    label: "Estrategia de extraccion",
    status: args.config.sharedSettingsUniform ? "configured" : "mixed",
    supportStatus: "partial",
    data: {
      dataInputMethod: args.config.dataInputMethod,
      ocrTemplateId: args.config.ocrTemplateId,
      spreadsheetTemplate: args.config.spreadsheetTemplate,
      manualEntryEnabled: args.config.manualEntryEnabled,
      hasNestedData: args.config.hasNestedData,
    },
  });

  pushNode(nodes, seenNodes, {
    id: "node:table-mapper",
    type: "table_mapper",
    label: "Mapeo a tablas",
    status: args.tables.some((table) => table.status === "conflict")
      ? "conflict"
      : args.tables.some((table) => table.status === "partial")
        ? "partial"
        : args.tables.length > 1
          ? "fan_out"
          : "single_target",
    supportStatus: "implemented",
    data: {
      defaultTablaId: args.config.defaultTablaId,
      fanOutCount: args.tables.length,
      targetTables: args.tables.map((table) => ({
        id: table.id,
        name: table.name,
        rowCount: table.rowCount,
        isDefault: table.isDefault,
        status: table.status,
        editable: table.editable,
        editabilityReason: table.editabilityReason,
        mappedColumns: table.mappedColumns,
        unmappedColumns: table.unmappedColumns,
        extraColumns: table.extraColumns,
        consumers: table.consumers,
        mappingConflicts: table.mappingConflicts,
      })),
    },
  });

  pushNode(nodes, seenNodes, {
    id: "node:lineage-policy",
    type: "lineage_policy",
    label: "Lineage estable",
    status: "stable_identity",
    supportStatus: "implemented",
    data: {
      mode: "lineage_row_key",
      materializationMode: "materialization_version",
      extractionMode: "extraction_id",
      totalRows: args.lineage.totalRows,
      stableRows: args.lineage.stableRows,
      legacyRows: args.lineage.legacyRows,
      rematerializedRows: args.lineage.rematerializedRows,
      rowsWithExtraction: args.lineage.rowsWithExtraction,
    },
  });

  pushNode(nodes, seenNodes, {
    id: "node:conflict-handler",
    type: "conflict_handler",
    label: "Conflictos",
    status: "flag_conflict",
    supportStatus: "implemented",
    data: {
      ocrConflict: "LINEAGE_RECONCILIATION_CONFLICT",
      downstreamConflict: "LINEAGE_OVERRIDE_REATTACH_CONFLICT",
      ocrConflicts: args.conflicts.ocrConflicts,
      downstreamConflicts: args.conflicts.downstreamConflicts,
      stableOverrides: args.conflicts.stableOverrides,
      legacyOverrides: args.conflicts.legacyOverrides,
    },
  });

  pushNode(nodes, seenNodes, {
    id: "node:downstream-consumers",
    type: "downstream_consumers",
    label: "Consumers downstream",
    status: args.macroTables.length > 0 ? "connected" : "none",
    supportStatus: args.macroTables.length > 0 ? "implemented" : "partial",
    data: {
      macroTables: args.macroTables,
      connectedCount: args.macroTables.length,
    },
  });

  const orderedNodeIds = nodes.map((node) => node.id);
  for (let index = 0; index < orderedNodeIds.length - 1; index += 1) {
    pushEdge(edges, seenEdges, {
      id: `edge:${orderedNodeIds[index]}:${orderedNodeIds[index + 1]}`,
      source: orderedNodeIds[index]!,
      target: orderedNodeIds[index + 1]!,
      type: "pipeline_step",
    });
  }

  return { nodes, edges };
}

function normalizeTemplateColumns(value: unknown): TemplateColumnRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((column, index) => {
      if (!column || typeof column !== "object" || Array.isArray(column)) return null;
      const item = column as Record<string, unknown>;
      const label =
        typeof item.label === "string" && item.label.trim().length > 0
          ? item.label.trim()
          : `Columna ${index + 1}`;
      const fieldKey = normalizeFieldKey(
        typeof item.fieldKey === "string" && item.fieldKey.trim().length > 0
          ? item.fieldKey
          : label,
      );
      return {
        fieldKey,
        label,
        dataType:
          typeof item.dataType === "string" && item.dataType.trim().length > 0
            ? item.dataType.trim()
            : "text",
        required: Boolean(item.required),
      } satisfies TemplateColumnRecord;
    })
    .filter((column): column is TemplateColumnRecord => Boolean(column));
}

async function resolveFolderTables(params: {
  supabase: Awaited<ReturnType<typeof resolveRequestAccessContext>>["supabase"];
  obraId: string;
  tenantId: string;
  folderPath: string;
}) {
  const { supabase, obraId, tenantId, folderPath } = params;
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  const normalizedFlatFolderName = normalizeFolderName(normalizedFolderPath);

  const { data: tablas, error: tablasError } = await supabase
    .from("obra_tablas")
    .select("id, obra_id, name, source_type, settings")
    .eq("obra_id", obraId)
    .eq("source_type", "ocr");

  if (tablasError) throw tablasError;

  const linkedTables = (tablas ?? [])
    .map((tabla) => {
      const settings = readSettings(tabla.settings);
      const rawFolder = typeof settings.ocrFolder === "string" ? settings.ocrFolder : "";
      const normalizedTableFolder = normalizeFolderPath(rawFolder);
      if (!normalizedTableFolder) return null;
      if (
        normalizedTableFolder !== normalizedFolderPath &&
        normalizeFolderName(normalizedTableFolder) !== normalizedFlatFolderName
      ) {
        return null;
      }
      return {
        id: tabla.id as string,
        name: tabla.name as string,
        settings,
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; settings: Record<string, unknown> }>;

  const tableColumnsByTablaId = new Map<string, TableColumnRecord[]>();
  if (linkedTables.length > 0) {
    const { data: tableColumns, error: tableColumnsError } = await supabase
      .from("obra_tabla_columns")
      .select("id, tabla_id, field_key, label, data_type, required, position")
      .in(
        "tabla_id",
        linkedTables.map((table) => table.id),
      )
      .order("position", { ascending: true });
    if (tableColumnsError) throw tableColumnsError;
    for (const column of tableColumns ?? []) {
      const tablaId = column.tabla_id as string;
      if (!tableColumnsByTablaId.has(tablaId)) {
        tableColumnsByTablaId.set(tablaId, []);
      }
      tableColumnsByTablaId.get(tablaId)?.push({
        id: column.id as string,
        fieldKey: column.field_key as string,
        label: column.label as string,
        dataType: typeof column.data_type === "string" ? column.data_type : "text",
        required: Boolean(column.required),
        position: Number(column.position ?? 0),
      });
    }
  }

  const rowCountByTablaId = new Map<string, number>();
  const lineageSummary: LineageSummary = {
    totalRows: 0,
    stableRows: 0,
    legacyRows: 0,
    rematerializedRows: 0,
    rowsWithExtraction: 0,
  };
  if (linkedTables.length > 0) {
    const { data: rowData, error: rowError } = await supabase
      .from("obra_tabla_rows")
      .select("tabla_id, lineage_row_key, materialization_version, extraction_id")
      .in(
        "tabla_id",
        linkedTables.map((table) => table.id),
      );
    if (rowError) throw rowError;
    for (const row of rowData ?? []) {
      const tablaId = row.tabla_id as string;
      rowCountByTablaId.set(tablaId, (rowCountByTablaId.get(tablaId) ?? 0) + 1);
      lineageSummary.totalRows += 1;
      if (typeof row.lineage_row_key === "string" && row.lineage_row_key.startsWith("legacy:")) {
        lineageSummary.legacyRows += 1;
      } else if (typeof row.lineage_row_key === "string" && row.lineage_row_key.length > 0) {
        lineageSummary.stableRows += 1;
      }
      if (Number(row.materialization_version ?? 0) > 1) {
        lineageSummary.rematerializedRows += 1;
      }
      if (typeof row.extraction_id === "string" && row.extraction_id.length > 0) {
        lineageSummary.rowsWithExtraction += 1;
      }
    }
  }

  const templatesMap = new Map<
    string,
    { id: string; name: string; description: string | null; columns: TemplateColumnRecord[] }
  >();
  const { data: templates, error: templatesError } = await supabase
    .from("ocr_templates")
    .select("id, name, description, columns")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (templatesError) throw templatesError;
  for (const template of templates ?? []) {
    templatesMap.set(template.id as string, {
      id: template.id as string,
      name: template.name as string,
      description: (template.description as string | null) ?? null,
      columns: normalizeTemplateColumns(template.columns),
    });
  }

  const { data: documents, error: documentsError } = await supabase
    .from("ocr_document_processing")
    .select("id, tabla_id, error_code")
    .eq("obra_id", obraId)
    .in(
      "tabla_id",
      linkedTables.map((table) => table.id),
    );
  if (documentsError) throw documentsError;

  const conflictSummary: ConflictSummary = {
    ocrConflicts: (documents ?? []).filter(
      (document) => document.error_code === "LINEAGE_RECONCILIATION_CONFLICT",
    ).length,
    downstreamConflicts: 0,
    stableOverrides: 0,
    legacyOverrides: 0,
  };

  const macroTablesById = new Map<string, { id: string; name: string }>();
  const macroTablesByTablaId = new Map<string, Array<{ id: string; name: string }>>();
  if (linkedTables.length > 0) {
    const { data: macroSources, error: macroSourcesError } = await supabase
      .from("macro_table_sources")
      .select("obra_tabla_id, macro_table_id, macro_tables!inner(id, name)")
      .in(
        "obra_tabla_id",
        linkedTables.map((table) => table.id),
      );
    if (macroSourcesError) throw macroSourcesError;
    for (const source of macroSources ?? []) {
      const macroTable = Array.isArray(source.macro_tables)
        ? source.macro_tables[0]
        : source.macro_tables;
      if (!macroTable) continue;
      macroTablesById.set(macroTable.id as string, {
        id: macroTable.id as string,
        name: macroTable.name as string,
      });
      const tablaId = source.obra_tabla_id as string;
      if (!macroTablesByTablaId.has(tablaId)) {
        macroTablesByTablaId.set(tablaId, []);
      }
      macroTablesByTablaId.get(tablaId)?.push({
        id: macroTable.id as string,
        name: macroTable.name as string,
      });
    }

    const { data: overrides, error: overridesError } = await supabase
      .from("macro_table_custom_values")
      .select("binding_status, source_tabla_id")
      .in(
        "source_tabla_id",
        linkedTables.map((table) => table.id),
      );
    if (overridesError) throw overridesError;
    for (const override of overrides ?? []) {
      if (override.binding_status === "conflict") {
        conflictSummary.downstreamConflicts += 1;
      } else if (override.binding_status === "stable") {
        conflictSummary.stableOverrides += 1;
      } else if (override.binding_status === "legacy") {
        conflictSummary.legacyOverrides += 1;
      }
    }
  }

  const tableRecords: TableRecord[] = linkedTables.map((table) => {
    const currentColumns = tableColumnsByTablaId.get(table.id) ?? [];
    const templateId =
      typeof table.settings.ocrTemplateId === "string" && table.settings.ocrTemplateId.trim().length > 0
        ? table.settings.ocrTemplateId.trim()
        : null;
    const templateColumns = templateId ? templatesMap.get(templateId)?.columns ?? [] : [];
    const templateFieldKeys = new Set(templateColumns.map((column) => column.fieldKey));
    const currentFieldKeys = new Set(currentColumns.map((column) => column.fieldKey));
    const mappedColumns =
      templateColumns.length > 0
        ? currentColumns.filter((column) => templateFieldKeys.has(column.fieldKey))
        : currentColumns;
    const extraColumns =
      templateColumns.length > 0
        ? currentColumns.filter((column) => !templateFieldKeys.has(column.fieldKey))
        : [];
    const unmappedColumns =
      templateColumns.length > 0
        ? templateColumns.filter((column) => !currentFieldKeys.has(column.fieldKey))
        : [];

    const mappingConflicts: Array<{ code: string; message: string }> = [];
    if (currentColumns.length === 0) {
      mappingConflicts.push({
        code: "TABLE_SCHEMA_EMPTY",
        message: "La tabla no tiene columnas objetivo configuradas.",
      });
    }
    if (templateId && !templatesMap.has(templateId)) {
      mappingConflicts.push({
        code: "OCR_TEMPLATE_MISSING",
        message: "La tabla referencia un template OCR que ya no esta disponible.",
      });
    }
    if (!templateId && normalizeDataInputMethod(table.settings.dataInputMethod) !== "manual") {
      mappingConflicts.push({
        code: "SOURCE_CONTRACT_MISSING",
        message: "No hay template OCR asociado; el sistema no puede mostrar mapping fuente -> destino con precision.",
      });
    }
    if (templateColumns.length > 0 && mappedColumns.length === 0 && currentColumns.length > 0) {
      mappingConflicts.push({
        code: "NO_TEMPLATE_MATCH",
        message: "La tabla tiene columnas, pero ninguna coincide con el contrato del template OCR actual.",
      });
    }
    if (unmappedColumns.length > 0) {
      mappingConflicts.push({
        code: "UNMAPPED_TEMPLATE_COLUMNS",
        message: `${unmappedColumns.length} columna(s) esperada(s) por el template todavia no estan mapeadas en la tabla.`,
      });
    }

    let status: TableRecord["status"] = "ready";
    if (
      mappingConflicts.some((conflict) =>
        conflict.code === "TABLE_SCHEMA_EMPTY" ||
        conflict.code === "OCR_TEMPLATE_MISSING" ||
        conflict.code === "NO_TEMPLATE_MATCH",
      )
    ) {
      status = "conflict";
    } else if (mappingConflicts.length > 0 || extraColumns.length > 0) {
      status = "partial";
    }

    return {
      id: table.id,
      name: table.name,
      settings: table.settings,
      rowCount: rowCountByTablaId.get(table.id) ?? 0,
      status,
      editable: false,
      editabilityReason:
        "En este slice solo se puede cambiar la tabla primaria del folder. El mapping por columna todavia no se persiste desde este editor.",
      mappedColumns,
      unmappedColumns,
      extraColumns,
      consumers: macroTablesByTablaId.get(table.id) ?? [],
      mappingConflicts,
    };
  });

  return {
    tables: tableRecords,
    templates: [...templatesMap.values()].map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
    })),
    documentCount: (documents ?? []).length,
    macroTables: [...macroTablesById.values()],
    lineageSummary,
    conflictSummary,
  };
}

export async function GET(request: Request, context: RouteContext) {
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

    const url = new URL(request.url);
    const folderPath = normalizeFolderPath(url.searchParams.get("folderPath") ?? "");
    if (!folderPath) {
      return NextResponse.json({ error: "folderPath requerido" }, { status: 400 });
    }

    const { data: obraRow, error: obraError } = await supabase
      .from("obras")
      .select("id")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obraRow) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const { tables, templates, documentCount, macroTables, lineageSummary, conflictSummary } = await resolveFolderTables({
      supabase,
      obraId,
      tenantId,
      folderPath,
    });

    if (tables.length === 0) {
      return NextResponse.json({ error: "No encontramos tablas OCR vinculadas a esa carpeta" }, { status: 404 });
    }

    const settingsList = tables.map((table) => table.settings);
    const defaultTabla = tables.find((table) => {
      return settingsList.some((settings) => settings.defaultTablaId === table.id);
    }) ?? null;

    const dataInputMethod = resolveUniformValue(
      settingsList.map((settings) => normalizeDataInputMethod(settings.dataInputMethod)),
    );
    const documentTypes = resolveUniformValue(
      settingsList.map((settings) => normalizeStringList(settings.extractionDocumentTypes)),
    );
    const extractionInstructions = resolveUniformValue(
      settingsList.map((settings) =>
        typeof settings.extractionInstructions === "string"
          ? settings.extractionInstructions.trim()
          : typeof settings.ocrInstructions === "string"
            ? settings.ocrInstructions.trim()
            : "",
      ),
    );
    const ocrTemplateId = resolveUniformValue(
      settingsList.map((settings) =>
        typeof settings.ocrTemplateId === "string" && settings.ocrTemplateId.trim().length > 0
          ? settings.ocrTemplateId.trim()
          : null,
      ),
    );
    const spreadsheetTemplate = resolveUniformValue(
      settingsList.map((settings) => normalizeSpreadsheetTemplate(settings.spreadsheetTemplate)),
    );
    const manualEntryEnabled = resolveUniformValue(
      settingsList.map((settings) =>
        typeof settings.manualEntryEnabled === "boolean"
          ? settings.manualEntryEnabled
          : normalizeDataInputMethod(settings.dataInputMethod) !== "ocr",
      ),
    );
    const hasNestedData = resolveUniformValue(
      settingsList.map((settings) => Boolean(settings.hasNestedData)),
    );
    const defaultTablaId = resolveUniformValue(
      settingsList.map((settings) =>
        typeof settings.defaultTablaId === "string" && settings.defaultTablaId.trim().length > 0
          ? settings.defaultTablaId.trim()
          : null,
      ),
    );

    const linkedTablaIdSet = new Set(tables.map((table) => table.id));
    const normalizedDefaultTablaId =
      defaultTablaId.value && linkedTablaIdSet.has(defaultTablaId.value)
        ? defaultTablaId.value
        : null;

    const sharedSettingsUniform = [
      dataInputMethod.isUniform,
      documentTypes.isUniform,
      extractionInstructions.isUniform,
      ocrTemplateId.isUniform,
      spreadsheetTemplate.isUniform,
      manualEntryEnabled.isUniform,
      hasNestedData.isUniform,
      defaultTablaId.isUniform,
    ].every(Boolean);

    const folderLabel =
      (typeof tables[0]?.settings.ocrFolderLabel === "string" &&
        tables[0].settings.ocrFolderLabel.trim().length > 0 &&
        tables[0].settings.ocrFolderLabel.trim()) ||
      folderPath.split("/").filter(Boolean).pop() ||
      folderPath;

    const config = {
      dataInputMethod: dataInputMethod.value ?? "both",
      documentTypes: documentTypes.value ?? [],
      extractionInstructions: extractionInstructions.value ?? "",
      ocrTemplateId: ocrTemplateId.value ?? null,
      spreadsheetTemplate: spreadsheetTemplate.value ?? null,
      defaultTablaId: normalizedDefaultTablaId ?? defaultTabla?.id ?? null,
      manualEntryEnabled: manualEntryEnabled.value ?? true,
      hasNestedData: hasNestedData.value ?? false,
      sharedSettingsUniform,
      targetTablaIds: tables.map((table) => table.id),
    };

    const graph = buildGraph({
      folderPath,
      folderLabel,
      documentCount,
      tables: tables.map((table) => ({
        id: table.id,
        name: table.name,
        rowCount: table.rowCount,
        isDefault: (config.defaultTablaId ?? null) === table.id,
        status: table.status,
        editable: table.editable,
        editabilityReason: table.editabilityReason,
        mappedColumns: table.mappedColumns,
        unmappedColumns: table.unmappedColumns,
        extraColumns: table.extraColumns,
        consumers: table.consumers,
        mappingConflicts: table.mappingConflicts,
      })),
      macroTables,
      lineage: lineageSummary,
      conflicts: conflictSummary,
      config,
    });

    return NextResponse.json({
      folder: {
        path: folderPath,
        label: folderLabel,
      },
      config,
      tables: tables.map((table) => ({
        id: table.id,
        name: table.name,
        rowCount: table.rowCount,
        isDefault: config.defaultTablaId === table.id,
        status: table.status,
        editable: table.editable,
        editabilityReason: table.editabilityReason,
        mappedColumns: table.mappedColumns,
        unmappedColumns: table.unmappedColumns,
        extraColumns: table.extraColumns,
        consumers: table.consumers,
        mappingConflicts: table.mappingConflicts,
      })),
      templates,
      macroTables,
      lineage: lineageSummary,
      conflicts: conflictSummary,
      stats: {
        linkedTables: tables.length,
        documents: documentCount,
        macroTables: macroTables.length,
      },
      graph,
    });
  } catch (error) {
    console.error("[folder-extraction-pipeline:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
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

    const body = await request.json().catch(() => ({}));
    const folderPath = normalizeFolderPath(
      typeof body.folderPath === "string" ? body.folderPath : "",
    );
    if (!folderPath) {
      return NextResponse.json({ error: "folderPath requerido" }, { status: 400 });
    }

    const { data: obraRow, error: obraError } = await supabase
      .from("obras")
      .select("id")
      .eq("id", obraId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (obraError) throw obraError;
    if (!obraRow) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const { tables } = await resolveFolderTables({
      supabase,
      obraId,
      tenantId,
      folderPath,
    });
    if (tables.length === 0) {
      return NextResponse.json({ error: "No encontramos tablas OCR vinculadas a esa carpeta" }, { status: 404 });
    }

    const allowedTablaIds = new Set(tables.map((table) => table.id));
    const requestedDefaultTablaId =
      typeof body.defaultTablaId === "string" && body.defaultTablaId.trim().length > 0
        ? body.defaultTablaId.trim()
        : null;
    if (requestedDefaultTablaId && !allowedTablaIds.has(requestedDefaultTablaId)) {
      return NextResponse.json({ error: "defaultTablaId no pertenece a la carpeta seleccionada" }, { status: 400 });
    }

    const documentTypes = normalizeStringList(body.documentTypes);
    const extractionInstructions =
      typeof body.extractionInstructions === "string" ? body.extractionInstructions.trim() : "";
    const dataInputMethod = normalizeDataInputMethod(body.dataInputMethod);
    const ocrTemplateId =
      typeof body.ocrTemplateId === "string" && body.ocrTemplateId.trim().length > 0
        ? body.ocrTemplateId.trim()
        : null;
    const spreadsheetTemplate = normalizeSpreadsheetTemplate(body.spreadsheetTemplate) ?? "auto";
    const manualEntryEnabled =
      typeof body.manualEntryEnabled === "boolean"
        ? body.manualEntryEnabled
        : dataInputMethod !== "ocr";
    const hasNestedData = body.hasNestedData === true;

    for (const table of tables) {
      const nextSettings = {
        ...table.settings,
        ocrFolder: folderPath,
        dataInputMethod,
        extractionDocumentTypes: documentTypes,
        extractionInstructions,
        ocrInstructions: extractionInstructions,
        spreadsheetTemplate,
        ocrTemplateId,
        defaultTablaId: requestedDefaultTablaId,
        manualEntryEnabled,
        hasNestedData,
        folderExtractionGraph: {
          strategy:
            spreadsheetTemplate === "certificado"
              ? "spreadsheet_multi"
              : tables.length > 1
                ? "ocr_multi"
                : "ocr_single",
          folderPath,
          updatedAt: new Date().toISOString(),
          updatedByUserId: user?.id ?? null,
        },
      } satisfies Record<string, unknown>;

      const { error: updateError } = await supabase
        .from("obra_tablas")
        .update({ settings: nextSettings })
        .eq("id", table.id)
        .eq("obra_id", obraId);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[folder-extraction-pipeline:put]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
