import { NextResponse } from "next/server";
import {
  mapMacroTableToResponse,
  mapColumnToResponse,
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

type RouteContext = { params: Promise<{ id: string }> };

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

function mapSourceResponse(
  macroTableId: string,
  tabla: MacroSourceTablaRecord,
  explicitSourceIdByTablaId: Map<string, string>,
  position: number
) {
  return {
    id: explicitSourceIdByTablaId.get(tabla.id) ?? `dynamic:${macroTableId}:${tabla.id}`,
    macroTableId,
    obraTablaId: tabla.id,
    position,
    obraTabla: {
      id: tabla.id,
      name: tabla.name,
      obraId: tabla.obraId ?? "",
      obraName: tabla.obraName ?? "",
      defaultTablaId: tabla.defaultTablaId,
    },
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await resolveRequestAccessContext();
  const { supabase, tenantId } = access;

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
    // Fetch macro table
    const { data: macroTable, error: tableError } = await supabase
      .from("macro_tables")
      .select("id, tenant_id, name, description, settings, created_at, updated_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (tableError) {
      if (tableError.code === "PGRST116") {
        return NextResponse.json({ error: "Macro tabla no encontrada" }, { status: 404 });
      }
      throw tableError;
    }

    // Fetch stored sources with obra and tabla info
    const { data: sources, error: sourcesError } = await supabase
      .from("macro_table_sources")
      .select(`
        id, macro_table_id, obra_tabla_id, position,
        obra_tablas!inner(
          id, name, obra_id, settings,
          obras!inner(id, designacion_y_ubicacion)
        )
      `)
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    if (sourcesError) throw sourcesError;

    // Fetch columns
    const { data: columns, error: columnsError } = await supabase
      .from("macro_table_columns")
      .select("id, macro_table_id, column_type, source_field_key, label, data_type, position, config")
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    if (columnsError) throw columnsError;

    const explicitSourceTablas = (sources ?? [])
      .map((source) => source.obra_tablas)
      .filter(Boolean)
      .map(mapTablaRecord);
    const normalizedSettings = buildMacroSourceSelectionSettings(
      macroTable.settings ?? {},
      explicitSourceTablas
    );

    let candidateTablas: MacroSourceTablaRecord[] = [];
    if (normalizedSettings.sourceMode === "template") {
      const { data: tenantTablas, error: tenantTablasError } = await supabase
        .from("obra_tablas")
        .select(`
          id, name, obra_id, settings,
          obras!inner(id, tenant_id, designacion_y_ubicacion)
        `)
        .eq("obras.tenant_id", tenantId)
        .order("created_at", { ascending: true });

      if (tenantTablasError) throw tenantTablasError;
      candidateTablas = (tenantTablas ?? []).map(mapTablaRecord);
    }

    const resolvedSourceTablas = resolveMacroSourceTablas({
      settings: normalizedSettings,
      explicitSourceTablas,
      candidateTablas,
    });
    const explicitSourceIdByTablaId = new Map(
      (sources ?? []).map((source) => [source.obra_tabla_id as string, source.id as string])
    );
    const mappedSources = resolvedSourceTablas.map((tabla, index) =>
      mapSourceResponse(id, tabla, explicitSourceIdByTablaId, index)
    );

    return NextResponse.json({
      macroTable: {
        ...mapMacroTableToResponse({ ...macroTable, settings: normalizedSettings }),
        sources: mappedSources,
        columns: (columns ?? []).map(mapColumnToResponse),
      },
    });
  } catch (error) {
    console.error("[macro-tables:get]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ColumnInput = {
  id?: string; // existing column id for updates
  columnType?: MacroTableColumnType;
  sourceFieldKey?: string | null;
  label: string;
  dataType?: string;
  config?: Record<string, unknown>;
};

type SourceInput = {
  id?: string; // existing source id for updates
  obraTablaId: string;
};

export async function PATCH(request: Request, context: RouteContext) {
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
    const { data: existing, error: existingError } = await supabase
      .from("macro_tables")
      .select("id, settings")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Macro tabla no encontrada" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    const hasSettingsInput = typeof body.settings === "object" && body.settings !== null;
    let sourceTablasForSettings: MacroSourceTablaRecord[] | null = null;

    // Update macro table basic info if provided
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim() || null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("macro_tables")
        .update(updates)
        .eq("id", id);

      if (updateError) throw updateError;
    }

    // Update sources if provided
    if (Array.isArray(body.sources)) {
      const newSources: SourceInput[] = body.sources;
      
      // Validate all source obra_tablas
      const sourceTablaIds = newSources.map(s => s.obraTablaId).filter(Boolean);
      if (sourceTablaIds.length > 0) {
        const { data: validTablas } = await supabase
          .from("obra_tablas")
          .select("id, obra_id, name, settings, obras!inner(tenant_id)")
          .in("id", sourceTablaIds);

        const validTablaIds = new Set((validTablas ?? []).map(t => t.id));
        sourceTablasForSettings = (validTablas ?? []).map(mapTablaRecord);

        // Delete existing sources
        await supabase.from("macro_table_sources").delete().eq("macro_table_id", id);

        // Insert new sources
        const sourcesPayload = newSources
          .filter(s => s.obraTablaId && validTablaIds.has(s.obraTablaId))
          .map((source, index) => ({
            macro_table_id: id,
            obra_tabla_id: source.obraTablaId,
            position: index,
          }));

        if (sourcesPayload.length > 0) {
          const { error: sourcesError } = await supabase
            .from("macro_table_sources")
            .insert(sourcesPayload);

          if (sourcesError) throw sourcesError;
        }
      } else {
        sourceTablasForSettings = [];
        await supabase.from("macro_table_sources").delete().eq("macro_table_id", id);
      }
    }

    if (sourceTablasForSettings === null && hasSettingsInput) {
      const { data: currentSources, error: currentSourcesError } = await supabase
        .from("macro_table_sources")
        .select(`
          obra_tablas!inner(
            id, name, obra_id, settings,
            obras!inner(tenant_id)
          )
        `)
        .eq("macro_table_id", id);

      if (currentSourcesError) throw currentSourcesError;
      sourceTablasForSettings = (currentSources ?? [])
        .map((source) => source.obra_tablas)
        .filter(Boolean)
        .map(mapTablaRecord);
    }

    if (sourceTablasForSettings !== null || hasSettingsInput) {
      const normalizedSettings = buildMacroSourceSelectionSettings(
        hasSettingsInput ? body.settings : existing.settings ?? {},
        sourceTablasForSettings ?? []
      );
      const { error: settingsError } = await supabase
        .from("macro_tables")
        .update({ settings: normalizedSettings })
        .eq("id", id);

      if (settingsError) throw settingsError;
    }

    // Update columns if provided
    if (Array.isArray(body.columns)) {
      const newColumns: ColumnInput[] = body.columns;

      // Delete existing columns (cascades to custom_values for those columns)
      await supabase.from("macro_table_columns").delete().eq("macro_table_id", id);

      // Insert new columns
      const columnsPayload = newColumns.map((col, index) => {
        const columnType = col.columnType ?? "source";
        return {
          macro_table_id: id,
          column_type: columnType,
          source_field_key: columnType === "source" ? (col.sourceFieldKey ?? null) : null,
          label: col.label || `Columna ${index + 1}`,
          data_type: ensureMacroDataType(col.dataType),
          position: index,
          config: col.config ?? {},
        };
      });

      if (columnsPayload.length > 0) {
        const { error: columnsError } = await supabase
          .from("macro_table_columns")
          .insert(columnsPayload);

        if (columnsError) throw columnsError;
      }
    }

    // Fetch and return updated macro table
    const { data: updatedTable, error: fetchError } = await supabase
      .from("macro_tables")
      .select("id, tenant_id, name, description, settings, created_at, updated_at")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const { data: sources, error: sourcesFetchError } = await supabase
      .from("macro_table_sources")
      .select(`
        id, macro_table_id, obra_tabla_id, position,
        obra_tablas!inner(
          id, name, obra_id, settings,
          obras!inner(id, designacion_y_ubicacion)
        )
      `)
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    if (sourcesFetchError) throw sourcesFetchError;

    const { data: columns } = await supabase
      .from("macro_table_columns")
      .select("id, macro_table_id, column_type, source_field_key, label, data_type, position, config")
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    const explicitSourceTablas = (sources ?? [])
      .map((source) => source.obra_tablas)
      .filter(Boolean)
      .map(mapTablaRecord);
    const normalizedSettings = buildMacroSourceSelectionSettings(
      updatedTable.settings ?? {},
      explicitSourceTablas
    );

    let candidateTablas: MacroSourceTablaRecord[] = [];
    if (normalizedSettings.sourceMode === "template") {
      const { data: tenantTablas, error: tenantTablasError } = await supabase
        .from("obra_tablas")
        .select(`
          id, name, obra_id, settings,
          obras!inner(id, tenant_id, designacion_y_ubicacion)
        `)
        .eq("obras.tenant_id", tenantId)
        .order("created_at", { ascending: true });

      if (tenantTablasError) throw tenantTablasError;
      candidateTablas = (tenantTablas ?? []).map(mapTablaRecord);
    }

    const resolvedSourceTablas = resolveMacroSourceTablas({
      settings: normalizedSettings,
      explicitSourceTablas,
      candidateTablas,
    });
    const explicitSourceIdByTablaId = new Map(
      (sources ?? []).map((source) => [source.obra_tabla_id as string, source.id as string])
    );

    return NextResponse.json({
      macroTable: {
        ...mapMacroTableToResponse({ ...updatedTable, settings: normalizedSettings }),
        sources: resolvedSourceTablas.map((tabla, index) =>
          mapSourceResponse(id, tabla, explicitSourceIdByTablaId, index)
        ),
        columns: (columns ?? []).map(mapColumnToResponse),
      },
    });
  } catch (error) {
    console.error("[macro-tables:patch]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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
    const { data: existing, error: existingError } = await supabase
      .from("macro_tables")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Macro tabla no encontrada" }, { status: 404 });
    }

    // Delete macro table (cascades to sources, columns, custom_values)
    const { error: deleteError } = await supabase
      .from("macro_tables")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[macro-tables:delete]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


