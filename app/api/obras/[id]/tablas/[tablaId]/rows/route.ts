import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { coerceValueForType, ensureTablaDataType } from "@/lib/tablas";

async function fetchColumnMetas(supabase: Awaited<ReturnType<typeof createClient>>, tablaId: string) {
	const { data, error } = await supabase
		.from("obra_tabla_columns")
		.select("id, tabla_id, field_key, label, data_type, position, required, config")
		.eq("tabla_id", tablaId)
		.order("position", { ascending: true });
	if (error) throw error;
	return (data ?? []).map((column) => ({
		id: column.id as string,
		fieldKey: column.field_key as string,
		dataType: ensureTablaDataType(column.data_type as string | undefined),
		required: Boolean(column.required),
		position: column.position ?? 0,
	}));
}
type RowsContext = { params: Promise<{ id: string; tablaId: string }> };

export async function GET(request: Request, context: RowsContext) {
	const { id, tablaId } = await context.params;
	if (!id || !tablaId) {
		return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
	}

	try {
		const url = new URL(request.url);
		const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
		const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
		const from = (page - 1) * limit;
		const to = from + limit - 1;
		const docPath = url.searchParams.get("docPath");

		const supabase = await createClient();
		let rowsQuery = supabase
			.from("obra_tabla_rows")
			.select("id, tabla_id, data, source, created_at, updated_at")
			.eq("tabla_id", tablaId)
			.order("created_at", { ascending: false })
			.range(from, to);
		if (docPath) {
			rowsQuery = rowsQuery.contains("data", { __docPath: docPath });
		}

		const { data, error } = await rowsQuery;
		if (error) throw error;

		let countQuery = supabase
			.from("obra_tabla_rows")
			.select("id", { count: "exact", head: true })
			.eq("tabla_id", tablaId);
		if (docPath) {
			countQuery = countQuery.contains("data", { __docPath: docPath });
		}
		const { count } = await countQuery;

		return NextResponse.json({
			rows: data ?? [],
			pagination: {
				page,
				limit,
				total: count ?? 0,
				totalPages: count ? Math.max(1, Math.ceil(count / limit)) : 1,
				hasNextPage: count ? to + 1 < count : false,
				hasPreviousPage: page > 1,
			},
		});
	} catch (error) {
		console.error("[tabla-rows:list]", error);
		const message = error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(request: Request, context: RowsContext) {
	const { id, tablaId } = await context.params;
	if (!id || !tablaId) {
		return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const dirtyRows: any[] = Array.isArray(body?.dirtyRows) ? body.dirtyRows : [];
		const deletedRowIds: string[] = Array.isArray(body?.deletedRowIds)
			? body.deletedRowIds.filter((value): value is string => typeof value === "string" && value.length > 0)
			: [];

		const supabase = await createClient();
		const columns = await fetchColumnMetas(supabase, tablaId);
		if (columns.length === 0) {
			return NextResponse.json(
				{ error: "No hay columnas definidas para la tabla" },
				{ status: 400 }
			);
		}

		if (dirtyRows.length > 0) {
			const payload = dirtyRows
				.filter((row) => typeof row?.id === "string")
				.map((row) => {
					const data: Record<string, unknown> = {};
					for (const column of columns) {
						data[column.fieldKey] = coerceValueForType(column.dataType, (row as any)[column.fieldKey]);
					}
					return {
						id: row.id as string,
						tabla_id: tablaId,
						data,
						source: row.source ?? "manual",
					};
				});

			if (payload.length > 0) {
				const { error: upsertError } = await supabase
					.from("obra_tabla_rows")
					.upsert(payload, { onConflict: "id" });
				if (upsertError) throw upsertError;
			}
		}

		if (deletedRowIds.length > 0) {
			const { error: deleteError } = await supabase
				.from("obra_tabla_rows")
				.delete()
				.in("id", deletedRowIds);
			if (deleteError) throw deleteError;
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[tabla-rows:save]", error);
		const message = error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
