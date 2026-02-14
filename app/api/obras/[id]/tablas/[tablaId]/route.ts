import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
	coerceValueForType,
	ensureTablaDataType,
	evaluateTablaFormula,
	normalizeFieldKey,
} from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string; tablaId: string }> };

type ColumnInput = {
	id?: string;
	label?: string;
	fieldKey?: string;
	dataType?: string;
	required?: boolean;
	config?: Record<string, unknown>;
};

type PersistedColumn = {
	id: string;
	field_key: string;
	label: string;
	data_type: ReturnType<typeof ensureTablaDataType>;
	required: boolean;
	position: number;
	config: Record<string, unknown>;
};

function normalizeColumnInput(column: ColumnInput, index: number) {
	const label =
		typeof column.label === "string" && column.label.trim()
			? column.label.trim()
			: `Columna ${index + 1}`;
	const fieldKey = normalizeFieldKey(
		typeof column.fieldKey === "string" && column.fieldKey.trim()
			? column.fieldKey
			: label
	);
	const config =
		column.config && typeof column.config === "object"
			? { ...column.config }
			: {};
	return {
		id: typeof column.id === "string" && column.id ? column.id : undefined,
		label,
		field_key: fieldKey,
		data_type: ensureTablaDataType(column.dataType),
		required: Boolean(column.required),
		position: index,
		config,
	};
}

function toResponseColumn(column: PersistedColumn) {
	return {
		id: column.id,
		fieldKey: column.field_key,
		label: column.label,
		dataType: column.data_type,
		required: Boolean(column.required),
		position: column.position ?? 0,
		config: column.config ?? {},
	};
}

export async function PATCH(request: Request, context: RouteContext) {
	const { id: obraId, tablaId } = await context.params;
	if (!obraId || !tablaId) {
		return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const rawColumns: ColumnInput[] = Array.isArray(body.columns) ? body.columns : [];
		if (rawColumns.length === 0) {
			return NextResponse.json(
				{ error: "Debe enviar al menos una columna" },
				{ status: 400 }
			);
		}

		const normalizedColumns = rawColumns.map(normalizeColumnInput);
		const uniqueFieldKeys = new Set(normalizedColumns.map((col) => col.field_key));
		if (uniqueFieldKeys.size !== normalizedColumns.length) {
			return NextResponse.json(
				{ error: "Las columnas deben tener fieldKey único" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();
		const { data: tabla, error: tablaError } = await supabase
			.from("obra_tablas")
			.select("id, obra_id, name")
			.eq("id", tablaId)
			.eq("obra_id", obraId)
			.single();
		if (tablaError || !tabla) {
			return NextResponse.json({ error: "Tabla no encontrada" }, { status: 404 });
		}

		const { data: existingColumnsData, error: existingColumnsError } = await supabase
			.from("obra_tabla_columns")
			.select("id, field_key, label, data_type, required, position, config")
			.eq("tabla_id", tablaId)
			.order("position", { ascending: true });
		if (existingColumnsError) throw existingColumnsError;
		const existingColumns = (existingColumnsData ?? []) as PersistedColumn[];
		const existingById = new Map(existingColumns.map((col) => [col.id, col]));

		for (const col of normalizedColumns) {
			if (col.id && !existingById.has(col.id)) {
				return NextResponse.json(
					{ error: "Una columna enviada no pertenece a la tabla actual" },
					{ status: 400 }
				);
			}
		}

		const incomingIds = new Set(
			normalizedColumns
				.map((col) => col.id)
				.filter((id): id is string => typeof id === "string")
		);
		const removedIds = existingColumns
			.map((col) => col.id)
			.filter((id) => !incomingIds.has(id));

		const updateExisting = normalizedColumns.filter((col) => col.id);
		const insertNew = normalizedColumns.filter((col) => !col.id);

		for (const col of updateExisting) {
			const { error: updateError } = await supabase
				.from("obra_tabla_columns")
				.update({
					field_key: col.field_key,
					label: col.label,
					data_type: col.data_type,
					required: col.required,
					position: col.position,
					config: col.config,
				})
				.eq("id", col.id as string)
				.eq("tabla_id", tablaId);
			if (updateError) throw updateError;
		}

		let insertedRows: PersistedColumn[] = [];
		if (insertNew.length > 0) {
			const { data: inserted, error: insertError } = await supabase
				.from("obra_tabla_columns")
				.insert(
					insertNew.map((col) => ({
						tabla_id: tablaId,
						field_key: col.field_key,
						label: col.label,
						data_type: col.data_type,
						required: col.required,
						position: col.position,
						config: col.config,
					}))
				)
				.select("id, field_key, label, data_type, required, position, config");
			if (insertError) throw insertError;
			insertedRows = (inserted ?? []) as PersistedColumn[];
		}

		if (removedIds.length > 0) {
			const { error: deleteError } = await supabase
				.from("obra_tabla_columns")
				.delete()
				.in("id", removedIds);
			if (deleteError) throw deleteError;
		}

		const insertedByPosition = new Map(insertedRows.map((col) => [col.position, col]));
		const nextColumns: PersistedColumn[] = normalizedColumns.map((col) => {
			if (col.id) {
				return {
					id: col.id,
					field_key: col.field_key,
					label: col.label,
					data_type: col.data_type,
					required: col.required,
					position: col.position,
					config: col.config,
				};
			}
			const inserted = insertedByPosition.get(col.position);
			if (!inserted) {
				throw new Error("No se pudo persistir una columna nueva");
			}
			return inserted;
		});

		// Migrate JSON row payloads to keep data aligned with renamed/removed/new columns.
		const { data: tablaRows, error: rowsError } = await supabase
			.from("obra_tabla_rows")
			.select("id, data, source")
			.eq("tabla_id", tablaId);
		if (rowsError) throw rowsError;

		if ((tablaRows ?? []).length > 0) {
			const sourceKeyByColumnId = new Map<string, string>();
			for (const col of normalizedColumns) {
				if (!col.id) continue;
				const previous = existingById.get(col.id);
				if (!previous) continue;
				sourceKeyByColumnId.set(col.id, previous.field_key);
			}

			const migratedRows = (tablaRows ?? []).map((row) => {
				const previousData = ((row.data as Record<string, unknown>) ?? {}) as Record<
					string,
					unknown
				>;
				const migratedData: Record<string, unknown> = {};
				for (const column of nextColumns) {
					const previousKey = sourceKeyByColumnId.get(column.id) ?? column.field_key;
					const rawValue = previousData[previousKey];
					migratedData[column.field_key] = coerceValueForType(
						column.data_type,
						rawValue
					);
				}

				// Preserve source metadata keys for traceability.
				for (const [key, value] of Object.entries(previousData)) {
					if (key.startsWith("__")) {
						migratedData[key] = value;
					}
				}

				for (const column of nextColumns) {
					const formula =
						typeof column.config?.formula === "string"
							? column.config.formula.trim()
							: "";
					if (!formula) continue;
					const computed = evaluateTablaFormula(formula, migratedData);
					migratedData[column.field_key] = coerceValueForType(
						column.data_type,
						computed
					);
				}

				return {
					id: row.id as string,
					tabla_id: tablaId,
					data: migratedData,
					source: row.source ?? "manual",
				};
			});

			const { error: upsertRowsError } = await supabase
				.from("obra_tabla_rows")
				.upsert(migratedRows, { onConflict: "id" });
			if (upsertRowsError) throw upsertRowsError;
		}

		return NextResponse.json({
			tabla: {
				id: tablaId,
				obraId: tabla.obra_id as string,
				name: tabla.name as string,
				columns: nextColumns.map(toResponseColumn),
			},
		});
	} catch (error) {
		console.error("[tablas:update-schema]", error);
		const message = error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
