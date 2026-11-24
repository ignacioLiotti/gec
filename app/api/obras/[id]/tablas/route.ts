import { NextResponse } from "next/server";
import {
	ensureTablaDataType,
	normalizeFieldKey,
	normalizeFolderName,
	normalizeFolderPath,
} from "@/lib/tablas";
import { createClient } from "@/utils/supabase/server";
import {
	hasDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";

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
	{ label: "N° Orden", fieldKey: "nroOrden", dataType: "text" },
	{ label: "Fecha", fieldKey: "fecha", dataType: "text" },
	{ label: "Solicitante", fieldKey: "solicitante", dataType: "text" },
	{ label: "Proveedor", fieldKey: "proveedor", dataType: "text" },
	{
		label: "Cantidad",
		fieldKey: "cantidad",
		dataType: "number",
		required: true,
	},
	{ label: "Unidad", fieldKey: "unidad", dataType: "text", required: true },
	{ label: "Detalle Descriptivo", fieldKey: "material", dataType: "text", required: true },
	{
		label: "Precio Unitario",
		fieldKey: "precioUnitario",
		dataType: "currency",
	},
	{ label: "Precio Total", fieldKey: "precioTotal", dataType: "currency" },
	{ label: "Total Orden", fieldKey: "totalOrden", dataType: "currency" },
];

function toColumnResponse(record: {
	id: string;
	tabla_id: string;
	field_key: string;
	label: string;
	data_type: string;
	required: boolean;
	position: number;
	config: unknown;
}) {
	return {
		id: record.id,
		tablaId: record.tabla_id,
		fieldKey: record.field_key,
		label: record.label,
		dataType: ensureTablaDataType(record.data_type),
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

		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select(`
				obra_tablas(
					id, obra_id, name, description, source_type, settings, created_at,
					obra_tabla_rows(count),
					obra_tabla_columns(id, tabla_id, field_key, label, data_type, position, required, config)
				)
			`)
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.order("created_at", { referencedTable: "obra_tablas", ascending: true })
			.order("position", { referencedTable: "obra_tablas.obra_tabla_columns", ascending: true })
			.maybeSingle();
		if (obraError) throw obraError;
		if (!obra) {
			return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		}

		const result = (obra.obra_tablas ?? []).map((tabla) => {
			const tablaId = tabla.id as string;
			return {
				id: tablaId,
				obraId: tabla.obra_id as string,
				name: tabla.name as string,
				description: tabla.description as string | null,
				sourceType: tabla.source_type as string,
				settings: (tabla.settings as Record<string, unknown>) ?? {},
				rowCount: tabla.obra_tabla_rows?.[0]?.count ?? 0,
				columns: (tabla.obra_tabla_columns ?? []).map(toColumnResponse),
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
		const rawOcrFolderPath =
			typeof body.ocrFolderPath === "string" ? body.ocrFolderPath : "";
		const rawOcrDocType =
			typeof body.ocrDocType === "string" ? body.ocrDocType.trim() : "";
		const rawOcrInstructions =
			typeof body.ocrInstructions === "string"
				? body.ocrInstructions.trim()
				: "";
		const documentTypes = Array.isArray(body.documentTypes)
			? body.documentTypes
					.filter((value: unknown): value is string => typeof value === "string")
					.map((value: string) => value.trim())
					.filter(Boolean)
			: [];
		const extractionInstructions =
			typeof body.extractionInstructions === "string"
				? body.extractionInstructions.trim()
				: "";
		const rawOcrTemplateId =
			typeof body.ocrTemplateId === "string" ? body.ocrTemplateId : null;
		const rawSpreadsheetTemplate =
			typeof body.spreadsheetTemplate === "string"
				? body.spreadsheetTemplate.trim()
				: "";
		const normalizedOcrFolderPath = normalizeFolderPath(
			rawOcrFolderPath || rawOcrFolderName
		);
		const normalizedOcrFolderName = normalizeFolderName(
			normalizedOcrFolderPath.split("/").pop() ?? rawOcrFolderName
		);
		const needsOcrFolder = sourceType === "ocr";
		if (needsOcrFolder && !normalizedOcrFolderPath) {
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
				ocrFolder: normalizedOcrFolderPath,
				ocrFolderLabel: rawOcrFolderName.trim() || normalizedOcrFolderName,
				ocrNested: hasNestedData,
				ocrDocType: rawOcrDocType || null,
				ocrInstructions: rawOcrInstructions || null,
				ocrTemplateId: rawOcrTemplateId,
				spreadsheetTemplate: rawSpreadsheetTemplate || "auto",
				dataInputMethod,
			};
			if (documentTypes.length > 0) {
				settings.extractionDocumentTypes = documentTypes;
			}
			if (extractionInstructions) {
				settings.extractionInstructions = extractionInstructions;
			}
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

		// Allow N OCR tables per folder path. Extraction fan-out is handled in file-manager upload/retry.
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

		if (needsOcrFolder && normalizedOcrFolderPath) {
			const folderKey = `${obraId}/${normalizedOcrFolderPath}/.keep`;
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
