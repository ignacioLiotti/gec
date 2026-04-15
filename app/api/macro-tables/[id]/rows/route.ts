import { NextResponse } from "next/server";
import {
  matchesMacroFilters,
  matchesMacroSearch,
  type MacroTableFilters,
} from "@/lib/macro-table-filters";
import { mapColumnToResponse, type MacroTableRow } from "@/lib/macro-tables";
import {
  buildMacroSourceSelectionSettings,
  resolveMacroSourceTablas,
  type MacroSourceTablaRecord,
} from "@/lib/macro-table-source-selection";
import {
  hasDemoCapability,
  resolveRequestAccessContext,
} from "@/lib/demo-session";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await resolveRequestAccessContext();
  const { supabase, tenantId } = access;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const obraIdFilter = url.searchParams.get("obraId")?.trim() ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
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
    const { data: allRows, error: rowsError } = await supabase
      .from("obra_tabla_rows")
      .select("id, tabla_id, data, created_at")
      .in("tabla_id", tablaIds)
      .order("created_at", { ascending: false });

    if (rowsError) throw rowsError;

    // Fetch custom values for this macro table
    const rowIds = (allRows ?? []).map(r => r.id);
    const customValuesMap = new Map<string, Map<string, unknown>>();
    
    if (rowIds.length > 0) {
      const { data: customValues, error: customError } = await supabase
        .from("macro_table_custom_values")
        .select("id, source_row_id, column_id, value")
        .eq("macro_table_id", id)
        .in("source_row_id", rowIds);

      if (customError) throw customError;

      // Build nested map: rowId -> columnId -> value
      for (const cv of customValues ?? []) {
        const rowId = cv.source_row_id as string;
        const columnId = cv.column_id as string;
        if (!customValuesMap.has(rowId)) {
          customValuesMap.set(rowId, new Map());
        }
        customValuesMap.get(rowId)?.set(columnId, cv.value);
      }
    }

    // Map rows to macro table format
    const mappedRows: MacroTableRow[] = (allRows ?? []).map((row) => {
      const tablaId = row.tabla_id as string;
      const tablaInfo = tablaInfoMap.get(tablaId);
      const rowData = (row.data as Record<string, unknown>) ?? {};
      const rowCustomValues = customValuesMap.get(row.id as string);

      const mappedRow: MacroTableRow = {
        id: row.id as string,
        _sourceTablaId: tablaId,
        _sourceTablaName: tablaInfo?.name ?? "",
        _obraId: tablaInfo?.obraId ?? "",
        _obraName: tablaInfo?.obraName ?? "",
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

    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * limit;
    const pagedRows = filteredRows.slice(from, from + limit);

    return NextResponse.json({
      rows: pagedRows,
      columns,
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
    const message = error instanceof Error ? error.message : "Error desconocido";
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

    // Filter to only valid editable columns
    const validValues = customValues.filter(cv => 
      cv.sourceRowId && 
      cv.columnId && 
      validEditableColumnIds.has(cv.columnId)
    );

    if (validValues.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    // Upsert custom values
    const upsertPayload = validValues.map(cv => ({
      macro_table_id: id,
      source_row_id: cv.sourceRowId,
      column_id: cv.columnId,
      value: cv.value,
    }));

    const { error: upsertError } = await supabase
      .from("macro_table_custom_values")
      .upsert(upsertPayload, { 
        onConflict: "macro_table_id,source_row_id,column_id" 
      });

    if (upsertError) throw upsertError;

    return NextResponse.json({ ok: true, updated: validValues.length });
  } catch (error) {
    console.error("[macro-tables:rows:save]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
