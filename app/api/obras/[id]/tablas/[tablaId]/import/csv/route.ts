import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { coerceValueForType, ensureTablaDataType, normalizeFieldKey } from "@/lib/tablas";
import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";
import {
	canAutoWriteDataFlow,
	tryRecomputeObraDataFlowWritebacks,
} from "@/lib/data-flow-recompute";

type RouteContext = { params: Promise<{ id: string; tablaId: string }> };

async function fetchColumns(
	supabase: SupabaseClient,
	tablaId: string
) {
	const { data, error } = await supabase
		.from("obra_tabla_columns")
		.select("id, tabla_id, field_key, label, data_type, position, required, config")
		.eq("tabla_id", tablaId)
		.order("position", { ascending: true });
	if (error) throw error;
	return (data ?? []).map((column) => ({
		id: column.id as string,
		fieldKey: column.field_key as string,
		label: column.label as string,
		dataType: ensureTablaDataType(column.data_type as string | undefined),
		required: Boolean(column.required),
		config: (column.config as Record<string, unknown>) ?? {},
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
		const { data: tabla, error: tablaError } = await supabase
			.from("obra_tablas")
			.select("id, obra_id, obras!inner(id, tenant_id, deleted_at)")
			.eq("id", tablaId)
			.eq("obra_id", id)
			.eq("obras.tenant_id", tenantId)
			.is("obras.deleted_at", null)
			.maybeSingle();
		if (tablaError) throw tablaError;
		if (!tabla) {
			return NextResponse.json({ error: "Tabla no encontrada" }, { status: 404 });
		}
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
			const normalizedRecord = new Map<string, unknown>();
			for (const [recordKey, recordValue] of Object.entries(record ?? {})) {
				normalizedRecord.set(normalizeFieldKey(recordKey), recordValue);
			}
			for (const column of columns) {
				const key = column.fieldKey;
				const aliases = Array.isArray(column.config?.aliases)
					? (column.config.aliases as unknown[]).filter(
							(value): value is string => typeof value === "string"
					  )
					: [];
				const excelKeywords = Array.isArray(column.config?.excelKeywords)
					? (column.config.excelKeywords as unknown[]).filter(
							(value): value is string => typeof value === "string"
					  )
					: [];
				const candidateKeys = [
					key,
					column.label,
					key.toLowerCase(),
					column.label.toLowerCase(),
					normalizeFieldKey(column.label),
					...aliases,
					...excelKeywords,
					...aliases.map((alias) => normalizeFieldKey(alias)),
					...excelKeywords.map((keyword) => normalizeFieldKey(keyword)),
				];
				let rawValue: unknown = null;
				for (const candidate of candidateKeys) {
					if (candidate && candidate in record) {
						rawValue = (record as Record<string, unknown>)[candidate];
						break;
					}
					const normalizedCandidate = normalizeFieldKey(candidate);
					if (normalizedCandidate && normalizedRecord.has(normalizedCandidate)) {
						rawValue = normalizedRecord.get(normalizedCandidate);
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

		const dataFlowRecompute = await tryRecomputeObraDataFlowWritebacks({
			supabase,
			tenantId,
			obraId: id,
			actorUserId: user?.id ?? null,
			trigger: "source_change",
			allowAutoWrite: await canAutoWriteDataFlow({ supabase, tenantId }),
		});

		return NextResponse.json({ ok: true, inserted: rowsPayload.length, dataFlowRecompute });
	} catch (error) {
		console.error("[tabla-rows:csv-import]", error);
		const message = error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
