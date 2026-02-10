import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
	ensureTablaDataType,
	normalizeFieldKey,
	normalizeFolderName,
} from "@/lib/tablas";

type RouteContext = { params: Promise<{ id: string }> };

type ColumnInput = {
	label?: string;
	fieldKey?: string;
	dataType?: string;
	required?: boolean;
	config?: Record<string, unknown>;
	scope?: "parent" | "item";
};

const SOURCE_TYPES = new Set(["manual", "csv", "ocr"]);

const MATERIALS_TEMPLATE_COLUMNS: ColumnInput[] = [
	{
		label: "Cantidad",
		fieldKey: "cantidad",
		dataType: "number",
		required: true,
	},
	{ label: "Unidad", fieldKey: "unidad", dataType: "text", required: true },
	{ label: "Material", fieldKey: "material", dataType: "text", required: true },
	{
		label: "Precio Unitario",
		fieldKey: "precioUnitario",
		dataType: "currency",
	},
	{ label: "Proveedor", fieldKey: "proveedor", dataType: "text" },
	{ label: "N° Orden", fieldKey: "nroOrden", dataType: "text" },
	{ label: "Solicitante", fieldKey: "solicitante", dataType: "text" },
	{ label: "Gestor", fieldKey: "gestor", dataType: "text" },
];

function toColumnResponse(record: any) {
	return {
		id: record.id as string,
		tablaId: record.tabla_id as string,
		fieldKey: record.field_key as string,
		label: record.label as string,
		dataType: ensureTablaDataType(record.data_type as string | undefined),
		required: Boolean(record.required),
		position: record.position ?? 0,
		config: record.config ?? {},
	};
}

export async function GET(_req: Request, context: RouteContext) {
	const { id } = await context.params;
	const obraId = id;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const supabase = await createClient();
		const { data: tablas, error: tablasError } = await supabase
			.from("obra_tablas")
			.select(
				"id, obra_id, name, description, source_type, settings, created_at"
			)
			.eq("obra_id", obraId)
			.order("created_at", { ascending: true });
		if (tablasError) throw tablasError;

		const tablaIds = (tablas ?? []).map((t) => t.id as string);
		let columnsByTabla = new Map<
			string,
			ReturnType<typeof toColumnResponse>[]
		>();
		if (tablaIds.length > 0) {
			const { data: columns, error: columnsError } = await supabase
				.from("obra_tabla_columns")
				.select(
					"id, tabla_id, field_key, label, data_type, position, required, config"
				)
				.in("tabla_id", tablaIds)
				.order("position", { ascending: true });
			if (columnsError) throw columnsError;
			for (const column of columns ?? []) {
				const mapped = toColumnResponse(column);
				if (!columnsByTabla.has(mapped.tablaId)) {
					columnsByTabla.set(mapped.tablaId, []);
				}
				columnsByTabla.get(mapped.tablaId)?.push(mapped);
			}
		}

		const rowCounts = new Map<string, number>();
		if (tablaIds.length > 0) {
			const { data: countsData, error: countsError } = await supabase
				.from("obra_tabla_rows")
				.select("tabla_id, row_count:count(id)", { group: "tabla_id" } as any)
				.in("tabla_id", tablaIds);
			if (!countsError) {
				const groupedCounts =
					(countsData as unknown as
						| { tabla_id: string; row_count: number }[]
						| null) ?? [];
				for (const entry of groupedCounts) {
					rowCounts.set(entry.tabla_id, Number(entry.row_count ?? 0));
				}
			}
		}

		const result = (tablas ?? []).map((tabla) => {
			const tablaId = tabla.id as string;
			return {
				id: tablaId,
				obraId: tabla.obra_id as string,
				name: tabla.name as string,
				description: tabla.description as string | null,
				sourceType: tabla.source_type as string,
				settings: (tabla.settings as Record<string, unknown>) ?? {},
				rowCount: rowCounts.get(tablaId) ?? 0,
				columns: columnsByTabla.get(tablaId) ?? [],
			};
		});

		return NextResponse.json({ tablas: result });
	} catch (error) {
		console.error("[tablas:list]", error);
		const message =
			error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(request: Request, context: RouteContext) {
	const { id } = await context.params;
	const obraId = id;
	if (!obraId) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const rawName = typeof body.name === "string" ? body.name.trim() : "";
		if (!rawName) {
			return NextResponse.json(
				{ error: "Nombre de tabla requerido" },
				{ status: 400 }
			);
		}

		const rawColumns: ColumnInput[] = Array.isArray(body.columns)
			? body.columns
			: [];
		const requestedTemplate =
			typeof body.template === "string" ? body.template : null;
		const sourceType =
			typeof body.sourceType === "string" && SOURCE_TYPES.has(body.sourceType)
				? body.sourceType
				: requestedTemplate === "materials"
					? "ocr"
					: "manual";
		const rawOcrFolderName =
			typeof body.ocrFolderName === "string" ? body.ocrFolderName : "";
		const rawOcrDocType =
			typeof body.ocrDocType === "string" ? body.ocrDocType.trim() : "";
	const rawOcrInstructions =
			typeof body.ocrInstructions === "string"
				? body.ocrInstructions.trim()
				: "";
		const rawOcrTemplateId =
			typeof body.ocrTemplateId === "string" ? body.ocrTemplateId : null;
		const normalizedOcrFolderName = normalizeFolderName(rawOcrFolderName);
		const needsOcrFolder = sourceType === "ocr";
		if (needsOcrFolder && !normalizedOcrFolderName) {
			return NextResponse.json(
				{ error: "Debes definir un nombre de carpeta OCR válido" },
				{ status: 400 }
			);
		}
		const hasNestedData = needsOcrFolder && Boolean(body.hasNestedData);

		let normalizedColumns: ColumnInput[] = rawColumns;
		let settings: Record<string, unknown> = {};

		if (requestedTemplate === "materials") {
			normalizedColumns = MATERIALS_TEMPLATE_COLUMNS;
			settings = { ...settings, ocrProfile: "materials" };
		}

		if (needsOcrFolder) {
			const rawDataInputMethod =
				typeof body.dataInputMethod === "string" ? body.dataInputMethod : "both";
			const dataInputMethod = ["ocr", "manual", "both"].includes(rawDataInputMethod)
				? rawDataInputMethod
				: "both";
			settings = {
				...settings,
				ocrFolder: normalizedOcrFolderName,
				ocrFolderLabel: rawOcrFolderName.trim() || normalizedOcrFolderName,
				ocrNested: hasNestedData,
				ocrDocType: rawOcrDocType || null,
				ocrInstructions: rawOcrInstructions || null,
				ocrTemplateId: rawOcrTemplateId,
				dataInputMethod,
			};
		}

		if (normalizedColumns.length === 0) {
			return NextResponse.json(
				{ error: "Debe definir al menos una columna" },
				{ status: 400 }
			);
		}

		const columnsPayload = normalizedColumns.map((column, index) => {
			const label =
				typeof column.label === "string" && column.label.trim()
					? column.label.trim()
					: `Columna ${index + 1}`;
			const fieldKey = column.fieldKey
				? normalizeFieldKey(column.fieldKey)
				: normalizeFieldKey(label);
			const incomingConfig =
				column.config && typeof column.config === "object"
					? { ...column.config }
					: {};
			let config = incomingConfig;
			if (hasNestedData) {
				const scope =
					(incomingConfig?.ocrScope as "parent" | "item" | undefined) ?? "item";
				config = { ...incomingConfig, ocrScope: scope };
			} else if (config?.ocrScope) {
				const { ocrScope, ...rest } = config;
				config = rest;
			}
			if (incomingConfig?.ocrDescription && typeof incomingConfig?.ocrDescription === "string") {
				config = { ...config, ocrDescription: incomingConfig.ocrDescription };
			}
			return {
				field_key: fieldKey,
				label,
				data_type: ensureTablaDataType(column.dataType ?? "text"),
				required: Boolean(column.required),
				position: index,
				config,
			};
		});

		const fieldKeys = new Set(columnsPayload.map((col) => col.field_key));
		if (fieldKeys.size !== columnsPayload.length) {
			return NextResponse.json(
				{ error: "Las columnas deben tener nombres únicos" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		if (needsOcrFolder && normalizedOcrFolderName) {
			const { data: existingOcr, error: existingOcrError } = await supabase
				.from("obra_tablas")
				.select("id, settings")
				.eq("obra_id", obraId)
				.eq("source_type", "ocr");
			if (existingOcrError) throw existingOcrError;
			const folderTaken = (existingOcr ?? []).some((tabla) => {
				const tablaSettings = (tabla.settings as Record<string, unknown>) ?? {};
				const folderValueRaw = tablaSettings["ocrFolder"];
				const folderValue =
					typeof folderValueRaw === "string" ? folderValueRaw : "";
				return folderValue === normalizedOcrFolderName;
			});
			if (folderTaken) {
				return NextResponse.json(
					{ error: "Ya existe una tabla OCR asociada a esa carpeta" },
					{ status: 400 }
				);
			}
		}
		const { data: tabla, error: tablaError } = await supabase
			.from("obra_tablas")
			.insert({
				obra_id: obraId,
				name: rawName,
				description:
					typeof body.description === "string" ? body.description : null,
				source_type: sourceType,
				settings,
			})
			.select("id, obra_id, name, description, source_type, settings")
			.single();
		if (tablaError) throw tablaError;

		const tablaId = tabla.id as string;
		const insertPayload = columnsPayload.map((column) => ({
			tabla_id: tablaId,
			...column,
		}));

		const { error: columnsError, data: insertedColumns } = await supabase
			.from("obra_tabla_columns")
			.insert(insertPayload)
			.select(
				"id, tabla_id, field_key, label, data_type, position, required, config"
			)
			.order("position", { ascending: true });

		if (columnsError) {
			await supabase.from("obra_tablas").delete().eq("id", tablaId);
			throw columnsError;
		}

		if (needsOcrFolder && normalizedOcrFolderName) {
			const folderKey = `${obraId}/${normalizedOcrFolderName}/.keep`;
			try {
				const { error: folderError } = await supabase.storage
					.from("obra-documents")
					.upload(folderKey, new Blob([""], { type: "text/plain" }), {
						upsert: true,
					});
				if (folderError) {
					console.error(
						"[tablas:create] OCR folder creation failed",
						folderError
					);
				}
			} catch (storageError) {
				console.error("[tablas:create] Unexpected storage error", storageError);
			}
		}

		return NextResponse.json({
			tabla: {
				id: tablaId,
				obraId: tabla.obra_id as string,
				name: tabla.name as string,
				description: tabla.description as string | null,
				sourceType: tabla.source_type as string,
				settings: tabla.settings ?? {},
				rowCount: 0,
				columns: (insertedColumns ?? []).map(toColumnResponse),
			},
		});
	} catch (error) {
		console.error("[tablas:create]", error);
		const message =
			error instanceof Error ? error.message : "Error desconocido";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
