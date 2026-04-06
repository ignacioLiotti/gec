import { NextResponse } from "next/server";
import {
  mapMacroTableToResponse,
  mapColumnToResponse,
  mapSourceToResponse,
  ensureMacroDataType,
  type MacroTableColumnType,
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

export async function GET() {
  const access = await resolveRequestAccessContext();
  const { supabase, tenantId } = access;

  if (access.actorType === "anonymous") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (access.actorType === "demo" && !hasDemoCapability(access.demoSession, "macro")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tenantId) {
    return NextResponse.json({ macroTables: [] });
  }

  try {
    // Fetch all macro tables for this tenant
    const { data: macroTables, error: tablesError } = await supabase
      .from("macro_tables")
      .select("id, tenant_id, name, description, settings, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (tablesError) throw tablesError;

    const tableIds = (macroTables ?? []).map((t) => t.id as string);

    // Fetch sources for all tables
    const sourcesByTable = new Map<string, ReturnType<typeof mapSourceToResponse>[]>();
    const sourceTablasByTable = new Map<string, MacroSourceTablaRecord[]>();
    const sourceCounts = new Map<string, number>();
    if (tableIds.length > 0) {
      const { data: sources, error: sourcesError } = await supabase
        .from("macro_table_sources")
        .select(`
          id, macro_table_id, obra_tabla_id, position,
          obra_tablas!inner(
            id, name, obra_id, settings
          )
        `)
        .in("macro_table_id", tableIds)
        .order("position", { ascending: true });

      if (sourcesError) throw sourcesError;

      for (const source of sources ?? []) {
        const macroTableId = source.macro_table_id as string;
        const mapped = mapSourceToResponse(source);
        if (!sourcesByTable.has(macroTableId)) {
          sourcesByTable.set(macroTableId, []);
        }
        sourcesByTable.get(macroTableId)?.push(mapped);

        const obraTabla = source.obra_tablas;
        if (obraTabla) {
          if (!sourceTablasByTable.has(macroTableId)) {
            sourceTablasByTable.set(macroTableId, []);
          }
          sourceTablasByTable.get(macroTableId)?.push(mapTablaRecord(obraTabla));
        }
      }

      const needsDynamicSources = (macroTables ?? []).some((table) => {
        const explicitSourceTablas = sourceTablasByTable.get(table.id as string) ?? [];
        const settings = buildMacroSourceSelectionSettings(table.settings ?? {}, explicitSourceTablas);
        return settings.sourceMode === "template";
      });

      let candidateTablas: MacroSourceTablaRecord[] = [];
      if (needsDynamicSources) {
        const { data: tenantTablas, error: tenantTablasError } = await supabase
          .from("obra_tablas")
          .select(`
            id, name, obra_id, settings,
            obras!inner(tenant_id)
          `)
          .eq("obras.tenant_id", tenantId)
          .order("created_at", { ascending: true });

        if (tenantTablasError) throw tenantTablasError;
        candidateTablas = (tenantTablas ?? []).map(mapTablaRecord);
      }

      for (const table of macroTables ?? []) {
        const tableId = table.id as string;
        const explicitSourceTablas = sourceTablasByTable.get(tableId) ?? [];
        const normalizedSettings = buildMacroSourceSelectionSettings(
          table.settings ?? {},
          explicitSourceTablas
        );
        const resolvedSourceTablas = resolveMacroSourceTablas({
          settings: normalizedSettings,
          explicitSourceTablas,
          candidateTablas,
        });
        sourceCounts.set(tableId, resolvedSourceTablas.length);
      }
    }

    // Fetch columns for all tables
    const columnsByTable = new Map<string, ReturnType<typeof mapColumnToResponse>[]>();
    if (tableIds.length > 0) {
      const { data: columns, error: columnsError } = await supabase
        .from("macro_table_columns")
        .select("id, macro_table_id, column_type, source_field_key, label, data_type, position, config")
        .in("macro_table_id", tableIds)
        .order("position", { ascending: true });

      if (columnsError) throw columnsError;

      for (const col of columns ?? []) {
        const mapped = mapColumnToResponse(col);
        if (!columnsByTable.has(mapped.macroTableId)) {
          columnsByTable.set(mapped.macroTableId, []);
        }
        columnsByTable.get(mapped.macroTableId)?.push(mapped);
      }
    }

    const result = (macroTables ?? []).map((table) => {
      const tableId = table.id as string;
      const normalizedSettings = buildMacroSourceSelectionSettings(
        table.settings ?? {},
        sourceTablasByTable.get(tableId) ?? []
      );
      return {
        ...mapMacroTableToResponse({ ...table, settings: normalizedSettings }),
        sources: sourcesByTable.get(tableId) ?? [],
        columns: columnsByTable.get(tableId) ?? [],
        sourceCount: sourceCounts.get(tableId) ?? (sourcesByTable.get(tableId)?.length ?? 0),
      };
    });

    return NextResponse.json({ macroTables: result });
  } catch (error) {
    console.error("[macro-tables:list]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ColumnInput = {
  columnType?: MacroTableColumnType;
  sourceFieldKey?: string | null;
  label: string;
  dataType?: string;
  config?: Record<string, unknown>;
};

type SourceInput = {
  obraTablaId: string;
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

export async function POST(request: Request) {
  const access = await resolveRequestAccessContext();
  const { supabase, user, tenantId } = access;

  if (access.actorType !== "user" || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "No se encontró una organización para el usuario" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    if (!rawName) {
      return NextResponse.json(
        { error: "Nombre de macro tabla requerido" },
        { status: 400 }
      );
    }

    const description = typeof body.description === "string" ? body.description.trim() : null;
    const rawSettings =
      typeof body.settings === "object" && body.settings !== null ? body.settings : {};
    
    const rawSources: SourceInput[] = Array.isArray(body.sources) ? body.sources : [];
    const rawColumns: ColumnInput[] = Array.isArray(body.columns) ? body.columns : [];

    if (rawSources.length === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar al menos una tabla fuente" },
        { status: 400 }
      );
    }

    if (rawColumns.length === 0) {
      return NextResponse.json(
        { error: "Debe definir al menos una columna" },
        { status: 400 }
      );
    }

    // Validate that all source obra_tablas exist and belong to tenant's obras
    const sourceTablaIds = rawSources.map(s => s.obraTablaId).filter(Boolean);
    const { data: validTablas, error: validationError } = await supabase
      .from("obra_tablas")
      .select("id, obra_id, name, settings, obras!inner(tenant_id)")
      .in("id", sourceTablaIds);

    if (validationError) throw validationError;

    const validTablaIds = new Set((validTablas ?? []).map(t => t.id));
    const invalidSources = sourceTablaIds.filter(id => !validTablaIds.has(id));
    
    if (invalidSources.length > 0) {
      return NextResponse.json(
        { error: "Algunas tablas fuente no existen o no pertenecen a tu organización" },
        { status: 400 }
      );
    }

    const normalizedSettings = buildMacroSourceSelectionSettings(
      rawSettings,
      (validTablas ?? []).map(mapTablaRecord)
    );

    // Create macro table
    const { data: macroTable, error: tableError } = await supabase
      .from("macro_tables")
      .insert({
        tenant_id: tenantId,
        name: rawName,
        description,
        settings: normalizedSettings,
      })
      .select("id, tenant_id, name, description, settings, created_at, updated_at")
      .single();

    if (tableError) throw tableError;

    const macroTableId = macroTable.id as string;

    // Insert sources
    const sourcesPayload = rawSources
      .filter(s => s.obraTablaId && validTablaIds.has(s.obraTablaId))
      .map((source, index) => ({
        macro_table_id: macroTableId,
        obra_tabla_id: source.obraTablaId,
        position: index,
      }));

    const { data: insertedSources, error: sourcesError } = await supabase
      .from("macro_table_sources")
      .insert(sourcesPayload)
      .select("id, macro_table_id, obra_tabla_id, position");

    if (sourcesError) {
      // Rollback: delete macro table
      await supabase.from("macro_tables").delete().eq("id", macroTableId);
      throw sourcesError;
    }

    // Insert columns
    const columnsPayload = rawColumns.map((col, index) => {
      const columnType = col.columnType ?? "source";
      return {
        macro_table_id: macroTableId,
        column_type: columnType,
        source_field_key: columnType === "source" ? (col.sourceFieldKey ?? null) : null,
        label: col.label || `Columna ${index + 1}`,
        data_type: ensureMacroDataType(col.dataType),
        position: index,
        config: col.config ?? {},
      };
    });

    const { data: insertedColumns, error: columnsError } = await supabase
      .from("macro_table_columns")
      .insert(columnsPayload)
      .select("id, macro_table_id, column_type, source_field_key, label, data_type, position, config");

    if (columnsError) {
      // Rollback: delete macro table (cascades to sources)
      await supabase.from("macro_tables").delete().eq("id", macroTableId);
      throw columnsError;
    }

    return NextResponse.json({
      macroTable: {
        ...mapMacroTableToResponse(macroTable),
        sources: (insertedSources ?? []).map(mapSourceToResponse),
        columns: (insertedColumns ?? []).map(mapColumnToResponse),
      },
    });
  } catch (error) {
    console.error("[macro-tables:create]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

