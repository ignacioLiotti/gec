import { NextResponse } from "next/server";
import {
  matchesMacroFilters,
  matchesMacroSearch,
  type MacroTableFilters,
} from "@/lib/macro-table-filters";
import {
  mapColumnToResponse,
  type MacroTableColumn,
  type MacroTableOverrideBindingStatus,
  type MacroTableOverrideConflict,
  type MacroTableOverrideSummary,
  type MacroTableRow,
} from "@/lib/macro-tables";
import {
  buildMacroSourceSelectionSettings,
  resolveMacroSourceTablas,
  type MacroSourceTablaRecord,
} from "@/lib/macro-table-source-selection";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";
import {
  canAutoWriteDataFlow,
  tryRecomputeObraDataFlowWritebacks,
} from "@/lib/data-flow-recompute";

type RouteContext = { params: Promise<{ id: string }> };

const LINEAGE_OVERRIDE_REATTACH_CONFLICT = "LINEAGE_OVERRIDE_REATTACH_CONFLICT" as const;

type SourceRowRecord = {
  id: string;
  tabla_id: string;
  lineage_row_key: string | null;
  extraction_id: string | null;
  materialization_version: number | null;
  data: Record<string, unknown> | null;
  created_at: string | null;
};

type CustomValueRecord = {
  id: string;
  macro_table_id: string;
  source_row_id: string;
  source_tabla_id: string | null;
  lineage_row_key: string | null;
  column_id: string;
  value: unknown;
  binding_status: MacroTableOverrideBindingStatus | null;
  binding_error: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type OverrideResolution = {
  valuesByRowId: Map<string, Map<string, unknown>>;
  rowBindingStatus: Map<string, MacroTableOverrideBindingStatus>;
  rowConflictCounts: Map<string, number>;
  conflicts: MacroTableOverrideConflict[];
  summary: MacroTableOverrideSummary;
};

type ObraRecord = {
  id: string;
  n: number | string | null;
  designacion_y_ubicacion: string | null;
  sup_de_obra_m2: number | string | null;
  entidad_contratante: string | null;
  mes_basico_de_contrato: string | null;
  iniciacion: string | null;
  contrato_mas_ampliaciones: number | string | null;
  certificado_a_la_fecha: number | string | null;
  saldo_a_certificar: number | string | null;
  segun_contrato: number | string | null;
  prorrogas_acordadas: number | string | null;
  plazo_total: number | string | null;
  plazo_transc: number | string | null;
  porcentaje: number | string | null;
  custom_data?: Record<string, unknown> | null;
};

function mapTablaRecord(record: unknown): MacroSourceTablaRecord {
  const resolvedRecord = Array.isArray(record) ? record[0] : record;
  const safeRecord =
    resolvedRecord && typeof resolvedRecord === "object"
      ? (resolvedRecord as {
          id?: unknown;
          name?: unknown;
          obra_id?: unknown;
          settings?: unknown;
          obras?: unknown;
        })
      : {};
  const obrasRecord = Array.isArray(safeRecord.obras) ? safeRecord.obras[0] : safeRecord.obras;
  const safeObraRecord =
    obrasRecord && typeof obrasRecord === "object"
      ? (obrasRecord as { designacion_y_ubicacion?: unknown })
      : {};
  const settings =
    safeRecord.settings &&
    typeof safeRecord.settings === "object" &&
    !Array.isArray(safeRecord.settings)
      ? (safeRecord.settings as Record<string, unknown>)
      : {};

  return {
    id: safeRecord.id as string,
    name: (safeRecord.name as string) ?? "",
    defaultTablaId:
      typeof settings.defaultTablaId === "string" ? (settings.defaultTablaId as string) : null,
    obraId: typeof safeRecord.obra_id === "string" ? safeRecord.obra_id : undefined,
    obraName:
      typeof safeObraRecord.designacion_y_ubicacion === "string"
        ? (safeObraRecord.designacion_y_ubicacion as string)
        : undefined,
  };
}

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value: unknown): number => Math.max(0, Math.min(100, toNumber(value)));

function isColumnManuallyEditable(column: {
  columnType: string;
  config?: Record<string, unknown> | null;
}): boolean {
  if (column.columnType === "custom") return true;
  const allowManualEdit = column.config?.allowManualEdit;
  return allowManualEdit === true || allowManualEdit === "true" || allowManualEdit === 1;
}

function mapObraRecord(record: ObraRecord | null | undefined): Record<string, unknown> {
  if (!record) return {};
  const contratoMasAmpliaciones = toNumber(record.contrato_mas_ampliaciones);
  const porcentaje = clampPercent(record.porcentaje);
  const certificadoALaFecha = contratoMasAmpliaciones * (porcentaje / 100);
  const saldoACertificar = contratoMasAmpliaciones - certificadoALaFecha;

  return {
    n: toNumber(record.n),
    designacionYUbicacion: record.designacion_y_ubicacion ?? "",
    supDeObraM2: toNumber(record.sup_de_obra_m2),
    entidadContratante: record.entidad_contratante ?? "",
    mesBasicoDeContrato: record.mes_basico_de_contrato ?? "",
    iniciacion: record.iniciacion ?? "",
    contratoMasAmpliaciones,
    certificadoALaFecha: toNumber(record.certificado_a_la_fecha) || certificadoALaFecha,
    saldoACertificar: toNumber(record.saldo_a_certificar) || saldoACertificar,
    segunContrato: toNumber(record.segun_contrato),
    prorrogasAcordadas: toNumber(record.prorrogas_acordadas),
    plazoTotal: toNumber(record.plazo_total),
    plazoTransc: toNumber(record.plazo_transc),
    porcentaje,
    customData:
      record.custom_data && typeof record.custom_data === "object" && !Array.isArray(record.custom_data)
        ? record.custom_data
        : {},
  };
}

function resolveObraSourceValue(obraValues: Record<string, unknown>, sourceFieldKey: string): unknown {
  const obraFieldKey = sourceFieldKey.slice("obra.".length);
  if (!obraFieldKey) return null;
  if (Object.prototype.hasOwnProperty.call(obraValues, obraFieldKey)) {
    return obraValues[obraFieldKey];
  }
  const customData = obraValues.customData;
  if (customData && typeof customData === "object" && !Array.isArray(customData)) {
    return (customData as Record<string, unknown>)[obraFieldKey] ?? null;
  }
  return null;
}

function normalizeBusinessIdentityValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function resolveBusinessIdentityValue(rowData: Record<string, unknown>): string | null {
  const candidateKeys = [
    "nro",
    "numero",
    "nro_orden",
    "numero_orden",
    "order_number",
    "certificado",
    "nro_certificado",
    "invoice_number",
    "factura",
    "id_negocio",
  ];

  for (const key of candidateKeys) {
    if (!Object.prototype.hasOwnProperty.call(rowData, key)) continue;
    const resolved = normalizeBusinessIdentityValue(rowData[key]);
    if (resolved) return resolved;
  }

  return null;
}

function extractDocumentPath(rowData: Record<string, unknown>): string | null {
  const value = rowData.__docPath;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractDocumentFileName(docPath: string | null): string | null {
  if (!docPath) return null;
  const parts = docPath.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] ?? null : null;
}

function buildStableIdentityKey(
  sourceTablaId: string | null | undefined,
  lineageRowKey: string | null | undefined,
): string | null {
  if (!sourceTablaId || !lineageRowKey) return null;
  return `${sourceTablaId}::${lineageRowKey}`;
}

function buildCellKey(rowId: string, columnId: string): string {
  return `${rowId}::${columnId}`;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [];
  const normalizedSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += normalizedSize) {
    chunks.push(values.slice(index, index + normalizedSize));
  }
  return chunks;
}

function dedupeOverrides(records: CustomValueRecord[]): CustomValueRecord[] {
  const unique = new Map<string, CustomValueRecord>();
  for (const record of records) {
    unique.set(record.id, record);
  }
  return [...unique.values()];
}

function setRowBindingStatus(
  map: Map<string, MacroTableOverrideBindingStatus>,
  rowId: string,
  nextStatus: MacroTableOverrideBindingStatus,
) {
  const current = map.get(rowId);
  if (current === "conflict") return;
  if (nextStatus === "conflict" || current == null) {
    map.set(rowId, nextStatus);
    return;
  }
  if (nextStatus === "stable" || current === "legacy") {
    map.set(rowId, nextStatus);
  }
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildOverrideConflict(args: {
  macroTableId: string;
  rowId: string;
  sourceTablaId: string | null;
  lineageRowKey: string | null;
  columnId: string;
  candidates: CustomValueRecord[];
  detail: string;
}): MacroTableOverrideConflict {
  const uniqueCandidates = dedupeOverrides(args.candidates);
  return {
    code: LINEAGE_OVERRIDE_REATTACH_CONFLICT,
    macroTableId: args.macroTableId,
    rowId: args.rowId,
    sourceTablaId: args.sourceTablaId,
    lineageRowKey: args.lineageRowKey,
    columnId: args.columnId,
    candidateOverrideIds: uniqueCandidates.map((candidate) => candidate.id),
    candidateSourceRowIds: uniqueCandidates.map((candidate) => candidate.source_row_id),
    detail: args.detail,
  };
}

function isMissingLineageMigrationError(message: string): boolean {
  return /source_tabla_id|binding_status|binding_error|lineage_row_key|materialization_version|extraction_id/i.test(
    message,
  ) && /does not exist|column/i.test(message);
}

function resolveRouteErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Error desconocido";
}

function resolveOverrideBindings(args: {
  macroTableId: string;
  currentRows: SourceRowRecord[];
  customValues: CustomValueRecord[];
}): OverrideResolution {
  const rowById = new Map(args.currentRows.map((row) => [row.id, row]));
  const rowByStableIdentity = new Map<string, SourceRowRecord>();
  for (const row of args.currentRows) {
    const stableIdentity = buildStableIdentityKey(row.tabla_id, row.lineage_row_key);
    if (stableIdentity) {
      rowByStableIdentity.set(stableIdentity, row);
    }
  }

  const stableCandidatesByCell = new Map<string, CustomValueRecord[]>();
  const legacyCandidatesByCell = new Map<string, CustomValueRecord[]>();
  const matchedOverrideIds = new Set<string>();

  for (const customValue of args.customValues) {
    const stableIdentity = buildStableIdentityKey(
      customValue.source_tabla_id,
      customValue.lineage_row_key,
    );
    const stableRow = stableIdentity ? rowByStableIdentity.get(stableIdentity) : undefined;
    if (stableRow) {
      const key = buildCellKey(stableRow.id, customValue.column_id);
      const list = stableCandidatesByCell.get(key) ?? [];
      list.push(customValue);
      stableCandidatesByCell.set(key, list);
      matchedOverrideIds.add(customValue.id);
    }

    const legacyRow = rowById.get(customValue.source_row_id);
    if (legacyRow) {
      const key = buildCellKey(legacyRow.id, customValue.column_id);
      const list = legacyCandidatesByCell.get(key) ?? [];
      list.push(customValue);
      legacyCandidatesByCell.set(key, list);
      matchedOverrideIds.add(customValue.id);
    }
  }

  const valuesByRowId = new Map<string, Map<string, unknown>>();
  const rowBindingStatus = new Map<string, MacroTableOverrideBindingStatus>();
  const rowConflictCounts = new Map<string, number>();
  const conflicts: MacroTableOverrideConflict[] = [];
  const appliedRowIds = new Set<string>();
  let appliedStable = 0;
  let appliedLegacy = 0;

  const candidateCellKeys = new Set([
    ...stableCandidatesByCell.keys(),
    ...legacyCandidatesByCell.keys(),
  ]);

  for (const cellKey of candidateCellKeys) {
    const [rowId, columnId] = cellKey.split("::");
    const row = rowById.get(rowId);
    if (!row || !columnId) continue;

    const stableCandidates = dedupeOverrides(stableCandidatesByCell.get(cellKey) ?? []);
    const legacyCandidates = dedupeOverrides(legacyCandidatesByCell.get(cellKey) ?? []);
    const extraLegacyCandidates = legacyCandidates.filter(
      (legacyCandidate) =>
        !stableCandidates.some((stableCandidate) => stableCandidate.id === legacyCandidate.id),
    );

    let conflictDetail: string | null = null;
    if (
      stableCandidates.some((candidate) => candidate.binding_status === "conflict") ||
      legacyCandidates.some((candidate) => candidate.binding_status === "conflict")
    ) {
      conflictDetail = "El override ya estaba marcado con conflicto de lineage.";
    } else if (stableCandidates.length > 1) {
      conflictDetail =
        "Hay multiples overrides estables para la misma fila y columna despues del reattach.";
    } else if (stableCandidates.length === 1 && extraLegacyCandidates.length > 0) {
      conflictDetail =
        "Conviven override estable y override legacy para la misma celda logica; no se resuelve automaticamente.";
    } else if (stableCandidates.length === 0 && legacyCandidates.length > 1) {
      conflictDetail =
        "Hay multiples overrides legacy para la misma celda y no se puede elegir uno sin ambiguedad.";
    }

    if (conflictDetail) {
      conflicts.push(
        buildOverrideConflict({
          macroTableId: args.macroTableId,
          rowId,
          sourceTablaId: row.tabla_id,
          lineageRowKey: row.lineage_row_key,
          columnId,
          candidates: [...stableCandidates, ...legacyCandidates],
          detail: conflictDetail,
        }),
      );
      setRowBindingStatus(rowBindingStatus, rowId, "conflict");
      incrementCount(rowConflictCounts, rowId);
      continue;
    }

    const selected =
      stableCandidates[0] ??
      legacyCandidates[0] ??
      null;
    if (!selected) continue;

    if (!valuesByRowId.has(rowId)) {
      valuesByRowId.set(rowId, new Map());
    }
    valuesByRowId.get(rowId)?.set(columnId, selected.value);
    appliedRowIds.add(rowId);

    const selectedStatus =
      selected.binding_status === "stable" ? "stable" : "legacy";
    setRowBindingStatus(rowBindingStatus, rowId, selectedStatus);
    if (selectedStatus === "stable") {
      appliedStable += 1;
    } else {
      appliedLegacy += 1;
    }
  }

  const rowsWithConflicts = new Set(conflicts.map((conflict) => conflict.rowId));
  for (const rowId of rowsWithConflicts) {
    appliedRowIds.add(rowId);
  }

  return {
    valuesByRowId,
    rowBindingStatus,
    rowConflictCounts,
    conflicts,
    summary: {
      totalRecords: dedupeOverrides(args.customValues.filter((value) => matchedOverrideIds.has(value.id)))
        .length,
      appliedStable,
      appliedLegacy,
      conflicts: conflicts.length,
      rowsWithOverrides: appliedRowIds.size,
      rowsWithConflicts: rowsWithConflicts.size,
    },
  };
}

function normalizeGroupValue(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return "(Sin valor)";
  return String(value);
}

function toComparableNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPresentGroupValue(value: unknown) {
  return value !== null && typeof value !== "undefined" && value !== "";
}

function summarizeGroupColumnValue(
  rows: MacroTableRow[],
  column: MacroTableColumn,
  groupColumnId: string
) {
  if (column.id === groupColumnId) return normalizeGroupValue(rows[0]?.[column.id]);

  const values = rows.map((row) => row[column.id]).filter(isPresentGroupValue);
  const summary = column.config?.macroGroupSummary;
  if (summary === "count") return values.length;
  if (values.length === 0) return null;
  if (summary === "oldest") return values[values.length - 1] ?? null;
  if (summary === "min" || summary === "max" || summary === "sum") {
    const numericValues = values.map(toComparableNumber).filter((value): value is number => value !== null);
    if (numericValues.length === 0) return values[0] ?? null;
    if (summary === "min") return Math.min(...numericValues);
    if (summary === "max") return Math.max(...numericValues);
    return numericValues.reduce((total, value) => total + value, 0);
  }
  return values[0] ?? null;
}

function compareMacroRowValues(a: unknown, b: unknown, direction: "asc" | "desc") {
  const aNumber = toComparableNumber(a);
  const bNumber = toComparableNumber(b);
  const multiplier = direction === "desc" ? -1 : 1;
  if (aNumber !== null && bNumber !== null) return (aNumber - bNumber) * multiplier;
  return String(a ?? "").localeCompare(String(b ?? ""), "es", { numeric: true }) * multiplier;
}

function sortGroupRows(rows: MacroTableRow[], groupColumn: MacroTableColumn) {
  const sortColumnId =
    typeof groupColumn.config?.macroAccordionSortColumnId === "string"
      ? groupColumn.config.macroAccordionSortColumnId
      : "";
  if (!sortColumnId) return rows;
  const direction =
    groupColumn.config?.macroAccordionSortDirection === "asc" ? "asc" : "desc";
  return [...rows].sort((a, b) => compareMacroRowValues(a[sortColumnId], b[sortColumnId], direction));
}

function sortMacroRows(
  rows: MacroTableRow[],
  sortByColumnId: string,
  direction: "asc" | "desc",
  columns: MacroTableColumn[],
) {
  if (!sortByColumnId) return rows;
  const validColumnIds = new Set(columns.map((column) => column.id));
  const allowedSystemColumns = new Set([
    "_obraName",
    "_sourceTablaName",
    "_businessIdentity",
    "_docFileName",
    "_overrideBindingStatus",
    "_overrideConflictCount",
  ]);
  if (!validColumnIds.has(sortByColumnId) && !allowedSystemColumns.has(sortByColumnId)) {
    return rows;
  }
  return [...rows].sort((left, right) =>
    compareMacroRowValues(left[sortByColumnId], right[sortByColumnId], direction)
  );
}

function groupMacroRowsByColumn(
  rows: MacroTableRow[],
  columnId: string,
  columns: MacroTableColumn[]
): MacroTableRow[] {
  const groupColumn = columns.find((column) => column.id === columnId);
  const groups = new Map<string, MacroTableRow[]>();

  for (const row of rows) {
    const groupValue = normalizeGroupValue(row[columnId]);
    const existing = groups.get(groupValue);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(groupValue, [row]);
    }
  }

  return Array.from(groups.entries()).map(([groupValue, groupRows]) => {
    const sortedGroupRows = groupColumn ? sortGroupRows(groupRows, groupColumn) : groupRows;
    const firstRow = sortedGroupRows[0];
    const groupRow: MacroTableRow = {
      ...firstRow,
      id: `macro-group:${columnId}:${encodeURIComponent(groupValue)}`,
      [columnId]: groupValue,
      _macroAccordionGroup: true,
      _macroAccordionGroupColumnId: columnId,
      _macroAccordionGroupValue: groupValue,
      _macroAccordionGroupCount: sortedGroupRows.length,
      _macroAccordionRows: sortedGroupRows,
    };

    for (const column of columns) {
      groupRow[column.id] = summarizeGroupColumnValue(sortedGroupRows, column, columnId);
    }

    return groupRow;
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await resolveRequestAccessContext();
  const { supabase, tenantId } = access;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const obraIdFilter = url.searchParams.get("obraId")?.trim() ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
  const groupByColumnId = url.searchParams.get("groupBy")?.trim() ?? "";
  const sortByColumnId = url.searchParams.get("sortBy")?.trim() ?? "";
  const sortDirection = url.searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  const rawFilters = url.searchParams.get("filters");
  let parsedFilters: unknown = {};
  if (rawFilters) {
    try {
      parsedFilters = JSON.parse(rawFilters);
    } catch {
      parsedFilters = {};
    }
  }
  const filters: MacroTableFilters =
    parsedFilters && typeof parsedFilters === "object" && !Array.isArray(parsedFilters)
      ? (parsedFilters as MacroTableFilters)
      : {};

  if (access.actorType === "anonymous") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (access.actorType === "demo" && !hasDemoCapability(access.demoSession, "macro")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
  }

  try {
    const supabaseInBatchSize = 40;

    // Verify macro table exists and belongs to tenant
    const { data: macroTable, error: tableError } = await supabase
      .from("macro_tables")
      .select("id, name, settings")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (tableError || !macroTable) {
      return NextResponse.json({ error: "Macro tabla no encontrada" }, { status: 404 });
    }

    // Fetch columns
    const { data: columnsData, error: columnsError } = await supabase
      .from("macro_table_columns")
      .select("id, macro_table_id, column_type, source_field_key, label, data_type, position, config")
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    if (columnsError) throw columnsError;
    const columns = (columnsData ?? []).map(mapColumnToResponse);
    const displayColumns = columns.some(
      (column) =>
        column.columnType === "computed" &&
        column.label.toLowerCase().includes("obra")
    )
      ? columns
      : [
          {
            id: "_obraName",
            dataType: "text" as const,
          },
          ...columns,
        ];

    // Fetch stored sources with obra and tabla info
    const { data: storedSources, error: sourcesError } = await supabase
      .from("macro_table_sources")
      .select(`
        id, macro_table_id, obra_tabla_id, position,
        obra_tablas!inner(
          id, name, obra_id, settings,
          obras!inner(
            id,
            tenant_id,
            n,
            designacion_y_ubicacion,
            sup_de_obra_m2,
            entidad_contratante,
            mes_basico_de_contrato,
            iniciacion,
            contrato_mas_ampliaciones,
            certificado_a_la_fecha,
            saldo_a_certificar,
            segun_contrato,
            prorrogas_acordadas,
            plazo_total,
            plazo_transc,
            porcentaje,
            custom_data
          )
        )
      `)
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    if (sourcesError) throw sourcesError;

    const explicitSourceTablas = (storedSources ?? [])
      .map((source) => source.obra_tablas)
      .filter(Boolean)
      .map(mapTablaRecord);
    const normalizedSettings = buildMacroSourceSelectionSettings(
      macroTable.settings ?? {},
      explicitSourceTablas
    );

    let sources = storedSources ?? [];
    if (normalizedSettings.sourceMode === "template") {
      const { data: tenantTablas, error: tenantTablasError } = await supabase
        .from("obra_tablas")
        .select(`
          id, name, obra_id, settings,
          obras!inner(
            id,
            tenant_id,
            n,
            designacion_y_ubicacion,
            sup_de_obra_m2,
            entidad_contratante,
            mes_basico_de_contrato,
            iniciacion,
            contrato_mas_ampliaciones,
            certificado_a_la_fecha,
            saldo_a_certificar,
            segun_contrato,
            prorrogas_acordadas,
            plazo_total,
            plazo_transc,
            porcentaje,
            custom_data
          )
        `)
        .eq("obras.tenant_id", tenantId)
        .order("created_at", { ascending: true });

      if (tenantTablasError) throw tenantTablasError;

      const tenantTablaRecords = (tenantTablas ?? []).map(mapTablaRecord);
      const resolvedSourceTablas = resolveMacroSourceTablas({
        settings: normalizedSettings,
        explicitSourceTablas,
        candidateTablas: tenantTablaRecords,
      });
      const tenantTablaById = new Map((tenantTablas ?? []).map((tabla) => [tabla.id as string, tabla]));
      const storedSourceByTablaId = new Map(
        (storedSources ?? []).map((source) => [source.obra_tabla_id as string, source])
      );

      sources = resolvedSourceTablas
        .map((tabla, index) => {
          const storedSource = storedSourceByTablaId.get(tabla.id);
          if (storedSource) return storedSource;
          const tenantTabla = tenantTablaById.get(tabla.id);
          if (!tenantTabla) return null;
          return {
            id: `dynamic:${id}:${tabla.id}`,
            macro_table_id: id,
            obra_tabla_id: tabla.id,
            position: index,
            obra_tablas: tenantTabla,
          };
        })
        .filter(Boolean) as typeof storedSources;
    }

    if (obraIdFilter) {
      sources = sources.filter((source) => {
        const tabla = Array.isArray(source.obra_tablas) ? source.obra_tablas[0] : source.obra_tablas;
        return tabla?.obra_id === obraIdFilter;
      });
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({
        rows: [],
        columns,
        overrideSummary: {
          totalRecords: 0,
          appliedStable: 0,
          appliedLegacy: 0,
          conflicts: 0,
          rowsWithOverrides: 0,
          rowsWithConflicts: 0,
        },
        overrideConflicts: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    // Fetch all rows from all source tablas
    const tablaIds = sources.map((source) => source.obra_tabla_id);
    
    // Build a map of tabla info
    const tablaInfoMap = new Map<
      string,
      { name: string; obraId: string; obraName: string; obraValues: Record<string, unknown> }
    >();
    for (const source of sources) {
      const tablaId = source.obra_tabla_id;
      const tabla = Array.isArray(source.obra_tablas) ? source.obra_tablas[0] : source.obra_tablas;
      if (tabla) {
        const obraValue = Array.isArray(tabla.obras) ? tabla.obras[0] : tabla.obras;
        const obraRecord = (obraValue ?? null) as ObraRecord | null;
        tablaInfoMap.set(tablaId, {
          name: tabla.name,
          obraId: tabla.obra_id,
          obraName: obraRecord?.designacion_y_ubicacion ?? "",
          obraValues: mapObraRecord(obraRecord),
        });
      }
    }

    // Fetch all rows from source tablas
    const allRows: Array<Record<string, unknown>> = [];
    for (const tablaIdChunk of chunkValues(tablaIds, supabaseInBatchSize)) {
      const { data: rowChunk, error: rowsError } = await supabase
        .from("obra_tabla_rows")
        .select("id, tabla_id, lineage_row_key, extraction_id, materialization_version, data, created_at")
        .in("tabla_id", tablaIdChunk)
        .order("created_at", { ascending: false });

      if (rowsError) throw rowsError;
      allRows.push(...(rowChunk ?? []));
    }

    const rowRecords: SourceRowRecord[] = allRows
      .map((row) => ({
      id: row.id as string,
      tabla_id: row.tabla_id as string,
      lineage_row_key:
        typeof row.lineage_row_key === "string" ? (row.lineage_row_key as string) : null,
      extraction_id:
        typeof row.extraction_id === "string" ? (row.extraction_id as string) : null,
      materialization_version:
        typeof row.materialization_version === "number"
          ? (row.materialization_version as number)
          : row.materialization_version == null
            ? null
            : Number(row.materialization_version),
      data:
        row.data && typeof row.data === "object" && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : {},
      created_at: typeof row.created_at === "string" ? (row.created_at as string) : null,
      }))
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
        return rightTime - leftTime;
      });

    const rowIds = rowRecords.map((row) => row.id);
    const legacyCustomValuesById = new Map<string, CustomValueRecord>();
    const stableCustomValuesById = new Map<string, CustomValueRecord>();

    if (rowIds.length > 0) {
      for (const rowIdChunk of chunkValues(rowIds, supabaseInBatchSize)) {
        const { data: legacyCustomValues, error: legacyCustomValuesError } = await supabase
          .from("macro_table_custom_values")
          .select(
            "id, macro_table_id, source_row_id, source_tabla_id, lineage_row_key, column_id, value, binding_status, binding_error, created_at, updated_at",
          )
          .eq("macro_table_id", id)
          .in("source_row_id", rowIdChunk);

        if (legacyCustomValuesError) throw legacyCustomValuesError;

        for (const customValue of legacyCustomValues ?? []) {
          legacyCustomValuesById.set(customValue.id as string, {
            id: customValue.id as string,
            macro_table_id: customValue.macro_table_id as string,
            source_row_id: customValue.source_row_id as string,
            source_tabla_id:
              typeof customValue.source_tabla_id === "string"
                ? (customValue.source_tabla_id as string)
                : null,
            lineage_row_key:
              typeof customValue.lineage_row_key === "string"
                ? (customValue.lineage_row_key as string)
                : null,
            column_id: customValue.column_id as string,
            value: customValue.value,
            binding_status:
              customValue.binding_status === "stable" ||
              customValue.binding_status === "conflict" ||
              customValue.binding_status === "legacy"
                ? (customValue.binding_status as MacroTableOverrideBindingStatus)
                : null,
            binding_error:
              customValue.binding_error &&
              typeof customValue.binding_error === "object" &&
              !Array.isArray(customValue.binding_error)
                ? (customValue.binding_error as Record<string, unknown>)
                : null,
            created_at:
              typeof customValue.created_at === "string" ? (customValue.created_at as string) : null,
            updated_at:
              typeof customValue.updated_at === "string" ? (customValue.updated_at as string) : null,
          });
        }
      }
    }

    if (tablaIds.length > 0) {
      for (const tablaIdChunk of chunkValues(tablaIds, supabaseInBatchSize)) {
        const { data: stableCustomValues, error: stableCustomValuesError } = await supabase
          .from("macro_table_custom_values")
          .select(
            "id, macro_table_id, source_row_id, source_tabla_id, lineage_row_key, column_id, value, binding_status, binding_error, created_at, updated_at",
          )
          .eq("macro_table_id", id)
          .in("source_tabla_id", tablaIdChunk);

        if (stableCustomValuesError) throw stableCustomValuesError;

        for (const customValue of stableCustomValues ?? []) {
          stableCustomValuesById.set(customValue.id as string, {
            id: customValue.id as string,
            macro_table_id: customValue.macro_table_id as string,
            source_row_id: customValue.source_row_id as string,
            source_tabla_id:
              typeof customValue.source_tabla_id === "string"
                ? (customValue.source_tabla_id as string)
                : null,
            lineage_row_key:
              typeof customValue.lineage_row_key === "string"
                ? (customValue.lineage_row_key as string)
                : null,
            column_id: customValue.column_id as string,
            value: customValue.value,
            binding_status:
              customValue.binding_status === "stable" ||
              customValue.binding_status === "conflict" ||
              customValue.binding_status === "legacy"
                ? (customValue.binding_status as MacroTableOverrideBindingStatus)
                : null,
            binding_error:
              customValue.binding_error &&
              typeof customValue.binding_error === "object" &&
              !Array.isArray(customValue.binding_error)
                ? (customValue.binding_error as Record<string, unknown>)
                : null,
            created_at:
              typeof customValue.created_at === "string" ? (customValue.created_at as string) : null,
            updated_at:
              typeof customValue.updated_at === "string" ? (customValue.updated_at as string) : null,
          });
        }
      }
    }

    const overrideResolution = resolveOverrideBindings({
      macroTableId: id,
      currentRows: rowRecords,
      customValues: [
        ...legacyCustomValuesById.values(),
        ...stableCustomValuesById.values(),
      ],
    });

    // Map rows to macro table format
    const mappedRows: MacroTableRow[] = rowRecords.map((row) => {
      const tablaId = row.tabla_id;
      const tablaInfo = tablaInfoMap.get(tablaId);
      const rowData = row.data ?? {};
      const rowCustomValues = overrideResolution.valuesByRowId.get(row.id);
      const businessIdentity = resolveBusinessIdentityValue(rowData);
      const docPath = extractDocumentPath(rowData);
      const docFileName = extractDocumentFileName(docPath);

      const mappedRow: MacroTableRow = {
        id: row.id,
        _sourceTablaId: tablaId,
        _sourceTablaName: tablaInfo?.name ?? "",
        _obraId: tablaInfo?.obraId ?? "",
        _obraName: tablaInfo?.obraName ?? "",
        _businessIdentity: businessIdentity,
        _lineageRowKey: row.lineage_row_key,
        _extractionId: row.extraction_id,
        _materializationVersion: row.materialization_version,
        _docPath: docPath,
        _docFileName: docFileName,
        _overrideBindingStatus: overrideResolution.rowBindingStatus.get(row.id) ?? null,
        _overrideConflictCount: overrideResolution.rowConflictCounts.get(row.id) ?? 0,
      };

      // Map columns
      for (const col of columns) {
        let value: unknown = null;
        if (col.columnType === "source" && col.sourceFieldKey) {
          if (col.sourceFieldKey.startsWith("obra.")) {
            value = resolveObraSourceValue(tablaInfo?.obraValues ?? {}, col.sourceFieldKey);
          } else {
            // Get value from source row data
            value = rowData[col.sourceFieldKey] ?? null;
          }
        } else if (col.columnType === "custom") {
          // Get value from custom values
          value = rowCustomValues?.get(col.id) ?? null;
        } else if (col.columnType === "computed") {
          // Handle computed columns based on config
          const computeType = col.config?.compute as string;
          if (computeType === "obra_name") {
            value = tablaInfo?.obraName ?? "";
          } else if (computeType === "tabla_name") {
            value = tablaInfo?.name ?? "";
          }
        }
        const hasManualOverride =
          isColumnManuallyEditable(col) && rowCustomValues?.has(col.id);
        mappedRow[col.id] = hasManualOverride ? rowCustomValues?.get(col.id) ?? null : value;
      }

      return mappedRow;
    });
    const filteredRows = mappedRows.filter(
      (row) =>
        matchesMacroSearch(row, displayColumns, query) &&
        matchesMacroFilters(row, displayColumns, filters)
    );

    const preparedRows = sortByColumnId
      ? sortMacroRows(filteredRows, sortByColumnId, sortDirection, columns)
      : filteredRows;

    const groupedRows = groupByColumnId
      ? groupMacroRowsByColumn(preparedRows, groupByColumnId, columns)
      : preparedRows;

    const total = groupedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * limit;
    const pagedRows = groupedRows.slice(from, from + limit);

    return NextResponse.json({
      rows: pagedRows,
      columns,
      overrideSummary: overrideResolution.summary,
      overrideConflicts: overrideResolution.conflicts,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
    });
  } catch (error) {
    console.error("[macro-tables:rows:get]", error);
    const message = resolveRouteErrorMessage(error);
    if (isMissingLineageMigrationError(message)) {
      return NextResponse.json(
        {
          error:
            "Faltan migraciones de lineage en la base activa. Aplica 0093_row_lineage_identity.sql y 0094_macro_table_lineage_overrides.sql.",
          code: "LINEAGE_MIGRATION_REQUIRED",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CustomValueInput = {
  sourceRowId: string;
  columnId: string;
  value: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await resolveRequestAccessContext();
  const { supabase, user, tenantId } = access;

  if (access.actorType !== "user" || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
  }

  try {
    // Verify macro table exists and belongs to tenant
    const { data: macroTable, error: tableError } = await supabase
      .from("macro_tables")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (tableError || !macroTable) {
      return NextResponse.json({ error: "Macro tabla no encontrada" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const customValues: CustomValueInput[] = Array.isArray(body.customValues) ? body.customValues : [];

    if (customValues.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    // Fetch columns to validate column IDs and ensure they're custom columns
    const columnIds = [...new Set(customValues.map(cv => cv.columnId))];
    const { data: validColumns, error: colError } = await supabase
      .from("macro_table_columns")
      .select("id, column_type, config")
      .eq("macro_table_id", id)
      .in("id", columnIds);

    if (colError) throw colError;

    const validEditableColumnIds = new Set(
      (validColumns ?? [])
        .filter((col) =>
          isColumnManuallyEditable({
            columnType: col.column_type as string,
            config:
              col.config && typeof col.config === "object" && !Array.isArray(col.config)
                ? (col.config as Record<string, unknown>)
                : {},
          })
        )
        .map((col) => col.id)
    );

    // Filter to only valid editable columns and keep the latest value per logical cell.
    const validValueMap = new Map<string, CustomValueInput>();
    for (const customValue of customValues) {
      if (
        !customValue.sourceRowId ||
        !customValue.columnId ||
        !validEditableColumnIds.has(customValue.columnId)
      ) {
        continue;
      }
      validValueMap.set(
        buildCellKey(customValue.sourceRowId, customValue.columnId),
        customValue,
      );
    }
    const validValues = [...validValueMap.values()];

    if (validValues.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const sourceRowIds = [...new Set(validValues.map((value) => value.sourceRowId))];
    const { data: sourceRows, error: sourceRowsError } = await supabase
      .from("obra_tabla_rows")
      .select("id, tabla_id, lineage_row_key")
      .in("id", sourceRowIds);

    if (sourceRowsError) throw sourceRowsError;

    const sourceRowMap = new Map(
      (sourceRows ?? []).map((row) => [
        row.id as string,
        {
          id: row.id as string,
          tablaId: row.tabla_id as string,
          lineageRowKey:
            typeof row.lineage_row_key === "string" ? (row.lineage_row_key as string) : null,
        },
      ]),
    );

    const stableTablaIds = [...new Set(
      [...sourceRowMap.values()]
        .map((row) => row.tablaId)
        .filter((tablaId): tablaId is string => Boolean(tablaId)),
    )];

    const existingOverridesById = new Map<string, CustomValueRecord>();

    if (sourceRowIds.length > 0) {
      const { data: existingLegacyOverrides, error: existingLegacyOverridesError } = await supabase
        .from("macro_table_custom_values")
        .select(
          "id, macro_table_id, source_row_id, source_tabla_id, lineage_row_key, column_id, value, binding_status, binding_error, created_at, updated_at",
        )
        .eq("macro_table_id", id)
        .in("source_row_id", sourceRowIds)
        .in("column_id", columnIds);

      if (existingLegacyOverridesError) throw existingLegacyOverridesError;

      for (const override of existingLegacyOverrides ?? []) {
        existingOverridesById.set(override.id as string, {
          id: override.id as string,
          macro_table_id: override.macro_table_id as string,
          source_row_id: override.source_row_id as string,
          source_tabla_id:
            typeof override.source_tabla_id === "string" ? (override.source_tabla_id as string) : null,
          lineage_row_key:
            typeof override.lineage_row_key === "string" ? (override.lineage_row_key as string) : null,
          column_id: override.column_id as string,
          value: override.value,
          binding_status:
            override.binding_status === "stable" ||
            override.binding_status === "conflict" ||
            override.binding_status === "legacy"
              ? (override.binding_status as MacroTableOverrideBindingStatus)
              : null,
          binding_error:
            override.binding_error &&
            typeof override.binding_error === "object" &&
            !Array.isArray(override.binding_error)
              ? (override.binding_error as Record<string, unknown>)
              : null,
          created_at: typeof override.created_at === "string" ? (override.created_at as string) : null,
          updated_at: typeof override.updated_at === "string" ? (override.updated_at as string) : null,
        });
      }
    }

    if (stableTablaIds.length > 0) {
      const { data: existingStableOverrides, error: existingStableOverridesError } = await supabase
        .from("macro_table_custom_values")
        .select(
          "id, macro_table_id, source_row_id, source_tabla_id, lineage_row_key, column_id, value, binding_status, binding_error, created_at, updated_at",
        )
        .eq("macro_table_id", id)
        .in("source_tabla_id", stableTablaIds)
        .in("column_id", columnIds);

      if (existingStableOverridesError) throw existingStableOverridesError;

      for (const override of existingStableOverrides ?? []) {
        existingOverridesById.set(override.id as string, {
          id: override.id as string,
          macro_table_id: override.macro_table_id as string,
          source_row_id: override.source_row_id as string,
          source_tabla_id:
            typeof override.source_tabla_id === "string" ? (override.source_tabla_id as string) : null,
          lineage_row_key:
            typeof override.lineage_row_key === "string" ? (override.lineage_row_key as string) : null,
          column_id: override.column_id as string,
          value: override.value,
          binding_status:
            override.binding_status === "stable" ||
            override.binding_status === "conflict" ||
            override.binding_status === "legacy"
              ? (override.binding_status as MacroTableOverrideBindingStatus)
              : null,
          binding_error:
            override.binding_error &&
            typeof override.binding_error === "object" &&
            !Array.isArray(override.binding_error)
              ? (override.binding_error as Record<string, unknown>)
              : null,
          created_at: typeof override.created_at === "string" ? (override.created_at as string) : null,
          updated_at: typeof override.updated_at === "string" ? (override.updated_at as string) : null,
        });
      }
    }

    const existingOverrides = [...existingOverridesById.values()];
    const conflicts: MacroTableOverrideConflict[] = [];
    const updates: Array<Record<string, unknown>> = [];
    const inserts: Array<Record<string, unknown>> = [];
    let stableWrites = 0;
    let legacyWrites = 0;

    for (const customValue of validValues) {
      const sourceRow = sourceRowMap.get(customValue.sourceRowId);
      if (!sourceRow) continue;

      const stableIdentity = buildStableIdentityKey(sourceRow.tablaId, sourceRow.lineageRowKey);
      const stableMatches = stableIdentity
        ? existingOverrides.filter(
            (override) =>
              override.column_id === customValue.columnId &&
              buildStableIdentityKey(override.source_tabla_id, override.lineage_row_key) ===
                stableIdentity,
          )
        : [];
      const legacyMatches = existingOverrides.filter(
        (override) =>
          override.column_id === customValue.columnId &&
          override.source_row_id === customValue.sourceRowId,
      );
      const extraLegacyMatches = legacyMatches.filter(
        (legacyMatch) => !stableMatches.some((stableMatch) => stableMatch.id === legacyMatch.id),
      );

      let conflictDetail: string | null = null;
      if (
        stableMatches.some((match) => match.binding_status === "conflict") ||
        extraLegacyMatches.some((match) => match.binding_status === "conflict")
      ) {
        conflictDetail = "La celda ya tiene un conflicto previo de reattach por lineage.";
      } else if (stableMatches.length > 1) {
        conflictDetail = "Hay multiples overrides estables para la misma identidad estable.";
      } else if (stableMatches.length === 1 && extraLegacyMatches.length > 0) {
        conflictDetail =
          "Existe un override estable y otro legacy para la misma celda; se requiere resolver el conflicto.";
      } else if (stableMatches.length === 0 && legacyMatches.length > 1) {
        conflictDetail = "Hay multiples overrides legacy para la misma celda.";
      }

      if (conflictDetail) {
        conflicts.push(
          buildOverrideConflict({
            macroTableId: id,
            rowId: customValue.sourceRowId,
            sourceTablaId: sourceRow.tablaId,
            lineageRowKey: sourceRow.lineageRowKey,
            columnId: customValue.columnId,
            candidates: [...stableMatches, ...legacyMatches],
            detail: conflictDetail,
          }),
        );
        continue;
      }

      const bindingStatus: MacroTableOverrideBindingStatus =
        sourceRow.lineageRowKey && sourceRow.tablaId ? "stable" : "legacy";
      const targetOverride = stableMatches[0] ?? legacyMatches[0] ?? null;
      const payload = {
        macro_table_id: id,
        source_row_id: customValue.sourceRowId,
        source_tabla_id: bindingStatus === "stable" ? sourceRow.tablaId : null,
        lineage_row_key: bindingStatus === "stable" ? sourceRow.lineageRowKey : null,
        column_id: customValue.columnId,
        value: customValue.value,
        binding_status: bindingStatus,
        binding_error: null,
      };

      if (bindingStatus === "stable") {
        stableWrites += 1;
      } else {
        legacyWrites += 1;
      }

      if (targetOverride) {
        updates.push({
          id: targetOverride.id,
          ...payload,
        });
      } else {
        inserts.push(payload);
      }
    }

    if (conflicts.length > 0) {
      // Slice note: downstream conflict persistence lives in binding_error.errorCode for now.
      // This is the current transition backing, not the final canonical conflict model.
      const conflictUpdatesById = new Map<string, Record<string, unknown>>();
      for (const conflict of conflicts) {
        for (const overrideId of conflict.candidateOverrideIds) {
          const existingOverride = existingOverridesById.get(overrideId);
          if (!existingOverride) continue;
          conflictUpdatesById.set(overrideId, {
            id: existingOverride.id,
            macro_table_id: existingOverride.macro_table_id,
            source_row_id: existingOverride.source_row_id,
            source_tabla_id: existingOverride.source_tabla_id,
            lineage_row_key: existingOverride.lineage_row_key,
            column_id: existingOverride.column_id,
            value: existingOverride.value,
            binding_status: "conflict" as const,
            binding_error: {
              errorCode: LINEAGE_OVERRIDE_REATTACH_CONFLICT,
              detail: conflict.detail,
              columnId: conflict.columnId,
              sourceTablaId: conflict.sourceTablaId,
              lineageRowKey: conflict.lineageRowKey,
              candidateOverrideIds: conflict.candidateOverrideIds,
              candidateSourceRowIds: conflict.candidateSourceRowIds,
            },
          });
        }
      }
      const conflictUpdates = [...conflictUpdatesById.values()];

      if (conflictUpdates.length > 0) {
        const { error: conflictPersistError } = await supabase
          .from("macro_table_custom_values")
          .upsert(conflictUpdates, { onConflict: "id" });

        if (conflictPersistError) throw conflictPersistError;
      }

      return NextResponse.json(
        {
          error: "No se pudo reatachar uno o mas overrides por lineage.",
          code: LINEAGE_OVERRIDE_REATTACH_CONFLICT,
          conflicts,
        },
        { status: 409 },
      );
    }

    if (updates.length > 0) {
      const { error: updateOverridesError } = await supabase
        .from("macro_table_custom_values")
        .upsert(updates, { onConflict: "id" });

      if (updateOverridesError) throw updateOverridesError;
    }

    if (inserts.length > 0) {
      const { error: insertOverridesError } = await supabase
        .from("macro_table_custom_values")
        .insert(inserts);

      if (insertOverridesError) throw insertOverridesError;
    }

    const { data: affectedTablas, error: affectedTablasError } = stableTablaIds.length
      ? await supabase
          .from("obra_tablas")
          .select("id, obra_id")
          .in("id", stableTablaIds)
      : { data: [], error: null };
    if (affectedTablasError) throw affectedTablasError;

    const affectedObraIds = [
      ...new Set(
        (affectedTablas ?? [])
          .map((tabla) => (typeof tabla.obra_id === "string" ? tabla.obra_id : null))
          .filter((obraId): obraId is string => Boolean(obraId)),
      ),
    ];
    const allowAutoWrite = await canAutoWriteDataFlow({ supabase, tenantId });
    const dataFlowRecompute = await Promise.all(
      affectedObraIds.map((obraId) =>
        tryRecomputeObraDataFlowWritebacks({
          supabase,
          tenantId,
          obraId,
          actorUserId: user.id,
          trigger: "source_change",
          allowAutoWrite,
        }),
      ),
    );

    // TODO(domain-model): Emit `fila_actualizada` / `override_actualizado` domain event
    // so dependent calculations/recommendations can be processed consistently.
    return NextResponse.json({
      ok: true,
      updated: validValues.length,
      bindingSummary: {
        stable: stableWrites,
        legacy: legacyWrites,
      },
      dataFlowRecompute,
    });
  } catch (error) {
    console.error("[macro-tables:rows:save]", error);
    const message = resolveRouteErrorMessage(error);
    if (isMissingLineageMigrationError(message)) {
      return NextResponse.json(
        {
          error:
            "Faltan migraciones de lineage en la base activa. Aplica 0093_row_lineage_identity.sql y 0094_macro_table_lineage_overrides.sql.",
          code: "LINEAGE_MIGRATION_REQUIRED",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
