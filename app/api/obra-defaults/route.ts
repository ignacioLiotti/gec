import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { normalizeFolderName, normalizeFieldKey, ensureTablaDataType, type TablaColumnDataType } from "@/lib/tablas";

type DefaultFolder = {
	id: string;
	name: string;
	path: string;
	position: number;
};

type DefaultTablaColumn = {
	id: string;
	field_key: string;
	label: string;
	data_type: TablaColumnDataType;
	position: number;
	required: boolean;
	config: Record<string, unknown>;
};

type DefaultTabla = {
	id: string;
	name: string;
	description: string | null;
	source_type: "manual" | "csv" | "ocr";
	linked_folder_path: string | null;
	settings: Record<string, unknown>;
	position: number;
	ocr_template_id?: string | null;
	columns: DefaultTablaColumn[];
};

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

	return { supabase, user, tenantId: membership?.tenant_id ?? null };
}

export async function GET() {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ folders: [], tablas: [] });
	}

	try {
		const [foldersResult, tablasResult] = await Promise.all([
			supabase
				.from("obra_default_folders")
				.select("id, name, path, position")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: true }),
			supabase
				.from("obra_default_tablas")
				.select(
					"id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id"
				)
				.eq("tenant_id", tenantId)
				.order("position", { ascending: true }),
		]);

		const { data: folders, error: foldersError } = foldersResult;
		const { data: tablas, error: tablasError } = tablasResult;

		if (foldersError) {
			console.error("[obra-defaults:get] folders error:", foldersError);
			throw foldersError;
		}
		if (tablasError) {
			console.error("[obra-defaults:get] tablas error:", tablasError);
			throw tablasError;
		}

		// Fetch columns for all tablas
		const tablaIds = (tablas ?? []).map((tabla) => tabla.id);
		let columnsData: DefaultTablaColumn[] = [];

		if (tablaIds.length > 0) {
			const { data: columns, error: columnsError } = await supabase
				.from("obra_default_tabla_columns")
				.select("id, default_tabla_id, field_key, label, data_type, position, required, config")
				.in("default_tabla_id", tablaIds)
				.order("position", { ascending: true });

			if (columnsError) throw columnsError;
			columnsData = (columns ?? []) as any;
		}

		// Group columns by tabla
		const columnsByTabla = new Map<string, DefaultTablaColumn[]>();
		for (const column of columnsData) {
			const tablaId = (column as any).default_tabla_id;
			const existing = columnsByTabla.get(tablaId) ?? [];
			existing.push({
				id: column.id,
				field_key: column.field_key,
				label: column.label,
				data_type: ensureTablaDataType(column.data_type),
				position: column.position,
				required: column.required,
				config: column.config as Record<string, unknown>,
			});
			columnsByTabla.set(tablaId, existing);
		}

		const tablasWithColumns: DefaultTabla[] = (tablas ?? []).map((tabla) => ({
			id: tabla.id,
			name: tabla.name,
			description: tabla.description,
			source_type: tabla.source_type as "manual" | "csv" | "ocr",
			linked_folder_path: tabla.linked_folder_path,
			settings: (tabla.settings as Record<string, unknown>) ?? {},
			position: tabla.position,
			ocr_template_id: tabla.ocr_template_id,
			columns: columnsByTabla.get(tabla.id) ?? [],
		}));

		return NextResponse.json({
			folders: folders ?? [],
			tablas: tablasWithColumns,
		});
	} catch (error) {
		console.error("[obra-defaults:get]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error loading defaults" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json(
			{ error: "No tenant found for user" },
			{ status: 400 }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const type = body.type as "folder" | "tabla";

		if (type === "folder") {
			const rawName = typeof body.name === "string" ? body.name.trim() : "";
			if (!rawName) {
				return NextResponse.json({ error: "Folder name required" }, { status: 400 });
			}

			const path = normalizeFolderName(rawName);
			if (!path) {
				return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
			}

			// Get max position
			const { data: existing } = await supabase
				.from("obra_default_folders")
				.select("position")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: false })
				.limit(1);

			const nextPosition = (existing?.[0]?.position ?? -1) + 1;

			const { data: folder, error } = await supabase
				.from("obra_default_folders")
				.insert({
					tenant_id: tenantId,
					name: rawName,
					path,
					position: nextPosition,
				})
				.select("id, name, path, position")
				.single();

			if (error) throw error;

			return NextResponse.json({ folder });
		} else if (type === "tabla") {
			const rawName = typeof body.name === "string" ? body.name.trim() : "";
			if (!rawName) {
				return NextResponse.json({ error: "Tabla name required" }, { status: 400 });
			}

			const description = typeof body.description === "string" ? body.description : null;
			const sourceType = ["manual", "csv", "ocr"].includes(body.sourceType)
				? body.sourceType
				: "manual";
			const linkedFolderPath =
				typeof body.linkedFolderPath === "string" && body.linkedFolderPath.trim()
					? normalizeFolderName(body.linkedFolderPath)
					: null;
			const ocrTemplateId =
				typeof body.ocrTemplateId === "string" && body.ocrTemplateId.trim()
					? body.ocrTemplateId.trim()
					: null;

			const rawColumns: Array<{
				label: string;
				dataType?: string;
				required?: boolean;
				ocrScope?: string;
				fieldKey?: string;
			}> = Array.isArray(body.columns) ? body.columns : [];

			// Build settings
			const settings: Record<string, unknown> = {};
			if (sourceType === "ocr" && linkedFolderPath) {
				settings.ocrFolder = linkedFolderPath;
				if (typeof body.ocrDocType === "string" && body.ocrDocType.trim()) {
					settings.ocrDocType = body.ocrDocType.trim();
				}
				if (typeof body.ocrInstructions === "string" && body.ocrInstructions.trim()) {
					settings.ocrInstructions = body.ocrInstructions.trim();
				}
				if (body.hasNestedData) {
					settings.hasNestedData = true;
				}
				if (ocrTemplateId) {
					settings.ocrTemplateId = ocrTemplateId;
				}
			}

			// Get max position
			const { data: existing } = await supabase
				.from("obra_default_tablas")
				.select("position")
				.eq("tenant_id", tenantId)
				.order("position", { ascending: false })
				.limit(1);

			const nextPosition = (existing?.[0]?.position ?? -1) + 1;

			// Create tabla
			const { data: tabla, error: tablaError } = await supabase
				.from("obra_default_tablas")
				.insert({
					tenant_id: tenantId,
					name: rawName,
					description,
					source_type: sourceType,
					linked_folder_path: linkedFolderPath,
					settings,
					position: nextPosition,
					ocr_template_id: ocrTemplateId,
				})
				.select("id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id")
				.single();

			if (tablaError) throw tablaError;

			// Create columns
			const columnsPayload = rawColumns.map((col, index) => ({
				default_tabla_id: tabla.id,
				field_key: normalizeFieldKey(col.fieldKey || col.label),
				label: col.label,
				data_type: ensureTablaDataType(col.dataType),
				position: index,
				required: Boolean(col.required),
				config: col.ocrScope ? { ocrScope: col.ocrScope } : {},
			}));

			let insertedColumns: DefaultTablaColumn[] = [];
			if (columnsPayload.length > 0) {
				const { data: columns, error: columnsError } = await supabase
					.from("obra_default_tabla_columns")
					.insert(columnsPayload)
					.select("id, field_key, label, data_type, position, required, config")
					.order("position", { ascending: true });

				if (columnsError) {
					// Rollback tabla creation
					await supabase.from("obra_default_tablas").delete().eq("id", tabla.id);
					throw columnsError;
				}
				insertedColumns = (columns ?? []) as any;
			}

			return NextResponse.json({
				tabla: {
					...tabla,
					columns: insertedColumns,
				},
			});
		}

		return NextResponse.json({ error: "Invalid type" }, { status: 400 });
	} catch (error) {
		console.error("[obra-defaults:post]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error creating default" },
			{ status: 500 }
		);
	}
}

export async function DELETE(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant found" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const type = body.type as "folder" | "tabla";
		const id = typeof body.id === "string" ? body.id : null;

		if (!id) {
			return NextResponse.json({ error: "ID required" }, { status: 400 });
		}

		if (type === "folder") {
			const { error } = await supabase
				.from("obra_default_folders")
				.delete()
				.eq("id", id)
				.eq("tenant_id", tenantId);

			if (error) throw error;
		} else if (type === "tabla") {
			// Columns will be deleted via CASCADE
			const { error } = await supabase
				.from("obra_default_tablas")
				.delete()
				.eq("id", id)
				.eq("tenant_id", tenantId);

			if (error) throw error;
		} else {
			return NextResponse.json({ error: "Invalid type" }, { status: 400 });
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[obra-defaults:delete]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error deleting default" },
			{ status: 500 }
		);
	}
}

