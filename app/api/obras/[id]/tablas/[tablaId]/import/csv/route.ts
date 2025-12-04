import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/utils/supabase/server";
import { coerceValueForType, ensureTablaDataType, normalizeFieldKey } from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string; tablaId: string }> };

async function fetchColumns(
	supabase: Awaited<ReturnType<typeof createClient>>,
	tablaId: string
) {
	const { data, error } = await supabase
		.from("obra_tabla_columns")
		.select("id, tabla_id, field_key, label, data_type, position, required")
		.eq("tabla_id", tablaId)
		.order("position", { ascending: true });
	if (error) throw error;
	return (data ?? []).map((column) => ({
		id: column.id as string,
		fieldKey: column.field_key as string,
		label: column.label as string,
		dataType: ensureTablaDataType(column.data_type as string | undefined),
		required: Boolean(column.required),
	}));
}

export async function POST(request: Request, context: RouteContext) {
	const { id, tablaId } = await context.params;
	if (!id || !tablaId) {
		return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
	}

	try {
		const formData = await request.formData();
		const fileEntry = formData.get("file");
		if (!(fileEntry instanceof File)) {
			return NextResponse.json({ error: "Archivo CSV requerido" }, { status: 400 });
		}

		const csvText = await fileEntry.text();
		const parsed = Papa.parse<Record<string, string>>(csvText, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header) => header.trim(),
		});

		if (parsed.errors?.length) {
			return NextResponse.json(
				{ error: "No se pudo leer el CSV", details: parsed.errors[0]?.message },
				{ status: 400 }
			);
		}

		const supabase = await createClient();
		const columns = await fetchColumns(supabase, tablaId);
		if (columns.length === 0) {
			return NextResponse.json({ error: "No hay columnas configuradas" }, { status: 400 });
		}

		const records = (parsed.data ?? []).filter((row) =>
			Object.values(row || {}).some((value) => String(value ?? "").trim().length > 0)
		);
		if (records.length === 0) {
			return NextResponse.json({ error: "El CSV no contiene filas válidas" }, { status: 400 });
		}

		const rowsPayload = records.map((record) => {
			const data: Record<string, unknown> = {};
			for (const column of columns) {
				const key = column.fieldKey;
				const candidateKeys = [
					key,
					column.label,
					key.toLowerCase(),
					column.label.toLowerCase(),
					normalizeFieldKey(column.label),
				];
				let rawValue: unknown = null;
				for (const candidate of candidateKeys) {
					if (candidate && candidate in record) {
						rawValue = (record as Record<string, unknown>)[candidate];
						break;
					}
				}
				data[key] = rawValue == null || rawValue === ""
					? null
					: coerceValueForType(column.dataType, rawValue);
			}
			return {
				tabla_id: tablaId,
				data,
				source: "csv",
			};
		});

		const { error: insertError } = await supabase.from("obra_tabla_rows").insert(rowsPayload);
		if (insertError) throw insertError;

		return NextResponse.json({ ok: true, inserted: rowsPayload.length });
	} catch (error) {
		console.error("[tabla-rows:csv-import]", error);
		const message = error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
