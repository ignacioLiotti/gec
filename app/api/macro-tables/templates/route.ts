import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

export type DefaultTabla = {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  columnCount: number;
};

export async function GET() {
  const { supabase, user, tenantId } = await getAuthContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantId) {
    return NextResponse.json({ templates: [] });
  }

  try {
    // Fetch all default tablas for this tenant
    const { data: defaultTablas, error: tablasError } = await supabase
      .from("obra_default_tablas")
      .select("id, name, description, source_type, position")
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true });

    if (tablasError) throw tablasError;

    // Get column counts for each default tabla
    const tablaIds = (defaultTablas ?? []).map((t) => t.id as string);
    let columnCounts = new Map<string, number>();

    if (tablaIds.length > 0) {
      const { data: columns, error: colError } = await supabase
        .from("obra_default_tabla_columns")
        .select("default_tabla_id")
        .in("default_tabla_id", tablaIds);

      if (!colError && columns) {
        for (const col of columns) {
          const id = col.default_tabla_id as string;
          columnCounts.set(id, (columnCounts.get(id) ?? 0) + 1);
        }
      }
    }

    const templates: DefaultTabla[] = (defaultTablas ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      description: t.description as string | null,
      sourceType: t.source_type as string,
      columnCount: columnCounts.get(t.id as string) ?? 0,
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[macro-tables:templates]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}






