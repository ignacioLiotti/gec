import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  mapMacroTableToResponse,
  mapColumnToResponse,
  mapSourceToResponse,
  ensureMacroDataType,
  type MacroTableColumnType,
} from "@/lib/macro-tables";

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, tenantId: null };
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const tenantId = membership?.tenant_id ?? null;
  return { supabase, user, tenantId };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Fetch sources with obra and tabla info
    const { data: sources, error: sourcesError } = await supabase
      .from("macro_table_sources")
      .select(`
        id, macro_table_id, obra_tabla_id, position,
        obra_tablas!inner(
          id, name, obra_id,
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

    // Map sources with joined data
    const mappedSources = (sources ?? []).map((source: any) => ({
      ...mapSourceToResponse(source),
      obraTabla: source.obra_tablas ? {
        id: source.obra_tablas.id,
        name: source.obra_tablas.name,
        obraId: source.obra_tablas.obra_id,
        obraName: source.obra_tablas.obras?.designacion_y_ubicacion ?? "",
      } : undefined,
    }));

    return NextResponse.json({
      macroTable: {
        ...mapMacroTableToResponse(macroTable),
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
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
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

    const body = await request.json().catch(() => ({}));

    // Update macro table basic info if provided
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim() || null;
    }
    if (typeof body.settings === "object" && body.settings !== null) {
      updates.settings = body.settings;
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
          .select("id")
          .in("id", sourceTablaIds);

        const validTablaIds = new Set((validTablas ?? []).map(t => t.id));

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
      }
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

    const { data: sources } = await supabase
      .from("macro_table_sources")
      .select("id, macro_table_id, obra_tabla_id, position")
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    const { data: columns } = await supabase
      .from("macro_table_columns")
      .select("id, macro_table_id, column_type, source_field_key, label, data_type, position, config")
      .eq("macro_table_id", id)
      .order("position", { ascending: true });

    return NextResponse.json({
      macroTable: {
        ...mapMacroTableToResponse(updatedTable),
        sources: (sources ?? []).map(mapSourceToResponse),
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
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
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






