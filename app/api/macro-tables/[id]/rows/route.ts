import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { mapColumnToResponse, type MacroTableRow } from "@/lib/macro-tables";

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

export async function GET(request: Request, context: RouteContext) {
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
    const { data: macroTable, error: tableError } = await supabase
      .from("macro_tables")
      .select("id, name")
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
    const tablaIds = sources.map((s: any) => s.obra_tabla_id);
    
    // Build a map of tabla info
    const tablaInfoMap = new Map<string, { name: string; obraId: string; obraName: string }>();
    for (const source of sources as any[]) {
      const tablaId = source.obra_tabla_id;
      const tabla = source.obra_tablas;
      if (tabla) {
        tablaInfoMap.set(tablaId, {
          name: tabla.name,
          obraId: tabla.obra_id,
          obraName: tabla.obras?.designacion_y_ubicacion ?? "",
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
    let customValuesMap = new Map<string, Map<string, unknown>>();
    
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
        if (col.columnType === "source" && col.sourceFieldKey) {
          // Get value from source row data
          mappedRow[col.id] = rowData[col.sourceFieldKey] ?? null;
        } else if (col.columnType === "custom") {
          // Get value from custom values
          mappedRow[col.id] = rowCustomValues?.get(col.id) ?? null;
        } else if (col.columnType === "computed") {
          // Handle computed columns based on config
          const computeType = col.config?.compute as string;
          if (computeType === "obra_name") {
            mappedRow[col.id] = tablaInfo?.obraName ?? "";
          } else if (computeType === "tabla_name") {
            mappedRow[col.id] = tablaInfo?.name ?? "";
          }
        }
      }

      return mappedRow;
    });

    // Pagination
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    
    const total = mappedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = (page - 1) * limit;
    const pagedRows = mappedRows.slice(from, from + limit);

    return NextResponse.json({
      rows: pagedRows,
      columns,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
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
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
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
      .select("id, column_type")
      .eq("macro_table_id", id)
      .in("id", columnIds);

    if (colError) throw colError;

    const validCustomColumnIds = new Set(
      (validColumns ?? [])
        .filter((col: any) => col.column_type === "custom")
        .map((col: any) => col.id)
    );

    // Filter to only valid custom columns
    const validValues = customValues.filter(cv => 
      cv.sourceRowId && 
      cv.columnId && 
      validCustomColumnIds.has(cv.columnId)
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




